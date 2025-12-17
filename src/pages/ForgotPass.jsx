import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebaseConfig";
import "../styles/forgotpass.css";
//Firebase WILL HOST the change of password using the link sent via user's email. No need to code that here. This way it makes our app more secured than creating our own page for that.

function ForgotPassword() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [sent, setSent] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [cooldown, setCooldown] = useState(0); //seconds countdown for when resending link again (making button disabled)

    /*For the countdown*/
    useEffect(() => {
        if (cooldown === 0) return;

        const timer = setInterval(() => {
            setCooldown((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [cooldown]);

    const handleReset = async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        try {
            await sendPasswordResetEmail(auth, email);
            setSent(true);
            setMessage("We emailed you a reset link.");
        } catch (err) {
            console.error(err);
            setError("Unable to send reset link. Please try again.");
        }
    };

    //for when resending link again
    const handleResend = async () => {
        if (cooldown > 0) return; //prevents spamming
        setError("");
        setMessage("");

        try {
            await sendPasswordResetEmail(auth, email);
            setMessage("New reset link has been sent.");
            setCooldown(30); //30 seconds

        } catch (err) {
            console.error(err);
            setError("Unable to resend reset link.\nPlease try again");
        }
    };

    return (
        <div className="ui-container">
            <div className="ui-card">
                <form className="ui-form" onSubmit={handleReset}>

                    {/*This is a conditional layout design. Different design if link is sent or when yet to be sent*/}
                    {/*Before link is sent via email -- ui*/}
                    {!sent && (
                        <>
                            <h2 className="ui-title">Forgot Password<span className="ui-title-plus">?</span></h2>
                            <p
                                className="forgot-smallText"
                            >
                                Enter the email address you used when you joined <br />
                                SERVE+ and we'll send you a link to reset your password.
                            </p>
                            <input
                                className="ui-input"
                                type="email"
                                placeholder="Email Address"
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            {error && <p className="ui-error">{error}</p>}

                            <button className="ui-btn" type="submit">
                                Send reset link
                            </button>

                            <p className="ui-smallText">
                                <Link to="/">Back to Login</Link>
                            </p>
                        </>
                    )}

                    {/*After link is sent via email --ui*/}
                    {sent && (
                        <>
                            <span className="ui-icon">📩</span>
                            <h2 className="ui-title">Check your email</h2>
                            {message && <p className="forgot-message">{message}</p>}
                            {error && <p className="forgot-message" style={{ color: "#dc2626" }}>{error}</p>}

                            <p className="forgot-description">
                                If you don't see it within a few minutes, check your <br />Spam/Junk folder.
                            </p>

                            <button
                                className="ui-btn"
                                type="button"
                                onClick={() => navigate("/", { replace: true })}
                            >
                                Back to Login
                            </button>
                            <p
                                className="forgot-resend"
                                role="button"
                                tabIndex={cooldown === 0 ? 0 : -1}
                                onClick={cooldown === 0 ? handleResend : undefined}
                            >
                                {cooldown > 0
                                    ? `Resend available in ${cooldown}s`
                                    : "Resend link"}
                            </p>
                        </>
                    )}
                </form>
            </div>
        </div >
    );
}

export default ForgotPassword;
