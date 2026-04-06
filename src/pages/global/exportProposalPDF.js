/**
 * Export a Community Engagement Proposal to PDF using a template form.
 * @param {Object} formData - The proposal form data.
 * @param {string} [formUrl='/assets/Community Engagement Proposal.pdf'] - The URL of the PDF template.
 * @returns {Promise<void>} - Triggers a download of the filled PDF.
 */
export async function exportCommunityEngagementProposalPDF(formData, formUrl = '/assets/Community Engagement Proposal.pdf') {
      // DEBUG: Log all field names and types
      try {
        const allFields = form.getFields();
        console.log('PDF Form Fields:');
        allFields.forEach(f => {
          try {
            const name = f.getName();
            const type = f.constructor.name;
            let value = '';
            try { value = f.getText ? f.getText() : ''; } catch {}
            console.log(`Field: ${name}, Type: ${type}, Value: ${value}`);
          } catch {}
        });
      } catch (e) { console.log('Field debug error', e); }
  try {
    const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      window.showToast('No form fields found in this PDF.');
      return;
    }
    // Fill each field with the correct form value
    form.getTextField('text_50ryuo').setText(formData.title || '');
    form.getTextField('text_2unkt').setText(formData.dateProposed || '');
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

    // Learning Outcomes (robust mapping, clear all, then set selected)
    const loMap = {
      'intellectual development': 'checkbox_30btwq',
      'career exploration': 'checkbox_33savz',
      'collaboration': 'checkbox_31tkfd',
      'socio-civic responsibility': 'checkbox_34kdal',
      'appreciation of culture and diversity': 'checkbox_32qnm',
      'others': 'checkbox_35vxii',
      'others, pls. specify': 'checkbox_35vxii',
    };
    const normalizeLO = s => String(s).replace(/\s+/g, ' ').replace(/\./g, '').replace(/,/g, '').trim().toLowerCase();
    // Clear all LO fields first
    Object.values(loMap).forEach(field => {
      try {
        const cb = form.getCheckBox(field);
        if (typeof cb.uncheck === 'function') cb.uncheck();
        if (typeof cb.setValue === 'function') cb.setValue('Off');
      } catch {}
    });
    // Accept both string and number keys (e.g., '0', '1', ... or label)
    const loKeyMap = {
      '0': 'intellectual development',
      '1': 'career exploration',
      '2': 'collaboration',
      '3': 'socio-civic responsibility',
      '4': 'appreciation of culture and diversity',
      '5': 'others',
    };
    let learningOutcomesArr = [];
    if (formData.learningOutcomes !== undefined && formData.learningOutcomes !== null) {
      if (Array.isArray(formData.learningOutcomes)) {
        learningOutcomesArr = formData.learningOutcomes;
      } else if (typeof formData.learningOutcomes === 'string' || typeof formData.learningOutcomes === 'number') {
        learningOutcomesArr = [formData.learningOutcomes];
      }
    }
    const selectedLOs = learningOutcomesArr.map(lo => {
      if (typeof lo === 'string' && loKeyMap[lo.trim()]) {
        return loKeyMap[lo.trim()];
      }
      return normalizeLO(lo);
    });
    Object.entries(loMap).forEach(([lo, field]) => {
      try {
        if (selectedLOs.includes(lo)) {
          // Try checkbox logic first
          try {
            const cb = form.getCheckBox(field);
            if (typeof cb.check === 'function') cb.check();
            if (typeof cb.setValue === 'function') cb.setValue('Yes');
          } catch {
            // Fallback to text field logic
            try {
              form.getTextField(field).setText('X');
            } catch {}
          }
        }
      } catch {}
    });

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
    window.showToast('PDF Export Error: ' + err);
    console.error('PDF Export Error:', err);
  }
}






import { PDFDocument } from 'pdf-lib';


