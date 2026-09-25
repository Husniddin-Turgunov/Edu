import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index";
import { candidates, vacancies } from "@/db/schema";
import {
  getStoredConfig,
  logAndRun,
  sendTelegramToChat,
  writeIntegrationLog,
} from "@/db/integrations";
import { telegramAnswerCallback } from "@/lib/integration-clients";
import { createCandidate, setInterviewConfirmStatus } from "@/db/queries";

export const dynamic = "force-dynamic";

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    from?: { username?: string; first_name?: string };
    text?: string;
    location?: { latitude: number; longitude: number };
    contact?: { phone_number: string; first_name?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { username?: string };
    message?: { chat: { id: number } };
  };
};

function secretOk(req: Request, expected: string, token: string) {
  const url = new URL(req.url);
  const given =
    url.searchParams.get("secret") ||
    req.headers.get("x-telegram-bot-api-secret-token") ||
    "";
  if (expected) return given === expected;
  if (token) return given === token.slice(-12);
  return true;
}

export async function POST(req: Request) {
  const config = await getStoredConfig("telegram");
  if (!secretOk(req, config.webhookSecret, config.token)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    if (update.callback_query?.data) {
      await handleCallback(update);
    } else if (update.message) {
      await handleMessage(update, config.formsEnabled, config.geoEnabled);
    }
    await writeIntegrationLog({
      system: "telegram",
      operation: "webhook",
      result: { ok: true, message: "Update processed" },
    });
  } catch (error) {
    await writeIntegrationLog({
      system: "telegram",
      operation: "webhook",
      result: {
        ok: false,
        message: "Webhook error",
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleCallback(update: TelegramUpdate) {
  const data = update.callback_query?.data ?? "";
  const chatId = String(update.callback_query?.message?.chat.id ?? "");
  const match = /^iv:(confirm|decline|reschedule):(\d+)$/.exec(data);
  if (!match) return;
  const status =
    match[1] === "confirm"
      ? "confirmed"
      : match[1] === "decline"
        ? "declined"
        : "reschedule";
  await setInterviewConfirmStatus(Number(match[2]), status);
  if (update.callback_query?.id) {
    const config = await getStoredConfig("telegram");
    await telegramAnswerCallback(
      config,
      update.callback_query.id,
      status === "confirmed" ? "Спасибо, подтвердили" : "Ответ записан",
    );
  }
  if (chatId) {
    await sendTelegramToChat({
      chatId,
      text:
        status === "confirmed"
          ? "Собеседование подтверждено. Ждём вас."
          : status === "declined"
            ? "Отметили, что вы не сможете прийти. HR свяжется с вами."
            : "Запрос на перенос отправлен HR.",
      operation: `interview_${status}`,
    });
  }
}

async function handleMessage(
  update: TelegramUpdate,
  formsEnabled: boolean,
  geoEnabled: boolean,
) {
  const message = update.message;
  if (!message) return;
  const chatId = String(message.chat.id);
  const text = (message.text ?? "").trim();

  if (message.from?.username) {
    const handle = `@${message.from.username}`;
    await db
      .update(candidates)
      .set({ telegram: chatId })
      .where(eq(candidates.telegram, handle));
    await db
      .update(candidates)
      .set({ telegram: chatId })
      .where(eq(candidates.telegram, message.from.username));
  }

  if (geoEnabled && message.location) {
    await logAndRun("telegram", "geolocation", async () => ({
      ok: true,
      message: `Геолокация ${message.location!.latitude},${message.location!.longitude}`,
      payload: { chatId, ...message.location },
    }));
    await sendTelegramToChat({
      chatId,
      text: "Геолокация получена, спасибо.",
      operation: "geo_ack",
    });
    return;
  }

  if (!formsEnabled) return;

  if (text === "/start" || text.toLowerCase() === "вакансии") {
    const open = await db.select().from(vacancies);
    const list = open
      .filter((row) => row.status === "open")
      .slice(0, 12)
      .map((row, index) => `${index + 1}. ${row.roleTitle}`)
      .join("\n");
    await sendTelegramToChat({
      chatId,
      text: list
        ? `Вакансии:\n${list}\n\nАнкета: ФИО | телефон | номер вакансии`
        : "Сейчас нет открытых вакансий. Напишите ФИО и телефон.",
      operation: "vacancies_list",
    });
    return;
  }

  if (message.contact || text.includes("|")) {
    const parts = message.contact
      ? [
          message.contact.first_name || message.from?.first_name || "Кандидат",
          message.contact.phone_number,
          "1",
        ]
      : text.split("|").map((part) => part.trim());
    const name = parts[0] || "Кандидат";
    const phone = parts[1] || "";
    const vacancyIndex = Number(parts[2] || "1");
    const open = (await db.select().from(vacancies)).filter(
      (row) => row.status === "open",
    );
    const vacancy = open[Math.max(0, vacancyIndex - 1)] ?? open[0];
    if (!vacancy) {
      await sendTelegramToChat({
        chatId,
        text: "Нет открытых вакансий для анкеты.",
        operation: "form_no_vacancy",
      });
      return;
    }
    await createCandidate({
      name,
      phone,
      telegram: chatId,
      source: "telegram",
      vacancyId: vacancy.id,
      notes: "Анкета из Telegram-бота",
    });
    await sendTelegramToChat({
      chatId,
      text: `Анкета принята. Вакансия: ${vacancy.roleTitle}. HR свяжется с вами.`,
      operation: "form_saved",
    });
  }
}
