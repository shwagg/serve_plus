import { useNavigate } from "react-router-dom";
export default function ProposeProject() {
  const [page, setPage] = useState(1);

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
          <span style={{ fontWeight: 500, fontSize: 18 }}>Page {page} / 3</span>
          <span style={{ position: 'absolute', top: 24, right: 24, fontSize: 22, cursor: 'pointer' }} title="Info">ℹ️</span>
        </div>
        {page === 1 ? <PageOne onNext={() => setPage(2)} /> : null}
        {page === 2 ? <PageTwo onPrev={() => setPage(1)} onNext={() => setPage(3)} /> : null}
        {page === 3 ? <PageThree onPrev={() => setPage(2)} /> : null}
      </div>
    </div>
  );
}

function PageOne({ onNext }) {
  return (
    <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} onSubmit={e => { e.preventDefault(); onNext(); }}>
      {/* ...existing code for page 1 form... */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 2 }}>
          <label style={labelStyle}>Title of Service-Learning Initiative</label>
          <input style={inputStyle} type="text" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Date Proposed</label>
          <input style={inputStyle} type="date" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Faculty-In-Charge / Proponent(s)</label>
          <input style={inputStyle} type="text" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Participating Section(s)</label>
          <input style={inputStyle} type="text" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Course Title</label>
          <input style={inputStyle} type="text" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Course Code</label>
          <input style={inputStyle} type="text" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Stakeholders</label>
          <input style={inputStyle} type="text" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Target Dates</label>
          <input style={inputStyle} type="date" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Target location</label>
          <input style={inputStyle} type="text" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Number of Volunteer Hours</label>
          <input style={inputStyle} type="number" min="0" />
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
            <input type="checkbox" style={{ accentColor: '#3386e6', width: 18, height: 18 }} />
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

function PageTwo({ onPrev, onNext }) {
  return (
    <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} onSubmit={e => { e.preventDefault(); onNext(); }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <label style={labelStyle}>Description</label>
          <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>Note: Please write a detailed description of the activity.</span>
        </div>
        <textarea style={textareaStyle} rows={4} />
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <label style={labelStyle}>Objectives</label>
          <span style={{ fontSize: 13, color: '#888', fontWeight: 400 }}>Note: Please specify student outcome, course objective or learning outcome to be met.</span>
        </div>
        <textarea style={textareaStyle} rows={4} />
      </div>
      <div style={{ marginBottom: 32 }}>
        <label style={labelStyle}>Success Indicators</label>
        <textarea style={textareaStyle} rows={4} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={buttonStyle} onClick={onPrev}>PREVIOUS</button>
        <button type="submit" style={buttonStyle}>NEXT</button>
      </div>
    </form>
  );
}

import React, { useState } from "react";

function PageThree({ onPrev }) {
  const navigate = useNavigate();
  // Demo data for activity and student leader
  const [activities, setActivities] = React.useState([
    { id: 1, name: 'Riverbank Cleanup & Segregation' }
  ]);
  const [leaders, setLeaders] = React.useState([
    { id: 1, name: 'Maria G. Santos' }
  ]);
  const [budget, setBudget] = React.useState("");
  const [activityInput, setActivityInput] = React.useState("");
  const [leaderInput, setLeaderInput] = React.useState("");

  const addActivity = () => {
    // Placeholder event ID for now
    navigate("/event/placeholder/activity");
  };
  const removeActivity = id => setActivities(activities.filter(a => a.id !== id));

  const addLeader = () => {
    if (leaderInput.trim()) {
      setLeaders([...leaders, { id: Date.now(), name: leaderInput }]);
      setLeaderInput("");
    }
  };
  const removeLeader = id => setLeaders(leaders.filter(l => l.id !== id));

  return (
    <form style={{ background: '#fff', borderRadius: 12, padding: 24, color: '#222', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} onSubmit={e => { e.preventDefault(); alert('Submitted!'); }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
        {/* Specific Activity */}
        <div style={{ flex: 2, minWidth: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Specific Activity</div>
          <div style={{ border: '1.5px solid #1ea7fd', borderRadius: 12, padding: 16, minHeight: 220, background: '#f7f9fa', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <button type="button" style={addBtnStyle} onClick={addActivity}>+ Add Activity</button>
              <input
                type="text"
                placeholder=""
                value={activityInput}
                onChange={e => setActivityInput(e.target.value)}
                style={{ ...inputStyle, maxWidth: 180, marginBottom: 0 }}
              />
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
        {/* Budget & Roster Involvement */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Budget</div>
            <input
              style={inputStyle}
              type="text"
              placeholder=""
              value={budget}
              onChange={e => setBudget(e.target.value)}
            />
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Note: Attach the Fundraising Activity Proposal if applicable</div>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Roster Involvement</div>
            <div style={{ border: '1.5px solid #1ea7fd', borderRadius: 12, padding: 12, minHeight: 80, background: '#f7f9fa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <button type="button" style={addBtnStyle} onClick={addLeader}>+ Add Student Leader</button>
                <input
                  type="text"
                  placeholder=""
                  value={leaderInput}
                  onChange={e => setLeaderInput(e.target.value)}
                  style={{ ...inputStyle, maxWidth: 150, marginBottom: 0 }}
                />
              </div>
              {leaders.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', background: '#1ea7fd', color: '#fff', borderRadius: 6, marginBottom: 8, padding: '6px 12px', fontWeight: 500 }}>
                  <button type="button" onClick={() => removeLeader(l.id)} style={removeBtnStyle}>×</button>
                  <span style={{ flex: 1 }}>{l.name}</span>
                  <span style={{ fontSize: 18, marginLeft: 8 }}>📋</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#888', margin: '8px 0 24px 0' }}>
        Important: Review all fields carefully; the proposal is locked and cannot be edited once submitted.
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={buttonStyle} onClick={onPrev}>PREVIOUS</button>
        <button type="submit" style={{ ...buttonStyle, background: '#1ea7fd', color: '#fff', border: 'none' }}>SUBMIT</button>
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
