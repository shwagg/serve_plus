import { useEffect, useRef, useState } from "react";
import { playBadgeEarnedSound } from "../utils/soundUtils";

const COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE', '#5DADE2',
  '#58D68D', '#FF9F43', '#A29BFE', '#FD79A8', '#6C5CE7',
  '#00B894', '#E17055', '#FDCB6E', '#74B9FF', '#30bdb7',
];
const SHAPES = ['rect', 'rect', 'circle', 'ribbon', 'triangle', 'star', 'heart', 'diamond'];

function rnd(a, b) { return a + Math.random() * (b - a); }

function makeParticle(cx, cy) {
  const angle = rnd(0, Math.PI * 2);
  const speed = rnd(3, 8);
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const w = rnd(7, 16);
  return {
    x: cx, y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - rnd(6, 14),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape, w,
    h: shape === 'ribbon' ? rnd(3, 7) : w * rnd(0.6, 1.1),
    rot: rnd(0, Math.PI * 2), rotV: rnd(-0.05, 0.05),
    gravity: rnd(0.05, 0.15), drag: rnd(0.975, 0.995),
    alpha: 1, decay: rnd(0.006, 0.011),
  };
}

function drawStar(ctx, r) {
  const pts = 5, step = Math.PI / pts;
  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.42;
    const a = i * step - Math.PI / 2;
    i === 0 ? ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius)
             : ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath(); ctx.fill();
}

function drawParticle(ctx, p) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, p.alpha);
  ctx.fillStyle = p.color;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  const r = p.w / 2;
  if      (p.shape === 'circle')   { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); }
  else if (p.shape === 'triangle') { ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r,r); ctx.lineTo(-r,r); ctx.closePath(); ctx.fill(); }
  else if (p.shape === 'star')     { drawStar(ctx, r); }
  else if (p.shape === 'heart')    {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.35);
    ctx.bezierCurveTo(r, r * 0.35, r, -r * 0.35, 0, -r * 0.35);
    ctx.bezierCurveTo(-r, -r * 0.35, -r, r * 0.35, 0, r * 0.35);
    ctx.fill();
  }
  else if (p.shape === 'diamond')  {
    ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r*0.6,0); ctx.lineTo(0,r); ctx.lineTo(-r*0.6,0); ctx.closePath(); ctx.fill();
  }
  else { ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); }
  ctx.restore();
}

function runConfettiOnce({ canvas, count, cx, cy }) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  let particles = Array.from({ length: count }, () => makeParticle(cx ?? canvas.width / 2, cy ?? canvas.height * 0.5));

  let rafId;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0);
    for (const p of particles) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.alpha -= p.decay;
      drawParticle(ctx, p);
    }
    if (particles.length > 0) rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

export default function RequirementsCompletedModal({ reqItem, onDismiss, hasContinue }) {
  const [visible, setVisible] = useState(false);
  const confettiCanvasRef = useRef(null);

  useEffect(() => {
    if (reqItem) {
      const t = setTimeout(() => { setVisible(true); playBadgeEarnedSound(); }, 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [reqItem?.id]);

  useEffect(() => {
    if (!visible || !reqItem) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10001;';
    document.body.appendChild(canvas);

    const stop = runConfettiOnce({
      canvas,
      count: 250,
      cx: window.innerWidth / 2,
      cy: window.innerHeight * 0.55,
    });

    return () => { stop(); canvas.remove(); };
  }, [visible]);

  if (!reqItem) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(reqItem.id), 300);
  };

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true" role="dialog" aria-label="Requirements completed"
      style={{ zIndex: 10000 }}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
        style={{ position: "relative" }}
      >
        {/* X close button */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute", top: 14, right: 16,
            background: "none", border: "none", cursor: "pointer",
            fontSize: 20, color: "#94a3b8", lineHeight: 1, padding: 4,
            zIndex: 2,
          }}
        >✕</button>

        {/* Icon */}
        <div className="badge-earned-icon-wrap">
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "linear-gradient(135deg, #fffde7 0%, #fff9c4 100%)",
            border: "2.5px solid #f59e0b",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 38,
          }}>
            🎉
          </div>
        </div>

        <p className="badge-earned-subtitle" style={{ color: "#f59e0b" }}>Mission Requirements Done!</p>
        <h2 className="badge-earned-name" style={{ color: "#1e293b" }}>
          Hooray! You&apos;re all done!
        </h2>

        <p className="badge-earned-desc" style={{ color: "#475569" }}>
          You&apos;ve submitted all your requirements for this mission. Please wait while the admin
          reviews your consent form and task photo proofs — your points will be released once approved.
        </p>

        {reqItem.isOrganizer && (
          <div style={{
            background: "#fef3c7", border: "1px solid #fbbf24",
            borderRadius: 10, padding: "10px 14px", margin: "10px 0",
            fontSize: "0.83rem", color: "#92400e", textAlign: "left",
            zIndex: 1, position: "relative",
          }}>
            <strong>Reminder:</strong> As the mission organizer, you still need to submit your{" "}
            <strong>Accomplishment Report</strong>. Your certificate will not be issued until the
            report is submitted and approved by the admin.
          </div>
        )}

        <button
          className="badge-earned-btn"
          style={{ background: "#f59e0b", marginTop: 8 }}
          onClick={handleClose}
        >
          {hasContinue ? "Continue" : "OK"}
        </button>
      </div>
    </div>
  );
}
