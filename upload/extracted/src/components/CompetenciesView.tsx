"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import {
  createRoleProfileAction,
  importRoleCatalogExcelAction,
  syncRoleCatalogAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type RoleRow = {
  id: number;
  code: string;
  roleTitle: string;
  department: string;
  managerName: string;
  description: string;
  isActive: boolean;
  seatCount: number;
  filledCount: number;
  vacantSeats: number;
  activeVacancies: number;
  competencyCount: number;
};

type Level = {
  id: number;
  code: string;
  name: string;
  minScore: number;
  maxScore: number;
  description: string;
  nextSteps: string;
};

export function CompetenciesView({
  roles,
  levels,
}: {
  roles: RoleRow[];
  levels: Level[];
}) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const copy =
    locale === "uz"
      ? {
          search: "Qidiruv",
          sync: "Shtatdan yangilash",
          create: "Lavozim yaratish",
          importExcel: "Excel yuklash",
          showArchived: "Arxivni ko‘rsatish",
          vacancies: "Bo‘sh o‘rinlar",
          comps: "Kompetensiyalar",
          seats: "Shtat",
          scale: "Daraja shkalasi",
          empty: "Lavozimlar yo‘q — shtatdan yangilang yoki yarating",
          code: "Kod",
          role: "Lavozim",
          dept: "Bo‘lim",
          manager: "Rahbar",
          desc: "Tavsif",
        }
      : locale === "en"
        ? {
            search: "Search",
            sync: "Sync from staffing",
            create: "Create position",
            importExcel: "Upload Excel",
            showArchived: "Show archived",
            vacancies: "Open seats",
            comps: "Competencies",
            seats: "Headcount",
            scale: "Level scale",
            empty: "No positions yet — sync staffing or create one",
            code: "Code",
            role: "Role",
            dept: "Department",
            manager: "Manager",
            desc: "Description",
          }
        : {
            search: "Поиск",
            sync: "Обновить из штатки",
            create: "Создать должность",
            importExcel: "Загрузить Excel",
            showArchived: "Показать архив",
            vacancies: "Вакансии",
            comps: "Компетенции",
            seats: "Штат",
            scale: "Шкала уровней",
            empty: "Нет должностей — обновите из штатки или создайте",
            code: "Код",
            role: "Должность",
            dept: "Подразделение",
            manager: "Руководитель",
            desc: "Описание",
          };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roles.filter((row) => {
      if (!showArchived && !row.isActive) return false;
      if (!q) return true;
      return (
        row.roleTitle.toLowerCase().includes(q) ||
        row.department.toLowerCase().includes(q) ||
        row.code.toLowerCase().includes(q) ||
        row.managerName.toLowerCase().includes(q)
      );
    });
  }, [roles, query, showArchived]);

  return (
    <AppShell pathname="/competencies">
      <PageHeader
        title={t("competencies_title")}
        subtitle={t("competencies_subtitle")}
      />

      <section
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={copy.search}
          style={{ minWidth: 220, flex: "1 1 220px" }}
        />
        <form action={syncRoleCatalogAction}>
          <button type="submit" className="btn btn-ghost">
            {copy.sync}
          </button>
        </form>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setCreateOpen((value) => !value)}
        >
          {copy.create}
        </button>
        <form
          action={importRoleCatalogExcelAction}
          encType="multipart/form-data"
          style={{ display: "flex", gap: 8, alignItems: "center" }}
        >
          <input type="file" name="file" accept=".xlsx,.xls,.csv" required />
          <button type="submit" className="btn btn-ghost">
            {copy.importExcel}
          </button>
        </form>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          {copy.showArchived}
        </label>
      </section>

      {createOpen ? (
        <article className="panel" style={{ marginBottom: 16, maxWidth: 720 }}>
          <h2 style={{ marginTop: 0 }}>{copy.create}</h2>
          <form action={createRoleProfileAction} className="stack-form">
            <label>
              {copy.code}
              <input name="code" placeholder="optional" />
            </label>
            <label>
              {copy.role}
              <input name="roleTitle" required />
            </label>
            <label>
              {copy.dept}
              <input name="department" required />
            </label>
            <label>
              {copy.manager}
              <input name="managerName" />
            </label>
            <label>
              {copy.desc}
              <textarea name="description" rows={2} />
            </label>
            <button type="submit" className="btn btn-primary">
              {copy.create}
            </button>
          </form>
        </article>
      ) : null}

      <section className="stack" style={{ gap: 10, marginBottom: 28 }}>
        {filtered.length === 0 ? (
          <p className="muted">{copy.empty}</p>
        ) : (
          filtered.map((row) => (
            <Link
              key={row.id}
              href={`/competencies/${row.id}`}
              className="list-item learn-role-card"
              style={{ opacity: row.isActive ? 1 : 0.55 }}
            >
              <span style={{ flex: 1 }}>
                <strong>
                  {localizeStaffText(row.roleTitle, locale, "role")}
                </strong>
                <span className="muted" style={{ display: "block" }}>
                  {localizeStaffText(row.department, locale, "department")}
                  {row.managerName ? ` · ${row.managerName}` : ""}
                  {" · "}
                  {row.code}
                </span>
              </span>
              <span className="muted" style={{ textAlign: "right" }}>
                {copy.seats}: {row.filledCount}/{row.seatCount}
                <br />
                {copy.vacancies}: {row.activeVacancies}
                <br />
                {copy.comps}: {row.competencyCount}
              </span>
            </Link>
          ))
        )}
      </section>

      <section>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            margin: "0 0 12px",
          }}
        >
          {copy.scale}
        </h2>
        <div className="card-grid">
          {levels.map((level) => (
            <article key={level.id} className="level-card" data-level={level.code}>
              <p className="score-range">
                {level.minScore}–{level.maxScore}%
              </p>
              <h3>{level.name}</h3>
              <p>{level.description}</p>
              <div className="next-steps">
                <strong>{t("next_steps")}</strong>
                <p>{level.nextSteps}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
