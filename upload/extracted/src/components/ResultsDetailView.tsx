"use client";

import Link from "next/link";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  KnowledgeProfileCard,
  parseProfileJson,
} from "@/components/KnowledgeProfileCard";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "@/lib/levels";
import type { ResultsGroup } from "@/lib/results-groups";

export function ResultsDetailView({
  group,
  personId,
  personName,
  meta,
  assessmentTitle,
  competencyName,
  score,
  levelCode,
  completedAt,
  profileJson,
}: {
  group: ResultsGroup;
  personId: number;
  personName: string;
  meta: string;
  assessmentTitle: string;
  competencyName: string;
  score: number;
  levelCode: string;
  completedAt: string;
  profileJson: string;
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const profile = parseProfileJson(profileJson);

  return (
    <AppShell pathname="/results">
      <PageHeader
        title={assessmentTitle}
        subtitle={`${personName} · ${meta}`}
        action={<LevelBadge level={levelCode} />}
      />
      <p style={{ marginBottom: 14 }}>
        <Link
          href={`/results/${group}/${personId}`}
          className="btn btn-ghost"
        >
          ← {t("results_back_tests")}
        </Link>
      </p>

      <section className="panel result-panel">
        <p className="eyebrow">{t("result")}</p>
        <h2>
          {personName}: {score}%
        </h2>
        <p className="muted">
          {competencyName} · {t("level")}: {levelLabel(levelCode)} ·{" "}
          {new Date(completedAt).toLocaleString(dateLocale)}
        </p>
        {profile ? (
          <KnowledgeProfileCard profile={profile} />
        ) : (
          <p className="lead" style={{ marginTop: 16 }}>
            {t("level")}: <strong>{levelLabel(levelCode)}</strong>
          </p>
        )}
      </section>
    </AppShell>
  );
}
