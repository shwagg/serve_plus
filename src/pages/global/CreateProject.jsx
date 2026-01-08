import { db } from "../../firebaseConfig";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "../../styles/AdminDashboard.css";
import { useState, useEffect } from "react";
//import { Link, useNavigate } from "react-router-dom";

export default function CreateProject() {
    const [title, setTitle] = useState("");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [location, setLocation] = useState("");
    const [points, setPoints] = useState("");
    const [description, setDescription] = useState("");
    //const [waiver, setWaiver] = useState("");

    const [facultyInCharge, setFacultyInCharge] = useState("");
    const [sections, setSections] = useState("");
    const [courseTitle, setCourseTitle] = useState("");
    const [courseCode, setCourseCode] = useState("");
    const [stakeholders, setStakeholders] = useState("");
    const [targetDates, setTargetDates] = useState("");
    const [volunteerHours, setVolunteerHours] = useState("");
    const [sdgs, setSdgs] = useState([]); // array of strings

    // SDG items for selection
    const sdgItems = [
        "1. No Poverty",
        "2. Zero Hunger",
        "3. Good Health and Well-Being",
        "4. Quality Education",
        "5. Gender Equality",
        "6. Clean Water and Sanitation",
        "7. Affordable and Clean Energy",
        "8. Decent Work and Economic Growth",
        "9. Industry, Innovation, and Infrastructure",
        "10. Reduced Inequalities",
        "11. Sustainable Cities and Communities",
        "12. Responsible Consumption and Production",
        "13. Climate Action",
        "14. Life Below Water",
        "15. Life on Land",
        "16. Peace, Justice, and Strong Institutions",
        "17. Partnership for the Goals",
    ];
    const half = Math.ceil(sdgItems.length / 2); // 9
    const leftCol = sdgItems.slice(0, half);     // 1-9
    const rightCol = sdgItems.slice(half);       // 10-17
    const sdgColumnMajor = leftCol.flatMap((item, i) => [
        item,
        rightCol[i]
    ]).filter(Boolean);

    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);

    //Submit to "Missions" under Firestore
    const handleSaveDraft = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            const payload = {
                title: title?.trim() || "",
                date: date || "",
                dateAt: date ? Timestamp.fromDate(new Date(`${date}T00:00:00`)) : null,
                // format: January 8, 2026
                time: time?.trim() || "",
                location: location?.trim() || "",
                points: Number(points) || 0,
                description: description?.trim() || "",
                waiver: waiver?.trim() || "",

                facultyInCharge: facultyInCharge?.trim() || "",
                sections: sections?.trim() || "",
                courseTitle: courseTitle?.trim() || "",
                courseCode: courseCode?.trim() || "",
                stakeholders: stakeholders?.trim() || "",
                targetDates: targetDates?.trim() || "",
                volunteerHours: Number(volunteerHours) || 0,
                sdgs: sdgs, //can be tags here for easy search

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

            // input required before submitting
            if (!payload.title) throw new Error("Title is required.");
            //if (!payload.date) throw new Error("Date is required.");

            const docRef = await addDoc(collection(db, "Missions"), payload);

            // go to project details after saving
            navigate(`/admin/projects/${docRef.id}`);
        } catch (err) {
            console.error("Create proposal failed:", err);
            alert(err.message || "Failed to save proposal.");
        } finally {
            setSaving(false);
        }
    };

    //for info description when clicked
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

    //date proposed set to default when saving as drafts
    useEffect(() => {
        const today = new Date().toISOString().slice(0, 10);
        setDate((prev) => prev || today);
    }, []);


    return (
        <div className="create-project">
            {/* Top header (outside the card) */}
            <div className="cp-topbar">
                <h1 className="page-title"> Create Project </h1>
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
                            <label className="cp-label">Title of Service-Learning Initiative</label>
                            <input className="cp-input" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                        </div>

                        <div className="cp-field cp-span-4">
                            <label className="cp-label">Date Proposed</label>
                            <div className="cp-inputWrap">
                                <input className="cp-input cp-inputHasIcon" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                                <span className="cp-inputIcon" aria-hidden="true">🗓</span>
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="cp-field cp-span-12">
                            <label className="cp-label">Description / Project Rationale</label>
                            <textarea
                                className="cp-input"
                                rows={5}
                                placeholder="Briefly describe the purpose, activities, and expected impact of the project."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </div>

                        {/* Row 3 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Faculty-In-Charge / Proponent(s)</label>
                            <input className="cp-input" type="text" value={facultyInCharge} onChange={(e) => setFacultyInCharge(e.target.value)} />
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Participating Section(s)</label>
                            <input className="cp-input" type="text" value={sections} onChange={(e) => setSections(e.target.value)} />
                        </div>

                        {/* Row 4 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Course Title</label>
                            <input className="cp-input" type="text" value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Course Code</label>
                            <input className="cp-input" type="text" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
                        </div>

                        {/* Row 5 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Stakeholders</label>
                            <input className="cp-input" type="text" value={stakeholders} onChange={(e) => setStakeholders(e.target.value)} />
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Target Dates</label>
                            <div className="cp-inputWrap">
                                <input className="cp-input cp-inputHasIcon" type="text" placeholder="" value={targetDates} onChange={(e) => setTargetDates(e.target.value)} />
                                <span className="cp-inputIcon" aria-hidden="true">🗓</span>
                            </div>
                        </div>

                        {/* Row 6 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Target location</label>
                            <input className="cp-input" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
                        </div>

                        <div className="cp-field cp-span-3">
                            <label className="cp-label">Number of Volunteer Hours</label>
                            <input className="cp-input" type="number" min="0" value={volunteerHours} onChange={(e) => setVolunteerHours(e.target.value)} />
                        </div>

                        <div className="cp-field cp-span-3">
                            <label className="cp-label">Points</label>
                            <input
                                className="cp-input"
                                type="number"
                                min="0"
                                placeholder="e.g., 150"
                                value={points}
                                onChange={(e) => setPoints(e.target.value)}
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
                            {sdgColumnMajor.map((item) => (
                                <label key={item} className="cp-sdgItem">
                                    <input
                                        type="checkbox"
                                        className="cp-checkbox"
                                        checked={sdgs.includes(item)}
                                        onChange={(e) => {
                                            setSdgs((prev) =>
                                                e.target.checked ? [...prev, item] : prev.filter((x) => x !== item)
                                            );
                                        }}
                                    />
                                    <span className="cp-sdgText">{item}</span>
                                </label>
                            ))}
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
            </div>
        </div >
    );
}
