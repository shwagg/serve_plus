//first page for admin after login
import { collection, getDocs } from "firebase/firestore";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebaseConfig";
import "../../styles/AdminDashboard.css";

export default function AdminDashboard() {
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


  // Engagement metrics: only published missions, blank value for now
  const [engagement, setEngagement] = useState([]);

  useEffect(() => {
    const fetchEngagement = async () => {
      try {
        const snap = await getDocs(collection(db, "missions"));
        const rows = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const published = rows.filter((m) => (m.status || "draft") === "published");
        setEngagement(
          published.map((m) => ({
            id: m.id,
            label: m.title || m.alt || m.name || "Untitled Mission",
            value: ""
          }))
        );
      } catch (err) {
        setEngagement([]);
      }
    };
    fetchEngagement();
  }, []);

  return (
    <div className="admin-outlet">
      <h1 className="page-title">Dashboard</h1>
      <div className="dashboard-grid">
        {/* LEFT column cards */}
        <section className="left-col">
          <div className="panel">
            <div className="panel-header panel-header-analytics">
              <span>Students Engagement</span>
            </div>

            <div className="panel-body">
              <div className="bar-list">
                {engagement.map((x) => (
                  <div
                    className="bar-row"
                    key={x.label}
                    style={{ cursor: 'pointer' }}
                    onClick={() => x.id && navigate(`/admin/events/${x.id}`)}
                    title="View Event Monitoring"
                  >
                    <div className="bar-label">{x.label}</div>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${x.value}%` }}
                      />
                      <div className="bar-value">{x.value}%</div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="card-note">
                *Sample only for demo. Replace with real metrics later.
              </p>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header panel-header-analytics">
              <span>Satisfaction Ratings</span>
            </div>

            <div className="panel-body">
              <div className="ratings">
                <div className="rating-row">
                  <span>Volunteer Satisfaction</span>
                  <strong>—</strong>
                </div>
                <div className="rating-row">
                  <span>Faculty/SI Satisfaction</span>
                  <strong>—</strong>
                </div>
                <div className="rating-row">
                  <span>Community Partner Feedback</span>
                  <strong>—</strong>
                </div>
              </div>

              <p className="card-note">
                *Leave blank for now. You can compute later from surveys.
              </p>
            </div>
          </div>
          <div className="panel">
            <div className="panel-header panel-header-analytics">
              <span>SDG Distribution</span>
            </div>

            <div className="panel-body" style={{ textAlign: "center" }}>
              {pieSlices.length === 0 ? (
                <p className="card-note">No SDG data available yet.</p>
              ) : (
                <svg width={CHART_SIZE} height={CHART_SIZE}>
                  {pieSlices.map((slice, index) => {
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
                          fill={`hsl(${index * 45}, 70%, 55%)`}
                        />
                        {slice.percentage >= 5 && (
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#fff"
                            fontSize="12"
                            fontWeight="600"
                          >
                            <tspan x={labelX} dy="-2">
                              SDG {slice.sdgId}
                            </tspan>
                            <tspan x={labelX} dy="14">
                              {slice.percentage}%
                            </tspan>
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              )}

              {/* Description text */}
              {chartData.length > 0 && (
                <p className="card-note" style={{ marginTop: "12px" }}>
                  <strong>
                    {chartData
                      .filter((x) => x.sdgId !== "Others")
                      .slice(0, 2)
                      .map((x) => `SDG ${x.sdgId}`)
                      .join(" & ")}
                  </strong>{" "}
                  account for the largest share of SDG engagements, with the remaining
                  contributions grouped under <strong>Others</strong>.
                </p>
              )}


            </div>
          </div>


        </section>

        {/* RIGHT column panels */}
        <section className="right-col">
          {/* Events Today */}
          <div className="panel">
            <div className="panel-header">
              <span>Events Today</span>
              <button
                className="panel-link"
                type="button"
                onClick={() => navigate("/admin/projects")}
              >
                View all Events
              </button>
            </div>

            <div className="panel-body">
              {eventsToday.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-title">No events today yet</p>
                  <p className="empty-desc">
                    Once you create projects/events (with today’s date + active
                    status), they will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="event-grid">
                  {eventsToday.map((e) => (
                    <div
                      className="event-card"
                      key={e.id}
                      onClick={() => e.id && navigate(`/admin/events/${e.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="event-title">
                        {e.title || e.alt || "Untitled Event"}
                      </div>
                      <div className="event-footer">
                        <span className="event-date">
                          {e.targetDate ? new Date(e.targetDate).toLocaleDateString() : "No date"}
                        </span>
                        <button
                          className="event-details"
                          type="button"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            e.id && navigate(`/admin/events/${e.id}`);
                          }}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="panel">
            <div className="panel-header panel-header-accent">
              <span>Upcoming Events</span>
            </div>

            <div className="panel-body">
              {upcomingEvents.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-title">No upcoming events yet</p>
                  <p className="empty-desc">
                    Future-dated projects will be listed here once added.
                  </p>
                </div>
              ) : (
                <div className="event-grid">
                  {upcomingEvents.map((e) => (
                    <div
                      className="event-card"
                      key={e.id}
                      onClick={() => e.id && navigate(`/admin/events/${e.id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="event-title">
                        {e.title || e.alt || e.name || "Untitled Event"}
                      </div>
                      <div className="event-footer">
                        <span className="event-date">
                          {e.targetDate ? new Date(e.targetDate).toLocaleDateString() : "No date"}
                        </span>
                        <button
                          className="event-details"
                          type="button"
                          onClick={(evt) => {
                            evt.stopPropagation();
                            e.id && navigate(`/admin/events/${e.id}`);
                          }}
                        >
                          Details
                        </button>
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
