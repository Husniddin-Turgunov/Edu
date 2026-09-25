"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  assignEmployeePositionAction,
  assignEmployeeMentorAction,
  dismissPositionAction,
  hireInternAction,
  syncDepartmentManagersAction,
} from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Position = {
  id: number;
  code: string;
  role: string;
  department: string;
  name: string | null;
  email: string | null;
  employeeId: number | null;
  isPrimary: boolean;
  currentLevel: string;
  avatarHue: number;
};

type DirectoryRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  telegram: string;
  department: string;
  roleTitle: string;
  currentLevel: string;
  startingLevel: string;
  targetLevel: string;
  status: string;
  hiredAt: string | null;
  nextCheckAt: string | null;
  avatarHue: number;
  managerName: string | null;
  managerRoleTitle: string | null;
  managerDepartment: string | null;
  mentorUserId: number | null;
  mentorName: string | null;
  progress: number;
};

type OrgDepartment = {
  key: string;
  name: string;
  direct: Position[];
  children: { name: string; positions: Position[] }[];
};

type InternOption = {
  id: number;
  name: string;
  roleTitle: string;
};

type ManagerOption = {
  id: number;
  displayName: string;
  profileDepartment: string | null;
  profileJobTitle: string | null;
};

function MentorPickerCell({
  employeeId,
  mentorUserId,
  mentorName,
  managers,
}: {
  employeeId: number;
  mentorUserId: number | null;
  mentorName: string | null;
  managers: ManagerOption[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <form action={assignEmployeeMentorAction} className="emp-mentor-form">
        <input type="hidden" name="employeeId" value={employeeId} />
        <select
          name="mentorUserId"
          className="emp-mentor-select"
          autoFocus
          defaultValue={mentorUserId ?? ""}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        >
          <option value="">{t("mentor_unassigned")}</option>
          {managers.map((manager) => (
            <option key={manager.id} value={manager.id}>
              {manager.displayName}
              {manager.profileJobTitle ? ` · ${manager.profileJobTitle}` : ""}
            </option>
          ))}
        </select>
      </form>
    );
  }

  return (
    <button
      type="button"
      className="emp-mentor-pick"
      title={t("emp_change_mentor")}
      onClick={() => setOpen(true)}
    >
      {mentorName ?? t("mentor_unassigned")}
    </button>
  );
}

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

const HR_STATUS_KEYS: Record<string, MessageKey> = {
  active: "emp_status_active",
  probation: "emp_status_probation",
  learning: "emp_status_learning",
  paused: "emp_status_paused",
  left: "emp_status_left",
};

