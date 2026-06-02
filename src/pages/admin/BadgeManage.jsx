import React, { useEffect, useState, useContext, useMemo, useRef } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  where,
  limit,
  doc,
  setDoc,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../firebaseConfig";
import {
  BADGE_DEFINITIONS,
  BADGE_CATEGORIES,
} from "../../constants/badgeDefinitions";
import { awardBadge, getStudentBadges } from "../../hooks/badgeSystem";
import BadgeIcon from "../../components/badges/BadgeIcon";
import { SessionContext } from "../../context/SessionContext";
import { logAudit } from "../../utils/auditLogger";
import "../../styles/Badge.css";

async function loadBadgeConfigs() {
  const [overridesSnap, customSnap] = await Promise.all([
    getDocs(collection(db, "badgeOverrides")),
    getDocs(collection(db, "customBadges")),
  ]);
  const overrides = {};
  overridesSnap.docs.forEach((d) => { overrides[d.id] = d.data(); });
  const customs = customSnap.docs.map((d) => ({ _docId: d.id, ...d.data() }));
  return { overrides, customs };
}

async function uploadBadgeImage(file, badgeId) {
  const ext = file.name.split(".").pop();
  const storageRef = ref(storage, `badges/custom/${badgeId}_${Date.now()}.${ext}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

async function hasBadgeBeenAwarded(badgeId) {
  const q = query(collectionGroup(db, "badges"), where("badgeId", "==", badgeId), limit(1));
  const snap = await getDocs(q);
  return !snap.empty;
}

// ─── Badge image slot with inline upload ────────────────────────────────────
// Sits in the same left slot as the BadgeIcon — clicking it replaces the image.

function BadgeImgSlotEdit({ currentImageUrl, badgeId, svgId, onFile, showRequired = false, onReject, hideHint = false }) {
  const inputRef = useRef();
  const [preview, setPreview] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
    if (!isSvg) {
      e.target.value = "";
      onReject?.("Badge icon must be an SVG file (.svg). Please upload an SVG.");
      return;
    }
    setPreview(URL.createObjectURL(file));
    onFile(file);
  };

  const isEmpty = !preview && !currentImageUrl && !badgeId;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      {showRequired && !hideHint && (
        <span className="bm-img-slot-bg-hint">⚠ Use transparent background</span>
      )}
      <div
        className={`bm-img-slot-edit${isEmpty && showRequired ? " bm-img-slot-required" : ""}`}
        onClick={() => inputRef.current.click()}
        title="SVG only — use a transparent background"
      >
        {preview ? (
          <img src={preview} alt="" className="bm-img-slot-img" />
        ) : currentImageUrl ? (
          <img src={currentImageUrl} alt="" className="bm-img-slot-img" />
        ) : badgeId ? (
          <BadgeIcon badgeId={svgId ?? badgeId} earned size="sm" />
        ) : (
          <div className="bm-img-slot-empty" />
        )}
        <div className="bm-img-slot-overlay">↑</div>
        <input
          ref={inputRef}
          type="file"
          accept=".svg,image/svg+xml"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
      {isEmpty && showRequired && (
        <span className="bm-img-slot-required-label">Required</span>
      )}
    </div>
  );
}

// ─── Badge Catalog Tab ───────────────────────────────────────────────────────

function BadgeCatalogTab({ mergedDefs, onRefresh }) {
  const [editingId, setEditingId]       = useState(null);
  const [editForm, setEditForm]         = useState({ name: "", description: "", criteria: "" });
  const [editFile, setEditFile]         = useState(null);
  const [saving, setSaving]             = useState(false);
  const [showAdd, setShowAdd]           = useState(false);
  const [addForm, setAddForm]           = useState({ name: "", description: "", criteria: "" });
  const [addFile, setAddFile]           = useState(null);
  const [addSaving, setAddSaving]       = useState(false);
  const [deletingId, setDeletingId]     = useState(null);
  const [awardStatusMap, setAwardStatusMap] = useState({});
  const [toast, setToast]               = useState("");
  const checkingRef = useRef(new Set());

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const categories = BADGE_CATEGORIES;

  // Pre-load award status for all non-archived custom institutional badges
  useEffect(() => {
    const toCheck = mergedDefs.filter(
      (d) => d.isCustom && d.category === "institutional" && !d.archived
    );
    toCheck.forEach(async (def) => {
      if (checkingRef.current.has(def.id)) return;
      checkingRef.current.add(def.id);
      try {
        const awarded = await hasBadgeBeenAwarded(def.id);
        setAwardStatusMap((prev) => ({ ...prev, [def.id]: awarded ? "awarded" : "none" }));
      } catch (e) {
        console.error("hasBadgeBeenAwarded:", e);
        setAwardStatusMap((prev) => ({ ...prev, [def.id]: "none" }));
      }
    });
  }, [mergedDefs]);

  const startEdit = (def) => {
    setEditingId(def.id);
    setEditFile(null);
    setEditForm({ name: def.name, description: def.description || "", criteria: def.criteria || "" });
  };

  const cancelEdit = () => { setEditingId(null); setEditFile(null); };

  const saveEdit = async (def) => {
    setSaving(true);
    try {
      let imageUrl = def.imageUrl || null;
      if (editFile) imageUrl = await uploadBadgeImage(editFile, def.id);

      const payload = { name: editForm.name, description: editForm.description, criteria: editForm.criteria, ...(imageUrl ? { imageUrl } : {}) };

      if (def.isCustom) {
        await setDoc(doc(db, "customBadges", def._docId), {
          ...payload, id: def.id, isCustom: true,
          category: "institutional", colorTheme: "red", triggerType: "manual",
        });
      } else {
        await setDoc(doc(db, "badgeOverrides", def.id), payload);
      }
      await onRefresh();
      setEditingId(null);
      setEditFile(null);
    } catch (e) {
      console.error("saveEdit:", e);
    } finally {
      setSaving(false);
    }
  };

  const deleteCustom = async (def) => {
    if (!def.isCustom) return;
    if (!window.confirm(`Delete "${def.name}"? This cannot be undone.`)) return;
    setDeletingId(def.id);
    try {
      await deleteDoc(doc(db, "customBadges", def._docId));
      await onRefresh();
    } catch (e) {
      console.error("deleteCustom:", e);
    } finally {
      setDeletingId(null);
    }
  };

  const archiveCustom = async (def) => {
    if (!def.isCustom) return;
    if (!window.confirm(`Archive "${def.name}"? It will no longer appear for new awards, but existing records are kept.`)) return;
    setDeletingId(def.id);
    try {
      await setDoc(doc(db, "customBadges", def._docId), { archived: true }, { merge: true });
      await onRefresh();
    } catch (e) {
      console.error("archiveCustom:", e);
    } finally {
      setDeletingId(null);
    }
  };

  const saveAdd = async () => {
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    try {
      const newId = `custom-${Date.now()}`;
      let imageUrl = null;
      if (addFile) imageUrl = await uploadBadgeImage(addFile, newId);
      await addDoc(collection(db, "customBadges"), {
        id: newId,
        name: addForm.name.trim(),
        description: addForm.description.trim(),
        criteria: addForm.criteria.trim(),
        ...(imageUrl ? { imageUrl } : {}),
        isCustom: true, category: "institutional", colorTheme: "red", triggerType: "manual",
      });
      await onRefresh();
      setShowAdd(false);
      setAddForm({ name: "", description: "", criteria: "" });
      setAddFile(null);
    } catch (e) {
      console.error("saveAdd:", e);
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <div className="bm-catalog">
      {categories.map((cat) => {
        const badges = mergedDefs.filter((b) => b.category === cat.key);
        return (
          <div key={cat.key} className="bm-catalog-group">
            <div className="bm-catalog-group-header">
              <h3 className="bm-catalog-group-title" style={{ color: cat.color }}>
                {cat.label}
              </h3>
            </div>

            <div className="bm-catalog-grid">
              {badges.map((def) => (
                <div key={def.id} className={`bm-catalog-card${def.archived ? " bm-catalog-card--archived" : ""}`}>
                  {!def.archived && editingId === def.id ? (
                    // ── Edit state: same layout as display, fields in-place ──
                    <>
                      <BadgeImgSlotEdit
                        currentImageUrl={def.imageUrl || null}
                        badgeId={def.id}
                        svgId={def.svgId}
                        onFile={setEditFile}
                        onReject={showToast}
                      />
                      <div className="bm-catalog-info">
                        <input
                          className="bm-field-name"
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          placeholder="Badge name"
                        />
                        <textarea
                          className="bm-field-criteria"
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          placeholder="Short description (shown on hover)..."
                          rows={2}
                        />
                        <textarea
                          className="bm-field-criteria"
                          value={editForm.criteria}
                          onChange={(e) => setEditForm((f) => ({ ...f, criteria: e.target.value }))}
                          placeholder="How it is earned..."
                          rows={2}
                        />
                        <div className="bm-catalog-footer">
                          <button className="bm-save-btn" onClick={() => saveEdit(def)} disabled={saving}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button className="bm-cancel-btn" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </div>
                    </>
                  ) : (
                    // ── Display state ──
                    <>
                      <BadgeIcon badgeId={def.svgId ?? def.id} imageUrl={def.imageUrl} earned={!def.archived} size="sm" />
                      <div className="bm-catalog-info">
                        <div className="bm-catalog-name">{def.name}</div>
                        {def.description && (
                          <div className="bm-catalog-criteria" style={{ fontStyle: "italic", color: "#80868b" }}>{def.description}</div>
                        )}
                        <div className="bm-catalog-criteria">{def.criteria}</div>
                        <div className="bm-catalog-footer">
                          {def.archived ? (
                            <span className="bm-archived-tag">Archived</span>
                          ) : (
                            <span className={`bm-catalog-type bm-type-${def.triggerType}`}>
                              {def.triggerType === "manual" ? "Manual" : "Automatic"}
                            </span>
                          )}
                          {!def.archived && def.triggerType === "manual" && (
                            <div className="bm-card-actions">
                              <button className="bm-edit-btn" onClick={() => { startEdit(def); setShowAdd(false); }}>
                                Edit
                              </button>
                              {def.isCustom && (() => {
                                const status = awardStatusMap[def.id];
                                if (!status) return <button className="bm-delete-btn" disabled>…</button>;
                                if (status === "awarded") return (
                                  <button
                                    className="bm-archive-btn"
                                    onClick={() => archiveCustom(def)}
                                    disabled={deletingId === def.id}
                                  >
                                    {deletingId === def.id ? "…" : "Archive"}
                                  </button>
                                );
                                return (
                                  <button
                                    className="bm-delete-btn"
                                    onClick={() => deleteCustom(def)}
                                    disabled={deletingId === def.id}
                                  >
                                    {deletingId === def.id ? "…" : "Delete"}
                                  </button>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add-new card */}
              {cat.key === "institutional" && !showAdd && (
                <div
                  className="bm-catalog-card bm-add-card"
                  onClick={() => { setShowAdd(true); setEditingId(null); }}
                >
                  <div className="bm-add-card-inner">
                    <span className="bm-add-card-icon">+</span>
                    <span className="bm-add-card-label">Add Badge</span>
                  </div>
                </div>
              )}

              {/* Add form — same card layout as display */}
              {cat.key === "institutional" && showAdd && (
                <div className="bm-catalog-card bm-add-form-card">
                  <div className="bm-add-form-top">
                    <BadgeImgSlotEdit
                      currentImageUrl={null}
                      badgeId={null}
                      svgId={null}
                      onFile={setAddFile}
                      showRequired={true}
                      hideHint={true}
                      onReject={showToast}
                    />
                    <div className="bm-catalog-info">
                      <input
                        className="bm-field-name"
                        value={addForm.name}
                        onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                        placeholder="Badge name"
                      />
                      <textarea
                        className="bm-field-criteria"
                        value={addForm.description}
                        onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                        placeholder="Short description (shown on hover)..."
                        rows={2}
                      />
                      <textarea
                        className="bm-field-criteria"
                        value={addForm.criteria}
                        onChange={(e) => setAddForm((f) => ({ ...f, criteria: e.target.value }))}
                        placeholder="How it is earned..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="bm-add-footer">
                    <span className="bm-img-slot-bg-hint">⚠ For icon, transparent background required</span>
                    <div className="bm-add-btns">
                      <button
                        className="bm-save-btn"
                        onClick={saveAdd}
                        disabled={addSaving || !addForm.name.trim() || !addFile}
                        title={!addFile ? "Upload a badge icon first" : undefined}
                      >
                        {addSaving ? "Adding…" : "Add"}
                      </button>
                      <button className="bm-cancel-btn" onClick={() => { setShowAdd(false); setAddForm({ name: "", description: "", criteria: "" }); setAddFile(null); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {toast && <div className="bm-toast">{toast}</div>}
    </div>
  );
}

// ─── Award Badges Tab ────────────────────────────────────────────────────────

const getInitials = (name) => {
  const parts = (name || "?").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name || "?").slice(0, 2).toUpperCase();
};

function Podium({ students }) {
  const top3 = [...students]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 3);
  if (top3.length === 0) return null;

  const spots = [
    { student: top3[1] || null, rank: 2 },
    { student: top3[0] || null, rank: 1 },
    { student: top3[2] || null, rank: 3 },
  ];

  return (
    <div className="bm-podium-wrap">
      <div className="bm-podium-label">Top Volunteers by Points</div>
      <div className="bm-podium">
        {spots.map(({ student, rank }) => (
          <div key={rank} className={`bm-podium-item bm-podium-rank-${rank}${!student ? " bm-podium-empty" : ""}`}>
            {student && (
              <>
                <div className="bm-podium-avatar" style={!student.avatar ? { background: '#30bdb7', color: '#fff' } : {}}>
                  {student.avatar
                    ? <img src={student.avatar} alt="" />
                    : <span style={{ fontWeight: 700 }}>{getInitials(student.displayName)}</span>}
                </div>
                <div className="bm-podium-name" title={student.displayName}>{student.displayName}</div>
                <div className="bm-podium-pts">{student.totalPoints} pts</div>
              </>
            )}
            <div className="bm-podium-step">
              <span className="bm-podium-rank">#{rank}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AwardBadgesTab({ mergedDefs, mergedById }) {
  const { user } = useContext(SessionContext);
  const [students, setStudents]               = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [search, setSearch]                   = useState("");
  const [sortBy, setSortBy]                   = useState("points");
  const [selected, setSelected]               = useState(null);
  const [studentBadges, setStudentBadges]     = useState([]);
  const [loadingBadges, setLoadingBadges]     = useState(false);
  const [awarding, setAwarding]               = useState(null);
  const [toast, setToast]                     = useState("");

  const institutionalBadges = useMemo(
    () => mergedDefs.filter((b) => b.triggerType === "manual" && !b.archived),
    [mergedDefs]
  );

  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        const q = query(collection(db, "users"), where("role", "==", "student"));
        const snap = await getDocs(q);
        setStudents(
          snap.docs.map((d) => ({
            uid: d.id,
            displayName: d.data().name || d.data().username || d.data().email || d.id,
            email: d.data().email || "",
            avatar: (() => { const p = d.data().avatar || d.data().photoURL || d.data().profilePhoto || ""; return p.includes("ui-avatars.com") ? "" : p; })(),
            totalPoints: d.data().totalPoints || 0,
          }))
        );
      } catch (e) {
        console.error("fetchStudents error:", e);
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, []);

  const selectStudent = async (student) => {
    setSelected(student);
    setLoadingBadges(true);
    try {
      const badges = await getStudentBadges(student.uid);
      setStudentBadges(badges);
    } catch (e) {
      console.error("getStudentBadges error:", e);
    } finally {
      setLoadingBadges(false);
    }
  };

  const handleAward = async (badgeId) => {
    if (!selected) return;
    setAwarding(badgeId);
    try {
      const badgeDef = mergedById[badgeId];
      const awarded = await awardBadge(selected.uid, badgeId, user?.uid ?? "admin", badgeDef);
      if (awarded) {
        setToast(`"${badgeDef?.name ?? badgeId}" awarded to ${selected.displayName}!`);
        logAudit({
          action: "BADGE_AWARDED_MANUAL",
          category: "reward",
          details: {
            targetUserId: selected.uid,
            targetUserName: selected.displayName,
            badgeId,
            badgeName: badgeDef?.name || badgeId,
          },
        });
        const badges = await getStudentBadges(selected.uid);
        setStudentBadges(badges);
      } else {
        setToast(`${selected.displayName} already has this badge.`);
      }
    } catch (e) {
      console.error("handleAward error:", e);
      setToast("Something went wrong. Please try again.");
    } finally {
      setAwarding(null);
      setTimeout(() => setToast(""), 3500);
    }
  };

  const filtered = students.filter(
    (s) =>
      s.displayName.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = sortBy === "points"
    ? [...filtered].sort((a, b) => b.totalPoints - a.totalPoints)
    : [...filtered].sort((a, b) => a.displayName.localeCompare(b.displayName));

  const earnedSet = new Set(studentBadges.map((b) => b.badgeId ?? b.id));

  return (
    <>
    {!loadingStudents && students.length > 0 && <Podium students={students} />}
    <div className="bm-award-layout">
      <div className="bm-student-panel">
        <div className="bm-search-wrap">
          <input
            className="bm-search"
            type="text"
            placeholder="Search volunteers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="bm-sort-row">
            <button
              className={`bm-sort-btn${sortBy === "points" ? " active" : ""}`}
              onClick={() => setSortBy("points")}
            >By Points</button>
            <button
              className={`bm-sort-btn${sortBy === "name" ? " active" : ""}`}
              onClick={() => setSortBy("name")}
            >By Name</button>
          </div>
        </div>
        {loadingStudents ? (
          <p className="bm-loading">Loading volunteers…</p>
        ) : sorted.length === 0 ? (
          <p className="bm-empty">No volunteers found.</p>
        ) : (
          <div className="bm-student-list">
            {sorted.map((s) => (
              <div
                key={s.uid}
                className={`bm-student-row${selected?.uid === s.uid ? " selected" : ""}`}
                onClick={() => selectStudent(s)}
              >
                <div className="bm-student-avatar" style={!s.avatar ? { background: '#30bdb7', color: '#fff' } : {}}>
                  {s.avatar ? <img src={s.avatar} alt="" /> : <span>{getInitials(s.displayName)}</span>}
                </div>
                <div className="bm-student-info">
                  <div className="bm-student-name">{s.displayName}</div>
                  <div className="bm-student-email">{s.email}</div>
                </div>
                <div className="bm-student-pts-badge">{s.totalPoints}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bm-badge-panel">
        {!selected ? (
          <div className="bm-no-selection">
            <span>Select a volunteer to manage their badges</span>
          </div>
        ) : (
          <>
            <div className="bm-student-header">
              <div className="bm-student-avatar large" style={!selected.avatar ? { background: '#30bdb7', color: '#fff' } : {}}>
                {selected.avatar ? <img src={selected.avatar} alt="" /> : <span>{getInitials(selected.displayName)}</span>}
              </div>
              <div>
                <div className="bm-selected-name">{selected.displayName}</div>
                <div className="bm-selected-email">{selected.email}</div>
                {!loadingBadges && (
                  <div className="bm-selected-count">{earnedSet.size} of {mergedDefs.length} badges earned</div>
                )}
              </div>
            </div>

            {loadingBadges ? (
              <p className="bm-loading">Loading badges…</p>
            ) : (
              <>
                <div className="bm-earned-section">
                  <h4>Earned Badges</h4>
                  <div className="bm-earned-grid">
                    {mergedDefs.map((def) => {
                      const earned = earnedSet.has(def.id);
                      return (
                        <div key={def.id} className={`bm-earned-slot${earned ? " earned" : ""}`} title={def.name}>
                          <BadgeIcon badgeId={def.svgId ?? def.id} imageUrl={def.imageUrl} earned={earned} size="sm" />
                          <span>{def.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bm-institutional-section">
                  <h4>Award Manual Badges</h4>
                  <p className="bm-institutional-note">These badges are awarded manually. Once given, they cannot be revoked.</p>
                  <div className="bm-institutional-grid">
                    {institutionalBadges.map((def) => {
                      const alreadyEarned = earnedSet.has(def.id);
                      return (
                        <div key={def.id} className="bm-institutional-card">
                          <BadgeIcon badgeId={def.svgId ?? def.id} imageUrl={def.imageUrl} earned size="md" />
                          <div className="bm-institutional-info">
                            <div className="bm-institutional-name">{def.name}</div>
                            <div className="bm-institutional-criteria">{def.criteria}</div>
                            {alreadyEarned ? (
                              <span className="bm-already-awarded">Already awarded</span>
                            ) : (
                              <button className="bm-award-btn" onClick={() => handleAward(def.id)} disabled={awarding === def.id}>
                                {awarding === def.id ? "Awarding…" : "Award Badge"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {toast && <div className="bm-toast">{toast}</div>}
    </div>
    </>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function BadgeManage() {
  const [activeTab, setActiveTab]         = useState("catalog");
  const [overrides, setOverrides]         = useState({});
  const [customs, setCustoms]             = useState([]);
  const [configLoading, setConfigLoading] = useState(true);

  const refresh = async () => {
    try {
      const { overrides: ov, customs: cs } = await loadBadgeConfigs();
      setOverrides(ov);
      setCustoms(cs);
    } catch (e) {
      console.error("loadBadgeConfigs:", e);
    }
  };

  useEffect(() => {
    setConfigLoading(true);
    refresh().finally(() => setConfigLoading(false));
  }, []);

  const mergedDefs = useMemo(() => [
    ...BADGE_DEFINITIONS.map((b) => ({ ...b, ...(overrides[b.id] || {}) })),
    ...customs,
  ], [overrides, customs]);

  const mergedById = useMemo(
    () => Object.fromEntries(mergedDefs.map((b) => [b.id, b])),
    [mergedDefs]
  );

  return (
    <div className="bm-page">
      <div className="bm-header">
        <h2 className="bm-title">Badge Management</h2>
        <p className="bm-subtitle">View and customize badges, and award manual badges to volunteers.</p>
      </div>

      <div className="bm-tabs">
        <button className={`bm-tab${activeTab === "catalog" ? " active" : ""}`} onClick={() => setActiveTab("catalog")}>
          Badge Catalog
        </button>
        <button className={`bm-tab${activeTab === "award" ? " active" : ""}`} onClick={() => setActiveTab("award")}>
          Award Badges
        </button>
      </div>

      <div className="bm-body">
        {configLoading ? (
          <p className="bm-loading">Loading…</p>
        ) : (
          <>
            {activeTab === "catalog" && <BadgeCatalogTab mergedDefs={mergedDefs} onRefresh={refresh} />}
            {activeTab === "award"   && <AwardBadgesTab  mergedDefs={mergedDefs} mergedById={mergedById} />}
          </>
        )}
      </div>
    </div>
  );
}
