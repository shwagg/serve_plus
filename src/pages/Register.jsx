import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../firebaseConfig";
import { doc, setDoc } from "firebase/firestore";
import "../styles/Register.css";

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
        <div className="register-container">
            <div className="register-card">
                <form className="register-form" onSubmit={registerSubmit}>
                    <h2 className="register-title">
                        SIGN UP <span className="register-title-to">to</span> SERVE<span className="register-title-plus">+</span>
                    </h2>

                    {/* Link to Login Page if account exists */}
                    <p className="register-loginLink">
                        Already have an account?{" "}
                        <Link to="/">Login here</Link>
                    </p>

                    <input
                        className="register-input"
                        type="text"
                        placeholder="Name"
                        onChange={(e) => setName(e.target.value)}
                        required
                    />

                    <input
                        className="register-input"
                        type="text"
                        placeholder="Username"
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />

                    <input
                        className="register-input"
                        type="email"
                        placeholder="Email"
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />

                    <input
                        className="register-input"
                        type="password"
                        placeholder="Password"
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />

                    <input
                        className="register-input"
                        type="password"
                        placeholder="Confirm Password"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <button className="register-btn" type="submit" disabled={loading}>
                        {loading ? "Creating Account..." : "CREATE ACCOUNT"}
                    </button>
                    {error && <p className="register-error" style={{ color: "red" }}>{error}</p>}
                </form>
            </div>
        </div>
    );
}

export default Register;