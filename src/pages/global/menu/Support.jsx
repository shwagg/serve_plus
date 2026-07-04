import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../../components/Header";
import { db, auth } from "../../../firebaseConfig";
import {
  collection, addDoc, serverTimestamp, query, where,
  orderBy, onSnapshot, doc, updateDoc,
} from "firebase/firestore";
import "./Support.css";
import { logAudit } from "../../../utils/auditLogger";

const TYPES = [
  { value: "Suggestion", icon: "💡", desc: "Share an idea or improvement" },
  { value: "Bug Report", icon: "🐛", desc: "Something isn't working right" },
  { value: "Question",   icon: "❓", desc: "Need help or clarification" },
];

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function StatusBadge({ status }) {
  return (
    <span className={`support-thread-status ${status}`}>
      {status === "resolved" ? "Resolved" : "Open"}
    </span>
  );
}

export default function Support() {
  const navigate = useNavigate();
  const user = auth.currentUser;

  const [type, setType] = useState("Suggestion");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Threads
  const [tickets, setTickets] = useState([]);
  const [expandedTicket, setExpandedTicket] = useState(null);
  const [replyText, setReplyText] = useState({});
  const [sendingReply, setSendingReply] = useState(null);
  const messageEndRefs = useRef({});

  // Load user's tickets + per-ticket message listeners
  useEffect(() => {
    if (!user?.uid) return;

    const ticketsQ = query(
      collection(db, "support"),
      where("submittedBy", "==", user.uid),
      orderBy("lastMessageAt", "desc"),
    );

    let messageUnsubs = [];

    const unsubTickets = onSnapshot(ticketsQ, (snap) => {
      messageUnsubs.forEach((u) => u());
      messageUnsubs = [];

      const newTickets = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        messages: [],
      }));
      setTickets(newTickets);

      snap.docs.forEach((ticketDoc) => {
        const messagesQ = query(
          collection(db, "support", ticketDoc.id, "messages"),
          orderBy("sentAt", "asc"),
        );
        const unsub = onSnapshot(messagesQ, (msgSnap) => {
          const messages = msgSnap.docs.map((m) => ({ id: m.id, ...m.data() }));
          setTickets((prev) =>
            prev.map((t) => (t.id === ticketDoc.id ? { ...t, messages } : t))
          );
        });
        messageUnsubs.push(unsub);
      });
    });

    return () => {
      unsubTickets();
      messageUnsubs.forEach((u) => u());
    };
  }, [user?.uid]);

  // Scroll to bottom of expanded thread when messages change
  useEffect(() => {
    if (!expandedTicket) return;
    const el = messageEndRefs.current[expandedTicket];
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [tickets, expandedTicket]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const ticketRef = await addDoc(collection(db, "support"), {
        type,
        preview: message.trim().slice(0, 120),
        submittedBy: user?.uid || null,
        submittedByEmail: user?.email || null,
        submittedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        status: "open",
      });
      await addDoc(collection(db, "support", ticketRef.id, "messages"), {
        text: message.trim(),
        from: "user",
        senderName: user?.displayName || user?.email || "You",
        sentAt: serverTimestamp(),
      });
      logAudit({
        action: "SUPPORT_TICKET_CREATED",
        category: "system",
        actorName: user?.displayName || user?.email || "",
        details: {
          ticketId: ticketRef.id,
          ticketType: type,
          ticketPreview: message.trim().slice(0, 120),
        },
      });
      setSuccess(true);
      setMessage("");
      setType("Suggestion");
      setExpandedTicket(ticketRef.id);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  };

  const handleReply = async (ticketId) => {
    const text = (replyText[ticketId] || "").trim();
    if (!text) return;
    setSendingReply(ticketId);
    try {
      await addDoc(collection(db, "support", ticketId, "messages"), {
        text,
        from: "user",
        senderName: user?.displayName || user?.email || "You",
        sentAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "support", ticketId), {
        lastMessageAt: serverTimestamp(),
        status: "open",
      });
      logAudit({
        action: "SUPPORT_MESSAGE_SENT",
        category: "system",
        actorName: user?.displayName || user?.email || "",
        details: {
          ticketId,
          messagePreview: text.slice(0, 120),
          sentBy: "user",
        },
      });
      setReplyText((prev) => ({ ...prev, [ticketId]: "" }));
    } catch (err) {
      console.error(err);
    }
    setSendingReply(null);
  };

  return (
    <div className="support-page">
      <Header />
      <div className="support-body">

        {/* Back */}
        <div className="support-back-row">
          <button className="support-back-btn" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>

        {/* Hero */}
        <div className="support-hero">
          <h1 className="support-hero-title">Support</h1>
          <p className="support-hero-sub">
            Have a question, spotted a bug, or want to share an idea? We'd love to hear from you.
          </p>
        </div>

        <div className="support-content">

          {/* FAQ link */}
          <div className="support-card support-faq-card">
            <div className="support-faq-left">
              <span className="support-faq-icon">💡</span>
              <div>
                <h3 className="support-card-title">Frequently Asked Questions</h3>
                <p className="support-card-desc">
                  Find quick answers to common questions about using the platform.
                </p>
              </div>
            </div>
            <button className="support-faq-btn" onClick={() => navigate("/global/faq")}>
              View FAQs →
            </button>
          </div>

          {/* Send message form */}
          <div className="support-card">
            <h3 className="support-card-title">Send us a message</h3>
            <p className="support-card-desc">
              Share a suggestion, report an issue, or ask us anything.
            </p>

            {success ? (
              <div className="support-success">
                <span className="support-success-icon">✓</span>
                <div>
                  <p className="support-success-title">Message sent!</p>
                  <p className="support-success-sub">Thanks for reaching out. We'll look into it.</p>
                </div>
                <button className="support-send-another" onClick={() => setSuccess(false)}>
                  Send another
                </button>
              </div>
            ) : (
              <form className="support-form" onSubmit={handleSubmit}>
                <div className="support-type-row">
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`support-type-card${type === t.value ? " active" : ""}`}
                      onClick={() => setType(t.value)}
                    >
                      <span className="support-type-card-icon">{t.icon}</span>
                      <span className="support-type-card-label">{t.value}</span>
                      <span className="support-type-card-desc">{t.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="support-field">
                  <label className="support-label">Message</label>
                  <textarea
                    className="support-textarea"
                    rows={5}
                    placeholder={
                      type === "Suggestion"
                        ? "What feature or improvement would you like to see?"
                        : type === "Bug Report"
                        ? "Describe what happened, what you expected, and the steps to reproduce…"
                        : "What would you like to know?"
                    }
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                {error && <p className="support-error">{error}</p>}

                <button
                  type="submit"
                  className="support-submit-btn"
                  disabled={submitting || !message.trim()}
                >
                  {submitting ? "Sending…" : "Send Message"}
                </button>
              </form>
            )}
          </div>

          {/* Contact info */}
          <div className="support-card support-contact-card">
            <span className="support-contact-icon">✉️</span>
            <div>
              <h3 className="support-card-title">Still need help?</h3>
              <p className="support-card-desc">
                Reach us directly at{" "}
                <a href="mailto:support@serveplus.edu" className="support-email-link">
                  support@serveplus.edu
                </a>
                . We typically respond within 1–2 business days.
              </p>
            </div>
          </div>

          {/* Support threads — only shown if user has submitted tickets */}
          {tickets.length > 0 && (
            <div className="support-threads-section">
              <h3 className="support-threads-heading">Your conversations</h3>
              <p className="support-threads-sub">
                Track your submitted messages and replies from our team.
              </p>

              {tickets.map((ticket) => {
                const isOpen = expandedTicket === ticket.id;
                const devMessages = ticket.messages?.filter((m) => m.from === "developer") || [];
                const hasUnread = devMessages.length > 0;

                return (
                  <div key={ticket.id} className={`support-thread-card${isOpen ? " open" : ""}`}>
                    {/* Thread header — click to expand/collapse */}
                    <button
                      className="support-thread-header"
                      onClick={() => setExpandedTicket(isOpen ? null : ticket.id)}
                    >
                      <div className="support-thread-header-left">
                        <span className="support-thread-type-badge">{ticket.type}</span>
                        <StatusBadge status={ticket.status || "open"} />
                        {hasUnread && !isOpen && (
                          <span className="support-thread-unread-dot" title="Reply from support team" />
                        )}
                      </div>
                      <div className="support-thread-header-right">
                        <span className="support-thread-date">{formatDate(ticket.submittedAt)}</span>
                        <span className="support-thread-chevron">{isOpen ? "▲" : "▼"}</span>
                      </div>
                    </button>

                    {/* Preview when collapsed */}
                    {!isOpen && (
                      <p className="support-thread-preview">{ticket.preview}</p>
                    )}

                    {/* Full thread when expanded */}
                    {isOpen && (
                      <div className="support-thread-body">
                        <div className="support-thread-messages">
                          {(ticket.messages || []).map((msg) => (
                            <div key={msg.id} className={`support-thread-msg ${msg.from}`}>
                              <div className="support-thread-msg-bubble">
                                <p className="support-thread-msg-text">{msg.text}</p>
                              </div>
                              <span className="support-thread-msg-meta">
                                {msg.from === "developer" ? "Support Team" : "You"}
                                {" · "}
                                {formatDate(msg.sentAt)}
                              </span>
                            </div>
                          ))}
                          <div ref={(el) => { messageEndRefs.current[ticket.id] = el; }} />
                        </div>

                        {ticket.status !== "resolved" && (
                          <div className="support-thread-reply-row">
                            <textarea
                              className="support-thread-reply-input"
                              placeholder="Write a reply…"
                              rows={2}
                              value={replyText[ticket.id] || ""}
                              onChange={(e) =>
                                setReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleReply(ticket.id);
                                }
                              }}
                            />
                            <button
                              className="support-thread-reply-btn"
                              disabled={!replyText[ticket.id]?.trim() || sendingReply === ticket.id}
                              onClick={() => handleReply(ticket.id)}
                            >
                              {sendingReply === ticket.id ? "…" : "Send"}
                            </button>
                          </div>
                        )}

                        {ticket.status === "resolved" && (
                          <p className="support-thread-resolved-note">
                            ✓ This ticket has been marked as resolved.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
