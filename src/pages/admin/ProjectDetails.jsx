import { useRef, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { createNotification } from "../../utils/notificationUtils";
import { showToast } from "../../utils/toast";

import "../../styles/ProjectDetails.css";

//for demo purposes only
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ceBg from "../../assets/ce-proposal-page1.png";
import { QRCodeCanvas } from "qrcode.react";


export default function ProjectDetails({ projectId, onClose }) {

  const navigate = useNavigate();
  const [attendees, setAttendees] = useState([]);
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [taskCount, setTaskCount] = useState(0);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showFeedbackQR, setShowFeedbackQR] = useState(false);
  const [showAttendanceReport, setShowAttendanceReport] = useState(false);

  // Fetch attendees from Firestore subcollection
  useEffect(() => {
    if (!projectId || !showQR) return;
    const fetchAttendees = async () => {
      try {
        const volunteerRef = collection(db, "missions", projectId, "volunteer");
        const snap = await getDocs(volunteerRef);

        // All volunteers with their status
        const allVols = await Promise.all(snap.docs.map(async (d) => {
          let name = d.data().name || d.data().email || "Unknown";
          if (name === "Unknown") {
            try {
              const userSnap = await getDoc(doc(db, "users", d.id));
              if (userSnap.exists()) name = userSnap.data().name || userSnap.data().email || "Unknown";
            } catch (_) {}
          }
          return {
            uid: d.id,
            name,
            status: d.data().attendanceStatus || "not_checked",
            email: d.data().email || ""
          };
        }));
        setAllVolunteers(allVols);

        // Only present attendees for quick view
        setAttendees(
          snap.docs
            .filter(doc => doc.data().attendanceStatus === "present")
            .map(doc => doc.data().name || doc.data().email || "Unknown")
        );
      } catch (err) {
        setAttendees([]);
        setAllVolunteers([]);
      }
    };
    fetchAttendees();
  }, [projectId, showQR]);

  const handleRemoveVolunteer = async (uid, name) => {
    if (!window.confirm(`Remove "${name}" from this event?`)) return;
    try {
      await deleteDoc(doc(db, "missions", projectId, "volunteer", uid));
      await deleteDoc(doc(db, "userMissions", uid, "missions", projectId));
      setAllVolunteers(prev => prev.filter(v => v.uid !== uid));
      setAttendees(prev => prev.filter(n => n !== name));
      createNotification(uid, {
        type: "event_removed",
        title: "Removed from Event",
        message: `You have been removed from "${project?.title || "an event"}".`,
        link: "/student",
      }).catch(() => {});
      showToast(`${name} removed from this event.`);
    } catch (err) {
      showToast("Failed to remove volunteer. Please try again.");
    }
  };

  //attendance re-generate timestamp for qr code
  const generateNewQR = async () => {
    const newTimestamp = Date.now();

    await updateDoc(doc(db, "missions", projectId), {
      validQRTimestamp: newTimestamp,
      updatedAt: serverTimestamp()
    });

    await load(); // reload project
  };
  const generateQRValue = () => {
    const expiresAt = Date.now() + (30 * 60 * 1000); // After 30 minutes

    return JSON.stringify({
      eventId: projectId,
      expiresAt
    });
  };

  //export to PDF (demo purposes only)
  const pdfRef = useRef(null);
  const handleExportPdf = async () => {
    if (!pdfRef.current) return;

    // temporarily show if you decide to hide via display:none (we won't)
    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);

    const filename = `CE-Proposal-${(project?.title || project?.alt || "Draft")
      .toString()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")}.pdf`;

    pdf.save(filename);
  };

  const ref = doc(db, "missions", projectId);
  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setProject(null);
        return;
      }
      const data = snap.data();
      setProject({
        id: snap.id,
        ...data,
        status: data.status || "draft",
        approvals: {
          faculty: data.approvals?.faculty ?? { approved: false, decidedAt: null },
          partner: data.approvals?.partner ?? { approved: false, decidedAt: null },
        },
      });
    } catch (e) {
      console.error(e);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadTaskCount();
  }, [projectId]);

  const loadTaskCount = async () => {
    try {
      const tasksRef = collection(db, "missions", projectId, "task");
      const snap = await getDocs(tasksRef);
      setTaskCount(snap.size);
    } catch (e) {
      console.error("Error loading task count:", e);
      setTaskCount(0);
    }
  };

  const setStatus = async (nextStatus) => {
    setSaving(true);
    try {
      const payload = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };

      if (nextStatus === "for_approval") {
        payload.submittedAt = serverTimestamp();
        payload.approvals = {
          faculty: { approved: false, decidedAt: null, decidedBy: "" },
          partner: { approved: false, decidedAt: null, decidedBy: "" },
        };
      }

      // this is where mission is set as "published"
      if (nextStatus === "published") {
        payload.publishedAt = serverTimestamp();
        // community feedback form metadata
        payload.feedback = {
          isActive: true,
          avgRating: null,
          multiplier: null,
        };
      }

      await updateDoc(ref, payload);
      await load();
    } catch (e) {
      console.error(e);
      showToast("Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const toggleApproval = async (who) => {
    setSaving(true);
    try {
      const current = project?.approvals?.[who]?.approved ?? false;

      await updateDoc(ref, {
        [`approvals.${who}.approved`]: !current,
        [`approvals.${who}.decidedAt`]: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await load();
    } catch (e) {
      console.error(e);
      showToast("Failed to update approval.");
    } finally {
      setSaving(false);
    }
  };

  const canPublish =
    project?.status === "for_approval" &&
    project?.approvals?.faculty?.approved === true &&
    project?.approvals?.partner?.approved === true;

  if (loading) return <p>Loading…</p>;
  if (!project) return <p>Project not found.</p>;

  //for archiving projects (admin-privilege)
  const handleArchive = async () => {
    if (!window.confirm("Archive this project? You can restore it later.")) return;

    setSaving(true);
    try {
      // Send event_cancelled notifications to volunteers (non-blocking)
      try {
        const volunteersRef = collection(db, "missions", projectId, "volunteer");
        const volunteersSnap = await getDocs(volunteersRef);

        const notificationPromises = volunteersSnap.docs.map(async (volunteerDoc) => {
          try {
            await createNotification(volunteerDoc.id, {
              type: "event_cancelled",
              title: "Event Cancelled",
              message: `${project?.title || "An event"} has been cancelled.`,
              link: "/student"
            });
          } catch (notifError) {
            console.error(`Failed to notify volunteer ${volunteerDoc.id}:`, notifError);
          }
        });

        await Promise.all(notificationPromises);
      } catch (notifError) {
        console.error("Error sending notifications:", notifError);
        // Continue with archiving even if notifications fail
      }

      // Archive the event
      await updateDoc(ref, {
        status: "archived",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate("/admin/projects");
    } catch (e) {
      console.error(e);
      showToast("Failed to archive.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm("Restore this project to Draft?")) return;

    setSaving(true);
    try {
      await updateDoc(ref, {
        status: "draft",
        archivedAt: null,
        updatedAt: serverTimestamp(),
      });
      await load();
    } catch (e) {
      console.error(e);
      showToast("Failed to restore.");
    } finally {
      setSaving(false);
    }
  };

  //able to delete (admin-privilege) -> 
  const handleDelete = async () => {
    const ok = window.confirm(
      "Delete this project permanently? This cannot be undone."
    );
    if (!ok) return;

    setSaving(true);
    try {
      const ref = doc(db, "missions", projectId);
      await deleteDoc(ref);
      navigate("/admin/projects");
    } catch (e) {
      console.error(e);
      showToast("Failed to delete.");
    } finally {
      setSaving(false);
    }
  };

  //will be fixing ui here shortly - aly
  return (
    <div>
      <div className="project-details-header">
        <button onClick={onClose}>✕</button>
      </div>

      {/* Export PDF using proposal under assets (demo) */}
      <button disabled type="button" onClick={handleExportPdf}>
        Export PDF (still editing)
      </button>

      <div className="mission-header">

        {/*mission title */}
        <h2 className="mission-title">
          {project.title || "Untitled Mission"}
        </h2>

        {/*tags */}
        <div className="mission-tags">
          <span className="tag">
            📅 {project.targetDate || "No target date"}
          </span>
          <span className={`tag status-${project.status}`}>
            {project.status}
          </span>
          <span className="tag">
            ⏰ {project.startTime || "TBD"}
          </span>
          <span className="tag">
            🏫 {project.department || "—"}
          </span>
          <span className="tag">
            👤 {project.preparedBy || "Organizer"}
          </span>
        </div>
      </div>

      {/*progress bar no. of joined */}
      <div className="mission-progress">
        <div className="progress-info">
          {attendees.length} / {project.maxStudents || 0} volunteers joined
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{
              width: `${(attendees.length / (project.maxStudents || 1)) * 100}%`
            }}
          />
        </div>
      </div>

      {/*points and badges */}
      <div className="mission-points">
        <div className="points-value">
          ⭐ {project.points || 0} Points
        </div>
        <button className="add-badge-btn">
          +
        </button>
      </div>
      {/*manage tasks */}
      <h3 style={{ color: "#111" }}>Tasks</h3>
      <button
        onClick={() => navigate(`/admin/projects/${projectId}/tasks`)}
        style={{
          background: '#007bff',
          color: '#fff',
          padding: '10px 20px',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontWeight: 600,
          marginBottom: 12
        }}
      >
        Manage Tasks
      </button>
      <p style={{ color: "#888", fontSize: 14 }}>
        {taskCount > 0 ? `${taskCount} task(s) for this project` : 'No tasks yet'}
      </p>

      {/*attendance & community feedback form */}
      <div className="mission-section">
        <h3>Mission Access</h3>
        <div className="qr-card">
          <div>
            <strong>Attendance QR</strong>
            <p>Volunteers scan to mark attendance</p>
          </div>

          <div className="qr-actions">
            <button onClick={() => setShowQR(true)}>View</button>
            <button onClick={generateNewQR}>Reset</button>
          </div>

        </div>
        <div className="qr-card">
          <div>
            <strong>Community Feedback</strong>
            <p>Scan to submit feedback</p>
          </div>

          <div className="qr-actions">
            <button onClick={() => setShowFeedbackQR(true)}>View</button>
            <button>Close</button>
          </div>

        </div>
      </div>

      <p style={{ color: "#111" }}>
        <b>Community Feedback:</b>{" "}
        {project.feedback?.isActive === false ? (
          <span style={{ color: "#28a745", fontWeight: 600 }}>Closed</span>
        ) : (
          <span style={{ color: "#ffc107", fontWeight: 600 }}>Active</span>
        )}
      </p>
      <hr />

      {/*approvals */}
      <div className="mission-section">
        <h3>Approvals</h3>
        <div className="approval-item">
          <div className="avatar">F</div>
          <div>
            <div className="approval-name">
              Faculty
            </div>

            {project.approvals.faculty.decidedAt
              ? new Date(project.approvals.faculty.decidedAt.seconds * 1000).toLocaleString()
              : "Pending"}

            <div className="approval-comment">
              Approved by faculty reviewer
            </div>
          </div>
        </div>

        <div className="approval-item">
          <div className="avatar">P</div>
          <div>
            <div className="approval-name">
              Community Partner
            </div>

            {project.approvals.partner.decidedAt
              ? new Date(project.approvals.partner.decidedAt.seconds * 1000).toLocaleString()
              : "Pending"}

            <div className="approval-comment">
              Awaiting decision
            </div>
          </div>
        </div>
      </div>

      <hr />

      <h3 style={{ color: "#111" }}>Actions (demo)</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={saving} onClick={() => setStatus("draft")}>
          Set Draft
        </button>

        <button disabled={saving} onClick={() => setStatus("for_approval")}>
          Submit for Approval
        </button>

        <button disabled={saving} onClick={() => toggleApproval("faculty")}>
          Toggle Faculty Approval
        </button>

        <button disabled={saving} onClick={() => toggleApproval("partner")}>
          Toggle Partner Approval
        </button>

        {project.status !== "archived" ? (
          <button disabled={saving} onClick={handleArchive}>
            Archive
          </button>
        ) : (
          <button disabled={saving} onClick={handleRestore}>
            Restore to Draft
          </button>
        )}

        <button disabled={saving} onClick={handleDelete}>
          Delete
        </button>

        <button disabled={!canPublish || saving} onClick={() => setStatus("published")}>
          Publish
        </button>
      </div>


      {/* ATTENDANCE QR CODE */}
      {showQR && (
        <div style={{ marginTop: 20, textAlign: "center" }}>
          <QRCodeCanvas
            value={generateQRValue()}
            size={220}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>
            Scan this code to record attendance.
          </div>
          <button
            onClick={async () => {
              await generateNewQR();
              setShowQR(true);
            }}
          >
            Generate Attendance QR
          </button>
        </div>
      )}

      {showFeedbackQR && (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <QRCodeCanvas
              value={`${window.location.origin}/global/feedback/${projectId}`}
              size={220}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#555', textAlign: 'center' }}>
              Scan this code to submit community feedback.
            </div>

            <button
              style={{
                marginTop: 12,
                background: '#234e7b',
                color: '#fff',
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13
              }}
              onClick={() =>
                navigate(`/global/feedback/${projectId}`)
              }
              type="button"
            >
              Open Feedback Form
            </button>
          </div>
        </div>
      )}

      {/* Attendance Report Modal */}
      {showAttendanceReport && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }} onClick={() => setShowAttendanceReport(false)}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 32,
            maxWidth: 600,
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto',
            position: 'relative'
          }} onClick={(e) => e.stopPropagation()}>
            <button
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 600,
                color: '#555'
              }}
              onClick={() => setShowAttendanceReport(false)}
            >
              ×
            </button>

            <h2 style={{ margin: '0 0 8px 0', color: '#234e7b', fontSize: 24 }}>Attendance Report</h2>
            <p style={{ margin: '0 0 24px 0', color: '#666', fontSize: 14 }}>
              {project.title || project.alt || 'Untitled Event'}
            </p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 600, color: '#234e7b', marginBottom: 8 }}>
                Total Registered: {allVolunteers.length}
              </div>
              <div style={{ fontWeight: 600, color: '#30bdb7', marginBottom: 8 }}>
                Present: {allVolunteers.filter(v => v.status === 'present').length}
              </div>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
                Date: {project.date || '—'}
              </div>
            </div>

            {allVolunteers.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                color: '#888',
                background: '#f9fafb',
                borderRadius: 8
              }}>
                No volunteers have joined this event yet.
              </div>
            ) : (
              <div>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 14
                }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#234e7b', fontWeight: 600 }}>#</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#234e7b', fontWeight: 600 }}>Name</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#234e7b', fontWeight: 600 }}>Status</th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', color: '#234e7b', fontWeight: 600 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allVolunteers.map((volunteer, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '12px 8px', color: '#555' }}>{idx + 1}</td>
                        <td style={{ padding: '12px 8px', color: '#111' }}>{volunteer.name}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            background: volunteer.status === 'present' ? '#d4edda' : '#fff3cd',
                            color: volunteer.status === 'present' ? '#155724' : '#856404',
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            textTransform: 'capitalize'
                          }}>
                            {volunteer.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <button
                            onClick={() => handleRemoveVolunteer(volunteer.uid, volunteer.name)}
                            style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              border: 'none',
                              borderRadius: 6,
                              padding: '4px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <button
                style={{
                  width: '100%',
                  background: '#30bdb7',
                  color: '#fff',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onClick={() => {
                  // Export as CSV
                  const csvContent = "data:text/csv;charset=utf-8,"
                    + "No,Name,Email,Status\n"
                    + allVolunteers.map((v, idx) => `${idx + 1},${v.name},${v.email},${v.status}`).join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `attendance_${projectId}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                Export as CSV
              </button>
            </div>
          </div>
        </div>
      )}

      <hr />


      {/* Hidden div for PDF export */}
      <div className="pdf-export-wrap">
        <div ref={pdfRef} className="ce-sheet">
          <img src={ceBg} alt="CE Proposal Template" className="ce-bg" />

          {/* Title */}
          <div className="ce-field ce-title">
            {project?.title || project?.alt || ""}
          </div>

          {/* Date Proposed (this is what you asked for) */}
          <div className="ce-field ce-dateProposed">
            {project?.dateProposed || ""}
          </div>

          {/* Location */}
          <div className="ce-field ce-location">
            {project?.location || ""}
          </div>

          {/* Volunteer Hours */}
          <div className="ce-field ce-hours">
            {project?.volunteerHours ?? ""}
          </div>

          {/* Points */}
          <div className="ce-field ce-points">
            {project?.points ?? ""}
          </div>

          {/* Stakeholders */}
          <div className="ce-field ce-stakeholders">
            {project?.stakeholders || ""}
          </div>

          {/* Description */}
          <div className="ce-field ce-description">
            {project?.description || ""}
          </div>

          {/* SDG checks example */}
          {(project?.sdgs || []).includes("4. Quality Education") && (
            <div className="ce-check ce-sdg4">✓</div>
          )}
        </div>
      </div>
    </div>
  );
}