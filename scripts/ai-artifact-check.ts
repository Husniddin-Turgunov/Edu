/**
 * scripts/ai-artifact-check.ts — Faza 4 dalil skripti.
 *
 *   npx tsx --env-file=.env scripts/ai-artifact-check.ts
 *
 * Tekshiriladi:
 *  1) escapeHtml — tegli matn HTML ga aylmaydi (XSS)
 *  2) sanitizeHtml — <script>, on*=, javascript:, <iframe>, data:text/html olib tashlanadi
 *  3) Lokal grafik — SVG chiqadi, CDN/JS/xonaviy URL yo'q
 *  4) Dashboard HTML — bloklar to'g'ri chiqadi (KPI, bar, donut, jadval)
 *  5) artifact.dashboard tool — bazada saqlanadi, verified: true
 *  6) artifact.code tool — kod escape qilingan holda saqlanadi
 *  7) verifyArtifact KAPOT — skriptli HTML tekshiruvdan o'tmaydi
 */

import {
  escapeHtml,
  sanitizeHtml,
  buildDashboardHtml,
  buildCodeHtml,
  barChartSvg,
  donutChartSvg,
  columnChartSvg,
} from "@/lib/ai/artifacts";
import { runTool, type ToolContext } from "@/lib/ai/tools";
import { verifyToolResult } from "@/lib/ai/verify";
import { db } from "@/lib/db";

