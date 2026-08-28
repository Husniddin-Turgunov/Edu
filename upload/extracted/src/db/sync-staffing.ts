import staffing from "@/data/staffing.json";
import { employeeImportKey } from "@/lib/staffing-match";
import { db } from "./index";
import {
  assignments,
  candidateAssignments,
  candidateResults,
  candidates,
  employees,
  results,
  vacancies,
} from "./schema";

type StaffItem = {
  code: string;
  role: string;
  department: string;
  name: string | null;
  email?: string | null;
};

function slugEmail(name: string, index: number) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 40);
  return `${base || "employee"}.${index}@akela.group`;
}

function hueFromName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * 17) % 360;
  return h;
}

/** Import Excel roster when vacancies are still empty (e.g. after deploy). */
export async function syncStaffingIfNeeded() {
  let existingVacancies: { id: number }[] = [];
  try {
    existingVacancies = await db.select({ id: vacancies.id }).from(vacancies);
  } catch {
    return;
  }
  if (existingVacancies.length > 0) return;

  const raw = staffing as {
    employees: StaffItem[];
    vacancies: StaffItem[];
  };

  await db.delete(candidateResults);
  await db.delete(candidateAssignments);
  await db.delete(candidates);
  await db.delete(results);
  await db.delete(assignments);
  await db.delete(employees);
  await db.delete(vacancies);

  const seen = new Map<string, StaffItem>();
  for (const e of raw.employees) {
    if (!e.name) continue;
    const key = employeeImportKey(e);
    if (!seen.has(key)) seen.set(key, e);
  }

  let i = 1;
  const usedEmails = new Set<string>();
  for (const e of seen.values()) {
    let email = (e.email || "").trim().toLowerCase();
    if (!email || usedEmails.has(email)) {
      email = slugEmail(e.name!, i);
    }
    while (usedEmails.has(email)) {
      i += 1;
      email = slugEmail(e.name!, i);
    }
    usedEmails.add(email);
    i += 1;
    await db.insert(employees).values({
      name: e.name!,
      email,
      department: e.department || "AKELA GROUP",
      roleTitle: e.role,
      currentLevel: "junior",
      avatarHue: hueFromName(e.name!),
      createdAt: new Date().toISOString(),
    });
  }

  for (const v of raw.vacancies) {
    await db.insert(vacancies).values({
      code: v.code || "",
      roleTitle: v.role,
      department: v.department || "AKELA GROUP",
      status: "open",
      createdAt: new Date().toISOString(),
    });
  }
}
