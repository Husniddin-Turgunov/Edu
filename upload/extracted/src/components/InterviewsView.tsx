"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import {
  createInterviewAction,
  saveInterviewEvaluationAction,
  setInterviewConfirmAction,
} from "@/db/actions";
import type { InterviewEvaluation } from "@/db/queries";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type InterviewRow = {
  id: number;
  candidateId: number;
  scheduledAt: string;
  durationMinutes: number;
  format: string;
  address: string;
  geoUrl: string;
  room: string;
  interviewerName: string;
  departmentHead: string;
  commentToCandidate: string;
  confirmStatus: string;
  status: string;
  decision: string | null;
  decisionComment: string;
  candidateName: string;
  candidateTelegram: string;
  roleTitle: string | null;
  department: string | null;
  vacancyCode: string | null;
  hrOwnerName: string | null;
  evaluation: InterviewEvaluation;
  notify: Record<string, unknown>;
};

type CandidateOpt = {
  id: number;
  name: string;
  roleTitle: string;
};

type HrUser = { id: number; displayName: string };

const EVAL_FIELDS: { name: keyof InterviewEvaluation; key: MessageKey }[] = [
  { name: "appearance", key: "iv_eval_appearance" },
  { name: "communication", key: "iv_eval_communication" },
  { name: "motivation", key: "iv_eval_motivation" },
  { name: "adequacy", key: "iv_eval_adequacy" },
  { name: "experience", key: "iv_eval_experience" },
  { name: "leaveReasons", key: "iv_eval_leave" },
  { name: "salaryExpectations", key: "iv_eval_salary" },
  { name: "professionalConfidence", key: "iv_eval_confidence" },
  { name: "valuesFit", key: "iv_eval_values" },
  { name: "risks", key: "iv_eval_risks" },
  { name: "comment", key: "iv_eval_comment" },
  { name: "recommendation", key: "iv_eval_recommendation" },
];

function confirmKey(status: string): MessageKey {
  if (status === "confirmed") return "iv_confirm_confirmed";
  if (status === "declined") return "iv_confirm_declined";
  if (status === "reschedule") return "iv_confirm_reschedule";
  return "iv_confirm_pending";
}

function formatKey(format: string): MessageKey {
  if (format === "online") return "iv_format_online";
  if (format === "phone") return "iv_format_phone";
  return "iv_format_office";
}

