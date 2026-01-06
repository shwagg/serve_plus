
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../../../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function EventActivity() {
  const { id } = useParams();

  // If the id is 'placeholder', show a blank activity creation form
  if (id === 'placeholder') {
    // Example skills for Core Service & Soft Skills
    const coreSkills = [
      'Teamwork',
      'Communication',
      'Problem Solving',
      'Leadership',
      'Time Management',
      'Adaptability',
      'Conflict Resolution',
      'Empathy',
      'Critical Thinking',
      'Responsibility',
    ];
    const technicalSkills = [
      'Data Analysis',
      'Coding/Programming',
      'Web Design',
      'Social Media Management',
      'Digital Literacy',
      'Spreadsheet Skills',
      'Presentation Software',
      'Video Editing',
      'IT Troubleshooting',
      'Database Management',
    ];
    const specializedSkills = [
      'Project Planning',
      'Grant Writing',
      'Event Coordination',
      'Research Methods',
      'Survey Design',
      'Workshop Facilitation',
      'Community Assessment',
      'Policy Analysis',
      'Report Writing',
      'Monitoring & Evaluation',
    ];
    const [showCoreDropdown, setShowCoreDropdown] = React.useState(false);
    const [showTechnicalDropdown, setShowTechnicalDropdown] = React.useState(false);
    const [showSpecializedDropdown, setShowSpecializedDropdown] = React.useState(false);
    const [easySkills, setEasySkills] = React.useState('');
    const [moderateSkills, setModerateSkills] = React.useState('');
    const [hardSkills, setHardSkills] = React.useState('');

    // Handler for adding a skill to a level
    const handleAddSkill = (skill, level) => {
      if (level === 'easy') setEasySkills(easySkills ? easySkills + '\n' + skill : skill);
      if (level === 'moderate') setModerateSkills(moderateSkills ? moderateSkills + '\n' + skill : skill);
      if (level === 'hard') setHardSkills(hardSkills ? hardSkills + '\n' + skill : skill);
      setShowCoreDropdown(false);
      setShowTechnicalDropdown(false);
      setShowSpecializedDropdown(false);
    };

    return (
      <div style={{ background: '#f7f9fa', minHeight: '100vh', padding: 32, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <form style={{ background: '#fff', borderRadius: 20, padding: 32, minWidth: 800, maxWidth: 900, boxShadow: '0 2px 8px #0001', border: '4px solid #3386e6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#2566b3' }}>Service-Learning Proposal</span>
            <span style={{ fontSize: 22, color: '#3386e6', cursor: 'pointer' }} title="Info">ℹ️</span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#2566b3', marginBottom: 18, textAlign: 'center' }}>Specific Activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 18 }}>
            {/* Main form and skill dropdowns */}
            <React.Fragment>
              <div>
                <label style={{ fontWeight: 600, color: '#2566b3' }}>Activity Title</label>
                <input type="text" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', marginBottom: 12, marginTop: 4, color: '#234e7b', background: '#fff' }} placeholder="" />
                <label style={{ fontWeight: 600, color: '#2566b3' }}>Role Description</label>
                <textarea style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', minHeight: 100, marginBottom: 12, marginTop: 4, color: '#234e7b', background: '#fff' }} placeholder="" />
                <label style={{ fontWeight: 600, color: '#2566b3' }}>Type of Skills:</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
                  {/* Core Skills Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button type="button" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', color: '#234e7b', background: '#fff', textAlign: 'left', fontWeight: 500, cursor: 'pointer' }} onClick={() => { setShowCoreDropdown(v => !v); setShowTechnicalDropdown(false); setShowSpecializedDropdown(false); }}>
                      Core Service & Soft Skills ▼
                    </button>
                    {showCoreDropdown && (
                      <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1.5px solid #1ea7fd', borderRadius: 6, width: '100%', boxShadow: '0 2px 8px #0002', marginTop: 2 }}>
                        {coreSkills.map(skill => (
                          <div key={skill} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#2566b3' }}>{skill}</span>
                            <div>
                              <button type="button" style={{ marginRight: 4, background: 'none', color: '#2566b3', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'easy')}>Easy</button>
                              <button type="button" style={{ marginRight: 4, background: 'none', color: '#e6a700', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'moderate')}>Moderate</button>
                              <button type="button" style={{ background: 'none', color: '#d32f2f', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'hard')}>Hard</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Technical Skills Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button type="button" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', color: '#234e7b', background: '#fff', textAlign: 'left', fontWeight: 500, cursor: 'pointer' }} onClick={() => { setShowTechnicalDropdown(v => !v); setShowCoreDropdown(false); setShowSpecializedDropdown(false); }}>
                      Technical & Digital Skills ▼
                    </button>
                    {showTechnicalDropdown && (
                      <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1.5px solid #1ea7fd', borderRadius: 6, width: '100%', boxShadow: '0 2px 8px #0002', marginTop: 2 }}>
                        {technicalSkills.map(skill => (
                          <div key={skill} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#2566b3' }}>{skill}</span>
                            <div>
                              <button type="button" style={{ marginRight: 4, background: 'none', color: '#2566b3', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'easy')}>Easy</button>
                              <button type="button" style={{ marginRight: 4, background: 'none', color: '#e6a700', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'moderate')}>Moderate</button>
                              <button type="button" style={{ background: 'none', color: '#d32f2f', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'hard')}>Hard</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Specialized Skills Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button type="button" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', color: '#234e7b', background: '#fff', textAlign: 'left', fontWeight: 500, cursor: 'pointer' }} onClick={() => { setShowSpecializedDropdown(v => !v); setShowCoreDropdown(false); setShowTechnicalDropdown(false); }}>
                      Specialized Project Skills ▼
                    </button>
                    {showSpecializedDropdown && (
                      <div style={{ position: 'absolute', zIndex: 10, background: '#fff', border: '1.5px solid #1ea7fd', borderRadius: 6, width: '100%', boxShadow: '0 2px 8px #0002', marginTop: 2 }}>
                        {specializedSkills.map(skill => (
                          <div key={skill} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ color: '#2566b3' }}>{skill}</span>
                            <div>
                              <button type="button" style={{ marginRight: 4, background: 'none', color: '#2566b3', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'easy')}>Easy</button>
                              <button type="button" style={{ marginRight: 4, background: 'none', color: '#e6a700', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'moderate')}>Moderate</button>
                              <button type="button" style={{ background: 'none', color: '#d32f2f', border: '1px solid #ccc', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }} onClick={() => handleAddSkill(skill, 'hard')}>Hard</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontWeight: 600, color: '#2566b3' }}>Required Skills:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                  <div>
                    <label style={{ fontWeight: 500, color: '#2566b3' }}>Easy Skills</label>
                    <textarea value={easySkills} onChange={e => setEasySkills(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', minHeight: 40, marginBottom: 4, color: '#234e7b', background: '#fff' }} placeholder="" />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, color: '#2566b3' }}>Moderate Skills</label>
                    <textarea value={moderateSkills} onChange={e => setModerateSkills(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', minHeight: 40, marginBottom: 4, color: '#234e7b', background: '#fff' }} placeholder="" />
                  </div>
                  <div>
                    <label style={{ fontWeight: 500, color: '#2566b3' }}>Hard Skills</label>
                    <textarea value={hardSkills} onChange={e => setHardSkills(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #1ea7fd', minHeight: 40, marginBottom: 4, color: '#234e7b', background: '#fff' }} placeholder="" />
                  </div>
                </div>
              </div>
            </React.Fragment>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button type="submit" style={{ background: '#1ea7fd', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 32px', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>
              CONFIRM
            </button>
          </div>
        </form>
      </div>
    );
  }

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvent() {
      try {
        const eventRef = doc(db, 'Missions', id);
        const eventSnap = await getDoc(eventRef);
        if (eventSnap.exists()) {
          setEvent(eventSnap.data());
        }
      } catch (err) {
        setEvent(null);
      } finally {
        setLoading(false);
      }
    }
    fetchEvent();
  }, [id]);

  if (loading) {
    return <div style={{ padding: 32 }}>Loading...</div>;
  }
  if (!event) {
    return <div style={{ padding: 32 }}>Event not found.</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 24, padding: 32, justifyContent: 'center', background: '#fff', minHeight: '100vh' }}>
      {/* Left: Event Summary styled as per screenshot */}
      <div style={{ flex: '0 0 40%', maxWidth: '40%', minWidth: 340, background: 'transparent', borderRadius: 24, padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Top image */}
        <div style={{ width: '100%', height: 180, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', position: 'relative' }}>
          <img src={event.img || '/assets/mission1.jpg'} alt={event.alt || 'Event'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          {/* Optional close button */}
          {/* <button style={{ position: 'absolute', top: 16, left: 16, background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 22, fontWeight: 700, color: '#234e7b', cursor: 'pointer', zIndex: 2 }}>×</button> */}
        </div>
        {/* Green card */}
        <div style={{ background: '#7bb661', borderBottomLeftRadius: 24, borderBottomRightRadius: 24, padding: '32px 24px 24px 24px', width: '100%', boxSizing: 'border-box', marginTop: -4, minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
          <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: 12, fontSize: 26, lineHeight: 1.2 }}>{event.title}</h2>
          <p style={{ color: '#fff', fontSize: 15, marginBottom: 18, fontWeight: 400, lineHeight: 1.5 }}>{event.description}</p>
          {/* White info box */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 18, color: '#222', fontSize: 15, boxShadow: '0 2px 8px #0001' }}>
            <div style={{ marginBottom: 10 }}><strong>Location:</strong> <span style={{ color: '#234e7b' }}>{event.location}</span></div>
            <div style={{ marginBottom: 10 }}><strong>Date & Time:</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>{event.date}</li>
                <li>{event.time}</li>
              </ul>
            </div>
            <div style={{ marginBottom: 10 }}><strong>Points:</strong> <span style={{ color: '#388e3c' }}>{event.points} PTS</span></div>
            <div style={{ marginBottom: 10 }}><strong>Event Badge:</strong><br /><img src={event.badge || '/assets/badge.png'} alt="Event Badge" style={{ width: 90, marginTop: 8, borderRadius: 8, border: '2px solid #eee' }} /></div>
            {event.waiver && <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}><a href={event.waiver} style={{ color: '#30bdb7', textDecoration: 'underline', fontWeight: 500, fontSize: 15 }}>Waiver Form</a></div>}
          </div>
          <button style={{ background: '#bdbdbd', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 0', fontWeight: 600, fontSize: 18, cursor: 'not-allowed', width: '100%', marginTop: 8, letterSpacing: 1 }} disabled>
            INCOMPLETE
          </button>
        </div>
      </div>
      {/* Right: Activity Section */}
      <div style={{ flex: '0 0 60%', maxWidth: '60%', minWidth: 400, background: '#7bb661', borderRadius: 20, padding: 24 }}>
        <h2 style={{ color: '#fff', fontWeight: 700, marginBottom: 16 }}>Activity</h2>
        {event.activities && event.activities.map((activity, idx) => (
          <div key={idx} style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ color: '#234e7b', fontWeight: 700 }}>{activity.title}</h3>
              <button style={{ background: '#7bb661', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                JOIN THE ACTIVITY!
              </button>
            </div>
            <ul style={{ color: '#234e7b', fontSize: 15, marginBottom: 8 }}>
              {activity.details && activity.details.map((detail, i) => (
                <li key={i}>{detail}</li>
              ))}
            </ul>
            {activity.required && <div style={{ color: '#234e7b', fontSize: 15, marginBottom: 8 }}><strong>Required:</strong> {activity.required}</div>}
            <input type="file" style={{ marginBottom: 8, width: '100%' }} />
            <textarea placeholder="Journal Reflection" style={{ width: '100%', minHeight: 60, marginBottom: 8, borderRadius: 6, border: '1px solid #ccc', padding: 8 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span>Task Progress</span>
              <progress value="0" max="100" style={{ flex: 1 }} />
            </div>
            <button style={{ background: '#bdbdbd', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 24px', fontWeight: 600, fontSize: 14, cursor: 'not-allowed' }} disabled>
              SUBMIT
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
