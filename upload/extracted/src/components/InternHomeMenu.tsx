"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";

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

export function InternHomeMenu({
  name,
  showHeader = true,
}: {
  name: string;
  showHeader?: boolean;
}) {
  const { t } = useI18n();

  return (
    <>
      {showHeader ? (
        <PageHeader
          title={t("intern_home_welcome").replace("{name}", name)}
          subtitle={t("intern_home_subtitle")}
          action={
            <Link href="/my/learning" className="btn btn-primary">
              {t("nav_learning_level")}
            </Link>
          }
        />
      ) : null}
      <section className="stack" style={{ gap: 12, marginBottom: 22 }}>
        <h2 className="dash-section-title">{t("intern_company_menu_title")}</h2>
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
    </>
  );
}
