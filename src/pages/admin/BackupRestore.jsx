import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useState } from "react";
import { functions } from "../../firebaseConfig";
import "../../styles/BackupRestore.css";

export default function BackupRestore() {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // backupId or "create"
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [label, setLabel] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchBackups = useCallback(async ({ resetState = true } = {}) => {
    if (resetState) {
      setLoading(true);
      setError("");
    }
    try {
      const listBackupsFn = httpsCallable(functions, "listBackups");
      const result = await listBackupsFn();
      setBackups(result.data.backups || []);
    } catch (err) {
      setError("Failed to load backups. " + (err.message || ""));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      fetchBackups({ resetState: false });
    });
  }, [fetchBackups]);

  const handleCreateBackup = async () => {
    setActionLoading("create");
    setError("");
    setSuccess("");
    try {
      const createBackupFn = httpsCallable(functions, "createBackup");
      const result = await createBackupFn({ label: label || undefined });
      setSuccess(result.data.message);
      setLabel("");
      await fetchBackups();
    } catch (err) {
      setError("Failed to create backup. " + (err.message || ""));
    }
    setActionLoading(null);
  };

  const handleRestore = async (backupId) => {
    setActionLoading(backupId);
    setError("");
    setSuccess("");
    setConfirmRestore(null);
    try {
      const restoreBackupFn = httpsCallable(functions, "restoreBackup");
      const result = await restoreBackupFn({ backupId });
      if (result.data?.success === false) {
        setError(
          "Restore completed with errors. " +
            (result.data.errors || []).join(" "),
        );
      } else {
        setSuccess(result.data.message);
      }
      await fetchBackups();
    } catch (err) {
      setError("Failed to restore backup. " + (err.message || ""));
    }
    setActionLoading(null);
  };

  const handleDelete = async (backupId) => {
    setActionLoading(backupId);
    setError("");
    setSuccess("");
    setConfirmDelete(null);
    try {
      const deleteBackupFn = httpsCallable(functions, "deleteBackup");
      const result = await deleteBackupFn({ backupId });
      setSuccess(result.data.message);
      await fetchBackups();
    } catch (err) {
      setError("Failed to delete backup. " + (err.message || ""));
    }
    setActionLoading(null);
  };

  const formatSize = (bytes) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (isoString) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="admin-outlet">
      {/* Header */}
      <div className="backup-header">
        <div>
          <h2 className="backup-title">Data Backup & Restore</h2>
          <p className="backup-subtitle">
            Manage backups of volunteer and project data. Backups run
            automatically every week, or create one manually anytime.
          </p>
        </div>
      </div>

      {/* Status messages */}
      {error && (
        <div className="backup-alert backup-alert-error">
          <span className="backup-alert-icon">⚠</span>
          {error}
          <button className="backup-alert-close" onClick={() => setError("")}>
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="backup-alert backup-alert-success">
          <span className="backup-alert-icon">✓</span>
          {success}
          <button className="backup-alert-close" onClick={() => setSuccess("")}>
            ×
          </button>
        </div>
      )}

      {/* Create Backup Section */}
      <div className="backup-create-section">
        <div className="backup-create-card">
          <div className="backup-create-left">
            <span className="backup-create-icon">🛡️</span>
            <div>
              <h3 className="backup-create-title">Create Manual Backup</h3>
              <p className="backup-create-desc">
                Back up all volunteer accounts, project data, events,
                announcements, documents, audit logs, and Firebase
                Authentication users.
              </p>
            </div>
          </div>
          <div className="backup-create-right">
            <input
              type="text"
              className="backup-label-input"
              placeholder="Backup label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={actionLoading === "create"}
            />
            <button
              className="backup-btn backup-btn-primary"
              onClick={handleCreateBackup}
              disabled={actionLoading === "create"}
            >
              {actionLoading === "create" ? (
                <span className="backup-spinner" />
              ) : null}
              {actionLoading === "create" ? "Creating..." : "Create Backup"}
            </button>
          </div>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="backup-schedule-info">
        <span className="backup-schedule-icon">🕐</span>
        <span>
          <strong>Automatic backups</strong> run every{" "}
          <strong>Sunday at 2:00 AM (PHT)</strong>. They appear in the list
          below alongside manual backups.
        </span>
      </div>

      {/* Backup List */}
      <div className="backup-list-section">
        <div className="backup-list-header">
          <h3>Backup History</h3>
          <button
            className="backup-btn backup-btn-secondary"
            onClick={fetchBackups}
            disabled={loading}
          >
            ↻ Refresh
          </button>
        </div>

        {loading ? (
          <div className="backup-loading">
            <span className="backup-spinner backup-spinner-lg" />
            <p>Loading backups...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="backup-empty">
            <p>No backups found. Create your first backup above.</p>
          </div>
        ) : (
          <div className="backup-table-wrapper">
            <table className="backup-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Date Created</th>
                  <th>Created By</th>
                  <th>Documents</th>
                  <th>Size</th>
                  <th>Last Restored</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => (
                  <tr key={backup.backupId}>
                    <td>
                      <div className="backup-label-cell">
                        {backup.backupId?.startsWith("scheduled_") && (
                          <span className="backup-badge backup-badge-auto">
                            Auto
                          </span>
                        )}
                        {backup.backupId?.startsWith("backup_") && (
                          <span className="backup-badge backup-badge-manual">
                            Manual
                          </span>
                        )}
                        <span>{backup.label}</span>
                      </div>
                    </td>
                    <td>{formatDate(backup.createdAt)}</td>
                    <td>{backup.createdByEmail}</td>
                    <td>{backup.totalDocuments?.toLocaleString() ?? "—"}</td>
                    <td>{formatSize(backup.sizeInBytes)}</td>
                    <td>
                      {backup.lastRestoredAt
                        ? formatDate(backup.lastRestoredAt)
                        : "Never"}
                    </td>
                    <td>
                      <div className="backup-actions">
                        {/* Restore */}
                        {confirmRestore === backup.backupId ? (
                          <div className="backup-confirm-group">
                            <span className="backup-confirm-text">
                              Restore this backup? Users created after this
                              backup will be removed from Auth.
                            </span>
                            <button
                              className="backup-btn backup-btn-confirm"
                              onClick={() => handleRestore(backup.backupId)}
                              disabled={actionLoading === backup.backupId}
                            >
                              {actionLoading === backup.backupId
                                ? "Restoring..."
                                : "Yes, Restore"}
                            </button>
                            <button
                              className="backup-btn backup-btn-cancel"
                              onClick={() => setConfirmRestore(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : confirmDelete === backup.backupId ? (
                          <div className="backup-confirm-group">
                            <span className="backup-confirm-text">
                              Delete permanently?
                            </span>
                            <button
                              className="backup-btn backup-btn-danger"
                              onClick={() => handleDelete(backup.backupId)}
                              disabled={actionLoading === backup.backupId}
                            >
                              {actionLoading === backup.backupId
                                ? "Deleting..."
                                : "Yes, Delete"}
                            </button>
                            <button
                              className="backup-btn backup-btn-cancel"
                              onClick={() => setConfirmDelete(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              className="backup-btn backup-btn-restore"
                              onClick={() => setConfirmRestore(backup.backupId)}
                              disabled={!!actionLoading}
                              title="Restore this backup"
                            >
                              ↩ Restore
                            </button>
                            <button
                              className="backup-btn backup-btn-delete"
                              onClick={() => setConfirmDelete(backup.backupId)}
                              disabled={!!actionLoading}
                              title="Delete this backup"
                            >
                              ✕ Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collections Info */}
      <div className="backup-collections-info">
        <h4>Backed-up Collections</h4>
        <div className="backup-collections-grid">
          {[
            { name: "Users", desc: "Volunteer & staff accounts" },
            { name: "Missions", desc: "CSCEprojects" },
            { name: "Events", desc: "Community events & activities" },
            { name: "Audit Logs", desc: "System activity records" },
            { name: "Announcements", desc: "Global announcements" },
            { name: "Documents", desc: "Uploaded forms & files metadata" },
            {
              name: "Auth Users",
              desc: "Firebase Authentication accounts",
            },
          ].map((col) => (
            <div key={col.name} className="backup-collection-chip">
              <strong>{col.name}</strong>
              <span>{col.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
