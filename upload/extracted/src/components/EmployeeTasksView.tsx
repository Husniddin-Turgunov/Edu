"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import type {
  EmployeeTaskItem,
  EmployeeTaskKind,
  EmployeeTasksBoard,
} from "@/db/employee-home";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";

const KIND_KEYS: Record<EmployeeTaskKind, MessageKey> = {
  lesson: "eh_task_kind_lesson",
  test: "eh_task_kind_test",
  attestation: "eh_task_kind_attest",
  promotion: "eh_task_kind_promo",
};

const PRIORITY_KEYS: Record<EmployeeTaskItem["priority"], MessageKey> = {
  high: "eh_task_priority_high",
  medium: "eh_task_priority_medium",
  low: "eh_task_priority_low",
};

type TaskFilter = "all" | "overdue" | "open" | "review";

function formatDue(iso: string | null, locale: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return date.toLocaleString(dateLocale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmployeeTasksView({
  data,
  themeHue,
}: {
  data: EmployeeTasksBoard;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [shown, setShown] = useState(8);
  const localized = useImportedContent(
    data.items.map((item) => item.title),
    locale,
  );

  const filtered = useMemo(() => {
    return data.items.filter((item) => {
      if (filter === "overdue") return item.overdue;
      if (filter === "review") {
        return (
          item.statusKey === "learn_status_submitted" ||
          item.statusKey === "learn_status_recheck"
        );
      }
      if (filter === "open") {
        return (
          !item.overdue &&
          item.statusKey !== "learn_status_submitted" &&
          item.statusKey !== "learn_status_recheck"
        );
      }
      return true;
    });
  }, [data.items, filter]);

  const visible = filtered.slice(0, shown);

  function setTab(next: TaskFilter) {
    setFilter(next);
    setShown(8);
  }

  return (
    <AppShell pathname="/my/tasks" role="employee" themeHue={themeHue}>
      <PageHeader
        title={t("nav_my_tasks")}
        subtitle={t("eh_tasks_note")}
        action={
          visible[0] ? (
            <Link href={visible[0].href} className="btn btn-primary">
              {t("eh_continue")}
            </Link>
          ) : undefined
        }
      />

      <section className="stack" style={{ gap: 8, marginBottom: 16 }}>
        <div className="grid-stats dash-kpi-grid dash-kpi-grid-employee">
          <div className="stat">
            <span>{t("eh_task_kpi_open")}</span>
            <strong>{data.counts.open}</strong>
          </div>
          <div className="stat">
            <span>{t("eh_kpi_overdue")}</span>
            <strong>{data.counts.overdue}</strong>
          </div>
          <div className="stat">
            <span>{t("eh_learn_in_review")}</span>
            <strong>{data.counts.review}</strong>
          </div>
          <div className="stat">
            <span>{t("eh_task_kpi_urgent")}</span>
            <strong>{data.counts.urgent}</strong>
          </div>
        </div>
      </section>

      <div className="candidate-tabs" role="tablist" style={{ marginBottom: 14 }}>
        {(
          [
            ["all", "eh_task_filter_all"],
            ["open", "eh_task_filter_open"],
            ["overdue", "eh_task_filter_overdue"],
            ["review", "eh_task_filter_review"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? "candidate-tab active" : "candidate-tab"}
            onClick={() => setTab(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <section className="panel" style={{ maxWidth: 860 }}>
        {filtered.length === 0 ? (
          <p className="muted">
            {data.items.length === 0 ? t("eh_empty_tasks") : t("eh_task_empty_filter")}
          </p>
        ) : (
          <div className="list">
            {visible.map((item) => {
              const due = formatDue(item.dueAt, locale);
              const title =
                item.kind === "promotion"
                  ? t("eh_task_promotion")
                  : localized(item.title) || item.title;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="list-item dash-action-link"
                  style={{ opacity: item.overdue ? 1 : undefined }}
                >
                  <div style={{ flex: 1 }}>
                    <div className="muted">
                      {t(KIND_KEYS[item.kind])} · {t(PRIORITY_KEYS[item.priority])}
                      {item.overdue ? ` · ${t("eh_learn_overdue")}` : ""}
                    </div>
                    <strong>{title}</strong>
                    <div className="muted">
                      {t(item.statusKey)}
                      {due ? ` · ${t("learn_field_deadline")} ${due}` : ""}
                    </div>
                    {item.comment ? (
                      <p style={{ margin: "8px 0 0" }}>
                        {t("learn_field_mentor_comment")}: {item.comment}
                      </p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        {filtered.length > shown ? (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: 12 }}
            onClick={() => setShown((count) => count + 8)}
          >
            {t("eh_show_more")}
          </button>
        ) : null}
      </section>
    </AppShell>
  );
}
