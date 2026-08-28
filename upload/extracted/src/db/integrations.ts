import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { integrationLogs, integrationSettings } from "./schema";
import {
  applySecretPreserves,
  isIntegrationSystem,
  mergeIntegrationConfig,
  maskIntegrationConfig,
  renderTemplate,
  storageEnvStatus,
  type IntegrationConfigMap,
  type IntegrationSystem,
} from "@/lib/integrations";
import {
  bitrixCall,
  smtpSendMail,
  smtpTestConnection,
  telegramGetMe,
  telegramSendMessage,
  verifixRequest,
  verifixTestConnection,
  type ClientResult,
} from "@/lib/integration-clients";
import { verifyLocalStorageAccess } from "@/lib/local-storage";

async function ready() {
  const { ensureDb } = await import("./queries");
  await ensureDb();
}

export async function getStoredConfig<K extends IntegrationSystem>(
  system: K,
): Promise<IntegrationConfigMap[K]> {
  await ready();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.system, system))
    .limit(1);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(row?.configJson || "{}") as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return mergeIntegrationConfig(system, parsed);
}

export async function getMaskedConfig(system: IntegrationSystem) {
  const config = await getStoredConfig(system);
  return maskIntegrationConfig(config as unknown as Record<string, unknown>);
}

export async function saveIntegrationConfig(
  system: IntegrationSystem,
  incoming: Record<string, unknown>,
) {
  await ready();
  const [row] = await db
    .select()
    .from(integrationSettings)
    .where(eq(integrationSettings.system, system))
    .limit(1);
  let stored: Record<string, unknown> = {};
  try {
    stored = JSON.parse(row?.configJson || "{}") as Record<string, unknown>;
  } catch {
    stored = {};
  }
  const merged = mergeIntegrationConfig(
    system,
    applySecretPreserves(incoming, stored),
  );
  const now = new Date().toISOString();
  if (row) {
    await db
      .update(integrationSettings)
      .set({ configJson: JSON.stringify(merged), updatedAt: now })
      .where(eq(integrationSettings.id, row.id));
  } else {
    await db.insert(integrationSettings).values({
      system,
      configJson: JSON.stringify(merged),
      updatedAt: now,
    });
  }
  return merged;
}

