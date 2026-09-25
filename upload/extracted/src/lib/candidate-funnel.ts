/**
 * Canonical hiring funnel for candidates (spec §2 statuses + §1 funnel).
 */

export const CANDIDATE_STATUSES = [
  "new",
  "reviewing",
  "awaiting_invite",
  "invited",
  "interview_confirmed",
  "interview_declined",
  "interview_passed",
  "test_assigned",
  "test_completed",
  "trial_admitted",
  "hired",
  "rejected",
  "reserve",
] as const;

export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const CANDIDATE_SOURCES = [
  "manual",
  "telegram",
  "verifix",
  "other",
] as const;

export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

/** Legacy DB values → canonical status. */
const LEGACY_STATUS_MAP: Record<string, CandidateStatus> = {
  new: "new",
  testing: "test_assigned",
  assessed: "test_completed",
  internship_ready: "trial_admitted",
  internship: "trial_admitted",
  hired: "hired",
  rejected: "rejected",
  reserve: "reserve",
  reviewing: "reviewing",
  awaiting_invite: "awaiting_invite",
  invited: "invited",
  interview_confirmed: "interview_confirmed",
  interview_declined: "interview_declined",
  interview_passed: "interview_passed",
  test_assigned: "test_assigned",
  test_completed: "test_completed",
  trial_admitted: "trial_admitted",
};

export function normalizeCandidateStatus(
  raw: string | null | undefined,
): CandidateStatus {
  if (!raw) return "new";
  return LEGACY_STATUS_MAP[raw] ?? "new";
}

export function isCandidateStatus(value: string): value is CandidateStatus {
  return (CANDIDATE_STATUSES as readonly string[]).includes(value);
}

/** i18n key for a status label. */
export function candidateStatusMessageKey(
  status: string,
): `cand_status_${CandidateStatus}` {
  return `cand_status_${normalizeCandidateStatus(status)}`;
}

/** Suggested next HR action for a status (i18n key). */
export function candidateNextActionKey(
  status: string,
): `cand_next_${CandidateStatus}` {
  return `cand_next_${normalizeCandidateStatus(status)}`;
}

export const ARCHIVED_STATUSES: readonly CandidateStatus[] = [
  "hired",
  "rejected",
  "reserve",
];

export function isArchivedCandidateStatus(status: string) {
  return ARCHIVED_STATUSES.includes(normalizeCandidateStatus(status));
}

/** Hiring funnel stages (spec §1 «Воронка найма»). */
export const FUNNEL_STAGES = [
  "telegram_form",
  "verifix",
  "invited",
  "interview_confirmed",
  "interview_passed",
  "test_assigned",
  "test_completed",
  "trial_admitted",
  "trial_completed",
  "hired",
  "learning_3m",
  "attestation_ready",
  "middle_confirmed",
] as const;

export type FunnelStageId = (typeof FUNNEL_STAGES)[number];

/** Admin dashboard funnel row links. */
export const FUNNEL_STAGE_HREFS: Record<FunnelStageId, string> = {
  telegram_form: "/candidates?source=telegram",
  verifix: "/candidates?source=verifix",
  invited: "/candidates?status=invited",
  interview_confirmed: "/candidates?status=interview_confirmed",
  interview_passed: "/candidates?status=interview_passed",
  test_assigned: "/candidates?status=test_assigned",
  test_completed: "/candidates?status=test_completed",
  trial_admitted: "/trial",
  trial_completed: "/interns",
  hired: "/employees",
  learning_3m: "/learning",
  attestation_ready: "/attestation",
  middle_confirmed: "/employees?level=middle",
};

export const FUNNEL_STAGE_STATUSES: Record<
  FunnelStageId,
  readonly CandidateStatus[] | null
> = {
  telegram_form: null,
  verifix: null,
  invited: ["invited"],
  interview_confirmed: ["interview_confirmed"],
  interview_passed: ["interview_passed"],
  test_assigned: ["test_assigned"],
  test_completed: ["test_completed"],
  trial_admitted: ["trial_admitted", "hired"],
  trial_completed: null,
  hired: ["hired"],
  learning_3m: null,
  attestation_ready: null,
  middle_confirmed: null,
};

export function countByCanonicalStatus(
  rows: { status: string }[],
): Record<CandidateStatus, number> {
  const counts = Object.fromEntries(
    CANDIDATE_STATUSES.map((s) => [s, 0]),
  ) as Record<CandidateStatus, number>;
  for (const row of rows) {
    counts[normalizeCandidateStatus(row.status)] += 1;
  }
  return counts;
}

/** Allowed HR status transitions (soft guide; admin can set any). */
export const STATUS_TRANSITIONS: Partial<
  Record<CandidateStatus, CandidateStatus[]>
> = {
  new: ["reviewing", "awaiting_invite", "rejected", "reserve"],
  reviewing: ["awaiting_invite", "invited", "rejected", "reserve"],
  awaiting_invite: ["invited", "rejected", "reserve"],
  invited: [
    "interview_confirmed",
    "interview_declined",
    "rejected",
    "reserve",
  ],
  interview_confirmed: ["interview_passed", "interview_declined", "rejected"],
  interview_declined: ["invited", "awaiting_invite", "rejected", "reserve"],
  interview_passed: ["test_assigned", "reserve", "rejected"],
  test_assigned: ["test_completed", "rejected"],
  test_completed: ["trial_admitted", "rejected", "reserve"],
  trial_admitted: ["hired", "rejected", "reserve"],
  hired: [],
  rejected: ["reserve", "reviewing"],
  reserve: ["reviewing", "awaiting_invite", "rejected"],
};
