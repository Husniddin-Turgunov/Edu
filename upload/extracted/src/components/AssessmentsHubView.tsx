"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const KINDS = [
  {
    href: "/assessments/kind/candidate",
    titleKey: "tests_kind_candidate" as const,
    noteKey: "tests_kind_candidate_note" as const,
    driveKey: "tests_kind_candidate_drive" as const,
  },
  {
    href: "/assessments/kind/trial",
    titleKey: "tests_kind_trial" as const,
    noteKey: "tests_kind_trial_note" as const,
    driveKey: "tests_kind_trial_drive" as const,
  },
  {
    href: "/assessments/kind/intern",
    titleKey: "tests_kind_intern" as const,
    noteKey: "tests_kind_intern_note" as const,
    driveKey: "tests_kind_intern_drive" as const,
  },
  {
    href: "/assessments/kind/level",
    titleKey: "tests_kind_level" as const,
    noteKey: "tests_kind_level_note" as const,
    driveKey: "tests_kind_level_drive" as const,
  },
  {
    href: "/learning-tests",
    titleKey: "tests_kind_lessons" as const,
    noteKey: "tests_kind_lessons_note" as const,
    driveKey: "tests_kind_lessons_drive" as const,
  },
];

export function AssessmentsHubView() {
  const { t } = useI18n();

  return (
    <AppShell pathname="/assessments">
      <PageHeader
        title={t("assessments_title")}
        subtitle={t("assessments_hub_note")}
      />

      <section className="stack" style={{ gap: 18, maxWidth: 960 }}>
        <div className="learn-audience-grid" style={{ gridTemplateColumns: "1fr" }}>
          {KINDS.map((kind) => (
            <Link
              key={kind.href}
              href={kind.href}
              className="learn-audience-btn"
            >
              <strong>{t(kind.titleKey)}</strong>
              <span className="muted">{t(kind.noteKey)}</span>
              <span className="muted">{t(kind.driveKey)}</span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
