"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import { AppShell, LevelBadge, PageHeader, type AppShellRole } from "@/components/ui";
import {
  KnowledgeProfileCard,
  parseProfileJson,
} from "@/components/KnowledgeProfileCard";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { levelLabel, nextLevel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";
import { useImportedContent } from "@/lib/imported-content-i18n";

const COMP_STATUS_KEYS: Record<string, MessageKey> = {
  not_checked: "emp_comp_not_checked",
  doesnt_know: "emp_comp_doesnt_know",
  partial: "emp_comp_partial",
  junior: "emp_comp_junior",
  junior_plus: "emp_comp_junior_plus",
  middle_minus: "emp_comp_middle_minus",
  middle: "emp_comp_middle",
  needs_recheck: "emp_comp_needs_recheck",
};

type CompetencyRow = {
  name: string;
  category: string;
  status: string;
};

type StatsData = {
  person: {
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    targetLevel?: string;
    startedAt: string | null;
  };
  participantKind: "employee" | "intern";
  overallPercent: number;
  learning: {
    progressPercent: number;
    credited: number;
    total: number;
    overdue: number;
  } | null;
  competencies: {
    mastered: CompetencyRow[];
    improve: CompetencyRow[];
  };
  promotion: {
    id: number;
    fromLevel: string;
    toLevel: string;
    score: number;
    status: "pending" | "approved" | "rejected";
    reviewedAt: string | null;
  } | null;
  level: {
    code: string;
    name: string;
    description: string;
    nextSteps: string;
    minScore: number;
    maxScore: number;
  } | null;
  tests: {
    completedCount: number;
    pendingCount: number;
    avgScore: number | null;
    bestScore: number | null;
    results: {
      id: number;
      score: number;
      levelCode: string;
      completedAt: string;
      assessmentTitle: string;
      competencyName: string;
      profileJson?: string | null;
    }[];
    pending: {
      id: number;
      assessmentTitle: string;
      dueAt: string | null;
    }[];
  };
};

function formatTenure(
  startedAt: string | null,
  locale: string,
  t: (key: import("@/lib/i18n").MessageKey) => string,
) {
  if (!startedAt) return t("mystats_tenure_unknown");
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return t("mystats_tenure_unknown");

  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  let days = now.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    const prev = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += prev;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const dateLocale = locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const unit = (value: number, name: "day" | "month" | "year") =>
    new Intl.NumberFormat(dateLocale, {
      style: "unit",
      unit: name,
      unitDisplay: "long",
    }).format(value);

  if (years <= 0 && months <= 0) {
    return unit(Math.max(days, 0), "day");
  }
  if (years <= 0) {
    return unit(months, "month");
  }
  return months > 0
    ? `${unit(years, "year")} ${unit(months, "month")}`
    : unit(years, "year");
}

function getAnniversary(startedAt: string | null) {
  if (!startedAt) return null;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const years = now.getFullYear() - start.getFullYear();
  if (
    years < 1 ||
    now.getMonth() !== start.getMonth() ||
    now.getDate() !== start.getDate()
  ) {
    return null;
  }
  return { years, year: now.getFullYear() };
}

export function ParticipantStatisticsView({
  data,
  themeHue,
}: {
  data: StatsData;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const isEmployee = data.participantKind === "employee";
  const role: AppShellRole = isEmployee ? "employee" : "intern";
  const nxt = nextLevel(data.person.currentLevel);
  const target = data.person.targetLevel || nxt || "middle";
  const activePromotion =
    data.promotion?.fromLevel === data.person.currentLevel &&
    data.promotion.toLevel === nxt
      ? data.promotion
      : null;
  const progress = isEmployee
    ? data.overallPercent
    : activePromotion?.status === "pending"
      ? 70
      : activePromotion?.status === "rejected"
        ? 0
        : 0;
  const [showCongratulations, setShowCongratulations] = useState(false);
  const [showAnniversary, setShowAnniversary] = useState(false);
  const [masteredShown, setMasteredShown] = useState(6);
  const [improveShown, setImproveShown] = useState(6);
  const anniversary = getAnniversary(data.person.startedAt);
  const anniversaryYear = anniversary?.year;
  const anniversaryYears = anniversary?.years;
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const displayName = localizeStaffText(data.person.name, locale, "name");
  const displayRole = localizeStaffText(data.person.roleTitle, locale, "role");
  const displayDepartment = localizeStaffText(
    data.person.department,
    locale,
    "department",
  );
  const localized = useImportedContent(
    [
      ...data.competencies.mastered.map((row) => row.name),
      ...data.competencies.improve.map((row) => row.name),
      ...data.tests.results.map((row) => row.assessmentTitle),
    ],
    locale,
  );

  useEffect(() => {
    if (
      data.promotion?.status !== "approved" ||
      data.promotion.toLevel !== data.person.currentLevel
    ) {
      return;
    }
    const key = `promotion-congratulations-${data.promotion.id}`;
    if (!window.localStorage.getItem(key)) {
      const timer = window.setTimeout(() => setShowCongratulations(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, [data.person.currentLevel, data.promotion]);

  useEffect(() => {
    if (!anniversaryYear || !anniversaryYears || !data.person.startedAt) return;
    const key = `work-anniversary-${data.person.startedAt}-${anniversaryYear}`;
    if (!window.localStorage.getItem(key)) {
      const timer = window.setTimeout(() => setShowAnniversary(true), 0);
      return () => window.clearTimeout(timer);
    }
  }, [anniversaryYear, anniversaryYears, data.person.startedAt]);

  function closeCongratulations() {
    if (data.promotion) {
      window.localStorage.setItem(
        `promotion-congratulations-${data.promotion.id}`,
        "seen",
      );
    }
    setShowCongratulations(false);
  }

  function closeAnniversary() {
    if (anniversary && data.person.startedAt) {
      window.localStorage.setItem(
        `work-anniversary-${data.person.startedAt}-${anniversary.year}`,
        "seen",
      );
    }
    setShowAnniversary(false);
  }

  return (
    <AppShell pathname="/my/statistics" role={role} themeHue={themeHue}>
      {showCongratulations && data.promotion ? (
        <div className="promotion-celebration-backdrop" role="presentation">
          <section
            className="promotion-celebration"
            role="dialog"
            aria-modal="true"
            aria-labelledby="promotion-congratulations-title"
          >
            <div className="promotion-confetti" aria-hidden="true">
              🎉 ✨ 🎊
            </div>
            <p className="eyebrow">{t("promo_congratulations")}</p>
            <h2 id="promotion-congratulations-title">
              {levelLabel(data.promotion.fromLevel)} →{" "}
              {levelLabel(data.promotion.toLevel)}
            </h2>
            <p className="lead">
              {t("promo_new_level")
                .replace("{level}", levelLabel(data.promotion.toLevel))}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={closeCongratulations}
            >
              {t("promo_continue")}
            </button>
          </section>
        </div>
      ) : null}
      {!showCongratulations && showAnniversary && anniversary ? (
        <div className="promotion-celebration-backdrop" role="presentation">
          <section
            className="promotion-celebration work-anniversary-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="work-anniversary-title"
          >
            <div className="promotion-confetti" aria-hidden="true">
              🎉 💚 ✨
            </div>
            <p className="eyebrow">{t("mystats_anniversary_eyebrow")}</p>
            <h2 id="work-anniversary-title">
              {t("mystats_anniversary_title").replace(
                "{years}",
                String(anniversary.years),
              )}
            </h2>
            <p className="lead">{t("mystats_anniversary_message")}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={closeAnniversary}
            >
              {t("promo_continue")}
            </button>
          </section>
        </div>
      ) : null}
      <PageHeader
        title={isEmployee ? t("nav_my_progress") : t("nav_my_statistics")}
        subtitle={
          isEmployee
            ? t("eh_prog_note")
            : `${displayName} · ${displayRole}${
                displayDepartment ? ` · ${displayDepartment}` : ""
              }`
        }
        action={
          isEmployee ? (
            <Link
              href={
                (data.learning?.overdue ?? 0) > 0 ||
                data.competencies.improve.length > 0
                  ? "/my/learning"
                  : data.tests.pendingCount > 0
                    ? "/my/tests"
                    : "/my/attestation"
              }
              className="btn btn-primary"
            >
              {t("eh_continue")}
            </Link>
          ) : undefined
        }
      />

      {isEmployee ? (
        <section className="stack" style={{ gap: 8, marginBottom: 16 }}>
          <div className="grid-stats dash-kpi-grid dash-kpi-grid-learn">
            <Link href="/my/learning" className="stat dash-stat-link">
              <span>{t("eh_prog_overall")}</span>
              <strong>{data.overallPercent}%</strong>
            </Link>
            <Link href="/my/learning" className="stat dash-stat-link">
              <span>{t("eh_learn_kpi_credited")}</span>
              <strong>
                {data.learning
                  ? `${data.learning.credited}/${data.learning.total}`
                  : "—"}
              </strong>
            </Link>
            <Link
              href="/my/learning"
              className={
                (data.learning?.overdue ?? 0) > 0
                  ? "stat dash-stat-link stat-warn"
                  : "stat dash-stat-link"
              }
            >
              <span>{t("eh_kpi_overdue")}</span>
              <strong>{data.learning?.overdue ?? 0}</strong>
            </Link>
            <Link href="/my/tests" className="stat dash-stat-link">
              <span>{t("mystats_avg_score")}</span>
              <strong>
                {data.tests.avgScore != null ? `${data.tests.avgScore}%` : "—"}
              </strong>
            </Link>
          </div>
        </section>
      ) : (
      <section className="grid-stats" style={{ marginBottom: 18 }}>
        <article className="stat">
          <p className="muted">{t("mystats_tests_done")}</p>
          <strong>{data.tests.completedCount}</strong>
        </article>
        <article className="stat">
          <p className="muted">{t("mystats_avg_score")}</p>
          <strong>
            {data.tests.avgScore != null ? `${data.tests.avgScore}%` : "—"}
          </strong>
        </article>
        <article className="stat">
          <p className="muted">{t("mystats_best_score")}</p>
          <strong>
            {data.tests.bestScore != null ? `${data.tests.bestScore}%` : "—"}
          </strong>
        </article>
        <article className="stat">
          <p className="muted">{t("mystats_pending")}</p>
          <strong>{data.tests.pendingCount}</strong>
        </article>
      </section>
      )}

      <section className="layout-2">
        <article className="panel work-tenure-card">
          <div className="work-tenure-icon" aria-hidden="true">♥</div>
          <p className="eyebrow">{t("mystats_work_title")}</p>
          <h2>{t("mystats_with_us")}</h2>
          <p className="work-tenure-value">
            {formatTenure(data.person.startedAt, locale, t)}
          </p>
          {data.person.startedAt ? (
            <p className="muted">
              {t("mystats_together_since").replace(
                "{date}",
                new Date(data.person.startedAt).toLocaleDateString(dateLocale, {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
              )}
            </p>
          ) : null}
        </article>

        <article className="panel">
          <p className="eyebrow">{t("mystats_rank_title")}</p>
          <h2 style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LevelBadge level={data.person.currentLevel} />
            <span>{levelLabel(data.person.currentLevel)}</span>
          </h2>
          <p className="lead">
            {data.level?.description ?? t("mystats_unassessed_self")}
          </p>

          {nxt ? (
            <div className="level-growth-progress">
              <div className="level-growth-labels">
                <LevelBadge level={data.person.currentLevel} />
                <span className="level-growth-target">{levelLabel(nxt)}</span>
              </div>
              <div
                className="level-growth-arrow"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
                aria-label={t("promo_progress_to").replace(
                  "{level}",
                  levelLabel(nxt),
                )}
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <div className="level-growth-status">
                <strong>
                  {isEmployee
                    ? t("eh_prog_to_level").replace("{level}", levelLabel(target))
                    : t("promo_progress_to").replace("{level}", levelLabel(nxt))}
                </strong>
                <span>
                  {data.participantKind === "intern"
                    ? t("promo_progress_intern_trial")
                    : isEmployee
                      ? (data.learning?.overdue ?? 0) > 0 ||
                        (data.learning &&
                          data.learning.credited < data.learning.total)
                        ? t("eh_prog_status_learn")
                        : data.competencies.improve.length > 0
                          ? t("eh_prog_status_gaps")
                          : t("eh_prog_status_ready")
                      : activePromotion?.status === "pending"
                        ? t("promo_progress_manager")
                        : activePromotion?.status === "rejected"
                          ? t("promo_progress_rejected")
                          : t("promo_progress_attestation")}
                </span>
              </div>
              <div className="level-growth-milestones" aria-hidden="true">
                <span className="done">{t("promo_stage_current")}</span>
                <span className={progress >= 40 ? "done" : ""}>
                  {data.participantKind === "intern"
                    ? t("promo_stage_daily_report")
                    : t("nav_my_learning")}
                </span>
                <span className={progress >= 75 ? "active" : ""}>
                  {data.participantKind === "intern"
                    ? t("promo_stage_mentor")
                    : t("promo_stage_attestation")}
                </span>
              </div>
              {isEmployee ? (
                <p className="muted" style={{ marginTop: 10 }}>
                  {t("eh_prog_mix")}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="next-steps">
            <h3>{t("mystats_how_to_rise")}</h3>
            <p>{data.level?.nextSteps ?? t("mystats_unassessed_self")}</p>
            {nxt ? (
              <p className="muted" style={{ marginTop: 8 }}>
                {t("next_goal")}: <strong>{levelLabel(nxt)}</strong>
              </p>
            ) : data.person.currentLevel === "expert" ? (
              <p className="muted" style={{ marginTop: 8 }}>
                {t("expert_note")}
              </p>
            ) : null}
            {data.tests.pendingCount > 0 ? (
              <p style={{ marginTop: 12 }}>
                <Link href="/my/tests" className="btn btn-primary">
                  {t("mystats_go_tests")}
                </Link>
              </p>
            ) : isEmployee ? (
              <p style={{ marginTop: 12 }}>
                <Link href="/my/learning" className="btn btn-ghost">
                  {t("nav_my_learning")}
                </Link>
              </p>
            ) : null}
          </div>
        </article>
      </section>

      {isEmployee ? (
        <section className="layout-2" style={{ marginTop: 16 }}>
          <article className="panel">
            <p className="eyebrow">{t("eh_prog_mastered")}</p>
            <h2>
              {t("eh_prog_mastered")} · {data.competencies.mastered.length}
            </h2>
            {data.competencies.mastered.length === 0 ? (
              <p className="muted">{t("eh_prog_mastered_empty")}</p>
            ) : (
              <ExpandOnClick
                hint={t("eh_prog_list_hint")}
                action={t("eh_prog_mastered_show")}
              >
                <CompetencyList
                  items={data.competencies.mastered.slice(0, masteredShown)}
                  localized={localized}
                  t={t}
                />
                {data.competencies.mastered.length > masteredShown ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ marginTop: 12 }}
                    onClick={() =>
                      setMasteredShown((count) =>
                        Math.min(data.competencies.mastered.length, count + 8),
                      )
                    }
                  >
                    {t("eh_show_more")}
                  </button>
                ) : null}
              </ExpandOnClick>
            )}
          </article>
          <article className="panel">
            <p className="eyebrow">{t("eh_prog_improve")}</p>
            <h2>
              {t("eh_prog_improve")} · {data.competencies.improve.length}
            </h2>
            {data.competencies.improve.length === 0 ? (
              <p className="muted">{t("eh_prog_improve_empty")}</p>
            ) : (
              <ExpandOnClick
                hint={t("eh_prog_list_hint")}
                action={t("eh_prog_improve_show")}
              >
                <CompetencyList
                  items={data.competencies.improve.slice(0, improveShown)}
                  localized={localized}
                  t={t}
                />
                {data.competencies.improve.length > improveShown ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ marginTop: 12 }}
                    onClick={() =>
                      setImproveShown((count) =>
                        Math.min(data.competencies.improve.length, count + 8),
                      )
                    }
                  >
                    {t("eh_show_more")}
                  </button>
                ) : null}
              </ExpandOnClick>
            )}
          </article>
        </section>
      ) : null}

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>{t("mystats_tests_title")}</h2>
        {data.tests.results.length === 0 ? (
          <p className="muted">{t("no_history")}</p>
        ) : (
          <ExpandOnClick
            hint={t("eh_long_hint")}
            action={`${t("eh_show_more")} (${data.tests.results.length})`}
          >
          <div className="list">
            {data.tests.results.map((r) => {
              const profile = parseProfileJson(r.profileJson);
              return (
                <div
                  key={r.id}
                  className="list-item"
                  style={{ alignItems: "flex-start" }}
                >
                  <div style={{ flex: 1 }}>
                    <strong>{localized(r.assessmentTitle)}</strong>
                    <div className="muted">
                      {r.competencyName} · {r.score}% ·{" "}
                      {new Date(r.completedAt).toLocaleDateString(dateLocale)}
                    </div>
                    {profile ? (
                      <KnowledgeProfileCard profile={profile} compact />
                    ) : (
                      <p className="muted" style={{ marginTop: 8 }}>
                        {t("level")}: {levelLabel(r.levelCode)}
                      </p>
                    )}
                  </div>
                  <LevelBadge level={r.levelCode} />
                </div>
              );
            })}
          </div>
          </ExpandOnClick>
        )}
      </section>
    </AppShell>
  );
}

function CompetencyList({
  items,
  localized,
  t,
}: {
  items: CompetencyRow[];
  localized: (value: string | null | undefined) => string;
  t: (key: MessageKey) => string;
}) {
  return (
    <div className="list learn-title-list" style={{ marginTop: 8 }}>
      {items.map((row) => {
        const statusKey =
          COMP_STATUS_KEYS[row.status] ?? "emp_comp_not_checked";
        return (
          <div key={`${row.name}:${row.status}`} className="list-item learn-title-row">
            <div style={{ flex: 1 }}>
              <strong>{localized(row.name) || row.name}</strong>
              {row.category ? (
                <div className="muted">{row.category}</div>
              ) : null}
            </div>
            <span className={`learn-status learn-status-${row.status}`}>
              {t(statusKey)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
