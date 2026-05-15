import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { auth, db } from "../firebaseConfig";
import {
  doc, updateDoc, collection, query, where, getDocs,
} from "firebase/firestore";
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from "firebase/auth";
import { useSession } from "../context/SessionContext";
import CertificateQRScannerModal from "./CertificateQRScannerModal";
import { VisibilityIcon, VisibilityOffIcon, CloseIcon } from "./icons";
import "./styles/SettingsModal.css";

const SECTIONS = [
  { id: "profile",       icon: "👤", label: "Profile"           },
  { id: "terms",         icon: "📄", label: "Terms & Privacy"   },
  { id: "notifications", icon: "🔔", label: "Notifications"     },
  { id: "certificate",   icon: "🏅", label: "Verify Certificate" },
  { id: "audit",         icon: "🕒", label: "Audit Log"         },
];

export default function SettingsModal({ isOpen, onClose }) {
  const { userData, refreshUserData } = useSession();
  const [activeSection, setActiveSection] = useState("profile");
  const [showCertModal, setShowCertModal] = useState(false);

  // Username
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [savingUsername, setSavingUsername] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Notifications
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [savingNotif, setSavingNotif] = useState(false);
  const [announcementsEnabled, setAnnouncementsEnabled] = useState(true);
  const [savingAnnouncements, setSavingAnnouncements] = useState(false);

  // Audit log
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Reset all form state whenever modal opens
  useEffect(() => {
    if (isOpen && userData) {
      setUsername(userData.username || "");
      setNotifEnabled(userData.globalNotificationsEnabled !== false);
      setAnnouncementsEnabled(userData.announcementsEnabled !== false);
      setUsernameError(""); setUsernameSuccess("");
      setPasswordError(""); setPasswordSuccess("");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    }
    if (!isOpen) setActiveSection("profile");
  }, [isOpen, userData]);

  useEffect(() => {
    if (isOpen && activeSection === "audit") fetchAuditLogs();
  }, [isOpen, activeSection]);

  const fetchAuditLogs = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setAuditLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "auditLogs"), where("uid", "==", user.uid))
      );
      const logs = snap.docs
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            action: data.action,
            email: data.email || "",
            timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : null,
          };
        })
        .filter(l => l.action === "LOGIN" || l.action === "LOGOUT")
        .sort((a, b) => {
          const ta = a.timestamp ? a.timestamp.getTime() : 0;
          const tb = b.timestamp ? b.timestamp.getTime() : 0;
          return tb - ta;
        })
        .slice(0, 5);
      setAuditLogs(logs);
    } catch {
      setAuditLogs([]);
    }
    setAuditLoading(false);
  };

  const handleSaveUsername = async () => {
    setUsernameError(""); setUsernameSuccess("");
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) { setUsernameError("Username cannot be empty."); return; }
    if (!/^[a-z0-9._]{3,20}$/.test(trimmed)) {
      setUsernameError("3–20 characters: letters, numbers, . or _");
      return;
    }
    if (trimmed === userData?.username) {
      setUsernameError("That's already your current username.");
      return;
    }
    setSavingUsername(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where("username", "==", trimmed))
      );
      if (!snap.empty) { setUsernameError("Username is already taken."); return; }
      await updateDoc(doc(db, "users", auth.currentUser.uid), { username: trimmed });
      await refreshUserData();
      setUsernameSuccess("Username updated successfully.");
    } catch {
      setUsernameError("Failed to update username. Please try again.");
    } finally {
      setSavingUsername(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(""); setPasswordSuccess("");
    if (!currentPassword) { setPasswordError("Please enter your current password."); return; }
    const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!pwRegex.test(newPassword)) {
      setPasswordError("Password needs 8+ characters, an uppercase letter, a number, and a symbol.");
      return;
    }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    setSavingPassword(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setPasswordError("Current password is incorrect.");
      } else if (e.code === "auth/requires-recent-login") {
        setPasswordError("Please log out and log back in before changing your password.");
      } else {
        setPasswordError("Failed to change password. Please try again.");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleToggleNotifications = async (val) => {
    setNotifEnabled(val);
    setSavingNotif(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        globalNotificationsEnabled: val,
      });
      await refreshUserData();
    } catch {
      setNotifEnabled(!val);
    } finally {
      setSavingNotif(false);
    }
  };

  const handleToggleAnnouncements = async (val) => {
    setAnnouncementsEnabled(val);
    setSavingAnnouncements(true);
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        announcementsEnabled: val,
      });
      await refreshUserData();
    } catch {
      setAnnouncementsEnabled(!val);
    } finally {
      setSavingAnnouncements(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "—";
    return date.toLocaleString("en-US", {
      month: "short", day: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const hasPasswordProvider = auth.currentUser?.providerData?.some(
    p => p.providerId === "password"
  );

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-modal" onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="settings-header">
            <span className="settings-title">⚙️ Settings</span>
            <button className="settings-close" onClick={onClose} aria-label="Close settings">
              <CloseIcon style={{ fontSize: 16 }} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="settings-body">

            {/* Left sidebar nav */}
            <nav className="settings-nav">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  className={`settings-nav-item${activeSection === s.id ? " active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                >
                  <span className="settings-nav-icon">{s.icon}</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </nav>

            {/* Right content */}
            <div className="settings-content">

              {/* ── Profile ── */}
              {activeSection === "profile" && (
                <div className="settings-section">
                  <h2 className="settings-section-title">Profile</h2>
                  <p className="settings-desc">
                    Update your display username and account password.
                  </p>

                  {/* Username */}
                  <div className="settings-group">
                    <label className="settings-label">Username</label>
                    <div className="settings-input-row">
                      <div className="ui-input-prefix-wrap">
                        <span className="ui-input-prefix">@</span>
                        <input
                          className="ui-input-bare"
                          value={username}
                          onChange={e => {
                            setUsername(e.target.value);
                            setUsernameError(""); setUsernameSuccess("");
                          }}
                          placeholder="username"
                          maxLength={20}
                        />
                      </div>
                      <button
                        className="settings-save-btn"
                        onClick={handleSaveUsername}
                        disabled={savingUsername}
                      >
                        {savingUsername ? "Saving…" : "Save"}
                      </button>
                    </div>
                    {usernameError && <p className="ui-error">{usernameError}</p>}
                    {usernameSuccess && <p className="ui-success">{usernameSuccess}</p>}
                  </div>

                  <div className="settings-divider" />

                  {/* Password */}
                  <div className="settings-group">
                    <label className="settings-label">Change Password</label>

                    {!hasPasswordProvider ? (
                      <div className="settings-sso-notice">
                        Your account uses Blackboard SSO. Password changes are managed
                        through Blackboard.
                      </div>
                    ) : (
                      <>
                        <div className="ui-input-pass-wrap">
                          <input
                            className="ui-input pass"
                            style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                            type={showCurrentPw ? "text" : "password"}
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={e => {
                              setCurrentPassword(e.target.value);
                              setPasswordError(""); setPasswordSuccess("");
                            }}
                          />
                          <button
                            type="button"
                            className="ui-btn eye"
                            onClick={() => setShowCurrentPw(v => !v)}
                            tabIndex={-1}
                          >
                            {showCurrentPw ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </button>
                        </div>

                        <div className="ui-input-pass-wrap" style={{ marginTop: 8 }}>
                          <input
                            className="ui-input pass"
                            style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                            type={showNewPw ? "text" : "password"}
                            placeholder="New password"
                            value={newPassword}
                            onChange={e => {
                              setNewPassword(e.target.value);
                              setPasswordError(""); setPasswordSuccess("");
                            }}
                          />
                          <button
                            type="button"
                            className="ui-btn eye"
                            onClick={() => setShowNewPw(v => !v)}
                            tabIndex={-1}
                          >
                            {showNewPw ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </button>
                        </div>

                        <div className="ui-input-pass-wrap" style={{ marginTop: 8 }}>
                          <input
                            className="ui-input pass"
                            style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                            type={showConfirmPw ? "text" : "password"}
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={e => {
                              setConfirmPassword(e.target.value);
                              setPasswordError(""); setPasswordSuccess("");
                            }}
                          />
                          <button
                            type="button"
                            className="ui-btn eye"
                            onClick={() => setShowConfirmPw(v => !v)}
                            tabIndex={-1}
                          >
                            {showConfirmPw ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </button>
                        </div>

                        {passwordError && (
                          <p className="ui-error" style={{ marginTop: 4 }}>{passwordError}</p>
                        )}
                        {passwordSuccess && (
                          <p className="ui-success" style={{ marginTop: 4 }}>{passwordSuccess}</p>
                        )}

                        <button
                          className="settings-primary-btn"
                          style={{ marginTop: 14 }}
                          onClick={handleChangePassword}
                          disabled={savingPassword}
                        >
                          {savingPassword ? "Changing…" : "Change Password"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ── Terms & Privacy ── */}
              {activeSection === "terms" && (
                <div className="settings-section">
                  <h2 className="settings-section-title">Terms & Privacy</h2>
                  <p className="settings-desc">
                    Review the agreements you accepted when joining SERVE+.
                  </p>
                  <div className="settings-terms-links">
                    <a
                      href="/global/terms-condition"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="settings-terms-btn"
                    >
                      📄 Terms of Service
                    </a>
                    <a
                      href="/global/privacy-policy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="settings-terms-btn"
                    >
                      🔒 Privacy Policy
                    </a>
                  </div>
                  {(userData?.termsAccepted || userData?.privacyAccepted) && (
                    <p className="settings-accepted-note">
                      ✅ You have accepted the Terms of Service and Privacy Policy.
                    </p>
                  )}
                </div>
              )}

              {/* ── Notifications ── */}
              {activeSection === "notifications" && (
                <div className="settings-section">
                  <h2 className="settings-section-title">Notifications</h2>
                  <p className="settings-desc">
                    Control whether in-app notifications and alerts are shown to you.
                  </p>
                  <div className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Notification Bell</p>
                      <p className="settings-toggle-sublabel">
                        When off, the unread count badge is hidden from the bell
                      </p>
                    </div>
                    <div
                      className={`settings-toggle${notifEnabled ? " on" : ""}`}
                      role="switch"
                      aria-checked={notifEnabled}
                      tabIndex={0}
                      onClick={() => !savingNotif && handleToggleNotifications(!notifEnabled)}
                      onKeyDown={e => e.key === "Enter" || e.key === " " ? handleToggleNotifications(!notifEnabled) : null}
                      aria-label={notifEnabled ? "Disable notification bell" : "Enable notification bell"}
                    >
                      <span className="settings-toggle-thumb" />
                    </div>
                  </div>

                  <div className="settings-divider" />

                  <div className="settings-toggle-row">
                    <div>
                      <p className="settings-toggle-label">Community Updates</p>
                      <p className="settings-toggle-sublabel">
                        When off, the 📢 announcements button is hidden from the page
                      </p>
                    </div>
                    <div
                      className={`settings-toggle${announcementsEnabled ? " on" : ""}`}
                      role="switch"
                      aria-checked={announcementsEnabled}
                      tabIndex={0}
                      onClick={() => !savingAnnouncements && handleToggleAnnouncements(!announcementsEnabled)}
                      onKeyDown={e => e.key === "Enter" || e.key === " " ? handleToggleAnnouncements(!announcementsEnabled) : null}
                      aria-label={announcementsEnabled ? "Hide community updates" : "Show community updates"}
                    >
                      <span className="settings-toggle-thumb" />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Verify Certificate ── */}
              {activeSection === "certificate" && (
                <div className="settings-section">
                  <h2 className="settings-section-title">Verify Certificate</h2>
                  <p className="settings-desc">
                    Scan a QR code or enter a certificate ID to verify the authenticity
                    of a SERVE+ certificate.
                  </p>
                  <button
                    className="settings-primary-btn"
                    onClick={() => setShowCertModal(true)}
                  >
                    Open Certificate Scanner
                  </button>
                </div>
              )}

              {/* ── Audit Log ── */}
              {activeSection === "audit" && (
                <div className="settings-section">
                  <h2 className="settings-section-title">Audit Log</h2>
                  <p className="settings-desc">
                    Your 5 most recent login and logout events for this account.
                  </p>
                  {auditLoading ? (
                    <p className="settings-loading">Loading…</p>
                  ) : auditLogs.length === 0 ? (
                    <p className="settings-empty">No activity records found.</p>
                  ) : (
                    <div className="settings-audit-list">
                      {auditLogs.map((log, i) => (
                        <div key={log.id || i} className="settings-audit-item">
                          <div className="settings-audit-left">
                            <span
                              className={`settings-audit-badge ${
                                log.action === "LOGIN" ? "login" : "logout"
                              }`}
                            >
                              {log.action}
                            </span>
                            <span className="settings-audit-email">
                              {log.email || userData?.email || "—"}
                            </span>
                          </div>
                          <span className="settings-audit-time">
                            {formatDate(log.timestamp)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <CertificateQRScannerModal
        isOpen={showCertModal}
        onClose={() => setShowCertModal(false)}
      />
    </>,
    document.body
  );
}
