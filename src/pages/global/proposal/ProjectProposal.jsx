import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import '../../../styles/ProjectProposal.css';

function ProjectProposal({ projectType, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Common fields
  const [formData, setFormData] = useState({
    title: '',
    dateProposed: '',
    sdg: '',
    targetDate: '',
    stakeholders: '',
    location: '',
    volunteerHours: '',
    description: '',
    objectives: '',
    specificActivities: '',
    successIndicators: '',
    budget: '',
  });

  // Service Learning specific fields
  const [slFields, setSlFields] = useState({
    section: '',
    course: '',
    courseCode: '',
  });

  // Community Engagement specific fields
  const [ceFields, setCeFields] = useState({
    nature: '',
    learningOutcomes: '',
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        alert('You must be logged in to submit a proposal');
        return;
      }

      // Prepare proposal data
      const proposalData = {
        proponent: user.uid,
        dateCreated: serverTimestamp(),
        status: 'pending',
        proposalType: projectType === 'service-learning' ? 'sl' : 'ce',
        title: formData.title,
        dateProposed: formData.dateProposed,
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
        proposalData.slFields = slFields;
      } else {
        proposalData.ceFields = ceFields;
      }

      // Submit to Firestore
      await addDoc(collection(db, 'proposal'), proposalData);

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

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="dateProposed">Date Proposed *</label>
              <input
                type="date"
                id="dateProposed"
                name="dateProposed"
                value={formData.dateProposed}
                onChange={handleInputChange}
                required
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
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sdg">Sustainable Development Goal (SDG)</label>
              <input
                type="text"
                id="sdg"
                name="sdg"
                value={formData.sdg}
                onChange={handleInputChange}
                placeholder="e.g., SDG 4: Quality Education"
              />
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
                <option value="0">Level 0</option>
                <option value="1">Level 1</option>
                <option value="2">Level 2</option>
                <option value="3">Level 3</option>
                <option value="4">Level 4</option>
                <option value="5">Level 5</option>
              </select>
            </div>
          </div>
        )}

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