import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

function Register() {
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const registerSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        try {
            // 1. Create user in Firebase Auth
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCred.user.uid;

            // 2. Create user profile in Firestore
            await setDoc(doc(db, "users", uid), {
                uid,
                name,
                username,
                email,
                role: "student", // Default role for new registrations
                status: "active",
                createdAt: new Date(),
            });

            // 3. Redirect to login
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
                        <Link to="/">Login here</Link>
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

                    <input
                        className="ui-input"
                        type="password"
                        placeholder="Password"
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <input
                        className="ui-input"
                        type="password"
                        placeholder="Confirm Password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <button className="ui-btn" type="submit" disabled={loading}>
                        {loading ? "Creating Account..." : "CREATE ACCOUNT"}
                    </button>
                    {error && <p className="ui-error">{error}</p>}
                </form>
            </div>
        </div>
    );
}

export default Register;