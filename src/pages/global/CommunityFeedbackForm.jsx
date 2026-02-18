import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, getDocs, collection, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import "../../styles/CommunityFeedbackForm.css";
import serveIcon from "../../assets/serve_plus_logo.svg";
import { computeAverageRating, getProgramMultiplier } from "../../hooks/rewardSystem";


export default function PublicFeedback() {
    const { missionId } = useParams();
    const navigate = useNavigate();
    const [mission, setMission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitted, setSubmitted] = useState(false);
    const [ratings, setRatings] = useState({
        overallOrganization: 0,
        qualityOfService: 0,
        participation: 0,
        continuity: 0,
        socialImpact: 0,
        relevance: 0,
        inclusivity: 0,
        knowledge: 0,
        alignment: 0,
    });

    const [comments, setComments] = useState("");
    const [name, setName] = useState("");

    useEffect(() => {
        const fetchMission = async () => {
            try {
                const snap = await getDoc(doc(db, "missions", missionId));
                if (snap.exists()) {
                    setMission(snap.data());
                }
            } catch (err) {
                console.error("Error fetching mission:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchMission();
    }, [missionId]);

    const handleRatingChange = (field, value) => {
        setRatings((prev) => ({
            ...prev,
            [field]: Number(value),
        }));
    };

    //adding of "feedbackResponses" as subcollection
    const handleSubmit = async (e) => {
        e.preventDefault();

        //if there is an error - it would scroll back to empty field
        const unansweredField = Object.keys(ratings).find(
            (key) => ratings[key] === 0
        );
        if (unansweredField) {
            const element = document.getElementById(unansweredField);
            if (element) {
                element.scrollIntoView({ behavior: "smooth", block: "center" });
                element.classList.add("rating-error");

                // Remove highlight after 2 seconds
                setTimeout(() => {
                    element.classList.remove("rating-error");
                }, 2000);
            }
            return; // Stop submission
        }

        try {
            if (Object.values(ratings).includes(0)) {
                alert("Please rate all items before submitting.");
                return;
            }
            await addDoc(
                collection(db, "missions", missionId, "feedbackResponses"),
                {
                    ratings,
                    comments,
                    name,
                    submittedAt: serverTimestamp(),
                }
            );
            const snapshot = await getDocs(
                collection(db, "missions", missionId, "feedbackResponses")
            );

            let allAverages = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.ratings) {
                    const avg = computeAverageRating(data.ratings);
                    allAverages.push(avg);
                }
            });
            const missionAverage =
                allAverages.reduce((sum, val) => sum + val, 0) /
                allAverages.length;

            const finalAverage = Number(missionAverage.toFixed(2));
            const multiplier = getProgramMultiplier(finalAverage);

            await updateDoc(doc(db, "missions", missionId), {
                "feedback.avgRating": finalAverage,
                "feedback.multiplier": multiplier
            });

            setSubmitted(true);

        } catch (err) {
            console.error("Error saving response:", err);
            alert("Failed to submit feedback.");
        }
    };

    if (loading) {
        return <div className="feedback-page"><div className="feedback-card">Loading...</div></div>;
    }

    if (!mission) {
        return <div className="feedback-page"><div className="feedback-card">Mission not found.</div></div>;
    }

    if (mission.status !== "published" || !mission.feedback?.isActive) {
        return (
            <div className="feedback-page">
                <div className="feedback-card">
                    <h2>Feedback Closed</h2>
                    <p>This feedback form is no longer accepting responses.</p>
                </div>
            </div>
        );
    }
    //Thank you notice after submission - UI
    if (submitted) {
        return (
            <div className="success-overlay">
                <div className="success-card">
                    <button
                        className="success-close"
                        onClick={() => {
                            if (window.history.length > 1) {
                                navigate(-1);
                            } else {
                                navigate("/");
                            }
                        }} //go back to camera from scanning qr to this form
                    >
                        ✕
                    </button>
                    <img
                        src={serveIcon}
                        alt="Serve+ Logo"
                        className="feedback-logo"
                    />
                    <h2>Thank You! 😊</h2>
                    <p>Your feedback has been successfully submitted.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="feedback-page">
            <div className="feedback-card">
                <div className="feedback-topbar">
                    <h3>Community Feedback Form</h3>
                </div>
                <div className="feedback-content">
                    <div className="feedback-header">
                        <img src={serveIcon} alt="Serve+ Logo" className="feedback-logo" />
                        <h2>{mission.title}</h2>
                        <div className="feedback-meta">
                            <span className="feedback-date">
                                Date: {mission.targetDate
                                    ? new Date(mission.targetDate).toLocaleDateString()
                                    : "Activity Date"}
                            </span>
                        </div>


                        <div className="feedback-instruction">
                            <p>
                                Please rate the following items from <strong>1 (Lowest)</strong> to <strong>5 (Highest) </strong>
                                based on your experience during the activity.
                            </p>

                            <div className="rating-legend">
                                <span><strong>1</strong> – Poor</span>
                                <span><strong>2</strong> – Fair</span>
                                <span><strong>3</strong> – Good</span>
                                <span><strong>4</strong> – Very Good</span>
                                <span><strong>5</strong> – Excellent</span>
                                <span><strong>N/A</strong> – Not Applicable</span>
                            </div>
                        </div>
                    </div>


                    <form onSubmit={handleSubmit} className="feedback-form">
                        <div className="rating-section">
                            {renderRating("Overall Organization", "Pangkalahatang Organisasyon", "Pamamahala ng oras, programa, proyekto / daloy ng aktibidad, atbp.", "overallOrganization")}
                            {renderRating("Quality of Service", "Kalidad ng Serbisyo", "Malinaw na layunin, pagdalo, atbp.", "qualityOfService")}
                            {renderRating("Opportunity for Participation", "Pagkakataon sa Pakikilahok", "Katanungan/ diskusyon/ partisipasyon at pag-engganyo", "participation")}
                            {renderRating("Continuity and Improvement", "Pagpapatuloy at Pagpapabuti", "Posibilidad sa pag ulit ng programa/ proyekto/ aktibidad", "continuity")}
                            {renderRating("Social Impact", "Epekto sa Lipunan", null, "socialImpact")}
                            {renderRating("Relevance to Community Needs", "Kaugnayan sa Pangangailangan ng Komunidad", null, "relevance")}
                            {renderRating("Promotes Inclusivity and Equality", "Nagpapalaganap ng Pagkakapantay-pantay at Inklusibidad", "Pagkakapantay-pantay sa komunidad", "inclusivity")}
                            {renderRating("Participants Acquired New Knowledge", "Nakakuha ng Bagong Kaalaman ang mga Kalahok", null, "knowledge")}
                            {renderRating("Alignment with Beneficiaries' Needs", "Angkop sa Pangangailangan ng mga Benepisyaryo", null, "alignment")}
                        </div>

                        <div className="feedback-group">
                            <label>Other Comments or Suggestions</label>
                            <textarea
                                className="feedback-textarea"
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                            />
                        </div>

                        <div className="feedback-group">
                            <label>Name (Optional)</label>
                            <input
                                type="text"
                                className="feedback-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>

                        <button type="submit" className="feedback-button">
                            Submit Feedback
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );

    function renderRating(label, tagalog, description, field) {
        return (
            <div className="rating-group" id={field}>
                <label>
                    <span className="rating-label-en">{label}</span>
                    <span className="rating-label-tl">{tagalog}</span>
                    {description && (
                        <span className="rating-label-desc">
                            [{description}]
                        </span>
                    )}
                </label>
                <div className="rating-options">
                    {[1, 2, 3, 4, 5].map((num) => (
                        <label key={num} className="rating-item">
                            <input
                                type="radio"
                                name={field}
                                value={num}
                                checked={ratings[field] === num}
                                onChange={(e) =>
                                    handleRatingChange(field, e.target.value)
                                }
                            />
                            {num}
                        </label>
                    ))}
                    {/* N/A Option */}
                    <label className="rating-item rating-na">
                        <input
                            type="radio"
                            name={field}
                            value="NA"
                            checked={ratings[field] === null}
                            onChange={() =>
                                setRatings((prev) => ({
                                    ...prev,
                                    [field]: null,
                                }))
                            }
                        />
                        N/A
                    </label>
                </div>
            </div>
        );
    }
}
