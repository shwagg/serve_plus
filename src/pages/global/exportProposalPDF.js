import { PDFDocument } from 'pdf-lib';

/**
 * Export a Service-Learning Proposal to PDF using a template form.
 * @param {Object} formData - The proposal form data.
 * @param {Array} activities - The list of activities.
 * @param {string} [formUrl='/assets/Proposal Form 32.pdf'] - The URL of the PDF template.
 * @returns {Promise<void>} - Triggers a download of the filled PDF.
 */
export async function exportProposalPDF(formData, activities, formUrl = '/assets/Proposal Form 32.pdf') {
  try {
    const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      alert('No form fields found in this PDF.');
      return;
    }
    // Fill each field with the correct form value
    form.getTextField('text_2cqcm').setText(formData.title || '');
    form.getTextField('text_3hzck').setText(formData.faculty || formData.proponent || '');
    form.getTextField('text_4opji').setText(formData.courseTitle || formData.coursetitle || '');
    form.getTextField('text_5fdvm').setText(formData.stakeholders || '');
    form.getTextField('text_6avjw').setText(formData.targetLocation || formData.targetlocation || '');
    form.getTextField('text_7cxg').setText(formData.date || formData.dateproposed || '');
    form.getTextField('text_8ylsk').setText(formData.sections || '');
    form.getTextField('text_9nnpw').setText(formData.courseCode || formData.coursecode || '');
    form.getTextField('text_10dky').setText(formData.targetDates || formData.targetdates || '');
    form.getTextField('text_11ecqo').setText(formData.volunteerHours?.toString() || formData.hours?.toString() || '');
    form.getTextField('textarea_31qotr').setText(formData.description || '');
    form.getTextField('textarea_32sqrh').setText(formData.objectives || '');
    form.getTextField('textarea_33vrob').setText(
      (activities && activities.length > 0)
        ? activities.map((act, idx) => `${idx+1}. ${act.title}`).join('\n')
        : formData.specificactivities || ''
    );
    form.getTextField('textarea_34pgia').setText(formData.indicators || formData.successindicators || '');
    form.getTextField('text_35uwrn').setText((formData.budget || '').replace(/₱/g, 'PHP'));
    // SDG Checkboxes mapping
    const sdgCheckboxMap = [
      { field: 'checkbox_13ofpt', label: 'No Poverty' },
      { field: 'checkbox_17idjm', label: 'Zero Hunger' },
      { field: 'checkbox_20womi', label: 'Good Health and Well-Being' },
      { field: 'checkbox_23svwh', label: 'Quality Education' },
      { field: 'checkbox_26shtn', label: 'Gender Equality' },
      { field: 'checkbox_29apra', label: 'Clean Water and Sanitation' },
      { field: 'checkbox_14zvvw', label: 'Affordable and Clean Energy' },
      { field: 'checkbox_18fzxs', label: 'Decent Work and Economic Growth' },
      { field: 'checkbox_21kwei', label: 'Industry, Innovation, and Infrastructure' },
      { field: 'checkbox_24wogc', label: 'Reduced Inequalities' },
      { field: 'checkbox_27wlsf', label: 'Sustainable Cities and Communities' },
      { field: 'checkbox_30ultz', label: 'Responsible Consumption and Production' },
      { field: 'checkbox_15cxua', label: 'Climate Action' },
      { field: 'checkbox_19bdjk', label: 'Life Below Water' },
      { field: 'checkbox_22mcqk', label: 'Life on Land' },
      { field: 'checkbox_25sdjc', label: 'Peace, Justice, and Strong Institutions' },
      { field: 'checkbox_28rpwo', label: 'Partnership for the Goals' },
    ];
    if (formData.sdgs && Array.isArray(formData.sdgs)) {
      sdgCheckboxMap.forEach(({ field, label }) => {
        try {
          const cb = form.getCheckBox(field);
          const shouldCheck = formData.sdgs.some(sdg => sdg.trim().toLowerCase() === label.trim().toLowerCase());
          if (shouldCheck) {
            if (typeof cb.check === 'function') cb.check();
            if (typeof cb.setValue === 'function') cb.setValue('Yes');
          } else {
            if (typeof cb.uncheck === 'function') cb.uncheck();
            if (typeof cb.setValue === 'function') cb.setValue('Off');
          }
        } catch (e) {
          // Field not found, skip
        }
      });
    }
    form.flatten();
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.title || 'proposal'}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    alert('PDF Export Error: ' + err);
    console.error('PDF Export Error:', err);
  }
}
