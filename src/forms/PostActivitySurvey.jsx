// --- Example Parent Component Usage ---
// Place this code in your parent component (not in this file, just for reference):
/*
import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // adjust path as needed
import PostActivitySurvey from './PostActivitySurvey';

function PostSurveyWrapper({ missionId, volunteerId, ...otherProps }) {
  const [proposal, setProposal] = useState({ initiativeTitle: '', location: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProposal() {
      setLoading(true);
      const missionRef = doc(db, 'missions', missionId);
      const missionSnap = await getDoc(missionRef);
      if (missionSnap.exists()) {
        setProposal({
          initiativeTitle: missionSnap.data().initiativeTitle || '',
          location: missionSnap.data().location || '',
        });
      }
      setLoading(false);
    }
    if (missionId) fetchProposal();
  }, [missionId]);

  if (loading) return <div>Loading...</div>;

  return (
    <PostActivitySurvey
      initiativeTitle={proposal.initiativeTitle}
      location={proposal.location}
      {...otherProps}
    />
  );
}
*/
// --- End Example ---
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

const PostActivitySurvey = ({ onSubmit,
  initialName = '',
  initialEngagementType = '',
  initialTitle = '',
  initialDate = '',
  initialCollege = '',
  initialProgram = '',
  initialNonAcademicOrg = '' }) => {

  const [form, setForm] = useState({
    name: initialName,
    engagementType: initialEngagementType,
    initiativeTitle: initialTitle,
    dateOfImplementation: initialDate,
    college: initialCollege,
    program: initialProgram,
    nonAcademicOrg: initialNonAcademicOrg,
    location: '',
  });

  // Update form state if initiativeTitle or location props change
  React.useEffect(() => {
    setForm((prev) => ({
      ...prev,
      initiativeTitle,
      location,
    }));
  }, [initiativeTitle, location]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  const selectedCollege = colleges.find((c) => c.name === form.college);

  return (
    <form onSubmit={handleSubmit} className="post-activity-survey-form">
      <style>{`
        .post-activity-survey-form {
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
          font-family: 'Inter', Helvetica, Arial, sans-serif;
        }
        .post-activity-survey-form h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #23235b;
          margin-bottom: 18px;
          padding-left: 10px;
        }
        .post-activity-survey-form label {
          font-weight: 500;
          color: #222;
          margin-bottom: 6px;
          margin-top: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .post-activity-survey-form input[type="text"],
        .post-activity-survey-form input[type="email"],
        .post-activity-survey-form input[type="date"],
        .post-activity-survey-form select,
        .post-activity-survey-form input,
        .post-activity-survey-form textarea {
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
        .post-activity-survey-form input:focus,
        .post-activity-survey-form select:focus,
        .post-activity-survey-form textarea:focus {
          border: 1.5px solid #5b6ee1;
        }
        .post-activity-survey-form input:disabled,
        .post-activity-survey-form select:disabled {
          color: #808080;
          background: #f1f1f1;
          cursor: not-allowed;
        }
        .post-activity-survey-form fieldset {
          border: none;
          padding: 0;
          margin: 0;
        }
        .post-activity-survey-form legend {
          font-weight: 600;
          color: #23235b;
          margin-bottom: 8px;
        }
        .post-activity-survey-form button[type="submit"] {
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
        .post-activity-survey-form button[type="submit"]:hover {
          background: #249e9a;
        }
      `}</style>
      <h2 style={{ marginBottom: 24 }}>Post-Activity Survey</h2>
      <div style={{ marginBottom: 18 }}>
        <label>
          Name *
          <input name="name" value={form.name} onChange={handleChange} required autoComplete="off" />
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>
          Title of Service-Learning / Community Engagement Initiative *
          <input name="initiativeTitle" value={form.initiativeTitle} disabled required placeholder="e.g., Feeding Program for Barangay 123" autoComplete="off" />
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>
          Type of Engagement *
          <select name="engagementType" value={form.engagementType} disabled required>
            <option value="">Select Type</option>
            <option value="sl">Service-Learning</option>
            <option value="ce">Community Engagement</option>
          </select>
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>
          College/Department/Organization *
          <select name="college" value={form.college} disabled required>
            <option value="">Select College/Department/Org</option>
            {colleges.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      {form.college === 'Non-Academic Organization' ? (
        <div style={{ marginBottom: 18 }}>
          <label>
            Organization Name *
            <input name="nonAcademicOrg" value={form.nonAcademicOrg} disabled required autoComplete="off" />
          </label>
        </div>
      ) : (
        selectedCollege && selectedCollege.programs.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <label>
              Program *
              <select name="program" value={form.program} disabled required>
                <option value="">Select Program</option>
                {selectedCollege.programs.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
        )
      )}
      <div style={{ marginBottom: 18 }}>
        <label>
          Type of Engagement *
          <select name="engagementType" value={form.engagementType} onChange={handleChange} required>
            <option value="">Select Type</option>
            <option value="SL">Service-Learning (SL)</option>
            <option value="CE">Community Engagement (CE)</option>
          </select>
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>
          Title of Service-Learning / Community Engagement Initiative *
          <input
            name="initiativeTitle"
            value={form.initiativeTitle}
            onChange={handleChange}
            required
            placeholder="e.g., Feeding Program for Barangay 123"
            autoComplete="off"
            readOnly
          />
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>
          Date of Implementation *
          <input name="dateOfImplementation" type="date" value={form.dateOfImplementation} onChange={handleChange} required />
        </label>
      </div>
      <div style={{ marginBottom: 24 }}>
        <label>
          Location/Venue *
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            required
            placeholder="e.g., Barangay 123 Hall"
            autoComplete="off"
            readOnly
          />
        </label>
      </div>
      {/* Likert Scale Section */}
      <div style={{ marginTop: 8, marginBottom: 24 }}>
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
              {[5, 4, 3, 2, 1, 0].map(val => (
                <th key={val} style={{ textAlign: 'center', padding: '8px 0', fontWeight: 600, color: '#23235b', fontSize: 15 }}>{val}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              'The ideas, suggestions, and solutions that were implemented during the community service helped in providing solutions to the problems and issues in the community.',
              'The community service brought about initiatives and teamwork that somehow addressed the problems and issues at hand.',
              'Being able to understand the diversity of the people involved in the community allowed for a successful implementation of the community service initiative.',
              'Through the community service initiative, I was able to realize the role that I have to play in the society both as a student and a Filipino citizen.',
              'The profession that I will pursue in the future along with the knowledge and skills that I would be able to develop would contribute to addressing social problems and issues.',
              'I consider community development initiatives to be the last of my priorities. I think that by focusing on academics, friends, family, recreation, etc. I would be able to help the society more.',
              'I think that my participation in the community service initiative did not help the community or the country let alone the world. My involvement was insignificant and did not make any difference.',
              'I was able to realize that participating in community development initiatives, no matter how big or small the involvement is, would make a difference. As such, I am willing to manage my time and have the initiative to participate whenever there is an opportunity.'
            ].map((statement, idx) => (
              <tr key={idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f6f7fa' }}>
                <td style={{ padding: '10px 12px', fontSize: 15, color: '#222', fontWeight: 500 }}>{statement}</td>
                {[5, 4, 3, 2, 1, 0].map(val => (
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
      <button type="submit">Submit</button>
    </form>
  );
};

export default PostActivitySurvey;
