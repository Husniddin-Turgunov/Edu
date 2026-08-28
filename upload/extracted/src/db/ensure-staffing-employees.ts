import staffing from "@/data/staffing.json";
import { db } from "./index";
import { employees } from "./schema";

function hueFromName(name: string) {
  let hue = 0;
  for (let i = 0; i < name.length; i++) {
    hue = (hue + name.charCodeAt(i) * 17) % 360;
  }
  return hue;
}

/** Create employee rows for staffing seats that share a name but have distinct emails. */
export async function ensureStaffingEmployees() {
  const people = await db.select().from(employees);
  const emailSet = new Set(
    people.map((person) => person.email.trim().toLowerCase()),
  );
  const seenSeatEmails = new Set<string>();
  let created = 0;

  for (const position of staffing.positions) {
    const email = String(position.email ?? "")
      .trim()
      .toLowerCase();
    const name = String(position.name ?? "").trim();
    if (!email || !name || seenSeatEmails.has(email)) continue;
    seenSeatEmails.add(email);
    if (emailSet.has(email)) continue;

    await db.insert(employees).values({
      name,
      email,
      department: position.department || "AKELA GROUP",
      roleTitle: position.role,
      currentLevel: "junior",
      avatarHue: hueFromName(name),
      createdAt: new Date().toISOString(),
    });
    emailSet.add(email);
    created += 1;
  }

  return { created };
}
