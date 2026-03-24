import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, serverTimestamp, Timestamp, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../firebaseConfig";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../../../components/Header";
import GlobalAnnouncements from "../../../components/GlobalAnnouncements";
import QRScanner from "../../../components/QRScanner";
import { createNotification } from "../../../utils/notificationUtils";
import { useSession } from '../../../context/SessionContext';
import ChooseGroup from './ChooseGroup';
import { calculateWeightedTaskPoints } from "../../../hooks/taskPointingSystem";
import "../../../styles/student.css";
import "../../../styles/EventActivity.css";
import PreActivitySurvey from "../../../forms/PreActivitySurvey.jsx";
import PostActivitySurvey from "../../../forms/PostActivitySurvey.jsx";

export default function EventActivity() {
  const { userData } = useSession();
  //Requirement panel containing all forms
  const RequirementItem = ({ label, status, onOpen }) => {
    const isLocked =
      status === "locked" && !onOpen;
    //(label === "Attendance (QR)");

    return (
      <div className={`requirement-item ${status}`} role="listitem">
        <span className="req-label">{label}</span>

        {isLocked && <span className="req-status muted" aria-label="Locked">🔒 Locked</span>}
        {status === "pending" && <span className="req-status pending">Pending</span>}
        {status === "submitted" && <span className="req-status done">✓ Submitted</span>}
        {onOpen && status !== "submitted" && (
          <button className="req-action" onClick={onOpen} aria-label={`Open ${label}`}>
            Open
          </button>
        )}

      </div>
    );
  };

  const [uploadedConsentFile, setUploadedConsentFile] = useState(null);
  const [selectedConsentFile, setSelectedConsentFile] = useState(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  // State for pre-activity survey modal (existing)
  const [showPreSurveyModal, setShowPreSurveyModal] = useState(false);
  // State for post-activity survey modal
  const [showPostSurveyModal, setShowPostSurveyModal] = useState(false);
  // State for group selection modal
  const [showChooseGroupModal, setShowChooseGroupModal] = useState(false);
  const [selectedGroupTask, setSelectedGroupTask] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();
  const location = useLocation();
  const mode = "active";
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrStatus, setQRStatus] = useState("");
  const [scannedLocation, setScannedLocation] = useState(null);
  const [scannerKey, setScannerKey] = useState(0);
  const [scanSuccess, setScanSuccess] = useState(false);

  const handleQRScan = async (decodedText, position) => {
    setQRStatus("");
    const projectId = id;
    const user = auth.currentUser;
    if (!user) {
      setQRStatus("You must be logged in to record attendance.");
      return;
    }
    try {
      let parsed = null;
      try {
        parsed = JSON.parse(decodedText);
      } catch (e) {
        setQRStatus("Invalid QR code format.");
        return;
      }
      if (!parsed || parsed.eventId !== projectId) {
        setQRStatus("This QR code is not valid for this event.");
        return;
      }
      if (Date.now() > parsed.expiresAt) {
        setQRStatus("QR code has expired.");
        return;
      }

      // Save scan location to volunteer doc (best-effort) and mark attendance present
      let locData = null;

      if (!position || !position.coords) {
        setQRStatus("Location not detected. Please allow GPS access and try again.");
        setScanSuccess(false);
        return;
      }

      locData = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      const volunteerRef = doc(db, "missions", projectId, "volunteer", user.uid);

      await updateDoc(volunteerRef, {
        "scanAttendance.location": locData,
        "scanAttendance.scannedAt": serverTimestamp(),
        "progress.attendance": "present"
      });

      setQRStatus(
        `Attendance recorded — scanned at ${locData.lat.toFixed(6)}, ${locData.lng.toFixed(6)} (±${Math.round(locData.accuracy)}m)`
      );

      setTimeout(() => {
        setShowQRModal(false);
      }, 2000); // when succeed close scanner after 2 seconds

      // If we have coordinates, attempt reverse geocoding via Google Maps Geocoding API (best-effort)
      if (locData) {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(locData.lat)},${encodeURIComponent(locData.lng)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const json = await resp.json();
            const locationName = (json.results && json.results[0]?.formatted_address) || null;
            if (locationName) {
              // save the resolved name to Firestore
              await updateDoc(volunteerRef, { "scanAttendance.locationName": locationName });
              locData.name = locationName;
            }
          }
        } catch (e) {
          console.warn('Reverse geocoding failed:', e);
        }
      }
    } catch (e) {
      console.warn("Failed to save scan location or mark attendance:", e);
    }

    // Update local state to reflect attendance as present
    setVolunteerProgress((prev) => ({ ...prev, attendance: "present" }));
    setScanSuccess(true);

    // Show a status message including coordinates if available (user will choose to Continue)
    setScannedLocation(locData);
    if (locData) {
      setQRStatus(`Attendance recorded — scanned at ${locData.lat.toFixed(6)}, ${locData.lng.toFixed(6)} (±${Math.round(locData.accuracy)}m)`);
    } else {
      setQRStatus("Location not detected. Please allow GPS access and try again."); setScanSuccess(false);
    }
};
//For saving consent file to be reviewed
const handleConsentSubmit = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in.");
      return;
    }
    if (!selectedConsentFile) {
      alert("Please select a PDF file.");
      return;
    }
    // ✅ PDF validation
    if (selectedConsentFile.type !== "application/pdf") {
      alert("Only PDF files are allowed.");
      return;
    }
    // ✅ File size limit (10MB)
    if (selectedConsentFile.size > 10 * 1024 * 1024) {
      alert("File must be less than 10MB.");
      return;
    }
    const fileRef = ref(
      storage,
      `consents/${id}/${user.uid}/${selectedConsentFile.name}`
    );
    // Upload to Storage
    await uploadBytes(fileRef, selectedConsentFile);
    const downloadURL = await getDownloadURL(fileRef);
    // Save metadata to Firestore
    await setDoc(
      doc(db, "missions", id, "volunteer", user.uid),
      {
        consentSubmission: {
          fileUrl: downloadURL,
          filePath: fileRef.fullPath,
          fileType: selectedConsentFile.type,
          submittedAt: serverTimestamp()
        },
        progress: {
          consent: "submitted"
        }
      },
      { merge: true }
    );
    setUploadedConsentFile(selectedConsentFile);
    setSelectedConsentFile(null);
    alert("Consent uploaded successfully!");
  } catch (error) {
    console.error("Upload error:", error);
    alert("Upload failed.");
  }
};


// All hooks at top level
// Placeholder form hooks
const coreSkills = [
  "Teamwork",
  "Communication",
  "Problem Solving",
  "Leadership",
  "Time Management",
  "Adaptability",
  "Conflict Resolution",
  "Empathy",
  "Critical Thinking",
  "Responsibility",
];
const technicalSkills = [
  "Data Analysis",
  "Coding/Programming",
  "Web Design",
  "Social Media Management",
  "Digital Literacy",
  "Spreadsheet Skills",
  "Presentation Software",
  "Video Editing",
  "IT Troubleshooting",
  "Database Management",
];
const specializedSkills = [
  "Project Planning",
  "Grant Writing",
  "Event Coordination",
  "Research Methods",
  "Survey Design",
  "Workshop Facilitation",
  "Community Assessment",
  "Policy Analysis",
  "Report Writing",
  "Monitoring & Evaluation",
];
const [showCoreDropdown, setShowCoreDropdown] = React.useState(false);
const [showTechnicalDropdown, setShowTechnicalDropdown] =
  React.useState(false);
