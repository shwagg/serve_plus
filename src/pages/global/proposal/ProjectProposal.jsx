
// React and library imports
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import '../../../styles/ProjectProposal.css';
import SummaryPanel from '../SummaryPanel';

/**
 * Main component for the Project Proposal form.
 * Handles form state, submission, and PDF export for both Service Learning and Community Engagement proposals.
 * @param {Object} props
 * @param {string} props.projectType - The type of project ('service-learning' or 'community-engagement')
 * @param {Function} props.onClose - Callback to close the proposal form
 */
function ProjectProposal({ projectType, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [hasProponentName, setHasProponentName] = useState(false);
  const [userRole, setUserRole] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    sdgs: [],
    targetDate: '',
    stakeholders: '',
    location: '',
    volunteerHours: '',
    description: '',
    objectives: '',
    specificActivities: '',
    successIndicators: '',
    budget: '',
    preparedBy: '', // Faculty in Charge/Proponent
    affiliation: '', // College/Program/Department/Student Org
    studentOutcomes: '',
    alt: '', // Alt text for image
  });
  // Get user info and update formData.preparedBy on mount or when user changes
  // Effect: Fetch user info and update preparedBy field on mount or when user changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user?.displayName) {
        setFormData(prev => ({ ...prev, preparedBy: user.displayName }));
        setHasProponentName(true);
      } else if (user?.uid) {
        // Try to fetch name from Firestore user profile
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.name) {
              setFormData(prev => ({ ...prev, preparedBy: data.name }));
              setHasProponentName(true);
              
              // Set user role
              if (data.role) {
                setUserRole(data.role);
                
                // If user is faculty, auto-populate assignedFaculty
                if (data.role === 'faculty') {
                  setSlFields(prev => ({ ...prev, assignedFaculty: data.name }));
                }
              }
            } else {
              setHasProponentName(false);
            }
          } else {
            setHasProponentName(false);
          }
        } catch (err) {
          // Ignore errors
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
  });

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
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * Handles changes to Service Learning specific fields.
   */
  const handleSlFieldChange = (e) => {
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
    setFormData(prev => ({
      ...prev,
      sdgs: prev.sdgs.filter(num => num !== sdgNumber)
    }));
  };

  // Submission logic is now handled in SummaryPanel

  return (
    <div className="project-proposal-container">
      <div className="proposal-content-wrapper">
        {!showSummary ? (
          <form className="proposal-form" onSubmit={(e) => e.preventDefault()}>
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

            {projectType === 'service-learning' && (
              <div className="form-group">
                <label htmlFor="preparedBy">Faculty-in-Charge / Proponent(s) *</label>
                <input
                  type="text"
                  id="preparedBy"
                  name="preparedBy"
                  value={formData.preparedBy}
                  onChange={handleInputChange}
                  readOnly={hasProponentName}
                  required
                  placeholder="e.g., Juan Dela Cruz"
                />
              </div>
            )}

            {projectType === 'service-learning' && (
              <div className="form-group">
                <label htmlFor="assignedFaculty">Assigned Faculty *</label>
                <input
                  type="text"
                  id="assignedFaculty"
                  name="assignedFaculty"
                  value={slFields.assignedFaculty}
                  onChange={handleSlFieldChange}
                  readOnly={userRole === 'faculty'}
                  required
                  placeholder="e.g., Juan Dela Cruz"
                />
              </div>
            )}

            {projectType === 'community-engagement' && (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ceProponent">Name of Proponent(s)</label>
                  <input
                    type="text"
                    id="ceProponent"
                    name="preparedBy"
                    value={formData.preparedBy}
                    onChange={handleInputChange}
                    readOnly={hasProponentName}
                    required
                    placeholder="e.g., Juan Dela Cruz"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="affiliation">Affiliation</label>
                  <input
                    type="text"
                    id="affiliation"
                    name="affiliation"
                    value={formData.affiliation}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., College of Science"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="targetDate">Target Date</label>
              <input
                type="date"
                id="targetDate"
                name="targetDate"
                value={formData.targetDate}
                onChange={handleInputChange}
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
                          {sdgNum}
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
              <label htmlFor="stakeholders">Stakeholders</label>
              <textarea
                id="stakeholders"
                name="stakeholders"
                value={formData.stakeholders}
                onChange={handleInputChange}
                required
                rows="3"
                placeholder="List all stakeholders involved in the project"
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
                <select
                  id="nature"
                  name="nature"
                  value={ceFields.nature}
                  onChange={handleCeFieldChange}
                  required
                >
                  <option value="">Select nature of engagement</option>
                  <option value="program">Program</option>
                  <option value="project/advocacy">Project/Advocacy</option>
                  <option value="consultation/extension">Consultation/Extension</option>
                </select>
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
              </div>

              <div className="form-group">
                <label htmlFor="learningOutcomes">Learning Outcomes Level</label>
                <select
                  id="learningOutcomes"
                  name="learningOutcomes"
                  value={ceFields.learningOutcomes}
                  onChange={handleCeFieldChange}
                  required
                >
                  <option value="">Select learning outcomes level</option>
                  <option value="0">Intellectual Development</option>
                  <option value="1">Collaboration</option>
                  <option value="2">Appreciation of Culture and Diversity</option>
                  <option value="3">Career Exploration</option>
                  <option value="4">Socio-Civic Responsibility</option>
                  <option value="5">Others, pls. Specify</option>
                </select>
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
              <label htmlFor="specificActivities">Specific Activities</label>
              <textarea
                id="specificActivities"
                name="specificActivities"
                value={formData.specificActivities}
                onChange={handleInputChange}
                required
                rows="5"
                placeholder="Describe the specific activities planned for this project"
              />
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
          />
        )}
      </div>
    </div>
  );
}

export default ProjectProposal;