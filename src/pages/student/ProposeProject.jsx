import { useNavigate, useLocation } from "react-router-dom";
export default function ProposeProject() {
  const location = useLocation();
  // Set initial page based on query param
  const queryPage = (() => {
    const params = new URLSearchParams(location.search);
    const p = parseInt(params.get('page'), 10);
    return p === 3 ? 3 : 1;
  })();
  const [page, setPage] = useState(queryPage);

  // Store activities in state, initialize with demo if needed
  const [activities, setActivities] = useState([]);
  // Store all form data
  const [formData, setFormData] = useState({
    title: '',
    date: '',
    faculty: '',
    sections: '',
    courseTitle: '',
    courseCode: '',
    stakeholders: '',
    targetDates: '',
    targetLocation: '',
    volunteerHours: '',
    sdgs: [],
    description: '',
    objectives: '',
    indicators: '',
    budget: '',
  });

  // If coming back from EventActivity, add new activity
  React.useEffect(() => {
    if (location.state && location.state.activities) {
      setActivities(location.state.activities);
      window.history.replaceState({}, document.title);
    } else if (location.state && location.state.newActivity) {
      setActivities(prev => {
        if (prev.some(a => a.id === location.state.newActivity.id)) return prev;
        return [...prev, location.state.newActivity];
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <div style={{ background: '#f7f9fa', minHeight: '100vh', padding: '2rem' }}>
      <div style={{
        maxWidth: 900,
        margin: '2rem auto',
        background: 'linear-gradient(180deg, #3386e6 0%, #2566b3 100%)',
        borderRadius: 16,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: 32,
        color: '#fff',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: 28 }}>Service-Learning Proposal</h2>
          <span style={{ fontWeight: 500, fontSize: 18 }}>Page {page} / 4</span>
          <span style={{ position: 'absolute', top: 24, right: 24, fontSize: 22, cursor: 'pointer' }} title="Info">ℹ️</span>
        </div>
        {page === 1 ? <PageOne onNext={() => setPage(2)} formData={formData} setFormData={setFormData} /> : null}
        {page === 2 ? <PageTwo onPrev={() => setPage(1)} onNext={() => setPage(3)} formData={formData} setFormData={setFormData} /> : null}
        {page === 3 ? <PageThree onPrev={() => setPage(2)} onNext={() => setPage(4)} activities={activities} setActivities={setActivities} formData={formData} setFormData={setFormData} /> : null}
        {page === 4 ? <PageFour onPrev={() => setPage(3)} activities={activities} formData={formData} /> : null}
      </div>
    </div>
  );
}

function PageOne({ onNext, formData, setFormData }) {
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
  return (
    <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} onSubmit={e => { e.preventDefault(); onNext(); }}>
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
          <label style={labelStyle}>Target location</label>
          <input style={inputStyle} type="text" name="targetLocation" value={formData.targetLocation} onChange={handleChange} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Number of Volunteer Hours</label>
          <input style={inputStyle} type="number" min="0" name="volunteerHours" value={formData.volunteerHours} onChange={handleChange} />
        </div>
      </div>
      <div style={{ marginBottom: 8, fontWeight: 600 }}>SDG(s)</div>
      <div style={{ marginBottom: 8, fontSize: 13, color: '#888' }}>
        Note: Please check the targeted SDG Number and Goal that applies.
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        background: '#f7f9fa',
        border: '1px solid #b3d1f7',
        borderRadius: 8,
        padding: 16,
        marginBottom: 24,
      }}>
        {sdgList.map((sdg, i) => (
          <label key={sdg.num} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 500 }}>
            <input type="checkbox" style={{ accentColor: '#3386e6', width: 18, height: 18 }} name="sdgs" value={sdg.label} checked={formData.sdgs.includes(sdg.label)} onChange={handleChange} />
            {sdg.num}. {sdg.label}
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={buttonStyle} disabled>PREVIOUS</button>
        <button type="submit" style={buttonStyle}>NEXT</button>
      </div>
    </form>
  );
}

function PageTwo({ onPrev, onNext, formData, setFormData }) {
  const handleChange = e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  return (
    <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} onSubmit={e => { e.preventDefault(); onNext(); }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <label style={labelStyle}>Description</label>
          <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>Note: Please write a detailed description of the activity.</span>
        </div>
        <textarea style={textareaStyle} rows={4} name="description" value={formData.description} onChange={handleChange} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <label style={labelStyle}>Objectives</label>
          <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>Note: Please specify student outcome, course objective or learning outcome to be met.</span>
        </div>
        <textarea style={textareaStyle} rows={4} name="objectives" value={formData.objectives} onChange={handleChange} />
      </div>
      <div style={{ marginBottom: 32 }}>
        <label style={labelStyle}>Success Indicators</label>
        <textarea style={textareaStyle} rows={4} name="indicators" value={formData.indicators} onChange={handleChange} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={buttonStyle} onClick={onPrev}>PREVIOUS</button>
        <button type="submit" style={buttonStyle}>NEXT</button>
      </div>
    </form>
  );
}

import React, { useState } from "react";

function PageThree({ onPrev, onNext, activities, setActivities, formData, setFormData }) {
  const navigate = useNavigate();

  const addActivity = () => {
    navigate("/event/placeholder/activity", { state: { fromProposal: true, activities } });
  };
  const removeActivity = id => setActivities(activities.filter(a => a.id !== id));
  const handleBudgetChange = e => {
    setFormData(prev => ({ ...prev, budget: e.target.value }));
  };

  return (
    <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} onSubmit={e => { e.preventDefault(); onNext(); }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
        {/* Specific Activity */}
        <div style={{ flex: 2, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Specific Activity</div>
          <div style={{ border: '1.5px solid #1ea7fd', borderRadius: 12, padding: 16, minHeight: 220, background: '#f7f9fa', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <button type="button" style={addBtnStyle} onClick={addActivity}>+ Add Activity</button>
            </div>
            {activities.map(a => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', background: '#1ea7fd', color: '#fff', borderRadius: 6, marginBottom: 8, padding: '6px 12px', fontWeight: 500 }}>
                <button type="button" onClick={() => removeActivity(a.id)} style={removeBtnStyle}>×</button>
                <span style={{ flex: 1 }}>{a.name}</span>
                <span style={{ fontSize: 18, marginLeft: 8 }}>📋</span>
              </div>
            ))}
          </div>
        </div>
        {/* Budget Section Only */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Budget</div>
            <input
              style={inputStyle}
              type="text"
              placeholder=""
              name="budget"
              value={formData.budget}
              onChange={handleBudgetChange}
            />
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Note: Attach the Fundraising Activity Proposal if applicable</div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#888', margin: '8px 0 24px 0' }}>
        Important: Review all fields carefully; the proposal is locked and cannot be edited once submitted.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={buttonStyle} onClick={onPrev}>PREVIOUS</button>
        <button type="submit" style={{ ...buttonStyle, background: '#1ea7fd', color: '#fff', border: 'none' }}>NEXT</button>
      </div>
    </form>
  );
}

function PageFour({ onPrev, activities, formData }) {
  // Final review and submit page
  return (
    <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} onSubmit={e => { e.preventDefault(); alert('Submitted!'); }}>
      <h3 style={{ fontWeight: 700, marginBottom: 16 }}>Final Review & Submit</h3>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Service-Learning Proposal Details:</div>
        <div style={{ marginBottom: 8 }}><b>Title:</b> {formData.title}</div>
        <div style={{ marginBottom: 8 }}><b>Date Proposed:</b> {formData.date}</div>
        <div style={{ marginBottom: 8 }}><b>Faculty-In-Charge / Proponent(s):</b> {formData.faculty}</div>
        <div style={{ marginBottom: 8 }}><b>Participating Section(s):</b> {formData.sections}</div>
        <div style={{ marginBottom: 8 }}><b>Course Title:</b> {formData.courseTitle}</div>
        <div style={{ marginBottom: 8 }}><b>Course Code:</b> {formData.courseCode}</div>
        <div style={{ marginBottom: 8 }}><b>Stakeholders:</b> {formData.stakeholders}</div>
        <div style={{ marginBottom: 8 }}><b>Target Dates:</b> {formData.targetDates}</div>
        <div style={{ marginBottom: 8 }}><b>Target Location:</b> {formData.targetLocation}</div>
        <div style={{ marginBottom: 8 }}><b>Number of Volunteer Hours:</b> {formData.volunteerHours}</div>
        <div style={{ marginBottom: 8 }}><b>SDGs:</b> {formData.sdgs.join(', ')}</div>
        <div style={{ marginBottom: 8 }}><b>Description:</b> {formData.description}</div>
        <div style={{ marginBottom: 8 }}><b>Objectives:</b> {formData.objectives}</div>
        <div style={{ marginBottom: 8 }}><b>Success Indicators:</b> {formData.indicators}</div>
        <div style={{ marginBottom: 8 }}><b>Budget:</b> {formData.budget}</div>
        <div style={{ fontWeight: 600, margin: '16px 0 8px 0' }}>Activities Added:</div>
        <ul>
          {activities.map(a => (
            <li key={a.id} style={{ marginBottom: 4 }}>{a.name}</li>
          ))}
        </ul>
      </div>
      <div style={{ color: '#888', fontSize: 14, marginBottom: 24 }}>
        Please review all information before submitting. You will not be able to edit after submission.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={buttonStyle} onClick={onPrev}>PREVIOUS</button>
        <button type="submit" style={{ ...buttonStyle, background: '#3386e6', color: '#fff', border: 'none' }}>SUBMIT</button>
      </div>
    </form>
  );
}

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
  { num: 17, label: 'Partnership for the Goals' },
];
