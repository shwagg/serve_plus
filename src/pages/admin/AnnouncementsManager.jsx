import { useState, useEffect } from "react";
import { db } from "../../firebaseConfig";
import {
  collection, getDocs, addDoc, deleteDoc,
  doc, setDoc, getDoc, serverTimestamp, orderBy, query,
} from "firebase/firestore";
import { showToast } from "../../utils/toast";

export default function AnnouncementsManager() {
  // Banner
  const [banner, setBanner] = useState({ title: "", description: "", imageUrl: "", link: "" });
  const [bannerSaving, setBannerSaving] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState([]);
  const [form, setForm] = useState({ title: "", body: "" });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    getDoc(doc(db, "systemConfig", "banner")).then((snap) => {
      if (snap.exists()) setBanner(snap.data());
    });
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const q = query(collection(db, "adminAnnouncements"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      // collection may not exist yet — that's fine
    }
  };

  const saveBanner = async () => {
    setBannerSaving(true);
    try {
      await setDoc(doc(db, "systemConfig", "banner"), banner);
      showToast("Banner saved!", "success");
    } catch {
      showToast("Failed to save banner.", "error");
    } finally {
      setBannerSaving(false);
    }
  };

  const postAnnouncement = async () => {
    if (!form.title.trim()) return;
    setPosting(true);
    try {
      await addDoc(collection(db, "adminAnnouncements"), {
        title: form.title.trim(),
        body: form.body.trim(),
        createdAt: serverTimestamp(),
      });
      setForm({ title: "", body: "" });
      showToast("Announcement posted!", "success");
      loadAnnouncements();
    } catch {
      showToast("Failed to post announcement.", "error");
    } finally {
      setPosting(false);
    }
  };

  const deleteAnnouncement = async (id) => {
    try {
      await deleteDoc(doc(db, "adminAnnouncements", id));
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

  return (
    <div className="admin-outlet content">
      <h1 className="page-title">Announcements &amp; Banner</h1>

      {/* Banner */}
      <div className="card">
        <div className="card-header">Promotional Banner</div>
        <div className="card-body">
          <p className="card-note" style={{ marginBottom: 14 }}>
            Controls the banner displayed on the student home screen.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="ann-input"
              placeholder="Title"
              value={banner.title}
              onChange={(e) => setBanner((b) => ({ ...b, title: e.target.value }))}
            />
            <textarea
              className="ann-input"
              placeholder="Description"
              rows={2}
              value={banner.description}
              onChange={(e) => setBanner((b) => ({ ...b, description: e.target.value }))}
            />
            <input
              className="ann-input"
              placeholder="Image URL"
              value={banner.imageUrl}
              onChange={(e) => setBanner((b) => ({ ...b, imageUrl: e.target.value }))}
            />
            <input
              className="ann-input"
              placeholder="Button link (e.g. /student/home)"
              value={banner.link}
              onChange={(e) => setBanner((b) => ({ ...b, link: e.target.value }))}
            />
            <button
              className="btn-primary"
              style={{ alignSelf: "flex-start" }}
              onClick={saveBanner}
              disabled={bannerSaving}
            >
              {bannerSaving ? "Saving…" : "Save Banner"}
            </button>
          </div>
        </div>
      </div>

      {/* Post new announcement */}
      <div className="card">
        <div className="card-header">Post Announcement</div>
        <div className="card-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              className="ann-input"
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <textarea
              className="ann-input"
              placeholder="Message (optional)"
              rows={3}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            />
            <button
              className="btn-primary"
              style={{ alignSelf: "flex-start" }}
              onClick={postAnnouncement}
              disabled={posting || !form.title.trim()}
            >
              {posting ? "Posting…" : "Post"}
            </button>
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
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1f3b73" }}>
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
