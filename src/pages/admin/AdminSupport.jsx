import { useState, useEffect, useRef } from "react";
import { db, auth } from "../../firebaseConfig";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import "../../styles/adminSupport.css";

const STATUS_FILTERS = ["All", "Open", "Resolved"];
const TYPE_FILTERS  = ["All", "Suggestion", "Bug Report", "Question"];

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminSupport() {
  const user = auth.currentUser;

  const [tickets, setTickets]             = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText]         = useState("");
  const [sending, setSending]             = useState(false);
  const [statusFilter, setStatusFilter]   = useState("All");
  const [typeFilter, setTypeFilter]       = useState("All");
  const [search, setSearch]               = useState("");
  const messageEndRef = useRef(null);

  // Load all tickets + per-ticket message listeners
  useEffect(() => {
    const ticketsQ = query(
      collection(db, "support"),
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

      // Keep selected ticket in sync
      setSelectedTicket((prev) =>
        prev ? newTickets.find((t) => t.id === prev.id) || null : null
      );

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
          setSelectedTicket((prev) =>
            prev?.id === ticketDoc.id ? { ...prev, messages } : prev
          );
        });
        messageUnsubs.push(unsub);
      });
    });

    return () => {
      unsubTickets();
      messageUnsubs.forEach((u) => u());
    };
  }, []);

  // Scroll to latest message when thread opens / new message arrives
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedTicket?.messages]);

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setReplyText("");
  };

  const handleReply = async () => {
    const text = replyText.trim();
    if (!text || !selectedTicket) return;
    setSending(true);
    try {
      await addDoc(
        collection(db, "support", selectedTicket.id, "messages"),
        {
          text,
          from: "developer",
          senderName: user?.displayName || user?.email || "Support Team",
          sentAt: serverTimestamp(),
        }
      );
      await updateDoc(doc(db, "support", selectedTicket.id), {
        lastMessageAt: serverTimestamp(),
        status: "open",
      });
      setReplyText("");
    } catch (err) {
      console.error(err);
    }
    setSending(false);
  };

  const toggleResolved = async (ticket) => {
    const newStatus = ticket.status === "resolved" ? "open" : "resolved";
    await updateDoc(doc(db, "support", ticket.id), { status: newStatus });
  };

  // Filtered ticket list
  const term = search.trim().toLowerCase();
  const filtered = tickets.filter((t) => {
    if (statusFilter !== "All" && t.status !== statusFilter.toLowerCase()) return false;
    if (typeFilter !== "All" && t.type !== typeFilter) return false;
    if (term && !(t.preview || "").toLowerCase().includes(term) &&
        !(t.submittedByEmail || "").toLowerCase().includes(term) &&
        !(t.type || "").toLowerCase().includes(term)) return false;
    return true;
  });

  return (
    <div className="as-root">
      {/* ── Left panel ── */}
      <aside className="as-sidebar">
        <div className="as-sidebar-top">
          <h2 className="as-sidebar-title">Support Inbox</h2>
          <span className="as-badge">{tickets.filter((t) => t.status !== "resolved").length} open</span>
        </div>

        <input
          className="as-search"
          placeholder="Search by email, type, preview…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="as-filters">
          <div className="as-filter-row">
            <span className="as-filter-label">Status</span>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                className={`as-filter-btn${statusFilter === f ? " active" : ""}`}
                onClick={() => setStatusFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="as-filter-row">
            <span className="as-filter-label">Type</span>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                className={`as-filter-btn${typeFilter === f ? " active" : ""}`}
                onClick={() => setTypeFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="as-ticket-list">
          {filtered.length === 0 && (
            <p className="as-empty">No tickets match your filters.</p>
          )}
          {filtered.map((ticket) => (
            <button
              key={ticket.id}
              className={`as-ticket-row${selectedTicket?.id === ticket.id ? " selected" : ""}`}
              onClick={() => handleSelectTicket(ticket)}
            >
              <div className="as-ticket-row-top">
                <span className="as-ticket-type">{ticket.type}</span>
                <span className={`as-ticket-status ${ticket.status || "open"}`}>
                  {ticket.status === "resolved" ? "Resolved" : "Open"}
                </span>
              </div>
              <p className="as-ticket-preview">{ticket.preview}</p>
              <div className="as-ticket-meta">
                <span>{ticket.submittedByEmail || "—"}</span>
                <span>{formatDate(ticket.submittedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Right panel ── */}
      <main className="as-main">
        {!selectedTicket ? (
          <div className="as-empty-state">
            <span className="as-empty-icon">💬</span>
            <p className="as-empty-title">Select a ticket to view the conversation</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="as-thread-header">
              <div className="as-thread-header-left">
                <span className="as-thread-type">{selectedTicket.type}</span>
                <span className={`as-ticket-status ${selectedTicket.status || "open"}`}>
                  {selectedTicket.status === "resolved" ? "Resolved" : "Open"}
                </span>
              </div>
              <div className="as-thread-header-right">
                <span className="as-thread-email">{selectedTicket.submittedByEmail}</span>
                <button
                  className={`as-resolve-btn${selectedTicket.status === "resolved" ? " undo" : ""}`}
                  onClick={() => toggleResolved(selectedTicket)}
                >
                  {selectedTicket.status === "resolved" ? "Re-open" : "Mark Resolved"}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="as-messages">
              {(selectedTicket.messages || []).map((msg) => (
                <div key={msg.id} className={`as-msg ${msg.from}`}>
                  <div className="as-msg-bubble">
                    <p className="as-msg-text">{msg.text}</p>
                  </div>
                  <span className="as-msg-meta">
                    {msg.from === "developer" ? `You (${msg.senderName})` : msg.senderName}
                    {" · "}
                    {formatDate(msg.sentAt)}
                  </span>
                </div>
              ))}
              <div ref={messageEndRef} />
            </div>

            {/* Reply input */}
            {selectedTicket.status !== "resolved" ? (
              <div className="as-reply-row">
                <textarea
                  className="as-reply-input"
                  placeholder="Type your reply… (Enter to send, Shift+Enter for new line)"
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleReply();
                    }
                  }}
                />
                <button
                  className="as-reply-btn"
                  disabled={!replyText.trim() || sending}
                  onClick={handleReply}
                >
                  {sending ? "Sending…" : "Send Reply"}
                </button>
              </div>
            ) : (
              <div className="as-resolved-note">
                ✓ Ticket resolved — re-open to reply.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