const [showSpecializedDropdown, setShowSpecializedDropdown] =
  React.useState(false);
const [easySkills, setEasySkills] = React.useState("");
const [moderateSkills, setModerateSkills] = React.useState("");
const [hardSkills, setHardSkills] = React.useState("");

const [journalReflections, setJournalReflections] = useState({});
const [submitStatus, setSubmitStatus] = useState({});
const [userJournals, setUserJournals] = useState([]);
const [editingJournalId, setEditingJournalId] = useState(null);
const [editingJournalText, setEditingJournalText] = useState("");
const [enrolledTasks, setEnrolledTasks] = useState({});
const [volunteerProgress, setVolunteerProgress] = useState(null);
const [expandedTasks, setExpandedTasks] = useState({});
const canJoinActivities = true;
const toggleTaskExpand = (taskId) => setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
// Handler for adding a skill to a level (for placeholder)
const handleAddSkill = (skill, level) => {
  if (level === "easy")
    setEasySkills(easySkills ? easySkills + "\n" + skill : skill);
  if (level === "moderate")
    setModerateSkills(moderateSkills ? moderateSkills + "\n" + skill : skill);
  if (level === "hard")
    setHardSkills(hardSkills ? hardSkills + "\n" + skill : skill);
  setShowCoreDropdown(false);
  setShowTechnicalDropdown(false);
  setShowSpecializedDropdown(false);
};

// Journal handlers
const handleJournalChange = (idx, value) => {
  setJournalReflections((prev) => ({ ...prev, [idx]: value }));
};
const handleJournalSubmit = async (activityIdx, activity) => {
  const user = auth.currentUser;
  if (!user) {
    setSubmitStatus((prev) => ({
      ...prev,
      [activityIdx]: "You must be logged in.",
    }));
    return;
  }
  if (
    !journalReflections[activityIdx] ||
    !journalReflections[activityIdx].trim()
  ) {
    setSubmitStatus((prev) => ({
      ...prev,
      [activityIdx]: "Reflection cannot be empty.",
    }));
    return;
  }
  try {
    // Update the reflection field in the participant document
    const participantRef = doc(
      db,
      "missions",
      id,
      "task",
      activity.id,
      "participants",
      user.uid
    );

    let pointsToAward = activity.points || 0;
    if (activity?.type !== "grouped") {
      const participantsRef = collection(
        db,
        "missions",
        id,
        "task",
        activity.id,
        "participants"
      );
      const [participantSnap, participantsSnap] = await Promise.all([
        getDoc(participantRef),
        getDocs(participantsRef),
      ]);
      const participantCount = participantsSnap.size;
      const enrollmentOrder = participantSnap.exists()
        ? participantSnap.data().enrollmentOrder
        : null;
      const position =
        Number.isFinite(enrollmentOrder) && enrollmentOrder > 0
          ? enrollmentOrder
          : participantCount;

      pointsToAward = calculateWeightedTaskPoints(
        activity.points || 0,
        position,
        participantCount
      );
    }

    await updateDoc(participantRef, {
      reflection: journalReflections[activityIdx],
      status: "completed",
      pointsEarned: pointsToAward,
      completedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });

    // Update volunteer's total points in the event
    const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
    const volunteerSnap = await getDoc(volunteerRef);
    if (volunteerSnap.exists()) {
      const currentTotal = volunteerSnap.data().pointsEarned || 0;
      const newTotal = currentTotal + pointsToAward;
      await updateDoc(volunteerRef, {
        pointsEarned: newTotal,
      });
      // Update the displayed total
      setTotalPointsEarned(newTotal);

      // Check for level up (calculate across all missions)
      const missionsRef = collection(db, "missions");
      const missionsSnap = await getDocs(missionsRef);
      let totalPointsAllMissions = 0;

      for (const missionDoc of missionsSnap.docs) {
        const volRef = doc(db, "missions", missionDoc.id, "volunteer", user.uid);
        const volSnap = await getDoc(volRef);
        if (volSnap.exists()) {
          totalPointsAllMissions += volSnap.data().pointsEarned || 0;
        }
      }

      // Calculate old and new level (every 100 points = 1 level)
      const oldLevel = Math.floor((totalPointsAllMissions - pointsToAward) / 100) + 1;
      const newLevel = Math.floor(totalPointsAllMissions / 100) + 1;

      // Send level up notification if level increased
      if (newLevel > oldLevel) {
        await createNotification(user.uid, {
          type: "level_up",
          title: "Level Up!",
          message: `Congratulations! You've reached Level ${newLevel}! 🎉`,
          link: "/student"
        });
      }
    }

    setSubmitStatus((prev) => ({
      ...prev,
      [activityIdx]: `Reflection submitted! +${pointsToAward} points earned!`,
    }));
    setJournalReflections((prev) => ({ ...prev, [activityIdx]: "" }));

    // Send points earned notification
    if (pointsToAward > 0) {
      await createNotification(user.uid, {
        type: "points_earned",
        title: "Points Earned!",
        message: `You earned ${pointsToAward} points for completing "${activity.title}"`,
        link: `/event/${id}/activity`
      });
    }

    // Send notification to student
    await createNotification(user.uid, {
      type: "reflection_submitted",
      title: "Reflection Submitted",
      message: `Your reflection for "${activity.title}" has been submitted successfully!`,
      link: `/event/${id}/activity`
    });

    // Refresh journals to show the updated reflection
    await fetchUserJournals();
  } catch (err) {
    console.error("Error submitting reflection:", err);
    setSubmitStatus((prev) => ({
      ...prev,
      [activityIdx]: "Error submitting. Try again.",
    }));
  }
};

// Helper function to fetch user journals from participant documents
const fetchUserJournals = async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Fetch all tasks for this mission
    const tasksRef = collection(db, "missions", id, "task");
    const tasksSnap = await getDocs(tasksRef);

    const journals = [];
    // For each task, check if user has a participant document with a reflection
    for (const taskDoc of tasksSnap.docs) {
      const participantRef = doc(
        db,
        "missions",
        id,
        "task",
        taskDoc.id,
        "participants",
        user.uid
      );
      const participantSnap = await getDoc(participantRef);

      if (participantSnap.exists()) {
        const data = participantSnap.data();
        if (data.reflection && data.reflection.trim()) {
          journals.push({
            id: taskDoc.id,
            taskId: taskDoc.id,
            activityId: taskDoc.data().title,
            reflection: data.reflection,
            ...data,
          });
        }
      }
    }

    setUserJournals(journals);
  } catch (err) {
    console.error("Error fetching journals:", err);
  }
};

useEffect(() => {
  async function fetchEventAndJournals() {
    try {
      const eventRef = doc(db, "missions", id);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        setEvent(eventSnap.data());
      } else {
        console.error("Event not found for id:", id);
      }
      // Fetch user journals from participant documents
      await fetchUserJournals();
    } catch (err) {
      console.error("Error fetching event or journals:", err);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }
  fetchEventAndJournals();
}, [id, auth.currentUser]);

