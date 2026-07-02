import { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { createNotification, notifyUsersByRoles } from '../../utils/notificationUtils';
import { showConfirm, showToast } from '../../utils/toast';
import { logAudit } from '../../utils/auditLogger';

import { exportProposalPDF } from './exportProposalPDF';

const FIELD_LIMITS = {
  title: 200,
  location: 50,
  volunteerHours: 50,
  stakeholderItem: 50,
  course: 50,
  courseCode: 50,
  section: 50,
  activityItem: 50,
  description: 2000,
  objectives: 2000,
  successIndicators: 1000,
  budget: 200,
  proponents: 3,
};

function getVisibleCharacterCount(value) {
  return String(value || '').replace(/[\s\r\n]+/g, '').length;
}

function SummaryPanel({
  formData,
  slFields,
  ceFields,
  projectType,
  loading,
  onBack,
  onClose,
  sdgOptions,
  setLoading,
  onClearDraft,
  proposalId,
  isResubmission = false,
}) {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

  const validateProposalLimits = () => {
    if ((formData.title || '').length > FIELD_LIMITS.title) return `Title can only have ${FIELD_LIMITS.title} characters.`;
    if ((formData.location || '').length > FIELD_LIMITS.location) return `Location can only have ${FIELD_LIMITS.location} characters.`;
    if (getVisibleCharacterCount(formData.title) > FIELD_LIMITS.title) return `Title can only have ${FIELD_LIMITS.title} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.location) > FIELD_LIMITS.location) return `Location can only have ${FIELD_LIMITS.location} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.description) > FIELD_LIMITS.description) return `Project Description can only have ${FIELD_LIMITS.description} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.objectives) > FIELD_LIMITS.objectives) return `Objectives can only have ${FIELD_LIMITS.objectives} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.successIndicators) > FIELD_LIMITS.successIndicators) return `Success Indicators can only have ${FIELD_LIMITS.successIndicators} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.budget) > FIELD_LIMITS.budget) return `Budget can only have ${FIELD_LIMITS.budget} characters, excluding spaces and line breaks.`;
    if (Number(formData.volunteerHours) > FIELD_LIMITS.volunteerHours) return `Volunteer Hours can only go up to ${FIELD_LIMITS.volunteerHours}.`;
    if ((formData.proponents || []).length > FIELD_LIMITS.proponents) return `Only ${FIELD_LIMITS.proponents} proponents are allowed.`;
    if ((formData.stakeholders || []).some(item => getVisibleCharacterCount(item) > FIELD_LIMITS.stakeholderItem)) return `Each stakeholder can only have ${FIELD_LIMITS.stakeholderItem} characters, excluding spaces and line breaks.`;
    if ((formData.specificActivities || []).some(item => getVisibleCharacterCount(item) > FIELD_LIMITS.activityItem)) return `Each specific activity can only have ${FIELD_LIMITS.activityItem} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(slFields.course) > FIELD_LIMITS.course) return `Course can only have ${FIELD_LIMITS.course} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(slFields.courseCode) > FIELD_LIMITS.courseCode) return `Course Code can only have ${FIELD_LIMITS.courseCode} characters, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(slFields.section) > FIELD_LIMITS.section) return `Section can only have ${FIELD_LIMITS.section} characters, excluding spaces and line breaks.`;
    return '';
  };

  /**
   * Handles form submission: creates a mission document in the unified missions collection.
   */
  const handleSubmit = async () => {
    try {
      const limitError = validateProposalLimits();
      if (limitError) {
        showToast(limitError);
        return;
      }
      const user = auth.currentUser;
      if (!user) {
        showToast('You must be logged in to submit a proposal');
        return;
      }

      if (!proposalId || isResubmission) {
        const confirmed = await showConfirm(
          'Submit for approval? You can edit only until the first signatory approval. After that, issues must be rejected with a reason and resubmitted.'
        );
        if (!confirmed) return;
      }

      setLoading(true);
      const now = serverTimestamp();
      // Derive Faculty In Charge: explicit input (student proposals) or locked first proponent (faculty proposals)
      const assignedFacultyValue = formData.facultyInCharge?.trim() || formData.proponents?.[0] || formData.preparedBy || '';

      // --- UPDATE MODE (editing existing proposal) ---
      if (proposalId) {
        const updateData = {
          updatedAt: now,
          projectType: projectType === 'service-learning' ? 'sl' : 'ce',
          title: formData.title,
          alt: formData.alt || '',
          dateProposed: formData.targetDate,
          sdgs: formData.sdgs || [],
          targetDate: formData.targetDate,
          stakeholders: Array.isArray(formData.stakeholders) ? formData.stakeholders : (formData.stakeholders ? [formData.stakeholders] : []),
          location: formData.location,
          volunteerHours: Number(formData.volunteerHours) || 0,
          description: formData.description,
          objectives: formData.objectives,
          specificActivities: Array.isArray(formData.specificActivities)
            ? formData.specificActivities
            : (formData.specificActivities || '').split('\n').filter(a => a.trim()),
          successIndicators: formData.successIndicators.split('\n').filter(a => a.trim()),
          budget: formData.budget,
          studentOutcomes: formData.studentOutcomes || '',
          proponents: formData.proponents?.length ? formData.proponents : [formData.preparedBy],
          preparedBy: formData.proponents?.[0] || formData.preparedBy,
          selectedReviewedBy: formData.reviewedBy || '',
          selectedRecommendedBy: formData.recommendedBy || '',
          affiliatedDepartment: formData.affiliatedDepartment || '',
          partnerSchool: formData.partnerSchool || '',
          participantLimit: formData.participantLimit ? Math.min(Number(formData.participantLimit), 50) : null,
          ...(isResubmission ? {
            status: 'for_approval',
            submittedForApprovalAt: now,
            submittedBy: user.uid,
            reviewedBy: '',
            recommendedBy: '',
            endorsedBy: '',
            approvedBy: '',
            lastApprovedAt: deleteField(),
            lastApprovedBy: deleteField(),
            rejectionReason: deleteField(),
            rejectedBy: deleteField(),
            rejectedAt: deleteField(),
            rejectedByUser: deleteField(),
            'approvals.reviewedBy': null,
            'approvals.recommendedBy': null,
            'approvals.endorsedBy': null,
            'approvals.approvedBy': null,
            'approvals.submitted.approved': true,
            'approvals.submitted.decidedAt': now,
            'approvals.submitted.name': formData.proponents?.[0] || formData.preparedBy || user.email || '',
          } : {}),
        };
        if (projectType === 'service-learning') {
          updateData.slFields = {
            section: slFields.section,
            course: slFields.course,
            courseCode: slFields.courseCode,
            courseId: slFields.courseId || null,
            assignedFaculty: assignedFacultyValue,
          };
        } else {
          updateData.ceFields = {
            nature: ceFields.nature,
            learningOutcomes: ceFields.learningOutcomes,
            customLearningOutcome: ceFields.customLearningOutcome || '',
            assignedFaculty: assignedFacultyValue,
          };
        }
        await updateDoc(doc(db, 'missions', proposalId), updateData);
        logAudit({
          action: isResubmission ? "PROPOSAL_RESUBMITTED" : "PROPOSAL_UPDATED",
          category: "proposal",
          details: { proposalId, proposalTitle: formData.title || "" },
        });
        if (isResubmission) {
          try {
            await createNotification(user.uid, {
              type: 'proposal_submitted',
              title: 'Proposal Resubmitted',
              message: `Your proposal "${formData.title}" was resubmitted for approval.`,
              link: '/student',
              proposalId,
            });
            await notifyUsersByRoles(['admin', 'faculty'], {
              type: 'proposal_submitted',
              title: 'Proposal Resubmitted',
              message: `"${formData.title}" was resubmitted for approval.`,
              link: '/global/review-proposals',
              proposalId,
            });
          } catch (notificationError) {
            console.error('Error creating proposal resubmission notifications:', notificationError);
          }
        }
        showToast(isResubmission ? 'Proposal resubmitted successfully!' : 'Proposal updated successfully!');
        onClearDraft?.();
        onClose();
        return;
      }

      // --- Approval Flow Logic ---
      // reviewedBy / recommendedBy come from the proponent's form selections.
      // approvalFlow is built from Firestore for tracking the full chain.
      const reviewedBy    = formData.reviewedBy    || '';
      const recommendedBy = formData.recommendedBy || '';
      let endorsedBy = '';
      let approvedBy = '';
      let approvalFlow = [];
      try {
        const { getDocs, collection: col, query, where } = await import('firebase/firestore');
        const dept = formData.affiliatedDepartment;
        const chairSnap = await getDocs(query(col(db, 'users'), where('department', '==', dept), where('position', '==', 'program chair')));
        const deanSnap  = await getDocs(query(col(db, 'users'), where('department', '==', dept), where('position', '==', 'college dean')));
        const chairName = chairSnap.docs.length > 0 ? (chairSnap.docs[0].data().name || '') : '';
        const deanName  = deanSnap.docs.length  > 0 ? (deanSnap.docs[0].data().name  || '') : '';
        approvalFlow = [chairName, deanName, 'Admin Regular', 'Admin Director'];
      } catch {
        approvalFlow = [];
      }

      // Create mission document with unified schema
      const missionData = {
        // Timestamps
        createdAt: now,
        publishedAt: null,
        updatedAt: now,

        // Basic Info
        projectType: projectType === 'service-learning' ? 'sl' : 'ce',
        status: 'for_approval',
        title: formData.title,
        alt: formData.alt || '',

        // Project Details
        dateProposed: formData.targetDate,
        sdgs: formData.sdgs || [],
        targetDate: formData.targetDate,
        stakeholders: Array.isArray(formData.stakeholders) ? formData.stakeholders : (formData.stakeholders ? [formData.stakeholders] : []),
        location: formData.location,
        volunteerHours: Number(formData.volunteerHours) || 0,
        description: formData.description,
        objectives: formData.objectives,
        specificActivities: Array.isArray(formData.specificActivities)
          ? formData.specificActivities
          : (formData.specificActivities || '').split('\n').filter(a => a.trim()),
        successIndicators: formData.successIndicators.split('\n').filter(a => a.trim()),
        budget: formData.budget,
        studentOutcomes: formData.studentOutcomes || '',

        // People involved
        proponents: formData.proponents?.length ? formData.proponents : [formData.preparedBy],
        preparedBy: formData.proponents?.[0] || formData.preparedBy,
        createdBy: user.uid,
        // Signatory selections made by proponent (who should review/recommend)
        selectedReviewedBy: reviewedBy,
        selectedRecommendedBy: recommendedBy,
        // Actual approval fields — filled only when each approver manually acts
        reviewedBy: '',
        recommendedBy: '',
        endorsedBy,
        approvedBy,

        // Department & Partner
        affiliatedDepartment: formData.affiliatedDepartment || '',
        partnerSchool: formData.partnerSchool || '',
        participantLimit: formData.participantLimit ? Math.min(Number(formData.participantLimit), 50) : null,

        // Activities
        activities: [],

        // Feedback from Community
        feedback: {
          isActive: false,
          openedAt: null,
          closedAt: null
        },

        // --- Add approval flow ---
        approvalFlow,
      };

      // Add type-specific fields
      if (projectType === 'service-learning') {
        missionData.slFields = {
          section: slFields.section,
          course: slFields.course,
          courseCode: slFields.courseCode,
          courseId: slFields.courseId || null,
          assignedFaculty: assignedFacultyValue,
        };
      } else {
        missionData.ceFields = {
          nature: ceFields.nature,
          learningOutcomes: ceFields.learningOutcomes,
          customLearningOutcome: ceFields.customLearningOutcome || '',
          assignedFaculty: assignedFacultyValue,
        };
      }

      // Save to missions collection
      const docRef = await addDoc(collection(db, 'missions'), missionData);

      logAudit({
        action: "PROPOSAL_SUBMITTED",
        category: "proposal",
        details: {
          proposalId: docRef.id,
          proposalTitle: formData.title || "",
          projectType: projectType,
        },
      });

      try {
        await createNotification(user.uid, {
          type: 'proposal_submitted',
          title: 'Proposal Submitted',
          message: `Your proposal "${formData.title}" was submitted for approval.`,
          link: '/global/review-proposals',
          proposalId: docRef.id,
        });

        await notifyUsersByRoles(['admin', 'faculty'], {
          type: 'proposal_submitted',
          title: 'New Proposal Submitted',
          message: `"${formData.title}" was submitted for approval.`,
          link: '/global/review-proposals',
          proposalId: docRef.id,
        });
      } catch (notificationError) {
        console.error('Error creating proposal notifications:', notificationError);
      }

      showToast('Proposal submitted successfully!');
      onClearDraft?.();
      onClose();
    } catch (error) {
      console.error('Error submitting proposal:', error);
      showToast('Failed to submit proposal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sdgNumberToLabel = {
    1: 'No Poverty', 2: 'Zero Hunger', 3: 'Good Health and Well-Being',
    4: 'Quality Education', 5: 'Gender Equality', 6: 'Clean Water and Sanitation',
    7: 'Affordable and Clean Energy', 8: 'Decent Work and Economic Growth',
    9: 'Industry Innovation and Infrastructure', 10: 'Reduced Inequalities',
    11: 'Sustainable Cities and Communities', 12: 'Responsible Consumption and Production',
    13: 'Climate Action', 14: 'Life Below Water', 15: 'Life on Land',
    16: 'Peace, Justice and Strong Institutions', 17: 'Partnership for the Goals'
  };

  const buildExportData = () => {
    if (projectType === 'service-learning') {
      return {
        proposalTitle: formData.title,
        dateProposed: new Date().toLocaleString(),
        participatingSections: slFields.section || '',
        proponent: (formData.proponents?.length ? formData.proponents : [formData.preparedBy]).join(', '),
        courseTitle: slFields.course || '',
        courseCode: slFields.courseCode || '',
        targetDates: formData.targetDate,
        targetLocation: formData.location,
        sdgs: (formData.sdgs || []).map(num => sdgNumberToLabel[num] || num),
        proposalDescription: formData.description,
        proposalObjectives: formData.objectives,
        specificActivities: Array.isArray(formData.specificActivities)
          ? formData.specificActivities.join('\n')
          : formData.specificActivities,
        successIndicators: formData.successIndicators,
        budget: formData.budget,
        stakeholders: Array.isArray(formData.stakeholders)
          ? formData.stakeholders.join(', ')
          : formData.stakeholders,
        volunteerHours: formData.volunteerHours,
        preparedBy: formData.preparedBy || formData.proponents?.[0] || '',
        reviewedBy: formData.reviewedBy || '',
        recommendedBy: formData.recommendedBy || '',
        endorsedBy: formData.endorsedBy || '',
        approvedBy: formData.approvedBy || '',
      };
    }
    // community-engagement
    const normalize = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
    const validNatures = ['program', 'project/advocacy', 'consultation/extension'];
    const ceLOKeyMap = {
      '0': 'intellectual development', '1': 'collaboration',
      '2': 'appreciation of culture and diversity', '3': 'career exploration',
      '4': 'socio-civic responsibility', '5': 'others'
    };
    let natureArr = ceFields.nature;
    if (!Array.isArray(natureArr)) natureArr = natureArr ? [natureArr] : [];
    natureArr = natureArr.map(normalize).filter(n => validNatures.includes(n));
    let loArr = [];
    if (ceFields.learningOutcomes) {
      if (Array.isArray(ceFields.learningOutcomes)) {
        loArr = ceFields.learningOutcomes.map(lo => ceLOKeyMap[lo] || normalize(lo));
      } else {
        loArr = [ceLOKeyMap[ceFields.learningOutcomes] || normalize(ceFields.learningOutcomes)];
      }
    }
    return {
      communityEngagementTitle: formData.title,
      dateProposed: new Date().toLocaleString(),
      proponent: (formData.proponents?.length ? formData.proponents : [formData.preparedBy]).join(', '),
      studentOutcomes: formData.studentOutcomes || '',
      sdgs: (formData.sdgs || []).map(num => sdgNumberToLabel[num] || num),
      natureOfEngagement: natureArr,
      learningOutcomes: loArr,
      targetDate: formData.targetDate,
      location: formData.location,
      stakeholders: Array.isArray(formData.stakeholders)
        ? formData.stakeholders.join(', ')
        : formData.stakeholders,
      numberOfVolunteerHours: formData.volunteerHours,
      ceDescription: formData.description,
      ceObjectives: formData.objectives,
      specificActivities: Array.isArray(formData.specificActivities)
        ? formData.specificActivities.join('\n')
        : formData.specificActivities,
      successIndicators: formData.successIndicators,
      budget: formData.budget,
      preparedBy: formData.preparedBy || formData.proponents?.[0] || '',
      reviewedBy: formData.reviewedBy || '',
      recommendedBy: formData.recommendedBy || '',
      endorsedBy: formData.endorsedBy || '',
      approvedBy: formData.approvedBy || '',
    };
  };

  useEffect(() => {
    let previewUrl = null;
    const generatePdfPreview = async () => {
      try {
        const exportFormData = buildExportData();
        const url = await exportProposalPDF({
          projectType,
          formData: exportFormData,
          slFields,
          ceFields,
          sdgOptions,
          returnUrl: true
        });
        previewUrl = url;
        setPdfPreviewUrl(url);
      } catch (e) {
        console.warn('PDF preview error:', e.message);
        setPdfPreviewUrl('');
      }
    };
    generatePdfPreview();
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
    // eslint-disable-next-line
  }, [formData, slFields, ceFields, projectType]);

  const handleExport = async () => {
    try {
      setLoading(true);
      if (projectType === 'community-engagement' && (!ceFields.learningOutcomes || ceFields.learningOutcomes === '')) {
        showToast('Please select a Learning Outcomes Level before exporting.');
        return;
      }
      await exportProposalPDF({ projectType, formData: buildExportData(), slFields, ceFields, sdgOptions });
    } catch (err) {
      showToast('Export error: ' + err);
      console.error('Export error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', padding: '1rem 1.5rem 1.5rem' }}>
      {pdfPreviewUrl ? (
        <iframe
          src={`${pdfPreviewUrl}#navpanes=0`}
          width="100%"
          height="480"
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff' }}
          title="PDF Preview"
        />
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#a0aec0' }}>Generating preview…</div>
      )}

      {/* Approval workflow info */}
      <div style={{
        margin: '1rem 0 0',
        padding: '0.85rem 1rem',
        background: '#f0fdfc',
        border: '1px solid #99f6e4',
        borderRadius: 8,
        fontSize: '0.85rem',
        color: '#0f766e',
        lineHeight: 1.6,
      }}>
        <strong style={{ display: 'block', marginBottom: '0.5rem' }}>What happens after submission?</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            { step: 1, label: 'Program Chair', desc: 'Reviews and approves the proposal' },
            { step: 2, label: 'College Dean', desc: 'Recommends the proposal' },
            { step: 3, label: 'Admin (CSCE)', desc: 'Endorses and forwards for final sign-off' },
            { step: 4, label: 'Director', desc: 'Final approval — proponent can publish the event' },
          ].map(({ step, label, desc }) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: '#0d9488', color: '#fff',
                fontSize: '0.7rem', fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>{step}</span>
              <span><strong>{label}</strong> — {desc}</span>
            </div>
          ))}
        </div>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: '#0d9488' }}>
          You can edit this proposal until the first signatory approval is recorded. After that, editing is locked to preserve the approval record. If a later approver finds an issue, they must reject the proposal with a reason so you can revise and resubmit.
        </p>
      </div>

      <div className="form-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn-cancel" onClick={onBack}>Back</button>
        <button type="button" className="btn-next" disabled={loading} onClick={handleExport}>
          Export PDF
        </button>
        <button
          type="button"
          className="btn-submit"
          disabled={loading}
          onClick={handleSubmit}
        >
          {proposalId ? 'Update Proposal' : 'Submit for Review'}
        </button>
      </div>
    </div>
  );
}

export default SummaryPanel;
