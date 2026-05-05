import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc, } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { showToast, showConfirm } from "../../utils/toast";
import { logAudit } from "../../utils/auditLogger";

import "../../styles/admin.css";

export default function ProjectTasks() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    enrollmentDeadline: "",
    points: 0,
    type: "individual",
    maxParticipants: 5,
  });

  // Load project info
  useEffect(() => {
    const loadProject = async () => {
      try {
        const projectRef = doc(db, "missions", projectId);
        const snap = await getDoc(projectRef);
        if (snap.exists()) {
          setProject({ id: snap.id, ...snap.data() });
        }
      } catch (e) {
        console.error("Error loading project:", e);
      }
    };
    loadProject();
  }, [projectId]);

  // Load tasks
  const loadTasks = async () => {
    setLoading(true);
    try {
      const tasksRef = collection(db, "missions", projectId, "task");
      const snap = await getDocs(tasksRef);
      const taskList = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      // Sort by ID numerically
      taskList.sort((a, b) => {
        const aId = parseInt(a.id) || 0;
        const bId = parseInt(b.id) || 0;
        return aId - bId;
      });
      setTasks(taskList);
    } catch (e) {
      console.error("Error loading tasks:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Task title is required.");
      return;
    }
    if (formData.enrollmentDeadline && !project?.targetDate) {
      showToast("Set a target date before adding an enrollment deadline time.");
      return;
    }

    setSaving(true);
    try {
      const tasksRef = collection(db, "missions", projectId, "task");
      const snap = await getDocs(tasksRef);

      // Get next ID starting from 0
      const nextId = snap.size.toString();

      const taskRef = doc(db, "missions", projectId, "task", nextId);
      const taskData = {
        title: formData.title,
        description: formData.description,
        enrollmentDeadline: formData.enrollmentDeadline,
        points: parseInt(formData.points) || 0,
        type: formData.type || "individual",
        createdAt: new Date().toISOString(),
      };
      
      // Add maxParticipants only for grouped tasks
      if (formData.type === "grouped") {
        taskData.maxParticipants = parseInt(formData.maxParticipants) || 5;
      }
      
      await setDoc(taskRef, taskData);

      logAudit({
        action: "TASK_CREATED",
        category: "event",
        details: {
          missionId: projectId,
          missionTitle: project?.title || "",
          taskTitle: formData.title,
          taskType: formData.type,
          taskPoints: parseInt(formData.points) || 0,
        },
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        enrollmentDeadline: "",
        points: 0,
        type: "individual",
        maxParticipants: 5,
      });
      setShowForm(false);
      await loadTasks();
    } catch (e) {
      console.error("Error creating task:", e);
      showToast("Failed to create task.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditTask = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      showToast("Task title is required.");
      return;
    }
    if (formData.enrollmentDeadline && !project?.targetDate) {
      showToast("Set a target date before adding an enrollment deadline time.");
      return;
    }

    setSaving(true);
    try {
      const taskRef = doc(db, "missions", projectId, "task", editingTaskId);
      const updateData = {
        title: formData.title,
        description: formData.description,
        enrollmentDeadline: formData.enrollmentDeadline,
        points: parseInt(formData.points) || 0,
        type: formData.type || "individual",
      };
      
      // Add maxParticipants only for grouped tasks
      if (formData.type === "grouped") {
        updateData.maxParticipants = parseInt(formData.maxParticipants) || 5;
      }
      
      await updateDoc(taskRef, updateData);

      logAudit({
        action: "TASK_UPDATED",
        category: "event",
        details: {
          missionId: projectId,
          missionTitle: project?.title || "",
          taskId: editingTaskId,
          taskTitle: formData.title,
        },
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        enrollmentDeadline: "",
        points: 0,
        type: "individual",
        maxParticipants: 5,
      });
      setEditingTaskId(null);
      setShowForm(false);
      await loadTasks();
    } catch (e) {
      console.error("Error updating task:", e);
      showToast("Failed to update task.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!await showConfirm("Delete this task? This cannot be undone.")) return;

    setSaving(true);
    try {
      const taskRef = doc(db, "missions", projectId, "task", taskId);
      const taskSnap = tasks.find(t => t.id === taskId);
      await deleteDoc(taskRef);
      logAudit({
        action: "TASK_DELETED",
        category: "event",
        details: {
          missionId: projectId,
          missionTitle: project?.title || "",
          taskId,
          taskTitle: taskSnap?.title || "",
        },
      });
      await loadTasks();
    } catch (e) {
      console.error("Error deleting task:", e);
      showToast("Failed to delete task.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (task) => {
    setEditingTaskId(task.id);
    setFormData({
      title: task.title || "",
      description: task.description || "",
      enrollmentDeadline: task.enrollmentDeadline || "",
      points: task.points || 0,
      type: task.type || "individual",
      maxParticipants: task.maxParticipants || 5,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingTaskId(null);
    setFormData({
      title: "",
      description: "",
      enrollmentDeadline: "",
      points: 0,
      type: "individual",
      maxParticipants: 5,
    });
  };

  if (loading && !project) return <p>Loading…</p>;

  return (
    <div className="admin-outlet">
      <button
        type="button"
        onClick={() => navigate(`/admin/projects/${projectId}`)}
      >
        ← Back to Project Details
      </button>

      <h1 style={{ marginTop: 12, color: "#111" }}>
        Tasks for {project?.title || project?.alt || "Project"}
      </h1>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: "#007bff",
              color: "#fff",
              padding: "10px 20px",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            + Create New Task
          </button>
        ) : (
          <div
            style={{
              border: "1px solid #ddd",
              padding: 20,
              borderRadius: 8,
              background: "#f9f9f9",
            }}
          >
            <h3 style={{ marginTop: 0, color: "#111" }}>
              {editingTaskId ? "Edit Task" : "Create New Task"}
            </h3>
            <form onSubmit={editingTaskId ? handleEditTask : handleCreateTask}>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  Title *
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows={4}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  Enrollment Deadline Time
                </label>
                <input
                  type="time"
                  name="enrollmentDeadline"
                  value={formData.enrollmentDeadline}
                  onChange={handleInputChange}
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  Points (0-1000)
                </label>
                <input
                  type="number"
                  name="points"
                  value={formData.points}
                  onChange={handleInputChange}
                  min="0"
                  max="1000"
                  style={{ width: "100%", padding: 8, fontSize: 14 }}
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 4,
                    fontWeight: 600,
                    color: "#111",
                  }}
                >
                  Task Type
                </label>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#111" }}>
                    <input
                      type="radio"
                      name="type"
                      value="individual"
                      checked={formData.type === "individual"}
                      onChange={handleInputChange}
                      style={{ marginRight: 6 }}
                    />
                    Individual
                  </label>
                  <label style={{ display: "flex", alignItems: "center", cursor: "pointer", color: "#111" }}>
                    <input
                      type="radio"
                      name="type"
                      value="grouped"
                      checked={formData.type === "grouped"}
                      onChange={handleInputChange}
                      style={{ marginRight: 6 }}
                    />
                    Grouped
                  </label>
                </div>
              </div>

              {formData.type === "grouped" && (
                <div style={{ marginBottom: 12 }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: 4,
                      fontWeight: 600,
                      color: "#111",
                    }}
                  >
                    Max Members per Group
                  </label>
                  <input
                    type="number"
                    name="maxParticipants"
                    value={formData.maxParticipants}
                    onChange={handleInputChange}
                    min="2"
                    max="50"
                    style={{ width: "100%", padding: 8, fontSize: 14 }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    background: "#28a745",
                    color: "#fff",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  {saving
                    ? "Saving…"
                    : editingTaskId
                      ? "Update Task"
                      : "Create Task"}
                </button>
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={saving}
                  style={{
                    background: "#6c757d",
                    color: "#fff",
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <hr />

      <h2 style={{ color: "#111" }}>Task List ({tasks.length})</h2>

      {loading ? (
        <p>Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p style={{ color: "#888" }}>
          No tasks yet. Create one to get started!
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {tasks.map((task) => (
            <div
              key={task.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 16,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, color: "#111" }}>{task.title}</h3>
                  {task.description && (
                    <p style={{ margin: "8px 0", color: "#555", fontSize: 14 }}>
                      {task.description}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      marginTop: 12,
                      fontSize: 13,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ color: "#111", fontWeight: 600 }}>
                      <strong>Type:</strong> {task.type === "grouped" ? "Grouped" : "Individual"}
                    </div>
                    {task.type === "grouped" && task.maxParticipants && (
                      <div style={{ color: "#1976d2", fontWeight: 600 }}>
                        <strong>Max per Group:</strong> {task.maxParticipants}
                      </div>
                    )}
                    {task.points !== undefined && (
                      <div style={{ color: "#388e3c", fontWeight: 600 }}>
                        <strong>Points:</strong> {task.points}
                      </div>
                    )}
                    {task.enrollmentDeadline && (
                      <div style={{ color: "#111" }}>
                        <strong>Enrollment Deadline:</strong> {task.enrollmentDeadline}
                      </div>
                    )}
                    {task.createdAt && (
                      <div style={{ color: "#888" }}>
                        <strong>Created:</strong> {new Date(task.createdAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginLeft: 16 }}>
                  <button
                    onClick={() => startEdit(task)}
                    disabled={saving}
                    style={{
                      background: "#007bff",
                      color: "#fff",
                      padding: "6px 12px",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    disabled={saving}
                    style={{
                      background: "#dc3545",
                      color: "#fff",
                      padding: "6px 12px",
                      border: "none",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
