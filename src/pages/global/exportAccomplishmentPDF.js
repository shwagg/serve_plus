import { PDFDocument } from 'pdf-lib';

// ─────────────────────────────────────────────────────────────
// Helper: safe setText — silently skips missing/wrong-type fields
// ─────────────────────────────────────────────────────────────
function setText(form, fieldName, value) {
  try {
    form.getTextField(fieldName).setText(String(value ?? ''));
  } catch {
    // field not found or wrong type — skip
  }
}

// ─────────────────────────────────────────────────────────────
// SL Accomplishment Report  (CSCE-FORM-040A-12)
// Template: /assets/Accomplishment Report (SL).pdf
// ─────────────────────────────────────────────────────────────
export async function exportSLAccomplishmentPDF({ formData, returnUrl = false }) {
  try {
    const formUrl = '/assets/Accomplishment%20Report%20(SL).pdf';
    const existingPdfBytes = await fetch(formUrl).then(res => {
      if (!res.ok) throw new Error(`Failed to fetch PDF template: ${res.status}`);
      return res.arrayBuffer();
    });
    const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    // ── Section I: Background Information ──────────────────
    setText(form, 'text_1dblj',    formData.leaderName);
    setText(form, 'textarea_2ndhx', formData.activityTitle);
    setText(form, 'textarea_3axie', formData.location);
    setText(form, 'textarea_4pz',   formData.sdgs);
    setText(form, 'textarea_5dxpw', String(formData.volunteerHours ?? ''));

    setText(form, 'text_6ttje',    formData.plannedStart);
    setText(form, 'text_7xree',    formData.plannedEnd);
    setText(form, 'text_8jopt',    formData.actualStart);
    setText(form, 'text_9lfwv',    formData.actualEnd);

    setText(form, 'text_11azzp',   formData.proposedBudget);
    setText(form, 'text_12dvbe',   formData.incurredBudget);

    // ── Section II: Results ────────────────────────────────
    setText(form, 'textarea_13klcf', formData.goalsObjectives);
    setText(form, 'textarea_14spgv', formData.extentAchieved);
    setText(form, 'textarea_15arcd', formData.recommendations);
    setText(form, 'textarea_16dfzf', formData.beneWho);
    setText(form, 'textarea_17fdem', formData.beneWhat);
    setText(form, 'textarea_18bmmz', String(formData.beneCount ?? ''));

    // ── Section III: Follow-Up ─────────────────────────────
    setText(form, 'textarea_19tanq', formData.followUpPlans);

    // ── Section IV: Comments / Recommendations ─────────────
    setText(form, 'textarea_20qrbf', formData.comments);


    // ── Section VI: Declaration ────────────────────────────
    // signature_22krxk — physical signature field, skip
    setText(form, 'text_21utnv', formData.declarationName || formData.leaderName); // Faculty-in charge / Proponent
    setText(form, 'text_23bpwj', formData.declarationDate || new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }));

    // Received by / Noted by — left blank for manual signing
    setText(form, 'text_25ykea', '');
    setText(form, 'text_27hafk', '');

    try { form.flatten(); } catch { /* some PDFs have non-standard XRef entries that pdf-lib can't flatten — skip */ }
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    if (returnUrl) return URL.createObjectURL(blob);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.activityTitle || 'SL-Accomplishment-Report'}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  } catch (err) {
    if (returnUrl) throw err;
    window.showToast?.('PDF Export Error: ' + err.message);
    console.error('SL Accomplishment PDF Export Error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// CE Accomplishment Report  (CSCE-FORM-040B-22)
// Template: /assets/Accomplishment Report (CE).pdf
// ─────────────────────────────────────────────────────────────
export async function exportCEAccomplishmentPDF({ formData, returnUrl = false }) {
  try {
    const formUrl = '/assets/Accomplishment%20Report%20(CE).pdf';
    const existingPdfBytes = await fetch(formUrl).then(res => {
      if (!res.ok) throw new Error(`Failed to fetch PDF template: ${res.status}`);
      return res.arrayBuffer();
    });
    const pdfDoc = await PDFDocument.load(existingPdfBytes, { ignoreEncryption: true });
    const form = pdfDoc.getForm();

    // ── Section I: Background Information ──────────────────
    setText(form, 'text_1ifmc', formData.leaderName);
    setText(form, 'text_2qxwf', formData.activityTitle);

    // Nature of CE (each option is a separate text field marked 'X')
    const nature = (formData.ceNature || '').toLowerCase();
    setText(form, 'text_4gipo', nature.includes('program') ? 'X' : '');
    setText(form, 'text_5nwbj', (nature.includes('project') || nature.includes('advocacy')) ? 'X' : '');
    setText(form, 'text_6csyr', (nature.includes('consultation') || nature.includes('extension')) ? 'X' : '');

    setText(form, 'textarea_7uitm', formData.location);
    setText(form, 'textarea_8gpjx', formData.sdgs);
    setText(form, 'text_9blgf',    String(formData.volunteerHours ?? ''));

    setText(form, 'text_10pfry',   formData.plannedStart);
    setText(form, 'text_11pkfw',   formData.plannedEnd);
    setText(form, 'text_12xtdl',   formData.actualStart);
    setText(form, 'text_13bpnd',   formData.actualEnd);

    setText(form, 'text_14ncwo',   formData.proposedBudget);
    setText(form, 'text_15zqsu',   formData.incurredBudget);

    // ── Section II: Results ────────────────────────────────
    setText(form, 'textarea_16lolv', formData.goalsObjectives);
    setText(form, 'textarea_17xkgw', formData.extentAchieved);
    setText(form, 'textarea_18widc', formData.recommendations);
    setText(form, 'textarea_19ltrx', formData.beneWho);
    setText(form, 'textarea_20kuni', formData.beneWhat); // What benefits?
    setText(form, 'textarea_21rtif', formData.beneWhat); // What involvement? (same field in modal)
    setText(form, 'textarea_22antv', String(formData.beneCount ?? ''));

    // ── Section III: Follow-Up ─────────────────────────────
    setText(form, 'textarea_23ujuc', formData.followUpPlans);

    // ── Section VI: Declaration ────────────────────────────
    setText(form, 'text_24qmb',   formData.declarationName || formData.leaderName);
    // signature_25pvzl — physical signature field, skip
    setText(form, 'text_26jahb',  formData.declarationDate || new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }));

    // Received by / Noted by — left blank for manual signing
    setText(form, 'text_27idhg', '');
    setText(form, 'text_31rwhd', '');

    try { form.flatten(); } catch { /* some PDFs have non-standard XRef entries that pdf-lib can't flatten — skip */ }
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });

    if (returnUrl) return URL.createObjectURL(blob);

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.activityTitle || 'CE-Accomplishment-Report'}.pdf`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  } catch (err) {
    if (returnUrl) throw err;
    window.showToast?.('PDF Export Error: ' + err.message);
    console.error('CE Accomplishment PDF Export Error:', err);
  }
}

// ─────────────────────────────────────────────────────────────
// Unified export handler
// ─────────────────────────────────────────────────────────────
export async function exportAccomplishmentPDF({ projectType, formData, returnUrl = false }) {
  if (projectType === 'sl') {
    return await exportSLAccomplishmentPDF({ formData, returnUrl });
  } else {
    return await exportCEAccomplishmentPDF({ formData, returnUrl });
  }
}
