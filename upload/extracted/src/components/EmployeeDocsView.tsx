"use client";

import Link from "next/link";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import { AppShell, PageHeader } from "@/components/ui";
import type {
  EmployeeDocsContact,
  EmployeeDocsPage,
} from "@/db/employee-home";
import { useI18n, type Locale, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";
import { useImportedContent } from "@/lib/imported-content-i18n";

const COMPANY_DOCS: {
  href: string;
  titleKey: MessageKey;
  noteKey: MessageKey;
}[] = [
  {
    href: "/my/company/rules",
    titleKey: "intern_intro_rules_title",
    noteKey: "intern_menu_rules_note",
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
    href: "/my/company/history",
    titleKey: "intern_intro_history_title",
    noteKey: "intern_menu_history_note",
  },
];

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  { q: "eh_docs_faq_access_q", a: "eh_docs_faq_access_a" },
  { q: "eh_docs_faq_pay_q", a: "eh_docs_faq_pay_a" },
  { q: "eh_docs_faq_it_q", a: "eh_docs_faq_it_a" },
  { q: "eh_docs_faq_learn_q", a: "eh_docs_faq_learn_a" },
  { q: "eh_docs_faq_attest_q", a: "eh_docs_faq_attest_a" },
];

function ContactBlock({
  person,
  locale,
  t,
}: {
  person: EmployeeDocsContact;
  locale: Locale;
  t: (key: MessageKey) => string;
}) {
  const name = localizeStaffText(person.name, locale, "name");
  const role = person.roleTitle
    ? localizeStaffText(person.roleTitle, locale, "role")
    : "";
  return (
    <div className="docs-contact-body">
      <strong>{name}</strong>
      {role ? <p className="muted">{role}</p> : null}
      <dl className="docs-contact-dl">
        {person.phone ? (
          <>
            <dt>{t("eh_mentor_phone")}</dt>
            <dd>
              <a href={`tel:${person.phone}`}>{person.phone}</a>
            </dd>
          </>
        ) : null}
        {person.telegram ? (
          <>
            <dt>{t("eh_mentor_telegram")}</dt>
            <dd>
              <a
                href={`https://t.me/${person.telegram.replace(/^@/, "")}`}
                target="_blank"
                rel="noreferrer"
              >
                {person.telegram.startsWith("@")
                  ? person.telegram
                  : `@${person.telegram}`}
              </a>
            </dd>
          </>
        ) : null}
        {person.email ? (
          <>
            <dt>{t("eh_mentor_email")}</dt>
            <dd>
              <a href={`mailto:${person.email}`}>{person.email}</a>
            </dd>
          </>
        ) : null}
      </dl>
      {!person.phone && !person.telegram && !person.email ? (
        <p className="muted">{t("eh_docs_contact_empty")}</p>
      ) : null}
    </div>
  );
}