// Edit journal handler
const handleEditJournal = (journal) => {
  setEditingJournalId(journal.taskId);
  setEditingJournalText(journal.reflection);
};

const handleSaveEditJournal = async (journal) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    const participantRef = doc(
      db,
      "missions",
      id,
      "task",
      journal.taskId,
      "participants",
      user.uid
    );
    await updateDoc(participantRef, {
      reflection: editingJournalText,
      lastUpdated: new Date().toISOString(),
    });
    setEditingJournalId(null);
    setEditingJournalText("");
    await fetchUserJournals();
  } catch (err) {
    alert("Failed to update journal.");
  }
};

const handleDeleteJournal = async (taskId) => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    // Clear the reflection field instead of deleting the participant document
    const participantRef = doc(
      db,
      "missions",
      id,
      "task",
      taskId,
      "participants",
      user.uid
    );
    const participantSnap = await getDoc(participantRef);
    const pointsToRemove = participantSnap.exists()
      ? participantSnap.data().pointsEarned || 0
      : 0;

    await updateDoc(participantRef, {
      reflection: "",
      status: "todo",
      pointsEarned: 0,
      lastUpdated: new Date().toISOString(),
    });

    if (pointsToRemove > 0) {
      const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
      const volunteerSnap = await getDoc(volunteerRef);
      if (volunteerSnap.exists()) {
        const currentTotal = volunteerSnap.data().pointsEarned || 0;
        const newTotal = Math.max(0, currentTotal - pointsToRemove);
        await updateDoc(volunteerRef, { pointsEarned: newTotal });
        setTotalPointsEarned(newTotal);
      }
    }

    setUserJournals(userJournals.filter((j) => j.taskId !== taskId));
  } catch (err) {
    alert("Failed to delete journal.");
  }
};

const handleJoinActivity = async (taskId, task) => {
  const user = auth.currentUser;
  if (!user) {
    alert("You must be logged in to join an activity.");
    return;
  }

  if (event?.targetDate && task?.enrollmentDeadline) {
    const today = new Date().toLocaleDateString("en-CA");
    if (today !== event.targetDate) {
      alert("Enrollment is only open on the task due date.");
      return;
    }
    const nowTime = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (nowTime > task.enrollmentDeadline) {
      alert("Enrollment deadline has passed for this task.");
      return;
    }
  }

  // Check if task is grouped
  if (task?.type === "grouped") {
    // Show group selection modal
    setSelectedGroupTask({ taskId, task });
    setShowChooseGroupModal(true);
    return;
  }

  // Individual task - proceed with direct enrollment
  try {
    const participantRef = doc(
      db,
      "missions",
      id,
      "task",
      taskId,
      "participants",
      user.uid
    );
    const participantSnap = await getDoc(participantRef);

    if (participantSnap.exists()) {
      alert("You are already enrolled in this activity!");
      return;
    }

    const participantsRef = collection(
      db,
      "missions",
      id,
      "task",
      taskId,
      "participants"
    );
    const participantsSnap = await getDocs(participantsRef);
    const enrollmentOrder = participantsSnap.size + 1;

    // Create participant document with user UID as document ID
    await setDoc(participantRef, {
      status: "todo",
      role: "",
      proof: "",
      reflection: "",
      enrollmentOrder,
      joinedAt: new Date().toISOString(),
    });

    // Update local state
    setEnrolledTasks((prev) => ({ ...prev, [taskId]: true }));
    alert("Successfully enrolled in the activity!");
  } catch (err) {
    console.error("Error enrolling in activity:", err);
    alert("Failed to enroll. Please try again.");
  }
};

// Handle group selection for grouped tasks
const handleGroupSelected = async ({ groupId, isNew }) => {
  const user = auth.currentUser;
  if (!user || !selectedGroupTask) return;

  const { taskId } = selectedGroupTask;

  try {
    const participantRef = doc(
      db,
      "missions",
      id,
      "task",
      taskId,
      "participants",
      user.uid
    );

    // Create participant document with group info
    await setDoc(participantRef, {
      status: "enrolled",
      groupId: groupId,
      role: "",
      proof: "",
      reflection: "",
      joinedAt: new Date().toISOString(),
    });

    // Update local state
    setEnrolledTasks((prev) => ({ ...prev, [taskId]: true }));
    alert(`Successfully joined ${isNew ? 'new' : ''} group!`);

    // Reload tasks to reflect enrollment
    await fetchUserJournals();
  } catch (err) {
    console.error("Error enrolling in grouped activity:", err);
    alert("Failed to enroll. Please try again.");
  }
};

