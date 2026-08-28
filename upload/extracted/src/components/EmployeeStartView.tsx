"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import type { EmployeeStartData } from "@/db/employee-home";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

const COMPANY_LINKS: {
  href: string;
  titleKey: MessageKey;
  noteKey: MessageKey;
}[] = [
  {
    href: "/my/company/history",
    titleKey: "intern_intro_history_title",
    noteKey: "intern_menu_history_note",
  },
  {
    href: "/my/company/about",
    titleKey: "intern_intro_about_title",
    noteKey: "intern_menu_about_note",
  },
  {
    href: "/my/company/structure",
    titleKey: "intern_intro_structure_title",
    noteKey: "intern_menu_structure_note",
  },
  {
    href: "/my/company/rules",
    titleKey: "intern_intro_rules_title",
    noteKey: "intern_menu_rules_note",
  },
];

function formatHired(iso: string | null, locale: string) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return date.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function EmployeeStartView({
  data,
  entryUrl,
  themeHue,
}: {
  data: EmployeeStartData;
  entryUrl: string;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const hired = formatHired(data.person.hiredAt, locale);
  const checks: {
    key: MessageKey;
    done: boolean;
    href: string;
  }[] = [
    {
      key: "eh_check_onboarding",
      done: data.onboardingCompleted,
      href: data.onboardingCompleted ? "/my/company/about" : "/my/onboarding",
    },
    {
      key: "eh_check_profile",
      done: true,
      href: "/my/profile",
    },
    {
      key: "eh_check_manager",
      done: Boolean(data.managerName),
      href: "/my/profile",
    },
    {
      key: "eh_check_rules",
      done: data.onboardingCompleted,
      href: "/my/company/rules",
    },
    {
      key: "eh_check_learning",
      done: data.hasProgram,
      href: "/my/learning",
    },
  ];

  return (
    <AppShell pathname="/my/start" role="employee" themeHue={themeHue}>
      <PageHeader
        title={t("eh_start_title")}
        subtitle={t("eh_start_note")}
      />

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2>{t("eh_start_day")}</h2>
        <p className="muted">
          {localizeStaffText(data.person.roleTitle, locale, "role")}
          {" · "}
          {localizeStaffText(data.person.department, locale, "department")}
          {hired ? ` · ${t("eh_start_hired").replace("{date}", hired)}` : ""}
        </p>
        <div className="list" style={{ marginTop: 12 }}>
          {checks.map((item) => (
            <Link key={item.key} href={item.href} className="list-item dash-action-link">
              <div>
                <strong>{t(item.key)}</strong>
              </div>
              <span className="muted">
                {item.done ? t("eh_check_done") : t("eh_check_todo")}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="stack" style={{ gap: 12, marginBottom: 18 }}>
        <h2 className="dash-section-title">{t("eh_start_company")}</h2>
        <div className="learn-audience-grid">
          {COMPANY_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="learn-audience-btn"
            >
              <strong>{t(link.titleKey)}</strong>
              <span className="muted">{t(link.noteKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="layout-2" style={{ marginBottom: 22 }}>
        <article className="panel">
          <h2>{t("eh_start_people")}</h2>
          <p>
            <span className="muted">{t("eh_start_manager")}: </span>
            <strong>
              {data.managerName
                ? localizeStaffText(data.managerName, locale, "name")
                : t("eh_start_unknown")}
            </strong>
          </p>
          <p>
            <span className="muted">{t("eh_start_mentor")}: </span>
            <strong>
              {data.mentorName
                ? localizeStaffText(data.mentorName, locale, "name")
                : t("eh_start_unknown")}
            </strong>
          </p>
          <Link href="/my/profile" className="btn btn-ghost">
            {t("nav_profile")}
          </Link>
        </article>

        <article className="panel">
          <h2>{t("eh_start_access")}</h2>
          <p>
            <span className="muted">{t("login_label")}: </span>
            <code>{data.person.login}</code>
          </p>
          <p>
            <span className="muted">{t("eh_start_entry")}: </span>
            <a href={entryUrl}>{entryUrl}</a>
          </p>
          <p>
            <span className="muted">{t("st_co_phone")}: </span>
            {data.company.phone || t("eh_start_unknown")}
          </p>
          <p>
            <span className="muted">{t("st_co_address")}: </span>
            {data.company.address || t("eh_start_unknown")}
          </p>
          <p>
            <span className="muted">{t("eh_start_hours")}: </span>
            {data.company.workDays} · {data.company.workStart}–{data.company.workEnd} ·{" "}
            {data.company.timezone}
          </p>
        </article>
      </section>
    </AppShell>
  );
}
