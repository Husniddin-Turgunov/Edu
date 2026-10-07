import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  akelaMcpHandlers,
  akelaMcpTools,
  mcpApiKey,
  rpcError,
  rpcResult,
  serverInfo,
  toolCallPayload,
  toolsListPayload,
  type JsonRpcRequest,
  type JsonRpcResponse,
} from "@/lib/ai/mcp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/mcp — Akela MCP serveri (JSON-RPC 2.0, Streamable HTTP).
 *
 * Metodlar: initialize · tools/list · tools/call · ping
 *
 * Autentifikatsiya (ikkalasidan biri):
 *   1) `x-api-key: <AKELA_MCP_API_KEY>`
 *   2) admin/grader sessiyasi (boshqaruvchi panelidan)
 *
 * Faqat O'QISH vositalari eksport qilinadi: hech qanday o'zgartirish yo'q.
 */
async function authorize(req: Request): Promise<{ ok: true } | { ok: false; response: Response }> {
  const apiKey = mcpApiKey();
  const provided = req.headers.get("x-api-key") || "";
  if (apiKey && provided && provided === apiKey) return { ok: true };

  const session = await getSession().catch(() => null);
  if (session?.userId) {
    const user = await db.user
      .findUnique({ where: { id: String(session.userId) }, select: { role: true, isActive: true } })
      .catch(() => null);
    if (user?.isActive && (user.role === "admin" || user.role === "grader")) return { ok: true };
  }

  if (!apiKey) {
    return {
      ok: false,
      response: Response.json(
        { ok: false, error: "AKELA_MCP_API_KEY .env da yo'q — MCP endpoint o'chirilgan" },
        { status: 503 },
      ),
    };
  }
  return {
    ok: false,
    response: Response.json(
      { ok: false, error: "Autentifikatsiya kerak: x-api-key yoki admin sessiya" },
      { status: 401 },
    ),
  };
}

export async function POST(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;

  let body: JsonRpcRequest | JsonRpcRequest[];
  try {
    body = await req.json();
  } catch {
    return Response.json(rpcError(null, -32700, "Parse error: JSON kutilgan"), { status: 400 });
  }

  const requests = Array.isArray(body) ? body : [body];

  const responses: JsonRpcResponse[] = [];
  for (const req of requests) {
    const id = req?.id ?? null;
    const method = String(req?.method || "");

    try {
      if (method === "initialize") {
        responses.push(rpcResult(id, serverInfo("akela-lms")));
        continue;
      }
      if (method === "ping") {
        responses.push(rpcResult(id, {}));
        continue;
      }
      if (method === "notifications/initialized" || method.startsWith("notifications/")) {
        continue; // bildirishnoma — javobsiz
      }
      if (method === "tools/list") {
        responses.push(rpcResult(id, toolsListPayload(akelaMcpTools())));
        continue;
      }
      if (method === "tools/call") {
        const name = String(req?.params?.name || "");
        const handler = akelaMcpHandlers[name];
        if (!handler) {
          responses.push(
            rpcResult(id, toolCallPayload(`Bunday vosita yo'q: ${name}`, true)),
          );
          continue;
        }
        const args = (req?.params?.arguments || {}) as Record<string, unknown>;
        const out = await handler(args);
        responses.push(rpcResult(id, toolCallPayload(out.text, !!out.isError)));
        continue;
      }
      responses.push(rpcError(id, -32601, `Method topilmadi: ${method}`));
    } catch (err: any) {
      responses.push(rpcResult(id, toolCallPayload(String(err?.message || "Xato"), true)));
    }
  }

  return Response.json(Array.isArray(body) ? responses : responses[0], {
    headers: { "cache-control": "no-store" },
  });
}

/** GET — endpoint haqida qisqa ma'lumot (oddiy brauzer tekshiruvi uchun). */
export async function GET(req: Request) {
  const auth = await authorize(req);
  if (!auth.ok) return auth.response;
  return Response.json({
    ok: true,
    ...serverInfo("akela-lms"),
    tools: akelaMcpTools().map((t) => t.name),
    usage: {
      initialize: { method: "POST", body: { jsonrpc: "2.0", id: 1, method: "initialize", params: {} } },
      toolsList: { method: "POST", body: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} } },
      toolsCall: {
        method: "POST",
        body: {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "akela.users", arguments: { query: "akbar" } },
        },
      },
    },
  });
}