// =============================
// Service Learning (SL) Export
// =============================
export async function exportSLProposalPDF({ formData, slFields, sdgOptions, returnUrl = false }) {
      // Debug: Log missing or undefined fields
      const requiredFields = [
        'proposalTitle',
        'dateProposed',
        'participatingSections',
        'proponent',
        'courseTitle',
        'courseCode',
        'targetDates',
        'targetLocation',
        'sdgs',
        'proposalDescription',
        'proposalObjectives',
        'specificActivities',
        'successIndicators',
        'budget',
        'stakeholders',
        'volunteerHours'
      ];
      const missingFields = requiredFields.filter(f => formData[f] === undefined || formData[f] === null);
      if (missingFields.length > 0) {
        console.warn('SL Export: Missing or undefined fields:', missingFields);
      }
  try {
    const formUrl = '/assets/SL-Proposal-Form-32.pdf';
    const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      window.showToast('No form fields found in this PDF.');
      return;
    }
    // Fill each field with the correct form value (NEW MAPPING)
    form.getTextField('text_19pykj').setText(formData.proposalTitle || '');
    form.getTextField('text_20ta').setText(formData.dateProposed || '');
    form.getTextField('text_21ezok').setText(formData.proponent || '');
    form.getTextField('textarea_25nitg').setText(formData.participatingSections || '');
    form.getTextField('text_22bjc').setText(formData.courseTitle || '');
    form.getTextField('text_27xsue').setText(formData.courseCode || '');
    const slStakeholdersField = form.getTextField('textarea_23zuvj');
    try { slStakeholdersField.enableMultiline(); } catch {}
    slStakeholdersField.setFontSize(8);
    slStakeholdersField.setText(formData.stakeholders || '');
    form.getTextField('text_28odnz').setText(formData.targetDates || '');
    const slLocationField = form.getTextField('text_24dmff');
    try { slLocationField.enableMultiline(); } catch {}
    slLocationField.setFontSize(8);
    slLocationField.setText(formData.targetLocation || '');
    form.getTextField('text_29svdr').setText(formData.volunteerHours?.toString() || '');

    // SDG Checkboxes mapping (NEW)
    const slSdgCheckboxMap = [
      { field: 'text_1pjgf', label: 'No Poverty' },
      { field: 'text_2hjju', label: 'Zero Hunger' },
      { field: 'text_3zkwd', label: 'Good Health and Well-Being' },
      { field: 'text_4xduz', label: 'Quality Education' },
      { field: 'text_5olaq', label: 'Gender Equality' },
      { field: 'text_6htvl', label: 'Clean Water and Sanitation' },
      { field: 'text_7dqvy', label: 'Affordable and Clean Energy' },
      { field: 'text_8twfk', label: 'Decent Work and Economic Growth' },
      { field: 'text_9zsjb', label: 'Industry Innovation and Infrastructure' },
      { field: 'text_10aovh', label: 'Reduced Inequalities' },
      { field: 'text_11qwwf', label: 'Sustainable Cities and Communities' },
      { field: 'text_12omwb', label: 'Responsible Consumption and Production' },
      { field: 'text_13fwno', label: 'Climate Action' },
      { field: 'text_14qicw', label: 'Life Below Water' },
      { field: 'text_15lzmv', label: 'Life on Land' },
      { field: 'text_16yome', label: 'Peace, Justice and Strong Institutions' },
      { field: 'text_17qdvc', label: 'Partnership for the Goals' },
    ];
    if (formData.sdgs && Array.isArray(formData.sdgs)) {
      const normalize = s => String(s).replace(/\s+/g, ' ').replace(/\(.*?\)/g, '').replace(/\./g, '').trim().toLowerCase();
      const normalizedSelected = formData.sdgs.map(sdg => normalize(sdg));
      slSdgCheckboxMap.forEach(({ field, label }) => {
        try {
          const normalizedLabel = normalize(label);
          const shouldCheck = normalizedSelected.includes(normalizedLabel);
          form.getTextField(field).setText(shouldCheck ? 'X' : '');
        } catch (e) {
          // Field not found, skip
        }
      });
    }

    form.getTextField('textarea_30spbk').setText(formData.proposalDescription || '');
    form.getTextField('textarea_31waid').setText(formData.proposalObjectives || '');
    form.getTextField('textarea_32gfbz').setText(formData.specificActivities || '');
    form.getTextField('textarea_33pffk').setText(formData.successIndicators || '');
    form.getTextField('textarea_35lsbz').setText((formData.budget || '').replace(/₱/g, 'PHP'));
    try { form.getTextField('text_33ixka').setText(formData.preparedBy || ' '); } catch {}
    try { form.getTextField('text_34fpep').setText(formData.reviewedBy || ' '); } catch {}
    try { form.getTextField('text_35ixwb').setText(formData.recommendedBy || ' '); } catch {}
    try { form.getTextField('text_36qjiq').setText(formData.endorsedBy || ' '); } catch {}
    try { form.getTextField('text_37nyfm').setText(formData.approvedBy || ' '); } catch {}
    form.flatten();
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    if (returnUrl) return url;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.proposalTitle || 'proposal'}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    if (returnUrl) throw err;
    window.showToast('PDF Export Error: ' + err);
    console.error('PDF Export Error:', err);
  }
}

