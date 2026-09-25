import "server-only";
import net from "node:net";
import tls from "node:tls";
import type {
  BitrixConfig,
  SmtpConfig,
  TelegramConfig,
  VerifixConfig,
} from "@/lib/integrations";

export type ClientResult = {
  ok: boolean;
  skipped?: boolean;
  message: string;
  error?: string;
  payload?: Record<string, unknown>;
};

async function readJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function telegramGetMe(
  config: TelegramConfig,
): Promise<ClientResult> {
  if (!config.token) {
    return { ok: false, skipped: true, message: "Токен Telegram не задан" };
  }
  const res = await fetch(
    `https://api.telegram.org/bot${config.token}/getMe`,
    { cache: "no-store" },
  );
  const body = await readJson(res);
  if (!res.ok || (typeof body === "object" && body && "ok" in body && !body.ok)) {
    return {
      ok: false,
      message: "Telegram не ответил",
      error: typeof body === "string" ? body : JSON.stringify(body),
    };
  }
  const username =
    typeof body === "object" && body && "result" in body
      ? String((body as { result?: { username?: string } }).result?.username ?? "")
      : "";
  return {
    ok: true,
    message: username ? `Подключено @${username}` : "Бот подключён",
    payload: { username },
  };
}

export async function telegramSendMessage(input: {
  config: TelegramConfig;
  chatId: string;
  text: string;
  buttons?: { text: string; callbackData: string }[];
}): Promise<ClientResult> {
  if (!input.config.token) {
    return { ok: false, skipped: true, message: "Токен Telegram не задан" };
  }
  if (!input.chatId) {
    return {
      ok: false,
      message: "Нет chat_id",
      error: "Кандидат должен написать боту, чтобы появился chat_id.",
    };
  }
  const payload: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
  };
  if (input.buttons?.length) {
    payload.reply_markup = {
      inline_keyboard: [
        input.buttons.map((btn) => ({
          text: btn.text,
          callback_data: btn.callbackData,
        })),
      ],
    };
  }
  const res = await fetch(
    `https://api.telegram.org/bot${input.config.token}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  const body = await readJson(res);
  if (!res.ok || (typeof body === "object" && body && "ok" in body && !body.ok)) {
    return {
      ok: false,
      message: "Отправка в Telegram не удалась",
      error: typeof body === "string" ? body : JSON.stringify(body),
      payload,
    };
  }
  return { ok: true, message: "Сообщение отправлено", payload };
}

export async function telegramAnswerCallback(
  config: TelegramConfig,
  callbackId: string,
  text: string,
) {
  if (!config.token) return;
  await fetch(
    `https://api.telegram.org/bot${config.token}/answerCallbackQuery`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, text }),
    },
  ).catch(() => undefined);
}

