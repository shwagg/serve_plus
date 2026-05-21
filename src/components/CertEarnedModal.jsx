import { useEffect, useRef, useState } from "react";

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

export default function CertEarnedModal({ certQueue = [], onDismiss }) {
  const [visible, setVisible] = useState(false);
  const innerCanvasRef = useRef(null);
  const current = certQueue[0] ?? null;

  useEffect(() => {
    if (current) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [current?.notifId]);

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

  if (!current) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(current.notifId), 300);
  };

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true" role="dialog" aria-label="Certificate received"
      onClick={handleClose}
    >
      <div
        className={`badge-earned-card${visible ? " badge-earned-card-visible" : ""}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Confetti inside the card */}
        <canvas ref={innerCanvasRef} className="badge-earned-confetti-canvas" aria-hidden="true" />

        <div className="badge-earned-icon-wrap">
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, #eef5ff 0%, #dbeafe 100%)',
            border: '2.5px solid #30bdb7',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#234e7b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <polyline points="9 15 11 17 15 13"/>
            </svg>
          </div>
        </div>

        <p className="badge-earned-subtitle">Congratulations!</p>
        <h2 className="badge-earned-name" style={{ color: "#234e7b" }}>{current.course}</h2>
        <p className="badge-earned-desc">
          Mission Complete.
          <br />Your SERVE+ certificate has now been added to your portfolio.
        </p>

        {certQueue.length > 1 && (
          <p className="badge-earned-more">
            +{certQueue.length - 1} more certificate{certQueue.length - 1 > 1 ? "s" : ""} to view!
          </p>
        )}

        <button
          className="badge-earned-btn"
          style={{ background: "#234e7b" }}
          onClick={() => {
            handleClose();
            if (certQueue.length === 1) window.location.href = "/profile#certificates";
          }}
        >
          {certQueue.length > 1 ? "Close" : "View in Portfolio"}
        </button>
      </div>
    </div>
  );
}
