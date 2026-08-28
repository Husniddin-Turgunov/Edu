"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import {
  archiveRoleProfileAction,
  assignLessonToRoleProfileAction,
  copyRoleProgramAction,
  createSkillCompetencyAction,
  linkRoleCompetencyAction,
  unlinkRoleCompetencyAction,
  updateRoleProfileAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Detail = {
  profile: {
    id: number;
    code: string;
    roleTitle: string;
    department: string;
    managerName: string;
    description: string;
    duties: string;
    requirements: string;
    programs: string[];
    tools: string[];
    junior: {
      basicKnowledge: string;
      standardTasks: string;
      byInstruction: string;
      requiredPrograms: string;
      minKpi: string;
    };
    middle: {
      independentTasks: string;
      complexSituations: string;
      analysis: string;
      errorPrevention: string;
      responsibility: string;
      processImprovement: string;
      communication: string;
    };
    isActive: boolean;
    seatCount: number;
    filledCount: number;
    vacantSeats: number;
    activeVacancies: number;
  };
  competencies: Array<{
    linkId: number;
    competencyId: number;
    name: string;
    category: string;
    description: string;
    levelScope: string;
    verificationMethod: string;
    isRequired: boolean;
    weight: number;
    isCriticalError: boolean;
  }>;
  availableSkills: Array<{
    id: number;
    name: string;
    category: string;
  }>;
  materials: {
    entranceTest: { id: number; title: string; source: string } | null;
    fiveDayLessons: Array<{ id: number; title: string; slug: string }>;
    threeMonthLessons: Array<{
      id: number;
      title: string;
      slug: string;
      month: number;
    }>;
    practiceLessons: Array<{ id: number; title: string; slug: string }>;
    attestations: Array<{ id: number; title: string; department: string }>;
  };
  catalogRoles: Array<{ id: number; roleTitle: string }>;
  lessonOptions: Array<{ id: number; title: string }>;
};

function Field({
  label,
  name,
  defaultValue,
  rows,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label>
      {label}
      {rows ? (
        <textarea name={name} rows={rows} defaultValue={defaultValue ?? ""} />
      ) : (
        <input name={name} defaultValue={defaultValue ?? ""} />
      )}
    </label>
  );
}

