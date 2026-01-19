import React, { useState } from "react";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

// --- Style constants ---
const addBtnStyle = {
  background: '#fff',
  color: '#1ea7fd',
  border: '1.5px solid #1ea7fd',
  borderRadius: 6,
  padding: '4px 12px',
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  marginRight: 4,
};
const removeBtnStyle = {
  background: 'none',
  color: '#fff',
  border: 'none',
  fontSize: 20,
  fontWeight: 700,
  cursor: 'pointer',
  marginRight: 8,
  lineHeight: 1,
};
const labelStyle = {
  fontWeight: 600,
  marginBottom: 4,
  display: 'block',
  fontSize: 15,
};
const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #b3d1f7',
  borderRadius: 6,
  fontSize: 15,
  marginBottom: 0,
  marginTop: 2,
  background: '#f7f9fa',
  color: '#111',
};
const textareaStyle = {
  width: '100%',
  padding: '10px',
  border: '1px solid #b3d1f7',
  borderRadius: 6,
  fontSize: 15,
  marginTop: 4,
  background: '#f7f9fa',
  color: '#111',
  resize: 'vertical',
};
const buttonStyle = {
  background: '#fff',
  color: '#3386e6',
  border: '1.5px solid #3386e6',
  borderRadius: 6,
  padding: '8px 24px',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
  transition: 'background 0.2s, color 0.2s',
};
const sdgList = [
  { num: 1, label: 'No Poverty' },
  { num: 2, label: 'Zero Hunger' },
  { num: 3, label: 'Good Health and Well-Being' },
  { num: 4, label: 'Quality Education' },
  { num: 5, label: 'Gender Equality' },
  { num: 6, label: 'Clean Water and Sanitation' },
  { num: 7, label: 'Affordable and Clean Energy' },
  { num: 8, label: 'Decent Work and Economic Growth' },
  { num: 9, label: 'Industry, Innovation, and Infrastructure' },
  { num: 10, label: 'Reduced Inequalities' },
  { num: 11, label: 'Sustainable Cities and Communities' },
  { num: 12, label: 'Responsible Consumption and Production' },
  { num: 13, label: 'Climate Action' },
  { num: 14, label: 'Life Below Water' },
  { num: 15, label: 'Life on Land' },
  { num: 16, label: 'Peace, Justice, and Strong Institutions' },
  { num: 17, label: 'Partnership for the Goals' }
];