export function EmployeeDocsView({
  data,
  themeHue,
}: {
  data: EmployeeDocsPage;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const localized = useImportedContent(
    [
      data.person.roleTitle,
      data.person.department,
      ...(data.role?.duties ?? []),
      ...(data.role?.requirements ?? []),
      ...(data.role?.programs ?? []),
      ...(data.role?.tools ?? []),
      data.role?.description ?? "",
    ],
    locale,
  );
  const displayRole = localizeStaffText(data.person.roleTitle, locale, "role");
  const displayDept = localizeStaffText(
    data.person.department,
    locale,
    "department",
  );
  const tools = [...(data.role?.programs ?? []), ...(data.role?.tools ?? [])];

  return (
    <AppShell pathname="/my/docs" role="employee" themeHue={themeHue}>
      <PageHeader
        title={t("nav_my_docs")}
        subtitle={t("eh_docs_note")}
        action={
          <Link href="/my/company/rules" className="btn btn-primary">
            {t("eh_docs_open_rules")}
          </Link>
        }
      />

      <section className="dash-kpi-grid dash-kpi-grid-docs">
        <div className="stat">
          <span>{t("eh_docs_kpi_company")}</span>
          <strong>{data.counts.companyDocs}</strong>
        </div>
        <div className="stat">
          <span>{t("eh_docs_kpi_job")}</span>
          <strong>{data.counts.jobReady ? t("eh_check_done") : t("eh_check_todo")}</strong>
        </div>
        <div className="stat">
          <span>{t("eh_docs_kpi_tools")}</span>
          <strong>{data.counts.tools}</strong>
        </div>
        <div className="stat">
          <span>{t("eh_docs_kpi_help")}</span>
          <strong>{data.counts.help}</strong>
        </div>
      </section>

      <section className="panel docs-job">
        <p className="eyebrow">{t("eh_docs_job_title")}</p>
        <h2>{displayRole}</h2>
        <p className="muted">{displayDept}</p>
        {data.role?.description ? (
          <p className="lead">{localized(data.role.description)}</p>
        ) : null}
        {data.role && (data.role.duties.length > 0 || data.role.requirements.length > 0) ? (
          <ExpandOnClick
            hint={t("eh_docs_job_hint")}
            action={t("eh_docs_job_show")}
          >
            <div className="docs-job-grid">
              {data.role.duties.length > 0 ? (
                <div>
                  <h3>{t("eh_docs_duties")}</h3>
                  <ul>
                    {data.role.duties.map((line) => (
                      <li key={line}>{localized(line)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.role.requirements.length > 0 ? (
                <div>
                  <h3>{t("eh_docs_requirements")}</h3>
                  <ul>
                    {data.role.requirements.map((line) => (
                      <li key={line}>{localized(line)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </ExpandOnClick>
        ) : (
          <p className="muted">{t("eh_docs_job_empty")}</p>
        )}
      </section>

      <section className="docs-section">
        <h2 className="dash-section-title">{t("eh_docs_company_title")}</h2>
        <div className="learn-audience-grid">
          {COMPANY_DOCS.map((link) => (
            <Link key={link.href} href={link.href} className="learn-audience-btn">
              <strong>{t(link.titleKey)}</strong>
              <span className="muted">{t(link.noteKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel docs-section">
        <h2>{t("eh_docs_templates_title")}</h2>
        <p className="muted">{t("eh_docs_templates_note")}</p>
        {tools.length > 0 ? (
          <div className="docs-chip-row">
            {tools.map((item) => (
              <span key={item} className="learn-meta-chip">
                {localized(item)}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted">{t("eh_docs_templates_empty")}</p>
        )}
        <div className="docs-template-links">
          <Link href="/my/learning" className="btn btn-ghost">
            {t("eh_docs_to_learning")}
          </Link>
          <Link href="/my/attestation" className="btn btn-ghost">
            {t("nav_my_attestations")}
          </Link>
          <Link href="/my/calendar" className="btn btn-ghost">
            {t("nav_my_calendar")}
          </Link>
        </div>
      </section>

      <section className="docs-section">
        <h2 className="dash-section-title">{t("eh_docs_help")}</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          {t("eh_docs_help_note")}
        </p>
        <div className="docs-help-grid">
          <article className="panel">
            <p className="eyebrow">{t("eh_docs_help_hr")}</p>
            <p className="muted">{t("eh_docs_help_hr_note")}</p>
            <p>
              <span className="muted">{t("st_co_phone")}: </span>
              {data.company.phone || t("eh_start_unknown")}
            </p>
            <p>
              <span className="muted">{t("st_co_address")}: </span>
              {data.company.address || t("eh_start_unknown")}
            </p>
            <p className="muted">
              {t("eh_start_hours")}: {data.company.workDays} · {data.company.workStart}
              –{data.company.workEnd}
            </p>
          </article>
          <article className="panel">
            <p className="eyebrow">{t("eh_docs_help_it")}</p>
            <p className="muted">{t("eh_docs_help_it_note")}</p>
            <p>
              <span className="muted">{t("st_co_phone")}: </span>
              {data.company.phone || t("eh_start_unknown")}
            </p>
          </article>
          <article className="panel">
            <p className="eyebrow">{t("eh_docs_help_pay")}</p>
            <p className="muted">{t("eh_docs_help_pay_note")}</p>
            <p>
              <span className="muted">{t("st_co_phone")}: </span>
              {data.company.phone || t("eh_start_unknown")}
            </p>
          </article>
          <article className="panel">
            <p className="eyebrow">{t("eh_start_manager")}</p>
            {data.manager ? (
              <ContactBlock person={data.manager} locale={locale} t={t} />
            ) : (
              <p className="muted">{t("eh_start_unknown")}</p>
            )}
            {data.mentor ? (
              <>
                <p className="eyebrow" style={{ marginTop: 12 }}>
                  {t("eh_start_mentor")}
                </p>
                <ContactBlock person={data.mentor} locale={locale} t={t} />
              </>
            ) : null}
            <Link href="/my/mentor" className="btn btn-ghost" style={{ marginTop: 10 }}>
              {t("nav_my_mentor")}
            </Link>
          </article>
        </div>
      </section>

      <section className="panel docs-section">
        <h2>{t("eh_docs_faq_title")}</h2>
        <p className="muted">{t("eh_docs_faq_note")}</p>
        <ExpandOnClick hint={t("eh_docs_faq_hint")} action={t("eh_docs_faq_show")}>
          <div className="docs-faq">
            {FAQ.map((item) => (
              <article key={item.q} className="docs-faq-item">
                <strong>{t(item.q)}</strong>
                <p className="muted">{t(item.a)}</p>
              </article>
            ))}
          </div>
        </ExpandOnClick>
      </section>
    </AppShell>
  );
}