// Conditional rendering for placeholder
if (id === "placeholder") {
  const navigate = useNavigate();
  const [activityTitle, setActivityTitle] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const location = useLocation();
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!activityTitle.trim()) return;
    // Compose activity object
    const newActivity = {
      id: Date.now(),
      name: activityTitle,
      role: roleDescription,
      easySkills,
      moderateSkills,
      hardSkills,
    };
    // Merge previous activities with new activity
    let prevActivities = Array.isArray(location.state?.activities)
      ? location.state.activities
      : [];
    // Only add if not already present (by id)
    if (!prevActivities.some((a) => a.id === newActivity.id)) {
      prevActivities = [...prevActivities, newActivity];
    }
    // Redirect back to proposal page 3/3 with all activities
    navigate("/student/propose-project?page=3", {
      state: { newActivity, activities: prevActivities },
    });
  };

  return (
    <div
      style={{
        background: "#f7f9fa",
        minHeight: "100vh",
        padding: 32,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <form
        style={{
          background: "#fff",
          borderRadius: 20,
          padding: 32,
          minWidth: 800,
          maxWidth: 900,
          boxShadow: "0 2px 8px #0001",
          border: "4px solid #3386e6",
        }}
        onSubmit={handleSubmit}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: "#2566b3" }}>
            Service-Learning Proposal
          </span>
          <span
            style={{ fontSize: 22, color: "#3386e6", cursor: "pointer" }}
            title="Info"
          >
            ℹ️
          </span>
        </div>
        <div
          style={{
            fontWeight: 700,
            fontSize: 22,
            color: "#2566b3",
            marginBottom: 18,
            textAlign: "center",
          }}
        >
          Specific Activity
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 18,
          }}
        >
          {/* Main form and skill dropdowns */}
          <React.Fragment>
            <div>
              <label style={{ fontWeight: 600, color: "#2566b3" }}>
                Activity Title
              </label>
              <input
                type="text"
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1.5px solid #1ea7fd",
                  marginBottom: 12,
                  marginTop: 4,
                  color: "#234e7b",
                  background: "#fff",
                }}
                placeholder=""
              />
              <label style={{ fontWeight: 600, color: "#2566b3" }}>
                Role Description
              </label>
              <textarea
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  borderRadius: 6,
                  border: "1.5px solid #1ea7fd",
                  minHeight: 100,
                  marginBottom: 12,
                  marginTop: 4,
                  color: "#234e7b",
                  background: "#fff",
                }}
                placeholder=""
              />
              <label style={{ fontWeight: 600, color: "#2566b3" }}>
                Type of Skills:
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  position: "relative",
                }}
              >
                {/* Core Skills Dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1.5px solid #1ea7fd",
                      color: "#234e7b",
                      background: "#fff",
                      textAlign: "left",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setShowCoreDropdown((v) => !v);
                      setShowTechnicalDropdown(false);
                      setShowSpecializedDropdown(false);
                    }}
                  >
                    Core Service & Soft Skills ▼
                  </button>
                  {showCoreDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        zIndex: 10,
                        background: "#fff",
                        border: "1.5px solid #1ea7fd",
                        borderRadius: 6,
                        width: "100%",
                        boxShadow: "0 2px 8px #0002",
                        marginTop: 2,
                      }}
                    >
                      {coreSkills.map((skill) => (
                        <div
                          key={skill}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: "#2566b3" }}>{skill}</span>
                          <div>
                            <button
                              type="button"
                              style={{
                                marginRight: 4,
                                background: "none",
                                color: "#2566b3",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() => handleAddSkill(skill, "easy")}
                            >
                              Easy
                            </button>
                            <button
                              type="button"
                              style={{
                                marginRight: 4,
                                background: "none",
                                color: "#e6a700",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() =>
                                handleAddSkill(skill, "moderate")
                              }
                            >
                              Moderate
                            </button>
                            <button
                              type="button"
                              style={{
                                background: "none",
                                color: "#d32f2f",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() => handleAddSkill(skill, "hard")}
                            >
                              Hard
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Technical Skills Dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1.5px solid #1ea7fd",
                      color: "#234e7b",
                      background: "#fff",
                      textAlign: "left",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setShowTechnicalDropdown((v) => !v);
                      setShowCoreDropdown(false);
                      setShowSpecializedDropdown(false);
                    }}
                  >
                    Technical & Digital Skills ▼
                  </button>
                  {showTechnicalDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        zIndex: 10,
                        background: "#fff",
                        border: "1.5px solid #1ea7fd",
                        borderRadius: 6,
                        width: "100%",
                        boxShadow: "0 2px 8px #0002",
                        marginTop: 2,
                      }}
                    >
                      {technicalSkills.map((skill) => (
                        <div
                          key={skill}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: "#2566b3" }}>{skill}</span>
                          <div>
                            <button
                              type="button"
                              style={{
                                marginRight: 4,
                                background: "none",
                                color: "#2566b3",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() => handleAddSkill(skill, "easy")}
                            >
                              Easy
                            </button>
                            <button
                              type="button"
                              style={{
                                marginRight: 4,
                                background: "none",
                                color: "#e6a700",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() =>
                                handleAddSkill(skill, "moderate")
                              }
                            >
                              Moderate
                            </button>
                            <button
                              type="button"
                              style={{
                                background: "none",
                                color: "#d32f2f",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() => handleAddSkill(skill, "hard")}
                            >
                              Hard
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Specialized Skills Dropdown */}
                <div style={{ position: "relative" }}>
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1.5px solid #1ea7fd",
                      color: "#234e7b",
                      background: "#fff",
                      textAlign: "left",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      setShowSpecializedDropdown((v) => !v);
                      setShowCoreDropdown(false);
                      setShowTechnicalDropdown(false);
                    }}
                  >
                    Specialized Project Skills ▼
                  </button>
                  {showSpecializedDropdown && (
                    <div
                      style={{
                        position: "absolute",
                        zIndex: 10,
                        background: "#fff",
                        border: "1.5px solid #1ea7fd",
                        borderRadius: 6,
                        width: "100%",
                        boxShadow: "0 2px 8px #0002",
                        marginTop: 2,
                      }}
                    >
                      {specializedSkills.map((skill) => (
                        <div
                          key={skill}
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ color: "#2566b3" }}>{skill}</span>
                          <div>
                            <button
                              type="button"
                              style={{
                                marginRight: 4,
                                background: "none",
                                color: "#2566b3",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() => handleAddSkill(skill, "easy")}
                            >
                              Easy
                            </button>
                            <button
                              type="button"
                              style={{
                                marginRight: 4,
                                background: "none",
                                color: "#e6a700",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() =>
                                handleAddSkill(skill, "moderate")
                              }
                            >
                              Moderate
                            </button>
                            <button
                              type="button"
                              style={{
                                background: "none",
                                color: "#d32f2f",
                                border: "1px solid #ccc",
                                borderRadius: 4,
                                padding: "2px 8px",
                                cursor: "pointer",
                                fontWeight: 600,
                              }}
                              onClick={() => handleAddSkill(skill, "hard")}
                            >
                              Hard
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontWeight: 600, color: "#2566b3" }}>
                Required Skills:
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr",
                  gap: 8,
                }}
              >
                <div>
                  <label style={{ fontWeight: 500, color: "#2566b3" }}>
                    Easy Skills
                  </label>
                  <textarea
                    value={easySkills}
                    onChange={(e) => setEasySkills(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1.5px solid #1ea7fd",
                      minHeight: 40,
                      marginBottom: 4,
                      color: "#234e7b",
                      background: "#fff",
                    }}
                    placeholder=""
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 500, color: "#2566b3" }}>
                    Moderate Skills
                  </label>
                  <textarea
                    value={moderateSkills}
                    onChange={(e) => setModerateSkills(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1.5px solid #1ea7fd",
                      minHeight: 40,
                      marginBottom: 4,
                      color: "#234e7b",
                      background: "#fff",
                    }}
                    placeholder=""
                  />
                </div>
                <div>
                  <label style={{ fontWeight: 500, color: "#2566b3" }}>
                    Hard Skills
                  </label>
                  <textarea
                    value={hardSkills}
                    onChange={(e) => setHardSkills(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 8,
                      borderRadius: 6,
                      border: "1.5px solid #1ea7fd",
                      minHeight: 40,
                      marginBottom: 4,
                      color: "#234e7b",
                      background: "#fff",
                    }}
                    placeholder=""
                  />
                </div>
              </div>
            </div>
          </React.Fragment>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 24,
          }}
        >
          <button
            type="submit"
            style={{
              background: "#1ea7fd",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "12px 32px",
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            CONFIRM
          </button>
        </div>
      </form>
    </div>
  );
}

//for when this event will be able to
//add journal, scan attendance, and answer post-survey
const [event, setEvent] = useState(null);
const today = new Date().toLocaleDateString("en-CA");
const eventDate = event?.targetDate;
const isEventDay = eventDate === today;
const isAfterEvent = today > eventDate;
const [tasks, setTasks] = useState([]);
const [preSurveyData, setPreSurveyData] = useState(null);
const [loading, setLoading] = useState(true);
const [totalPointsEarned, setTotalPointsEarned] = useState(0);
const [leaderboard, setLeaderboard] = useState([]);
const leaderboardListRef = useRef(null);
const currentUserRef = useRef(null);
const previousRankRef = useRef(null);
const hasLeaderboardLoadedRef = useRef(false);

