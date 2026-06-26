
// React and library imports
import { useState, useEffect, useRef, useCallback } from 'react';
import { auth, db } from '../../../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import '../../../styles/ProjectProposal.css';
import SummaryPanel from '../SummaryPanel';
import { showToast } from '../../../utils/toast';
import { useSession } from '../../../context/useSession';

const PROPOSAL_BLACKBOARD_LOCK_REASON =
  'Create Proposal is only available for Blackboard-linked student and faculty accounts.';
const FIELD_LIMITS = {
  title: 200,
  location: 50,
  volunteerHours: 50,
  stakeholderItem: 50,
  stakeholderItems: 5,
  course: 50,
  courseCode: 50,
  section: 50,
  activityItem: 50,
  activityItems: 5,
  description: 2000,
  objectives: 2000,
  successIndicators: 1000,
  budget: 200,
  studentOutcomes: 130,
  proponents: 3,
};

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function trimToLimit(value, limit) {
  return String(value || '').slice(0, limit);
}

function getRemainingCount(value, limit) {
  return `${String(value || '').length} / ${limit} characters`;
}

function getVisibleCharacterCount(value) {
  return String(value || '').replace(/[\s\r\n]+/g, '').length;
}

function hasEmoji(str) {
  return /\p{Extended_Pictographic}/u.test(String(str || ''));
}

function stripEmojis(str) {
  return String(str || '').replace(/\p{Extended_Pictographic}/gu, '');
}

function isProposalLockedForUser(userData) {
  const role = normalizeValue(userData?.role || userData?.userRole || userData?.Role);
  if (role !== 'student' && role !== 'faculty') return false;
  return normalizeValue(userData?.authProvider) !== 'blackboard';
}

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

function parseLocalDate(dateString) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Calendar control with explicitly styled unavailable dates. Native date inputs do
 * not expose their calendar-day elements for styling, so their disabled-day colors
 * differ by browser and operating system.
 */
