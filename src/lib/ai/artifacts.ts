/**
 * lib/ai/artifacts.ts
 *
 * Faza 4 — ARTIFACT: agent ko'rsatadigan vizual natija.
 *
 * Nima uchun kerak: foydalanuvchiga "jadvalson" deb aytganda chat ichida
 * yopiq `iframe` da ochiladigan mustaqil HTML hujjat kerak — dashboard,
 * diagramma yoki kod ko'rinishi. Claude/Gemini uslubidagi artifact panel.
 *
 * XAVFSIZLIK (bu tizimning asosiy sharti):
 *  1) HTML ichida **skript yo'q**: `sandbox` iframe skriptsiz ishlaydi va
 *     bizning HTML'imiz `<script>` umuman yo'q. Barcha grafik — **statik
 *     SVG** (lokal chizma kutubxonasi, CDN/JS yo'q).
 *  2) Barcha ma'lumot (sarlavha, bo'lim, xodim ismi, o'zbekcha harf)
 *     `escapeHtml` orqali o'tadi — hech qanday foydalanuvchi matni HTML
 *     tegiga aylana olmaydi.
 *  3) `sanitizeHtml` — tayyor HTML berilsa, `<script>`, `on*=`, `javascript:`,
 *     `<iframe>`, `<object>`, `<embed>` va `data:text/html` butunlay olib
 *     tashlanadi. Bu "LLM HTML qaytardi" yo'li uchun majburiy ogohlantirish.
 *  4) Route CSP sarlavhalarini ham beradi: `default-src 'none'; style-src
 *     'unsafe-inline'; img-src data:` — tashqi manba umuman yuklanmaydi.
 *
 * Cheklovlar: 1 artifact ≤ 200 qator/10 grafik, HTML ≤ 400 KB.
 */

export type ArtifactKind = "dashboard" | "code" | "html";

const MAX_HTML_BYTES = 400_000;
const MAX_ROWS = 200;
const MAX_BARS = 24;

/** Barcha dinamik matn shu orqali o'tadi. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Tayyor HTML ni tozalash.
 *
 * Diqqat: bu "to'liq sanitizer" emas — u tayyor HTML ni **chaqirilgan
 * kontekstda** xavfsizlashtiradi (skriptsiz iframe + `default-src 'none'`).
 * Ichki `<style>` va `<svg>` saqlanadi (dashboard uchun kerak).
 */
