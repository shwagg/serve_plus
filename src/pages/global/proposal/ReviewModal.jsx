import React, { useState, useContext, useMemo, useEffect } from "react";
import { db, auth } from "../../../firebaseConfig";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { createNotification, notifyUsersByRoles } from "../../../utils/notificationUtils";
import { SessionContext } from "../../../context/SessionContext";
import "./ReviewModal.css";

export default function ReviewModal({ proposal, onClose, onApprovalChange, isPartner }) {

  //prevent modal rendering while session loads
  const { userData: contextUserData } = useContext(SessionContext);
  const [localUserData, setLocalUserData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectComments, setRejectComments] = useState("");
  const [approvalMessage, setApprovalMessage] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [actionSaved, setActionSaved] = useState(false);

  // Use context userData or fetch it directly as fallback
  const userData = contextUserData || localUserData;

  // Fetch user data directly if not available from context
  useEffect(() => {
    const fetchUserData = async () => {
      if (contextUserData) {
        console.log("Using userData from SessionContext");
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.warn("No authenticated user found");
        return;
      }

      try {
        console.log("Fetching userData directly for uid:", currentUser.uid);
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          console.log("ReviewModal - Fetched user data directly:", data);
          setLocalUserData(data);
        } else {
          console.error("User document not found in Firestore for uid:", currentUser.uid);
        }
      } catch (error) {
        console.error("Error fetching user data in ReviewModal:", error);
      }
    };

    fetchUserData();
  }, [contextUserData]);

  if (!proposal) return null;

  const formatDate = (value) => {
    if (!value) return "N/A";
    try {
      if (value && typeof value.toDate === "function") {
        return value.toDate().toLocaleDateString();
      }
      return new Date(value).toLocaleDateString();
    } catch (err) {
      return "N/A";
    }
  };

  const getStatusBadgeClass = (status = "") => {
    const s = status.toLowerCase();
    if (s === "for_approval" || s === "for-approval") return "pending";
    if (s === "draft") return "draft";
    if (s === "pending") return "pending";
    if (s === "published") return "published";
    if (s === "completed") return "completed";
    return "draft";
  };

  const formatStatus = (status) => {
    if (!status || typeof status !== "string") return "Draft";
    const s = status.toLowerCase();
    if (s === "for_approval" || s === "for-approval") return "For Approval";
    if (s === "pending") return "For Approval";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Sequential approval enforcement
  // Normalize role and position
  const role = userData?.role || userData?.userRole || userData?.Role || "";
  const positionField = userData?.position || userData?.positions || userData?.Position || userData?.Positions || "";
  const userPositions = Array.isArray(positionField) ? positionField : positionField ? [positionField] : [];
  const normalizedPositions = userPositions.map(p => String(p).toLowerCase().trim().replace(/\s+/g, " ")).filter(p => p.length > 0);

  function getApprovalLevel() {
    if (role.toLowerCase() === "faculty") {
      if (normalizedPositions.includes("program chair")) return "reviewedBy";
      // Allow both 'college dean' and 'cluster head' for recommendedBy
      if (normalizedPositions.includes("college dean") || normalizedPositions.includes("cluster head")) return "recommendedBy";
    }
    if (role.toLowerCase() === "admin") {
      if (normalizedPositions.includes("regular")) return "endorsedBy";
      if (normalizedPositions.includes("director")) return "approvedBy";
    }
    return null;
  }
  const approvalLevel = useMemo(() => getApprovalLevel(), [userData, proposal?.projectType, proposal?.id]);

  // Only allow approval if previous steps are completed
  function canApproveSequential() {
    if (!approvalLevel || !proposal) return false;
    if (approvalLevel === "reviewedBy") {
      return !proposal.reviewedBy && !proposal.recommendedBy && !proposal.endorsedBy && !proposal.approvedBy;
    }
    if (approvalLevel === "recommendedBy") {
      return typeof proposal.reviewedBy === "string" && proposal.reviewedBy.trim() !== "" && (!proposal.recommendedBy || proposal.recommendedBy.trim() === "") && (!proposal.endorsedBy || proposal.endorsedBy.trim() === "") && (!proposal.approvedBy || proposal.approvedBy.trim() === "");
    }
    if (approvalLevel === "endorsedBy") {
      return typeof proposal.reviewedBy === "string" && proposal.reviewedBy.trim() !== "" && typeof proposal.recommendedBy === "string" && proposal.recommendedBy.trim() !== "" && (!proposal.endorsedBy || proposal.endorsedBy.trim() === "") && (!proposal.approvedBy || proposal.approvedBy.trim() === "");
    }
    if (approvalLevel === "approvedBy") {
      return typeof proposal.reviewedBy === "string" && proposal.reviewedBy.trim() !== "" && typeof proposal.recommendedBy === "string" && proposal.recommendedBy.trim() !== "" && typeof proposal.endorsedBy === "string" && proposal.endorsedBy.trim() !== "" && (!proposal.approvedBy || proposal.approvedBy.trim() === "");
    }
    return false;
  }

  // Debug logs for troubleshooting
  console.log("[DEBUG][ReviewModal] userData:", userData);
  console.log("[DEBUG][ReviewModal] normalizedPositions:", normalizedPositions);
  console.log("[DEBUG][ReviewModal] approvalLevel:", approvalLevel);
  console.log("[DEBUG][ReviewModal] canApproveSequential:", canApproveSequential());
  console.log("[DEBUG][ReviewModal] proposal:", proposal);

  // Check if this approval field has already been filled
  const isAlreadyApproved = () => {
    if (!approvalLevel) return false;
    
    const fieldValue = proposal[approvalLevel];
    const approved = fieldValue && typeof fieldValue === "string" && fieldValue.trim() !== "";
    console.log(`Checking if already approved for ${approvalLevel}:`, {fieldValue, approved});
    return approved;
  };

  // Handle approve action
  const handleApprove = async () => {
    if (!approvalLevel) {
      setApprovalMessage("Unable to determine approval level.");
      return;
    }

    setIsSubmitting(true);
    try {
      const proposalRef = doc(db, "missions", proposal.id);
      let updateData = {
        [approvalLevel]: userData.name || userData.email,
        lastApprovedAt: serverTimestamp(),
        lastApprovedBy: approvalLevel,
      };

      // Check how many approval fields are currently filled (before this approval)
      const currentApprovalCount = [
        proposal.reviewedBy,
        proposal.recommendedBy,
        proposal.endorsedBy,
        proposal.approvedBy
      ].filter(field => field && typeof field === "string" && field.trim() !== "").length;

      // Check if all approval fields will be filled after this approval
      const currentProposal = {
        ...proposal,
        [approvalLevel]: userData.name || userData.email
      };

      const allApprovalsFilled = 
        currentProposal.reviewedBy && 
        currentProposal.recommendedBy && 
        currentProposal.endorsedBy && 
        currentProposal.approvedBy;

      // Determine the new status based on approval progress
      if (allApprovalsFilled) {
        // All approvals complete → draft
        updateData.status = "draft";
        setApprovalMessage("Proposal fully approved! All signatures collected. Status updated to Draft for admin review.");
      } else if (currentApprovalCount === 0) {
        // First approval (transitioning from for_approval) → pending
        updateData.status = "pending";
        setApprovalMessage(`First approval recorded! Status updated to Pending. Waiting for remaining approvals.`);
      } else {
        // Subsequent approvals → keep as pending
        updateData.status = "pending";
        setApprovalMessage(`Approval recorded! Waiting for remaining approvals.`);
      }

      await updateDoc(proposalRef, updateData);

      // Confirm approval immediately so the UI updates without waiting for notifications
      setActionSaved(true);
      if (onApprovalChange) {
        onApprovalChange();
      }
      setTimeout(() => {
        onClose();
      }, 1500);

      // Send notifications in background — don't await so they don't block the UI
      const nextStatus = updateData.status || proposal.status || "pending";
      const statusLabel = formatStatus(nextStatus);
      const notifData = {
        type: "proposal_status",
        title: "Proposal Status Updated",
        message: `"${proposal.title || "Untitled"}" is now ${statusLabel}.`,
        link: "/global/review-proposals",
        proposalId: proposal.id,
      };
      Promise.allSettled([
        proposal.createdBy
          ? createNotification(proposal.createdBy, {
              ...notifData,
              message: `Your proposal "${proposal.title || "Untitled"}" is now ${statusLabel}.`,
            })
          : Promise.resolve(),
        notifyUsersByRoles(["admin", "faculty"], notifData),
      ]).catch((err) => console.error("Error sending proposal status notifications:", err));
    } catch (error) {
      console.error("Error approving proposal:", error);
      setApprovalMessage("Error approving proposal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reject action
  const handleReject = async () => {
    if (!approvalLevel) {
      setApprovalMessage("Unable to determine approval level.");
      return;
    }

    if (!rejectComments.trim()) {
      setApprovalMessage("Please provide comments for rejection.");
      return;
    }

    setIsSubmitting(true);
    try {
      const proposalRef = doc(db, "missions", proposal.id);
      const updateData = {
        status: "for_approval",
        rejectionReason: rejectComments,
        rejectedBy: approvalLevel,
        rejectedAt: serverTimestamp(),
        rejectedByUser: userData.name || userData.email,
        // Clear all approval fields when rejected
        reviewedBy: "",
        recommendedBy: "",
        endorsedBy: "",
        approvedBy: "",
      };
      setApprovalMessage("Proposal rejected. All approvals cleared and returned to For Approval for resubmission.");

      await updateDoc(proposalRef, updateData);

      // Confirm rejection immediately so the UI updates without waiting for notifications
      setActionSaved(true);
      if (onApprovalChange) {
        onApprovalChange();
      }
      setTimeout(() => {
        onClose();
      }, 1500);

      // Send notifications in background
      const statusLabel = formatStatus(updateData.status);
      const notifData = {
        type: "proposal_status",
        title: "Proposal Status Updated",
        message: `"${proposal.title || "Untitled"}" is now ${statusLabel}.`,
        link: "/global/review-proposals",
        proposalId: proposal.id,
      };
      Promise.allSettled([
        proposal.createdBy
          ? createNotification(proposal.createdBy, {
              ...notifData,
              message: `Your proposal "${proposal.title || "Untitled"}" is now ${statusLabel}.`,
            })
          : Promise.resolve(),
        notifyUsersByRoles(["admin", "faculty"], notifData),
      ]).catch((err) => console.error("Error sending proposal status notifications:", err));
    } catch (error) {
      console.error("Error rejecting proposal:", error);
      setApprovalMessage("Error rejecting proposal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-title-group">
            <h2>Proposal Summary</h2>
          </div>
          <button className="modal-close" onClick={onClose}>&&#10;</button>
        </div>
        
        <div className="modal-body">
          {/* Basic Information */}
          <div className="modal-section">
            <h3>Basic Information</h3>
            <div className="field-group">
              <label>Title:</label>
              <p>{proposal.title || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Project Type:</label>
              <p>{proposal.projectType === "sl" ? "Service Learning" : proposal.projectType === "ce" ? "Community Engagement" : "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Status:</label>
              <p>
                <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                  {formatStatus(proposal.status) || "Draft"}
                </span>
              </p>
            </div>
            <div className="field-group">
              <label>Date Proposed:</label>
              <p>{formatDate(proposal.dateProposed)}</p>
            </div>
            <div className="field-group">
              <label>Target Date:</label>
              <p>{proposal.targetDate || "N/A"}</p>
            </div>
          </div>

          {/* SDGs */}
          {proposal.sdg && proposal.sdg.length > 0 && (
            <div className="modal-section">
              <h3>Sustainable Development Goals</h3>
              <div className="field-group">
                <div className="sdg-list">
                  {proposal.sdg.map((sdg, idx) => (
                    <span key={idx} className="sdg-badge">SDG {sdg}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Project Details */}
          <div className="modal-section">
            <h3>Project Details</h3>
            <div className="field-group">
              <label>Stakeholders:</label>
              <p>{proposal.stakeholders || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Location:</label>
              <p>{proposal.location || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Volunteer Hours:</label>
              <p>{proposal.volunteerHours || "N/A"}</p>
            </div>
          </div>

          {/* Proponents */}
          {proposal.proponents && proposal.proponents.length > 0 && (
            <div className="modal-section">
              <h3>Proponents</h3>
              <div className="field-group">
                <ul className="proponents-list">
                  {proposal.proponents.map((proponent, idx) => (
                    <li key={idx}>{proponent}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Description & Objectives */}
          <div className="modal-section">
            <h3>Description & Objectives</h3>
            <div className="field-group">
              <label>Student Outcomes:</label>
              <p>{proposal.studentOutcomes || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Description:</label>
              <p>{proposal.description || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Objectives:</label>
              <p>{proposal.objectives || "N/A"}</p>
            </div>
          </div>

          {/* Specific Activities */}
          {proposal.specificActivities && proposal.specificActivities.length > 0 && (
            <div className="modal-section">
              <h3>Specific Activities</h3>
              <div className="field-group">
                <ul className="activities-list">
                  {proposal.specificActivities.map((activity, idx) => (
                    <li key={idx}>{activity}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Success Indicators */}
          {proposal.successIndicators && proposal.successIndicators.length > 0 && (
            <div className="modal-section">
              <h3>Success Indicators</h3>
              <div className="field-group">
                <ul className="indicators-list">
                  {proposal.successIndicators.map((indicator, idx) => (
                    <li key={idx}>{indicator}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Budget */}
          <div className="modal-section">
            <h3>Budget</h3>
            <div className="field-group">
              <p>{proposal.budget || "N/A"}</p>
            </div>
          </div>

          {/* Service Learning Fields */}
          {proposal.projectType === "sl" && proposal.slFields && (
            <div className="modal-section">
              <h3>Service Learning Details</h3>
              <div className="field-group">
                <label>Section:</label>
                <p>{proposal.slFields.section || "N/A"}</p>
              </div>
              <div className="field-group">
                <label>Course:</label>
                <p>{proposal.slFields.course || "N/A"}</p>
              </div>
              <div className="field-group">
                <label>Course Code:</label>
                <p>{proposal.slFields.courseCode || "N/A"}</p>
              </div>
            </div>
          )}

          {/* Community Engagement Fields */}
          {proposal.projectType === "ce" && proposal.ceFields && (
            <div className="modal-section">
              <h3>Community Engagement Details</h3>
              <div className="field-group">
                <label>Nature:</label>
                <p>{proposal.ceFields.nature || "N/A"}</p>
              </div>
              <div className="field-group">
                <label>Learning Outcomes:</label>
                <p>{proposal.ceFields.learningOutcomes || "N/A"}</p>
              </div>
              {proposal.ceFields.customLearningOutcome && (
                <div className="field-group">
                  <label>Custom Learning Outcome:</label>
                  <p>{proposal.ceFields.customLearningOutcome}</p>
                </div>
              )}
              <div className="field-group">
                <label>Affiliation:</label>
                <p>{proposal.ceFields.affiliation || "N/A"}</p>
              </div>
            </div>
          )}

          {/* Approval Chain */}
          <div className="modal-section">
            <h3>Approval Chain</h3>
            <div className="field-group">
              <label>Prepared By:</label>
              <p>{proposal.preparedBy || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Reviewed By:</label>
              <p>{proposal.reviewedBy || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Recommended By:</label>
              <p>{proposal.recommendedBy || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Endorsed By:</label>
              <p>{proposal.endorsedBy || "N/A"}</p>
            </div>
            <div className="field-group">
              <label>Approved By:</label>
              <p>{proposal.approvedBy || "N/A"}</p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          {approvalMessage && (
            <div className="approval-message">
              {approvalMessage}
            </div>
          )}

          {!actionSaved && (
            <div className="rejection-form">
              <label>Comments for rejection (required if rejecting):</label>
              <textarea
                className="rejection-textarea"
                placeholder="Please provide your comments for rejection..."
                value={rejectComments}
                onChange={(e) => setRejectComments(e.target.value)}
                rows="3"
                disabled={isSubmitting || !approvalLevel || !canApproveSequential()}
              />
            </div>
          )}

          <div className="modal-actions">
            {/* Partners see only Close button, no approve/reject */}
            {isPartner ? (
              <button className="btn-close" onClick={onClose}>
                Close
              </button>
            ) : !actionSaved ? (
              <>
                <button
                  className="btn-approve"
                  onClick={handleApprove}
                  disabled={isSubmitting || !approvalLevel || isAlreadyApproved() || !canApproveSequential()}
                  title={`Approval Level: ${approvalLevel || 'None'} ${isAlreadyApproved() ? '(Already approved)' : ''} ${!canApproveSequential() ? '(Not your turn)' : ''}`}
                >
                  {isSubmitting ? "Approving..." : "Approve"}
                </button>
                <button
                  className="btn-reject"
                  onClick={handleReject}
                  disabled={isSubmitting || !approvalLevel || isAlreadyApproved() || !canApproveSequential()}
                  title={`Approval Level: ${approvalLevel || 'None'} ${isAlreadyApproved() ? '(Already approved)' : ''} ${!canApproveSequential() ? '(Not your turn)' : ''}`}
                >
                  {isSubmitting ? "Rejecting..." : "Reject"}
                </button>
              </>
            ) : (
              <button className="btn-close" onClick={onClose}>
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
