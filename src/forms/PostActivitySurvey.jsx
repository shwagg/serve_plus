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
import React, { useState, useEffect } from 'react';

const colleges = [
  { name: 'College of Arts and Science (CAS)', programs: ['COMM', 'BMMA'] },
  { name: 'College of Computer and Information Science (CCIS)', programs: ['IT', 'CS'] },
  { name: 'College of Health Sciences (CHS)', programs: ['BIO', 'MDT', 'PH', 'PT', 'PSY'] },
  { name: 'College of Nursing (CN)', programs: ['Nursing'] },
  { name: 'College of Maritime Education and Training (CMET)', programs: ['MARE', 'MT', 'MSSB'] },
  { name: 'E.T. Yuchengco College of Business (ETYCB)', programs: ['ACT', 'AIS', 'BA OM', 'BA FM', 'BA MM', 'BIA', 'GM', 'HM', 'MKT', 'TM'] },
  { name: 'Mapua-Laguna Institute of Aviation (MIA)', programs: ['AEE', 'AM', 'AMT'] },
  { name: 'Mapua Institute of Technology at Laguna (MITL)', programs: ['AR', 'CHE', 'CE', 'CPE', 'EE', 'ECE', 'IE', 'ME'] },
  { name: 'Mapua MCL Senior High School (SHS)', programs: ['ABM', 'STEM', 'HUMSS', 'ICT'] },
  { name: 'Non-Academic Organization', programs: [] },
];

const likertScale = [
  { val: 1, label: 'Strongly Disagree', color: '#ef4444', light: '#fee2e2' },
  { val: 2, label: 'Disagree', color: '#f97316', light: '#ffedd5' },
  { val: 3, label: 'Neutral', color: '#eab308', light: '#fef9c3' },
  { val: 4, label: 'Agree', color: '#22c55e', light: '#dcfce7' },
  { val: 5, label: 'Strongly Agree', color: '#30bdb7', light: '#ccfbf1' },
  { val: 0, label: 'No Basis', color: '#64748b', light: '#f1f5f9', display: 'No basis' },
];

const likertStatements = [
  'The ideas, suggestions, and solutions that were implemented during the community service helped in providing solutions to the problems and issues in the community.',
  'The community service brought about initiatives and teamwork that somehow addressed the problems and issues at hand.',
  'Being able to understand the diversity of the people involved in the community allowed for a successful implementation of the community service initiative.',
  'Through the community service initiative, I was able to realize the role that I have to play in the society both as a student and a Filipino citizen.',
  'The profession that I will pursue in the future along with the knowledge and skills that I would be able to develop would contribute to addressing social problems and issues.',
  'I consider community development initiatives to be the last of my priorities. I think that by focusing on academics, friends, family, recreation, etc. I would be able to help the society more.',
  'I think that my participation in the community service initiative did not help the community or the country let alone the world. My involvement was insignificant and did not make any difference.',
  'I was able to realize that participating in community development initiatives, no matter how big or small the involvement is, would make a difference. As such, I am willing to manage my time and have the initiative to participate whenever there is an opportunity.',
];

