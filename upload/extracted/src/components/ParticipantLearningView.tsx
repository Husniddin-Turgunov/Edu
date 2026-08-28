"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import {
  AppShell,
  LevelBadge,
  PageHeader,
  type AppShellRole,
} from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";
import { LEVEL_ORDER, levelLabel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";
import type { Lesson, LessonLevel } from "@/lib/lessons";
import {
  LEARNING_MONTH_THEMES,
  isLessonDayUnlocked,
  lessonDayNumber,
  statusIsDone,
} from "@/lib/learning-program";

const STATUS_KEYS: Record<string, MessageKey> = {
  not_started: "learn_status_not_started",
  studying: "learn_status_studying",
  submitted: "learn_status_submitted",
  returned: "learn_status_returned",
  fixing: "learn_status_fixing",
  accepted: "learn_status_accepted",
  recheck: "learn_status_recheck",
  credited: "learn_status_credited",
};

const PATH_KEYS: Record<string, MessageKey> = {
  full: "learn_path_full",
  check_only: "learn_path_check",
  hard_case: "learn_path_hard",
  skip: "learn_path_skip",
};

type LessonRow = Lesson & { dbId?: number; completed?: boolean };

type ProgramItem = {
  lessonId: number;
  slug: string;
  title: string;
  summary: string;
  month: 1 | 2 | 3;
  pathMode: string;
  status: string;
  durationMin: number;
  blockedByOverdue?: boolean;
  deadlineAt?: string | null;
};

type LearningData = {
  person: {
    name: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    targetLevel?: string;
  };
  participantKind: "employee" | "intern";
  analysis: {
    summary: string | null;
    gaps: string[];
    weakSections: string[];
    latestTestTitle: string | null;
    latestScore: number | null;
    hasTests: boolean;
  };
  roleFamilies: string[];
  roleFamilyLabel: string;
  recommendations: { lesson: LessonRow; reasons: string[] }[];
  library: LessonRow[];
  program: {
    progressPercent: number;
    counts: {
      total: number;
      credited: number;
      submitted: number;
      returned: number;
      overdue?: number;
    };
    byMonth: { 1: ProgramItem[]; 2: ProgramItem[]; 3: ProgramItem[] };
  } | null;
};

function lessonLevelLabel(level: LessonLevel) {
  if (level === "all") return "All";
  return levelLabel(level);
}

function levelRank(level: string) {
  if (level === "all") return -1;
  if (level === "unassessed") return 0;
  return LEVEL_ORDER.indexOf(level as (typeof LEVEL_ORDER)[number]);
}

function isOverdue(item: ProgramItem) {
  if (!item.deadlineAt || item.pathMode === "skip" || statusIsDone(item.status)) {
    return false;
  }
  return new Date(item.deadlineAt).getTime() < Date.now();
}

function isDueSoon(item: ProgramItem) {
  if (!item.deadlineAt || isOverdue(item) || statusIsDone(item.status)) {
    return false;
  }
  const left = new Date(item.deadlineAt).getTime() - Date.now();
  return left > 0 && left <= 3 * 24 * 60 * 60 * 1000;
}

function formatDeadline(iso: string | null | undefined, locale: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return date.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "short",
  });
}

function activeProgramMonth(program: LearningData["program"]): 1 | 2 | 3 {
  if (!program) return 1;
  for (const month of [1, 2, 3] as const) {
    const open = program.byMonth[month].some(
      (item) => item.pathMode !== "skip" && !statusIsDone(item.status),
    );
    if (open) return month;
  }
  return 1;
}

function allProgramItems(program: NonNullable<LearningData["program"]>) {
  return [
    ...program.byMonth[1],
    ...program.byMonth[2],
    ...program.byMonth[3],
  ];
}

function findResumeIndex(items: ProgramItem[]) {
  const overdue = items.findIndex(
    (item) => isOverdue(item) && !item.blockedByOverdue,
  );
  if (overdue >= 0) return overdue;
  const active = items.findIndex((item) =>
    ["studying", "submitted", "returned", "fixing", "recheck"].includes(
      item.status,
    ),
  );
  if (active >= 0) return active;
  const next = items.findIndex(
    (item) => !statusIsDone(item.status) && item.pathMode !== "skip",
  );
  if (next >= 0) return next;
  return Math.max(0, items.length - 1);
}

