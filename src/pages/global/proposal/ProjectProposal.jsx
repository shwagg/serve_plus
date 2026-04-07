
// React and library imports
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../firebaseConfig';
import { collection, addDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import '../../../styles/ProjectProposal.css';
import SummaryPanel from '../SummaryPanel';
import { showToast } from '../../../utils/toast';

/**
 * Reusable custom dropdown that matches the SDG dropdown style and stays the same width as its trigger.
 */
function CustomSelect({ id, name, value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="sdg-dropdown-wrapper" ref={wrapperRef}>
      <button
        type="button"
        id={id}
        className="sdg-dropdown-toggle"
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: selected ? '#2d3748' : '#a0aec0' }}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="dropdown-arrow">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="sdg-dropdown-menu" role="listbox">
          {options.length === 0 ? (
            <div className="sdg-option" style={{ color: '#a0aec0', cursor: 'default' }}>
              <span className="sdg-option-text">{placeholder}</span>
            </div>
          ) : (
            options.map(opt => (
              <div
                key={opt.value}
                className={`sdg-option${value === opt.value ? ' selected' : ''}`}
                role="option"
                aria-selected={value === opt.value}
                onClick={() => {
                  onChange({ target: { name, value: opt.value } });
                  setOpen(false);
                }}
              >
                <span className="sdg-option-text">{opt.label}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Tag input for proponents. Pressing Enter or comma commits the typed name as a tag.
 * The first `lockedCount` tags show a lock instead of a remove button.
 */
function ProponentTagInput({ tags, onAdd, onRemove, lockedCount = 0 }) {
  const [input, setInput] = useState('');

  const commit = () => {
    const name = input.trim();
    if (!name || tags.includes(name)) { setInput(''); return; }
    onAdd(name);
    setInput('');
  };

  return (
    <div className="proponent-tags-box">
      {tags.map((tag, i) => (
        <span key={i} className="proponent-tag">
          {tag}
          {i < lockedCount
            ? <span className="proponent-tag-lock" title="Auto-filled from your account">🔒</span>
            : <button type="button" className="proponent-tag-remove" onClick={() => onRemove(i)}>×</button>
          }
        </span>
      ))}
      <input
        type="text"
        className="proponent-tag-input"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === ',')    { e.preventDefault(); commit(); }
        }}
        placeholder={tags.length === 0 ? 'Type a name and press Enter' : 'Add another name…'}
      />
    </div>
  );
}

/**
 * Numbered list input for stakeholders. Pressing Enter commits the item and shows it
 * as "1. Name", "2. Name", etc.
 */
function NumberedStakeholderInput({ items, onAdd, onRemove, placeholder, addMorePlaceholder }) {
  const [input, setInput] = useState('');

  const commit = () => {
    const val = input.trim();
    if (!val) return;
    onAdd(val);
    setInput('');
  };

  return (
    <div className="numbered-list-box">
      {items.map((item, i) => (
        <div key={i} className="numbered-item">
          <span className="numbered-item-num">{i + 1}.</span>
          <span className="numbered-item-text">{item}</span>
          <button type="button" className="numbered-item-remove" onClick={() => onRemove(i)}>×</button>
        </div>
      ))}
      <input
        type="text"
        className="numbered-item-add"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder={items.length === 0
          ? (placeholder || 'Type a name and press Enter')
          : (addMorePlaceholder || 'Add another…')}
      />
    </div>
  );
}

/**
 * Main component for the Project Proposal form.
 * Handles form state, submission, and PDF export for both Service Learning and Community Engagement proposals.
 * @param {Object} props
 * @param {string} props.projectType - The type of project ('service-learning' or 'community-engagement')
 * @param {Function} props.onClose - Callback to close the proposal form
 */
function ProjectProposal({ projectType, onClose, editProposal, timelineNode }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [hasProponentName, setHasProponentName] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    sdgs: [],
    targetDate: '',
    stakeholders: [],         // array — rendered as numbered list
    location: '',
    volunteerHours: '',
    description: '',
    objectives: '',
    specificActivities: [],   // array — each item becomes a task on submission
    successIndicators: '',
    budget: '',
    preparedBy: '',           // primary proponent name (auto-filled from auth)
    proponents: [],           // full proponents array (managed by tag input)
    reviewedBy: '',           // Program Chair signatory
    recommendedBy: '',        // College Dean signatory
    affiliatedDepartment: '',
    studentOutcomes: '',
    alt: '',
    partnerSchool: '',
  });
  // Department options for dropdown
  const departments = [
    "College of Arts and Science (CAS)",
    "College of Computer and Information Science (CCIS)",
    "College of Health Sciences (CHS)",
    "College of Nursing (CN)",
    "College of Maritime Education and Training (CMET)",
    "E.T. Yuchengco College of Business (ETYCB)",
    "Mapua-Laguna Institute of Aviation (MIA)",
    "Mapua Institute of Technology at Laguna (MITL)",
    "Mapua MCL Senior High School (SHS)"
  ];
  const [partnerSchools, setPartnerSchools] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [chairList, setChairList] = useState([]);
  const [deanList, setDeanList] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPartnerSchools(allUsers.filter(u => u.role === 'partner'));
        setFacultyList(allUsers.filter(u => u.role === 'faculty'));
        setChairList(allUsers.filter(u => u.position === 'program chair'));
        setDeanList(allUsers.filter(u => u.position === 'college dean'));
      } catch {
        setPartnerSchools([]);
        setFacultyList([]);
        setChairList([]);
        setDeanList([]);
      } finally {
        setLoadingSchools(false);
      }
    }
    fetchUsers();
  }, []);
  // Always fetch the user's full name from Firestore (avoids showing email as the proponent tag)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user?.uid) {
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            // Use the user's full name from Firestore (the 'name' field, not 'username')
            const name = data.name || '';
            if (name) {
              setFormData(prev => ({
                ...prev,
                preparedBy: name,
                // Always refresh the first (locked) proponent with the current user's name
                proponents: prev.proponents?.length ? [name, ...prev.proponents.slice(1)] : [name],
              }));
              setHasProponentName(true);
            } else {
              setHasProponentName(false);
            }
            if (data.role) {
              setUserRole(data.role);
              if (data.role === 'faculty') {
                setSlFields(prev => ({ ...prev, assignedFaculty: data.name || '' }));
              }
            }
          } else {
            setHasProponentName(false);
          }
        } catch (err) {
          setHasProponentName(false);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Service Learning specific fields
  const [slFields, setSlFields] = useState({
    section: '',
    course: '',
    courseCode: '',
    assignedFaculty: ''
  });

  // Community Engagement specific fields
  const [ceFields, setCeFields] = useState({
    nature: '',
    learningOutcomes: '0', // Default to first option (Intellectual Development)
    customLearningOutcome: '',
    assignedFaculty: '',
  });

  // Draft persistence — placed after all state declarations so refs initialise correctly
  const draftKey = useRef(`serve_plus_draft_${projectType}_${auth.currentUser?.uid || 'guest'}`).current;
  const submittedRef = useRef(false);
  const hasUserInputRef = useRef(false); // true only after user actually types/selects something
  const [draftRestored, setDraftRestored] = useState(false);

  const formDataRef = useRef(formData);
  const slFieldsRef = useRef(slFields);
  const ceFieldsRef = useRef(ceFields);
  useEffect(() => { formDataRef.current = formData; }, [formData]);
  useEffect(() => { slFieldsRef.current = slFields; }, [slFields]);
  useEffect(() => { ceFieldsRef.current = ceFields; }, [ceFields]);

  // Pre-populate form when editing an existing proposal
  useEffect(() => {
    if (!editProposal) return;
    const p = editProposal;
    setFormData({
      title: p.title || '',
      sdgs: p.sdgs || [],
      targetDate: p.targetDate || '',
      stakeholders: Array.isArray(p.stakeholders) ? p.stakeholders : [],
      location: p.location || '',
      volunteerHours: p.volunteerHours ? String(p.volunteerHours) : '',
      description: p.description || '',
      objectives: p.objectives || '',
      specificActivities: Array.isArray(p.specificActivities) ? p.specificActivities : [],
      successIndicators: Array.isArray(p.successIndicators) ? p.successIndicators.join('\n') : (p.successIndicators || ''),
      budget: p.budget || '',
      studentOutcomes: p.studentOutcomes || '',
      preparedBy: p.preparedBy || '',
      proponents: Array.isArray(p.proponents) ? p.proponents : [],
      reviewedBy: p.reviewedBy || '',
      recommendedBy: p.recommendedBy || '',
      affiliatedDepartment: p.affiliatedDepartment || '',
      alt: p.alt || '',
      partnerSchool: p.partnerSchool || '',
    });
    if (p.projectType === 'sl' && p.slFields) {
      setSlFields({
        section: p.slFields.section || '',
        course: p.slFields.course || '',
        courseCode: p.slFields.courseCode || '',
        assignedFaculty: p.slFields.assignedFaculty || '',
      });
    }
    if (p.projectType === 'ce' && p.ceFields) {
      setCeFields({
        nature: p.ceFields.nature || '',
        learningOutcomes: p.ceFields.learningOutcomes || '0',
        customLearningOutcome: p.ceFields.customLearningOutcome || '',
        assignedFaculty: p.ceFields.assignedFaculty || '',
      });
    }
    setHasProponentName(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editProposal?.id]);

  // Restore draft on mount (skip when editing an existing proposal)
  useEffect(() => {
    if (editProposal) return;
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.formData) {
          const restored = { ...draft.formData };
          // Backward compat: stakeholders / specificActivities were strings in older drafts
          if (typeof restored.stakeholders === 'string') {
            restored.stakeholders = restored.stakeholders
              ? restored.stakeholders.split('\n').filter(s => s.trim())
              : [];
          }
          if (typeof restored.specificActivities === 'string') {
            restored.specificActivities = restored.specificActivities
              ? restored.specificActivities.split('\n').filter(s => s.trim())
              : [];
          }
          if (!Array.isArray(restored.stakeholders))       restored.stakeholders       = [];
          if (!Array.isArray(restored.proponents))         restored.proponents         = [];
          if (!Array.isArray(restored.specificActivities)) restored.specificActivities = [];
          setFormData(prev => ({ ...prev, ...restored }));
        }
        if (draft.slFields) setSlFields(prev => ({ ...prev, ...draft.slFields }));
        if (draft.ceFields) setCeFields(prev => ({ ...prev, ...draft.ceFields }));
        setDraftRestored(true);
      }
    } catch (e) { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft while typing (debounced 1.5s)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ formData, slFields, ceFields }));
      } catch (e) { /* ignore */ }
    }, 1500);
    return () => clearTimeout(timer);
  }, [formData, slFields, ceFields, draftKey]);

  // Save draft immediately on unmount (handles accidental close)
  // Guard: only save if user has actually typed something — prevents React StrictMode's
  // simulated unmount from overwriting a previously saved draft with the initial empty state.
  useEffect(() => {
    return () => {
      if (submittedRef.current) return;
      if (!hasUserInputRef.current) return;
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          formData: formDataRef.current,
          slFields: slFieldsRef.current,
          ceFields: ceFieldsRef.current,
        }));
      } catch (e) { /* ignore */ }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearDraft = useCallback(() => {
    submittedRef.current = true;
    try { localStorage.removeItem(draftKey); } catch (e) { /* ignore */ }
  }, [draftKey]);

  const discardDraft = () => {
    clearDraft();
    submittedRef.current = false;
    hasUserInputRef.current = false;
    setFormData({ title: '', sdgs: [], targetDate: '', stakeholders: [], location: '', volunteerHours: '', description: '', objectives: '', specificActivities: [], successIndicators: '', budget: '', preparedBy: formDataRef.current?.preparedBy || '', proponents: formDataRef.current?.preparedBy ? [formDataRef.current.preparedBy] : [], reviewedBy: '', recommendedBy: '', affiliatedDepartment: '', studentOutcomes: '', alt: '', partnerSchool: '' });
    setSlFields({ section: '', course: '', courseCode: '', assignedFaculty: slFieldsRef.current?.assignedFaculty || '' });
    setCeFields({ nature: '', learningOutcomes: '0', customLearningOutcome: '', assignedFaculty: '' });
    setDraftRestored(false);
    showToast('Draft discarded.');
  };

  // SDG dropdown state
  const [showSdgDropdown, setShowSdgDropdown] = useState(false);

  // All 17 SDGs
  const sdgOptions = [
    { number: 1, name: 'No Poverty' },
    { number: 2, name: 'Zero Hunger' },
    { number: 3, name: 'Good Health and Well-being' },
    { number: 4, name: 'Quality Education' },
    { number: 5, name: 'Gender Equality' },
    { number: 6, name: 'Clean Water and Sanitation' },
    { number: 7, name: 'Affordable and Clean Energy' },
    { number: 8, name: 'Decent Work and Economic Growth' },
    { number: 9, name: 'Industry, Innovation and Infrastructure' },
    { number: 10, name: 'Reduced Inequality' },
    { number: 11, name: 'Sustainable Cities and Communities' },
    { number: 12, name: 'Responsible Consumption and Production' },
    { number: 13, name: 'Climate Action' },
    { number: 14, name: 'Life Below Water' },
    { number: 15, name: 'Life on Land' },
    { number: 16, name: 'Peace and Justice Strong Institutions' },
    { number: 17, name: 'Partnerships to achieve the Goal' },
  ];

  /**
   * Returns the title for the proposal based on project type.
   */
  const getProjectTypeTitle = () => {
    return projectType === 'service-learning'
      ? 'Service Learning Project Proposal'
      : 'Community Engagement Project Proposal';
  };

  /**
   * Handles changes to main form fields (formData).
   * Clears assigned faculty selections when the affiliated department changes.
   */
  const handleInputChange = (e) => {
    hasUserInputRef.current = true;
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'affiliatedDepartment') {
      setSlFields(prev => ({ ...prev, assignedFaculty: '' }));
      setCeFields(prev => ({ ...prev, assignedFaculty: '' }));
    }
  };

  /**
   * Handles changes to Service Learning specific fields.
   */
  const handleSlFieldChange = (e) => {
    hasUserInputRef.current = true;
    const { name, value } = e.target;
    setSlFields(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * Handles changes to Community Engagement specific fields.
   */
  const handleCeFieldChange = (e) => {
    hasUserInputRef.current = true;
    const { name, value } = e.target;
    setCeFields(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * Toggles selection of an SDG number in the formData.sdgs array.
   * @param {number} sdgNumber
   */
  const handleSdgToggle = (sdgNumber) => {
    hasUserInputRef.current = true;
    setFormData(prev => {
      const currentSdgs = prev.sdgs || [];
      if (currentSdgs.includes(sdgNumber)) {
        return {
          ...prev,
          sdgs: currentSdgs.filter(num => num !== sdgNumber)
        };
      } else {
        return {
          ...prev,
          sdgs: [...currentSdgs, sdgNumber].sort((a, b) => a - b)
        };
      }
    });
  };

  /**
   * Removes an SDG number from the formData.sdgs array.
   * @param {number} sdgNumber
   */
  const handleRemoveSdg = (sdgNumber) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({
      ...prev,
      sdgs: prev.sdgs.filter(num => num !== sdgNumber)
    }));
  };

  const handleAddProponent = (name) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, proponents: [...(prev.proponents || []), name] }));
  };

  const handleRemoveProponent = (index) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, proponents: prev.proponents.filter((_, i) => i !== index) }));
  };

  const handleAddStakeholder = (text) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, stakeholders: [...(prev.stakeholders || []), text] }));
  };

  const handleRemoveStakeholder = (index) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, stakeholders: prev.stakeholders.filter((_, i) => i !== index) }));
  };

  const handleAddActivity = (text) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, specificActivities: [...(prev.specificActivities || []), text] }));
  };

  const handleRemoveActivity = (index) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, specificActivities: prev.specificActivities.filter((_, i) => i !== index) }));
  };

  //1 month rule for selecting target date for the project
  const minTargetDate = new Date();
  minTargetDate.setMonth(minTargetDate.getMonth() + 1);

  const minDateString =
    minTargetDate.getFullYear() +
    "-" +
    String(minTargetDate.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(minTargetDate.getDate()).padStart(2, "0");

  // Faculty / chairs / deans filtered by the selected affiliated department
  const filteredFaculty = facultyList.filter(
    f => !formData.affiliatedDepartment || f.department === formData.affiliatedDepartment
  );
  const filteredChairs = chairList.filter(
    c => !formData.affiliatedDepartment || c.department === formData.affiliatedDepartment
  );
  const filteredDeans = deanList.filter(
    d => !formData.affiliatedDepartment || d.department === formData.affiliatedDepartment
  );

  // Submission logic is now handled in SummaryPanel

  return (
    <div className="proposal-content-wrapper">
      {!showSummary ? (
          <form className="proposal-form" onSubmit={(e) => e.preventDefault()}>
            {/* Draft restored banner */}
            {draftRestored && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e', gap: 12 }}>
                <span>✏️ <strong>Draft restored.</strong> You can continue where you left off.</span>
                <button type="button" onClick={discardDraft} style={{ background: 'none', border: 'none', color: '#b45309', fontWeight: 600, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', padding: 0 }}>
                  Discard draft
                </button>
              </div>
            )}
            {/* Basic Information */}
            <div className="form-section">
              <h2>Basic Information</h2>
              <div className="form-group">
                <label htmlFor="title">
                  {projectType === 'service-learning'
                    ? 'Title of Service-Learning Initiative'
                    : 'Title of Community Engagement Initiative'}
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="partnerSchool">Partner School</label>
                {loadingSchools ? (
                  <div>Loading schools...</div>
                ) : (
                  <CustomSelect
                    id="partnerSchool"
                    name="partnerSchool"
                    value={formData.partnerSchool || ''}
                    onChange={handleInputChange}
                    placeholder="Select Partner School"
                    options={partnerSchools.map(s => ({
                      value: s.organizationName || s.name || s.email,
                      label: s.organizationName || s.name || s.email,
                    }))}
                  />
                )}
              </div>

              {/* Affiliated Department Dropdown (for both project types) */}
              <div className="form-group">
                <label htmlFor="affiliatedDepartment">Affiliated Department</label>
                <CustomSelect
                  id="affiliatedDepartment"
                  name="affiliatedDepartment"
                  value={formData.affiliatedDepartment}
                  onChange={handleInputChange}
                  placeholder="Select Department"
                  options={departments.map(d => ({ value: d, label: d }))}
                />
              </div>

              {projectType === 'service-learning' && (
                <div className="form-group">
                  <label>Faculty-in-Charge / Proponent(s) *</label>
                  <ProponentTagInput
                    tags={formData.proponents || []}
                    onAdd={handleAddProponent}
                    onRemove={handleRemoveProponent}
                    lockedCount={hasProponentName ? 1 : 0}
                  />
                </div>
              )}

              {projectType === 'service-learning' && (
                <div className="form-group">
                  <label htmlFor="assignedFaculty">Assigned Faculty *</label>
                  {userRole === 'faculty' ? (
                    <input
                      type="text"
                      id="assignedFaculty"
                      name="assignedFaculty"
                      value={slFields.assignedFaculty}
                      readOnly
                      required
                    />
                  ) : (
                    <CustomSelect
                      id="assignedFaculty"
                      name="assignedFaculty"
                      value={slFields.assignedFaculty}
                      onChange={handleSlFieldChange}
                      placeholder={
                        !formData.affiliatedDepartment
                          ? 'Select a department first'
                          : filteredFaculty.length === 0
                            ? 'No faculty available for this department'
                            : 'Select Faculty'
                      }
                      options={filteredFaculty.map(f => ({ value: f.name || f.email, label: f.name || f.email }))}
                    />
                  )}
                </div>
              )}

              {projectType === 'community-engagement' && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Name of Proponent(s)</label>
                    <ProponentTagInput
                      tags={formData.proponents || []}
                      onAdd={handleAddProponent}
                      onRemove={handleRemoveProponent}
                      lockedCount={hasProponentName ? 1 : 0}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="ceAssignedFaculty">Assigned Faculty *</label>
                    <CustomSelect
                      id="ceAssignedFaculty"
                      name="assignedFaculty"
                      value={ceFields.assignedFaculty}
                      onChange={handleCeFieldChange}
                      placeholder={
                        !formData.affiliatedDepartment
                          ? 'Select a department first'
                          : filteredFaculty.length === 0
                            ? 'No faculty available for this department'
                            : 'Select Faculty'
                      }
                      options={filteredFaculty.map(f => ({ value: f.name || f.email, label: f.name || f.email }))}
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="targetDate">Target Date</label>
                <small className="date-hint">
                  Must be at least 1 month from today to allow approval processing.
                </small>
                <input
                  type="date"
                  id="targetDate"
                  name="targetDate"
                  value={formData.targetDate}
                  onChange={handleInputChange}
                  min={minDateString}
                  required
                />

              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sdgs">Sustainable Development Goal (SDG)</label>
                  <div className="sdg-selector">
                    {/* Selected SDGs Display */}
                    {formData.sdgs && formData.sdgs.length > 0 && (
                      <div className="sdg-selected-tags">
                        {formData.sdgs.map(sdgNum => (
                          <span key={sdgNum} className="sdg-tag">
                            SDG {sdgNum}
                            <button
                              type="button"
                              className="sdg-tag-remove"
                              onClick={() => handleRemoveSdg(sdgNum)}
                              aria-label={`Remove SDG ${sdgNum}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Dropdown */}
                    <div className="sdg-dropdown-wrapper">
                      <button
                        type="button"
                        className="sdg-dropdown-toggle"
                        onClick={() => setShowSdgDropdown(!showSdgDropdown)}
                      >
                        {formData.sdgs.length === 0
                          ? 'Select SDG(s)'
                          : `${formData.sdgs.length} SDG${formData.sdgs.length > 1 ? 's' : ''} selected`}
                        <span className="dropdown-arrow">{showSdgDropdown ? '▲' : '▼'}</span>
                      </button>

                      {showSdgDropdown && (
                        <div className="sdg-dropdown-menu">
                          {sdgOptions.map(sdg => (
                            <label key={sdg.number} className="sdg-option">
                              <input
                                type="checkbox"
                                checked={formData.sdgs.includes(sdg.number)}
                                onChange={() => handleSdgToggle(sdg.number)}
                              />
                              <span className="sdg-option-text">
                                <strong>SDG {sdg.number}:</strong> {sdg.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="volunteerHours">Volunteer Hours</label>
                  <input
                    type="number"
                    id="volunteerHours"
                    name="volunteerHours"
                    value={formData.volunteerHours}
                    onChange={handleInputChange}
                    required
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  required
                  placeholder="Venue or community where project will take place"
                />
              </div>

              <div className="form-group">
                <label>Stakeholders</label>
                <NumberedStakeholderInput
                  items={formData.stakeholders || []}
                  onAdd={handleAddStakeholder}
                  onRemove={handleRemoveStakeholder}
                />
              </div>
            </div>

            {/* Service Learning Specific Fields */}
            {projectType === 'service-learning' && (
              <div className="form-section">
                <h2>Academic Information</h2>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="course">Course *</label>
                    <input
                      type="text"
                      id="course"
                      name="course"
                      value={slFields.course}
                      onChange={handleSlFieldChange}
                      required
                      placeholder="e.g., Introduction to Community Development"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="courseCode">Course Code *</label>
                    <input
                      type="text"
                      id="courseCode"
                      name="courseCode"
                      value={slFields.courseCode}
                      onChange={handleSlFieldChange}
                      required
                      placeholder="e.g., CD 101"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="section">Section *</label>
                  <input
                    type="text"
                    id="section"
                    name="section"
                    value={slFields.section}
                    onChange={handleSlFieldChange}
                    required
                    placeholder="e.g., Section A"
                  />
                </div>
              </div>
            )}




            {/* Community Engagement Specific Fields */}
            {projectType === 'community-engagement' && (
              <div className="form-section">
                <h2>Engagement Details</h2>

                <div className="form-group">
                  <label htmlFor="nature">Nature of Engagement</label>
                  <CustomSelect
                    id="nature"
                    name="nature"
                    value={ceFields.nature}
                    onChange={handleCeFieldChange}
                    placeholder="Select nature of engagement"
                    options={[
                      { value: 'program', label: 'Program' },
                      { value: 'project/advocacy', label: 'Project/Advocacy' },
                      { value: 'consultation/extension', label: 'Consultation/Extension' },
                    ]}
                  />
                </div>

                {/* Student Outcomes Field */}
                <div className="form-group">
                  <label htmlFor="studentOutcomes">Student Outcomes</label>
                  <input
                    type="text"
                    id="studentOutcomes"
                    name="studentOutcomes"
                    value={formData.studentOutcomes || ''}
                    onChange={handleInputChange}
                    placeholder="Describe expected student outcomes"
                  />
                  {(() => {
                    const len = (formData.studentOutcomes || '').length;
                    const limit = 130;
                    const color = len > limit ? '#e53e3e' : len > 105 ? '#d97706' : '#a0aec0';
                    const note = len > limit ? ' — text may be cut off in the PDF' : len > 105 ? ' — text will appear smaller in the PDF to fit' : '';
                    return (
                      <small style={{ color, fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
                        {len} / {limit} characters{note}
                      </small>
                    );
                  })()}
                </div>

                <div className="form-group">
                  <label htmlFor="learningOutcomes">Learning Outcomes Level</label>
                  <CustomSelect
                    id="learningOutcomes"
                    name="learningOutcomes"
                    value={ceFields.learningOutcomes}
                    onChange={handleCeFieldChange}
                    placeholder="Select learning outcomes level"
                    options={[
                      { value: '0', label: 'Intellectual Development' },
                      { value: '1', label: 'Collaboration' },
                      { value: '2', label: 'Appreciation of Culture and Diversity' },
                      { value: '3', label: 'Career Exploration' },
                      { value: '4', label: 'Socio-Civic Responsibility' },
                      { value: '5', label: 'Others, pls. Specify' },
                    ]}
                  />
                </div>

                {ceFields.learningOutcomes === '5' && (
                  <div className="form-group">
                    <label htmlFor="customLearningOutcome">Specify Learning Outcome *</label>
                    <input
                      type="text"
                      id="customLearningOutcome"
                      name="customLearningOutcome"
                      value={ceFields.customLearningOutcome}
                      onChange={handleCeFieldChange}
                      required
                      placeholder="Please specify the learning outcome"
                    />
                  </div>
                )}
              </div>
            )}


            {/* Project Details */}
            <div className="form-section">
              <h2>Project Details</h2>

              <div className="form-group">
                <label htmlFor="description">Project Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  required
                  rows="5"
                  placeholder="Provide a detailed description of the project"
                />
              </div>

              <div className="form-group">
                <label htmlFor="objectives">Objectives</label>
                <textarea
                  id="objectives"
                  name="objectives"
                  value={formData.objectives}
                  onChange={handleInputChange}
                  required
                  rows="4"
                  placeholder="List the main objectives of the project"
                />
              </div>

              <div className="form-group">
                <label>Specific Activities / Task Assignment</label>
                <NumberedStakeholderInput
                  items={formData.specificActivities || []}
                  onAdd={handleAddActivity}
                  onRemove={handleRemoveActivity}
                  placeholder="Type an activity and press Enter"
                  addMorePlaceholder="Add another activity…"
                />
                <small style={{ color: '#718096', fontSize: '0.8rem', marginTop: 4, display: 'block' }}>
                  Each activity will automatically become a volunteer task when the proposal is approved.
                </small>
              </div>

              <div className="form-group">
                <label htmlFor="successIndicators">Success Indicators</label>
                <textarea
                  id="successIndicators"
                  name="successIndicators"
                  value={formData.successIndicators}
                  onChange={handleInputChange}
                  required
                  rows="4"
                  placeholder="How will you measure the success of this project?"
                />
              </div>

              <div className="form-group">
                <label htmlFor="budget">Budget</label>
                <textarea
                  id="budget"
                  name="budget"
                  value={formData.budget}
                  onChange={handleInputChange}
                  required
                  rows="4"
                  placeholder="Provide a detailed budget breakdown"
                />
              </div>
            </div>

            {/* Signatories */}
            <div className="form-section">
              <h2>Signatories</h2>
              <p style={{ margin: '0 0 1rem', color: '#718096', fontSize: '0.85rem' }}>
                Select the signatories for this proposal. Export the PDF, collect physical signatures from each signatory, then upload the signed scan from the proposal review page.
              </p>
              <div className="form-row">
                <div className="form-group">
                  <label>Reviewed By <span style={{ color: '#718096', fontWeight: 400 }}>(Program Chair)</span></label>
                  <CustomSelect
                    name="reviewedBy"
                    value={formData.reviewedBy}
                    onChange={handleInputChange}
                    placeholder={
                      !formData.affiliatedDepartment
                        ? 'Select a department first'
                        : filteredChairs.length === 0
                          ? 'No program chair found for this department'
                          : 'Select Program Chair'
                    }
                    options={filteredChairs.map(c => ({ value: c.name || c.email, label: c.name || c.email }))}
                  />
                </div>
                <div className="form-group">
                  <label>Recommended By <span style={{ color: '#718096', fontWeight: 400 }}>(College Dean)</span></label>
                  <CustomSelect
                    name="recommendedBy"
                    value={formData.recommendedBy}
                    onChange={handleInputChange}
                    placeholder={
                      !formData.affiliatedDepartment
                        ? 'Select a department first'
                        : filteredDeans.length === 0
                          ? 'No college dean found for this department'
                          : 'Select College Dean'
                    }
                    options={filteredDeans.map(d => ({ value: d.name || d.email, label: d.name || d.email }))}
                  />
                </div>
              </div>
            </div>

            {timelineNode && (
              <div style={{ padding: '0 0 8px' }}>
                {timelineNode}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={onClose}
                className="btn-cancel"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-next"
                disabled={loading}
                onClick={() => setShowSummary(true)}
              >
                Next
              </button>
            </div>
          </form>
        ) : (
          <SummaryPanel
            formData={formData}
            slFields={slFields}
            ceFields={ceFields}
            projectType={projectType}
            loading={loading}
            onBack={() => setShowSummary(false)}
            onClose={onClose}
            sdgOptions={sdgOptions}
            setLoading={setLoading}
            onClearDraft={clearDraft}
            proposalId={editProposal?.id}
            existingSignedDocUrl={editProposal?.signedDocUrl}
          />
      )}
    </div>
  );
}

export default ProjectProposal;