export function EmployeesView({
  directory,
  positions,
  internOptions,
  managers,
  mgrSyncResult,
  initialTab = "people",
}: {
  directory: DirectoryRow[];
  positions: Position[];
  internOptions: InternOption[];
  managers: ManagerOption[];
  mgrSyncResult?: {
    employees: number;
    leaders: number;
    created: number;
    relinked: number;
    updatedManagers: number;
    updatedMentors: number;
    updatedDepartments: number;
  } | null;
  initialTab?: "people" | "org" | "archive" | "history" | "competencies";
}) {
  const { t, locale } = useI18n();
  const [tab, setTab] = useState<
    "people" | "org" | "archive" | "history" | "competencies"
  >(initialTab);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";

  const structure = useMemo(() => {
    const leadership = positions.filter((p) => p.department === "AKELA GROUP");
    const roots = new Map<string, OrgDepartment>();

    for (const position of positions) {
      if (position.department === "AKELA GROUP") continue;
      const code = departmentCode(position.department);
      if (!code) continue;

      let root = roots.get(code.root);
      if (!root) {
        root = {
          key: code.root,
          name: code.child
            ? `Департамент AGM/${code.root}`
            : position.department,
          direct: [],
          children: [],
        };
        roots.set(code.root, root);
      }

      if (!code.child) {
        root.name = position.department;
        root.direct.push(position);
        continue;
      }

      let child = root.children.find(
        (item) => item.name === position.department,
      );
      if (!child) {
        child = { name: position.department, positions: [] };
        root.children.push(child);
      }
      child.positions.push(position);
    }

    return {
      leadership,
      departments: [...roots.values()]
        .map((root) => ({
          ...root,
          children: [...root.children].sort((a, b) =>
            compareByAgmCode(a.name, b.name),
          ),
        }))
        .sort((a, b) => a.key.localeCompare(b.key, "ru", { numeric: true })),
    };
  }, [positions]);

  const filteredDirectory = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      tab === "archive"
        ? directory.filter((row) => row.status === "left")
        : directory.filter((row) => row.status !== "left");
    if (!q) return base;
    return base.filter((row) =>
      [
        row.name,
        row.email,
        row.department,
        row.roleTitle,
        row.managerName ?? "",
        row.managerRoleTitle ?? "",
        row.managerDepartment ?? "",
        row.mentorName ?? "",
        row.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [directory, query, tab]);

  const active = selectedDept
    ? structure.departments.find((d) => d.key === selectedDept) ?? null
    : null;

  const vacantPositions = positions.filter((position) => !position.employeeId);
  const occupiedPositions = positions.filter(
    (position) => position.employeeId && position.name,
  );
  const peopleById = new Map<number, Position>();
  const internsById = new Map<
    number,
    { employeeId: number; name: string; role: string }
  >(
    internOptions.map((intern) => [
      intern.id,
      {
        employeeId: intern.id,
        name: intern.name,
        role: intern.roleTitle,
      },
    ]),
  );
  for (const position of occupiedPositions) {
    if (!position.employeeId) continue;
    if (!peopleById.has(position.employeeId) || position.isPrimary) {
      peopleById.set(position.employeeId, position);
    }
    if (/стаж|intern/i.test(position.role)) {
      internsById.set(position.employeeId, {
        employeeId: position.employeeId,
        name: position.name ?? "",
        role: position.role,
      });
    }
  }
  const existingPeople = [...peopleById.values()].sort((a, b) =>
    (a.name ?? "").localeCompare(b.name ?? "", "ru"),
  );
  const interns = [...internsById.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "ru"),
  );

  const positionLabel = (position: Position) =>
    `${position.code} · ${localizeStaffText(
      position.role,
      locale,
      "role",
    )} · ${localizeStaffText(
      position.department,
      locale,
      "department",
    )}`;

  function PositionRow({ position }: { position: Position }) {
    const displayName = position.name
      ? localizeStaffText(position.name, locale, "name")
      : null;
    const content = (
      <div className="org-position-person">
        <span
          className={
            position.name ? "avatar org-avatar" : "avatar org-avatar vacant"
          }
          style={
            position.name
              ? { background: `hsl(${position.avatarHue} 42% 38%)` }
              : undefined
          }
        >
          {displayName
            ? displayName
                .split(" ")
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
            : "—"}
        </span>
        <span>
          {displayName ? (
            <strong>{displayName}</strong>
          ) : (
            <strong className="org-vacancy">{t("org_vacant_position")}</strong>
          )}
          {position.email ? (
            <div className="muted">{position.email}</div>
          ) : null}
        </span>
      </div>
    );

    return (
      <div className="org-position-row">
        <div className="org-position-code">{position.code}</div>
        <div className="org-position-role">
          {localizeStaffText(position.role, locale, "role")}
        </div>
        <div>
          {position.employeeId ? (
            <Link href={`/employees/${position.employeeId}`}>{content}</Link>
          ) : (
            content
          )}
        </div>
        <div>
          {position.name ? (
            <LevelBadge level={position.currentLevel} />
          ) : (
            <span className="level-badge level-unassessed">
              {t("vacancy_open")}
            </span>
          )}
        </div>
      </div>
    );
  }

  function PositionList({ items }: { items: Position[] }) {
    return (
      <div className="org-position-list">
        {items.map((position, index) => (
          <PositionRow key={`${position.code}-${index}`} position={position} />
        ))}
      </div>
    );
  }

  return (
    <AppShell pathname="/employees">
      <PageHeader
        title={
          tab === "org" && active
            ? localizeStaffText(active.name, locale, "department")
            : t("employees_title")
        }
        subtitle={
          tab === "org"
            ? active
              ? t("org_department_structure")
              : t("org_structure_subtitle")
            : t("employees_subtitle")
        }
        action={
          tab === "org" && active ? (
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
        {(
          [
            ["people", "emp_tab_people"],
            ["org", "emp_tab_org"],
            ["competencies", "admin_tab_staff_competencies"],
            ["history", "admin_tab_moves_history"],
            ["archive", "admin_tab_archive"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "candidate-tab active" : "candidate-tab"}
            onClick={() => {
              setTab(id);
              if (id !== "org") setSelectedDept(null);
              const url = new URL(window.location.href);
              url.searchParams.set("tab", id);
              window.history.replaceState({}, "", url.toString());
            }}
          >
            {t(key)}
          </button>
        ))}
      </div>

      {tab === "people" || tab === "archive" ? (
        <section className="panel emp-directory-panel">
          <div className="emp-directory-toolbar">
            <h2>
              {t("emp_directory_title")} · {filteredDirectory.length}
            </h2>
            <label className="emp-search">
              <span className="sr-only">{t("emp_search")}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("emp_search")}
              />
            </label>
          </div>

          <div className="emp-sync-banner">
            <div>
              <strong>{t("emp_sync_managers_btn")}</strong>
              <p className="muted emp-sync-inline-hint">
                {t("emp_sync_managers_note")}
              </p>
            </div>
            <form action={syncDepartmentManagersAction}>
              <button type="submit" className="btn btn-primary emp-sync-btn">
                {t("emp_sync_managers_btn")}
              </button>
            </form>
          </div>

          {mgrSyncResult ? (
            <p className="emp-sync-result portal-flash">
              {t("emp_sync_managers_done")
                .replace("{employees}", String(mgrSyncResult.employees))
                .replace("{leaders}", String(mgrSyncResult.leaders))
                .replace("{created}", String(mgrSyncResult.created))
                .replace("{relinked}", String(mgrSyncResult.relinked))
                .replace("{managers}", String(mgrSyncResult.updatedManagers))
                .replace("{mentors}", String(mgrSyncResult.updatedMentors))
                .replace("{departments}", String(mgrSyncResult.updatedDepartments))}
            </p>
          ) : null}

          {filteredDirectory.length === 0 ? (
            <p className="muted">{t("emp_directory_empty")}</p>
          ) : (
            <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("full_name")}</th>
                  <th>{t("col_position")}</th>
                  <th>{t("col_department")}</th>
                  <th>{t("emp_col_manager")}</th>
                  <th>{t("emp_col_mentor")}</th>
                  <th>{t("emp_col_hired")}</th>
                  <th>{t("emp_col_start_level")}</th>
                  <th>{t("col_level")}</th>
                  <th>{t("emp_col_target_level")}</th>
                  <th>{t("emp_col_progress")}</th>
                  <th>{t("emp_col_next_check")}</th>
                  <th>{t("emp_col_status")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredDirectory.map((row) => {
                  const displayName = localizeStaffText(row.name, locale, "name");
                  const statusKey =
                    HR_STATUS_KEYS[row.status] ?? "emp_status_active";
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/employees/${row.id}`} className="person">
                          <span
                            className="avatar"
                            style={{
                              background: `hsl(${row.avatarHue} 42% 38%)`,
                            }}
                          >
                            {displayName
                              .split(" ")
                              .map((part) => part[0])
                              .slice(0, 2)
                              .join("")}
                          </span>
                          <span>
                            <strong>{displayName}</strong>
                            <span className="muted">{row.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td>
                        {localizeStaffText(row.roleTitle, locale, "role")}
                      </td>
                      <td>
                        {localizeStaffText(
                          row.department,
                          locale,
                          "department",
                        )}
                      </td>
                      <td>
                        {row.managerRoleTitle ? (
                          <span>
                            <strong>
                              {localizeStaffText(
                                row.managerRoleTitle,
                                locale,
                                "role",
                              )}
                            </strong>
                            {row.managerName ? (
                              <span className="muted emp-manager-name">
                                {localizeStaffText(row.managerName, locale, "name")}
                              </span>
                            ) : null}
                          </span>
                        ) : row.managerName ? (
                          localizeStaffText(row.managerName, locale, "name")
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <MentorPickerCell
                          employeeId={row.id}
                          mentorUserId={row.mentorUserId}
                          mentorName={row.mentorName}
                          managers={managers}
                        />
                      </td>
                      <td>
                        {row.hiredAt
                          ? new Date(row.hiredAt).toLocaleDateString(dateLocale)
                          : "—"}
                      </td>
                      <td>
                        <LevelBadge level={row.startingLevel} />
                      </td>
                      <td>
                        <LevelBadge level={row.currentLevel} />
                      </td>
                      <td>
                        <LevelBadge level={row.targetLevel} />
                      </td>
                      <td>
                        <div className="emp-progress">
                          <div className="emp-progress-track">
                            <div
                              className="emp-progress-bar"
                              style={{ width: `${row.progress}%` }}
                            />
                          </div>
                          <span>{row.progress}%</span>
                        </div>
                      </td>
                      <td>
                        {row.nextCheckAt
                          ? new Date(row.nextCheckAt).toLocaleDateString(
                              dateLocale,
                            )
                          : "—"}
                      </td>
                      <td>
                        <span className={`emp-status emp-status-${row.status}`}>
                          {t(statusKey)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </section>
      ) : tab === "history" ? (
        <section className="panel emp-directory-panel">
          <h2>
            {t("admin_tab_moves_history")} · {directory.length}
          </h2>
          <p className="muted">{t("emp_history_note")}</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("full_name")}</th>
                  <th>{t("col_position")}</th>
                  <th>{t("col_level")}</th>
                  <th>{t("emp_col_target_level")}</th>
                  <th>{t("emp_col_hired")}</th>
                </tr>
              </thead>
              <tbody>
                {directory
                  .filter((row) => row.status !== "left")
                  .map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link href={`/employees/${row.id}`}>{row.name}</Link>
                      </td>
                      <td>
                        {localizeStaffText(row.roleTitle, locale, "role")}
                      </td>
                      <td>
                        <LevelBadge level={row.currentLevel} />
                      </td>
                      <td>{row.targetLevel}</td>
                      <td>
                        {row.hiredAt
                          ? new Date(row.hiredAt).toLocaleDateString(dateLocale)
                          : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : tab === "competencies" ? (
        <section className="panel">
          <h2>{t("admin_tab_staff_competencies")}</h2>
          <p className="muted">{t("emp_competencies_note")}</p>
          <p>
            <Link href="/competencies" className="btn btn-primary">
              {t("admin_tab_roles")}
            </Link>{" "}
            <Link href="/mentors" className="btn btn-ghost">
              {t("admin_tab_mentors")}
            </Link>
          </p>
          <div className="list" style={{ marginTop: 16 }}>
            {directory
              .filter((row) => row.status !== "left")
              .slice(0, 40)
              .map((row) => (
                <Link
                  key={row.id}
                  href={`/employees/${row.id}`}
                  className="list-item"
                >
                  <div>
                    <strong>{row.name}</strong>
                    <div className="muted" style={{ fontSize: "0.85rem" }}>
                      {localizeStaffText(row.roleTitle, locale, "role")} ·{" "}
                      {row.currentLevel} → {row.targetLevel}
                    </div>
                  </div>
                  <span>{row.progress}%</span>
                </Link>
              ))}
          </div>
        </section>
      ) : !active ? (
        <>
          <section className="panel org-leadership">
            <h2>{t("org_leadership")}</h2>
            <p className="muted">{t("org_leadership_note")}</p>
            <PositionList items={structure.leadership} />
          </section>

          <section className="panel" style={{ marginTop: 18 }}>
            <h2>
              {t("org_departments")} · {structure.departments.length}
            </h2>
            <p className="muted">{t("employees_by_dept_note")}</p>
            <div className="dept-grid">
              {structure.departments.map((department) => {
                const count =
                  department.direct.length +
                  department.children.reduce(
                    (sum, child) => sum + child.positions.length,
                    0,
                  );
                return (
                  <button
                    key={department.key}
                    type="button"
                    className="dept-card"
                    onClick={() => setSelectedDept(department.key)}
                  >
                    <span className="org-dept-code">
                      AGM/{department.key}
                    </span>
                    <strong>
                      {localizeStaffText(
                        department.name,
                        locale,
                        "department",
                      )}
                    </strong>
                    <span className="muted">
                      {count} {t("org_positions")}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="staff-management-grid">
            <article className="panel">
              <h2>{t("staff_hire_title")}</h2>
              <p className="muted">{t("staff_hire_note")}</p>
              <form action={hireInternAction} className="stack-form">
                <label>
                  {t("staff_intern")}
                  <select name="employeeId" required defaultValue="">
                    <option value="" disabled>
                      {t("select")}
                    </option>
                    {interns.map((person) => (
                      <option
                        key={person.employeeId}
                        value={person.employeeId!}
                      >
                        {localizeStaffText(person.name, locale, "name")} —{" "}
                        {localizeStaffText(person.role, locale, "role")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("staff_vacant_role")}
                  <select name="positionId" required defaultValue="">
                    <option value="" disabled>
                      {t("select")}
                    </option>
                    {vacantPositions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {positionLabel(position)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">
                  {t("staff_hire_btn")}
                </button>
              </form>
            </article>

            <article className="panel">
              <h2>{t("staff_change_title")}</h2>
              <p className="muted">{t("staff_change_note")}</p>
              <form
                action={assignEmployeePositionAction}
                className="stack-form"
              >
                <label>
                  {t("col_employee")}
                  <select name="employeeId" required defaultValue="">
                    <option value="" disabled>
                      {t("select")}
                    </option>
                    {existingPeople.map((person) => (
                      <option
                        key={person.employeeId}
                        value={person.employeeId!}
                      >
                        {localizeStaffText(person.name ?? "", locale, "name")}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("staff_new_role")}
                  <select name="positionId" required defaultValue="">
                    <option value="" disabled>
                      {t("select")}
                    </option>
                    {vacantPositions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {positionLabel(position)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t("staff_change_type")}
                  <select name="mode" defaultValue="move">
                    <option value="move">{t("staff_move_role")}</option>
                    <option value="additional">
                      {t("staff_additional_role")}
                    </option>
                  </select>
                </label>
                <button type="submit" className="btn btn-primary">
                  {t("staff_change_btn")}
                </button>
              </form>
            </article>

            <article className="panel staff-dismiss-card">
              <h2>{t("staff_dismiss_title")}</h2>
              <p className="muted">{t("staff_dismiss_note")}</p>
              <form action={dismissPositionAction} className="stack-form">
                <label>
                  {t("staff_occupied_role")}
                  <select name="positionId" required defaultValue="">
                    <option value="" disabled>
                      {t("select")}
                    </option>
                    {occupiedPositions.map((position) => (
                      <option key={position.id} value={position.id}>
                        {positionLabel(position)} —{" "}
                        {localizeStaffText(
                          position.name ?? "",
                          locale,
                          "name",
                        )}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn-danger">
                  {t("staff_dismiss_btn")}
                </button>
              </form>
            </article>
          </section>
        </>
      ) : (
        <section className="org-department-view">
          {active.direct.length > 0 ? (
            <article className="panel org-section">
              <h2>{t("org_department_management")}</h2>
              <PositionList items={active.direct} />
            </article>
          ) : null}

          {active.children.map((child, index) => (
            <article key={child.name} className="panel org-section">
              <p className="eyebrow">
                {t("org_department_unit")} {index + 1}
              </p>
              <h2>
                {localizeStaffText(child.name, locale, "department")}
              </h2>
              <PositionList items={child.positions} />
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
