"use client";

import { Fragment, useMemo, useState } from "react";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { ObserverDashboard, ObserverDepartmentBlock } from "@/db/queries";
import { localizeStaffText } from "@/lib/staff-localization";

function scoreLabel(v: number | null) {
  return v == null ? "—" : `${v}%`;
}

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function departmentCode(value: string) {
  const match = value.match(/AGM\/(\d{3})(?:\/(\d{2}))?/i);
  return match ? { root: match[1], child: match[2] ?? null } : null;
}

function departmentSortKey(value: string) {
  const code = departmentCode(value);
  if (!code) return value.toLowerCase();
  return `${code.root}-${code.child ?? "00"}`;
}

function compareDepartments(a: string, b: string) {
  return departmentSortKey(a).localeCompare(departmentSortKey(b), "ru", {
    numeric: true,
  });
}

type OrgRoot = {
  key: string;
  name: string;
  direct: ObserverDepartmentBlock | null;
  children: ObserverDepartmentBlock[];
  employeeCount: number;
  assessedCount: number;
  avgScore: number | null;
};

function buildOrgRoots(departments: ObserverDepartmentBlock[]): {
  leadership: ObserverDepartmentBlock | null;
  roots: OrgRoot[];
  other: ObserverDepartmentBlock[];
} {
  let leadership: ObserverDepartmentBlock | null = null;
  const roots = new Map<string, OrgRoot>();
  const other: ObserverDepartmentBlock[] = [];

  for (const block of departments) {
    if (block.department === "AKELA GROUP") {
      leadership = block;
      continue;
    }

    const code = departmentCode(block.department);
    if (!code) {
      other.push(block);
      continue;
    }

    let root = roots.get(code.root);
    if (!root) {
      root = {
        key: code.root,
        name: code.child
          ? `Департамент AGM/${code.root}`
          : block.department,
        direct: null,
        children: [],
        employeeCount: 0,
        assessedCount: 0,
        avgScore: null,
      };
      roots.set(code.root, root);
    }

    if (!code.child) {
      root.name = block.department;
      root.direct = block;
    } else {
      root.children.push(block);
    }
  }

  const list = [...roots.values()].map((root) => {
    const blocks = [
      ...(root.direct ? [root.direct] : []),
      ...root.children,
    ];
    const scores = blocks.flatMap((block) =>
      block.people
        .filter((person) => person.avgScore != null)
        .map((person) => person.avgScore!),
    );
    return {
      ...root,
      children: [...root.children].sort((a, b) =>
        compareDepartments(a.department, b.department),
      ),
      employeeCount: blocks.reduce(
        (sum, block) => sum + block.employeeCount,
        0,
      ),
      assessedCount: blocks.reduce(
        (sum, block) => sum + block.assessedCount,
        0,
      ),
      avgScore: avg(scores),
    };
  });

  list.sort((a, b) => a.key.localeCompare(b.key, "ru", { numeric: true }));
  other.sort((a, b) => compareDepartments(a.department, b.department));

  return { leadership, roots: list, other };
}