function TargetDatePicker({ id, name, value, onChange, minDate, maxDate, required }) {
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => parseLocalDate(value || minDate));
  const pickerRef = useRef(null);
  const selectedDate = value ? parseLocalDate(value) : null;

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleOutsideClick = event => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const firstDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const calendarStart = new Date(firstDayOfMonth);
  calendarStart.setDate(1 - firstDayOfMonth.getDay());
  const monthLabel = visibleMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const selectedLabel = selectedDate
    ? selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Select target date';

  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    const dateValue = formatDateValue(date);
    return {
      date,
      dateValue,
      isCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
      isDisabled: dateValue < minDate || dateValue > maxDate,
    };
  });

  return (
    <div className="target-date-picker" ref={pickerRef}>
      <button
        type="button"
        id={id}
        className={`target-date-trigger${value ? '' : ' placeholder'}`}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-required={required}
        onClick={() => {
          if (!isOpen) setVisibleMonth(parseLocalDate(value || minDate));
          setIsOpen(open => !open);
        }}
      >
        <span>{selectedLabel}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        <div className="target-date-calendar" role="dialog" aria-label="Choose target date">
          <div className="target-date-calendar-header">
            <button
              type="button"
              className="calendar-nav-button"
              aria-label="Previous month"
              onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              className="calendar-nav-button"
              aria-label="Next month"
              onClick={() => setVisibleMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="calendar-weekdays" aria-hidden="true">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-days">
            {days.map(({ date, dateValue, isCurrentMonth, isDisabled }) => {
              const isSelected = dateValue === value;
              return (
                <button
                  key={dateValue}
                  type="button"
                  className={`calendar-day${isDisabled ? ' disabled' : ''}${!isCurrentMonth ? ' outside-month' : ''}${isSelected ? ' selected' : ''}`}
                  disabled={isDisabled}
                  aria-label={date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  aria-pressed={isSelected}
                  onClick={() => {
                    onChange({ target: { name, value: dateValue } });
                    setIsOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
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
        onChange={e => {
          let nextValue = e.target.value;
          if (hasEmoji(nextValue)) {
            nextValue = stripEmojis(nextValue);
            showToast('Emojis are not allowed in this field.');
          }
          setInput(nextValue);
        }}
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
function NumberedStakeholderInput({ items, onAdd, onRemove, placeholder, addMorePlaceholder, maxChars, maxItems }) {
  const [input, setInput] = useState('');

  const commit = () => {
    const val = input.trim();
    if (!val) return;
    const added = onAdd(val);
    if (added !== false) setInput('');
  };

  const itemLimitReached = Boolean(maxItems && items.length >= maxItems);

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
        maxLength={maxChars}
        disabled={itemLimitReached}
        onChange={e => {
          let nextValue = e.target.value;
          if (hasEmoji(nextValue)) {
            nextValue = stripEmojis(nextValue);
            showToast('Emojis are not allowed in this field.');
          }
          setInput(nextValue);
        }}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        placeholder={itemLimitReached
          ? `Maximum of ${maxItems} items reached`
          : items.length === 0
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
  const { userData, authLoading } = useSession();
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [hasProponentName, setHasProponentName] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const fieldErrorTimeoutsRef = useRef({});
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
    participantLimit: '',
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
  ];
  const [partnerSchools, setPartnerSchools] = useState([]);
  const [chairList, setChairList] = useState([]);
  const [deanList, setDeanList] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const allUsers = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPartnerSchools(allUsers.filter(u => u.role === 'partner'));
        setChairList(allUsers.filter(u => u.position === 'program chair'));
        setDeanList(allUsers.filter(u => u.position === 'college dean'));
      } catch {
        setPartnerSchools([]);
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
  });

  // Community Engagement specific fields
  const [ceFields, setCeFields] = useState({
    nature: '',
    learningOutcomes: '0', // Default to first option (Intellectual Development)
    customLearningOutcome: '',
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
      reviewedBy: p.selectedReviewedBy || '',
      recommendedBy: p.selectedRecommendedBy || '',
      affiliatedDepartment: p.affiliatedDepartment || '',
      alt: p.alt || '',
      partnerSchool: p.partnerSchool || '',
      participantLimit: p.participantLimit ? String(p.participantLimit) : '',
    });
    if (p.projectType === 'sl' && p.slFields) {
      setSlFields({
        section: p.slFields.section || '',
        course: p.slFields.course || '',
        courseCode: p.slFields.courseCode || '',
      });
    }
    if (p.projectType === 'ce' && p.ceFields) {
      setCeFields({
        nature: p.ceFields.nature || '',
        learningOutcomes: p.ceFields.learningOutcomes || '0',
        customLearningOutcome: p.ceFields.customLearningOutcome || '',
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
      Object.values(fieldErrorTimeoutsRef.current).forEach(clearTimeout);
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

  const showTemporaryFieldError = useCallback((fieldName, message) => {
    setFieldErrors(prev => ({ ...prev, [fieldName]: message }));
    if (fieldErrorTimeoutsRef.current[fieldName]) {
      clearTimeout(fieldErrorTimeoutsRef.current[fieldName]);
    }
    fieldErrorTimeoutsRef.current[fieldName] = setTimeout(() => {
      setFieldErrors(prev => ({ ...prev, [fieldName]: '' }));
      delete fieldErrorTimeoutsRef.current[fieldName];
    }, 3000);
  }, []);

  const showTemporaryFieldErrors = useCallback((errors) => {
    Object.entries(errors).forEach(([fieldName, message]) => {
      if (message) {
        showTemporaryFieldError(fieldName, message);
      }
    });
  }, [showTemporaryFieldError]);

  const discardDraft = () => {
    clearDraft();
    submittedRef.current = false;
    hasUserInputRef.current = false;
    setFormData({ title: '', sdgs: [], targetDate: '', stakeholders: [], location: '', volunteerHours: '', description: '', objectives: '', specificActivities: [], successIndicators: '', budget: '', preparedBy: formDataRef.current?.preparedBy || '', proponents: formDataRef.current?.preparedBy ? [formDataRef.current.preparedBy] : [], reviewedBy: '', recommendedBy: '', affiliatedDepartment: '', studentOutcomes: '', alt: '', partnerSchool: '', participantLimit: '' });
    setSlFields({ section: '', course: '', courseCode: '' });
    setCeFields({ nature: '', learningOutcomes: '0', customLearningOutcome: '' });
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
   * Handles changes to main form fields (formData).
   */
  const handleInputChange = (e) => {
    hasUserInputRef.current = true;
    const { name } = e.target;
    let value = e.target.value;
    if (hasEmoji(value)) {
      value = stripEmojis(value);
      showToast('Emojis are not allowed in this field.');
    }
    const textLimits = {
      title: FIELD_LIMITS.title,
      location: FIELD_LIMITS.location,
      description: FIELD_LIMITS.description,
      objectives: FIELD_LIMITS.objectives,
      successIndicators: FIELD_LIMITS.successIndicators,
      budget: FIELD_LIMITS.budget,
      studentOutcomes: FIELD_LIMITS.studentOutcomes,
    };

    if (name === 'volunteerHours') {
      if (value !== '' && Number(value) > FIELD_LIMITS.volunteerHours) {
        setFormData(prev => ({ ...prev, [name]: '' }));
        showTemporaryFieldError(name, `Volunteer Hours only allows up to ${FIELD_LIMITS.volunteerHours}.`);
        showToast(`Volunteer Hours only allows up to ${FIELD_LIMITS.volunteerHours}.`);
        return;
      }
      setFormData(prev => ({ ...prev, [name]: value }));
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    } else if (name === 'participantLimit') {
      if (value !== '' && Number(value) > 50) {
        setFormData(prev => ({ ...prev, [name]: '' }));
        showTemporaryFieldError(name, 'Participant Limit only allows up to 50.');
        showToast('Participant Limit only allows up to 50.');
        return;
      }
      setFormData(prev => ({ ...prev, [name]: value }));
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    } else if (textLimits[name] && getVisibleCharacterCount(value) > textLimits[name]) {
      setFormData(prev => ({ ...prev, [name]: '' }));
      showTemporaryFieldError(name, `This field only allows up to ${textLimits[name]} characters, excluding spaces and line breaks.`);
      showToast(`This field only allows up to ${textLimits[name]} characters, excluding spaces and line breaks.`);
      return;
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Handles changes to Service Learning specific fields.
   */
  const handleSlFieldChange = (e) => {
    hasUserInputRef.current = true;
    const { name } = e.target;
    let value = e.target.value;
    if (hasEmoji(value)) {
      value = stripEmojis(value);
      showToast('Emojis are not allowed in this field.');
    }
    const textLimits = {
      section: FIELD_LIMITS.section,
      course: FIELD_LIMITS.course,
      courseCode: FIELD_LIMITS.courseCode,
    };
    if (textLimits[name] && getVisibleCharacterCount(value) > textLimits[name]) {
      setSlFields(prev => ({
        ...prev,
        [name]: ''
      }));
      showTemporaryFieldError(name, `This field only allows up to ${textLimits[name]} characters, excluding spaces and line breaks.`);
      showToast(`This field only allows up to ${textLimits[name]} characters, excluding spaces and line breaks.`);
      return;
    }
    setSlFields(prev => ({
      ...prev,
      [name]: value
    }));
    setFieldErrors(prev => ({ ...prev, [name]: '' }));
  };

  /**
   * Handles changes to Community Engagement specific fields.
   */
  const handleCeFieldChange = (e) => {
    hasUserInputRef.current = true;
    const { name } = e.target;
    let value = e.target.value;
    if (hasEmoji(value)) {
      value = stripEmojis(value);
      showToast('Emojis are not allowed in this field.');
    }
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
    if (name.length > 50) {
      showToast('Each proponent name only allows up to 50 characters.');
      showTemporaryFieldError('proponents', 'Each proponent name only allows up to 50 characters.');
      return;
    }
    if ((formData.proponents || []).length >= FIELD_LIMITS.proponents) {
      showToast(`Only ${FIELD_LIMITS.proponents} proponent names are allowed.`);
      showTemporaryFieldError('proponents', `Only ${FIELD_LIMITS.proponents} proponent names are allowed.`);
      return;
    }
    setFormData(prev => ({ ...prev, proponents: [...(prev.proponents || []), name] }));
    setFieldErrors(prev => ({ ...prev, proponents: '' }));
  };

  const handleRemoveProponent = (index) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, proponents: prev.proponents.filter((_, i) => i !== index) }));
  };

  const handleAddStakeholder = (text) => {
    hasUserInputRef.current = true;
    if ((formData.stakeholders || []).length >= FIELD_LIMITS.stakeholderItems) {
      showToast(`Only ${FIELD_LIMITS.stakeholderItems} stakeholders are allowed.`);
      showTemporaryFieldError('stakeholders', `Only ${FIELD_LIMITS.stakeholderItems} stakeholders are allowed.`);
      return false;
    }
    if (String(text || '').trim().length > FIELD_LIMITS.stakeholderItem || getVisibleCharacterCount(text) > FIELD_LIMITS.stakeholderItem) {
      showToast(`Stakeholders are limited to ${FIELD_LIMITS.stakeholderItem} characters each, excluding spaces and line breaks.`);
      showTemporaryFieldError('stakeholders', `Each stakeholder can only have ${FIELD_LIMITS.stakeholderItem} characters, excluding spaces and line breaks.`);
      return false;
    }
    setFormData(prev => ({ ...prev, stakeholders: [...(prev.stakeholders || []), text] }));
    setFieldErrors(prev => ({ ...prev, stakeholders: '' }));
    return true;
  };

  const handleRemoveStakeholder = (index) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, stakeholders: prev.stakeholders.filter((_, i) => i !== index) }));
    setFieldErrors(prev => ({ ...prev, stakeholders: '' }));
  };

  const handleAddActivity = (text) => {
    hasUserInputRef.current = true;
    if ((formData.specificActivities || []).length >= FIELD_LIMITS.activityItems) {
      showToast(`Only ${FIELD_LIMITS.activityItems} specific activities are allowed.`);
      showTemporaryFieldError('specificActivities', `Only ${FIELD_LIMITS.activityItems} specific activities are allowed.`);
      return false;
    }
    if (String(text || '').trim().length > FIELD_LIMITS.activityItem || getVisibleCharacterCount(text) > FIELD_LIMITS.activityItem) {
      showToast(`Each activity is limited to ${FIELD_LIMITS.activityItem} characters, excluding spaces and line breaks.`);
      showTemporaryFieldError('specificActivities', `Each activity can only have ${FIELD_LIMITS.activityItem} characters, excluding spaces and line breaks.`);
      return false;
    }
    setFormData(prev => ({ ...prev, specificActivities: [...(prev.specificActivities || []), text] }));
    setFieldErrors(prev => ({ ...prev, specificActivities: '' }));
    return true;
  };

  const handleRemoveActivity = (index) => {
    hasUserInputRef.current = true;
    setFormData(prev => ({ ...prev, specificActivities: prev.specificActivities.filter((_, i) => i !== index) }));
    setFieldErrors(prev => ({ ...prev, specificActivities: '' }));
  };

  // Target date must allow approval processing but stay within the proposal window.
  const minTargetDate = new Date();
  minTargetDate.setMonth(minTargetDate.getMonth() + 1);

  const minDateString =
    minTargetDate.getFullYear() +
    "-" +
    String(minTargetDate.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(minTargetDate.getDate()).padStart(2, "0");
  const maxTargetDate = new Date();
  maxTargetDate.setMonth(maxTargetDate.getMonth() + 5);
  const maxDateString =
    maxTargetDate.getFullYear() +
    "-" +
    String(maxTargetDate.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(maxTargetDate.getDate()).padStart(2, "0");

  const handleNumericKeyDown = (e) => {
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowedKeys.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleNumericPaste = (e) => {
    const pasted = e.clipboardData.getData('text');
    if (!/^\d+$/.test(pasted)) {
      e.preventDefault();
    }
  };

  const validateBeforeSummary = () => {
    const nextErrors = {};
    if (getVisibleCharacterCount(formData.title) > FIELD_LIMITS.title) nextErrors.title = `Only ${FIELD_LIMITS.title} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.location) > FIELD_LIMITS.location) nextErrors.location = `Only ${FIELD_LIMITS.location} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(slFields.course) > FIELD_LIMITS.course) nextErrors.course = `Only ${FIELD_LIMITS.course} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(slFields.courseCode) > FIELD_LIMITS.courseCode) nextErrors.courseCode = `Only ${FIELD_LIMITS.courseCode} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(slFields.section) > FIELD_LIMITS.section) nextErrors.section = `Only ${FIELD_LIMITS.section} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.description) > FIELD_LIMITS.description) nextErrors.description = `Only ${FIELD_LIMITS.description} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.objectives) > FIELD_LIMITS.objectives) nextErrors.objectives = `Only ${FIELD_LIMITS.objectives} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.successIndicators) > FIELD_LIMITS.successIndicators) nextErrors.successIndicators = `Only ${FIELD_LIMITS.successIndicators} characters are allowed, excluding spaces and line breaks.`;
    if (getVisibleCharacterCount(formData.budget) > FIELD_LIMITS.budget) nextErrors.budget = `Only ${FIELD_LIMITS.budget} characters are allowed, excluding spaces and line breaks.`;
    if (Number(formData.volunteerHours) > FIELD_LIMITS.volunteerHours) nextErrors.volunteerHours = `Volunteer Hours can only go up to ${FIELD_LIMITS.volunteerHours}.`;
    if ((formData.proponents || []).length > FIELD_LIMITS.proponents) nextErrors.proponents = `Only ${FIELD_LIMITS.proponents} proponent names are allowed.`;
    if ((formData.stakeholders || []).length > FIELD_LIMITS.stakeholderItems) nextErrors.stakeholders = `Only ${FIELD_LIMITS.stakeholderItems} stakeholders are allowed.`;
    if ((formData.specificActivities || []).length > FIELD_LIMITS.activityItems) nextErrors.specificActivities = `Only ${FIELD_LIMITS.activityItems} specific activities are allowed.`;
    if ((formData.stakeholders || []).some(item => getVisibleCharacterCount(item) > FIELD_LIMITS.stakeholderItem)) nextErrors.stakeholders = `Each stakeholder can only have ${FIELD_LIMITS.stakeholderItem} characters, excluding spaces and line breaks.`;
    if ((formData.specificActivities || []).some(item => getVisibleCharacterCount(item) > FIELD_LIMITS.activityItem)) nextErrors.specificActivities = `Each activity can only have ${FIELD_LIMITS.activityItem} characters, excluding spaces and line breaks.`;
    if (formData.targetDate && (formData.targetDate < minDateString || formData.targetDate > maxDateString)) nextErrors.targetDate = `Select a date at least 1 month from today and no later than 5 months from today.`;

    if (Object.keys(nextErrors).length > 0) {
      showTemporaryFieldErrors(nextErrors);
      showToast('Some fields exceed the allowed limits. Please review the highlighted fields.');
      return false;
    }
    return true;
  };

  // Chairs and deans are filtered by the selected affiliated department.
  const filteredChairs = chairList.filter(
    c => !formData.affiliatedDepartment || c.department === formData.affiliatedDepartment
  );
  const filteredDeans = deanList.filter(
    d => !formData.affiliatedDepartment || d.department === formData.affiliatedDepartment
  );

  // Submission logic is now handled in SummaryPanel
  if (authLoading) {
    return (
      <div className="proposal-content-wrapper">
        <div className="proposal-locked-state">
          <p>Loading proposal access...</p>
        </div>
      </div>
    );
  }

  if (isProposalLockedForUser(userData)) {
    return (
      <div className="proposal-content-wrapper">
        <div className="proposal-locked-state">
          <h2>Create Proposal Locked</h2>
          <p>{PROPOSAL_BLACKBOARD_LOCK_REASON}</p>
          {onClose && (
            <button type="button" className="btn-cancel" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

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
                <small className={`field-limit-hint${fieldErrors.title ? ' error' : ''}`}>
                  {fieldErrors.title || `${getVisibleCharacterCount(formData.title)} / ${FIELD_LIMITS.title} characters`}
                </small>
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
                  <small className={`field-limit-hint${fieldErrors.proponents ? ' error' : ''}`}>
                    {fieldErrors.proponents || `${(formData.proponents || []).length} / ${FIELD_LIMITS.proponents} proponents`}
                  </small>
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
                    <small className={`field-limit-hint${fieldErrors.proponents ? ' error' : ''}`}>
                      {fieldErrors.proponents || `${(formData.proponents || []).length} / ${FIELD_LIMITS.proponents} proponents`}
                    </small>
                  </div>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="targetDate">Target Date</label>
                <small className="date-hint">
                  Must be at least 1 month from today and no later than 5 months from today.
                </small>
                <TargetDatePicker
                  id="targetDate"
                  name="targetDate"
                  value={formData.targetDate}
                  onChange={handleInputChange}
                  minDate={minDateString}
                  maxDate={maxDateString}
                  required
                />
                {fieldErrors.targetDate && <small className="field-limit-hint error">{fieldErrors.targetDate}</small>}
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
                  onKeyDown={handleNumericKeyDown}
                  onPaste={handleNumericPaste}
                  required
                  max={FIELD_LIMITS.volunteerHours}
                  />
                  {fieldErrors.volunteerHours && <small className="field-limit-hint error">{fieldErrors.volunteerHours}</small>}
                </div>

                <div className="form-group">
                  <label htmlFor="participantLimit">Participant Limit</label>
                  <input
                    type="number"
                    id="participantLimit"
                    name="participantLimit"
                    value={formData.participantLimit}
                    onChange={handleInputChange}
                    onKeyDown={handleNumericKeyDown}
                    onPaste={handleNumericPaste}
                    min="1"
                    max="50"
                    placeholder="Max participants (optional, up to 50)"
                  />
                  {fieldErrors.participantLimit && <small className="field-limit-hint error">{fieldErrors.participantLimit}</small>}
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
                <small className={`field-limit-hint${fieldErrors.location ? ' error' : ''}`}>
                  {fieldErrors.location || `${getVisibleCharacterCount(formData.location)} / ${FIELD_LIMITS.location} characters`}
                </small>
              </div>

              <div className="form-group">
                <label>Stakeholders</label>
                <NumberedStakeholderInput
                  items={formData.stakeholders || []}
                  onAdd={handleAddStakeholder}
                  onRemove={handleRemoveStakeholder}
                  maxChars={FIELD_LIMITS.stakeholderItem}
                  maxItems={FIELD_LIMITS.stakeholderItems}
                  placeholder="Type a stakeholder and press Enter"
                  addMorePlaceholder="Add another stakeholder..."
                />
                <small className={`field-limit-hint${fieldErrors.stakeholders ? ' error' : ''}`}>
                  {fieldErrors.stakeholders || `Add up to ${FIELD_LIMITS.stakeholderItems} stakeholders. Each stakeholder can use up to ${FIELD_LIMITS.stakeholderItem} characters.`}
                </small>
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
                    <small className={`field-limit-hint${fieldErrors.course ? ' error' : ''}`}>
                      {fieldErrors.course || `${getVisibleCharacterCount(slFields.course)} / ${FIELD_LIMITS.course} characters`}
                    </small>
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
                    <small className={`field-limit-hint${fieldErrors.courseCode ? ' error' : ''}`}>
                      {fieldErrors.courseCode || `${getVisibleCharacterCount(slFields.courseCode)} / ${FIELD_LIMITS.courseCode} characters`}
                    </small>
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
                  <small className={`field-limit-hint${fieldErrors.section ? ' error' : ''}`}>
                    {fieldErrors.section || `${getVisibleCharacterCount(slFields.section)} / ${FIELD_LIMITS.section} characters`}
                  </small>
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
                  <small className="field-limit-hint">
                    {`${getVisibleCharacterCount(formData.studentOutcomes)} / ${FIELD_LIMITS.studentOutcomes} characters`}
                  </small>
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
                <small className={`field-limit-hint${fieldErrors.description ? ' error' : ''}`}>
                  {fieldErrors.description || `${getVisibleCharacterCount(formData.description)} / ${FIELD_LIMITS.description} characters`}
                </small>
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
                <small className={`field-limit-hint${fieldErrors.objectives ? ' error' : ''}`}>
                  {fieldErrors.objectives || `${getVisibleCharacterCount(formData.objectives)} / ${FIELD_LIMITS.objectives} characters`}
                </small>
              </div>

              <div className="form-group">
                <label>Specific Activities / Task Assignment</label>
                <NumberedStakeholderInput
                  items={formData.specificActivities || []}
                  onAdd={handleAddActivity}
                  onRemove={handleRemoveActivity}
                  maxChars={FIELD_LIMITS.activityItem}
                  maxItems={FIELD_LIMITS.activityItems}
                  placeholder="Type an activity and press Enter"
                  addMorePlaceholder="Add another activity..."
                />
                <small className={`field-limit-hint${fieldErrors.specificActivities ? ' error' : ''}`}>
                  {fieldErrors.specificActivities || `Add up to ${FIELD_LIMITS.activityItems} activities. Each activity can use up to ${FIELD_LIMITS.activityItem} characters.`}
                </small>
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
                <small className={`field-limit-hint${fieldErrors.successIndicators ? ' error' : ''}`}>
                  {fieldErrors.successIndicators || `${getVisibleCharacterCount(formData.successIndicators)} / ${FIELD_LIMITS.successIndicators} characters`}
                </small>
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
                <small className={`field-limit-hint${fieldErrors.budget ? ' error' : ''}`}>
                  {fieldErrors.budget || `${getVisibleCharacterCount(formData.budget)} / ${FIELD_LIMITS.budget} characters`}
                </small>
              </div>
            </div>

            {/* Signatories */}
            <div className="form-section">
              <h2>Signatories</h2>
              <p style={{ margin: '0 0 1rem', color: '#718096', fontSize: '0.85rem' }}>
                Select the signatories who will review this proposal. Once submitted, it will route digitally through <strong>Program Chair → College Dean → Admin (CSCE) → Director</strong> for sequential approval before the event can be published.
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
                onClick={() => {
                  if (validateBeforeSummary()) {
                    setShowSummary(true);
                  }
                }}
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
            isResubmission={editProposal?.status === 'rejected'}
          />
      )}
    </div>
  );
}

export default ProjectProposal;