useEffect(() => {
  let unsubscribe = null;
  async function fetchEvent() {
    try {
      const eventRef = doc(db, "missions", id);
      const eventSnap = await getDoc(eventRef);
      if (eventSnap.exists()) {
        setEvent(eventSnap.data());

        // Fetch tasks from tasks subcollection
        const tasksRef = collection(db, "missions", id, "task");
        const tasksSnap = await getDocs(tasksRef);
        const tasksData = tasksSnap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTasks(tasksData);

        // Check enrollment status for each task and get volunteer points
        const user = auth.currentUser;
        if (user) {
          const preSurveyRef = doc(
            db,
            "missions",
            id,
            "volunteer",
            user.uid,
            "preSurvey",
            "response"
          );

          const preSurveySnap = await getDoc(preSurveyRef);

          if (preSurveySnap.exists()) {
            const data = preSurveySnap.data();
            setPreSurveyData(data.respondent);
          }

          const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
          unsubscribe = onSnapshot(volunteerRef, (snap) => {
            if (!snap.exists()) {
              navigate(`/event/${id}`);
              return;
            }

            const data = snap.data();

            if (data.registrationStatus !== "approved") {
              navigate(`/event/${id}`);
              return;
            }

            setVolunteerProgress(data.progress || {});
            setTotalPointsEarned(data.pointsEarned || 0);
          });

          // Enrollment status for each task
          const enrollmentStatus = {};
          for (const task of tasksData) {
            const participantRef = doc(
              db,
              "missions",
              id,
              "task",
              task.id,
              "participants",
              user.uid
            );
            const participantSnap = await getDoc(participantRef);
            enrollmentStatus[task.id] = participantSnap.exists();
          }
          setEnrolledTasks(enrollmentStatus);
        }
      } else {
        console.error("Event not found for id:", id);
      }
    } catch (err) {
      console.error("Error fetching event:", err);
      setEvent(null);
    } finally {
      setLoading(false);
    }
  }
  fetchEvent();
  return () => {
    if (unsubscribe) unsubscribe();
  };
}, [id]);

