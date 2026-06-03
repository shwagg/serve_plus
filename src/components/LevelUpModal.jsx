import { useEffect, useRef, useState } from "react";
import { LEVEL_UNLOCKS } from "../hooks/rewardSystem";
import { playBadgeEarnedSound } from "../utils/soundUtils";

const COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#F7DC6F', '#BB8FCE', '#5DADE2',
  '#58D68D', '#FF9F43', '#A29BFE', '#FD79A8', '#6C5CE7',
  '#00B894', '#E17055', '#FDCB6E', '#74B9FF', '#30bdb7',
];

function rnd(a, b) { return a + Math.random() * (b - a); }

function makeParticle(cx, cy) {
  const angle = rnd(0, Math.PI * 2);
  const speed = rnd(2, 7);
  const w = rnd(7, 16);
  return {
    x: cx, y: cy,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - rnd(5, 12),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    w, h: w * rnd(0.6, 1.1),
    rot: rnd(0, Math.PI * 2), rotV: rnd(-0.05, 0.05),
    gravity: rnd(0.05, 0.15), drag: rnd(0.975, 0.995),
    alpha: 1, decay: rnd(0.007, 0.013),
  };
}

function runConfetti({ canvas, count, cx, cy }) {
  canvas.width = canvas.offsetWidth || 300;
  canvas.height = canvas.offsetHeight || 400;
  const ctx = canvas.getContext('2d');
  let particles = [];

  const burst = () => {
    particles.push(...Array.from({ length: count }, () =>
      makeParticle(cx ?? canvas.width / 2, cy ?? canvas.height * 0.3)
    ));
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
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return () => { clearInterval(intervalId); cancelAnimationFrame(rafId); };
}

export default function LevelUpModal({ levelQueue = [], onDismiss }) {
  const [visible, setVisible] = useState(false);
  const innerCanvasRef = useRef(null);

  const currentLevel = levelQueue[0] ?? null;
  const unlock = currentLevel ? LEVEL_UNLOCKS[currentLevel] : null;

  useEffect(() => {
    if (currentLevel) {
      const t = setTimeout(() => { setVisible(true); playBadgeEarnedSound(); }, 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [currentLevel]);

  useEffect(() => {
    if (!visible) return;

    const bodyCanvas = document.createElement('canvas');
    bodyCanvas.width = window.innerWidth;
    bodyCanvas.height = window.innerHeight;
    bodyCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000;';
    document.body.appendChild(bodyCanvas);

    const stopBody = runConfetti({
      canvas: bodyCanvas, count: 200,
      cx: bodyCanvas.width / 2, cy: bodyCanvas.height * 0.6,
    });

    const inner = innerCanvasRef.current;
    let stopInner = () => {};
    if (inner) {
      inner.width = inner.offsetWidth;
      inner.height = inner.offsetHeight;
      stopInner = runConfetti({
        canvas: inner, count: 80,
        cx: inner.width / 2, cy: inner.height * 0.3,
      });
    }

    return () => { stopBody(); stopInner(); bodyCanvas.remove(); };
  }, [visible]);

  if (!currentLevel) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onDismiss?.(currentLevel), 300);
  };

  return (
    <div
      className={`badge-earned-overlay${visible ? " badge-earned-visible" : ""}`}
      aria-modal="true" role="dialog" aria-label="Level up"
      onClick={handleClose}
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

        <canvas ref={innerCanvasRef} className="badge-earned-confetti-canvas" aria-hidden="true" />

        <div className="levelup-badge-wrap">
          <div className="levelup-badge">
            <span className="levelup-badge-label">LEVEL</span>
            <span className="levelup-badge-number">{currentLevel}</span>
          </div>
        </div>

        <p className="badge-earned-subtitle">Level Up!</p>
        <h2 className="badge-earned-name" style={{ color: "#30bdb7" }}>
          You reached Level {currentLevel}!
        </h2>

        {unlock && (
          <p className="badge-earned-desc">
            {unlock.icon} <strong>{unlock.name}</strong> unlocked — {unlock.description}
          </p>
        )}

        {levelQueue.length > 1 && (
          <p className="badge-earned-more">
            +{levelQueue.length - 1} more level{levelQueue.length - 1 > 1 ? "s" : ""} to show!
          </p>
        )}

        <button
          className="badge-earned-btn"
          style={{ background: "#30bdb7" }}
          onClick={handleClose}
        >
          {levelQueue.length > 1 ? "Next" : "Let's go!"}
        </button>
      </div>
    </div>
  );
}
