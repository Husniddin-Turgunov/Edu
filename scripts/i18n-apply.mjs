/**
 * Qo'lda tarjima qilingan matnlarni saytga ulaydi.
 *  - data/i18n-sections.json  -> bo'lim nomlari
 *  - data/i18n/titles-*.json  -> maqola sarlavhalari
 *
 * Chiqaradi:
 *  - public/bitrix-data/index.<lang>.json
 *  - public/bitrix-data/articles/<id>.<lang>.json  (faqat tarjima qilingan qismlar)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = "C:\\Users\\user\\Documents\\Ish\\ish kuni\\Osnova new\\akela-app";
const I18N = path.join(ROOT, "data", "i18n");
const DATA = path.join(ROOT, "public", "bitrix-data");
const ART = path.join(DATA, "articles");
const LANGS = ["uz", "en"];

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
const writeJson = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1), "utf8");

/* --- tarjimalarni yig'ish --- */
const sections = readJson(path.join(ROOT, "data", "i18n-sections.json")).sections;

const titles = {};
for (const f of fs.readdirSync(I18N)) {
  if (!f.startsWith("titles-")) continue;
  Object.assign(titles, readJson(path.join(I18N, f)).titles);
}

/**
 * Bo'lim kaliti noyob bo'lishi uchun: agar maqolaning `parent` bo'lsa,
 * kalit = "Ota bo'lim > Bo'lim". Aks holda — oddiy nomi.
 * (Masalan "Начало работы" 10 ta turli bo'limda bor; bitta qilib
 *  aralashtirilsa, maqolalar noto'g'ri guruhlanadi.)
 */
const sectionKey = (a) => (a.parent ? `${a.parent} > ${a.section}` : a.section);

/* --- indeks --- */
const index = readJson(path.join(DATA, "index.json"));
for (const lang of LANGS) {
  const articles = index.articles.map((a) => {
    const key = sectionKey(a);
    const sec = sections[key] ?? sections[a.section];
    const title = titles[`${a.id}.${lang}`];
    return {
      ...a,
      sectionKey: key,
      section: sec ? sec[lang] : a.section,
      sectionRu: a.section,
      title: title || a.title,
      translated: Boolean(title && sec),
    };
  });
  writeJson(path.join(DATA, `index.${lang}.json`), {
    generatedAt: new Date().toISOString(),
    total: articles.length,
    translated: articles.filter((a) => a.translated).length,
    articles,
  });
}

/* --- maqolalar (faqat sarlavha + bo'lim) --- */
let n = 0;
for (const lang of LANGS) {
  for (const a of index.articles) {
    const src = path.join(ART, `${a.id}.json`);
    if (!fs.existsSync(src)) continue;
    const art = readJson(src);
    const key = sectionKey(a);
    const sec = sections[key] ?? sections[a.section];
    const out = {
      ...art,
      title: titles[`${a.id}.${lang}`] || art.title,
      section: sec ? sec[lang] : a.section,
      sectionKey: key,
      lang,
    };
    writeJson(path.join(ART, `${a.id}.${lang}.json`), out);
    n++;
  }
}

const keys = [...new Set(index.articles.map(sectionKey))];
const missing = keys.filter((k) => !sections[k]);
console.log("indeks: uz/en yozildi | maqola fayllari:", n);
console.log("tarjima qilingan sarlavhalar:", Object.keys(titles).length / 2);
console.log("bo'lim kalitlari:", keys.length, "| lug'atda yo'q:", missing.length);
if (missing.length) writeJson(path.join(ROOT, "data", "missing-sections.json"), missing);