let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) console.log(`  OK   ${name}${detail ? ` — ${detail}` : ""}`);
  else {
    failed++;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function realCtx(): Promise<ToolContext> {
  const admin: any = await db.user.findFirst({ where: { role: "admin" }, select: { id: true, email: true, role: true } });
  if (!admin) throw new Error("Admin topilmadi");
  return {
    actor: { userId: admin.id, email: admin.email, role: "admin", name: "Tekshiruv", isAdmin: true },
    conversationId: null,
    source: "api",
  };
}

async function main() {
  console.log("\n=== 1) escapeHtml — XSS ga qarshi ===");
  const evil = `<script>alert(1)</script> "onload='x'`;
  const safe = escapeHtml(evil);
  check("script tegiga aylanmadi", !safe.includes("<script"), safe);
  check("quote escape qilingan", safe.includes("&lt;script") && safe.includes("&quot;"), safe);

  console.log("\n=== 2) sanitizeHtml ===");
  const dirty = `<div onclick="steal()"><script>bad()</script><a href="javascript:bad()">x</a><iframe src="http://e"></iframe><img src="data:text/html;base64,AA"></div>`;
  const clean = sanitizeHtml(dirty);
  check("script yo'q", !/<script/i.test(clean));
  check("on* atributi yo'q", !/\son\w+\s*=/i.test(clean));
  check("javascript: URL yo'q", !/javascript:/i.test(clean));
  check("iframe yo'q", !/<iframe/i.test(clean));
  check("data:text/html yo'q", !/data:text\/html/i.test(clean));

  console.log("\n=== 3) Lokal grafik (SVG, CDN/JS yo'q) ===");
  const bars = barChartSvg([{ label: "IT", value: 12 }, { label: "Moliya", value: 7 }]);
  check("barChart SVG qaytardi", bars.startsWith("<svg") && bars.includes("</svg>"), `${bars.length} belgi`);
  const donut = donutChartSvg([{ label: "O'tgan", value: 30 }, { label: "Yiqilgan", value: 10 }]);
  check("donutChart SVG qaytardi", donut.startsWith("<svg") && donut.includes("<path"), `${donut.length} belgi`);
  const cols = columnChartSvg([{ label: "Yan", value: 5 }, { label: "Feb", value: 9 }]);
  check("columnChart SVG qaytardi", cols.startsWith("<svg") && cols.includes("<rect"), `${cols.length} belgi`);
  // `xmlns="http://www.w3.org/2000/svg"` — bu SVG NAMESPACE, tarmoq manbai
  // emas. Haqiqiy tashqi yuklanish `src=`/`href=`/`url()`/`@import` orqali bo'ladi.
  const svgs = bars + donut + cols;
  check(
    "tashqi manba yo'q (src/href/url/@import)",
    !/(src|href)\s*=/i.test(svgs) && !/url\(/i.test(svgs) && !/@import/i.test(svgs),
  );

  console.log("\n=== 4) Dashboard HTML ===");
  const html = buildDashboardHtml({
    title: "Test natijalari <script>alert(1)</script>",
    subtitle: "Oxirgi 30 kun",
    kpis: [{ label: "Xodimlar", value: 47 }, { label: "O'tish", value: 78, suffix: "%" }],
    bars: [{ title: "Bo'limlar", type: "bar", items: [{ label: "IT", value: 12 }] }],
    donut: { title: "Holat", items: [{ label: "O'tdi", value: 30 }] },
    tables: [{ title: "Top", headers: ["Xodim", "Ball"], rows: [["Alisher", 91]] }],
  });
  check("sarlavha escape qilingan", !html.includes("<script>alert"), "");
  check("KPI kartasi bor", html.includes("Xodimlar") && html.includes("47"));
  check("bar SVG bor", html.includes("<svg"));
  check("donut bor", html.includes("<path"));
  check("jadval bor", html.includes("<table") && html.includes("Alisher"));
  check("hech qanday script yo'q", !/<script/i.test(html));
  check("CSP-meta yo'q (sarlavhalar route'da)", !/http-equiv/i.test(html));

  console.log("\n=== 5) artifact.dashboard tool ===");
  const ctx = await realCtx();
  // Unikal sarlavha: idempotency himoyasi (5 daqiqa) bir xil args'ni
  // qayta qabul qilmasligi uchun — real hayotda model har safar boshqa
  // sarlavha beradi, skript ham shunday qiladi.
  const stamp = Date.now().toString(36);
  const dash = await runTool(
    "artifact.dashboard",
    {
      title: `Bo'limlar kesimi ${stamp}`,
      subtitle: "Real ma'lumotdan",
      kpis: [{ label: "Xodimlar", value: 47 }],
      charts: [{ title: "Bo'limlar", type: "bar", items: [{ label: "IT", value: 12 }, { label: "Moliya", value: 7 }] }],
      donut: { title: "Holatlar", items: [{ label: "O'tdi", value: 30 }, { label: "Yiqildi", value: 10 }] },
    },
    ctx,
  );
  check("dashboard yaratildi", dash.ok, dash.summary);
  check("verified = true", dash.verified === true, dash.verifyNote || "");
  const artifactId = String((dash.data as any)?.artifactId || "");
  check("artifactUrl qaytdi", typeof (dash.data as any)?.artifactUrl === "string");

  const row: any = await db.aiArtifact.findUnique({ where: { id: artifactId } });
  check("bazada saqlangan", !!row && row.html.length > 400, `${row?.html?.length} belgi`);
  check("bazadagi HTML skriptsiz", !/<script/i.test(String(row?.html || "")));

  console.log("\n=== 6) artifact.code tool ===");
  const code = await runTool(
    "artifact.code",
    { title: `SQL namunasi ${stamp}`, language: "sql", code: "select * from users where role = 'admin'; <script>x</script>" },
    ctx,
  );
  check("kod artifacti yaratildi", code.ok, code.summary);
  check("verified = true", code.verified === true, code.verifyNote || "");
  const codeRow: any = await db.aiArtifact.findUnique({ where: { id: String((code.data as any)?.artifactId) } });
  check("kod matni saqlangan", String(codeRow?.source || "").includes("select"), "");
  check("koddagi script escape qilingan", !/<script>x<\/script>/.test(String(codeRow?.html || "")));

  console.log("\n=== 7) verifyArtifact KAPOT ===");
  const unsafeId = "art_yoq_yoq";
  const missing = await verifyToolResult(
    "artifact.dashboard",
    {},
    ctx,
    { ok: true, summary: "t", data: { artifactId: unsafeId } } as any,
  );
  check("yo'q artifact tekshiruvdan o'tmaydi", missing.ok === false, missing.detail);

const dirtyRow = await db.aiArtifact.create({
    data: {
      ownerId: ctx.actor.userId,
      kind: "dashboard",
      title: "Xavfsiz emas",
      html: `<html><body onload="x()"><script>alert(1)</script>${"x".repeat(600)}</body></html>`,
    },
    select: { id: true },
  });
  const dirtyCheck = await verifyToolResult(
    "artifact.dashboard",
    {},
    ctx,
    { ok: true, summary: "t", data: { artifactId: dirtyRow.id } } as any,
  );
  check(
    "skriptli HTML tekshiruvdan o'tmaydi (panelda bo'sh sahifa bo'lmasin)",
    dirtyCheck.ok === false,
    dirtyCheck.detail,
  );

  console.log(`\n=== NATIJA: ${failed === 0 ? "BARCHASI O'TDI" : `${failed} ta xato`} ===\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Skript xatosi:", err?.message || err);
  process.exit(1);
});