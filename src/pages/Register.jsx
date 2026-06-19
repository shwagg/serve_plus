import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword, deleteUser, sendEmailVerification, signOut } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions } from "../firebaseConfig";
import { doc, setDoc, collection, getDocs, query, where, serverTimestamp, deleteDoc } from "firebase/firestore";
import { VisibilityIcon, VisibilityOffIcon } from "../components/icons";
import servePlusIcon from "../assets/serve_plus_icon.svg";
import "../styles/ui.css";
import { isAllowedEmailDomain, normalizeEmail } from "../utils/emailPolicy";

const isEmulator = import.meta.env.VITE_USE_EMULATORS === "true";
const NAME_REGEX = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const MIDDLE_INITIAL_REGEX = /^[A-Za-z]$/;
const USERNAME_REGEX = /^(?=.*[a-z0-9])[a-z0-9._]{3,20}$/;

function capitalizeName(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function getRegistrationErrorMessage(err) {
    if (err?.code === "auth/invalid-sender") {
        return "Registration email could not be sent because Firebase Authentication has an invalid sender email configured. Please contact the administrator.";
    }

    return err?.message || "Registration failed. Please try again.";
}

function validateRegistrationFields({ firstName, middleInitial, lastName, username }) {
    const trimmedFirstName = firstName.trim();
    const trimmedMiddleInitial = middleInitial.trim();
    const trimmedLastName = lastName.trim();
    const normalizedUsername = username.trim().toLowerCase();

    if (!NAME_REGEX.test(trimmedFirstName)) {
        return {
            message: "First name can only contain letters, spaces, apostrophes, or hyphens.",
        };
    }

    if (!NAME_REGEX.test(trimmedLastName)) {
        return {
            message: "Last name can only contain letters, spaces, apostrophes, or hyphens.",
        };
    }

    if (trimmedMiddleInitial && !MIDDLE_INITIAL_REGEX.test(trimmedMiddleInitial)) {
        return {
            message: "Middle initial must be a single letter.",
        };
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
        return {
            message: "Username must be 3-20 characters and can only contain letters, numbers, . or _.",
        };
    }

    return {
        normalizedFirstName: capitalizeName(trimmedFirstName),
        normalizedMiddleInitial: trimmedMiddleInitial.toUpperCase(),
        normalizedLastName: capitalizeName(trimmedLastName),
        normalizedUsername,
    };
}

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
        const input = username.trim().toLowerCase();
        if (!input) { setUsernameStatus(null); return; }
        if (!USERNAME_REGEX.test(input)) { setUsernameStatus(null); return; }
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

        const fieldValidation = validateRegistrationFields({
            firstName,
            middleInitial,
            lastName,
            username,
        });

        if (fieldValidation.message) {
            setError(fieldValidation.message);
            setLoading(false);
            return;
        }

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

        let createdUser = null;
        let createdUserDocRef = null;
        let verificationEmailSent = false;

        try {
            // Check username uniqueness
            const usernameSnap = await getDocs(query(collection(db, "users"), where("username", "==", fieldValidation.normalizedUsername)));
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
            createdUser = userCred.user;
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

            const fullName = [
                fieldValidation.normalizedFirstName,
                fieldValidation.normalizedMiddleInitial ? fieldValidation.normalizedMiddleInitial.toUpperCase() : null,
                fieldValidation.normalizedLastName,
            ]
                .filter(Boolean).join(" ");

            createdUserDocRef = doc(db, "users", uid);
            await setDoc(createdUserDocRef, {
                uid,
                name: fullName,
                username: fieldValidation.normalizedUsername,
                email: normalizedEmail,
                emailVerified: isEmulator,
                emailVerificationPending: !isEmulator,
                ...(isEmulator ? {} : { emailVerificationSentAt: serverTimestamp() }),
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

            if (!isEmulator) {
                await sendEmailVerification(userCred.user);
                verificationEmailSent = true;
            }
            await signOut(auth);

            // 4. Redirect to login
            alert(isEmulator
                ? "Account created! (Emulator: email verification skipped)"
                : "Account created! Check your email to verify your account before logging in."
            );
            navigate("/auth", { replace: true });
        } catch (err) {
            console.error(err);
            if (createdUser && !verificationEmailSent) {
                try {
                    if (createdUserDocRef) await deleteDoc(createdUserDocRef);
                    await deleteUser(createdUser);
                } catch (cleanupErr) {
                    console.warn("Could not clean up failed registration:", cleanupErr);
                }

                try {
                    await signOut(auth);
                } catch {
                    // Sign-out cleanup is best effort after a failed registration.
                }
            }

            setError(getRegistrationErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-split">
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
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                onBlur={() => setFirstName(capitalizeName(firstName))}
                                required
                            />
                            <input
                                className="ui-input"
                                type="text"
                                placeholder="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                onBlur={() => setLastName(capitalizeName(lastName))}
                                required
                            />
                            <input
                                className="ui-input reg-mi"
                                type="text"
                                placeholder="M.I."
                                maxLength={1}
                                value={middleInitial}
                                onChange={(e) => setMiddleInitial(e.target.value)}
                                onBlur={() => setMiddleInitial(middleInitial.trim().toUpperCase())}
                            />
                        </div>

                        <div style={{ width: "85%", maxWidth: 420 }}>
                            <div className={`ui-input-prefix-wrap${usernameStatus === "taken" ? " ui-input--error" : ""}`}>
                                <span className="ui-input-prefix">@</span>
                                <input
                                    className="ui-input-bare"
                                    type="text"
                                    placeholder="Username"
                                    value={username}
                                    maxLength={20}
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
