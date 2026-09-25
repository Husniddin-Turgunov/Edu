"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import {
  assignLessonRoleAction,
  ensureLessonTestsAction,
  getLearningLessonContentAction,
  getLearningLessonsForRoleAction,
  syncDriveLessonsAction,
  unassignLessonRoleAction,
  addInternStandardLessonAction,
  removeInternStandardItemAction,
  rebuildAllLearningProgramsAction,
} from "@/db/actions";
import {
  InternDailyReportsAdminPanel,
  type DailyJournalRow,
} from "@/components/InternDailyReportsAdminPanel";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";
import { LEVEL_ORDER, levelLabel } from "@/lib/levels";
import { lessonAssignedToStaffRole, isFiveDayInternProgramSlug } from "@/lib/role-match";
import { LEARNING_MONTH_THEMES } from "@/lib/learning-program";
import Link from "next/link";

type StaffRole = { id: string; label: string; department: string };

type OrgRoleGroup = {
  key: string;
  name: string;
  roles: StaffRole[];
  children: { name: string; roles: StaffRole[] }[];
};

function departmentCode(value: string) {
  const match = value.match(/AGM\/(\d{3})(?:\/(\d{2}))?/i);
  return match ? { root: match[1], child: match[2] ?? null } : null;
}

function compareByAgmCode(a: string, b: string) {
  const ca = departmentCode(a);
  const cb = departmentCode(b);
  if (ca && cb) {
    const left = `${ca.root}-${ca.child ?? "00"}`;
    const right = `${cb.root}-${cb.child ?? "00"}`;
    return left.localeCompare(right, "ru", { numeric: true });
  }
  return a.localeCompare(b, "ru", { numeric: true });
}

type LessonRow = {
  dbId: number;
  id: string;
  title: string;
  summary: string;
  content: string;
  contentFormat?: "text" | "html";
  level: string;
  roleFamilies: string[];
  topics: string[];
  durationMin: number;
  isActive: boolean;
  driveFileId: string | null;
  driveModifiedAt?: string | null;
  hasTest?: boolean;
  linkedTestSlug?: string | null;
};

function lessonLevelLabel(level: string, allLabel: string) {
  if (level === "all") return allLabel;
  return levelLabel(level);
}