function PersonTable({
  people,
  empty,
  showDepartment,
}: {
  people: ObserverDashboard["interns"];
  empty: string;
  showDepartment?: boolean;
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const localizedName = (value: string) =>
    localizeStaffText(value, locale, "name");

  if (people.length === 0) {
    return <p className="muted">{empty}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("full_name")}</th>
            <th>{t("col_role")}</th>
            {showDepartment ? <th>{t("col_department")}</th> : null}
            <th>{t("observer_avg_score")}</th>
            <th>{t("observer_latest")}</th>
            <th>{t("col_level")}</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>
                <span className="person">
                  <span
                    className="avatar"
                    style={{
                      background: `hsl(${p.avatarHue} 42% 38%)`,
                    }}
                  >
                    {localizedName(p.name)
                      .split(" ")
                      .map((x) => x[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <strong>{localizedName(p.name)}</strong>
                </span>
              </td>
              <td>
                {p.roleTitle
                  ? localizeStaffText(p.roleTitle, locale, "role")
                  : "—"}
              </td>
              {showDepartment ? (
                <td>
                  {p.department
                    ? localizeStaffText(p.department, locale, "department")
                    : "—"}
                </td>
              ) : null}
              <td>
                <strong>{scoreLabel(p.avgScore)}</strong>
              </td>
              <td className="muted">
                {p.latestScore != null ? (
                  <>
                    {p.latestScore}%
                    {p.latestAt
                      ? ` · ${new Date(p.latestAt).toLocaleDateString(dateLocale)}`
                      : ""}
                  </>
                ) : (
                  t("observer_no_result")
                )}
              </td>
              <td>
                {p.latestLevel ? (
                  <LevelBadge level={p.latestLevel} />
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DepartmentStatsBlock({
  block,
  title,
}: {
  block: ObserverDepartmentBlock;
  title?: string;
}) {
  const { t, locale } = useI18n();
  return (
    <article className="panel observer-dept-block">
      <div className="observer-dept-head">
        <div>
          <h2>
            {title ??
              localizeStaffText(block.department, locale, "department")}
          </h2>
          <p className="muted">
            {block.employeeCount} {t("observer_people")} ·{" "}
            {t("observer_assessed")}: {block.assessedCount}
          </p>
        </div>
        <div className="observer-dept-avg">
          <span className="muted">{t("observer_avg_score")}</span>
          <strong>{scoreLabel(block.avgScore)}</strong>
        </div>
      </div>
      <PersonTable people={block.people} empty={t("observer_no_employees")} />
    </article>
  );
}

export function ObserverView({
  data,
  themeHue = 220,
  role = "observer",
}: {
  data: ObserverDashboard;
  themeHue?: number;
  role?: "observer" | "manager";
}) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<
    "overview" | "employees" | "interns" | "candidates"
  >("overview");
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const { summary } = data;

  const structure = useMemo(
    () => buildOrgRoots(data.departments),
    [data.departments],
  );

  const active =
    selectedDept != null
      ? structure.roots.find((root) => root.key === selectedDept) ?? null
      : null;

  const openDepartment = (key: string) => {
    setSelectedDept(key);
    setTab("employees");
  };

  const tabs: { id: typeof tab; key: MessageKey }[] = [
    { id: "overview", key: "observer_tab_overview" },
    { id: "employees", key: "observer_tab_employees" },
    { id: "interns", key: "observer_tab_interns" },
    { id: "candidates", key: "observer_tab_candidates" },
  ];

  return (
    <AppShell pathname="/observer" role={role} themeHue={themeHue}>
      <PageHeader
        title={
          tab === "employees" && active
            ? localizeStaffText(active.name, locale, "department")
            : t("observer_title")
        }
        subtitle={
          tab === "employees" && active
            ? t("org_department_structure")
            : undefined
        }
        action={
          tab === "employees" && active ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSelectedDept(null)}
            >
              {t("employees_back_depts")}
            </button>
          ) : undefined
        }
      />

      <div className="candidate-tabs" role="tablist">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={
              tab === item.id ? "candidate-tab active" : "candidate-tab"
            }
            onClick={() => {
              setTab(item.id);
              if (item.id !== "employees") setSelectedDept(null);
            }}
          >
            {t(item.key)}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <section className="grid-stats">
            <article className="stat">
              <span>{t("role_employee")}</span>
              <strong>{summary.employeesCount}</strong>
              <div className="muted">
                {t("observer_assessed")}: {summary.employeesAssessed}
              </div>
            </article>
            <article className="stat">
              <span>{t("observer_avg_employees")}</span>
              <strong>{scoreLabel(summary.employeesAvgScore)}</strong>
            </article>
            <article className="stat">
              <span>{t("role_intern")}</span>
              <strong>{summary.internsCount}</strong>
              <div className="muted">
                {t("observer_assessed")}: {summary.internsAssessed}
              </div>
            </article>
            <article className="stat">
              <span>{t("observer_avg_interns")}</span>
              <strong>{scoreLabel(summary.internsAvgScore)}</strong>
            </article>
            <article className="stat">
              <span>{t("role_candidate")}</span>
              <strong>{summary.candidatesTotal}</strong>
              <div className="muted">
                {t("observer_assessed")}: {summary.candidatesAssessed}
              </div>
            </article>
            <article className="stat">
              <span>{t("observer_avg_candidates")}</span>
              <strong>{scoreLabel(summary.candidatesAvgScore)}</strong>
            </article>
          </section>

          <section className="panel" style={{ marginTop: 18 }}>
            <h2>{t("observer_dept_overview")}</h2>
            <p className="muted">{t("observer_dept_overview_note")}</p>
            {structure.roots.length === 0 &&
            structure.other.length === 0 &&
            !structure.leadership ? (
              <p className="muted">{t("observer_no_employees")}</p>
            ) : (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="observer-org-table">
                  <thead>
                    <tr>
                      <th>{t("col_department")}</th>
                      <th>{t("observer_headcount")}</th>
                      <th>{t("observer_assessed")}</th>
                      <th>{t("observer_avg_score")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structure.leadership ? (
                      <tr>
                        <td>
                          <strong>
                            {localizeStaffText(
                              structure.leadership.department,
                              locale,
                              "department",
                            )}
                          </strong>
                        </td>
                        <td>{structure.leadership.employeeCount}</td>
                        <td>{structure.leadership.assessedCount}</td>
                        <td>
                          <strong>
                            {scoreLabel(structure.leadership.avgScore)}
                          </strong>
                        </td>
                      </tr>
                    ) : null}
                    {structure.roots.map((root) => (
                      <Fragment key={`root-${root.key}`}>
                        <tr
                          className="observer-org-root observer-org-clickable"
                          onClick={() => openDepartment(root.key)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openDepartment(root.key);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <td>
                            <span className="org-dept-code">
                              AGM/{root.key}
                            </span>{" "}
                            <strong>
                              {localizeStaffText(
                                root.name,
                                locale,
                                "department",
                              )}
                            </strong>
                          </td>
                          <td>{root.employeeCount}</td>
                          <td>{root.assessedCount}</td>
                          <td>
                            <strong>{scoreLabel(root.avgScore)}</strong>
                          </td>
                        </tr>
                        {root.direct && root.children.length > 0 ? (
                          <tr
                            className="observer-org-child observer-org-clickable"
                            onClick={() => openDepartment(root.key)}
                            onKeyDown={(event) => {
                              if (
                                event.key === "Enter" ||
                                event.key === " "
                              ) {
                                event.preventDefault();
                                openDepartment(root.key);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <td>
                              {localizeStaffText(
                                root.direct.department,
                                locale,
                                "department",
                              )}
                            </td>
                            <td>{root.direct.employeeCount}</td>
                            <td>{root.direct.assessedCount}</td>
                            <td>
                              <strong>
                                {scoreLabel(root.direct.avgScore)}
                              </strong>
                            </td>
                          </tr>
                        ) : null}
                        {root.children.map((child) => (
                          <tr
                            key={child.department}
                            className="observer-org-child observer-org-clickable"
                            onClick={() => openDepartment(root.key)}
                            onKeyDown={(event) => {
                              if (
                                event.key === "Enter" ||
                                event.key === " "
                              ) {
                                event.preventDefault();
                                openDepartment(root.key);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <td>
                              {localizeStaffText(
                                child.department,
                                locale,
                                "department",
                              )}
                            </td>
                            <td>{child.employeeCount}</td>
                            <td>{child.assessedCount}</td>
                            <td>
                              <strong>{scoreLabel(child.avgScore)}</strong>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    {structure.other.map((block) => (
                      <tr key={block.department}>
                        <td>
                          <strong>
                            {localizeStaffText(
                              block.department,
                              locale,
                              "department",
                            )}
                          </strong>
                        </td>
                        <td>{block.employeeCount}</td>
                        <td>{block.assessedCount}</td>
                        <td>
                          <strong>{scoreLabel(block.avgScore)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}

      {tab === "employees" ? (
        active ? (
          <section className="observer-dept-list org-department-view">
            {active.direct ? (
              <div className="org-section">
                <h3>{t("org_department_management")}</h3>
                <DepartmentStatsBlock
                  block={active.direct}
                  title={localizeStaffText(
                    active.direct.department,
                    locale,
                    "department",
                  )}
                />
              </div>
            ) : null}
            {active.children.map((child) => (
              <div key={child.department} className="org-section">
                <h3>
                  {t("org_department_unit")}:{" "}
                  {localizeStaffText(child.department, locale, "department")}
                </h3>
                <DepartmentStatsBlock block={child} />
              </div>
            ))}
            {!active.direct && active.children.length === 0 ? (
              <article className="panel">
                <p className="muted">{t("observer_no_employees")}</p>
              </article>
            ) : null}
          </section>
        ) : (
          <section className="observer-dept-list">
            <p className="muted" style={{ marginBottom: 16 }}>
              {t("observer_employees_by_dept")}
            </p>
            {structure.leadership ? (
              <DepartmentStatsBlock
                block={structure.leadership}
                title={t("org_leadership")}
              />
            ) : null}
            {structure.roots.length === 0 && structure.other.length === 0 ? (
              <article className="panel">
                <p className="muted">{t("observer_no_employees")}</p>
              </article>
            ) : (
              <section className="panel">
                <h2>
                  {t("org_departments")} · {structure.roots.length}
                </h2>
                <div className="dept-grid">
                  {structure.roots.map((root) => (
                    <button
                      key={root.key}
                      type="button"
                      className="dept-card"
                      onClick={() => setSelectedDept(root.key)}
                    >
                      <span className="org-dept-code">AGM/{root.key}</span>
                      <strong>
                        {localizeStaffText(root.name, locale, "department")}
                      </strong>
                      <span className="muted">
                        {root.employeeCount} {t("observer_people")} ·{" "}
                        {t("observer_avg_score")}: {scoreLabel(root.avgScore)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            {structure.other.map((block) => (
              <DepartmentStatsBlock key={block.department} block={block} />
            ))}
          </section>
        )
      ) : null}

      {tab === "interns" ? (
        <section className="panel">
          <div className="observer-section-head">
            <div>
              <h2>{t("results_group_interns")}</h2>
              <p className="muted">
                {summary.internsCount} {t("observer_people")} ·{" "}
                {t("observer_avg_score")}: {scoreLabel(summary.internsAvgScore)}
              </p>
            </div>
          </div>
          <PersonTable
            people={data.interns}
            empty={t("observer_no_interns")}
            showDepartment
          />
        </section>
      ) : null}

      {tab === "candidates" ? (
        <section className="panel">
          <div className="observer-section-head">
            <div>
              <h2>{t("results_group_candidates")}</h2>
              <p className="muted">
                {t("observer_candidates_came")}: {summary.candidatesTotal} ·{" "}
                {t("observer_assessed")}: {summary.candidatesAssessed} ·{" "}
                {t("observer_avg_score")}:{" "}
                {scoreLabel(summary.candidatesAvgScore)}
              </p>
            </div>
          </div>
          <PersonTable
            people={data.candidates}
            empty={t("observer_no_candidates")}
            showDepartment
          />
        </section>
      ) : null}
    </AppShell>
  );
}
