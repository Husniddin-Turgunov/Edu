export const SETTINGS_SECTIONS = [
  "company",
  "permissions",
  "tests",
  "learning",
  "notifications",
  "security",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

export type CompanySettings = {
  name: string;
  logoUrl: string;
  address: string;
  phone: string;
  timezone: string;
  workDays: string;
  workStart: string;
  workEnd: string;
};

export type PermissionSettings = {
  candidateOwnTestOnly: boolean;
  internSeesLessons: boolean;
  mentorSeesMentees: boolean;
  managerSeesDepartment: boolean;
  hrSeesAllCandidates: boolean;
  adminManagesAll: boolean;
  answerKeyHrOnly: boolean;
};

export type TestSettings = {
  questionCount: number;
  durationMinutes: number;
  passScore: number;
  maxAttempts: number;
  randomOrder: boolean;
  forbidReentry: boolean;
  showResultToCandidate: boolean;
};

export type LearningSettings = {
  dayMinutes: number;
  deadlineDays: number;
  passThreshold: number;
  retryAttempts: number;
  overdueBlocksNext: boolean;
  autoAssignLessons: boolean;
};

export type NotificationSettings = {
  candidateInvited: boolean;
  interviewConfirmed: boolean;
  testAssigned: boolean;
  testCompleted: boolean;
  lessonOverdue: boolean;
  workReviewed: boolean;
  attestationAssigned: boolean;
  reachedMiddle: boolean;
};

export type SecuritySettings = {
  minPasswordLength: number;
  twoFactorEnabled: boolean;
  sessionDays: number;
  retentionDays: number;
  consentRequired: boolean;
};

export type SettingsMap = {
  company: CompanySettings;
  permissions: PermissionSettings;
  tests: TestSettings;
  learning: LearningSettings;
  notifications: NotificationSettings;
  security: SecuritySettings;
};

export const DEFAULT_SETTINGS: SettingsMap = {
  company: {
    name: "AKELA GROUP",
    logoUrl: "/akela-logo.png?v=nobox",
    address: "",
    phone: "",
    timezone: "Asia/Tashkent",
    workDays: "mon-fri",
    workStart: "09:00",
    workEnd: "18:00",
  },
  permissions: {
    candidateOwnTestOnly: true,
    internSeesLessons: true,
    mentorSeesMentees: true,
    managerSeesDepartment: true,
    hrSeesAllCandidates: true,
    adminManagesAll: true,
    answerKeyHrOnly: true,
  },
  tests: {
    questionCount: 15,
    durationMinutes: 25,
    passScore: 60,
    maxAttempts: 1,
    randomOrder: true,
    forbidReentry: true,
    showResultToCandidate: false,
  },
  learning: {
    dayMinutes: 480,
    deadlineDays: 1,
    passThreshold: 70,
    retryAttempts: 2,
    overdueBlocksNext: true,
    autoAssignLessons: true,
  },
  notifications: {
    candidateInvited: true,
    interviewConfirmed: true,
    testAssigned: true,
    testCompleted: true,
    lessonOverdue: true,
    workReviewed: true,
    attestationAssigned: true,
    reachedMiddle: true,
  },
  security: {
    minPasswordLength: 8,
    twoFactorEnabled: false,
    sessionDays: 7,
    retentionDays: 365,
    consentRequired: false,
  },
};

export function mergeSettings<K extends SettingsSection>(
  section: K,
  stored: Record<string, unknown> | null | undefined,
): SettingsMap[K] {
  const defaults = DEFAULT_SETTINGS[section];
  const raw = stored ?? {};
  const out = { ...defaults } as Record<string, unknown>;
  for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
    const incoming = raw[key as string];
    const current = defaults[key];
    if (typeof current === "boolean") {
      if (incoming === undefined) out[key as string] = current;
      else out[key as string] = incoming === true || incoming === "1";
    } else if (typeof current === "number") {
      const n = Number(incoming);
      out[key as string] = Number.isFinite(n) ? n : current;
    } else if (typeof incoming === "string") {
      out[key as string] = incoming;
    }
  }
  return out as SettingsMap[K];
}

export const NOTIFICATION_TYPE_FLAGS: Record<string, keyof NotificationSettings> = {
  interview_invite: "candidateInvited",
  candidate_invited: "candidateInvited",
  interview_confirmed: "interviewConfirmed",
  test_assigned: "testAssigned",
  test_completed: "testCompleted",
  lesson_overdue: "lessonOverdue",
  work_reviewed: "workReviewed",
  attestation_assigned: "attestationAssigned",
  reached_middle: "reachedMiddle",
};
