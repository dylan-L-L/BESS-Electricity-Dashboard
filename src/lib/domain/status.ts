import type { NormalizedStatus, ReviewStatus } from "../types";

export const NORMALIZED_STATUS_LABELS: Record<NormalizedStatus, string> = {
  draft: "Draft",
  consultation: "Consultation",
  filed: "Filed",
  approved: "Approved",
  effective: "Effective",
  suspended: "Suspended",
  other: "Other",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  ai_draft: "AI Draft",
  pending_review: "Pending Review",
  published: "Published",
  rejected: "Rejected",
};

export function normalizedStatusLabel(status: NormalizedStatus): string {
  return NORMALIZED_STATUS_LABELS[status];
}
export function reviewStatusLabel(status: ReviewStatus): string {
  return REVIEW_STATUS_LABELS[status];
}
