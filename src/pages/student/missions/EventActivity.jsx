import { getAuth } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../../../components/Header";
import QRScanner from "../../../components/QRScanner";
import { db } from "../../../firebaseConfig";

export default function EventActivity() {
    const [showQRModal, setShowQRModal] = useState(false);
    const [qrStatus, setQRStatus] = useState("");
    const handleQRScan = async (decodedText) => {
      setQRStatus("");
      // Use event id from this page
      const projectId = id;
      // Get current user
      const user = auth.currentUser;
      if (!user) {
        setQRStatus("You must be logged in to record attendance.");
        return;
      }
      try {
        // Verify QR code contains correct eventId
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
        // Fetch user info from users collection
        const userDoc = await getDoc(doc(db, "users", user.uid));
        let name = "";
        let email = "";
        if (userDoc.exists()) {
          const data = userDoc.data();
          name = data.name || data.username || "";
          email = data.email || "";
        } else {
          name = user.displayName || "";
          email = user.email || "";
        }
        await setDoc(
          doc(db, "Missions", projectId, "volunteer", user.uid),
          {
            name,
            email,
            attendanceStatus: "present"
          },
          { merge: true }
        );
        setQRStatus("Attendance recorded!");
      } catch (err) {
        setQRStatus("Failed to record attendance.");
      }
    };
  const { id } = useParams();
  const navigate = useNavigate();
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
  // Event hooks
  // const [event, setEvent] = useState(null); // REMOVE duplicate declaration
  // const [loading, setLoading] = useState(true); // REMOVE duplicate declaration
  // Journal hooks
  const [journalReflections, setJournalReflections] = useState({});
  const [submitStatus, setSubmitStatus] = useState({});
  const [userJournals, setUserJournals] = useState([]);
  const [editingJournalId, setEditingJournalId] = useState(null);
  const [editingJournalText, setEditingJournalText] = useState("");
  const [enrolledTasks, setEnrolledTasks] = useState({});
  const auth = getAuth();

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
        "Missions",
        id,
        "task",
        activity.id,
        "participants",
        user.uid
      );

      await updateDoc(participantRef, {
        reflection: journalReflections[activityIdx],
        lastUpdated: new Date().toISOString(),
      });

      setSubmitStatus((prev) => ({
        ...prev,
        [activityIdx]: "Reflection submitted!",
      }));
      setJournalReflections((prev) => ({ ...prev, [activityIdx]: "" }));

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
      const tasksRef = collection(db, "Missions", id, "task");
      const tasksSnap = await getDocs(tasksRef);

      const journals = [];
      // For each task, check if user has a participant document with a reflection
      for (const taskDoc of tasksSnap.docs) {
        const participantRef = doc(
          db,
          "Missions",
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
        const eventRef = doc(db, "Missions", id);
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
    // eslint-disable-next-line
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
        "Missions",
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
      // Refresh journals
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
        "Missions",
        id,
        "task",
        taskId,
        "participants",
        user.uid
      );
      await updateDoc(participantRef, {
        reflection: "",
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
        "Missions",
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
    // ...existing code...
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

  useEffect(() => {
    async function fetchEvent() {
      try {
        const eventRef = doc(db, "Missions", id);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          setEvent(eventSnap.data());

          // Fetch tasks from tasks subcollection
          const tasksRef = collection(db, "Missions", id, "task");
          const tasksSnap = await getDocs(tasksRef);
          const tasksData = tasksSnap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setTasks(tasksData);

          // Check enrollment status for each task
          const user = auth.currentUser;
          if (user) {
            const enrollmentStatus = {};
            for (const task of tasksData) {
              const participantRef = doc(
                db,
                "Missions",
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
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        background: "#f6f6f6",
        position: "relative",
      }}
    >
      <Header />
      <div
        style={{
          flex: 1,
          display: "flex",
          gap: 24,
          padding: 32,
          justifyContent: "center",
          boxSizing: "border-box",
          overflowY: "auto",
          paddingTop: 120,
        }}
      >
        {/* Left: Event Summary styled as per screenshot */}
        <div
          style={{
            flex: "0 0 40%",
            maxWidth: "40%",
            minWidth: 340,
            background: "transparent",
            borderRadius: 24,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Top image */}
          <div
            style={{
              width: "100%",
              height: 180,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src={event.img || "/assets/mission1.jpg"}
              alt={event.alt || "Event"}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          {/* Green card */}
          <div
            style={{
              background: "#7bb661",
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              padding: "32px 24px 24px 24px",
              width: "100%",
              boxSizing: "border-box",
              marginTop: -4,
              minHeight: 420,
              display: "flex",
              flexDirection: "column",
              alignItems: "stretch",
              position: "relative"
            }}
          >
            <h2
              style={{
                color: "#fff",
                fontWeight: 700,
                marginBottom: 12,
                fontSize: 26,
                lineHeight: 1.2,
              }}
            >
              {event.title}
            </h2>
            <p
              style={{
                color: "#fff",
                fontSize: 15,
                marginBottom: 18,
                fontWeight: 400,
                lineHeight: 1.5,
              }}
            >
              {event.description}
            </p>
            {/* White info box */}
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: 20,
                marginBottom: 18,
                color: "#222",
                fontSize: 15,
                boxShadow: "0 2px 8px #0001",
              }}
            >
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
                <strong>Event Badge:</strong>
                <br />
                <img
                  src={event.badge || "/assets/badge.png"}
                  alt="Event Badge"
                  style={{
                    width: 90,
                    marginTop: 8,
                    borderRadius: 8,
                    border: "2px solid #eee",
                  }}
                />
              </div>
              {/* View Event Page Button */}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                <button
                  style={{
                    background: "#2566b3",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "10px 24px",
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: "pointer",
                    boxShadow: "0 2px 8px #0001",
                  }}
                  onClick={() => setShowQRModal(true)}
                >
                  Scan Attendance QR Code
                </button>
              </div>
              {showQRModal && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  width: "100vw",
                  height: "100vh",
                  background: "rgba(0,0,0,0.4)",
                  zIndex: 9999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <div style={{ background: "#fff", borderRadius: 16, padding: 32, boxShadow: "0 4px 24px #0003", minWidth: 340, textAlign: "center", position: "relative" }}>
                    <button style={{ position: "absolute", top: 12, right: 12, background: "#eee", border: "none", borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontWeight: 700 }} onClick={() => setShowQRModal(false)}>X</button>
                    <h3 style={{ marginBottom: 16, color: "#2566b3" }}>Scan or Upload QR Code</h3>
                    <QRScanner onScan={handleQRScan} />
                    {qrStatus && <div style={{ marginTop: 16, color: qrStatus === "Attendance recorded!" ? "green" : "red" }}>{qrStatus}</div>}
                  </div>
                </div>
              )}
              {event.waiver && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <a
                    href={event.waiver}
                    style={{
                      color: "#30bdb7",
                      textDecoration: "underline",
                      fontWeight: 500,
                      fontSize: 15,
                    }}
                  >
                    Waiver Form
                  </a>
                </div>
              )}
            </div>
            <button
              style={{
                background: "#bdbdbd",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "14px 0",
                fontWeight: 600,
                fontSize: 18,
                cursor: "not-allowed",
                width: "100%",
                marginTop: 8,
                letterSpacing: 1,
              }}
              disabled
            >
              INCOMPLETE
            </button>
          </div>
        </div>
        {/* Activities Section with journals below each activity title */}
        {/* Right: Activity Section */}
        <div
          style={{
            flex: "0 0 60%",
            maxWidth: "60%",
            minWidth: 400,
            background: "#7bb661",
            borderRadius: 20,
            padding: 24,
            height: "75vh",
            overflowY: "auto",
          }}
        >
          <h2 style={{ color: "#fff", fontWeight: 700, marginBottom: 16 }}>
            Activity
          </h2>
          {tasks &&
            tasks.map((activity, idx) => {
              // Find journals for this activity
              const journalsForActivity = userJournals.filter(
                (j) => j.activityId === activity.title
              );
              return (
                <div
                  key={idx}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 24,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <h3 style={{ color: "#234e7b", fontWeight: 700 }}>
                      {activity.title}
                    </h3>
                    <button
                      onClick={() => handleJoinActivity(activity.id)}
                      disabled={enrolledTasks[activity.id]}
                      style={{
                        background: enrolledTasks[activity.id]
                          ? "#bdbdbd"
                          : "#7bb661",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "8px 18px",
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: enrolledTasks[activity.id]
                          ? "not-allowed"
                          : "pointer",
                      }}
                    >
                      {enrolledTasks[activity.id]
                        ? "ENROLLED"
                        : "JOIN THE ACTIVITY!"}
                    </button>
                  </div>
                  {/* User's journals for this activity */}
                  {journalsForActivity.length > 0 &&
                    journalsForActivity.map((journal) => (
                      <div
                        key={journal.id}
                        style={{
                          background: "#f9f9f9",
                          border: "1px solid #eee",
                          borderRadius: 8,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        {editingJournalId === journal.taskId ? (
                          <>
                            <textarea
                              value={editingJournalText}
                              onChange={(e) =>
                                setEditingJournalText(e.target.value)
                              }
                              style={{
                                width: "100%",
                                minHeight: 60,
                                margin: "8px 0",
                                borderRadius: 6,
                                border: "1px solid #ccc",
                                padding: 8,
                              }}
                            />
                            <button
                              onClick={() => handleSaveEditJournal(journal)}
                              style={{
                                marginRight: 8,
                                background: "#1ea7fd",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px 18px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingJournalId(null)}
                              style={{
                                background: "#bdbdbd",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px 18px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ margin: "8px 0", color: "#234e7b" }}>
                              {journal.reflection}
                            </div>
                            <button
                              onClick={() => handleEditJournal(journal)}
                              style={{
                                marginRight: 8,
                                background: "#7bb661",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px 18px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteJournal(journal.taskId)
                              }
                              style={{
                                background: "#d32f2f",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                padding: "6px 18px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                  <ul
                    style={{ color: "#234e7b", fontSize: 15, marginBottom: 8 }}
                  >
                    {activity.details &&
                      activity.details.map((detail, i) => (
                        <li key={i}>{detail}</li>
                      ))}
                  </ul>
                  {activity.required && (
                    <div
                      style={{
                        color: "#234e7b",
                        fontSize: 15,
                        marginBottom: 8,
                      }}
                    >
                      <strong>Required:</strong> {activity.required}
                    </div>
                  )}
                  <textarea
                    placeholder="Journal Reflection"
                    style={{
                      width: "100%",
                      minHeight: 60,
                      marginBottom: 8,
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      padding: 8,
                    }}
                    value={journalReflections[idx] || ""}
                    onChange={(e) => handleJournalChange(idx, e.target.value)}
                  />
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      marginBottom: 8,
                    }}
                  >
                    <span>Task Progress</span>
                    <progress
                      value={
                        submitStatus[idx] === "Reflection submitted!" ? 100 : 0
                      }
                      max="100"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <button
                    style={{
                      background:
                        journalReflections[idx] &&
                        journalReflections[idx].trim()
                          ? "#1ea7fd"
                          : "#bdbdbd",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      padding: "8px 24px",
                      fontWeight: 600,
                      fontSize: 14,
                      cursor:
                        journalReflections[idx] &&
                        journalReflections[idx].trim()
                          ? "pointer"
                          : "not-allowed",
                    }}
                    disabled={
                      !journalReflections[idx] ||
                      !journalReflections[idx].trim()
                    }
                    onClick={() => handleJournalSubmit(idx, activity)}
                  >
                    SUBMIT
                  </button>
                  {submitStatus[idx] && (
                    <div
                      style={{
                        marginTop: 8,
                        color:
                          submitStatus[idx] === "Reflection submitted!"
                            ? "#7bb661"
                            : "#d32f2f",
                        fontWeight: 600,
                      }}
                    >
                      {submitStatus[idx]}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
