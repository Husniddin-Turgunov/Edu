/**
 * Open platform accounts for every occupied staffing position.
 * Login = slug from должность; password = akela-{login}.
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { and, eq, isNotNull } from "drizzle-orm";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const CYR: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

function translit(input: string) {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => CYR[ch] ?? ch)
    .join("");
}

function loginFromRoleTitle(roleTitle: string) {
  const raw = translit(roleTitle)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
  return (raw || "employee").slice(0, 32);
}

async function main() {
  const { db } = await import("../db/index");
  const { employees, platformUsers, staffingPositions } = await import(
    "../db/schema"
  );
  const { ensureSchema } = await import("../db/seed");
  const {
    employeeAccountTypeForRoleTitle,
    hashPassword,
  } = await import("../lib/auth-core");

  await ensureSchema();

  const occupied = await db
    .select({
      employeeId: employees.id,
      name: employees.name,
      roleTitle: employees.roleTitle,
      department: employees.department,
      positionId: staffingPositions.id,
      login: platformUsers.login,
      userId: platformUsers.id,
      isActive: platformUsers.isActive,
    })
    .from(staffingPositions)
    .innerJoin(employees, eq(staffingPositions.employeeId, employees.id))
    .leftJoin(platformUsers, eq(platformUsers.employeeId, employees.id))
    .where(
      and(
        eq(staffingPositions.isActive, true),
        isNotNull(staffingPositions.employeeId),
      ),
    );

  // One account per employee (primary row preferred via first seen).
  const byEmployee = new Map<number, (typeof occupied)[number]>();
  for (const row of occupied) {
    if (!byEmployee.has(row.employeeId)) byEmployee.set(row.employeeId, row);
  }

  const usedLogins = new Set(
    (
      await db
        .select({ login: platformUsers.login })
        .from(platformUsers)
    ).map((r) => r.login.toLowerCase()),
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const report: string[] = [];

  for (const row of byEmployee.values()) {
    let login = loginFromRoleTitle(row.roleTitle).toLowerCase();
    if (usedLogins.has(login)) {
      login = `${login}_${row.employeeId}`.slice(0, 40);
    }
    while (usedLogins.has(login)) {
      login = `${login}x`.slice(0, 40);
    }

    const password = `akela-${login}`;
    const passwordHash = hashPassword(password);
    const accountType = employeeAccountTypeForRoleTitle(row.roleTitle);
    const role = accountType === "manager" ? "manager" : "participant";
    const participantKind = accountType === "manager" ? null : accountType;

    if (row.userId) {
      // Keep existing custom logins (hadmin, office, …); only ensure active.
      if (!row.isActive) {
        await db
          .update(platformUsers)
          .set({ isActive: true })
          .where(eq(platformUsers.id, row.userId));
        updated += 1;
        report.push(`ACTIVATE ${row.name} · ${row.login}`);
      } else {
        skipped += 1;
      }
      continue;
    }

    await db.insert(platformUsers).values({
      login,
      passwordHash,
      passwordPlain: password,
      role,
      participantKind,
      displayName: row.name,
      profileJobTitle: row.roleTitle,
      profileDepartment: row.department,
      employeeId: row.employeeId,
      candidateId: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    usedLogins.add(login);
    created += 1;
    report.push(
      `CREATE ${row.name} · ${row.roleTitle} · ${login} / ${password}`,
    );
  }

  console.log(`Employees with positions: ${byEmployee.size}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  for (const line of report) console.log(line);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
