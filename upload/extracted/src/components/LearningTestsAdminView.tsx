"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import {
  ensureLessonTestsAction,
  getLearningTestsForRoleAction,
  openLearningTestEditorAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { lessonAssignedToStaffRole } from "@/lib/role-match";

type StaffRole = { id: string; label: string; department: string };
type LessonOption = {
  dbId: number;
  id: string;
  title: string;
  hasTest?: boolean;
};
type TestRow = {
  dbId: number;
  id: string;
  lessonDbId: number;
  lessonId: string;
  lessonTitle: string;
  title: string;
  summary: string;
  level: string;
  roleFamilies: string[];
  topics: string[];
  durationMin: number;
  assessmentId: number | null;
  isActive: boolean;
};
type AssessmentOption = { id: number; title: string };

export function LearningTestsAdminView({
  tests,
  testStats,
  lessons,
  assessments: _assessments,
  staffRoles,
  internRoles = [],
}: {
  tests: TestRow[];
  testStats: {
    total: number;
    active: number;
    missingLessons: number;
    roleGroups: {
      roleFamilies: string[];
      count: number;
      kind?: "employees" | "interns";
    }[];
  };
  lessons: LessonOption[];
  assessments: AssessmentOption[];
  staffRoles: StaffRole[];
  internRoles?: StaffRole[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [note, setNote] = useState("");
  const [audience, setAudience] = useState<"employees" | "interns" | null>(
    null,
  );
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [openRoleId, setOpenRoleId] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [missingOpen, setMissingOpen] = useState(false);
  const [roleTests, setRoleTests] = useState<Record<string, TestRow[]>>({});
  const [openingId, setOpeningId] = useState<number | null>(null);

  void _assessments;

  const active = useMemo(
    () => tests.filter((test) => test.isActive),
    [tests],
  );
  const missing = useMemo(
    () => lessons.filter((lesson) => !lesson.hasTest),
    [lessons],
  );
  const audienceRoles = audience === "interns" ? internRoles : staffRoles;
  const audienceGroups = useMemo(
    () =>
      testStats.roleGroups.filter((group) =>
        audience === "interns"
          ? group.kind === "interns"
          : group.kind !== "interns",
      ),
    [audience, testStats.roleGroups],
  );
  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return audienceRoles;
    return audienceRoles.filter(
      (role) =>
        role.label.toLowerCase().includes(q) ||
        role.department.toLowerCase().includes(q),
    );
  }, [query, audienceRoles]);
  const rolesByDepartment = useMemo(() => {
    const grouped = new Map<string, StaffRole[]>();
    for (const role of filteredRoles) {
      const rows = grouped.get(role.department) ?? [];
      rows.push(role);
      grouped.set(role.department, rows);
    }
    return [...grouped.entries()];
  }, [filteredRoles]);
  const cacheKey = (roleId: string) =>
    `${audience ?? "employees"}:${roleId}`;
  const openRole =
    audienceRoles.find((role) => role.id === openRoleId) ?? null;
  const openAssigned = openRole
    ? (roleTests[cacheKey(openRole.id)] ?? [])
    : [];

  function countForRole(roleId: string) {
    return audienceGroups.reduce(
      (sum, group) =>
        lessonAssignedToStaffRole(group.roleFamilies, roleId)
          ? sum + group.count
          : sum,
      0,
    );
  }

  function uniqueTestsForRoles(roles: StaffRole[]) {
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
    setQuery("");
    setRoleTests({});
  }

  function toggleRole(role: StaffRole) {
    if (openRoleId === role.id) {
      setOpenRoleId(null);
      return;
    }
    setOpenRoleId(role.id);
    const key = cacheKey(role.id);
    if (roleTests[key]) return;
    startTransition(async () => {
      const rows = await getLearningTestsForRoleAction(
        role.id,
        audience === "interns" ? "interns" : "employees",
      );
      setRoleTests((prev) => ({ ...prev, [key]: rows }));
    });
  }

  function openEditor(test: TestRow) {
    setOpeningId(test.dbId);
    startTransition(async () => {
      try {
        const assessmentId = await openLearningTestEditorAction(test.dbId);
        router.push(`/assessments/${assessmentId}`);
      } finally {
        setOpeningId(null);
      }
    });
  }

  function renderTestButton(test: TestRow) {
    const busy = openingId === test.dbId;
    return (
      <button
        key={test.dbId}
        type="button"
        className="list-item learn-role-card"
        style={{ display: "block", width: "100%", textAlign: "left" }}
        disabled={pending && busy}
        onClick={() => openEditor(test)}
      >
        <strong>{test.title}</strong>
        <div className="muted">
          {t("admin_ltests_linked")}: {test.lessonTitle}
          {test.roleFamilies.length
            ? ` · ${test.roleFamilies.join(", ")}`
            : ` · ${t("admin_learning_unassigned")}`}
          {busy ? " · …" : ""}
        </div>
      </button>
    );
  }

  function renderRoleRows(roles: StaffRole[]) {
    return (
      <div className="list" style={{ marginTop: 10 }}>
        {roles.map((role) => {
          const count = countForRole(role.id);
          const selected = openRoleId === role.id;
          const key = cacheKey(role.id);
          return (
            <div key={role.id} className="learn-role-row">
              <button
                type="button"
                className={
                  selected
                    ? "list-item learn-role-card learn-role-card-active"
                    : "list-item learn-role-card"
                }
                onClick={() => toggleRole(role)}
              >
                <span style={{ flex: 1, textAlign: "left" }}>
                  <strong>{role.label}</strong>
                  <div className="muted">
                    {t("admin_ltests_test_count").replace(
                      "{n}",
                      String(count),
                    )}
                  </div>
                </span>
                <span className="muted">{selected ? "▾" : "▸"}</span>
              </button>

              {selected ? (
                <div className="learn-role-detail">
                  {!roleTests[key] && pending ? (
                    <p className="muted">…</p>
                  ) : openAssigned.length === 0 ? (
                    <p className="muted">{t("admin_ltests_role_empty")}</p>
                  ) : (
                    <div className="list">
                      {openAssigned.map((test) => renderTestButton(test))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AppShell pathname="/learning-tests">
      <PageHeader
        title={t("admin_ltests_title")}
        subtitle={t("admin_ltests_staff_note")}
      />

      <section className="stack" style={{ gap: 18, maxWidth: 980 }}>
        {testStats.missingLessons > 0 ? (
          <article className="panel learn-alert" role="status">
            <button
              type="button"
              className="learn-role-toggle"
              aria-expanded={missingOpen}
              onClick={() => setMissingOpen((prev) => !prev)}
            >
              <span>
                <strong>{t("admin_ltests_missing_title")}</strong>
                <span className="muted" style={{ marginLeft: 8 }}>
                  {testStats.missingLessons}
                </span>
              </span>
              <span className="muted">{missingOpen ? "▾" : "▸"}</span>
            </button>

            {missingOpen ? (
              <div style={{ marginTop: 12 }}>
                <p>
                  {t("admin_ltests_missing_note").replace(
                    "{n}",
                    String(testStats.missingLessons),
                  )}
                </p>
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {missing.map((lesson) => (
                    <li key={lesson.dbId}>
                      {t("admin_learning_no_test_for").replace(
                        "{title}",
                        lesson.title,
                      )}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ marginTop: 12 }}
                  disabled={pending}
                  onClick={() => {
                    startTransition(async () => {
                      const summary = await ensureLessonTestsAction();
                      setNote(
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
                {note ? <p className="muted">{note}</p> : null}
              </div>
            ) : null}
          </article>
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
                {t("admin_ltests_library")} · {testStats.active}
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
            <div style={{ marginTop: 12 }}>
              <p className="muted">{t("admin_ltests_staff_hint")}</p>
              {testStats.active === 0 ? (
                <p className="muted">{t("admin_ltests_empty")}</p>
              ) : (
                <>
                  {testStats.active > active.length ? (
                    <p className="muted">
                      Показаны первые {active.length} из {testStats.active}.
                      Тесты должности открываются в соответствующем отделе.
                    </p>
                  ) : null}
                  <div className="list" style={{ marginTop: 12 }}>
                    {active.map((test) => renderTestButton(test))}
                  </div>
                </>
              )}
            </div>
          ) : null}
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

        {audience ? (
          <>
            <article className="panel">
              <label>
                {t("admin_learning_search_role")}
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("admin_learning_search_placeholder")}
                />
              </label>
            </article>

            {audience === "interns" && filteredRoles.length === 0 ? (
              <article className="panel">
                <h2>{t("admin_learning_intern_roles_title")}</h2>
                <p className="muted">{t("admin_learning_intern_roles_note")}</p>
                <p className="muted">{t("admin_learning_intern_roles_empty")}</p>
              </article>
            ) : (
              rolesByDepartment.map(([department, roles]) => {
                const deptOpen = openDept === department;
                const deptTestCount = uniqueTestsForRoles(roles);
                return (
                  <article key={department} className="panel">
                    <button
                      type="button"
                      className="learn-role-toggle"
                      onClick={() =>
                        setOpenDept((prev) =>
                          prev === department ? null : department,
                        )
                      }
                    >
                      <span>
                        <strong>{department}</strong>
                        <span className="muted" style={{ marginLeft: 8 }}>
                          {t("admin_ltests_roles_count")
                            .replace("{roles}", String(roles.length))
                            .replace("{tests}", String(deptTestCount))}
                        </span>
                      </span>
                      <span className="muted">{deptOpen ? "▾" : "▸"}</span>
                    </button>

                    {deptOpen ? renderRoleRows(roles) : null}
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
