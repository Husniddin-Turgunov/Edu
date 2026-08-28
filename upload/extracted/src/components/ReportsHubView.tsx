"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";

const SECTIONS: {
  href: string;
  titleKey: MessageKey;
  noteKey: MessageKey;
}[] = [
  {
    href: "/reports/hiring",
    titleKey: "reports_hiring_title",
    noteKey: "reports_hiring_note",
  },
  {
    href: "/reports/testing",
    titleKey: "reports_testing_title",
    noteKey: "reports_testing_note",
  },
  {
    href: "/reports/trial",
    titleKey: "reports_trial_title",
    noteKey: "reports_trial_note",
  },
  {
    href: "/reports/learning",
    titleKey: "reports_learning_title",
    noteKey: "reports_learning_note",
  },
  {
    href: "/reports/mentors",
    titleKey: "reports_mentors_title",
    noteKey: "reports_trial_note",
  },
  {
    href: "/reports/attestations",
    titleKey: "reports_attestations_title",
    noteKey: "reports_learning_note",
  },
  {
    href: "/results",
    titleKey: "reports_results_link_title",
    noteKey: "reports_results_link_note",
  },
];

export function ReportsHubView() {
  const { t } = useI18n();
  return (
    <AppShell pathname="/reports">
      <PageHeader
        title={t("nav_reports")}
        subtitle={t("reports_hub_note")}
      />
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
