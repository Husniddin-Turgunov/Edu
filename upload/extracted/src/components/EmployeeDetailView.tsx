"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  KnowledgeProfileCard,
  parseProfileJson,
} from "@/components/KnowledgeProfileCard";
import {
  assignEmployeeAttestationAction,
  assignEmployeePositionAction,
  assignEmployeeTestAction,
  rebuildEmployeeLearningProgramAction,
  setEmployeePortalAction,
  updateEmployeeProfileAction,
  updateInternMentorshipAction,
  upsertEmployeeCompetencyAction,
} from "@/db/actions";
import {
  EMPLOYEE_COMPETENCY_STATUSES,
  EMPLOYEE_STATUSES,
} from "@/lib/employee-profile";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { LEVEL_ORDER, levelLabel, nextLevel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";

type PortalFlash = {
  login: string;
  password: string;
};

type MatrixRow = {
  competencyId: number;
  name: string;
  category: string;
  description: string;
  status: string;
  note: string;
  rowId: number | null;
};

type Props = {
  employee: {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    telegram?: string | null;
    roleTitle: string;
    department: string;
    currentLevel: string;
    startingLevel?: string | null;
    targetLevel?: string | null;
    status?: string | null;
    workSchedule?: string | null;
    managerEmployeeId?: number | null;
    mentorUserId?: number | null;
    nextCheckAt?: string | null;
    notes?: string | null;
    hiredAt?: string | null;
    createdAt?: string | null;
    managerName?: string | null;
    mentorName?: string | null;
  };
  employeeResults: {
    id: number;
    score: number;
    levelCode: string;
    completedAt: string;
    assessmentTitle: string;
    competencyName: string;
    profileJson?: string | null;
  }[];
  pending: {
    id: number;
    assessmentTitle: string;
    dueAt: string | null;
  }[];
  level: {
    description: string;
    nextSteps: string;
  } | null;
  platformAccess?: {
    login: string;
    role: string;
    isActive: boolean;
    participantKind: string | null;
  } | null;
  matrix: MatrixRow[];
  completedLessonsCount: number;
  attestations: {
    id: number;
    title: string;
    status: string;
    scheduledAt: string | null;
  }[];
  attestationReviews?: {
    id: number;
    type: string;
    status: string;
    scheduledAt: string;
    finalScore: number | null;
    decision: string;
    protocolNumber: string | null;
    attestationTitle: string;
  }[];
  entranceSnapshot: Record<string, unknown> | null;
  trialReports: {
    id: number;
    reportDate: string;
    status: string;
    score: number | null;
  }[];
  peers: { id: number; name: string; department: string }[];
  assessmentsForAssign: { id: number; title: string }[];
  vacantPositions: {
    id: number;
    code: string;
    role: string;
    department: string;
  }[];
  mentorship?: {
    mentorUserId: number | null;
    trialStartsAt: string;
    trialEndsAt: string;
    status: string;
    department: string;
  } | null;
  managers?: {
    id: number;
    displayName: string;
    profileDepartment: string | null;
  }[];
  portalFlash?: PortalFlash | null;
  entryUrl: string;
};

const HR_STATUS_KEYS: Record<string, MessageKey> = {
  active: "emp_status_active",
  probation: "emp_status_probation",
  learning: "emp_status_learning",
  paused: "emp_status_paused",
  left: "emp_status_left",
};

const COMPETENCY_STATUS_KEYS: Record<string, MessageKey> = {
  not_checked: "emp_comp_not_checked",
  doesnt_know: "emp_comp_doesnt_know",
  partial: "emp_comp_partial",
  junior: "emp_comp_junior",
  junior_plus: "emp_comp_junior_plus",
  middle_minus: "emp_comp_middle_minus",
  middle: "emp_comp_middle",
  needs_recheck: "emp_comp_needs_recheck",
};

export function EmployeeDetailView({
  employee,
  employeeResults,
  pending,
  level,
  platformAccess,
  matrix,
  completedLessonsCount,
  attestations,
  attestationReviews = [],
  entranceSnapshot,
  trialReports,
  peers,
  assessmentsForAssign,
  vacantPositions,
  mentorship,
  managers = [],
  portalFlash,
  entryUrl,
}: Props) {
  const { t, locale } = useI18n();
  const nxt = nextLevel(employee.currentLevel);
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const displayName = localizeStaffText(employee.name, locale, "name");
  const displayRole = localizeStaffText(employee.roleTitle, locale, "role");
  const displayDepartment = localizeStaffText(
    employee.department,
    locale,
    "department",
  );
  const kindKey =
    platformAccess?.role === "manager"
      ? "role_manager"
      : platformAccess?.participantKind === "intern"
        ? "role_intern"
        : "role_employee";
  const accountType =
    platformAccess?.role === "manager"
      ? "manager"
      : platformAccess?.participantKind === "intern"
        ? "intern"
        : "employee";
  const tenureSource = employee.hiredAt || employee.createdAt || null;
  const hiredAtValue = tenureSource
    ? new Date(tenureSource).toISOString().slice(0, 10)
    : "";
  const nextCheckValue = employee.nextCheckAt
    ? new Date(employee.nextCheckAt).toISOString().slice(0, 10)
    : "";
  const isInternAccount =
    accountType === "intern" || /стаж|intern/i.test(employee.roleTitle);
  const trialStartValue = mentorship?.trialStartsAt
    ? new Date(mentorship.trialStartsAt).toISOString().slice(0, 10)
    : hiredAtValue;
  const trialEndValue = mentorship?.trialEndsAt
    ? new Date(mentorship.trialEndsAt).toISOString().slice(0, 10)
    : "";
  const startingLevel = employee.startingLevel || employee.currentLevel;
  const targetLevel = employee.targetLevel || nxt || employee.currentLevel;
  const statusKey =
    HR_STATUS_KEYS[employee.status || "active"] ?? "emp_status_active";
  const entranceScore =
    typeof entranceSnapshot?.score === "number"
      ? entranceSnapshot.score
      : typeof entranceSnapshot?.percent === "number"
        ? entranceSnapshot.percent
        : null;
  const entranceLevel =
    typeof entranceSnapshot?.level === "string"
      ? entranceSnapshot.level
      : typeof entranceSnapshot?.levelCode === "string"
        ? entranceSnapshot.levelCode
        : null;

  return (
    <AppShell pathname="/employees">
      <PageHeader
        title={displayName}
        subtitle={`${displayRole} · ${displayDepartment}`}
        action={
          <Link href="/employees" className="btn btn-ghost">
            {t("emp_back_list")}
          </Link>
        }
      />

      {portalFlash ? (
        <section className="panel portal-flash" style={{ marginBottom: 18 }}>
          <h2>{t("portal_access_created")}</h2>
          <p className="muted">{t("employee_access_created_note")}</p>
          <dl className="portal-creds">
            <div>
              <dt>{t("portal_login_label")}</dt>
              <dd>
                <code>{portalFlash.login}</code>
              </dd>
            </div>
            <div>
              <dt>{t("portal_password_label")}</dt>
              <dd>
                <code>{portalFlash.password}</code>
              </dd>
            </div>
            <div>
              <dt>{t("portal_entry_url")}</dt>
              <dd>
                <Link href="/login">{entryUrl}</Link>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="layout-2">
        <article className="panel">
          <p className="eyebrow">{t("emp_basic_info")}</p>
          <h2 style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LevelBadge level={employee.currentLevel} />
            <span>{levelLabel(employee.currentLevel)}</span>
          </h2>
          <p className="muted" style={{ marginBottom: 12 }}>
            {t(statusKey)}
            {employee.managerName
              ? ` · ${t("emp_col_manager")}: ${localizeStaffText(employee.managerName, locale, "name")}`
              : ""}
            {employee.mentorName
              ? ` · ${t("emp_col_mentor")}: ${employee.mentorName}`
              : ""}
          </p>
          <dl className="emp-meta">
            <div>
              <dt>{t("email")}</dt>
              <dd>{employee.email}</dd>
            </div>
            <div>
              <dt>{t("emp_phone")}</dt>
              <dd>{employee.phone || "—"}</dd>
            </div>
            <div>
              <dt>{t("emp_telegram")}</dt>
              <dd>{employee.telegram || "—"}</dd>
            </div>
            <div>
              <dt>{t("emp_schedule")}</dt>
              <dd>{employee.workSchedule || "—"}</dd>
            </div>
            <div>
              <dt>{t("emp_col_start_level")}</dt>
              <dd>
                <LevelBadge level={startingLevel} />
              </dd>
            </div>
            <div>
              <dt>{t("emp_col_target_level")}</dt>
              <dd>
                <LevelBadge level={targetLevel} />
              </dd>
            </div>
            <div>
              <dt>{t("emp_col_hired")}</dt>
              <dd>
                {hiredAtValue
                  ? new Date(hiredAtValue).toLocaleDateString(dateLocale)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("emp_col_next_check")}</dt>
              <dd>
                {nextCheckValue
                  ? new Date(nextCheckValue).toLocaleDateString(dateLocale)
                  : "—"}
              </dd>
            </div>
          </dl>
          {employee.notes ? (
            <p className="muted" style={{ marginTop: 12 }}>
              {employee.notes}
            </p>
          ) : null}
        </article>

        <article className="panel">
          <h2>{t("emp_path_title")}</h2>
          <p className="muted">{t("emp_path_note")}</p>
          <div className="path-steps" style={{ marginTop: 12 }}>
            {LEVEL_ORDER.map((code) => {
              const currentIdx = LEVEL_ORDER.indexOf(
                employee.currentLevel as (typeof LEVEL_ORDER)[number],
              );
              const idx = LEVEL_ORDER.indexOf(code);
              const cls =
                code === employee.currentLevel
                  ? "path-step current"
                  : currentIdx > idx
                    ? "path-step done"
                    : "path-step";
              return (
                <div key={code} className={cls}>
                  {levelLabel(code)}
                </div>
              );
            })}
          </div>
          <ul className="emp-path-list">
            <li>
              <strong>{t("emp_path_entrance")}</strong>
              <span className="muted">
                {entranceScore != null
                  ? `${entranceScore}%${entranceLevel ? ` · ${entranceLevel}` : ""}`
                  : t("emp_path_empty")}
              </span>
            </li>
            <li>
              <strong>{t("emp_path_trial")}</strong>
              <span className="muted">
                {trialReports.length > 0
                  ? t("emp_path_trial_count").replace(
                      "{n}",
                      String(trialReports.length),
                    )
                  : t("emp_path_empty")}
              </span>
            </li>
            <li>
              <strong>{t("emp_path_lessons")}</strong>
              <span className="muted">
                {completedLessonsCount > 0
                  ? t("emp_path_lessons_count").replace(
                      "{n}",
                      String(completedLessonsCount),
                    )
                  : t("emp_path_empty")}
              </span>
            </li>
            <li>
              <strong>{t("emp_path_tests")}</strong>
              <span className="muted">
                {employeeResults.length > 0
                  ? t("emp_path_tests_count").replace(
                      "{n}",
                      String(employeeResults.length),
                    )
                  : t("emp_path_empty")}
              </span>
            </li>
            <li>
              <strong>{t("emp_path_attestations")}</strong>
              <span className="muted">
                {attestationReviews.length > 0
                  ? t("emp_path_attestations_count").replace(
                      "{n}",
                      String(attestationReviews.length),
                    )
                  : attestations.length > 0
                    ? t("emp_path_attestations_count").replace(
                        "{n}",
                        String(attestations.length),
                      )
                    : t("emp_path_empty")}
              </span>
            </li>
          </ul>
          {attestationReviews.length > 0 ? (
            <div className="list" style={{ marginTop: 12 }}>
              {attestationReviews.map((review) => (
                <Link
                  key={review.id}
                  href={`/attestation/reviews/${review.id}`}
                  className="list-item learn-role-card"
                >
                  <span style={{ flex: 1 }}>
                    <strong>{review.attestationTitle}</strong>
                    <span className="muted" style={{ display: "block" }}>
                      {t(`attest_type_${review.type}` as MessageKey)} ·{" "}
                      {review.status}
                      {review.finalScore != null
                        ? ` · ${Math.round(review.finalScore)}%`
                        : ""}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
          <div className="next-steps" style={{ marginTop: 16 }}>
            <h3>{t("next_steps")}</h3>
            <p>{level?.nextSteps ?? level?.description ?? t("unassessed_desc")}</p>
            {nxt ? (
              <p className="muted" style={{ marginTop: 8 }}>
                {t("next_goal")}: <strong>{levelLabel(nxt)}</strong>
              </p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 16 }} id="matrix">
        <h2>{t("emp_matrix_title")}</h2>
        <p className="muted">{t("emp_matrix_note")}</p>
        {matrix.length === 0 ? (
          <p className="muted">{t("emp_matrix_empty")}</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>{t("emp_comp_name")}</th>
                  <th>{t("emp_comp_category")}</th>
                  <th>{t("emp_comp_status")}</th>
                  <th>{t("emp_comp_note")}</th>
                  <th>{t("emp_comp_save")}</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.competencyId}>
                    <td>
                      <strong>{row.name}</strong>
                      {row.description ? (
                        <div className="muted">{row.description}</div>
                      ) : null}
                    </td>
                    <td>{row.category}</td>
                    <td colSpan={3}>
                      <form
                        action={upsertEmployeeCompetencyAction}
                        className="emp-matrix-form"
                      >
                        <input
                          type="hidden"
                          name="employeeId"
                          value={employee.id}
                        />
                        <input
                          type="hidden"
                          name="competencyId"
                          value={row.competencyId}
                        />
                        <select name="status" defaultValue={row.status}>
                          {EMPLOYEE_COMPETENCY_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t(COMPETENCY_STATUS_KEYS[status])}
                            </option>
                          ))}
                        </select>
                        <input
                          name="note"
                          defaultValue={row.note}
                          placeholder={t("emp_comp_note")}
                        />
                        <button type="submit" className="btn btn-ghost">
                          {t("emp_comp_save")}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="layout-2" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>{t("waiting")}</h2>
          {pending.length === 0 ? (
            <p className="muted">{t("no_pending")}</p>
          ) : (
            <div className="list">
              {pending.map((p) => (
                <div key={p.id} className="list-item">
                  <div>
                    <strong>{p.assessmentTitle}</strong>
                    <div className="muted">
                      {t("until")}{" "}
                      {p.dueAt
                        ? new Date(p.dueAt).toLocaleDateString(dateLocale)
                        : "—"}
                    </div>
                  </div>
                  <Link href={`/take/${p.id}`} className="btn btn-primary">
                    {t("take")}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="panel">
          <h2>{t("emp_actions_title")}</h2>
          <p className="muted">{t("emp_actions_note")}</p>

          <form
            action={assignEmployeeTestAction}
            className="stack-form"
            style={{ marginTop: 12 }}
          >
            <input type="hidden" name="employeeId" value={employee.id} />
            <label>
              {t("emp_action_assign_test")}
              <select name="assessmentId" required defaultValue="">
                <option value="" disabled>
                  {t("select")}
                </option>
                {assessmentsForAssign.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("until")}
              <input type="date" name="dueAt" />
            </label>
            <button type="submit" className="btn btn-primary">
              {t("assign_test")}
            </button>
          </form>

          <form
            action={assignEmployeeAttestationAction}
            className="stack-form"
            style={{ marginTop: 16 }}
          >
            <input type="hidden" name="employeeId" value={employee.id} />
            <label>
              {t("emp_action_assign_attestation")}
              <select name="attestationId" required defaultValue="">
                <option value="" disabled>
                  {t("select")}
                </option>
                {attestations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("emp_attestation_type")}
              <select name="type" defaultValue="final_3_months">
                <option value="after_trial">{t("attest_type_after_trial")}</option>
                <option value="month_1">{t("attest_type_month_1")}</option>
                <option value="month_2">{t("attest_type_month_2")}</option>
                <option value="final_3_months">
                  {t("attest_type_final_3_months")}
                </option>
                <option value="repeat">{t("attest_type_repeat")}</option>
                <option value="annual">{t("attest_type_annual")}</option>
                <option value="transfer">{t("attest_type_transfer")}</option>
              </select>
            </label>
            <button type="submit" className="btn btn-ghost">
              {t("emp_action_assign_attestation_btn")}
            </button>
          </form>

          <form
            action={assignEmployeePositionAction}
            className="stack-form"
            style={{ marginTop: 16 }}
          >
            <input type="hidden" name="employeeId" value={employee.id} />
            <input type="hidden" name="mode" value="move" />
            <label>
              {t("emp_action_move_role")}
              <select name="positionId" required defaultValue="">
                <option value="" disabled>
                  {t("select")}
                </option>
                {vacantPositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.code} ·{" "}
                    {localizeStaffText(position.role, locale, "role")} ·{" "}
                    {localizeStaffText(
                      position.department,
                      locale,
                      "department",
                    )}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-ghost">
              {t("staff_move_role")}
            </button>
          </form>

          <p style={{ marginTop: 16 }}>
            <Link href="/learning" className="btn btn-ghost">
              {t("emp_action_learning")}
            </Link>
          </p>
          <form
            action={rebuildEmployeeLearningProgramAction}
            style={{ marginTop: 12 }}
          >
            <input type="hidden" name="employeeId" value={employee.id} />
            <button type="submit" className="btn btn-ghost">
              {t("learn_rebuild_program")}
            </button>
          </form>
        </article>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t("emp_profile_edit")}</h2>
        <form
          action={updateEmployeeProfileAction}
          className="stack-form emp-profile-grid"
        >
          <input type="hidden" name="employeeId" value={employee.id} />
          <label>
            {t("emp_phone")}
            <input name="phone" defaultValue={employee.phone ?? ""} />
          </label>
          <label>
            {t("emp_telegram")}
            <input name="telegram" defaultValue={employee.telegram ?? ""} />
          </label>
          <label>
            {t("emp_schedule")}
            <input
              name="workSchedule"
              defaultValue={employee.workSchedule ?? ""}
            />
          </label>
          <label>
            {t("emp_col_status")}
            <select name="status" defaultValue={employee.status || "active"}>
              {EMPLOYEE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(HR_STATUS_KEYS[status])}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("emp_col_start_level")}
            <select name="startingLevel" defaultValue={startingLevel}>
              {LEVEL_ORDER.map((code) => (
                <option key={code} value={code}>
                  {levelLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("col_level")}
            <select name="currentLevel" defaultValue={employee.currentLevel}>
              {LEVEL_ORDER.map((code) => (
                <option key={code} value={code}>
                  {levelLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("emp_col_target_level")}
            <select name="targetLevel" defaultValue={targetLevel}>
              {LEVEL_ORDER.map((code) => (
                <option key={code} value={code}>
                  {levelLabel(code)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("emp_col_manager")}
            <select
              name="managerEmployeeId"
              defaultValue={employee.managerEmployeeId ?? ""}
            >
              <option value="">{t("mentor_unassigned")}</option>
              {peers
                .filter((peer) => peer.id !== employee.id)
                .map((peer) => (
                  <option key={peer.id} value={peer.id}>
                    {localizeStaffText(peer.name, locale, "name")}
                  </option>
                ))}
            </select>
          </label>
          <label>
            {t("emp_col_mentor")}
            <select
              name="mentorUserId"
              defaultValue={employee.mentorUserId ?? ""}
            >
              <option value="">{t("mentor_unassigned")}</option>
              {managers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.displayName}
                  {manager.profileDepartment
                    ? ` · ${manager.profileDepartment}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("col_department")}
            <input name="department" defaultValue={employee.department} />
          </label>
          <label>
            {t("col_position")}
            <input name="roleTitle" defaultValue={employee.roleTitle} />
          </label>
          <label>
            {t("employee_hire_date_label")}
            <input type="date" name="hiredAt" defaultValue={hiredAtValue} />
          </label>
          <label>
            {t("emp_col_next_check")}
            <input type="date" name="nextCheckAt" defaultValue={nextCheckValue} />
          </label>
          <label className="emp-notes">
            {t("emp_notes")}
            <textarea name="notes" rows={3} defaultValue={employee.notes ?? ""} />
          </label>
          <button type="submit" className="btn btn-primary">
            {t("emp_profile_save")}
          </button>
        </form>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t("history")}</h2>
        {employeeResults.length === 0 ? (
          <p className="muted">{t("no_history")}</p>
        ) : (
          <div className="list">
            {employeeResults.map((r) => {
              const profile = parseProfileJson(r.profileJson);
              return (
                <div
                  key={r.id}
                  className="list-item"
                  style={{ alignItems: "flex-start" }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{r.assessmentTitle}</strong>
                    <div className="muted">
                      {r.competencyName} · {r.score}% ·{" "}
                      {new Date(r.completedAt).toLocaleDateString(dateLocale)}
                    </div>
                    {profile ? (
                      <KnowledgeProfileCard profile={profile} compact />
                    ) : (
                      <p className="muted" style={{ marginTop: 8 }}>
                        {t("level")}: {levelLabel(r.levelCode)}
                      </p>
                    )}
                  </div>
                  <LevelBadge level={r.levelCode} />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {isInternAccount ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <h2>{t("mentor_admin_title")}</h2>
          <p className="muted">{t("mentor_admin_note")}</p>
          <form
            action={updateInternMentorshipAction}
            className="stack-form"
            style={{ maxWidth: 520 }}
          >
            <input type="hidden" name="employeeId" value={employee.id} />
            <label>
              {t("mentor_label")}
              <select
                name="mentorUserId"
                defaultValue={mentorship?.mentorUserId ?? ""}
              >
                <option value="">{t("mentor_unassigned")}</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.displayName}
                    {manager.profileDepartment
                      ? ` · ${manager.profileDepartment}`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("mentor_trial_start")}
              <input
                type="date"
                name="trialStartsAt"
                defaultValue={trialStartValue}
              />
            </label>
            <label>
              {t("mentor_trial_end")}
              <input
                type="date"
                name="trialEndsAt"
                defaultValue={trialEndValue}
              />
            </label>
            {mentorship ? (
              <p className="muted">
                {t("mentor_status")}: {mentorship.status}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary">
              {t("mentor_admin_save")}
            </button>
          </form>
        </section>
      ) : null}

      <section className="layout-2" style={{ marginTop: 16 }}>
        <article className="panel">
          <h2>{t("employee_access_title")}</h2>
          <p className="muted">{t("employee_access_subtitle")}</p>
          {platformAccess?.isActive && platformAccess.login ? (
            <p className="muted" style={{ marginBottom: 12 }}>
              {t(kindKey)} · <code>{platformAccess.login}</code> ·{" "}
              {t("portal_enabled")}
            </p>
          ) : (
            <p className="muted" style={{ marginBottom: 12 }}>
              {t("portal_disabled")}
            </p>
          )}
          <form action={setEmployeePortalAction} className="stack-form">
            <input type="hidden" name="employeeId" value={employee.id} />
            <label>
              {t("employee_account_type")}
              <select name="accountType" defaultValue={accountType}>
                <option value="intern">{t("role_intern")}</option>
                <option value="employee">{t("role_employee")}</option>
                <option value="manager">{t("role_manager")}</option>
              </select>
            </label>
            <p className="muted">{t("employee_account_type_hint")}</p>
            <label>
              {t("portal_login_label")}
              <input
                name="portalLogin"
                placeholder={t("portal_login_placeholder")}
                defaultValue={platformAccess?.login ?? ""}
                autoComplete="off"
              />
            </label>
            <label>
              {t("portal_password_label")}
              <input
                name="portalPassword"
                placeholder={t("portal_password_placeholder")}
                autoComplete="new-password"
              />
            </label>
            <p className="muted">{t("employee_access_hint")}</p>
            <button type="submit" className="btn btn-primary">
              {platformAccess?.isActive
                ? t("employee_access_update")
                : t("portal_create_access")}
            </button>
          </form>
        </article>

        <article className="panel">
          <p className="muted">{t("portal_admin_note")}</p>
          <p>
            <Link href="/login">{entryUrl}</Link>
          </p>
        </article>
      </section>
    </AppShell>
  );
}
