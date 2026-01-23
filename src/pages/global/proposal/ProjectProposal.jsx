import { useState, useEffect } from 'react';
import { exportProposalPDF, exportCommunityEngagementProposalPDF } from '../exportProposalPDF';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import '../../../styles/ProjectProposal.css';

function ProjectProposal({ projectType, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    sdg: [],
    targetDate: '',
    stakeholders: '',
    location: '',
    volunteerHours: '',
    description: '',
    objectives: '',
    specificActivities: '',
    successIndicators: '',
    budget: '',
    faculty: '', // Faculty in Charge/Proponent
    college: '', // College/Program/Department/Student Org
  });
  // Get user info and update formData.faculty on mount or when user changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user?.displayName) {
        setFormData(prev => ({ ...prev, faculty: user.displayName }));
      } else if (user?.uid) {
        // Try to fetch name from Firestore user profile
        try {
          const { getDoc, doc } = await import('firebase/firestore');
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.name) {
              setFormData(prev => ({ ...prev, faculty: data.name }));
            }
          }
        } catch (err) {
          // Ignore errors
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

  const getProjectTypeTitle = () => {
    return projectType === 'service-learning' 
      ? 'Service Learning Project Proposal' 
      : 'Community Engagement Project Proposal';
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSlFieldChange = (e) => {
    const { name, value } = e.target;
    setSlFields(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCeFieldChange = (e) => {
    const { name, value } = e.target;
    setCeFields(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSdgToggle = (sdgNumber) => {
    setFormData(prev => {
      const currentSdgs = prev.sdg || [];
      if (currentSdgs.includes(sdgNumber)) {
        return {
          ...prev,
          sdg: currentSdgs.filter(num => num !== sdgNumber)
        };
      } else {
        return {
          ...prev,
          sdg: [...currentSdgs, sdgNumber].sort((a, b) => a - b)
        };
      }
    });
  };

  const handleRemoveSdg = (sdgNumber) => {
    setFormData(prev => ({
      ...prev,
      sdg: prev.sdg.filter(num => num !== sdgNumber)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        alert('You must be logged in to submit a proposal');
        return;
      }

      // Create main proposal document
      const proposalData = {
        proponent: user.uid,
        dateCreated: serverTimestamp(),
        status: 'pending',
        proposalType: projectType === 'service-learning' ? 'sl' : 'ce',
      };

      // Add proposal to main collection
      const proposalRef = await addDoc(collection(db, 'proposal'), proposalData);

      // Prepare details data
      const detailsData = {
        title: formData.title,
        dateProposed: serverTimestamp(),
        sdg: formData.sdg,
        targetDate: formData.targetDate,
        stakeholders: formData.stakeholders,
        location: formData.location,
        volunteerHours: formData.volunteerHours,
        description: formData.description,
        objectives: formData.objectives,
        specificActivities: formData.specificActivities,
        successIndicators: formData.successIndicators,
        budget: formData.budget,
        preparedBy: user.uid,
        reviewedBy: '',
        recommendedBy: '',
        endorsedBy: '',
        approvedBy: '',
      };

      // Add type-specific fields
      if (projectType === 'service-learning') {
        detailsData.slFields = slFields;
      } else {
        detailsData.ceFields = ceFields;
      }

      // Add details to subcollection
      await addDoc(collection(db, 'proposal', proposalRef.id, 'details'), detailsData);

      alert('Proposal submitted successfully!');
      onClose();
    } catch (error) {
      console.error('Error submitting proposal:', error);
      alert('Failed to submit proposal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="project-proposal-container" onClick={onClose}>
      <div className="proposal-content-wrapper" onClick={(e) => e.stopPropagation()}>
        <div className="proposal-header">
          <h1>{getProjectTypeTitle()}</h1>
          <span className="project-type-badge">{projectType}</span>
        </div>

        <form className="proposal-form" onSubmit={handleSubmit}>
        {/* Basic Information */}
        <div className="form-section">
          <h2>Basic Information</h2>
          
          <div className="form-group">
            <label htmlFor="title">Project Title *</label>
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
            <label htmlFor="faculty">
              {projectType === 'service-learning'
                ? 'Faculty-in-Charge / Proponent(s) *'
                : 'Name of Proponent(s) and College / Program / Department / Student Organization *'}
            </label>
            <input
              type="text"
              id="faculty"
              name="faculty"
              value={formData.faculty}
              readOnly
              required
              placeholder={projectType === 'service-learning'
                ? 'e.g., Dr. Juan Dela Cruz'
                : 'e.g., Juan Dela Cruz, College of Science'}
            />
          </div>

          <div className="form-group">
            <label htmlFor="targetDate">Target Date *</label>
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
              <label htmlFor="sdg">Sustainable Development Goal (SDG)</label>
              <div className="sdg-selector">
                {/* Selected SDGs Display */}
                {formData.sdg && formData.sdg.length > 0 && (
                  <div className="sdg-selected-tags">
                    {formData.sdg.map(sdgNum => (
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
                    {formData.sdg.length === 0 
                      ? 'Select SDG(s)' 
                      : `${formData.sdg.length} SDG${formData.sdg.length > 1 ? 's' : ''} selected`}
                    <span className="dropdown-arrow">{showSdgDropdown ? '▲' : '▼'}</span>
                  </button>
                  
                  {showSdgDropdown && (
                    <div className="sdg-dropdown-menu">
                      {sdgOptions.map(sdg => (
                        <label key={sdg.number} className="sdg-option">
                          <input
                            type="checkbox"
                            checked={formData.sdg.includes(sdg.number)}
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
              <label htmlFor="volunteerHours">Volunteer Hours *</label>
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
            <label htmlFor="location">Location *</label>
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
            <label htmlFor="stakeholders">Stakeholders *</label>
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

        {/* Type-specific fields */}
        {/* --- Service Learning (SL) Specific Fields --- */}
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
              <label htmlFor="faculty">Faculty in Charge *</label>
              <input
                type="text"
                id="faculty"
                name="faculty"
                value={formData.faculty}
                onChange={handleInputChange}
                required
                placeholder="e.g., Dr. Juan Dela Cruz"
              />
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
        {/* --- End of Service Learning (SL) Specific Fields --- */}




        {/* --- Community Engagement (CE) Specific Fields --- */}
        {projectType === 'community-engagement' && (
          <div className="form-section">
            <h2>Engagement Details</h2>
            
            <div className="form-group">
              <label htmlFor="nature">Nature of Engagement *</label>
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

            <div className="form-group">
              <label htmlFor="learningOutcomes">Learning Outcomes Level *</label>
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
        {/* --- End of Community Engagement (CE) Specific Fields --- */}





        {/* Project Details */}
        <div className="form-section">
          <h2>Project Details</h2>
          
          <div className="form-group">
            <label htmlFor="description">Project Description *</label>
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
            <label htmlFor="objectives">Objectives *</label>
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
            <label htmlFor="specificActivities">Specific Activities *</label>
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
            <label htmlFor="successIndicators">Success Indicators *</label>
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
            <label htmlFor="budget">Budget *</label>
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
            className="btn-submit"
            disabled={loading}
            onClick={async () => {
              try {
                setLoading(true);
                // Map formData to SL export keys if projectType is service-learning
                let exportFormData = formData;
                if (projectType === 'service-learning') {
                  // Map SDG numbers to SDG labels for X placement
                  const sdgNumberToLabel = {
                    1: 'No Poverty',
                    2: 'Zero Hunger',
                    3: 'Good Health and Well-Being',
                    4: 'Quality Education',
                    5: 'Gender Equality',
                    6: 'Clean Water and Sanitation',
                    7: 'Affordable and Clean Energy',
                    8: 'Decent Work and Economic Growth',
                    9: 'Industry Innovation and Infrastructure',
                    10: 'Reduced Inequalities',
                    11: 'Sustainable Cities and Communities',
                    12: 'Responsible Consumption and Production',
                    13: 'Climate Action',
                    14: 'Life Below Water',
                    15: 'Life on Land',
                    16: 'Peace, Justice and Strong Institutions',
                    17: 'Partnership for the Goals'
                  };
                  exportFormData = {
                    proposalTitle: formData.title,
                    dateProposed: new Date().toLocaleString(),
                    participatingSections: slFields.section || '',
                    proponent: formData.faculty,
                    courseTitle: slFields.course || '',
                    courseCode: slFields.courseCode || '',
                    targetDates: formData.targetDate,
                    targetLocation: formData.location,
                    sdgs: (formData.sdg || []).map(num => sdgNumberToLabel[num] || num),
                    proposalDescription: formData.description,
                    proposalObjectives: formData.objectives,
                    specificActivities: formData.specificActivities,
                    successIndicators: formData.successIndicators,
                    budget: formData.budget,
                    stakeholders: formData.stakeholders,
                    volunteerHours: formData.volunteerHours
                  };
                }
                // Map formData to CE export keys if projectType is community-engagement
                if (projectType === 'community-engagement') {
                              // Validation: Prevent export if not selected
                              if (!ceFields.learningOutcomes || ceFields.learningOutcomes === '') {
                                alert('Please select a Learning Outcomes Level before exporting.');
                                setLoading(false);
                                return;
                              }
                  const ceSdgNumberToLabel = {
                    1: 'No Poverty',
                    2: 'Zero Hunger',
                    3: 'Good Health and Well-Being',
                    4: 'Quality Education',
                    5: 'Gender Equality',
                    6: 'Clean Water and Sanitation',
                    7: 'Affordable and Clean Energy',
                    8: 'Decent Work and Economic Growth',
                    9: 'Industry Innovation and Infrastructure',
                    10: 'Reduced Inequalities',
                    11: 'Sustainable Cities and Communities',
                    12: 'Responsible Consumption and Production',
                    13: 'Climate Action',
                    14: 'Life Below Water',
                    15: 'Life on Land',
                    16: 'Peace, Justice and Strong Institutions',
                    17: 'Partnership for the Goals'
                  };
                  // Normalize and filter only valid selections
                  const normalize = s => String(s).replace(/\s+/g, ' ').trim().toLowerCase();
                  const validNatures = ['program', 'project/advocacy', 'consultation/extension'];
                  const validLOs = [
                    'intellectual development',
                    'collaboration',
                    'appreciation of culture and diversity',
                    'career exploration',
                    'socio-civic responsibility',
                    'others',
                    'others, pls. specify'
                  ];
                  let natureArr = ceFields.nature;
                  if (!Array.isArray(natureArr)) natureArr = natureArr ? [natureArr] : [];
                  natureArr = natureArr.map(normalize).filter(n => validNatures.includes(n));
                  let loArr = [];
                  if (ceFields.learningOutcomes) {
                    if (Array.isArray(ceFields.learningOutcomes)) {
                      loArr = ceFields.learningOutcomes;
                    } else if (typeof ceFields.learningOutcomes === 'string' || typeof ceFields.learningOutcomes === 'number') {
                      loArr = [ceFields.learningOutcomes];
                    }
                  }
                  loArr = loArr.map(normalize).filter(lo => validLOs.includes(lo));
                  // Always set learningOutcomes in exportFormData
                  exportFormData = {
                    communityEngagementTitle: formData.title,
                    dateProposed: new Date().toLocaleString(),
                    proponent: formData.faculty,
                    studentOutcomes: formData.studentOutcomes || '',
                    sdgs: (formData.sdg || []).map(num => ceSdgNumberToLabel[num] || num),
                    natureOfEngagement: natureArr,
                    learningOutcomes: loArr,
                    targetDate: formData.targetDate,
                    location: formData.location,
                    stakeholders: formData.stakeholders,
                    numberOfVolunteerHours: formData.volunteerHours,
                    ceDescription: formData.description,
                    ceObjectives: formData.objectives,
                    specificActivities: formData.specificActivities,
                    successIndicators: formData.successIndicators,
                    budget: formData.budget,
                    preparedBy: formData.faculty
                  };
                  console.log('DEBUG: Full exportFormData for CE', exportFormData);
                }
                await exportProposalPDF({
                  projectType,
                  formData: exportFormData,
                  slFields,
                  ceFields,
                  sdgOptions
                });
              } catch (err) {
                alert('Export error: ' + err);
                console.error('Export error:', err);
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'Exporting...' : 'Export'}
          </button>
          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading}
          >
            {loading ? 'Submitting...' : 'Submit Proposal'}
          </button>
        </div>
      </form>
        </div>
      </div>
  );
}

export default ProjectProposal;