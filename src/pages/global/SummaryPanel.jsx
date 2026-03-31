import { useEffect, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { createNotification, notifyUsersByRoles } from '../../utils/notificationUtils';
import { showToast } from '../../utils/toast';

import { exportProposalPDF } from './exportProposalPDF';

function SummaryPanel({
  formData,
  slFields,
  ceFields,
  projectType,
  loading,
  onBack,
  onClose,
  sdgOptions,
  setLoading
}) {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

  /**
   * Handles form submission: creates a mission document in the unified missions collection.
   */
  const handleSubmit = async () => {
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        showToast('You must be logged in to submit a proposal');
        setLoading(false);
        return;
      }
      const now = serverTimestamp();

      // --- Approval Flow Logic ---
      // 1. Query Firestore for program chair and dean of selected department
      // 2. Add admin/regular and admin/director (hardcoded names from README)
      // 3. Store approvalFlow: [chair, dean, admin, director] (full names)
      // 4. Auto-fill reviewedBy if proponent is program chair
      let approvalFlow = [];
      let reviewedBy = '';
      let recommendedBy = '';
      let endorsedBy = '';
      let approvedBy = '';
      try {
        const { getDocs, collection, query, where } = await import('firebase/firestore');
        const dept = formData.affiliatedDepartment;
        // Query for program chair
        const chairSnap = await getDocs(query(collection(db, 'users'), where('department', '==', dept), where('position', '==', 'program chair')));
        const deanSnap = await getDocs(query(collection(db, 'users'), where('department', '==', dept), where('position', '==', 'college dean')));
        const chairName = chairSnap.docs.length > 0 ? (chairSnap.docs[0].data().name || '') : '';
        const deanName = deanSnap.docs.length > 0 ? (deanSnap.docs[0].data().name || '') : '';
        // Admin names from README
        const adminRegular = 'Admin Regular';
        const adminDirector = 'Admin Director';
        approvalFlow = [chairName, deanName, adminRegular, adminDirector];

        // Determine proponent's position
        let proponentPosition = '';
        // Try to get the proponent's position from Firestore
        const proponentSnap = await getDocs(query(collection(db, 'users'), where('name', '==', formData.preparedBy)));
        if (proponentSnap.docs.length > 0) {
          proponentPosition = proponentSnap.docs[0].data().position || '';
        }

        // Auto-fill logic
        if (proponentPosition === 'program chair') {
          reviewedBy = formData.preparedBy;
        }
        // If the proponent is the dean, all steps are manual (no auto-fill)
      } catch (e) {
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
        stakeholders: formData.stakeholders,
        location: formData.location,
        volunteerHours: Number(formData.volunteerHours) || 0,
        description: formData.description,
        objectives: formData.objectives,
        specificActivities: formData.specificActivities.split('\n').filter(a => a.trim()),
        successIndicators: formData.successIndicators.split('\n').filter(a => a.trim()),
        budget: formData.budget,
        studentOutcomes: formData.studentOutcomes || '',

        // People involved
        proponents: [formData.preparedBy],
        preparedBy: formData.preparedBy,
        createdBy: user.uid,
        reviewedBy,
        recommendedBy,
        endorsedBy,
        approvedBy,

        // Affiliation
        affiliation: formData.affiliation || '',

        // Partner School (for filtering)
        partnerSchool: formData.partnerSchool || '',

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
          assignedFaculty: slFields.assignedFaculty,
        };
      } else {
        missionData.ceFields = {
          nature: ceFields.nature,
          learningOutcomes: ceFields.learningOutcomes,
          customLearningOutcome: ceFields.customLearningOutcome || '',
        };
      }

      // Save to missions collection
      const docRef = await addDoc(collection(db, 'missions'), missionData);

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
        proponent: formData.preparedBy,
        courseTitle: slFields.course || '',
        courseCode: slFields.courseCode || '',
        targetDates: formData.targetDate,
        targetLocation: formData.location,
        sdgs: (formData.sdgs || []).map(num => sdgNumberToLabel[num] || num),
        proposalDescription: formData.description,
        proposalObjectives: formData.objectives,
        specificActivities: formData.specificActivities,
        successIndicators: formData.successIndicators,
        budget: formData.budget,
        stakeholders: formData.stakeholders,
        volunteerHours: formData.volunteerHours
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
      proponent: formData.preparedBy,
      affiliation: formData.affiliation,
      studentOutcomes: formData.studentOutcomes || '',
      sdgs: (formData.sdgs || []).map(num => sdgNumberToLabel[num] || num),
      natureOfEngagement: natureArr,
      learningOutcomes: loArr,
      targetDate: formData.targetDate,
      location: formData.location,
      stakeholders: formData.stakeholders,
      numberOfVolunteerHours: formData.volunteerHours,
      ceDescription: formData.description,
      ceObjectives: formData.objectives,
      specificActivities: formData.specificActivities,
      successIndicators: formData.successIndicators,
      budget: formData.budget,
      preparedBy: formData.preparedBy
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
      <p style={{ margin: '0.75rem 0 0', color: '#718096', fontSize: '0.8rem', textAlign: 'center' }}>
        Review all fields carefully — the proposal cannot be edited once submitted.
      </p>
      <div className="form-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn-cancel" onClick={onBack}>Back</button>
        <button type="button" className="btn-next" disabled={loading} onClick={handleExport}>
          Export PDF
        </button>
        <button type="button" className="btn-submit" disabled={loading} onClick={handleSubmit}>
          Submit
        </button>
      </div>
    </div>
  );
}

export default SummaryPanel;
