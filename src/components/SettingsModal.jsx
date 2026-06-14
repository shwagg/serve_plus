import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import {
  doc, getDoc, updateDoc, collection, query, where, getDocs,
} from "firebase/firestore";
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider, signOut,
} from "firebase/auth";
import { useSession } from "../context/useSession";
import {
  VisibilityIcon, VisibilityOffIcon, CloseIcon,
  Face6RoundedIcon, GavelRoundedIcon, NotificationsNoneRoundedIcon,
  LocalPoliceOutlinedIcon, HistoryOutlinedIcon,
  ArticleOutlinedIcon, FileDownloadOutlinedIcon, PersonOffOutlinedIcon,
} from "./icons";
import { renderAgreementContent } from "../utils/agreementContent";
import "./styles/SettingsModal.css";

const ALL_SECTIONS = [
  { id: "profile",       Icon: Face6RoundedIcon,            label: "Profile",           roles: null },
  { id: "terms",         Icon: GavelRoundedIcon,            label: "Terms & Privacy",   roles: null },
  { id: "notifications", Icon: NotificationsNoneRoundedIcon, label: "Notifications",    roles: null },
  { id: "certificate",   Icon: LocalPoliceOutlinedIcon,     label: "Verify Certificate", roles: null },
  { id: "documents",     Icon: ArticleOutlinedIcon,         label: "Documents",          roles: ["student"] },
  { id: "audit",         Icon: HistoryOutlinedIcon,         label: "Audit Log",         roles: null },
  { id: "deactivate",   Icon: PersonOffOutlinedIcon,       label: "Deactivate Account", roles: null, danger: true },
];

