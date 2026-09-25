import { eq } from "drizzle-orm";
import staffing from "../data/staffing.json";
import { client, db } from "../db/index";
import { ensureSchema } from "../db/seed";
import { employees, vacancies } from "../db/schema";

type StaffItem = {
  code: string;
  role: string;
  department: string;
  name: string | null;
  email?: string | null;
};

function key(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/эли?вира/g, "эльвира")
    .replace(/\s+/g, " ")
    .trim();
}

function fallbackEmail(code: string, used: Set<string>) {
  const slug = code
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  let email = `${slug || "employee"}@akela.group`;
  let n = 2;
  while (used.has(email)) {
    email = `${slug || "employee"}.${n++}@akela.group`;
  }
  return email;
}

async function main() {
  await ensureSchema();

  const raw = staffing as {
    employees: StaffItem[];
    vacancies: StaffItem[];
  };

  const currentEmployees = await db.select().from(employees);
  const byName = new Map(currentEmployees.map((e) => [key(e.name), e]));
  const emailOwner = new Map(
    currentEmployees.map((e) => [e.email.toLowerCase(), e.id]),
  );
  const usedEmails = new Set(currentEmployees.map((e) => e.email.toLowerCase()));

  const uniquePeople = new Map<string, StaffItem>();
  for (const item of raw.employees) {
    if (!item.name) continue;
    const k = key(item.name);
    const previous = uniquePeople.get(k);
    if (!previous || (!previous.email && item.email)) {
      uniquePeople.set(k, item);
    }
  }

  let updated = 0;
  let inserted = 0;
  const retainedIds = new Set<number>();

  for (const item of uniquePeople.values()) {
    const existing = byName.get(key(item.name!));
    let email = (item.email || "").trim().toLowerCase();

    if (
      !email ||
      (emailOwner.has(email) && emailOwner.get(email) !== existing?.id)
    ) {
      email = fallbackEmail(item.code, usedEmails);
    }

    if (existing) {
      usedEmails.delete(existing.email.toLowerCase());
      usedEmails.add(email);
      emailOwner.set(email, existing.id);
      retainedIds.add(existing.id);
      await db
        .update(employees)
        .set({
          name: item.name!,
          email,
          department: item.department || "AKELA GROUP",
          roleTitle: item.role,
        })
        .where(eq(employees.id, existing.id));
      updated += 1;
    } else {
      usedEmails.add(email);
      const [created] = await db
        .insert(employees)
        .values({
          name: item.name!,
          email,
          department: item.department || "AKELA GROUP",
          roleTitle: item.role,
          currentLevel: "junior",
          avatarHue: Math.floor(Math.random() * 360),
          createdAt: new Date().toISOString(),
        })
        .returning();
      retainedIds.add(created.id);
      inserted += 1;
    }
  }

  // Remove obsolete people only when no history/account references them.
  let removed = 0;
  for (const old of currentEmployees) {
    if (retainedIds.has(old.id)) continue;
    const result = await client.execute({
      sql: `DELETE FROM employees
            WHERE id = ?
              AND NOT EXISTS (SELECT 1 FROM assignments WHERE employee_id = ?)
              AND NOT EXISTS (SELECT 1 FROM results WHERE employee_id = ?)
              AND NOT EXISTS (SELECT 1 FROM platform_users WHERE employee_id = ?)`,
      args: [old.id, old.id, old.id, old.id],
    });
    removed += Number(result.rowsAffected ?? 0);
  }

  const currentVacancies = await db.select().from(vacancies);
  const vacancyByCode = new Map(
    currentVacancies.map((v) => [v.code.trim().toLowerCase(), v]),
  );
  await client.execute("UPDATE vacancies SET status = 'closed'");

  let vacancyUpdated = 0;
  let vacancyInserted = 0;
  for (const item of raw.vacancies) {
    const codeKey = item.code.trim().toLowerCase();
    const existing = vacancyByCode.get(codeKey);
    if (existing) {
      await db
        .update(vacancies)
        .set({
          roleTitle: item.role,
          department: item.department || "AKELA GROUP",
          status: "open",
        })
        .where(eq(vacancies.id, existing.id));
      vacancyUpdated += 1;
    } else {
      await db.insert(vacancies).values({
        code: item.code,
        roleTitle: item.role,
        department: item.department || "AKELA GROUP",
        status: "open",
        createdAt: new Date().toISOString(),
      });
      vacancyInserted += 1;
    }
  }

  console.log({
    employees: { updated, inserted, removed, total: uniquePeople.size },
    vacancies: {
      updated: vacancyUpdated,
      inserted: vacancyInserted,
      open: raw.vacancies.length,
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
