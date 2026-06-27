import React, { useState, useContext, useMemo, useEffect } from "react";
import ProposalTimeline from "../../../components/ProposalTimeline";
import { db, auth } from "../../../firebaseConfig";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { createNotification, notifyUsersByRoles } from "../../../utils/notificationUtils";
import { showConfirm } from "../../../utils/toast";
import { SessionContext } from "../../../context/sessionContextCore";
import { exportProposalPDF } from "../exportProposalPDF";
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
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);

  const sdgNumberToLabel = {
    1: 'No Poverty', 2: 'Zero Hunger', 3: 'Good Health and Well-Being',
    4: 'Quality Education', 5: 'Gender Equality', 6: 'Clean Water and Sanitation',
    7: 'Affordable and Clean Energy', 8: 'Decent Work and Economic Growth',
    9: 'Industry Innovation and Infrastructure', 10: 'Reduced Inequalities',
    11: 'Sustainable Cities and Communities', 12: 'Responsible Consumption and Production',
    13: 'Climate Action', 14: 'Life Below Water', 15: 'Life on Land',
    16: 'Peace, Justice and Strong Institutions', 17: 'Partnership for the Goals',
  };

  // Build export data from the live Firestore proposal document
  const buildExportDataFromProposal = () => {
    const proponentStr = Array.isArray(proposal.proponents)
      ? proposal.proponents.join(', ')
      : (proposal.preparedBy || '');
    const sdgLabels = (proposal.sdgs || []).map(num => sdgNumberToLabel[num] || String(num));
    const activitiesStr = Array.isArray(proposal.specificActivities)
      ? proposal.specificActivities.join('\n')
      : (proposal.specificActivities || '');
    const successStr = Array.isArray(proposal.successIndicators)
      ? proposal.successIndicators.join('\n')
      : (proposal.successIndicators || '');
    const stakeholdersStr = Array.isArray(proposal.stakeholders)
      ? proposal.stakeholders.join(', ')
      : (proposal.stakeholders || '');

    if (proposal.projectType === 'sl') {
      return {
        projectType: 'service-learning',
        formData: {
          proposalTitle: proposal.title || '',
          dateProposed: proposal.dateProposed || proposal.targetDate || '',
          participatingSections: proposal.slFields?.section || '',
          proponent: proponentStr,
          courseTitle: proposal.slFields?.course || '',
          courseCode: proposal.slFields?.courseCode || '',
          targetDates: proposal.targetDate || '',
          targetLocation: proposal.location || '',
          sdgs: sdgLabels,
          proposalDescription: proposal.description || '',
          proposalObjectives: proposal.objectives || '',
          specificActivities: activitiesStr,
          successIndicators: successStr,
          budget: proposal.budget || '',
          stakeholders: stakeholdersStr,
          volunteerHours: proposal.volunteerHours || '',
          preparedBy: proposal.preparedBy || '',
          reviewedBy: proposal.reviewedBy || '',
          recommendedBy: proposal.recommendedBy || '',
          endorsedBy: proposal.endorsedBy || '',
          approvedBy: proposal.approvedBy || '',
        },
        slFields: {
          section: proposal.slFields?.section || '',
          course: proposal.slFields?.course || '',
          courseCode: proposal.slFields?.courseCode || '',
          assignedFaculty: proposal.slFields?.assignedFaculty || '',
        },
        ceFields: {},
      };
    }
    // Community Engagement
    const ceLOKeyMap = {
      '0': 'intellectual development', '1': 'collaboration',
      '2': 'appreciation of culture and diversity', '3': 'career exploration',
      '4': 'socio-civic responsibility', '5': 'others',
    };
    const lo = proposal.ceFields?.learningOutcomes;
    const loArr = lo !== undefined && lo !== null
      ? [ceLOKeyMap[String(lo)] || String(lo).toLowerCase().trim()]
      : [];
    return {
      projectType: 'community-engagement',
      formData: {
        communityEngagementTitle: proposal.title || '',
        dateProposed: proposal.dateProposed || proposal.targetDate || '',
        proponent: proponentStr,
        studentOutcomes: proposal.studentOutcomes || '',
        sdgs: sdgLabels,
        natureOfEngagement: proposal.ceFields?.nature ? [proposal.ceFields.nature] : [],
        learningOutcomes: loArr,
        targetDate: proposal.targetDate || '',
        location: proposal.location || '',
        stakeholders: stakeholdersStr,
        numberOfVolunteerHours: proposal.volunteerHours || '',
        ceDescription: proposal.description || '',
        ceObjectives: proposal.objectives || '',
        specificActivities: activitiesStr,
        successIndicators: successStr,
        budget: proposal.budget || '',
        preparedBy: proposal.preparedBy || '',
        reviewedBy: proposal.reviewedBy || '',
        recommendedBy: proposal.recommendedBy || '',
        endorsedBy: proposal.endorsedBy || '',
        approvedBy: proposal.approvedBy || '',
      },
      slFields: {},
      ceFields: proposal.ceFields || {},
    };
  };

  // Regenerate PDF preview whenever any approval field changes
  useEffect(() => {
    if (!proposal?.id) return;
    let cancelled = false;
    const generate = async () => {
      setPdfPreviewLoading(true);
      try {
        const { projectType: pt, formData, slFields, ceFields } = buildExportDataFromProposal();
        const url = await exportProposalPDF({ projectType: pt, formData, slFields, ceFields, sdgOptions: [], returnUrl: true });
        if (!cancelled) setPdfPreviewUrl(url);
      } catch (e) {
        if (!cancelled) setPdfPreviewUrl('');
      } finally {
        if (!cancelled) setPdfPreviewLoading(false);
      }
    };
    generate();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.id, proposal.reviewedBy, proposal.recommendedBy, proposal.endorsedBy, proposal.approvedBy]);

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
    if (s === "rejected") return "rejected";
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
    if (s === "draft") return "Ready for Publishing";
    if (s === "rejected") return "Returned for Revision";
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
    const status = String(proposal.status || "").toLowerCase();
    if (!["for_approval", "for-approval", "pending"].includes(status)) return false;
    const approverName = userData?.name || "";
    if (approvalLevel === "reviewedBy") {
      // Guard: only the designated Program Chair may approve
      const designated = proposal.selectedReviewedBy || "";
      if (designated && approverName && designated !== approverName) return false;
      return !proposal.reviewedBy && !proposal.recommendedBy && !proposal.endorsedBy && !proposal.approvedBy;
    }
    if (approvalLevel === "recommendedBy") {
      // Guard: only the designated College Dean may approve
      const designated = proposal.selectedRecommendedBy || "";
      if (designated && approverName && designated !== approverName) return false;
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

    const confirmed = await showConfirm(
      "Confirm this approval? The proponent can no longer edit after the first signatory approval."
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const proposalRef = doc(db, "missions", proposal.id);
      const approverName = userData.name || userData.email;
      let updateData = {
        [approvalLevel]: approverName,
        lastApprovedAt: serverTimestamp(),
        lastApprovedBy: approvalLevel,
        // Track per-step approval details without overwriting approvals.faculty / approvals.partner
        [`approvals.${approvalLevel}.approved`]: true,
        [`approvals.${approvalLevel}.decidedAt`]: serverTimestamp(),
        [`approvals.${approvalLevel}.name`]: approverName,
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
      setApprovalMessage("A rejection reason is required so the proponent knows what to revise before resubmitting.");
      return;
    }

    const confirmed = await showConfirm(
      "Return this proposal for revision? Your reason will be sent to the proponent."
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      const proposalRef = doc(db, "missions", proposal.id);
      const rejectorName = userData.name || userData.email;
      const updateData = {
        status: "rejected",
        rejectionReason: rejectComments,
        rejectedBy: approvalLevel,
        rejectedAt: serverTimestamp(),
        rejectedByUser: rejectorName,
        // Clear signatory name strings
        reviewedBy: "",
        recommendedBy: "",
        endorsedBy: "",
        approvedBy: "",
        // Clear all per-step signatory approvals (preserve approvals.faculty / approvals.partner)
        "approvals.reviewedBy": null,
        "approvals.recommendedBy": null,
        "approvals.endorsedBy": null,
        "approvals.approvedBy": null,
      };
      setApprovalMessage("Proposal returned for revision. The proponent can use your reason to revise and resubmit it.");

      await updateDoc(proposalRef, updateData);

      // Confirm rejection immediately so the UI updates without waiting for notifications
      setActionSaved(true);
      if (onApprovalChange) {
        onApprovalChange();
      }
      setTimeout(() => {
        onClose();
      }, 1500);

      // Send rejection notification to the proponent in background.
      const notifData = {
        type: "proposal_rejected",
        title: "Proposal Rejected",
        message: `${rejectorName || "An approver"} rejected your proposal "${proposal.title || "Untitled"}": ${rejectComments.trim()} You can edit and resubmit it.`,
        link: "/student",
        proposalId: proposal.id,
      };
      Promise.allSettled([
        proposal.createdBy
          ? createNotification(proposal.createdBy, notifData)
          : Promise.resolve(),
      ]).catch((err) => console.error("Error sending proposal status notifications:", err));
    } catch (error) {
      console.error("Error rejecting proposal:", error);
      setApprovalMessage("Error rejecting proposal. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const typeLabel = proposal.projectType === "sl"
    ? "Service Learning"
    : proposal.projectType === "ce"
    ? "Community Engagement"
    : proposal.projectType || "Proposal";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="rm-header">
          <div className="rm-header-left">
            <span className="rm-type-chip">{typeLabel}</span>
            <h2 className="rm-title">{proposal.title || "Untitled Proposal"}</h2>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* ── Two-column body ── */}
        <div className="rm-body">

          {/* Left: scrollable proposal details */}
          <div className="rm-left">

            {/* Meta row */}
            <div className="rm-meta-row">
              <span className={`status-badge ${getStatusBadgeClass(proposal.status)}`}>
                {formatStatus(proposal.status)}
              </span>
              {proposal.targetDate && (
                <span className="rm-meta-item">📅 {proposal.targetDate}</span>
              )}
              {proposal.dateProposed && (
                <span className="rm-meta-item">Submitted {formatDate(proposal.dateProposed)}</span>
              )}
              {proposal.preparedBy && (
                <span className="rm-meta-item">By {proposal.preparedBy}</span>
              )}
            </div>

            {/* SDGs */}
            {proposal.sdg && proposal.sdg.length > 0 && (
              <div className="modal-section">
                <h3>SDGs</h3>
                <div className="sdg-list">
                  {proposal.sdg.map((sdg, idx) => (
                    <span key={idx} className="sdg-badge">SDG {sdg}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Project Details */}
            <div className="modal-section">
              <h3>Project Details</h3>
              <div className="field-group">
                <label>Location</label>
                <p>{proposal.location || "N/A"}</p>
              </div>
              <div className="field-group">
                <label>Stakeholders</label>
                <p>{proposal.stakeholders || "N/A"}</p>
              </div>
              <div className="field-group">
                <label>Volunteer Hours</label>
                <p>{proposal.volunteerHours || "N/A"}</p>
              </div>
            </div>

            {/* Proponents */}
            {proposal.proponents && proposal.proponents.length > 0 && (
              <div className="modal-section">
                <h3>Proponents</h3>
                <ul className="proponents-list">
                  {proposal.proponents.map((p, idx) => <li key={idx}>{p}</li>)}
                </ul>
              </div>
            )}

            {/* Description */}
            <div className="modal-section">
              <h3>Description & Objectives</h3>
              {proposal.studentOutcomes && (
                <div className="field-group">
                  <label>Student Outcomes</label>
                  <p>{proposal.studentOutcomes}</p>
                </div>
              )}
              <div className="field-group">
                <label>Description</label>
                <p>{proposal.description || "N/A"}</p>
              </div>
              <div className="field-group">
                <label>Objectives</label>
                <p>{proposal.objectives || "N/A"}</p>
              </div>
            </div>

            {/* Specific Activities */}
            {proposal.specificActivities && proposal.specificActivities.length > 0 && (
              <div className="modal-section">
                <h3>Specific Activities</h3>
                <ul className="activities-list">
                  {proposal.specificActivities.map((a, idx) => <li key={idx}>{a}</li>)}
                </ul>
              </div>
            )}

            {/* Success Indicators */}
            {proposal.successIndicators && proposal.successIndicators.length > 0 && (
              <div className="modal-section">
                <h3>Success Indicators</h3>
                <ul className="indicators-list">
                  {proposal.successIndicators.map((s, idx) => <li key={idx}>{s}</li>)}
                </ul>
              </div>
            )}

            {/* Budget */}
            <div className="modal-section">
              <h3>Budget</h3>
              <p>{proposal.budget || "N/A"}</p>
            </div>

            {/* SL Fields */}
            {proposal.projectType === "sl" && proposal.slFields && (
              <div className="modal-section">
                <h3>Service Learning Details</h3>
                <div className="field-group"><label>Section</label><p>{proposal.slFields.section || "N/A"}</p></div>
                <div className="field-group"><label>Course</label><p>{proposal.slFields.course || "N/A"}</p></div>
                <div className="field-group"><label>Course Code</label><p>{proposal.slFields.courseCode || "N/A"}</p></div>
              </div>
            )}

            {/* CE Fields */}
            {proposal.projectType === "ce" && proposal.ceFields && (
              <div className="modal-section">
                <h3>Community Engagement Details</h3>
                <div className="field-group"><label>Nature</label><p>{proposal.ceFields.nature || "N/A"}</p></div>
                <div className="field-group"><label>Learning Outcomes</label><p>{proposal.ceFields.learningOutcomes || "N/A"}</p></div>
                {proposal.ceFields.customLearningOutcome && (
                  <div className="field-group"><label>Custom Learning Outcome</label><p>{proposal.ceFields.customLearningOutcome}</p></div>
                )}
                <div className="field-group"><label>Affiliation</label><p>{proposal.ceFields.affiliation || "N/A"}</p></div>
              </div>
            )}
          </div>

          {/* Right: sticky action panel */}
          <div className="rm-right">

            {/* Proposal Form Preview */}
            <div className="rm-panel-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="rm-panel-label" style={{ margin: 0 }}>Proposal Form Preview</div>
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(v => !v)}
                  style={{
                    fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px',
                    borderRadius: 6, border: '1.5px solid #0d9488',
                    background: showPdfPreview ? '#0d9488' : '#fff',
                    color: showPdfPreview ? '#fff' : '#0d9488',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {showPdfPreview ? 'Hide ▲' : 'View ▼'}
                </button>
              </div>
              {showPdfPreview && (
                <div style={{ marginTop: 10 }}>
                  {pdfPreviewLoading ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                      Generating preview…
                    </div>
                  ) : pdfPreviewUrl ? (
                    <iframe
                      src={`${pdfPreviewUrl}#navpanes=0&toolbar=0`}
                      width="100%"
                      height="420"
                      style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', display: 'block' }}
                      title="Proposal Form Preview"
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1rem 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                      Preview unavailable
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Signatories Timeline */}
            <div className="rm-panel-section">
              <div className="rm-panel-label">Approval Progress</div>
              <ProposalTimeline proposal={proposal} />
            </div>

            {/* Signed Document */}
            <div className="rm-panel-section">
              <div className="rm-panel-label">Signed Document</div>
              {proposal.signedDocUrl ? (
                <a
                  href={proposal.signedDocUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rm-doc-link"
                >
                  📄 View Signed Document
                </a>
              ) : (
                <p className="rm-no-doc">No document uploaded yet</p>
              )}
            </div>

            {/* Actions */}
            {approvalMessage ? (
              <div className="rm-approval-msg">{approvalMessage}</div>
            ) : isPartner || !approvalLevel ? (
              <button className="rm-btn-close" onClick={onClose}>Close</button>
            ) : actionSaved ? (
              <button className="rm-btn-close" onClick={onClose}>Close</button>
            ) : (
              <div className="rm-action-panel">
                {canApproveSequential() && !isAlreadyApproved() ? (
                  <>
                    <div className="rm-panel-label">Your Action</div>
                    <div className="rm-approval-lock-note">
                      After you approve, the proponent can no longer edit this proposal. If a later signatory finds an issue, return it with a reason so it can be revised and resubmitted.
                    </div>
                    <button
                      className="rm-btn-approve"
                      onClick={handleApprove}
                      disabled={isSubmitting}
                    >
                      {isSubmitting
                        ? "Submitting…"
                        : approvalLevel === "reviewedBy"
                          ? "✓ Reviewed"
                          : approvalLevel === "recommendedBy"
                            ? "✓ Recommended"
                            : approvalLevel === "endorsedBy"
                            ? "✓ Endorsed" 
                            : approvalLevel === "approvedBy"
                              ? "✓ Approved"
                            : "✓ Approve"}
                    </button>
                    <div className="rm-return-label">Return to proponent</div>
                    <textarea
                      className="rm-rejection-textarea"
                      placeholder="Explain what must be revised before resubmission (required)..."
                      value={rejectComments}
                      onChange={(e) => setRejectComments(e.target.value)}
                      rows={3}
                      disabled={isSubmitting}
                    />
                    <div className="rm-rejection-help">
                      Required: include enough detail for the proponent to correct the proposal before resubmitting.
                    </div>
                    <button
                      className="rm-btn-return"
                      onClick={handleReject}
                      disabled={isSubmitting || !rejectComments.trim()}
                    >
                      {isSubmitting ? "Returning..." : "Return for Revision"}
                    </button>
                  </>
                ) : isAlreadyApproved() ? (
                  <div className="rm-already-done">You have already approved this proposal.</div>
                ) : (
                  <div className="rm-not-turn">Not your turn yet — waiting for the previous signatory.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
