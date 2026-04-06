//first page for admin after login
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import "../../styles/AdminDashboard.css";

export default function AdminDashboard() {
  // New: State for summary cards
  const [totalStudents, setTotalStudents] = useState(null);
  const [totalTasks, setTotalTasks] = useState(null);
    // Fetch total registered students
    useEffect(() => {
      const fetchTotalStudents = async () => {
        try {
          const snap = await getDocs(collection(db, "users"));
          setTotalStudents(snap.size);
        } catch (err) {
          setTotalStudents("-");
        }
      };
      fetchTotalStudents();
    }, []);

    // Fetch total completed tasks (assumes a 'tasks' collection with a 'status' field)
    useEffect(() => {
      const fetchTotalTasks = async () => {
        try {
          const snap = await getDocs(collection(db, "tasks"));
          // If tasks have a 'status' field, count only completed
          const completed = snap.docs.filter(doc => (doc.data().status || "") === "completed").length;
          setTotalTasks(completed);
        } catch (err) {
          setTotalTasks("-");
        }
      };
      fetchTotalTasks();
    }, []);
  const navigate = useNavigate();
  //Filled from firestore under 'Missons'
  const [eventsToday, setEventsToday] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  //(Under dashboard) SDG Analytics
  const [sdgAnalytics, setSdgAnalytics] = useState([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const topSDG = sdgAnalytics
    .slice()
    .sort((a, b) => b.count - a.count)[0];
  //For the pie chart
  const CHART_SIZE = 220;
  const RADIUS = 90;
  const CENTER = CHART_SIZE / 2;
  const getPieSlices = (data) => {
    let cumulative = 0;

    return data.map((item) => {
      const startAngle = cumulative * 2 * Math.PI;
      const sliceAngle = (item.percentage / 100) * 2 * Math.PI;
      cumulative += item.percentage / 100;

      return {
        ...item,
        startAngle,
        endAngle: startAngle + sliceAngle,
        midAngle: startAngle + sliceAngle / 2,
      };
    });
  };
  // ---------- SDG CHART DATA (Industry Standard: Top 5 + Others) ----------

  // sort SDGs by percentage (descending)
  const sortedSDGs = [...sdgAnalytics].sort(
    (a, b) => b.percentage - a.percentage
  );

  // take top 5 SDGs
  const topFive = sortedSDGs.slice(0, 5);

  // group the rest as "Others"
  const others = sortedSDGs.slice(5);

  const othersPercentage = others.reduce(
    (sum, x) => sum + x.percentage,
    0
  );

  // final dataset used by the chart
  const chartData =
    others.length > 0
      ? [
        ...topFive,
        {
          sdgId: "Others",
          count: others.reduce((s, x) => s + x.count, 0),
          percentage: Number(othersPercentage.toFixed(1)),
        },
      ]
      : topFive;

  // build pie slices from FINAL chart data
  const pieSlices = getPieSlices(chartData);

  const visibleSlices = pieSlices.filter((x) => x.percentage >= 5);
  const maxCount = Math.max(
    ...visibleSlices.map((x) => x.count),
    0
  );

  const topSDGs = visibleSlices.filter(
    (x) => x.count === maxCount && maxCount > 0
  );



  const describeArc = (cx, cy, r, startAngle, endAngle) => {
    const polarToCartesian = (angle) => ({
      x: cx + r * Math.cos(angle - Math.PI / 2),
      y: cy + r * Math.sin(angle - Math.PI / 2),
    });

    const start = polarToCartesian(endAngle);
    const end = polarToCartesian(startAngle);
    const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

    return `
    M ${start.x} ${start.y}
    A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}
    L ${cx} ${cy}
    Z
  `;
  };

  useEffect(() => {
    const parseMissionDate = (dateStr) => {
      // Accepts (yyyy-mm-dd) or other string formats
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    };

    const isSameDay = (a, b) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const startOfToday = () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    };

    const fetchPublishedMissions = async () => {
      try {
        const snap = await getDocs(collection(db, "missions"));
        const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        // only published missions should be visible as "events" (after complete approval)
        const published = rows.filter(
          (m) => (m.status || "draft") === "published",
        );

        // SDG analytics (only published projects are being counted)
        const sdgCounts = {};
        published.forEach((mission) => {
          (mission.sdgs || []).forEach((sdgId) => {
            sdgCounts[sdgId] = (sdgCounts[sdgId] || 0) + 1;
          });
        });
        const totalSDGAssignments = Object.values(sdgCounts).reduce(
          (sum, c) => sum + c,
          0
        );

        const analytics = Object.entries(sdgCounts).map(([sdgId, count]) => ({
          sdgId: Number(sdgId),
          count,
          percentage: totalSDGAssignments
            ? Number(((count / totalSDGAssignments) * 100).toFixed(1))
            : 0,
        }));

        setSdgAnalytics(analytics);
        setTotalProjects(published.length);

        const today = startOfToday();
        const todayEvents = [];
        const upcoming = [];

        for (const m of published) {
          // Use targetDate as the event date
          const md = parseMissionDate(m.targetDate);
          if (!md) continue;
          const missionDay = new Date(
            md.getFullYear(),
            md.getMonth(),
            md.getDate(),
          );
          if (isSameDay(missionDay, today)) todayEvents.push(m);
          else if (missionDay > today) upcoming.push(m);
        }
        // Sort upcoming by soonest targetDate
        upcoming.sort((a, b) => {
          const da = parseMissionDate(a.targetDate);
          const db = parseMissionDate(b.targetDate);
          return (da || 0) - (db || 0);
        });
        setEventsToday(todayEvents);
        setUpcomingEvents(upcoming);
      } catch (err) {
        console.error("Failed to load missions for dashboard:", err);
        setEventsToday([]);
        setUpcomingEvents([]);
      }
    };

    fetchPublishedMissions();
  }, []);


  // Real-time Student Engagement metrics for each mission
  const [engagement, setEngagement] = useState([]);
  useEffect(() => {
    const fetchEngagement = async () => {
      try {
        const snap = await getDocs(collection(db, "missions"));
        const missions = snap.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((doc) => doc.status === "published");

        const engagementArr = [];
        for (const mission of missions) {
          const volSnap = await getDocs(collection(db, "missions", mission.id, "volunteer"));
          const volunteers = volSnap.docs.map(d => d.data());
          const total = volunteers.length;
          const count = (key, value) => volunteers.filter(v => v.progress?.[key] === value).length;
          const completed =
            count("preSurvey", "submitted") +
            count("consent", "submitted") +
            count("attendance", "present") +
            count("postSurvey", "submitted");
          const maxPossible = total * 4;
          const percent = maxPossible === 0 ? 0 : Math.round((completed / maxPossible) * 100);
          engagementArr.push({
            id: mission.id,
            label: mission.title || mission.alt || mission.name || "Untitled Mission",
            value: percent
          });
        }
        setEngagement(engagementArr);
      } catch (err) {
        setEngagement([]);
      }
    };
    fetchEngagement();
  }, []);

  return (
    <div className="admin-outlet">
      <h1 className="page-title">Dashboard</h1>

      {/* Summary cards row */}
      <div style={{ display: 'flex', gap: 18, marginBottom: 18, flexWrap: 'wrap' }}>
                <div style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 12,
                  boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
                  minWidth: 220,
                  flex: '1 1 220px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '18px 22px',
                  gap: 16
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', background: 'rgba(76, 72, 255, 0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10
                  }}>
                    <svg width="26" height="26" fill="none" viewBox="0 0 24 24"><g><rect width="24" height="24" fill="none"/><path d="M7 7h10v2H7V7Zm0 4h10v2H7v-2Zm0 4h7v2H7v-2Zm-2-9.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-13ZM6.5 5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h11a.5.5 0 0 0 .5-.5v-13a.5.5 0 0 0-.5-.5h-11Z" fill="#4C48FF"/></g></svg>
                  </div>
                  <div>
                    <div style={{ color: '#8A94A6', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Total Published Events</div>
                    <div style={{ color: '#1f3b73', fontSize: 26, fontWeight: 700 }}>{typeof totalProjects === 'number' ? totalProjects : '...'}</div>
                  </div>
                </div>
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
          minWidth: 220,
          flex: '1 1 220px',
          display: 'flex',
          alignItems: 'center',
          padding: '18px 22px',
          gap: 16
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: 'rgba(76, 72, 255, 0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10
          }}>
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24"><g><rect width="24" height="24" fill="none"/><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z" fill="#4C48FF"/></g></svg>
          </div>
          <div>
            <div style={{ color: '#8A94A6', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Total registered volunteers</div>
            <div style={{ color: '#1f3b73', fontSize: 26, fontWeight: 700 }}>{totalStudents === null ? '...' : totalStudents}</div>
          </div>
        </div>
        <div style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
          minWidth: 220,
          flex: '1 1 220px',
          display: 'flex',
          alignItems: 'center',
          padding: '18px 22px',
          gap: 16
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: 'rgba(48, 189, 183, 0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: 10
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><g><rect width="24" height="24" fill="none"/><path d="M17.5 10.5l-5 5-2.5-2.5" stroke="#30bdb7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="12" r="10" stroke="#30bdb7" strokeWidth="2"/></g></svg>
          </div>
          <div>
            <div style={{ color: '#8A94A6', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Total tasks completed</div>
            <div style={{ color: '#1f3b73', fontSize: 26, fontWeight: 700 }}>{totalTasks === null ? '...' : totalTasks}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* LEFT column cards */}
        <section className="left-col">
          {/* Students Engagement - Real-Time Metrics Styled */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(31,59,115,0.07)',
            marginBottom: 24,
            padding: 0,
            border: 'none',
            overflow: 'visible',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '24px 32px 0 32px',
              background: 'transparent',
              borderRadius: '16px 16px 0 0',
            }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: '50%', background: '#e6eaff',
              }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><g><rect width="24" height="24" fill="none"/><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z" fill="#4C48FF"/></g></svg>
              </span>
              <span style={{ color: '#1f3b73', fontWeight: 700, fontSize: 20 }}>Volunteers Engagement</span>
            </div>
            <div style={{ background: '#f8faff', borderRadius: '0 0 16px 16px', marginTop: 18, padding: '0 32px 24px 32px', minHeight: 60 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 8 }}>
                {engagement.map((x) => (
                  <div
                    key={x.label}
                    style={{ marginBottom: 2, cursor: 'pointer' }}
                    onClick={() => x.id && navigate(`/admin/projects/${x.id}`)}
                    title="View Project Details"
                  >
                    <div style={{ fontWeight: 600, color: '#1f3b73', fontSize: 15, marginBottom: 6 }}>{x.label}</div>
                    <div style={{ background: '#e6eaf3', borderRadius: 8, height: 18, position: 'relative', overflow: 'hidden', width: '100%' }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #4C48FF 60%, #30bdb7 100%)',
                        width: `${x.value}%`,
                        borderRadius: 8,
                        transition: 'width 0.3s',
                      }} />
                      <div style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 13,
                        color: '#fff',
                        fontWeight: 700,
                        background: 'linear-gradient(90deg, #4C48FF 60%, #30bdb7 100%)',
                        padding: '1px 14px',
                        borderRadius: 12,
                        minWidth: 36,
                        textAlign: 'center',
                        boxShadow: '0 1px 4px rgba(31,59,115,0.08)',
                      }}>{x.value}%</div>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ margin: '14px 0 0 0', fontSize: 12, color: '#8A94A6' }}>
                *Sample only for demo. Replace with real metrics later.
              </p>
            </div>
          </div>

          {/* Satisfaction Ratings - Modern Styled */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(31,59,115,0.07)',
            marginBottom: 24,
            padding: 0,
            border: 'none',
            overflow: 'visible',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '24px 32px 0 32px',
              background: 'transparent',
              borderRadius: '16px 16px 0 0',
            }}>
              <span style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: '50%', background: '#e6eaff',
              }}>
                <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><g><rect width="24" height="24" fill="none"/><path d="M12 2a1 1 0 0 1 1 1v1.07A7.002 7.002 0 0 1 19.93 11H21a1 1 0 1 1 0 2h-1.07A7.002 7.002 0 0 1 13 19.93V21a1 1 0 1 1-2 0v-1.07A7.002 7.002 0 0 1 4.07 13H3a1 1 0 1 1 0-2h1.07A7.002 7.002 0 0 1 11 4.07V3a1 1 0 0 1 1-1Z" fill="#4C48FF"/></g></svg>
              </span>
              <span style={{ color: '#1f3b73', fontWeight: 700, fontSize: 20 }}>Satisfaction Ratings</span>
            </div>
            <div style={{ background: '#f8faff', borderRadius: '0 0 16px 16px', marginTop: 18, padding: '0 32px 24px 32px', minHeight: 60 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#1f3b73', fontWeight: 500 }}>
                  <span>Volunteer Satisfaction</span>
                  <span style={{ color: '#8A94A6', fontWeight: 700 }}>—</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#1f3b73', fontWeight: 500 }}>
                  <span>Faculty/SI Satisfaction</span>
                  <span style={{ color: '#8A94A6', fontWeight: 700 }}>—</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: '#1f3b73', fontWeight: 500 }}>
                  <span>Community Partner Feedback</span>
                  <span style={{ color: '#8A94A6', fontWeight: 700 }}>—</span>
                </div>
              </div>
              <p style={{ margin: '14px 0 0 0', fontSize: 12, color: '#8A94A6' }}>
                *Leave blank for now. You can compute later from surveys.
              </p>
            </div>
          </div>
          {/* SDG Distribution - Modern Styled */}
          <div style={{
            background: '#fff',
            borderRadius: 24,
            boxShadow: '0 4px 24px rgba(31,59,115,0.07)',
            marginBottom: 24,
            padding: 0,
            border: 'none',
            overflow: 'visible',
            textAlign: 'center',
          }}>
            <div style={{ padding: '32px 0 0 0', textAlign: 'center' }}>
              <span style={{ color: '#1f3b73', fontWeight: 700, fontSize: 28, letterSpacing: 0.5 }}>SDG Distribution</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, padding: '0 0 0 0' }}>
              {pieSlices.length === 0 ? (
                <p style={{ color: '#8A94A6', fontSize: 16, marginTop: 40 }}>No SDG data available yet.</p>
              ) : (
                <svg width={CHART_SIZE} height={CHART_SIZE} style={{ margin: '32px 0 0 0' }}>
                  {pieSlices.map((slice, index) => {
                    // Use a simple color palette for clarity
                    const palette = ['#e6f0fa', '#ff5c5c', '#7cff7c', '#ffe066', '#6ec6ff', '#b388ff', '#ffb3b3'];
                    const path = describeArc(
                      CENTER,
                      CENTER,
                      RADIUS,
                      slice.startAngle,
                      slice.endAngle
                    );
                    const labelX =
                      CENTER + (RADIUS * 0.6) * Math.cos(slice.midAngle - Math.PI / 2);
                    const labelY =
                      CENTER + (RADIUS * 0.6) * Math.sin(slice.midAngle - Math.PI / 2);
                    return (
                      <g key={slice.sdgId}>
                        <path
                          d={path}
                          fill={palette[index % palette.length]}
                        />
                        {slice.percentage >= 5 && (
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={index === 1 ? '#fff' : '#1f3b73'}
                            fontSize="13"
                            fontWeight="700"
                          >
                            <tspan x={labelX} dy="-2">SDG {slice.sdgId}</tspan>
                            <tspan x={labelX} dy="15">{slice.percentage}%</tspan>
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
            {/* Description text */}
            {chartData.length > 0 && (
              <p style={{ margin: '32px 0 0 0', fontSize: 16, color: '#8A94A6', fontWeight: 500, padding: '0 32px 32px 32px', lineHeight: 1.5 }}>
                <span style={{ color: '#1f3b73', fontWeight: 700 }}>
                  {chartData
                    .filter((x) => x.sdgId !== "Others")
                    .slice(0, 2)
                    .map((x) => `SDG ${x.sdgId}`)
                    .join(" & ")}
                </span>
                {` account for the largest share of SDG engagements, with the remaining contributions grouped under `}
                <span style={{ color: '#1f3b73', fontWeight: 700 }}>Others</span>.
              </p>
            )}
          </div>


        </section>

        {/* RIGHT column panels */}
        <section className="right-col">
          {/* Events Today - Custom Styled */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(31,59,115,0.07)',
            marginBottom: 24,
            padding: 0,
            border: 'none',
            overflow: 'visible',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 32px 0 32px',
              background: 'transparent',
              borderRadius: '16px 16px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: '50%', background: '#ffe6e6',
                }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><g><rect width="24" height="24" fill="none"/><path d="M12 2a1 1 0 0 1 1 1v1.07A7.002 7.002 0 0 1 19.93 11H21a1 1 0 1 1 0 2h-1.07A7.002 7.002 0 0 1 13 19.93V21a1 1 0 1 1-2 0v-1.07A7.002 7.002 0 0 1 4.07 13H3a1 1 0 1 1 0-2h1.07A7.002 7.002 0 0 1 11 4.07V3a1 1 0 0 1 1-1Zm0 4a5 5 0 1 0 0 10A5 5 0 0 0 12 6Z" fill="#ff5c5c"/></g></svg>
                </span>
                <span style={{ color: '#1f3b73', fontWeight: 700, fontSize: 20 }}>Events Today</span>
              </div>
              <button
                style={{
                  background: '#4C48FF', color: '#fff', border: 'none', borderRadius: 18,
                  fontWeight: 700, fontSize: 15, padding: '8px 24px', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(76,72,255,0.08)',
                  transition: 'background 0.2s',
                }}
                type="button"
                onClick={() => navigate("/admin/projects")}
              >
                View All Events
              </button>
            </div>
            <div style={{ background: '#f8faff', borderRadius: '0 0 16px 16px', marginTop: 18, padding: '0 32px 24px 32px', minHeight: 90 }}>
              {eventsToday.length === 0 ? (
                <div style={{ border: '1px dashed #e5e7eb', borderRadius: 12, background: '#fff', padding: 24, marginTop: 8 }}>
                  <p style={{ fontWeight: 700, color: '#1f3b73', fontSize: 18, margin: 0 }}>No Events today yet!</p>
                  <p style={{ color: '#8A94A6', fontSize: 15, margin: '8px 0 0 0' }}>
                    Once you create project/events (with today’s date + active status), they will appear here automatically.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 8 }}>
                  {eventsToday.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => e.id && navigate(`/admin/events/${e.id}`)}
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        boxShadow: '0 2px 8px rgba(31,59,115,0.04)',
                        padding: '18px 22px',
                        display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
                        border: '1px solid #f0f1f7',
                        transition: 'box-shadow 0.2s',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#1f3b73', fontSize: 17 }}>{e.title || e.alt || 'Untitled Event'}</div>
                      <div style={{ color: '#8A94A6', fontSize: 14, marginBottom: 6 }}>
                        {e.proponent ? `proposed by: (${e.proponent})` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        {/* Placeholder avatars */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: -8 }}>
                          {[1,2,3,4].map((_, idx) => (
                            <img key={idx} src={`https://randomuser.me/api/portraits/men/${idx+10}.jpg`} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #fff', marginLeft: idx === 0 ? 0 : -12, boxShadow: '0 1px 4px rgba(31,59,115,0.08)' }} />
                          ))}
                          <span style={{ marginLeft: 6, background: '#4C48FF', color: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 700, padding: '2px 10px' }}>18+</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events - Custom Styled */}
          <div style={{
            background: '#fff',
            borderRadius: 16,
            boxShadow: '0 4px 24px rgba(31,59,115,0.07)',
            marginBottom: 24,
            padding: 0,
            border: 'none',
            overflow: 'visible',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '24px 32px 0 32px',
              background: 'transparent',
              borderRadius: '16px 16px 0 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 38, height: 38, borderRadius: '50%', background: '#e6f7ff',
                }}>
                  <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><g><rect width="24" height="24" fill="none"/><path d="M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0Zm-5-9a1 1 0 0 1 1 1v1.07A7.002 7.002 0 0 1 19.93 11H21a1 1 0 1 1 0 2h-1.07A7.002 7.002 0 0 1 13 19.93V21a1 1 0 1 1-2 0v-1.07A7.002 7.002 0 0 1 4.07 13H3a1 1 0 1 1 0-2h1.07A7.002 7.002 0 0 1 11 4.07V3a1 1 0 0 1 1-1Z" fill="#30bdb7"/></g></svg>
                </span>
                <span style={{ color: '#1f3b73', fontWeight: 700, fontSize: 20 }}>Upcoming Events</span>
              </div>
            </div>
            <div style={{ background: '#f8faff', borderRadius: '0 0 16px 16px', marginTop: 18, padding: '0 32px 24px 32px', minHeight: 90 }}>
              {upcomingEvents.length === 0 ? (
                <div style={{ border: '1px dashed #e5e7eb', borderRadius: 12, background: '#fff', padding: 24, marginTop: 8 }}>
                  <p style={{ fontWeight: 700, color: '#1f3b73', fontSize: 18, margin: 0 }}>No upcoming events yet</p>
                  <p style={{ color: '#8A94A6', fontSize: 15, margin: '8px 0 0 0' }}>
                    Future-dated projects will be listed here once added.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 8 }}>
                  {upcomingEvents.map((e) => (
                    <div
                      key={e.id}
                      onClick={() => e.id && navigate(`/admin/events/${e.id}`)}
                      style={{
                        background: '#fff',
                        borderRadius: 14,
                        boxShadow: '0 2px 8px rgba(31,59,115,0.04)',
                        padding: '18px 22px',
                        display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
                        border: '1px solid #f0f1f7',
                        transition: 'box-shadow 0.2s',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#1f3b73', fontSize: 17 }}>{e.title || e.alt || e.name || 'Untitled Event'}</div>
                      <div style={{ color: '#8A94A6', fontSize: 14, marginBottom: 6 }}>
                        {e.proponent ? `proposed by: (${e.proponent})` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                        {/* Placeholder avatars */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: -8 }}>
                          {[1,2,3,4].map((_, idx) => (
                            <img key={idx} src={`https://randomuser.me/api/portraits/men/${idx+20}.jpg`} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #fff', marginLeft: idx === 0 ? 0 : -12, boxShadow: '0 1px 4px rgba(31,59,115,0.08)' }} />
                          ))}
                          <span style={{ marginLeft: 6, background: '#30bdb7', color: '#fff', borderRadius: 12, fontSize: 13, fontWeight: 700, padding: '2px 10px' }}>18+</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
