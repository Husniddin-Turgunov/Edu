"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui";
import {
  createManagerTaskAction,
  updateManagerTaskStatusAction,
} from "@/db/actions";
import type { ManagerTaskRow } from "@/db/manager-cabinet";
import { useI18n } from "@/lib/i18n";

type Props = {
  team: { id: number; name: string }[];
  items: ManagerTaskRow[];
  counts: {
    open: number;
    overdue: number;
    doneToday: number;
    inProgress: number;
  };
  initialFilter?: string;
};

export function ManagerTasksView({ team, items, counts, initialFilter }: Props) {
  const { t } = useI18n();
  const [filter, setFilter] = useState(initialFilter ?? "all");
  const visible = useMemo(() => {
    if (filter === "overdue") return items.filter((row) => row.overdue);
    if (filter === "open") return items.filter((row) => row.status !== "done");
    if (filter === "done") return items.filter((row) => row.status === "done");
    return items;
  }, [filter, items]);

  return (
    <>
      <PageHeader title={t("mgr_tasks_title")} subtitle={t("mgr_tasks_note")} />

      <div className="grid-stats dash-kpi-grid dash-kpi-grid-mgr">
        <button type="button" className="stat" onClick={() => setFilter("done")}>
          <span>{t("mgr_tasks_done_today")}</span>
          <strong>{counts.doneToday}</strong>
        </button>
        <button type="button" className="stat" onClick={() => setFilter("open")}>
          <span>{t("mgr_tasks_in_progress")}</span>
          <strong>{counts.inProgress}</strong>
        </button>
        <button type="button" className="stat" onClick={() => setFilter("overdue")}>
          <span>{t("mgr_kpi_overdue")}</span>
          <strong>{counts.overdue}</strong>
        </button>
        <div className="stat">
          <span>{t("mgr_tasks_open")}</span>
          <strong>{counts.open}</strong>
        </div>
      </div>

      <article className="panel mgr-task-form">
        <h2>{t("mgr_tasks_create")}</h2>
        <form action={createManagerTaskAction} className="form-grid">
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
            {t("mgr_task_title")}
            <input name="title" required />
          </label>
          <label>
            {t("mgr_task_due")}
            <input name="dueAt" type="datetime-local" />
          </label>
          <label>
            {t("mgr_task_priority")}
            <select name="priority" defaultValue="medium">
              <option value="high">{t("mgr_priority_high")}</option>
              <option value="medium">{t("mgr_priority_medium")}</option>
              <option value="low">{t("mgr_priority_low")}</option>
            </select>
          </label>
          <label className="span-2">
            {t("mgr_task_description")}
            <textarea name="description" rows={2} />
          </label>
          <button type="submit" className="btn btn-primary">
            {t("mgr_tasks_create_btn")}
          </button>
        </form>
      </article>

      <article className="panel" style={{ marginTop: 18 }}>
        <h2>{t("mgr_tasks_list")}</h2>
        {visible.length === 0 ? (
          <p className="muted">{t("mgr_tasks_empty")}</p>
        ) : (
          <div className="list">
            {visible.map((task) => (
              <div key={task.id} className="list-item mgr-task-row">
                <div>
                  <strong>{task.title}</strong>
                  <div className="muted">
                    {task.employeeName} · {task.dueAt?.slice(0, 16) ?? t("mgr_no_deadline")}
                  </div>
                </div>
                {task.status !== "done" ? (
                  <form action={updateManagerTaskStatusAction}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <input type="hidden" name="status" value="done" />
                    <button type="submit" className="btn btn-primary">
                      {t("mgr_task_done")}
                    </button>
                  </form>
                ) : (
                  <span className="learn-status learn-status-credited">
                    {t("mgr_task_status_done")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </article>
    </>
  );
}
