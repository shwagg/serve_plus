import React, { useState } from 'react';

const colleges = [
  {
    name: 'College of Arts and Science (CAS)',
    programs: ['COMM', 'BMMA'],
  },
  {
    name: 'College of Computer and Information Science (CCIS)',
    programs: ['IT', 'CS'],
  },
  {
    name: 'College of Health Sciences (CHS)',
    programs: ['BIO', 'MDT', 'PH', 'PT', 'PSY'],
  },
  {
    name: 'College of Nursing (CN)',
    programs: ['Nursing'],
  },
  {
    name: 'College of Maritime Education and Training (CMET)',
    programs: ['MARE', 'MT', 'MSSB'],
  },
  {
    name: 'E.T. Yuchengco College of Business (ETYCB)',
    programs: ['ACT', 'AIS', 'BA OM', 'BA FM', 'BA MM', 'BIA', 'GM', 'HM', 'MKT', 'TM'],
  },
  {
    name: 'Mapua-Laguna Institute of Aviation (MIA)',
    programs: ['AEE', 'AM', 'AMT'],
  },
  {
    name: 'Mapua Institute of Technology at Laguna (MITL)',
    programs: ['AR', 'CHE', 'CE', 'CPE', 'EE', 'ECE', 'IE', 'ME'],
  },
  {
    name: 'Mapua MCL Senior High School (SHS)',
    programs: ['ABM', 'STEM', 'HUMSS', 'ICT'],
  },
  {
    name: 'Non-Academic Organization',
    programs: [],
  },
];

