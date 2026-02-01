import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, setDoc, collection, getDocs, query, where } from "firebase/firestore";
import { VisibilityIcon, VisibilityOffIcon } from "../components/icons";

function Register() {
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const registerSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (password !== confirmPassword) {
            setError("Password does not match");
            setLoading(false);
            return;
        }

        try {
            // 1. Create user in Firebase Auth
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCred.user.uid;

            // 2. Fetch upcoming event
            let upcomingEventLabel = null;
            try {
                const missionsRef = collection(db, "Missions");
                const missionsSnap = await getDocs(missionsRef);
                
                const now = new Date();
                let nearestEvent = null;
                let nearestDate = null;
                
                console.log('Fetching events for new user registration...');
                
                missionsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    console.log('Event:', data.title, 'Date:', data.date, 'Status:', data.status);
                    
                    if (data.date && (data.status === 'published' || !data.status)) {
                        let eventDate;
                        if (data.dateAt?.toDate) {
                            eventDate = data.dateAt.toDate();
                        } else if (data.date) {
                            // Try parsing the date string
                            eventDate = new Date(data.date);
                        }
                        
                        console.log('Parsed date:', eventDate, 'Is future:', eventDate > now);
                        
                        if (eventDate && eventDate > now && (!nearestDate || eventDate < nearestDate)) {
                            nearestDate = eventDate;
                            nearestEvent = data.title || 'Upcoming Event';
                        }
                    }
                });
                
                console.log('Nearest event found:', nearestEvent);
                
                if (nearestEvent) {
                    upcomingEventLabel = `Joined Event: ${nearestEvent}`;
                }
            } catch (err) {
                console.error('Could not fetch upcoming event:', err);
            }

            // 3. Create user profile in Firestore
            const eventHistory = [
                { label: "Registered", date: new Date().toISOString().slice(0, 10) }
            ];
            
            if (upcomingEventLabel) {
                eventHistory.push({ 
                    label: upcomingEventLabel, 
                    date: new Date().toISOString().slice(0, 10) 
                });
            }

            await setDoc(doc(db, "users", uid), {
                uid,
                name,
                username,
                email,
                role: "student", // Default role for new registrations
                status: "active",
                createdAt: new Date(),
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name || username)}&background=30bdb7&color=fff&size=120`,
                level: 1,
                levelProgress: 0,
                skills: ["React", "Firebase", "UI/UX"],
                interests: ["Design", "Coding", "Music"],
                achievements: ["Welcome!"],
                eventHistory
            });

            // 4. Redirect to login
            alert("Account created successfully! Please log in.");
            navigate("/", { replace: true });
        } catch (err) {
            console.error(err);
            setError(err.message || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="ui-container">
            <div className="ui-card">
                <form className="ui-form" onSubmit={registerSubmit}>
                    <h2 className="ui-title">
                        SIGN UP <span className="ui-title-to">to</span> SERVE<span className="ui-title-plus">+</span>
                    </h2>

                    {/* Link to Login Page if account exists */}
                    <p className="ui-link">
                        Already have an account?{" "}
                        <Link to="/auth">Login here</Link>
                    </p>

                    <input
                        className="ui-input"
                        type="text"
                        placeholder="Name"
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <input
                        className="ui-input"
                        type="text"
                        placeholder="Username"
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />

                    <input
                        className="ui-input"
                        type="email"
                        placeholder="Email"
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <div className="ui-input-pass-wrap">
                        <input
                            className="ui-input"
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {password.length > 0 && (
                            <button
                                type="button"
                                className="ui-btn eye"
                                aria-label={showPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowPassword((prev) => !prev)}
                            >
                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </button>
                        )}
                    </div>

                    <div className="ui-input-pass-wrap">
                        <input
                            className="ui-input"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirm Password"
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        {confirmPassword.length > 0 && (
                            <button
                                type="button"
                                className="ui-btn eye"
                                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                onClick={() => setShowConfirmPassword((prev) => !prev)}
                            >
                                {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </button>
                        )}
                    </div>

                    <button className="ui-btn" type="submit" disabled={loading}>
                        {loading ? "Creating Account..." : "Create Account"}
                    </button>
                    {error && <p className="ui-error">{error}</p>}
                </form>
            </div>
        </div>
    );
}

export default Register;