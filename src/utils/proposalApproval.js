export const SIGNATORY_APPROVAL_FIELDS = [
  'reviewedBy',
  'recommendedBy',
  'endorsedBy',
  'approvedBy',
];

export const PROPOSAL_LOCKED_NOTICE =
  'Editing is disabled because this proposal has entered the approval stage. After the first signatory approval, the proposal is locked to preserve the approval record. If a later approver finds an issue, the proposal must be rejected with a reason, revised, and resubmitted.';

function hasFieldValue(value) {
  return typeof value === 'string' ? value.trim() !== '' : Boolean(value);
}

export function hasSignatoryApproval(proposal) {
  if (!proposal) return false;

  return SIGNATORY_APPROVAL_FIELDS.some((field) => {
    if (hasFieldValue(proposal[field])) return true;
    return proposal.approvals?.[field]?.approved === true;
  });
}
