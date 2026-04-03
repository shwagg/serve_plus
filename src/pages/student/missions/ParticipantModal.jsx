import React, { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../firebaseConfig";
import { calculateWeightedTaskPoints } from "../../../hooks/taskPointingSystem";

function resolveParticipantPosition(participant, index) {
  const enrollmentOrder = Number(participant?.enrollmentOrder);
  if (Number.isFinite(enrollmentOrder) && enrollmentOrder > 0) {
    return enrollmentOrder;
  }

  return index + 1;
}

export default function ParticipantModal({ open, onClose, missionId, task }) {
  const [participants, setParticipants] = useState([]);
  const [activeTaskId, setActiveTaskId] = useState("");
  const currentTaskId = task?.id || "";

  useEffect(() => {
    let isMounted = true;

    if (!open || !missionId || !currentTaskId) {
      return () => {
        isMounted = false;
      };
    }

    const participantsRef = collection(
      db,
      "missions",
      missionId,
      "task",
      currentTaskId,
      "participants",
    );

    const unsubscribe = onSnapshot(
      participantsRef,
      (participantsSnap) => {
        Promise.all(
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
        )
          .then((list) => {
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
              setActiveTaskId(currentTaskId);
            }
          })
          .catch((err) => {
            console.error("Failed to load task participants:", err);
            if (isMounted) {
              setParticipants([]);
              setActiveTaskId(currentTaskId);
            }
          });
      },
      (err) => {
        console.error("Failed to subscribe task participants:", err);
        if (isMounted) {
          setParticipants([]);
          setActiveTaskId(currentTaskId);
        }
      },
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [open, missionId, currentTaskId]);

  if (!open || !task) return null;

  const isLoading = Boolean(missionId && currentTaskId && activeTaskId !== currentTaskId);
  const visibleParticipants = activeTaskId === currentTaskId ? participants : [];
  const participantCount = visibleParticipants.length;
  const baseTaskPoints = Number(task.points) || 0;
  const currentUserUid = auth.currentUser?.uid || "";

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
          <div className="task-participants-modal__summary">
            <span className="task-participants-modal__summary-label">
              Base score:
            </span>
            <span className="task-participants-modal__summary-value">
              {baseTaskPoints} pts
            </span>
          </div>

          {isLoading ? (
            <div className="task-participants-modal__state">
              Loading participants...
            </div>
          ) : visibleParticipants.length === 0 ? (
            <div className="task-participants-modal__state">
              No participants yet.
            </div>
          ) : (
            <div
              className="task-participants-list"
              role="list"
              aria-label="Task participants"
            >
              {visibleParticipants.map((participant, index) => {
                const position = resolveParticipantPosition(participant, index);
                const predictedPoints = calculateWeightedTaskPoints(
                  baseTaskPoints,
                  position,
                  participantCount,
                );
                const isCurrentUser = participant.uid === currentUserUid;

                return (
                  <div
                    key={participant.uid}
                    className={`task-participants-list__item ${
                      isCurrentUser ? "task-participants-list__item--current" : ""
                    }`}
                    role="listitem"
                  >
                    <span className="task-participants-list__index">
                      #{position}
                    </span>
                    <span className="task-participants-list__name">
                      {participant.name}
                      {isCurrentUser ? (
                        <span className="task-participants-list__you"> (You)</span>
                      ) : null}
                    </span>
                    <span className="task-participants-list__points">
                      {predictedPoints.toFixed(2)} pts
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