useEffect(() => {
  async function fetchEventLeaderboard() {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const volunteersSnap = await getDocs(
        collection(db, "missions", id, "volunteer")
      );

      const usersMap = new Map();
      usersSnap.docs.forEach((userDoc) => {
        usersMap.set(userDoc.id, userDoc.data());
      });

      const leaderboardData = volunteersSnap.docs.map((volunteerDoc) => {
        const userId = volunteerDoc.id;
        const userData = usersMap.get(userId) || {};
        const name =
          userData.username ||
          userData.name ||
          userData.email?.split("@")[0] ||
          "Volunteer";

        return {
          uid: userId,
          name,
          points: volunteerDoc.data().pointsEarned || 0,
          avatar:
            userData.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              name
            )}&background=30bdb7&color=fff&size=120`,
        };
      });

      leaderboardData.sort((a, b) => b.points - a.points);

      const notifyRankChange = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const missionsSnap = await getDocs(collection(db, "missions"));
        const pointsByUser = new Map();

        for (const missionDoc of missionsSnap.docs) {
          const volunteersSnap = await getDocs(
            collection(db, "missions", missionDoc.id, "volunteer")
          );
          volunteersSnap.docs.forEach((volunteerDoc) => {
            const currentPoints = pointsByUser.get(volunteerDoc.id) || 0;
            const pointsToAdd = volunteerDoc.data().pointsEarned || 0;
            pointsByUser.set(volunteerDoc.id, currentPoints + pointsToAdd);
          });
        }

        if (!pointsByUser.has(user.uid)) return;

        const globalLeaderboard = Array.from(pointsByUser.entries()).map(
          ([uid, points]) => ({ uid, points })
        );
        globalLeaderboard.sort(
          (a, b) => b.points - a.points || a.uid.localeCompare(b.uid)
        );

        const newIndex = globalLeaderboard.findIndex(
          (entry) => entry.uid === user.uid
        );
        if (newIndex === -1) return;

        const newRank = newIndex + 1;
        const previousRank = previousRankRef.current;
        previousRankRef.current = newRank;

        if (!hasLeaderboardLoadedRef.current) {
          hasLeaderboardLoadedRef.current = true;
          return;
        }

        if (!previousRank || previousRank === newRank) return;

        const cutoff = Timestamp.fromDate(
          new Date(Date.now() - 24 * 60 * 60 * 1000)
        );
        const notificationsRef = collection(
          db,
          "users",
          user.uid,
          "notifications"
        );
        const recentQuery = query(
          notificationsRef,
          where("type", "==", "leaderboard_rank_global"),
          where("createdAt", ">=", cutoff)
        );
        const recentSnap = await getDocs(recentQuery);
        if (!recentSnap.empty) return;

        const ordinal = (rank) => {
          const j = rank % 10;
          const k = rank % 100;
          if (j === 1 && k !== 11) return `${rank}st`;
          if (j === 2 && k !== 12) return `${rank}nd`;
          if (j === 3 && k !== 13) return `${rank}rd`;
          return `${rank}th`;
        };

        const direction = newRank < previousRank ? "up" : "down";
        const title =
          direction === "up" ? "Leaderboard Rank Up" : "Leaderboard Rank Down";
        const message =
          direction === "up"
            ? `You moved up to ${ordinal(newRank)} place on the overall leaderboard.`
            : `You moved down to ${ordinal(newRank)} place on the overall leaderboard.`;

        await createNotification(user.uid, {
          type: "leaderboard_rank_global",
          title,
          message,
          link: "/student",
          rank: {
            from: previousRank,
            to: newRank,
            direction,
          },
        });
      };

      await notifyRankChange();
      setLeaderboard(leaderboardData);
    } catch (error) {
      console.error("Error fetching event leaderboard:", error);
    }
  }

  if (id) {
    fetchEventLeaderboard();
  }
}, [id, totalPointsEarned]);

useEffect(() => {
  const container = leaderboardListRef.current;
  const item = currentUserRef.current;

  if (!container || !item) return;

  requestAnimationFrame(() => {
    const containerHeight = container.getBoundingClientRect().height;
    const itemRect = item.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const itemCenter =
      itemRect.top - containerRect.top + itemRect.height / 2;

    const scrollTop =
      itemCenter - containerHeight / 2 + container.scrollTop;

    container.scrollTo({
      top: scrollTop,
      behavior: "auto",
    });
  });
}, [leaderboard]);

if (loading) {
  return (
    <div className="full-page">
      <Header />
      <div className="header-spacer" />
      <div className="ea-fullpage-center">
        <div className="page-spinner" />
        <p style={{ marginTop: 16, color: '#6b7280', fontSize: 14 }}>Loading event…</p>
      </div>
    </div>
  );
}
if (!event) {
  return (
    <div className="full-page">
      <Header />
      <div className="header-spacer" />
      <div className="ea-fullpage-center">
        <span style={{ fontSize: 48 }}>😕</span>
        <h2 style={{ color: '#374151', marginTop: 12 }}>Event not found</h2>
        <p style={{ color: '#6b7280' }}>Check the event ID in the URL or verify your Firestore data.</p>
        <button className="ui-btn" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>Go Back</button>
      </div>
    </div>
  );
}
if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
  return (
    <div className="full-page">
      <Header />
      <div className="header-spacer" />
      <div className="ea-fullpage-center">
        <span style={{ fontSize: 48 }}>📋</span>
        <h2 style={{ color: '#374151', marginTop: 12 }}>No tasks yet</h2>
        <p style={{ color: '#6b7280' }}>No tasks have been added to this event.</p>
        <button className="ui-btn" style={{ marginTop: 16 }} onClick={() => navigate(-1)}>Go Back</button>
      </div>
    </div>
  );
  return (
    <div style={{ display: 'none' }}>
    </div>
  );
}

const sortedLeaderboard = [...leaderboard].sort(
  (a, b) => b.points - a.points
);
const top1 = sortedLeaderboard[0];
const top2 = sortedLeaderboard[1];
const top3 = sortedLeaderboard[2];
const podium = [top2, top1, top3].filter(Boolean);
const currentUserId = auth.currentUser?.uid;
const currentUserIndex = sortedLeaderboard.findIndex(
  (user) => user.uid === currentUserId
);
const currentUserRank =
  currentUserIndex !== -1 ? currentUserIndex + 1 : null;

const getOrdinal = (rank) => {
  if (!rank) return "";

  const j = rank % 10;
  const k = rank % 100;

  if (j === 1 && k !== 11) return `${rank}st`;
  if (j === 2 && k !== 12) return `${rank}nd`;
  if (j === 3 && k !== 13) return `${rank}rd`;
  return `${rank}th`;
};

const openUserProfile = (uid) => {
  if (!uid) return;
  try {
    if (window.showUserProfile && typeof window.showUserProfile === "function") {
      window.showUserProfile(uid);
      console.debug("openUserProfile -> window.showUserProfile", uid);
      return;
    }
  } catch (err) {
    console.warn("error calling window.showUserProfile", err);
  }
  // fallback to profile route
  navigate(`/profile/${uid}`);
};

return (
  <div className="full-page">
    <Header />
    <div className="header-spacer"></div>
    <div className="event-activity-container">
      {/* Left Side: Event Summary */}
      <div className="event-left-panel">
        <div className="event-summary-card">
          <div className="event-summary-image">
            <img
              src={event.img && event.img.trim() !== "" ? event.img : "/assets/mission1.jpg"}
              alt={event.alt || "Event"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          {/* Green card */}
          <div className="event-summary-body">
            <h2 className="event-summary-title">
              {event.title}
            </h2>
            <p className="event-summary-description">
              {event.description}
            </p>
            {/* White info box */}
            <div className="event-info-box">
              <div className="ea-info-item">
                <span className="ea-info-icon">📍</span>
                <div>
                  <div className="ea-info-label">Location</div>
                  <div className="ea-info-value">{event.location || 'TBA'}</div>
                </div>
              </div>
              <div className="ea-info-item">
                <span className="ea-info-icon">📅</span>
                <div>
                  <div className="ea-info-label">Date &amp; Time</div>
                  <div className="ea-info-value">{event.date || 'TBA'}{event.time ? ` · ${event.time}` : ''}</div>
                </div>
              </div>
              <div className="ea-info-item">
                <span className="ea-info-icon">⭐</span>
                <div>
                  <div className="ea-info-label">Event Points</div>
                  <div className="ea-info-value ea-pts-value">{event.points || 0} pts</div>
                </div>
              </div>
              {/* Your Points Earned */}
              <div className="ea-points-earned-box">
                <div className="ea-points-earned-label">Your Points Earned</div>
                <div className="ea-points-earned-value">{totalPointsEarned}</div>
                <div className="ea-points-earned-sub">pts</div>
                {event.points > 0 && (
                  <div className="ea-points-bar-wrap">
                    <div className="ea-points-bar-fill" style={{ width: `${Math.min(100, (totalPointsEarned / event.points) * 100)}%` }} />
                  </div>
                )}
              </div>
              {event.badge && (
                <div className="ea-info-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <div className="ea-info-label">Event Badge</div>
                  <img src={event.badge} alt="Event Badge" className="image-badge" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEADERBOARD */}
        <div className="event-leaderboard-card">
          <section className="leaderboard-section">
            <div className="mission-section-header">
              <h2 style={{ color: "#000" }}>Activity Leaderboard</h2>
            </div>
            <div className="leaderboard-body">
              <div className="leaderboard-podium">
                {podium.map((user) => {
                  const rank =
                    user.uid === top1?.uid ? 1 : user.uid === top2?.uid ? 2 : 3;

                  return (
                    <div key={user.uid} className={`podium-item rank-${rank}`}>
                      <div className="podium-top">
                        <div
                          className="podium-avatar-wrap"
                          role="button"
                          tabIndex={0}
                          aria-label={`Open profile for ${user.name}`}
                          onClick={() => openUserProfile(user.uid)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              openUserProfile(user.uid);
                              e.preventDefault();
                            }
                          }}
                        >
                          <img src={user.avatar} alt={user.name} />
                          <span className="podium-rank">{rank}</span>
                        </div>

                        <div className="podium-info">
                          <div className="podium-name">{user.name}</div>
                          <div className="podium-points">{user.points} pts</div>
                        </div>
                      </div>
                      <div className={`podium-base rank-${rank}`}></div>
                    </div>
                  );
                })}
              </div>
              <div className="leaderboard-list" ref={leaderboardListRef}>
                {sortedLeaderboard.length === 0 ? (
                  <div style={{ padding: "12px 14px", color: "#6b7280" }}>
                    No participants yet.
                  </div>
                ) : (
                  sortedLeaderboard.map((user, index) => {
                    const rank = index + 1;
                    return (
                      <div
                        key={user.uid}
                        ref={user.uid === currentUserId ? currentUserRef : null}
                        className={`leaderboard-row ${user.uid === currentUserId ? "is-current-user" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-label={`Open profile for ${user.name}`}
                        onClick={() => openUserProfile(user.uid)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            openUserProfile(user.uid);
                            e.preventDefault();
                          }
                        }}
                      >
                        <span className="rank-num">{rank}</span>
                        <img
                          src={user.avatar}
                          alt={`${user.name}'s avatar`}
                          className="leaderboard-avatar"
                        ></img>
                        <span className="rank-name">{user.name}</span>
                        <span className="rank-points">{user.points} pts</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Right Side: Activity Section & Requirement */}
      <div className="event-right-panel">
        <div className="event-activities-panel">
          <h2 className="event-activities-title">
            Activities
          </h2>
          {/*TASKS AVAILABLE FOR THIS SPECIFIC EVENT*/}
          {tasks &&
            tasks.map((activity, idx) => {
              const journalsForActivity = userJournals.filter(
                (j) => j.activityId === activity.title
              );
              const isEnrolled = !!enrolledTasks[activity.id];
              const isExpanded = !!expandedTasks[activity.id];
              const journalText = journalReflections[idx] || "";
              const charCount = journalText.length;
              return (
                <div key={idx} className={`ea-task-card${isEnrolled ? ' enrolled' : ''}`}>
                  {/* Card Header */}
                  <div className="ea-task-header" onClick={() => toggleTaskExpand(activity.id)} role="button" tabIndex={0} aria-expanded={isExpanded} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleTaskExpand(activity.id)}>
                    <div className="ea-task-header-left">
                      <span className="ea-task-title">{activity.title}</span>
                      <span className="ea-task-pts">+{activity.points} pts</span>
                    </div>
                    <div className="ea-task-header-right">
                      {isEnrolled ? (
                        <span className="ea-enroll-badge enrolled">✓ Enrolled</span>
                      ) : canJoinActivities ? (
                        <button
                          className="ea-join-btn"
                          onClick={e => { e.stopPropagation(); handleJoinActivity(activity.id, activity); }}
                        >
                          {activity.type === "grouped" ? "Join Group" : "Join"}
                        </button>
                      ) : (
                        <span className="ea-enroll-badge closed">Closed</span>
                      )}
                      <span className="ea-expand-icon">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expandable body */}
                  {isExpanded && (
                    <div className="ea-task-body">
                      {/* Details list */}
                      {activity.details && activity.details.length > 0 && (
                        <ul className="activity-details-list">
                          {activity.details.map((detail, i) => <li key={i}>{detail}</li>)}
                        </ul>
                      )}
                      {activity.required && (
                        <div className="activity-required">
                          <strong>Required:</strong> {activity.required}
                        </div>
                      )}

                      {/* Existing journal entries */}
                      {journalsForActivity.length > 0 && journalsForActivity.map((journal) => (
                        <div key={journal.id} className="journal-card">
                          {editingJournalId === journal.taskId ? (
                            <>
                              <textarea
                                value={editingJournalText}
                                onChange={e => setEditingJournalText(e.target.value)}
                                className="journal-edit-textarea"
                              />
                              <div className="ea-journal-btn-row">
                                <button onClick={() => handleSaveEditJournal(journal)} className="journal-button journal-button-save">Save</button>
                                <button onClick={() => setEditingJournalId(null)} className="journal-button journal-button-cancel">Cancel</button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="journal-text">{journal.reflection}</div>
                              <div className="ea-journal-btn-row">
                                <button onClick={() => handleEditJournal(journal)} className="journal-button journal-button-edit">Edit</button>
                                <button onClick={() => handleDeleteJournal(journal.taskId)} className="journal-button journal-button-delete">Delete</button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      {/* Journal textarea + submit */}
                      <div className="ea-journal-section">
                        <div className="ea-journal-label-row">
                          <span className="ea-journal-label">📝 Reflection Journal</span>
                          {!isEventDay && <span className="ea-journal-locked-note">🔒 Unlocks on event day</span>}
                        </div>
                        <textarea
                          placeholder={isEventDay ? "Write your reflection here…" : "Will be available during the event"}
                          className="journal-textarea"
                          value={journalText}
                          onChange={e => handleJournalChange(idx, e.target.value)}
                          disabled={!isEventDay}
                          maxLength={1000}
                        />
                        <div className="ea-journal-footer">
                          <span className="ea-char-count">{charCount}/1000</span>
                          <button
                            className={`ea-submit-btn${!isEventDay || !journalText.trim() ? ' locked' : ''}`}
                            disabled={!isEventDay || !journalText.trim()}
                            onClick={() => handleJournalSubmit(idx, activity)}
                          >
                            {!isEventDay ? '🔒 Locked' : 'Submit Reflection'}
                          </button>
                        </div>
                        {submitStatus[idx] && (
                          <div className={`ea-submit-status${submitStatus[idx].startsWith('Reflection submitted') ? ' success' : ' error'}`}>
                            {submitStatus[idx]}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
        {/*REQUIREMENTS SECTION (UNDER ALL TASKS)*/}
        <div className="event-activities-panel">
          <h3 className="event-activities-title">Requirements</h3>

          {/* Step progress indicator */}
          {(() => {
            const steps = [
              { key: 'preSurvey',  label: 'Pre-Survey',  check: volunteerProgress?.preSurvey === 'submitted' },
              { key: 'consent',    label: 'Consent',     check: volunteerProgress?.consent === 'submitted' || volunteerProgress?.consent === 'verified' },
              { key: 'attendance', label: 'Attendance',  check: volunteerProgress?.attendance === 'present' },
              { key: 'postSurvey', label: 'Post-Survey', check: volunteerProgress?.postSurvey === 'submitted' },
            ];
            const completedCount = steps.filter(s => s.check).length;
            return (
              <div className="ea-steps-container">
                {steps.map((step, i) => (
                  <React.Fragment key={step.key}>
                    <div className={`ea-step${step.check ? ' done' : ''}`}>
                      <div className="ea-step-circle">{step.check ? '✓' : i + 1}</div>
                      <div className="ea-step-label">{step.label}</div>
                    </div>
                    {i < steps.length - 1 && <div className={`ea-step-line${steps[i + 1].check ? ' done' : ''}`} />}
                  </React.Fragment>
                ))}
              </div>
            );
          })()}

          <div className="requirements-status" style={{ marginTop: 12 }}>
            Status: <span className={`status-text ${
              volunteerProgress?.preSurvey === 'submitted' &&
              volunteerProgress?.consent === 'submitted' &&
              volunteerProgress?.attendance === 'present' &&
              volunteerProgress?.postSurvey === 'submitted'
                ? 'complete' : 'incomplete'
            }`}>
              {volunteerProgress?.preSurvey === 'submitted' &&
               volunteerProgress?.consent === 'submitted' &&
               volunteerProgress?.attendance === 'present' &&
               volunteerProgress?.postSurvey === 'submitted'
                ? '✓ Complete' : 'Incomplete'}
            </span>
          </div>

          <h4 className="requirements-subtitle">Before Event</h4>
          <div className="activity-card">
            <RequirementItem
              label="Pre-Activity Survey"
              status={volunteerProgress?.preSurvey}
              onOpen={() => { console.log("Pre-activity clicked"); setShowPreSurveyModal(true) }}
            />
          </div>
          <div className="activity-card">
            <RequirementItem
              label="Parent Consent"
              status={volunteerProgress?.consent === "open"
                ? "pending"
                : volunteerProgress?.consent}
              onOpen={() => setShowConsentModal(true)}
            />
          </div>
          <div className="activity-card">
            <RequirementItem
              label="Attendance (QR)"
              status={
                volunteerProgress?.attendance === "present"
                  ? "submitted" : "locked"
              }
              onOpen={isEventDay ? () => setShowQRModal(true) : null}
            />
          </div>

          <h4 className="requirements-subtitle">After Event</h4>
          <RequirementItem
            label="Post-Activity Survey"
            status={volunteerProgress?.postSurvey}
            locked={
              volunteerProgress?.preSurvey !== "submitted" ||
              volunteerProgress?.consent !== "verified" ||
              volunteerProgress?.attendance !== "present"
            }
            onOpen={isAfterEvent ? () => setShowPostSurveyModal(true) : null}
          />
        </div>
      </div>

    </div>

    {/* QR Modal - at root level to prevent flickering */}
    {showQRModal && (
      <div className="ea-modal-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="ea-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="ea-modal-header">
            <h3 className="ea-modal-title">📷 Scan Attendance QR</h3>
            <button className="ea-modal-close" onClick={() => setShowQRModal(false)} aria-label="Close">✕</button>
          </div>
          <QRScanner key={scannerKey} onScan={handleQRScan} />
          {qrStatus && (
            <div>
              <div className={`qr-status ${scanSuccess ? "qr-status-success" : "qr-status-error"}`}>{qrStatus}</div>
              {!scanSuccess && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <button
                    className="ea-retry-btn"
                    onClick={() => {
                      setQRStatus("");
                      setScannedLocation(null);
                      setScanSuccess(false);
                      setScannerKey(k => k + 1);
                    }}
                  >
                    🔄 Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )}


    {/* Pre-Activity Survey Modal */}
    {showPreSurveyModal && (
      <div
        className="ea-modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowPreSurveyModal(false);
        }}
      >
        <div
          className="ea-modal-card modal-scrollable"
          style={{ maxHeight: "90vh", overflowY: "auto", minWidth: 340 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ea-modal-header">
            <h3 className="ea-modal-title">📋 Pre-Activity Survey</h3>
            <button className="ea-modal-close" onClick={() => setShowPreSurveyModal(false)} aria-label="Close">✕</button>
          </div>

          <PreActivitySurvey
            // auto-fill of information already provided beforehand
            initialName={userData?.name || ''}
            initialEngagementType={event?.projectType || ""}
            initialTitle={event?.title || ""}

            onSubmit={async (form) => {
              const user = auth.currentUser;
              if (!user) {
                alert("You must be logged in.");
                return;
              }
              await setDoc(
                doc(
                  db,
                  "missions", id,
                  "volunteer", user.uid,
                  "preSurvey", "response"
                ),
                {
                  meta: {
                    submittedAt: serverTimestamp(),
                    version: "v1"
                  },
                  respondent: {
                    name: form.name,
                    college: form.college,
                    program: form.program,
                    nonAcademicOrg: form.nonAcademicOrg
                  },
                  engagement: {
                    type: form.engagementType,
                    initiativeTitle: form.initiativeTitle,
                    participation: form.participation,
                    participationOther: form.participationOther
                  },
                  background: {
                    previousService: form.prevService,
                    frequency: form.frequency
                  },
                  likert: {
                    q1: Number(form.likert_0),
                    q2: Number(form.likert_1),
                    q3: Number(form.likert_2),
                    q4: Number(form.likert_3),
                    q5: Number(form.likert_4),
                    q6: Number(form.likert_5),
                    q7: Number(form.likert_6),
                    q8: Number(form.likert_7)
                  }
                }
              );
              await updateDoc(
                doc(db, "missions", id, "volunteer", user.uid),
                {
                  "progress.preSurvey": "submitted",
                  "progress.consent": "open"
                }
              );

              setVolunteerProgress((prev) => ({
                ...prev,
                preSurvey: "submitted",
                consent: "open"
              }));
              setShowPreSurveyModal(false);
              alert("Pre-Activity Survey submitted!");
              window.location.reload();
            }}
          />
        </div>
      </div>
    )}


    {/* Post-Activity Survey Modal */}
    {showPostSurveyModal && (
      <div className="ea-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPostSurveyModal(false); }}>
        <div className="ea-modal-card modal-scrollable" style={{ maxHeight: '90vh', overflowY: 'auto', minWidth: 340 }} onClick={e => e.stopPropagation()}>
          <div className="ea-modal-header">
            <h3 className="ea-modal-title">📋 Post-Activity Survey</h3>
            <button className="ea-modal-close" onClick={() => setShowPostSurveyModal(false)} aria-label="Close">✕</button>
          </div>

          <PostActivitySurvey
            //Auto fill with information already given from preSurvey
            initialName={userData?.name || ''}
            initialEngagementType={event?.projectType || ""}
            initialTitle={event?.title || ""}
            initialDate={new Date().toISOString().split("T")[0]}
            initialCollege={preSurveyData?.college || ""}
            initialProgram={preSurveyData?.program || ""}
            initialNonAcademicOrg={preSurveyData?.nonAcademicOrg || ""}

            onSubmit={async (form) => {
              // Mark user as present in Firestore and save survey
              const user = auth.currentUser;
              if (!user) {
                alert('You must be logged in.');
                return;
              }

              await setDoc(
                doc(
                  db,
                  "missions", id,
                  "volunteer", user.uid,
                  "postSurvey", "response"
                ),
                {
                  meta: {
                    submittedAt: serverTimestamp(),
                    version: "v1"
                  },
                  respondent: {
                    name: form.name,
                    college: form.college,
                    program: form.program,
                    nonAcademicOrg: form.nonAcademicOrg
                  },
                  engagement: {
                    type: form.engagementType,
                    initiativeTitle: form.initiativeTitle,
                    dateOfImplementation: form.dateOfImplementation,
                    location: form.location
                  },
                  likert: {
                    q1: Number(form.likert_0),
                    q2: Number(form.likert_1),
                    q3: Number(form.likert_2),
                    q4: Number(form.likert_3),
                    q5: Number(form.likert_4),
                    q6: Number(form.likert_5),
                    q7: Number(form.likert_6),
                    q8: Number(form.likert_7)
                  }
                }
              );
              await updateDoc(
                doc(db, "missions", id, "volunteer", user.uid),
                {
                  "progress.postSurvey": "submitted"
                }
              );
              setVolunteerProgress(prev => ({
                ...prev,
                postSurvey: "submitted",
                finalStatus: "completed"
              }));

              setShowPostSurveyModal(false);
              alert("Post-Activity Survey submitted!");
              window.location.reload();
            }}
          />
        </div>
      </div>
    )}

    {/* Consent Modal*/}
    {showConsentModal && (
      <div
        className="ea-modal-overlay"
        onClick={e => {
          if (e.target === e.currentTarget) setShowConsentModal(false);
        }}
      >
        <div
          className="ea-modal-card"
          style={{ minHeight: 180, minWidth: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
        >
          <div className="ea-modal-header" style={{ width: '100%' }}>
            <h3 className="ea-modal-title">📄 Activity Consent Form</h3>
            <button className="ea-modal-close" onClick={() => setShowConsentModal(false)} aria-label="Close">✕</button>
          </div>
          <div className="qr-modal-note">
            <strong>Note:</strong><br />
            If there is no submitted consent form, students will not be allowed to join the event.<br /><br />
            Please download the PDF file and fill up the necessary fields and have your parent/guardian sign it. And then upload it to the submission bin for checking.
          </div>
          <p style={{ margin: '16px 0', textAlign: 'center' }}>Please download and fill out the consent form below.</p>
          <a
            href="/assets/Activity%20Consent%20Form%20Fillable.pdf"
            download
            className="consent-btn"
          >
            Download Consent Form (PDF)
          </a>

          {/* Submission Bin for PDF or Image Upload */}
          <div className="consent-details">
            <input
              type="file"
              accept="application/pdf"
              style={{ marginBottom: 8 }}
              onChange={(e) => setSelectedConsentFile(e.target.files[0])}
            />
            <button
              disabled={!selectedConsentFile}
              onClick={handleConsentSubmit}
            >
              Submit
            </button>

            {uploadedConsentFile && (
              <div style={{ marginTop: 8, color: '#234e7b', fontWeight: 500 }}>
                Selected file: {uploadedConsentFile.name}
                <button
                  style={{
                    marginLeft: 12,
                    background: '#d32f2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '2px 10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onClick={() => setUploadedConsentFile(null)}
                  title="Remove file"
                >
                  ×
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    )}

    {/* ChooseGroup Modal for Grouped Tasks */}
    {showChooseGroupModal && selectedGroupTask && (
      <ChooseGroup
        open={showChooseGroupModal}
        onClose={() => {
          setShowChooseGroupModal(false);
          setSelectedGroupTask(null);
        }}
        taskId={selectedGroupTask.taskId}
        missionId={id}
        user={{
          uid: auth.currentUser?.uid,
          displayName: userData?.name || auth.currentUser?.displayName || "",
          name: userData?.name || "",
        }}
        onGroupSelected={handleGroupSelected}
      />
    )}
  </div>
);
}