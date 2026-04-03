import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "../../../firebaseConfig";

export default function ParticipantModal({ open, onClose, missionId, task }) {
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchParticipants() {
      if (!open || !missionId || !task?.id) {
        if (isMounted) {
          setParticipants([]);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setParticipants([]);
      }

      try {
        const participantsRef = collection(
          db,
          "missions",
          missionId,
          "task",
          task.id,
          "participants",
        );
        const participantsSnap = await getDocs(participantsRef);

        const list = await Promise.all(
          participantsSnap.docs.map(async (participantDoc) => {
            const participantData = participantDoc.data();
            const userSnap = await getDoc(doc(db, "users", participantDoc.id));
            const userInfo = userSnap.exists() ? userSnap.data() : {};
            const name =
              userInfo.username ||
              userInfo.name ||
              userInfo.email?.split("@")[0] ||
              participantDoc.id;

            return {
              uid: participantDoc.id,
              name,
              enrollmentOrder: participantData.enrollmentOrder,
              joinedAt: participantData.joinedAt || "",
            };
          }),
        );

        list.sort((a, b) => {
          const aOrder = Number(a.enrollmentOrder);
          const bOrder = Number(b.enrollmentOrder);
          const aHasOrder = Number.isFinite(aOrder) && aOrder > 0;
          const bHasOrder = Number.isFinite(bOrder) && bOrder > 0;

          if (aHasOrder && bHasOrder) return aOrder - bOrder;
          if (aHasOrder) return -1;
          if (bHasOrder) return 1;
          return String(a.joinedAt).localeCompare(String(b.joinedAt));
        });

        if (isMounted) {
          setParticipants(list);
        }
      } catch (err) {
        console.error("Failed to load task participants:", err);
        if (isMounted) {
          setParticipants([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchParticipants();

    return () => {
      isMounted = false;
    };
  }, [open, missionId, task?.id]);

  if (!open || !task) return null;

  return (
    <div
      className="ea-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="ea-modal-card task-participants-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ea-modal-header">
          <h3 className="ea-modal-title">
            👥 {task.title || "Task Participants"}
          </h3>
          <button
            className="ea-modal-close"
            onClick={() => onClose?.()}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="task-participants-modal__body">
          {loading ? (
            <div className="task-participants-modal__state">
              Loading participants...
            </div>
          ) : participants.length === 0 ? (
            <div className="task-participants-modal__state">
              No participants yet.
            </div>
          ) : (
            <div
              className="task-participants-list"
              role="list"
              aria-label="Task participants"
            >
              {participants.map((participant, index) => (
                <div
                  key={participant.uid}
                  className="task-participants-list__item"
                  role="listitem"
                >
                  <span className="task-participants-list__index">
                    #{index + 1}
                  </span>
                  <span className="task-participants-list__name">
                    {participant.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
