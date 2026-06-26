import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, increment, onSnapshot, runTransaction} from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import "./GroupModal.css";

function sortGroupsByNumber(a, b) {
	const aNumber = Number(a.groupNumber);
	const bNumber = Number(b.groupNumber);
	const aHasNumber = Number.isFinite(aNumber);
	const bHasNumber = Number.isFinite(bNumber);

	if (aHasNumber && bHasNumber && aNumber !== bNumber) {
		return aNumber - bNumber;
	}
	if (aHasNumber) return -1;
	if (bHasNumber) return 1;
	return String(a.id).localeCompare(String(b.id));
}

function resolveMemberName(userData, memberDocId, memberData) {
	return (
		memberData?.name ||
		userData?.username ||
		userData?.name ||
		userData?.email?.split("@")[0] ||
		memberDocId
	);
}

export default function GroupModal({
	open,
	onClose,
	missionId,
	task,
	user,
	mode = "view",
	onGroupSelected,
}) {
	const [groups, setGroups] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [working, setWorking] = useState(false);

	const taskId = task?.id || "";
	const currentUserUid = user?.uid || "";
	const baseTaskPoints = Number(task?.points) || 0;
	const allowJoin = mode === "join";
	const taskMaxParticipants = Number.isFinite(Number(task?.maxParticipants))
		? Number(task.maxParticipants)
		: null;
	const taskMaxGroups = Number.isFinite(Number(task?.maxGroups))
		? Number(task.maxGroups)
		: null;

	useEffect(() => {
		let isMounted = true;

		if (!open || !missionId || !taskId) {
			setGroups([]);
			setLoading(false);
			setError("");
			return () => {
				isMounted = false;
			};
		}

		setLoading(true);
		setError("");

		const groupsRef = collection(db, "missions", missionId, "task", taskId, "group");

		const unsubscribe = onSnapshot(
			groupsRef,
			async (groupsSnap) => {
				try {
					const loadedGroups = await Promise.all(
						groupsSnap.docs.map(async (groupDoc) => {
							const groupData = groupDoc.data();
							const membersSnap = await getDocs(collection(groupDoc.ref, "members"));

							const members = await Promise.all(
								membersSnap.docs.map(async (memberDoc) => {
									const memberData = memberDoc.data();
									let userData = null;

									if (!memberData?.name) {
										const userSnap = await getDoc(doc(db, "users", memberDoc.id));
										userData = userSnap.exists() ? userSnap.data() : null;
									}

									return {
										uid: memberDoc.id,
										name: resolveMemberName(userData, memberDoc.id, memberData),
										joinedAt: memberData?.joinedAt || "",
									};
								}),
							);

							members.sort((a, b) => {
								const joinedCompare = String(a.joinedAt).localeCompare(String(b.joinedAt));
								if (joinedCompare !== 0) return joinedCompare;
								return String(a.name).localeCompare(String(b.name));
							});

							const fallbackMemberCount = members.length;
							const memberCount = Number.isFinite(Number(groupData.memberCount))
								? Number(groupData.memberCount)
								: fallbackMemberCount;

							return {
								id: groupDoc.id,
								...groupData,
								memberCount,
								members,
							};
						}),
					);

					loadedGroups.sort(sortGroupsByNumber);

					if (isMounted) {
						setGroups(loadedGroups);
						setLoading(false);
					}
				} catch (snapshotError) {
					console.error("Failed to load grouped task details:", snapshotError);
					if (isMounted) {
						setGroups([]);
						setError("Failed to load groups.");
						setLoading(false);
					}
				}
			},
			(snapshotError) => {
				console.error("Failed to subscribe groups:", snapshotError);
				if (isMounted) {
					setGroups([]);
					setError("Failed to subscribe groups.");
					setLoading(false);
				}
			},
		);

		return () => {
			isMounted = false;
			unsubscribe();
		};
	}, [open, missionId, taskId]);

	const currentUserGroup = useMemo(
		() => groups.find((group) => group.members.some((member) => member.uid === currentUserUid)),
		[groups, currentUserUid],
	);
	const isGroupCreationFull = Number.isFinite(taskMaxGroups) && groups.length >= taskMaxGroups;

	const getEffectiveMaxParticipants = (group) => {
		const groupLimit = Number(group?.maxParticipants);
		if (Number.isFinite(groupLimit)) return groupLimit;
		return taskMaxParticipants;
	};

	const getNextGroupNumber = () => {
		const highestGroupNumber = groups.reduce((maxNumber, group) => {
			const current = Number(group.groupNumber);
			if (Number.isFinite(current) && current > maxNumber) {
				return current;
			}
			return maxNumber;
		}, 0);

		return highestGroupNumber + 1;
	};

	const resolveDisplayName = () =>
		user?.displayName || user?.name || user?.email?.split("@")[0] || "Anonymous";

	const handleCreateGroup = async () => {
		if (!allowJoin || !user || !missionId || !taskId) return;

		if (currentUserGroup) {
			setError("You are already in a group for this task.");
			return;
		}

		setWorking(true);
		setError("");

		try {
			const groupsRef = collection(db, "missions", missionId, "task", taskId, "group");
			const newGroupRef = doc(groupsRef);
			const taskRef = doc(db, "missions", missionId, "task", taskId);
			const groupNumber = getNextGroupNumber();
			const createdAt = new Date().toISOString();
			const memberName = resolveDisplayName();

			await runTransaction(db, async (transaction) => {
				const taskSnap = await transaction.get(taskRef);
				if (!taskSnap.exists()) {
					throw new Error("Task not found.");
				}

				const taskData = taskSnap.data();
				const maxGroups = Number(taskData?.maxGroups);
				const currentGroupCount = Number.isFinite(Number(taskData?.groupCount))
					? Number(taskData.groupCount)
					: groups.length;

				if (Number.isFinite(maxGroups) && currentGroupCount >= maxGroups) {
					throw new Error("Maximum groups reached for this task.");
				}

				transaction.set(newGroupRef, {
					groupNumber,
					memberCount: 1,
					createdAt,
					status: "in_progress",
				});
				transaction.update(taskRef, {
					groupCount: Number.isFinite(Number(taskData?.groupCount))
						? increment(1)
						: currentGroupCount + 1,
				});

				const memberRef = doc(newGroupRef, "members", user.uid);
				transaction.set(memberRef, {
					name: memberName,
					joinedAt: createdAt,
				});
			});

			onGroupSelected?.({ groupId: newGroupRef.id, isNew: true });
			onClose?.();
		} catch (joinError) {
			console.error("Failed to create group:", joinError);
			setError(joinError?.message || "Failed to create group.");
		} finally {
			setWorking(false);
		}
	};

	const handleJoinGroup = async (groupId) => {
		if (!allowJoin || !user || !missionId || !taskId) return;

		if (currentUserGroup && currentUserGroup.id !== groupId) {
			setError("You are already in another group for this task.");
			return;
		}

		setWorking(true);
		setError("");

		try {
			const groupRef = doc(db, "missions", missionId, "task", taskId, "group", groupId);
			const memberRef = doc(groupRef, "members", user.uid);
			const joinedAt = new Date().toISOString();
			const memberName = resolveDisplayName();

			await runTransaction(db, async (transaction) => {
				const [groupSnap, memberSnap] = await Promise.all([
					transaction.get(groupRef),
					transaction.get(memberRef),
				]);

				if (!groupSnap.exists()) {
					throw new Error("Group not found.");
				}

				if (memberSnap.exists()) {
					return;
				}

				const groupData = groupSnap.data();
				const maxParticipants = Number.isFinite(Number(groupData?.maxParticipants))
					? Number(groupData.maxParticipants)
					: taskMaxParticipants;
				const currentCount = Number(groupData?.memberCount) || 0;

				if (Number.isFinite(maxParticipants) && currentCount >= maxParticipants) {
					throw new Error("This group is already full.");
				}

				transaction.set(memberRef, {
					name: memberName,
					joinedAt,
				});

				transaction.update(groupRef, {
					memberCount: increment(1),
					lastUpdated: joinedAt,
				});
			});

			onGroupSelected?.({ groupId, isNew: false });
			onClose?.();
		} catch (joinError) {
			console.error("Failed to join group:", joinError);
			setError(joinError?.message || "Failed to join group.");
		} finally {
			setWorking(false);
		}
	};

	const handleJoinRandomGroup = () => {
		if (!allowJoin) return;

		const availableGroups = groups.filter((group) => {
			const maxParticipants = getEffectiveMaxParticipants(group);
			if (!Number.isFinite(maxParticipants)) return true;
			return group.memberCount < maxParticipants;
		});

		if (!availableGroups.length) {
			if (Number.isFinite(taskMaxGroups) && groups.length >= taskMaxGroups) {
				setError("Maximum groups reached for this task.");
				return;
			}
			handleCreateGroup();
			return;
		}

		const randomIndex = Math.floor(Math.random() * availableGroups.length);
		const selectedGroup = availableGroups[randomIndex];
		handleJoinGroup(selectedGroup.id);
	};

	if (!open || !task) return null;

	return (
		<div
			className="ea-modal-overlay"
			onClick={(event) => {
				if (event.target === event.currentTarget) onClose?.();
			}}
		>
			<div
				className="ea-modal-card task-participants-modal group-modal"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="ea-modal-header">
					<h3 className="ea-modal-title">Groups for {task.title || "Grouped Task"}</h3>
					<button className="ea-modal-close" onClick={() => onClose?.()} aria-label="Close">
						x
					</button>
				</div>

				<div className="task-participants-modal__body group-modal__body">
					<div className="task-participants-modal__summary group-modal__summary">
						<span className="task-participants-modal__summary-label">Points per member:</span>
						<span className="task-participants-modal__summary-value">{baseTaskPoints} pts</span>
					</div>
					{Number.isFinite(taskMaxGroups) ? (
						<div className="task-participants-modal__summary group-modal__summary">
							<span className="task-participants-modal__summary-label">Groups:</span>
							<span className="task-participants-modal__summary-value">{groups.length}/{taskMaxGroups}</span>
						</div>
					) : null}

					{currentUserGroup ? (
						<div className="group-modal__current">Your current group: Group {currentUserGroup.groupNumber ?? currentUserGroup.id}</div>
					) : null}

					{allowJoin ? (
						<div className="group-modal__actions">
							<button className="task-join-btn" onClick={handleCreateGroup} disabled={working || isGroupCreationFull}>
								{isGroupCreationFull ? "Groups Full" : "Create Group"}
							</button>
							<button className="task-join-btn group-modal__random-btn" onClick={handleJoinRandomGroup} disabled={working}>
								Join Random
							</button>
						</div>
					) : null}

					{error ? <div className="group-modal__error">{error}</div> : null}

					{loading ? (
						<div className="task-participants-modal__state">Loading groups...</div>
					) : groups.length === 0 ? (
						<div className="task-participants-modal__state">
							{allowJoin ? "No groups yet. Create the first group." : "No groups yet."}
						</div>
					) : (
						<div className="group-modal__list" role="list" aria-label="Task groups">
							{groups.map((group, index) => {
								const maxParticipants = getEffectiveMaxParticipants(group);
								const isFull = Number.isFinite(maxParticipants)
									? group.memberCount >= maxParticipants
									: false;
								const slotPct = Number.isFinite(maxParticipants) && maxParticipants > 0
									? Math.min((group.memberCount / maxParticipants) * 100, 100)
									: 0;
								const isCurrentUserGroup = group.members.some((member) => member.uid === currentUserUid);

								return (
									<div
										key={group.id}
										className={`group-modal__group-card${isCurrentUserGroup ? " group-modal__group-card--current" : ""}`}
										role="listitem"
									>
										<div className="group-modal__group-header">
											<div>
												<h4 className="group-modal__group-title">Group {group.groupNumber ?? index + 1}</h4>
											</div>

											{allowJoin ? (
												<button
													className="task-join-btn group-modal__group-join-btn"
													onClick={() => handleJoinGroup(group.id)}
													disabled={working || isFull || isCurrentUserGroup}
												>
													{isCurrentUserGroup ? "Joined" : isFull ? "Full" : "Join"}
												</button>
											) : null}
										</div>

										{Number.isFinite(maxParticipants) && maxParticipants > 0 ? (
											<div className="group-modal__slot-wrap">
												<div className="group-modal__slot-bar">
													<div
														className="group-modal__slot-fill"
														style={{ width: `${slotPct}%`, background: isFull ? "#ef4444" : "#30bdb7" }}
													/>
												</div>
												<span className="group-modal__slot-label">
													{group.memberCount}/{maxParticipants} members{isFull ? " · Full" : ""}
												</span>
											</div>
										) : null}

										<div className="group-modal__members">
											{group.members.length === 0 ? (
												<span className="group-modal__member group-modal__member--empty">No members yet</span>
											) : (
												group.members.map((member) => (
													<span
														key={member.uid}
														className={`group-modal__member${member.uid === currentUserUid ? " group-modal__member--you" : ""}`}
													>
														{member.name}
														{member.uid === currentUserUid ? " (You)" : ""}
													</span>
												))
											)}
										</div>
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
