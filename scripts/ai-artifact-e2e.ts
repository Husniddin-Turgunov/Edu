/**
 * scripts/ai-artifact-e2e.ts — Faza 4 dalil: HTTP orqali artifact route va
 * chat integratsiyasi.
 *
 *   npx tsx --env-file=.env scripts/ai-artifact-e2e.ts
 *
 * Tekshiriladi:
 *  1) POST /api/ai/artifacts — sessiyasiz 401
 *  2) POST /api/ai/artifacts (admin) — dashboard yaratiladi, URL qaytadi
 *  3) GET /api/ai/artifacts/[id] — HTML + CSP sarlavhalari, skriptsiz
 *  4) Chat orqali "dashboard qil" — artifact.dashboard chaqiriladi, verified
 *  5) Chat tarixi artifact panelini saqlagan holda qaytaradi
 */

import { encodeSessionToken, SESSION_COOKIE } from "@/lib/auth-core";
import { db } from "@/lib/db";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

type Event = { type: string; [k: string]: any };

async function chat(message: string, cookie: string) {
  const res = await fetch(`${BASE}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `${SESSION_COOKIE}=${cookie}` },
    body: JSON.stringify({ message }),
  });
  const raw = await res.text();
  const events: Event[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("data:")) continue;
    const p = t.slice(5).trim();
    if (!p || p === "[DONE]") continue;
    try {
      events.push(JSON.parse(p));
    } catch {
      /* bo'lakli SSE */
    }
  }
  return { events, reply: String(events.find((e) => e.type === "reply")?.reply || "") };
}

async function main() {
  const admin: any = await db.user.findFirst({
    where: { role: "admin" },
    select: { id: true, email: true, name: true, surname: true, role: true },
  });
  if (!admin) throw new Error("Admin topilmadi");
  const cookie = encodeSessionToken(
    { userId: admin.id, email: admin.email, name: admin.name || "", surname: admin.surname || "", role: admin.role },
    1,
  );

  console.log("\n=== 1) Sessiyasiz POST — 401 ===");
  const noAuth = await fetch(`${BASE}/api/ai/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "dashboard", title: "Test" }),
  });
  check("401 qaytaradi", noAuth.status === 401, `status ${noAuth.status}`);

  console.log("\n=== 2) Admin POST — artifact yaratish ===");
  const created = await fetch(`${BASE}/api/ai/artifacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `${SESSION_COOKIE}=${cookie}` },
    body: JSON.stringify({
      kind: "dashboard",
      title: "E2E dashboard",
      kpis: [{ label: "Xodimlar", value: 47 }],
      charts: [{ title: "Bo'limlar", type: "bar", items: [{ label: "IT", value: 12 }] }],
      tables: [{ title: "Ro'yxat", headers: ["Xodim", "Ball"], rows: [["Alisher", 91]] }],
    }),
  });
  const createdJson: any = await created.json();
  check("201/200", created.ok, `status ${created.status}`);
  check("artifactId qaytdi", typeof createdJson?.artifact?.id === "string", createdJson?.artifact?.id || "");
  const id = createdJson?.artifact?.id;

  console.log("\n=== 3) GET artifact — HTML + CSP ===");
  const getRes = await fetch(`${BASE}/api/ai/artifacts/${id}`, { headers: { Cookie: `${SESSION_COOKIE}=${cookie}` } });
  const html = await getRes.text();
  check("200", getRes.ok, `status ${getRes.status}`);
  check("content-type html", (getRes.headers.get("content-type") || "").includes("text/html"));
  check(
    "CSP: default-src 'none'",
    (getRes.headers.get("content-security-policy") || "").includes("default-src 'none'"),
    getRes.headers.get("content-security-policy") || "",
  );
  check("X-Frame-Options SAMEORIGIN", getRes.headers.get("x-frame-options") === "SAMEORIGIN");
  check("nosniff", getRes.headers.get("x-content-type-options") === "nosniff");
  check("HTMLda skript yo'q", !/<script/i.test(html));
  check("SVG grafik bor", html.includes("<svg") && html.includes("<table"));

  console.log("\n=== 4) Chat orqali dashboard ===");
  const turn = await chat(
    "Bo'limlar kesimini choy diagrammasi bilan vizual dashboard qilib ko'rsat. KPI: xodimlar soni.",
    cookie,
  );
  const tools = turn.events.filter((e) => e.type === "step" && e.step?.type === "action").map((e) => e.step.tool);
  const results = turn.events
    .filter((e) => e.type === "step" && e.step?.type === "result")
    .map((e) => ({ tool: e.step.tool, ok: e.step.ok, verified: e.step.verified }));
  console.log(`  vositalar: ${tools.join(", ") || "(yo'q)"}`);
  console.log(`  javob: ${turn.reply.slice(0, 200)}`);
  check("artifact.dashboard chaqirildi", tools.includes("artifact.dashboard"), tools.join(", "));
  const art = results.find((r) => r.tool === "artifact.dashboard");
  check("artifact muvaffaqiyatli", art?.ok === true);
  check("tek shirildi", art?.verified !== undefined, String(art?.verified));

  console.log("\n=== 5) Chat tarixi — panel ma'lumoti saqlangan ===");
  const listRes = await fetch(`${BASE}/api/ai/chat`, { headers: { Cookie: `${SESSION_COOKIE}=${cookie}` } });
  const list: any = await listRes.json();
  const convId = list?.conversations?.[0]?.id;
  const histRes = await fetch(`${BASE}/api/ai/chat?conversationId=${encodeURIComponent(convId)}`, {
    headers: { Cookie: `${SESSION_COOKIE}=${cookie}` },
  });
  const hist: any = await histRes.json();
  const lastAssistant = [...(hist.messages || [])].reverse().find((m: any) => m.role === "assistant");
  const artifactStep = (lastAssistant?.actions || []).find(
    (a: any) => a.type === "result" && typeof a.tool === "string" && a.tool.startsWith("artifact."),
  );
  check("artifact step tarixda bor", !!artifactStep, artifactStep?.tool || "");
  check(
    "artifactUrl saqlangan (sahifa yangilansa ham panel chiqadi)",
    typeof artifactStep?.data?.artifactUrl === "string",
    artifactStep?.data?.artifactUrl || "",
  );

  console.log(`\n=== NATIJA: ${failed === 0 ? "BARCHASI O'TDI" : `${failed} ta xato`} ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("E2E xatosi:", err?.message || err);
  process.exit(1);
});