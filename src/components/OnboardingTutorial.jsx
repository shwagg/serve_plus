import { useState, useEffect, useContext } from 'react';
import { auth } from '../firebaseConfig';
import { SessionContext } from '../context/sessionContextCore';
import './OnboardingTutorial.css';

const STEPS = [
  {
    icon: '🌟',
    title: 'Welcome to SERVE+!',
    body: "SERVE+ is your platform for service learning and community engagement. Here you can browse and join missions, complete requirements, track your points, and even propose your own projects. Let's walk you through the basics!",
  },
  {
    icon: '🗺️',
    title: 'Browse & Join Missions',
    body: "Your home page shows available missions as cards. Use the tabs — All, Enrolled, and Proposals — to filter the list. Each card shows the mission date, location, and how many volunteers have joined. Click a card to open it.",
  },
  {
    icon: '📋',
    title: 'Inside a Mission',
    body: "Each mission has four tabs: Content (details & description), Requirements (Pre-Activity Survey, Parent Consent Form, and Attendance QR), Task Assignment (tasks you can complete for points), and Leaderboard (see how you rank among volunteers). Complete each requirement to earn points!",
  },
  {
    icon: '📝',
    title: 'Create a Proposal',
    body: "Have a project idea? Open the menu (top-right) and select 'Create Proposal'. Choose between a Service Learning or Community Engagement proposal, fill out the form, preview it, then submit. It goes through Reviewed By → Recommended By → Admin → Director for approval.",
  },
  {
    icon: '🏅',
    title: 'Points, Badges & Leaderboard',
    body: "Every requirement and task you complete earns you points, shown in the header. Accumulate points to unlock badges and climb the Leaderboard — visible on your home page and inside each mission. Check your Profile to see all your badges and achievements.",
  },
  {
    icon: '🔔',
    title: "You're All Set!",
    body: "Use the notification bell to stay updated on mission approvals and announcements. The chat icon lets you message within a mission. Access Settings, Support, and more from the top-right menu. Good luck, volunteer!",
  },
];

export default function OnboardingTutorial({ forceOpen = false, onClose }) {
  const { userData } = useContext(SessionContext);
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user) {
        const key = `serve_tutorial_seen_${user.uid}`;
        if (!localStorage.getItem(key)) {
          setVisible(true);
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (forceOpen) {
      setStep(0);
      setVisible(true);
    }
  }, [forceOpen]);

  // Only show for students/volunteers
  const role = userData?.role;
  if (role && role !== 'student') return null;

  const dismiss = () => {
    const user = auth.currentUser;
    if (user) localStorage.setItem(`serve_tutorial_seen_${user.uid}`, '1');
    setVisible(false);
    onClose?.();
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="ot-overlay" role="dialog" aria-modal="true" aria-label="Welcome tutorial">
      <div className="ot-card">
        <button className="ot-skip" onClick={dismiss} aria-label="Skip tutorial">
          Skip
        </button>
        <div className="ot-icon">{current.icon}</div>
        <h3 className="ot-title">{current.title}</h3>
        <p className="ot-body">{current.body}</p>
        <div className="ot-dots">
          {STEPS.map((_, i) => (
            <span key={i} className={`ot-dot${i === step ? ' ot-dot-active' : ''}`} />
          ))}
        </div>
        <div className="ot-actions">
          {step > 0 && (
            <button className="ot-btn ot-btn-back" onClick={() => setStep((s) => s - 1)}>
              ← Back
            </button>
          )}
          <button
            className="ot-btn ot-btn-primary"
            onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
          >
            {isLast ? 'Get Started!' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  );
}
