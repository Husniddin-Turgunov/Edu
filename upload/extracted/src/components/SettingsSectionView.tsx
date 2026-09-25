"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { saveSystemSettingsAction } from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { SettingsSection } from "@/lib/system-settings";

const TITLES: Record<SettingsSection, MessageKey> = {
  company: "st_company_title",
  permissions: "st_perm_title",
  tests: "st_tests_title",
  learning: "st_learn_title",
  notifications: "st_notif_title",
  security: "st_sec_title",
};

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cand-check">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={Boolean(defaultChecked)}
      />
      {label}
    </label>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string | number;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        autoComplete="off"
      />
    </label>
  );
}

export function SettingsSectionView({
  section,
  config,
  embedded = false,
}: {
  section: SettingsSection;
  config: Record<string, unknown>;
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const str = (key: string) => String(config[key] ?? "");
  const num = (key: string) => Number(config[key] ?? 0);
  const flag = (key: string) => Boolean(config[key]);

  const body = (
    <>
      {!embedded ? (
        <>
          <PageHeader title={t(TITLES[section])} subtitle={t("st_section_note")} />
          <p>
            <Link href="/admin/system">{t("st_back")}</Link>
          </p>
        </>
      ) : null}
      <article className="panel" style={{ maxWidth: 720 }}>
        <form action={saveSystemSettingsAction} className="stack-form">
          <input type="hidden" name="section" value={section} />
          {section === "company" ? (
            <>
              <Field name="name" label={t("st_co_name")} defaultValue={str("name")} />
              <Field
                name="logoUrl"
                label={t("st_co_logo")}
                defaultValue={str("logoUrl")}
              />
              <Field
                name="address"
                label={t("st_co_address")}
                defaultValue={str("address")}
              />
              <Field name="phone" label={t("st_co_phone")} defaultValue={str("phone")} />
              <Field
                name="timezone"
                label={t("st_co_tz")}
                defaultValue={str("timezone")}
              />
              <Field
                name="workDays"
                label={t("st_co_days")}
                defaultValue={str("workDays")}
              />
              <div className="form-grid">
                <Field
                  name="workStart"
                  label={t("st_co_start")}
                  defaultValue={str("workStart")}
                />
                <Field
                  name="workEnd"
                  label={t("st_co_end")}
                  defaultValue={str("workEnd")}
                />
              </div>
            </>
          ) : null}
          {section === "permissions" ? (
            <>
              <p className="muted">{t("st_perm_intro")}</p>
              <Check
                name="candidateOwnTestOnly"
                label={t("st_perm_candidate")}
                defaultChecked={flag("candidateOwnTestOnly")}
              />
              <Check
                name="internSeesLessons"
                label={t("st_perm_intern")}
                defaultChecked={flag("internSeesLessons")}
              />
              <Check
                name="mentorSeesMentees"
                label={t("st_perm_mentor")}
                defaultChecked={flag("mentorSeesMentees")}
              />
              <Check
                name="managerSeesDepartment"
                label={t("st_perm_manager")}
                defaultChecked={flag("managerSeesDepartment")}
              />
              <Check
                name="hrSeesAllCandidates"
                label={t("st_perm_hr")}
                defaultChecked={flag("hrSeesAllCandidates")}
              />
              <Check
                name="adminManagesAll"
                label={t("st_perm_admin")}
                defaultChecked={flag("adminManagesAll")}
              />
              <Check
                name="answerKeyHrOnly"
                label={t("st_perm_key")}
                defaultChecked={flag("answerKeyHrOnly")}
              />
            </>
          ) : null}
          {section === "tests" ? (
            <>
              <div className="form-grid">
                <Field
                  name="questionCount"
                  label={t("st_test_count")}
                  type="number"
                  defaultValue={num("questionCount")}
                />
                <Field
                  name="durationMinutes"
                  label={t("st_test_duration")}
                  type="number"
                  defaultValue={num("durationMinutes")}
                />
                <Field
                  name="passScore"
                  label={t("st_test_pass")}
                  type="number"
                  defaultValue={num("passScore")}
                />
                <Field
                  name="maxAttempts"
                  label={t("st_test_attempts")}
                  type="number"
                  defaultValue={num("maxAttempts")}
                />
              </div>
              <Check
                name="randomOrder"
                label={t("st_test_random")}
                defaultChecked={flag("randomOrder")}
              />
              <Check
                name="forbidReentry"
                label={t("st_test_reentry")}
                defaultChecked={flag("forbidReentry")}
              />
              <Check
                name="showResultToCandidate"
                label={t("st_test_show")}
                defaultChecked={flag("showResultToCandidate")}
              />
            </>
          ) : null}
          {section === "learning" ? (
            <>
              <div className="form-grid">
                <Field
                  name="dayMinutes"
                  label={t("st_learn_day")}
                  type="number"
                  defaultValue={num("dayMinutes")}
                />
                <Field
                  name="deadlineDays"
                  label={t("st_learn_deadline")}
                  type="number"
                  defaultValue={num("deadlineDays")}
                />
                <Field
                  name="passThreshold"
                  label={t("st_learn_pass")}
                  type="number"
                  defaultValue={num("passThreshold")}
                />
                <Field
                  name="retryAttempts"
                  label={t("st_learn_retry")}
                  type="number"
                  defaultValue={num("retryAttempts")}
                />
              </div>
              <Check
                name="overdueBlocksNext"
                label={t("st_learn_overdue")}
                defaultChecked={flag("overdueBlocksNext")}
              />
              <Check
                name="autoAssignLessons"
                label={t("st_learn_auto")}
                defaultChecked={flag("autoAssignLessons")}
              />
            </>
          ) : null}
          {section === "notifications" ? (
            <>
              <Check
                name="candidateInvited"
                label={t("st_n_invite")}
                defaultChecked={flag("candidateInvited")}
              />
              <Check
                name="interviewConfirmed"
                label={t("st_n_confirm")}
                defaultChecked={flag("interviewConfirmed")}
              />
              <Check
                name="testAssigned"
                label={t("st_n_test_assigned")}
                defaultChecked={flag("testAssigned")}
              />
              <Check
                name="testCompleted"
                label={t("st_n_test_done")}
                defaultChecked={flag("testCompleted")}
              />
              <Check
                name="lessonOverdue"
                label={t("st_n_overdue")}
                defaultChecked={flag("lessonOverdue")}
              />
              <Check
                name="workReviewed"
                label={t("st_n_reviewed")}
                defaultChecked={flag("workReviewed")}
              />
              <Check
                name="attestationAssigned"
                label={t("st_n_attest")}
                defaultChecked={flag("attestationAssigned")}
              />
              <Check
                name="reachedMiddle"
                label={t("st_n_middle")}
                defaultChecked={flag("reachedMiddle")}
              />
            </>
          ) : null}
          {section === "security" ? (
            <>
              <div className="form-grid">
                <Field
                  name="minPasswordLength"
                  label={t("st_sec_pwd")}
                  type="number"
                  defaultValue={num("minPasswordLength")}
                />
                <Field
                  name="sessionDays"
                  label={t("st_sec_session")}
                  type="number"
                  defaultValue={num("sessionDays")}
                />
                <Field
                  name="retentionDays"
                  label={t("st_sec_retain")}
                  type="number"
                  defaultValue={num("retentionDays")}
                />
              </div>
              <Check
                name="twoFactorEnabled"
                label={t("st_sec_2fa")}
                defaultChecked={flag("twoFactorEnabled")}
              />
              <Check
                name="consentRequired"
                label={t("st_sec_consent")}
                defaultChecked={flag("consentRequired")}
              />
              <p className="muted">{t("st_sec_backup")}</p>
            </>
          ) : null}
          <button type="submit" className="btn btn-primary">
            {t("ig_save")}
          </button>
        </form>
      </article>
    </>
  );
  if (embedded) return body;
  return <AppShell pathname="/settings">{body}</AppShell>;
}