export async function writeIntegrationLog(input: {
  system: string;
  operation: string;
  result: ClientResult;
  retryOfId?: number | null;
}) {
  await ready();
  const [row] = await db
    .insert(integrationLogs)
    .values({
      system: input.system,
      operation: input.operation,
      result: input.result.skipped
        ? "skipped"
        : input.result.ok
          ? "ok"
          : "error",
      message: input.result.message,
      error: input.result.error ?? "",
      payloadJson: JSON.stringify(input.result.payload ?? {}),
      retryOfId: input.retryOfId ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listIntegrationLogs(filter?: {
  system?: string | null;
  limit?: number;
}) {
  await ready();
  const rows = await db
    .select()
    .from(integrationLogs)
    .orderBy(desc(integrationLogs.createdAt))
    .limit(filter?.limit ?? 80);
  if (!filter?.system) return rows;
  return rows.filter((row) => row.system === filter.system);
}

export async function getIntegrationLog(id: number) {
  await ready();
  const [row] = await db
    .select()
    .from(integrationLogs)
    .where(eq(integrationLogs.id, id))
    .limit(1);
  return row ?? null;
}

export function isSystemConfigured(system: IntegrationSystem, config: Record<string, unknown>) {
  if (system === "telegram") return Boolean(config.token);
  if (system === "verifix") {
    return Boolean(config.apiBase && config.clientId && config.clientSecret);
  }
  if (system === "bitrix") return Boolean(config.webhook);
  if (system === "smtp") return Boolean(config.host);
  if (system === "storage") {
    const env = storageEnvStatus();
    return (
      env.drive ||
      env.blob ||
      env.local ||
      Boolean(config.onedriveClientId) ||
      Boolean(config.localPath)
    );
  }
  return false;
}

export async function getIntegrationsOverview() {
  const systems: IntegrationSystem[] = [
    "telegram",
    "verifix",
    "bitrix",
    "smtp",
    "storage",
  ];
  const env = storageEnvStatus();
  const items = await Promise.all(
    systems.map(async (system) => {
      const config = (await getStoredConfig(system)) as unknown as Record<
        string,
        unknown
      >;
      return {
        system,
        configured: isSystemConfigured(system, config),
        driveOn: env.drive,
        sheetsOn: env.sheets,
        blobOn: env.blob,
        localOn: env.local,
      };
    }),
  );
  return { items, env };
}

export async function testIntegration(
  system: IntegrationSystem,
): Promise<ClientResult> {
  let result: ClientResult;
  if (system === "telegram") {
    result = await telegramGetMe(await getStoredConfig("telegram"));
  } else if (system === "verifix") {
    result = await verifixTestConnection(await getStoredConfig("verifix"));
  } else if (system === "bitrix") {
    result = await bitrixCall(await getStoredConfig("bitrix"), "profile.json");
  } else if (system === "smtp") {
    result = await smtpTestConnection(await getStoredConfig("smtp"));
  } else {
    const config = await getStoredConfig("storage");
    const env = storageEnvStatus();
    const localCheck = config.localPath?.trim()
      ? await verifyLocalStorageAccess()
      : env.local
        ? await verifyLocalStorageAccess()
        : null;
    const parts = [
      localCheck?.ok ? localCheck.message : null,
      env.drive ? "Google Drive" : null,
      env.sheets ? "Google Sheets" : null,
      env.blob ? "Vercel Blob" : null,
      config.onedriveClientId ? "OneDrive (ключи заданы)" : null,
      config.localPath && !localCheck?.ok ? `Локально: ${config.localPath}` : null,
    ].filter(Boolean);
    result = {
      ok: Boolean(localCheck?.ok || parts.length > 0),
      message: parts.length ? parts.join(" · ") : "Хранилище не настроено",
    };
  }
  await writeIntegrationLog({
    system,
    operation: "test_connection",
    result,
  });
  return result;
}

export async function logAndRun(
  system: string,
  operation: string,
  fn: () => Promise<ClientResult>,
) {
  try {
    const result = await fn();
    await writeIntegrationLog({ system, operation, result });
    return result;
  } catch (error) {
    const result: ClientResult = {
      ok: false,
      message: operation,
      error: error instanceof Error ? error.message : String(error),
    };
    await writeIntegrationLog({ system, operation, result });
    return result;
  }
}

export async function sendTelegramToChat(input: {
  chatId: string;
  text: string;
  buttons?: { text: string; callbackData: string }[];
  operation: string;
}) {
  const config = await getStoredConfig("telegram");
  return logAndRun("telegram", input.operation, () =>
    telegramSendMessage({
      config,
      chatId: input.chatId,
      text: input.text,
      buttons: input.buttons,
    }),
  );
}

export async function sendSmtp(input: {
  to: string;
  subject: string;
  text: string;
  operation: string;
}) {
  const config = await getStoredConfig("smtp");
  return logAndRun("smtp", input.operation, () =>
    smtpSendMail({
      config,
      to: input.to,
      subject: input.subject,
      text: input.text,
    }),
  );
}

export async function pushVerifix(input: {
  path: string;
  payload: Record<string, unknown>;
  operation: string;
}) {
  const config = await getStoredConfig("verifix");
  return logAndRun("verifix", input.operation, () =>
    verifixRequest({
      config,
      path: input.path,
      payload: input.payload,
      operation: input.operation,
    }),
  );
}

export async function retryIntegrationLog(id: number) {
  const row = await getIntegrationLog(id);
  if (!row) throw new Error("Запись журнала не найдена");
  if (!isIntegrationSystem(row.system)) {
    throw new Error("Повтор недоступен для этой системы");
  }
  const result = await testIntegration(row.system);
  await writeIntegrationLog({
    system: row.system,
    operation: `${row.operation}:retry`,
    result,
    retryOfId: row.id,
  });
  return result;
}

export function telegramChatId(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (/^-?\d+$/.test(trimmed)) return trimmed;
  return "";
}

function fillInviteTemplate(template: string, vars: Record<string, string>) {
  return renderTemplate(template, vars)
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n");
}

export async function notifyInterviewCreated(input: {
  interviewId: number;
  candidateName: string;
  candidateTelegram: string;
  scheduledAt: string;
  address: string;
  geoUrl: string;
  hrContact: string;
  comment: string;
}) {
  const config = await getStoredConfig("telegram");
  if (!config.notifyInterviews) {
    return { status: "skipped", note: "Уведомления выключены" };
  }
  const when = new Date(input.scheduledAt);
  const text = fillInviteTemplate(config.templateInvite, {
    name: input.candidateName,
    date: when.toLocaleDateString("ru-RU"),
    time: when.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
    address: input.address ? `Адрес: ${input.address}` : "",
    geo: config.geoEnabled && input.geoUrl ? `Геолокация: ${input.geoUrl}` : "",
    hr: input.hrContact ? `Контакт HR: ${input.hrContact}` : "",
    comment: input.comment ? `Комментарий: ${input.comment}` : "",
  });
  const chatId = telegramChatId(input.candidateTelegram);
  const send = await sendTelegramToChat({
    chatId,
    text,
    operation: `interview_invite:${input.interviewId}`,
    buttons: [
      { text: "Подтверждаю", callbackData: `iv:confirm:${input.interviewId}` },
      { text: "Не смогу прийти", callbackData: `iv:decline:${input.interviewId}` },
      { text: "Перенести", callbackData: `iv:reschedule:${input.interviewId}` },
    ],
  });
  return {
    channel: "telegram",
    status: send.ok ? "sent" : send.skipped ? "stub_queued" : "error",
    note: send.message,
    text,
    buttons: ["confirm", "decline", "reschedule"],
    queuedAt: new Date().toISOString(),
    error: send.error,
  };
}

export async function syncCandidateToVerifix(input: {
  candidateId: number;
  name: string;
  phone?: string;
  telegram?: string;
  status: string;
  vacancyTitle?: string;
}) {
  const config = await getStoredConfig("verifix");
  if (!config.transferCandidates) {
    return { skipped: true };
  }
  let mapping: Record<string, string> = {};
  try {
    mapping = JSON.parse(config.statusMapping) as Record<string, string>;
  } catch {
    mapping = {};
  }
  return pushVerifix({
    path: config.candidatesPath,
    operation: `candidate:${input.candidateId}`,
    payload: {
      external_id: input.candidateId,
      name: input.name,
      phone: input.phone ?? "",
      telegram: input.telegram ?? "",
      status: mapping[input.status] ?? input.status,
      vacancy: input.vacancyTitle ?? "",
    },
  });
}

export async function syncTestResultToVerifix(input: {
  candidateId: number;
  name: string;
  score: number;
  level: string;
  summary: string;
}) {
  const config = await getStoredConfig("verifix");
  if (!config.transferTestResults) return { skipped: true };
  return pushVerifix({
    path: config.resultsPath,
    operation: `test_result:${input.candidateId}`,
    payload: input,
  });
}

export async function syncHireToVerifix(input: {
  candidateId?: number;
  employeeId?: number;
  name: string;
  status: string;
}) {
  const config = await getStoredConfig("verifix");
  if (!config.hireEmployee) return { skipped: true };
  return pushVerifix({
    path: config.hirePath,
    operation: `hire:${input.employeeId ?? input.candidateId ?? 0}`,
    payload: input,
  });
}

export async function maybeCreateBitrixLearningTask(input: {
  title: string;
  description: string;
}) {
  const config = await getStoredConfig("bitrix");
  if (!config.autoCreateLearningTasks || !config.webhook) {
    return { skipped: true };
  }
  return logAndRun("bitrix", "task.create", () =>
    bitrixCall(config, "tasks.task.add.json", {
      fields: {
        TITLE: input.title,
        DESCRIPTION: input.description,
      },
    }),
  );
}

export { isIntegrationSystem };
