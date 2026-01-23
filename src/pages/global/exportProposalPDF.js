/**
 * Export a Community Engagement Proposal to PDF using a template form.
 * @param {Object} formData - The proposal form data.
 * @param {string} [formUrl='/assets/Community Engagement Proposal.pdf'] - The URL of the PDF template.
 * @returns {Promise<void>} - Triggers a download of the filled PDF.
 */
export async function exportCommunityEngagementProposalPDF(formData, formUrl = '/assets/Community Engagement Proposal.pdf') {
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
    form.getTextField('text_50ryuo').setText(formData.title || '');
    form.getTextField('text_2unkt').setText(formData.date || '');
    form.getTextField('text_3xesj').setText(formData.proponent || '');
    form.getTextField('textarea_48tipb').setText(formData.studentOutcomes || '');

    // SDG Checkboxes mapping (updated to match provided field names)
    const sdgCheckboxMap = [
      { field: 'checkbox_9ghlq', label: 'No Poverty' },
      { field: 'checkbox_10qofh', label: 'Zero Hunger' },
      { field: 'checkbox_11eb', label: 'Good Health and Well-being' },
      { field: 'checkbox_12busz', label: 'Quality Education' },
      { field: 'checkbox_14ogu', label: 'Gender Equality' },
      { field: 'checkbox_15anqh', label: 'Clean Water and Sanitation' },
      { field: 'checkbox_16sgix', label: 'A ordable and Clean Energy' },
      { field: 'checkbox_17bnjhdbw', label: 'Decent Work and Economic growth' },
      { field: 'checkbox_18qrua', label: 'Industry, Innovation, and Infrastructure' },
      { field: 'checkbox_19kzlh', label: 'Reduced Inequalities' },
      { field: 'checkbox_19kzlh', label: 'Sustainable Cities and Communities' },
      { field: 'checkbox_21mmcs', label: 'Responsible Consumption and Production' },
      { field: 'checkbox_22tcpr', label: 'Climate Action' },
      { field: 'checkbox_23ea', label: 'Life Below Water' },
      { field: 'checkbox_24opun', label: 'Life on Land' },
      { field: 'checkbox_25awsq', label: 'Peace, Justice, and Strong Institutions' },
      { field: 'checkbox_26xiot', label: 'Partnership for the Goals' },
    ];
    if (formData.sdgs && Array.isArray(formData.sdgs)) {
      // Normalize SDG names and also match SDG numbers robustly
      const normalize = s => String(s).replace(/\s+/g, ' ').replace(/\(.*?\)/g, '').replace(/\./g, '').trim().toLowerCase();
      // Build a set of selected SDG numbers and normalized names
      const selectedNumbers = formData.sdgs.map(sdg => typeof sdg === 'number' ? sdg : parseInt(sdg)).filter(n => !isNaN(n));
      const normalizedSelected = formData.sdgs.map(sdg => normalize(sdg));
      sdgCheckboxMap.forEach(({ field, label }, idx) => {
        try {
          const cb = form.getCheckBox(field);
          const normalizedLabel = normalize(label);
          // Try to match by normalized name or by SDG number (idx+1)
          const sdgNumber = idx + 1;
          const labelHasNumber = label.match(/\((\d+)\)/);
          const labelNumber = labelHasNumber ? parseInt(labelHasNumber[1]) : sdgNumber;
          const shouldCheck = normalizedSelected.includes(normalizedLabel) || selectedNumbers.includes(labelNumber);
          // Debug log for troubleshooting
          console.log('SDG export:', { label, field, normalizedLabel, labelNumber, shouldCheck, selectedNumbers, normalizedSelected });
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

    // Nature of Engagement
    if (formData.nature) {
      const natureMap = {
        'program': 'checkbox_27iorz',
        'project/advocacy': 'checkbox_28qjyy',
        'consultation/extension': 'checkbox_29rrbl',
      };
      const field = natureMap[formData.nature.toLowerCase()];
      if (field) {
        try {
          const cb = form.getCheckBox(field);
          if (typeof cb.check === 'function') cb.check();
          if (typeof cb.setValue === 'function') cb.setValue('Yes');
        } catch {}
      }
    }

    // Learning Outcomes
    if (formData.learningOutcomes) {
      const loMap = {
        '0': 'checkbox_30btwq', // Intellectual Development
        '1': 'checkbox_33savz', // Career Exploration
        '2': 'checkbox_31tkfd', // Collaboration
        '3': 'checkbox_34kdal', // Socio-civic responsibility
        '4': 'checkbox_32qnm', // Appreciation, culture and Diversity
        '5': 'checkbox_35vxii', // Others, pls. specify
      };
      const field = loMap[formData.learningOutcomes];
      if (field) {
        try {
          const cb = form.getCheckBox(field);
          if (typeof cb.check === 'function') cb.check();
          if (typeof cb.setValue === 'function') cb.setValue('Yes');
        } catch {}
      }
    }

    // Other fields
    form.getTextField('text_36gklh').setText(formData.targetDate || '');
    form.getTextField('textarea_40zyhk').setText(formData.stakeholders || '');
    form.getTextField('textarea_41fakl').setText(formData.location || '');
    form.getTextField('textarea_43umtx').setText(formData.description || '');
    form.getTextField('textarea_44xwjd').setText(formData.objectives || '');
    form.getTextField('textarea_45oxhg').setText(formData.specificActivities || '');
    form.getTextField('textarea_46hsmz').setText(formData.successIndicators || '');
    form.getTextField('textarea_47lzdh').setText((formData.budget || '').replace(/₱/g, 'PHP'));
    // Volunteer Hours (for CE form)
    if (form.getTextField && formData.volunteerHours !== undefined) {
      try {
        form.getTextField('text_37volh').setText(formData.volunteerHours.toString());
      } catch (e) {
        // Field not found, skip
      }
    }

    form.flatten();
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.title || 'community_engagement_proposal'}.pdf`;
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






import { PDFDocument } from 'pdf-lib';


// =============================
// Service Learning (SL) Export
// =============================
export async function exportSLProposalPDF({ formData, slFields, sdgOptions }) {
  try {
    const formUrl = '/assets/Proposal Form 32.pdf';
    const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      alert('No form fields found in this PDF.');
      return;
    }
    // Map SDG numbers to names
    const sdgNames = formData.sdg && Array.isArray(formData.sdg)
      ? formData.sdg.map(num => {
          const sdgObj = sdgOptions.find(opt => opt.number === num);
          return sdgObj ? sdgObj.name : '';
        })
      : [];
    // Fill each field with the correct form value
    form.getTextField('text_2cqcm').setText(formData.title || '');
    form.getTextField('text_3hzck').setText(formData.faculty || formData.proponent || '');
    form.getTextField('text_4opji').setText(slFields.course || '');
    form.getTextField('text_5fdvm').setText(formData.stakeholders || '');
    form.getTextField('text_6avjw').setText(formData.location || '');
    form.getTextField('text_7cxg').setText(formData.targetDate || formData.dateproposed || '');
    form.getTextField('text_8ylsk').setText(slFields.section || '');
    form.getTextField('text_9nnpw').setText(slFields.courseCode || '');
    form.getTextField('text_10dky').setText(formData.targetDate || '');
    form.getTextField('text_11ecqo').setText(formData.volunteerHours?.toString() || formData.hours?.toString() || '');
    form.getTextField('textarea_31qotr').setText(formData.description || '');
    form.getTextField('textarea_32sqrh').setText(formData.objectives || '');
    form.getTextField('textarea_33vrob').setText(formData.specificActivities || '');
    form.getTextField('textarea_34pgia').setText(formData.successIndicators || '');
    form.getTextField('text_35uwrn').setText((formData.budget || '').replace(/₱/g, 'PHP'));
    // SDG Checkboxes mapping (SL)
    const slSdgCheckboxMap = [
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
    if (sdgNames && Array.isArray(sdgNames)) {
      slSdgCheckboxMap.forEach(({ field, label }) => {
        try {
          const cb = form.getCheckBox(field);
          const shouldCheck = sdgNames.some(sdg => sdg.trim().toLowerCase() === label.trim().toLowerCase());
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

// =============================
// Community Engagement (CE) Export
// =============================
export async function exportCEProposalPDF({ formData, ceFields, sdgOptions }) {
  try {
    const formUrl = '/assets/Community Engagement Proposal.pdf';
    const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      alert('No form fields found in this PDF.');
      return;
    }
    // Map SDG numbers to names
    const sdgNames = formData.sdg && Array.isArray(formData.sdg)
      ? formData.sdg.map(num => {
          const sdgObj = sdgOptions.find(opt => opt.number === num);
          return sdgObj ? sdgObj.name : '';
        })
      : [];
    // Fill each field with the correct form value
    form.getTextField('text_50ryuo').setText(formData.title || '');
    form.getTextField('text_2unkt').setText(formData.targetDate || '');
    form.getTextField('text_3xesj').setText(formData.faculty || formData.proponent || '');
    form.getTextField('textarea_48tipb').setText(ceFields.customLearningOutcome || '');
    // SDG Checkboxes mapping (CE)
    const ceSdgCheckboxMap = [
      { field: 'checkbox_9ghlq', label: 'No Poverty' },
      { field: 'checkbox_10qofh', label: 'Zero Hunger' },
      { field: 'checkbox_11eb', label: 'Good Health and Well-being' },
      { field: 'checkbox_12busz', label: 'Quality Education' },
      { field: 'checkbox_14ogu', label: 'Gender Equality' },
      { field: 'checkbox_15anqh', label: 'Clean Water and Sanitation' },
      { field: 'checkbox_16sgix', label: 'A ordable and Clean Energy' },
      { field: 'checkbox_17bnjhdbw', label: 'Decent Work and Economic growth' },
      { field: 'checkbox_18qrua', label: 'Industry, Innovation, and Infrastructure' },
      { field: 'checkbox_19kzlh', label: 'Reduced Inequalities' },
      { field: 'checkbox_21mmcs', label: 'Responsible Consumption and Production' },
      { field: 'checkbox_22tcpr', label: 'Climate Action' },
      { field: 'checkbox_23ea', label: 'Life Below Water' },
      { field: 'checkbox_24opun', label: 'Life on Land' },
      { field: 'checkbox_25awsq', label: 'Peace, Justice, and Strong Institutions' },
      { field: 'checkbox_26xiot', label: 'Partnership for the Goals' },
      { field: 'checkbox_19kzlh', label: 'Sustainable Cities and Communities' }, // Only once, at the end for clarity if needed
    ];
    if (sdgNames && Array.isArray(sdgNames)) {
      ceSdgCheckboxMap.forEach(({ field, label }) => {
        try {
          const cb = form.getCheckBox(field);
          const shouldCheck = sdgNames.some(sdg => sdg.trim().toLowerCase() === label.trim().toLowerCase());
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
    // Nature of Engagement
    if (ceFields.nature) {
      const natureMap = {
        'program': 'checkbox_27iorz',
        'project/advocacy': 'checkbox_28qjyy',
        'consultation/extension': 'checkbox_29rrbl',
      };
      const field = natureMap[ceFields.nature.toLowerCase()];
      if (field) {
        try {
          const cb = form.getCheckBox(field);
          if (typeof cb.check === 'function') cb.check();
          if (typeof cb.setValue === 'function') cb.setValue('Yes');
        } catch {}
      }
    }
    // Learning Outcomes
    if (ceFields.learningOutcomes) {
      const loMap = {
        '0': 'checkbox_30btwq', // Intellectual Development
        '1': 'checkbox_33savz', // Career Exploration
        '2': 'checkbox_31tkfd', // Collaboration
        '3': 'checkbox_34kdal', // Socio-civic responsibility
        '4': 'checkbox_32qnm', // Appreciation, culture and Diversity
        '5': 'checkbox_35vxii', // Others, pls. specify
      };
      const field = loMap[ceFields.learningOutcomes];
      if (field) {
        try {
          const cb = form.getCheckBox(field);
          if (typeof cb.check === 'function') cb.check();
          if (typeof cb.setValue === 'function') cb.setValue('Yes');
        } catch {}
      }
    }
    // Other fields
    form.getTextField('text_36gklh').setText(formData.targetDate || '');
    form.getTextField('textarea_40zyhk').setText(formData.stakeholders || '');
    form.getTextField('textarea_41fakl').setText(formData.location || '');
    form.getTextField('textarea_43umtx').setText(formData.description || '');
    form.getTextField('textarea_44xwjd').setText(formData.objectives || '');
    form.getTextField('textarea_45oxhg').setText(formData.specificActivities || '');
    form.getTextField('textarea_46hsmz').setText(formData.successIndicators || '');
    form.getTextField('textarea_47lzdh').setText((formData.budget || '').replace(/₱/g, 'PHP'));
    // Volunteer Hours (for CE form)
    if (form.getTextField && formData.volunteerHours !== undefined) {
      try {
        form.getTextField('text_37volh').setText(formData.volunteerHours.toString());
      } catch (e) {
        // Field not found, skip
      }
    }
    form.flatten();
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.title || 'community_engagement_proposal'}.pdf`;
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

// =============================
// Unified Export Handler
// =============================
export async function exportProposalPDF({ projectType, formData, slFields, ceFields, sdgOptions }) {
  if (projectType === 'service-learning') {
    await exportSLProposalPDF({ formData, slFields, sdgOptions });
  } else {
    await exportCEProposalPDF({ formData, ceFields, sdgOptions });
  }
}
