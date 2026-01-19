import React, { useState } from "react";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

function ActivityModal({ open, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("");
  const [coreSkills, setCoreSkills] = useState("");
  const [techSkills, setTechSkills] = useState("");
  const [projSkills, setProjSkills] = useState("");

  if (!open) return null;
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', border: '3px solid #2196f3', borderRadius: 14, padding: 0, minWidth: 500, minHeight: 320, boxShadow: '0 4px 24px rgba(0,0,0,0.15)', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar with blue background and white text */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#2566b3', borderTopLeftRadius: 10, borderTopRightRadius: 10, padding: '12px 24px 8px 16px', marginBottom: 0 }}>
          <button onClick={onClose} style={{ fontSize: 22, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 700, marginRight: 8 }}>×</button>
          <div style={{ flex: 1, textAlign: 'center', color: '#fff', fontWeight: 700, fontSize: 22 }}>Service-Learning Proposal</div>
          <div style={{ width: 32 }}></div>
        </div>
        <div style={{ textAlign: 'center', color: '#fff', background: '#3386e6', fontWeight: 600, fontSize: 18, marginBottom: 10, padding: '6px 0' }}>Specific Activity</div>
        {/* Main column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1, padding: 28 }}>
          <div>
            <label style={{ fontWeight: 600, fontSize: 15, color: '#2566b3' }}>Activity Title</label>
            <input style={{ ...inputStyle, marginTop: 4 }} value={title} onChange={e => setTitle(e.target.value)} placeholder="Activity Title" />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontWeight: 600, fontSize: 15, color: '#2566b3' }}>Role Description</label>
            <textarea style={{ ...textareaStyle, minHeight: 80, marginTop: 4, flex: 1 }} value={role} onChange={e => setRole(e.target.value)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={{ fontWeight: 600, fontSize: 15, color: '#2566b3' }}>Type of Skills: <span title="Info" style={{ color: '#3386e6', cursor: 'pointer' }}>ⓘ</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              <div>
                <label style={{ fontSize: 14, color: '#3386e6' }}>Core Service & Soft Skills</label>
                <select style={{ ...inputStyle, marginTop: 2 }} value={coreSkills} onChange={e => setCoreSkills(e.target.value)}>
                  <option value="">Select</option>
                  <option>Communication</option>
                  <option>Teamwork</option>
                  <option>Problem Solving</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#3386e6' }}>Technical & Digital Skills</label>
                <select style={{ ...inputStyle, marginTop: 2 }} value={techSkills} onChange={e => setTechSkills(e.target.value)}>
                  <option value="">Select</option>
                  <option>Digital Literacy</option>
                  <option>Data Analysis</option>
                  <option>Programming</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 14, color: '#3386e6' }}>Specialized Project Skills</label>
                <select style={{ ...inputStyle, marginTop: 2 }} value={projSkills} onChange={e => setProjSkills(e.target.value)}>
                  <option value="">Select</option>
                  <option>Project Management</option>
                  <option>Research</option>
                  <option>Leadership</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        {/* Confirm button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 28px 18px 28px' }}>
          <button type="button" style={{ ...buttonStyle, background: '#2196f3', color: '#fff', minWidth: 100 }}
            onClick={() => {
              onSave({
                id: Date.now(),
                title,
                role,
                coreSkills,
                techSkills,
                projSkills
              });
              onClose();
            }}
          >CONFIRM</button>
        </div>
      </div>
    </div>
  );
}

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
  const [activityModalOpen, setActivityModalOpen] = useState(false);
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
      // Map form fields to your data (fix typos and mapping)
      try {
        form.getTextField('proposalTitle').setText(formData.title || '');
        form.getTextField('proposedDate').setText(formData.date || '');
        form.getTextField('proponent').setText(formData.faculty || '');
        form.getTextField('participatingSections').setText(formData.sections || '');
        form.getTextField('courseTitle').setText(formData.courseTitle || ''); // fixed typo
        form.getTextField('courseCode').setText(formData.courseCode || '');
        form.getTextField('stakeholders').setText(formData.stakeholders || '');
        form.getTextField('targetDate').setText(formData.targetDates || '');
        form.getTextField('targetLocation').setText(formData.targetLocation || ''); // fixed mapping
        form.getTextField('volunteerHours').setText(formData.volunteerHours?.toString() || '');
        form.getTextField('SDGs').setText((formData.sdgs && formData.sdgs.length > 0) ? formData.sdgs.join(', ') : '');
        form.getTextField('proposalDescription').setText(formData.description || '');
        form.getTextField('objectives').setText(formData.objectives || '');
        form.getTextField('successIndicators').setText(formData.indicators || '');
        form.getTextField('budget').setText(formData.budget || '');
        form.getTextField('specificActivities').setText(
          activities && activities.length > 0
            ? activities.map((act, idx) => `${idx+1}. ${act.title}`).join('\n')
            : ''
        );
      } catch (e) {
        alert('Some fields could not be filled. Please check the PDF form field names.\n' + e);
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
  };

  // DEBUG: List all PDF form field names (run automatically on mount for user convenience)
  /*
  React.useEffect(() => {
    (async () => {
      try {
        const formUrl = '/assets/Proposal Form 32.pdf';
        const existingPdfBytes = await fetch(formUrl).then(res => res.arrayBuffer());
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        let form;
        try {
          form = pdfDoc.getForm();
        } catch {
          setError('No form fields found in this PDF.');
          setLoading(false);
          return;
        }
        const fields = form.getFields();
        const names = fields.map(f => f.getName());
        // Optionally show field names for debugging
        // alert('PDF Form Fields:\n' + names.join('\n'));
        setLoading(false);
      } catch (err) {
        setError('Error loading or parsing Proposal Form 32 PDF. Please check the file. ' + err);
        setLoading(false);
        console.error('PDF useEffect error:', err);
      }
    })();
  }, []);
  */

  return (
    <div style={{ background: '#f7f9fa', minHeight: '100vh', padding: '2rem' }}>
      <ActivityModal
        open={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        onSave={activity => setActivities(prev => [...prev, activity])}
      />
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
            <button type="button" style={addBtnStyle} onClick={() => setActivityModalOpen(true)}>Add Activity</button>
          </div>
          {activities.length === 0 && <div style={{ color: '#888', marginBottom: 16 }}>No activities added yet.</div>}
          {activities.map((act, idx) => (
            <div key={act.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} type="text" placeholder="Activity Title" value={act.title} onChange={e => updateActivity(act.id, 'title', e.target.value)} />
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
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button type="button" style={buttonStyle} onClick={handleExport}>EXPORT TO PDF</button>
            <button type="submit" style={{ ...buttonStyle, background: '#3386e6', color: '#fff', border: '1.5px solid #3386e6' }}>SUBMIT</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Style constants and SDG list
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
  color: '#e53935', // red for visibility
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
  { num: 17, label: 'Partnership for the Goals' },
];
