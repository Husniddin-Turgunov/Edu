"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

type Counts = {
  employees: number;
  interns: number;
  candidates: number;
};

export function ResultsHubView({ counts }: { counts: Counts }) {
  const { t } = useI18n();

  const groups = [
    {
      href: "/results/employees",
      title: t("results_group_employees"),
      note: t("results_group_employees_note"),
      count: counts.employees,
    },
    {
      href: "/results/interns",
      title: t("results_group_interns"),
      note: t("results_group_interns_note"),
      count: counts.interns,
    },
    {
      href: "/results/candidates",
      title: t("results_group_candidates"),
      note: t("results_group_candidates_note"),
      count: counts.candidates,
    },
  ] as const;

  return (
    <AppShell pathname="/results">
      <PageHeader
        title={t("results_title")}
        subtitle={t("results_hub_subtitle")}
      />

      <section className="results-groups">
        {groups.map((g) => (
          <Link key={g.href} href={g.href} className="panel results-group-card">
            <p className="eyebrow">{t("results_section")}</p>
            <h2>{g.title}</h2>
            <p className="muted">{g.note}</p>
            <strong className="results-group-count">
              {g.count} {t("results_people_count")}
            </strong>
          </Link>
        ))}
      </section>
    </AppShell>
  );
}