function categoryBreakdown(lessons: LessonRow[], allLabel: string) {
  const byLevel = new Map<string, number>();
  const byTopic = new Map<string, number>();

  for (const lesson of lessons) {
    const levelKey = lessonLevelLabel(lesson.level, allLabel);
    byLevel.set(levelKey, (byLevel.get(levelKey) ?? 0) + 1);
    for (const topic of lesson.topics) {
      const key = topic.trim();
      if (!key) continue;
      byTopic.set(key, (byTopic.get(key) ?? 0) + 1);
    }
  }

  const levelOrder = ["All", allLabel, ...LEVEL_ORDER.map((code) => levelLabel(code))];
  const levels = [...byLevel.entries()].sort((a, b) => {
    const ia = levelOrder.indexOf(a[0]);
    const ib = levelOrder.indexOf(b[0]);
    if (ia >= 0 && ib >= 0) return ia - ib;
    if (ia >= 0) return -1;
    if (ib >= 0) return 1;
    return a[0].localeCompare(b[0]);
  });

  const topics = [...byTopic.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { levels, topics };
}

export function LearningAdminView({
  lessons,
  lessonStats,
  staffRoles,
  internRoles = [],
  internStandard = [],
  driveConfigured = false,
  dailyReports = [],
  programs = [],
}: {
  lessons: LessonRow[];
  lessonStats: {
    total: number;
    active: number;
    withoutTest: number;
    roleGroups: {
      roleFamilies: string[];
      count: number;
      kind?: "employees" | "interns";
    }[];
  };
  staffRoles: StaffRole[];
  internRoles?: StaffRole[];
  internStandard?: {
    id: number;
    lessonId: number | null;
    title: string;
  }[];
  driveConfigured?: boolean;
  dailyReports?: DailyJournalRow[];
  programs?: {
    programId: number;
    employeeId: number;
    employeeName: string;
    roleTitle: string;
    department: string;
    currentLevel: string;
    hrStatus: string;
    targetLevel: string;
    startsAt: string;
    generatedAt: string;
    totalItems: number;
    creditedItems: number;
    progressPercent: number;
  }[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [syncNote, setSyncNote] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [roleQuery, setRoleQuery] = useState("");
  const [audience, setAudience] = useState<"employees" | "interns" | null>(
    null,
  );
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<number | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [roleLessons, setRoleLessons] = useState<Record<string, LessonRow[]>>(
    {},
  );
  const [lessonContent, setLessonContent] = useState<
    Record<
      number,
      { summary: string; content: string; contentFormat: "text" | "html" }
    >
  >({});
  const openLesson =
    lessons.find((lesson) => lesson.dbId === openLessonId) ?? null;
  const openLessonContent =
    openLessonId != null ? lessonContent[openLessonId] : undefined;
  const localized = useImportedContent(
    [
      openLesson?.title,
      openLessonContent?.summary,
      openLessonContent?.content,
      ...internStandard.map((item) => item.title),
    ],
    locale,
  );

  const activeLessons = useMemo(
    () => lessons.filter((lesson) => lesson.isActive),
    [lessons],
  );
  const library = activeLessons;
  const unassigned = activeLessons.filter(
    (lesson) => lesson.roleFamilies.length === 0,
  );
  const withoutTest = activeLessons.filter((lesson) => !lesson.hasTest);
  const audienceRoles =
    audience === "interns" ? internRoles : staffRoles;
  const audienceGroups = useMemo(
    () =>
      lessonStats.roleGroups.filter((group) =>
        audience === "interns"
          ? group.kind === "interns"
          : group.kind !== "interns",
      ),
    [audience, lessonStats.roleGroups],
  );
  const visibleRoles = useMemo(() => {
    const q = roleQuery.trim().toLowerCase();
    if (!q) return audienceRoles;
    return audienceRoles.filter(
      (role) =>
        role.label.toLowerCase().includes(q) ||
        role.department.toLowerCase().includes(q),
    );
  }, [roleQuery, audienceRoles]);

  const rolesByRoot = useMemo(() => {
    const roots = new Map<string, OrgRoleGroup>();
    const uncoded = new Map<string, StaffRole[]>();

    for (const role of visibleRoles) {
      const dept = role.department || t("admin_learning_no_dept");
      const code = departmentCode(dept);
      if (!code) {
        const list = uncoded.get(dept) ?? [];
        list.push(role);
        uncoded.set(dept, list);
        continue;
      }

      let root = roots.get(code.root);
      if (!root) {
        root = {
          key: code.root,
          name: code.child ? `Департамент AGM/${code.root}` : dept,
          roles: [],
          children: [],
        };
        roots.set(code.root, root);
      }

      if (!code.child) {
        root.name = dept;
        root.roles.push(role);
        continue;
      }

      let child = root.children.find((item) => item.name === dept);
      if (!child) {
        child = { name: dept, roles: [] };
        root.children.push(child);
      }
      child.roles.push(role);
    }

    const groups: OrgRoleGroup[] = [...roots.values()]
      .map((root) => ({
        ...root,
        children: [...root.children].sort((a, b) =>
          compareByAgmCode(a.name, b.name),
        ),
      }))
      .sort((a, b) => a.key.localeCompare(b.key, "ru", { numeric: true }));

    for (const [name, roles] of [...uncoded.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "ru"),
    )) {
      groups.unshift({ key: `other:${name}`, name, roles, children: [] });
    }

    return groups;
  }, [visibleRoles, t]);

  const openRole = visibleRoles.find((role) => role.id === openRoleId) ?? null;
  const openAssigned = openRole
    ? (roleLessons[`${audience ?? "employees"}:${openRole.id}`] ?? [])
    : [];
  const openAvailable = openRole
    ? activeLessons.filter((lesson) => {
        if (lessonAssignedToStaffRole(lesson.roleFamilies, openRole.id)) {
          return false;
        }
        const isIntern = isFiveDayInternProgramSlug(lesson.id);
        return audience === "interns" ? isIntern : !isIntern;
      })
    : [];
  const openCats = categoryBreakdown(openAssigned, t("learn_filter_all"));
  const selectedId =
    (openRole && pick[openRole.id]) || String(openAvailable[0]?.dbId || "");

  function syncDrive() {
    startTransition(async () => {
      const summary = await syncDriveLessonsAction();
      setSyncNote(summary.message);
      router.refresh();
    });
  }

  function countForRole(roleId: string) {
    return audienceGroups.reduce(
      (sum, group) =>
        lessonAssignedToStaffRole(group.roleFamilies, roleId)
          ? sum + group.count
          : sum,
      0,
    );
  }

  function uniqueLessonsForRoles(roles: StaffRole[]) {
    let count = 0;
    for (const group of audienceGroups) {
      if (
        roles.some((role) =>
          lessonAssignedToStaffRole(group.roleFamilies, role.id),
        )
      ) {
        count += group.count;
      }
    }
    return count;
  }

  function selectAudience(next: "employees" | "interns") {
    setAudience(next);
    setOpenDept(null);
    setOpenRoleId(null);
    setRoleQuery("");
    setRoleLessons({});
  }

  function toggleRole(role: StaffRole) {
    if (openRoleId === role.id) {
      setOpenRoleId(null);
      return;
    }
    setOpenRoleId(role.id);
    const cacheKey = `${audience ?? "employees"}:${role.id}`;
    if (roleLessons[cacheKey]) return;
    startTransition(async () => {
      const rows = await getLearningLessonsForRoleAction(
        role.id,
        audience === "interns" ? "interns" : "employees",
      );
      setRoleLessons((prev) => ({ ...prev, [cacheKey]: rows }));
    });
  }

  function renderRoleDetail(role: StaffRole) {
    return (
      <div className="learn-role-detail">
        <div className="learn-library-head">
          <div>
            <p className="eyebrow">{t("admin_learning_role_detail")}</p>
            <h3 style={{ margin: 0 }}>{role.label}</h3>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {role.department}
            </p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => setOpenRoleId(null)}
          >
            {t("admin_learning_close")}
          </button>
        </div>

        <div className="learn-cat-block">
          <h3>{t("admin_learning_by_level")}</h3>
          {openCats.levels.length === 0 ? (
            <p className="muted">{t("admin_learning_role_empty")}</p>
          ) : (
            <ul className="learn-chip-list">
              {openCats.levels.map(([name, count]) => (
                <li key={name}>
                  {name}: {count}
                </li>
              ))}
            </ul>
          )}
        </div>

        {openCats.topics.length > 0 ? (
          <div className="learn-cat-block">
            <h3>{t("admin_learning_by_topic")}</h3>
            <ul className="learn-chip-list">
              {openCats.topics.map(([name, count]) => (
                <li key={name}>
                  {name}: {count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {openAssigned.length > 0 ? (
          <div className="list" style={{ marginTop: 14 }}>
            {openAssigned.map((lesson) => (
              <div
                key={lesson.dbId}
                className="list-item"
                style={{ alignItems: "center" }}
              >
                <div style={{ flex: 1 }}>
                  <strong>{localized(lesson.title)}</strong>
                  <div className="muted">
                    {lessonLevelLabel(lesson.level, t("learn_filter_all"))} ·{" "}
                    {lesson.durationMin} {t("min")}
                  </div>
                  <p style={{ margin: "6px 0 0" }}>
                    {localized(lesson.summary)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn"
                  disabled={pending}
                  onClick={() => {
                    const fd = new FormData();
                    fd.set("lessonId", String(lesson.dbId));
                    fd.set("roleId", role.id);
                    startTransition(async () => {
                      await unassignLessonRoleAction(fd);
                      router.refresh();
                    });
                  }}
                >
                  {t("admin_learning_remove")}
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {openAvailable.length > 0 ? (
          <div className="learn-role-assign">
            <label style={{ flex: 1, minWidth: 220 }}>
              {t("admin_learning_add_from_library")}
              <select
                value={selectedId}
                onChange={(event) =>
                  setPick((prev) => ({
                    ...prev,
                    [role.id]: event.target.value,
                  }))
                }
              >
                {openAvailable.map((lesson) => (
                  <option key={lesson.dbId} value={lesson.dbId}>
                    {localized(lesson.title)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending || !selectedId}
              onClick={() => {
                const fd = new FormData();
                fd.set("lessonId", selectedId);
                fd.set("roleId", role.id);
                startTransition(async () => {
                  await assignLessonRoleAction(fd);
                  router.refresh();
                });
              }}
            >
              {t("admin_learning_assign")}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  function renderRoleList(roles: StaffRole[]) {
    return (
      <div className="list">
        {roles.map((role) => {
          const count = countForRole(role.id);
          const selected = openRoleId === role.id;
          return (
            <div key={role.id} className="list-item learn-role-row">
              <button
                type="button"
                className={
                  selected
                    ? "learn-role-card learn-role-card-active"
                    : "learn-role-card"
                }
                onClick={() => toggleRole(role)}
              >
                <span style={{ flex: 1, textAlign: "left" }}>
                  <strong>{role.label}</strong>
                  <div className="muted">
                    {t("admin_learning_lesson_count").replace(
                      "{n}",
                      String(count),
                    )}
                  </div>
                </span>
                <span className="muted">{selected ? "▾" : "▸"}</span>
              </button>
              {selected ? (
                !roleLessons[`${audience ?? "employees"}:${role.id}`] &&
                pending ? (
                  <div className="learn-role-detail">
                    <p className="muted">…</p>
                  </div>
                ) : (
                  renderRoleDetail(role)
                )
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell pathname="/learning">
      <PageHeader
        title={t("admin_learning_title")}
        subtitle={t("admin_learning_drive_note")}
      />

      <section className="stack" style={{ gap: 18, maxWidth: 980 }}>
        <article className="panel">
          <h2>{t("learn_admin_program_title")}</h2>
          <p className="muted">{t("learn_admin_program_note")}</p>
          <div className="learn-month-grid">
            {([1, 2, 3] as const).map((month) => (
              <div key={month} className="learn-month-card">
                <h3>
                  {t("learn_month")} {month}:{" "}
                  {t(LEARNING_MONTH_THEMES[month].titleKey as MessageKey)}
                </h3>
                <ul>
                  {LEARNING_MONTH_THEMES[month].bullets.map((key) => (
                    <li key={key}>{t(key as MessageKey)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <form action={rebuildAllLearningProgramsAction} style={{ marginTop: 14 }}>
            <button type="submit" className="btn btn-ghost">
              {t("learn_admin_rebuild_all")}
            </button>
          </form>
          {programs.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              {t("learn_admin_programs_empty")}
            </p>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    <th>{t("full_name")}</th>
                    <th>{t("col_position")}</th>
                    <th>{t("col_level")}</th>
                    <th>{t("emp_col_progress")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {programs.map((row) => (
                    <tr key={row.programId}>
                      <td>{row.employeeName}</td>
                      <td>{row.roleTitle}</td>
                      <td>
                        {levelLabel(row.currentLevel)} →{" "}
                        {levelLabel(row.targetLevel)}
                      </td>
                      <td>
                        {row.progressPercent}% ({row.creditedItems}/
                        {row.totalItems})
                      </td>
                      <td>
                        <Link
                          href={`/employees/${row.employeeId}`}
                          className="btn btn-ghost"
                        >
                          {t("learn_admin_open_employee")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="panel">
          <h2>{t("admin_learning_drive_title")}</h2>
          <p className="muted">
            {driveConfigured
              ? t("admin_learning_drive_ok")
              : t("admin_learning_drive_off")}
          </p>
          {syncNote ? <p className="muted">{syncNote}</p> : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!driveConfigured || pending}
            onClick={syncDrive}
          >
            {pending ? t("drive_syncing") : t("admin_learning_drive_sync")}
          </button>
        </article>

        <article className="panel">
          <h2>{t("admin_learning_audience_title")}</h2>
          <p className="muted">{t("admin_learning_audience_note")}</p>
          <div className="learn-audience-grid">
            <button
              type="button"
              className={
                audience === "employees"
                  ? "learn-audience-btn learn-audience-btn-active"
                  : "learn-audience-btn"
              }
              onClick={() => selectAudience("employees")}
            >
              <strong>{t("admin_learning_audience_employees")}</strong>
              <span className="muted">
                {t("admin_learning_audience_employees_note")}
              </span>
            </button>
            <button
              type="button"
              className={
                audience === "interns"
                  ? "learn-audience-btn learn-audience-btn-active"
                  : "learn-audience-btn"
              }
              onClick={() => selectAudience("interns")}
            >
              <strong>{t("admin_learning_audience_interns")}</strong>
              <span className="muted">
                {t("admin_learning_audience_interns_note")}
              </span>
            </button>
          </div>
        </article>

        {audience === "interns" ? (
          <>
            <article className="panel">
              <h2>{t("intern_standard_title")}</h2>
              <p className="muted">{t("intern_standard_note")}</p>
              {internStandard.length === 0 ? (
                <p className="muted">{t("intern_standard_empty")}</p>
              ) : (
                <div className="list" style={{ marginTop: 10 }}>
                  {internStandard.map((item) => (
                    <div key={item.id} className="list-item">
                      <strong>{localized(item.title)}</strong>
                      <form action={removeInternStandardItemAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="btn">
                          {t("admin_learning_remove")}
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              <form
                action={addInternStandardLessonAction}
                className="stack-form"
                style={{ marginTop: 12, maxWidth: 480 }}
              >
                <label>
                  {t("intern_standard_add")}
                  <select name="lessonId" defaultValue="">
                    <option value="">{t("mentor_assign_pick")}</option>
                    {activeLessons
                      .filter(
                        (lesson) =>
                          !internStandard.some(
                            (s) => s.lessonId === lesson.dbId,
                          ),
                      )
                      .map((lesson) => (
                        <option key={lesson.dbId} value={lesson.dbId}>
                          {localized(lesson.title)}
                        </option>
                      ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">
                  {t("intern_standard_save")}
                </button>
              </form>
            </article>

            <InternDailyReportsAdminPanel reports={dailyReports} />
          </>
        ) : null}

        <article className="panel">
          <button
            type="button"
            className="learn-role-toggle"
            aria-expanded={libraryOpen}
            onClick={() => setLibraryOpen((prev) => !prev)}
          >
            <span>
              <strong>
                {t("admin_learning_library")} · {lessonStats.active}
              </strong>
              <span className="muted" style={{ marginLeft: 8 }}>
                {libraryOpen
                  ? t("admin_learning_hide_content")
                  : t("admin_learning_show_content")}
              </span>
            </span>
            <span className="muted">{libraryOpen ? "▾" : "▸"}</span>
          </button>

          {libraryOpen ? (
            <div className="learn-library-body">
              <p className="muted">{t("admin_learning_library_note")}</p>

              {lessonStats.withoutTest > 0 ? (
                <div className="learn-alert" role="status">
                  <strong>
                    {t("admin_learning_no_test_alert").replace(
                      "{n}",
                      String(lessonStats.withoutTest),
                    )}
                  </strong>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {withoutTest.map((lesson) => (
                      <li key={lesson.dbId}>
                        {t("admin_learning_no_test_for").replace(
                          "{title}",
                          localized(lesson.title),
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: 10 }}
                    disabled={pending}
                    onClick={() => {
                      startTransition(async () => {
                        const summary = await ensureLessonTestsAction();
                        setSyncNote(
                          t("admin_learning_tests_created").replace(
                            "{n}",
                            String(summary.created),
                          ),
                        );
                        router.refresh();
                      });
                    }}
                  >
                    {t("admin_learning_create_missing_tests")}
                  </button>
                </div>
              ) : null}

              {library.length === 0 ? (
                <p className="muted">{t("admin_learning_library_empty")}</p>
              ) : (
                <>
                  {lessonStats.active > library.length ? (
                    <p className="muted">
                      Показаны первые {library.length} из {lessonStats.active}.
                      Уроки должности открываются в соответствующем отделе.
                    </p>
                  ) : null}
                  <div className="list" style={{ marginTop: 12 }}>
                    {library.map((lesson) => {
                    const isOpen = openLessonId === lesson.dbId;
                    const loaded = lessonContent[lesson.dbId];
                    const isHtml =
                      (loaded?.contentFormat ?? lesson.contentFormat) === "html";
                    const summary = loaded?.summary ?? lesson.summary;
                    const body = loaded?.content?.trim() || summary;
                    const localizedBody = localized(body);
                    return (
                      <div
                        key={lesson.dbId}
                        className="list-item learn-admin-lesson"
                        style={{ display: "block" }}
                      >
                        <button
                          type="button"
                          className="learn-admin-lesson-toggle"
                          aria-expanded={isOpen}
                          onClick={() => {
                            if (isOpen) {
                              setOpenLessonId(null);
                              return;
                            }
                            setOpenLessonId(lesson.dbId);
                            if (lessonContent[lesson.dbId]) return;
                            startTransition(async () => {
                              const loaded =
                                await getLearningLessonContentAction(lesson.dbId);
                              if (!loaded) return;
                              setLessonContent((prev) => ({
                                ...prev,
                                [lesson.dbId]: loaded,
                              }));
                            });
                          }}
                        >
                          <span className="learn-admin-lesson-head">
                            <strong>{localized(lesson.title)}</strong>
                            <span className="muted">
                              {isOpen
                                ? t("admin_learning_hide_content")
                                : t("admin_learning_show_content")}
                            </span>
                          </span>
                          <span className="muted">
                            {lessonLevelLabel(
                              lesson.level,
                              t("learn_filter_all"),
                            )}{" "}
                            · {lesson.durationMin} {t("min")}
                            {lesson.driveFileId ? ` · Drive` : ""}
                            {lesson.hasTest
                              ? ` · ${t("admin_learning_has_test")}`
                              : ` · ${t("admin_learning_missing_test")}`}
                            {lesson.roleFamilies.length
                              ? ` · ${lesson.roleFamilies.join(", ")}`
                              : ` · ${t("admin_learning_unassigned")}`}
                          </span>
                          {!lesson.hasTest ? (
                            <span className="learn-alert-inline">
                              {t("admin_learning_no_test_for").replace(
                                "{title}",
                                localized(lesson.title),
                              )}
                            </span>
                          ) : null}
                        </button>
                        {isOpen ? (
                          <div className="learn-admin-lesson-body">
                            {!loaded && pending ? (
                              <p className="muted">…</p>
                            ) : null}
                            {summary ? (
                              <p className="muted learn-admin-lesson-summary">
                                {localized(summary)}
                              </p>
                            ) : null}
                            {isHtml ? (
                              <div
                                className="lesson-body lesson-body-html"
                                dangerouslySetInnerHTML={{
                                  __html:
                                    localizedBody ||
                                    `<p>${localized(summary)}</p>`,
                                }}
                              />
                            ) : (
                              <div
                                className="lesson-body"
                                style={{
                                  whiteSpace: "pre-wrap",
                                  lineHeight: 1.6,
                                }}
                              >
                                {localizedBody || t("learn_empty_content")}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                    })}
                  </div>
                </>
              )}
              {unassigned.length > 0 ? (
                <p className="muted" style={{ marginTop: 12 }}>
                  {t("admin_learning_unassigned_count").replace(
                    "{n}",
                    String(unassigned.length),
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
        </article>

        {audience ? (
          <>
            <article className="panel">
              <h2>
                {audience === "interns"
                  ? t("admin_learning_intern_roles_title")
                  : t("admin_learning_roles_title")}
              </h2>
              <p className="muted">
                {audience === "interns"
                  ? t("admin_learning_intern_roles_note")
                  : t("admin_learning_roles_click_note")}
              </p>
              <label style={{ marginTop: 10, display: "block" }}>
                {t("admin_learning_search_role")}
                <input
                  value={roleQuery}
                  onChange={(event) => setRoleQuery(event.target.value)}
                  placeholder={t("admin_learning_search_placeholder")}
                />
              </label>
            </article>

            {visibleRoles.length === 0 ? (
              <article className="panel">
                <p className="muted">
                  {audience === "interns"
                    ? t("admin_learning_intern_roles_empty")
                    : t("admin_learning_role_empty")}
                </p>
              </article>
            ) : (
              rolesByRoot.map((root) => {
                const deptOpen = openDept === root.key;
                const allRoles = [
                  ...root.roles,
                  ...root.children.flatMap((child) => child.roles),
                ];
                const deptLessonCount = uniqueLessonsForRoles(allRoles);

                return (
                  <article key={root.key} className="panel">
                    <button
                      type="button"
                      className="learn-role-toggle"
                      onClick={() =>
                        setOpenDept((prev) =>
                          prev === root.key ? null : root.key,
                        )
                      }
                    >
                      <span>
                        <strong>{root.name}</strong>
                        <span className="muted" style={{ marginLeft: 8 }}>
                          {t("admin_learning_roles_count")
                            .replace("{roles}", String(allRoles.length))
                            .replace("{lessons}", String(deptLessonCount))}
                        </span>
                      </span>
                      <span className="muted">{deptOpen ? "▾" : "▸"}</span>
                    </button>

                    {deptOpen ? (
                      <div className="stack" style={{ marginTop: 12, gap: 16 }}>
                        {root.roles.length > 0
                          ? renderRoleList(root.roles)
                          : null}

                        {root.children.map((child) => (
                          <div key={child.name} className="learn-role-sub">
                            <p className="learn-role-sub-head">
                              <strong>{child.name}</strong>
                              {" · "}
                              {t("admin_learning_roles_count")
                                .replace("{roles}", String(child.roles.length))
                                .replace(
                                  "{lessons}",
                                  String(uniqueLessonsForRoles(child.roles)),
                                )}
                            </p>
                            {renderRoleList(child.roles)}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })
            )}
          </>
        ) : null}

      </section>
    </AppShell>
  );
}
