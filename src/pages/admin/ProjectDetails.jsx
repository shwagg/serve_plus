import { useRef, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../firebaseConfig";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import "../../styles/AdminDashboard.css";

//for demo purposes only
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import ceBg from "../../assets/ce-proposal-page1.png";


export default function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  //export to PDF (demo purposes only)
  const pdfRef = useRef(null);
  const handleExportPdf = async () => {
    if (!pdfRef.current) return;

    // temporarily show if you decide to hide via display:none (we won't)
    const canvas = await html2canvas(pdfRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = 210;
    const pageHeight = 297;

    pdf.addImage(imgData, "PNG", 0, 0, pageWidth, pageHeight);

    const filename = `CE-Proposal-${(project?.title || project?.alt || "Draft")
      .toString()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")}.pdf`;

    pdf.save(filename);
  };

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

  //for archiving projects (admin-privilege)
  const handleArchive = async () => {
    if (!window.confirm("Archive this project? You can restore it later.")) return;

    setSaving(true);
    try {
      await updateDoc(ref, {
        status: "archived",
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate("/admin/projects");
    } catch (e) {
      console.error(e);
      alert("Failed to archive.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm("Restore this project to Draft?")) return;

    setSaving(true);
    try {
      await updateDoc(ref, {
        status: "draft",
        archivedAt: null,
        updatedAt: serverTimestamp(),
      });
      await load();
    } catch (e) {
      console.error(e);
      alert("Failed to restore.");
    } finally {
      setSaving(false);
    }
  };

  //able to delete (admin-privilege) -> 
  const handleDelete = async () => {
    const ok = window.confirm(
      "Delete this project permanently? This cannot be undone."
    );
    if (!ok) return;

    setSaving(true);
    try {
      await deleteDoc(ref);
      navigate("/admin/projects");
    } catch (e) {
      console.error(e);
      alert("Failed to delete.");
    } finally {
      setSaving(false);
    }
  };

  //will be fixing ui here shortly - aly
  return (
    <div>
      <button type="button" onClick={() => navigate("/admin/projects")}>
        ← Back to Project List
      </button>

      <h1 style={{ marginTop: 12, color: "#111" }}>
        {project.title || project.alt || "Untitled Mission"}
      </h1>

      {/* Export PDF using proposal under assets (demo) */}
      <button disabled type="button" onClick={handleExportPdf}>
        Export PDF (still editing)
      </button>

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

        {project.status !== "archived" ? (
          <button disabled={saving} onClick={handleArchive}>
            Archive
          </button>
        ) : (
          <button disabled={saving} onClick={handleRestore}>
            Restore to Draft
          </button>
        )}

        <button disabled={saving} onClick={handleDelete}>
          Delete
        </button>

        <button disabled={!canPublish || saving} onClick={() => setStatus("published")}>
          Publish
        </button>
      </div>

      <hr />

      <h3 style={{ color: "#111" }}>Tasks</h3>
      <p style={{ color: "#111" }}>dito gawa ni jc.</p>
      <p style={{ color: "#111" }}><b>projectId:</b> {projectId}</p>

      {/* Hidden div for PDF export */}
      <div className="pdf-export-wrap">
        <div ref={pdfRef} className="ce-sheet">
          <img src={ceBg} alt="CE Proposal Template" className="ce-bg" />

          {/* Title */}
          <div className="ce-field ce-title">
            {project?.title || project?.alt || ""}
          </div>

          {/* Date Proposed (this is what you asked for) */}
          <div className="ce-field ce-dateProposed">
            {project?.dateProposed || ""}
          </div>

          {/* Location */}
          <div className="ce-field ce-location">
            {project?.location || ""}
          </div>

          {/* Volunteer Hours */}
          <div className="ce-field ce-hours">
            {project?.volunteerHours ?? ""}
          </div>

          {/* Points */}
          <div className="ce-field ce-points">
            {project?.points ?? ""}
          </div>

          {/* Stakeholders */}
          <div className="ce-field ce-stakeholders">
            {project?.stakeholders || ""}
          </div>

          {/* Description */}
          <div className="ce-field ce-description">
            {project?.description || ""}
          </div>

          {/* SDG checks example */}
          {(project?.sdgs || []).includes("4. Quality Education") && (
            <div className="ce-check ce-sdg4">✓</div>
          )}
        </div>
      </div>

    </div>
  );
}
