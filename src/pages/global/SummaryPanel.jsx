import React, { useEffect, useState } from 'react';
import { PDFDocument } from 'pdf-lib';

function SummaryPanel({
  formData,
  slFields,
  ceFields,
  projectType,
  loading,
  onBack,
  onExport,
  onSubmit
}) {
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

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
          form.getTextField('Faculty').setText(formData.faculty || '');
          form.getTextField('TargetDate').setText(formData.targetDate || '');
          form.getTextField('SDG').setText((formData.sdg || []).join(', '));
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
        } catch (e) {}
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
          {pdfPreviewUrl && (
            <iframe
              src={pdfPreviewUrl}
              width="100%"
              height="520"
              style={{ border: '1px solid #ccc', borderRadius: 8, background: '#fff', boxShadow: '0 2px 8px #eee' }}
              title="PDF Preview"
            />
          )}
        </div>
        {/* Summary details on the right */}
        <div style={{ flex: 1.2, minWidth: 400, maxWidth: 700, background: '#fff', padding: '40px 48px', borderRadius: 20, boxShadow: '0 2px 12px #e0e0e0', color: '#222', display: 'flex', flexDirection: 'column', gap: 16, border: '1.5px solid #e0e0e0' }}>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#1a237e' }}>{formData.title}</div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 8 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Published by:</div>
              <div>{formData.faculty}</div>
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
          <div><b>SDGs:</b> {(formData.sdg || []).join(', ')}</div>
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
          onClick={onExport}
          style={{ background: '#00bcd4', color: '#fff', fontWeight: 600, borderRadius: 20, padding: '10px 28px', fontSize: 16 }}
        >
          Export SL Proposal (PDF)
        </button>
        <button
          type="button"
          className="btn-submit"
          disabled={loading}
          onClick={onSubmit}
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
