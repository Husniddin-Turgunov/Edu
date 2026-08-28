import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { auditLogs, platformUsers, systemSettings } from "./schema";
import {
  DEFAULT_SETTINGS,
  isSettingsSection,
  mergeSettings,
  NOTIFICATION_TYPE_FLAGS,
  type SettingsMap,
  type SettingsSection,
} from "@/lib/system-settings";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

export async function getSettingsSection<K extends SettingsSection>(
  section: K,
): Promise<SettingsMap[K]> {
  await ready();
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.section, section))
    .limit(1);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(row?.configJson || "{}") as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return mergeSettings(section, parsed);
}

export async function getPublicCompanySettings() {
  try {
    return await getSettingsSection("company");
  } catch {
    return DEFAULT_SETTINGS.company;
  }
}

export async function saveSettingsSection<K extends SettingsSection>(
  section: K,
  incoming: Record<string, unknown>,
) {
  await ready();
  const merged = mergeSettings(section, incoming);
  const now = new Date().toISOString();
  const [row] = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.section, section))
    .limit(1);
  if (row) {
    await db
      .update(systemSettings)
      .set({ configJson: JSON.stringify(merged), updatedAt: now })
      .where(eq(systemSettings.id, row.id));
  } else {
    await db.insert(systemSettings).values({
      section,
      configJson: JSON.stringify(merged),
      updatedAt: now,
    });
  }
  return merged;
}

export async function writeAuditLog(input: {
  actorUserId?: number | null;
  actorName?: string;
  action: string;
  target?: string;
  result?: string;
  detail?: string;
}) {
  await ready();
  await db.insert(auditLogs).values({
    actorUserId: input.actorUserId ?? null,
    actorName: input.actorName ?? "",
    action: input.action,
    target: input.target ?? "",
    result: input.result ?? "ok",
    detail: input.detail ?? "",
    createdAt: new Date().toISOString(),
  });
}

export async function listAuditLogs(limit = 80) {
  await ready();
  return db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function notificationEnabled(type: string) {
  const settings = await getSettingsSection("notifications");
  const flag = NOTIFICATION_TYPE_FLAGS[type];
  if (!flag) return true;
  return settings[flag];
}

export async function setPlatformUserActive(userId: number, isActive: boolean) {
  await ready();
  const [row] = await db
    .update(platformUsers)
    .set({ isActive })
    .where(eq(platformUsers.id, userId))
    .returning({
      id: platformUsers.id,
      login: platformUsers.login,
      displayName: platformUsers.displayName,
    });
  return row ?? null;
}

export { isSettingsSection };