function findResumeItem(items: ProgramItem[]) {
  const open = items.filter(
    (item) => item.pathMode !== "skip" && !item.blockedByOverdue,
  );
  return (
    open.find((item) => isOverdue(item)) ||
    open.find((item) =>
      ["studying", "submitted", "returned", "fixing", "recheck"].includes(
        item.status,
      ),
    ) ||
    open.find((item) => !statusIsDone(item.status)) ||
    null
  );
}

function monthStats(items: ProgramItem[]) {
  const total = items.length;
  const done = items.filter(
    (item) => statusIsDone(item.status) || item.pathMode === "skip",
  ).length;
  return {
    total,
    done,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

/** Current lesson first, then the rest of the month, then already finished ones. */
function buildRevealOrder(items: ProgramItem[]) {
  if (items.length === 0) return [] as ProgramItem[];
  const resume = findResumeIndex(items);
  return [...items.slice(resume), ...items.slice(0, resume)];
}

function statusClass(status: string, overdue?: boolean) {
  if (overdue) return "learn-status learn-status-overdue";
  return `learn-status learn-status-${status}`;
}

export function ParticipantLearningView({
  data,
  themeHue,
}: {
  data: LearningData;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const isEmployee = data.participantKind === "employee";
  const role: AppShellRole = isEmployee ? "employee" : "intern";
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [monthTab, setMonthTab] = useState<1 | 2 | 3>(() =>
    activeProgramMonth(data.program),
  );
  const [monthOpened, setMonthOpened] = useState(isEmployee);
  const [revealedCount, setRevealedCount] = useState(1);
  const [libraryOpened, setLibraryOpened] = useState(false);
  const [libraryCount, setLibraryCount] = useState(8);
  const currentLearningLevel =
    data.person.currentLevel === "unassessed"
      ? "junior"
      : data.person.currentLevel;
  const currentRank = levelRank(currentLearningLevel);
  const visibleLevels = LEVEL_ORDER.filter((code) => {
    if (code === "intern" && currentLearningLevel !== "intern") return false;
    return levelRank(code) <= currentRank;
  });

  const monthItems = data.program?.byMonth[monthTab] ?? [];
  const revealOrder = useMemo(() => {
    if (!monthOpened || !data.program) return [] as ProgramItem[];
    return buildRevealOrder(data.program.byMonth[monthTab]);
  }, [monthOpened, monthTab, data.program]);
  const globalResume = data.program
    ? findResumeItem(allProgramItems(data.program))
    : null;
  const resumeLesson =
    monthItems.length > 0
      ? monthItems[findResumeIndex(monthItems)] ?? null
      : null;
  const visibleMonthItems = revealOrder.slice(0, revealedCount);

  function openMonth(month: 1 | 2 | 3) {
    setMonthTab(month);
    setMonthOpened(true);
    setRevealedCount(1);
  }

  const filteredLibrary = useMemo(() => {
    const leveled = data.library.filter((lesson) => {
      if (currentLearningLevel !== "intern" && lesson.level === "intern") {
        return false;
      }
      const levelOk =
        lesson.level === "all" || levelRank(lesson.level) <= currentRank;
      if (!levelOk) return false;
      return (
        levelFilter === "all" ||
        lesson.level === "all" ||
        lesson.level === levelFilter
      );
    });

    const sorted = [...leveled].sort((a, b) => {
      const dayDiff = lessonDayNumber(a) - lessonDayNumber(b);
      if (dayDiff !== 0) return dayDiff;
      return a.title.localeCompare(b.title, "ru");
    });

    return sorted.filter((lesson) => {
      const day = lessonDayNumber(lesson);
      if (day <= 0) return true;
      if (lesson.completed) return true;
      return isLessonDayUnlocked(lesson, sorted);
    });
  }, [data.library, levelFilter, currentRank, currentLearningLevel]);

  const libraryVisible = libraryOpened ? filteredLibrary : [];
  const recommended = data.recommendations.filter(
    ({ lesson }) =>
      lesson.completed || isLessonDayUnlocked(lesson, data.library),
  );

  const displayName = localizeStaffText(data.person.name, locale, "name");
  const displayRole = localizeStaffText(data.person.roleTitle, locale, "role");
  const displayRoleFamily = localizeStaffText(
    data.roleFamilyLabel,
    locale,
    "role",
  );
  const localized = useImportedContent(
    [
      data.analysis.latestTestTitle,
      data.analysis.summary,
      ...data.analysis.gaps,
      ...data.analysis.weakSections,
      ...data.recommendations.map(({ lesson }) => lesson.title),
      ...visibleMonthItems.flatMap((item) => [item.title, item.summary]),
      ...libraryVisible.slice(0, libraryCount).map((lesson) => lesson.title),
      globalResume?.title,
      globalResume?.summary,
      resumeLesson?.title,
      resumeLesson?.summary,
    ],
    locale,
  );

  function lessonHref(lesson: LessonRow) {
    const key = lesson.dbId != null ? String(lesson.dbId) : lesson.id;
    return `/my/learning/${encodeURIComponent(key)}`;
  }

  function openLesson(lesson: LessonRow) {
    if (!lesson.completed && !isLessonDayUnlocked(lesson, filteredLibrary)) {
      return;
    }
    router.push(lessonHref(lesson));
  }

  const continueHref = globalResume
    ? `/my/learning/${globalResume.lessonId}`
    : "/my/tests";

  return (
    <AppShell pathname="/my/learning" role={role} themeHue={themeHue}>
      <PageHeader
        title={isEmployee ? t("eh_learn_title") : t("nav_learning_level")}
        subtitle={`${displayName} · ${displayRole}`}
        action={
          isEmployee ? (
            <Link href={continueHref} className="btn btn-primary">
              {globalResume ? t("eh_continue") : t("nav_my_tests")}
            </Link>
          ) : undefined
        }
      />

      {isEmployee && data.program ? (
        <EmployeeLearningBody
          data={data}
          t={t}
          locale={locale}
          localized={localized}
          monthTab={monthTab}
          monthOpened={monthOpened}
          monthItems={monthItems}
          visibleMonthItems={visibleMonthItems}
          revealOrder={revealOrder}
          revealedCount={revealedCount}
          globalResume={globalResume}
          resumeLesson={resumeLesson}
          recommended={recommended}
          openMonth={openMonth}
          onShowMore={() =>
            setRevealedCount((count) =>
              Math.min(revealOrder.length, count + 8),
            )
          }
        />
      ) : (
        <InternLearningIntro
          data={data}
          t={t}
          localized={localized}
          recommended={recommended}
          openLesson={openLesson}
        />
      )}

      <section className="panel">
        <div className="learn-library-head">
          <div>
            <p className="eyebrow">{t("learn_library_title")}</p>
            <h2>
              {t("learn_library_for_role").replace(
                "{role}",
                displayRole || displayRoleFamily,
              )}
            </h2>
            <p className="muted">{t("learn_library_note")}</p>
          </div>
        </div>

        {!libraryOpened ? (
          <div className="learn-month-closed" style={{ marginTop: 14 }}>
            <p className="muted">{t("learn_library_closed_hint")}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setLibraryOpened(true);
                setLibraryCount(8);
              }}
            >
              {t("learn_library_show")}
            </button>
          </div>
        ) : (
          <>
            <div className="learn-filters learn-filters-single">
              <label>
                {t("learn_filter_level")}
                <select
                  value={levelFilter}
                  onChange={(event) => setLevelFilter(event.target.value)}
                >
                  <option value="all">{t("learn_filter_all")}</option>
                  {visibleLevels.map((code) => (
                    <option key={code} value={code}>
                      {levelLabel(code)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="learn-role-lock">
                <span>{t("learn_role_label")}</span>
                <strong>{displayRole || displayRoleFamily}</strong>
              </div>
            </div>

            {filteredLibrary.length === 0 ? (
              <p className="muted">{t("learn_library_empty")}</p>
            ) : (
              <div className="list learn-title-list" style={{ marginTop: 14 }}>
                {filteredLibrary.slice(0, libraryCount).map((lesson) => {
                  const levelLocked =
                    lesson.level !== "all" &&
                    levelRank(lesson.level) > currentRank;
                  const dayLocked =
                    !lesson.completed &&
                    !isLessonDayUnlocked(lesson, data.library);
                  const locked = levelLocked || dayLocked;
                  const unlockText = levelLocked
                    ? t("learn_unlock_level").replace(
                        "{level}",
                        lessonLevelLabel(lesson.level),
                      )
                    : t("learn_unlock_day");

                  if (locked) {
                    return (
                      <div
                        key={lesson.id}
                        className="list-item learn-title-row learn-title-row-locked"
                        aria-label={unlockText}
                      >
                        <strong>{localized(lesson.title)}</strong>
                        <span className="muted">🔒</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      className="list-item learn-title-row"
                      onClick={() => openLesson(lesson)}
                    >
                      <strong>{localized(lesson.title)}</strong>
                      {lesson.completed ? (
                        <span className="learn-status learn-status-credited">
                          {t("learn_completed_badge")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
            {filteredLibrary.length > libraryCount ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() =>
                  setLibraryCount((count) =>
                    Math.min(filteredLibrary.length, count + 8),
                  )
                }
              >
                {t("eh_show_more")}
              </button>
            ) : null}
          </>
        )}
      </section>
    </AppShell>
  );
}

function InternLearningIntro({
  data,
  t,
  localized,
  recommended,
  openLesson,
}: {
  data: LearningData;
  t: (key: MessageKey) => string;
  localized: (value: string | null | undefined) => string;
  recommended: { lesson: LessonRow; reasons: string[] }[];
  openLesson: (lesson: LessonRow) => void;
}) {
  return (
    <section className="layout-2" style={{ marginBottom: 16 }}>
      <article className="panel">
        <p className="eyebrow">{t("learn_analysis_title")}</p>
        <h2 style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <LevelBadge level={data.person.currentLevel} />
          <span>{levelLabel(data.person.currentLevel)}</span>
        </h2>
        <AnalysisBody data={data} t={t} localized={localized} />
      </article>

      <article className="panel">
        <p className="eyebrow">{t("learn_recommended_title")}</p>
        <h2>{t("learn_recommended_heading")}</h2>
        {recommended.length === 0 ? (
          <p className="muted">{t("learn_no_recommendations")}</p>
        ) : (
          <div className="list learn-title-list">
            {recommended.map(({ lesson }) => (
              <button
                key={lesson.id}
                type="button"
                className="list-item learn-title-row"
                onClick={() => openLesson(lesson)}
              >
                <strong>{localized(lesson.title)}</strong>
              </button>
            ))}
          </div>
        )}
      </article>
    </section>
  );
}

function AnalysisBody({
  data,
  t,
  localized,
}: {
  data: LearningData;
  t: (key: MessageKey) => string;
  localized: (value: string | null | undefined) => string;
}) {
  if (!data.analysis.hasTests) {
    return <p className="lead">{t("learn_no_tests")}</p>;
  }
  return (
    <>
      <p className="lead">
        {localized(data.analysis.summary) || t("learn_analysis_fallback")}
      </p>
      {data.analysis.latestTestTitle ? (
        <p className="muted">
          {t("learn_latest_test")}:{" "}
          <strong>{localized(data.analysis.latestTestTitle)}</strong>
          {data.analysis.latestScore != null
            ? ` · ${data.analysis.latestScore}%`
            : ""}
        </p>
      ) : null}
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
  );
}

function EmployeeLearningBody({
  data,
  t,
  locale,
  localized,
  monthTab,
  monthOpened,
  monthItems,
  visibleMonthItems,
  revealOrder,
  revealedCount,
  globalResume,
  resumeLesson,
  recommended,
  openMonth,
  onShowMore,
}: {
  data: LearningData;
  t: (key: MessageKey) => string;
  locale: string;
  localized: (value: string | null | undefined) => string;
  monthTab: 1 | 2 | 3;
  monthOpened: boolean;
  monthItems: ProgramItem[];
  visibleMonthItems: ProgramItem[];
  revealOrder: ProgramItem[];
  revealedCount: number;
  globalResume: ProgramItem | null;
  resumeLesson: ProgramItem | null;
  recommended: { lesson: LessonRow; reasons: string[] }[];
  openMonth: (month: 1 | 2 | 3) => void;
  onShowMore: () => void;
}) {
  const program = data.program!;
  const overdueCount = program.counts.overdue ?? 0;
  const currentMonth = activeProgramMonth(program);

  return (
    <>
      <section className="stack" style={{ gap: 8, marginBottom: 16 }}>
        <div className="grid-stats dash-kpi-grid dash-kpi-grid-learn">
          <div className="stat">
            <span>{t("eh_kpi_progress")}</span>
            <strong>{program.progressPercent}%</strong>
          </div>
          <div className="stat">
            <span>{t("eh_learn_kpi_credited")}</span>
            <strong>
              {program.counts.credited}/{program.counts.total}
            </strong>
          </div>
          <div className={overdueCount > 0 ? "stat stat-warn" : "stat"}>
            <span>{t("eh_kpi_overdue")}</span>
            <strong>{overdueCount}</strong>
          </div>
          <div className="stat">
            <span>{t("eh_learn_in_review")}</span>
            <strong>{program.counts.submitted}</strong>
          </div>
        </div>
      </section>

      <article className="panel learn-resume" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t("eh_learn_resume_title")}</p>
        {globalResume ? (
          <>
            <h2 style={{ marginBottom: 8 }}>{localized(globalResume.title)}</h2>
            <div className="learn-pill-row">
              <span
                className={statusClass(
                  globalResume.status,
                  isOverdue(globalResume),
                )}
              >
                {isOverdue(globalResume)
                  ? t("eh_learn_overdue")
                  : t(STATUS_KEYS[globalResume.status] ?? "learn_status_not_started")}
              </span>
              <span className="learn-meta-chip">
                {t("learn_month")} {globalResume.month}
              </span>
              <span className="learn-meta-chip">
                {globalResume.durationMin} {t("min")}
              </span>
              <span className="learn-meta-chip">
                {t(PATH_KEYS[globalResume.pathMode] ?? "learn_path_full")}
              </span>
              {globalResume.deadlineAt ? (
                <span
                  className={
                    isOverdue(globalResume)
                      ? "learn-status learn-status-overdue"
                      : isDueSoon(globalResume)
                        ? "learn-status learn-status-soon"
                        : "learn-meta-chip"
                  }
                >
                  {isDueSoon(globalResume) ? `${t("eh_learn_due_soon")} · ` : ""}
                  {t("learn_field_deadline")}{" "}
                  {formatDeadline(globalResume.deadlineAt, locale)}
                </span>
              ) : null}
            </div>
            {globalResume.summary ? (
              <p className="muted" style={{ marginTop: 10 }}>
                {localized(globalResume.summary)}
              </p>
            ) : null}
            <Link
              href={`/my/learning/${globalResume.lessonId}`}
              className="btn btn-primary"
              style={{ marginTop: 12 }}
            >
              {t("eh_learn_open_lesson")}
            </Link>
          </>
        ) : (
          <p className="muted">{t("eh_learn_resume_empty")}</p>
        )}
      </article>

      <section className="panel" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t("learn_program_title")}</p>
        <h2>
          {t("learn_program_heading").replace(
            "{level}",
            levelLabel(data.person.targetLevel || "middle"),
          )}
        </h2>
        <p className="muted">{t("eh_learn_note")}</p>
        <div className="emp-progress learn-progress-wide" style={{ marginTop: 14 }}>
          <div className="emp-progress-track">
            <div
              className="emp-progress-bar"
              style={{ width: `${program.progressPercent}%` }}
            />
          </div>
          <span>
            {program.progressPercent}% · {program.counts.credited}/
            {program.counts.total}
          </span>
        </div>

        <div className="learn-month-steps" role="tablist">
          {([1, 2, 3] as const).map((month) => {
            const stats = monthStats(program.byMonth[month]);
            const selected = monthTab === month && monthOpened;
            const current = month === currentMonth;
            const complete = stats.total > 0 && stats.done === stats.total;
            return (
              <button
                key={month}
                type="button"
                role="tab"
                aria-selected={selected}
                className={[
                  "learn-month-step",
                  selected ? "is-selected" : "",
                  current ? "is-current" : "",
                  complete ? "is-complete" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => openMonth(month)}
              >
                <span className="eyebrow">
                  {t("learn_month")} {month}
                  {complete
                    ? ` · ${t("eh_learn_month_complete")}`
                    : current
                      ? ` · ${t("eh_learn_month_current")}`
                      : ""}
                </span>
                <strong>
                  {t(LEARNING_MONTH_THEMES[month].titleKey as MessageKey)}
                </strong>
                <div className="emp-progress-track" style={{ marginTop: 8 }}>
                  <div
                    className="emp-progress-bar"
                    style={{ width: `${stats.percent}%` }}
                  />
                </div>
                <span className="muted">
                  {t("eh_learn_month_of")
                    .replace("{done}", String(stats.done))
                    .replace("{total}", String(stats.total))}
                </span>
              </button>
            );
          })}
        </div>

        <article className="learn-month-card">
          <h3>{t(LEARNING_MONTH_THEMES[monthTab].titleKey as MessageKey)}</h3>
          {monthItems.length === 0 ? (
            <p className="muted">{t("learn_month_empty")}</p>
          ) : !monthOpened ? (
            <div className="learn-month-closed" style={{ marginTop: 14 }}>
              <p className="muted">{t("learn_month_closed_hint")}</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openMonth(monthTab)}
              >
                {resumeLesson
                  ? t("learn_month_continue").replace(
                      "{title}",
                      localized(resumeLesson.title),
                    )
                  : t("learn_month_show")}
              </button>
            </div>
          ) : (
            <div className="list" style={{ marginTop: 12 }}>
              {visibleMonthItems.map((item, index) => {
                const statusKey =
                  STATUS_KEYS[item.status] ?? "learn_status_not_started";
                const isCurrent =
                  resumeLesson?.lessonId === item.lessonId && index === 0;
                const overdue = isOverdue(item);
                const soon = isDueSoon(item);
                const deadlineLabel = formatDeadline(item.deadlineAt, locale);
                const body = (
                  <div style={{ flex: 1 }}>
                    {isCurrent ? (
                      <p className="eyebrow" style={{ marginBottom: 6 }}>
                        {t("learn_month_resume_here")}
                      </p>
                    ) : null}
                    <strong>{localized(item.title)}</strong>
                    <div className="learn-pill-row" style={{ marginTop: 8 }}>
                      <span className={statusClass(item.status, overdue)}>
                        {overdue ? t("eh_learn_overdue") : t(statusKey)}
                      </span>
                      <span className="learn-meta-chip">
                        {item.durationMin} {t("min")}
                      </span>
                      <span className="learn-meta-chip">
                        {t(PATH_KEYS[item.pathMode] ?? "learn_path_full")}
                      </span>
                      {deadlineLabel ? (
                        <span
                          className={
                            overdue
                              ? "learn-status learn-status-overdue"
                              : soon
                                ? "learn-status learn-status-soon"
                                : "learn-meta-chip"
                          }
                        >
                          {soon ? `${t("eh_learn_due_soon")} · ` : ""}
                          {t("learn_field_deadline")} {deadlineLabel}
                        </span>
                      ) : null}
                    </div>
                    {item.blockedByOverdue ? (
                      <p style={{ margin: "8px 0 0" }}>{t("st_lesson_blocked")}</p>
                    ) : isCurrent && item.summary ? (
                      <p className="muted" style={{ margin: "8px 0 0" }}>
                        {localized(item.summary)}
                      </p>
                    ) : null}
                  </div>
                );
                if (item.blockedByOverdue) {
                  return (
                    <div
                      key={`${item.lessonId}:${index}`}
                      className="list-item learn-lesson-card learn-lesson-reveal"
                      style={{ opacity: 0.55 }}
                    >
                      {body}
                    </div>
                  );
                }
                return (
                  <Link
                    key={`${item.lessonId}:${index}`}
                    href={`/my/learning/${item.lessonId}`}
                    className={
                      isCurrent
                        ? "list-item learn-lesson-card learn-lesson-card-link learn-lesson-reveal learn-lesson-card-current"
                        : "list-item learn-lesson-card learn-lesson-card-link learn-lesson-reveal"
                    }
                  >
                    {body}
                  </Link>
                );
              })}
              {revealedCount < revealOrder.length ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: 8 }}
                  onClick={onShowMore}
                >
                  {t("eh_show_more")}
                </button>
              ) : null}
            </div>
          )}
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 16 }}>
        <p className="eyebrow">{t("learn_analysis_title")}</p>
        <h2>{t("learn_recommended_heading")}</h2>
        <ExpandOnClick
          hint={t("eh_learn_analysis_hint")}
          action={t("eh_learn_analysis_show")}
        >
          <div className="layout-2" style={{ marginTop: 8 }}>
            <div>
              <AnalysisBody data={data} t={t} localized={localized} />
            </div>
            <div>
              {recommended.length === 0 ? (
                <p className="muted">{t("learn_no_recommendations")}</p>
              ) : (
                <div className="list learn-title-list">
                  {recommended.slice(0, 6).map(({ lesson }) => (
                    <Link
                      key={lesson.id}
                      href={
                        lesson.dbId != null
                          ? `/my/learning/${lesson.dbId}`
                          : `/my/learning/${encodeURIComponent(lesson.id)}`
                      }
                      className="list-item learn-title-row"
                    >
                      <strong>{localized(lesson.title)}</strong>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ExpandOnClick>
      </section>
    </>
  );
}
