/**
 * Bitrix24 «Помощь» — TO'LIQ qayta yig'ish (bir marta, to'g'ri usul)
 *
 * Nima qiladi:
 *   1. data/bitrix-article-index.json dan TO'LIQ maqola ro'yxatini oladi
 *   2. har bir maqolani ochadi va DOM tartibida bloklarni yig'a_di
 *      (p / ul / ol / h2 / h3 / IMG) — rasm o'z joyida saqlanadi
 *   3. «Коротко», TOC (В этой статье), breadcrumb, muallif/sana, o'xshash maqolalarni ham oladi
 *   4. rasmlarni yuklab oladi
 *   5) data/bitrix-articles/ va public/bitrix-data/articles/ ga yozadi
 *   6) public/bitrix-data/index.json ni yangilaydi
 *
 * Ishga tushirish:  node scripts/bitrix-full.mjs
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:\\Users\\user\\Documents\\Ish\\ish kuni\\Osnova new\\akela-app";
const ART = path.join(ROOT, "data", "bitrix-articles");
const PUB = path.join(ROOT, "public", "bitrix-data", "articles");
const IMG = path.join(ROOT, "public", "bitrix-img");
const META = path.join(ROOT, "data", "article-meta.json");
const INDEX = path.join(ROOT, "public", "bitrix-data", "index.json");
for (const d of [ART, PUB, IMG]) fs.mkdirSync(d, { recursive: true });

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/** JSON faylni BOM'siz o'qish (PowerShell UTF8 BOM qo'shadi) */
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

const meta = readJson(META);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();

// --- sessiya cookie'larini yuklaymiz ---
const cookieFile = path.join(ART, "cookies.json");
if (fs.existsSync(cookieFile)) {
  const cookies = readJson(cookieFile);
  await ctx.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
      expires: c.expires > 0 ? c.expires : undefined,
      httpOnly: !!c.httpOnly,
      secure: !!c.secure,
    }))
  );
  log("cookie yuklandi:", cookies.length);
} else {
  log("OGOHLANTIRISH: cookies.json topilmadi — sessiya yo'q");
}

const page = await ctx.newPage();

const stats = { total: 0, ok: 0, fail: 0, images: 0, imgFail: 0 };

const ids = Object.keys(meta);
log("MAQOLALAR:", ids.length);

