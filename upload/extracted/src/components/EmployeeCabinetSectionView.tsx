"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import type { EmployeeHomeAction } from "@/db/employee-home";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

export type EmployeeCabinetKind = "tasks" | "mentor" | "notifications";

export type EmployeeCabinetNotice = {
  id: number;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

const META: Record<
  EmployeeCabinetKind,
  { path: string; title: MessageKey; note: MessageKey }
> = {
  tasks: {
    path: "/my/tasks",
    title: "nav_my_tasks",
    note: "eh_tasks_note",
  },
  mentor: {
    path: "/my/mentor",
    title: "nav_my_mentor",
    note: "eh_mentor_note",
  },
  notifications: {
    path: "/my/notifications",
    title: "nav_my_notifications",
    note: "eh_notif_note",
  },
};

function formatWhen(iso: string | null | undefined, locale: string) {
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

export function EmployeeCabinetSectionView({
  kind,
  themeHue,
  mentorName = null,
  managerName = null,
  tasks = [],
  notifications = [],
}: {
  kind: EmployeeCabinetKind;
  themeHue: number;
  mentorName?: string | null;
  managerName?: string | null;
  tasks?: EmployeeHomeAction[];
  notifications?: EmployeeCabinetNotice[];
}) {
  const { t, locale } = useI18n();
  const meta = META[kind];
  const [noticeTab, setNoticeTab] = useState<"unread" | "all">("unread");
  const [noticeCount, setNoticeCount] = useState(10);

  return (
    <AppShell pathname={meta.path} role="employee" themeHue={themeHue}>
      <PageHeader
        title={t(meta.title)}
        subtitle={t(meta.note)}
        action={
          kind === "notifications" && notifications.some((row) => !row.readAt) ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="btn btn-ghost">
                {t("eh_notif_mark_all")}
              </button>
            </form>
          ) : undefined
        }
      />

      {kind === "tasks" ? (
        <section className="panel" style={{ maxWidth: 820 }}>
          {tasks.length === 0 ? (
            <p className="muted">{t("eh_empty_tasks")}</p>
          ) : (
            <div className="list">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={task.href}
                  className="list-item dash-action-link"
                >
                  <div>
                    <strong>{t(task.titleKey)}</strong>
                    {task.detail ? (
                      <div className="muted">{task.detail}</div>
                    ) : null}
                  </div>
                  {task.count != null ? (
                    <strong className="dash-action-count">{task.count}</strong>
                  ) : null}
                </Link>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {kind === "mentor" ? (
        <section className="layout-2">
          <article className="panel">
            <h2>{t("eh_start_mentor")}</h2>
            <p>
              <strong>
                {mentorName
                  ? localizeStaffText(mentorName, locale, "name")
                  : t("eh_start_unknown")}
              </strong>
            </p>
            <Link href="/my/profile" className="btn btn-primary">
              {t("eh_mentor_contact")}
            </Link>
          </article>
          <article className="panel">
            <h2>{t("eh_start_manager")}</h2>
            <p>
              <strong>
                {managerName
                  ? localizeStaffText(managerName, locale, "name")
                  : t("eh_start_unknown")}
              </strong>
            </p>
            <Link href="/my/profile" className="btn btn-ghost">
              {t("nav_profile")}
            </Link>
          </article>
        </section>
      ) : null}

      {kind === "notifications" ? (
        <section className="panel" style={{ maxWidth: 820 }}>
          {notifications.length === 0 ? (
            <p className="muted">{t("eh_notif_empty")}</p>
          ) : (
            <>
              {(() => {
                const unreadCount = notifications.filter((row) => !row.readAt)
                  .length;
                const filtered =
                  noticeTab === "unread"
                    ? notifications.filter((row) => !row.readAt)
                    : notifications;
                const shown = filtered.slice(0, noticeCount);

                const d = (iso: string) => {
                  const dt = new Date(iso);
                  return `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
                };
                const todayKey = d(new Date().toISOString());
                const yesterdayKey = d(
                  new Date(Date.now() - 86400000).toISOString(),
                );

                const groups: Array<{
                  key: "today" | "yesterday" | "older";
                  title: string;
                  items: typeof shown;
                }> = [
                  { key: "today", title: t("eh_notif_group_today"), items: [] },
                  {
                    key: "yesterday",
                    title: t("eh_notif_group_yesterday"),
                    items: [],
                  },
                  { key: "older", title: t("eh_notif_group_older"), items: [] },
                ];

                for (const row of shown) {
                  const key = d(row.createdAt) === todayKey ? "today" : d(row.createdAt) === yesterdayKey ? "yesterday" : "older";
                  const group = groups.find((g) => g.key === key);
                  if (group) group.items.push(row);
                }

                return (
                  <>
                    <div className="notif-top">
                      <div className="candidate-tabs" role="tablist">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={noticeTab === "unread"}
                          className={
                            noticeTab === "unread"
                              ? "candidate-tab active"
                              : "candidate-tab"
                          }
                          onClick={() => {
                            setNoticeTab("unread");
                            setNoticeCount(10);
                          }}
                        >
                          {t("eh_notif_filter_unread")}
                          {unreadCount > 0 ? ` · ${unreadCount}` : ""}
                        </button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={noticeTab === "all"}
                          className={
                            noticeTab === "all"
                              ? "candidate-tab active"
                              : "candidate-tab"
                          }
                          onClick={() => {
                            setNoticeTab("all");
                            setNoticeCount(10);
                          }}
                        >
                          {t("eh_notif_filter_all")}
                        </button>
                      </div>
                      <p className="muted" style={{ margin: 0 }}>
                        {t("eh_notif_unread_label").replace(
                          "{n}",
                          String(unreadCount),
                        )}
                      </p>
                    </div>

                    {groups.map((group) =>
                      group.items.length === 0 ? null : (
                        <section key={group.key} className="notif-group">
                          <h2 className="notif-group-title">{group.title}</h2>
                          <div className="list">
                            {group.items.map((row) => (
                              <div
                                key={row.id}
                                className={
                                  !row.readAt
                                    ? "list-item notif-item notif-unread"
                                    : "list-item notif-item"
                                }
                              >
                                <div style={{ flex: 1 }}>
                                  {row.href ? (
                                    <Link href={row.href}>
                                      <strong>{row.title}</strong>
                                    </Link>
                                  ) : (
                                    <strong>{row.title}</strong>
                                  )}

                                  {row.body ? (
                                    row.body.length > 180 ? (
                                      <ExpandOnClick
                                        hint={t("eh_long_hint")}
                                        action={t("eh_long_show")}
                                      >
                                        <div className="muted" style={{ marginTop: 6 }}>
                                          {row.body}
                                        </div>
                                      </ExpandOnClick>
                                    ) : (
                                      <div className="muted">{row.body}</div>
                                    )
                                  ) : null}

                                  <div className="muted">
                                    {formatWhen(row.createdAt, locale)}
                                  </div>
                                </div>

                                {row.readAt ? (
                                  <span className="muted">{t("eh_notif_read")}</span>
                                ) : (
                                  <form action={markNotificationReadAction}>
                                    <input
                                      type="hidden"
                                      name="notificationId"
                                      value={row.id}
                                    />
                                    <button type="submit" className="btn btn-ghost">
                                      {t("eh_notif_read")}
                                    </button>
                                  </form>
                                )}
                              </div>
                            ))}
                          </div>
                        </section>
                      ),
                    )}

                    {filtered.length > noticeCount ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ marginTop: 12 }}
                        onClick={() =>
                          setNoticeCount((count) =>
                            Math.min(filtered.length, count + 10),
                          )
                        }
                      >
                        {t("eh_show_more")}
                      </button>
                    ) : null}
                  </>
                );
              })()}
            </>
          )}
        </section>
      ) : null}
    </AppShell>
  );
}
