import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { logAudit } from "./auditLogger";
import { notifyCommunityChairsForProposal } from "./notificationUtils";

export function isProposalReadyToPublish(proposal) {
  if (!proposal) return false;
  const status = String(proposal.status || "").toLowerCase();
  return status === "draft" &&
    ["reviewedBy", "recommendedBy", "endorsedBy", "approvedBy"].every((field) =>
      typeof proposal[field] === "string" && proposal[field].trim() !== ""
    );
}

export function canCurrentUserPublishProposal(proposal, user = auth.currentUser) {
  return !!user && proposal?.createdBy === user.uid && isProposalReadyToPublish(proposal);
}

export async function publishApprovedProposal(proposal, userData = {}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be logged in to publish this event.");
  }
  if (!canCurrentUserPublishProposal(proposal, user)) {
    throw new Error("Only the proposal creator can publish after all approvals are complete.");
  }

  const taskCollectionRef = collection(db, "missions", proposal.id, "task");
  const existingTasksSnap = await getDocs(taskCollectionRef);
  const existingTaskIds = new Set(existingTasksSnap.docs.map((taskDoc) => taskDoc.id));
  const activities = Array.isArray(proposal.specificActivities)
    ? proposal.specificActivities
      .map((item) => String(typeof item === "string" ? item : item?.name || item?.title || "").trim())
      .filter(Boolean)
    : [];

  const batch = writeBatch(db);

  activities.forEach((activityTitle, index) => {
    const taskRef = doc(db, "missions", proposal.id, "task", String(index));
    const proposalTaskFields = {
      title: activityTitle,
      sourceActivityIndex: index,
      sourceActivityTitle: activityTitle,
      isProposalActivity: true,
      updatedAt: serverTimestamp(),
    };

    if (existingTaskIds.has(String(index))) {
      batch.set(taskRef, proposalTaskFields, { merge: true });
    } else {
      batch.set(taskRef, {
        ...proposalTaskFields,
        description: "",
        points: 0,
        type: "individual",
        maxParticipants: 5,
        participantCount: 0,
        createdAt: new Date().toISOString(),
      });
    }
  });

  const publisherName =
    userData?.name ||
    userData?.username ||
    user.displayName ||
    user.email ||
    "";

  batch.update(doc(db, "missions", proposal.id), {
    status: "published",
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedBy: user.uid,
    publishedByName: publisherName,
  });

  await batch.commit();

  await logAudit({
    action: "PROPOSAL_PUBLISHED",
    category: "proposal",
    actorName: publisherName,
    details: {
      proposalId: proposal.id,
      proposalTitle: proposal.title || "",
    },
  });

  notifyCommunityChairsForProposal(
    proposal,
    {
      type: "proposal_status",
      title: "Department Proposal Published",
      message: `"${proposal.title || "Untitled"}" was published by ${publisherName || "the proponent"}.`,
      proposalId: proposal.id,
    },
    { excludeUserIds: [user.uid, proposal.createdBy] },
  ).catch((error) => {
    console.error("Error sending community chair publish notifications:", error);
  });
}
