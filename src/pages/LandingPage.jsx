import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import servePlusLogo from "../assets/serve_plus_logo.svg";
import badge00 from "../assets/badges/00-serve-ready.svg";
import badge01 from "../assets/badges/01-first-step.svg";
import badge02 from "../assets/badges/02-active-volunteer.svg";
import badge03 from "../assets/badges/03-community-advocate.svg";
import badge04 from "../assets/badges/04-service-champion.svg";
import badge05 from "../assets/badges/05-consistent-contributor.svg";
import badge06 from "../assets/badges/06-excellence-in-service.svg";
import badge07 from "../assets/badges/07-organizer.svg";
import badge08 from "../assets/badges/08-lead-organizer.svg";
import badge09 from "../assets/badges/09-program-builder.svg";
import badge10 from "../assets/badges/10-csce-recognition-award.svg";
import badge11 from "../assets/badges/11-outstanding-volunteer.svg";
import phoneMockup from "../assets/lpassets/landing_phone_mockup.png";
import requirementScreen from "../assets/lpassets/landing_phone_requirement.png";
import rewardsScreen from "../assets/lpassets/landing_phone_badge.png";
import missionScreen from "../assets/lpassets/landing_phone_mission.png";
import "../styles/landing.css";

const FAQS = [
  {
    q: "How do i earn XP?",
    a: "You earn XP by participating in missions and completing activities.",
  },
  {
    q: "What are badges?",
    a: "Badges are achievements you unlock as you reach milestones and complete challenges.",
  },
  {
    q:"How many badges can I unlock?",
    a:"There are 12 unique badges waiting to be earned."
  },
  {
    q: "What do levels unlock?",
    a: "Every 100 XP moves you up a level. Higher levels unlock profile customizations such as colored rings, custom titles, bio sections, and badge pinning.",
  },
  {
    q: "Do achievements expire?",
    a: "No. Once earned, your achievements remain part of your SERVE+ profile.",
  },
  {
    q:"Do I get a certificate after every mission?",
    a:"Yes. Eligible completed missions provide a verified certificate. You can verify your certificate using the QR code or by visiting the verification page."
  },
  {
    q: "Is my data safe?",
    a: "SERVE+ uses multi-factor authentication, role-based access control, and encrypted data storage. Only authorized staff can access your records.",
  },
  {
    q: "How can I check my progress?",
    a: "Your XP, level, badges, and achievements are all available in your profile.",
  },
  {
    q: "Who do I contact for help?",
    a: "Reach out to the Center for Service-Learning and Community Engagement (CSCE) or contact our support team using email at the bottom of the page.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "🔍 Discover Missions",
    body: "Find community projects and volunteer opportunities that match your interests.",
    features: [
      "All active missions in one feed",
      "Filter by category or date",
      "One-tap enrollment",
    ],
  },
  {
    num: "02",
    title: "🤝 Make an Impact",
    body: "Join activities, contribute to meaningful causes, and complete missions.",
    features: [
      "Pre-activity survey and consent form",
      "Attendance QR scan at the venue",
      "Task photo proof and post-survey",
    ],
  },
  {
    num: "03",
    title: "🏆  Earn Recognition",
    body: "Receive verified certificates, unlock achievements, and build your impact portfolio.",
    features: [
      "XP and level progression (1–10)",
      "12 achievement badges to collect",
      "QR-verified certificate per mission",
    ],
  },
];

const GAMIFY_CARDS = [
  {
    label: "XP",
    title: "Earn XP",
    body: "Complete mission requirements",
  },
  {
    label: "12",
    title: "Collect Badges",
    body: "Unlock 12 achievements",
  },
  {
    label: "10",
    title: "Level Up",
    body: "Grow through service",
  },
  {
    label: "QR",
    title: "Get Certified",
    body: "Receive verified certificates",
  },
];

/* ── Step phone screens ── */
function MissionListScreen() {
  return (
    <div className="lp-phone-screen">
      <img src={missionScreen} alt="SERVE+ app" className="lp-phone-img" />
    </div>
  );
}

function RequirementsScreen() {
  return (
    <div className="lp-phone-screen">
      <img src={requirementScreen} alt="SERVE+ app" className="lp-phone-img" />
    </div>
  );
}

function RewardsScreen() {
  return (
    <div className="lp-phone-screen">
      <img src={rewardsScreen} alt="SERVE+ app" className="lp-phone-img" />
    </div>
  );
}

function StepScreen({ step }) {
  if (step === 0) return <MissionListScreen />;
  if (step === 1) return <RequirementsScreen />;
  return <RewardsScreen />;
}

