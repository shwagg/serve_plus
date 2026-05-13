import { useState, useEffect, useRef } from 'react';

function CustomSelect({ value, onChange, options, placeholder, required }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          border: `1.5px solid ${open ? '#30bdb7' : '#e0e4ea'}`,
          borderRadius: 12, padding: '10px 12px', fontSize: '1rem',
          background: '#fafbfc', color: selected ? '#222' : '#9ca3af',
          cursor: 'pointer', textAlign: 'left', transition: 'border 0.2s',
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <span style={{ fontSize: 12, color: '#9ca3af', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {required && (
        <input tabIndex={-1} required value={value} onChange={() => {}}
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }} />
      )}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
          background: '#fff', border: '1.5px solid #e0e4ea', borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
        }}>
          {options.map((o) => (
            <div
              key={o.value}
              onMouseDown={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: '10px 14px', fontSize: '0.95rem', cursor: 'pointer',
                background: o.value === value ? '#f0fdfb' : '#fff',
                color: o.value === value ? '#30bdb7' : '#222',
                fontWeight: o.value === value ? 600 : 400,
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = '#f9fafb'; }}
              onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = '#fff'; }}
            >
              {o.value === value && <span style={{ marginRight: 8, color: '#30bdb7' }}>✓</span>}
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

const PreActivitySurvey = ({
  initialName = "",
  initialEngagementType = "",
  initialTitle = "",
  initialCollege = "",
  initialProgram = "",
  onSubmit,
  onProgressChange,
  children
}) => {

  const [form, setForm] = useState({
    name: initialName,
    engagementType: initialEngagementType,
    initiativeTitle: initialTitle,
    college: initialCollege,
    program: initialProgram,
    nonAcademicOrg: '',
    participation: [],
    participationOther: '',
    prevService: '',
    frequency: '',
    likert_0: '',
    likert_1: '',
    likert_2: '',
    likert_3: '',
    likert_4: '',
    likert_5: '',
    likert_6: '',
    likert_7: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleParticipationChange = (e) => {
    const { value, checked } = e.target;
    setForm((prev) => {
      let updatedParticipation = [...prev.participation];

      if (checked) {
        if (!updatedParticipation.includes(value)) {
          updatedParticipation.push(value);
        }
      } else {
        updatedParticipation = updatedParticipation.filter((p) => p !== value);
      }

      return {
        ...prev,
        participation: updatedParticipation,
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) {
      onSubmit(form);
    }
  };

  const selectedCollege = colleges.find((c) => c.name === form.college);
  const likertScale = [
    { val: 1, label: 'Strongly Disagree', color: '#ef4444', light: '#fee2e2' },
    { val: 2, label: 'Disagree', color: '#f97316', light: '#ffedd5' },
    { val: 3, label: 'Neutral', color: '#eab308', light: '#fef9c3' },
    { val: 4, label: 'Agree', color: '#22c55e', light: '#dcfce7' },
    { val: 5, label: 'Strongly Agree', color: '#30bdb7', light: '#ccfbf1' },
    { val: 0, label: 'No Basis', color: '#64748b', light: '#f1f5f9', display: 'No basis' },
  ];

  const progressFields = [
    form.name,
    form.college,
    form.prevService,
    form.frequency,
    form.participation.length > 0 ? 'filled' : '',
    form.likert_0,
    form.likert_1,
    form.likert_2,
    form.likert_3,
    form.likert_4,
    form.likert_5,
    form.likert_6,
    form.likert_7,
  ];
  const progressPct = Math.round((progressFields.filter(Boolean).length / progressFields.length) * 100);

  useEffect(() => {
    if (onProgressChange) onProgressChange(progressPct);
  }, [progressPct, onProgressChange]);

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
          font-family: 'Inter', Helvetica, Arial, sans-serif;
        }
        .pre-activity-survey-form h2 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #23235b;
          margin-bottom: 18px;
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
          border-radius: 12px;
          accent-color: #30bdb7;
          padding: 10px 12px;
          font-size: 1rem;
          background: #ffffff;
          color: #222;
          margin-top: 2px;
          margin-bottom: 0;
          outline: none;
          transition: border 0.2s;
          cursor: text;
        }
        .pre-activity-survey-form input:focus,
        .pre-activity-survey-form select:focus,
        .pre-activity-survey-form textarea:focus {
          border: 1.5px solid #30bdb7;
          outline: none;
        }
        .pre-activity-survey-form input:disabled,
        .pre-activity-survey-form select:disabled {
          color: #9ca3af;
          background: #f3f4f6;
          cursor: not-allowed;
          border-color: #e5e7eb;
        }
        .pre-activity-survey-form fieldset {
          border: none;
          padding: 0;
          margin: 0;
        }
        .pre-activity-survey-form legend {
          font-weight: 600;
          color: #222;
          margin-bottom: 8px;
        }
        .pre-activity-survey-form .pill-group {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 8px;
        }
        .pre-activity-survey-form .pill-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          border-radius: 99px;
          border: 1.5px solid #d1d5db;
          background: #fff;
          color: #374151;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }
        .pre-activity-survey-form .pill-btn:hover {
          border-color: #30bdb7;
          color: #30bdb7;
        }
        .pre-activity-survey-form .pill-btn.selected {
          background: #30bdb7;
          border-color: #30bdb7;
          color: #fff;
        }
        .pre-activity-survey-form .pill-btn.selected .pill-check {
          display: inline-flex;
        }
        .pre-activity-survey-form .pill-check {
          display: none;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          font-size: 10px;
          font-weight: 700;
          flex-shrink: 0;
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
        .pre-activity-survey-form .survey-likert-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 8px;
        }
        .pre-activity-survey-form .survey-likert-heading {
          display: flex;
          flex-direction: column;
          gap: 4px;
          border-bottom: 1px solid #e5e7eb;
          padding-bottom: 12px;
        }
        .pre-activity-survey-form .survey-likert-heading h3 {
          font-weight: 700;
          color: #23235b;
          font-size: 1.05rem;
          margin: 0;
        }
        .pre-activity-survey-form .survey-likert-heading p {
          font-size: 13px;
          color: #6b7280;
          margin: 0;
          line-height: 1.45;
        }
        .pre-activity-survey-form .pre-likert-card {
          border-radius: 14px;
          padding: 16px;
          transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
        }
        .pre-activity-survey-form .pre-likert-question {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #1f2937;
          font-weight: 500;
          line-height: 1.5;
        }
        .pre-activity-survey-form .pre-likert-options {
          display: grid;
          grid-template-columns: repeat(5, minmax(38px, 1fr)) minmax(92px, 1.25fr);
          gap: 8px;
          align-items: stretch;
        }
        .pre-activity-survey-form .likert-choice {
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
        .pre-activity-survey-form .likert-choice:hover {
          border-color: var(--choice-color);
          color: var(--choice-color);
        }
        .pre-activity-survey-form .likert-choice.selected {
          background: var(--choice-color);
          border-color: var(--choice-color);
          color: #fff;
          box-shadow: 0 3px 10px var(--choice-shadow);
        }
        .pre-activity-survey-form .likert-choice-no-basis {
          font-size: 12px;
          line-height: 1.15;
        }
        .pre-activity-survey-form .pre-likert-selected-label {
          margin-top: 10px;
          min-height: 23px;
        }
        .pre-activity-survey-form .likert-selected-pill {
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          border: 1px solid var(--choice-border);
          color: var(--choice-color);
          background: var(--choice-bg);
        }
        .pre-activity-survey-form .pre-likert-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .pre-activity-survey-form .pre-likert-selected-label {
          min-width: 110px;
          flex-shrink: 0;
          margin-top: 0;
          min-height: 23px;
        }
        @media (max-width: 520px) {
          .pre-activity-survey-form {
            padding: 20px 16px;
          }
          .pre-activity-survey-form .pre-likert-row {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }
          .pre-activity-survey-form .pre-likert-options {
            grid-template-columns: repeat(5, 1fr);
          }
          .pre-activity-survey-form .likert-choice-no-basis {
            grid-column: 1 / -1;
            font-size: 13px;
            min-height: 36px;
          }
          .pre-activity-survey-form .pre-likert-selected-label {
            min-width: unset;
            margin-top: 4px;
          }
        }
      `}</style>
      <label>
        Complete Name *
        <input name="name" type='text' value={form.name} onChange={handleChange} required autoComplete="on" />
      </label>
      <label>
        Title of Initiative *
        <input name="initiativeTitle" value={form.initiativeTitle} disabled required placeholder="e.g., Feeding Program for Barangay 123" autoComplete="off" />
      </label>
      <label>
        Type of Engagement *
        <select name="engagementType" value={form.engagementType} disabled required>
          <option value="">Select Type</option>
          <option value="sl">Service-Learning</option>
          <option value="ce">Community Engagement</option>
        </select>
      </label>
      <label>
        College/Department/Organization *
        <CustomSelect
          value={form.college}
          onChange={(val) => setForm((prev) => ({ ...prev, college: val, program: '' }))}
          placeholder="Select College/Department/Org"
          required
          options={colleges.map((c) => ({ value: c.name, label: c.name }))}
        />
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
            <CustomSelect
              value={form.program}
              onChange={(val) => setForm((prev) => ({ ...prev, program: val }))}
              placeholder="Select Program"
              required
              options={selectedCollege.programs.map((p) => ({ value: p, label: p }))}
            />
          </label>
        )
      )}

      <fieldset>
        <legend>Type/Level of Participation <span style={{ fontWeight: 400, color: '#888', fontSize: 13 }}>(Select all that apply)</span></legend>
        <div className="pill-group">
          {['Organizer', 'Donor', 'Participant', 'Other'].map((opt) => {
            const selected = form.participation.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                className={`pill-btn${selected ? ' selected' : ''}`}
                onClick={() => {
                  const e = { target: { value: opt, checked: !selected } };
                  handleParticipationChange(e);
                }}
              >
                <span className="pill-check">✓</span>
                {opt}
              </button>
            );
          })}
        </div>
        {form.participation.includes('Other') && (
          <input
            name="participationOther"
            value={form.participationOther}
            onChange={handleChange}
            placeholder="Please specify"
            style={{ marginTop: 10, width: '100%' }}
          />
        )}
      </fieldset>
      <fieldset>
        <legend>Previous Community Service Experience *</legend>
        <div className="pill-group">
          {['Yes', 'No'].map((opt) => {
            const selected = form.prevService === opt;
            return (
              <button
                key={opt}
                type="button"
                className={`pill-btn${selected ? ' selected' : ''}`}
                onClick={() => setForm((prev) => ({ ...prev, prevService: opt }))}
              >
                <span className="pill-check">✓</span>
                {opt}
              </button>
            );
          })}
        </div>
        {/* hidden required input for validation */}
        <input type="text" name="prevService" value={form.prevService} required onChange={() => {}} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }} />
      </fieldset>
      <label>
        Frequency of Community Service *
        <CustomSelect
          value={form.frequency}
          onChange={(val) => setForm((prev) => ({ ...prev, frequency: val }))}
          placeholder="Select Frequency"
          required
          options={[
            { value: 'Once a year', label: 'Once a year' },
            { value: '2-4 times a year', label: '2-4 times a year' },
            { value: 'Monthly', label: 'Monthly' },
            { value: 'Weekly', label: 'Weekly' },
            { value: 'Several times a week', label: 'Several times a week' },
            { value: 'Not Applicable', label: 'Not Applicable' },
          ]}
        />
      </label>
      {/* Likert Scale Section */}
      <div style={{ marginTop: 8 }}>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
          Scale: 1 Strongly Disagree, 2 Disagree, 3 Neutral, 4 Agree, 5 Strongly Agree, then No basis.
        </p>
        <h3 style={{ fontWeight: 700, color: '#23235b', fontSize: '1.05rem', marginBottom: 4 }}>
          How much do you agree with each statement? 🤔
        </h3>
        <p style={{ display: 'none' }}>
          Tap a number to rate — <b>1</b> = Strongly Disagree, <b>5</b> = Strongly Agree, <b>0</b> = No basis
        </p>
        {[
          { text: 'There are existing problems in the community and I can come up with ideas, suggestions, and solutions to address these problems and issues.', emoji: '💡' },
          { text: 'Volunteer work along with teamwork would somehow help solve social problems.', emoji: '🤝' },
          { text: 'People in the community come from diverse background, culture, and social standing and it is important to understand these differences in order to help solve problems.', emoji: '🌍' },
          { text: 'I would like to make a difference in the community because I have a social and moral obligation to do so. I would do this even if my contribution would seem very little.', emoji: '💪' },
          { text: "Contributing and improving skills I've learned from my degree program or affiliation would somehow solve social problems.", emoji: '🎓' },
          { text: 'I would definitely participate in community development initiatives but it would be the last of my priorities because I have to consider other aspects of my life first such as academics, friends, family, recreation, etc.', emoji: '📋' },
          { text: 'I think that the magnitude of issues in our country and in the world in general is so big that whatever I do to help would be insignificant and would not make any difference.', emoji: '🌐' },
          { text: 'I would consider participating in community development initiatives whenever I can, and with proper time management and the initiative to do so, I definitely can.', emoji: '⏰' },
        ].map((item, idx) => {
          const selected = form[`likert_${idx}`];
          const selectedMeta = likertScale.find(s => String(s.val) === selected);
          return (
            <div key={idx} className="pre-likert-card" style={{
              background: selectedMeta ? selectedMeta.light : '#fafbfc',
              border: `1.5px solid ${selectedMeta ? selectedMeta.color : '#e5e7eb'}`,
              borderRadius: 14,
              padding: '16px 18px',
              marginBottom: 12,
              transition: 'all 0.2s ease',
            }}>
              <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#1f2937', fontWeight: 500, lineHeight: 1.5 }}>
                <span style={{ marginRight: 8 }}>{item.emoji}</span>{item.text}
              </p>
              <div className="pre-likert-row">
                <div className="pre-likert-options" role="radiogroup" aria-label={`Statement ${idx + 1}`}>
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
                        style={{
                          '--choice-color': color,
                          '--choice-shadow': `${color}55`,
                        }}
                      >
                        {display || val}
                      </button>
                    );
                  })}
                </div>
                <div className="pre-likert-selected-label">
                  {selectedMeta && (
                    <span className="likert-selected-pill" style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: selectedMeta.color,
                      background: selectedMeta.light,
                      padding: '3px 10px',
                      borderRadius: 20,
                      border: `1px solid ${selectedMeta.color}44`,
                      whiteSpace: 'nowrap',
                    }}>
                      {selectedMeta.label}
                    </span>
                  )}
                </div>
              </div>
              {/* hidden required radio to trigger browser validation */}
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
      {children}
      <button type="submit">Submit</button>
    </form>
  );
};

export default PreActivitySurvey;
