// Community Engagement Proposal Template
import { db } from "../../firebaseConfig";
import { addDoc, collection, serverTimestamp, Timestamp, setDoc, doc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../../styles/AdminDashboard.css";
import { CampaignOutlinedIcon, ImportContactsOutlinedIcon, ConnectWithoutContactOutlinedIcon } from "../../components/icons";
import { SDGS } from "../../hooks/sdg";
import { useState, useEffect, useRef } from "react";

export default function CreateProject() {
    //note: useref for able to track which input is empty
    const [title, setTitle] = useState(""); const titleRef = useRef(null);
    const [date, setDate] = useState("");
    const [proponents, setProponents] = useState([]); const proponentsRef = useRef(null);
    const [proponentInput, setProponentInput] = useState("");
    const [isProponentFocused, setIsProponentFocused] = useState(false);

    const [studentOutcomes, setStudentOutcomes] = useState(""); const studentOutcomesRef = useRef(null);
    const [sdgs, setSdgs] = useState([]); // array of numbers (SDG IDs) 
    const sdgsRef = useRef(null);
    const sdgItems = Object.entries(SDGS).map(([id, label]) => ({
        id: Number(id),
        label,
    }));
    const half = Math.ceil(sdgItems.length / 2); // 9
    const leftCol = sdgItems.slice(0, half);     // 1-9
    const rightCol = sdgItems.slice(half);       // 10-17
    const sdgColumnMajor = leftCol.flatMap((item, i) => [
        item,
        rightCol[i]
    ]).filter(Boolean);
    const [natureOfEngagement, setNatureOfEngagement] = useState(""); const natureRef = useRef(null);
    const [learningOutcomes, setLearningOutcomes] = useState([]); const learningOutcomesRef = useRef(null);
    const [otherOutcome, setOtherOutcome] = useState(""); //for customize label of learning outcomes
    const OTHER_KEY = "__OTHER__"; //'others, please specify' wont be showing to users initially
    const [targetDates, setTargetDates] = useState(""); const targetDateRef = useRef(null);
    const [location, setLocation] = useState(""); const locationRef = useRef(null);
    const [stakeholders, setStakeholders] = useState(""); const stakeholdersRef = useRef(null);
    const [volunteerHours, setVolunteerHours] = useState(""); const volunteerHoursRef = useRef(null);
    const [description, setDescription] = useState(""); const descriptionRef = useRef(null);
    const [objectives, setObjectives] = useState(""); const objectivesRef = useRef(null);
    const [specificActivities, setSpecificActivities] = useState([]); const activitiesRef = useRef(null);
    const [activityInput, setActivityInput] = useState("");
    const [isActivityFocused, setIsActivityFocused] = useState(false);
    const [successIndicators, setSuccessIndicators] = useState([]);
    const [indicatorInput, setIndicatorInput] = useState(""); const indicatorsRef = useRef(null);
    const [isIndicatorFocused, setIsIndicatorFocused] = useState(false);
    const [budget, setBudget] = useState(""); const budgetRef = useRef(null);
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    // For consistency of tags
    const normalizeTag = (value) =>
        value
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim();

    const displayTag = (value) =>
        value.toUpperCase();

    //Proponent Names and Organizations
    const handleAddProponent = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();

            const normalized = normalizeTag(proponentInput);
            if (!normalized) return;
            if (proponents.includes(normalized)) return;

            setProponents((prev) => [...prev, normalized]);
            setProponentInput("");
        }
    };

    //Nature of engagement & Learning outcomes options
    const NATURE_OPTIONS = [
        { key: "Program", icon: ImportContactsOutlinedIcon },
        { key: "Project/ Advocacy", icon: CampaignOutlinedIcon },
        { key: "Consultation/ Extension", icon: ConnectWithoutContactOutlinedIcon },
    ];

    const LEARNING_OUTCOME_OPTIONS = [
        "Intellectual Development",
        "Collaboration",
        "Appreciation of Culture and Diversity",
        "Career Exploration",
        "Socio-Civic Responsibility",
        OTHER_KEY,
    ];

    //Target date calendar
    const getMinTargetDate = (proposedDate) => {
        if (!proposedDate) return "";

        const d = new Date(proposedDate);
        d.setMonth(d.getMonth() + 1);

        return d.toISOString().slice(0, 10);
    };

    //Specific Activities
    const handleAddActivityTag = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();

            const normalized = normalizeTag(activityInput);
            if (!normalized) return;
            if (specificActivities.includes(normalized)) return;

            setSpecificActivities((prev) => [...prev, normalized]);
            setActivityInput("");
        }
    };
    //Success Indicators
    const handleAddIndicator = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();

            const value = indicatorInput
                .replace(/\s+/g, " ")
                .trim();

            if (!value) return;

            setSuccessIndicators((prev) => [...prev, value]);
            setIndicatorInput("");
        }
    };

    const autoResizeIndicator = (el) => {
        if (!el) return;

        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    };

    const handleIndicatorChange = (e) => {
        const el = e.target;
        const value = el.value;

        // limit to 2 lines
        if (value.split("\n").length > 2) return;

        setIndicatorInput(value);
        autoResizeIndicator(el);
    };
    //Input Validations
    const scrollToRef = (ref) => {
        if (!ref?.current) return;

        ref.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
        });

        if (typeof ref.current.focus === "function") {
            ref.current.focus();
        }
    };

    const validatePayload = (payload) => {
        const isEmptyString = (v) => typeof v === "string" && !v.trim();
        const isEmptyArray = (v) => Array.isArray(v) && v.length === 0;

        if (isEmptyString(payload.title)) {
            return { ref: titleRef, message: "Title is required." };
        }

        if (isEmptyArray(payload.proponents)) {
            return { ref: proponentsRef, message: "Please add at least one proponent." };
        }

        if (isEmptyString(payload.studentOutcomes)) {
            return {
                ref: studentOutcomesRef,
                message: "Student outcomes are required.",
            };
        }

        if (isEmptyArray(payload.sdgs)) {
            return { ref: sdgsRef, message: "At least one SDG must be selected." };
        }

        if (isEmptyString(payload.natureOfEngagement)) {
            return {
                ref: natureRef,
                message: "Nature of engagement is required.",
            };
        }

        if (isEmptyArray(payload.learningOutcomes)) {
            return {
                ref: learningOutcomesRef,
                message: "At least one learning outcome must be selected.",
            };
        }

        if (isEmptyString(payload.targetDates)) {
            return {
                ref: targetDateRef,
                message: "Target date is required.",
            };
        }

        // 1-month preparation rule
        if (payload.date && payload.targetDates) {
            const proposed = new Date(payload.date);
            const target = new Date(payload.targetDates);

            const minTarget = new Date(proposed);
            minTarget.setMonth(minTarget.getMonth() + 1);

            if (target < minTarget) {
                return {
                    ref: targetDateRef,
                    message:
                        "Target date must be at least one month after the proposed date.",
                };
            }
        }

        if (isEmptyString(payload.location)) {
            return { ref: locationRef, message: "Location is required." };
        }

        if (isEmptyString(payload.stakeholders)) {
            return { ref: stakeholdersRef, message: "Stakeholders are required." };
        }

        if (!payload.volunteerHours || payload.volunteerHours <= 0) {
            return {
                ref: volunteerHoursRef,
                message: "Volunteer hours must be greater than zero.",
            };
        }

        if (isEmptyString(payload.description)) {
            return { ref: descriptionRef, message: "Description is required." };
        }

        if (isEmptyString(payload.objectives)) {
            return { ref: objectivesRef, message: "Objectives are required." };
        }

        if (isEmptyArray(payload.specificActivities)) {
            return {
                ref: activitiesRef,
                message: "Please add at least one specific activity.",
            };
        }

        if (isEmptyArray(payload.successIndicators)) {
            return {
                ref: indicatorsRef,
                message: "Please add at least one success indicator.",
            };
        }

        if (isEmptyString(payload.budget)) {
            return {
                ref: budgetRef,
                message: "Budget is required. You may enter N/A if not applicable.",
            };
        }

        return null;
    };



    //Submit to "Missions" under Firestore
    const handleSaveDraft = async (e) => {
        e.preventDefault();
        setSaving(true);
        const finalLearningOutcomes = learningOutcomes
            .filter((x) => x !== OTHER_KEY)
            .concat(
                learningOutcomes.includes(OTHER_KEY) && otherOutcome.trim()
                    ? [`Other: ${otherOutcome.trim()}`]
                    : []
            );

        try {
            const payload = {
                title: title?.trim() || "",
                date: date || "",
                dateAt: date ? Timestamp.fromDate(new Date(`${date}T00:00:00`)) : null, //what is this for?
                // format: January 8, 2026
                proponents,
                studentOutcomes: studentOutcomes?.trim() || "",
                sdgs: sdgs, //read from ../hooks/sdg.js
                natureOfEngagement,
                learningOutcomes: finalLearningOutcomes,
                targetDates: targetDates?.trim() || "",
                location: location?.trim() || "",
                stakeholders: stakeholders?.trim() || "",
                volunteerHours: Number(volunteerHours) || 0,
                description: description?.trim() || "",
                objectives: objectives?.trim() || "",
                specificActivities,
                successIndicators,
                budget: budget?.trim() || "",

                img: "",
                badge: "",
                alt: title?.trim() || "",

                status: "draft",
                approvals: {
                    faculty: { approved: false, decidedAt: null },
                    partner: { approved: false, decidedAt: null },
                },
                submittedAt: null,
                publishedAt: null,

                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            };

            // Input required validation before submitting
            const error = validatePayload(payload);
            if (error) {
                scrollToRef(error.ref);
                alert(error.message);
                setSaving(false);
                return;
            }
            const docRef = await addDoc(collection(db, "missions"), payload);

            // Create chat metadata 
            const chatMetadataRef = doc(db, "missions", docRef.id, "chat", "metadata");
            await setDoc(chatMetadataRef, {
                createdAt: serverTimestamp(),
                lastMessageAt: null,
                messageCount: 0
            });

            // go to project details after saving
            navigate(`/admin/projects/${docRef.id}`);
        } catch (err) {
            console.error("Create proposal failed:", err);
            alert(err.message || "Failed to save proposal.");
        } finally {
            setSaving(false);
        }
    };

    //For info description when clicked
    const [showInfo, setShowInfo] = useState(false);
    const handleInfoClick = () => {
        setShowInfo(true);
    };
    useEffect(() => {
        if (!showInfo) return;
        const timer = setTimeout(() => {
            setShowInfo(false);
        }, 5000); // 5 seconds

        return () => clearTimeout(timer);
    }, [showInfo]);

    //Date proposed set to default when saving as drafts
    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        setDate((prev) => prev || today);
    }, []);

    return (
        <div className="create-project">
            {/* Top header (outside the card) */}
            <div className="cp-topbar">
                <h1 className="page-title"> Community Engagement Proposal </h1>
                <div className="cp-infoWrapper">
                    <button type="button" className="cp-infoBtn"
                        onClick={handleInfoClick}
                        aria-label="Information">
                        i
                    </button>
                    <div className={`cp-infoHint ${showInfo ? "show" : ""}`}>
                        Use this form to propose a service-learning initiative for review and approval.
                    </div>

                </div>
            </div>

            {/* Form Card */}
            <div className="cp-card">
                <form className="cp-form" onSubmit={handleSaveDraft}>
                    <div className="cp-grid">
                        {/* Row 1 */}
                        <div className="cp-field cp-span-8">
                            <label className="cp-label">Title of the Initiative</label>
                            <input ref={titleRef} className="cp-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                        </div>

                        <div className="cp-field cp-span-4">
                            <label className="cp-label">Date Proposed</label>
                            <div className="cp-inputWrap">
                                <input className="cp-input cp-inputHasIcon" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                <span className="cp-inputIcon" aria-hidden="true">🗓</span>
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">
                                Name of Proponent(s)
                                <span className="cp-note">(Press Enter to add)</span>
                            </label>

                            <div
                                className="cp-tagInput"
                                onClick={() => setIsProponentFocused(true)}
                            >
                                {proponents.map((name) => (
                                    <span key={name} className="cp-tag">
                                        {displayTag(name)}
                                        <button
                                            type="button"
                                            className="cp-tagRemove"
                                            onClick={() =>
                                                setProponents((prev) => prev.filter((x) => x !== name))
                                            }
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}

                                {(isProponentFocused || proponentInput) && (
                                    <input
                                        ref={proponentsRef}
                                        type="text"
                                        className="cp-tagInputField"
                                        placeholder="e.g. Juan Dela Cruz"
                                        value={proponentInput}
                                        onChange={(e) => setProponentInput(e.target.value)}
                                        onKeyDown={handleAddProponent}
                                        onBlur={() => {
                                            setIsProponentFocused(false);
                                            if (!proponentInput.trim()) setProponentInput("");
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Student Outcomes<br /></label>
                            <textarea
                                ref={studentOutcomesRef}
                                className="cp-input"
                                rows={5}
                                value={studentOutcomes}
                                onChange={(e) => setStudentOutcomes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* SDG Section */}
                    <div className="cp-sdg">
                        <div className="cp-sdgHeader">
                            <span className="cp-label cp-sdgLabel">SDG(s)</span>
                            <span className="cp-sdgNote">
                                Note: Please check the targeted SDG Number and Goal that applies.
                            </span>
                        </div>

                        <div className="cp-sdgGrid">
                            {sdgColumnMajor.map((sdg) => (
                                <label key={sdg.id} className="cp-sdgItem">
                                    <input
                                        ref={sdgsRef}
                                        type="checkbox"
                                        className="cp-checkbox"
                                        checked={sdgs.includes(sdg.id)}
                                        onChange={(e) => {
                                            setSdgs((prev) =>
                                                e.target.checked ? [...prev, sdg.id] : prev.filter((id) => id !== sdg.id)
                                            );
                                        }}
                                    />
                                    <span className="cp-sdgText">SDG {sdg.id} - {sdg.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Nature of Engagement */}
                    <div className="cp-filterBlock">
                        <label className="cp-label">Nature of Engagement</label>
                        <div className="cp-propertyGrid">
                            {NATURE_OPTIONS.map((option) => {
                                const selected = natureOfEngagement === option.key;

                                return (
                                    <button
                                        key={option.key}
                                        ref={natureRef}
                                        type="button"
                                        className={`cp-propertyCard ${selected ? "active" : ""}`}
                                        onClick={() => setNatureOfEngagement(option.key)}
                                    >
                                        <div className="cp-propertyIcon"><option.icon fontSize="medium" /></div>
                                        <div className="cp-propertyLabel">{option.key}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>


                    {/* Learning Outcomes */}
                    <div className="cp-filterBlock">
                        <label className="cp-label">
                            Learning Outcomes <span className="cp-note">(Check all that apply)</span>
                        </label>

                        <div className="cp-amenities">
                            {LEARNING_OUTCOME_OPTIONS.map((option) => {
                                const isOther = option === OTHER_KEY;
                                const selected = isOther
                                    ? learningOutcomes.includes(OTHER_KEY)
                                    : learningOutcomes.includes(option);

                                return (
                                    <button
                                        ref={learningOutcomesRef}
                                        key={option}
                                        type="button"
                                        className={`cp-amenity ${selected ? "active" : ""} ${isOther ? "cp-amenity-other" : ""
                                            }`}
                                        onClick={() => {
                                            if (isOther) {
                                                setLearningOutcomes((prev) =>
                                                    prev.includes(OTHER_KEY)
                                                        ? prev.filter((x) => x !== OTHER_KEY)
                                                        : [...prev, OTHER_KEY]
                                                );
                                            } else {
                                                setLearningOutcomes((prev) =>
                                                    selected
                                                        ? prev.filter((x) => x !== option)
                                                        : [...prev, option]
                                                );
                                            }
                                        }}
                                    >
                                        <span className="cp-amenityIcon">
                                            {selected ? "✓" : ""}
                                        </span>

                                        {isOther && selected ? (
                                            <input
                                                type="text"
                                                className="cp-amenityInput"
                                                placeholder="Others, please specify"
                                                value={otherOutcome}
                                                onChange={(e) => setOtherOutcome(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="cp-amenityLabel">
                                                {isOther
                                                    ? "Others, please specify"
                                                    : option}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="cp-grid">
                        {/* Row 6 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Target Dates
                                <span className="cp-note">
                                    (Must be at least 1 month after the proposed date)
                                </span>
                            </label>
                            <div className="cp-inputWrap">
                                <input
                                    ref={targetDateRef}
                                    className="cp-input cp-inputHasIcon"
                                    type="date"
                                    value={targetDates}
                                    min={getMinTargetDate(date)}
                                    onChange={(e) => setTargetDates(e.target.value)}
                                />

                                <span className="cp-inputIcon" aria-hidden="true">🗓</span>
                            </div>
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Location</label>
                            <input ref={locationRef} className="cp-input" type="text" value={displayTag(location)} onChange={(e) => setLocation(e.target.value)} />
                        </div>

                        {/* Row 7 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Stakeholders</label>
                            <input ref={stakeholdersRef} className="cp-input" type="text" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} />
                        </div>


                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Number of Volunteer Hours</label>
                            <input ref={volunteerHoursRef} className="cp-input" type="number" min="0" value={volunteerHours} onChange={(e) => setVolunteerHours(e.target.value)} />
                        </div>

                        {/* Row 8 */}
                        <div className="cp-field cp-span-12">
                            <label className="cp-label">Description / Project Rationale</label>
                            <textarea
                                ref={descriptionRef}
                                className="cp-input"
                                rows={5}
                                placeholder="Briefly describe the purpose, activities, and expected impact of the project."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>
                        {/* Row 9 */}
                        <div className="cp-field cp-span-12">
                            <label className="cp-label">Objectives</label>
                            <textarea
                                ref={objectivesRef}
                                className="cp-input"
                                rows={5}
                                placeholder="Briefly describe the purpose, activities, and expected impact of the project."
                                value={objectives}
                                onChange={(e) => setObjectives(e.target.value)}
                            />
                        </div>

                    </div>
                    <div className="cp-grid">
                        {/* Row 10 */}
                        <div className="cp-field cp-span-6">
                            {/* Specific Activities */}
                            <div className="cp-filterBlock">
                                <label className="cp-label">
                                    Specific Activities{" "}
                                    <span className="cp-note">(Press Enter to add)</span>
                                </label>

                                <div
                                    className="cp-tagInput"
                                    onClick={() => setIsActivityFocused(true)}
                                >
                                    {specificActivities.map((activity) => (
                                        <span key={activity} className="cp-tag">
                                            {displayTag(activity)}
                                            <button
                                                type="button"
                                                className="cp-tagRemove"
                                                onClick={() =>
                                                    setSpecificActivities((prev) =>
                                                        prev.filter((x) => x !== activity)
                                                    )
                                                }
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}

                                    {/* Input (appears only when focused or has value) */}
                                    {(isActivityFocused || activityInput) && (
                                        <input
                                            ref={activitiesRef}
                                            type="text"
                                            className="cp-tagInputField"
                                            placeholder="e.g. coastal cleanup"
                                            value={activityInput}
                                            onChange={(e) => setActivityInput(e.target.value)}
                                            onKeyDown={handleAddActivityTag}
                                            onFocus={() => setIsActivityFocused(true)}
                                            onBlur={() => {
                                                setIsActivityFocused(false);
                                                if (!activityInput.trim()) setActivityInput("");
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="cp-field cp-span-6">
                            {/* Success Indicators */}
                            <div className="cp-filterBlock">
                                <label className="cp-label">
                                    Success Indicators{" "}
                                    <span className="cp-note">(Press Enter to add)</span>
                                </label>

                                <div className="cp-indicatorCard"
                                    onClick={() => setIsIndicatorFocused(true)}>
                                    {/* Existing indicators */}
                                    {successIndicators.map((item, index) => (
                                        <div key={index} className="cp-indicatorItem">
                                            <span className="cp-indicatorIndex">{index + 1}.</span>

                                            <span className="cp-indicatorText">{item}</span>

                                            <button
                                                type="button"
                                                className="cp-indicatorRemove"
                                                onClick={() =>
                                                    setSuccessIndicators((prev) =>
                                                        prev.filter((_, i) => i !== index)
                                                    )
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}

                                    {/* Input row – only when focused or typing */}
                                    {(isIndicatorFocused || indicatorInput) && (
                                        <div className="cp-indicatorInputRow">
                                            <span className="cp-indicatorIndex">
                                                {successIndicators.length + 1}.
                                            </span>

                                            <textarea
                                                ref={indicatorsRef}
                                                className="cp-indicatorInput"
                                                placeholder="e.g. at least 100 kg of waste collected"
                                                value={indicatorInput}
                                                rows={1}
                                                onChange={handleIndicatorChange}
                                                onKeyDown={handleAddIndicator}
                                                onFocus={(e) => {
                                                    setIsIndicatorFocused(true);
                                                    autoResizeIndicator(e.target);
                                                }}
                                                onBlur={() => {
                                                    setIsIndicatorFocused(false);
                                                    if (!indicatorInput.trim()) setIndicatorInput("");
                                                }}
                                            />


                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        {/* Row 11 */}
                        {/* Budget */}
                        <div className="cp-field cp-span-12">
                            <label className="cp-label">Budget</label>
                            <textarea
                                ref={budgetRef}
                                className="cp-input"
                                rows={5}
                                placeholder="Provide computation here"
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="cp-actions">
                        <button type="button" className="cp-btnOutline">
                            PREVIOUS
                        </button>

                        <button type="submit" disabled={saving}
                            className="cp-btnPrimary">
                            SAVE AS DRAFT
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