// --- Main Component ---
export default function ProposeProject() {
  // State and persistence
  const getInitialFormData = () => {
    try {
      const saved = localStorage.getItem('proposalFormData');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: '', date: '', faculty: '', sections: '', courseTitle: '', courseCode: '', stakeholders: '', targetDates: '', targetLocation: '', volunteerHours: '', sdgs: [], description: '', objectives: '', indicators: '', budget: '',
    };
  };
  const getInitialActivities = () => {
    try {
      const saved = localStorage.getItem('proposalActivities');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  };
  const [formData, setFormData] = useState(getInitialFormData);
  const [activities, setActivities] = useState(getInitialActivities);
  React.useEffect(() => { localStorage.setItem('proposalFormData', JSON.stringify(formData)); }, [formData]);
  React.useEffect(() => { localStorage.setItem('proposalActivities', JSON.stringify(activities)); }, [activities]);

  // Handlers
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => {
        let sdgs = prev.sdgs;
        if (checked) sdgs = [...sdgs, value];
        else sdgs = sdgs.filter(s => s !== value);
        return { ...prev, sdgs };
      });
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  const addActivity = () => {
    setActivities(prev => ([...prev, { id: Date.now(), title: '', date: '' }]));
  };
  const updateActivity = (id, field, value) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };
  const removeActivity = id => setActivities(prev => prev.filter(a => a.id !== id));

  // PDF Export Handler
  const handleExport = async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]);
    const { height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let y = height - 40;
    const drawText = (label, value, yOffset = 20) => {
      page.drawText(label, { x: 40, y: y, size: 12, font, color: rgb(0,0,0) });
      page.drawText(value, { x: 200, y: y, size: 12, font, color: rgb(0,0,0) });
      y -= yOffset;
    };
    drawText('Title:', formData.title || '-');
    drawText('Date Proposed:', formData.date || '-');
    drawText('Faculty-In-Charge:', formData.faculty || '-');
    drawText('Sections:', formData.sections || '-');
    drawText('Course Title:', formData.courseTitle || '-');
    drawText('Course Code:', formData.courseCode || '-');
    drawText('Stakeholders:', formData.stakeholders || '-');
    drawText('Target Dates:', formData.targetDates || '-');
    drawText('Target Location:', formData.targetLocation || '-');
    drawText('Volunteer Hours:', formData.volunteerHours?.toString() || '-');
    drawText('SDGs:', (formData.sdgs && formData.sdgs.length > 0) ? formData.sdgs.join(', ') : '-');
    y -= 10;
    drawText('Description:', formData.description || '-');
    y -= 10;
    drawText('Objectives:', formData.objectives || '-');
    y -= 10;
    drawText('Indicators:', formData.indicators || '-');
    y -= 10;
    drawText('Budget:', formData.budget || '-');
    y -= 20;
    page.drawText('Activities:', { x: 40, y: y, size: 12, font, color: rgb(0,0,0) });
    y -= 20;
    if (activities && activities.length > 0) {
      activities.forEach((act, idx) => {
        page.drawText(`${idx+1}. ${act.title || '-'} (${act.date || '-'})`, { x: 60, y: y, size: 11, font, color: rgb(0,0,0) });
        y -= 16;
      });
    } else {
      page.drawText('No activities listed.', { x: 60, y: y, size: 11, font, color: rgb(0,0,0) });
      y -= 16;
    }
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
  };

  // Render single-page form
  return (
    <div style={{ background: '#f7f9fa', minHeight: '100vh', padding: '2rem' }}>
      <div style={{ maxWidth: 900, margin: '2rem auto', background: 'linear-gradient(180deg, #3386e6 0%, #2566b3 100%)', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: 32, color: '#fff', position: 'relative' }}>
        <h2 style={{ margin: 0, fontWeight: 700, fontSize: 28, marginBottom: 24 }}>Service-Learning Proposal</h2>
        <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} autoComplete="off">
          {/* Basic Info */}
          <h3 style={{ marginBottom: 16 }}>Basic Information</h3>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Title of Service-Learning Initiative</label>
              <input style={inputStyle} type="text" name="title" value={formData.title} onChange={handleChange} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Date Proposed</label>
              <input style={inputStyle} type="date" name="date" value={formData.date} onChange={handleChange} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Faculty-In-Charge / Proponent(s)</label>
              <input style={inputStyle} type="text" name="faculty" value={formData.faculty} onChange={handleChange} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Participating Section(s)</label>
              <input style={inputStyle} type="text" name="sections" value={formData.sections} onChange={handleChange} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Course Title</label>
              <input style={inputStyle} type="text" name="courseTitle" value={formData.courseTitle} onChange={handleChange} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Course Code</label>
              <input style={inputStyle} type="text" name="courseCode" value={formData.courseCode} onChange={handleChange} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Stakeholders</label>
              <input style={inputStyle} type="text" name="stakeholders" value={formData.stakeholders} onChange={handleChange} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Target Dates</label>
              <input style={inputStyle} type="date" name="targetDates" value={formData.targetDates} onChange={handleChange} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Target Location</label>
              <input style={inputStyle} type="text" name="targetLocation" value={formData.targetLocation} onChange={handleChange} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Number of Volunteer Hours</label>
              <input style={inputStyle} type="number" name="volunteerHours" value={formData.volunteerHours} onChange={handleChange} />
            </div>
          </div>
          {/* SDGs */}
          <div style={{ marginBottom: 8, fontWeight: 600 }}>SDG(s)</div>
          <div style={{ marginBottom: 8, fontSize: 13, color: '#888' }}>Note: Please check the targeted SDG Number and Goal that applies.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#f7f9fa', border: '1px solid #b3d1f7', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            {sdgList.map((sdg, i) => (
              <label key={sdg.num} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500 }}>
                <input type="checkbox" style={{ accentColor: '#3386e6', width: 18, height: 18 }} name="sdgs" value={sdg.label} checked={formData.sdgs.includes(sdg.label)} onChange={handleChange} />
                {sdg.num}. {sdg.label}
              </label>
            ))}
          </div>
          {/* Description, Objectives, Indicators, Budget */}
          <h3 style={{ marginBottom: 16 }}>Project Details</h3>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Description</label>
            <textarea style={textareaStyle} rows={4} name="description" value={formData.description} onChange={handleChange} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Objectives</label>
            <textarea style={textareaStyle} rows={4} name="objectives" value={formData.objectives} onChange={handleChange} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Success Indicators</label>
            <textarea style={textareaStyle} rows={4} name="indicators" value={formData.indicators} onChange={handleChange} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Budget</label>
            <input style={inputStyle} type="text" name="budget" value={formData.budget} onChange={handleChange} />
          </div>
          {/* Activities */}
          <h3 style={{ marginBottom: 16 }}>Activities</h3>
          <div style={{ marginBottom: 16 }}>
            <button type="button" style={addBtnStyle} onClick={addActivity}>Add Activity</button>
          </div>
          {activities.length === 0 && <div style={{ color: '#888', marginBottom: 16 }}>No activities added yet.</div>}
          {activities.map((act, idx) => (
            <div key={act.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input style={{ ...inputStyle, flex: 2 }} type="text" placeholder="Activity Title" value={act.title} onChange={e => updateActivity(act.id, 'title', e.target.value)} />
              <input style={{ ...inputStyle, flex: 1 }} type="date" placeholder="Date" value={act.date} onChange={e => updateActivity(act.id, 'date', e.target.value)} />
              <button type="button" style={removeBtnStyle} onClick={() => removeActivity(act.id)} title="Remove Activity">×</button>
            </div>
          ))}
          {/* Review/Export */}
          <h3 style={{ margin: '32px 0 16px 0' }}>Review & Export</h3>
          <div style={{ marginBottom: 16 }}>
            <strong>Title:</strong> {formData.title}<br />
            <strong>Date Proposed:</strong> {formData.date}<br />
            <strong>Faculty-In-Charge:</strong> {formData.faculty}<br />
            <strong>Sections:</strong> {formData.sections}<br />
            <strong>Course Title:</strong> {formData.courseTitle}<br />
            <strong>Course Code:</strong> {formData.courseCode}<br />
            <strong>Stakeholders:</strong> {formData.stakeholders}<br />
            <strong>Target Dates:</strong> {formData.targetDates}<br />
            <strong>Target Location:</strong> {formData.targetLocation}<br />
            <strong>Volunteer Hours:</strong> {formData.volunteerHours}<br />
            <strong>SDGs:</strong> {(formData.sdgs && formData.sdgs.length > 0) ? formData.sdgs.join(', ') : '-'}<br />
            <strong>Description:</strong> {formData.description}<br />
            <strong>Objectives:</strong> {formData.objectives}<br />
            <strong>Indicators:</strong> {formData.indicators}<br />
            <strong>Budget:</strong> {formData.budget}<br />
          </div>
          <div style={{ marginBottom: 16 }}>
            <strong>Activities:</strong>
            <ul>
              {activities && activities.length > 0 ? activities.map((act, idx) => (
                <li key={idx}>{act.title} ({act.date})</li>
              )) : <li>No activities listed.</li>}
            </ul>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" style={buttonStyle} onClick={handleExport}>EXPORT TO PDF</button>
          </div>
        </form>
      </div>
    </div>
  );
}