// =============================
// Community Engagement (CE) Export
// =============================
export async function exportCEProposalPDF({ formData, ceFields, sdgOptions, returnUrl = false }) {
      // Learning Outcomes (robust mapping, only mark selected, clear others)
      const loMap = {
        'intellectual development': 'text_26ucos',
        'collaboration': 'text_27rrgo',
        'appreciation of culture and diversity': 'text_28tubq',
        'career exploration': 'text_29pnil',
        'socio-civic responsibility': 'text_30weng',
        'others, pls. specify': 'text_31llnn',
        'others': 'text_31llnn', // fallback for legacy
      };
      // Normalize function for robust matching
      const normalize = s => String(s).replace(/\s+/g, ' ').replace(/\./g, '').replace(/,/g, '').trim().toLowerCase();
      const selectedLOs = formData.learningOutcomes
        ? (Array.isArray(formData.learningOutcomes) ? formData.learningOutcomes.map(lo => normalize(lo)) : [normalize(formData.learningOutcomes)])
        : [];
      Object.entries(loMap).forEach(([lo, field]) => {
        try {
          if (selectedLOs.includes(normalize(lo))) {
            form.getTextField(field).setText('X');
          } else {
            form.getTextField(field).setText('');
          }
        } catch {}
      });
  try {
    const formUrl = '/assets/CE-Proposal-Form-33.pdf';
    const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    let form;
    try {
      form = pdfDoc.getForm();
    } catch {
      window.showToast('No form fields found in this PDF.');
      return;
    }
    // Fill each field with the correct form value (NEW MAPPING)
    form.getTextField('text_1gjss').setText(formData.communityEngagementTitle || '');
    form.getTextField('text_2empx').setText(formData.dateProposed || '');
    form.getTextField('text_3ting').setText(formData.proponent || '');
    const studentOutcomesField = form.getTextField('text_4uee');
    try { studentOutcomesField.enableMultiline(); } catch {}
    const soLen = (formData.studentOutcomes || '').length;
    const soFontSize = soLen > 130 ? 7 : 8;
    studentOutcomesField.setFontSize(soFontSize);
    studentOutcomesField.setText(formData.studentOutcomes || '');

    // SDG Checkboxes mapping (NEW)
    const ceSdgCheckboxMap = [
      { field: 'text_5fity', label: 'No Poverty' },
      { field: 'text_6spsk', label: 'Zero Hunger' },
      { field: 'text_7sezy', label: 'Good Health and Well-Being' },
      { field: 'text_8wldo', label: 'Quality Education' },
      { field: 'text_9gaan', label: 'Gender Equality' },
      { field: 'text_10qqqf', label: 'Clean Water and Sanitation' },
      { field: 'text_11whun', label: 'Affordable and Clean Energy' },
      { field: 'text_18zynl', label: 'Decent Work and Economic Growth' },
      { field: 'text_13jokq', label: 'Industry Innovation and Infrastructure' },
      { field: 'text_14jpbh', label: 'Reduced Inequalities' },
      { field: 'text_15owud', label: 'Sustainable Cities and Communities' },
      { field: 'text_16ilet', label: 'Responsible Consumption and Production' },
      { field: 'text_17ixtn', label: 'Climate Action' },
      { field: 'text_19eahq', label: 'Life Below Water' },
      { field: 'text_20uagp', label: 'Life on Land' },
      { field: 'text_21juni', label: 'Peace, Justice and Strong Institutions' },
      { field: 'text_22bcgy', label: 'Partnership for the Goals' },
    ];
    if (formData.sdgs && Array.isArray(formData.sdgs)) {
      const normalize = s => String(s).replace(/\s+/g, ' ').replace(/\(.*?\)/g, '').replace(/\./g, '').trim().toLowerCase();
      const normalizedSelected = formData.sdgs.map(sdg => normalize(sdg));
      ceSdgCheckboxMap.forEach(({ field, label }) => {
        try {
          const normalizedLabel = normalize(label);
          const shouldCheck = normalizedSelected.includes(normalizedLabel);
          form.getTextField(field).setText(shouldCheck ? 'X' : '');
        } catch (e) {
          // Field not found, skip
        }
      });
    }

    // Nature of Engagement and Learning Outcomes with unique field names
    const natureMap = {
      'program': 'text_23fcew',
      'project/advocacy': 'text_24acgi',
      'consultation/extension': 'text_25iyvh',
    };
    const loMap = {
      'intellectual development': 'text_26ucos',
      'career exploration': 'text_29pnil',
      'collaboration': 'text_27rrgo',
      'socio-civic responsibility': 'text_30weng',
      'appreciation of culture and diversity': 'text_28tubq',
      'others': 'text_31llnn',
    };
    const normalize = s => String(s).replace(/\s+/g, ' ').replace(/\./g, '').replace(/,/g, '').trim().toLowerCase();
    // Clear all fields for Nature of Engagement and Learning Outcomes
    const allNatureFields = Object.values(natureMap);
    const allLOFields = Object.values(loMap);
    allNatureFields.forEach(field => {
      try { form.getTextField(field).setText(''); } catch {}
    });
    allLOFields.forEach(field => {
      try { form.getTextField(field).setText(''); } catch {}
    });
    // Set Nature of Engagement
    const selectedNatures = formData.natureOfEngagement
      ? (Array.isArray(formData.natureOfEngagement) ? formData.natureOfEngagement.map(n => normalize(n)) : [normalize(formData.natureOfEngagement)])
      : [];
    Object.entries(natureMap).forEach(([nature, field]) => {
      try {
        if (selectedNatures.includes(normalize(nature))) {
          form.getTextField(field).setText('X');
        }
      } catch {}
    });
    // Set Learning Outcomes (robust: support both string/number keys and labels, handle undefined/null)
    let learningOutcomesArr = [];
    if (formData.learningOutcomes !== undefined && formData.learningOutcomes !== null) {
      if (Array.isArray(formData.learningOutcomes)) {
        learningOutcomesArr = formData.learningOutcomes;
      } else if (typeof formData.learningOutcomes === 'string' || typeof formData.learningOutcomes === 'number') {
        learningOutcomesArr = [formData.learningOutcomes];
      }
    }
    // Accept both string and number keys (e.g., '0', '1', ... or label)
    const loKeyMap = {
      '0': 'intellectual development',
      '1': 'collaboration',
      '2': 'appreciation of culture and diversity',
      '3': 'career exploration',
      '4': 'socio-civic responsibility',
      '5': 'others',
    };
    const normalizeLO = s => String(s).replace(/\s+/g, ' ').replace(/\./g, '').replace(/,/g, '').trim().toLowerCase();
    const selectedLOs = learningOutcomesArr.map(lo => {
      if (typeof lo === 'string' && loKeyMap[lo.trim()]) {
        return loKeyMap[lo.trim()];
      }
      return normalizeLO(lo);
    });
    // Set only selected LO fields
    Object.entries(loMap).forEach(([lo, field]) => {
      try {
        if (selectedLOs.includes(lo)) {
          // DEBUG: Log before
          try { console.log('Before setText', field, form.getTextField(field).getText()); } catch {}
          // Try all common checkbox values
          try { form.getTextField(field).setText('Yes'); } catch {}
          try { form.getTextField(field).setText('On'); } catch {}
          try { form.getTextField(field).setText('X'); } catch {}
          // DEBUG: Log after
          try { console.log('After setText', field, form.getTextField(field).getText()); } catch {}
        }
      } catch {}
    });

    form.getTextField('text_32nsrl').setText(formData.targetDate || '');
    const ceLocationField = form.getTextField('text_33olvu');
    try { ceLocationField.enableMultiline(); } catch {}
    ceLocationField.setFontSize(8);
    ceLocationField.setText(formData.location || '');
    const ceStakeholdersField = form.getTextField('text_34nwi');
    try { ceStakeholdersField.enableMultiline(); } catch {}
    ceStakeholdersField.setFontSize(8);
    ceStakeholdersField.setText(formData.stakeholders || '');
    form.getTextField('text_35fgvb').setText(formData.numberOfVolunteerHours?.toString() || '');
    form.getTextField('textarea_36deco').setText(formData.ceDescription || '');
    form.getTextField('textarea_37phsy').setText(formData.ceObjectives || '');
    form.getTextField('textarea_38xian').setText(formData.specificActivities || '');
    form.getTextField('textarea_39zrqx').setText(formData.successIndicators || '');
    form.getTextField('text_40bmwp').setText((formData.budget || '').replace(/₱/g, 'PHP'));
    try { form.getTextField('text_41upqr').setText(formData.preparedBy || ' '); } catch {}
    try { form.getTextField('text_42wcjw').setText(formData.reviewedBy || ' '); } catch {}
    try { form.getTextField('text_43zgvm').setText(formData.recommendedBy || ' '); } catch {}
    try { form.getTextField('text_44hegs').setText(formData.endorsedBy || ' '); } catch {}
    try { form.getTextField('text_45mqpp').setText(formData.approvedBy || ' '); } catch {}
    form.flatten();
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    if (returnUrl) return url;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.communityEngagementTitle || 'community_engagement_proposal'}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    if (returnUrl) throw err;
    window.showToast('PDF Export Error: ' + err);
    console.error('PDF Export Error:', err);
  }
}

// =============================
// Unified Export Handler
// =============================
export async function exportProposalPDF({ projectType, formData, slFields, ceFields, sdgOptions, returnUrl = false }) {
  if (projectType === 'service-learning') {
    return await exportSLProposalPDF({ formData, slFields, sdgOptions, returnUrl });
  } else {
    return await exportCEProposalPDF({ formData, ceFields, sdgOptions, returnUrl });
  }
}
