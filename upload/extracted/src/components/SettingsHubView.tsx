"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";

const SECTIONS: { href: string; titleKey: MessageKey; noteKey: MessageKey }[] = [
  {
    href: "/settings/company",
    titleKey: "st_company_title",
    noteKey: "st_company_note",
  },
  {
    href: "/access",
    titleKey: "st_users_title",
    noteKey: "st_users_note",
  },
  {
    href: "/settings/permissions",
    titleKey: "st_perm_title",
    noteKey: "st_perm_note",
  },
  {
    href: "/settings/tests",
    titleKey: "st_tests_title",
    noteKey: "st_tests_note",
  },
  {
    href: "/settings/learning",
    titleKey: "st_learn_title",
    noteKey: "st_learn_note",
  },
  {
    href: "/settings/notifications",
    titleKey: "st_notif_title",
    noteKey: "st_notif_note",
  },
  {
    href: "/settings/security",
    titleKey: "st_sec_title",
    noteKey: "st_sec_note",
  },
  {
    href: "/design",
    titleKey: "hub_settings_design",
    noteKey: "hub_settings_design_note",
  },
  {
    href: "/settings/audit",
    titleKey: "st_audit_title",
    noteKey: "st_audit_note",
  },
];

export function SettingsHubView() {
  const { t } = useI18n();
  return (
    <AppShell pathname="/settings">
      <PageHeader title={t("nav_settings")} subtitle={t("st_hub_note")} />
      <section className="stack" style={{ gap: 14, maxWidth: 960 }}>
        <div
          className="learn-audience-grid"
          style={{ gridTemplateColumns: "1fr" }}
        >
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="learn-audience-btn"
            >
              <strong>{t(section.titleKey)}</strong>
              <span className="muted">{t(section.noteKey)}</span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
