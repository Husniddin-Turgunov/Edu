"use client";

import { useState } from "react";
import Link from "next/link";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import { AppShell, PageHeader } from "@/components/ui";
import { submitMentorRatingAction } from "@/db/actions";
import type {
  EmployeeContactCard,
  EmployeeMentorPage,
  MentorWorkItem,
} from "@/db/employee-home";
import { useI18n, type Locale, type MessageKey } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";
import { localizeStaffText } from "@/lib/staff-localization";

const STATUS_KEYS: Record<string, MessageKey> = {
  not_started: "learn_status_not_started",
  studying: "learn_status_studying",
  submitted: "learn_status_submitted",
  returned: "learn_status_returned",
  fixing: "learn_status_fixing",
  accepted: "learn_status_accepted",
  recheck: "learn_status_recheck",
  credited: "learn_status_credited",
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

function telegramHref(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://t.me/${value.replace(/^@/, "")}`;
}

function phoneHref(raw: string) {
  const value = raw.replace(/[^\d+]/g, "");
  return value ? `tel:${value}` : "";
}

function WorkList({
  items,
  empty,
  locale,
  t,
  localized,
}: {
  items: MentorWorkItem[];
  empty: string;
  locale: string;
  t: (key: MessageKey) => string;
  localized: (value: string | null | undefined) => string;
}) {
  const [shown, setShown] = useState(4);
  if (items.length === 0) {
    return <p className="muted">{empty}</p>;
  }
  return (
    <>
      <div className="list">
        {items.slice(0, shown).map((item) => {
          const when = formatWhen(item.at, locale);
          const statusKey = STATUS_KEYS[item.status] ?? "learn_status_not_started";
          return (
            <Link
              key={`${item.lessonId}:${item.status}:${item.at ?? ""}`}
              href={item.href}
              className="list-item dash-action-link"
            >
              <div style={{ flex: 1 }}>
                <strong>{localized(item.title) || item.title}</strong>
                <div className="learn-pill-row" style={{ marginTop: 6 }}>
                  <span className={`learn-status learn-status-${item.status}`}>
                    {t(statusKey)}
                  </span>
                  {when ? <span className="learn-meta-chip">{when}</span> : null}
                </div>
                {item.comment ? (
                  <p className="muted" style={{ margin: "8px 0 0" }}>
                    {t("learn_field_mentor_comment")}: {item.comment}
                  </p>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
      {items.length > shown ? (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ marginTop: 12 }}
          onClick={() => setShown((count) => Math.min(items.length, count + 6))}
        >
          {t("eh_show_more")}
        </button>
      ) : null}
    </>
  );
}

function personInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

function ContactCard({
  person,
  title,
  empty,
  locale,
  t,
}: {
  person: EmployeeContactCard | null;
  title: string;
  empty: string;
  locale: Locale;
  t: (key: MessageKey) => string;
}) {
  const [skillsShown, setSkillsShown] = useState(4);
  if (!person) {
    return (
      <article className="panel mentor-person-card">
        <h2>{title}</h2>
        <p className="muted">{empty}</p>
      </article>
    );
  }
  const name = localizeStaffText(person.name, locale, "name");
  const role = localizeStaffText(person.roleTitle, locale, "role");
  const department = localizeStaffText(person.department, locale, "department");
  const telegram = person.telegram?.trim() || "";
  const phone = person.phone?.trim() || "";
  const email = person.email?.trim() || "";
  const skills = person.competencies;
  const initials = personInitials(name);
  return (
    <article className="panel mentor-person-card">
      <p className="eyebrow">{title}</p>
      <div className="mentor-person-head">
        <div
          className="work-profile-avatar mentor-person-avatar"
          style={{
            background: `linear-gradient(145deg, hsl(${person.avatarHue} 42% 48%), hsl(${(person.avatarHue + 28) % 360} 52% 38%))`,
          }}
        >
          {person.avatarData ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatarData} alt={name} />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <div>
          <h2 style={{ marginTop: 0 }}>{name}</h2>
          <p className="muted" style={{ margin: "6px 0 0" }}>
            {role || t("eh_start_unknown")}
          </p>
          {department ? (
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {department}
            </p>
          ) : null}
        </div>
      </div>
      {(phone || telegram || email) && (
        <dl className="emp-meta mentor-person-contacts">
          {phone ? (
            <div>
              <dt>{t("eh_mentor_phone")}</dt>
              <dd>
                <a href={phoneHref(phone)}>{phone}</a>
              </dd>
            </div>
          ) : null}
          {telegram ? (
            <div>
              <dt>{t("eh_mentor_telegram")}</dt>
              <dd>
                <a href={telegramHref(telegram)} target="_blank" rel="noreferrer">
                  {telegram}
                </a>
              </dd>
            </div>
          ) : null}
          {email ? (
            <div>
              <dt>{t("eh_mentor_email")}</dt>
              <dd>
                <a href={`mailto:${email}`}>{email}</a>
              </dd>
            </div>
          ) : null}
        </dl>
      )}
      {!phone && !telegram && !email ? (
        <p className="muted" style={{ marginTop: 12 }}>
          {t("eh_mentor_no_contact")}
        </p>
      ) : null}
      {skills.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <h3>{t("eh_mentor_skills")}</h3>
          <ul className="learn-chip-list">
            {skills.slice(0, skillsShown).map((skill) => (
              <li key={skill}>{skill}</li>
            ))}
          </ul>
          {skills.length > skillsShown ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8 }}
              onClick={() =>
                setSkillsShown((count) => Math.min(skills.length, count + 8))
              }
            >
              {t("eh_mentor_competencies_more")}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function EmployeeMentorView({
  data,
  themeHue,
}: {
  data: EmployeeMentorPage;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const localized = useImportedContent(
    [
      ...data.waitingReview.map((item) => item.title),
      ...data.returned.map((item) => item.title),
      ...data.feedback.map((item) => item.title),
    ],
    locale,
  );
  const primary =
    data.returned[0] ?? data.waitingReview[0] ?? data.feedback[0] ?? null;

  return (
    <AppShell pathname="/my/mentor" role="employee" themeHue={themeHue}>
      <PageHeader
        title={t("nav_my_mentor")}
        subtitle={t("eh_mentor_note")}
        action={
          primary ? (
            <Link href={primary.href} className="btn btn-primary">
              {data.returned[0]
                ? t("eh_learn_open_lesson")
                : t("eh_continue")}
            </Link>
          ) : (
            <Link href="/my/learning" className="btn btn-primary">
              {t("nav_my_learning")}
            </Link>
          )
        }
      />

      <section className="stack" style={{ gap: 8, marginBottom: 16 }}>
        <div className="grid-stats dash-kpi-grid dash-kpi-grid-employee">
          <div className="stat">
            <span>{t("eh_learn_in_review")}</span>
            <strong>{data.counts.review}</strong>
          </div>
          <div className={data.counts.returned > 0 ? "stat stat-warn" : "stat"}>
            <span>{t("eh_learn_returned")}</span>
            <strong>{data.counts.returned}</strong>
          </div>
          <div className="stat">
            <span>{t("eh_mentor_kpi_comments")}</span>
            <strong>{data.counts.comments}</strong>
          </div>
        </div>
      </section>

      <section className="layout-2" style={{ marginBottom: 16 }}>
        <ContactCard
          person={data.mentor}
          title={t("eh_start_mentor")}
          empty={t("eh_mentor_empty")}
          locale={locale}
          t={t}
        />
        <ContactCard
          person={data.manager}
          title={t("eh_start_manager")}
          empty={t("eh_start_unknown")}
          locale={locale}
          t={t}
        />
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t("eh_mentor_how")}</p>
        <h2>{t("eh_mentor_returned_title")}</h2>
        <p className="muted">{t("eh_mentor_how_note")}</p>
        <div style={{ marginTop: 12 }}>
          <WorkList
            items={data.returned}
            empty={t("eh_mentor_returned_empty")}
            locale={locale}
            t={t}
            localized={localized}
          />
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>{t("eh_mentor_waiting")}</h2>
        <WorkList
          items={data.waitingReview}
          empty={t("eh_mentor_waiting_empty")}
          locale={locale}
          t={t}
          localized={localized}
        />
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <h2>{t("eh_mentor_feedback")}</h2>
        {data.feedback.length === 0 ? (
          <p className="muted">{t("eh_mentor_feedback_empty")}</p>
        ) : (
          <ExpandOnClick
            hint={t("eh_mentor_feedback_hint")}
            action={t("eh_mentor_feedback_show")}
          >
            <WorkList
              items={data.feedback}
              empty={t("eh_mentor_feedback_empty")}
              locale={locale}
              t={t}
              localized={localized}
            />
          </ExpandOnClick>
        )}
      </section>

      <section className="layout-2" style={{ marginBottom: 16 }}>
        <article className="panel">
          <h2>{t("eh_mentor_help")}</h2>
          <p className="muted">{t("eh_mentor_help_note")}</p>
          <p>
            <span className="muted">{t("st_co_phone")}: </span>
            {data.company.phone || t("eh_start_unknown")}
          </p>
          <p>
            <span className="muted">{t("st_co_address")}: </span>
            {data.company.address || t("eh_start_unknown")}
          </p>
        </article>

        <article className="panel">
          <h2>{t("eh_mentor_rate")}</h2>
          {data.rating ? (
            <>
              <p className="muted">{t("eh_mentor_rate_hint")}</p>
              {data.rating.currentScore != null ? (
                <p>
                  {t("eh_mentor_rate_done").replace(
                    "{score}",
                    String(data.rating.currentScore),
                  )}
                </p>
              ) : null}
              <ExpandOnClick
                hint={t("eh_mentor_rate_form_hint")}
                action={t("eh_mentor_rate")}
              >
                <form action={submitMentorRatingAction} className="stack-form">
                  <input
                    type="hidden"
                    name="mentorUserId"
                    value={data.rating.mentorUserId}
                  />
                  <label>
                    {t("eh_mentor_rate_score")}
                    <select
                      name="score"
                      defaultValue={String(data.rating.currentScore ?? 5)}
                    >
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("eh_mentor_rate_comment")}
                    <textarea name="comment" rows={2} />
                  </label>
                  <button type="submit" className="btn btn-primary">
                    {t("eh_mentor_rate_send")}
                  </button>
                </form>
              </ExpandOnClick>
            </>
          ) : (
            <p className="muted">{t("eh_mentor_empty")}</p>
          )}
        </article>
      </section>
    </AppShell>
  );
}
