"use client";

import { PageHeader } from "@/components/ui";
import {
  createOneOnOneMeetingAction,
  updateOneOnOneMeetingAction,
} from "@/db/actions";
import type { ManagerMeetingRow } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";

type Props = {
  team: { id: number; name: string }[];
  meetings: ManagerMeetingRow[];
  counts: { today: number; upcoming: number; done: number };
};

export function ManagerMeetingsView({ team, meetings, counts }: Props) {
  const { t } = useI18n();

  return (
    <>
      <PageHeader title={t("mgr_meetings_title")} subtitle={t("mgr_meetings_note")} />

      <div className="grid-stats dash-kpi-grid">
        <div className="stat">
          <span>{t("mgr_meetings_today")}</span>
          <strong>{counts.today}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_meetings_upcoming")}</span>
          <strong>{counts.upcoming}</strong>
        </div>
        <div className="stat">
          <span>{t("mgr_meetings_done")}</span>
          <strong>{counts.done}</strong>
        </div>
      </div>

      <article className="panel mgr-task-form" style={{ marginTop: 18 }}>
        <h2>{t("mgr_meetings_create")}</h2>
        <form action={createOneOnOneMeetingAction} className="form-grid">
          <label>
            {t("mgr_col_employee")}
            <select name="employeeId" required>
              <option value="">{t("mgr_select_employee")}</option>
              {team.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("mgr_meetings_when")}
            <input name="scheduledAt" type="datetime-local" required />
          </label>
          <label className="span-2">
            {t("mgr_meetings_goals")}
            <textarea name="nextGoals" rows={2} />
          </label>
          <button type="submit" className="btn btn-primary">
            {t("mgr_meetings_create_btn")}
          </button>
        </form>
      </article>

      <div className="list" style={{ marginTop: 18 }}>
        {meetings.length === 0 ? (
          <p className="muted">{t("mgr_meetings_empty")}</p>
        ) : (
          meetings.map((meeting) => (
            <article key={meeting.id} className="panel mgr-meeting-card">
              <div className="mgr-meeting-head">
                <div>
                  <h2>{meeting.employeeName}</h2>
                  <p className="muted">{meeting.scheduledAt.slice(0, 16)}</p>
                </div>
                <span className={`learn-status learn-status-${meeting.status === "done" ? "credited" : "studying"}`}>
                  {t(`mgr_meeting_status_${meeting.status}` as "mgr_meeting_status_planned")}
                </span>
              </div>

              <div className="mgr-meeting-context">
                <p>
                  KPI: {meeting.context.kpiPercent ?? meeting.context.progressPercent}% ·{" "}
                  {t("mgr_col_tasks")}: {meeting.context.openTasks}
                </p>
                {meeting.context.lastMeetingAt ? (
                  <p className="muted">
                    {t("mgr_meetings_last")}: {meeting.context.lastMeetingAt.slice(0, 10)}
                  </p>
                ) : null}
                {meeting.nextGoals ? (
                  <p>
                    <strong>{t("mgr_meetings_goals")}:</strong> {meeting.nextGoals}
                  </p>
                ) : null}
              </div>

              {meeting.status === "planned" ? (
                <form action={updateOneOnOneMeetingAction} className="form-grid">
                  <input type="hidden" name="meetingId" value={meeting.id} />
                  <input type="hidden" name="status" value="done" />
                  <label className="span-2">
                    {t("mgr_meetings_notes")}
                    <textarea name="notes" rows={2} defaultValue={meeting.notes} />
                  </label>
                  <label className="span-2">
                    {t("mgr_meetings_agreements")}
                    <textarea name="agreements" rows={2} defaultValue={meeting.agreements} />
                  </label>
                  <label className="span-2">
                    {t("mgr_meetings_next")}
                    <textarea name="nextGoals" rows={2} defaultValue={meeting.nextGoals} />
                  </label>
                  <button type="submit" className="btn btn-primary">
                    {t("mgr_meetings_complete")}
                  </button>
                </form>
              ) : null}
            </article>
          ))
        )}
      </div>
    </>
  );
}