export function sanitizeHtml(html: string): string {
  let out = String(html || "");
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  out = out.replace(/<script\b[^>]*\/?>/gi, "");
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  out = out.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  out = out.replace(/<embed\b[^>]*>/gi, "");
  out = out.replace(/<link\b[^>]*>/gi, "");
  out = out.replace(/\shref\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, ' href="#"');
  out = out.replace(/\ssrc\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "");
  out = out.replace(/data:text\/html[^"'\s)]*/gi, "");
  return out;
}

const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const round1 = (v: number) => Math.round(v * 10) / 10;

type Palette = [string, string, string, string, string];
const PALETTES: Palette[] = [
  ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"],
  ["#0f766e", "#0891b2", "#7c3aed", "#db2777", "#65a30d"],
  ["#1d4ed8", "#7e22ce", "#be123c", "#b45309", "#0f766e"],
];

/** O'zbekcha vaqt/son formatlari. */
export function fmtNumber(v: unknown): string {
  const n = num(v, 0);
  return new Intl.NumberFormat("uz-UZ", { maximumFractionDigits: 1 }).format(n);
}

export function fmtPercent(v: unknown): string {
  return `${round1(num(v, 0))}%`;
}

// ============================================================================
//  LOKAL GRAFIK KUTUBXONASI (statik SVG, CDN/JS yo'q)
// ============================================================================

export type Bar = { label: string; value: number };

/** Gorizontal bar chart — SVG, 100% lokal. */
export function barChartSvg(bars: Bar[], opts: { height?: number; palette?: number; suffix?: string } = {}): string {
  const items = bars.slice(0, MAX_BARS);
  if (items.length === 0) return "";
  const height = opts.height ?? Math.max(120, items.length * 26 + 24);
  const palette = PALETTES[(opts.palette ?? 0) % PALETTES.length];
  const labelW = 168;
  const barW = 460;
  const max = Math.max(...items.map((b) => num(b.value)), 1);
  const gap = 6;

  const rows = items
    .map((b, i) => {
      const value = num(b.value, 0);
      const w = Math.max(2, Math.round((value / max) * barW));
      const y = 16 + i * 26;
      const color = palette[i % palette.length];
      return [
        `<text x="${labelW - 8}" y="${y + 12}" text-anchor="end" font-size="11" fill="#475569">${escapeHtml(
          String(b.label || "").slice(0, 28),
        )}</text>`,
        `<rect x="${labelW}" y="${y}" width="${barW}" height="14" rx="7" fill="#e2e8f0"/>`,
        `<rect x="${labelW}" y="${y}" width="${w}" height="14" rx="7" fill="${color}"/>`,
        `<text x="${labelW + w + 6}" y="${y + 12}" font-size="11" font-weight="600" fill="#0f172a">${escapeHtml(
          `${fmtNumber(value)}${opts.suffix || ""}`,
        )}</text>`,
      ].join("");
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${labelW + barW + 90} ${height}" width="100%" height="${height}" role="img">${rows}</svg>`;
}

/** Donut (ring) chart — segmentlar path orqali. */
export function donutChartSvg(bars: Bar[], opts: { size?: number; palette?: number } = {}): string {
  const items = bars.slice(0, MAX_BARS);
  if (items.length === 0) return "";
  const size = opts.size ?? 180;
  const r = size / 2 - 12;
  const cx = size / 2;
  const cy = size / 2;
  const palette = PALETTES[(opts.palette ?? 1) % PALETTES.length];
  const total = items.reduce((sum, b) => sum + Math.max(0, num(b.value)), 0) || 1;

  let angle = -Math.PI / 2;
  const segs = items
    .map((b, i) => {
      const value = Math.max(0, num(b.value));
      const frac = value / total;
      const a2 = angle + frac * Math.PI * 2;
      const large = frac > 0.5 ? 1 : 0;
      const x1 = cx + r * Math.cos(angle);
      const y1 = cy + r * Math.sin(angle);
      const x2 = cx + r * Math.cos(a2);
      const y2 = cy + r * Math.sin(a2);
      const d = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
      angle = a2;
      return `<path d="${d}" fill="${palette[i % palette.length]}" stroke="#ffffff" stroke-width="1"/>`;
    })
    .join("");

  const legend = items
    .slice(0, 8)
    .map((b, i) => {
      const y = cy - 60 + i * 16;
      return `<rect x="${cx + r + 14}" y="${y - 8}" width="9" height="9" rx="2" fill="${palette[i % palette.length]}"/><text x="${
        cx + r + 28
      }" y="${y}" font-size="10.5" fill="#475569">${escapeHtml(String(b.label || "").slice(0, 22))} · ${escapeHtml(
        fmtNumber(Math.round((num(b.value) / total) * 100)),
      )}%</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size * 1.9} ${size}" width="100%" height="${size}" role="img">${segs}${legend}</svg>`;
}

/** Vertikal (ustunli) chart — oylar/kunlar uchun. */
export function columnChartSvg(bars: Bar[], opts: { height?: number; palette?: number; suffix?: string } = {}): string {
  const items = bars.slice(0, MAX_BARS);
  if (items.length === 0) return "";
  const height = opts.height ?? 220;
  const width = 720;
  const padX = 34;
  const padTop = 14;
  const padBottom = 34;
  const plotH = height - padTop - padBottom;
  const max = Math.max(...items.map((b) => num(b.value)), 1);
  const slot = (width - padX * 2) / items.length;
  const barW = Math.max(6, Math.min(46, slot * 0.62));
  const palette = PALETTES[(opts.palette ?? 0) % PALETTES.length];

  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((f) => {
      const y = padTop + plotH - f * plotH;
      return `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${width - padX}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/><text x="4" y="${(y + 3).toFixed(1)}" font-size="9.5" fill="#94a3b8">${escapeHtml(
        fmtNumber(Math.round(max * f)),
      )}</text>`;
    })
    .join("");

  const columns = items
    .map((b, i) => {
      const value = num(b.value, 0);
      const h = Math.max(2, Math.round((value / max) * plotH));
      const x = padX + i * slot + (slot - barW) / 2;
      const y = padTop + plotH - h;
      return [
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h}" rx="3" fill="${
          palette[0]
        }" opacity="${(0.55 + 0.45 * (i / Math.max(1, items.length - 1))).toFixed(2)}"/>`,
        `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#334155">${escapeHtml(
          `${fmtNumber(value)}${opts.suffix || ""}`,
        )}</text>`,
        `<text x="${(x + barW / 2).toFixed(1)}" y="${height - 12}" text-anchor="middle" font-size="9.5" fill="#64748b">${escapeHtml(
          String(b.label || "").slice(0, 10),
        )}</text>`,
      ].join("");
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img">${grid}${columns}</svg>`;
}

// ============================================================================
//  ARTIFACT HTML QURISH
// ============================================================================

const BASE_CSS = `
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:"Segoe UI",system-ui,-apple-system,"Noto Sans",Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:18px}
.wrap{max-width:1100px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
h1{font-size:19px;margin:0;letter-spacing:-.01em}
.sub{font-size:12px;color:#64748b;margin-top:3px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
.kpi .v{font-size:22px;font-weight:700;letter-spacing:-.02em}
.kpi .l{font-size:11.5px;color:#64748b;margin-top:2px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px}
h2{font-size:13.5px;margin:0 0 8px;color:#0f172a}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef2f7}
th{color:#64748b;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.03em}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
pre{background:#0f172a;color:#e2e8f0;padding:12px;border-radius:10px;overflow:auto;font-size:12px;line-height:1.5;margin:0}
.badge{display:inline-block;font-size:10.5px;padding:2px 7px;border-radius:999px;background:#eef2ff;color:#4338ca;font-weight:600}
footer{font-size:10.5px;color:#94a3b8;text-align:center;padding-top:6px}
`;

function shell(title: string, subtitle: string, body: string, badge?: string): string {
  const html = `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title><style>${BASE_CSS}</style></head>
<body><div class="wrap">
<header><h1>${escapeHtml(title)}</h1>${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}${
    badge ? ` <span class="badge">${escapeHtml(badge)}</span>` : ""
  }</header>
${body}
<footer>Akela AI · ${new Date().toISOString().slice(0, 16).replace("T", " ")} · barcha grafik lokal SVG (tashqi kutubxonasiz)</footer>
</div></body></html>`;
  return html.length > MAX_HTML_BYTES ? html.slice(0, MAX_HTML_BYTES) : html;
}

export type Kpi = { label: string; value: number | string; suffix?: string };
export type TableSpec = { title?: string; headers: string[]; rows: (string | number | null)[][] };

/**
 * Dashboard artifact: KPI + bar/donut/ustun grafik + jadvallar.
 * Barcha grafik statik SVG — skriptsiz iframe'da ishlaydi.
 */
export function buildDashboardHtml(spec: {
  title: string;
  subtitle?: string;
  kpis?: Kpi[];
  /** Grafiklar (ichki nomi) */
  bars?: { title?: string; items: Bar[]; type?: "bar" | "column" }[];
  /** Grafiklar (API va model ishlatadigan nom) — `bars` bilan bir xil */
  charts?: { title?: string; items: Bar[]; type?: "bar" | "column" }[];
  donut?: { title?: string; items: Bar[] };
  tables?: TableSpec[];
  badge?: string;
}) {
  const body: string[] = [];

  if (spec.kpis?.length) {
    body.push(
      `<div class="kpis">${spec.kpis
        .slice(0, 8)
        .map((k) => {
          const value = typeof k.value === "number" ? `${fmtNumber(k.value)}${k.suffix || ""}` : escapeHtml(k.value);
          return `<div class="card kpi"><div class="v">${value}</div><div class="l">${escapeHtml(k.label)}</div></div>`;
        })
        .join("")}</div>`,
    );
  }

  const graphs = (spec.bars || spec.charts || []).slice(0, 4);
  if (graphs.length) {
    const cards = graphs
      .map((g, i) => {
        const svg = g.type === "column" ? columnChartSvg(g.items, { palette: i }) : barChartSvg(g.items, { palette: i });
        return `<div class="card">${g.title ? `<h2>${escapeHtml(g.title)}</h2>` : ""}${svg}</div>`;
      })
      .join("");
    body.push(`<div class="grid2">${cards}</div>`);
  }

  if (spec.donut?.items?.length) {
    body.push(
      `<div class="card">${spec.donut.title ? `<h2>${escapeHtml(spec.donut.title)}</h2>` : ""}${donutChartSvg(
        spec.donut.items,
      )}</div>`,
    );
  }

  for (const table of (spec.tables ?? []).slice(0, 3)) {
    const headers = table.headers.slice(0, 12);
    const rows = table.rows.slice(0, MAX_ROWS);
    body.push(
      `<div class="card">${table.title ? `<h2>${escapeHtml(table.title)}</h2>` : ""}<table><thead><tr>${headers
        .map((h, i) => `<th class="${i > 0 ? "num" : ""}">${escapeHtml(h)}</th>`)
        .join("")}</tr></thead><tbody>${rows
        .map(
          (r) =>
            `<tr>${headers
              .map((_, i) => {
                const cell = Array.isArray(r) ? r[i] : null;
                const isNum = typeof cell === "number";
                return `<td class="${i > 0 || isNum ? "num" : ""}">${escapeHtml(cell ?? "")}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("")}</tbody></table></div>`,
    );
  }

  return shell(spec.title, spec.subtitle || "", body.join("\n"), spec.badge);
}

/** Kod artifacti — syntax bo'yicha bo'yalgan `<pre>` (escape qilingan, skriptsiz). */
const KEYWORDS =
  /\b(const|let|var|function|return|if|else|for|while|class|new|async|await|import|export|from|default|try|catch|throw|typeof|null|true|false|this|extends|interface|type|public|private|readonly|def|print|select|from)\b/g;

export function buildCodeHtml(spec: {
  title: string;
  language?: string;
  code: string;
  note?: string;
}): string {
  const code = String(spec.code || "").slice(0, 60_000);
  const html = escapeHtml(code);
  const painted = html
    .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span style="color:#7dd3fc">$1</span>')
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#64748b">$1</span>')
    .replace(KEYWORDS, '<span style="color:#c4b5fd;font-weight:600">$&</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:#fbbf24">$1</span>');

  const lines = code.split("\n").length;
  const body = `<div class="card"><pre><code>${painted}</code></pre></div>
  <div class="card" style="font-size:12px;color:#475569">${lines} qator · ${escapeHtml(spec.language || "text")}${
    spec.note ? ` · ${escapeHtml(spec.note)}` : ""
  }</div>`;
  return shell(spec.title, "Kod ko'rinishi — skriptsiz sandbox", body, "KOD");
}

/** Erkin HTML — LLM qaytarsa, sanitizatsiyadan o'tadi. */
export function buildRawHtml(title: string, html: string, subtitle?: string): string {
  const clean = sanitizeHtml(html);
  return shell(title, subtitle || "", `<div class="card">${clean}</div>`, "HTML");
}

/** Chaqirish uchun yagona quruvchi. */
export function buildArtifact(kind: ArtifactKind, spec: any): string {
  if (kind === "code") return buildCodeHtml(spec);
  if (kind === "html") return buildRawHtml(spec.title, spec.html, spec.subtitle);
  return buildDashboardHtml(spec);
}