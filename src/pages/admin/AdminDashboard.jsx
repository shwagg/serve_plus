//first page for admin after login
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import ProjectDetailSidebar from "./ProjectDetailSidebar";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import "../../styles/AdminDashboard.css";

// ── Design tokens ────────────────────────────────────────────
const G = {
  // Google Material palette
  blue:     "#1a73e8",
  blueL:    "#e8f0fe",
  green:    "#34a853",
  greenL:   "#e6f4ea",
  red:      "#ea4335",
  redL:     "#fce8e6",
  amber:    "#f9ab00",
  amberL:   "#fef7e0",
  text:     "#202124",
  sub:      "#5f6368",
  border:   "#e0e0e0",
  bg:       "#f8f9fa",
  white:    "#ffffff",
  // brand accents
  teal:     "#B1E1E6",
  pink:     "#E4AABB",
  orange:   "#ED4F13",
  yellow:   "#FBC805",
};

const elev1 = "0 1px 2px rgba(60,64,67,.3), 0 2px 6px rgba(60,64,67,.15)";
const elev2 = "0 1px 3px rgba(60,64,67,.3), 0 4px 8px rgba(60,64,67,.15)";

// ── Small shared components ──────────────────────────────────
function Card({ children, style }) {
  return (
    <div style={{ background: G.white, borderRadius: 12, boxShadow: elev1, marginBottom: 20, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHead({ title, sub, onMore }) {
  return (
    <div style={{ padding: "18px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 15, color: G.text, letterSpacing: "-.01em" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: G.sub, marginTop: 3, lineHeight: 1.45 }}>{sub}</div>}
      </div>
      {onMore && (
        <button onClick={onMore} style={{
          border: "none", background: "none", cursor: "pointer",
          color: G.blue, fontSize: 12, fontWeight: 600, padding: "2px 0",
          flexShrink: 0, marginLeft: 12, whiteSpace: "nowrap",
        }}>
          View details →
        </button>
      )}
    </div>
  );
}

function Pill({ label, color, bg }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color, background: bg, borderRadius: 999, padding: "2px 8px" }}>
      {label}
    </span>
  );
}

function ProgressBar({ value, color, height = 6 }) {
  return (
    <div style={{ background: "#e8eaed", borderRadius: 999, height, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: color, borderRadius: 999, transition: "width .4s ease" }} />
    </div>
  );
}

function Empty({ text }) {
  return <p style={{ color: G.sub, fontSize: 13, margin: 0, padding: "6px 0 10px" }}>{text}</p>;
}

function Divider() {
  return <div style={{ height: 1, background: G.border, margin: "0 0 4px" }} />;
}

// Full-screen modal overlay
function Modal({ title, subtitle, onClose, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(32,33,36,.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: G.white, borderRadius: 16, width: "100%", maxWidth: 660, maxHeight: "88vh", overflowY: "auto", boxShadow: "0 24px 48px rgba(0,0,0,.22)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{ padding: "24px 28px 16px", borderBottom: `1px solid ${G.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "sticky", top: 0, background: G.white, zIndex: 1, borderRadius: "16px 16px 0 0" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: G.text }}>{title}</h3>
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: G.sub }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ border: `1px solid ${G.border}`, background: G.white, borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 17, color: G.sub, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: 16 }}>
            ×
          </button>
        </div>
        <div style={{ padding: "20px 28px 28px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function AdminDashboard() {
  const navigate = useNavigate();

  // data state
  const [totalStudents,          setTotalStudents]          = useState(null);
  const [flaggedCount,           setFlaggedCount]           = useState(0);
  const [totalProjects,          setTotalProjects]          = useState(0);
  const [slCount,                setSlCount]                = useState(0);
  const [ceCount,                setCeCount]                = useState(0);
  const [eventsToday,            setEventsToday]            = useState([]);
  const [upcomingEvents,         setUpcomingEvents]         = useState([]);
  const [sdgAnalytics,           setSdgAnalytics]           = useState([]);
  const [engagement,             setEngagement]             = useState([]);
  const [participationBreakdown, setParticipationBreakdown] = useState({ verified: 0, partial: 0, minimal: 0, no_show: 0 });
  const [stepFunnel,             setStepFunnel]             = useState({ preSurvey: 0, consent: 0, attendance: 0, postSurvey: 0, total: 0 });
  const [pendingConsent,         setPendingConsent]         = useState(null);

  // UI state
  const [activeModal,     setActiveModal]     = useState(null); // 'sdg'|'engagement'|'funnel'|'participation'|'flaggedStudents'
  const [showSidebar,     setShowSidebar]     = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Flagged students modal state
  const [flaggedStudents,  setFlaggedStudents]  = useState([]);
  const [flaggedLoading,   setFlaggedLoading]   = useState(false);
  const [unflaggingIds,    setUnflaggingIds]    = useState({});

  // ── Fetch users ──────────────────────────────────────────
  useEffect(() => {
    getDocs(collection(db, "users")).then(snap => {
      const docs = snap.docs.map(d => d.data());
      setTotalStudents(docs.filter(u => u.role === "student").length);
      setFlaggedCount(docs.filter(u => u.attendanceFlagged === true).length);
    }).catch(() => setTotalStudents("-"));
  }, []);

  // ── Fetch missions ───────────────────────────────────────
  useEffect(() => {
    const parseDate = str => { if (!str) return null; const d = new Date(str); return isNaN(d) ? null : d; };
    const sameDay   = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

    getDocs(collection(db, "missions")).then(snap => {
      const rows      = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const published = rows.filter(m => m.status === "published");

      setTotalProjects(published.length);
      setSlCount(published.filter(m => m.projectType === "sl").length);
      setCeCount(published.filter(m => m.projectType === "ce").length);

      // SDG distribution
      const sdgCounts = {};
      published.forEach(m => (m.sdgs || []).forEach(id => { sdgCounts[id] = (sdgCounts[id] || 0) + 1; }));
      const totalSdg = Object.values(sdgCounts).reduce((s, c) => s + c, 0);
      setSdgAnalytics(Object.entries(sdgCounts).map(([id, count]) => ({
        sdgId: Number(id), count,
        percentage: totalSdg ? Number(((count / totalSdg) * 100).toFixed(1)) : 0,
      })));

      // Events today / upcoming
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayEvts = [], upcoming = [];
      for (const m of published) {
        const d = parseDate(m.targetDate);
        if (!d) continue;
        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        if (sameDay(day, today)) todayEvts.push(m);
        else if (day > today) upcoming.push(m);
      }
      upcoming.sort((a, b) => (parseDate(a.targetDate) || 0) - (parseDate(b.targetDate) || 0));
      setEventsToday(todayEvts);
      setUpcomingEvents(upcoming);
    }).catch(console.error);
  }, []);

  // ── Fetch volunteer data ─────────────────────────────────
  useEffect(() => {
    const run = async () => {
      try {
        const snap    = await getDocs(collection(db, "missions"));
        const missions = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.status === "published");

        const eng = [];
        const bd  = { verified: 0, partial: 0, minimal: 0, no_show: 0 };
        const fn  = { preSurvey: 0, consent: 0, attendance: 0, postSurvey: 0, total: 0 };
        let pending = 0;

        for (const m of missions) {
          const vs    = (await getDocs(collection(db, "missions", m.id, "volunteer"))).docs.map(d => d.data());
          const total = vs.length;
          const cnt   = (k, v) => vs.filter(x => x.progress?.[k] === v).length;

          const ps = cnt("preSurvey", "submitted");
          const cs = cnt("consent",   "submitted");
          const at = cnt("attendance","present");
          const po = cnt("postSurvey","submitted");

          eng.push({
            id: m.id, label: m.title || m.alt || "Untitled Mission",
            value:      total ? Math.round(((ps + cs + at + po) / (total * 4)) * 100) : 0,
            total, preSurvey: ps, consent: cs, attendance: at, postSurvey: po,
            data: m,
          });

          vs.forEach(v => { if (bd[v.participationStatus] !== undefined) bd[v.participationStatus]++; });

          fn.total      += total;
          fn.preSurvey  += ps;
          fn.consent    += cs;
          fn.attendance += at;
          fn.postSurvey += po;
          pending       += vs.filter(v => v.consentSubmission?.reviewStatus === "pending").length;
        }

        setEngagement(eng);
        setParticipationBreakdown(bd);
        setStepFunnel(fn);
        setPendingConsent(pending);
      } catch { setEngagement([]); }
    };
    run();
  }, []);

  // ── Flagged students fetch ────────────────────────────────
  const openFlaggedModal = async () => {
    setActiveModal("flaggedStudents");
    setFlaggedLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("attendanceFlagged", "==", true)));
      setFlaggedStudents(snap.docs.map(d => ({
        id: d.id,
        name: d.data().name || d.data().email || d.id,
        email: d.data().email || "",
        level: d.data().level || "—",
        flaggedMissionTitle: d.data().attendanceFlaggedMissionTitle || "—",
        flagExpiry: d.data().attendanceFlagExpiry?.toDate?.() || null,
      })));
    } finally {
      setFlaggedLoading(false);
    }
  };

  const handleUnflag = async (student) => {
    setUnflaggingIds(prev => ({ ...prev, [student.id]: true }));
    try {
      await updateDoc(doc(db, "users", student.id), {
        attendanceFlagged: false,
        attendanceFlagExpiry: null,
        attendanceFlaggedAt: null,
        attendanceFlaggedMissionId: null,
        attendanceFlaggedMissionTitle: null,
      });
      await addDoc(collection(db, "users", student.id, "notifications"), {
        type: "attendance_unflag",
        title: "Attendance Flag Removed",
        message: "An admin has removed your attendance flag. You can join missions again.",
        read: false,
        createdAt: serverTimestamp(),
      });
      setFlaggedStudents(prev => prev.filter(s => s.id !== student.id));
      setFlaggedCount(prev => Math.max(0, prev - 1));
    } finally {
      setUnflaggingIds(prev => { const n = { ...prev }; delete n[student.id]; return n; });
    }
  };

  // ── Donut chart helpers ──────────────────────────────────
  const SDG_COLORS = [G.teal, G.pink, G.yellow, G.orange, G.blue, "#9c27b0", "#4caf50"];

  const sorted    = [...sdgAnalytics].sort((a, b) => b.percentage - a.percentage);
  const top5      = sorted.slice(0, 5);
  const rest      = sorted.slice(5);
  const chartData = rest.length > 0
    ? [...top5, { sdgId: "Others", count: rest.reduce((s, x) => s + x.count, 0), percentage: Number(rest.reduce((s, x) => s + x.percentage, 0).toFixed(1)) }]
    : top5;

  const makeSlices = (data) => {
    let cum = 0;
    return data.map(item => {
      const sa = cum * 2 * Math.PI, angle = (item.percentage / 100) * 2 * Math.PI;
      cum += item.percentage / 100;
      return { ...item, startAngle: sa, endAngle: sa + angle, midAngle: sa + angle / 2 };
    });
  };

  const arcPath = (cx, cy, r, sa, ea) => {
    const pt = a => ({ x: cx + r * Math.cos(a - Math.PI / 2), y: cy + r * Math.sin(a - Math.PI / 2) });
    const s = pt(ea), e = pt(sa);
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${ea - sa > Math.PI ? 1 : 0} 0 ${e.x} ${e.y} L ${cx} ${cy} Z`;
  };

  const slices  = makeSlices(chartData);
  const pct     = v => stepFunnel.total > 0 ? Math.round((v / stepFunnel.total) * 100) : 0;
  const bdTotal = Object.values(participationBreakdown).reduce((a, b) => a + b, 0);

  const dateLabel = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // step defs reused by both dashboard and modal
  const STEPS = [
    { key: "preSurvey",  label: "Pre-Survey",   color: G.teal,   desc: "Volunteer completed the pre-activity survey before the event."      },
    { key: "consent",    label: "Consent Form",  color: G.yellow, desc: "Volunteer uploaded and submitted their signed consent form."        },
    { key: "attendance", label: "Attendance",    color: G.orange, desc: "Volunteer was marked present via QR scan or manual entry."          },
    { key: "postSurvey", label: "Post-Survey",   color: G.pink,   desc: "Volunteer completed the post-activity reflection survey."           },
  ];

  const PART_STATUSES = [
    { key: "verified", label: "Verified", color: G.teal,   desc: "Fully completed and actively participated in the event."         },
    { key: "partial",  label: "Partial",  color: G.yellow, desc: "Attended but only partially completed required activities."       },
    { key: "minimal",  label: "Minimal",  color: G.orange, desc: "Was present for a very small portion of the event."              },
    { key: "no_show",  label: "No Show",  color: G.pink,   desc: "Registered but did not attend. No points are awarded."           },
  ];

  // ── Render ───────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'Inter', 'Google Sans', 'Roboto', 'Segoe UI', sans-serif" }}>

      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: G.text, letterSpacing: "-.02em" }}>Dashboard</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: G.sub }}>{dateLabel}</p>
        </div>
      </div>

      {/* ── KPI summary row ── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24, flexWrap: "wrap" }}>
        {[
          { label: "Published Events",        value: totalProjects,         icon: "📋", accent: G.blue,   accentBg: G.blueL  },
          { label: "Registered Students",     value: totalStudents ?? "…",  icon: "👤", accent: G.green,  accentBg: G.greenL },
          { label: "Events Today",            value: eventsToday.length,    icon: "📅", accent: G.orange, accentBg: "#fff3e0"},
          { label: "Pending Consent Reviews", value: pendingConsent ?? "…", icon: "📝", accent: pendingConsent > 0 ? G.red : G.sub, accentBg: pendingConsent > 0 ? G.redL : G.bg, flag: pendingConsent > 0 },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 170px", background: G.white, borderRadius: 12, boxShadow: elev1, padding: "18px 20px", minWidth: 155 }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, marginBottom: 12 }}>
              {c.icon}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: G.text, lineHeight: 1 }}>{c.value}</div>
            <div style={{ fontSize: 12, color: G.sub, marginTop: 6, fontWeight: 500 }}>{c.label}</div>
            {c.flag && <div style={{ fontSize: 11, color: G.red, fontWeight: 600, marginTop: 4 }}>● Needs review</div>}
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="dashboard-grid">

        {/* LEFT column */}
        <section className="left-col">

          {/* Volunteer Engagement */}
          <Card>
            <CardHead
              title="Volunteer Engagement per Mission"
              sub="Overall step-completion rate — pre-survey, consent, attendance, post-survey"
              onMore={() => setActiveModal("engagement")}
            />
            <Divider />
            <div style={{ padding: "12px 20px 20px" }}>
              {engagement.length === 0
                ? <Empty text="No published missions with volunteers yet." />
                : engagement.map(x => (
                  <div key={x.id} style={{ marginBottom: 14, cursor: "pointer" }}
                    onClick={() => { if (x.data) { setSelectedProject(x.data); setShowSidebar(true); } }}
                    title="Click to view mission details"
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: G.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "78%" }}>
                        {x.label}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: G.blue, flexShrink: 0 }}>{x.value}%</span>
                    </div>
                    <ProgressBar value={x.value} color={G.blue} height={6} />
                  </div>
                ))
              }
            </div>
          </Card>

          {/* Step Completion Funnel */}
          <Card>
            <CardHead
              title="Step Completion Funnel"
              sub="Of all registered volunteers, percentage who completed each step"
              onMore={() => setActiveModal("funnel")}
            />
            <Divider />
            <div style={{ padding: "12px 20px 20px" }}>
              {stepFunnel.total === 0
                ? <Empty text="No volunteer data yet." />
                : STEPS.map(s => (
                  <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: G.text, width: 96, flexShrink: 0 }}>{s.label}</span>
                    <div style={{ flex: 1 }}>
                      <ProgressBar value={pct(stepFunnel[s.key])} color={s.color} height={7} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: G.text, width: 36, textAlign: "right", flexShrink: 0 }}>
                      {pct(stepFunnel[s.key])}%
                    </span>
                  </div>
                ))
              }
              {stepFunnel.total > 0 && (
                <p style={{ fontSize: 11, color: G.sub, margin: "10px 0 0", borderTop: `1px solid ${G.border}`, paddingTop: 10 }}>
                  Based on {stepFunnel.total} total volunteer registration{stepFunnel.total !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </Card>

          {/* SDG Distribution — donut */}
          <Card>
            <CardHead
              title="SDG Distribution"
              sub="UN Sustainable Development Goals addressed by published missions"
              onMore={() => setActiveModal("sdg")}
            />
            <Divider />
            <div style={{ padding: "12px 20px 24px" }}>
              {slices.length === 0
                ? <Empty text="No SDG data available yet." />
                : <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
                  {/* Donut chart */}
                  <svg width={160} height={160} style={{ flexShrink: 0 }}>
                    {slices.map((s, i) => (
                      <path key={s.sdgId} d={arcPath(80, 80, 70, s.startAngle, s.endAngle)} fill={SDG_COLORS[i % SDG_COLORS.length]} />
                    ))}
                    {/* Center hole */}
                    <circle cx={80} cy={80} r={44} fill={G.white} />
                    <text x={80} y={74} textAnchor="middle" fontSize="22" fontWeight="700" fill={G.text}>{totalProjects}</text>
                    <text x={80} y={92} textAnchor="middle" fontSize="10" fill={G.sub}>missions</text>
                  </svg>
                  {/* Legend */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                    {chartData.map((item, i) => (
                      <div key={item.sdgId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: SDG_COLORS[i % SDG_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: G.text, flex: 1 }}>SDG {item.sdgId}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: G.sub }}>{item.percentage}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              }
            </div>
          </Card>

        </section>

        {/* RIGHT column */}
        <section className="right-col">

          {/* Mission Types */}
          <Card>
            <CardHead title="Mission Types" sub="Published missions by project type" />
            <Divider />
            <div style={{ padding: "12px 20px 20px", display: "flex", gap: 12 }}>
              {[
                { label: "Service-Learning", sub: "SL", count: slCount, color: G.teal,   bg: "#f0f9fa" },
                { label: "Community Engagement", sub: "CE", count: ceCount, color: G.amber, bg: G.amberL },
              ].map(t => {
                const p = totalProjects > 0 ? Math.round((t.count / totalProjects) * 100) : 0;
                return (
                  <div key={t.sub} style={{ flex: 1, background: t.bg, borderRadius: 10, padding: "14px 16px", border: `1px solid ${G.border}` }}>
                    <div style={{ fontSize: 11, color: G.sub, fontWeight: 600, marginBottom: 4 }}>{t.label} ({t.sub})</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: G.text, lineHeight: 1 }}>{t.count}</div>
                    <div style={{ fontSize: 11, color: t.color, fontWeight: 600, marginTop: 4 }}>{p}% of total</div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Compliance Alerts — only shown when actionable */}
          {(pendingConsent > 0 || flaggedCount > 0) && (
            <Card style={{ border: `1px solid #fad2cf` }}>
              <CardHead title="Compliance Alerts" sub="Items that require your attention" />
              <Divider />
              <div style={{ padding: "12px 20px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingConsent > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: G.redL, borderRadius: 8, padding: "10px 14px" }}>
                    <span style={{ fontSize: 13, color: G.text }}>Consent forms awaiting review</span>
                    <span style={{ fontWeight: 700, color: G.red, fontSize: 16 }}>{pendingConsent}</span>
                  </div>
                )}
                {flaggedCount > 0 && (
                  <div
                    onClick={openFlaggedModal}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff8f0", borderRadius: 8, padding: "10px 14px", border: "1px solid #ffe0b2", cursor: "pointer" }}
                    title="Click to view flagged students"
                  >
                    <span style={{ fontSize: 13, color: G.text }}>Students with flagged attendance</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: G.orange, fontSize: 16 }}>{flaggedCount}</span>
                      <span style={{ fontSize: 11, color: G.orange, fontWeight: 600 }}>View →</span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Participation Status */}
          <Card>
            <CardHead
              title="Participation Status"
              sub="How volunteers were rated after each completed event"
              onMore={() => setActiveModal("participation")}
            />
            <Divider />
            <div style={{ padding: "12px 20px 20px" }}>
              {bdTotal === 0
                ? <Empty text="No participation data yet. Status is set after events are completed." />
                : PART_STATUSES.map(({ key, label, color }) => {
                  const count = participationBreakdown[key];
                  const p     = bdTotal > 0 ? Math.round((count / bdTotal) * 100) : 0;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: G.text, width: 68, flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={p} color={color} height={6} />
                      </div>
                      <span style={{ fontSize: 12, color: G.sub, width: 56, textAlign: "right", flexShrink: 0 }}>
                        {count} ({p}%)
                      </span>
                    </div>
                  );
                })
              }
            </div>
          </Card>

          {/* Events Today */}
          <Card>
            <div style={{ padding: "18px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: G.text }}>Events Today</div>
                <div style={{ fontSize: 12, color: eventsToday.length > 0 ? G.orange : G.sub, marginTop: 2 }}>
                  {eventsToday.length > 0 ? `${eventsToday.length} happening today` : "None scheduled today"}
                </div>
              </div>
              <button
                onClick={() => navigate("/admin/projects")}
                style={{ background: G.blue, color: G.white, border: "none", borderRadius: 20, fontWeight: 600, fontSize: 12, padding: "7px 18px", cursor: "pointer", boxShadow: "0 1px 3px rgba(26,115,232,.4)" }}
              >
                View All
              </button>
            </div>
            <Divider />
            <div style={{ padding: "6px 20px 16px" }}>
              {eventsToday.length === 0
                ? <Empty text="No events scheduled for today." />
                : eventsToday.map(e => <EventRow key={e.id} event={e} onClick={() => e.id && navigate(`/admin/events/${e.id}`)} />)
              }
            </div>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHead title="Upcoming Events" sub="Future-dated published missions, sorted by soonest date" />
            <Divider />
            <div style={{ padding: "6px 20px 16px" }}>
              {upcomingEvents.length === 0
                ? <Empty text="No upcoming events yet." />
                : upcomingEvents.map(e => <EventRow key={e.id} event={e} onClick={() => e.id && navigate(`/admin/events/${e.id}`)} />)
              }
            </div>
          </Card>

        </section>
      </div>

      {/* ════════════ MODALS ════════════ */}

      {/* SDG Distribution Modal */}
      {activeModal === "sdg" && (
        <Modal
          title="SDG Distribution"
          subtitle={`Full breakdown across all ${totalProjects} published missions`}
          onClose={() => setActiveModal(null)}
        >
          {/* Larger donut */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
            <svg width={220} height={220}>
              {makeSlices(chartData).map((s, i) => (
                <path key={s.sdgId} d={arcPath(110, 110, 90, s.startAngle, s.endAngle)} fill={SDG_COLORS[i % SDG_COLORS.length]} />
              ))}
              <circle cx={110} cy={110} r={56} fill={G.white} />
              <text x={110} y={103} textAnchor="middle" fontSize="28" fontWeight="700" fill={G.text}>{totalProjects}</text>
              <text x={110} y={122} textAnchor="middle" fontSize="11" fill={G.sub}>total missions</text>
            </svg>
          </div>
          {/* Full breakdown table */}
          <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 120px", padding: "10px 16px", background: G.bg, borderBottom: `1px solid ${G.border}` }}>
              <span style={{ fontSize: 12, color: G.sub, fontWeight: 600 }}>SDG</span>
              <span style={{ fontSize: 12, color: G.sub, fontWeight: 600, textAlign: "center" }}>Missions</span>
              <span style={{ fontSize: 12, color: G.sub, fontWeight: 600, textAlign: "right" }}>Share</span>
            </div>
            {[...sdgAnalytics].sort((a, b) => b.count - a.count).map((item, i) => (
              <div key={item.sdgId} style={{ display: "grid", gridTemplateColumns: "1fr auto 120px", alignItems: "center", padding: "12px 16px", borderBottom: i < sdgAnalytics.length - 1 ? `1px solid ${G.border}` : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: SDG_COLORS[i % SDG_COLORS.length], display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: G.text, fontWeight: 500 }}>SDG {item.sdgId}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: G.text, textAlign: "center" }}>{item.count}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                  <div style={{ width: 60, background: "#e8eaed", borderRadius: 999, height: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${item.percentage}%`, background: SDG_COLORS[i % SDG_COLORS.length], borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 12, color: G.sub, width: 36, textAlign: "right" }}>{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* Volunteer Engagement Modal */}
      {activeModal === "engagement" && (
        <Modal
          title="Volunteer Engagement"
          subtitle="Per-mission breakdown of step completion. Sorted by highest engagement."
          onClose={() => setActiveModal(null)}
        >
          {engagement.length === 0
            ? <Empty text="No data available." />
            : [...engagement].sort((a, b) => b.value - a.value).map((x, idx) => (
              <div key={x.id} style={{ marginBottom: 22, paddingBottom: 22, borderBottom: idx < engagement.length - 1 ? `1px solid ${G.border}` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{x.label}</span>
                  <Pill label={`${x.value}% overall`} color={G.blue} bg={G.blueL} />
                </div>
                <p style={{ fontSize: 12, color: G.sub, margin: "0 0 12px" }}>
                  {x.total} volunteer{x.total !== 1 ? "s" : ""} registered
                </p>
                {STEPS.map(s => {
                  const count = x[s.key];
                  const p     = x.total > 0 ? Math.round((count / x.total) * 100) : 0;
                  return (
                    <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: G.sub, width: 90, flexShrink: 0 }}>{s.label}</span>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={p} color={s.color} height={6} />
                      </div>
                      <span style={{ fontSize: 12, color: G.sub, width: 52, textAlign: "right", flexShrink: 0 }}>
                        {count}/{x.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          }
        </Modal>
      )}

      {/* Step Funnel Modal */}
      {activeModal === "funnel" && (
        <Modal
          title="Step Completion Funnel"
          subtitle={`Aggregate across all missions — ${stepFunnel.total} total volunteer registrations`}
          onClose={() => setActiveModal(null)}
        >
          {STEPS.map((s, i, arr) => {
            const count   = stepFunnel[s.key];
            const p       = pct(count);
            const prev    = i > 0 ? stepFunnel[arr[i - 1].key] : stepFunnel.total;
            const dropoff = prev > 0 ? Math.round(((prev - count) / prev) * 100) : 0;
            return (
              <div key={s.key} style={{ marginBottom: 24 }}>
                {/* Step header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: G.white, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: G.text }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: G.sub }}>{s.desc}</div>
                  </div>
                </div>
                {/* Bar + count */}
                <div style={{ paddingLeft: 38 }}>
                  <ProgressBar value={p} color={s.color} height={10} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: G.sub }}>
                      {count} of {stepFunnel.total} volunteers ({p}%)
                    </span>
                    {i > 0 && dropoff > 0 && (
                      <span style={{ fontSize: 11, color: G.orange, fontWeight: 600 }}>
                        ↓ {dropoff}% drop-off from previous step
                      </span>
                    )}
                  </div>
                </div>
                {/* Connector line between steps */}
                {i < arr.length - 1 && (
                  <div style={{ width: 2, height: 16, background: G.border, margin: "8px 0 0 13px" }} />
                )}
              </div>
            );
          })}
        </Modal>
      )}

      {/* Participation Status Modal */}
      {activeModal === "participation" && (
        <Modal
          title="Participation Status"
          subtitle={`Admins rate volunteers after each completed event. ${bdTotal} total ratings recorded.`}
          onClose={() => setActiveModal(null)}
        >
          {PART_STATUSES.map(({ key, label, color, desc }) => {
            const count = participationBreakdown[key];
            const p     = bdTotal > 0 ? Math.round((count / bdTotal) * 100) : 0;
            return (
              <div key={key} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: `1px solid ${G.border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: G.text }}>{label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: G.text }}>{count}</span>
                    <Pill label={`${p}%`} color={color} bg={`${color}22`} />
                  </div>
                </div>
                <ProgressBar value={p} color={color} height={8} />
                <p style={{ fontSize: 12, color: G.sub, margin: "8px 0 0" }}>{desc}</p>
              </div>
            );
          })}
        </Modal>
      )}

      {/* Flagged Students Modal */}
      {activeModal === "flaggedStudents" && (
        <Modal
          title="Flagged Students"
          subtitle={`Students currently restricted from joining missions due to missed attendance`}
          onClose={() => setActiveModal(null)}
        >
          {flaggedLoading ? (
            <p style={{ color: G.sub, fontSize: 13, margin: 0 }}>Loading…</p>
          ) : flaggedStudents.length === 0 ? (
            <Empty text="No students are currently flagged." />
          ) : (
            <div style={{ border: `1px solid ${G.border}`, borderRadius: 10, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 1fr 90px 80px", padding: "10px 16px", background: G.bg, borderBottom: `1px solid ${G.border}` }}>
                {["Student", "Level", "Flagged For", "Expires", ""].map(h => (
                  <span key={h} style={{ fontSize: 12, color: G.sub, fontWeight: 600 }}>{h}</span>
                ))}
              </div>
              {flaggedStudents.map((s, i) => (
                <div
                  key={s.id}
                  style={{
                    display: "grid", gridTemplateColumns: "1fr 80px 1fr 90px 80px",
                    alignItems: "center", padding: "12px 16px",
                    borderBottom: i < flaggedStudents.length - 1 ? `1px solid ${G.border}` : "none",
                    background: G.white,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{s.name}</div>
                    {s.email && s.email !== s.name && (
                      <div style={{ fontSize: 11, color: G.sub, marginTop: 2 }}>{s.email}</div>
                    )}
                  </div>
                  <div>
                    <Pill label={s.level} color={G.orange} bg="#fff3e0" />
                  </div>
                  <div style={{ fontSize: 12, color: G.sub, paddingRight: 8 }}>{s.flaggedMissionTitle}</div>
                  <div style={{ fontSize: 12, color: s.flagExpiry ? G.red : G.sub, fontWeight: s.flagExpiry ? 600 : 400 }}>
                    {s.flagExpiry ? s.flagExpiry.toLocaleDateString("en-PH") : "—"}
                  </div>
                  <div>
                    <button
                      onClick={() => handleUnflag(s)}
                      disabled={!!unflaggingIds[s.id]}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6,
                        border: `1px solid ${G.border}`, background: unflaggingIds[s.id] ? G.bg : G.white,
                        color: unflaggingIds[s.id] ? G.sub : G.green, cursor: unflaggingIds[s.id] ? "default" : "pointer",
                      }}
                    >
                      {unflaggingIds[s.id] ? "…" : "Unflag"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showSidebar && selectedProject && (
        <ProjectDetailSidebar
          project={selectedProject}
          onClose={() => { setShowSidebar(false); setSelectedProject(null); }}
          onApprovalChange={() => {}}
        />
      )}
    </div>
  );
}

// ── EventRow (separated to keep render clean) ────────────────
function EventRow({ event, onClick }) {
  const dateStr = event.targetDate
    ? new Date(event.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "No date";
  const imgSrc = event.coverUrl || event.img || null;
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f1f3f4", cursor: "pointer" }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, flexShrink: 0, overflow: "hidden", background: G.bg, border: `1px solid ${G.border}` }}>
        {imgSrc
          ? <img src={imgSrc} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }} />
          : null
        }
      </div>
      <div>
        <div style={{ fontWeight: 500, color: "#202124", fontSize: 14 }}>
          {event.title || event.alt || "Untitled Event"}
        </div>
        <div style={{ fontSize: 12, color: "#5f6368", marginTop: 2 }}>
          {dateStr}{event.location ? ` · ${event.location}` : ""}
        </div>
      </div>
    </div>
  );
}
