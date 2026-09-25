import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const employees = sqliteTable("employees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().default(""),
  telegram: text("telegram").notNull().default(""),
  department: text("department").notNull(),
  roleTitle: text("role_title").notNull(),
  currentLevel: text("current_level").notNull().default("junior"),
  startingLevel: text("starting_level").notNull().default("junior"),
  targetLevel: text("target_level").notNull().default("middle"),
  /** active | probation | learning | paused | left */
  status: text("status").notNull().default("active"),
  workSchedule: text("work_schedule").notNull().default(""),
  managerEmployeeId: integer("manager_employee_id"),
  mentorUserId: integer("mentor_user_id"),
  nextCheckAt: text("next_check_at"),
  avatarHue: integer("avatar_hue").notNull().default(160),
  /** Hire / start date for tenure; falls back to createdAt when null. */
  hiredAt: text("hired_at"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Dual-purpose rows:
 * - kind=audience — test audiences («для сотрудников/стажёров/кандидатов»)
 * - kind=skill — real competencies for Phase 10 catalog + employee matrix
 */
export const competencies = sqliteTable("competencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  /** audience | skill */
  kind: text("kind").notNull().default("skill"),
  /** junior | middle | all — target level band for the skill */
  levelScope: text("level_scope").notNull().default("all"),
  /** test | mentor | practice | attestation | other */
  verificationMethod: text("verification_method").notNull().default("test"),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(true),
  weight: integer("weight").notNull().default(1),
  isCriticalError: integer("is_critical_error", { mode: "boolean" })
    .notNull()
    .default(false),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

/** Per-employee competency matrix for Phase 6. */
export const employeeCompetencies = sqliteTable("employee_competencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  competencyId: integer("competency_id")
    .notNull()
    .references(() => competencies.id),
  /**
   * not_checked | doesnt_know | partial | junior | junior_plus |
   * middle_minus | middle | needs_recheck
   */
  status: text("status").notNull().default("not_checked"),
  note: text("note").notNull().default(""),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedByUserId: integer("updated_by_user_id"),
});

export type EmployeeCompetency = typeof employeeCompetencies.$inferSelect;

export const levelDefinitions = sqliteTable("level_definitions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  minScore: integer("min_score").notNull(),
  maxScore: integer("max_score").notNull(),
  description: text("description").notNull(),
  nextSteps: text("next_steps").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const assessments = sqliteTable("assessments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  competencyId: integer("competency_id")
    .notNull()
    .references(() => competencies.id),
  durationMinutes: integer("duration_minutes").notNull().default(20),
  passScore: integer("pass_score").notNull().default(60),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  /** Google Drive file id — used to skip already-imported tests */
  driveFileId: text("drive_file_id"),
  driveModifiedAt: text("drive_modified_at"),
  /** library | candidate | trial | intern | level | attestation | learning */
  source: text("source").notNull().default("library"),
});

export const questions = sqliteTable("questions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id),
  prompt: text("prompt").notNull(),
  /** single | multiple | text */
  type: text("type").notNull().default("single"),
  optionsJson: text("options_json").notNull().default("[]"),
  /** Legacy single-choice correct option index */
  correctIndex: integer("correct_index").notNull().default(0),
  /** JSON number[] — correct option indexes for single/multiple */
  correctIndexesJson: text("correct_indexes_json").notNull().default("[]"),
  /** JSON string[] — keywords for written answers */
  keywordsJson: text("keywords_json").notNull().default("[]"),
  weight: integer("weight").notNull().default(1),
  /** optional legacy band */
  difficulty: text("difficulty").notNull().default("junior"),
  /** knowledge | aspiration (legacy: theory|practice → knowledge) */
  knowledgeKind: text("knowledge_kind").notNull().default("knowledge"),
  /** Название раздела, напр. «Продажи», «Сервис», «Стремление» */
  section: text("section").notNull().default("Общий"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});

export const assignments = sqliteTable("assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  status: text("status").notNull().default("pending"),
  assignedAt: text("assigned_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  dueAt: text("due_at"),
});

export const results = sqliteTable("results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignments.id),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id),
  score: real("score").notNull(),
  levelCode: text("level_code").notNull(),
  answersJson: text("answers_json").notNull(),
  /** JSON KnowledgeProfile — что знает по теории/практике и сложности */
  profileJson: text("profile_json").notNull().default("{}"),
  completedAt: text("completed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const vacancies = sqliteTable("vacancies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().default(""),
  roleTitle: text("role_title").notNull(),
  department: text("department").notNull(),
  status: text("status").notNull().default("open"),
  /** Set when vacancy is filled or closed — used for time-to-close reports. */
  closedAt: text("closed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Mutable organizational positions imported from the staffing workbook. */
export const staffingPositions = sqliteTable("staffing_positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  roleTitle: text("role_title").notNull(),
  department: text("department").notNull(),
  employeeId: integer("employee_id").references(() => employees.id),
  email: text("email"),
  isPrimary: integer("is_primary", { mode: "boolean" })
    .notNull()
    .default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" })
    .notNull()
    .default(true),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Phase 10 catalog: one profile per unique должность (department + role title).
 * Staffing seats stay in staffing_positions; this holds requirements & materials links.
 */
export const roleProfiles = sqliteTable("role_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  roleTitle: text("role_title").notNull(),
  department: text("department").notNull(),
  managerName: text("manager_name").notNull().default(""),
  description: text("description").notNull().default(""),
  duties: text("duties").notNull().default(""),
  requirements: text("requirements").notNull().default(""),
  /** JSON string[] — programs / tools labels */
  programsJson: text("programs_json").notNull().default("[]"),
  toolsJson: text("tools_json").notNull().default("[]"),
  /** JSON LevelRequirements for Junior */
  juniorReqJson: text("junior_req_json").notNull().default("{}"),
  /** JSON LevelRequirements for Middle */
  middleReqJson: text("middle_req_json").notNull().default("{}"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Skills required for a role profile. */
export const roleCompetencies = sqliteTable("role_competencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roleProfileId: integer("role_profile_id")
    .notNull()
    .references(() => roleProfiles.id),
  competencyId: integer("competency_id")
    .notNull()
    .references(() => competencies.id),
  isRequired: integer("is_required", { mode: "boolean" }).notNull().default(true),
  weight: integer("weight").notNull().default(1),
  /** junior | middle | all */
  levelScope: text("level_scope").notNull().default("all"),
});

/** Job applicants linked to an open vacancy (штатная вакансия). */
export const candidates = sqliteTable("candidates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  telegram: text("telegram").notNull().default(""),
  /** manual | telegram | verifix | other */
  source: text("source").notNull().default("manual"),
  vacancyId: integer("vacancy_id")
    .notNull()
    .references(() => vacancies.id),
  status: text("status").notNull().default("new"),
  /** Confirmed level from test / HR */
  currentLevel: text("current_level").notNull().default("unassessed"),
  /** Level claimed by candidate */
  claimedLevel: text("claimed_level").notNull().default(""),
  interviewResult: text("interview_result").notNull().default(""),
  hrOwnerUserId: integer("hr_owner_user_id"),
  photoUrl: text("photo_url"),
  birthDate: text("birth_date"),
  address: text("address").notNull().default(""),
  desiredSalary: text("desired_salary").notNull().default(""),
  availableFrom: text("available_from"),
  /** Free-form resume / skills blob */
  profileJson: text("profile_json").notNull().default("{}"),
  avatarHue: integer("avatar_hue").notNull().default(200),
  notes: text("notes").notNull().default(""),
  /** Why the candidate was rejected (Phase 11 reports). */
  rejectionReason: text("rejection_reason").notNull().default(""),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  /** Portal login for candidate-only area */
  portalLogin: text("portal_login"),
  portalPasswordHash: text("portal_password_hash"),
  portalEnabled: integer("portal_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Timeline of candidate funnel events (invite, interview, comments…). */
export const candidateEvents = sqliteTable("candidate_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidates.id),
  /** status_change | comment | document | invite | interview | test | decision */
  kind: text("kind").notNull().default("comment"),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  actorUserId: integer("actor_user_id"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Interview calendar entries for hiring funnel (§3). */
export const interviews = sqliteTable("interviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidates.id),
  vacancyId: integer("vacancy_id").references(() => vacancies.id),
  scheduledAt: text("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  /** office | online | phone */
  format: text("format").notNull().default("office"),
  address: text("address").notNull().default(""),
  geoUrl: text("geo_url").notNull().default(""),
  room: text("room").notNull().default(""),
  hrOwnerUserId: integer("hr_owner_user_id"),
  interviewerName: text("interviewer_name").notNull().default(""),
  departmentHead: text("department_head").notNull().default(""),
  commentToCandidate: text("comment_to_candidate").notNull().default(""),
  /** pending | confirmed | declined | reschedule */
  confirmStatus: text("confirm_status").notNull().default("pending"),
  /** scheduled | completed | cancelled | no_show */
  status: text("status").notNull().default("scheduled"),
  /** JSON evaluation scores/comments */
  evaluationJson: text("evaluation_json").notNull().default("{}"),
  /**
   * assign_test | extra_interview | other_role | reserve | reject
   */
  decision: text("decision"),
  decisionComment: text("decision_comment").notNull().default(""),
  /** Stub Telegram notification payload/log */
  notifyJson: text("notify_json").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const candidateAssignments = sqliteTable("candidate_assignments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidates.id),
  status: text("status").notNull().default("pending"),
  assignedAt: text("assigned_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  dueAt: text("due_at"),
  confirmedAt: text("confirmed_at"),
  startedAt: text("started_at"),
  expiresAt: text("expires_at"),
});

export const candidateResults = sqliteTable("candidate_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => candidateAssignments.id),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidates.id),
  assessmentId: integer("assessment_id")
    .notNull()
    .references(() => assessments.id),
  score: real("score").notNull(),
  levelCode: text("level_code").notNull(),
  answersJson: text("answers_json").notNull(),
  profileJson: text("profile_json").notNull().default("{}"),
  /** Candidate attempt telemetry: answer changes, page exits, timeout, device. */
  telemetryJson: text("telemetry_json").notNull().default("{}"),
  completedAt: text("completed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Fixed kiosk slots 1–5 for candidate testing without login. */
export const candidateTerminalSlots = sqliteTable("candidate_terminal_slots", {
  slotNumber: integer("slot_number").primaryKey(),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Queue of candidates waiting on a terminal slot. */
export const candidateTerminalQueue = sqliteTable("candidate_terminal_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slotNumber: integer("slot_number").notNull(),
  candidateId: integer("candidate_id")
    .notNull()
    .references(() => candidates.id),
  assignmentId: integer("assignment_id").references(
    () => candidateAssignments.id,
  ),
  sortOrder: integer("sort_order").notNull().default(0),
  /** queued | active | testing | done */
  status: text("status").notNull().default("queued"),
  confirmedAt: text("confirmed_at"),
  startedAt: text("started_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type Employee = typeof employees.$inferSelect;
export type Competency = typeof competencies.$inferSelect;
export type LevelDefinition = typeof levelDefinitions.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Result = typeof results.$inferSelect;
export type Vacancy = typeof vacancies.$inferSelect;
export type StaffingPosition = typeof staffingPositions.$inferSelect;
export type RoleProfile = typeof roleProfiles.$inferSelect;
export type RoleCompetency = typeof roleCompetencies.$inferSelect;
export type Candidate = typeof candidates.$inferSelect;
export type CandidateEvent = typeof candidateEvents.$inferSelect;
export type Interview = typeof interviews.$inferSelect;
export type CandidateAssignment = typeof candidateAssignments.$inferSelect;
export type CandidateResult = typeof candidateResults.$inferSelect;
export type CandidateTerminalSlot = typeof candidateTerminalSlots.$inferSelect;
export type CandidateTerminalQueueItem =
  typeof candidateTerminalQueue.$inferSelect;

export const platformUsers = sqliteTable("platform_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  /** Plain password for admin display only (internal HR tool). */
  passwordPlain: text("password_plain"),
  /** admin | observer | manager | participant */
  role: text("role").notNull(),
  /** employee | intern | candidate — only for participants */
  participantKind: text("participant_kind"),
  displayName: text("display_name").notNull(),
  profileJobTitle: text("profile_job_title"),
  profileDepartment: text("profile_department"),
  avatarData: text("avatar_data"),
  avatarHue: integer("avatar_hue").notNull().default(220),
  employeeId: integer("employee_id").references(() => employees.id),
  candidateId: integer("candidate_id").references(() => candidates.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  /** Mandatory first-login orientation for intern accounts: 0..5. */
  onboardingStep: integer("onboarding_step").notNull().default(0),
  onboardingCompletedAt: text("onboarding_completed_at"),
  preferredLocale: text("preferred_locale").notNull().default("ru"),
  /** JSON: UI prefs + optional contact fields for admin profile. */
  uiPreferencesJson: text("ui_preferences_json").notNull().default("{}"),
  /** JSON string[] of mentor competency labels for Phase 9 directory. */
  mentorCompetenciesJson: text("mentor_competencies_json").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type PlatformUser = typeof platformUsers.$inferSelect;

/** Intern/employee feedback used for mentor rating. */
export const mentorRatings = sqliteTable("mentor_ratings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mentorUserId: integer("mentor_user_id")
    .notNull()
    .references(() => platformUsers.id),
  fromEmployeeId: integer("from_employee_id")
    .notNull()
    .references(() => employees.id),
  score: integer("score").notNull().default(5),
  comment: text("comment").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type MentorRating = typeof mentorRatings.$inferSelect;

/** Admin-designed home canvases for observer, manager, employee, intern. */
export const roleHomePages = sqliteTable("role_home_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  audience: text("audience").notNull().unique(),
  documentJson: text("document_json").notNull().default("{}"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedByUserId: integer("updated_by_user_id"),
});

export type RoleHomePage = typeof roleHomePages.$inferSelect;

/** Admin-designed onboarding/company pages, keyed by step and locale. */
export const visualContentPages = sqliteTable("visual_content_pages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pageKey: text("page_key").notNull().unique(),
  documentJson: text("document_json").notNull().default("{}"),
  version: integer("version").notNull().default(1),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedByUserId: integer("updated_by_user_id"),
});

export type VisualContentPage = typeof visualContentPages.$inferSelect;

/** Admin-editable learning lessons (participant «Обучение»). */
export const learningLessons = sqliteTable("learning_lessons", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  content: text("content").notNull().default(""),
  /** text | html — Drive Word imports use html */
  contentFormat: text("content_format").notNull().default("text"),
  /** Structured Phase 7 fields (may mirror sections inside content HTML). */
  goal: text("goal").notNull().default(""),
  material: text("material").notNull().default(""),
  example: text("example").notNull().default(""),
  instruction: text("instruction").notNull().default(""),
  practice: text("practice").notNull().default(""),
  criteria: text("criteria").notNull().default(""),
  /** 1 | 2 | 3 — month in Junior→Middle program */
  programMonth: integer("program_month").notNull().default(0),
  /** basic | check | hard_case */
  track: text("track").notNull().default("basic"),
  level: text("level").notNull().default("junior"),
  roleFamiliesJson: text("role_families_json").notNull().default("[]"),
  topicsJson: text("topics_json").notNull().default("[]"),
  durationMin: integer("duration_min").notNull().default(20),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  driveFileId: text("drive_file_id"),
  driveModifiedAt: text("drive_modified_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Verification tests linked 1:1 (or N:1) to a lesson. */
export const learningTests = sqliteTable("learning_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  slug: text("slug").notNull().unique(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => learningLessons.id),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  level: text("level").notNull().default("junior"),
  roleFamiliesJson: text("role_families_json").notNull().default("[]"),
  topicsJson: text("topics_json").notNull().default("[]"),
  durationMin: integer("duration_min").notNull().default(10),
  /** JSON VerificationQuestion[] — used when assessmentId is null */
  questionsJson: text("questions_json").notNull().default("[]"),
  /** Optional full assessment from library */
  assessmentId: integer("assessment_id").references(() => assessments.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Employee lesson workflow (Phase 7).
 * Status: not_started | studying | submitted | returned | fixing |
 * accepted | recheck | credited
 */
export const lessonProgress = sqliteTable("lesson_progress", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => learningLessons.id),
  status: text("status").notNull().default("not_started"),
  deadlineAt: text("deadline_at"),
  answerText: text("answer_text").notNull().default(""),
  answerFileUrl: text("answer_file_url").notNull().default(""),
  mentorComment: text("mentor_comment").notNull().default(""),
  submittedAt: text("submitted_at"),
  reviewedAt: text("reviewed_at"),
  reviewedByUserId: integer("reviewed_by_user_id"),
  completedAt: text("completed_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Individual 3-month Middle program for an employee. */
export const employeeLearningPrograms = sqliteTable(
  "employee_learning_programs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    targetLevel: text("target_level").notNull().default("middle"),
    status: text("status").notNull().default("active"),
    startsAt: text("starts_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    generatedAt: text("generated_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    month1Theme: text("month1_theme").notNull().default(""),
    month2Theme: text("month2_theme").notNull().default(""),
    month3Theme: text("month3_theme").notNull().default(""),
  },
);

export const employeeProgramItems = sqliteTable("employee_program_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  programId: integer("program_id")
    .notNull()
    .references(() => employeeLearningPrograms.id),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => learningLessons.id),
  competencyId: integer("competency_id"),
  month: integer("month").notNull().default(1),
  /** full | check_only | hard_case | skip */
  pathMode: text("path_mode").notNull().default("full"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type EmployeeLearningProgram =
  typeof employeeLearningPrograms.$inferSelect;
export type EmployeeProgramItem = typeof employeeProgramItems.$inferSelect;

/** Standalone department attestation with its own questions and window. */
export const attestations = sqliteTable("attestations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull().default("Аттестация"),
  description: text("description").notNull().default(""),
  department: text("department").notNull().default(""),
  positionTitlesJson: text("position_titles_json").notNull().default("[]"),
  scheduledAt: text("scheduled_at").notNull(),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  durationMinutes: integer("duration_minutes").notNull().default(40),
  passingScore: integer("passing_score").notNull().default(70),
  assessmentId: integer("assessment_id").references(() => assessments.id),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Individual employee attestation card and signed protocol. */
export const attestationReviews = sqliteTable("attestation_reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attestationId: integer("attestation_id")
    .notNull()
    .references(() => attestations.id),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  resultId: integer("result_id").references(() => results.id),
  /** after_trial | month_1 | month_2 | final_3_months | repeat | annual | transfer */
  type: text("type").notNull().default("final_3_months"),
  /** scheduled | in_progress | awaiting_commission | completed */
  status: text("status").notNull().default("scheduled"),
  scheduledAt: text("scheduled_at").notNull(),
  commissionJson: text("commission_json").notNull().default("[]"),
  signaturesJson: text("signatures_json").notNull().default("[]"),
  testScore: real("test_score"),
  practicalScore: real("practical_score"),
  projectScore: real("project_score"),
  defenseScore: real("defense_score"),
  independenceScore: real("independence_score"),
  disciplineScore: real("discipline_score"),
  mentorScore: real("mentor_score"),
  managerScore: real("manager_score"),
  finalScore: real("final_score"),
  weakCompetenciesJson: text("weak_competencies_json").notNull().default("[]"),
  mentorComment: text("mentor_comment").notNull().default(""),
  managerComment: text("manager_comment").notNull().default(""),
  commissionComment: text("commission_comment").notNull().default(""),
  /** middle_confirmed | middle_not_confirmed | keep_junior | additional_learning | repeat | transfer */
  decision: text("decision").notNull().default(""),
  nextCheckAt: text("next_check_at"),
  protocolNumber: text("protocol_number"),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const levelPromotionRequests = sqliteTable(
  "level_promotion_requests",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    employeeId: integer("employee_id")
      .notNull()
      .references(() => employees.id),
    resultId: integer("result_id").references(() => results.id),
    attestationId: integer("attestation_id").references(() => attestations.id),
    fromLevel: text("from_level").notNull(),
    toLevel: text("to_level").notNull(),
    department: text("department").notNull(),
    score: real("score").notNull(),
    status: text("status").notNull().default("pending"),
    reviewerUserId: integer("reviewer_user_id").references(
      () => platformUsers.id,
    ),
    reviewComment: text("review_comment"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
    reviewedAt: text("reviewed_at"),
  },
);

export type LearningLesson = typeof learningLessons.$inferSelect;
export type LearningTest = typeof learningTests.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type Attestation = typeof attestations.$inferSelect;
export type AttestationReview = typeof attestationReviews.$inferSelect;
export type LevelPromotionRequest = typeof levelPromotionRequests.$inferSelect;

/** Active internship mentorship (trial period + mentor). */
export const internMentorships = sqliteTable("intern_mentorships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  internEmployeeId: integer("intern_employee_id")
    .notNull()
    .references(() => employees.id),
  mentorUserId: integer("mentor_user_id").references(() => platformUsers.id),
  department: text("department").notNull().default(""),
  /** auto | admin_override */
  source: text("source").notNull().default("auto"),
  /** Candidate who entered the 5-day trial, if any. */
  sourceCandidateId: integer("source_candidate_id").references(
    () => candidates.id,
  ),
  /** Snapshot of entrance test: score, level, weak topics, recommendation. */
  entranceSnapshotJson: text("entrance_snapshot_json").notNull().default("{}"),
  trialStartsAt: text("trial_starts_at").notNull(),
  trialEndsAt: text("trial_ends_at").notNull(),
  /** active | extended | hired | ended | other_role */
  status: text("status").notNull().default("active"),
  decisionComment: text("decision_comment"),
  decidedByUserId: integer("decided_by_user_id").references(
    () => platformUsers.id,
  ),
  decidedAt: text("decided_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Admin-configured Intern Standard catalog (lessons and/or tests). */
export const internStandardItems = sqliteTable("intern_standard_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** lesson | test */
  itemType: text("item_type").notNull(),
  lessonId: integer("lesson_id").references(() => learningLessons.id),
  testId: integer("test_id").references(() => learningTests.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** Extra lessons/tests assigned to a specific intern by mentor or admin. */
export const internContentAssignments = sqliteTable(
  "intern_content_assignments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    internEmployeeId: integer("intern_employee_id")
      .notNull()
      .references(() => employees.id),
    /** lesson | test */
    itemType: text("item_type").notNull(),
    lessonId: integer("lesson_id").references(() => learningLessons.id),
    testId: integer("test_id").references(() => learningTests.id),
    assignedByUserId: integer("assigned_by_user_id")
      .notNull()
      .references(() => platformUsers.id),
    /** mentor | admin */
    source: text("source").notNull().default("mentor"),
    assignedAt: text("assigned_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
);

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => platformUsers.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  href: text("href"),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  readAt: text("read_at"),
});

export type InternMentorship = typeof internMentorships.$inferSelect;
export type InternStandardItem = typeof internStandardItems.$inferSelect;
export type InternContentAssignment =
  typeof internContentAssignments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

/** Admin library of daily mini-tests for interns. */
export const internDailyTests = sqliteTable("intern_daily_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  summary: text("summary").notNull().default(""),
  /** JSON { id, prompt, options, correctIndex }[] */
  questionsJson: text("questions_json").notNull().default("[]"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Admin schedule: which mini-test applies on a calendar day.
 * Prefer internEmployeeId when set; otherwise match by department.
 */
export const internDailySchedules = sqliteTable("intern_daily_schedules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportDate: text("report_date").notNull(),
  testId: integer("test_id")
    .notNull()
    .references(() => internDailyTests.id),
  department: text("department").notNull().default(""),
  internEmployeeId: integer("intern_employee_id").references(() => employees.id),
  createdByUserId: integer("created_by_user_id").references(
    () => platformUsers.id,
  ),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/** One daily report per intern per calendar day (written + mini-test). */
export const internDailyReports = sqliteTable("intern_daily_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  mentorshipId: integer("mentorship_id")
    .notNull()
    .references(() => internMentorships.id),
  internEmployeeId: integer("intern_employee_id")
    .notNull()
    .references(() => employees.id),
  reportDate: text("report_date").notNull(),
  scheduleId: integer("schedule_id").references(() => internDailySchedules.id),
  testId: integer("test_id").references(() => internDailyTests.id),
  bodyText: text("body_text").notNull().default(""),
  answersJson: text("answers_json").notNull().default("{}"),
  score: real("score"),
  /** submitted | reviewed */
  status: text("status").notNull().default("submitted"),
  mentorComment: text("mentor_comment"),
  reviewedByUserId: integer("reviewed_by_user_id").references(
    () => platformUsers.id,
  ),
  submittedAt: text("submitted_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  reviewedAt: text("reviewed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type InternDailyTest = typeof internDailyTests.$inferSelect;
export type InternDailySchedule = typeof internDailySchedules.$inferSelect;
export type InternDailyReport = typeof internDailyReports.$inferSelect;

/** Per-system credentials and toggles (Telegram, Verifix, Bitrix, SMTP, storage). */
export const integrationSettings = sqliteTable("integration_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  system: text("system").notNull().unique(),
  configJson: text("config_json").notNull().default("{}"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const integrationLogs = sqliteTable("integration_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  system: text("system").notNull(),
  operation: text("operation").notNull(),
  /** ok | error | skipped */
  result: text("result").notNull(),
  message: text("message").notNull().default(""),
  error: text("error").notNull().default(""),
  payloadJson: text("payload_json").notNull().default("{}"),
  retryOfId: integer("retry_of_id"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type IntegrationSetting = typeof integrationSettings.$inferSelect;
export type IntegrationLog = typeof integrationLogs.$inferSelect;

export const systemSettings = sqliteTable("system_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  section: text("section").notNull().unique(),
  configJson: text("config_json").notNull().default("{}"),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorUserId: integer("actor_user_id"),
  actorName: text("actor_name").notNull().default(""),
  action: text("action").notNull(),
  target: text("target").notNull().default(""),
  result: text("result").notNull().default("ok"),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

/** Manager-assigned team tasks (not learning items). */
export const managerTasks = sqliteTable("manager_tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assignedByUserId: integer("assigned_by_user_id")
    .notNull()
    .references(() => platformUsers.id),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  dueAt: text("due_at"),
  /** high | medium | low */
  priority: text("priority").notNull().default("medium"),
  /** open | in_progress | done | overdue */
  status: text("status").notNull().default("open"),
  resultNote: text("result_note").notNull().default(""),
  completedAt: text("completed_at"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const oneOnOneMeetings = sqliteTable("one_on_one_meetings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  managerUserId: integer("manager_user_id")
    .notNull()
    .references(() => platformUsers.id),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  scheduledAt: text("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  /** planned | done | cancelled */
  status: text("status").notNull().default("planned"),
  notes: text("notes").notNull().default(""),
  agreements: text("agreements").notNull().default(""),
  nextGoals: text("next_goals").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const kpiTargets = sqliteTable("kpi_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id),
  /** YYYY-MM */
  period: text("period").notNull(),
  metricKey: text("metric_key").notNull(),
  planValue: real("plan_value").notNull().default(100),
  factValue: real("fact_value"),
  managerUserId: integer("manager_user_id")
    .notNull()
    .references(() => platformUsers.id),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const trialDecisions = sqliteTable("trial_decisions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  internEmployeeId: integer("intern_employee_id")
    .notNull()
    .references(() => employees.id),
  managerUserId: integer("manager_user_id")
    .notNull()
    .references(() => platformUsers.id),
  day: integer("day").notNull().default(5),
  score: real("score"),
  mentorScore: real("mentor_score"),
  comment: text("comment").notNull().default(""),
  /** continue | extend | end */
  decisionType: text("decision_type").notNull().default("continue"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type ManagerTask = typeof managerTasks.$inferSelect;
export type OneOnOneMeeting = typeof oneOnOneMeetings.$inferSelect;
export type KpiTarget = typeof kpiTargets.$inferSelect;
export type TrialDecision = typeof trialDecisions.$inferSelect;