export default function SettingsModal({ isOpen, onClose }) {
  const { userData, refreshUserData } = useSession();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("profile");

  // Username
  const [username, setUsername] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
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

  // Terms & Privacy inline viewer
  const [termsTab, setTermsTab] = useState("terms");
  const [agreementData, setAgreementData] = useState(null);
  const [agreementLoading, setAgreementLoading] = useState(false);

  // Audit log
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Deactivate account
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState("");

  // Reset all form state whenever modal opens
  useEffect(() => {
    if (isOpen && userData) {
      setUsername(userData.username || "");
      setNotifEnabled(userData.globalNotificationsEnabled !== false);
      setAnnouncementsEnabled(userData.announcementsEnabled !== false);
      setUsernameError(""); setUsernameSuccess("");
      setPasswordError(""); setPasswordSuccess("");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setDeactivateConfirmText(""); setDeactivateError("");
    }
    if (!isOpen) { setActiveSection("profile"); setEditingUsername(false); }
  }, [isOpen, userData]);

  useEffect(() => {
    if (isOpen && activeSection === "terms" && !agreementData) fetchAgreementData();
  }, [isOpen, activeSection]);

  useEffect(() => {
    if (isOpen && activeSection === "audit") fetchAuditLogs();
  }, [isOpen, activeSection]);

  const fetchAgreementData = async () => {
    setAgreementLoading(true);
    try {
      const snap = await getDoc(doc(db, "settings", "agreements"));
      if (snap.exists()) setAgreementData(snap.data());
      else setAgreementData({});
    } catch {
      setAgreementData({});
    }
    setAgreementLoading(false);
  };

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

  const handleDeactivateAccount = async () => {
    setDeactivateError("");
    setDeactivating(true);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Not signed in.");
      await updateDoc(doc(db, "users", user.uid), {
        deactivated: true,
        deactivatedAt: new Date(),
        scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
      await signOut(auth);
      onClose();
      navigate("/");
    } catch {
      setDeactivateError("Failed to deactivate account. Please try again.");
    } finally {
      setDeactivating(false);
    }
  };

  const handleSaveUsername = async () => {
    setUsernameError(""); setUsernameSuccess("");
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) { setUsernameError("Username cannot be empty."); return false; }
    if (!/^[a-z0-9._]{3,20}$/.test(trimmed)) {
      setUsernameError("3–20 characters: letters, numbers, . or _");
      return false;
    }
    if (trimmed === userData?.username) {
      setUsernameError("That's already your current username.");
      return false;
    }
    setSavingUsername(true);
    try {
      const snap = await getDocs(
        query(collection(db, "users"), where("username", "==", trimmed))
      );
      if (!snap.empty) { setUsernameError("Username is already taken."); return false; }
      await updateDoc(doc(db, "users", auth.currentUser.uid), { username: trimmed });
      await refreshUserData();
      setUsernameSuccess("Username updated successfully.");
      return true;
    } catch {
      setUsernameError("Failed to update username. Please try again.");
      return false;
    } finally {
      setSavingUsername(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError(""); setPasswordSuccess("");
    if (!isCreatingServePassword && !currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    const pwRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
    if (!pwRegex.test(newPassword)) {
      setPasswordError("Password needs 8+ characters, an uppercase letter, a number, and a symbol.");
      return;
    }
    if (newPassword !== confirmPassword) { setPasswordError("Passwords do not match."); return; }
    setSavingPassword(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        setPasswordError("You need to be signed in to update your password.");
        return;
      }

      if (!isCreatingServePassword) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
      }

      await updatePassword(user, newPassword);
      await updateDoc(doc(db, "users", user.uid), {
        hasServePassword: true,
        updatedAt: new Date(),
      });
      await user.reload?.();
      await refreshUserData();
      setPasswordSuccess(
        isCreatingServePassword
          ? "SERVE+ password created successfully."
          : "Password changed successfully.",
      );
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    } catch (e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") {
        setPasswordError("Current password is incorrect.");
      } else if (e.code === "auth/requires-recent-login") {
        setPasswordError(
          isCreatingServePassword
            ? "Please sign out, sign in with Blackboard again, then create your SERVE+ password."
            : "Please log out and log back in before changing your password.",
        );
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
  const isBlackboardLinked = Boolean(
    userData?.authProvider === "blackboard" ||
      userData?.blackboardId ||
      userData?.blackboardAuthUid
  );
  const hasServePassword = userData?.hasServePassword === true || hasPasswordProvider;
  const isCreatingServePassword = isBlackboardLinked && !hasServePassword;
  const canManagePassword = hasServePassword || isCreatingServePassword;

  const communityUpdatesDisabled = userData?.role === "admin" || userData?.role === "partner" || userData?.role === "sysadmin";

  const sections = ALL_SECTIONS.filter(s => !s.roles || s.roles.includes(userData?.role));

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-modal" onClick={e => e.stopPropagation()}>

          {/* ── Header ── */}
          <div className="settings-header">
            <span className="settings-title">Settings</span>
            <button className="settings-close" onClick={onClose} aria-label="Close settings">
              <CloseIcon style={{ fontSize: 16 }} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="settings-body">

            {/* Left sidebar nav */}
            <nav className="settings-nav">
              {sections.filter(s => !s.danger).map(s => (
                <button
                  key={s.id}
                  className={`settings-nav-item${activeSection === s.id ? " active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                >
                  <s.Icon className="settings-nav-icon" fontSize="small" />
                  <span>{s.label}</span>
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {sections.filter(s => s.danger).map(s => (
                <button
                  key={s.id}
                  className={`settings-nav-item danger${activeSection === s.id ? " active" : ""}`}
                  onClick={() => setActiveSection(s.id)}
                >
                  <s.Icon className="settings-nav-icon" fontSize="small" />
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

                  {/* Blackboard SSO notice */}
                  {!hasPasswordProvider && (
                    <div className="settings-sso-banner">
                      🏫 This account was created by signing in through <strong>Blackboard</strong>.
                      Password changes are managed there.
                    </div>
                  )}

                  {/* Info table */}
                  <div className="settings-info-table">
                    <div className="settings-info-row">
                      <span className="settings-info-key">Name</span>
                      <span className="settings-info-val">{userData?.name || "—"}</span>
                    </div>
                    <div className="settings-info-row">
                      <span className="settings-info-key">Email</span>
                      <span className="settings-info-val">
                        {userData?.email || auth.currentUser?.email || "—"}
                      </span>
                    </div>
                    <div className="settings-info-row">
                      <span className="settings-info-key">Username</span>
                      {editingUsername ? (
                        <div className="settings-username-inline">
                          <div className="ui-input-prefix-wrap settings-username-wrap">
                            <span className="ui-input-prefix">@</span>
                            <input
                              className="ui-input-bare"
                              value={username}
                              onChange={e => {
                                setUsername(e.target.value);
                                setUsernameError(""); setUsernameSuccess("");
                              }}
                              placeholder="new username"
                              maxLength={20}
                              autoFocus
                            />
                          </div>
                          <button
                            className="settings-save-btn"
                            onClick={async () => {
                              const ok = await handleSaveUsername();
                              if (ok) setEditingUsername(false);
                            }}
                            disabled={savingUsername}
                          >
                            {savingUsername ? "Saving…" : "Save"}
                          </button>
                          <button
                            className="settings-cancel-btn"
                            onClick={() => {
                              setEditingUsername(false);
                              setUsername(userData?.username || "");
                              setUsernameError(""); setUsernameSuccess("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="settings-username-view">
                          <span className="settings-info-val" style={{ flex: "none" }}>
                            {userData?.username ? `@${userData.username}` : "—"}
                          </span>
                          <button
                            className="settings-edit-icon-btn"
                            onClick={() => {
                              setUsername(userData?.username || "");
                              setUsernameError(""); setUsernameSuccess("");
                              setEditingUsername(true);
                            }}
                            aria-label="Edit username"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {usernameError && <p className="ui-error" style={{ marginTop: 6 }}>{usernameError}</p>}
                  {usernameSuccess && <p className="ui-success" style={{ marginTop: 6 }}>{usernameSuccess}</p>}

                  <div className="settings-divider" />

                  {/* Password */}
                  <div className="settings-group">
                    <label className="settings-label">
                      {isCreatingServePassword ? "Create SERVE+ Password" : "Change Password"}
                    </label>

                    {!canManagePassword ? (
                      <div className="settings-sso-notice">
                        This account does not currently support SERVE+ password changes.
                      </div>
                    ) : (
                      <>
                        {isCreatingServePassword && (
                          <div className="settings-sso-notice">
                            Your Blackboard account does not have a SERVE+ password yet.
                            Create one here to enable email/password sign-in.
                          </div>
                        )}

                        {!isCreatingServePassword && (
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
                        )}

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
                          {savingPassword
                            ? isCreatingServePassword ? "Creating…" : "Changing…"
                            : isCreatingServePassword ? "Create Password" : "Change Password"}
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
                  {(userData?.termsAccepted || userData?.privacyAccepted) && (
                    <p className="settings-accepted-note" style={{ marginBottom: 14 }}>
                      ✅ You have accepted the Terms of Service and Privacy Policy.
                    </p>
                  )}
                  <div className="settings-agreement-tabs">
                    <button
                      className={`settings-agreement-tab${termsTab === "terms" ? " active" : ""}`}
                      onClick={() => setTermsTab("terms")}
                    >
                      Terms of Service
                    </button>
                    <button
                      className={`settings-agreement-tab${termsTab === "privacy" ? " active" : ""}`}
                      onClick={() => setTermsTab("privacy")}
                    >
                      Privacy Policy
                    </button>
                  </div>
                  <div className="settings-agreement-body">
                    {agreementLoading ? (
                      <p className="settings-loading">Loading…</p>
                    ) : !agreementData ? (
                      <p className="settings-empty">Could not load content.</p>
                    ) : termsTab === "terms" ? (
                      <>
                        {renderAgreementContent(agreementData.termsIntro, {
                          richClassName: "settings-agreement-rich-body",
                          plainClassName: "settings-agreement-intro",
                          preservePlainTextBreaks: true,
                        })}
                        {agreementData.version && (
                          <p className="settings-agreement-version">v{agreementData.version}</p>
                        )}
                        <hr className="settings-agreement-divider" />
                        {(agreementData.termsSections || []).map((s, i) => (
                          <div key={i}>
                            <h3 className="settings-agreement-heading">{s.heading}</h3>
                            {renderAgreementContent(s.body, {
                              richClassName: "settings-agreement-rich-body",
                            })}
                          </div>
                        ))}
                      </>
                    ) : (
                      <>
                        {renderAgreementContent(agreementData.privacyIntro, {
                          richClassName: "settings-agreement-rich-body",
                          plainClassName: "settings-agreement-intro",
                          preservePlainTextBreaks: true,
                        })}
                        {agreementData.version && (
                          <p className="settings-agreement-version">v{agreementData.version}</p>
                        )}
                        <hr className="settings-agreement-divider" />
                        {(agreementData.privacySections || []).map((s, i) => (
                          <div key={i}>
                            <h3 className="settings-agreement-heading">{s.heading}</h3>
                            {renderAgreementContent(s.body, {
                              richClassName: "settings-agreement-rich-body",
                            })}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
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
                        Toggle off to hide the bell's count badge.
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

                  <div className={`settings-toggle-row${communityUpdatesDisabled ? " disabled" : ""}`}>
                    <div>
                      <p className="settings-toggle-label">Community Updates</p>
                      <p className="settings-toggle-sublabel">
                        {communityUpdatesDisabled
                          ? "Not available for this account type"
                          : "Toggle off to hide 📢 announcement button."
                        }
                      </p>
                    </div>
                    <div
                      className={`settings-toggle${announcementsEnabled ? " on" : ""}`}
                      role="switch"
                      aria-checked={announcementsEnabled}
                      tabIndex={communityUpdatesDisabled ? -1 : 0}
                      onClick={() => !communityUpdatesDisabled && !savingAnnouncements && handleToggleAnnouncements(!announcementsEnabled)}
                      onKeyDown={e => !communityUpdatesDisabled && (e.key === "Enter" || e.key === " ") ? handleToggleAnnouncements(!announcementsEnabled) : null}
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
                    onClick={() => { onClose(); navigate("/verify-certificate"); }}
                  >
                    Open Certificate Scanner
                  </button>
                </div>
              )}

              {/* ── Documents ── */}
              {activeSection === "documents" && (
                <div className="settings-section">
                  <h2 className="settings-section-title">Documents</h2>
                  <p className="settings-desc">
                    Download official SERVE+ forms and export your volunteer portfolio.
                  </p>
                  <div className="settings-doc-list">
                    <a
                      href="/assets/Activity Information and Consent Form.pdf"
                      download="Activity Information and Consent Form.pdf"
                      className="settings-doc-item"
                    >
                      <ArticleOutlinedIcon className="settings-doc-icon" />
                      <div className="settings-doc-info">
                        <p className="settings-doc-name">Activity Consent Form</p>
                        <p className="settings-doc-desc">Blank consent form for SERVE+ activities</p>
                      </div>
                      <FileDownloadOutlinedIcon className="settings-doc-action" />
                    </a>
                    <button
                      className="settings-doc-item"
                      onClick={() => { onClose(); navigate("/profile"); }}
                    >
                      <ArticleOutlinedIcon className="settings-doc-icon" />
                      <div className="settings-doc-info">
                        <p className="settings-doc-name">Volunteer Portfolio</p>
                        <p className="settings-doc-desc">Export your portfolio as PDF from your Profile page</p>
                      </div>
                      <FileDownloadOutlinedIcon className="settings-doc-action" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Deactivate Account ── */}
              {activeSection === "deactivate" && (
                <div className="settings-section">
                  <h2 className="settings-section-title">Deactivate Account</h2>
                  <p className="settings-desc">
                    This will deactivate your account and schedule it for permanent deletion.
                  </p>

                  <div className="settings-deactivate-warning">
                    <p className="settings-deactivate-warning-title">Before you continue</p>
                    <ul className="settings-deactivate-warning-list">
                      <li>Your account will be <strong>immediately deactivated</strong> and you will be signed out.</li>
                      <li>You have <strong>30 days</strong> to contact support and recover your account.</li>
                      <li>After 30 days, your account and all associated data will be <strong>permanently deleted</strong> and cannot be recovered.</li>
                    </ul>
                  </div>

                  <div className="settings-divider" />

                  <div className="settings-group">
                    <label className="settings-label">Confirm deactivation</label>
                    <p className="settings-deactivate-confirm-hint">
                      Type <strong>DEACTIVATE</strong> below to continue.
                    </p>
                    <input
                      className="ui-input"
                      style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}
                      type="text"
                      placeholder="DEACTIVATE"
                      value={deactivateConfirmText}
                      onChange={e => { setDeactivateConfirmText(e.target.value); setDeactivateError(""); }}
                      autoComplete="off"
                    />
                    {deactivateError && (
                      <p className="ui-error" style={{ marginTop: 4 }}>{deactivateError}</p>
                    )}
                    <button
                      className="settings-danger-btn"
                      style={{ marginTop: 14 }}
                      onClick={handleDeactivateAccount}
                      disabled={deactivateConfirmText !== "DEACTIVATE" || deactivating}
                    >
                      {deactivating ? "Deactivating…" : "Deactivate My Account"}
                    </button>
                  </div>
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

    </>,
    document.body
  );
}