/* ── FAQ accordion ── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item${open ? " open" : ""}`}>
      <button className="lp-faq-q" onClick={() => setOpen((o) => !o)}>
        <span>{q}</span>
        <svg className="lp-faq-chevron" width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M4 7l5 5 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <div className="lp-faq-body">
        <p className="lp-faq-a">{a}</p>
      </div>
    </div>
  );
}

/* -- MAIN COMPONENT --*/
export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [timerKey, setTimerKey] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setActiveStep((s) => (s + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(t);
  }, [paused, timerKey]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".lp-reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const handleStepChange = (i) => {
    setActiveStep(i);
    setTimerKey((k) => k + 1);
  };

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const step = STEPS[activeStep];

  return (
    <div className="lp">
      {/* ── Navbar ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <button
            className="lp-nav-logo"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <img src={servePlusLogo} alt="SERVE+" className="lp-nav-logo-img" />
          </button>
          <div className="lp-nav-links">
            <button className="lp-nav-link" onClick={() => scrollTo("about")}>About</button>
            <button className="lp-nav-link" onClick={() => scrollTo("faqs")}>FAQs</button>
            <Link to="/verify-certificate" className="lp-nav-link">Verify Certificate</Link>
            <Link to="/auth" className="lp-nav-cta">Login</Link>
          </div>
        </div>
      </nav>

      {/* ── FIRST ── */}
      <section className="lp-hero">
        <div className="lp-hero-content lp-reveal">
          <h1 className="lp-hero-h1">
            Serve with Purpose.
            <br />
            Get Recognized.
          </h1>
          <p className="lp-hero-sub">
            SERVE+ is Mapúa MCL's platform for service learning and community engagement. Discover meaningful missions, earn achievements, build your portfolio, and make a real impact beyond the classroom
          </p>
          <Link to="/auth" className="lp-hero-cta">Start Journey</Link>
        </div>
        <div className="lp-hero-phone lp-reveal lp-reveal-d1" aria-hidden="true">
          <div className="lp-phone-frame">
            <div className="lp-phone-notch" />
            <div className="lp-phone-screen">
              <img src={phoneMockup} alt="SERVE+ app" className="lp-phone-img" />
            </div>
          </div>
        </div>
      </section>

      {/* ── About / Mission ── */}
      <section id="about" className="lp-about">
        <div className="lp-about-inner lp-reveal">
          <span className="lp-section-tag">Who We Are</span> <br/><br/>
          <h2 className="lp-section-h2">A Platform for Student</h2><br/>
          <p className="lp-about-body">
            SERVE+ helps students discover meaningful opportunities, develop real-world skills, and build a lasting record of their contributions. Through service, leadership, and community engagement, every experience becomes part of a journey of growth.
          </p>
        </div>
      </section>

      {/* ── STEPS — */}
      <section
        className="lp-steps"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="lp-steps-inner">
          <span className="lp-section-tag">How It Works</span>
          <h2 className="lp-section-h2">3 Steps to Get Started</h2>

          {/* Tab bar */}
          <div className="lp-steps-tabs" role="tablist">
            {STEPS.map((s, i) => (
              <button
                key={i}
                role="tab"
                aria-selected={i === activeStep}
                className={`lp-steps-tab${i === activeStep ? " active" : ""}`}
                onClick={() => handleStepChange(i)}
              >
                <span className="lp-steps-tab-num">{s.num}</span>
                <span className="lp-steps-tab-label">{s.title}</span>
                {i === activeStep && (
                  <div
                    className="lp-steps-tab-bar"
                    key={`bar-${activeStep}-${timerKey}`}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="lp-steps-body">
            {/* Phone mockup */}
            <div className="lp-steps-phone" aria-hidden="true">
              <div className="lp-steps-phone-frame">
                <div className="lp-steps-phone-notch" />
                <div className="lp-steps-phone-screen">
                  <StepScreen key={activeStep} step={activeStep} />
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="lp-steps-text" key={`text-${activeStep}`}>
              <span className="lp-steps-text-num">{step.num}</span>
              <h3 className="lp-steps-text-title">{step.title}</h3>
              <p className="lp-steps-text-body">{step.body}</p>
              <ul className="lp-steps-features">
                {step.features.map((f) => (
                  <li key={f} className="lp-steps-feature">
                    <span className="lp-steps-feature-dot" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Dots */}
          <div className="lp-steps-dots">
            {STEPS.map((_, i) => (
              <button
                key={i}
                className={`lp-steps-dot${i === activeStep ? " active" : ""}`}
                onClick={() => handleStepChange(i)}
                aria-label={`Step ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Gamification ── */}
      <section className="lp-gamify">
        <div className="lp-gamify-inner">
          <span className="lp-section-tag lp-section-tag--light">Gamification</span>
          <h2 className="lp-section-h2 lp-section-h2--light">Service That Rewards You Back.</h2>
          <p className="lp-gamify-sub">
            Every mission counts. Earn XP, unlock achievements, level up, and collect verified certificates as you make an impact.
          </p>
          <div className="lp-gamify-grid">
            {GAMIFY_CARDS.map((card) => (
              <div className="lp-gamify-card" key={card.title}>
                <div className="lp-gamify-card-label">{card.label}</div>
                <h3 className="lp-gamify-card-title">{card.title}</h3>
                <p className="lp-gamify-card-body">{card.body}</p>
              </div>
            ))}
          </div>
          <div className="lp-badge-marquee-wrap">
            <div className="lp-badge-marquee-track">
              {[badge00, badge01, badge02, badge03, badge04, badge05, badge06, badge07, badge08, badge09, badge10, badge11,
                badge00, badge01, badge02, badge03, badge04, badge05, badge06, badge07, badge08, badge09, badge10, badge11].map(
                (src, i) => (
                  <img key={i} src={src} alt="" className="lp-badge" aria-hidden="true" />
                )
              )}
            </div>
          </div><br/><br/>
          <p className="lp-badge-caption">12 badges waiting to be earned</p>
        </div>
      </section>

      {/* ── FAQs ── */}
      <section id="faqs" className="lp-faqs">
        <div className="lp-faqs-inner lp-reveal">
          <span className="lp-section-tag">FAQs</span>
          <h2 className="lp-section-h2">Common questions.</h2>
          <div className="lp-faq-list">
            {FAQS.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <img src={servePlusLogo} alt="SERVE+" className="lp-footer-logo" />
          <p className="lp-footer-tag">A Capstone Project</p>
          <p className="lp-footer-copy">© 2026 SERVE+</p>
          <a href="mailto:serveplus_auth@gmail.com" className="lp-footer-email">
            serveplus_auth@gmail.com
          </a>
        </div>
      </footer>
    </div>
  );
}
