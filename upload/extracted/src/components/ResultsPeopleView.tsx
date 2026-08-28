"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { ResultsGroup } from "@/lib/results-groups";

export type ResultPersonCard = {
  personId: number;
  personName: string;
  meta: string;
  avatarHue: number;
  resultCount: number;
  latestAt: string;
  latestScore: number;
  latestLevel: string;
};

const GROUP_TITLE: Record<ResultsGroup, "results_group_employees" | "results_group_interns" | "results_group_candidates"> = {
  employees: "results_group_employees",
  interns: "results_group_interns",
  candidates: "results_group_candidates",
};

export function ResultsPeopleView({
  group,
  people,
}: {
  group: ResultsGroup;
  people: ResultPersonCard[];
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";

  return (
    <AppShell pathname="/results">
      <PageHeader
        title={t(GROUP_TITLE[group])}
        subtitle={t("results_people_subtitle")}
      />
      <p style={{ marginBottom: 14 }}>
        <Link href="/results" className="btn btn-ghost">
          ← {t("results_back_groups")}
        </Link>
      </p>

      <section className="panel">
        {people.length === 0 ? (
          <p className="muted">{t("results_people_empty")}</p>
        ) : (
          <div className="list">
            {people.map((p) => (
              <Link
                key={p.personId}
                href={`/results/${group}/${p.personId}`}
                className="list-item person-result-link"
              >
                <div className="person">
                  <span
                    className="avatar"
                    style={{ background: `hsl(${p.avatarHue} 42% 38%)` }}
                  >
                    {p.personName
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span>
                    <strong>{p.personName}</strong>
                    <div className="muted">{p.meta}</div>
                    <div className="muted">
                      {p.resultCount} {t("results_tests_count")} ·{" "}
                      {t("results_latest")}: {p.latestScore}% ·{" "}
                      {new Date(p.latestAt).toLocaleDateString(dateLocale)}
                    </div>
                  </span>
                </div>
                <LevelBadge level={p.latestLevel} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
