import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const ref = doc(db, "Missions", projectId);

  const load = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        setProject(null);
        return;
      }
      const data = snap.data();
      setProject({
        id: snap.id,
        ...data,
        status: data.status || "draft",
        approvals: {
          faculty: data.approvals?.faculty ?? { approved: false, decidedAt: null },
          partner: data.approvals?.partner ?? { approved: false, decidedAt: null },
        },
      });
    } catch (e) {
      console.error(e);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const setStatus = async (nextStatus) => {
    setSaving(true);
    try {
      const payload = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };

      if (nextStatus === "for_approval") {
        payload.submittedAt = serverTimestamp();
        payload.approvals = {
          faculty: { approved: false, decidedAt: null },
          partner: { approved: false, decidedAt: null },
        };
      }

      if (nextStatus === "published") {
        payload.publishedAt = serverTimestamp();
      }

      await updateDoc(ref, payload);
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to update status.");
    } finally {
      setSaving(false);
    }
  };

  const toggleApproval = async (who) => {
    setSaving(true);
    try {
      const current = project?.approvals?.[who]?.approved ?? false;

      await updateDoc(ref, {
        [`approvals.${who}.approved`]: !current,
        [`approvals.${who}.decidedAt`]: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to update approval.");
    } finally {
      setSaving(false);
    }
  };

  const canPublish =
    project?.status === "for_approval" &&
    project?.approvals?.faculty?.approved === true &&
    project?.approvals?.partner?.approved === true;

  if (loading) return <p>Loading…</p>;
  if (!project) return <p>Project not found.</p>;

  return (
    <div>
      <button type="button" onClick={() => navigate("/admin/projects")}>
        ← Back to Project List
      </button>

      <h1 style={{ marginTop: 12, color: "#111" }}>
        {project.title || project.alt || "Untitled Mission"}
      </h1>

      <p style={{ color: "#111" }}><b>Status:</b> {project.status}</p>
      <p style={{ color: "#111" }}><b>Date:</b> {project.date || "—"}</p>
      <p style={{ color: "#111" }}><b>Location:</b> {project.location || "—"}</p>
      <p style={{ color: "#111" }}><b>Points:</b> {typeof project.points === "number" ? project.points : "—"}</p>

      <hr />

      <h3 style={{ color: "#111" }}>Approvals</h3>
      <p style={{ color: "#111" }}>Faculty: {project.approvals.faculty.approved ? "Approved" : "Pending"}</p>
      <p style={{ color: "#111" }}>Community Partner: {project.approvals.partner.approved ? "Approved" : "Pending"}</p>

      <hr />

      <h3 style={{ color: "#111" }}>Actions (demo)</h3>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={saving} onClick={() => setStatus("draft")}>
          Set Draft
        </button>

        <button disabled={saving} onClick={() => setStatus("for_approval")}>
          Submit for Approval
        </button>

        <button disabled={saving} onClick={() => toggleApproval("faculty")}>
          Toggle Faculty Approval
        </button>

        <button disabled={saving} onClick={() => toggleApproval("partner")}>
          Toggle Partner Approval
        </button>

        <button disabled={!canPublish || saving} onClick={() => setStatus("published")}>
          Publish
        </button>
      </div>

      <hr />

      <h3 style={{ color: "#111" }}>Tasks (placeholder)</h3>
      <p style={{ color: "#111" }}>This is where your classmate’s tasks component will be shown.</p>
      <p style={{ color: "#111" }}><b>projectId:</b> {projectId}</p>
    </div>
  );
}
