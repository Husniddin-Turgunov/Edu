"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, LevelBadge, PageHeader, type AppShellRole } from "@/components/ui";
import { ParticipantShell } from "@/components/ParticipantShell";
import { useI18n } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";
import { LEVEL_ORDER, levelLabel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";
import type { VerificationTest } from "@/lib/verification-tests";
import type { LessonLevel } from "@/lib/lessons";

type TestRow = VerificationTest & {
  dbId?: number;
  programMonth?: 1 | 2 | 3;
  lessonCompleted?: boolean;
  unlocked?: boolean;
};

type StaffTestsData = {
  person: {
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
  };
  participantKind: "employee" | "intern";
  promotion: {
    fromLevel: string;
    toLevel: string;
    score: number;
    status: "pending" | "approved" | "rejected";
  } | null;
  analysis: {
    summary: string | null;
    gaps: string[];
    weakSections: string[];
    hasTests: boolean;
    pendingAssignment: {
      id: number;
      assessmentTitle: string;
      dueAt: string | null;
    } | null;
  };
  roleFamilyLabel: string;
  recommendations: { test: TestRow; reasons: string[] }[];
  library: TestRow[];
};

type CandidateHomeData = {
  person: {
    name: string;
    roleTitle: string;
    department: string;
    status: string;
    currentLevel: string;
  };
  pending: {
    id: number;
    assessmentTitle: string;
    dueAt: string | null;
  } | null;
  latestDone: {
    id: number;
    assessmentTitle: string;
  } | null;
  participantKind?: "employee" | "intern" | "candidate";
};

function testLevelLabel(level: LessonLevel) {
  if (level === "all") return "All";
  return levelLabel(level);
}

function levelRank(level: string) {
  if (level === "all") return -1;
  if (level === "unassessed") return 0;
  return LEVEL_ORDER.indexOf(level as (typeof LEVEL_ORDER)[number]);
}

export function ParticipantTestsView({
  data,
  themeHue = 220,
  kindKey,
}: {
  data: StaffTestsData | CandidateHomeData;
  themeHue?: number;
  kindKey?: import("@/lib/i18n").MessageKey;
}) {
  const isStaff =
    "library" in data &&
    (data.participantKind === "employee" || data.participantKind === "intern");

  if (!isStaff) {
    return (
      <CandidateTestsBody
        data={data as CandidateHomeData}
        kindKey={kindKey ?? "role_candidate"}
        themeHue={themeHue}
      />
    );
  }

  return (
    <StaffVerificationTestsView
      data={data as StaffTestsData}
      themeHue={themeHue}
    />
  );
}

function StaffVerificationTestsView({
  data,
  themeHue,
}: {
  data: StaffTestsData;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const role: AppShellRole =
    data.participantKind === "intern" ? "intern" : "employee";
  const currentLearningLevel =
    data.person.currentLevel === "unassessed"
      ? "junior"
      : data.person.currentLevel;
  const [monthTab, setMonthTab] = useState<1 | 2 | 3>(1);
  const currentRank = levelRank(currentLearningLevel);

  const displayName = localizeStaffText(data.person.name, locale, "name");
  const displayRole = localizeStaffText(data.person.roleTitle, locale, "role");
  const displayRoleFamily = localizeStaffText(
    data.roleFamilyLabel,
    locale,
    "role",
  );
  const monthTests = useMemo(
    () =>
      data.library.filter(
        (test) =>
          (test.programMonth ?? 1) === monthTab &&
          (currentLearningLevel === "intern" || test.level !== "intern"),
      ),
    [data.library, monthTab, currentLearningLevel],
  );
  const localized = useImportedContent(
    [
      data.analysis.pendingAssignment?.assessmentTitle,
      data.analysis.summary,
      ...data.analysis.gaps,
      ...data.analysis.weakSections,
      ...monthTests.flatMap((test) => [
        test.title,
        test.summary,
        test.lessonTitle,
      ]),
      ...data.recommendations.flatMap(({ test, reasons }) => [
        test.title,
        test.summary,
        test.lessonTitle,
        ...reasons,
      ]),
    ],
    locale,
  );

  return (
    <AppShell pathname="/my/tests" role={role} themeHue={themeHue}>
      <PageHeader
        title={t("nav_my_tests")}
        subtitle={`${displayName} · ${displayRole}`}
      />

      {data.promotion && data.participantKind !== "intern" ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <p className="eyebrow">{t("promo_status_title")}</p>
          <h2>
            {data.promotion.status === "pending"
              ? t("promo_pending")
              : data.promotion.status === "approved"
                ? t("promo_approved")
                : t("promo_rejected")}
          </h2>
          <p className="muted">
            {levelLabel(data.promotion.fromLevel)} →{" "}
            {levelLabel(data.promotion.toLevel)} · {Math.round(data.promotion.score)}%
          </p>
          {data.promotion.status === "pending" ? (
            <p>{t("promo_pending_note")}</p>
          ) : null}
        </article>
      ) : null}

      {data.analysis.pendingAssignment ? (
        <article className="panel" style={{ marginBottom: 16 }}>
          <p className="eyebrow">{t("verify_hr_assignment")}</p>
          <h2>
            {localized(data.analysis.pendingAssignment.assessmentTitle)}
          </h2>
          <Link
            href={`/my/take/${data.analysis.pendingAssignment.id}`}
            className="btn btn-primary"
          >
            {t("portal_start_test")}
          </Link>
        </article>
      ) : null}

      <section className="layout-2" style={{ marginBottom: 16 }}>
        <article className="panel">
          <p className="eyebrow">{t("verify_analysis_title")}</p>
          <h2 style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <LevelBadge level={data.person.currentLevel} />
            <span>{levelLabel(data.person.currentLevel)}</span>
          </h2>
          {!data.analysis.hasTests ? (
            <p className="lead">{t("verify_no_tests")}</p>
          ) : (
            <>
              <p className="lead">
                {localized(data.analysis.summary) || t("verify_analysis_fallback")}
              </p>
              {data.analysis.weakSections.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <h3>{t("learn_weak_sections")}</h3>
                  <ul className="learn-chip-list">
                    {data.analysis.weakSections.map((section) => (
                      <li key={section}>{localized(section)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {data.analysis.gaps.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <h3>{t("learn_gaps")}</h3>
                  <ul>
                    {data.analysis.gaps.slice(0, 5).map((gap) => (
                      <li key={gap}>{localized(gap)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </article>

        <article className="panel">
          <p className="eyebrow">{t("verify_recommended_title")}</p>
          <h2>{t("verify_recommended_heading")}</h2>
          {data.recommendations.length === 0 ? (
            <p className="muted">{t("verify_no_recommendations")}</p>
          ) : (
            <div className="list">
              {data.recommendations.map(({ test, reasons }) => (
                <div key={test.id} className="list-item learn-lesson-card">
                  <div style={{ flex: 1 }}>
                    <strong>{localized(test.title)}</strong>
                    <div className="muted">
                      {testLevelLabel(test.level)} · {test.durationMin}{" "}
                      {t("min")}
                    </div>
                    <p style={{ margin: "8px 0 0" }}>
                      {localized(test.summary)}
                    </p>
                    <div className="muted" style={{ marginTop: 6 }}>
                      {reasons.map(localized).join(" · ")}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <Link
                        href={`/my/tests/check/${
                          test.dbId ?? encodeURIComponent(test.id)
                        }`}
                        className="btn btn-primary"
                      >
                        {t("verify_start")}
                      </Link>
                    </div>
                  </div>
                  <span className="level-badge level-middle">
                    {testLevelLabel(test.level)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="learn-library-head">
          <div>
            <p className="eyebrow">{t("verify_library_title")}</p>
            <h2>
              {t("verify_library_for_role").replace(
                "{role}",
                displayRole || displayRoleFamily,
              )}
            </h2>
            <p className="muted">{t("verify_library_note")}</p>
          </div>
        </div>

        <div className="candidate-tabs" role="tablist" style={{ marginTop: 16 }}>
          {([1, 2, 3] as const).map((month) => (
            <button
              key={month}
              type="button"
              role="tab"
              aria-selected={monthTab === month}
              className={
                monthTab === month ? "candidate-tab active" : "candidate-tab"
              }
              onClick={() => setMonthTab(month)}
            >
              {t("learn_month")} {month}
            </button>
          ))}
        </div>

        <div className="learn-filters learn-filters-single">
          <div className="learn-role-lock">
            <span>{t("learn_role_label")}</span>
            <strong>{displayRole || displayRoleFamily}</strong>
          </div>
        </div>

        {monthTests.length === 0 ? (
          <p className="muted">{t("verify_library_empty")}</p>
        ) : (
          <div className="list" style={{ marginTop: 14 }}>
            {monthTests.map((test) => {
              const levelLocked =
                test.level !== "all" && levelRank(test.level) > currentRank;
              const needLesson = !test.lessonCompleted;
              const locked = levelLocked || needLesson || test.unlocked === false;
              const unlockText = levelLocked
                ? t("verify_unlock_level").replace(
                    "{level}",
                    testLevelLabel(test.level),
                  )
                : t("verify_need_lesson").replace(
                    "{lesson}",
                    localized(test.lessonTitle),
                  );

              return (
                <article
                  key={test.id}
                  className={
                    locked
                      ? "list-item learn-lesson-card learn-lesson-card-locked"
                      : "list-item learn-lesson-card"
                  }
                  tabIndex={locked ? 0 : undefined}
                  aria-label={locked ? unlockText : undefined}
                >
                  <div className="learn-lesson-content" style={{ flex: 1 }}>
                    <strong>{localized(test.title)}</strong>
                    <div className="muted">
                      {testLevelLabel(test.level)} · {test.durationMin}{" "}
                      {t("min")} · {displayRoleFamily}
                    </div>
                    <p style={{ margin: "8px 0 0" }}>
                      {localized(test.summary)}
                    </p>
                    {!locked ? (
                      <div style={{ marginTop: 10 }}>
                        <Link
                          href={`/my/tests/check/${
                            test.dbId ?? encodeURIComponent(test.id)
                          }`}
                          className="btn btn-primary"
                        >
                          {t("verify_start")}
                        </Link>
                      </div>
                    ) : needLesson && !levelLocked ? (
                      <div style={{ marginTop: 10 }}>
                        <Link
                          href={`/my/learning/${test.lessonId}`}
                          className="btn"
                        >
                          {t("verify_go_lesson")}
                        </Link>
                      </div>
                    ) : null}
                  </div>
                  {locked ? (
                    <div className="learn-lock-overlay" aria-hidden="true">
                      <span className="learn-lock-icon">🔒</span>
                      <strong>{t("learn_locked")}</strong>
                      <span className="learn-lock-tooltip">{unlockText}</span>
                    </div>
                  ) : (
                    <span className={`level-badge level-${test.level}`}>
                      {testLevelLabel(test.level)}
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function CandidateTestsBody({
  data,
  kindKey,
  themeHue,
}: {
  data: CandidateHomeData;
  kindKey: import("@/lib/i18n").MessageKey;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const localized = useImportedContent(
    [data.pending?.assessmentTitle, data.latestDone?.assessmentTitle],
    locale,
  );

  return (
    <ParticipantShell
      pathname="/my/tests"
      themeHue={themeHue}
      showProfileNav={false}
    >
      <section className="portal-card">
        <p className="eyebrow">
          {t(kindKey)} · {t("participant_area")}
        </p>
        <h2>{localizeStaffText(data.person.name, locale, "name")}</h2>
        <p className="lead">
          {localizeStaffText(data.person.roleTitle, locale, "role")}
          {data.person.department
            ? ` · ${localizeStaffText(
                data.person.department,
                locale,
                "department",
              )}`
            : ""}
        </p>

        <div className="portal-status-row">
          <span className="muted">{t("col_level")}</span>
          <LevelBadge level={data.person.currentLevel} />
        </div>

        {data.pending ? (
          <article className="panel portal-test-panel">
            <h2>{t("portal_your_test")}</h2>
            <p>
              <strong>{localized(data.pending.assessmentTitle)}</strong>
            </p>
            <Link
              href={`/my/take/${data.pending.id}`}
              className="btn btn-primary"
            >
              {t("portal_start_test")}
            </Link>
          </article>
        ) : data.latestDone ? (
          <article className="panel portal-test-panel">
            <h2>{t("already_done")}</h2>
            <p className="muted">
              {localized(data.latestDone.assessmentTitle)} · {t("completed")}
            </p>
          </article>
        ) : (
          <article className="panel portal-test-panel">
            <p className="muted">{t("portal_no_test_yet")}</p>
          </article>
        )}
      </section>
    </ParticipantShell>
  );
}
