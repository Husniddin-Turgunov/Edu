/**
 * lib/ai/mcp.ts
 *
 * MCP (Model Context Protocol) — ikki yo'nalishda:
 *
 *  1) MIJOZ (agent vositalari): tashqi MCP serverlarga ulanadi.
 *     Konfiguratsiya: .env da MCP_SERVERS = [{"name":"brave","url":"https://..."}]
 *     Agent vositalari: mcp.servers, mcp.tools, mcp.call
 *
 *  2) SERVER (bu ilova MCP endpoint bo'ladi): /api/mcp
 *     JSON-RPC 2.0 — initialize, tools/list, tools/call.
 *     Akela ma'lumotini tashqi agentlarga o'qish uchun ochadi.
 *
 * Xavfsizlik: MCP serveri FAQAT o'qish vositalarini beradi (hech qanday
 * o'zgartirish yo'q) va `x-api-key` yoki admin sessiya bilan himoyalanadi.
 */

import { db } from "@/lib/db";

const TIMEOUT_MS = 25_000;

// ============================================================================
//  Konfiguratsiya
// ============================================================================

export type McpServerConfig = {
  name: string;
  url: string;
  /** qo'shimcha sarlavhalar, masalan {"Authorization": "Bearer ..."} */
  headers?: Record<string, string>;
  description?: string;
};

export function configuredServers(): McpServerConfig[] {
  const raw = String(process.env.MCP_SERVERS || "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s: any) => ({
        name: String(s?.name || "").trim(),
        url: String(s?.url || "").trim(),
        headers: s?.headers && typeof s.headers === "object" ? s.headers : undefined,
        description: String(s?.description || "").trim() || undefined,
      }))
      .filter((s) => s.name && /^https?:\/\//i.test(s.url));
  } catch {
    return [];
  }
}

export function mcpApiKey(): string {
  return String(process.env.AKELA_MCP_API_KEY || "").trim();
}

// ============================================================================
//  JSON-RPC yordamchilari (server + client uchun umumiy)
// ============================================================================

export const PROTOCOL_VERSION = "2025-06-18";

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: any;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

export function rpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

export function rpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export type McpToolDescriptor = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties?: Record<string, unknown>; required?: string[] };
};

export type McpToolHandler = (args: Record<string, any>) => Promise<{
  text: string;
  isError?: boolean;
}>;

export function serverInfo(name: string) {
  return {
    protocolVersion: PROTOCOL_VERSION,
    serverInfo: { name, version: "1.0.0" },
    capabilities: { tools: { listChanged: false } },
  };
}

export function toolsListPayload(tools: McpToolDescriptor[]) {
  return { tools };
}

export function toolCallPayload(text: string, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

// ============================================================================
//  CLIENT — tashqi MCP serverga so'rov
// ============================================================================

async function rpcCall(server: McpServerConfig, method: string, params: unknown, id: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(server.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(server.headers || {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    // Streamable-HTTP SSE javobini ham qabul qilamiz
    const payload = text.startsWith("event:") || text.startsWith("data:")
      ? text
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("")
      : text;
    const parsed = JSON.parse(payload || "{}");
    if (parsed?.error) throw new Error(parsed.error?.message || "MCP server xatosi");
    return parsed?.result;
  } finally {
    clearTimeout(timer);
  }
}

let idSeq = 0;
const nextId = () => ++idSeq;

export async function mcpListTools(serverName: string) {
  const server = configuredServers().find((s) => s.name === serverName);
  if (!server) throw new Error(`MCP server topilmadi: ${serverName}`);
  const result = await rpcCall(server, "tools/list", {}, nextId());
  const tools = Array.isArray(result?.tools) ? result.tools : [];
  return tools.map((t: any) => ({
    name: String(t?.name || ""),
    description: String(t?.description || ""),
    inputSchema: t?.inputSchema || { type: "object" },
  }));
}

export async function mcpCallTool(serverName: string, toolName: string, args: Record<string, unknown>) {
  const server = configuredServers().find((s) => s.name === serverName);
  if (!server) throw new Error(`MCP server topilmadi: ${serverName}`);
  const result = await rpcCall(server, "tools/call", { name: toolName, arguments: args || {} }, nextId());
  const content = Array.isArray(result?.content) ? result.content : [];
  const text = content
    .map((c: any) => (typeof c?.text === "string" ? c.text : JSON.stringify(c)))
    .join("\n")
    .slice(0, 12_000);
  return { text: text || JSON.stringify(result ?? {}).slice(0, 4000), isError: !!result?.isError };
}

// ============================================================================
//  SERVER — Akela'ni o'qish vositalari (faqat o'qish!)
// ============================================================================

export function akelaMcpTools(): McpToolDescriptor[] {
  return [
    {
      name: "akela.overview",
      description: "Platforma umumiy statistikasi: xodim, test, savol, topshirish, dars, kurs soni.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "akela.users",
      description: "Xodimlar ro'yxati. Ixtiyoriy filtrlar: query (ism/pochta/bo'lim), department, status, limit.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          department: { type: "string" },
          status: { type: "string", enum: ["pending", "approved", "rejected"] },
          limit: { type: "number" },
        },
      },
    },
    {
      name: "akela.tests",
      description: "Testlar ro'yxati: nom, holat, ko'rinish, savollar soni, o'tish balyi.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, status: { type: "string" }, limit: { type: "number" } },
      },
    },
    {
      name: "akela.courses",
      description: "Kurslar va ularning modullari/darslari (o'qish uchun).",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "number" } },
      },
    },
    {
      name: "akela.results",
      description: "Test natijalari: xodim, test, ball, baholash holati. Filtr: query, testId, limit.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, testId: { type: "string" }, limit: { type: "number" } },
      },
    },
    {
      name: "akela.accessRules",
      description: "Maxsus ko'rinish/ruxsat qoidalari: kim nimani ko'ra olmaydi.",
      inputSchema: { type: "object", properties: {} },
    },
  ];
}