async function verifixToken(config: VerifixConfig) {
  const base = config.apiBase.replace(/\/$/, "");
  const url = `${base}${config.tokenPath.startsWith("/") ? "" : "/"}${config.tokenPath}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      filial_id: config.filialId,
      grant_type: "client_credentials",
    }),
  });
  const body = (await readJson(res)) as {
    access_token?: string;
    token?: string;
  };
  const token = body.access_token || body.token;
  if (!res.ok || !token) {
    throw new Error(
      typeof body === "string" ? body : JSON.stringify(body) || `HTTP ${res.status}`,
    );
  }
  return token;
}

export async function verifixRequest(input: {
  config: VerifixConfig;
  path: string;
  payload: Record<string, unknown>;
  operation: string;
}): Promise<ClientResult> {
  if (!input.config.apiBase || !input.config.clientId || !input.config.clientSecret) {
    return { ok: false, skipped: true, message: "Verifix не настроен" };
  }
  try {
    const token = await verifixToken(input.config);
    const base = input.config.apiBase.replace(/\/$/, "");
    const path = input.path.startsWith("/") ? input.path : `/${input.path}`;
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filial_id: input.config.filialId,
        ...input.payload,
      }),
    });
    const body = await readJson(res);
    if (!res.ok) {
      return {
        ok: false,
        message: `${input.operation}: HTTP ${res.status}`,
        error: typeof body === "string" ? body : JSON.stringify(body),
        payload: input.payload,
      };
    }
    return {
      ok: true,
      message: `${input.operation}: ок`,
      payload: { request: input.payload, response: body },
    };
  } catch (error) {
    return {
      ok: false,
      message: `${input.operation}: ошибка`,
      error: error instanceof Error ? error.message : String(error),
      payload: input.payload,
    };
  }
}

export async function verifixTestConnection(
  config: VerifixConfig,
): Promise<ClientResult> {
  if (!config.apiBase || !config.clientId || !config.clientSecret) {
    return { ok: false, skipped: true, message: "Verifix не настроен" };
  }
  try {
    await verifixToken(config);
    return { ok: true, message: "Авторизация Verifix успешна" };
  } catch (error) {
    return {
      ok: false,
      message: "Авторизация Verifix не удалась",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function bitrixUrl(config: BitrixConfig, method: string) {
  const hook = config.webhook.replace(/\/$/, "");
  return `${hook}/${method}`;
}

export async function bitrixCall(
  config: BitrixConfig,
  method: string,
  params: Record<string, unknown> = {},
): Promise<ClientResult> {
  if (!config.webhook) {
    return { ok: false, skipped: true, message: "Вебхук Bitrix24 не задан" };
  }
  const res = await fetch(bitrixUrl(config, method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });
  const body = (await readJson(res)) as {
    result?: unknown;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || body.error) {
    return {
      ok: false,
      message: `Bitrix ${method} не удался`,
      error: body.error_description || body.error || JSON.stringify(body),
      payload: params,
    };
  }
  return {
    ok: true,
    message: `Bitrix ${method}: ок`,
    payload: { result: body.result },
  };
}

export async function smtpTestConnection(
  config: SmtpConfig,
): Promise<ClientResult> {
  if (!config.host) {
    return { ok: false, skipped: true, message: "SMTP-хост не задан" };
  }
  const port = Number(config.port) || (config.secure ? 465 : 587);
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = config.secure
        ? tls.connect({ host: config.host, port, servername: config.host })
        : net.connect({ host: config.host, port });
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error("Таймаут подключения"));
      }, 8000);
      socket.once("connect", () => {
        clearTimeout(timer);
        socket.end();
        resolve();
      });
      socket.once("secureConnect", () => {
        clearTimeout(timer);
        socket.end();
        resolve();
      });
      socket.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    return { ok: true, message: `SMTP ${config.host}:${port} доступен` };
  } catch (error) {
    return {
      ok: false,
      message: "SMTP недоступен",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function encodeSmtp(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

class SmtpSession {
  private buffer = "";
  private pending: ((line: string) => void) | null = null;
  constructor(private socket: net.Socket) {
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.flush();
    });
  }

  private flush() {
    if (!this.pending) return;
    const lines = this.buffer.split("\r\n");
    if (lines.length < 2) return;
    // Keep last incomplete line.
    const complete = lines.slice(0, -1);
    this.buffer = lines[lines.length - 1] ?? "";
    const last = complete.reverse().find((line) => /^\d{3}(?: |$)/.test(line));
    if (!last) return;
    const wait = this.pending;
    this.pending = null;
    wait(last);
  }

  expect() {
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("SMTP timeout")), 12000);
      this.pending = (line) => {
        clearTimeout(timer);
        resolve(line);
      };
      this.flush();
    });
  }

  async command(cmd: string, ok: number[]) {
    this.socket.write(`${cmd}\r\n`);
    const line = await this.expect();
    const code = Number(line.slice(0, 3));
    if (!ok.includes(code)) throw new Error(line);
    return line;
  }

  end() {
    this.socket.end();
  }
}

export async function smtpSendMail(input: {
  config: SmtpConfig;
  to: string;
  subject: string;
  text: string;
}): Promise<ClientResult> {
  if (!input.config.host || !input.to) {
    return { ok: false, skipped: true, message: "SMTP не настроен или нет получателя" };
  }
  const port = Number(input.config.port) || (input.config.secure ? 465 : 587);
  const from = input.config.from || input.config.user;
  const useTls = input.config.secure || port === 465;
  const payload = [
    `From: ${from}`,
    `To: ${input.to}`,
    `Subject: =?UTF-8?B?${encodeSmtp(input.subject)}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    input.text.replace(/\n/g, "\r\n"),
    ".",
  ].join("\r\n");

  try {
    const socket: net.Socket = useTls
      ? tls.connect({ host: input.config.host, port, servername: input.config.host })
      : net.connect({ host: input.config.host, port });
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.once("connect", () => resolve());
      socket.once("secureConnect", () => resolve());
    });
    let session = new SmtpSession(socket);
    const greet = await session.expect();
    if (!greet.startsWith("220")) throw new Error(greet);
    await session.command("EHLO akela-assess", [250]);
    if (!useTls && port === 587) {
      await session.command("STARTTLS", [220]);
      const upgraded = tls.connect({
        socket,
        host: input.config.host,
        servername: input.config.host,
      });
      await new Promise<void>((resolve, reject) => {
        upgraded.once("error", reject);
        upgraded.once("secureConnect", () => resolve());
      });
      session = new SmtpSession(upgraded);
      await session.command("EHLO akela-assess", [250]);
    }
    if (input.config.user) {
      await session.command("AUTH LOGIN", [334]);
      await session.command(encodeSmtp(input.config.user), [334]);
      await session.command(encodeSmtp(input.config.password), [235]);
    }
    await session.command(`MAIL FROM:<${from}>`, [250]);
    await session.command(`RCPT TO:<${input.to}>`, [250, 251]);
    await session.command("DATA", [354]);
    await session.command(payload, [250]);
    await session.command("QUIT", [221, 250]).catch(() => undefined);
    session.end();
    return { ok: true, message: `Письмо отправлено на ${input.to}` };
  } catch (error) {
    return {
      ok: false,
      message: "Отправка почты не удалась",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
