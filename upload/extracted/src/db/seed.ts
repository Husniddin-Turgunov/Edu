import { client, db } from "./index";
import {
  assessments,
  attestations,
  competencies,
  employees,
  learningLessons,
  learningTests,
  lessonProgress,
  levelDefinitions,
  vacancies,
} from "./schema";
import staffing from "@/data/staffing.json";
import { DEMO_LESSON_SLUGS } from "@/lib/lessons";
import { employeeImportKey } from "@/lib/staffing-match";
import { eq, inArray } from "drizzle-orm";

type StaffItem = {
  code: string;
  role: string;
  department: string;
  name: string | null;
  email?: string | null;
};

export async function ensureSchema() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL,
      role_title TEXT NOT NULL,
      current_level TEXT NOT NULL DEFAULT 'junior',
      avatar_hue INTEGER NOT NULL DEFAULT 160,
      hired_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS level_definitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      min_score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      description TEXT NOT NULL,
      next_steps TEXT NOT NULL,
      sort_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      competency_id INTEGER NOT NULL REFERENCES competencies(id),
      duration_minutes INTEGER NOT NULL DEFAULT 20,
      is_active INTEGER NOT NULL DEFAULT 1,
      drive_file_id TEXT,
      drive_modified_at TEXT,
      source TEXT NOT NULL DEFAULT 'library'
    );

    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id),
      prompt TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'single',
      options_json TEXT NOT NULL DEFAULT '[]',
      correct_index INTEGER NOT NULL DEFAULT 0,
      correct_indexes_json TEXT NOT NULL DEFAULT '[]',
      keywords_json TEXT NOT NULL DEFAULT '[]',
      weight INTEGER NOT NULL DEFAULT 1,
      difficulty TEXT NOT NULL DEFAULT 'junior',
      knowledge_kind TEXT NOT NULL DEFAULT 'knowledge',
      section TEXT NOT NULL DEFAULT 'Общий'
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_at TEXT NOT NULL,
      due_at TEXT
    );

    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES assignments(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      assessment_id INTEGER NOT NULL REFERENCES assessments(id),
      score REAL NOT NULL,
      level_code TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      profile_json TEXT NOT NULL DEFAULT '{}',
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vacancies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL DEFAULT '',
      role_title TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staffing_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      role_title TEXT NOT NULL,
      department TEXT NOT NULL,
      employee_id INTEGER REFERENCES employees(id),
      email TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      telegram TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      vacancy_id INTEGER NOT NULL REFERENCES vacancies(id),
      status TEXT NOT NULL DEFAULT 'new',
      current_level TEXT NOT NULL DEFAULT 'unassessed',
      claimed_level TEXT NOT NULL DEFAULT '',
      interview_result TEXT NOT NULL DEFAULT '',
      hr_owner_user_id INTEGER,
      photo_url TEXT,
      birth_date TEXT,
      address TEXT NOT NULL DEFAULT '',
      desired_salary TEXT NOT NULL DEFAULT '',
      available_from TEXT,
      profile_json TEXT NOT NULL DEFAULT '{}',
      avatar_hue INTEGER NOT NULL DEFAULT 200,
      notes TEXT NOT NULL DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      portal_login TEXT,
      portal_password_hash TEXT,
      portal_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidate_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      kind TEXT NOT NULL DEFAULT 'comment',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      from_status TEXT,
      to_status TEXT,
      actor_user_id INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      vacancy_id INTEGER REFERENCES vacancies(id),
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      format TEXT NOT NULL DEFAULT 'office',
      address TEXT NOT NULL DEFAULT '',
      geo_url TEXT NOT NULL DEFAULT '',
      room TEXT NOT NULL DEFAULT '',
      hr_owner_user_id INTEGER,
      interviewer_name TEXT NOT NULL DEFAULT '',
      department_head TEXT NOT NULL DEFAULT '',
      comment_to_candidate TEXT NOT NULL DEFAULT '',
      confirm_status TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'scheduled',
      evaluation_json TEXT NOT NULL DEFAULT '{}',
      decision TEXT,
      decision_comment TEXT NOT NULL DEFAULT '',
      notify_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidate_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assessment_id INTEGER NOT NULL REFERENCES assessments(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_at TEXT NOT NULL,
      due_at TEXT,
      confirmed_at TEXT,
      started_at TEXT,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS candidate_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL REFERENCES candidate_assignments(id),
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      assessment_id INTEGER NOT NULL REFERENCES assessments(id),
      score REAL NOT NULL,
      level_code TEXT NOT NULL,
      answers_json TEXT NOT NULL,
      profile_json TEXT NOT NULL DEFAULT '{}',
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS platform_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_plain TEXT,
      role TEXT NOT NULL,
      participant_kind TEXT,
      display_name TEXT NOT NULL,
      profile_job_title TEXT,
      profile_department TEXT,
      avatar_data TEXT,
      avatar_hue INTEGER NOT NULL DEFAULT 220,
      employee_id INTEGER REFERENCES employees(id),
      candidate_id INTEGER REFERENCES candidates(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      onboarding_step INTEGER NOT NULL DEFAULT 0,
      onboarding_completed_at TEXT,
      preferred_locale TEXT NOT NULL DEFAULT 'ru',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidate_terminal_slots (
      slot_number INTEGER PRIMARY KEY,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidate_terminal_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_number INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      assignment_id INTEGER REFERENCES candidate_assignments(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      confirmed_at TEXT,
      started_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_home_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audience TEXT NOT NULL UNIQUE,
      document_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS visual_content_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL UNIQUE,
      document_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER
    );
  `);

  // Migrate older DBs that already have questions without new columns.
  // Parallel chunks — sequential Turso HTTP round-trips were ~30–40s.
  const migrations = [
    `ALTER TABLE questions ADD COLUMN type TEXT NOT NULL DEFAULT 'single'`,
    `ALTER TABLE questions ADD COLUMN correct_indexes_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE questions ADD COLUMN keywords_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE questions ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'junior'`,
    `ALTER TABLE questions ADD COLUMN knowledge_kind TEXT NOT NULL DEFAULT 'knowledge'`,
    `ALTER TABLE questions ADD COLUMN section TEXT NOT NULL DEFAULT 'Общий'`,
    `ALTER TABLE questions ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE results ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE candidate_results ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE candidate_results ADD COLUMN telemetry_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE assessments ADD COLUMN drive_file_id TEXT`,
    `ALTER TABLE assessments ADD COLUMN drive_modified_at TEXT`,
    `ALTER TABLE assessments ADD COLUMN source TEXT NOT NULL DEFAULT 'library'`,
    `ALTER TABLE assessments ADD COLUMN pass_score INTEGER NOT NULL DEFAULT 60`,
    `ALTER TABLE candidates ADD COLUMN portal_login TEXT`,
    `ALTER TABLE candidates ADD COLUMN portal_password_hash TEXT`,
    `ALTER TABLE candidates ADD COLUMN portal_enabled INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE candidates ADD COLUMN telegram TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE candidates ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
    `ALTER TABLE candidates ADD COLUMN claimed_level TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE candidates ADD COLUMN interview_result TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE candidates ADD COLUMN hr_owner_user_id INTEGER`,
    `ALTER TABLE candidates ADD COLUMN photo_url TEXT`,
    `ALTER TABLE candidates ADD COLUMN birth_date TEXT`,
    `ALTER TABLE candidates ADD COLUMN address TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE candidates ADD COLUMN desired_salary TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE candidates ADD COLUMN available_from TEXT`,
    `ALTER TABLE candidates ADD COLUMN profile_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE candidates ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE candidates ADD COLUMN rejection_reason TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE vacancies ADD COLUMN closed_at TEXT`,
    `CREATE TABLE IF NOT EXISTS candidate_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      kind TEXT NOT NULL DEFAULT 'comment',
      title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      from_status TEXT,
      to_status TEXT,
      actor_user_id INTEGER,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS interviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      vacancy_id INTEGER REFERENCES vacancies(id),
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      format TEXT NOT NULL DEFAULT 'office',
      address TEXT NOT NULL DEFAULT '',
      geo_url TEXT NOT NULL DEFAULT '',
      room TEXT NOT NULL DEFAULT '',
      hr_owner_user_id INTEGER,
      interviewer_name TEXT NOT NULL DEFAULT '',
      department_head TEXT NOT NULL DEFAULT '',
      comment_to_candidate TEXT NOT NULL DEFAULT '',
      confirm_status TEXT NOT NULL DEFAULT 'pending',
      status TEXT NOT NULL DEFAULT 'scheduled',
      evaluation_json TEXT NOT NULL DEFAULT '{}',
      decision TEXT,
      decision_comment TEXT NOT NULL DEFAULT '',
      notify_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `UPDATE candidates SET status = 'test_assigned' WHERE status = 'testing'`,
    `UPDATE candidates SET status = 'test_completed' WHERE status = 'assessed'`,
    `UPDATE candidates SET status = 'trial_admitted' WHERE status IN ('internship_ready', 'internship')`,
    `CREATE TABLE IF NOT EXISTS platform_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_plain TEXT,
      role TEXT NOT NULL,
      participant_kind TEXT,
      display_name TEXT NOT NULL,
      profile_job_title TEXT,
      profile_department TEXT,
      avatar_data TEXT,
      avatar_hue INTEGER NOT NULL DEFAULT 220,
      employee_id INTEGER REFERENCES employees(id),
      candidate_id INTEGER REFERENCES candidates(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
    `ALTER TABLE platform_users ADD COLUMN password_plain TEXT`,
    `ALTER TABLE platform_users ADD COLUMN profile_job_title TEXT`,
    `ALTER TABLE platform_users ADD COLUMN profile_department TEXT`,
    `ALTER TABLE platform_users ADD COLUMN avatar_data TEXT`,
    `ALTER TABLE platform_users ADD COLUMN avatar_hue INTEGER NOT NULL DEFAULT 220`,
    `ALTER TABLE platform_users ADD COLUMN onboarding_step INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE platform_users ADD COLUMN onboarding_completed_at TEXT`,
    `ALTER TABLE platform_users ADD COLUMN preferred_locale TEXT NOT NULL DEFAULT 'ru'`,
    `ALTER TABLE platform_users ADD COLUMN ui_preferences_json TEXT NOT NULL DEFAULT '{}'`,
    `CREATE TABLE IF NOT EXISTS visual_content_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      page_key TEXT NOT NULL UNIQUE,
      document_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER
    )`,
    `ALTER TABLE candidate_assignments ADD COLUMN confirmed_at TEXT`,
    `ALTER TABLE candidate_assignments ADD COLUMN started_at TEXT`,
    `ALTER TABLE candidate_assignments ADD COLUMN expires_at TEXT`,
    `CREATE TABLE IF NOT EXISTS candidate_terminal_slots (
      slot_number INTEGER PRIMARY KEY,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS candidate_terminal_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_number INTEGER NOT NULL,
      candidate_id INTEGER NOT NULL REFERENCES candidates(id),
      assignment_id INTEGER REFERENCES candidate_assignments(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'queued',
      confirmed_at TEXT,
      started_at TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS staffing_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      role_title TEXT NOT NULL,
      department TEXT NOT NULL,
      employee_id INTEGER REFERENCES employees(id),
      email TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS role_home_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audience TEXT NOT NULL UNIQUE,
      document_json TEXT NOT NULL DEFAULT '{}',
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS learning_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      content_format TEXT NOT NULL DEFAULT 'text',
      level TEXT NOT NULL DEFAULT 'junior',
      role_families_json TEXT NOT NULL DEFAULT '[]',
      topics_json TEXT NOT NULL DEFAULT '[]',
      duration_min INTEGER NOT NULL DEFAULT 20,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      drive_file_id TEXT,
      drive_modified_at TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS learning_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      lesson_id INTEGER NOT NULL REFERENCES learning_lessons(id),
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT 'junior',
      role_families_json TEXT NOT NULL DEFAULT '[]',
      topics_json TEXT NOT NULL DEFAULT '[]',
      duration_min INTEGER NOT NULL DEFAULT 10,
      questions_json TEXT NOT NULL DEFAULT '[]',
      assessment_id INTEGER REFERENCES assessments(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS lesson_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      lesson_id INTEGER NOT NULL REFERENCES learning_lessons(id),
      completed_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS attestations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Аттестация',
      description TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      position_titles_json TEXT NOT NULL DEFAULT '[]',
      scheduled_at TEXT NOT NULL,
      starts_at TEXT,
      ends_at TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 40,
      passing_score INTEGER NOT NULL DEFAULT 70,
      assessment_id INTEGER REFERENCES assessments(id),
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`,
    `ALTER TABLE attestations ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE attestations ADD COLUMN department TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE attestations ADD COLUMN position_titles_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE attestations ADD COLUMN starts_at TEXT`,
    `ALTER TABLE attestations ADD COLUMN ends_at TEXT`,
    `ALTER TABLE attestations ADD COLUMN duration_minutes INTEGER NOT NULL DEFAULT 40`,
    `ALTER TABLE attestations ADD COLUMN passing_score INTEGER NOT NULL DEFAULT 70`,
    `CREATE TABLE IF NOT EXISTS attestation_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attestation_id INTEGER NOT NULL REFERENCES attestations(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      result_id INTEGER REFERENCES results(id),
      type TEXT NOT NULL DEFAULT 'final_3_months',
      status TEXT NOT NULL DEFAULT 'scheduled',
      scheduled_at TEXT NOT NULL,
      commission_json TEXT NOT NULL DEFAULT '[]',
      signatures_json TEXT NOT NULL DEFAULT '[]',
      test_score REAL,
      practical_score REAL,
      project_score REAL,
      defense_score REAL,
      independence_score REAL,
      discipline_score REAL,
      mentor_score REAL,
      manager_score REAL,
      final_score REAL,
      weak_competencies_json TEXT NOT NULL DEFAULT '[]',
      mentor_comment TEXT NOT NULL DEFAULT '',
      manager_comment TEXT NOT NULL DEFAULT '',
      commission_comment TEXT NOT NULL DEFAULT '',
      decision TEXT NOT NULL DEFAULT '',
      next_check_at TEXT,
      protocol_number TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS attestation_reviews_attestation_idx ON attestation_reviews(attestation_id)`,
    `CREATE INDEX IF NOT EXISTS attestation_reviews_employee_idx ON attestation_reviews(employee_id)`,
    `ALTER TABLE learning_lessons ADD COLUMN content_format TEXT NOT NULL DEFAULT 'text'`,
    `ALTER TABLE learning_lessons ADD COLUMN drive_file_id TEXT`,
    `ALTER TABLE learning_lessons ADD COLUMN drive_modified_at TEXT`,
    `CREATE TABLE IF NOT EXISTS level_promotion_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      result_id INTEGER REFERENCES results(id),
      attestation_id INTEGER REFERENCES attestations(id),
      from_level TEXT NOT NULL,
      to_level TEXT NOT NULL,
      department TEXT NOT NULL,
      score REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      reviewer_user_id INTEGER REFERENCES platform_users(id),
      review_comment TEXT,
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    )`,
    `UPDATE employees SET current_level = 'junior' WHERE current_level = 'unassessed'`,
    `ALTER TABLE employees ADD COLUMN hired_at TEXT`,
    `ALTER TABLE employees ADD COLUMN phone TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE employees ADD COLUMN telegram TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE employees ADD COLUMN starting_level TEXT NOT NULL DEFAULT 'junior'`,
    `ALTER TABLE employees ADD COLUMN target_level TEXT NOT NULL DEFAULT 'middle'`,
    `ALTER TABLE employees ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`,
    `ALTER TABLE employees ADD COLUMN work_schedule TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE employees ADD COLUMN manager_employee_id INTEGER`,
    `ALTER TABLE employees ADD COLUMN mentor_user_id INTEGER`,
    `ALTER TABLE employees ADD COLUMN next_check_at TEXT`,
    `ALTER TABLE employees ADD COLUMN notes TEXT NOT NULL DEFAULT ''`,
    `CREATE TABLE IF NOT EXISTS employee_competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      competency_id INTEGER NOT NULL REFERENCES competencies(id),
      status TEXT NOT NULL DEFAULT 'not_checked',
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      updated_by_user_id INTEGER
    )`,
    `ALTER TABLE learning_lessons ADD COLUMN goal TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE learning_lessons ADD COLUMN material TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE learning_lessons ADD COLUMN example TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE learning_lessons ADD COLUMN instruction TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE learning_lessons ADD COLUMN practice TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE learning_lessons ADD COLUMN criteria TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE learning_lessons ADD COLUMN program_month INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE learning_lessons ADD COLUMN track TEXT NOT NULL DEFAULT 'basic'`,
    `ALTER TABLE lesson_progress ADD COLUMN status TEXT NOT NULL DEFAULT 'credited'`,
    `ALTER TABLE lesson_progress ADD COLUMN deadline_at TEXT`,
    `ALTER TABLE lesson_progress ADD COLUMN answer_text TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE lesson_progress ADD COLUMN answer_file_url TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE lesson_progress ADD COLUMN mentor_comment TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE lesson_progress ADD COLUMN submitted_at TEXT`,
    `ALTER TABLE lesson_progress ADD COLUMN reviewed_at TEXT`,
    `ALTER TABLE lesson_progress ADD COLUMN reviewed_by_user_id INTEGER`,
    `CREATE TABLE IF NOT EXISTS employee_learning_programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      target_level TEXT NOT NULL DEFAULT 'middle',
      status TEXT NOT NULL DEFAULT 'active',
      starts_at TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      month1_theme TEXT NOT NULL DEFAULT '',
      month2_theme TEXT NOT NULL DEFAULT '',
      month3_theme TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS employee_program_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL REFERENCES employee_learning_programs(id),
      lesson_id INTEGER NOT NULL REFERENCES learning_lessons(id),
      competency_id INTEGER,
      month INTEGER NOT NULL DEFAULT 1,
      path_mode TEXT NOT NULL DEFAULT 'full',
      sort_order INTEGER NOT NULL DEFAULT 0
    )`,
    `UPDATE employees SET current_level = 'intern'
     WHERE current_level = 'junior'
       AND (
         lower(role_title) LIKE '%стаж%'
         OR lower(role_title) LIKE '%intern%'
         OR id IN (
           SELECT employee_id FROM platform_users
           WHERE employee_id IS NOT NULL AND participant_kind = 'intern'
         )
       )`,
    `INSERT OR IGNORE INTO level_definitions
      (code, name, min_score, max_score, description, next_steps, sort_order)
     VALUES (
       'intern',
       'Стажёр',
       0,
       0,
       'Испытательный период — базовое знакомство с компанией, стандартом стажёра и наставником.',
       'Пройти стандарт стажёра, задания наставника и выйти на уровень Junior.',
       0
     )`,
    `CREATE TABLE IF NOT EXISTS intern_mentorships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intern_employee_id INTEGER NOT NULL REFERENCES employees(id),
      mentor_user_id INTEGER REFERENCES platform_users(id),
      department TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'auto',
      source_candidate_id INTEGER REFERENCES candidates(id),
      entrance_snapshot_json TEXT NOT NULL DEFAULT '{}',
      trial_starts_at TEXT NOT NULL,
      trial_ends_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      decision_comment TEXT,
      decided_by_user_id INTEGER REFERENCES platform_users(id),
      decided_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `ALTER TABLE intern_mentorships ADD COLUMN source_candidate_id INTEGER REFERENCES candidates(id)`,
    `ALTER TABLE intern_mentorships ADD COLUMN entrance_snapshot_json TEXT NOT NULL DEFAULT '{}'`,
    `CREATE TABLE IF NOT EXISTS intern_standard_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_type TEXT NOT NULL,
      lesson_id INTEGER REFERENCES learning_lessons(id),
      test_id INTEGER REFERENCES learning_tests(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS intern_content_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intern_employee_id INTEGER NOT NULL REFERENCES employees(id),
      item_type TEXT NOT NULL,
      lesson_id INTEGER REFERENCES learning_lessons(id),
      test_id INTEGER REFERENCES learning_tests(id),
      assigned_by_user_id INTEGER NOT NULL REFERENCES platform_users(id),
      source TEXT NOT NULL DEFAULT 'mentor',
      assigned_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES platform_users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      href TEXT,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      read_at TEXT
    )`,
    `ALTER TABLE platform_users ADD COLUMN mentor_competencies_json TEXT NOT NULL DEFAULT '[]'`,
    `CREATE TABLE IF NOT EXISTS mentor_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mentor_user_id INTEGER NOT NULL REFERENCES platform_users(id),
      from_employee_id INTEGER NOT NULL REFERENCES employees(id),
      score INTEGER NOT NULL DEFAULT 5,
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS mentor_ratings_mentor_idx ON mentor_ratings(mentor_user_id)`,
    `ALTER TABLE competencies ADD COLUMN kind TEXT NOT NULL DEFAULT 'skill'`,
    `ALTER TABLE competencies ADD COLUMN level_scope TEXT NOT NULL DEFAULT 'all'`,
    `ALTER TABLE competencies ADD COLUMN verification_method TEXT NOT NULL DEFAULT 'test'`,
    `ALTER TABLE competencies ADD COLUMN is_required INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE competencies ADD COLUMN weight INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE competencies ADD COLUMN is_critical_error INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE competencies ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1`,
    `CREATE TABLE IF NOT EXISTS role_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      role_title TEXT NOT NULL,
      department TEXT NOT NULL,
      manager_name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      duties TEXT NOT NULL DEFAULT '',
      requirements TEXT NOT NULL DEFAULT '',
      programs_json TEXT NOT NULL DEFAULT '[]',
      tools_json TEXT NOT NULL DEFAULT '[]',
      junior_req_json TEXT NOT NULL DEFAULT '{}',
      middle_req_json TEXT NOT NULL DEFAULT '{}',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS role_competencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_profile_id INTEGER NOT NULL REFERENCES role_profiles(id),
      competency_id INTEGER NOT NULL REFERENCES competencies(id),
      is_required INTEGER NOT NULL DEFAULT 1,
      weight INTEGER NOT NULL DEFAULT 1,
      level_scope TEXT NOT NULL DEFAULT 'all'
    )`,
    `CREATE INDEX IF NOT EXISTS role_competencies_role_idx ON role_competencies(role_profile_id)`,
    `CREATE TABLE IF NOT EXISTS intern_daily_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      questions_json TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS intern_daily_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_date TEXT NOT NULL,
      test_id INTEGER NOT NULL REFERENCES intern_daily_tests(id),
      department TEXT NOT NULL DEFAULT '',
      intern_employee_id INTEGER REFERENCES employees(id),
      created_by_user_id INTEGER REFERENCES platform_users(id),
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS intern_daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mentorship_id INTEGER NOT NULL REFERENCES intern_mentorships(id),
      intern_employee_id INTEGER NOT NULL REFERENCES employees(id),
      report_date TEXT NOT NULL,
      schedule_id INTEGER REFERENCES intern_daily_schedules(id),
      test_id INTEGER REFERENCES intern_daily_tests(id),
      body_text TEXT NOT NULL DEFAULT '',
      answers_json TEXT NOT NULL DEFAULT '{}',
      score REAL,
      status TEXT NOT NULL DEFAULT 'submitted',
      mentor_comment TEXT,
      reviewed_by_user_id INTEGER REFERENCES platform_users(id),
      submitted_at TEXT NOT NULL,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(intern_employee_id, report_date)
    )`,
    `CREATE TABLE IF NOT EXISTS integration_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system TEXT NOT NULL UNIQUE,
      config_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS integration_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      system TEXT NOT NULL,
      operation TEXT NOT NULL,
      result TEXT NOT NULL,
      message TEXT NOT NULL DEFAULT '',
      error TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      retry_of_id INTEGER,
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS integration_logs_created_idx ON integration_logs(created_at)`,
    `CREATE INDEX IF NOT EXISTS integration_logs_system_idx ON integration_logs(system)`,
    `CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL UNIQUE,
      config_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_user_id INTEGER,
      actor_name TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      target TEXT NOT NULL DEFAULT '',
      result TEXT NOT NULL DEFAULT 'ok',
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at)`,
    `CREATE TABLE IF NOT EXISTS manager_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assigned_by_user_id INTEGER NOT NULL REFERENCES platform_users(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      due_at TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      result_note TEXT NOT NULL DEFAULT '',
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS manager_tasks_employee_idx ON manager_tasks(employee_id)`,
    `CREATE INDEX IF NOT EXISTS manager_tasks_manager_idx ON manager_tasks(assigned_by_user_id)`,
    `CREATE TABLE IF NOT EXISTS one_on_one_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manager_user_id INTEGER NOT NULL REFERENCES platform_users(id),
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'planned',
      notes TEXT NOT NULL DEFAULT '',
      agreements TEXT NOT NULL DEFAULT '',
      next_goals TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS one_on_one_manager_idx ON one_on_one_meetings(manager_user_id)`,
    `CREATE INDEX IF NOT EXISTS one_on_one_employee_idx ON one_on_one_meetings(employee_id)`,
    `CREATE TABLE IF NOT EXISTS kpi_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES employees(id),
      period TEXT NOT NULL,
      metric_key TEXT NOT NULL,
      plan_value REAL NOT NULL DEFAULT 100,
      fact_value REAL,
      manager_user_id INTEGER NOT NULL REFERENCES platform_users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS kpi_targets_employee_period_idx ON kpi_targets(employee_id, period)`,
    `CREATE TABLE IF NOT EXISTS trial_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      intern_employee_id INTEGER NOT NULL REFERENCES employees(id),
      manager_user_id INTEGER NOT NULL REFERENCES platform_users(id),
      day INTEGER NOT NULL DEFAULT 5,
      score REAL,
      mentor_score REAL,
      comment TEXT NOT NULL DEFAULT '',
      decision_type TEXT NOT NULL DEFAULT 'continue',
      created_at TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS trial_decisions_intern_idx ON trial_decisions(intern_employee_id)`,
  ];
  const chunkSize = 12;
  for (let i = 0; i < migrations.length; i += chunkSize) {
    await Promise.all(
      migrations.slice(i, i + chunkSize).map(async (sql) => {
        try {
          await client.execute(sql);
        } catch {
          // column/table already exists
        }
      }),
    );
  }

  await clearDemoLearningCatalog();
  await migrateAttestationRows();
  await migrateCompetencyKinds();
}

async function migrateCompetencyKinds() {
  const audienceNames = new Set([
    "для сотрудников",
    "для стажёров",
    "для кандидатов",
  ]);
  const rows = await db.select().from(competencies);
  for (const row of rows) {
    const isAudience =
      audienceNames.has(row.name) ||
      row.category.toLowerCase().includes("аудитор");
    const kind = isAudience ? "audience" : row.kind === "audience" ? "audience" : "skill";
    if (row.kind !== kind) {
      await db
        .update(competencies)
        .set({ kind })
        .where(eq(competencies.id, row.id));
    }
  }
}

async function clearDemoLearningCatalog() {
  const demoSlugs = [...DEMO_LESSON_SLUGS];
  if (demoSlugs.length === 0) return;

  const demoLessons = await db
    .select({ id: learningLessons.id, slug: learningLessons.slug })
    .from(learningLessons)
    .where(inArray(learningLessons.slug, demoSlugs));

  if (demoLessons.length === 0) {
    // Also drop orphan demo tests if lessons already gone
    const demoTestSlugs = demoSlugs.map((slug) => `check-${slug}`);
    await db
      .delete(learningTests)
      .where(inArray(learningTests.slug, demoTestSlugs));
    return;
  }

  const lessonIds = demoLessons.map((row) => row.id);
  await db
    .delete(lessonProgress)
    .where(inArray(lessonProgress.lessonId, lessonIds));
  await db
    .delete(learningTests)
    .where(inArray(learningTests.lessonId, lessonIds));
  await db
    .delete(learningLessons)
    .where(inArray(learningLessons.id, lessonIds));
}

async function migrateAttestationRows() {
  const rows = await db.select().from(attestations);
  for (const row of rows) {
    const startsAt = row.startsAt || row.scheduledAt;
    const startMs = new Date(startsAt).getTime();
    const endsAt =
      row.endsAt ||
      new Date(
        (Number.isFinite(startMs) ? startMs : Date.now()) + 14 * 86400000,
      ).toISOString();
    await db
      .update(attestations)
      .set({
        startsAt,
        endsAt,
        scheduledAt: startsAt,
        updatedAt: new Date().toISOString(),
      })
      .where(inArray(attestations.id, [row.id]));
    if (row.assessmentId) {
      await db
        .update(assessments)
        .set({ source: "attestation" })
        .where(inArray(assessments.id, [row.assessmentId]));
    }
  }
}

export async function seedIfEmpty() {
  await ensureSchema();

  const existing = await db.select().from(employees);
  if (existing.length > 0) return;

  await db.insert(levelDefinitions).values([
    {
      code: "intern",
      name: "Стажёр",
      minScore: 0,
      maxScore: 0,
      description:
        "Испытательный период — базовое знакомство с компанией, стандартом стажёра и наставником.",
      nextSteps:
        "Пройти стандарт стажёра, задания наставника и выйти на уровень Junior.",
      sortOrder: 0,
    },
    {
      code: "junior",
      name: "Junior",
      minScore: 0,
      maxScore: 21,
      description:
        "Начальный уровень — знает основные понятия (экв. 1–10 верных из 50).",
      nextSteps:
        "Закрепить бриф, профиль вакансии и базы сорсинга с наставником.",
      sortOrder: 1,
    },
    {
      code: "middle",
      name: "Middle",
      minScore: 22,
      maxScore: 41,
      description:
        "Средний уровень — умеет применять знания на практике (экв. 11–20).",
      nextSteps:
        "Больше живых кейсов: скрининг, Boolean, работодательский бренд.",
      sortOrder: 2,
    },
    {
      code: "senior",
      name: "Senior",
      minScore: 42,
      maxScore: 61,
      description:
        "Хороший уровень — понимает сложные ситуации (экв. 21–30).",
      nextSteps:
        "Ведение сложных вакансий end-to-end, переговоры по офферу.",
      sortOrder: 3,
    },
    {
      code: "lead",
      name: "Lead",
      minScore: 62,
      maxScore: 81,
      description:
        "Высокий уровень — самостоятельно принимает решения (экв. 31–40).",
      nextSteps:
        "Владение метриками найма, эскалации с заказчиком, менторинг.",
      sortOrder: 4,
    },
    {
      code: "expert",
      name: "Expert",
      minScore: 82,
      maxScore: 100,
      description:
        "Экспертный уровень — мыслит стратегически, сложные кейсы (экв. 41–50).",
      nextSteps:
        "Стандарты рекрутинга, обучение команды, сложный sourcing.",
      sortOrder: 5,
    },
  ]);

  await db
    .insert(competencies)
    .values([
      {
        name: "для сотрудников",
        description: "Тесты, которые назначают сотрудникам компании.",
        category: "аудитория",
      },
      {
        name: "для стажёров",
        description: "Тесты для стажёров и практики.",
        category: "аудитория",
      },
      {
        name: "для кандидатов",
        description: "Тесты для кандидатов на вакансии.",
        category: "аудитория",
      },
    ]);

  // Staff from Excel export (bundled staffing.json)
  {
    const raw = staffing as {
      employees: StaffItem[];
      vacancies: StaffItem[];
    };

    const seen = new Map<
      string,
      { name: string; role: string; department: string; email: string | null }
    >();
    for (const e of raw.employees) {
      if (!e.name) continue;
      const key = employeeImportKey(e);
      if (!seen.has(key)) {
        seen.set(key, {
          name: e.name,
          role: e.role,
          department: e.department || "AKELA GROUP",
          email: e.email ?? null,
        });
      }
    }

    let i = 1;
    const usedEmails = new Set<string>();
    for (const e of seen.values()) {
      const emailBase = e.name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/gi, ".")
        .replace(/^\.+|\.+$/g, "")
        .slice(0, 40);
      let hue = 0;
      for (let c = 0; c < e.name.length; c++) {
        hue = (hue + e.name.charCodeAt(c) * 17) % 360;
      }
      let email = (e.email || "").trim().toLowerCase();
      if (!email || usedEmails.has(email)) {
        email = `${emailBase || "employee"}.${i}@akela.group`;
      }
      while (usedEmails.has(email)) {
        i += 1;
        email = `${emailBase || "employee"}.${i}@akela.group`;
      }
      usedEmails.add(email);
      i += 1;
      await db.insert(employees).values({
        name: e.name,
        email,
        department: e.department,
        roleTitle: e.role,
        currentLevel: "junior",
        avatarHue: hue,
        createdAt: new Date().toISOString(),
      });
    }

    for (const v of raw.vacancies) {
      await db.insert(vacancies).values({
        code: v.code || "",
        roleTitle: v.role,
        department: v.department || "AKELA GROUP",
        status: "open",
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Library starts empty — HR adds corporate tests in UI.
}
