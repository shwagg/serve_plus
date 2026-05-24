import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, sendEmailVerification, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebaseConfig";
import { doc, setDoc, collection, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { VisibilityIcon, VisibilityOffIcon } from "../components/icons";
import servePlusIcon from "../assets/serve_plus_icon.svg";
import loginPosterGif from "../assets/login_poster_loop.gif";
import loginPosterFallback from "../assets/login_poster_img.svg";
import "../styles/ui.css";
import { isAllowedEmailDomain, normalizeEmail } from "../utils/emailPolicy";

function Register() {
    const [firstName, setFirstName] = useState("");
    const [middleInitial, setMiddleInitial] = useState("");
    const [lastName, setLastName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [confirmPasswordError, setConfirmPasswordError] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState(null); // null | "checking" | "taken" | "available"
    const navigate = useNavigate();

    const handleUsernameBlur = async () => {
        const input = username.trim();
        if (!input) { setUsernameStatus(null); return; }
        setUsernameStatus("checking");
        try {
            const snap = await getDocs(query(collection(db, "users"), where("username", "==", input)));
            setUsernameStatus(snap.empty ? "available" : "taken");
        } catch {
            setUsernameStatus(null);
        }
    };

    const registerSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (password !== confirmPassword) {
            setConfirmPasswordError("Passwords do not match.");
            setLoading(false);
            return;
        }

        // Password strength validation
        const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+=\-[\]{};':"\\|,.<>/?]).{8,}$/;
        if (!pwRegex.test(password)) {
            setError("Password must be at least 8 characters and include an uppercase letter, a number, and a symbol (e.g., !@#$).");
            setLoading(false);
            return;
        }

        const normalizedEmail = normalizeEmail(email);
        if (!isAllowedEmailDomain(normalizedEmail)) {
            setError("Please use an accepted email address.");
            setLoading(false);
            return;
        }

        try {
            // Check username uniqueness
            const usernameSnap = await getDocs(query(collection(db, "users"), where("username", "==", username.trim())));
            if (!usernameSnap.empty) {
                setError("Username is already taken. Please choose another.");
                setLoading(false);
                return;
            }

            const validateRegistrationEmail = httpsCallable(functions, "validateRegistrationEmail");
            await validateRegistrationEmail({ email: normalizedEmail });

            // 1. Create user in Firebase Auth
            const userCred = await createUserWithEmailAndPassword(
                auth,
                normalizedEmail,
                password,
            );
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
                    console.log('Event:', data.title, 'Date:', data.targetDate, 'Status:', data.status);

                    if (data.targetDate && (data.status === 'published' || !data.status)) {
                        let eventDate;
                        if (data.targetDate) {
                            eventDate = new Date(data.targetDate);
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

            const fullName = [firstName.trim(), middleInitial.trim() ? middleInitial.trim().toUpperCase() : null, lastName.trim()]
                .filter(Boolean).join(" ");

            await setDoc(doc(db, "users", uid), {
                uid,
                name: fullName,
                username,
                email: normalizedEmail,
                emailVerified: false,
                emailVerificationPending: true,
                emailVerificationSentAt: serverTimestamp(),
                role: "student", // Default role for new registrations
                status: "active",
                authProvider: "password",
                hasServePassword: true,
                createdAt: new Date(),
                avatar: "",
                totalPoints: 0,
                level: 1,
                levelProgress: 0,
                skills: ["React", "Firebase", "UI/UX"],
                interests: ["Design", "Coding", "Music"],
                eventHistory,
                termsAccepted: false,
                privacyAccepted: false,
                agreementVersion: null,
            });

            await sendEmailVerification(userCred.user);
            await signOut(auth);

            // 4. Redirect to login
            alert("Account created! Check your email to verify your account before logging in.");
            navigate("/auth", { replace: true });
        } catch (err) {
            console.error(err);
            setError(err.message || "Registration failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-split">
                {/* Left: poster */}
                <div className="auth-poster-panel">
                    <img src={loginPosterGif} alt="SERVE+ illustration" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = loginPosterFallback; }} />
                </div>

                {/* Right: form */}
                <div className="auth-form-panel">
                    <form className="ui-form auth-login-form" onSubmit={registerSubmit}>
                        <div className="auth-logo-row">
                            <img src={servePlusIcon} alt="SERVE+" className="auth-logo-icon" />
                            <span className="auth-logo-text">
                                SERVE<span className="auth-logo-plus">+</span>
                            </span>
                        </div>

                        <p className="ui-link" style={{ margin: "2px 0 10px" }}>
                            Already have an account?{" "}
                            <Link to="/auth">Login here</Link>
                        </p><br />

                        <div className="reg-name-row">
                            <input
                                className="ui-input"
                                type="text"
                                placeholder="First Name"
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                            <input
                                className="ui-input"
                                type="text"
                                placeholder="Last Name"
                                onChange={(e) => setLastName(e.target.value)}
                                required
                            />
                            <input
                                className="ui-input reg-mi"
                                type="text"
                                placeholder="M.I."
                                maxLength={1}
                                onChange={(e) => setMiddleInitial(e.target.value)}
                            />
                        </div>

                        <div style={{ width: "85%", maxWidth: 420 }}>
                            <div className={`ui-input-prefix-wrap${usernameStatus === "taken" ? " ui-input--error" : ""}`}>
                                <span className="ui-input-prefix">@</span>
                                <input
                                    className="ui-input-bare"
                                    type="text"
                                    placeholder="Username"
                                    onChange={(e) => { setUsername(e.target.value); setUsernameStatus(null); }}
                                    onBlur={handleUsernameBlur}
                                    required
                                />
                            </div>
                            {usernameStatus === "taken" && (
                                <p className="field-hint error">Username has already been used.</p>
                            )}
                        </div>

                        <input
                            className="ui-input"
                            style={{ width: "85%", maxWidth: 420, boxSizing: "border-box" }}
                            type="email"
                            placeholder="Email"
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />

                        <div className="ui-input-pass-wrap" style={{ width: "85%", maxWidth: 420 }}>
                            <input
                                className="ui-input pass"
                                style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
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

                        <div style={{ width: "85%", maxWidth: 420 }}>
                            <div className="ui-input-pass-wrap" style={{ maxWidth: "100%" }}>
                                <input
                                    className={`ui-input pass${confirmPasswordError ? " ui-input--error" : ""}`}
                                    style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="Confirm Password"
                                    onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(""); }}
                                    onBlur={() => {
                                        if (confirmPassword && confirmPassword !== password) {
                                            setConfirmPasswordError("Passwords do not match.");
                                        } else {
                                            setConfirmPasswordError("");
                                        }
                                    }}
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
                            {confirmPasswordError && (
                                <p className="field-hint error">{confirmPasswordError}</p>
                            )}
                            <br />
                        </div>
                        

                        <button className="auth-login-btn" type="submit" disabled={loading}>
                            {loading ? "Creating Account..." : "Create Account"}
                        </button>
                        {error && <p className="ui-error" style={{ textAlign: "center" }}>{error}</p>}
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Register;