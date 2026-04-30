import { useState, useEffect, useContext } from 'react';
import { auth } from '../firebaseConfig';
import { SessionContext } from '../context/SessionContext';
import './OnboardingTutorial.css';

const STEPS = [
  {
    icon: '🌟',
    title: 'Welcome to SERVE+!',
    body: "SERVE+ is your hub for volunteering, service learning, and community engagement. Let's take a quick tour to get you started.",
  },
  {
    icon: '🗺️',
    title: 'Browse Missions',
    body: 'Explore available missions on your home page. Each card shows the date, location, volunteer hours, and assigned tasks.',
  },
  {
    icon: '✅',
    title: 'Join a Mission',
    body: "Click on any mission to see its full details, then hit 'Join Mission' to enroll.",
  },
  {
    icon: '📝',
    title: 'Create a Proposal',
    body: "Have a project idea? Open the menu (☰) and select 'Create Proposal' to submit a Service Learning or Community Engagement proposal.",
  },
  {
    icon: '🏅',
    title: 'Earn Badges & Points',
    body: 'Complete missions, tasks, and surveys to earn points and unlock badges. Track all your achievements on your Profile page.',
  },
  {
    icon: '🔔',
    title: "You're All Set!",
    body: "Use the notification bell to stay updated on approvals and events. Your profile avatar (next to the ☰ menu) takes you to your profile. Good luck, volunteer!",
  },
];

export default function OnboardingTutorial() {
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

  // Only show for students/volunteers
  const role = userData?.role;
  if (role && role !== 'student') return null;

  const dismiss = () => {
    const user = auth.currentUser;
    if (user) localStorage.setItem(`serve_tutorial_seen_${user.uid}`, '1');
    setVisible(false);
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