const PreActivitySurvey = ({ onSubmit, initialName = '', initialInitiativeTitle = '', children }) => {
  const [form, setForm] = useState({
    name: initialName,
    college: '',
    program: '',
    nonAcademicOrg: '',
    engagementType: '',
    initiativeTitle: initialInitiativeTitle,
    participation: [],
    participationOther: '',
    prevService: '',
    frequency: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleParticipationChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setForm((prev) => ({ ...prev, participation: [...prev.participation, value] }));
    } else {
      setForm((prev) => ({ ...prev, participation: prev.participation.filter((p) => p !== value) }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const selectedCollege = colleges.find((c) => c.name === form.college);

  return (
    <form onSubmit={handleSubmit} className="pre-activity-survey-form">
      <style>{`
        .pre-activity-survey-form {
          background: #fff;
          border-radius: 14px;
          box-shadow: 0 2px 16px rgba(44,62,80,0.08), 0 1.5px 4px rgba(44,62,80,0.04);
          max-width: 600px;
          margin: 0 auto;
          padding: 32px 32px 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 22px;
          color: #222;
          font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
        }
        .pre-activity-survey-form h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #23235b;
          margin-bottom: 18px;
          border-left: 3px solid #5b6ee1;
          padding-left: 10px;
        }
        .pre-activity-survey-form label {
          font-weight: 500;
          color: #222;
          margin-bottom: 6px;
          margin-top: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .pre-activity-survey-form input[type="text"],
        .pre-activity-survey-form input[type="email"],
        .pre-activity-survey-form input[type="date"],
        .pre-activity-survey-form select,
        .pre-activity-survey-form input,
        .pre-activity-survey-form textarea {
          border: 1.5px solid #e0e4ea;
          border-radius: 7px;
          padding: 10px 12px;
          font-size: 1rem;
          background: #fafbfc;
          color: #222;
          margin-top: 2px;
          margin-bottom: 0;
          outline: none;
          transition: border 0.2s;
        }
        .pre-activity-survey-form input:focus,
        .pre-activity-survey-form select:focus,
        .pre-activity-survey-form textarea:focus {
          border: 1.5px solid #5b6ee1;
        }
        .pre-activity-survey-form fieldset {
          border: none;
          padding: 0;
          margin: 0;
        }
        .pre-activity-survey-form legend {
          font-weight: 600;
          color: #23235b;
          margin-bottom: 8px;
        }
        .pre-activity-survey-form .checkbox-group {
          display: flex;
          gap: 24px;
          margin-top: 6px;
        }
        .pre-activity-survey-form .checkbox-group label {
          flex-direction: row;
          align-items: center;
          font-weight: 400;
          gap: 6px;
        }
        .pre-activity-survey-form button[type="submit"] {
          background: #30bdb7;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 12px 0;
          font-weight: 600;
          font-size: 1.08rem;
          cursor: pointer;
          margin-top: 10px;
          margin-bottom: 0;
          transition: background 0.18s;
        }
        .pre-activity-survey-form button[type="submit"]:hover {
          background: #249e9a;
        }
        .pre-activity-survey-form .cancel-btn {
          background: #bdbdbd;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 12px 0;
          font-weight: 600;
          font-size: 1.08rem;
          cursor: pointer;
          margin-top: 0;
          margin-bottom: 0;
        }
      `}</style>
      <h2>Pre-Activity Survey</h2>
      <label>
        Name *
        <input name="name" value={form.name} onChange={handleChange} required autoComplete="off" />
      </label>
      <label>
        College/Department/Organization *
        <select name="college" value={form.college} onChange={handleChange} required>
          <option value="">Select College/Department/Org</option>
          {colleges.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </label>
      {form.college === 'Non-Academic Organization' ? (
        <label>
          Organization Name *
          <input name="nonAcademicOrg" value={form.nonAcademicOrg} onChange={handleChange} required autoComplete="off" />
        </label>
      ) : (
        selectedCollege && selectedCollege.programs.length > 0 && (
          <label>
            Program *
            <select name="program" value={form.program} onChange={handleChange} required>
              <option value="">Select Program</option>
              {selectedCollege.programs.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        )
      )}
      <label>
        Type of Engagement *
        <select name="engagementType" value={form.engagementType} onChange={handleChange} required>
          <option value="">Select Type</option>
          <option value="SL">Service-Learning (SL)</option>
          <option value="CE">Community Engagement (CE)</option>
        </select>
      </label>
      <label>
        Title of Service-Learning / Community Engagement Initiative *
        <input name="initiativeTitle" value={form.initiativeTitle} onChange={handleChange} required placeholder="e.g., Feeding Program for Barangay 123" autoComplete="off" />
      </label>
      <fieldset>
        <legend>Type/Level of Participation <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>(Select all that apply)</span></legend>
        <div className="checkbox-group">
          <label><input type="checkbox" value="Organizer" checked={form.participation.includes('Organizer')} onChange={handleParticipationChange} /> Organizer</label>
          <label><input type="checkbox" value="Donor" checked={form.participation.includes('Donor')} onChange={handleParticipationChange} /> Donor</label>
          <label><input type="checkbox" value="Participant" checked={form.participation.includes('Participant')} onChange={handleParticipationChange} /> Participant</label>
          <label>
            <input type="checkbox" value="Other" checked={form.participation.includes('Other')} onChange={handleParticipationChange} /> Other
            {form.participation.includes('Other') && (
              <input name="participationOther" value={form.participationOther} onChange={handleChange} placeholder="Please specify" style={{ marginLeft: 8, minWidth: 120 }} />
            )}
          </label>
        </div>
      </fieldset>
      <label>
        Previous Community Service Experience *
        <select name="prevService" value={form.prevService} onChange={handleChange} required>
          <option value="">Select</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      </label>
      <label>
        Frequency of Community Service *
        <select name="frequency" value={form.frequency} onChange={handleChange} required>
          <option value="">Select Frequency</option>
          <option value="Once a year">Once a year</option>
          <option value="2-4 times a year">2-4 times a year</option>
          <option value="Monthly">Monthly</option>
          <option value="Weekly">Weekly</option>
          <option value="Several times a week">Several times a week</option>
          <option value="Not Applicable">Not Applicable</option>
        </select>
      </label>
      {/* Likert Scale Section */}
      <div style={{ marginTop: 18 }}>
        <h3 style={{ fontWeight: 700, color: '#23235b', fontSize: '1.08rem', marginBottom: 8 }}>Please indicate how much you agree with each statement with 1 being that you strongly disagree and 5 being that you strongly agree.</h3>
        <div style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>
          <strong>LEGEND</strong><br />
          <span style={{ display: 'inline-block', minWidth: 180 }}><b>5</b> – Strongly Agree</span>
          <span style={{ display: 'inline-block', minWidth: 180 }}><b>2</b> – Disagree</span><br />
          <span style={{ display: 'inline-block', minWidth: 180 }}><b>4</b> – Agree</span>
          <span style={{ display: 'inline-block', minWidth: 180 }}><b>1</b> – Strongly Disagree</span><br />
          <span style={{ display: 'inline-block', minWidth: 180 }}><b>3</b> – Neutral</span>
          <span style={{ display: 'inline-block', minWidth: 180 }}><b>0</b> – No Basis for this evaluation</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fafbfc', borderRadius: 8, overflow: 'hidden', marginBottom: 18 }}>
          <thead>
            <tr style={{ background: '#f3f4f8' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#23235b', fontSize: 15 }}>Statement</th>
              {[5,4,3,2,1,0].map(val => (
                <th key={val} style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600, color: '#23235b', fontSize: 15 }}>{val}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              'There are existing problems in the community and I can come up with ideas, suggestions, and solutions to address these problems and issues.',
              'Volunteer work along with teamwork would somehow help solve social problems.',
              'People in the community come from diverse background, culture, and social standing and it is important to understand these differences in order to help solve problems.',
              'I would like to make a difference in the community because I have a social and moral obligation to do so. I would do this even if my contribution would seem very little.',
              'Contributing and improving skills I’ve learned from my degree program or affiliation would somehow solve social problems.',
              'I would definitely participate in community development initiatives but it would be the last of my priorities because I have to consider other aspects of my life first such as academics, friends, family, recreation, etc.',
              'I think that the magnitude of issues in our country and in the world in general is so big that whatever I do to help would be insignificant and would not make any difference.',
              'I would consider participating in community development initiatives whenever I can, and with proper time management and the initiative to do so, I definitely can.'
            ].map((statement, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f6f7fa' }}>
                <td style={{ padding: '10px 12px', fontSize: 15, color: '#222', fontWeight: 500 }}>{statement}</td>
                {[5,4,3,2,1,0].map(val => (
                  <td key={val} style={{ textAlign: 'center', padding: '10px 0' }}>
                    <input
                      type="radio"
                      name={`likert_${idx}`}
                      value={val}
                      checked={form[`likert_${idx}`] === String(val)}
                      onChange={e => setForm(prev => ({ ...prev, [`likert_${idx}`]: e.target.value }))}
                      style={{ accentColor: '#30bdb7' }}
                      required={val === 5}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {children}
      <button type="submit">Submit</button>
    </form>
  );
};

export default PreActivitySurvey;
