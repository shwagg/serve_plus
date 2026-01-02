import "../../styles/AdminDashboard.css";
import { useState, useEffect } from "react";
//import { Link, useNavigate } from "react-router-dom";

export default function CreateProject() {
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

    return (
        <div className="create-project">
            {/* Top header (outside the card) */}
            <div className="cp-topbar">
                <h1 className="page-title">Service-Learning Proposal</h1>
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
                <form>
                    <div className="cp-grid">
                        {/* Row 1 */}
                        <div className="cp-field cp-span-8">
                            <label className="cp-label">Title of Service-Learning Initiative</label>
                            <input className="cp-input" type="text" />
                        </div>

                        <div className="cp-field cp-span-4">
                            <label className="cp-label">Date Proposed</label>
                            <div className="cp-inputWrap">
                                <input className="cp-input cp-inputHasIcon" type="date" />
                                <span className="cp-inputIcon" aria-hidden="true">🗓</span>
                            </div>
                        </div>

                        {/* Row 2 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Faculty-In-Charge / Proponent(s)</label>
                            <input className="cp-input" type="text" />
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Participating Section(s)</label>
                            <input className="cp-input" type="text" />
                        </div>

                        {/* Row 3 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Course Title</label>
                            <input className="cp-input" type="text" />
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Course Code</label>
                            <input className="cp-input" type="text" />
                        </div>

                        {/* Row 4 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Stakeholders</label>
                            <input className="cp-input" type="text" />
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Target Dates</label>
                            <div className="cp-inputWrap">
                                <input className="cp-input cp-inputHasIcon" type="text" placeholder="" />
                                <span className="cp-inputIcon" aria-hidden="true">🗓</span>
                            </div>
                        </div>

                        {/* Row 5 */}
                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Target location</label>
                            <input className="cp-input" type="text" />
                        </div>

                        <div className="cp-field cp-span-6">
                            <label className="cp-label">Number of Volunteer Hours</label>
                            <input className="cp-input" type="number" min="0" />
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
                            {[
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
                            ].map((item) => (
                                <label key={item} className="cp-sdgItem">
                                    <input type="checkbox" className="cp-checkbox" />
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

                        <button type="button" className="cp-btnPrimary">
                            NEXT
                        </button>
                    </div>
                </form>
            </div>
        </div >
    );
}