for (let i = 0; i < ids.length; i++) {
  const id = ids[i];
  stats.total++;
  try {
    await page.goto(`https://helpdesk.bitrix24.ru/widget2/open/${id}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(1200);

    const d = await page.evaluate(() => {
      const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
      const skip = "nav,header,[class*=menu],[class*=chat],[class*=side],[class*=search],[class*=breadcrumb]";

      // --- kontent bloklari: DOM tartibida, rasm o'z joyida ---
      // UL/OL ichidagi har bir <li> — alohida blok (birlashma yo'q!)
      const blocks = [];
      let imgN = 0;
      for (const el of document.querySelectorAll("p,ul,ol,h2,h3,img")) {
        if (el.closest(skip)) continue;
        if (el.tagName === "IMG") {
          const s = el.getAttribute("src") || "";
          if (!s || /logo|avatar|icon|badge|yandex|emoji/i.test(s)) continue;
          imgN++;
          blocks.push({ k: "IMG", n: imgN, src: s });
        } else if (el.tagName === "UL" || el.tagName === "OL") {
          const items = [...el.querySelectorAll(":scope > li")]
            .map((li) => clean(li.textContent))
            .filter((t) => t && t.length > 1);
          if (items.length) {
            const listKind = el.tagName;
            items.forEach((t) => blocks.push({ k: "LI", list: listKind, t }));
          } else {
            // <li> yo'q bo'lsa — ichki <p> yoki matn
            const t = clean(el.textContent);
            if (t && t.length > 1) blocks.push({ k: "LI", list: listKind, t });
          }
        } else {
          const t = clean(el.textContent);
          if (t && t.length > 1) blocks.push({ k: el.tagName.toUpperCase(), t });
        }
      }

      // --- breadcrumb ---
      const bc = [...document.querySelectorAll("a")]
        .filter((a) => (a.getAttribute("href") || "").includes("SOURCE_LINK_PLACE=MENU"))
        .map((a) => clean(a.textContent));

      // --- «В этой статье» (o'ng panel) ---
      const toc = [...document.querySelectorAll('[class*="toc"] a, [class*="article-detail__nav"] a')]
        .map((a) => clean(a.textContent)).filter(Boolean);

      // --- «Коротко» ---
      const shortEl = blocks.find((b) => b.k === "P" && /^Коротко/.test(b.t));
      const short = shortEl ? shortEl.t.replace(/^Коротко\s*/, "") : null;

      // --- muallif / sana / o'qish vaqti ---
      const metaTxt = [...document.querySelectorAll('[class*="article-detail__meta"] *, [class*="article-card__meta"] *')]
        .map((e) => clean(e.textContent)).filter((t) => t && t.length < 60);

      // --- «Похожие статьи» ---
      const related = [...document.querySelectorAll('a[href^="/open/"]')]
        .map((a) => ({ id: a.getAttribute("href").match(/\/open\/(\d+)/)?.[1], t: clean(a.textContent) }))
        .filter((x) => x.id);

      return { blocks, toc, short, metaTxt, related: related.slice(0, 12), bc: bc.slice(0, 6) };
    });

    if (!d.blocks || d.blocks.length < 4) {
      stats.fail++;
      log(`  ✗ ${id} — blok kam (${d.blocks?.length ?? 0})`);
      continue;
    }

    // --- rasmlarni yuklab olish ---
    const images = [];
    for (const b of d.blocks) {
      if (b.k !== "IMG") continue;
      const u = new URL(b.src, "https://helpdesk.bitrix24.ru").toString();
      const ext = (u.match(/\.(jpg|jpeg|png|gif|webp)/i) || [0, "jpg"])[1].toLowerCase();
      const fn = `${id}__${String(b.n).padStart(2, "0")}.${ext}`;
      const file = path.join(IMG, fn);
      if (!fs.existsSync(file)) {
        try {
          const res = await page.request.get(u);
          if (res.status() === 200) {
            fs.writeFileSync(file, await res.body());
          } else { stats.imgFail++; }
        } catch { stats.imgFail++; }
      }
      if (fs.existsSync(file)) {
        images.push({ n: b.n, local: `/bitrix-img/${fn}`, bytes: fs.statSync(file).size });
        stats.images++;
      }
      b.local = `/bitrix-img/${fn}`;
    }

    // --- saqlash ---
    const m = meta[id] || {};
    const out = {
      id,
      title: m.title || "",
      sectionId: m.sectionId || null,
      section: m.section || null,
      parent: m.parent || null,
      order: m.order ?? 999,
      short: d.short,
      toc: d.toc,
      breadcrumb: d.bc,
      articleMeta: [...new Set(d.metaTxt)].slice(0, 8),
      related: d.related,
      blocks: d.blocks,
      images,
    };
    const json = JSON.stringify(out, null, 1);
    fs.writeFileSync(path.join(ART, `${id}.json`), json, "utf8");
    fs.writeFileSync(path.join(PUB, `${id}.json`), json, "utf8");
    stats.ok++;
    if (stats.ok % 10 === 0) log(`  … ${stats.ok}/${ids.length} (rasm ${stats.images})`);
  } catch (e) {
    stats.fail++;
    log(`  ✗ ${id} — ${e.message.slice(0, 60)}`);
  }
}

/* ---------- indeksni yangilash ---------- */
const arts = [];
for (const id of Object.keys(meta)) {
  const f = path.join(ART, `${id}.json`);
  if (!fs.existsSync(f)) continue;
  try {
    const a = readJson(f);
    if (!a.blocks || a.blocks.length < 4) continue;
    const cover = a.blocks.find((b) => b.k === "IMG" && b.local)?.local ?? null;
    arts.push({
      id: a.id, title: a.title, sectionId: a.sectionId, section: a.section,
      parent: a.parent, order: a.order, blocks: a.blocks.length,
      images: a.images.length, cover,
    });
  } catch {}
}
arts.sort((x, y) => (x.order ?? 999) - (y.order ?? 999) || String(x.title).localeCompare(String(y.title)));
fs.writeFileSync(INDEX, JSON.stringify({ generatedAt: new Date().toISOString(), total: arts.length, articles: arts }, null, 1), "utf8");

await browser.close();
log("TUGADI", JSON.stringify(stats));
log("indeks:", arts.length, "maqola");
