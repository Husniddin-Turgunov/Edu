/**
 * Bitrix24 maqolalarini 3 tilda tarjima qiladi (ru -> uz, en).
 *
 *  - Barcha matn bloklari (P/H2/H3/UL/OL), TOC, «Коротко», sarlavhalar,
 *    breadcrumb va o'xshash maqolalar sarlavhalari tarjima qilinadi.
 *  - Google'da so'rovlar birlashtirilib (batch) yuboriladi — tezroq.
 *  - Natijada `public/bitrix-data/articles/<id>.<lang>.json` yoziladi.
 *  - Takrorlanish oldi olindi: tarjima qilingan matnlar `cache` ga saqlanadi.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:\\Users\\user\\Documents\\Ish\\ish kuni\\Osnova new\\akela-app";
const ART = path.join(ROOT, "public", "bitrix-data", "articles");
const CACHE = path.join(ROOT, "data", "tr-cache.json");
const LANGS = ["uz", "en"];
const SEP = " ⟦␟⟧ "; // bloklarni ajratuvchi belgi

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const writeJson = (p, v) =>
  fs.writeFileSync(p, JSON.stringify(v, null, 1), "utf8");

const cache = fs.existsSync(CACHE) ? readJson(CACHE) : {};
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Google orqali tarjima (batched) — har bir so'rovga 20s timeout */
async function translateBatch(lines, lang, attempt = 0) {
  const text = lines.join(SEP);
  const url =
    `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=ru&tl=${lang}` +
    `&q=${encodeURIComponent(text)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const raw = await res.json();
  const joined = Array.isArray(raw[0]) ? raw[0].map((x) => x[0]).join("") : String(raw);
  const parts = joined.split(SEP.trim()).map((s) => s.trim());
  if (parts.length !== lines.length) {
    if (attempt < 2) {
      await sleep(600 * (attempt + 1));
      return translateBatch(lines, lang, attempt + 1);
    }
    return lines.map(() => null);
  }
  return parts;
}

const ids = fs
  .readdirSync(ART)
  .filter((f) => /^\d+\.json$/.test(f))
  .map((f) => f.replace(".json", ""));

log("maqolalar:", ids.length);

/* ---- 1. Barcha noyob matnlarni yig'ib, to'plamlab tarjima qilamiz ---- */
const need = new Map(); // matn -> Set(maqolaId/lang)
for (const id of ids) {
  const a = readJson(path.join(ART, `${id}.json`));
  const push = (s) => {
    if (!s || typeof s !== "string") return;
    const t = s.trim();
    if (t.length < 2 || t.length > 3000) return;
    if (!need.has(t)) need.set(t, new Set());
    need.get(t).add(id);
  };
  push(a.title);
  (a.breadcrumb ?? []).forEach(push);
  (a.toc ?? []).forEach(push);
  push(a.short);
  for (const b of a.blocks) if (b.t) push(b.t);
}

const uniq = [...need.keys()].filter((t) => !cache[t]);
log("unikal matn:", need.size, "| tarjima qilinmagan:", uniq.length);

/** Matnlarni URL uzunligi chegasiga qarab bo'laklarga ajratadi (~1200 belgi) */
function chunkByLen(list, max = 1100) {
  const out = [];
  let cur = [];
  let len = 0;
  for (const s of list) {
    const add = s.length + SEP.length;
    if (cur.length && len + add > max) {
      out.push(cur);
      cur = [];
      len = 0;
    }
    cur.push(s);
    len += add;
  }
  if (cur.length) out.push(cur);
  return out;
}

let doneCount = 0;
for (const lang of LANGS) {
  const chunks = chunkByLen(uniq);
  log(`${lang}: ${chunks.length} bo'lak`);
  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    try {
      const res = await translateBatch(chunk, lang);
      res.forEach((tr, k) => {
        if (tr) cache[`${lang}|${chunk[k]}`] = tr;
      });
      doneCount += chunk.length;
      if (ci % 10 === 0) {
        writeJson(CACHE, cache);
        log(`  ${lang}: bo'lak ${ci}/${chunks.length} (matn ${doneCount})`);
      }
    } catch (e) {
      // bo'lakni bo'sh qoldirib, keyingisiga o'tamiz (takrorlashning ho'ji yo'q)
      log(`  ${lang} bo'lak ${ci} o'tkazildi: ${e.message.slice(0, 30)}`);
    }
    await sleep(220);
  }
  writeJson(CACHE, cache);
  log(`${lang} tugadi`);
}

/* ---- 2. Tarjimalarni maqolalarga yozamiz ---- */
const t = (s, lang) => {
  if (!s) return s;
  const hit = cache[`${lang}|${s.trim()}`];
  return typeof hit === "string" && hit.length ? hit : s;
};

let written = 0;
for (const id of ids) {
  const a = readJson(path.join(ART, `${id}.json`));
  for (const lang of LANGS) {
    const o = { ...a };
    o.title = t(a.title, lang);
    o.breadcrumb = (a.breadcrumb ?? []).map((x) => t(x, lang));
    o.toc = (a.toc ?? []).map((x) => t(x, lang));
    o.short = a.short ? t(a.short, lang) : a.short;
    o.blocks = a.blocks.map((b) => (b.t ? { ...b, t: t(b.t, lang) } : b));
    o.related = (a.related ?? []).map((r) => ({ ...r, t: t(r.t, lang) }));
    o.lang = lang;
    writeJson(path.join(ART, `${id}.${lang}.json`), o);
    written++;
  }
}

log("TUGADI. yozilgan fayl:", written, "| kesh:", Object.keys(cache).length);
