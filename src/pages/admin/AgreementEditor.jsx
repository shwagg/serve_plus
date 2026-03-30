import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { db } from "../../firebaseConfig";
import "../../styles/AgreementEditor.css";

// Default content used to seed Firestore on first load
const DEFAULT_TERMS = [
  {
    heading: "1. Acceptance of Terms",
    body: "By using Serve Plus, you agree to comply with and be bound by these terms.",
  },
  {
    heading: "2. User Responsibilities",
    body: "You are responsible for maintaining the confidentiality of your account and password and for restricting access to your computer.",
  },
  {
    heading: "3. Prohibited Activities",
    body: "No unauthorized access or use of the platform.\nNo data mining, scraping, or similar activities.\nNo activity that disrupts or interferes with the platform.",
  },
  {
    heading: "4. Intellectual Property",
    body: "All content, trademarks, and data on this site are the property of Serve Plus or its licensors.",
  },
  {
    heading: "5. Modifications",
    body: "We reserve the right to revise these terms at any time. Continued use of the platform means you accept any changes.",
  },
  {
    heading: "6. Termination",
    body: "We may terminate or suspend access to our platform immediately, without prior notice, for any breach of these terms.",
  },
  {
    heading: "7. Governing Law",
    body: "These terms are governed by and construed in accordance with the laws of your jurisdiction.",
  },
  {
    heading: "8. Contact Us",
    body: "If you have any questions about these Terms, please contact us at support@serveplus.com.",
  },
];

const DEFAULT_TERMS_INTRO =
  "Welcome to Serve Plus. These Terms and Conditions outline the rules and regulations for the use of our platform. By accessing this website, you accept these terms in full. Please read them carefully.";

const DEFAULT_PRIVACY = [
  {
    heading: "1. Information We Collect",
    body: "Personal information (name, email address, etc.)\nUsage data and cookies",
  },
  {
    heading: "2. Use of Information",
    body: "Information is used to provide and improve our services, communicate with users, and ensure platform security.",
  },
  {
    heading: "3. Data Protection",
    body: "We implement security measures to protect your data from unauthorized access.",
  },
  {
    heading: "4. Third-Party Services",
    body: "We may use third-party services that collect, monitor, and analyze usage.",
  },
  {
    heading: "5. Changes to This Policy",
    body: "We may update our Privacy Policy from time to time. Changes will be posted on this page.",
  },
  {
    heading: "6. Contact Us",
    body: "If you have questions about this Privacy Policy, contact us at support@serveplus.com.",
  },
];

const DEFAULT_PRIVACY_INTRO =
  "Your privacy is important to us. This Privacy Policy explains how Serve Plus collects, uses, and protects your information when you use our platform.";

const AGREEMENT_DOC = doc(db, "settings", "agreements");

function RichTextBodyEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: value || "",
    editorProps: {
      attributes: {
        class: "ae-rich-editor-input",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;

    const incomingValue = value || "";
    if (editor.getHTML() !== incomingValue) {
      editor.commands.setContent(incomingValue || "<p></p>", false);
    }
  }, [editor, value]);

  if (!editor) {
    return <div className="ae-rich-editor-loading">Loading editor...</div>;
  }

  return (
    <div className="ae-rich-editor-wrapper">
      <div className="ae-rich-editor-toolbar">
        <button
          type="button"
          className={`ae-rich-editor-btn ${editor.isActive("paragraph") ? "active" : ""}`}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          Paragraph
        </button>
        <button
          type="button"
          className={`ae-rich-editor-btn ${editor.isActive("bulletList") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          Bullets
        </button>
        <button
          type="button"
          className={`ae-rich-editor-btn ${editor.isActive("orderedList") ? "active" : ""}`}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          Numbering
        </button>
      </div>

      <EditorContent editor={editor} />

      <p className="ae-rich-editor-hint">
        Tip: type * then space for bullets, or 1. then space for numbered lists.
      </p>
    </div>
  );
}

export default function AgreementEditor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [version, setVersion] = useState("1.0");
  const [activeTab, setActiveTab] = useState("terms"); // "terms" | "privacy"

  // Terms state
  const [termsIntro, setTermsIntro] = useState(DEFAULT_TERMS_INTRO);
  const [termsSections, setTermsSections] = useState(DEFAULT_TERMS);

  // Privacy state
  const [privacyIntro, setPrivacyIntro] = useState(DEFAULT_PRIVACY_INTRO);
  const [privacySections, setPrivacySections] = useState(DEFAULT_PRIVACY);

  // Fetch current agreements from Firestore
  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDoc(AGREEMENT_DOC);
      if (snap.exists()) {
        const data = snap.data();
        setVersion(data.version || "1.0");
        setTermsIntro(data.termsIntro || DEFAULT_TERMS_INTRO);
        setTermsSections(data.termsSections || DEFAULT_TERMS);
        setPrivacyIntro(data.privacyIntro || DEFAULT_PRIVACY_INTRO);
        setPrivacySections(data.privacySections || DEFAULT_PRIVACY);
      }
      // If doc doesn't exist, defaults are already set
    } catch (err) {
      console.error("Failed to fetch agreements:", err);
      setError("Failed to load current agreements.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  // Increment version by 0.1
  const incrementVersion = (currentVersion) => {
    const num = parseFloat(currentVersion) || 1.0;
    return (num + 0.1).toFixed(1);
  };

  // Save and publish
  const handlePublish = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const newVersion = incrementVersion(version);
      await setDoc(AGREEMENT_DOC, {
        version: newVersion,
        termsIntro,
        termsSections,
        privacyIntro,
        privacySections,
        updatedAt: serverTimestamp(),
      });
      setVersion(newVersion);
      setSuccess(`Agreements published! Version updated to ${newVersion}.`);
    } catch (err) {
      console.error("Failed to publish agreements:", err);
      setError("Failed to publish. Please try again.");
    }
    setSaving(false);
  };

  // Section helpers
  const updateSection = (type, index, field, value) => {
    if (type === "terms") {
      setTermsSections((prev) =>
        prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
      );
    } else {
      setPrivacySections((prev) =>
        prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
      );
    }
  };

  const addSection = (type) => {
    const sections = type === "terms" ? termsSections : privacySections;
    const nextNum = sections.length + 1;
    const newSection = { heading: `${nextNum}. New Section`, body: "" };
    if (type === "terms") {
      setTermsSections((prev) => [...prev, newSection]);
    } else {
      setPrivacySections((prev) => [...prev, newSection]);
    }
  };

  const removeSection = (type, index) => {
    if (type === "terms") {
      setTermsSections((prev) => prev.filter((_, i) => i !== index));
    } else {
      setPrivacySections((prev) => prev.filter((_, i) => i !== index));
    }
  };

  if (loading) {
    return (
      <div className="ae-container">
        <p className="ae-loading">Loading agreements...</p>
      </div>
    );
  }

  const currentSections =
    activeTab === "terms" ? termsSections : privacySections;
  const currentIntro = activeTab === "terms" ? termsIntro : privacyIntro;
  const setCurrentIntro =
    activeTab === "terms" ? setTermsIntro : setPrivacyIntro;

  return (
    <div className="ae-container">
      {/* Header */}
      <div className="ae-header">
        <div>
          <h1 className="ae-title">Agreement Editor</h1>
          <p className="ae-version">
            Current Version: <strong>{version}</strong>
          </p>
        </div>
        <button
          className="ae-publish-btn"
          onClick={handlePublish}
          disabled={saving}
        >
          {saving ? "Publishing..." : "Publish & Update Version"}
        </button>
      </div>

      {success && <div className="ae-alert ae-success">{success}</div>}
      {error && <div className="ae-alert ae-error">{error}</div>}

      {/* Tabs */}
      <div className="ae-tabs">
        <button
          className={`ae-tab ${activeTab === "terms" ? "active" : ""}`}
          onClick={() => setActiveTab("terms")}
        >
          Terms &amp; Conditions
        </button>
        <button
          className={`ae-tab ${activeTab === "privacy" ? "active" : ""}`}
          onClick={() => setActiveTab("privacy")}
        >
          Privacy Policy
        </button>
      </div>

      {/* Intro */}
      <div className="ae-section-card">
        <label className="ae-label">Introduction</label>
        <textarea
          className="ae-textarea"
          value={currentIntro}
          onChange={(e) => setCurrentIntro(e.target.value)}
          rows={4}
        />
      </div>

      {/* Sections */}
      {currentSections.map((section, idx) => (
        <div className="ae-section-card" key={idx}>
          <div className="ae-section-head">
            <label className="ae-label">Section {idx + 1}</label>
            <button
              className="ae-remove-btn"
              onClick={() => removeSection(activeTab, idx)}
              title="Remove section"
            >
              Remove
            </button>
          </div>
          <input
            className="ae-input"
            placeholder="Heading"
            value={section.heading}
            onChange={(e) =>
              updateSection(activeTab, idx, "heading", e.target.value)
            }
          />
          <RichTextBodyEditor
            value={section.body}
            onChange={(value) => updateSection(activeTab, idx, "body", value)}
          />
        </div>
      ))}

      <button className="ae-add-btn" onClick={() => addSection(activeTab)}>
        + Add Section
      </button>
    </div>
  );
}
