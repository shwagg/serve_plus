import { getAuth } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../../../firebaseConfig";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../../../components/Header";
import GlobalAnnouncements from "../../../components/GlobalAnnouncements";
import QRScanner from "../../../components/QRScanner";
import { db } from "../../../firebaseConfig";
import { createNotification } from "../../../utils/notificationUtils";
import "../../../styles/student.css";
import "../../../styles/EventActivity.css";
import PreActivitySurvey from "../../../../public/forms/PreActivitySurvey.jsx";
import PostActivitySurvey from "../../../../public/forms/PostActivitySurvey.jsx";

export default function EventActivity() {
  //Requirement panel containing all forms
  const RequirementItem = ({ label, status, mode, onOpen }) => {
    const isLocked =
      status === "locked" ||
      (label === "Attendance (QR)" && mode !== "active");

    return (
      <div className={`requirement-item ${status}`}>
        <span className="req-label">{label}</span>

        {isLocked && <span className="req-status muted">Locked</span>}
        {status === "pending" && <span className="req-status pending">Pending</span>}
        {status === "submitted" && <span className="req-status done">Submitted</span>}
        {onOpen && status !== "submitted" && (
          <button className="req-action" onClick={onOpen}>
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
  const { id } = useParams();
  const navigate = useNavigate();
  const auth = getAuth();
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get("mode") || "preview";
  const [open, setOpen] = useState(false);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrStatus, setQRStatus] = useState("");

  // Update unread count from GlobalAnnouncements
  useEffect(() => {
    // Check immediately
    const checkCount = () => {
      if (window.announcementActions?.getUnreadCount) {
        setAnnouncementUnreadCount(window.announcementActions.getUnreadCount());
      }
    };

    checkCount();
    const interval = setInterval(checkCount, 500);
    return () => clearInterval(interval);
  }, []);

  const handleQRScan = async (decodedText) => {
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
      // Validate QR timestamp against stored valid timestamp
      const missionDoc = await getDoc(doc(db, "missions", projectId));
      if (missionDoc.exists()) {
        const validTimestamp = missionDoc.data()?.validQRTimestamp;
        if (validTimestamp && parsed.timestamp !== validTimestamp) {
          setQRStatus("This QR code has been invalidated. Please use the current code.");
          return;
        }
      }
      // Instead of marking present, require post-activity survey proof
      setShowQRModal(false);
      setShowPostSurveyModal(true);
    } catch (err) {
      setQRStatus("Failed to process QR code.");
    }
  };
  //For saving consent file to be reviewed
  const handleConsentSubmit = async (file) => {
    const user = auth.currentUser;
    if (!user || !file) {
      alert("Missing user or file.");
      return;
    }

    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const fileType = ext === "pdf" ? "pdf" : "image";

      const filePath = `consents/${id}/${user.uid}/consent.${ext}`;
      const fileRef = ref(storage, filePath);

      await uploadBytes(fileRef, file);
      const fileUrl = await getDownloadURL(fileRef);

      await updateDoc(
        doc(db, "missions", id, "volunteer", user.uid),
        {
          "progress.consent": "submitted",
          consentSubmission: {
            fileUrl: fileUrl,
            filePath: filePath,
            fileType: fileType,
            submittedAt: serverTimestamp(),
            verifiedAt: null,
            verifiedBy: ""
          }
        }
      );

      setVolunteerProgress((prev) => ({
        ...prev,
        consent: "submitted"
      }));

      alert("Consent form submitted successfully.");
    } catch (error) {
      console.error("Consent upload failed FULL ERROR:", error);
      alert(error?.message || JSON.stringify(error));
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
  const canJoinActivities =
    volunteerProgress?.preSurvey === "submitted" &&
    volunteerProgress?.consent === "verified";
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

      const pointsToAward = activity.points || 0;

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

      // Send notification to student
      await createNotification(user.uid, {
        type: "reflection_submitted",
        title: "Reflection Submitted",
        message: `Your reflection for "${activity.title}" has been submitted successfully! +${pointsToAward} points earned.`,
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
      await updateDoc(participantRef, {
        reflection: "",
        status: "todo",
        lastUpdated: new Date().toISOString(),
      });
      setUserJournals(userJournals.filter((j) => j.taskId !== taskId));
    } catch (err) {
      alert("Failed to delete journal.");
    }
  };

  const handleJoinActivity = async (taskId) => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to join an activity.");
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
      const participantSnap = await getDoc(participantRef);

      if (participantSnap.exists()) {
        alert("You are already enrolled in this activity!");
        return;
      }

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

  const [event, setEvent] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPointsEarned, setTotalPointsEarned] = useState(0);

  useEffect(() => {
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
            // Fetch volunteer's total points for this event
            const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
            const volunteerSnap = await getDoc(volunteerRef);
            if (volunteerSnap.exists()) {
              setVolunteerProgress(volunteerSnap.data().progress);
              //this will be about the volunteer progress on his requirements.
            }

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
  }, [id]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: "#234e7b", fontWeight: 600 }}>
        Loading...
      </div>
    );
  }
  if (!event) {
    return (
      <div style={{ padding: 32, color: "#d32f2f", fontWeight: 700 }}>
        Event not found.
        <br />
        <span style={{ fontWeight: 400, color: "#234e7b" }}>
          Check the event ID in the URL or verify your Firestore data.
        </span>
      </div>
    );
  }
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    return (
      <div style={{ padding: 32, color: "#d32f2f", fontWeight: 700 }}>
        No tasks found for this event.
        <br />
        <span style={{ fontWeight: 400, color: "#234e7b" }}>
          Check your Firestore tasks subcollection.
        </span>
      </div>
    );
  }

  // ...existing code...

  return (
    <div className="full-page">
      <Header />
      <div className="header-spacer"></div>
      <div className="event-activity-container">
        {/* Left Side: Event Summary */}
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
              <div style={{ marginBottom: 10 }}>
                <strong>Location:</strong>{" "}
                <span style={{ color: "#234e7b" }}>{event.location}</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong>Date & Time:</strong>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>{event.date}</li>
                  <li>{event.time}</li>
                </ul>
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong>Points:</strong>{" "}
                <span style={{ color: "#388e3c" }}>{event.points} PTS</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong>Your Points Earned:</strong>{" "}
                <span style={{ color: "#1976d2", fontWeight: 600, fontSize: 16 }}>{totalPointsEarned} PTS</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong>Event Badge:</strong>
                <br />
                <img
                  src={event.badge || "/assets/badge.png"}
                  alt="Event Badge"
                  className="image-badge"
                />
              </div>

              {/* QR button only */}
              <div style={{ marginTop: 16, display: "flex", flexDirection: "row", justifyContent: "center", gap: 18 }}>
                <button
                  className="event-qr-button"
                  onClick={() => setShowQRModal(true)}
                  disabled={mode !== "active"}
                >
                  {mode === "active"
                    ? "Scan Attendance QR Code"
                    : "Attendance Locked"}
                </button>
              </div>

            </div>
            <div className="event-status-label incomplete">
              Status: Incomplete
            </div>

          </div>
        </div>

        {/* Right Side: Activity Section & Requirement */}
        <div className="event-right-panel">
          <div className="event-activities-panel">
            <h2 className="event-activities-title">
              Activity
            </h2>
            {/*TASKS AVAILABLE FOR THIS SPECIFIC EVENT*/}
            {tasks &&
              tasks.map((activity, idx) => {
                // Find journals for this activity
                const journalsForActivity = userJournals.filter(
                  (j) => j.activityId === activity.title
                );
                return (
                  <div key={idx} className="activity-card">
                    <div className="requirement-item activity-item">
                      <span className="req-label">
                        {activity.title} ({activity.points} pts)
                      </span>

                      {/* JOIN LOGIC */}
                      {enrolledTasks[activity.id] ? (
                        <span className="req-status done">Enrolled</span>
                      ) : canJoinActivities ? (
                        <button
                          className="req-action"
                          onClick={() => handleJoinActivity(activity.id)}
                        >
                          Join
                        </button>
                      ) : (
                        <span className="req-status locked">Closed</span>
                      )}
                    </div>

                    {/* User's journals for this activity */}
                    {journalsForActivity.length > 0 &&
                      journalsForActivity.map((journal) => (
                        <div key={journal.id} className="journal-card">
                          {editingJournalId === journal.taskId ? (
                            <>
                              <textarea
                                value={editingJournalText}
                                onChange={(e) =>
                                  setEditingJournalText(e.target.value)
                                }
                                className="journal-edit-textarea"
                              />
                              <button
                                onClick={() => handleSaveEditJournal(journal)}
                                className="journal-button journal-button-save"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingJournalId(null)}
                                className="journal-button journal-button-cancel"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="journal-text">
                                {journal.reflection}
                              </div>
                              <button
                                onClick={() => handleEditJournal(journal)}
                                className="journal-button journal-button-edit"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteJournal(journal.taskId)
                                }
                                className="journal-button journal-button-delete"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    <ul className="activity-details-list">
                      {activity.details &&
                        activity.details.map((detail, i) => (
                          <li key={i}>{detail}</li>
                        ))}
                    </ul>
                    {activity.required && (
                      <div className="activity-required">
                        <strong>Required:</strong> {activity.required}
                      </div>
                    )}
                    <textarea
                      placeholder={
                        mode === "preview"
                          ? "Journal will be available during the event"
                          : "Journal Reflection"
                      }
                      className="journal-textarea"
                      value={journalReflections[idx] || ""}
                      onChange={(e) => handleJournalChange(idx, e.target.value)}
                      disabled={mode === "preview"}
                    />
                    <div className="task-progress-row">
                      <span>Task Progress</span>
                      <progress
                        value={
                          submitStatus[idx] === "Reflection submitted!" ? 100 : 0
                        }
                        max="100"
                        className="task-progress-bar"
                      />
                    </div>
                    <button
                      className="activity-submit-button"
                      disabled={
                        mode === "preview" ||
                        !journalReflections[idx] ||
                        !journalReflections[idx].trim()
                      }
                      onClick={() => handleJournalSubmit(idx, activity)}
                    >
                      {mode === "preview" ? "LOCKED" : "SUBMIT"}
                    </button>

                    {submitStatus[idx] && (
                      <div
                        className={`submit-status ${submitStatus[idx] === "Reflection submitted!"
                          ? "submit-status-success"
                          : "submit-status-error"
                          }`}
                      >
                        {submitStatus[idx]}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          {/*REQUIREMENTS SECTION (UNDER ALL TASKS)*/}
          <div className="event-activities-panel">
            <h3 className="event-activities-title">Requirements</h3>
            <div className="requirements-status">
              Status: <span className="status-text incomplete">Incomplete</span>
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
                label="Parent Consent (In Person)"
                status={volunteerProgress?.consent}
                onOpen={() => setShowConsentModal(true)}
              />
            </div>
            <div className="activity-card">
              <RequirementItem
                label="Attendance (QR)"
                status={volunteerProgress?.attendance}
                onOpen={() => setShowQRModal(true)}
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
              onOpen={() => setShowPostSurveyModal(true)}
            />

          </div>
        </div>

      </div>

      {/* QR Modal - at root level to prevent flickering */}
      {showQRModal && (
        <div className="qr-modal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="qr-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={() => setShowQRModal(false)}>X</button>
            <h3 className="qr-modal-title">Scan or Upload QR Code</h3>
            <QRScanner onScan={handleQRScan} />
            {qrStatus && <div className={`qr-status ${qrStatus === "Attendance recorded!" ? "qr-status-success" : "qr-status-error"}`}>{qrStatus}</div>}
          </div>
        </div>
      )}


      {/* Pre-Activity Survey Modal */}
      {showPreSurveyModal && (
        <div
          className="qr-modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPreSurveyModal(false);
          }}
        >
          <div
            className="qr-modal-content modal-scrollable"
            style={{ maxHeight: "90vh", overflowY: "auto", minWidth: 340 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="qr-modal-close"
              onClick={() => setShowPreSurveyModal(false)}
            >
              X
            </button>

            <h3 className="qr-modal-title">Pre-Activity Survey</h3>

            <PreActivitySurvey
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
                    "progress.preSurvey": "submitted"
                  }
                );

                setVolunteerProgress((prev) => ({
                  ...prev,
                  preSurvey: "submitted",
                  consent: "open"
                }));
                setShowPreSurveyModal(false);
                alert("Pre-Activity Survey submitted!");
              }}
            />
          </div>
        </div>
      )}


      {/* Post-Activity Survey Modal */}
      {showPostSurveyModal && (
        <div className="qr-modal-overlay" onClick={e => e.stopPropagation()}>
          <div className="qr-modal-content modal-scrollable" style={{ maxHeight: '90vh', overflowY: 'auto', minWidth: 340 }} onClick={e => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={() => setShowPostSurveyModal(false)}>X</button>
            <h3 className="qr-modal-title">Post-Activity Survey</h3>

            <PostActivitySurvey
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
              }}
            />
          </div>
        </div>
      )}

      {/* Global Announcements Toggle Button */}
      <button
        className="global-feed-toggle"
        onClick={() => setOpen(!open)}
      >
        📢 Update
        {announcementUnreadCount > 0 && (
          <span className="global-feed-badge">{announcementUnreadCount}</span>
        )}
      </button>

      {/* SLIDE-IN PANEL */}
      <aside className={`global-feed ${open ? 'open' : ''}`}
        style={{
          position: 'fixed',
          top: 80,
          right: 0,
          height: 'calc(100vh - 80px)',
          width: 380,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderLeft: '2px solid #30bdb7',
          zIndex: 999,
          transition: 'transform 0.3s',
          transform: open ? 'translateX(0)' : 'translateX(100%)'
        }}>
        <GlobalAnnouncements />
      </aside>

      {/* Consent Modal*/}
      {showConsentModal && (
        <div
          className="qr-modal-overlay"
          onClick={e => {
            if (e.target === e.currentTarget) setShowConsentModal(false);
          }}
        >
          <div
            className="qr-modal-content"
            style={{ minHeight: 180, minWidth: 340, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
          >
            <button className="qr-modal-close" onClick={() => setShowConsentModal(false)} style={{ alignSelf: 'flex-end' }}>X</button>
            <h3 className="qr-modal-title">Activity Consent Form</h3>
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
                accept=".pdf,image/*"
                style={{ marginBottom: 8 }}
                onChange={e => {
                  const file = e.target.files && e.target.files[0];
                  if (!file) return;

                  const fileName = file.name.toLowerCase();
                  const isPdf = fileName.endsWith(".pdf");
                  const isImage =
                    fileName.endsWith(".jpg") ||
                    fileName.endsWith(".jpeg") ||
                    fileName.endsWith(".png");

                  if (!isPdf && !isImage) {
                    alert("Please upload a PDF or image file.");
                    e.target.value = "";
                    return;
                  }

                  setSelectedConsentFile(file);
                }}
              />
              <button
                disabled={!selectedConsentFile}
                onClick={() => handleConsentSubmit(selectedConsentFile)}
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
    </div>
  );
}