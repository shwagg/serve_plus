import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { db, storage } from "../firebaseConfig";
import { doc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { createNotification } from "../utils/notificationUtils";
import { exportAccomplishmentPDF } from "../pages/global/exportAccomplishmentPDF";
import "./styles/AccomplishmentReportModal.css";

/**
 * AccomplishmentReportModal
 * Props:
 *  - missionId       string
 *  - event           object  (the mission/event document data)
 *  - existingReport  object | null  (already-submitted report doc data)
 *  - onClose         () => void
 *  - onSubmitted     () => void  (called after successful submit)
 */
export default function AccomplishmentReportModal({ missionId, event, existingReport, onClose, onSubmitted }) {
  const auth = getAuth();
  const isSL = event?.projectType === "sl";
  const isCE = event?.projectType === "ce";
  const formLabel = isSL ? "Service-Learning (S-L)" : "Community Engagement (CE)";
  const formCode  = isSL ? "CSCE-FORM-040A-12" : "CSCE-FORM-040B-22";

  const isRevision = existingReport?.status === "revision_needed";
  const isApproved = existingReport?.status === "approved";
  const isSubmitted = existingReport?.status === "submitted";

  const preload = existingReport?.formData || {};

  // ── Section I ─────────────────────────────────────────
  const [leaderName,        setLeaderName]        = useState(preload.leaderName        || event?.preparedBy || (Array.isArray(event?.proponents) ? event.proponents[0] : "") || "");
  const [activityTitle,     setActivityTitle]     = useState(preload.activityTitle     || event?.title || "");
  const [location,          setLocation]          = useState(preload.location          || event?.location || "");
  const [summaryDetails,    setSummaryDetails]    = useState(preload.summaryDetails    || event?.description || "");
  const [sdgs,              setSdgs]              = useState(preload.sdgs              || (Array.isArray(event?.sdg || event?.sdgGoals) ? (event.sdg || event.sdgGoals).join(", ") : (event?.sdg || event?.sdgGoals || "")));
  const [volunteerHours,    setVolunteerHours]    = useState(preload.volunteerHours    || event?.volunteerHours || "");
  const [plannedStart,      setPlannedStart]      = useState(preload.plannedStart      || event?.targetDate || "");
  const [plannedEnd,        setPlannedEnd]        = useState(preload.plannedEnd        || event?.targetDate || "");
  const [actualStart,       setActualStart]       = useState(preload.actualStart       || event?.targetDate || "");
  const [actualEnd,         setActualEnd]         = useState(preload.actualEnd         || event?.targetDate || "");
  const [proposedBudget,    setProposedBudget]    = useState(preload.proposedBudget    || event?.budget || "");
  const [incurredBudget,    setIncurredBudget]    = useState(preload.incurredBudget    || "");
  // CE only
  const [ceNature,          setCeNature]          = useState(preload.ceNature          || "");

  // ── Section II ────────────────────────────────────────
  const [goalsObjectives,   setGoalsObjectives]   = useState(preload.goalsObjectives   || "");
  const [extentAchieved,    setExtentAchieved]    = useState(preload.extentAchieved    || "");
  const [recommendations,   setRecommendations]   = useState(preload.recommendations   || "");
  const [beneWho,           setBeneWho]           = useState(preload.beneWho           || "");
  const [beneWhat,          setBeneWhat]          = useState(preload.beneWhat          || "");
  const [beneCount,         setBeneCount]         = useState(preload.beneCount         || "");

  // ── Section III ───────────────────────────────────────
  const [followUpPlans,     setFollowUpPlans]     = useState(preload.followUpPlans     || "");

  // ── Section IV ────────────────────────────────────────
  const [comments,          setComments]          = useState(preload.comments          || "");

  // ── Section V  ────────────────────────────────────────
  const [photoFiles,        setPhotoFiles]        = useState([]);
  const [existingPhotoUrls, setExistingPhotoUrls] = useState(existingReport?.photoUrls || []);
  const photoInputRef = useRef(null);

  // ── Section VI ────────────────────────────────────────
  const [declarationName,   setDeclarationName]   = useState(preload.declarationName   || leaderName);
  const [declared,          setDeclared]          = useState(false);

  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState("");
  const [activeStep,      setActiveStep]      = useState(1);
  const [pdfPreviewUrl,   setPdfPreviewUrl]   = useState(null);
  const [pdfGenerating,   setPdfGenerating]   = useState(false);
  const [exporting,       setExporting]       = useState(false);
  const pdfPreviewUrlRef = useRef(null);

  const TOTAL_STEPS = 6;

  // Collect all current form state into the shape expected by exportAccomplishmentPDF
  const buildPdfData = useCallback(() => ({
    leaderName,
    activityTitle,
    location,
    sdgs,
    volunteerHours,
    plannedStart,
    plannedEnd,
    actualStart,
    actualEnd,
    proposedBudget,
    incurredBudget,
    ceNature,
    goalsObjectives,
    extentAchieved,
    recommendations,
    beneWho,
    beneWhat,
    beneCount,
    followUpPlans,
    comments,
    declarationName,
    declarationDate: new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }),
  }), [
    leaderName, activityTitle, location, sdgs, volunteerHours,
    plannedStart, plannedEnd, actualStart, actualEnd,
    proposedBudget, incurredBudget, ceNature,
    goalsObjectives, extentAchieved, recommendations,
    beneWho, beneWhat, beneCount, followUpPlans, comments, declarationName,
  ]);

  // Auto-generate PDF preview whenever step 6 is active or declaration name changes
  useEffect(() => {
    if (activeStep !== 6) return;
    let cancelled = false;
    setPdfGenerating(true);

    const generate = async () => {
      try {
        const url = await exportAccomplishmentPDF({
          projectType: event?.projectType || 'sl',
          formData: buildPdfData(),
          returnUrl: true,
        });
        if (!cancelled) {
          // Revoke old blob URL
          if (pdfPreviewUrlRef.current) URL.revokeObjectURL(pdfPreviewUrlRef.current);
          pdfPreviewUrlRef.current = url;
          setPdfPreviewUrl(url);
        }
      } catch (e) {
        if (!cancelled) setPdfPreviewUrl(null);
        console.warn('PDF preview error:', e.message);
      } finally {
        if (!cancelled) setPdfGenerating(false);
      }
    };

    generate();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, declarationName, event?.projectType]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (pdfPreviewUrlRef.current) URL.revokeObjectURL(pdfPreviewUrlRef.current); };
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportAccomplishmentPDF({
        projectType: event?.projectType || 'sl',
        formData: buildPdfData(),
        returnUrl: false,
      });
    } catch (e) {
      console.error('Export error:', e);
    } finally {
      setExporting(false);
    }
  };

  const validate = () => {
    if (!leaderName.trim())     return "Please enter the name of the Faculty-in-Charge / Student Leader.";
    if (!activityTitle.trim())  return "Please enter the activity title.";
    if (!location.trim())       return "Please enter the activity location.";
    if (!goalsObjectives.trim()) return "Please fill in the Goals and Objectives (Section II).";
    if (!extentAchieved.trim()) return "Please fill in the Extent Achieved (Section II).";
    if (!beneWho.trim())        return "Please fill in the Beneficiaries section.";
    if (!declared)              return "Please confirm the declaration before submitting.";
    if (isCE && !ceNature)      return "Please select the Nature of Community Engagement.";
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    setSubmitting(true);
    try {
      const user = auth.currentUser;
      // Upload new photos
      let uploadedUrls = [...existingPhotoUrls];
      for (const file of photoFiles) {
        const storePath = `accomplishment_reports/${missionId}/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, storePath);
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        uploadedUrls.push(url);
      }

      const formData = {
        leaderName, activityTitle, location, summaryDetails, sdgs,
        volunteerHours, plannedStart, plannedEnd, actualStart, actualEnd,
        proposedBudget, incurredBudget, goalsObjectives, extentAchieved,
        recommendations, beneWho, beneWhat, beneCount, followUpPlans, comments,
        declarationName,
        ...(isCE ? { ceNature } : {}),
      };

      // Save report doc
      const reportRef = doc(db, "missions", missionId, "accomplishmentReport", "submission");
      await setDoc(reportRef, {
        submittedBy: user.uid,
        submittedAt: serverTimestamp(),
        reportType: event?.projectType || "sl",
        status: "submitted",
        formData,
        photoUrls: uploadedUrls,
        ...(isRevision ? { revisionSubmittedAt: serverTimestamp() } : {}),
      }, { merge: true });

      // Update volunteer progress
      const volRef = doc(db, "missions", missionId, "volunteer", user.uid);
      await updateDoc(volRef, {
        "progress.accomplishmentReport": "submitted",
      });

      // Notify admins
      const { collection: col, getDocs: gd, query: q, where: w } = await import("firebase/firestore");
      const adminSnap = await gd(q(col(db, "users"), w("role", "in", ["admin", "sysadmin"])));
      await Promise.allSettled(
        adminSnap.docs.map(d =>
          createNotification(d.id, {
            type: "accomplishment_report_submitted",
            title: "Accomplishment Report Submitted",
            message: `${leaderName} submitted an accomplishment report for "${activityTitle}".`,
            link: `/admin/current-event/${missionId}?tab=accomplishment`,
            missionId,
          })
        )
      );

      onSubmitted?.();
      onClose();
    } catch (e) {
      console.error(e);
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = [
    "Background Information",
    "Results & Beneficiaries",
    "Follow-Up / Scaling",
    "Comments & Recommendations",
    "Photographs",
    "Declaration",
  ];

  return createPortal(
    <div className="ar-overlay" role="dialog" aria-modal="true" aria-labelledby="ar-title" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ar-modal">
        {/* Header */}
        <div className="ar-header">
          <div className="ar-header-left">
            <div className="ar-form-code">{formCode}</div>
            <h2 id="ar-title" className="ar-title">{formLabel} Accomplishment Report</h2>
          </div>
          <button className="ar-close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>

        {/* Status banner */}
        {isApproved && (
          <div className="ar-status-banner approved">✓ This report has been approved by the admin.</div>
        )}
        {isRevision && (
          <div className="ar-status-banner revision">
            ⚠ Revision required:{" "}
            <span>{existingReport?.revisionNote || "Please review and resubmit."}</span>
          </div>
        )}
        {isSubmitted && !isRevision && !isApproved && (
          <div className="ar-status-banner submitted">📋 Report submitted. Awaiting admin review.</div>
        )}

        {/* Step indicator */}
        <div className="ar-step-bar">
          {stepTitles.map((t, i) => (
            <button
              key={i}
              className={`ar-step-dot${activeStep === i + 1 ? " active" : ""}${i + 1 < activeStep ? " done" : ""}`}
              onClick={() => setActiveStep(i + 1)}
              title={t}
              aria-label={`Step ${i + 1}: ${t}`}
            >
              <span className="ar-step-num">{i + 1 < activeStep ? "✓" : i + 1}</span>
              <span className="ar-step-label">{t}</span>
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="ar-body">

          {/* ── STEP 1: Section I – Background Information ── */}
          {activeStep === 1 && (
            <div className="ar-section">
              <h3 className="ar-section-title">Section I: Background Information</h3>
              <p className="ar-section-note">Fields auto-filled from event data where available. Please verify and complete.</p>

              {isCE && (
                <div className="ar-field">
                  <label className="ar-label">Nature of Community Engagement <span className="ar-req">*</span></label>
                  <div className="ar-radio-group">
                    {["Program", "Project / Advocacy", "Consultation / Extension"].map(opt => (
                      <label key={opt} className="ar-radio-label">
                        <input type="radio" name="ceNature" value={opt} checked={ceNature === opt} onChange={() => setCeNature(opt)} />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="ar-field">
                <label className="ar-label">Name of Faculty-in-Charge / Student Leader{isCE ? " / Employee" : ""} <span className="ar-req">*</span></label>
                <input className="ar-input" value={leaderName} onChange={e => setLeaderName(e.target.value)} placeholder="Full name" />
              </div>

              <div className="ar-field">
                <label className="ar-label">
                  {isSL ? "Service-Learning Project / Activity Title (include course code, title, and participating section/s)" : "Community Engagement Title"}
                  {" "}<span className="ar-req">*</span>
                </label>
                <input className="ar-input" value={activityTitle} onChange={e => setActivityTitle(e.target.value)} placeholder="Activity title" />
              </div>

              <div className="ar-field">
                <label className="ar-label">
                  Location <span className="ar-req">*</span>
                  <span className="ar-hint"> (barangay, town, province, region, country)</span>
                </label>
                <input className="ar-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="Full location" />
              </div>

              <div className="ar-field">
                <label className="ar-label">Activity Summary Details</label>
                <textarea className="ar-textarea" rows={3} value={summaryDetails} onChange={e => setSummaryDetails(e.target.value)} placeholder="Brief summary of the activity" />
              </div>

              <div className="ar-row">
                <div className="ar-field">
                  <label className="ar-label">Sustainable Development Goal(s)</label>
                  <input className="ar-input" value={sdgs} onChange={e => setSdgs(e.target.value)} placeholder="e.g. SDG 4, SDG 17" />
                </div>
                <div className="ar-field ar-field--sm">
                  <label className="ar-label">Volunteer Hours Rendered</label>
                  <input className="ar-input" type="number" min="0" value={volunteerHours} onChange={e => setVolunteerHours(e.target.value)} placeholder="0" />
                </div>
              </div>

              <div className="ar-row">
                <div className="ar-field">
                  <label className="ar-label">Planned Start Date</label>
                  <input className="ar-input" type="date" value={plannedStart} onChange={e => setPlannedStart(e.target.value)} />
                </div>
                <div className="ar-field">
                  <label className="ar-label">Planned End Date</label>
                  <input className="ar-input" type="date" value={plannedEnd} onChange={e => setPlannedEnd(e.target.value)} />
                </div>
              </div>

              <div className="ar-row">
                <div className="ar-field">
                  <label className="ar-label">Actual Start Date</label>
                  <input className="ar-input" type="date" value={actualStart} onChange={e => setActualStart(e.target.value)} />
                </div>
                <div className="ar-field">
                  <label className="ar-label">Actual End Date</label>
                  <input className="ar-input" type="date" value={actualEnd} onChange={e => setActualEnd(e.target.value)} />
                </div>
              </div>

              <div className="ar-row">
                <div className="ar-field">
                  <label className="ar-label">Total Proposed Budget (if applicable)</label>
                  <input className="ar-input" value={proposedBudget} onChange={e => setProposedBudget(e.target.value)} placeholder="₱ 0.00" />
                </div>
                <div className="ar-field">
                  <label className="ar-label">Total Budget Incurred (if applicable)</label>
                  <input className="ar-input" value={incurredBudget} onChange={e => setIncurredBudget(e.target.value)} placeholder="₱ 0.00" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Section II – Results ── */}
          {activeStep === 2 && (
            <div className="ar-section">
              <h3 className="ar-section-title">Section II: Results of the {formLabel} Initiative</h3>

              <div className="ar-subsection-title">Overall Project / Activity Evaluation</div>

              <div className="ar-3col-grid">
                <div className="ar-field">
                  <label className="ar-label">
                    Goals and Objectives <span className="ar-req">*</span>
                    <span className="ar-hint"> (specify Learning Outcomes met; how target SDGs were achieved)</span>
                  </label>
                  <textarea className="ar-textarea" rows={5} value={goalsObjectives} onChange={e => setGoalsObjectives(e.target.value)} placeholder="Describe goals and objectives met..." />
                </div>
                <div className="ar-field">
                  <label className="ar-label">Extent to Which the Objectives are Achieved <span className="ar-req">*</span></label>
                  <textarea className="ar-textarea" rows={5} value={extentAchieved} onChange={e => setExtentAchieved(e.target.value)} placeholder="Describe the extent of achievement..." />
                </div>
                <div className="ar-field">
                  <label className="ar-label">Recommendations / Actions</label>
                  <textarea className="ar-textarea" rows={5} value={recommendations} onChange={e => setRecommendations(e.target.value)} placeholder="Any recommendations or corrective actions..." />
                </div>
              </div>

              <div className="ar-subsection-title" style={{ marginTop: 24 }}>Beneficiaries</div>
              <div className="ar-3col-grid">
                <div className="ar-field">
                  <label className="ar-label">Who has benefited? <span className="ar-req">*</span></label>
                  <textarea className="ar-textarea" rows={4} value={beneWho} onChange={e => setBeneWho(e.target.value)} placeholder="Describe who benefited..." />
                </div>
                <div className="ar-field">
                  <label className="ar-label">What benefits? What involvement?</label>
                  <textarea className="ar-textarea" rows={4} value={beneWhat} onChange={e => setBeneWhat(e.target.value)} placeholder="Describe the benefits and involvement..." />
                </div>
                <div className="ar-field">
                  <label className="ar-label">How many people?</label>
                  <input className="ar-input" type="number" min="0" value={beneCount} onChange={e => setBeneCount(e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3: Section III – Follow-Up ── */}
          {activeStep === 3 && (
            <div className="ar-section">
              <h3 className="ar-section-title">Section III: Follow-Up / Scaling / Upgrading</h3>
              <div className="ar-field">
                <label className="ar-label">Plans for Follow-Up / Scaling / Upgrading (if applicable)</label>
                <textarea className="ar-textarea" rows={8} value={followUpPlans} onChange={e => setFollowUpPlans(e.target.value)} placeholder="Describe any plans for follow-up, scaling, or upgrading the initiative..." />
              </div>
            </div>
          )}

          {/* ── STEP 4: Section IV – Comments ── */}
          {activeStep === 4 && (
            <div className="ar-section">
              <h3 className="ar-section-title">Section IV: Comments / Recommendations</h3>
              <div className="ar-field">
                <label className="ar-label">Please share any other information not covered in the report that you think is relevant.</label>
                <textarea className="ar-textarea" rows={8} value={comments} onChange={e => setComments(e.target.value)} placeholder="Any additional comments or information..." />
              </div>
            </div>
          )}

          {/* ── STEP 5: Section V – Photos ── */}
          {activeStep === 5 && (
            <div className="ar-section">
              <h3 className="ar-section-title">Section V: Photographs</h3>
              <p className="ar-section-note">Upload event photographs as documentation. Accepted: JPG, PNG, GIF, WEBP (max 10MB each).</p>

              <button className="ar-upload-btn" onClick={() => photoInputRef.current?.click()}>
                + Add Photos
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={e => {
                  const files = Array.from(e.target.files || []);
                  setPhotoFiles(prev => [...prev, ...files]);
                  e.target.value = "";
                }}
              />

              {/* Existing uploaded photos */}
              {existingPhotoUrls.length > 0 && (
                <div className="ar-photo-grid">
                  {existingPhotoUrls.map((url, i) => (
                    <div key={i} className="ar-photo-thumb">
                      <img src={url} alt={`Photo ${i + 1}`} />
                      <button className="ar-photo-remove" onClick={() => setExistingPhotoUrls(p => p.filter((_, j) => j !== i))} aria-label="Remove photo">×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* New photos to be uploaded */}
              {photoFiles.length > 0 && (
                <div className="ar-photo-grid">
                  {photoFiles.map((file, i) => (
                    <div key={i} className="ar-photo-thumb ar-photo-thumb--new">
                      <img src={URL.createObjectURL(file)} alt={file.name} />
                      <button className="ar-photo-remove" onClick={() => setPhotoFiles(p => p.filter((_, j) => j !== i))} aria-label="Remove photo">×</button>
                      <span className="ar-photo-new-badge">New</span>
                    </div>
                  ))}
                </div>
              )}

              {existingPhotoUrls.length === 0 && photoFiles.length === 0 && (
                <div className="ar-empty-photos">No photos uploaded yet. Click "Add Photos" to attach documentation.</div>
              )}
            </div>
          )}

          {/* ── STEP 6: Section VI – Declaration ── */}
          {activeStep === 6 && (
            <div className="ar-section">
              {/* ── PDF Preview ────────────────────────────── */}
              <div className="ar-preview-block">
                <div className="ar-preview-header">
                  <span className="ar-preview-label">📄 PDF Preview</span>
                  <button
                    className="ar-btn ar-btn--export"
                    onClick={handleExport}
                    disabled={exporting || pdfGenerating}
                  >
                    {exporting ? "Exporting…" : "⬇ Export PDF"}
                  </button>
                </div>
                {pdfGenerating ? (
                  <div className="ar-preview-loading">Generating preview…</div>
                ) : pdfPreviewUrl ? (
                  <iframe
                    src={`${pdfPreviewUrl}#navpanes=0&toolbar=0`}
                    className="ar-preview-iframe"
                    title="Accomplishment Report Preview"
                  />
                ) : (
                  <div className="ar-preview-loading">Preview unavailable — PDF template not found.</div>
                )}
              </div>

              <div className="ar-preview-divider" />

              <h3 className="ar-section-title">Section VI: Declaration</h3>
              <div className="ar-declaration-box">
                <p>
                  I confirm that the details contained in this report are correct and are representative of the current status of the{" "}
                  {isSL ? "service-learning project or activity" : "community engagement project, program, and/or activity"}.
                  I am responsible for the aforementioned {isSL ? "service-learning" : "community engagement"} initiative.
                </p>
              </div>

              <div className="ar-field" style={{ marginTop: 20 }}>
                <label className="ar-label">Faculty-in-Charge / Student Leader{isCE ? " / Employee" : ""} <span className="ar-req">*</span></label>
                <input className="ar-input" value={declarationName} onChange={e => setDeclarationName(e.target.value)} placeholder="Full name" />
              </div>

              <label className="ar-checkbox-label" style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={declared}
                  onChange={e => setDeclared(e.target.checked)}
                />
                I confirm the above declaration and that all information provided is accurate.
              </label>

              <div className="ar-note-box" style={{ marginTop: 20 }}>
                <strong>Note:</strong> After submission, this report will be reviewed by the CSCE / Admin. You will be notified once it is approved or if revisions are needed.
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <div className="ar-error">{error}</div>}

        {/* Footer navigation */}
        <div className="ar-footer">
          <div className="ar-step-counter">{activeStep} / {TOTAL_STEPS}</div>
          <div className="ar-footer-actions">
            {activeStep > 1 && (
              <button className="ar-btn ar-btn--secondary" onClick={() => setActiveStep(s => s - 1)}>
                ← Back
              </button>
            )}
            {activeStep < TOTAL_STEPS && (
              <button className="ar-btn ar-btn--primary" onClick={() => setActiveStep(s => s + 1)}>
                Next →
              </button>
            )}
            {activeStep === TOTAL_STEPS && !isApproved && (
              <button
                className="ar-btn ar-btn--submit"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : isRevision ? "Resubmit Report" : "Submit Report"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
