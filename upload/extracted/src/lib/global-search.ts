import "server-only";
import { like, or } from "drizzle-orm";
import { db } from "@/db/index";
import {
  assessments,
  attestations,
  candidates,
  competencies,
  employees,
  learningLessons,
  staffingPositions,
} from "@/db/schema";

export type SearchHit = {
  kind: string;
  title: string;
  meta: string;
  href: string;
};

export async function runGlobalSearch(q: string, limit = 8): Promise<SearchHit[]> {
  const query = q.trim();
  if (query.length < 2) return [];

  const pattern = `%${query}%`;
  const hits: SearchHit[] = [];

  const [cand, emps, tests, lessons, atts, roles, positions] = await Promise.all([
    db
      .select({
        id: candidates.id,
        name: candidates.name,
        status: candidates.status,
      })
      .from(candidates)
      .where(
        or(
          like(candidates.name, pattern),
          like(candidates.phone, pattern),
          like(candidates.telegram, pattern),
        ),
      )
      .limit(limit),
    db
      .select({
        id: employees.id,
        name: employees.name,
        roleTitle: employees.roleTitle,
        status: employees.status,
      })
      .from(employees)
      .where(
        or(
          like(employees.name, pattern),
          like(employees.roleTitle, pattern),
          like(employees.email, pattern),
        ),
      )
      .limit(limit),
    db
      .select({ id: assessments.id, title: assessments.title })
      .from(assessments)
      .where(like(assessments.title, pattern))
      .limit(limit),
    db
      .select({
        id: learningLessons.id,
        title: learningLessons.title,
        slug: learningLessons.slug,
      })
      .from(learningLessons)
      .where(like(learningLessons.title, pattern))
      .limit(limit),
    db
      .select({ id: attestations.id, title: attestations.title })
      .from(attestations)
      .where(like(attestations.title, pattern))
      .limit(limit),
    db
      .select({
        id: competencies.id,
        title: competencies.name,
        kind: competencies.kind,
      })
      .from(competencies)
      .where(like(competencies.name, pattern))
      .limit(limit),
    db
      .select({
        id: staffingPositions.id,
        title: staffingPositions.roleTitle,
        department: staffingPositions.department,
      })
      .from(staffingPositions)
      .where(
        or(
          like(staffingPositions.roleTitle, pattern),
          like(staffingPositions.department, pattern),
        ),
      )
      .limit(limit),
  ]);

  for (const row of cand) {
    hits.push({
      kind: "кандидат",
      title: row.name,
      meta: row.status,
      href: `/candidates/${row.id}`,
    });
  }
  for (const row of emps) {
    const isIntern = row.status === "intern" || row.status === "probation";
    hits.push({
      kind: isIntern ? "стажёр" : "сотрудник",
      title: row.name,
      meta: row.roleTitle,
      href: `/employees/${row.id}`,
    });
  }
  for (const row of tests) {
    hits.push({
      kind: "тест",
      title: row.title,
      meta: "",
      href: `/assessments/${row.id}`,
    });
  }
  for (const row of lessons) {
    hits.push({
      kind: "урок",
      title: row.title,
      meta: row.slug,
      href: `/learning?focus=lessons`,
    });
  }
  for (const row of atts) {
    hits.push({
      kind: "аттестация",
      title: row.title,
      meta: "",
      href: `/attestation/${row.id}`,
    });
  }
  for (const row of roles) {
    hits.push({
      kind: row.kind === "role" ? "должность" : "компетенция",
      title: row.title,
      meta: row.kind,
      href: `/competencies`,
    });
  }
  for (const row of positions) {
    hits.push({
      kind: "должность",
      title: row.title,
      meta: row.department || "",
      href: `/competencies`,
    });
  }

  const lower = query.toLowerCase();
  if (
    "отчёт".includes(lower) ||
    lower.includes("report") ||
    lower.includes("hisobot")
  ) {
    hits.push({
      kind: "отчёт",
      title: "Центр отчётов",
      meta: "",
      href: "/reports",
    });
  }
  if (
    "программа".includes(lower) ||
    lower.includes("program") ||
    lower.includes("dastur")
  ) {
    hits.push({
      kind: "программа",
      title: "Программы обучения",
      meta: "",
      href: "/learning?focus=programs",
    });
  }

  return hits.slice(0, 24);
}
