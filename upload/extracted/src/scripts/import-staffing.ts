import fs from "fs";
import path from "path";
import { client, db } from "../db/index";
import {
  assignments,
  employees,
  results,
  vacancies,
} from "../db/schema";
import { seedIfEmpty } from "../db/seed";

type StaffItem = {
  code: string;
  role: string;
  department: string;
  name: string | null;
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

async function main() {
  await seedIfEmpty();

  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS vacancies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL DEFAULT '',
      role_title TEXT NOT NULL,
      department TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );
  `);

  const staffingPath = path.join(process.cwd(), "data", "staffing.json");
  const raw = JSON.parse(fs.readFileSync(staffingPath, "utf8")) as {
    employees: StaffItem[];
    vacancies: StaffItem[];
  };

  await db.delete(results);
  await db.delete(assignments);
  await db.delete(employees);
  await db.delete(vacancies);

  const seen = new Map<string, StaffItem>();
  for (const e of raw.employees) {
    if (!e.name) continue;
    const key = e.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, e);
  }

  const unique = [...seen.values()];
  let i = 1;
  for (const e of unique) {
    await db.insert(employees).values({
      name: e.name!,
      email: slugEmail(e.name!, i++),
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

  console.log(
    `Imported ${unique.length} employees and ${raw.vacancies.length} vacancies.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
