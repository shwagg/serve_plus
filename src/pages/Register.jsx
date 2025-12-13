import { useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Register.css";

function Register() {
    const [name, setName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");



    const registerSubmit = (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            alert("Passwords do not match");
            return;
        }

        console.log(name, username, email, password);
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
                    <button className="register-btn" type="submit">CREATE ACCOUNT</button>
                </form>
            </div>
        </div>
    );
}

export default Register;