import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, deleteDoc, where, serverTimestamp, Timestamp, onSnapshot, writeBatch, runTransaction, increment, deleteField, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../../../firebaseConfig";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Header from "../../../components/Header";
import { showConfirm } from "../../../utils/toast";
import { WestIcon, ModeRoundedIcon, DeleteRoundedIcon, DeleteForeverRoundedIcon, ExpandMoreRoundedIcon, ExpandLessRoundedIcon } from "../../../components/icons";
import cloudsBg from '../../../assets/clouds-bg.jpg';
import xpIcon from '../../../assets/xp_icon.png';
import LoadingOverlay from '../../../components/LoadingOverlay';
import mission1 from '../../../assets/mission1.jpg';
import GlobalAnnouncements from "../../../components/GlobalAnnouncements";
import QRScanner from "../../../components/QRScanner";
import { createNotification } from "../../../utils/notificationUtils";
import { logAudit } from "../../../utils/auditLogger";
import { useSession } from '../../../context/useSession';
import { calculateWeightedTaskPoints } from "../../../hooks/taskPointingSystem";
import { computeFinalPoints, getLevelInfo } from "../../../hooks/rewardSystem";
import { getMissionPointsBreakdown, getRequirementPoints } from "../../../hooks/missionPoints";
import "../../../styles/student.css";
import "../../../styles/EventActivity.css";
import PreActivitySurvey from "../../../forms/PreActivitySurvey.jsx";
import PostActivitySurvey from "../../../forms/PostActivitySurvey.jsx";
import ParticipantModal from "./ParticipantModal.jsx";
import GroupModal from "./GroupModal.jsx";
import AccomplishmentReportModal from "../../../components/AccomplishmentReportModal.jsx";

const requirementPointUpdate = (key, points = 5) => ({
  [`requirementBonus.${key}`]: points,
  requirementPoints: increment(points),
  missionPoints: increment(points),
  [`pointsBreakdown.requirements.${key}`]: points,
  "pointsBreakdown.requirementPoints": increment(points),
  "pointsBreakdown.missionPoints": increment(points),
});

const taskPointIncrementUpdate = (points) => ({
  pointsEarned: increment(points),
  taskPoints: increment(points),
  missionPoints: increment(points),
  "pointsBreakdown.taskPoints": increment(points),
  "pointsBreakdown.missionPoints": increment(points),
});

const MAX_TASK_PHOTO_BYTES = 5 * 1024 * 1024;

function hasTaskPhoto(data = {}) {
  return !!data?.taskPhoto?.url;
}

function hasLegacyReflection(data = {}) {
  return !data?.legacyReflectionArchived && String(data?.reflection || "").trim().length > 0;
}

function hasTaskProof(data = {}) {
  return hasTaskPhoto(data) || hasLegacyReflection(data);
}

function isApprovedTaskProof(data = {}) {
  return hasTaskProof(data) && data.adminApprovalStatus === "approved";
}

function getProofKind(data = {}) {
  return hasTaskPhoto(data) ? "photo" : "legacy_reflection";
}

async function compressTaskPhoto(file) {
  if (!file || !file.type?.startsWith("image/")) {
    throw new Error("INVALID_PHOTO_TYPE");
  }

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("PHOTO_READ_FAILED"));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("PHOTO_DECODE_FAILED"));
    img.src = dataUrl;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) reject(new Error("PHOTO_COMPRESS_FAILED"));
      else resolve(result);
    }, "image/jpeg", 0.82);
  });

  return new File([blob], `${Date.now()}_task-photo.jpg`, { type: "image/jpeg" });
}

