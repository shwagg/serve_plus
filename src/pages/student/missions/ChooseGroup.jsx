import React, { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  increment,
  runTransaction,
} from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import "./ChooseGroup.css";


export default function ChooseGroup({ open, onClose, taskId, missionId, user, onGroupSelected }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [taskMaxParticipants, setTaskMaxParticipants] = useState(null);

  useEffect(() => {
    if (!open) return;
    // Fetch task config and groups for this task
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const taskDocRef = doc(db, "missions", missionId, "task", taskId);
        const taskSnap = await getDoc(taskDocRef);
        const taskMax = taskSnap.exists() ? taskSnap.data()?.maxParticipants : null;
        setTaskMaxParticipants(typeof taskMax === "number" ? taskMax : null);

        const groupCol = collection(db, "missions", missionId, "task", taskId, "group");
        const groupSnap = await getDocs(groupCol);
        const groupList = [];
        for (const groupDoc of groupSnap.docs) {
          const groupData = groupDoc.data();
          let membersCount =
            typeof groupData.memberCount === "number" ? groupData.memberCount : null;
          if (membersCount === null) {
            const membersCol = collection(
              db,
              "missions",
              missionId,
              "task",
              taskId,
              "group",
              groupDoc.id,
              "members"
            );
            const membersSnap = await getDocs(membersCol);
            membersCount = membersSnap.size;
          }
          groupList.push({
            id: groupDoc.id,
            ...groupData,
            membersCount
          });
        }
        setGroups(groupList);
        setLoading(false);
      } catch (err) {
        setError("Failed to load groups");
        setLoading(false);
      }
    };
    fetchGroups();
  }, [open, missionId, taskId]);

  // Create a new group
  const handleCreateGroup = async () => {
    setCreating(true);
    setError(null);
    try {
      // Find next group index
      const nextIndex = groups.length;
      const groupId = String(nextIndex);
      
      // Use transaction to ensure atomic operations
      await runTransaction(db, async (transaction) => {
        // Create group document
        const groupRef = doc(db, "missions", missionId, "task", taskId, "group", groupId);
        transaction.set(groupRef, {
          groupNumber: nextIndex,
          memberCount: 1,
          createdAt: new Date().toISOString(),
          status: "in_progress",
        });

        // Add user as member
        const memberRef = doc(db, "missions", missionId, "task", taskId, "group", groupId, "members", user.uid);
        transaction.set(memberRef, {
          name: user.displayName || user.name || "Anonymous",
          joinedAt: new Date().toISOString(),
        });
      });

      setCreating(false);
      onGroupSelected({ groupId, isNew: true });
      onClose();
    } catch (err) {
      setError("Failed to create group: " + (err?.message || "Unknown error"));
      setCreating(false);
      console.error("Create group error:", err);
    }
  };

  // Join an existing group
  const handleJoinGroup = async (groupId) => {
    setCreating(true);
    setError(null);
    try {
      // Check if group is full
      const groupRef = doc(db, "missions", missionId, "task", taskId, "group", groupId);
      const groupSnap = await getDoc(groupRef);
      
      if (!groupSnap.exists()) {
        throw new Error("Group not found");
      }

      const groupData = groupSnap.data();
      const maxParticipants = typeof groupData.maxParticipants === "number" 
        ? groupData.maxParticipants 
        : taskMaxParticipants;
      
      if (typeof maxParticipants === "number" && groupData.memberCount >= maxParticipants) {
        throw new Error("Group is full");
      }

      // Check if user is already a member
      const memberRef = doc(db, "missions", missionId, "task", taskId, "group", groupId, "members", user.uid);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        throw new Error("You are already in this group");
      }

      // Use transaction to ensure atomic operations
      await runTransaction(db, async (transaction) => {
        // Add user as member
        transaction.set(memberRef, {
          name: user.displayName || user.name || "Anonymous",
          joinedAt: new Date().toISOString(),
        });

        // Increment member count
        transaction.update(groupRef, {
          memberCount: increment(1),
          lastUpdated: new Date().toISOString(),
        });
      });

      setCreating(false);
      onGroupSelected({ groupId, isNew: false });
      onClose();
    } catch (err) {
      setError("Failed to join group: " + (err?.message || "Unknown error"));
      setCreating(false);
      console.error("Join group error:", err);
    }
  };

  // Join a random group
  const handleJoinRandomGroup = async () => {
    if (!groups.length) return handleCreateGroup();
    const availableGroups = groups.filter((group) => {
      const maxParticipants =
        typeof group.maxParticipants === "number" ? group.maxParticipants : taskMaxParticipants;
      if (typeof maxParticipants !== "number") return true;
      return group.membersCount < maxParticipants;
    });
    if (!availableGroups.length) return handleCreateGroup();
    const randomGroup = availableGroups[Math.floor(Math.random() * availableGroups.length)];
    handleJoinGroup(randomGroup.id);
  };

  if (!open) return null;

  return (
    <div className="choose-group-modal-overlay" onClick={onClose}>
      <div className="choose-group-modal-content" onClick={e => e.stopPropagation()}>
        <button className="choose-group-modal-close" onClick={onClose}>×</button>
        <div className="choose-group-modal-title">Choose a Group</div>
        {loading ? (
          <div>Loading groups...</div>
        ) : error ? (
          <div className="choose-group-modal-error">{error}</div>
        ) : (
          <>
            <div className="choose-group-modal-actions">
              <button onClick={handleCreateGroup} disabled={creating}>Create New Group</button>
              <button onClick={handleJoinRandomGroup} disabled={creating}>Join Random Group</button>
            </div>
            <div className="choose-group-modal-groups">
              <h4>Active Groups</h4>
              {groups.length === 0 ? (
                <div>No groups yet.</div>
              ) : (
                <ul>
                  {groups.map(group => {
                    const maxParticipants =
                      typeof group.maxParticipants === "number"
                        ? group.maxParticipants
                        : taskMaxParticipants;
                    const isFull =
                      typeof maxParticipants === "number"
                        ? group.membersCount >= maxParticipants
                        : false;
                    return (
                      <li key={group.id}>
                        <span>Group {group.groupNumber ?? group.id} ({group.membersCount} members)</span>
                        <button
                          onClick={() => handleJoinGroup(group.id)}
                          disabled={creating || isFull}
                          style={isFull ? { background: '#bbb', cursor: 'not-allowed' } : {}}
                        >
                          {isFull ? 'Full' : 'Join'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
