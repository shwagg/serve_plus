import { useRef, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, getDocs } from "firebase/firestore";
import { createNotification } from "../../utils/notificationUtils";
import { showToast, showConfirm } from "../../utils/toast";

import "../../styles/ProjectDetails.css";

//for demo purposes only
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ceBg from "../../assets/ce-proposal-page1.png";
import { QRCodeCanvas } from "qrcode.react";
import ImpactMetrics from "./ImpactMetrics";

export default function ProjectDetails({ projectId: propProjectId, onClose, sidebar }) {
  const params = useParams();
  const projectId = propProjectId || params.projectId;
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [showPreSurveyAnalytics, setShowPreSurveyAnalytics] = useState(false);
  const [showPostSurveyAnalytics, setShowPostSurveyAnalytics] = useState(false);
  const [impactModalOpen, setImpactModalOpen] = useState(false);
  const [impactModalType, setImpactModalType] = useState(null); // 'pre' or 'post'

  const navigate = useNavigate();
  const [attendees, setAttendees] = useState([]);
  const [allVolunteers, setAllVolunteers] = useState([]);
  const [taskCount, setTaskCount] = useState(0);
  const [specificActivities, setSpecificActivities] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showFeedbackQR, setShowFeedbackQR] = useState(false);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [showAttendanceReport, setShowAttendanceReport] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [taskParticipants, setTaskParticipants] = useState([]);

  // Fetch volunteers with pre/post survey answers (like CurrentEventMonitoring)
  useEffect(() => {
    if (!projectId) return;
    const fetchVolunteersWithSurveys = async () => {
      try {
        const volunteerRef = collection(db, "missions", projectId, "volunteer");
        const snap = await getDocs(volunteerRef);
        const volunteersRaw = snap.docs.map((d) => ({
          uid: d.id,
          ...d.data(),
        }));
        // Fetch pre/post survey answers for each volunteer
        const volunteersWithSurveys = await Promise.all(
          volunteersRaw.map(async (v) => {
            let name = v.name || v.email || "Unknown";
            if (name === "Unknown") {
              try {
                const userSnap = await getDoc(doc(db, "users", v.uid));
                if (userSnap.exists()) name = userSnap.data().name || userSnap.data().email || "Unknown";
              } catch (_) { }
            }
            let preSurveyAnswers = null;
            let postSurveyAnswers = null;
            try {
              const preDoc = await getDoc(doc(db, "missions", projectId, "volunteer", v.uid, "preSurvey", "response"));
              if (preDoc.exists()) preSurveyAnswers = preDoc.data();
            } catch (e) { }
            try {
              const postDoc = await getDoc(doc(db, "missions", projectId, "volunteer", v.uid, "postSurvey", "response"));
              if (postDoc.exists()) postSurveyAnswers = postDoc.data();
            } catch (e) { }
            return {
              ...v,
              name,
              preSurveyAnswers,
              postSurveyAnswers,
            };
          })
        );
        setAllVolunteers(volunteersWithSurveys);
        setAttendees(
          volunteersWithSurveys
            .filter(v => v.status === "present")
            .map(v => v.name)
        );
        // Tasks
        const tasksRef = collection(db, "missions", projectId, "task");
        const tasksSnap = await getDocs(tasksRef);
        const tasksData = tasksSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTasks(tasksData);
        // Task participants
        const allParticipants = [];
        for (const task of tasksData) {
          const participantsRef = collection(db, "missions", projectId, "task", task.id, "participants");
          const participantsSnap = await getDocs(participantsRef);
          participantsSnap.docs.forEach((doc) => {
            allParticipants.push({
              id: doc.id,
              taskId: task.id,
              ...doc.data(),
            });
          });
        }
        setTaskParticipants(allParticipants);
      } catch (err) {
        setAttendees([]);
        setAllVolunteers([]);
        setTasks([]);
        setTaskParticipants([]);
      }
    };
    fetchVolunteersWithSurveys();
  }, [projectId, showQR]);

  const handleRemoveVolunteer = async (uid, name) => {
    if (!await showConfirm(`Remove "${name}" from this event?`)) return;
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
      }).catch(() => { });
      showToast(`${name} removed from this event.`);
    } catch (err) {
      showToast("Failed to remove volunteer. Please try again.");
    }
  };

  //attendance re-generate timestamp for qr code
  const generateNewQR = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        showToast("Geolocation is not supported by this browser.");
        reject(new Error("No geolocation support"));
        return;
      }
      setQrGenerating(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const newTimestamp = Date.now();
            const qrLocation = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            };

            // Reverse-geocode using Google Maps API
            let qrLocationName = null;
            try {
              const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(qrLocation.lat)},${encodeURIComponent(qrLocation.lng)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
              const geoResp = await fetch(geoUrl);
              if (geoResp.ok) {
                const geoJson = await geoResp.json();
                qrLocationName = geoJson.results?.[0]?.formatted_address ?? null;
              }
            } catch (_) { /* non-critical, skip */ }

            const updatePayload = {
              validQRTimestamp: newTimestamp,
              qrLocation,
              updatedAt: serverTimestamp()
            };
            if (qrLocationName) updatePayload.qrLocationName = qrLocationName;

            await updateDoc(doc(db, "missions", projectId), updatePayload);
            await load(); // reload project (picks up new qrLocation + qrLocationName)
            resolve();
          } catch (err) {
            showToast("Failed to save QR location. Please try again.");
            reject(err);
          } finally {
            setQrGenerating(false);
          }
        },
        (err) => {
          setQrGenerating(false);
          showToast("Could not get your location. Please allow GPS access and try again.");
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };
  const generateQRValue = () => {
    const expiresAt = Date.now() + (30 * 60 * 1000); // After 30 minutes
    return JSON.stringify({
      eventId: projectId,
      expiresAt,
      location: project?.qrLocation ?? null
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
    loadSpecificActivities();
  }, [projectId]);

  const loadSpecificActivities = async () => {
    try {
      const snap = await getDocs(collection(db, "missions", projectId, "specificActivities"));
      setSpecificActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setSpecificActivities([]);
    }
  };

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
    project?.status === "draft" &&
    project?.approvals?.approvedBy?.approved === true &&
    project?.approvals?.endorsedBy?.approved === true;

  if (loading) return <p>Loading…</p>;
  if (!project) return <p>Project not found.</p>;

  //for archiving projects (admin-privilege)
  const handleArchive = async () => {
    if (!await showConfirm("Archive this project? You can restore it later.")) return;

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
    if (!await showConfirm("Restore this project to Draft?")) return;

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
    if (!await showConfirm("Delete this project permanently? This cannot be undone.")) return;

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
  // Sidebar style for overlay panel
  const sidebarStyle = sidebar
    ? {
      position: 'fixed',
      top: 0,
      right: 0,
      width: 420,
      height: '100vh',
      background: '#fff',
      borderLeft: '1px solid #e5e7eb',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
      zIndex: 1000,
      overflowY: 'auto',
      padding: 24,
      color: '#111',
      display: 'flex',
      flexDirection: 'column',
    }
    : { color: '#111' };

  // Card style for analytics panels
  const cardStyle = {
    background: '#fff',
    borderRadius: 16,
    boxShadow: '0 1px 8px #0001',
    padding: 24,
    marginBottom: 24,
    border: 'none',
  };

  // Close button for sidebar
  const closeBtn = sidebar && (
    <button
      onClick={onClose}
      style={{
        position: 'absolute',
        top: 18,
        left: 18,
        background: '#222',
        color: '#fff',
        border: 'none',
        borderRadius: '50%',
        width: 36,
        height: 36,
        fontSize: 22,
        fontWeight: 700,
        cursor: 'pointer',
        zIndex: 10,
        boxShadow: '0 2px 8px #0002',
      }}
      aria-label="Close"
    >
      ×
    </button>
  );

  return (
    <div style={sidebarStyle}>
      {closeBtn}
      {/* Export PDF using proposal under assets (demo) */}
      <button disabled type="button" onClick={handleExportPdf} style={{
        margin: '16px 0 12px 0',
        background: '#222',
        color: '#fff',
        border: 'none',
        borderRadius: 18,
        padding: '7px 18px',
        fontWeight: 600,
        fontSize: 15,
        cursor: 'not-allowed',
        width: 'fit-content',
        alignSelf: 'flex-start',
        opacity: 0.85,
      }}>
        Export PDF (still editing)
      </button>

      {/*mission title */}
      <h2 className="mission-title" style={{ marginTop: 0, marginBottom: 8, fontSize: 22, fontWeight: 700 }}>
        {project.title || "Untitled Mission"}
      </h2>
      {/*tags */}
      <div className="mission-tags" style={{ marginBottom: 18 }}>
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


      {/* Activities from specificActivities subcollection */}
      {specificActivities.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <h3 style={{ color: '#111', fontWeight: 700, margin: '0 0 8px 0', fontSize: 15 }}>Activities</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {specificActivities.map((act, idx) => (
              <div key={act.id || idx} style={{
                background: '#f8fafc',
                border: '1px solid #e5e7eb',
                borderRadius: 10,
                padding: '10px 14px',
              }}>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>
                  {act.title || act.name || `Activity ${idx + 1}`}
                </div>
                {act.description && (
                  <div style={{ color: '#64748b', fontSize: 13, marginTop: 4 }}>{act.description}</div>
                )}
                {act.date && (
                  <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>📅 {act.date}</div>
                )}
                {act.time && (
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>⏰ {act.time}</div>
                )}
                {act.location && (
                  <div style={{ color: '#94a3b8', fontSize: 12 }}>📍 {act.location}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* --- Analytics Section --- */}
      <h3 style={{ color: '#111', fontWeight: 700, margin: '18px 0 8px 0' }}>Analytics</h3>
      {/* Participation & Roster Analytics */}
      <div className="cem-panel cem-analytics" style={cardStyle}>
        <h2 className="cem-panel-title" style={{ color: '#23335b', fontSize: 18, marginBottom: 12, fontWeight: 700 }}>
          Participation & Roster Analytics
        </h2>
        <div className="cem-analytics-content">
          <div className="cem-metric-row"><span className="cem-metric-label">Volunteers Registered</span><span className="cem-metric-value">{allVolunteers.length} Volunteers</span></div>
          <div className="cem-metric-row"><span className="cem-metric-label">Volunteers Present</span><span className="cem-metric-value">{attendees.length} Volunteers</span></div>
          <div className="cem-metric-row"><span className="cem-metric-label">Attendance Success Rate</span><span className="cem-metric-badge success">{allVolunteers.length > 0 ? ((attendees.length / allVolunteers.length) * 100).toFixed(0) : 0}% out of 100</span></div>
          <button className="cem-btn-secondary" style={{ marginTop: 12, borderRadius: 18, fontWeight: 600, fontSize: 16, padding: '8px 18px' }} onClick={() => setShowRosterModal(true)}>
            View & Validate Roster
          </button>
        </div>
        {/* Roster Modal with Pie Chart */}
        {showRosterModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(44,62,80,0.18)',
              zIndex: 11000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setShowRosterModal(false)}
          >
            <div
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: 32,
                minWidth: 400,
                maxWidth: '90vw',
                boxShadow: '0 2px 16px #0002',
                position: 'relative',
                color: '#000',
                maxHeight: '80vh',
                overflowY: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: '#23335b',
                }}
                onClick={() => setShowRosterModal(false)}
              >
                ×
              </button>
              <h2 style={{ textAlign: 'center', marginBottom: 24, color: '#000' }}>Registered Volunteers</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                {/* Pie chart for attendance rate */}
                <svg width={120} height={120} viewBox="0 0 120 120" style={{ marginRight: 24 }}>
                  <circle
                    cx={60}
                    cy={60}
                    r={54}
                    fill="#f3f4f8"
                    stroke="#e0e4ea"
                    strokeWidth={12}
                  />
                  <circle
                    cx={60}
                    cy={60}
                    r={54}
                    fill="none"
                    stroke="#30bdb7"
                    strokeWidth={12}
                    strokeDasharray={`${allVolunteers.length > 0 ? ((attendees.length / allVolunteers.length) * 2 * Math.PI * 54).toFixed(2) : 0} ${(2 * Math.PI * 54 - (allVolunteers.length > 0 ? ((attendees.length / allVolunteers.length) * 2 * Math.PI * 54) : 0)).toFixed(2)}`}
                    strokeDashoffset={2 * Math.PI * 54 / 4}
                    style={{ transition: 'stroke-dasharray 0.6s' }}
                  />
                  <text
                    x="50%"
                    y="50%"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="1.5rem"
                    fontWeight="bold"
                    fill="#23335b"
                  >
                    {allVolunteers.length > 0 ? ((attendees.length / allVolunteers.length) * 100).toFixed(0) : 0}%
                  </text>
                </svg>
                <div style={{ fontWeight: 600, color: '#23335b', fontSize: '1.1rem' }}>
                  Attendance Success Rate
                  <div style={{ fontWeight: 400, color: '#888', fontSize: '0.95rem', marginTop: 4 }}>
                    {attendees.length} of {allVolunteers.length} present
                  </div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 8px #0001' }}>
                <thead>
                  <tr style={{ background: '#f3f4f8', color: '#23335b', borderBottom: '2px solid #e0e4ea' }}>
                    <th style={{ padding: '12px 10px', fontWeight: 700, textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '12px 10px', fontWeight: 700, textAlign: 'center' }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {allVolunteers.map((v, idx) => (
                    <tr key={v.uid || v.id || idx}>
                      <td style={{ padding: '10px 10px', color: '#111' }}>{v.name}</td>
                      <td style={{ padding: '10px 10px', textAlign: 'center', color: v.status === 'present' ? '#28a745' : '#888' }}>{v.status === 'present' ? 'Present' : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {/* Impact & Feedback Analytics (with charts) */}
      <div className="cem-panel cem-analytics" style={cardStyle}>
        <h2 className="cem-panel-title" style={{ color: '#23335b', fontSize: 18, marginBottom: 12, fontWeight: 700 }}>
          Impact & Feedback Analytics
        </h2>
        <div className="cem-analytics-content">
          <div className="cem-metric-row">
            <span className="cem-metric-label">Pre Activity Survey Answers</span>
            <span className="cem-metric-value">
              {allVolunteers.filter(v => v.preSurveyAnswers).length} submitted
            </span>
          </div>
          <div className="cem-metric-row">
            <span className="cem-metric-label">Post Activity Survey Answers</span>
            <span className="cem-metric-value">
              {allVolunteers.filter(v => v.postSurveyAnswers).length} submitted
            </span>
          </div>
          <div className="cem-metric-row">
            <span className="cem-metric-label">Community Feedback Answers</span>
            <span className="cem-metric-value">N/A</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8, gap: 8 }}>
            <button
              className="cem-btn-secondary"
              style={{ fontSize: 15, padding: '8px 18px', borderRadius: 18, fontWeight: 600 }}
              onClick={() => { setImpactModalType('pre'); setImpactModalOpen(true); }}
            >
              View Pre-Survey Analytics
            </button>
            <button
              className="cem-btn-secondary"
              style={{ fontSize: 15, padding: '8px 18px', borderRadius: 18, fontWeight: 600 }}
              onClick={() => { setImpactModalType('post'); setImpactModalOpen(true); }}
            >
              View Post-Survey Analytics
            </button>
          </div>
        </div>
      </div>
      {/* ImpactMetrics Modal (charts) */}
      {impactModalOpen && (
        <ImpactMetrics
          open={impactModalOpen}
          onClose={() => setImpactModalOpen(false)}
          volunteers={allVolunteers}
          showType={impactModalType}
        />
      )}
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
            <button onClick={() => generateNewQR().catch(() => {})} disabled={qrGenerating}>
              {qrGenerating ? "Getting location…" : "Reset"}
            </button>
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


      <h3 style={{ color: "#111" }}>Actions</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

        <button onClick={() => setStatus("published")}>
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
          {project?.qrLocationName && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#444", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              <span>📍</span>
              <span>{project.qrLocationName}</span>
            </div>
          )}
          <button
            disabled={qrGenerating}
            onClick={async () => {
              await generateNewQR().catch(() => {});
              setShowQR(true);
            }}
          >
            {qrGenerating ? "Getting location…" : "Generate Attendance QR"}
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