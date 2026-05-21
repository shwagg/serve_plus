import { useEffect, useRef, useState } from "react";
import BadgeIcon from "./BadgeIcon";
import { BADGE_BY_ID } from "../../constants/badgeDefinitions";
import { playBadgeEarnedSound } from "../../utils/soundUtils";

const COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE', '#5DADE2',
  '#58D68D', '#FF9F43', '#EE5A24', '#A29BFE', '#FD79A8',
  '#6C5CE7', '#00B894', '#E17055', '#FDCB6E', '#74B9FF',
];

const SHAPES = ['rect', 'rect', 'circle', 'ribbon', 'triangle', 'star', 'star', 'heart', 'diamond'];

function rnd(a, b) { return a + Math.random() * (b - a); }

function makeParticle(cx, cy, fast = false) {
  const angle = rnd(0, Math.PI * 2);
  const speed = rnd(2, 7);
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  const w = rnd(7, 16);
  return {
    x: cx, y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - rnd(5, 12),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    shape, w,
    h: shape === 'ribbon' ? rnd(3, 7) : w * rnd(0.6, 1.1),
    rot: rnd(0, Math.PI * 2),
    rotV: rnd(-0.05, 0.05),
    gravity: fast ? rnd(0.03, 0.07) : rnd(0.05, 0.15),
    drag: fast ? rnd(0.988, 0.997) : rnd(0.975, 0.995),
    alpha: 1,
    decay: fast ? rnd(0.004, 0.008) : rnd(0.007, 0.013),
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

function drawHeart(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, r * 0.35);
  ctx.bezierCurveTo( r,  r * 0.35,  r, -r * 0.35, 0, -r * 0.35);
  ctx.bezierCurveTo(-r, -r * 0.35, -r,  r * 0.35, 0,  r * 0.35);
  ctx.fill();
}

function drawDiamond(ctx, r) {
  ctx.beginPath();
  ctx.moveTo(0, -r); ctx.lineTo(r * 0.6, 0);
  ctx.lineTo(0, r);  ctx.lineTo(-r * 0.6, 0);
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
  else if (p.shape === 'heart')    { drawHeart(ctx, r); }
  else if (p.shape === 'diamond')  { drawDiamond(ctx, r); }
  else                             { ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
  ctx.restore();
}

function runConfetti({ canvas, count, fast, cx, cy }) {
  canvas.width  = canvas.width  || canvas.offsetWidth  || 300;
  canvas.height = canvas.height || canvas.offsetHeight || 400;
  const ctx = canvas.getContext('2d');
  let particles = [];

  const burst = () => {
    particles.push(...Array.from({ length: count }, () => makeParticle(cx ?? canvas.width / 2, cy ?? canvas.height * 0.3, fast)));
  };

  burst();
  const intervalId = setInterval(burst, 3000);

  let rafId;
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0);
    for (const p of particles) {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.gravity;
      p.x += p.vx; p.y += p.vy; p.rot += p.rotV; p.alpha -= p.decay;
      drawParticle(ctx, p);
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  const onHide = () => { if (document.hidden) particles = []; else burst(); };
  document.addEventListener('visibilitychange', onHide);

  return () => {
    clearInterval(intervalId);
    cancelAnimationFrame(rafId);
    document.removeEventListener('visibilitychange', onHide);
  };
}

const CATEGORY_COLORS = {
  default:       "#9CA3AF",
  milestone:     "#0D9488",
  performance:   "#D97706",
  leadership:    "#7C3AED",
  institutional: "#DC2626",
};

export default function BadgeEarnedModal({ badgeQueue = [], onDismiss }) {
  const [visible, setVisible] = useState(false);
  const innerCanvasRef = useRef(null);

  const currentId = badgeQueue[0] ?? null;
  const definition = currentId ? BADGE_BY_ID[currentId] : null;

  useEffect(() => {
    if (currentId) {
      const t = setTimeout(() => { setVisible(true); playBadgeEarnedSound(); }, 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [currentId]);

  useEffect(() => {
    if (!visible) return;

    // Full-screen canvas on body — particles escape beyond the modal
    const bodyCanvas = document.createElement('canvas');
    bodyCanvas.width = window.innerWidth;
    bodyCanvas.height = window.innerHeight;
    bodyCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000;';
    document.body.appendChild(bodyCanvas);

    const stopBody = runConfetti({
      canvas: bodyCanvas,
      count: 180,
      fast: false,
      cx: bodyCanvas.width / 2,
      cy: bodyCanvas.height * 0.6,
    });

    // Inner canvas inside the card — confetti within the modal
    const inner = innerCanvasRef.current;
    let stopInner = () => {};
    if (inner) {
      inner.width  = inner.offsetWidth;
      inner.height = inner.offsetHeight;
      stopInner = runConfetti({
        canvas: inner,
        count: 80,
        fast: true,
        cx: inner.width / 2,
        cy: inner.height * 0.3,
      });
    }

    return () => {
      stopBody();
      stopInner();
      bodyCanvas.remove();
    };
  }, [visible]);

  if (!currentId || !definition) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(currentId), 300);
  };

  const accentColor = CATEGORY_COLORS[definition.category] ?? "#0D9488";

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true" role="dialog" aria-label="Badge earned"
      onClick={handleClose}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti inside the card */}
        <canvas ref={innerCanvasRef} className="badge-earned-confetti-canvas" aria-hidden="true" />

        <div className="badge-earned-icon-wrap">
          <BadgeIcon badgeId={definition.id} earned size="lg" />
        </div>

        <p className="badge-earned-subtitle">Badge Unlocked!</p>
        <h2 className="badge-earned-name" style={{ color: accentColor }}>{definition.name}</h2>
        <p className="badge-earned-desc">{definition.description}</p>

        {badgeQueue.length > 1 && (
          <p className="badge-earned-more">
            +{badgeQueue.length - 1} more badge{badgeQueue.length - 1 > 1 ? "s" : ""} to claim!
          </p>
        )}

        <button className="badge-earned-btn" style={{ background: accentColor }} onClick={handleClose}>
          {badgeQueue.length > 1 ? "Close" : "Awesome!"}
        </button>
      </div>
    </div>
  );
}
