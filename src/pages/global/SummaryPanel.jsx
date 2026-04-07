import { useEffect, useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../../firebaseConfig';
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
  setLoading,
  onClearDraft,
  proposalId,
  existingSignedDocUrl,
}) {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [signedDoc, setSignedDoc] = useState(null);
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'];
  const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

  const handleFileSelect = (file) => {
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      showToast('Unsupported file type. Please upload a PDF, image, Word, or Excel file.');
      return;
    }
    if (file.size > MAX_SIZE) {
      showToast('File is too large. Maximum size is 50 MB.');
      return;
    }
    setSignedDoc(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelect(file);
  };

  /**
   * Handles form submission: creates a mission document in the unified missions collection.
   */
  const handleSubmit = async () => {
    const hasDoc = signedDoc || (proposalId && existingSignedDocUrl);
    if (!hasDoc) {
      showToast('Please upload the signed scanned document before submitting.');
      return;
    }
    setLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        showToast('You must be logged in to submit a proposal');
        setLoading(false);
        return;
      }

      // Upload signed document to Firebase Storage (skip if editing and no new file)
      let signedDocUrl = existingSignedDocUrl || '';
      if (signedDoc) {
        try {
          const ext = signedDoc.name.split('.').pop();
          const storageRef = ref(storage, `proposals/signed/${user.uid}_${Date.now()}.${ext}`);
          const snapshot = await uploadBytes(storageRef, signedDoc);
          signedDocUrl = await getDownloadURL(snapshot.ref);
        } catch (uploadErr) {
          console.error('Failed to upload signed document:', uploadErr);
          showToast('Failed to upload document. Please try again.');
          return;
        }
      }
      const now = serverTimestamp();

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
          reviewedBy: formData.reviewedBy || '',
          recommendedBy: formData.recommendedBy || '',
          affiliatedDepartment: formData.affiliatedDepartment || '',
          partnerSchool: formData.partnerSchool || '',
          signedDocUrl,
        };
        if (projectType === 'service-learning') {
          updateData.slFields = {
            section: slFields.section,
            course: slFields.course,
            courseCode: slFields.courseCode,
            assignedFaculty: slFields.assignedFaculty,
          };
        } else {
          updateData.ceFields = {
            nature: ceFields.nature,
            learningOutcomes: ceFields.learningOutcomes,
            customLearningOutcome: ceFields.customLearningOutcome || '',
            assignedFaculty: ceFields.assignedFaculty || '',
          };
        }
        await updateDoc(doc(db, 'missions', proposalId), updateData);
        showToast('Proposal updated successfully!');
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
        reviewedBy,
        recommendedBy,
        endorsedBy,
        approvedBy,

        // Department & Partner
        affiliatedDepartment: formData.affiliatedDepartment || '',
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

        // Signed document uploaded by proponent
        signedDocUrl,
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
          assignedFaculty: ceFields.assignedFaculty || '',
        };
      }

      // Save to missions collection
      const docRef = await addDoc(collection(db, 'missions'), missionData);

      // Create task subcollection documents from specific activities
      const activities = Array.isArray(formData.specificActivities) ? formData.specificActivities : [];
      for (let i = 0; i < activities.length; i++) {
        try {
          await setDoc(doc(db, 'missions', docRef.id, 'task', String(i)), {
            title: activities[i],
            description: '',
            points: 0,
            type: 'individual',
            createdAt: new Date().toISOString(),
          });
        } catch (taskErr) {
          console.warn('Failed to create task:', activities[i], taskErr);
        }
      }

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

      {/* Signature instruction */}
      <div style={{
        margin: '1rem 0 0',
        padding: '0.75rem 1rem',
        background: '#fffbeb',
        border: '1px solid #fcd34d',
        borderRadius: 8,
        fontSize: '0.85rem',
        color: '#92400e',
        lineHeight: 1.5,
      }}>
        <strong>Before submitting:</strong> Export the PDF above, have it physically signed by your
        <em> Reviewed By</em> and <em>Recommended By</em> signatories, then scan and upload the signed
        document below. The Submit button will be enabled once a document is attached.
      </div>

      {/* Upload bin */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          marginTop: '1rem',
          border: `2px dashed ${isDragOver ? '#30bdb7' : signedDoc ? '#30bdb7' : '#cbd5e0'}`,
          borderRadius: 10,
          background: isDragOver ? '#f0fdfc' : signedDoc ? '#f0fdfc' : '#f9fafb',
          padding: '1.5rem 1rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.txt"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e.target.files?.[0])}
        />
        {signedDoc ? (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📄</div>
            <div style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.9rem' }}>{signedDoc.name}</div>
            <div style={{ color: '#718096', fontSize: '0.78rem', marginTop: 2 }}>
              {(signedDoc.size / 1024).toFixed(0)} KB — click to replace
            </div>
          </>
        ) : proposalId && existingSignedDocUrl ? (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.4rem' }}>📄</div>
            <div style={{ fontWeight: 600, color: '#2d3748', fontSize: '0.9rem' }}>Previously uploaded document</div>
            <div style={{ color: '#718096', fontSize: '0.78rem', marginTop: 2 }}>
              <a href={existingSignedDocUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#30bdb7' }}>View current file</a> — click here to replace it
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: '2rem', color: '#cbd5e0', marginBottom: '0.5rem' }}>☁</div>
            <div style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.9rem' }}>
              Choose a file or drag &amp; drop it here.
            </div>
            <div style={{ color: '#a0aec0', fontSize: '0.78rem', margin: '0.3rem 0 0.75rem' }}>
              txt, docx, pdf, jpeg, xlsx — Up to 50MB
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              style={{
                padding: '6px 20px',
                borderRadius: 6,
                border: '1.5px solid #cbd5e0',
                background: '#fff',
                color: '#4a5568',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Browse files
            </button>
          </>
        )}
      </div>

      {/* Signature confirmation checkbox */}
      {(signedDoc || (proposalId && existingSignedDocUrl)) && (
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.6rem',
          marginTop: '0.85rem',
          cursor: 'pointer',
          fontSize: '0.85rem',
          color: '#4a5568',
          lineHeight: 1.5,
        }}>
          <input
            type="checkbox"
            checked={signatureConfirmed}
            onChange={(e) => setSignatureConfirmed(e.target.checked)}
            style={{ marginTop: 2, accentColor: '#30bdb7', width: 16, height: 16, flexShrink: 0 }}
          />
          <span>
            I confirm that the uploaded document has been physically signed by the{' '}
            <strong>Reviewed By</strong> and <strong>Recommended By</strong> signatories.
          </span>
        </label>
      )}

      <div className="form-actions" style={{ marginTop: '1rem' }}>
        <button type="button" className="btn-cancel" onClick={onBack}>Back</button>
        {!signedDoc && (
          <button type="button" className="btn-next" disabled={loading} onClick={handleExport}>
            Export PDF
          </button>
        )}
        <button
          type="button"
          className="btn-submit"
          disabled={loading || !(signedDoc || (proposalId && existingSignedDocUrl)) || !signatureConfirmed}
          onClick={handleSubmit}
        >
          {proposalId ? 'Update Proposal' : 'Submit to CSCE'}
        </button>
      </div>
    </div>
  );
}

export default SummaryPanel;