function normalizeMissionRoles(rawRoles) {
  const roles = Array.isArray(rawRoles) ? rawRoles : (rawRoles ? [rawRoles] : []);
  return roles.map(r => String(r || "").trim().toLowerCase().replace(/\s+/g, "_")).filter(Boolean);
}

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
        <span className="req-label">{label} <span style={{ color: '#aaa', fontSize: '0.82em', fontWeight: 500 }}>+5</span></span>

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
  const [joiningTaskId, setJoiningTaskId] = useState(null);
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

  // Haversine distance between two GPS points (returns meters)
  const getDistanceMeters = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleQRScan = async (decodedText, position) => {
    setQRStatus("");
    const projectId = id;
    const user = auth.currentUser;
    if (!user) {
      setQRStatus("You must be logged in to record attendance.");
      return;
    }
    if (volunteerProgress?.preSurvey !== "submitted" || !["submitted", "verified"].includes(volunteerProgress?.consent)) {
      setQRStatus("Complete the pre-activity survey and submit your parent consent form before recording attendance.");
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

      // Check if QR code has expired (30 minutes)
      if (parsed.timestamp) {
        const now = Date.now();
        const qrAge = now - parsed.timestamp;
        const THIRTY_MINUTES_MS = 30 * 60 * 1000;
        
        if (qrAge > THIRTY_MINUTES_MS) {
          const minutesAgo = Math.floor(qrAge / 60000);
          setQRStatus(`This QR code expired ${minutesAgo} minutes ago. Please ask the administrator to generate a new one.`);
          setScanSuccess(false);
          return;
        }
      }

      // Location proximity check — only if QR has embedded location
      if (parsed.location && position?.coords) {
        const dist = getDistanceMeters(
          parsed.location.lat,
          parsed.location.lng,
          position.coords.latitude,
          position.coords.longitude
        );
        

        const qrLocationAccuracy = parsed.location.accuracy || 20; 
        const userLocationAccuracy = position.coords.accuracy || 20; 
        const BASE_THRESHOLD = 200; 
        const ACCURACY_BUFFER = 1.5;
        
        // Dynamic threshold: base + (combined accuracy * buffer)
        const THRESHOLD_METERS = BASE_THRESHOLD + (qrLocationAccuracy + userLocationAccuracy) * ACCURACY_BUFFER;
        
        if (dist > THRESHOLD_METERS) {
          setQRStatus(
            `You are ${Math.round(dist)} meters away from the event location. Please move closer. (Threshold: 200m)`
          );
          setScanSuccess(false);
          return;
        }
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
      const attendanceIsFirst = volunteerProgress?.attendance !== "present";

      await updateDoc(volunteerRef, {
        "scanAttendance.location": locData,
        "scanAttendance.scannedAt": serverTimestamp(),
        "progress.attendance": "present",
        ...(attendanceIsFirst ? requirementPointUpdate("attendance") : {}),
      });
      if (attendanceIsFirst) {
        await updateDoc(doc(db, "users", user.uid), { totalPoints: increment(5) });
        setTotalPointsEarned(prev => prev + 5);
        window.showToast?.("+5 XP", "success", "You earned XP for your attendance.");
        createNotification(user.uid, {
          type: "points_awarded",
          title: "Points Awarded",
          message: "You received 5 points from completing a mission requirement.",
          link: `/event/${projectId}/activity`,
        }).catch(() => {});
      }

      setQRStatus("Attendance Recorded");
      setScannedLocation(locData);
      setScanSuccess(true);

      // Reverse-geocode volunteer location AND QR target location in parallel
      const geocode = async (lat, lng) => {
        try {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
          const resp = await fetch(url);
          if (resp.ok) {
            const json = await resp.json();
            return json.results?.[0]?.formatted_address || null;
          }
        } catch { /* non-fatal */ }
        return null;
      };

      const [scannedName, resolvedTargetName] = await Promise.all([
        geocode(locData.lat, locData.lng),
        (event?.qrLocationName || !parsed.location)
          ? Promise.resolve(event?.qrLocationName || null)
          : geocode(parsed.location.lat, parsed.location.lng),
      ]);

      await updateDoc(volunteerRef, {
        ...(scannedName ? { "scanAttendance.locationName": scannedName } : {}),
        "scanAttendance.location": deleteField(),
      });
      if (scannedName) locData.name = scannedName;

      setQRStatus("Attendance Recorded");

      setVolunteerProgress((prev) => ({ ...prev, attendance: "present" }));
      setScannedLocation(locData);

      // Audit-log every successful scan (overwrites are intentional and both entries remain)
      logAudit({
        action: "QR_ATTENDANCE_SCANNED",
        category: "event",
        details: {
          missionName: event?.title || projectId,
          targetLocation: resolvedTargetName || null,
          scannedLocation: locData.name || null,
        },
      });

    } catch (e) {
      console.warn("Failed to save scan location or mark attendance:", e);
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
      if (!isEditable) {
        alert("Consent submission is closed because this event has ended.");
        return;
      }
      if (volunteerProgress?.preSurvey !== "submitted") {
        alert("Complete the Pre-Activity Survey before submitting the parent consent form.");
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
      const consentIsFirst = !["submitted", "verified"].includes(volunteerProgress?.consent);
      const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
      const fileRef = ref(storage, `consents/${id}/${user.uid}/activity-consent.pdf`);
      // Upload to Storage
      await uploadBytes(fileRef, selectedConsentFile);
      const downloadURL = await getDownloadURL(fileRef);
      // Save metadata to Firestore
      await setDoc(
        volunteerRef,
        {
          consentSubmission: {
            fileUrl: downloadURL,
            filePath: fileRef.fullPath,
            fileName: selectedConsentFile.name,
            fileType: selectedConsentFile.type,
            submittedAt: serverTimestamp()
          },
          progress: {
            consent: "submitted"
          },
        },
        { merge: true }
      );
      await updateDoc(volunteerRef, {
        "consentSubmission.reviewStatus": deleteField(),
      });
      setConsentSubmitted(true);
      setConsentReviewStatus("");
      setConsentFileUrl(downloadURL);
      setVolunteerProgress((prev) => ({
        ...(prev || {}),
        consent: "submitted",
      }));
      setSelectedConsentFile(null);
      setShowConsentModal(false);
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

  const [taskPhotoFiles, setTaskPhotoFiles] = useState({});
  const [taskPhotoPreviews, setTaskPhotoPreviews] = useState({});
  const [uploadingTaskId, setUploadingTaskId] = useState(null);
  const [submitStatus, setSubmitStatus] = useState({});
  const [userJournals, setUserJournals] = useState([]);
  const [enrolledTasks, setEnrolledTasks] = useState({});
  const [tasks, setTasks] = useState([]);
  const [volunteerProgress, setVolunteerProgress] = useState(null);
  const [volunteerCount, setVolunteerCount] = useState(null);
  const [volunteerAvatars, setVolunteerAvatars] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [taskParticipantCounts, setTaskParticipantCounts] = useState({});
  const [taskGroupCounts, setTaskGroupCounts] = useState({});
  const [selectedTaskForParticipants, setSelectedTaskForParticipants] = useState(null);
  const [selectedTaskForGroups, setSelectedTaskForGroups] = useState(null);
  const [groupModalMode, setGroupModalMode] = useState("view");
  const [timerNow, setTimerNow] = useState(Date.now());
  const [activeNav, setActiveNav] = useState(() => {
    const saved = sessionStorage.getItem('ea_activeNav');
    if (saved) { sessionStorage.removeItem('ea_activeNav'); return saved; }
    return 'content';
  });
  const [showTasksInReq, setShowTasksInReq] = useState(false);
  const [requirementBonusEarned, setRequirementBonusEarned] = useState({});
  const [showAccomplishmentModal, setShowAccomplishmentModal] = useState(false);
  const [accomplishmentReport, setAccomplishmentReport] = useState(null);
  const accomplishmentNotifSentRef = useRef(false);
  const [pullY, setPullY] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const postSurveyStepRef = useRef(null);
  const [pullContainerEl, setPullContainerEl] = useState(null);
  const pullContainerRef = useCallback((el) => setPullContainerEl(el), []);
  const touchStartYRef = useRef(0);
  const pullingRef = useRef(false);
  const activeNavRef = useRef(activeNav);
  const cameraInputRefs = useRef({});
  const uploadInputRefs = useRef({});
  const taskPhotoPreviewsRef = useRef({});

  const compareParticipantsByEnrollment = useCallback((a, b) => {
    const aData = a?.data ? a.data() : a;
    const bData = b?.data ? b.data() : b;
    const aOrder = Number(aData?.enrollmentOrder);
    const bOrder = Number(bData?.enrollmentOrder);
    const aHasOrder = Number.isFinite(aOrder) && aOrder > 0;
    const bHasOrder = Number.isFinite(bOrder) && bOrder > 0;

    if (aHasOrder && bHasOrder) {
      if (aOrder !== bOrder) return aOrder - bOrder;
    } else if (aHasOrder) {
      return -1;
    } else if (bHasOrder) {
      return 1;
    }

    const aJoined = String(aData?.joinedAt || "");
    const bJoined = String(bData?.joinedAt || "");
    if (aJoined !== bJoined) return aJoined.localeCompare(bJoined);

    return String(a?.id || aData?.uid || "").localeCompare(
      String(b?.id || bData?.uid || ""),
    );
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  // Auto-expand Task Assignment when attendance is first marked present
  useEffect(() => {
    if (volunteerProgress?.attendance === 'present') {
      setShowTasksInReq(true);
    }
  }, [volunteerProgress?.attendance]);

  const canJoinActivities = true;
  const toggleTaskExpand = (taskId) => setExpandedTasks(prev => ({ ...prev, [taskId]: !prev[taskId] }));

  const getTaskEnrollmentDeadline = (task) => {
    if (!event?.targetDate || !task?.enrollmentDeadline) return null;

    const [year, month, day] = event.targetDate
      .split("-")
      .map((part) => Number(part));
    const [rawHour, rawMinute] = task.enrollmentDeadline.split(":");
    const hour = Number(rawHour);
    const minute = Number(rawMinute);

    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day) ||
      !Number.isFinite(hour) ||
      !Number.isFinite(minute)
    ) {
      return null;
    }

    return new Date(year, month - 1, day, hour, minute, 0, 0);
  };

  const getEnrollmentCountdown = (task) => {
    const deadline = getTaskEnrollmentDeadline(task);
    if (!deadline) return null;

    const remainingMs = deadline.getTime() - timerNow;
    if (remainingMs <= 0) {
      return {
        isClosed: true,
        label: "Enrollment closed",
      };
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad2 = (value) => String(value).padStart(2, "0");

    const label =
      days > 0
        ? `Closes in ${days}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`
        : `Closes in ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;

    return {
      isClosed: false,
      label,
    };
  };

  const isEnrollmentClosed = (task) => {
    const deadline = getTaskEnrollmentDeadline(task);
    if (!deadline) return false;
    return Date.now() > deadline.getTime();
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

  // Task photo proof handlers
  const handleTaskPhotoSelect = (activityIdx, file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      setSubmitStatus((prev) => ({
        ...prev,
        [activityIdx]: "Please select an image file.",
      }));
      return;
    }

    setTaskPhotoFiles((prev) => ({ ...prev, [activityIdx]: file }));
    setTaskPhotoPreviews((prev) => {
      if (prev[activityIdx]) URL.revokeObjectURL(prev[activityIdx]);
      return { ...prev, [activityIdx]: URL.createObjectURL(file) };
    });
    setSubmitStatus((prev) => ({ ...prev, [activityIdx]: "" }));
  };

  const clearSelectedTaskPhoto = (activityIdx) => {
    setTaskPhotoFiles((prev) => {
      const next = { ...prev };
      delete next[activityIdx];
      return next;
    });
    setTaskPhotoPreviews((prev) => {
      if (prev[activityIdx]) URL.revokeObjectURL(prev[activityIdx]);
      const next = { ...prev };
      delete next[activityIdx];
      return next;
    });
  };

  const uploadTaskPhoto = async ({ activity, file, user, submittedAt }) => {
    const compressedFile = await compressTaskPhoto(file);
    if (compressedFile.size > MAX_TASK_PHOTO_BYTES) {
      throw new Error("PHOTO_TOO_LARGE");
    }

    const storagePath = `task-photos/${id}/${activity.id}/${user.uid}/${Date.now()}.jpg`;
    const photoRef = ref(storage, storagePath);
    await uploadBytes(photoRef, compressedFile, { contentType: compressedFile.type });
    const url = await getDownloadURL(photoRef);

    return {
      url,
      storagePath,
      originalName: file.name || "task-photo.jpg",
      contentType: compressedFile.type,
      size: compressedFile.size,
      submittedBy: user.uid,
      submittedAt,
    };
  };

  const handleTaskPhotoSubmit = async (activityIdx, activity) => {
    const user = auth.currentUser;
    if (!user) {
      setSubmitStatus((prev) => ({
        ...prev,
        [activityIdx]: "You must be logged in.",
      }));
      return;
    }
    const selectedPhoto = taskPhotoFiles[activityIdx];
    if (!selectedPhoto) {
      setSubmitStatus((prev) => ({
        ...prev,
        [activityIdx]: "Please choose a photo first.",
      }));
      return;
    }

    try {
      setUploadingTaskId(activity.id);
      const submittedAt = new Date().toISOString();
      const taskPhoto = await uploadTaskPhoto({
        activity,
        file: selectedPhoto,
        user,
        submittedAt,
      });

      const participantRef = doc(
        db,
        "missions",
        id,
        "task",
        activity.id,
        "participants",
        user.uid
      );

      if (activity?.type === "grouped") {
        const participantSnap = await getDoc(participantRef);
        if (!participantSnap.exists()) {
          setSubmitStatus((prev) => ({
            ...prev,
            [activityIdx]: "You must join a group before submitting.",
          }));
          return;
        }

        const groupId = participantSnap.data()?.groupId;
        if (!groupId) {
          setSubmitStatus((prev) => ({
            ...prev,
            [activityIdx]: "Your group assignment is missing. Rejoin the task.",
          }));
          return;
        }

        const groupRef = doc(db, "missions", id, "task", activity.id, "group", groupId);

        await runTransaction(db, async (transaction) => {
          const groupSnap = await transaction.get(groupRef);

          if (!groupSnap.exists()) {
            throw new Error("GROUP_NOT_FOUND");
          }

          if (groupSnap.data()?.adminApprovalStatus === "approved") {
            throw new Error("GROUP_PROOF_ALREADY_APPROVED");
          }

          transaction.update(groupRef, {
            taskPhoto,
            proofType: "photo",
            legacyReflectionArchived: true,
            photoSubmittedBy: user.uid,
            photoSubmittedAt: submittedAt,
            status: "completed",
            adminApprovalStatus: "pending",
            lastUpdated: submittedAt,
          });
        });
        const groupPoints = Number(activity.points) || 0;

        const groupParticipantsRef = collection(
          db,
          "missions",
          id,
          "task",
          activity.id,
          "participants",
        );
        const groupParticipantsQuery = query(
          groupParticipantsRef,
          where("groupId", "==", groupId),
        );
        const groupParticipantsSnap = await getDocs(groupParticipantsQuery);
        let didUpdateCurrentUser = false;

        for (const groupParticipantDoc of groupParticipantsSnap.docs) {
          const targetParticipantRef = groupParticipantDoc.ref;
          const targetParticipantData = groupParticipantDoc.data() || {};

          try {
            await updateDoc(targetParticipantRef, {
              status: "completed",
              taskPhoto,
              proofType: "photo",
              legacyReflectionArchived: true,
              adminApprovalStatus: "pending",
              pointsEarned: 0,
              estimatedPoints: groupPoints,
              completedAt: targetParticipantData.completedAt || submittedAt,
              lastUpdated: submittedAt,
              groupId,
            });

            if (groupParticipantDoc.id === user.uid) {
              didUpdateCurrentUser = true;
            }
          } catch (groupParticipantSyncError) {
            console.warn(
              `Failed to sync grouped photo proof to participant ${groupParticipantDoc.id}:`,
              groupParticipantSyncError,
            );
          }
        }

        if (!didUpdateCurrentUser) {
          await updateDoc(participantRef, {
            status: "completed",
            taskPhoto,
            proofType: "photo",
            legacyReflectionArchived: true,
            adminApprovalStatus: "pending",
            pointsEarned: 0,
            estimatedPoints: groupPoints,
            completedAt: submittedAt,
            lastUpdated: submittedAt,
            groupId,
          });
        }

        setSubmitStatus((prev) => ({
          ...prev,
          [activityIdx]: "Group photo submitted! Awaiting admin approval.",
        }));
        clearSelectedTaskPhoto(activityIdx);

        await createNotification(user.uid, {
          type: "photo_submitted",
          title: "Group Photo Submitted",
          message: `Your group photo proof for "${activity.title}" has been submitted successfully!`,
          link: `/event/${id}/activity`,
          missionId: id,
          taskId: activity.id,
        });

        await fetchUserJournals();
        return;
      }

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
        const participantsSnap = await getDocs(participantsRef);
        const sortedParticipants = [...participantsSnap.docs].sort(
          compareParticipantsByEnrollment,
        );
        const participantCount = sortedParticipants.length;
        const positionIndex = sortedParticipants.findIndex(
          (participantDoc) => participantDoc.id === user.uid,
        );
        const position = positionIndex >= 0 ? positionIndex + 1 : participantCount;

        pointsToAward = calculateWeightedTaskPoints(
          activity.points || 0,
          position,
          participantCount
        );
      }

      await updateDoc(participantRef, {
        taskPhoto,
        proofType: "photo",
        legacyReflectionArchived: true,
        status: "completed",
        adminApprovalStatus: "pending",
        pointsEarned: 0,
        estimatedPoints: pointsToAward,
        completedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

      setSubmitStatus((prev) => ({
        ...prev,
        [activityIdx]: "Photo submitted! Awaiting admin approval.",
      }));
      clearSelectedTaskPhoto(activityIdx);

      // Send notification to student
      await createNotification(user.uid, {
        type: "photo_submitted",
        title: "Photo Submitted",
        message: `Your photo proof for "${activity.title}" has been submitted successfully!`,
        link: `/event/${id}/activity`,
        missionId: id,
        taskId: activity.id,
      });

      await fetchUserJournals();
    } catch (err) {
      console.error("Error submitting task photo:", err);
      const isGroupProofApproved = err?.message === "GROUP_PROOF_ALREADY_APPROVED";
      const isGroupMissing = err?.message === "GROUP_NOT_FOUND";
      const isTooLarge = err?.message === "PHOTO_TOO_LARGE";

      setSubmitStatus((prev) => ({
        ...prev,
        [activityIdx]: isGroupProofApproved
          ? "This group photo has already been approved."
          : isGroupMissing
            ? "Group not found. Please rejoin the grouped task."
            : isTooLarge
              ? "Photo must be less than 5MB after compression."
              : "Error submitting photo. Try again.",
      }));
    } finally {
      setUploadingTaskId(null);
    }
  };

  // Helper function to fetch user task proofs from participant documents.
  const fetchUserJournals = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      // Fetch all tasks for this mission
      const tasksRef = collection(db, "missions", id, "task");
      const tasksSnap = await getDocs(tasksRef);

      const journals = [];
      let backfilledPoints = 0;
      // For each task, check if user has a participant document with an active proof.
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
          if (hasTaskProof(data)) {
            let resolvedData = { ...data };
            if (data.adminApprovalStatus === 'approved' && !Number(data.pointsEarned)) {
              const taskData = taskDoc.data();
              const volunteerRef = doc(db, 'missions', id, 'volunteer', user.uid);
              try {
                let pts = 0;
                if (taskData.type === 'grouped') {
                  pts = Number(taskData.points) || 0;
                } else {
                  const participantsSnap = await getDocs(collection(db, 'missions', id, 'task', taskDoc.id, 'participants'));
                  const sorted = [...participantsSnap.docs].sort(compareParticipantsByEnrollment);
                  const posIdx = sorted.findIndex(p => p.id === user.uid);
                  const pos = posIdx >= 0 ? posIdx + 1 : sorted.length;
                  pts = calculateWeightedTaskPoints(taskData.points || 0, pos, sorted.length);
                }
                if (pts > 0) {
                  await updateDoc(participantRef, { pointsEarned: pts, estimatedPoints: deleteField() });
                  await updateDoc(doc(db, 'users', user.uid), { totalPoints: increment(pts) });
                  await updateDoc(volunteerRef, taskPointIncrementUpdate(pts));
                  resolvedData = { ...resolvedData, pointsEarned: pts };
                  backfilledPoints += pts;
                }
              } catch (e) {
                console.warn('Failed to award task proof points:', e);
              }
            }
            journals.push({
              id: taskDoc.id,
              taskId: taskDoc.id,
              activityId: taskDoc.data().title,
              reflection: data.reflection || "",
              taskPhoto: data.taskPhoto || null,
              proofType: getProofKind(data),
              ...resolvedData,
            });
          }
        }
      }

      setUserJournals(journals);
      if (backfilledPoints > 0) {
        setTotalPointsEarned(prev => prev + backfilledPoints);
      }
      return journals;
    } catch (err) {
      console.error("Error fetching task proofs:", err);
      return [];
    }
  };

  const hasCompletedTask = async (tasksData = tasks) => {
    const user = auth.currentUser;
    if (!user) return false;
    if (!Array.isArray(tasksData) || tasksData.length === 0) return false;

    for (const task of tasksData) {
      const participantSnap = await getDoc(
        doc(db, "missions", id, "task", task.id, "participants", user.uid),
      );
      if (participantSnap.exists() && isApprovedTaskProof(participantSnap.data())) return true;
    }

    return false;
  };

  const checkAndWriteRequirementsCompleted = async ({ preSurveyDone, consentDone, attendanceDone, journalDone, postSurveyDone }) => {
    if (isDonorUser ? !preSurveyDone : (!preSurveyDone || !consentDone || !attendanceDone || !journalDone || !postSurveyDone)) return;
    const user = auth.currentUser;
    if (!user) return;
    try {
      const existingSnap = await getDocs(query(
        collection(db, "users", user.uid, "notifications"),
        where("type", "==", "requirements_completed"),
        where("missionId", "==", id)
      ));
      if (!existingSnap.empty) return;

      await addDoc(collection(db, "users", user.uid, "notifications"), {
        type: "requirements_completed",
        missionId: id,
        isOrganizer: !!isOrganizerUser,
        popupShown: false,
        read: false,
        createdAt: serverTimestamp(),
        title: "Requirements Completed!",
        message: "You've submitted all your requirements for this mission.",
      });

      if (isOrganizerUser) {
        const arSnap = await getDocs(query(
          collection(db, "users", user.uid, "notifications"),
          where("type", "==", "accomplishment_report_reminder"),
          where("missionId", "==", id)
        ));
        if (arSnap.empty) {
          await addDoc(collection(db, "users", user.uid, "notifications"), {
            type: "accomplishment_report_reminder",
            missionId: id,
            popupShown: false,
            read: false,
            createdAt: serverTimestamp(),
            title: "Submit Your Accomplishment Report",
            message: "Don't forget! Submit your Accomplishment Report to receive your certificate for this mission.",
            link: `/event/${id}/activity`,
          });
        }
      }
    } catch (err) {
      console.error("checkAndWriteRequirementsCompleted error:", err);
    }
  };

  useEffect(() => {
    if (!authChecked) return;
    async function fetchEventAndJournals() {
      try {
        const eventRef = doc(db, "missions", id);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          const eventData = eventSnap.data();
          if (eventData.status === 'completed' || eventData.status === 'cancelled') {
            navigate(`/event/${id}`, { replace: true });
            return;
          }
          setEvent(eventData);
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

  useEffect(() => {
    if (!authChecked || !tasks.length) return;
    const user = auth.currentUser;
    if (!user) return;

    const prevStatuses = {};
    const unsubs = tasks.map((task) => {
      const participantRef = doc(db, 'missions', id, 'task', task.id, 'participants', user.uid);
      let isFirst = true;
      return onSnapshot(participantRef, async (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();

        if (isFirst) {
          isFirst = false;
          prevStatuses[task.id] = data.adminApprovalStatus;
          // Fallback: ensure enrollment and task points reflect Firestore state
          // in case fetchEvent's enrollment check was skipped due to an error.
          setEnrolledTasks(prev => prev[task.id] ? prev : { ...prev, [task.id]: true });
          return;
        }

        const prevStatus = prevStatuses[task.id];
        const newStatus = data.adminApprovalStatus;
        prevStatuses[task.id] = newStatus;
        if (prevStatus === newStatus) return;

        if (hasTaskProof(data)) {
          setUserJournals(prev => {
            const exists = prev.some(j => j.taskId === task.id);
            if (exists) return prev.map(j => j.taskId === task.id ? { ...j, ...data } : j);
            return [...prev, {
              id: task.id,
              taskId: task.id,
              activityId: task.title,
              reflection: data.reflection || "",
              taskPhoto: data.taskPhoto || null,
              proofType: getProofKind(data),
              ...data,
            }];
          });
        }

        if (newStatus === 'approved') {
          if (!Number(data.pointsEarned)) {
            try {
              let pts = 0;
              if (task.type === 'grouped') {
                pts = Number(task.points) || 0;
              } else {
                const participantsSnap = await getDocs(collection(db, 'missions', id, 'task', task.id, 'participants'));
                const sorted = [...participantsSnap.docs].sort(compareParticipantsByEnrollment);
                const posIdx = sorted.findIndex(p => p.id === user.uid);
                const pos = posIdx >= 0 ? posIdx + 1 : sorted.length;
                pts = calculateWeightedTaskPoints(task.points || 0, pos, sorted.length);
              }
              const volunteerRef = doc(db, 'missions', id, 'volunteer', user.uid);
              await updateDoc(participantRef, { pointsEarned: pts, estimatedPoints: deleteField() });
              await updateDoc(doc(db, 'users', user.uid), { totalPoints: increment(pts) });
              await updateDoc(volunteerRef, taskPointIncrementUpdate(pts));
              setTotalPointsEarned(prev => prev + pts);
              setUserJournals(prev => prev.map(j => j.taskId === task.id ? { ...j, pointsEarned: pts, estimatedPoints: undefined } : j));
              window.showToast?.(`Your task proof for "${task.title}" was approved! +${pts} pts earned.`, 'success');
            } catch {
              window.showToast?.(`Your task proof for "${task.title}" was approved!`, 'success');
            }
          } else {
            window.showToast?.(`Your task proof for "${task.title}" was approved!`, 'success');
          }
          const taskProofDone = await hasCompletedTask();
          await checkAndWriteRequirementsCompleted({
            preSurveyDone: volunteerProgress?.preSurvey === 'submitted',
            consentDone: ['submitted', 'verified'].includes(volunteerProgress?.consent),
            attendanceDone: volunteerProgress?.attendance === 'present',
            journalDone: taskProofDone,
            postSurveyDone: volunteerProgress?.postSurvey === 'submitted',
          });
        } else if (newStatus === 'rejected') {
          window.showToast?.(`Your task proof for "${task.title}" was rejected. Please replace the photo.`, 'error');
        }
      });
    });

    return () => unsubs.forEach(u => u());
  }, [tasks, authChecked]);

  useEffect(() => { activeNavRef.current = activeNav; }, [activeNav]);

  useEffect(() => {
    taskPhotoPreviewsRef.current = taskPhotoPreviews;
  }, [taskPhotoPreviews]);

  useEffect(() => {
    return () => {
      Object.values(taskPhotoPreviewsRef.current).forEach((previewUrl) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      });
    };
  }, []);

  useEffect(() => {
    const el = pullContainerEl;
    if (!el) return;
    const THRESHOLD = 80;

    const onTouchStart = (e) => {
      if (el.scrollTop === 0) {
        touchStartYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
      } else {
        pullingRef.current = false;
      }
    };

    const onTouchMove = (e) => {
      if (!pullingRef.current) return;
      const delta = e.touches[0].clientY - touchStartYRef.current;
      if (delta > 0) {
        e.preventDefault();
        setPullY(Math.min(delta * 0.5, THRESHOLD + 20));
      } else {
        pullingRef.current = false;
        setPullY(0);
      }
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      setPullY(prev => {
        if (prev >= THRESHOLD) {
          setIsPullRefreshing(true);
          sessionStorage.setItem('ea_activeNav', activeNavRef.current);
          setTimeout(() => window.location.reload(), 400);
        }
        return 0;
      });
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullContainerEl]);

  const deleteStoredTaskPhoto = async (taskPhoto) => {
    if (!taskPhoto?.storagePath) return;
    try {
      await deleteObject(ref(storage, taskPhoto.storagePath));
    } catch (error) {
      console.warn("Task photo file cleanup skipped:", error);
    }
  };

  const handleDeleteJournal = async (taskId) => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const taskDetails = tasks.find((task) => task.id === taskId);
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
      if (!participantSnap.exists()) {
        return;
      }

      const participantData = participantSnap.data() || {};

      if (taskDetails?.type === "grouped") {
        const groupId = participantData.groupId;
        if (!groupId) {
          alert("Group assignment missing. Rejoin the grouped task.");
          return;
        }

        const clearedAt = new Date().toISOString();
        const groupRef = doc(db, "missions", id, "task", taskId, "group", groupId);
        const groupSnap = await getDoc(groupRef);
        const groupData = groupSnap.exists() ? groupSnap.data() : {};
        if (groupData.adminApprovalStatus === "approved") {
          alert("Approved photo proofs cannot be removed.");
          return;
        }

        await deleteStoredTaskPhoto(groupData.taskPhoto || participantData.taskPhoto);

        await updateDoc(groupRef, {
          taskPhoto: deleteField(),
          proofType: deleteField(),
          legacyReflectionArchived: true,
          status: "in_progress",
          photoSubmittedBy: deleteField(),
          photoSubmittedAt: deleteField(),
          adminApprovalStatus: deleteField(),
          lastUpdated: clearedAt,
        });

        const groupedParticipantsSnap = await getDocs(query(
          collection(db, "missions", id, "task", taskId, "participants"),
          where("groupId", "==", groupId),
        ));

        for (const groupedParticipantDoc of groupedParticipantsSnap.docs) {
          const groupedParticipantData = groupedParticipantDoc.data() || {};
          const pointsToRemove = Number(groupedParticipantData.pointsEarned) || 0;
          await updateDoc(groupedParticipantDoc.ref, {
            taskPhoto: deleteField(),
            proofType: deleteField(),
            legacyReflectionArchived: true,
            status: "todo",
            pointsEarned: 0,
            estimatedPoints: deleteField(),
            adminApprovalStatus: deleteField(),
            completedAt: deleteField(),
            lastUpdated: clearedAt,
            groupId,
          });

          if (pointsToRemove > 0) {
            const volunteerRef = doc(db, "missions", id, "volunteer", groupedParticipantDoc.id);
            const volunteerSnap = await getDoc(volunteerRef);
            if (volunteerSnap.exists()) {
              const currentTotal = volunteerSnap.data().pointsEarned || 0;
              const newTotal = Math.max(0, currentTotal - pointsToRemove);
              await updateDoc(volunteerRef, {
                pointsEarned: newTotal,
                taskPoints: newTotal,
                missionPoints: increment(-pointsToRemove),
                "pointsBreakdown.taskPoints": newTotal,
                "pointsBreakdown.missionPoints": increment(-pointsToRemove),
              });
              if (groupedParticipantDoc.id === user.uid) {
                setTotalPointsEarned(newTotal);
              }
            }
          }
        }

        setUserJournals((prev) => prev.filter((j) => j.taskId !== taskId));
        window.showToast?.("Group photo proof removed", "success");
        return;
      }

      if (participantData.adminApprovalStatus === "approved") {
        alert("Approved photo proofs cannot be removed.");
        return;
      }

      await deleteStoredTaskPhoto(participantData.taskPhoto);

      const pointsToRemove = Number(participantData.pointsEarned) || 0;

      await updateDoc(participantRef, {
        taskPhoto: deleteField(),
        proofType: deleteField(),
        legacyReflectionArchived: true,
        status: "todo",
        pointsEarned: 0,
        estimatedPoints: deleteField(),
        pendingPoints: deleteField(),
        adminApprovalStatus: deleteField(),
        lastUpdated: new Date().toISOString(),
      });

      if (pointsToRemove > 0) {
        const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);
        const volunteerSnap = await getDoc(volunteerRef);
        if (volunteerSnap.exists()) {
          const currentTotal = volunteerSnap.data().pointsEarned || 0;
          const newTotal = Math.max(0, currentTotal - pointsToRemove);
          await updateDoc(volunteerRef, {
            pointsEarned: newTotal,
            taskPoints: newTotal,
            missionPoints: increment(-pointsToRemove),
            "pointsBreakdown.taskPoints": newTotal,
            "pointsBreakdown.missionPoints": increment(-pointsToRemove),
          });
          setTotalPointsEarned(newTotal);
        }
      }

      setUserJournals(userJournals.filter((j) => j.taskId !== taskId));
    } catch {
      alert("Failed to delete task proof.");
    }
  };

  const syncGroupedTaskCompletionForUser = async (tasksData, userId) => {
    if (!Array.isArray(tasksData) || !userId) {
      return false;
    }

    let totalPointsDelta = 0;
    let hasParticipantUpdates = false;

    for (const task of tasksData) {
      if (task?.type !== "grouped") {
        continue;
      }

      const participantRef = doc(
        db,
        "missions",
        id,
        "task",
        task.id,
        "participants",
        userId,
      );
      const participantSnap = await getDoc(participantRef);
      if (!participantSnap.exists()) {
        continue;
      }

      const participantData = participantSnap.data() || {};
      const groupId = participantData.groupId;
      if (!groupId) {
        continue;
      }

      const groupRef = doc(db, "missions", id, "task", task.id, "group", groupId);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) {
        continue;
      }

      const groupData = groupSnap.data() || {};
      const groupHasProof = hasTaskProof(groupData);
      if (!groupHasProof) {
        const participantPoints = Number(participantData.pointsEarned) || 0;
        const participantHasProof = hasTaskProof(participantData);
        const isCompleted = participantData.status === "completed";

        if (!participantPoints && !participantHasProof && !isCompleted) {
          continue;
        }

        await updateDoc(participantRef, {
          status: "todo",
          taskPhoto: deleteField(),
          proofType: deleteField(),
          legacyReflectionArchived: true,
          pointsEarned: 0,
          estimatedPoints: deleteField(),
          adminApprovalStatus: deleteField(),
          completedAt: deleteField(),
          lastUpdated: new Date().toISOString(),
          groupId,
        });

        if (participantPoints > 0) {
          const volunteerRef = doc(db, "missions", id, "volunteer", userId);
          const volunteerSnap = await getDoc(volunteerRef);
          if (volunteerSnap.exists()) {
            const currentTotal = volunteerSnap.data().pointsEarned || 0;
            const newTotal = Math.max(0, currentTotal - participantPoints);
            await updateDoc(volunteerRef, {
              pointsEarned: newTotal,
              taskPoints: newTotal,
              missionPoints: increment(-participantPoints),
              "pointsBreakdown.taskPoints": newTotal,
              "pointsBreakdown.missionPoints": increment(-participantPoints),
            });
            totalPointsDelta -= participantPoints;
          }
        }

        hasParticipantUpdates = true;
        continue;
      }

      const groupPoints = Number(task.points) || 0;
      const participantPoints = Number(participantData.pointsEarned) || 0;
      const groupApprovalStatus = groupData.adminApprovalStatus || participantData.adminApprovalStatus || "pending";
      const targetPoints = groupApprovalStatus === "approved" ? groupPoints : 0;
      const groupReflection = String(groupData.reflection || "").trim();
      const alreadySynced =
        participantData.status === "completed" &&
        participantPoints === targetPoints &&
        participantData.adminApprovalStatus === groupApprovalStatus &&
        ((groupData.taskPhoto?.url && participantData.taskPhoto?.url === groupData.taskPhoto.url) ||
          (!groupData.taskPhoto?.url && String(participantData.reflection || "").trim() === groupReflection));

      if (!alreadySynced) {
        const completedAt =
          participantData.completedAt ||
          groupData.photoSubmittedAt ||
          groupData.taskPhoto?.submittedAt ||
          new Date().toISOString();

        await updateDoc(participantRef, {
          status: "completed",
          ...(groupData.taskPhoto?.url ? { taskPhoto: groupData.taskPhoto, proofType: "photo", legacyReflectionArchived: true } : {}),
          ...(!groupData.taskPhoto?.url ? { reflection: groupReflection, proofType: "legacy_reflection" } : {}),
          adminApprovalStatus: groupApprovalStatus,
          pointsEarned: targetPoints,
          estimatedPoints: groupApprovalStatus === "approved" ? deleteField() : groupPoints,
          completedAt,
          lastUpdated: new Date().toISOString(),
          groupId,
        });

        const pointsDelta = targetPoints - participantPoints;
        if (pointsDelta !== 0) {
          await setDoc(
            doc(db, "missions", id, "volunteer", userId),
            {
              ...taskPointIncrementUpdate(pointsDelta),
            },
            { merge: true },
          );
          totalPointsDelta += pointsDelta;
        }

        hasParticipantUpdates = true;
      }
    }

    if (totalPointsDelta !== 0) {
      setTotalPointsEarned((prev) => Math.max(0, prev + totalPointsDelta));
    }

    return hasParticipantUpdates;
  };

  const handleGroupedTaskSelection = async ({ groupId, isNew = false }) => {
    const user = auth.currentUser;
    const groupedTask = selectedTaskForGroups;

    if (!user || !groupedTask?.id || !groupId) {
      window.showToast?.("Unable to join grouped task.", "error");
      return;
    }

    try {
      const participantRef = doc(
        db,
        "missions",
        id,
        "task",
        groupedTask.id,
        "participants",
        user.uid,
      );
      const participantsRef = collection(
        db,
        "missions",
        id,
        "task",
        groupedTask.id,
        "participants",
      );

      const [participantSnap, participantsSnap] = await Promise.all([
        getDoc(participantRef),
        getDocs(participantsRef),
      ]);

      if (participantSnap.exists()) {
        await updateDoc(participantRef, {
          groupId,
          enrollmentOrder: deleteField(),
          lastUpdated: new Date().toISOString(),
        });

        setEnrolledTasks((prev) => ({ ...prev, [groupedTask.id]: true }));
        setTaskParticipantCounts((prev) => ({
          ...prev,
          [groupedTask.id]: participantsSnap.size,
        }));
        if (isNew) {
          setTaskGroupCounts((prev) => ({
            ...prev,
            [groupedTask.id]: (prev[groupedTask.id] || 0) + 1,
          }));
        }
        window.showToast?.("Joined grouped task successfully", "success");
        setSelectedTaskForGroups(null);
        return;
      }

      await setDoc(participantRef, {
        status: "todo",
        role: "",
        proof: "",
        reflection: "",
        pointsEarned: 0,
        groupId,
        joinedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      });

      setEnrolledTasks((prev) => ({ ...prev, [groupedTask.id]: true }));
      setTaskParticipantCounts((prev) => ({
        ...prev,
        [groupedTask.id]: participantsSnap.size + 1,
      }));
      if (isNew) {
        setTaskGroupCounts((prev) => ({
          ...prev,
          [groupedTask.id]: (prev[groupedTask.id] || 0) + 1,
        }));
      }
      window.showToast?.("Joined grouped task successfully", "success");
      setSelectedTaskForGroups(null);
    } catch (error) {
      console.error("Error completing grouped task enrollment:", error);
      window.showToast?.("Failed to join grouped task", "error");
    }
  };

  const handleJoinActivity = async (taskId, task) => {
    const user = auth.currentUser;
    if (!user) {
      alert("You must be logged in to join an activity.");
      return;
    }

    if (task?.enrollmentDeadline) {
      const deadline = getTaskEnrollmentDeadline(task);
      if (!deadline) {
        alert("This task has an invalid enrollment deadline.");
        return;
      }

      const today = new Date().toLocaleDateString("en-CA");
      if (event?.targetDate && today !== event.targetDate) {
        if (today < event.targetDate) {
          alert("Enrollment opens on the event date.");
        } else {
          alert("Enrollment deadline has passed for this task.");
        }
        return;
      }

      if (Date.now() > deadline.getTime()) {
        alert("Enrollment deadline has passed for this task.");
        return;
      }
    }

    if (task?.type === "grouped") {
      setGroupModalMode("join");
      setSelectedTaskForGroups(task);
      return;
    }

    // Proceed with direct enrollment
    try {
      setJoiningTaskId(taskId);
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
      const highestOrder = participantsSnap.docs.reduce((maxOrder, participantDoc) => {
        const order = Number(participantDoc.data()?.enrollmentOrder);
        if (Number.isFinite(order) && order > maxOrder) {
          return order;
        }
        return maxOrder;
      }, 0);
      const enrollmentOrder = highestOrder + 1;

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
      setTaskParticipantCounts((prev) => ({
        ...prev,
        [taskId]: participantsSnap.size + 1,
      }));
      setJoiningTaskId(null);
      window.showToast?.("Joined task successfully!", "success");
    } catch (err) {
      console.error("Error enrolling in activity:", err);
      setJoiningTaskId(null);
      window.showToast?.("Failed to join. Please try again.", "error");
    }
  };

  const handleUnjoinActivity = async (taskId, task) => {
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

      const participantsRef = collection(
        db,
        "missions",
        id,
        "task",
        taskId,
        "participants"
      );

      const participantsSnap = await getDocs(participantsRef);
      const participantDocs = participantsSnap.docs;
      const leavingParticipantDoc = participantDocs.find(
        (participantDoc) => participantDoc.id === user.uid,
      );
      const leavingGroupId =
        task?.type === "grouped"
          ? leavingParticipantDoc?.data()?.groupId || null
          : null;
      const userParticipantExists = participantDocs.some(
        (participantDoc) => participantDoc.id === user.uid,
      );

      if (!userParticipantExists) {
        if (task?.type === "grouped") {
          try {
            const groupsSnap = await getDocs(
              collection(db, "missions", id, "task", taskId, "group"),
            );

            for (const groupDoc of groupsSnap.docs) {
              const memberRef = doc(groupDoc.ref, "members", user.uid);
              const memberSnap = await getDoc(memberRef);
              if (!memberSnap.exists()) continue;

              const updateTime = new Date().toISOString();
              await runTransaction(db, async (transaction) => {
                const latestGroupSnap = await transaction.get(groupDoc.ref);
                transaction.delete(memberRef);

                if (latestGroupSnap.exists()) {
                  const currentCount = Number(latestGroupSnap.data()?.memberCount) || 0;
                  transaction.update(groupDoc.ref, {
                    memberCount: Math.max(currentCount - 1, 0),
                    lastUpdated: updateTime,
                  });
                }
              });
              break;
            }
          } catch (groupCleanupError) {
            console.warn("Could not remove stale group membership:", groupCleanupError);
          }
        }

        setEnrolledTasks((prev) => ({
          ...prev,
          [taskId]: false,
        }));
        setTaskParticipantCounts((prev) => ({
          ...prev,
          [taskId]: participantDocs.length,
        }));
        window.showToast?.("Removed from task", "success");
        return;
      }

      const remainingParticipantDocs = participantDocs
        .filter((participantDoc) => participantDoc.id !== user.uid);

      await deleteDoc(participantRef);

      if (task?.type !== "grouped") {
        const sortedRemainingParticipantDocs = [...remainingParticipantDocs].sort(
          compareParticipantsByEnrollment,
        );
        const batch = writeBatch(db);
        let hasReorderUpdates = false;

        sortedRemainingParticipantDocs.forEach((participantDoc, index) => {
          const expectedOrder = index + 1;
          const currentOrder = Number(participantDoc.data()?.enrollmentOrder);
          if (currentOrder !== expectedOrder) {
            batch.update(participantDoc.ref, { enrollmentOrder: expectedOrder });
            hasReorderUpdates = true;
          }
        });

        if (hasReorderUpdates) {
          try {
            await batch.commit();
          } catch (reorderError) {
            console.warn("Task leave succeeded, but participant reindex was skipped:", reorderError);
          }
        }
      }

      // update UI
      setEnrolledTasks((prev) => ({
        ...prev,
        [taskId]: false,
      }));
      setTaskParticipantCounts((prev) => ({
        ...prev,
        [taskId]: remainingParticipantDocs.length,
      }));
      setUserJournals((prev) => prev.filter((j) => j.taskId !== taskId));

      if (task?.type === "grouped" && leavingGroupId) {
        try {
          const groupRef = doc(
            db,
            "missions",
            id,
            "task",
            taskId,
            "group",
            leavingGroupId,
          );
          const memberRef = doc(groupRef, "members", user.uid);
          const updateTime = new Date().toISOString();

          await runTransaction(db, async (transaction) => {
            const [groupSnap, memberSnap] = await Promise.all([
              transaction.get(groupRef),
              transaction.get(memberRef),
            ]);

            if (memberSnap.exists()) {
              transaction.delete(memberRef);
            }

            if (groupSnap.exists() && memberSnap.exists()) {
              const currentCount = Number(groupSnap.data()?.memberCount) || 0;
              transaction.update(groupRef, {
                memberCount: Math.max(currentCount - 1, 0),
                lastUpdated: updateTime,
              });
            }
          });
        } catch (groupLeaveError) {
          console.warn("Left task but failed to clean up group membership:", groupLeaveError);
        }
      }

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
                    color: "#000",
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
                    color: "#000",
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
                        color: "#000",
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
                        color: "#000",
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
                        color: "#000",
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
                        color: "#000",
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
                        color: "#000",
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
                        color: "#000",
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
  // Submit task photo proofs, scan attendance, and answer post-survey
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

  const [volunteerRole, setVolunteerRole] = useState(null);
  const [volunteerMissionRoles, setVolunteerMissionRoles] = useState([]);
  const effectiveVolunteerRoles = volunteerMissionRoles.length > 0
    ? volunteerMissionRoles
    : normalizeMissionRoles(volunteerRole);

  // Is the current user the organizer / proponent of this event?
  const isOrganizerUser = !!event && !!auth.currentUser && (
    event.createdBy === auth.currentUser.uid ||
    effectiveVolunteerRoles.some(r => ["organizer", "lead_organizer"].includes(r))
  );

  const isDonorUser = !!event && !!auth.currentUser && (
    effectiveVolunteerRoles.length === 1 && effectiveVolunteerRoles.includes("donor")
  );

  // Notify organizer once when event has ended and no accomplishment report submitted yet
  useEffect(() => {
    if (!isOrganizerUser) return;
    if (isEditable) return; // event not yet ended
    if (accomplishmentReport) return; // already submitted (any status)
    if (accomplishmentNotifSentRef.current) return;
    const user = auth.currentUser;
    if (!user || !event) return;
    accomplishmentNotifSentRef.current = true;
    // Fire-and-forget: send notification to organizer
    createNotification(user.uid, {
      type: "accomplishment_report_due",
      title: "Accomplishment Report Due",
      message: `The event "${event.title}" has ended. Please submit your ${event.projectType === "ce" ? "CE" : "S-L"} Accomplishment Report.`,
      link: `/event/${id}/activity`,
      missionId: id,
    }).catch(() => {});
  }, [isOrganizerUser, isEditable, accomplishmentReport, event, id]);

  // For donors: once pre-survey is submitted, they're fully complete
  const donorCompletionFiredRef = useRef(false);
  useEffect(() => {
    if (donorCompletionFiredRef.current) return;
    if (!isDonorUser || volunteerProgress?.preSurvey !== 'submitted') return;
    donorCompletionFiredRef.current = true;
    checkAndWriteRequirementsCompleted({
      preSurveyDone: true, consentDone: true, attendanceDone: true, journalDone: true, postSurveyDone: true,
    });
  }, [isDonorUser, volunteerProgress?.preSurvey]); // eslint-disable-line react-hooks/exhaustive-deps

  const [preSurveyData, setPreSurveyData] = useState(null);
  const [preSurveyFullData, setPreSurveyFullData] = useState(null);
  const [consentFileUrl, setConsentFileUrl] = useState(null);
  const [consentReviewStatus, setConsentReviewStatus] = useState("");
  const [showPreSurveyPreview, setShowPreSurveyPreview] = useState(false);
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
          const groupCounts = {};
          await Promise.all(
            tasksData.map(async (task) => {
              if (task.type === "grouped") {
                const groupsSnap = await getDocs(
                  collection(db, "missions", id, "task", task.id, "group"),
                );
                groupCounts[task.id] = groupsSnap.size;

                let groupedCount = 0;
                for (const groupDoc of groupsSnap.docs) {
                  const memberCount = Number(groupDoc.data()?.memberCount);
                  if (Number.isFinite(memberCount)) {
                    groupedCount += memberCount;
                  } else {
                    const membersSnap = await getDocs(collection(groupDoc.ref, "members"));
                    groupedCount += membersSnap.size;
                  }
                }
                counts[task.id] = groupedCount;
                return;
              }

              const participantsSnap = await getDocs(
                collection(db, "missions", id, "task", task.id, "participants"),
              );
              counts[task.id] = participantsSnap.size;
            })
          );
          setTaskParticipantCounts(counts);
          setTaskGroupCounts(groupCounts);

          // Check enrollment status for each task and get volunteer points
          const user = auth.currentUser;
          if (user) {
            // Load existing task enrollment status for this user
            const enrolledMap = {};
            await Promise.allSettled(
              tasksData.map(async (task) => {
                const participantRef = doc(db, "missions", id, "task", task.id, "participants", user.uid);
                const participantSnap = await getDoc(participantRef);
                enrolledMap[task.id] = participantSnap.exists();
              })
            );
            setEnrolledTasks(enrolledMap);

            // Auto-enroll the proponent/organizer (event creator) into the roster
            // so they appear in the leaderboard and volunteer list without manually joining.
            const eventData = eventSnap.data();
            if (eventData.createdBy === user.uid) {
              const proponentVolRef = doc(db, "missions", id, "volunteer", user.uid);
              const proponentVolSnap = await getDoc(proponentVolRef);
              if (!proponentVolSnap.exists()) {
                await setDoc(proponentVolRef, {
                  userId: user.uid,
                  joinedAt: new Date().toISOString(),
                  registrationStatus: "approved",
                  completionStatus: "in_progress",
                  roles: ["organizer"],
                  pointsEarned: 0,
                  progress: {
                    preSurvey: "not_required",
                    consent: "not_required",
                    attendance: "not_checked_in",
                    postSurvey: "not_required",
                  },
                });
                // Keep the reverse-index so chat / profile history loads correctly
                setDoc(doc(db, "userMissions", user.uid, "missions", id), {
                  title: eventData.title || "Untitled Mission",
                  roles: ["organizer"],
                  date: eventData.targetDate || "",
                  joinedAt: serverTimestamp(),
                }).catch(() => {});
              }
            }

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
            let consentStatus = "";
            let progress = {};
            let pointsEarned = 0;
            let loadedVolunteerRoles = [];
            if (volunteerSnap.exists()) {
              const data = volunteerSnap.data();
              progress = data.progress || {};
              pointsEarned = getMissionPointsBreakdown(data).missionPoints;
              loadedVolunteerRoles = normalizeMissionRoles(data.roles?.length > 0 ? data.roles : data.role);
              setVolunteerMissionRoles(loadedVolunteerRoles);
              const requirementBonus = data.requirementBonus || {};
              setRequirementBonusEarned(requirementBonus);

              // Backfill any missing requirement bonuses for already-completed requirements.
              // Guards against old records written before the bonus fields were added.
              const bonusBackfill = {};
              let bonusBackfillPoints = 0;
              if (preSurveySubmitted && !requirementBonus.preSurvey) {
                bonusBackfill['requirementBonus.preSurvey'] = 5;
                bonusBackfillPoints += 5;
              }
              if ((progress.attendance === 'present') && !requirementBonus.attendance) {
                bonusBackfill['requirementBonus.attendance'] = 5;
                bonusBackfillPoints += 5;
              }
              if ((progress.postSurvey === 'submitted') && !requirementBonus.postSurvey) {
                bonusBackfill['requirementBonus.postSurvey'] = 5;
                bonusBackfillPoints += 5;
              }
              if (Object.keys(bonusBackfill).length > 0) {
                try {
                  await updateDoc(volunteerRef, {
                    ...bonusBackfill,
                    requirementPoints: increment(bonusBackfillPoints),
                    missionPoints: increment(bonusBackfillPoints),
                    "pointsBreakdown.requirementPoints": increment(bonusBackfillPoints),
                    "pointsBreakdown.missionPoints": increment(bonusBackfillPoints),
                  });
                  await updateDoc(doc(db, "users", user.uid), { totalPoints: increment(bonusBackfillPoints) });
                  setRequirementBonusEarned(prev => ({
                    ...prev,
                    ...Object.fromEntries(
                      Object.entries(bonusBackfill)
                        .filter(([k]) => k.startsWith('requirementBonus.'))
                        .map(([k, v]) => [k.replace('requirementBonus.', ''), v])
                    ),
                  }));
                } catch (e) {
                  console.warn('Failed to backfill requirement bonuses:', e);
                }
              }

              // Consent backfill: points were already awarded when progress.consent was first set
              // to 'verified', but requirementBonus.consent was never written (historical gap).
              // Only write the volunteer doc field — do not re-award user XP.
              if (progress.consent === 'verified' && !requirementBonus.consent) {
                try {
                  await updateDoc(volunteerRef, requirementPointUpdate("consent"));
                  setRequirementBonusEarned(prev => ({ ...prev, consent: 5 }));
                } catch (e) {
                  console.warn('Failed to backfill consent bonus field:', e);
                }
              }

              const reviewStatus = data.consentSubmission?.reviewStatus || "";
              const hasConsentFile = Boolean(data.consentSubmission?.fileUrl);
              setConsentReviewStatus(reviewStatus);
              if (hasConsentFile) {
                setConsentFileUrl(data.consentSubmission.fileUrl);
              } else {
                setConsentFileUrl(null);
              }

              if (reviewStatus === "approved") {
                consentSubmitted = true;
                consentStatus = "verified";

                // Write progress.consent = 'verified' to Firestore so the leaderboard can read it.
                // Only award the bonus if it was never awarded before (guard via requirementBonus.consent).
                if (data.progress?.consent !== 'verified') {
                  try {
                    const bonusAlreadyAwarded = Boolean(data.requirementBonus?.consent);
                    await updateDoc(volunteerRef, {
                      "progress.consent": "verified",
                      ...(!bonusAlreadyAwarded ? requirementPointUpdate("consent") : {}),
                    });
                    if (!bonusAlreadyAwarded) {
                      await updateDoc(doc(db, "users", user.uid), { totalPoints: increment(5) });
                      setRequirementBonusEarned(prev => ({ ...prev, consent: 5 }));
                    }
                  } catch (e) {
                    console.warn("Failed to update consent verified status:", e);
                  }
                }
              } else if (reviewStatus === "rejected") {
                consentSubmitted = false;
                consentStatus = "rejected";
              } else if (hasConsentFile) {
                consentSubmitted = true;
                consentStatus = "submitted";
              } else {
                consentStatus = progress.consent || "";
              }
            } else {
              setConsentFileUrl(null);
              setConsentReviewStatus("");
              setVolunteerMissionRoles([]);
            }
            setConsentSubmitted(consentSubmitted);

            // Set volunteerProgress state based on Firestore records
            setVolunteerProgress({
              ...progress,
              preSurvey: preSurveySubmitted ? "submitted" : progress.preSurvey,
              consent: consentStatus,
            });
            setTotalPointsEarned(pointsEarned);

            // Fetch accomplishment report (organizer only)
            const isOrganizerUser =
              eventData.createdBy === user.uid ||
              loadedVolunteerRoles.some(r => ["organizer", "lead_organizer"].includes(r));
            if (isOrganizerUser || eventData.createdBy === user.uid) {
              try {
                const arRef = doc(db, "missions", id, "accomplishmentReport", "submission");
                const arSnap = await getDoc(arRef);
                if (arSnap.exists()) {
                  setAccomplishmentReport(arSnap.data());
                } else {
                  setAccomplishmentReport(null);
                }
              } catch (_) {}
            }

            const hadGroupedUpdates = await syncGroupedTaskCompletionForUser(tasksData, user.uid);
            if (hadGroupedUpdates) {
              await fetchUserJournals();
            }
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

  // Real-time listener: update consent status when admin approves or rejects
  useEffect(() => {
    if (!authChecked) return;
    const user = auth.currentUser;
    if (!user) return;

    let isFirstFire = true;
    const volunteerRef = doc(db, "missions", id, "volunteer", user.uid);

    const unsubscribeConsent = onSnapshot(volunteerRef, async (snap) => {
      if (!snap.exists()) return;

      if (isFirstFire) {
        isFirstFire = false;
        return;
      }

      const data = snap.data();
      const reviewStatus = data.consentSubmission?.reviewStatus || "";
      const hasConsentFile = Boolean(data.consentSubmission?.fileUrl);

      setConsentReviewStatus(reviewStatus);
      if (hasConsentFile) setConsentFileUrl(data.consentSubmission.fileUrl);

      let consentStatus = "";
      let consentIsSubmitted = false;

      if (reviewStatus === "approved") {
        consentIsSubmitted = true;
        consentStatus = "verified";

        if (data.progress?.consent !== 'verified') {
          try {
            const bonusAlreadyAwarded = Boolean(data.requirementBonus?.consent);
            await updateDoc(volunteerRef, {
              "progress.consent": "verified",
              ...(!bonusAlreadyAwarded ? requirementPointUpdate("consent") : {}),
            });
            if (!bonusAlreadyAwarded) {
              await updateDoc(doc(db, "users", user.uid), { totalPoints: increment(5) });
              setRequirementBonusEarned(prev => ({ ...prev, consent: 5 }));
              setTotalPointsEarned(prev => prev + 5);
              createNotification(user.uid, {
                type: "points_awarded",
                title: "Points Awarded",
                message: "You received 5 points from completing a mission requirement.",
                link: `/event/${id}/activity`,
              }).catch(() => {});
              window.showToast?.("+5 XP", "success", "You earned XP for your approved consent form.");
            } else {
              window.showToast?.("Your consent form has been approved!", "success");
            }
          } catch (e) {
            console.warn("Failed to award consent approval bonus:", e);
            window.showToast?.("Your consent form has been approved!", "success");
          }
        }
      } else if (reviewStatus === "rejected") {
        consentIsSubmitted = false;
        consentStatus = "rejected";
        window.showToast?.("Your consent form was rejected. Please re-upload.", "error");
      } else if (hasConsentFile) {
        consentIsSubmitted = true;
        consentStatus = "submitted";
      } else {
        consentStatus = data.progress?.consent || "";
      }

      setConsentSubmitted(consentIsSubmitted);
      setVolunteerProgress(prev => prev ? { ...prev, consent: consentStatus } : prev);
    });

    return () => unsubscribeConsent();
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
        const [usersSnap, volunteersSnap, tasksSnap, missionSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "missions", id, "volunteer")),
          getDocs(collection(db, "missions", id, "task")),
          getDoc(doc(db, "missions", id)),
        ]);
        const missionData = missionSnap.data() || {};
        const avgRating = missionData.feedback?.avgRating ?? 0;

        const usersMap = new Map();
        usersSnap.docs.forEach((userDoc) => {
          usersMap.set(userDoc.id, userDoc.data());
        });

        // Compute task points per user directly from participant docs
        const taskPointsMap = new Map();
        await Promise.all(tasksSnap.docs.map(async (taskDoc) => {
          const taskData = taskDoc.data();
          const participantsSnap = await getDocs(
            collection(db, "missions", id, "task", taskDoc.id, "participants")
          );
          if (taskData.type === "grouped") {
            // Grouped: pointsEarned is set on participant doc by syncGroupedTaskCompletionForUser
            participantsSnap.docs.forEach((pDoc) => {
              const pts = Number(pDoc.data().pointsEarned) || 0;
              if (pts > 0) taskPointsMap.set(pDoc.id, (taskPointsMap.get(pDoc.id) || 0) + pts);
            });
          } else {
            // Individual: weighted by enrollment position among all participants
            const sorted = [...participantsSnap.docs].sort((a, b) => {
              const aData = a.data(); const bData = b.data();
              const aOrder = Number(aData?.enrollmentOrder);
              const bOrder = Number(bData?.enrollmentOrder);
              const aHasOrder = Number.isFinite(aOrder) && aOrder > 0;
              const bHasOrder = Number.isFinite(bOrder) && bOrder > 0;
              if (aHasOrder && bHasOrder && aOrder !== bOrder) return aOrder - bOrder;
              if (aHasOrder) return -1;
              if (bHasOrder) return 1;
              const aJoined = String(aData?.joinedAt || "");
              const bJoined = String(bData?.joinedAt || "");
              if (aJoined !== bJoined) return aJoined.localeCompare(bJoined);
              return a.id.localeCompare(b.id);
            });
            sorted.forEach((pDoc, idx) => {
              const pData = pDoc.data();
              const existingPts = Number(pData.pointsEarned) || 0;
              if (existingPts > 0) {
                taskPointsMap.set(pDoc.id, (taskPointsMap.get(pDoc.id) || 0) + existingPts);
              } else if (pData.adminApprovalStatus === "approved") {
                const pos = idx + 1;
                const pts = calculateWeightedTaskPoints(taskData.points || 0, pos, sorted.length);
                taskPointsMap.set(pDoc.id, (taskPointsMap.get(pDoc.id) || 0) + pts);
              }
            });
          }
        }));

        const leaderboardData = volunteersSnap.docs.map((volunteerDoc) => {
          const userId = volunteerDoc.id;
          const userData = usersMap.get(userId) || {};
          const volData = volunteerDoc.data();
          const name =
            userData.username ||
            userData.name ||
            userData.email?.split("@")[0] ||
            "Volunteer";
          const progress = volData.progress || {};
          const progressRequirementPoints =
            (progress.preSurvey === 'submitted' ? 5 : 0) +
            (progress.attendance === 'present' ? 5 : 0) +
            (progress.consent === 'verified' ? 5 : 0) +
            (progress.postSurvey === 'submitted' ? 5 : 0);
          const storedRequirementPoints = getRequirementPoints(volData);
          const requirementPoints = storedRequirementPoints || progressRequirementPoints;
          const taskPoints = Number(volData.taskPoints) || taskPointsMap.get(userId) || 0;
          const roles = volData.roles || (volData.role ? [volData.role] : []);
          const roleRatingPoints = Number(volData.roleRatingPoints) ||
            (volData.releasedAt && roles.length > 0
              ? computeFinalPoints(roles, avgRating, "verified").finalPoints
              : 0);
          const bonusPoints = Number(volData.bonusPoints) || 0;
          const missionPoints = Number(volData.missionPoints) ||
            requirementPoints + taskPoints + roleRatingPoints + bonusPoints;
          return {
            uid: userId,
            name,
            points: missionPoints,
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
              const pointsToAdd = getMissionPointsBreakdown(volunteerDoc.data()).missionPoints;
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
            link: "/student/home",
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
                <span className="player-greeting">Hi, {(userData?.name || userData?.username || '').trim().split(/\s+/)[0] || 'Student'}!</span>
              </div>
              <div className="player-missions">
                <span className="missions-label">Missions Completed</span>
                <span className="missions-count">{completedMissions}</span>
              </div>
              <div className="player-level">
                {(() => { const li = getLevelInfo(userData?.totalPoints); return (<>
                <span className="level-label">Level {li.level}</span>
                <div className="level-bar" role="progressbar" aria-valuenow={li.progress} aria-valuemin={0} aria-valuemax={100}>
                  <div className="level-bar-fill" style={{ width: `${li.progress}%` }}></div>
                </div>
                <span className="level-points">{li.currentPoints}/{li.nextLevelPoints} pts</span>
                </>); })()}
              </div>
            </div>
          </section>
          <LoadingOverlay />
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
  const consentRejected = volunteerProgress?.consent === 'rejected';

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

        {/* PROGRESS STRIP — back | event title | compact progress bar */}
        {(() => {
          const enrolledTaskIds = Object.keys(enrolledTasks).filter(tid => enrolledTasks[tid]);
          const totalItems = isDonorUser ? 1 : (4 + enrolledTaskIds.length);
          let done = 0;
          if (volunteerProgress?.preSurvey === 'submitted') done++;
          if (!isDonorUser) {
            if (volunteerProgress?.consent === 'submitted' || volunteerProgress?.consent === 'verified') done++;
            if (volunteerProgress?.attendance === 'present') done++;
            if (volunteerProgress?.postSurvey === 'submitted') done++;
            enrolledTaskIds.forEach(tid => {
              if (userJournals.some(j => j.taskId === tid && j.adminApprovalStatus === 'approved' && hasTaskProof(j))) done++;
            });
          }
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
                <span className="ea-strip-event-title" title={event.title}>{event.title}</span>
                <div className="ea-strip-progress-bar-wrap">
                  <div className="ea-progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="ea-progress-card__pct">{pct}%</span>
              </div>
            </div>
          );
        })()}

        {/* HORIZONTAL NAVIGATION */}
        <div className="ea-nav-tabs">
          {[
            { id: 'content', label: 'Content' },
            { id: 'requirements', label: 'Requirements' },
            { id: 'leaderboard', label: 'Leaderboard' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`ea-nav-tab${activeNav === tab.id ? ' active' : ''}`}
              onClick={() => setActiveNav(tab.id)}
            >
              {tab.label}
            </button>
          ))}
          <button
            className="ea-nav-unenroll"
            title="Un-enroll from this event"
            onClick={async () => {
              if (!await showConfirm('Are you sure you want to un-enroll from this event? All earned points from this event will be voided.')) return;
              const user = auth.currentUser;
              if (!user) return;
              try {
                // Get volunteer data to calculate total points to void
                const volunteerRef = doc(db, 'missions', id, 'volunteer', user.uid);
                const volunteerSnap = await getDoc(volunteerRef);
                
                let totalPointsToVoid = 0;
                if (volunteerSnap.exists()) {
                  const volunteerData = volunteerSnap.data();
                  totalPointsToVoid = Number(volunteerData.pointsEarned) || 0;
                  
                  // Deduct points from user's total
                  if (totalPointsToVoid > 0) {
                    await updateDoc(doc(db, 'users', user.uid), { 
                      totalPoints: increment(-totalPointsToVoid) 
                    });
                  }
                }
                
                // Delete volunteer enrollment
                await deleteDoc(volunteerRef);
                deleteDoc(doc(db, 'userMissions', user.uid, 'missions', id)).catch(() => {});
                
                // Send notification about voided points
                if (totalPointsToVoid > 0) {
                  createNotification(user.uid, {
                    type: 'points_voided',
                    title: 'Points Voided',
                    message: `You unenrolled from "${event.title}". ${totalPointsToVoid} point${totalPointsToVoid !== 1 ? 's were' : ' was'} removed from your total.`,
                    link: '/student/home',
                    icon: '⚠️',
                  });
                }
                
                navigate('/student/home', { state: { scrollTo: 'missions' } });
              } catch (err) {
                console.error('Failed to un-enroll:', err);
                alert('Failed to un-enroll. Please try again.');
              }
            }}
          >
            <DeleteForeverRoundedIcon sx={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Only the content below slides in/out */}
        <div className={isLeaving ? 'ea-slide-out' : 'ea-slide-in'} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

          {/* SCROLLABLE BODY */}
          <div ref={pullContainerRef} className="ea-scrollable-body" style={{ backgroundImage: `url(${cloudsBg})`, backgroundSize: 'cover', backgroundPosition: 'center top', backgroundRepeat: 'no-repeat', backgroundColor: '#d1efff' }}>
            {(pullY > 0 || isPullRefreshing) && (
              <div className="ptr-indicator" style={{ height: isPullRefreshing ? 60 : pullY }}>
                <div className={`ptr-spinner${pullY >= 80 || isPullRefreshing ? ' ptr-spinner--ready' : ''}`} />
              </div>
            )}
            <div className="event-activity-bg">

              {/* Announcement */}
              {!isEditable && (
                <div className="ea-past-event-banner">
                  This event has already ended. Task joining and attendance are no longer available.
                </div>
              )}

              {/* Always-visible event banner: image with title + description overlay in lower-left */}
              <div className="ea-event-banner">
                <img
                  src={event.img && event.img.trim() !== '' ? event.img : mission1}
                  alt={event.alt || event.title}
                  className="ea-event-banner-img"
                />
                <div className="ea-event-banner-overlay">
                  <h2 className="ea-event-banner-title">{event.title}</h2>
                  {event.description && <p className="ea-event-banner-desc">{event.description}</p>}
                </div>
              </div>

              {/* Tab content area */}
              <div className="ea-tab-content">

                {/* CONTENT TAB */}
                {activeNav === 'content' && (
                  <div className="ea-content-tab">
                    <div className="ea-info-list">
                      {event.location && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">📍</span>
                          <div>
                            <div className="ea-info-label">Location</div>
                            <div className="ea-info-value">{event.location}</div>
                          </div>
                        </div>
                      )}
                      {eventDate && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">📅</span>
                          <div>
                            <div className="ea-info-label">Date &amp; Time</div>
                            <div className="ea-info-value">{formatDate(eventDate)}{event.time ? ` · ${event.time}` : ''}</div>
                          </div>
                        </div>
                      )}
                      {event.projectType && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">🏷️</span>
                          <div>
                            <div className="ea-info-label">Project Type</div>
                            <div className="ea-info-value">{event.projectType === 'sl' ? 'Service Learning' : event.projectType === 'ce' ? 'Community Engagement' : event.projectType}</div>
                          </div>
                        </div>
                      )}
                      {event.volunteerHours && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">⏱️</span>
                          <div>
                            <div className="ea-info-label">Volunteer Hours</div>
                            <div className="ea-info-value">{event.volunteerHours}</div>
                          </div>
                        </div>
                      )}
                      {(event.preparedBy || (Array.isArray(event.proponents) && event.proponents.length > 0)) && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">👤</span>
                          <div>
                            <div className="ea-info-label">Proponent(s)</div>
                            <div className="ea-info-value">
                              {Array.isArray(event.proponents) && event.proponents.length > 0
                                ? event.proponents.join(', ')
                                : event.preparedBy}
                            </div>
                          </div>
                        </div>
                      )}
                      {(event.slFields?.assignedFaculty || event.ceFields?.assignedFaculty) && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">🎓</span>
                          <div>
                            <div className="ea-info-label">Assigned Faculty</div>
                            <div className="ea-info-value">{event.slFields?.assignedFaculty || event.ceFields?.assignedFaculty}</div>
                          </div>
                        </div>
                      )}
                      {(event.partnerSchool || event.beneficiary || event.implementingAgency) && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">🏫</span>
                          <div>
                            <div className="ea-info-label">Partner School / Beneficiary</div>
                            <div className="ea-info-value">{event.partnerSchool || event.beneficiary || event.implementingAgency}</div>
                          </div>
                        </div>
                      )}
                      {event.objectives && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">🎯</span>
                          <div>
                            <div className="ea-info-label">Objectives</div>
                            <div className="ea-info-value" style={{ whiteSpace: 'pre-line' }}>{Array.isArray(event.objectives) ? event.objectives.join('\n') : event.objectives}</div>
                          </div>
                        </div>
                      )}
                      {Array.isArray(event.stakeholders) && event.stakeholders.length > 0 && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">👥</span>
                          <div>
                            <div className="ea-info-label">Stakeholders</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                              {event.stakeholders.map((s, i) => <span key={i} className="mission-tag">{s}</span>)}
                            </div>
                          </div>
                        </div>
                      )}
                      {(event.sdg || event.sdgGoals) && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">🌐</span>
                          <div>
                            <div className="ea-info-label">SDG Goals</div>
                            <div className="ea-info-value">{Array.isArray(event.sdg || event.sdgGoals) ? (event.sdg || event.sdgGoals).join(', ') : (event.sdg || event.sdgGoals)}</div>
                          </div>
                        </div>
                      )}
                      {(event.specificActivities || event.activities) && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">📋</span>
                          <div>
                            <div className="ea-info-label">Specific Activities</div>
                            <div className="ea-info-value">
                              {Array.isArray(event.specificActivities || event.activities)
                                ? (event.specificActivities || event.activities).map((a, i) => (
                                    <span key={i} style={{ display: 'block' }}>{typeof a === 'string' ? a : (a.name || a.title || '')}</span>
                                  ))
                                : (event.specificActivities || event.activities)
                              }
                            </div>
                          </div>
                        </div>
                      )}
                      {volunteerCount !== null && volunteerCount > 0 && (
                        <div className="ea-info-item">
                          <span className="ea-info-icon">👤</span>
                          <div>
                            <div className="ea-info-label">Participants</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              <div className="event-volunteer-stack">
                                {volunteerAvatars.map((src, i) => (
                                  <img key={i} src={src} alt="" className="event-volunteer-avatar" style={{ zIndex: volunteerAvatars.length - i }} />
                                ))}
                                {volunteerCount > 3 && <div className="event-volunteer-extra" style={{ zIndex: 0 }}>+{volunteerCount - 3}</div>}
                              </div>
                              <span className="ea-info-value">{volunteerCount} joined</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* REQUIREMENTS TAB */}
                {activeNav === 'requirements' && (
                  <div className="event-activities-panel">
                    <h3 className="event-activities-title">Requirements</h3>
                    {(() => {
                      const preSurveyDone = volunteerProgress?.preSurvey === 'submitted';
                      const consentDone = volunteerProgress?.consent === 'submitted' || volunteerProgress?.consent === 'verified';
                      const attendanceDone = volunteerProgress?.attendance === 'present';
                      const postSurveyDone = volunteerProgress?.postSurvey === 'submitted';
                      const consentLocked = !preSurveyDone;
                      const attendanceLocked = !consentDone;
                      const enrolledTaskIdsForReq = (tasks || []).filter(t => !!enrolledTasks[t.id]).map(t => t.id);
                      const approvedProofTaskIds = new Set(
                        userJournals
                          .filter(j => j.adminApprovalStatus === 'approved' && hasTaskProof(j))
                          .map(j => j.taskId),
                      );
                      const taskProofDone = approvedProofTaskIds.size > 0;
                      const postLocked = !preSurveyDone || !consentDone || !attendanceDone || !taskProofDone;
                      const preSurveyStep = {
                        label: 'Pre-Activity Survey',
                        desc: !isEditable ? 'Closed after the event date' : 'Fill out before the event',
                        done: preSurveyDone,
                        locked: !isEditable,
                        onOpen: isEditable ? () => setShowPreSurveyModal(true) : null,
                        type: 'survey',
                        previewable: preSurveyDone && !!preSurveyFullData,
                        onPreview: () => setShowPreSurveyPreview(true),
                        points: 5,
                        bonusKey: 'preSurvey',
                      };
                      const steps = isDonorUser ? [preSurveyStep] : [
                        preSurveyStep,
                        {
                          label: 'Parent Consent Form',
                          desc: !isEditable
                            ? 'Closed after the event date'
                            : consentRejected
                              ? 'Previous consent was rejected. Upload a new signed consent form'
                              : 'Upload the signed consent form',
                          done: consentDone,
                          locked: !isEditable || consentLocked,
                          onOpen: isEditable && !consentLocked ? () => setShowConsentModal(true) : null,
                          type: 'upload',
                          previewable: !!consentFileUrl,
                          onPreview: () => window.open(consentFileUrl, '_blank'),
                          points: 5,
                          bonusKey: 'consent',
                        },
                        {
                          label: 'Attendance',
                          desc: !isEditable ? 'Event has ended' : attendanceLocked ? 'Submit parent consent first to unlock' : 'Scan QR code on event day',
                          done: attendanceDone,
                          locked: !isEventDay || !isEditable || attendanceLocked,
                          onOpen: isEventDay && isEditable && !attendanceLocked ? () => setShowQRModal(true) : null,
                          type: 'qr',
                          previewable: false,
                          points: 5,
                          bonusKey: 'attendance',
                        },
                        {
                          label: 'Task Assignment',
                          desc: !attendanceDone ? 'Scan attendance first to unlock' : 'Join tasks and submit approved photo proofs',
                          done: taskProofDone,
                          locked: !attendanceDone,
                          onOpen: attendanceDone ? () => {
                            const wasOpen = showTasksInReq;
                            setShowTasksInReq(prev => !prev);
                            if (wasOpen) {
                              setTimeout(() => postSurveyStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 120);
                            }
                          } : null,
                          type: 'tasks',
                          previewable: false,
                          points: 0,
                          bonusKey: null,
                        },
                        {
                          label: 'Post-Activity Survey',
                          desc: postLocked ? 'Complete and have one task proof approved first' : 'Fill out after completing a task',
                          done: postSurveyDone,
                          locked: postLocked,
                          onOpen: postLocked ? null : () => setShowPostSurveyModal(true),
                          type: 'survey',
                          previewable: false,
                          points: 5,
                          bonusKey: 'postSurvey',
                        },
                        // Step 6 — Accomplishment Report (organizer/proponent only, unlocked after event ends)
                        ...(isOrganizerUser ? [{
                          label: 'Accomplishment Report',
                          desc: isEditable
                            ? 'Unlocks after the event ends'
                            : accomplishmentReport?.status === 'approved'
                              ? 'Report approved by admin'
                              : accomplishmentReport?.status === 'submitted'
                                ? 'Submitted — awaiting admin review'
                                : accomplishmentReport?.status === 'revision_needed'
                                  ? 'Revision required — please resubmit'
                                  : `Submit the ${event?.projectType === 'ce' ? 'CE' : 'S-L'} Accomplishment Report`,
                          done: accomplishmentReport?.status === 'approved',
                          locked: isEditable,
                          onOpen: !isEditable ? () => setShowAccomplishmentModal(true) : null,
                          type: 'accomplishment',
                          previewable: false,
                          points: 0,
                          bonusKey: null,
                        }] : []),
                      ];
                      const activeIndex = steps.findIndex(s => !s.done);
                      return (
                        <>
                        <div className="req-timeline">
                          {steps.map((step, i) => {
                            const isActive = i === activeIndex;
                            const lineTeal = i === activeIndex - 1;
                            return (
                              <React.Fragment key={i}>
                              <div ref={i === steps.length - 1 ? postSurveyStepRef : null} className={`req-timeline-item${step.done ? ' done' : isActive ? ' active' : step.locked ? ' locked' : ''}`} style={step.type === 'tasks' && showTasksInReq ? { alignItems: 'stretch' } : undefined}>
                                <div className="req-timeline-left">
                                  <div className={`req-timeline-dot${isActive ? ' req-timeline-dot--active' : ''}`}>{i + 1}</div>
                                  {i < steps.length - 1 && <div className={`req-timeline-line${lineTeal ? ' req-timeline-line--teal' : ''}`} />}
                                </div>
                                <div className="req-timeline-body">
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                    <span className="req-timeline-label">{step.label}</span>
                                    {step.points > 0 && (
                                      requirementBonusEarned[step.bonusKey] > 0
                                        ? <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>+{step.points} pts earned</span>
                                        : <span style={{ fontSize: 11, fontWeight: 600, color: '#0d9488', background: '#ccfbf1', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap' }}>+{step.points} pts</span>
                                    )}
                                  </div>
                                  <span className="req-timeline-desc">{step.desc}</span>
                                  {step.type === 'tasks' && (
                                    <span style={{ fontSize: 12, color: '#0d9488', fontWeight: 600, marginTop: 2 }}>{approvedProofTaskIds.size} / {enrolledTaskIdsForReq.length} proofs approved</span>
                                  )}
                                </div>
                                <div className="req-timeline-action">
                                  {step.done ? (
                                    step.previewable ? (
                                      <button className="req-view-btn" onClick={step.onPreview}>View</button>
                                    ) : (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {/*<span className="req-done-badge">Done</span>*/}
                                        {step.type === 'qr' && isEventDay && isEditable && (
                                          <button className="req-view-btn" onClick={() => setShowQRModal(true)} title="Scan again to update attendance">Rescan</button>
                                        )}
                                      </span>
                                    )
                                  ) : step.type === 'tasks' ? (
                                    attendanceDone ? (
                                      <button className="req-chevron-btn" onClick={step.onOpen} title={showTasksInReq ? 'Collapse tasks' : 'Expand tasks'}>
                                        {showTasksInReq ? <ExpandLessRoundedIcon sx={{ fontSize: 20 }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 20 }} />}
                                      </button>
                                    ) : null
                                  ) : (
                                    <button
                                      className={`req-action-btn${step.locked ? ' req-action-btn--locked' : ''}`}
                                      disabled={step.locked}
                                      onClick={step.locked ? undefined : step.onOpen}
                                    >
                                      {step.type === 'qr' ? 'Scan' : step.type === 'upload' ? 'Upload' : step.type === 'accomplishment' ? (accomplishmentReport ? 'View / Edit' : 'Submit') : 'Start'}
                                    </button>
                                  )}
                                </div>
                              </div>
                              {step.type === 'tasks' && showTasksInReq && (
                                <div style={{ position: 'relative', paddingTop: 0, paddingBottom: 35 }}>
                                  <div style={{ position: 'absolute', left: 13, top: -4, bottom: 0, width: 2, background: '#e5e7eb', zIndex: 0 }} />
                                <div className="task-list-scroll task-list-scroll--compact" style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 40, position: 'relative', zIndex: 1 }}>
                              {tasks && (() => {
                                const withIdx = tasks.map((t, i) => [t, i]);
                                const joinedList = withIdx.filter(([t]) => !!enrolledTasks[t.id]);
                                const unjoinedList = withIdx.filter(([t]) => !enrolledTasks[t.id]);

                                const renderTaskCard = (activity, idx) => {
                                  const isEnrolled = !!enrolledTasks[activity.id];
                                  const isGrouped = activity.type === 'grouped';
                                  const filledSlots = taskParticipantCounts[activity.id] || 0;
                                  const groupedSlots = taskGroupCounts[activity.id] || 0;
                                  const participantsText = isGrouped ? `${groupedSlots}` : `${filledSlots}`;
                                  const maxSlots = Number.isFinite(Number(activity.maxParticipants)) ? Number(activity.maxParticipants) : null;
                                  const isTaskCapacityFull = !isGrouped && maxSlots !== null && filledSlots >= maxSlots;
                                  const isDeadlineClosed = isEnrollmentClosed(activity);
                                  const journalsForActivity = userJournals.filter(j => j.taskId === activity.id);
                                  const hasSubmittedJournal = journalsForActivity.length > 0;
                                  const selectedPhoto = taskPhotoFiles[idx];
                                  const selectedPhotoPreview = taskPhotoPreviews[idx];
                                  const isUploadingPhoto = uploadingTaskId === activity.id;
                                  const enrollmentCountdown = getEnrollmentCountdown(activity);

                                  const attendanceDoneLocal = volunteerProgress?.attendance === 'present';
                                  if (!isEnrolled && (!isEventDay || !attendanceDoneLocal)) {
                                    return (
                                      <div key={idx} className="task-card task-card--locked">
                                        <span className="task-card__title-only">{activity.title}</span>
                                        {isEventDay && !attendanceDoneLocal && (
                                          <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Scan attendance first to unlock</span>
                                        )}
                                      </div>
                                    );
                                  }

                                  const isExpanded = expandedTasks[activity.id] !== false;
                                  const isEndedEnrolled = !isEditable && isEnrolled;

                                  return (
                                    <div key={idx} className={`task-card${isEnrolled ? ' task-card--enrolled' : ''}${isEndedEnrolled ? ' task-card--ended' : ''}`}>
                                      <div className="task-card__row" style={isEnrolled && !isEndedEnrolled ? { cursor: 'pointer' } : {}} onClick={isEnrolled && !isEndedEnrolled ? () => toggleTaskExpand(activity.id) : undefined}>
                                        <span className="task-card__emoji">{activity.emoji || '🎯'}</span>
                                        <div className="task-card__info">
                                          <span className="task-card__title">{activity.title}</span>
                                          <div className="task-card__meta">
                                            <span className="task-card__pts">{activity.points} PTS</span>
                                            {isEventDay && (
                                              <button
                                                className="task-participants-indicator"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (isGrouped) { setGroupModalMode('view'); setSelectedTaskForGroups(activity); } else { setSelectedTaskForParticipants(activity); }
                                                }}
                                                aria-label={`View ${isGrouped ? 'groups' : 'participants'} for ${activity.title}`}
                                              >
                                                {isGrouped ? 'Groups' : 'Participants'}: {participantsText}
                                              </button>
                                            )}
                                            {enrollmentCountdown && (
                                              <span className={`task-deadline-chip${enrollmentCountdown.isClosed ? ' task-deadline-chip--closed' : ''}`}>
                                                {enrollmentCountdown.label}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <div className="task-card__action">
                                          {isEnrolled ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                              {(() => {
                                                const journalData = userJournals.find(j => j.taskId === activity.id);
                                                const isApprovedProof = journalData?.adminApprovalStatus === 'approved' && hasTaskProof(journalData);
                                                const isDisabled = !isEditable || isApprovedProof;
                                                return (
                                                  <button className="task-enrolled-badge" onClick={(e) => { e.stopPropagation(); handleUnjoinActivity(activity.id, activity); }} disabled={isDisabled} title={isApprovedProof ? "Cannot unjoin - photo proof approved." : undefined}>
                                                    <span className="joined-text">✓ Joined</span><span className="remove-text">✕ Unjoin</span>
                                                  </button>
                                                );
                                              })()}
                                              {!isEndedEnrolled && (
                                                <button className="task-collapse-btn" onClick={(e) => { e.stopPropagation(); toggleTaskExpand(activity.id); }} aria-label={isExpanded ? 'Collapse' : 'Expand'}>
                                                  {isExpanded ? <ExpandLessRoundedIcon sx={{ fontSize: 20 }} /> : <ExpandMoreRoundedIcon sx={{ fontSize: 20 }} />}
                                                </button>
                                              )}
                                            </div>
                                          ) : isTaskCapacityFull ? (
                                            <span className="task-slot-full-badge">Full</span>
                                          ) : isDeadlineClosed ? (
                                            <span className="req-status locked">Closed</span>
                                          ) : !isEditable ? (
                                            <span className="req-status locked">Ended</span>
                                          ) : canJoinActivities ? (
                                            <button className="task-join-btn" onClick={() => handleJoinActivity(activity.id, activity)} disabled={!isEditable || joiningTaskId === activity.id}>
                                              {joiningTaskId === activity.id ? 'Joining…' : 'Join'}
                                            </button>
                                          ) : (
                                            <span className="req-status locked">Closed</span>
                                          )}
                                        </div>
                                      </div>
                                      {isEnrolled && isExpanded && (!isEndedEnrolled || hasSubmittedJournal) && (
                                        <div className="task-journal-section">
                                          {journalsForActivity.map((journal) => (
                                            <div key={journal.id} className="journal-card">
                                              {journal.taskPhoto?.url ? (
                                                <a href={journal.taskPhoto.url} target="_blank" rel="noreferrer" className="task-photo-proof-link">
                                                  <img src={journal.taskPhoto.url} alt={`${activity.title} proof`} className="task-photo-proof-img" />
                                                </a>
                                              ) : (
                                                <div className="journal-text">
                                                  <span className="journal-group-note">Legacy reflection</span>
                                                  <span>{journal.reflection}</span>
                                                </div>
                                              )}
                                            </div>
                                          ))}

                                          {selectedPhotoPreview && (
                                            <div className="journal-card">
                                              <img src={selectedPhotoPreview} alt="Selected proof preview" className="task-photo-proof-img" />
                                              <span className="task-photo-file-name">{selectedPhoto?.name}</span>
                                            </div>
                                          )}

                                          <input
                                            ref={(el) => { cameraInputRefs.current[activity.id] = el; }}
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleTaskPhotoSelect(idx, e.target.files?.[0])}
                                          />
                                          <input
                                            ref={(el) => { uploadInputRefs.current[activity.id] = el; }}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => handleTaskPhotoSelect(idx, e.target.files?.[0])}
                                          />

                                          <div className="journal-submit-row">
                                            {hasSubmittedJournal && (() => {
                                              const j = journalsForActivity[0];
                                              const approvalStatus = j?.adminApprovalStatus;
                                              if (approvalStatus === 'approved') {
                                                return <span className="journal-submitted-badge journal-approved-badge">Approved</span>;
                                              } else if (approvalStatus === 'rejected') {
                                                return <span className="journal-submitted-badge journal-rejected-badge">Rejected</span>;
                                              }
                                              return <span className="journal-submitted-badge">Submitted</span>;
                                            })()}
                                            {hasSubmittedJournal && (() => {
                                              const j = journalsForActivity[0];
                                              const approvalStatus = j?.adminApprovalStatus;
                                              const earned = Number(j?.pointsEarned) || 0;
                                              const estimated = Number(j?.estimatedPoints) || 0;
                                              if (earned > 0) return <span style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', background: '#dcfce7', borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap' }}>+{earned} pts earned</span>;
                                              if (estimated > 0 && approvalStatus !== 'rejected' && approvalStatus !== 'approved') return <span style={{ fontSize: 11, fontWeight: 600, color: '#b45309', background: '#fef3c7', borderRadius: 4, padding: '1px 7px', whiteSpace: 'nowrap' }}>Waiting to be checked</span>;
                                              return null;
                                            })()}
                                            {!isEndedEnrolled && (!hasSubmittedJournal || journalsForActivity[0]?.adminApprovalStatus !== 'approved') && (
                                              <>
                                                <button
                                                  type="button"
                                                  className="journal-reedit-btn"
                                                  disabled={!isHalfwayDone || isUploadingPhoto}
                                                  onClick={() => cameraInputRefs.current[activity.id]?.click()}
                                                  title="Take photo"
                                                >
                                                  <ModeRoundedIcon sx={{ fontSize: 15 }} />
                                                  Take Photo
                                                </button>
                                                <button
                                                  type="button"
                                                  className="journal-reedit-btn journal-reedit-btn--cancel"
                                                  disabled={!isHalfwayDone || isUploadingPhoto}
                                                  onClick={() => uploadInputRefs.current[activity.id]?.click()}
                                                >
                                                  Upload Photo
                                                </button>
                                                <button
                                                  className="activity-submit-button journal-submit-compact"
                                                  disabled={!isHalfwayDone || !selectedPhoto || isUploadingPhoto}
                                                  onClick={() => handleTaskPhotoSubmit(idx, activity)}
                                                >
                                                  {!isHalfwayDone ? 'LOCKED' : isUploadingPhoto ? 'UPLOADING...' : isGrouped ? 'SUBMIT FOR GROUP' : 'SUBMIT'}
                                                </button>
                                                {hasSubmittedJournal && (
                                                  <button onClick={() => handleDeleteJournal(journalsForActivity[0].taskId)} className="journal-edit-icon-btn journal-delete-icon-btn" title={isGrouped ? 'Delete group photo proof' : 'Delete photo proof'}>
                                                    <DeleteRoundedIcon sx={{ fontSize: 15 }} />
                                                  </button>
                                                )}
                                              </>
                                            )}
                                          </div>
                                          {submitStatus[idx] && (
                                            <div className={`submit-status journal-submit-status ${submitStatus[idx].includes('submitted') ? 'submit-status-success' : 'submit-status-error'}`}>{submitStatus[idx]}</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                };

                                if (withIdx.length === 0) {
                                  return (
                                    <div className="ea-empty-state" style={{ padding: '24px 0', textAlign: 'center' }}>
                                      <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>📋</span>
                                      <h4 style={{ color: '#374151', margin: 0 }}>No tasks yet</h4>
                                      <p style={{ color: '#6b7280', margin: '8px 0 0' }}>You can still complete the event requirements while waiting for tasks to be added.</p>
                                    </div>
                                  );
                                }

                                return (
                                  <>
                                    {joinedList.length > 0 && (
                                      <div className="task-section">
                                        <span className="task-section-label">Joined</span>
                                        {joinedList.map(([activity, idx]) => renderTaskCard(activity, idx))}
                                      </div>
                                    )}
                                    {joinedList.length > 0 && unjoinedList.length > 0 && <div className="task-section-divider" />}
                                    {unjoinedList.length > 0 && (
                                      <div className="task-section">
                                        {joinedList.length > 0 && <span className="task-section-label" style={{ paddingTop: 5 }}>Available</span>}
                                        {unjoinedList.map(([activity, idx]) => renderTaskCard(activity, idx))}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                                </div>
                                </div>
                              )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                        {isDonorUser && (
                          <div style={{ marginTop: 14, padding: '10px 14px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 10, fontSize: '0.8rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span>💛</span>
                            <span>As a donor, only the Pre-Activity Survey is required. Other requirements are waived.</span>
                          </div>
                        )}
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* LEADERBOARD TAB */}
                {activeNav === 'leaderboard' && (
                  <div className="event-leaderboard-card">
                    <h3 className="ea-leaderboard-title">Activity Leaderboard</h3>
                    {sortedLeaderboard.length === 0 ? (
                      <p className="ea-leaderboard-empty">No participants yet.</p>
                    ) : (
                      <div className="ea-leaderboard-list" ref={leaderboardListRef}>
                        {sortedLeaderboard.slice(0, sortedLeaderboard.length > 10 ? 10 : 5).map((user, index) => {
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
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { openUserProfile(user.uid); e.preventDefault(); } }}
                            >
                              <span className="ea-rank-num">{rank}</span>
                              {user.avatar
                                ? <img src={user.avatar} alt={user.name} className="ea-rank-avatar" />
                                : <span className="ea-rank-avatar ea-rank-initials">{(user.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                              }
                              <span className="ea-rank-name">{user.name}</span>
                              <span className="ea-rank-pts">{user.points} PTS</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
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
            <div className="ea-qr-modal-body">
              <QRScanner key={scannerKey} onScan={handleQRScan} statusOverride={scanSuccess ? "Attendance Recorded" : undefined} />
              {qrStatus && (
                <div>
                  {!scanSuccess && (
                    <div className="qr-status qr-status-error" style={{ whiteSpace: "pre-line" }}>{qrStatus}</div>
                  )}
                  {scanSuccess && scannedLocation && (
                    <div className="qr-location-details">
                      {scannedLocation.lat.toFixed(6)}, {scannedLocation.lng.toFixed(6)} (±{Math.round(scannedLocation.accuracy)}m)
                      {scannedLocation.name && (
                        <>
                          <br />
                          📍 {scannedLocation.name}
                        </>
                      )}
                    </div>
                  )}
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {scanSuccess && (
                      <button
                        className="ea-retry-btn"
                        style={{ width: '100%' }}
                        onClick={() => {
                          setQRStatus("");
                          setScannedLocation(null);
                          setScanSuccess(false);
                          setScannerKey(k => k + 1);
                        }}
                      >
                        Scan Another
                      </button>
                    )}
                    {!scanSuccess && (
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
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ParticipantModal
        open={!!selectedTaskForParticipants}
        onClose={() => setSelectedTaskForParticipants(null)}
        missionId={id}
        task={selectedTaskForParticipants}
      />

      <GroupModal
        open={!!selectedTaskForGroups}
        onClose={() => setSelectedTaskForGroups(null)}
        missionId={id}
        task={selectedTaskForGroups}
        user={auth.currentUser}
        mode={groupModalMode}
        onGroupSelected={handleGroupedTaskSelection}
      />

      {/* Accomplishment Report Modal */}
      {showAccomplishmentModal && (
        <AccomplishmentReportModal
          missionId={id}
          event={event}
          existingReport={accomplishmentReport}
          onClose={() => setShowAccomplishmentModal(false)}
          onSubmitted={() => {
            // Refresh report status after submission
            getDoc(doc(db, "missions", id, "accomplishmentReport", "submission"))
              .then(snap => snap.exists() && setAccomplishmentReport(snap.data()))
              .catch(() => {});
            setVolunteerProgress(prev => prev ? { ...prev, accomplishmentReport: 'submitted' } : prev);
          }}
        />
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
                initialCollege={userData?.department || ''}
                initialProgram={userData?.program || ''}
                onProgressChange={setSurveyProgress}

                onSubmit={async (form) => {
                  const user = auth.currentUser;
                  if (!user) {
                    alert("You must be logged in.");
                    return;
                  }
                  if (!isEditable) {
                    alert("Pre-Activity Survey submission is closed because this event has ended.");
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
                  const preSurveyIsFirst = volunteerProgress?.preSurvey !== "submitted";
                  const participationArr = Array.isArray(form.participation) ? form.participation : (form.participation ? [form.participation] : []);
                  const normParticipation = participationArr.map(r => r.trim().toLowerCase().replace(/\s+/g, "_"));
                  const primaryParticipationRole =
                    normParticipation.includes("lead_organizer") ? "lead_organizer" :
                    normParticipation.includes("organizer") ? "organizer" :
                    (normParticipation.includes("donor") && !normParticipation.includes("participant")) ? "donor" : null;
                  await updateDoc(
                    doc(db, "missions", id, "volunteer", user.uid),
                    {
                      "progress.preSurvey": "submitted",
                      "progress.consent": "open",
                      ...(preSurveyIsFirst ? requirementPointUpdate("preSurvey") : {}),
                      ...(normParticipation.length > 0 ? { roles: normParticipation, role: deleteField() } : {}),
                    }
                  );
                  if (preSurveyIsFirst) {
                    await updateDoc(doc(db, "users", user.uid), { totalPoints: increment(5) });
                    setTotalPointsEarned(prev => prev + 5);
                    createNotification(user.uid, {
                      type: "points_awarded",
                      title: "Points Awarded",
                      message: "You received 5 points from completing a mission requirement.",
                      link: `/event/${id}/activity`,
                    }).catch(() => {});
                  }
                  if (primaryParticipationRole === "donor") {
                    await checkAndWriteRequirementsCompleted({
                      preSurveyDone: true, consentDone: true, attendanceDone: true, journalDone: true, postSurveyDone: true,
                    });
                  }

                  setVolunteerProgress((prev) => ({
                    ...prev,
                    preSurvey: "submitted",
                    consent: "open"
                  }));
                  setShowPreSurveyModal(false);
                  if (preSurveyIsFirst) {
                    window.showToast?.("+5 XP", "success", "You earned XP for completing the pre-activity survey.");
                  } else {
                    window.showToast?.("Pre-Activity Survey submitted!", "success");
                  }
                  sessionStorage.setItem('ea_activeNav', activeNavRef.current);
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
          <div className="ea-modal-card modal-scrollable" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="ea-modal-header">
              <h3 className="ea-modal-title">📋 Post-Activity Survey</h3>
              <button className="ea-modal-close" onClick={() => setShowPostSurveyModal(false)} aria-label="Close">✕</button>
            </div>

            <PostActivitySurvey
              initialName={userData?.name || ''}
              initialEngagementType={event?.projectType || ""}
              initialTitle={event?.title || ""}
              initialDate={new Date().toISOString().split("T")[0]}
              initialCollege={preSurveyData?.college || ""}
              initialProgram={preSurveyData?.program || ""}
              initialNonAcademicOrg={preSurveyData?.nonAcademicOrg || ""}
              initialLocation={event?.location || ""}

              onSubmit={async (form) => {
                // Mark user as present in Firestore and save survey
                const user = auth.currentUser;
                if (!user) {
                  alert('You must be logged in.');
                  return;
                }
                if (volunteerProgress?.preSurvey !== 'submitted' ||
                    !['submitted', 'verified'].includes(volunteerProgress?.consent) ||
                    volunteerProgress?.attendance !== 'present' ||
                    !(await hasCompletedTask())) {
                  alert('Complete the pre-activity survey, parent consent, attendance, and one approved task before submitting the post-activity survey.');
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
                const postSurveyIsFirst = volunteerProgress?.postSurvey !== "submitted";
                await updateDoc(
                  doc(db, "missions", id, "volunteer", user.uid),
                  {
                    "progress.postSurvey": "submitted",
                    ...(postSurveyIsFirst ? requirementPointUpdate("postSurvey") : {}),
                  }
                );
                if (postSurveyIsFirst) {
                  await updateDoc(doc(db, "users", user.uid), { totalPoints: increment(5) });
                  setTotalPointsEarned(prev => prev + 5);
                  createNotification(user.uid, {
                    type: "points_awarded",
                    title: "Points Awarded",
                    message: "You received 5 points from completing a mission requirement.",
                    link: `/event/${id}/activity`,
                  }).catch(() => {});
                }
                setVolunteerProgress(prev => ({
                  ...prev,
                  postSurvey: "submitted",
                  finalStatus: "completed"
                }));

                setShowPostSurveyModal(false);
                if (postSurveyIsFirst) {
                  window.showToast?.("+5 XP", "success", "You earned XP for completing the post-activity survey.");
                } else {
                  window.showToast?.("Post-Activity Survey submitted!", "success");
                }
                const taskProofDone = await hasCompletedTask();
                await checkAndWriteRequirementsCompleted({
                  preSurveyDone: volunteerProgress?.preSurvey === 'submitted',
                  consentDone: ['submitted', 'verified'].includes(volunteerProgress?.consent),
                  attendanceDone: volunteerProgress?.attendance === 'present',
                  journalDone: taskProofDone,
                  postSurveyDone: true,
                });
                sessionStorage.setItem('ea_activeNav', activeNavRef.current);
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
                    <li>Volunteers without a submitted consent form will <strong>not</strong> be allowed to join the event.</li>
                    <li>Download the form, fill it out, have your parent/guardian sign it, then upload the signed copy below.</li>
                    <li>You will be notified once your consent form has been approved or rejected.</li>
                    <li>If it is rejected, you can upload a new signed copy and it will replace your previous submission for another review.</li>
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
                disabled={!isEditable || !selectedConsentFile || consentSubmitted}
                onClick={handleConsentSubmit}
              >
                {consentReviewStatus === 'rejected' ? 'Resubmit' : 'Submit'}
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