export function InterviewsView({
  interviews,
  candidates,
  hrUsers,
}: {
  interviews: InterviewRow[];
  candidates: CandidateOpt[];
  hrUsers: HrUser[];
}) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<"calendar" | "create" | "evaluate">(
    "calendar",
  );
  const [evaluateId, setEvaluateId] = useState<number | null>(
    interviews.find((i) => i.status === "scheduled")?.id ?? null,
  );
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const personName = (v: string) => localizeStaffText(v, locale, "name");
  const roleName = (v: string) => localizeStaffText(v, locale, "role");

  const byDay = useMemo(() => {
    const map = new Map<string, InterviewRow[]>();
    for (const row of interviews) {
      const day = row.scheduledAt.slice(0, 10);
      const list = map.get(day) ?? [];
      list.push(row);
      map.set(day, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [interviews]);

  const selected = interviews.find((i) => i.id === evaluateId) ?? null;

  return (
    <AppShell pathname="/interviews">
      <PageHeader
        title={t("iv_title")}
        subtitle={t("iv_subtitle")}
        action={
          <Link href="/candidates" className="btn btn-ghost">
            {t("nav_candidates")}
          </Link>
        }
      />

      <div className="candidate-tabs" role="tablist">
        {(
          [
            ["calendar", "iv_tab_calendar"],
            ["create", "iv_tab_create"],
            ["evaluate", "iv_tab_evaluate"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "candidate-tab active" : "candidate-tab"}
            onClick={() => setTab(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {tab === "calendar" ? (
        <section className="panel">
          <h2>{t("iv_tab_calendar")}</h2>
          {byDay.length === 0 ? (
            <p className="muted">{t("iv_empty")}</p>
          ) : (
            <div className="stack" style={{ gap: 18 }}>
              {byDay.map(([day, rows]) => (
                <div key={day}>
                  <h3>
                    {new Date(`${day}T12:00:00`).toLocaleDateString(dateLocale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </h3>
                  <div className="list">
                    {rows.map((row) => (
                      <div key={row.id} className="list-item iv-cal-row">
                        <div>
                          <strong>
                            {new Date(row.scheduledAt).toLocaleTimeString(
                              dateLocale,
                              { hour: "2-digit", minute: "2-digit" },
                            )}{" "}
                            · {personName(row.candidateName)}
                          </strong>
                          <div className="muted">
                            {roleName(row.roleTitle || "")}
                            {row.interviewerName
                              ? ` · ${row.interviewerName}`
                              : ""}
                            {` · ${t(formatKey(row.format))}`}
                            {row.room ? ` · ${row.room}` : ""}
                          </div>
                          <div className="muted">
                            {t("iv_confirm_label")}: {t(confirmKey(row.confirmStatus))}
                            {row.status === "completed"
                              ? ` · ${t("iv_status_completed")}`
                              : ""}
                          </div>
                        </div>
                        <div className="stack" style={{ gap: 6 }}>
                          <form action={setInterviewConfirmAction} className="stack-form">
                            <input
                              type="hidden"
                              name="interviewId"
                              value={row.id}
                            />
                            <select
                              name="confirmStatus"
                              defaultValue={row.confirmStatus}
                            >
                              <option value="pending">
                                {t("iv_confirm_pending")}
                              </option>
                              <option value="confirmed">
                                {t("iv_confirm_confirmed")}
                              </option>
                              <option value="declined">
                                {t("iv_confirm_declined")}
                              </option>
                              <option value="reschedule">
                                {t("iv_confirm_reschedule")}
                              </option>
                            </select>
                            <button type="submit" className="btn btn-ghost btn-sm">
                              {t("save")}
                            </button>
                          </form>
                          {row.status !== "completed" ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEvaluateId(row.id);
                                setTab("evaluate");
                              }}
                            >
                              {t("iv_open_eval")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="muted" style={{ marginTop: 16 }}>
            <Link href="/access">{t("hub_interviews_access")}</Link>
            {" · "}
            <Link href="/candidates">{t("hub_interviews_candidates")}</Link>
          </p>
        </section>
      ) : null}

      {tab === "create" ? (
        <section className="panel" style={{ maxWidth: 640 }}>
          <h2>{t("iv_tab_create")}</h2>
          <form action={createInterviewAction} className="stack-form">
            <label>
              {t("candidate")}
              <select name="candidateId" required defaultValue="">
                <option value="" disabled>
                  {t("select")}
                </option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {personName(c.name)} — {roleName(c.roleTitle)}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-grid">
              <label>
                {t("iv_date")}
                <input name="date" type="date" required />
              </label>
              <label>
                {t("iv_time")}
                <input name="time" type="time" required />
              </label>
              <label>
                {t("iv_duration")}
                <input
                  name="durationMinutes"
                  type="number"
                  min={15}
                  defaultValue={60}
                />
              </label>
              <label>
                {t("iv_format")}
                <select name="format" defaultValue="office">
                  <option value="office">{t("iv_format_office")}</option>
                  <option value="online">{t("iv_format_online")}</option>
                  <option value="phone">{t("iv_format_phone")}</option>
                </select>
              </label>
            </div>
            <label>
              {t("iv_address")}
              <input name="address" />
            </label>
            <label>
              {t("iv_geo")}
              <input name="geoUrl" placeholder="https://maps…" />
            </label>
            <label>
              {t("iv_room")}
              <input name="room" />
            </label>
            <label>
              {t("cand_hr_owner")}
              <select name="hrOwnerUserId" defaultValue="">
                <option value="">—</option>
                {hrUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("iv_interviewer")}
              <input name="interviewerName" />
            </label>
            <label>
              {t("iv_dept_head")}
              <input name="departmentHead" />
            </label>
            <label>
              {t("iv_comment_candidate")}
              <textarea name="commentToCandidate" rows={3} />
            </label>
            <label className="cand-check">
              <input type="checkbox" name="sendNotify" value="1" defaultChecked />
              {t("iv_send_telegram_stub")}
            </label>
            <p className="muted">{t("iv_telegram_note")}</p>
            <button type="submit" className="btn btn-primary">
              {t("iv_create_btn")}
            </button>
          </form>
        </section>
      ) : null}

      {tab === "evaluate" ? (
        <section className="layout-2">
          <article className="panel">
            <h2>{t("iv_pick_interview")}</h2>
            {interviews.length === 0 ? (
              <p className="muted">{t("iv_empty")}</p>
            ) : (
              <div className="list">
                {interviews.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    className={
                      evaluateId === row.id
                        ? "list-item dash-action-link active"
                        : "list-item dash-action-link"
                    }
                    onClick={() => setEvaluateId(row.id)}
                  >
                    <div>
                      <strong>{personName(row.candidateName)}</strong>
                      <div className="muted">
                        {new Date(row.scheduledAt).toLocaleString(dateLocale)}
                        {row.status === "completed"
                          ? ` · ${t("iv_status_completed")}`
                          : ""}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="panel">
            <h2>{t("iv_tab_evaluate")}</h2>
            {!selected ? (
              <p className="muted">{t("iv_pick_hint")}</p>
            ) : (
              <form
                action={saveInterviewEvaluationAction}
                className="stack-form"
              >
                <input type="hidden" name="interviewId" value={selected.id} />
                <p>
                  <strong>{personName(selected.candidateName)}</strong>
                    <span className="muted">
                    {" "}
                    · {roleName(selected.roleTitle || "")}
                  </span>
                </p>
                {EVAL_FIELDS.map((field) => (
                  <label key={field.name}>
                    {t(field.key)}
                    {field.name === "comment" ||
                    field.name === "recommendation" ||
                    field.name === "risks" ? (
                      <textarea
                        name={field.name}
                        rows={2}
                        defaultValue={selected.evaluation[field.name] ?? ""}
                      />
                    ) : (
                      <input
                        name={field.name}
                        defaultValue={selected.evaluation[field.name] ?? ""}
                      />
                    )}
                  </label>
                ))}
                <label>
                  {t("iv_decision")}
                  <select
                    name="decision"
                    defaultValue={selected.decision ?? ""}
                  >
                    <option value="">{t("select")}</option>
                    <option value="assign_test">{t("iv_dec_assign_test")}</option>
                    <option value="extra_interview">
                      {t("iv_dec_extra")}
                    </option>
                    <option value="other_role">{t("iv_dec_other_role")}</option>
                    <option value="reserve">{t("iv_dec_reserve")}</option>
                    <option value="reject">{t("iv_dec_reject")}</option>
                  </select>
                </label>
                <label>
                  {t("iv_decision_comment")}
                  <textarea
                    name="decisionComment"
                    rows={2}
                    defaultValue={selected.decisionComment}
                  />
                </label>
                {selected.notify &&
                typeof selected.notify.text === "string" ? (
                  <details>
                    <summary>{t("iv_telegram_preview")}</summary>
                    <pre className="iv-notify-pre">
                      {String(selected.notify.text)}
                    </pre>
                  </details>
                ) : null}
                <button type="submit" className="btn btn-primary">
                  {t("iv_save_eval")}
                </button>
              </form>
            )}
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
