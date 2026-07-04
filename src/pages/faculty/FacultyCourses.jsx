import { useState, useEffect } from "react";
import { db, auth } from "../../firebaseConfig";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { showToast } from "../../utils/toast";

const G = {
  blue: "#1a73e8",
  blueL: "#e8f0fe",
  green: "#34a853",
  greenL: "#e6f4ea",
  red: "#ea4335",
  redL: "#fce8e6",
  text: "#202124",
  sub: "#5f6368",
  border: "#e0e0e0",
  bg: "#f8f9fa",
  white: "#ffffff",
};

export default function FacultyCourses() {
  const facultyUid = auth.currentUser?.uid;

  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Create course modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ courseName: "", courseCode: "", section: "" });
  const [creating, setCreating] = useState(false);

  // Roster modal
  const [rosterCourse, setRosterCourse] = useState(null);
  const [allStudents, setAllStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [updatingRoster, setUpdatingRoster] = useState(false);

  // Subscribe to faculty's courses in real-time
  useEffect(() => {
    if (!facultyUid) {
      setLoadingCourses(false);
      return;
    }
    const q = query(collection(db, "courses"), where("facultyUid", "==", facultyUid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
        setCourses(list);
        setLoadingCourses(false);
      },
      () => setLoadingCourses(false)
    );
    return () => unsub();
  }, [facultyUid]);

  // Fetch all registered students when roster modal opens
  useEffect(() => {
    if (!rosterCourse) return;
    setLoadingStudents(true);
    setStudentSearch("");
    getDocs(query(collection(db, "users"), where("role", "==", "student")))
      .then((snap) => {
        setAllStudents(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
      })
      .catch(() => showToast("Failed to load students."))
      .finally(() => setLoadingStudents(false));
  }, [rosterCourse?.id]);

  // Keep rosterCourse in sync with the courses list (live enrollment count)
  useEffect(() => {
    if (!rosterCourse) return;
    const updated = courses.find((c) => c.id === rosterCourse.id);
    if (updated) setRosterCourse(updated);
  }, [courses]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreateCourse = async () => {
    const { courseName, courseCode, section } = createForm;
    if (!courseName.trim() || !courseCode.trim() || !section.trim()) {
      showToast("Please fill in all fields.");
      return;
    }
    setCreating(true);
    try {
      await addDoc(collection(db, "courses"), {
        facultyUid,
        courseName: courseName.trim(),
        courseCode: courseCode.trim(),
        section: section.trim(),
        students: [],
        createdAt: serverTimestamp(),
      });
      setCreateForm({ courseName: "", courseCode: "", section: "" });
      setShowCreateModal(false);
      showToast("Course created.");
    } catch {
      showToast("Failed to create course.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStudent = async (studentUid, isEnrolled) => {
    if (!rosterCourse || updatingRoster) return;
    setUpdatingRoster(true);
    try {
      await updateDoc(doc(db, "courses", rosterCourse.id), {
        students: isEnrolled ? arrayRemove(studentUid) : arrayUnion(studentUid),
      });
    } catch {
      showToast("Failed to update roster.");
    } finally {
      setUpdatingRoster(false);
    }
  };

  const enrolledUids = new Set(rosterCourse?.students || []);

  const filteredStudents = allStudents.filter((s) => {
    const q = studentSearch.toLowerCase();
    if (!q) return true;
    return (
      (s.name || "").toLowerCase().includes(q) ||
      (s.email || "").toLowerCase().includes(q) ||
      (s.username || "").toLowerCase().includes(q)
    );
  });

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    border: `1px solid ${G.border}`,
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 14,
    outline: "none",
    background: G.white,
  };

  const labelStyle = {
    fontSize: 13,
    fontWeight: 600,
    color: G.text,
    display: "block",
    marginBottom: 5,
  };

  return (
    <>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, padding: "28px 32px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: G.text }}>Courses</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: G.sub }}>
            Manage your courses and student rosters. Service Learning events are only visible to enrolled students.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: G.blue,
            color: G.white,
            border: "none",
            borderRadius: 8,
            padding: "10px 18px",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          + New Course
        </button>
      </div>

      {/* Course grid */}
      {loadingCourses ? (
        <p style={{ color: G.sub }}>Loading courses…</p>
      ) : courses.length === 0 ? (
        <div
          style={{
            background: G.white,
            borderRadius: 12,
            border: `1px solid ${G.border}`,
            padding: "48px 24px",
            textAlign: "center",
            color: G.sub,
            fontSize: 14,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <p style={{ margin: "0 0 6px", fontWeight: 600, color: G.text }}>No courses yet</p>
          <p style={{ margin: 0 }}>Create a course to link it to a Service Learning proposal and manage its roster.</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 16,
          }}
        >
          {courses.map((course) => (
            <div
              key={course.id}
              style={{
                background: G.white,
                borderRadius: 12,
                border: `1px solid ${G.border}`,
                padding: "20px 22px",
                boxShadow: "0 1px 3px rgba(60,64,67,.1)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: G.text, wordBreak: "break-word" }}>
                    {course.courseName}
                  </div>
                  <div style={{ fontSize: 12, color: G.sub, marginTop: 3 }}>
                    {course.courseCode} · Section {course.section}
                  </div>
                </div>
                <span
                  style={{
                    background: G.blueL,
                    color: G.blue,
                    borderRadius: 999,
                    padding: "3px 10px",
                    fontSize: 11,
                    fontWeight: 600,
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {(course.students || []).length} student{(course.students || []).length !== 1 ? "s" : ""}
                </span>
              </div>
              <button
                onClick={() => setRosterCourse(course)}
                style={{
                  background: G.bg,
                  border: `1px solid ${G.border}`,
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontSize: 13,
                  cursor: "pointer",
                  color: G.text,
                  fontWeight: 500,
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Manage Roster
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Create Course Modal ── */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(32,33,36,.52)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: 20,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              background: G.white,
              borderRadius: 16,
              width: "100%",
              maxWidth: 460,
              boxShadow: "0 24px 48px rgba(0,0,0,.22)",
              padding: "28px 28px 24px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: "0 0 22px", fontSize: 18, fontWeight: 700, color: G.text }}>
              New Course
            </h2>

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Course Name *</label>
              <input
                type="text"
                value={createForm.courseName}
                maxLength={100}
                onChange={(e) => setCreateForm((p) => ({ ...p, courseName: e.target.value }))}
                placeholder="e.g., Introduction to Community Development"
                style={inputStyle}
                autoFocus
              />
            </div>

            <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Course Code *</label>
                <input
                  type="text"
                  value={createForm.courseCode}
                  maxLength={20}
                  onChange={(e) => setCreateForm((p) => ({ ...p, courseCode: e.target.value }))}
                  placeholder="e.g., CD 101"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Section *</label>
                <input
                  type="text"
                  value={createForm.section}
                  maxLength={20}
                  onChange={(e) => setCreateForm((p) => ({ ...p, section: e.target.value }))}
                  placeholder="e.g., A"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "none",
                  border: `1px solid ${G.border}`,
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 14,
                  cursor: "pointer",
                  color: G.text,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCourse}
                disabled={creating}
                style={{
                  background: G.blue,
                  color: G.white,
                  border: "none",
                  borderRadius: 8,
                  padding: "9px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer",
                  opacity: creating ? 0.7 : 1,
                }}
              >
                {creating ? "Creating…" : "Create Course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Manage Roster Modal ── */}
      {rosterCourse && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(32,33,36,.52)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            padding: 20,
          }}
          onClick={() => setRosterCourse(null)}
        >
          <div
            style={{
              background: G.white,
              borderRadius: 16,
              width: "100%",
              maxWidth: 560,
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 48px rgba(0,0,0,.22)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky header */}
            <div
              style={{
                padding: "22px 24px 14px",
                borderBottom: `1px solid ${G.border}`,
                borderRadius: "16px 16px 0 0",
                background: G.white,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: G.text }}>
                    {rosterCourse.courseName}
                  </div>
                  <div style={{ fontSize: 12, color: G.sub, marginTop: 2 }}>
                    {rosterCourse.courseCode} · Section {rosterCourse.section} ·{" "}
                    <strong>{enrolledUids.size}</strong> enrolled
                  </div>
                </div>
                <button
                  onClick={() => setRosterCourse(null)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 22,
                    cursor: "pointer",
                    color: G.sub,
                    lineHeight: 1,
                    padding: "2px 6px",
                  }}
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search by name or email…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${G.border}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                  background: G.bg,
                }}
              />
            </div>

            {/* Scrollable student list */}
            <div style={{ overflowY: "auto", padding: "8px 8px 14px" }}>
              {loadingStudents ? (
                <p style={{ textAlign: "center", color: G.sub, padding: "24px 16px" }}>
                  Loading students…
                </p>
              ) : filteredStudents.length === 0 ? (
                <p style={{ textAlign: "center", color: G.sub, padding: "24px 16px" }}>
                  {studentSearch ? "No students match your search." : "No registered students found."}
                </p>
              ) : (
                filteredStudents.map((student) => {
                  const isEnrolled = enrolledUids.has(student.uid);
                  const displayName =
                    student.name || student.username || student.email?.split("@")[0] || "Unknown";
                  return (
                    <div
                      key={student.uid}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "9px 16px",
                        borderRadius: 8,
                        background: isEnrolled ? G.greenL : "transparent",
                        marginBottom: 2,
                        transition: "background .15s",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: G.text, wordBreak: "break-word" }}>
                          {displayName}
                        </div>
                        <div style={{ fontSize: 11, color: G.sub }}>{student.email}</div>
                      </div>
                      <button
                        disabled={updatingRoster}
                        onClick={() => handleToggleStudent(student.uid, isEnrolled)}
                        style={{
                          background: isEnrolled ? G.redL : G.blueL,
                          color: isEnrolled ? G.red : G.blue,
                          border: "none",
                          borderRadius: 6,
                          padding: "5px 14px",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: updatingRoster ? "not-allowed" : "pointer",
                          opacity: updatingRoster ? 0.6 : 1,
                          flexShrink: 0,
                          marginLeft: 12,
                        }}
                      >
                        {isEnrolled ? "Remove" : "Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
