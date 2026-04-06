import React from "react";

// Main ImpactMetrics Modal Component
export default function ImpactMetrics({
  open,
  onClose,
  volunteers,
  showType, // 'pre' or 'post'
}) {
  if (!open) return null;

  // --- Field order for Pre and Post Activity Survey ---
  const preFieldOrder = [
    { key: 'respondent.college', label: 'College/Department/Organization:' },
    { key: 'respondent.program', label: 'Program:' },
    { key: 'engagement.type', label: 'Type of Engagement:' },
    { key: 'engagement.initiativeTitle', label: 'Title of Initiative:' },
    { key: 'engagement.participation', label: 'Type/Level of Participation:' },
    { key: 'background.previousService', label: 'Previous Community Service Experience:' },
    { key: 'background.frequency', label: 'Frequency of Community Service:' },
  ];
  // --- Likert scale questions for Pre Activity Survey ---
  const preLikertQuestions = [
    {
      key: 'q1',
      label: 'There are existing problems in the community and I can come up with ideas, suggestions, and solutions to address these problems and issues.'
    },
    {
      key: 'q2',
      label: 'Volunteer work along with teamwork would somehow help solve social problems.'
    },
    {
      key: 'q3',
      label: 'People in the community come from diverse background, culture, and social standing and it is important to understand these differences in order to help solve problems.'
    },
    {
      key: 'q4',
      label: 'I would like to make a difference in the community because I have a social and moral obligation to do so. I would do this even if my contribution would seem very little.'
    },
    {
      key: 'q5',
      label: 'Contributing and improving skills I’ve learned from my degree program or affiliation would somehow solve social problems.'
    },
    {
      key: 'q6',
      label: 'I would definitely participate in community development initiatives but it would be the last of my priorities because I have to consider other aspects of my life first such as academics, friends, family, recreation, etc.'
    },
    {
      key: 'q7',
      label: 'I think that the magnitude of issues in our country and in the world in general is so big that whatever I do to help would be insignificant and would not make any difference.'
    },
    {
      key: 'q8',
      label: 'I would consider participating in community development initiatives whenever I can, and with proper time management and the initiative to do so, I definitely can.'
    },
  ];

  // Render pie/donut chart and legend for each field
  // --- Pie Chart Renderer for Pre Activity Survey (Styled & Hoverable) ---
  const renderPieChartAndLegend = (counts, colorList) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const entries = Object.entries(counts);
    const radius = 60;
    const cx = 80, cy = 80, r = radius;
    let acc = 0;
    // Pie slice data
    const pieData = entries.map(([answer, count], idx) => {
      const value = count / total;
      const startAngle = acc;
      const endAngle = acc + value * 2 * Math.PI;
      acc = endAngle;
      return { answer, count, idx, value, startAngle, endAngle };
    });
    // Helper for arc path
    function describeArc(cx, cy, r, startAngle, endAngle) {
      const polarToCartesian = (cx, cy, r, angle) => [
        cx + r * Math.cos(angle - Math.PI / 2),
        cy + r * Math.sin(angle - Math.PI / 2)
      ];
      const [x1, y1] = polarToCartesian(cx, cy, r, startAngle);
      const [x2, y2] = polarToCartesian(cx, cy, r, endAngle);
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      return [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');
    }
    // Helper for label position
    function getLabelPos(cx, cy, r, startAngle, endAngle) {
      const angle = (startAngle + endAngle) / 2;
      const labelR = r + 24;
      return [
        cx + labelR * Math.cos(angle - Math.PI / 2),
        cy + labelR * Math.sin(angle - Math.PI / 2)
      ];
    }
    // Tooltip state (React hook)
    const [tooltip, setTooltip] = React.useState({ show: false, x: 0, y: 0, label: '', count: 0, percent: 0 });
    // Mouse event handlers
    const handleMouseOver = (e, label, count, percent) => {
      const rect = e.target.getBoundingClientRect();
      setTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        label,
        count,
        percent,
      });
    };
    const handleMouseOut = () => setTooltip({ ...tooltip, show: false });
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 18, position: 'relative' }}>
        <svg width={cx * 2.2} height={cy * 2.1} viewBox={`0 0 ${cx * 2.2} ${cy * 2.1}`}> 
          {pieData.map((d, idx) => (
            <path
              key={d.answer}
              d={describeArc(cx, cy, r, d.startAngle, d.endAngle)}
              fill={colorList[idx % colorList.length]}
              stroke="#fff"
              strokeWidth={2}
              style={{ cursor: 'pointer', transition: 'filter 0.2s' }}
              onMouseOver={e => handleMouseOver(e, d.answer, d.count, Math.round((d.count / total) * 100))}
              onMouseOut={handleMouseOut}
            />
          ))}
          {/* Percentage labels outside each slice */}
          {pieData.map((d, idx) => {
            const percent = Math.round((d.count / total) * 100);
            if (percent === 0) return null;
            const [lx, ly] = getLabelPos(cx, cy, r, d.startAngle, d.endAngle);
            return (
              <text
                key={d.answer + '-label'}
                x={lx}
                y={ly}
                textAnchor="middle"
                fontSize="16"
                fontWeight="bold"
                fill={colorList[idx % colorList.length]}
                alignmentBaseline="middle"
              >
                {percent}%
              </text>
            );
          })}
        </svg>
        {/* Tooltip */}
        {tooltip.show && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: '8px 14px',
              boxShadow: '0 2px 8px #0002',
              pointerEvents: 'none',
              zIndex: 9999,
              fontSize: 14,
              color: '#23335b',
              whiteSpace: 'nowrap',
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div style={{ fontWeight: 600 }}>{tooltip.label}</div>
            <div>Count: {tooltip.count} ({tooltip.percent}%)</div>
          </div>
        )}
        {/* Horizontal legend below the chart */}
        <div style={{ display: 'flex', gap: 18, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {entries.map(([answer, count], idx) => (
            <div key={answer} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15 }}>
              <span style={{ width: 18, height: 8, borderRadius: 4, background: colorList[idx % colorList.length], display: 'inline-block' }}></span>
              <span style={{ color: colorList[idx % colorList.length], fontWeight: 500 }}>{answer}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Helper to get value by dot notation
  // --- Helper: Get value by dot notation path ---
  function getValueByPath(obj, path) {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
  }

  // --- Field order and likert for Post Activity Survey ---
  const postFieldOrder = [
    { key: 'respondent.college', label: 'College/Department/Organization:' },
    { key: 'respondent.program', label: 'Program:' },
    { key: 'engagement.type', label: 'Type of Engagement:' },
    { key: 'engagement.initiativeTitle', label: 'Title of Initiative:' },
    { key: 'engagement.participation', label: 'Type/Level of Participation:' },
    { key: 'background.previousService', label: 'Previous Community Service Experience:' },
    { key: 'background.frequency', label: 'Frequency of Community Service:' },
  ];
  const postLikertQuestions = [
    {
      key: 'q1',
      label:
        'The ideas, suggestions, and solutions that were implemented during the community service helped in providing solutions to the problems and issues in the community.'
    },
    {
      key: 'q2',
      label:
        'The community service brought about initiatives and teamwork that somehow addressed the problems and issues at hand.'
    },
    {
      key: 'q3',
      label:
        'Being able to understand the diversity of the people involved in the community allowed for a successful implementation of the community service initiative.'
    },
    {
      key: 'q4',
      label:
        'Through the community service initiative, I was able to realize the role that I have to play in the society both as a student and a Filipino citizen.'
    },
    {
      key: 'q5',
      label:
        'The profession that I will pursue in the future along with the knowledge and skills that I would be able to develop would contribute to addressing social problems and issues.'
    },
    {
      key: 'q6',
      label:
        'I consider community development initiatives to be the last of my priorities. I think that by focusing on academics, friends, family, recreation, etc. I would be able to help the society more.'
    },
    {
      key: 'q7',
      label:
        'I think that my participation in the community service initiative did not help the community or the country let alone the world. My involvement was insignificant and did not make any difference.'
    },
    {
      key: 'q8',
      label:
        'I was able to realize that participating in community development initiatives, no matter how big or small the involvement is, would make a difference. As such, I am willing to manage my time and have the initiative to participate whenever there is an opportunity.'
    },
  ];

  // Helper to get value by dot notation path
  function getValueByPath(obj, path) {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
  }

  // Aggregation logic for pre/post survey based on showType
  const surveyFieldOrder = showType === 'post' ? postFieldOrder : preFieldOrder;
  const surveyLikertQuestions = showType === 'post' ? postLikertQuestions : preLikertQuestions;
  const surveyAnswerKey = showType === 'post' ? 'postSurveyAnswers' : 'preSurveyAnswers';

  // Aggregate analytics for selected survey
  const surveyAnalytics = {};
  if (Array.isArray(volunteers)) {
    surveyFieldOrder.forEach(({ key }) => {
      const counts = {};
      volunteers.forEach(v => {
        const ans = v[surveyAnswerKey];
        if (!ans) return;
        const val = getValueByPath(ans, key);
        if (val === undefined || val === null || val === "") return;
        if (Array.isArray(val)) {
          val.forEach(item => {
            if (!item) return;
            counts[item] = (counts[item] || 0) + 1;
          });
        } else {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
      surveyAnalytics[key] = counts;
    });
  }


  // --- Begin: Analytics Summary Header ---
  // Calculate summary values
  // --- Summary Metrics ---
  const totalVolunteers = Array.isArray(volunteers) ? volunteers.length : 0;
  const preSurveyTotal = Array.isArray(volunteers) ? volunteers.filter(v => v.preSurveyAnswers).length : 0;
  const postSurveyTotal = Array.isArray(volunteers) ? volunteers.filter(v => v.postSurveyAnswers).length : 0;
  // If you have community feedback form data, replace 0 with the actual count
  const communityFeedbackTotal = 0;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(44,62,80,0.18)',
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      {/* --- Main Modal Container --- */}
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 32,
          minWidth: 400,
          maxWidth: '90vw',
          boxShadow: '0 2px 16px #0002',
          position: 'relative',
          color: '#000',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* --- Analytics Summary Header (Top Section) --- */}
        {/* --- Metrics Row: Volunteers, Pre, Post, Community Feedback --- */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          marginBottom: 32,
          padding: '0 8px',
        }}>
          <div style={{
            background: '#2563eb',
            borderRadius: 12,
            width: 56,
            height: 56,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 18,
          }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24"><rect width="24" height="24" rx="6" fill="#2563eb"/><path d="M7.5 7.5h9m-9 3h9m-9 3h6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="4.75" y="4.75" width="14.5" height="14.5" rx="3.25" stroke="#fff" strokeWidth="1.5"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#23335b', marginBottom: 2 }}>Impact & Feedback Analytics</div>
            <div style={{ fontSize: 15, color: '#4b5563', fontWeight: 500 }}>Overview of survey participation and feedback</div>
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: 24,
          marginBottom: 32,
          flexWrap: 'wrap',
          justifyContent: 'flex-start',
        }}>
          {/* Metric: Volunteers Registered */}
          <div style={{
            minWidth: 160,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#f8fafc',
            border: '1.5px solid #e3eafc',
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 1px 4px #0001',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zM21 21v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <div>
              <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>Volunteers Registered</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#23335b' }}>{totalVolunteers}</div>
            </div>
          </div>
          {/* Metric: Pre Activity Survey Answers */}
          <div style={{
            minWidth: 160,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#f8fafc',
            border: '1.5px solid #e3eafc',
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 1px 4px #0001',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#2563eb" strokeWidth="1.5"/><path d="M7 8h10M7 12h6" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <div>
              <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>Pre Activity Survey Answers</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#23335b' }}>{preSurveyTotal}</div>
            </div>
          </div>
          {/* Metric: Post Activity Survey Answers */}
          <div style={{
            minWidth: 160,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#f8fafc',
            border: '1.5px solid #e3eafc',
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 1px 4px #0001',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#2563eb" strokeWidth="1.5"/><path d="M7 8h10M7 12h6" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <div>
              <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>Post Activity Survey Answers</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#23335b' }}>{postSurveyTotal}</div>
            </div>
          </div>
          {/* Metric: Community Feedback Form */}
          <div style={{
            minWidth: 160,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#f8fafc',
            border: '1.5px solid #e3eafc',
            borderRadius: 12,
            padding: '16px 18px',
            boxShadow: '0 1px 4px #0001',
          }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="3" stroke="#2563eb" strokeWidth="1.5"/><path d="M7 8h10M7 12h6" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <div>
              <div style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>Community Feedback Form</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#23335b' }}>{communityFeedbackTotal}</div>
            </div>
          </div>
        </div>
        {/* --- End Analytics Summary Header --- */}
        {/* --- Survey Analytics Section (Pre or Post) --- */}
        <h2 style={{ textAlign: 'left', marginBottom: 24, color: '#000' }}>
          {showType === 'post' ? 'Post Activity Survey Analytics' : 'Pre Activity Survey Analytics'}
        </h2>
        {Array.isArray(volunteers) && volunteers.filter(v => v[surveyAnswerKey]).length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24,
              marginTop: 12,
              alignItems: 'stretch',
            }}
          >
            {/* --- Survey Field Cards --- */}
            {surveyFieldOrder.map(({ key, label }) => {
              const content = surveyAnalytics[key];
              if (!content || Object.keys(content).length === 0) return null;
              const entryCount = Object.keys(content).length;
              const isSingleAnswer = entryCount === 1;
              const dynamicMinHeight = isSingleAnswer ? 120 : Math.max(180, Math.min(320, 120 + entryCount * 32));
              const dynamicPadding = isSingleAnswer ? '12px 10px' : (entryCount > 4 ? '18px 16px' : '28px 24px');
              return (
                <div
                  key={key}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 12px #0001',
                    padding: dynamicPadding,
                    border: '1.5px solid #e3eafc',
                    minHeight: dynamicMinHeight,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'stretch',
                    transition: 'min-height 0.2s, padding 0.2s',
                    fontSize: isSingleAnswer ? 15 : undefined,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{label}</div>
                  <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>{Object.values(content).reduce((a, b) => a + b, 0)} responses</div>
                  {showType === 'post'
                    ? renderBarGraphAndLegend(content, ['#1a237e', '#43a047', '#fbc02d', '#e53935', '#8e24aa'])
                    : renderPieChartAndLegend(content, ['#1a237e', '#43a047', '#fbc02d', '#e53935', '#8e24aa'])}
                </div>
              );
            })}
            {/* --- Survey Likert Cards --- */}
            {surveyLikertQuestions.map(({ key, label }) => {
              const counts = {};
              if (Array.isArray(volunteers)) {
                volunteers.forEach(v => {
                  const ans = v[surveyAnswerKey];
                  if (!ans || !ans.likert) return;
                  const val = ans.likert[key];
                  if (val === undefined || val === null || val === "") return;
                  counts[val] = (counts[val] || 0) + 1;
                });
              }
              if (Object.keys(counts).length === 0) return null;
              const entryCount = Object.keys(counts).length;
              const dynamicMinHeight = Math.max(180, Math.min(320, 120 + entryCount * 32));
              const dynamicPadding = entryCount > 4 ? '18px 16px' : '28px 24px';
              return (
                <div
                  key={key}
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 2px 12px #0001',
                    padding: dynamicPadding,
                    border: '1.5px solid #e3eafc',
                    minHeight: dynamicMinHeight,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'stretch',
                    transition: 'min-height 0.2s, padding 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{label}</div>
                  <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>{Object.values(counts).reduce((a, b) => a + b, 0)} responses</div>
                  {showType === 'post'
                    ? renderBarGraphAndLegend(counts, ['#1a237e', '#43a047', '#fbc02d', '#e53935', '#8e24aa'])
                    : renderPieChartAndLegend(counts, ['#1a237e', '#43a047', '#fbc02d', '#e53935', '#8e24aa'])}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: '#888', textAlign: 'center', margin: '32px 0' }}>
            No submissions yet.
          </div>
        )}
      </div>
    </div>
  );
}

// PostSurveyAnalytics Component (Bar Graphs for Post Activity Survey)
function PostSurveyAnalytics({ volunteers }) {
  // You can adjust these fields and questions as needed for your post survey
  // --- Field order for Post Activity Survey ---
  const postFieldOrder = [
    { key: 'respondent.college', label: 'College/Department/Organization:' },
    { key: 'respondent.program', label: 'Program:' },
    { key: 'engagement.type', label: 'Type of Engagement:' },
    { key: 'engagement.initiativeTitle', label: 'Title of Initiative:' },
    { key: 'engagement.participation', label: 'Type/Level of Participation:' },
    { key: 'background.previousService', label: 'Previous Community Service Experience:' },
    { key: 'background.frequency', label: 'Frequency of Community Service:' },
  ];
  // --- Likert scale questions for Post Activity Survey ---
  const postLikertQuestions = [
    {
      key: 'q1',
      label:
        'The ideas, suggestions, and solutions that were implemented during the community service helped in providing solutions to the problems and issues in the community.'
    },
    {
      key: 'q2',
      label:
        'The community service brought about initiatives and teamwork that somehow addressed the problems and issues at hand.'
    },
    {
      key: 'q3',
      label:
        'Being able to understand the diversity of the people involved in the community allowed for a successful implementation of the community service initiative.'
    },
    {
      key: 'q4',
      label:
        'Through the community service initiative, I was able to realize the role that I have to play in the society both as a student and a Filipino citizen.'
    },
    {
      key: 'q5',
      label:
        'The profession that I will pursue in the future along with the knowledge and skills that I would be able to develop would contribute to addressing social problems and issues.'
    },
    {
      key: 'q6',
      label:
        'I consider community development initiatives to be the last of my priorities. I think that by focusing on academics, friends, family, recreation, etc. I would be able to help the society more.'
    },
    {
      key: 'q7',
      label:
        'I think that my participation in the community service initiative did not help the community or the country let alone the world. My involvement was insignificant and did not make any difference.'
    },
    {
      key: 'q8',
      label:
        'I was able to realize that participating in community development initiatives, no matter how big or small the involvement is, would make a difference. As such, I am willing to manage my time and have the initiative to participate whenever there is an opportunity.'
    },
  ];

  // Helper to get value by dot notation
  // --- Helper: Get value by dot notation path ---
  function getValueByPath(obj, path) {
    return path.split('.').reduce((o, p) => (o ? o[p] : undefined), obj);
  }

  // Aggregate post survey analytics
  // --- Aggregate post survey analytics ---
  const postSurveyAnalytics = {};
  if (Array.isArray(volunteers)) {
    postFieldOrder.forEach(({ key }) => {
      const counts = {};
      volunteers.forEach(v => {
        const ans = v.postSurveyAnswers;
        if (!ans) return;
        const val = getValueByPath(ans, key);
        if (val === undefined || val === null || val === "") return;
        if (Array.isArray(val)) {
          val.forEach(item => {
            if (!item) return;
            counts[item] = (counts[item] || 0) + 1;
          });
        } else {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
      postSurveyAnalytics[key] = counts;
    });
  }

  // Render bar graph and legend for each field (for post activity metrics)
  // --- Bar Graph Renderer for Post Activity Survey ---
  const renderBarGraphAndLegend = (counts, colorList) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const entries = Object.entries(counts).sort((a, b) => Number(a[0]) - Number(b[0]));
    const maxCount = Math.max(...Object.values(counts), 1);
    const barColors = [
      '#e53935', // red
      '#fb8c00', // orange
      '#fbc02d', // yellow
      '#7cb342', // green
      '#00bfae', // teal
      '#1e88e5', // blue
      '#8e24aa', // purple
    ];
    const barWidth = 56;
    const barGap = 32;
    const chartHeight = 180;
    const chartWidth = entries.length * (barWidth + barGap);
    // Tooltip state (React hook)
    const [tooltip, setTooltip] = React.useState({ show: false, x: 0, y: 0, label: '', count: 0, percent: 0 });
    // Mouse event handlers
    const handleMouseOver = (e, label, count, percent) => {
      const rect = e.target.getBoundingClientRect();
      setTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
        label,
        count,
        percent,
      });
    };
    const handleMouseOut = () => setTooltip({ ...tooltip, show: false });
    return (
      <div style={{ width: '100%', minWidth: 320, margin: '0 auto', position: 'relative', marginBottom: 18 }}>
        <svg width={chartWidth} height={chartHeight + 40} style={{ display: 'block', margin: '0 auto' }}>
          {/* Y axis grid lines */}
          {[0.25, 0.5, 0.75, 1].map((v, i) => (
            <line
              key={i}
              x1={0}
              x2={chartWidth}
              y1={chartHeight - v * chartHeight}
              y2={chartHeight - v * chartHeight}
              stroke="#eee"
              strokeDasharray="4 4"
            />
          ))}
          {/* Bars */}
          {entries.map(([answer, count], idx) => {
            const percent = ((count / total) * 100).toFixed(1);
            const barHeight = (count / maxCount) * (chartHeight - 10);
            return (
              <g key={answer}>
                <rect
                  x={idx * (barWidth + barGap)}
                  y={chartHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  fill={barColors[idx % barColors.length]}
                  rx={8}
                  style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
                  onMouseOver={e => handleMouseOver(e, answer, count, percent)}
                  onMouseOut={handleMouseOut}
                />
                {/* Value label on top */}
                <text
                  x={idx * (barWidth + barGap) + barWidth / 2}
                  y={chartHeight - barHeight - 8}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="bold"
                  fill="#23335b"
                >
                  {count}
                </text>
                {/* Category label below */}
                <text
                  x={idx * (barWidth + barGap) + barWidth / 2}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  fontSize="13"
                  fill="#23335b"
                >
                  {answer}
                </text>
              </g>
            );
          })}
        </svg>
        {/* Tooltip */}
        {tooltip.show && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x,
              top: tooltip.y,
              background: '#fff',
              border: '1px solid #ccc',
              borderRadius: 8,
              padding: '8px 14px',
              boxShadow: '0 2px 8px #0002',
              pointerEvents: 'none',
              zIndex: 9999,
              fontSize: 14,
              color: '#23335b',
              whiteSpace: 'nowrap',
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div style={{ fontWeight: 600 }}>{tooltip.label}</div>
            <div>Count: {tooltip.count} ({tooltip.percent}%)</div>
          </div>
        )}
      </div>
    );
  };

  // --- Render Post Activity Survey Analytics Grid ---
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
        marginTop: 12,
        alignItems: 'stretch',
      }}
    >
      {postFieldOrder.map(({ key, label }) => {
        const content = postSurveyAnalytics[key];
        if (!content || Object.keys(content).length === 0) return null;
        const entryCount = Object.keys(content).length;
        const isSingleAnswer = entryCount === 1;
        const dynamicMinHeight = isSingleAnswer ? 120 : Math.max(180, Math.min(320, 120 + entryCount * 32));
        const dynamicPadding = isSingleAnswer ? '12px 10px' : (entryCount > 4 ? '18px 16px' : '28px 24px');
        return (
          <div
            key={key}
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 2px 12px #0001',
              padding: dynamicPadding,
              border: '1.5px solid #e3eafc',
              minHeight: dynamicMinHeight,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'stretch',
              transition: 'min-height 0.2s, padding 0.2s',
              fontSize: isSingleAnswer ? 15 : undefined,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{label}</div>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 8 }}>{Object.values(content).reduce((a, b) => a + b, 0)} responses</div>
            {renderBarGraphAndLegend(content, ['#1a237e', '#43a047', '#fbc02d', '#e53935', '#8e24aa'])}
          </div>
        );
      })}
      {/* Post Likert scale questions */}
      {postLikertQuestions.map(({ key, label }) => {
        const counts = {};
        if (Array.isArray(volunteers)) {
          volunteers.forEach(v => {
            const ans = v.postSurveyAnswers;
            if (!ans || !ans.likert) return;
            const val = ans.likert[key];
            if (val === undefined || val === null || val === "") return;
            counts[val] = (counts[val] || 0) + 1;
          });
        }
        if (Object.keys(counts).length === 0) return null;
        const entryCount = Object.keys(counts).length;
        const dynamicMinHeight = Math.max(180, Math.min(320, 120 + entryCount * 32));
        const dynamicPadding = entryCount > 4 ? '18px 16px' : '28px 24px';
        return (
          <div
            key={key}
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 2px 12px #0001',
              padding: dynamicPadding,
              border: '1.5px solid #e3eafc',
              minHeight: dynamicMinHeight,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'stretch',
              transition: 'min-height 0.2s, padding 0.2s',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 2 }}>{label}</div>
            <div style={{ color: '#888', fontSize: 14, marginBottom: 12 }}>{Object.values(counts).reduce((a, b) => a + b, 0)} responses</div>
            {renderBarGraphAndLegend(counts, ['#1a237e', '#43a047', '#fbc02d', '#e53935', '#8e24aa'])}
          </div>
        );
      })}
    </div>
  );
}


