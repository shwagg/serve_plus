import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where, serverTimestamp, Timestamp, onSnapshot } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../firebaseConfig";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../../../components/Header";
import { Face6RoundedIcon, WestIcon, ModeRoundedIcon, DeleteRoundedIcon, ExpandMoreRoundedIcon, ExpandLessRoundedIcon } from "../../../components/icons";
import cloudsBg from '../../../assets/clouds-bg.jpg';
import mission1 from '../../../assets/mission1.jpg';
import GlobalAnnouncements from "../../../components/GlobalAnnouncements";
import QRScanner from "../../../components/QRScanner";
import { createNotification } from "../../../utils/notificationUtils";
import { useSession } from '../../../context/SessionContext';
import { calculateWeightedTaskPoints } from "../../../hooks/taskPointingSystem";
import { computeFinalPoints } from "../../../hooks/rewardSystem";
import "../../../styles/student.css";
import "../../../styles/EventActivity.css";
import PreActivitySurvey from "../../../forms/PreActivitySurvey.jsx";
import PostActivitySurvey from "../../../forms/PostActivitySurvey.jsx";

export default function EventActivity() {
  const isEventEditable = (eventDate) => {
    if (!eventDate) return false;

    const now = new Date();
    const eventTime = eventDate?.toDate
      ? eventDate.toDate()
      : new Date(eventDate);

    return now <= eventTime;
  };
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

  const [selectedConsentFile, setSelectedConsentFile] = useState(null);
  const [consentSubmitted, setConsentSubmitted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  // State for pre-activity survey modal (existing)
  const [showPreSurveyModal, setShowPreSurveyModal] = useState(false);
  const [surveyProgress, setSurveyProgress] = useState(0);
  // State for post-activity survey modal
  const [showPostSurveyModal, setShowPostSurveyModal] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();
  const location = useLocation();
  const [isLeaving, setIsLeaving] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // Redirect to login if not authenticated — wait for Firebase to restore session first
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/auth", { replace: true });
      } else {
        setAuthChecked(true);
      }
    });
    return () => unsubscribe();
  }, [auth, navigate]);
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  const [showPointsDetails, setShowPointsDetails] = useState(false);
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
      setConsentSubmitted(true);
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
  const [volunteerCount, setVolunteerCount] = useState(null);
  const [volunteerAvatars, setVolunteerAvatars] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [taskParticipantCounts, setTaskParticipantCounts] = useState({});
  const canJoinActivities = true;
  const toggleTaskExpand = (taskId) => setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  const isEnrollmentClosed = (task) => {
    if (!event?.targetDate || !task?.enrollmentDeadline) return false;
    const todayDate = new Date().toLocaleDateString("en-CA");
    if (todayDate > event.targetDate) return true;
    if (todayDate < event.targetDate) return false;
    const nowTime = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return nowTime > task.enrollmentDeadline;
  };
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

      const eligibleForPoints = isEnrollmentClosed(activity);

      await updateDoc(participantRef, {
        reflection: journalReflections[activityIdx],
        status: "completed",
        pointsEarned: eligibleForPoints ? pointsToAward : 0,
        completedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

      // Update volunteer's total points in the event
      const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
      const volunteerSnap = await getDoc(volunteerRef);
      if (eligibleForPoints && volunteerSnap.exists()) {
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
        [activityIdx]: eligibleForPoints
          ? `Reflection submitted! +${pointsToAward} points earned!`
          : "Reflection submitted! Points will be awarded after enrollment closes.",
      }));
      setJournalReflections((prev) => ({ ...prev, [activityIdx]: "" }));

      // Send points earned notification
      if (eligibleForPoints && pointsToAward > 0) {
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
    if (!authChecked) return;
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
  }, [id, authChecked]);

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

    // Proceed with direct enrollment
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

  const handleUnjoinActivity = async (taskId) => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in.");
      return;
    }

    if (!isEditable) {
      alert("You can no longer modify tasks.");
      return;
    }

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

      await deleteDoc(participantRef);

      // update UI
      setEnrolledTasks((prev) => ({
        ...prev,
        [taskId]: false,
      }));

      window.showToast?.("Removed from task", "success");

    } catch (err) {
      console.error("Error unjoining:", err);
      window.showToast?.("Failed to remove task", "error");
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
  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const [event, setEvent] = useState(null);
  const today = new Date().toLocaleDateString("en-CA");
  // Normalize targetDate to YYYY-MM-DD string — falls back to targetDates for older missions
  const eventDate = (() => {
    const td = event?.targetDate || event?.targetDates;
    if (!td) return null;
    if (typeof td === 'string') return td;
    if (td?.toDate) return td.toDate().toLocaleDateString("en-CA");
    return null;
  })();
  const isEventDay = eventDate === today;
  const isEditable = today <= eventDate;

  // Halfway logic: if event.time exists try to parse start, else use noon
  const isHalfwayDone = (() => {
    if (!isEventDay) return false;
    if (!event?.time) return true; // no time set → allow all day
    const now = new Date();
    const timeMatch = String(event.time).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!timeMatch) return true;
    let hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const period = timeMatch[3];
    if (period && period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (period && period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    const startTime = new Date();
    startTime.setHours(hours, minutes, 0, 0);
    const halfwayMs = (new Date().setHours(23, 59, 0, 0) - startTime.getTime()) / 2;
    return now >= new Date(startTime.getTime() + halfwayMs);
  })();
  const [tasks, setTasks] = useState([]);
  const [preSurveyData, setPreSurveyData] = useState(null);
  const [preSurveyFullData, setPreSurveyFullData] = useState(null);
  const [consentFileUrl, setConsentFileUrl] = useState(null);
  const [showPreSurveyPreview, setShowPreSurveyPreview] = useState(false);
  const [volunteerRole, setVolunteerRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);
  const [completedMissions, setCompletedMissions] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const leaderboardListRef = useRef(null);
  const currentUserRef = useRef(null);
  const previousRankRef = useRef(null);
  const hasLeaderboardLoadedRef = useRef(false);

  useEffect(() => {
    if (!authChecked) return;
    let unsubscribe = null;
    async function fetchEvent() {
      try {
        const eventRef = doc(db, "missions", id);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          setEvent(eventSnap.data());

          // Fetch volunteer count + first 3 avatars
          const volunteerSnap = await getDocs(collection(db, "missions", id, "volunteer"));
          setVolunteerCount(volunteerSnap.size);
          const first3 = volunteerSnap.docs.slice(0, 3);
          const avatars = await Promise.all(
            first3.map(async (vDoc) => {
              const userSnap = await getDoc(doc(db, "users", vDoc.id));
              const name = userSnap.exists() ? (userSnap.data().name || "User") : "User";
              return userSnap.exists() && userSnap.data().avatar
                ? userSnap.data().avatar
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=30bdb7&color=fff&size=64`;
            })
          );
          setVolunteerAvatars(avatars);

          // Fetch tasks from tasks subcollection
          const tasksRef = collection(db, "missions", id, "task");
          const tasksSnap = await getDocs(tasksRef);
          const tasksData = tasksSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setTasks(tasksData);

          // Fetch participant count per task for slot progress display
          const counts = {};
          await Promise.all(
            tasksData.map(async (task) => {
              const snap = await getDocs(
                collection(db, "missions", id, "task", task.id, "participants")
              );
              counts[task.id] = snap.size;
            })
          );
          setTaskParticipantCounts(counts);

          // Check enrollment status for each task and get volunteer points
          const user = auth.currentUser;
          if (user) {
            // Fetch pre-activity survey
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
            let preSurveySubmitted = false;
            if (preSurveySnap.exists()) {
              const data = preSurveySnap.data();
              setPreSurveyData(data.respondent);
              setPreSurveyFullData(data);
              const rawRole = data.engagement?.participation;
              if (rawRole) {
                const roles = Array.isArray(rawRole) ? rawRole : [rawRole];
                setVolunteerRole(roles.map(r => r.trim().toLowerCase().replace(/\s+/g, "_")));
              }
              preSurveySubmitted = true;
            }

            // Fetch consent submission
            const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
            const volunteerSnap = await getDoc(volunteerRef);
            let consentSubmitted = false;
            let progress = {};
            let pointsEarned = 0;
            if (volunteerSnap.exists()) {
              const data = volunteerSnap.data();
              progress = data.progress || {};
              pointsEarned = data.pointsEarned || 0;
              // Check for consentSubmission field
              if (data.consentSubmission && data.consentSubmission.fileUrl) {
                consentSubmitted = true;
                setConsentFileUrl(data.consentSubmission.fileUrl);
              }
            }

            // Set volunteerProgress state based on Firestore records
            setVolunteerProgress((prev) => ({
              ...progress,
              preSurvey: preSurveySubmitted ? "submitted" : progress.preSurvey,
              consent: consentSubmitted ? "submitted" : progress.consent,
            }));
            setTotalPointsEarned(pointsEarned);

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
  }, [id, authChecked]);

  useEffect(() => {
    const fetchCompleted = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const missionsSnap = await getDocs(collection(db, 'missions'));
        let count = 0;
        await Promise.all(missionsSnap.docs.map(async (mDoc) => {
          const volRef = doc(db, 'missions', mDoc.id, 'volunteer', user.uid);
          const volSnap = await getDoc(volRef);
          if (volSnap.exists() && volSnap.data().completionStatus === 'completed') count++;
        }));
        setCompletedMissions(count);
      } catch (e) { }
    };
    fetchCompleted();
  }, []);

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
        <div className="header-spacer"></div>
        <div className="content-page">
          <section className="player-strip" aria-label="Player stats">
            <div className="player-strip-inner">
              <div className="player-profile">
                {userData?.avatar && !userData.avatar.includes('ui-avatars.com') ? (
                  <img src={userData.avatar} alt="Profile" className="player-avatar" loading="lazy" />
                ) : (
                  <Face6RoundedIcon sx={{ width: 36, height: 36, color: '#30bdb7' }} />
                )}
                <span className="player-greeting">{userData?.username || userData?.name || ''}</span>
              </div>
              <div className="player-missions">
                <span className="missions-label">Missions Completed</span>
                <span className="missions-count">{completedMissions}</span>
              </div>
              <div className="player-level">
                <span className="level-label">Level {Math.floor((userData?.totalPoints || 0) / 100) + 1}</span>
                <div className="level-bar" role="progressbar" aria-valuenow={(userData?.totalPoints || 0) % 100} aria-valuemin={0} aria-valuemax={100}>
                  <div className="level-bar-fill" style={{ width: `${(userData?.totalPoints || 0) % 100}%` }}></div>
                </div>
                <span className="level-points">{userData?.totalPoints || 0} pts ({(userData?.totalPoints || 0) % 100}/100)</span>
              </div>
            </div>
          </section>
          <div className="ea-slide-in ea-loading-screen">
            <div className="ea-loading-spinner" />
            <span>Loading event...</span>
          </div>
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
      <div className="content-page" style={{ overflow: 'hidden' }}>

        {/* PLAYER STRIP — persistent, no animation */}
        <section className="player-strip" aria-label="Player stats">
          <div className="player-strip-inner">
            <div className="player-profile">
              {userData?.avatar && !userData.avatar.includes('ui-avatars.com') ? (
                <img src={userData.avatar} alt="Profile" className="player-avatar" loading="lazy" />
              ) : (
                <Face6RoundedIcon sx={{ width: 36, height: 36, color: '#30bdb7' }} />
              )}
              <span className="player-greeting">{userData?.username || userData?.name || ''}</span>
            </div>
            <div className="player-missions">
              <span className="missions-label">Missions Completed</span>
              <span className="missions-count">{completedMissions}</span>
            </div>
            <div className="player-level">
              <span className="level-label">Level {Math.floor((userData?.totalPoints || 0) / 100) + 1}</span>
              <div className="level-bar" role="progressbar" aria-valuenow={(userData?.totalPoints || 0) % 100} aria-valuemin={0} aria-valuemax={100}>
                <div className="level-bar-fill" style={{ width: `${(userData?.totalPoints || 0) % 100}%` }}></div>
              </div>
              <span className="level-points">{userData?.totalPoints || 0} pts ({(userData?.totalPoints || 0) % 100}/100)</span>
            </div>
          </div>
        </section>

        {/* STICKY PROGRESS STRIP — outside animation so it never gets clipped */}
        {(() => {
          const enrolledTaskIds = Object.keys(enrolledTasks).filter(tid => enrolledTasks[tid]);
          const totalItems = 4 + enrolledTaskIds.length;
          let done = 0;
          if (volunteerProgress?.preSurvey === 'submitted') done++;
          if (volunteerProgress?.consent === 'submitted' || volunteerProgress?.consent === 'verified') done++;
          if (volunteerProgress?.attendance === 'present') done++;
          if (volunteerProgress?.postSurvey === 'submitted') done++;
          enrolledTaskIds.forEach(tid => {
            const task = tasks.find(t => t.id === tid);
            if (task && userJournals.some(j => j.activityId === task.title)) done++;
          });
          const pct = totalItems > 0 ? Math.round((done / totalItems) * 100) : 0;
          return (
            <div className="ea-progress-strip">
              <div className="ea-progress-strip__main">
                <button
                  className="ea-progress-back-btn"
                  onClick={() => {
                    setIsLeaving(true);
                    setTimeout(() => navigate('/student/home', { state: { scrollTo: 'missions' } }), 380);
                  }}
                >
                  <span className="ea-progress-back-circle"><WestIcon sx={{ fontSize: 16 }} /></span>
                  <span className="ea-progress-back-label">Back</span>
                </button>
                <span className="ea-progress-card__title">Progress</span>
                <div className="ea-progress-bar-wrap">
                  <div className="ea-progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="ea-progress-card__pct">{pct}%</span>
                <button className="ea-progress-toggle" onClick={() => setShowProgressDetails(v => !v)} aria-label={showProgressDetails ? 'Collapse progress' : 'Expand progress'}>
                  {showProgressDetails
                    ? <ExpandLessRoundedIcon sx={{ fontSize: 20 }} />
                    : <ExpandMoreRoundedIcon sx={{ fontSize: 20 }} />}
                </button>
              </div>
              {showProgressDetails && (
                <div className="ea-progress-items">
                  {[
                    { label: 'Pre-Activity Survey', done: volunteerProgress?.preSurvey === 'submitted' },
                    { label: 'Parent Consent', done: volunteerProgress?.consent === 'submitted' || volunteerProgress?.consent === 'verified' },
                    { label: 'Attendance (QR)', done: volunteerProgress?.attendance === 'present' },
                    ...enrolledTaskIds.map(tid => {
                      const task = tasks.find(t => t.id === tid);
                      return { label: `Journal · ${task?.title || tid}`, done: task && userJournals.some(j => j.activityId === task.title) };
                    }),
                    { label: 'Post-Activity Survey', done: volunteerProgress?.postSurvey === 'submitted' },
                  ].map((item, i) => (
                    <div key={i} className={`ea-progress-item${item.done ? ' done' : ''}`}>
                      <span className="ea-progress-item__dot">{item.done ? '✓' : '○'}</span>
                      <span className="ea-progress-item__label">{item.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Only the content below slides in/out */}
        <div className={isLeaving ? 'ea-slide-out' : 'ea-slide-in'} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* SCROLLABLE BODY */}
          <div className="ea-scrollable-body" style={{ backgroundImage: `url(${cloudsBg})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat', backgroundColor: '#d1efff' }}>
            <div className="event-activity-bg">

              {!isEditable && (
                <div className="ea-past-event-banner">
                  This event has already ended. Task joining and attendance are no longer available.
                </div>
              )}



              <div className="event-activity-container">
                {/* Left Side: Event Summary */}
                <div className="event-left-panel">
                  <div className="event-summary-card">
                    {/* Banner image */}
                    <div className="event-summary-image">
                      <img
                        src={event.img && event.img.trim() !== "" ? event.img : mission1}
                        alt={event.alt || "Event"}
                      />
                    </div>

                    <div className="event-summary-body">
                      <h2 className="event-summary-title">{event.title}</h2>
                      <p className="event-summary-description">{event.description}</p>

                      {/* Rewards row: badge left (if exists), points right */}
                      <div className={`event-rewards-row${!event.badge ? ' no-badge' : ''}`}>
                        {event.badge && (
                          <div className="event-badge-col">
                            <img
                              src={event.badge}
                              alt="Event Badge"
                              className="image-badge"
                            />
                            <span className="event-badge-label">Event badge</span>
                          </div>
                        )}
                        <div className="event-points-col">
                          {(() => {
                            // Mission pts: role × best multiplier (1.3 = ≥4.5 rating) × verified (1.0)
                            const role = volunteerRole || ['participant'];
                            const { finalPoints: missionPts } = computeFinalPoints(role, 4.5, 'verified');
                            const taskPts = tasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0);
                            const totalPts = Number((missionPts + taskPts).toFixed(2));
                            const roleLabel = volunteerRole
                              ? (Array.isArray(volunteerRole) ? volunteerRole : [volunteerRole])
                                .map(r => r.replace(/_/g, ' ')).join(', ')
                              : null;
                            return (
                              <>
                                <span className="event-points-big">{totalPts} <span className="event-points-unit">PTS</span></span>
                                <span className="event-points-label">Potential points to earn</span>
                                <button className="event-points-see-details" onClick={() => setShowPointsDetails(v => !v)}>
                                  {showPointsDetails ? 'hide' : 'see details'}
                                </button>
                                {showPointsDetails && (
                                  <span className="event-points-note">
                                    <span className="event-points-note-row">
                                      <span className="event-points-note-pill">{missionPts} {roleLabel || 'participant'} pts</span>
                                      <span className="event-points-note-op">+</span>
                                      <span className="event-points-note-pill">{taskPts} task pts</span>
                                    </span>
                                    <span className="event-points-note-sub">
                                      Role pts × your post-event rating (×1.0 – ×1.3)
                                    </span>
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Location & Date/Time tags */}
                      <div className="event-info-box">
                        {event.location && (
                          <span className="event-info-tag">📍 {event.location}</span>
                        )}
                        {eventDate && (
                          <span className="event-info-tag">📅 {formatDate(eventDate) || eventDate}{event.time ? ` · ${event.time}` : ""}</span>
                        )}
                        {volunteerCount !== null && volunteerCount > 0 && (
                          <div className="event-info-tag event-volunteer-tag">
                            <div className="event-volunteer-stack">
                              {volunteerAvatars.map((src, i) => (
                                <img key={i} src={src} alt="" className="event-volunteer-avatar" style={{ zIndex: volunteerAvatars.length - i }} />
                              ))}
                              {volunteerCount > 3 && (
                                <div className="event-volunteer-extra" style={{ zIndex: 0 }}>+{volunteerCount - 3}</div>
                              )}
                            </div>
                            <span className="event-volunteer-label">joined</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LEADERBOARD */}
                  <div className="event-leaderboard-card">
                    <h3 className="ea-leaderboard-title">Activity Leaderboard</h3>
                    {sortedLeaderboard.length === 0 ? (
                      <p className="ea-leaderboard-empty">No participants yet.</p>
                    ) : (
                      <div className="ea-leaderboard-list" ref={leaderboardListRef}>
                        {sortedLeaderboard.map((user, index) => {
                          const rank = index + 1;
                          const isCurrent = user.uid === currentUserId;
                          return (
                            <div
                              key={user.uid}
                              ref={isCurrent ? currentUserRef : null}
                              className={`ea-leaderboard-row${isCurrent ? ' is-current-user' : ''}`}
                              role="button"
                              tabIndex={0}
                              aria-label={`Open profile for ${user.name}`}
                              onClick={() => openUserProfile(user.uid)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  openUserProfile(user.uid);
                                  e.preventDefault();
                                }
                              }}
                            >
                              <span className="ea-rank-num">{rank}</span>
                              {user.avatar
                                ? <img src={user.avatar} alt={user.name} className="ea-rank-avatar" />
                                : <span className="ea-rank-avatar ea-rank-initials">
                                  {(user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                </span>
                              }
                              <span className="ea-rank-name">{user.name}</span>
                              <span className="ea-rank-pts">{user.points} PTS</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Side: Activity Section & Requirement */}
                <div className="event-right-panel">


                  <div className={`event-activities-panel${!isEditable ? ' event-activities-panel--ended' : ''}`}>
                    <h2 className="event-activities-title">Task Assignment</h2>
                    <p className="event-activities-desc">Pick an extra role you want to take on for this event</p>
                    <p className="event-activities-subtitle">
                      {tasks ? tasks.filter(t => !!enrolledTasks[t.id]).length : 0} / {tasks?.length || 0} tasks joined
                    </p>
                    {/*TASKS AVAILABLE FOR THIS SPECIFIC EVENT*/}
                    <div className="task-list-scroll">
                      {tasks && (() => {
                        const withIdx = tasks.map((t, i) => [t, i]);
                        const joinedList = withIdx.filter(([t]) => !!enrolledTasks[t.id]);
                        const unjoinedList = withIdx.filter(([t]) => !enrolledTasks[t.id]);

                        const renderTaskCard = (activity, idx) => {
                          const isEnrolled = !!enrolledTasks[activity.id];
                          const isGrouped = activity.type === 'grouped';
                          const filledSlots = taskParticipantCounts[activity.id] || 0;
                          const maxSlots = isGrouped ? (activity.maxParticipants || null) : null;
                          const isFull = maxSlots !== null && filledSlots >= maxSlots;
                          const slotPct = maxSlots ? Math.min((filledSlots / maxSlots) * 100, 100) : 0;
                          const journalsForActivity = userJournals.filter(j => j.activityId === activity.title);
                          const hasSubmittedJournal = journalsForActivity.length > 0;

                          if (!isEventDay && !isEnrolled) {
                            return (
                              <div key={idx} className="task-card task-card--locked">
                                <span className="task-card__title-only">{activity.title}</span>
                              </div>
                            );
                          }

                          const isExpanded = expandedTasks[activity.id] !== false; // default open
                          const isEndedEnrolled = !isEditable && isEnrolled;

                          return (
                            <div key={idx} className={`task-card${isEnrolled ? ' task-card--enrolled' : ''}${isEndedEnrolled ? ' task-card--ended' : ''}`}>
                              <div className="task-card__row" style={isEnrolled && !isEndedEnrolled ? { cursor: 'pointer' } : {}} onClick={isEnrolled && !isEndedEnrolled ? () => toggleTaskExpand(activity.id) : undefined}>
                                <span className="task-card__emoji">{activity.emoji || '🎯'}</span>
                                <div className="task-card__info">
                                  <span className="task-card__title">{activity.title}</span>
                                  {isGrouped && maxSlots && (
                                    <div className="task-slot-wrap">
                                      <div className="task-slot-bar">
                                        <div className="task-slot-fill" style={{ width: `${slotPct}%`, background: isFull ? '#ef4444' : '#30bdb7' }} />
                                      </div>
                                      <span className="task-slot-label">{filledSlots}/{maxSlots} members{isFull ? ' · Full' : ''}</span>
                                    </div>
                                  )}
                                  <span className="task-card__pts">{activity.points} PTS</span>
                                </div>
                                <div className="task-card__action">
                                  {isEnrolled ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <button
                                        className="task-enrolled-badge"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnjoinActivity(activity.id);
                                        }}
                                        disabled={!isEditable}
                                      >
                                        <span className="joined-text">Joined</span>
                                        <span className="remove-text">✕</span>
                                      </button>

                                      {!isEndedEnrolled && (
                                        <button
                                          className="task-collapse-btn"
                                          onClick={(e) => { e.stopPropagation(); toggleTaskExpand(activity.id); }}
                                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                        >
                                          {isExpanded
                                            ? <ExpandLessRoundedIcon sx={{ fontSize: 20 }} />
                                            : <ExpandMoreRoundedIcon sx={{ fontSize: 20 }} />}
                                        </button>
                                      )}
                                    </div>
                                  ) : isFull ? (
                                    <span className="task-slot-full-badge">Full</span>
                                  ) : !isEditable ? (
                                    <span className="req-status locked">Ended</span>
                                  ) : canJoinActivities ? (
                                    <button className="task-join-btn" onClick={() => handleJoinActivity(activity.id, activity)} disabled={!isEditable}>Join</button>
                                  ) : (
                                    <span className="req-status locked">Closed</span>
                                  )}
                                </div>
                              </div>
                              {isEnrolled && isExpanded && !isEndedEnrolled && (
                                <div className="task-journal-section">
                                  {/* Journal text / edit textarea */}
                                  {journalsForActivity.map((journal) => (
                                    <div key={journal.id} className="journal-card">
                                      {editingJournalId === journal.taskId ? (
                                        <>
                                          <textarea value={editingJournalText} onChange={(e) => setEditingJournalText(e.target.value)} className="journal-edit-textarea" />
                                          <div className="journal-card-actions">
                                            <button onClick={() => handleSaveEditJournal(journal)} className="journal-button journal-button-save">Save</button>
                                            <button onClick={() => setEditingJournalId(null)} className="journal-button journal-button-cancel">Cancel</button>
                                          </div>
                                        </>
                                      ) : (
                                        <div className="journal-text">{journal.reflection}</div>
                                      )}
                                    </div>
                                  ))}

                                  {/* Bottom action row — same position as the submit button */}
                                  {hasSubmittedJournal ? (
                                    <div className="journal-submit-row">
                                      <span className="journal-submitted-badge">Submitted</span>
                                      <button
                                        onClick={() => handleEditJournal(journalsForActivity[0])}
                                        className="journal-edit-icon-btn"
                                        title="Edit reflection"
                                      >
                                        <ModeRoundedIcon sx={{ fontSize: 15 }} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteJournal(journalsForActivity[0].taskId)}
                                        className="journal-edit-icon-btn journal-delete-icon-btn"
                                        title="Delete reflection"
                                      >
                                        <DeleteRoundedIcon sx={{ fontSize: 15 }} />
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <textarea
                                        placeholder={!isHalfwayDone ? 'Journal will unlock once the event has started' : 'Write your reflection for this task…'}
                                        className="journal-textarea"
                                        value={journalReflections[idx] || ''}
                                        onChange={(e) => handleJournalChange(idx, e.target.value)}
                                        disabled={!isHalfwayDone}
                                      />
                                      <div className="journal-submit-row">
                                        {submitStatus[idx] && (
                                          <div className={`submit-status journal-submit-status ${submitStatus[idx].includes('submitted') ? 'submit-status-success' : 'submit-status-error'}`}>{submitStatus[idx]}</div>
                                        )}
                                        <button className="activity-submit-button journal-submit-compact" disabled={!isHalfwayDone || !journalReflections[idx]?.trim()} onClick={() => handleJournalSubmit(idx, activity)}>
                                          {!isHalfwayDone ? 'LOCKED' : 'SUBMIT'}
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        };

                        return (
                          <>
                            {joinedList.length > 0 && (
                              <div className="task-section">
                                <span className="task-section-label">Joined</span>
                                {joinedList.map(([activity, idx]) => renderTaskCard(activity, idx))}
                              </div>
                            )}
                            {joinedList.length > 0 && unjoinedList.length > 0 && (
                              <div className="task-section-divider" />
                            )}
                            {unjoinedList.length > 0 && (
                              <div className="task-section">
                                {joinedList.length > 0 && <span className="task-section-label">Available</span>}
                                {unjoinedList.map(([activity, idx]) => renderTaskCard(activity, idx))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  {/*REQUIREMENTS SECTION (UNDER ALL TASKS)*/}
                  <div className="event-activities-panel">
                    <h3 className="event-activities-title">Requirements</h3>
                    {(() => {
                      const preSurveyDone = volunteerProgress?.preSurvey === 'submitted';
                      const consentDone = volunteerProgress?.consent === 'submitted' || volunteerProgress?.consent === 'verified';
                      const attendanceDone = volunteerProgress?.attendance === 'present';
                      const postSurveyDone = volunteerProgress?.postSurvey === 'submitted';
                      const postLocked = !preSurveyDone || !consentDone || !attendanceDone;

                      const steps = [
                        {
                          label: 'Pre-Activity Survey',
                          desc: 'Fill out before the event',
                          done: preSurveyDone,
                          locked: false,
                          onOpen: () => setShowPreSurveyModal(true),
                          type: 'survey',
                          previewable: preSurveyDone && !!preSurveyFullData,
                          onPreview: () => setShowPreSurveyPreview(true),
                        },
                        {
                          label: 'Parent Consent Form',
                          desc: 'Upload the signed consent form',
                          done: consentDone,
                          locked: false,
                          onOpen: () => setShowConsentModal(true),
                          type: 'upload',
                          previewable: consentDone && !!consentFileUrl,
                          onPreview: () => window.open(consentFileUrl, '_blank'),
                        },
                        {
                          label: 'Attendance',
                          desc: !isEditable ? 'Event has ended' : 'Scan QR code on event day',
                          done: attendanceDone,
                          locked: !isEventDay || !isEditable,
                          onOpen: isEventDay && isEditable ? () => setShowQRModal(true) : null,
                          type: 'qr',
                          previewable: false,
                        },
                        {
                          label: 'Post-Activity Survey',
                          desc: !isEditable ? 'Event has ended' : 'Fill out after the event',
                          done: postSurveyDone,
                          locked: !isEditable || postLocked,
                          onOpen: null,
                          type: 'survey',
                          previewable: false,
                        },
                      ];

                      const activeIndex = steps.findIndex(s => !s.done);

                      return (
                        <div className="req-timeline">
                          {steps.map((step, i) => {
                            const isActive = i === activeIndex;
                            const lineTeal = i === activeIndex - 1;
                            return (
                              <div key={i} className={`req-timeline-item${step.done ? ' done' : isActive ? ' active' : step.locked ? ' locked' : ''}`}>
                                <div className="req-timeline-left">
                                  <div className={`req-timeline-dot${isActive ? ' req-timeline-dot--active' : ''}`}>
                                    {i + 1}
                                  </div>
                                  {i < steps.length - 1 && (
                                    <div className={`req-timeline-line${lineTeal ? ' req-timeline-line--teal' : ''}`} />
                                  )}
                                </div>
                                <div className="req-timeline-body">
                                  <span className="req-timeline-label">{step.label}</span>
                                  <span className="req-timeline-desc">{step.desc}</span>
                                </div>
                                <div className="req-timeline-action">
                                  {step.done ? (
                                    step.previewable ? (
                                      <button className="req-view-btn" onClick={step.onPreview}>View</button>
                                    ) : (
                                      <span className="req-done-badge">Done</span>
                                    )
                                  ) : (
                                    <button
                                      className={`req-action-btn${step.locked ? ' req-action-btn--locked' : ''}`}
                                      disabled={step.locked}
                                      onClick={step.locked ? undefined : step.onOpen}
                                    >
                                      {step.type === 'qr' ? 'Scan' : step.type === 'upload' ? 'Upload' : 'Start'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

              </div>
            </div>{/* closes event-activity-bg */}
          </div>{/* closes ea-scrollable-body */}
        </div>{/* closes ea-slide-in */}
      </div>{/* closes content-page */}

      {/* QR Modal - at root level to prevent flickering */}
      {showQRModal && (
        <div className="ea-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="ea-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="ea-modal-header">
              <h3 className="ea-modal-title">📷 Scan Attendance QR</h3>
              <button className="ea-modal-close" onClick={() => setShowQRModal(false)} aria-label="Close">✕</button>
            </div>
            <div className="ea-qr-modal-body">
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
            className="ea-modal-card"
            style={{ minWidth: 340 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ea-modal-header">
              <h3 className="ea-modal-title">📋 Pre-Activity Survey</h3>
              <button className="ea-modal-close" onClick={() => setShowPreSurveyModal(false)} aria-label="Close">✕</button>
            </div>
            <div style={{ height: 6, background: '#e5e7eb' }}>
              <div style={{ height: '100%', width: `${surveyProgress}%`, background: '#30bdb7', transition: 'width 0.4s ease' }} />
            </div>
            <div className="modal-scrollable">
              <PreActivitySurvey
                // auto-fill of information already provided beforehand
                initialName={userData?.name || ''}
                initialEngagementType={event?.projectType || ""}
                initialTitle={event?.title || ""}
                onProgressChange={setSurveyProgress}

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
            className="ea-modal-card consent-modal-card"
            onClick={e => e.stopPropagation()}
          >
            <div className="ea-modal-header">
              <h3 className="ea-modal-title">📄 Activity Consent Form</h3>
              <button className="ea-modal-close" onClick={() => setShowConsentModal(false)} aria-label="Close">✕</button>
            </div>

            {/* Teal accent line — matches pre-survey style exactly */}
            <div style={{ height: 4, background: '#e5e7eb' }}>
              <div style={{ height: '100%', width: '100%', background: '#30bdb7' }} />
            </div>

            <div className="consent-modal-body">
              {/* Unified note + download card */}
              <div className="consent-info-card">
                <div className="consent-note-row">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <ul className="consent-note-list">
                    <li>Students without a submitted consent form will <strong>not</strong> be allowed to join the event.</li>
                    <li>Download the form, fill it out, have your parent/guardian sign it, then upload the signed copy below.</li>
                  </ul>
                </div>

                <div className="consent-divider" />

                <div className="consent-pdf-row">
                  <div className="consent-pdf-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="consent-pdf-text">
                    <p className="consent-pdf-name">Activity Information and Consent Form</p>
                    <p className="consent-pdf-meta">PDF · CSCE-FORM-040AB-01</p>
                  </div>
                  <a
                    href="/assets/Activity%20Information%20and%20Consent%20Form.pdf"
                    download="Activity Information and Consent Form.pdf"
                    className="consent-download-btn"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </a>
                </div>
              </div>

              {/* Drag-and-drop upload area */}
              <div
                className={`consent-dropzone${selectedConsentFile ? ' consent-dropzone--filled' : ''}`}
                onClick={() => document.getElementById('consent-file-input').click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) setSelectedConsentFile(file);
                }}
              >
                <input
                  id="consent-file-input"
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => setSelectedConsentFile(e.target.files[0] || null)}
                />
                {selectedConsentFile ? (
                  <div className="consent-file-row">
                    <div className="consent-file-badge">PDF</div>
                    <div className="consent-file-info">
                      <span className="consent-file-name">{selectedConsentFile.name}</span>
                      <span className="consent-file-size">{(selectedConsentFile.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button
                      className="consent-file-remove"
                      onClick={e => { e.stopPropagation(); setSelectedConsentFile(null); }}
                      title="Remove file"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <svg className="consent-dropzone-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#30bdb7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 16 12 12 8 16" />
                      <line x1="12" y1="12" x2="12" y2="21" />
                      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                    </svg>
                    <p className="consent-dropzone-text">Drop your file here or <span>browse</span></p>
                    <p className="consent-dropzone-hint">PDF files only</p>
                  </>
                )}
              </div>

              {/* Submit button */}
              <button
                className={`consent-submit-btn${selectedConsentFile && !consentSubmitted ? '' : ' consent-submit-btn--disabled'}`}
                disabled={!selectedConsentFile || consentSubmitted}
                onClick={handleConsentSubmit}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Survey Preview Modal */}
      {showPreSurveyPreview && preSurveyFullData && (
        <div className="ea-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowPreSurveyPreview(false); }}>
          <div className="survey-preview-card" onClick={e => e.stopPropagation()}>
            <div className="ea-modal-header">
              <h3 className="ea-modal-title">Pre-Activity Survey</h3>
              <button className="ea-modal-close" onClick={() => setShowPreSurveyPreview(false)}>✕</button>
            </div>
            <div className="survey-preview-body">
              <div className="survey-preview-section">
                <div className="survey-preview-section-title">Respondent</div>
                <div className="survey-preview-row"><span className="survey-preview-label">Name</span><span className="survey-preview-value">{preSurveyFullData.respondent?.name || '—'}</span></div>
                <div className="survey-preview-row"><span className="survey-preview-label">College</span><span className="survey-preview-value">{preSurveyFullData.respondent?.college || '—'}</span></div>
                <div className="survey-preview-row"><span className="survey-preview-label">Program</span><span className="survey-preview-value">{preSurveyFullData.respondent?.program || '—'}</span></div>
                {preSurveyFullData.respondent?.nonAcademicOrg && (
                  <div className="survey-preview-row"><span className="survey-preview-label">Org</span><span className="survey-preview-value">{preSurveyFullData.respondent.nonAcademicOrg}</span></div>
                )}
              </div>
              <div className="survey-preview-section">
                <div className="survey-preview-section-title">Engagement</div>
                <div className="survey-preview-row"><span className="survey-preview-label">Type</span><span className="survey-preview-value">{preSurveyFullData.engagement?.type || '—'}</span></div>
                <div className="survey-preview-row"><span className="survey-preview-label">Initiative</span><span className="survey-preview-value">{preSurveyFullData.engagement?.initiativeTitle || '—'}</span></div>
                <div className="survey-preview-row"><span className="survey-preview-label">Role(s)</span><span className="survey-preview-value">{(preSurveyFullData.engagement?.participation || []).join(', ') || '—'}</span></div>
                {preSurveyFullData.engagement?.participationOther && (
                  <div className="survey-preview-row"><span className="survey-preview-label">Other role</span><span className="survey-preview-value">{preSurveyFullData.engagement.participationOther}</span></div>
                )}
              </div>
              <div className="survey-preview-section">
                <div className="survey-preview-section-title">Background</div>
                <div className="survey-preview-row"><span className="survey-preview-label">Prev. service</span><span className="survey-preview-value">{preSurveyFullData.background?.previousService || '—'}</span></div>
                <div className="survey-preview-row"><span className="survey-preview-label">Frequency</span><span className="survey-preview-value">{preSurveyFullData.background?.frequency || '—'}</span></div>
              </div>
              <div className="survey-preview-section">
                <div className="survey-preview-section-title">Likert Responses</div>
                {[
                  { emoji: '💡', short: 'I can come up with ideas to address community problems' },
                  { emoji: '🤝', short: 'Volunteer work and teamwork helps solve social problems' },
                  { emoji: '🌍', short: 'Understanding diverse backgrounds is key to helping' },
                  { emoji: '💪', short: 'I feel a social obligation to make a difference' },
                  { emoji: '🎓', short: 'My skills from school can help solve social problems' },
                  { emoji: '📋', short: 'Community work is last priority given other responsibilities' },
                  { emoji: '🌐', short: 'My contribution alone feels insignificant' },
                  { emoji: '⏰', short: 'With time management I can participate in initiatives' },
                ].map((q, i) => {
                  const val = preSurveyFullData.likert?.[`q${i + 1}`];
                  const SCALE = {
                    0: { label: 'No Basis', color: '#9ca3af', bg: '#f3f4f6' },
                    1: { label: 'Strongly Disagree', color: '#ef4444', bg: '#fee2e2' },
                    2: { label: 'Disagree', color: '#f97316', bg: '#ffedd5' },
                    3: { label: 'Neutral', color: '#ca8a04', bg: '#fef9c3' },
                    4: { label: 'Agree', color: '#16a34a', bg: '#dcfce7' },
                    5: { label: 'Strongly Agree', color: '#30bdb7', bg: '#ccfbf1' },
                  };
                  const meta = SCALE[val];
                  return (
                    <div key={i} className="survey-preview-likert-row">
                      <span className="survey-preview-likert-q">{q.emoji} {q.short}</span>
                      {meta ? (
                        <span className="survey-preview-likert-val" style={{ background: meta.bg, color: meta.color }}>{val}</span>
                      ) : (
                        <span className="survey-preview-likert-val" style={{ background: '#f3f4f6', color: '#9ca3af' }}>—</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}