export function RoleProfileDetailView({ detail }: { detail: Detail }) {
  const { t, locale } = useI18n();
  const { profile, competencies, availableSkills, materials } = detail;

  const copy =
    locale === "uz"
      ? {
          back: "Katalogga",
          save: "Saqlash",
          archive: "Arxivlash",
          restore: "Tiklash",
          junior: "Junior talablari",
          middle: "Middle talablari",
          comps: "Kompetensiyalar",
          addComp: "Kompetensiya qo‘shish",
          link: "Biriktirish",
          unlink: "Olib tashlash",
          materials: "Bog‘langan materiallar",
          entrance: "Kirish testi",
          five: "5 kunlik darslar",
          three: "3 oylik dastur",
          practice: "Amaliy topshiriqlar",
          attest: "Attestatsiya mezonlari",
          assignLesson: "Dars biriktirish",
          copyProgram: "Dasturni nusxalash",
          fromRole: "Qaysi lavozimdan",
          programs: "Dasturlar",
          tools: "Asboblar",
          critical: "Kritik xato",
          required: "Majburiy",
          none: "—",
        }
      : locale === "en"
        ? {
            back: "Back to catalog",
            save: "Save",
            archive: "Archive",
            restore: "Restore",
            junior: "Junior requirements",
            middle: "Middle requirements",
            comps: "Competencies",
            addComp: "Add competency",
            link: "Link",
            unlink: "Remove",
            materials: "Related materials",
            entrance: "Entrance test",
            five: "5-day lessons",
            three: "3-month program",
            practice: "Practical tasks",
            attest: "Attestation criteria",
            assignLesson: "Assign lesson",
            copyProgram: "Copy program",
            fromRole: "From role",
            programs: "Programs",
            tools: "Tools",
            critical: "Critical error",
            required: "Required",
            none: "—",
          }
        : {
            back: "К каталогу",
            save: "Сохранить",
            archive: "Архивировать",
            restore: "Восстановить",
            junior: "Требования Junior",
            middle: "Требования Middle",
            comps: "Компетенции",
            addComp: "Добавить компетенцию",
            link: "Назначить",
            unlink: "Убрать",
            materials: "Связанные материалы",
            entrance: "Входной тест",
            five: "Пятидневные уроки",
            three: "Трёхмесячная программа",
            practice: "Практические задания",
            attest: "Критерии аттестации",
            assignLesson: "Назначить урок",
            copyProgram: "Скопировать программу",
            fromRole: "С должности",
            programs: "Программы",
            tools: "Инструменты",
            critical: "Критическая ошибка",
            required: "Обязательная",
            none: "—",
          };

  return (
    <AppShell pathname="/competencies">
      <PageHeader
        title={localizeStaffText(profile.roleTitle, locale, "role")}
        subtitle={`${localizeStaffText(profile.department, locale, "department")} · ${profile.code}`}
      />

      <p style={{ marginTop: 0 }}>
        <Link href="/competencies" className="btn btn-ghost">
          {copy.back}
        </Link>
      </p>

      <form action={updateRoleProfileAction} className="stack" style={{ gap: 16, maxWidth: 980 }}>
        <input type="hidden" name="id" value={profile.id} />
        <article className="panel">
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <Field label="Должность" name="roleTitle" defaultValue={profile.roleTitle} />
            <Field
              label="Подразделение"
              name="department"
              defaultValue={profile.department}
            />
            <Field
              label="Руководитель"
              name="managerName"
              defaultValue={profile.managerName}
            />
            <p className="muted" style={{ margin: "28px 0 0" }}>
              Штат: {profile.filledCount}/{profile.seatCount} · Вакансии:{" "}
              {profile.activeVacancies}
            </p>
          </div>
          <div className="stack-form" style={{ marginTop: 12 }}>
            <Field
              label="Описание"
              name="description"
              defaultValue={profile.description}
              rows={2}
            />
            <Field
              label="Обязанности"
              name="duties"
              defaultValue={profile.duties}
              rows={3}
            />
            <Field
              label="Требования"
              name="requirements"
              defaultValue={profile.requirements}
              rows={3}
            />
            <Field
              label={copy.programs}
              name="programs"
              defaultValue={profile.programs.join(", ")}
            />
            <Field
              label={copy.tools}
              name="tools"
              defaultValue={profile.tools.join(", ")}
            />
          </div>
        </article>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          }}
        >
          <article className="panel">
            <h2 style={{ marginTop: 0 }}>{copy.junior}</h2>
            <div className="stack-form">
              <Field
                label="Базовые знания"
                name="junior_basicKnowledge"
                defaultValue={profile.junior.basicKnowledge}
                rows={2}
              />
              <Field
                label="Стандартные задачи"
                name="junior_standardTasks"
                defaultValue={profile.junior.standardTasks}
                rows={2}
              />
              <Field
                label="Работа по инструкции"
                name="junior_byInstruction"
                defaultValue={profile.junior.byInstruction}
                rows={2}
              />
              <Field
                label="Обязательные программы"
                name="junior_requiredPrograms"
                defaultValue={profile.junior.requiredPrograms}
              />
              <Field
                label="Минимальные KPI"
                name="junior_minKpi"
                defaultValue={profile.junior.minKpi}
              />
            </div>
          </article>
          <article className="panel">
            <h2 style={{ marginTop: 0 }}>{copy.middle}</h2>
            <div className="stack-form">
              <Field
                label="Самостоятельные задачи"
                name="middle_independentTasks"
                defaultValue={profile.middle.independentTasks}
                rows={2}
              />
              <Field
                label="Сложные ситуации"
                name="middle_complexSituations"
                defaultValue={profile.middle.complexSituations}
                rows={2}
              />
              <Field
                label="Анализ"
                name="middle_analysis"
                defaultValue={profile.middle.analysis}
                rows={2}
              />
              <Field
                label="Предотвращение ошибок"
                name="middle_errorPrevention"
                defaultValue={profile.middle.errorPrevention}
                rows={2}
              />
              <Field
                label="Ответственность"
                name="middle_responsibility"
                defaultValue={profile.middle.responsibility}
              />
              <Field
                label="Улучшение процесса"
                name="middle_processImprovement"
                defaultValue={profile.middle.processImprovement}
              />
              <Field
                label="Коммуникация"
                name="middle_communication"
                defaultValue={profile.middle.communication}
              />
            </div>
          </article>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary">
            {copy.save}
          </button>
        </div>
      </form>

      <form action={archiveRoleProfileAction} style={{ marginTop: 10 }}>
        <input type="hidden" name="id" value={profile.id} />
        <input
          type="hidden"
          name="archive"
          value={profile.isActive ? "1" : "0"}
        />
        <button type="submit" className="btn btn-ghost">
          {profile.isActive ? copy.archive : copy.restore}
        </button>
      </form>

      <section className="stack" style={{ gap: 14, marginTop: 28, maxWidth: 980 }}>
        <article className="panel">
          <h2 style={{ marginTop: 0 }}>{copy.comps}</h2>
          {competencies.length === 0 ? (
            <p className="muted">{copy.none}</p>
          ) : (
            <div className="list" style={{ marginTop: 10 }}>
              {competencies.map((item) => (
                <div key={item.linkId} className="list-item">
                  <span style={{ flex: 1 }}>
                    <strong>{item.name}</strong>
                    <span className="muted" style={{ display: "block" }}>
                      {item.category} · {item.levelScope} · {item.verificationMethod}
                      {item.isRequired ? ` · ${copy.required}` : ""}
                      {item.isCriticalError ? ` · ${copy.critical}` : ""}
                      {" · вес "}
                      {item.weight}
                    </span>
                  </span>
                  <form action={unlinkRoleCompetencyAction}>
                    <input type="hidden" name="roleProfileId" value={profile.id} />
                    <input type="hidden" name="linkId" value={item.linkId} />
                    <button type="submit" className="btn btn-ghost">
                      {copy.unlink}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}

          {availableSkills.length > 0 ? (
            <form
              action={linkRoleCompetencyAction}
              className="stack-form"
              style={{ marginTop: 14 }}
            >
              <input type="hidden" name="roleProfileId" value={profile.id} />
              <label>
                {copy.link}
                <select name="competencyId" required>
                  {availableSkills.map((skill) => (
                    <option key={skill.id} value={skill.id}>
                      {skill.name} ({skill.category})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn btn-ghost">
                {copy.link}
              </button>
            </form>
          ) : null}

          <form
            action={createSkillCompetencyAction}
            className="stack-form"
            style={{ marginTop: 16 }}
          >
            <h3 style={{ margin: 0 }}>{copy.addComp}</h3>
            <input type="hidden" name="roleProfileId" value={profile.id} />
            <label>
              Название
              <input name="name" required />
            </label>
            <label>
              Категория
              <input name="category" placeholder="напр. продажи" />
            </label>
            <label>
              Описание
              <textarea name="description" rows={2} />
            </label>
            <div
              style={{
                display: "grid",
                gap: 8,
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              }}
            >
              <label>
                Уровень
                <select name="levelScope" defaultValue="all">
                  <option value="all">all</option>
                  <option value="junior">junior</option>
                  <option value="middle">middle</option>
                </select>
              </label>
              <label>
                Проверка
                <select name="verificationMethod" defaultValue="test">
                  <option value="test">test</option>
                  <option value="mentor">mentor</option>
                  <option value="practice">practice</option>
                  <option value="attestation">attestation</option>
                  <option value="other">other</option>
                </select>
              </label>
              <label>
                Вес
                <input name="weight" type="number" min={1} defaultValue={1} />
              </label>
            </div>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="isCriticalError" value="1" />
              {copy.critical}
            </label>
            <button type="submit" className="btn btn-primary">
              {copy.addComp}
            </button>
          </form>
        </article>

        <article className="panel">
          <h2 style={{ marginTop: 0 }}>{copy.materials}</h2>
          <p>
            <strong>{copy.entrance}:</strong>{" "}
            {materials.entranceTest ? (
              <Link href={`/assessments/${materials.entranceTest.id}`}>
                {materials.entranceTest.title}
              </Link>
            ) : (
              copy.none
            )}
          </p>
          <MaterialList title={copy.five} items={materials.fiveDayLessons} />
          <MaterialList title={copy.three} items={materials.threeMonthLessons} />
          <MaterialList title={copy.practice} items={materials.practiceLessons} />
          <div style={{ marginTop: 10 }}>
            <strong>{copy.attest}</strong>
            {materials.attestations.length === 0 ? (
              <p className="muted">{copy.none}</p>
            ) : (
              <ul>
                {materials.attestations.map((item) => (
                  <li key={item.id}>
                    <Link href={`/attestation/${item.id}`}>{item.title}</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form
            action={assignLessonToRoleProfileAction}
            className="stack-form"
            style={{ marginTop: 16 }}
          >
            <h3 style={{ margin: 0 }}>{copy.assignLesson}</h3>
            <input type="hidden" name="roleProfileId" value={profile.id} />
            <input type="hidden" name="roleTitle" value={profile.roleTitle} />
            <label>
              Урок
              <select name="lessonId" required>
                {detail.lessonOptions.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn-ghost">
              {copy.assignLesson}
            </button>
          </form>

          <form
            action={copyRoleProgramAction}
            className="stack-form"
            style={{ marginTop: 16 }}
          >
            <h3 style={{ margin: 0 }}>{copy.copyProgram}</h3>
            <input type="hidden" name="roleProfileId" value={profile.id} />
            <input type="hidden" name="targetRoleTitle" value={profile.roleTitle} />
            <label>
              {copy.fromRole}
              <select name="sourceRoleTitle" required>
                {detail.catalogRoles
                  .filter((row) => row.id !== profile.id)
                  .map((row) => (
                    <option key={row.id} value={row.roleTitle}>
                      {localizeStaffText(row.roleTitle, locale, "role")}
                    </option>
                  ))}
              </select>
            </label>
            <button type="submit" className="btn btn-ghost">
              {copy.copyProgram}
            </button>
          </form>

          <p style={{ marginTop: 14 }}>
            <Link href="/learning" className="btn btn-ghost">
              {t("nav_admin_learning")}
            </Link>
          </p>
        </article>
      </section>
    </AppShell>
  );
}

function MaterialList({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: number; title: string; slug?: string; month?: number }>;
}) {
  return (
    <div style={{ marginTop: 10 }}>
      <strong>{title}</strong>
      {items.length === 0 ? (
        <p className="muted">—</p>
      ) : (
        <ul>
          {items.slice(0, 12).map((item) => (
            <li key={item.id}>
              <Link href={`/learning?lesson=${item.id}`}>
                {item.title}
                {item.month ? ` · M${item.month}` : ""}
              </Link>
            </li>
          ))}
          {items.length > 12 ? (
            <li className="muted">+{items.length - 12}</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
