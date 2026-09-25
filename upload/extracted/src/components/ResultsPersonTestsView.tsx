"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "@/lib/levels";
import type { ResultsGroup } from "@/lib/results-groups";

export type PersonTestCard = {
  resultId: number;
  assessmentTitle: string;
  competencyName: string;
  score: number;
  levelCode: string;
  completedAt: string;
};

export function ResultsPersonTestsView({
  group,
  personId,
  personName,
  meta,
  tests,
}: {
  group: ResultsGroup;
  personId: number;
  personName: string;
  meta: string;
  tests: PersonTestCard[];
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";

  return (
    <AppShell pathname="/results">
      <PageHeader title={personName} subtitle={meta} />
      <p style={{ marginBottom: 14 }}>
        <Link href={`/results/${group}`} className="btn btn-ghost">
          ← {t("results_back_people")}
        </Link>
      </p>

      <section className="panel">
        <h2>{t("results_tests_title")}</h2>
        {tests.length === 0 ? (
          <p className="muted">{t("results_tests_empty")}</p>
        ) : (
          <div className="list">
            {tests.map((test) => (
              <Link
                key={test.resultId}
                href={`/results/${group}/${personId}/${test.resultId}`}
                className="list-item person-result-link"
              >
                <div>
                  <strong>{test.assessmentTitle}</strong>
                  <div className="muted">
                    {test.competencyName} · {test.score}% ·{" "}
                    {levelLabel(test.levelCode)} ·{" "}
                    {new Date(test.completedAt).toLocaleString(dateLocale)}
                  </div>
                </div>
                <LevelBadge level={test.levelCode} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
