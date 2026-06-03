import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { getLevelInfo } from "../hooks/rewardSystem";
import xpIcon from "../assets/xp_icon.png";

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function BonusChip({ icon, amount }) {
  return (
    <span className="phe-chip">
      {icon && <span>{icon}</span>}
      <span className="phe-chip-amt">+{amount}</span>
    </span>
  );
}

function HistoryEntry({ entry }) {
  const { missionTitle, totalPoints, missionBase = 0, bonusPoints = 0, createdAt } = entry;
  const hasChips = missionBase > 0 || bonusPoints > 0;

  return (
    <div className="phe">
      <div className="phe-row-top">
        <span className="phe-mission" title={missionTitle}>{missionTitle}</span>
        <span className="phe-pts">+{totalPoints} XP</span>
      </div>
      <div className="phe-row-meta">
        <span className="phe-date">{formatDate(createdAt)}</span>
        {hasChips && (
          <div className="phe-chips">
            {missionBase > 0 && <BonusChip icon="✅" amount={missionBase} />}
            {bonusPoints > 0 && <BonusChip icon="⭐" amount={bonusPoints} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PlayerStrip() {
  const [uid, setUid] = useState(null);
  const [role, setRole] = useState(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [missionsCompleted, setMissionsCompleted] = useState(0);
  const [history, setHistory] = useState([]);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const pillRef = useRef(null);

  useEffect(() => {
    return onAuthStateChanged(getAuth(), (user) => setUid(user?.uid ?? null));
  }, []);

  useEffect(() => {
    if (!uid) { setRole(null); return; }
    return onSnapshot(doc(db, "users", uid), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setRole(d.role || null);
      setTotalPoints(d.totalPoints || 0);
      setMissionsCompleted(d.missionsCompleted || 0);
    });
  }, [uid]);

  useEffect(() => {
    if (!uid || role !== "student") { setHistory([]); return; }
    let cancelled = false;
    const fetchHistory = async () => {
      try {
        const missionsSnap = await getDocs(collection(db, "missions"));
        const results = await Promise.all(
          missionsSnap.docs.map(async (missionDoc) => {
            try {
              const volSnap = await getDoc(doc(db, "missions", missionDoc.id, "volunteer", uid));
              if (!volSnap.exists()) return null;
              const vData = volSnap.data();
              if (!vData.releasedAt) return null;
              const reqBonus = vData.requirementBonus || {};
              const requirementPoints = Object.values(reqBonus).reduce((s, v) => s + (Number(v) || 0), 0);
              const releasedPoints = vData.pointsEarned || 0;
              const bonusPoints = vData.bonusPoints || 0;
              const missionBase = (releasedPoints - bonusPoints) + requirementPoints;
              return {
                id: missionDoc.id,
                missionTitle: missionDoc.data().title || missionDoc.id,
                totalPoints: releasedPoints + requirementPoints,
                missionBase,
                bonusPoints,
                createdAt: vData.releasedAt,
              };
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;
        setHistory(
          results
            .filter(Boolean)
            .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
        );
      } catch {
        // fail silently
      }
    };
    fetchHistory();
    return () => { cancelled = true; };
  }, [uid, role]);

  const handleToggle = useCallback(() => {
    setOpen(prev => {
      if (!prev && pillRef.current) {
        const rect = pillRef.current.getBoundingClientRect();
        const isMobile = window.innerWidth <= 600;
        setDropPos({
          top: rect.bottom + 8,
          left: isMobile ? window.innerWidth / 2 : rect.left + rect.width / 2,
        });
      }
      return !prev;
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (!pillRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  if (!uid || role !== "student") return null;

  const { level, progress } = getLevelInfo(totalPoints);

  return (
    <>
      <button
        ref={pillRef}
        className={`player-strip-inner player-strip-btn${open ? " strip-open" : ""}`}
        onClick={handleToggle}
        aria-expanded={open}
        aria-label="View points history"
        type="button"
      >
        <div className="strip-compact-row">
          <span className="strip-level-text">Lv. {level}</span>
          <div className="strip-pts-bar-wrap">
            <div
              className="strip-pts-bar"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${totalPoints} points`}
            >
              <div className="strip-pts-fill" style={{ width: `${progress}%` }} />
              <span className="strip-pts-text">
                {totalPoints} XP
                <img src={xpIcon} alt="XP" style={{ width: 13, height: 13, verticalAlign: "middle", marginLeft: 8, marginBottom: 2 }} />
              </span>
            </div>
          </div>
          <span className="strip-sep" aria-hidden="true">|</span>
          <span className="strip-missions-text">
            {missionsCompleted}{" "}
            <span className="strip-missions-label">{missionsCompleted !== 1 ? "Missions" : "Mission"}</span>
          </span>
          <span className={`strip-caret${open ? " strip-caret--up" : ""}`} aria-hidden="true" />
        </div>
      </button>
      {open && createPortal(
        <div
          className="pts-history-panel"
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            transform: "translateX(-50%)",
            zIndex: 1050,
          }}
          role="dialog"
          aria-label="Points history"
        >
          <div className="php-header">
            <span className="php-title">⚡ Points History</span>
            <span className="php-total-badge">{totalPoints} XP total</span>
          </div>
          <div className="php-list">
            {history.length === 0 ? (
              <div className="php-empty">
                <span className="php-empty-icon">🎯</span>
                <span>Complete a mission to earn your first XP!</span>
              </div>
            ) : (
              history.map(entry => <HistoryEntry key={entry.id} entry={entry} />)
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
