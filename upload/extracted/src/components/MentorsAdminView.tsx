"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import { saveMentorCompetenciesAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";

type MentorRow = {
  id: number;
  name: string;
  roleTitle: string;
  department: string;
  competencies: string[];
  internCount: number;
  employeeCount: number;
  activeReviews: number;
  overdueReviews: number;
  rating: number;
  metrics: {
    avgReviewHours: number | null;
    commentQuality: number | null;
    returnedCount: number;
    feedbackCount: number;
    feedbackAvg: number | null;
  };
  login: string;
  employeeId: number | null;
};

export function MentorsAdminView({ mentors }: { mentors: MentorRow[] }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mentors;
    return mentors.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.roleTitle.toLowerCase().includes(q) ||
        row.competencies.some((item) => item.toLowerCase().includes(q)),
    );
  }, [mentors, query]);

  const copy =
    locale === "uz"
      ? {
          search: "Qidiruv",
          interns: "Stajyorlar",
          employees: "Xodimlar",
          active: "Faol tekshiruvlar",
          overdue: "Muddati o‘tgan",
          rating: "Reyting",
          competencies: "Kompetensiyalar",
          save: "Saqlash",
          openAccess: "Kirish",
          empty: "Hali mentorlar yo‘q. Avval manager akkaunt oching.",
          metrics: "Ko‘rsatkichlar",
          speed: "O‘rtacha tekshiruv",
          comments: "Izoh sifati",
          returned: "Qaytarilganlar",
          feedback: "Fikrlar",
          hours: "soat",
        }
      : locale === "en"
        ? {
            search: "Search",
            interns: "Interns",
            employees: "Employees",
            active: "Active reviews",
            overdue: "Overdue",
            rating: "Rating",
            competencies: "Competencies",
            save: "Save",
            openAccess: "Access",
            empty: "No mentors yet. Create manager accounts first.",
            metrics: "Metrics",
            speed: "Avg review time",
            comments: "Comment quality",
            returned: "Returned work",
            feedback: "Feedback",
            hours: "h",
          }
        : {
            search: "Поиск",
            interns: "Стажёры",
            employees: "Сотрудники",
            active: "Активные проверки",
            overdue: "Просроченные",
            rating: "Рейтинг",
            competencies: "Компетенции",
            save: "Сохранить",
            openAccess: "Доступ",
            empty: "Наставников пока нет. Сначала создайте учётки менеджеров.",
            metrics: "Оценка наставника",
            speed: "Скорость проверки",
            comments: "Качество комментариев",
            returned: "Повторные ошибки",
            feedback: "Отзывы",
            hours: "ч",
          };

  return (
    <AppShell pathname="/mentors">
      <PageHeader
        title={t("nav_mentors")}
        subtitle={t("hub_mentors_note")}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/access" className="btn">
              {t("hub_mentors_access")}
            </Link>
            <Link href="/observer/approvals" className="btn btn-ghost">
              {t("hub_mentors_approvals")}
            </Link>
          </div>
        }
      />

      <section className="panel" style={{ marginBottom: 16, maxWidth: 1100 }}>
        <label>
          {copy.search}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
          />
        </label>
      </section>

      {filtered.length === 0 ? (
        <section className="panel">
          <p className="lead">{copy.empty}</p>
          <Link href="/access" className="btn btn-primary">
            {t("hub_mentors_access")}
          </Link>
        </section>
      ) : (
        <div className="table-wrap" style={{ maxWidth: 1100 }}>
          <table>
            <thead>
              <tr>
                <th>{copy.search === "Search" ? "Name" : copy.search === "Qidiruv" ? "F.I.O." : "Ф.И.О."}</th>
                <th>{copy.interns}</th>
                <th>{copy.employees}</th>
                <th>{copy.active}</th>
                <th>{copy.overdue}</th>
                <th>{copy.rating}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((mentor) => (
                <Fragment key={mentor.id}>
                  <tr>
                    <td>
                      <strong>{mentor.name}</strong>
                      <div className="muted">
                        {mentor.roleTitle}
                        {mentor.department ? ` · ${mentor.department}` : ""}
                      </div>
                      {mentor.competencies.length > 0 ? (
                        <div className="muted" style={{ marginTop: 4 }}>
                          {mentor.competencies.join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    <td>{mentor.internCount}</td>
                    <td>{mentor.employeeCount}</td>
                    <td>{mentor.activeReviews}</td>
                    <td>
                      <span
                        className={
                          mentor.overdueReviews > 0 ? "emp-status warn" : undefined
                        }
                      >
                        {mentor.overdueReviews}
                      </span>
                    </td>
                    <td>
                      <strong>{mentor.rating.toFixed(1)}</strong>
                      <span className="muted"> / 5</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          setOpenId((prev) =>
                            prev === mentor.id ? null : mentor.id,
                          )
                        }
                      >
                        {copy.metrics}
                      </button>
                    </td>
                  </tr>
                  {openId === mentor.id ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="layout-2" style={{ gap: 16 }}>
                          <div>
                            <p className="muted">
                              {copy.speed}:{" "}
                              {mentor.metrics.avgReviewHours == null
                                ? "—"
                                : `${mentor.metrics.avgReviewHours} ${copy.hours}`}
                            </p>
                            <p className="muted">
                              {copy.comments}:{" "}
                              {mentor.metrics.commentQuality == null
                                ? "—"
                                : `${mentor.metrics.commentQuality}%`}
                            </p>
                            <p className="muted">
                              {copy.returned}: {mentor.metrics.returnedCount}
                            </p>
                            <p className="muted">
                              {copy.feedback}:{" "}
                              {mentor.metrics.feedbackAvg == null
                                ? "—"
                                : `${mentor.metrics.feedbackAvg} (${mentor.metrics.feedbackCount})`}
                            </p>
                            {mentor.employeeId ? (
                              <Link
                                href={`/employees/${mentor.employeeId}`}
                                className="btn"
                                style={{ marginTop: 8 }}
                              >
                                {copy.openAccess}
                              </Link>
                            ) : (
                              <Link
                                href="/access"
                                className="btn"
                                style={{ marginTop: 8 }}
                              >
                                {t("hub_mentors_access")}
                              </Link>
                            )}
                          </div>
                          <form
                            action={saveMentorCompetenciesAction}
                            className="stack-form"
                          >
                            <input
                              type="hidden"
                              name="mentorUserId"
                              value={mentor.id}
                            />
                            <label>
                              {copy.competencies}
                              <textarea
                                name="competencies"
                                rows={4}
                                defaultValue={mentor.competencies.join("\n")}
                                placeholder="Bitrix24, Excel, SMM…"
                              />
                            </label>
                            <button type="submit" className="btn btn-primary">
                              {copy.save}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
