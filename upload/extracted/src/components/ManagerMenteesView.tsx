"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  mentorConfirmCompetencyAction,
  mentorRecommendLevelAction,
  mentorReportHrAction,
  updateLessonWorkflowAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { EMPLOYEE_COMPETENCY_STATUSES } from "@/lib/employee-profile";
import { levelLabel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";

type MenteeRow = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  currentLevel: string;
  trialStartsAt: string;
  trialEndsAt: string;
  status: string;
};

type EmployeeRow = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  currentLevel: string;
  targetLevel: string;
  status: string;
  nextCheckAt: string | null;
};

type QueueItem = {
  progressId: number;
  employeeId: number;
  employeeName: string;
  lessonId: number;
  lessonTitle: string;
  lessonSlug: string;
  status: string;
  deadlineAt: string | null;
  submittedAt: string | null;
  answerText: string;
  answerFileUrl: string;
  mentorComment: string;
};

type NotificationRow = {
  id: number;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

type CabinetMetrics = {
  avgReviewHours: number | null;
  commentQuality: number | null;
  returnedCount: number;
  programFinishedPercent: number | null;
  feedbackAvg: number | null;
  rating: number;
};

function daysLeft(endsAt: string) {
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

export function ManagerMenteesView({
  mentees,
  employees = [],
  queue = [],
  overdue = [],
  lessonsToday = [],
  upcomingAttestations = [],
  weakCompetencies = [],
  metrics,
  mentorLoad = [],
  notifications,
  unreadCount,
  themeHue,
}: {
  mentees: MenteeRow[];
  employees?: EmployeeRow[];
  queue?: QueueItem[];
  overdue?: QueueItem[];
  lessonsToday?: {
    employeeId: number;
    employeeName: string;
    lessonId: number;
    title: string;
    status: string;
  }[];
  upcomingAttestations?: {
    id: number;
    employeeId: number;
    employeeName: string;
    title: string;
    scheduledAt: string;
    type: string;
  }[];
  weakCompetencies?: {
    employeeId: number;
    employeeName: string;
    competencyId: number;
    competency: string;
    status: string;
  }[];
  metrics?: CabinetMetrics;
  mentorLoad?: {
    mentorUserId: number;
    mentorName: string;
    menteeCount: number;
    load: "low" | "normal" | "high";
    rating: number | null;
  }[];
  notifications: NotificationRow[];
  unreadCount: number;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<
    "interns" | "employees" | "queue" | "insights"
  >("queue");
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";

  const copy =
    locale === "uz"
      ? {
          interns: "Stajyorlarim",
          employees: "Xodimlarim",
          queue: "Tekshiruv navbati",
          insights: "Reyting va zaifliklar",
          overdue: "Muddati o‘tgan",
          today: "Bugungi darslar",
          attest: "Yaqin attestatsiyalar",
          weak: "Zaif kompetensiyalar",
          accept: "Qabul qilish",
          return: "Qaytarish",
          report: "HR ga xabar",
          recommend: "Keyingi darajani tavsiya qilish",
          emptyQueue: "Tekshirish uchun ish yo‘q",
          rating: "Mentor reytingi",
          speed: "Tekshiruv tezligi",
          comments: "Izoh sifati",
          finished: "Dasturini tugatganlar",
          feedback: "Fikrlar",
          returned: "Qaytarilganlar",
          confirmComp: "Kompetensiyani tasdiqlash",
          confirmNote: "Mentor izohi",
        }
      : locale === "en"
        ? {
            interns: "My interns",
            employees: "My employees",
            queue: "Review queue",
            insights: "Rating & weak skills",
            overdue: "Overdue",
            today: "Lessons today",
            attest: "Upcoming attestations",
            weak: "Weak competencies",
            accept: "Accept",
            return: "Return",
            report: "Report to HR",
            recommend: "Recommend next level",
            emptyQueue: "Nothing to review",
            rating: "Mentor rating",
            speed: "Review speed",
            comments: "Comment quality",
            finished: "Finished program",
            feedback: "Feedback",
            returned: "Returned work",
            confirmComp: "Confirm competency",
            confirmNote: "Mentor comment",
          }
        : {
            interns: "Мои стажёры",
            employees: "Мои сотрудники",
            queue: "Задания на проверку",
            insights: "Рейтинг и слабые места",
            overdue: "Просроченные работы",
            today: "Уроки на сегодня",
            attest: "Ближайшие аттестации",
            weak: "Слабые компетенции",
            accept: "Принять",
            return: "Вернуть",
            report: "Сообщить HR",
            recommend: "Рекомендовать уровень",
            emptyQueue: "Нет работ на проверке",
            rating: "Рейтинг наставника",
            speed: "Скорость проверки",
            comments: "Качество комментариев",
            finished: "Завершили программу",
            feedback: "Отзывы",
            returned: "Повторные ошибки",
            confirmComp: "Подтвердить компетенцию",
            confirmNote: "Комментарий наставника",
          };

  return (
    <AppShell pathname="/observer/mentees" role="manager" themeHue={themeHue}>
      <PageHeader
        title={t("nav_mentees")}
        subtitle={t("mentor_list_subtitle")}
      />

      {metrics ? (
        <section className="layout-2" style={{ marginBottom: 16, maxWidth: 960 }}>
          <article className="panel">
            <p className="eyebrow">{copy.rating}</p>
            <h2>{metrics.rating.toFixed(1)} / 5</h2>
            <p className="muted">
              {copy.speed}:{" "}
              {metrics.avgReviewHours == null
                ? "—"
                : `${metrics.avgReviewHours} h`}{" "}
              · {copy.comments}:{" "}
              {metrics.commentQuality == null
                ? "—"
                : `${metrics.commentQuality}%`}
            </p>
          </article>
          <article className="panel">
            <p className="eyebrow">{copy.finished}</p>
            <h2>
              {metrics.programFinishedPercent == null
                ? "—"
                : `${metrics.programFinishedPercent}%`}
            </h2>
            <p className="muted">
              {copy.returned}: {metrics.returnedCount} · {copy.feedback}:{" "}
              {metrics.feedbackAvg == null ? "—" : metrics.feedbackAvg}
            </p>
          </article>
        </section>
      ) : null}

      {mentorLoad.length > 0 ? (
        <section className="panel mgr-mentor-load" style={{ marginBottom: 16 }}>
          <h2>{t("mgr_mentor_load_title")}</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("mgr_emp_mentor")}</th>
                  <th>{t("mgr_mentor_mentees")}</th>
                  <th>{t("mgr_mentor_load")}</th>
                  <th>{t("mgr_mentor_rating")}</th>
                </tr>
              </thead>
              <tbody>
                {mentorLoad.map((row) => (
                  <tr key={row.mentorUserId}>
                    <td>{row.mentorName}</td>
                    <td>{row.menteeCount}</td>
                    <td>
                      <span className={`mgr-load mgr-load-${row.load}`}>
                        {t(`mgr_load_${row.load}`)}
                      </span>
                    </td>
                    <td>{row.rating ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {notifications.length > 0 ? (
        <section className="panel" style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <h2>
              {t("notifications_title")}
              {unreadCount > 0 ? ` (${unreadCount})` : ""}
            </h2>
            {unreadCount > 0 ? (
              <form action={markAllNotificationsReadAction}>
                <button type="submit" className="btn">
                  {t("notifications_mark_all")}
                </button>
              </form>
            ) : null}
          </div>
          <div className="list">
            {notifications.slice(0, 8).map((item) => (
              <article key={item.id} className="list-item">
                <div style={{ flex: 1 }}>
                  <strong>{item.title}</strong>
                  <div className="muted">
                    {new Date(item.createdAt).toLocaleString(dateLocale)}
                    {!item.readAt ? ` · ${t("notifications_unread")}` : ""}
                  </div>
                  <p style={{ margin: "6px 0 0" }}>{item.body}</p>
                  {item.href ? (
                    <Link href={item.href} className="btn" style={{ marginTop: 8 }}>
                      {t("notifications_open")}
                    </Link>
                  ) : null}
                </div>
                {!item.readAt ? (
                  <form action={markNotificationReadAction}>
                    <input type="hidden" name="notificationId" value={item.id} />
                    <button type="submit" className="btn">
                      {t("notifications_mark_read")}
                    </button>
                  </form>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="emp-directory-toolbar" style={{ marginBottom: 14 }}>
        {(
          [
            ["queue", copy.queue],
            ["interns", copy.interns],
            ["employees", copy.employees],
            ["insights", copy.insights],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "btn btn-primary" : "btn btn-ghost"}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "queue" && queue.length > 0 ? ` (${queue.length})` : ""}
            {id === "interns" ? ` (${mentees.length})` : ""}
            {id === "employees" ? ` (${employees.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "queue" ? (
        <section className="stack" style={{ gap: 14, maxWidth: 960 }}>
          {overdue.length > 0 ? (
            <article className="panel">
              <h2>{copy.overdue}</h2>
              <div className="list" style={{ marginTop: 10 }}>
                {overdue.map((item) => (
                  <div key={`od-${item.progressId}`} className="list-item">
                    <span style={{ flex: 1 }}>
                      <strong>{item.employeeName}</strong>
                      <span className="muted" style={{ display: "block" }}>
                        {item.lessonTitle}
                      </span>
                    </span>
                    <Link
                      href={`/employees/${item.employeeId}`}
                      className="btn btn-ghost"
                    >
                      {item.deadlineAt
                        ? new Date(item.deadlineAt).toLocaleDateString(dateLocale)
                        : "—"}
                    </Link>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {queue.length === 0 ? (
            <article className="panel">
              <p className="lead">{copy.emptyQueue}</p>
            </article>
          ) : (
            queue.map((item) => (
              <article key={item.progressId} className="panel">
                <p className="eyebrow">{item.employeeName}</p>
                <h2>{item.lessonTitle}</h2>
                {item.answerText ? (
                  <p style={{ whiteSpace: "pre-wrap" }}>{item.answerText}</p>
                ) : null}
                {item.answerFileUrl ? (
                  <p>
                    <a href={item.answerFileUrl} target="_blank" rel="noreferrer">
                      {item.answerFileUrl}
                    </a>
                  </p>
                ) : null}
                <form action={updateLessonWorkflowAction} className="stack-form">
                  <input type="hidden" name="employeeId" value={item.employeeId} />
                  <input type="hidden" name="lessonId" value={item.lessonId} />
                  <label>
                    {t("learn_field_mentor_comment")}
                    <textarea
                      name="mentorComment"
                      rows={2}
                      defaultValue={item.mentorComment}
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="submit"
                      name="status"
                      value="accepted"
                      className="btn btn-primary"
                    >
                      {copy.accept}
                    </button>
                    <button
                      type="submit"
                      name="status"
                      value="returned"
                      className="btn btn-ghost"
                    >
                      {copy.return}
                    </button>
                    <Link
                      href={`/employees/${item.employeeId}`}
                      className="btn btn-ghost"
                    >
                      {t("mentor_open_profile")}
                    </Link>
                  </div>
                </form>
              </article>
            ))
          )}

          {lessonsToday.length > 0 ? (
            <article className="panel">
              <h2>{copy.today}</h2>
              <div className="list" style={{ marginTop: 10 }}>
                {lessonsToday.map((item, index) => (
                  <div
                    key={`${item.employeeId}-${item.lessonId}-${index}`}
                    className="list-item"
                  >
                    <span style={{ flex: 1 }}>
                      <strong>{item.employeeName}</strong>
                      <span className="muted" style={{ display: "block" }}>
                        {item.title} · {item.status}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </article>
          ) : null}
        </section>
      ) : null}

      {tab === "interns" ? (
        mentees.length === 0 ? (
          <section className="panel">
            <p className="lead">{t("mentor_list_empty")}</p>
          </section>
        ) : (
          <section className="stack" style={{ gap: 14, maxWidth: 900 }}>
            {mentees.map((row) => {
              const left = daysLeft(row.trialEndsAt);
              return (
                <article key={row.id} className="panel">
                  <p className="eyebrow">
                    {localizeStaffText(row.department, locale, "department")}
                  </p>
                  <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <LevelBadge level={row.currentLevel} />
                    {localizeStaffText(row.name, locale, "name")}
                  </h2>
                  <p className="muted">
                    {localizeStaffText(row.roleTitle, locale, "role")} ·{" "}
                    {levelLabel(row.currentLevel)}
                  </p>
                  <p>
                    {t("mentor_trial_window")
                      .replace(
                        "{start}",
                        new Date(row.trialStartsAt).toLocaleDateString(dateLocale),
                      )
                      .replace(
                        "{end}",
                        new Date(row.trialEndsAt).toLocaleDateString(dateLocale),
                      )}
                    {left != null
                      ? ` · ${t("mentor_days_left").replace("{n}", String(left))}`
                      : ""}
                  </p>
                  <Link
                    href={`/observer/mentees/${row.id}`}
                    className="btn btn-primary"
                  >
                    {t("mentor_open_profile")}
                  </Link>
                </article>
              );
            })}
          </section>
        )
      ) : null}

      {tab === "employees" ? (
        <section className="stack" style={{ gap: 14, maxWidth: 960 }}>
          {employees.length === 0 ? (
            <article className="panel">
              <p className="lead">{t("mentor_list_empty")}</p>
            </article>
          ) : (
            employees.map((row) => (
              <article key={row.id} className="panel">
                <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <LevelBadge level={row.currentLevel} />
                  {localizeStaffText(row.name, locale, "name")}
                </h2>
                <p className="muted">
                  {localizeStaffText(row.roleTitle, locale, "role")} ·{" "}
                  {localizeStaffText(row.department, locale, "department")} ·{" "}
                  {row.currentLevel} → {row.targetLevel}
                </p>
                <div className="layout-2" style={{ gap: 12, marginTop: 12 }}>
                  <form action={mentorRecommendLevelAction} className="stack-form">
                    <input type="hidden" name="employeeId" value={row.id} />
                    <label>
                      {copy.recommend}
                      <select name="toLevel" defaultValue={row.targetLevel || "middle"}>
                        <option value="junior">Junior</option>
                        <option value="middle">Middle</option>
                        <option value="senior">Senior</option>
                        <option value="lead">Lead</option>
                      </select>
                    </label>
                    <label>
                      <textarea name="comment" rows={2} placeholder="…" />
                    </label>
                    <button type="submit" className="btn btn-primary">
                      {copy.recommend}
                    </button>
                  </form>
                  <form action={mentorReportHrAction} className="stack-form">
                    <input type="hidden" name="employeeId" value={row.id} />
                    <label>
                      {copy.report}
                      <textarea name="message" rows={3} required />
                    </label>
                    <button type="submit" className="btn btn-ghost">
                      {copy.report}
                    </button>
                  </form>
                </div>
                <p style={{ marginTop: 10 }}>
                  <Link href={`/employees/${row.id}`} className="btn btn-ghost">
                    {t("mentor_open_profile")}
                  </Link>
                </p>
              </article>
            ))
          )}
        </section>
      ) : null}

      {tab === "insights" ? (
        <section className="stack" style={{ gap: 14, maxWidth: 960 }}>
          <article className="panel">
            <h2>{copy.attest}</h2>
            {upcomingAttestations.length === 0 ? (
              <p className="muted">—</p>
            ) : (
              <div className="list" style={{ marginTop: 10 }}>
                {upcomingAttestations.map((item) => (
                  <Link
                    key={item.id}
                    href={`/employees/${item.employeeId}`}
                    className="list-item learn-role-card"
                  >
                    <span style={{ flex: 1 }}>
                      <strong>{item.employeeName}</strong>
                      <span className="muted" style={{ display: "block" }}>
                        {item.title} · {item.type}
                      </span>
                    </span>
                    <span className="muted">
                      {new Date(item.scheduledAt).toLocaleDateString(dateLocale)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </article>
          <article className="panel">
            <h2>{copy.weak}</h2>
            {weakCompetencies.length === 0 ? (
              <p className="muted">—</p>
            ) : (
              <div className="list" style={{ marginTop: 10 }}>
                {weakCompetencies.map((item, index) => (
                  <div
                    key={`${item.employeeId}-${item.competencyId}-${index}`}
                    className="list-item"
                    style={{ flexDirection: "column", alignItems: "stretch" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ flex: 1 }}>
                        <strong>{item.employeeName}</strong>
                        <span className="muted" style={{ display: "block" }}>
                          {item.competency} · {item.status}
                        </span>
                      </span>
                      <Link
                        href={`/employees/${item.employeeId}#matrix`}
                        className="btn btn-ghost"
                      >
                        {t("mentor_open_profile")}
                      </Link>
                    </div>
                    <form
                      action={mentorConfirmCompetencyAction}
                      className="stack-form"
                      style={{ marginTop: 10 }}
                    >
                      <input type="hidden" name="employeeId" value={item.employeeId} />
                      <input
                        type="hidden"
                        name="competencyId"
                        value={item.competencyId}
                      />
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          gridTemplateColumns: "minmax(160px, 220px) 1fr",
                        }}
                      >
                        <label>
                          {copy.confirmComp}
                          <select name="status" defaultValue="middle">
                            {EMPLOYEE_COMPETENCY_STATUSES.filter((status) =>
                              ["junior", "junior_plus", "middle_minus", "middle"].includes(
                                status,
                              ),
                            ).map((status) => (
                              <option key={status} value={status}>
                                {t(
                                  `emp_comp_${status}` as "emp_comp_middle",
                                )}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          {copy.confirmNote}
                          <textarea
                            name="note"
                            rows={2}
                            placeholder={copy.confirmNote}
                          />
                        </label>
                      </div>
                      <button type="submit" className="btn btn-primary">
                        {copy.confirmComp}
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}
    </AppShell>
  );
}
