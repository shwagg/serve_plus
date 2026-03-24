import { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../firebaseConfig';
import { createNotification, notifyUsersByRoles } from '../../utils/notificationUtils';

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
        alert('You must be logged in to submit a proposal');
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

      alert('Proposal submitted successfully!');
      onClose();
    } catch (error) {
      console.error('Error submitting proposal:', error);
      alert('Failed to submit proposal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const generatePdfPreview = async () => {
      const templateUrl = projectType === 'service-learning'
        ? '/assets/SL-Proposal-Form-32.pdf'
        : '/assets/CE-Proposal-Form-33.pdf';
      try {
        const existingPdfBytes = await fetch(templateUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const form = pdfDoc.getForm();
        try {
          form.getTextField('ProjectTitle').setText(formData.title || '');
          form.getTextField('Faculty').setText(formData.preparedBy || '');
          form.getTextField('TargetDate').setText(formData.targetDate || '');
          form.getTextField('SDG').setText((formData.sdgs || []).join(', '));
          form.getTextField('VolunteerHours').setText(formData.volunteerHours || '');
          form.getTextField('Location').setText(formData.location || '');
          form.getTextField('Stakeholders').setText(formData.stakeholders || '');
          form.getTextField('Course').setText(slFields.course || '');
          form.getTextField('CourseCode').setText(slFields.courseCode || '');
          form.getTextField('Section').setText(slFields.section || '');
          form.getTextField('Description').setText(formData.description || '');
          form.getTextField('Objectives').setText(formData.objectives || '');
          form.getTextField('SpecificActivities').setText(formData.specificActivities || '');
          form.getTextField('SuccessIndicators').setText(formData.successIndicators || '');
          form.getTextField('Budget').setText(formData.budget || '');
        } catch (e) { }
        form.flatten();
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfPreviewUrl(url);
      } catch (e) {
        setPdfPreviewUrl('');
      }
    };
    generatePdfPreview();
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
    // eslint-disable-next-line
  }, [formData, slFields, ceFields, projectType]);

  return (
    <div style={{ background: '#fff', width: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', padding: 32 }}>
      <button
        type="button"
        className="btn-back"
        style={{ marginBottom: 16, alignSelf: 'flex-start' }}
        onClick={onBack}
      >
        Back
      </button>
      <h2 style={{ textAlign: 'center', marginBottom: 32, width: '100%', color: '#000' }}>Summary</h2>
      <div style={{ display: 'flex', flexDirection: 'row', width: '100%', maxWidth: 1200, margin: '0 auto', marginBottom: 24, gap: 40, alignItems: 'flex-start', justifyContent: 'center' }}>
        {/* PDF Preview on the left */}
        <div style={{ flex: 1, minWidth: 350, maxWidth: 600, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {pdfPreviewUrl ? (
            <iframe
              src={pdfPreviewUrl}
              width="100%"
              height="520"
              style={{ border: '1px solid #ccc', borderRadius: 8, background: '#fff', boxShadow: '0 2px 8px #eee' }}
              title="PDF Preview"
            />
          ) : null}
        </div>
        {/* Summary details on the right */}
        <div style={{ flex: 1.2, minWidth: 400, maxWidth: 700, background: '#fff', padding: '40px 48px', borderRadius: 20, boxShadow: '0 2px 12px #e0e0e0', color: '#222', display: 'flex', flexDirection: 'column', gap: 16, border: '1.5px solid #e0e0e0' }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a237e' }}>{formData.title}</div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Published by:</div>
              <div>{formData.preparedBy}</div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Date Published:</div>
              <div>{new Date().toLocaleDateString()}</div>
            </div>
            <div>
              <div style={{ fontWeight: 600 }}>Target Partner:</div>
              <div>{formData.stakeholders}</div>
            </div>
          </div>
          <div style={{ fontWeight: 600, marginTop: 8 }}>Details</div>
          <div><b>SDGs:</b> {(formData.sdgs || []).join(', ')}</div>
          <div><b>Target Date:</b> {formData.targetDate}</div>
          <div><b>Location:</b> {formData.location}</div>
          <div><b>Volunteer Hours:</b> {formData.volunteerHours}</div>
          <div><b>Description:</b> {formData.description}</div>
          <div><b>Objectives:</b> {formData.objectives}</div>
          <div><b>Specific Activities:</b> {formData.specificActivities}</div>
          <div><b>Success Indicators:</b> {formData.successIndicators}</div>
          <div><b>Budget:</b> {formData.budget}</div>
          {/* Service Learning fields */}
          {projectType === 'service-learning' && (
            <>
              <div><b>Section:</b> {slFields.section}</div>
              <div><b>Course:</b> {slFields.course}</div>
              <div><b>Course Code:</b> {slFields.courseCode}</div>
            </>
          )}
          {/* Community Engagement fields */}
          {projectType === 'community-engagement' && (
            <>
              <div><b>Affiliation:</b> {formData.affiliation}</div>
              <div><b>Nature:</b> {ceFields.nature}</div>
              <div><b>Learning Outcomes:</b> {(() => {
                const ceLOKeyMap = {
                  '0': 'Intellectual Development',
                  '1': 'Collaboration',
                  '2': 'Appreciation of Culture and Diversity',
                  '3': 'Career Exploration',
                  '4': 'Socio-Civic Responsibility',
                  '5': 'Others'
                };
                return ceLOKeyMap[ceFields.learningOutcomes] || ceFields.learningOutcomes;
              })()}</div>
              {ceFields.learningOutcomes === '5' && (
                <div><b>Custom Learning Outcome:</b> {ceFields.customLearningOutcome}</div>
              )}
              <div><b>Student Outcomes:</b> {formData.studentOutcomes || ''}</div>
            </>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
        <button
          type="button"
          className="btn-export"
          disabled={loading}
          onClick={async () => {
            try {
              setLoading(true);
              // Map formData to SL export keys if projectType is service-learning
              let exportFormData = formData;
              if (projectType === 'service-learning') {
                const sdgNumberToLabel = {
                  1: 'No Poverty',
                  2: 'Zero Hunger',
                  3: 'Good Health and Well-Being',
                  4: 'Quality Education',
                  5: 'Gender Equality',
                  6: 'Clean Water and Sanitation',
                  7: 'Affordable and Clean Energy',
                  8: 'Decent Work and Economic Growth',
                  9: 'Industry Innovation and Infrastructure',
                  10: 'Reduced Inequalities',
                  11: 'Sustainable Cities and Communities',
                  12: 'Responsible Consumption and Production',
                  13: 'Climate Action',
                  14: 'Life Below Water',
                  15: 'Life on Land',
                  16: 'Peace, Justice and Strong Institutions',
                  17: 'Partnership for the Goals'
                };
                exportFormData = {
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
              if (projectType === 'community-engagement') {
                if (!ceFields.learningOutcomes || ceFields.learningOutcomes === '') {
                  alert('Please select a Learning Outcomes Level before exporting.');
                  setLoading(false);
                  return;
                }
                const ceSdgNumberToLabel = {
                  1: 'No Poverty',
                  2: 'Zero Hunger',
                  3: 'Good Health and Well-Being',
                  4: 'Quality Education',
                  5: 'Gender Equality',
                  6: 'Clean Water and Sanitation',
                  7: 'Affordable and Clean Energy',
                  8: 'Decent Work and Economic Growth',
                  9: 'Industry Innovation and Infrastructure',
                  10: 'Reduced Inequalities',
                  11: 'Sustainable Cities and Communities',
                  12: 'Responsible Consumption and Production',
                  13: 'Climate Action',
                  14: 'Life Below Water',
                  15: 'Life on Land',
                  16: 'Peace, Justice and Strong Institutions',
                  17: 'Partnership for the Goals'
                };
                const normalize = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
                const validNatures = ['program', 'project/advocacy', 'consultation/extension'];
                const ceLOKeyMap = {
                  '0': 'intellectual development',
                  '1': 'collaboration',
                  '2': 'appreciation of culture and diversity',
                  '3': 'career exploration',
                  '4': 'socio-civic responsibility',
                  '5': 'others'
                };
                let natureArr = ceFields.nature;
                if (!Array.isArray(natureArr)) natureArr = natureArr ? [natureArr] : [];
                natureArr = natureArr.map(normalize).filter(n => validNatures.includes(n));
                let loArr = [];
                if (ceFields.learningOutcomes) {
                  if (Array.isArray(ceFields.learningOutcomes)) {
                    loArr = ceFields.learningOutcomes.map(lo => ceLOKeyMap[lo] || normalize(lo));
                  } else if (typeof ceFields.learningOutcomes === 'string' || typeof ceFields.learningOutcomes === 'number') {
                    loArr = [ceLOKeyMap[ceFields.learningOutcomes] || normalize(ceFields.learningOutcomes)];
                  }
                }
                exportFormData = {
                  communityEngagementTitle: formData.title,
                  dateProposed: new Date().toLocaleString(),
                  proponent: formData.preparedBy,
                  affiliation: formData.affiliation,
                  studentOutcomes: formData.studentOutcomes || '',
                  sdgs: (formData.sdgs || []).map(num => ceSdgNumberToLabel[num] || num),
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
              }
              await exportProposalPDF({
                projectType,
                formData: exportFormData,
                slFields,
                ceFields,
                sdgOptions
              });
            } catch (err) {
              alert('Export error: ' + err);
              console.error('Export error:', err);
            } finally {
              setLoading(false);
            }
          }}
          style={{ background: '#00bcd4', color: '#fff', fontWeight: 600, borderRadius: 20, padding: '10px 28px', fontSize: 16 }}
        >
          Export SL Proposal (PDF)
        </button>
        <button
          type="button"
          className="btn-submit"
          disabled={loading}
          onClick={handleSubmit}
          style={{ background: '#1a237e', color: '#fff', fontWeight: 600, borderRadius: 8, padding: '10px 32px', fontSize: 16 }}
        >
          SUBMIT
        </button>
      </div>
      <div style={{ marginTop: 18, color: '#888', fontSize: 13, textAlign: 'center', maxWidth: 600 }}>
        <b>Important:</b> Review all fields carefully; the proposal is locked and cannot be edited once submitted.
      </div>
    </div>
  );
}

export default SummaryPanel;