export const akelaMcpHandlers: Record<string, McpToolHandler> = {
  "akela.overview": async () => {
    const [users, tests, questions, results, courses, lessons, rules] = await Promise.all([
      db.user.count(),
      db.test.count(),
      db.question.count(),
      db.testResult.count(),
      db.course.count(),
      db.lesson.count(),
      db.accessRule.count(),
    ]);
    const byStatus = await db.user.groupBy({ by: ["status"], _count: { _all: true } });
    return {
      text: JSON.stringify(
        {
          users,
          usersByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
          tests,
          questions,
          results,
          courses,
          lessons,
          accessRules: rules,
        },
        null,
        1,
      ),
    };
  },

  "akela.users": async (args) => {
    const limit = Math.min(Number(args?.limit) || 20, 100);
    const rows = await db.user.findMany({
      where: {
        ...(args?.department ? { department: { contains: args.department } } : {}),
        ...(args?.status ? { status: args.status } : {}),
        ...(args?.query
          ? {
              OR: [
                { name: { contains: args.query } },
                { surname: { contains: args.query } },
                { email: { contains: args.query } },
                { phone: { contains: args.query } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        surname: true,
        email: true,
        phone: true,
        department: true,
        position: true,
        role: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      text: rows
        .map(
          (u) =>
            `${[u.surname, u.name].filter(Boolean).join(" ") || u.email} — ${u.department || "bo'lim yo'q"}, ${u.position || "lavozim yo'q"} — ${u.email} (${u.status}, rol: ${u.role})`,
        )
        .join("\n") || "Topilmadi",
    };
  },

  "akela.tests": async (args) => {
    const limit = Math.min(Number(args?.limit) || 20, 100);
    const rows = await db.test.findMany({
      where: {
        ...(args?.status ? { status: args.status } : {}),
        ...(args?.query ? { title: { contains: args.query } } : {}),
      },
      select: {
        title: true,
        status: true,
        visibility: true,
        passScore: true,
        maxAttempts: true,
        _count: { select: { questions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return {
      text: rows
        .map(
          (t) =>
            `"${t.title}" — ${t.status}/${t.visibility} — ${t._count.questions} savol — o'tish ${t.passScore}%, urinishlar ${t.maxAttempts}`,
        )
        .join("\n") || "Topilmadi",
    };
  },

  "akela.courses": async (args) => {
    const limit = Math.min(Number(args?.limit) || 20, 50);
    const courses = await db.course.findMany({
      where: args?.query ? { title: { contains: args.query } } : undefined,
      select: {
        title: true,
        status: true,
        modules: {
          select: { title: true, lessons: { select: { title: true, status: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const text = courses
      .map((c) => {
        const mods = (c.modules || [])
          .map(
            (m) =>
              `   • ${m.title}: ${(m.lessons || [])
                .map((l) => `${l.title}${l.status !== "active" ? ` (${l.status})` : ""}`)
                .join(", ")}`,
          )
          .join("\n");
        return `${c.title} [${c.status}]\n${mods}`;
      })
      .join("\n");
    return { text: text || "Topilmadi" };
  },

  "akela.results": async (args) => {
    const limit = Math.min(Number(args?.limit) || 20, 100);
    const rows = await db.testResult.findMany({
      where: {
        ...(args?.testId ? { testId: args.testId } : {}),
        ...(args?.query
          ? {
              user: {
                OR: [
                  { name: { contains: args.query } },
                  { surname: { contains: args.query } },
                  { email: { contains: args.query } },
                ],
              },
            }
          : {}),
      },
      select: {
        score: true,
        passed: true,
        gradingStatus: true,
        startedAt: true,
        completedAt: true,
        user: { select: { name: true, surname: true, email: true } },
        test: { select: { title: true } },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });
    return {
      text: rows
        .map((r) => {
          const who = [r.user?.surname, r.user?.name].filter(Boolean).join(" ") || r.user?.email || "?";
          const when = (r.completedAt || r.startedAt).toISOString().slice(0, 16).replace("T", " ");
          return `${who} — "${r.test?.title}" — ${r.score}% — ${r.passed ? "o'tdi" : "otmadi"} — ${r.gradingStatus} — ${when}`;
        })
        .join("\n") || "Topilmadi",
    };
  },

  "akela.accessRules": async () => {
    const rows = await db.accessRule.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return {
      text: rows
        .map((r) => `${r.subjectType}:${r.subjectValue} → ${r.resourceType}:${r.resourceId} → ${r.effect}`)
        .join("\n") || "Maxsus qoida yo'q",
    };
  },
};