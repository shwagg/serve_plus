import { useState, useEffect, Fragment } from "react";
import { db } from "../../firebaseConfig";
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, serverTimestamp, orderBy, query,
} from "firebase/firestore";
import { showToast } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";
import { notifyEventParticipants } from "../../utils/notificationUtils";
import "../../styles/ticker.css";
import servePlusIcon from '../../assets/serve_plus_icon.svg';

export default function AnnouncementsManager() {
  const [announcements, setAnnouncements] = useState([]);
  const [missions, setMissions] = useState([]);
  const [form, setForm] = useState({ title: "", body: "", type: "global", eventId: null });
  const [draftPreview, setDraftPreview] = useState({ title: "", body: "" });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadAnnouncements();
    loadMissions();
  }, []);

  const loadMissions = async () => {
    try {
      const q = query(collection(db, "missions"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setMissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error("Error loading missions:", error);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const q = query(collection(db, "adminAnnouncements"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // collection may not exist yet — that's fine
    }
  };

  const postAnnouncement = async () => {
    if (!form.title.trim()) return;
    
    // For event-specific announcements, require event selection
    if (form.type === "event" && !form.eventId) {
      showToast("Please select an event.", "error");
      return;
    }

    setPosting(true);
    try {
      // Only save GLOBAL announcements to the database
      if (form.type === "global") {
        await addDoc(collection(db, "adminAnnouncements"), {
          title: form.title.trim(),
          body: form.body.trim(),
          type: "global",
          createdAt: serverTimestamp(),
        });
      }

      // If it's an event-specific announcement, notify all participants (don't save to DB)
      if (form.type === "event") {
        const selectedMission = missions.find(m => m.id === form.eventId);
        await notifyEventParticipants(form.eventId, {
          type: "event_announcement",
          title: form.title.trim(),
          message: form.body.trim(),
          link: `/event/${form.eventId}/activity?mode=active`,
        }).catch(err => {
          console.warn("Failed to notify participants:", err);
          throw err;
        });
      }

      logAudit({
        action: form.type === "event" ? "EVENT_ANNOUNCEMENT_POSTED" : "ANNOUNCEMENT_POSTED",
        category: "system",
        details: {
          announcementTitle: form.title.trim(),
          ...(form.type === "event" && { eventId: form.eventId, eventTitle: missions.find(m => m.id === form.eventId)?.title }),
        },
      });

      setForm({ title: "", body: "", type: "global", eventId: null });
      setDraftPreview({ title: "", body: "" });
      showToast(form.type === "event" ? "Event announcement posted and notifications sent!" : "Announcement posted!", "success");
      loadAnnouncements();
    } catch (error) {
      console.error("Error posting announcement:", error);
      showToast("Failed to post announcement.", "error");
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      await deleteDoc(doc(db, "adminAnnouncements", id));
      logAudit({
        action: "ANNOUNCEMENT_DELETED",
        category: "system",
        details: { announcementTitle: announcements.find(a => a.id === id)?.title || "" },
      });
      showToast("Deleted.", "success");
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      showToast("Failed to delete.", "error");
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };

  const handleInputBlur = () => {
    setDraftPreview({ title: form.title.trim(), body: form.body.trim() });
  };

  const previewItems = [
    ...(form.type === "global" && draftPreview.title ? [draftPreview] : []),
    ...announcements,
  ];
  const renderPreviewItems = (items, keyPrefix = '') =>
    items.map((a, i) => (
      <Fragment key={keyPrefix + i}>
        {i > 0 && <img src={servePlusIcon} className="ticker-sep" alt="" aria-hidden="true" />}
        {a.title}{a.body ? ` — ${a.body}` : ''}
      </Fragment>
    ));

  return (
    <div className="admin-outlet content">
      <h1 className="page-title">Announcements</h1>

      {/* Post new announcement */}
      <div className="card">
        <div className="card-header">Post Announcement</div>
        <div className="card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Announcement Type Toggle */}
            <div style={{ display: "flex", gap: 12, borderBottom: "1px solid #e5e7eb", paddingBottom: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="announcementType"
                  value="global"
                  checked={form.type === "global"}
                  onChange={(e) => setForm(f => ({ ...f, type: e.target.value, eventId: null }))}
                />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Global Announcement</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input
                  type="radio"
                  name="announcementType"
                  value="event"
                  checked={form.type === "event"}
                  onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                />
                <span style={{ fontSize: 13, fontWeight: 500 }}>Event-Specific Announcement</span>
              </label>
            </div>

            {/* Event Selection - only show for event-specific announcements */}
            {form.type === "event" && (
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6, color: "#475569" }}>
                  Select Mission/Event *
                </label>
                <select
                  value={form.eventId || ""}
                  onChange={(e) => setForm(f => ({ ...f, eventId: e.target.value }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontFamily: "inherit",
                  }}
                >
                  <option value="">-- Select an event --</option>
                  {missions.map((mission) => (
                    <option key={mission.id} value={mission.id}>
                      {mission.title || "Untitled Mission"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <input
              className="ann-input"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              onBlur={handleInputBlur}
            />
            <textarea
              className="ann-input"
              placeholder="Message (optional)"
              rows={3}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              onBlur={handleInputBlur}
            />
            {form.type === "event" && (
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 8px" }}>
                ℹ️ This announcement will only appear as a notification to students who joined this event.
              </p>
            )}
            <button
              className="btn-primary"
              style={{ alignSelf: "flex-start" }}
              onClick={postAnnouncement}
              disabled={posting || !form.title.trim() || (form.type === "event" && !form.eventId)}
            >
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="card">
        <div className="card-header">Live Preview</div>
        <div className="card-body" style={{ padding: 0 }}>
          <p className="card-note" style={{ padding: '12px 16px 10px' }}>
            This is how the announcement strip appears to students — fixed above the header at the very top of the screen.
          </p>
          {/* Mock student screen */}
          <div style={{ margin: '0 16px 16px', borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            {/* Ticker */}
            <div className="ticker-preview-wrap">
              <span className="ticker-label">📢 News</span>
              <div className="ticker-track">
                {previewItems.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#475569', paddingLeft: 16 }}>
                    No announcements posted yet — your text will scroll here
                  </span>
                ) : (
                  <div className="ticker-content">
                    <span className="ticker-text">{renderPreviewItems(previewItems)}</span>
                    <span className="ticker-text" aria-hidden="true">{renderPreviewItems(previewItems, 'd-')}</span>
                  </div>
                )}
              </div>
            </div>
            {/* Mock header */}
            <div style={{ background: '#d0edfc', height: 56, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, borderBottom: '1px solid #b8ddf0' }}>
              <div style={{ width: 22, height: 22, background: '#30bdb7', borderRadius: 4, flexShrink: 0 }} />
              <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: '-0.01em' }}>
                SERVE<span style={{ color: '#30bdb7' }}>+</span>
              </span>
            </div>
            {/* Mock leaderboard */}
            <div style={{ background: '#f0f9ff', padding: '14px 16px 18px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#0f172a', marginBottom: 3 }}>Leaderboard</div>
              <div style={{ height: 9, background: '#cce6f8', borderRadius: 4, width: '52%', marginBottom: 14 }} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                {[{ h: 72, w: '30%' }, { h: 96, w: '38%' }, { h: 60, w: '30%' }].map((s, i) => (
                  <div key={i} style={{ width: s.w, height: s.h, background: '#fff', borderRadius: 8, border: '1px solid #dbeafe' }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="card-header">Posted Announcements</div>
        <div className="card-body">
          {announcements.length === 0 ? (
            <div className="empty-state">
              <p className="empty-title">No announcements yet</p>
              <p className="empty-desc">
                Post an announcement above to notify students.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {announcements.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "12px 0",
                    borderBottom: i < announcements.length - 1 ? "1px solid #e5e7eb" : "none",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#000" }}>
                      {a.title}
                    </div>
                    {a.body && (
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                        {a.body}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                      {formatDate(a.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteAnnouncement(a.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ef4444",
                      cursor: "pointer",
                      fontSize: 12,
                      flexShrink: 0,
                      padding: "2px 0",
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