const PostActivitySurvey = ({
  onSubmit,
  initialName = '',
  initialEngagementType = '',
  initialTitle = '',
  initialDate = '',
  initialCollege = '',
  initialProgram = '',
  initialNonAcademicOrg = '',
  initialLocation = '',
}) => {
  const [form, setForm] = useState({
    name: initialName,

    engagementType: initialEngagementType,
    initiativeTitle: initialTitle,
    dateOfImplementation: initialDate,
    college: initialCollege,
    program: initialProgram,
    nonAcademicOrg: initialNonAcademicOrg,
    location: initialLocation,
    likert_0: '',
    likert_1: '',
    likert_2: '',
    likert_3: '',
    likert_4: '',
    likert_5: '',
    likert_6: '',
    likert_7: '',
  });

  useEffect(() => {
    if (initialName) setForm((prev) => ({ ...prev, name: initialName }));
  }, [initialName]);

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
          margin: 0;
        }
        .post-activity-survey-form label {
          font-weight: 500;
          color: #222;
          margin: 0;
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
          border-radius: 12px;
          accent-color: #30bdb7;
          padding: 10px 12px;
          font-size: 1rem;
          background: #ffffff;
          color: #222;
          margin-top: 2px;
          outline: none;
          transition: border 0.2s;
          cursor: text;
        }
        .post-activity-survey-form input:focus,
        .post-activity-survey-form select:focus,
        .post-activity-survey-form textarea:focus {
          border: 1.5px solid #30bdb7;
        }
        .post-activity-survey-form input:disabled,
        .post-activity-survey-form select:disabled {
          color: #9ca3af;
          background: #f3f4f6;
          cursor: not-allowed;
          border-color: #e5e7eb;
        }
        .post-activity-survey-form .post-likert-options {
          display: grid;
          grid-template-columns: repeat(5, minmax(38px, 1fr)) minmax(92px, 1.25fr);
          gap: 8px;
          align-items: stretch;
        }
        .post-activity-survey-form .likert-choice {
          min-height: 42px;
          border-radius: 11px;
          border: 1.5px solid #e5e7eb;
          background: #fff;
          color: #475569;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, color 0.15s, box-shadow 0.15s;
        }
        .post-activity-survey-form .likert-choice:hover {
          border-color: var(--choice-color);
          color: var(--choice-color);
        }
        .post-activity-survey-form .likert-choice.selected {
          background: var(--choice-color);
          border-color: var(--choice-color);
          color: #fff;
          box-shadow: 0 3px 10px var(--choice-shadow);
        }
        .post-activity-survey-form .likert-choice-no-basis {
          font-size: 12px;
          line-height: 1.15;
        }
        .post-activity-survey-form .post-likert-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .post-activity-survey-form .post-likert-label {
          min-width: 110px;
          flex-shrink: 0;
        }
        @media (max-width: 520px) {
          .post-activity-survey-form {
            padding: 20px 16px;
          }
          .post-activity-survey-form .post-likert-row {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }
          .post-activity-survey-form .post-likert-options {
            grid-template-columns: repeat(5, 1fr);
          }
          .post-activity-survey-form .likert-choice-no-basis {
            grid-column: 1 / -1;
            font-size: 13px;
            min-height: 36px;
          }
          .post-activity-survey-form .post-likert-label {
            min-width: unset;
          }
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
          transition: background 0.18s;
        }
        .post-activity-survey-form button[type="submit"]:hover {
          background: #249e9a;
        }
      `}</style>

      <h2>Post-Activity Survey</h2>

      <label>
        Name *
        <input name="name" value={form.name} onChange={handleChange} required autoComplete="off" disabled={!!initialName} />
      </label>

      <label>
        Title of Service-Learning / Community Engagement Initiative *
        <input name="initiativeTitle" value={form.initiativeTitle} disabled placeholder="e.g., Feeding Program for Barangay 123" autoComplete="off" />
      </label>

      <label>
        Type of Engagement *
        <select name="engagementType" value={form.engagementType} disabled>
          <option value="">Select Type</option>
          <option value="sl">Service-Learning</option>
          <option value="ce">Community Engagement</option>
        </select>
      </label>

      <label>
        College/Department/Organization *
        <select name="college" value={form.college} disabled>
          <option value="">Select College/Department/Org</option>
          {colleges.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
      </label>

      {form.college === 'Non-Academic Organization' ? (
        <label>
          Organization Name *
          <input name="nonAcademicOrg" value={form.nonAcademicOrg} disabled autoComplete="off" />
        </label>
      ) : (
        selectedCollege && selectedCollege.programs.length > 0 && (
          <label>
            Program *
            <select name="program" value={form.program} disabled>
              <option value="">Select Program</option>
              {selectedCollege.programs.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        )
      )}

      <label>
        Date of Implementation *
        <input name="dateOfImplementation" type="date" value={form.dateOfImplementation} onChange={handleChange} required />
      </label>

      <label>
        Location/Venue *
        <input name="location" value={form.location} disabled placeholder="e.g., Barangay 123 Hall" autoComplete="off" />
      </label>

      {/* Likert Scale Section */}
      <div style={{ marginTop: 8 }}>
        <h3 style={{ fontWeight: 700, color: '#23235b', fontSize: '1.05rem', marginBottom: 4 }}>
          Please indicate how much you agree with each statement.
        </h3>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Scale: <b>1</b> Strongly Disagree &rarr; <b>5</b> Strongly Agree, then <b>No basis</b> if not applicable.
        </p>
        {likertStatements.map((statement, idx) => {
          const selected = form[`likert_${idx}`];
          const selectedMeta = likertScale.find(s => String(s.val) === selected);
          return (
            <div key={idx} style={{
              background: selectedMeta ? selectedMeta.light : '#fafbfc',
              border: `1.5px solid ${selectedMeta ? selectedMeta.color : '#e5e7eb'}`,
              borderRadius: 14,
              padding: '16px 18px',
              marginBottom: 12,
              transition: 'all 0.2s ease',
            }}>
              <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#1f2937', fontWeight: 500, lineHeight: 1.5 }}>
                {statement}
              </p>
              <div className="post-likert-row">
                <div className="post-likert-options" role="radiogroup" aria-label={`Statement ${idx + 1}`}>
                  {likertScale.map(({ val, label, display, color }) => {
                    const isSelected = selected === String(val);
                    return (
                      <button
                        key={val}
                        type="button"
                        className={`likert-choice${isSelected ? ' selected' : ''}${val === 0 ? ' likert-choice-no-basis' : ''}`}
                        title={label}
                        aria-pressed={isSelected}
                        onClick={() => setForm(prev => ({ ...prev, [`likert_${idx}`]: String(val) }))}
                        style={{ '--choice-color': color, '--choice-shadow': `${color}55` }}
                      >
                        {display || val}
                      </button>
                    );
                  })}
                </div>
                <div className="post-likert-label">
                  {selectedMeta && (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: selectedMeta.color,
                      background: selectedMeta.light,
                      padding: '3px 10px',
                      borderRadius: 20,
                      border: `1px solid ${selectedMeta.color}44`,
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                    }}>
                      {selectedMeta.label}
                    </span>
                  )}
                </div>
              </div>
              {/* hidden required input to trigger browser validation */}
              <input
                type="radio"
                name={`likert_${idx}`}
                value={selected || ''}
                checked={!!selected}
                onChange={() => {}}
                required
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
              />
            </div>
          );
        })}
      </div>

      <button type="submit">Submit</button>
    </form>
  );
};

export default PostActivitySurvey;
