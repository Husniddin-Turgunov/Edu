/**
 * lib/ai/documents.ts
 *
 * Yuklangan manba fayllardan matn chiqarish. Loyihada fayl-matn parseri
 * yo'q edi, shuning uchun uchala tur yozildi:
 *   - ZIP o'quvchi (DOCX/XLSX ichida) вЂ” zlib dan foydalanib, tashqi paket yo'q
 *   - PDF o'quvchi (FlateDecode + matn operatorlari + ToUnicode jadvali)
 *   - oddiy matn / markdown / CSV
 *
 * Maqsad: tashlangan fayl haqiqiy manba bo'lsin, test esa faqat shu manbadan
 * yig'ilsin вЂ” ya'ni "internetdan ma'lumot aramasdan" rejimi ham ishlaydi.
 */

import { inflateRawSync, inflateSync } from "zlib";

export type ExtractedDoc = {
  text: string;
  parser: string;
  pageCount: number;
  charCount: number;
  wordCount: number;
  warning?: string;
};

// ============================================================================
//  ZIP o'quvchi (DOCX / XLSX ichida)
// ============================================================================

type ZipEntry = { name: string; data: Buffer };

function readZip(buffer: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  // EOCD imzosi 0x06054b50
  let eocd = -1;
  for (let i = buffer.length - 22; i >= 0 && i > buffer.length - 22 - 65_535; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error("ZIP fayl emas (EOCD topilmadi)");

  let entryCount = buffer.readUInt16LE(eocd + 10);
  let dirOffset = buffer.readUInt32LE(eocd + 16);

  // ZIP64 yordamchi yozuvi kerak bo'lsa
  if (dirOffset === 0xffffffff || entryCount === 0xffff) {
    for (let i = eocd - 20; i >= 0; i--) {
      if (buffer.readUInt32LE(i) === 0x07064b50) {
        const z64Offset = Number(buffer.readBigUInt64LE(i + 8));
        entryCount = Number(buffer.readBigUInt64LE(z64Offset + 32));
        dirOffset = Number(buffer.readBigUInt64LE(z64Offset + 48));
        break;
      }
    }
  }

  let p = dirOffset;
  for (let n = 0; n < entryCount && p + 46 <= buffer.length; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(p + 10);
    const compressedSize = buffer.readUInt32LE(p + 20);
    const nameLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const commentLen = buffer.readUInt16LE(p + 32);
    const localOffset = buffer.readUInt32LE(p + 42);
    const name = buffer.slice(p + 46, p + 46 + nameLen).toString("utf8");

    if (name.endsWith("/") || compressedSize === 0) {
      p += 46 + nameLen + extraLen + commentLen;
      continue;
    }

    try {
      const localNameLen = buffer.readUInt16LE(localOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLen + localExtraLen;
      const raw = buffer.slice(dataStart, dataStart + compressedSize);
      const data = method === 0 ? raw : inflateRawSync(raw);
      out.set(name, data);
    } catch {
      // buzilgan yozuvni o'tkazib ketamiz, qolganini o'qidiramiz
    }

    p += 46 + nameLen + extraLen + commentLen;
  }

  return out;
}

// ============================================================================
//  DOCX
// ============================================================================

function extractDocx(buffer: Buffer): ExtractedDoc {
  const zip = readZip(buffer);
  const docEntry = zip.get("word/document.xml");
  if (!docEntry) throw new Error("DOCX ichida word/document.xml topilmadi");

  const xml = docEntry.toString("utf8");
  const parts: string[] = [];

  // AVVAL paragraflarni ajratamiz (yopuvchi teglar hali joyida),
  // KEYIN har bir blok ichini tozalaymiz. Aks holda normalizatsiya
  // `</w:p>` ni o'chirib, regex hech narsa topolmaydi.
  const paragraphRe = /<w:p[\s>][\s\S]*?<\/w:p>|<w:p\/>/g;
  let m: RegExpExecArray | null;
  while ((m = paragraphRe.exec(xml)) !== null) {
    let block = m[0];
    // Jadvallar satrlarini ajratib ko'rsatish uchun (blok ichida)
    block = block
      .replace(/<w:tab\/>/g, "\t")
      .replace(/<w:br\/>/g, "\n")
      .replace(/<\/w:tc>/g, "\t")
      .replace(/<\/w:tr>/g, "\n");
    const texts: string[] = [];
    const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(block)) !== null) {
      texts.push(decodeXml(t[1]));
    }
    const line = texts.join("");
    if (line.trim()) parts.push(line);
  }

  // Sarlavha/izoh matnlari ham qo'shiladi (ixtiyoriy)
  for (const key of ["word/header1.xml", "word/header2.xml", "word/footer1.xml"]) {
    const extra = zip.get(key);
    if (!extra) continue;
    const extraTexts: string[] = [];
    const tRe = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(extra.toString("utf8"))) !== null) extraTexts.push(decodeXml(t[1]));
    const line = extraTexts.join("").trim();
    if (line) parts.push(line);
  }

  const text = normalizeText(parts.join("\n"));
  return finish(text, "docx", 0);
}

/**
 * PPTX slayd matnlari: `ppt/slides/slideN.xml` ichidagi `<a:t>` teglar.
 * DOCX parser bilan bir xil yondashuv (DrawingML).
 */
function extractPptx(buffer: Buffer): ExtractedDoc {
  const zip = readZip(buffer);
  const slideKeys = [...zip.keys()]
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml/)?.[1] || 0);
      const nb = Number(b.match(/slide(\d+)\.xml/)?.[1] || 0);
      return na - nb;
    });
  if (slideKeys.length === 0) throw new Error("PPTX ichida slayd topilmadi");

  const parts: string[] = [];
  slideKeys.forEach((key, idx) => {
    const xml = (zip.get(key) as Buffer).toString("utf8");
    const texts: string[] = [];
    const tRe = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
    let t: RegExpExecArray | null;
    while ((t = tRe.exec(xml)) !== null) {
      const line = decodeXml(t[1]);
      if (line.trim()) texts.push(line);
    }
    if (texts.length > 0) parts.push(`# Slayd ${idx + 1}\n${texts.join("\n")}`);
  });

  const text = normalizeText(parts.join("\n\n"));
  if (!text.trim()) throw new Error("PPTX slaydlarida matn topilmadi (faqat rasm bo'lishi mumkin)");
  return finish(text, "pptx", slideKeys.length);
}

/**
 * Eski .doc (OLE compound document): matn bo'laklari UTF-16LE ko'rinishida
 * saqlanadi. Oddiy va ishonchli usul — o'qiladigan satrlarni ajratib olish.
 * Murakkab formatlash yo'qoladi, lekin matn to'liq chiqadi.
 */
function extractDoc(buffer: Buffer): ExtractedDoc {
  // UTF-16LE matnni ajratish (WordDocument stream'dagi paragraflar)
  const text16 = buffer.toString("utf16le");
  const parts: string[] = [];
  // 4+ belgili o'qiladigan ketma-ketliklar (lotin/kirill/raqam/tinish)
  const re = /[A-Za-zА-Яа-яЁё0-9ЎўҒғҲҳҚқЎўʼ'‘’“”«».,;:!?()\[\]{}"“”@#$%&*+\-=\\/|<>~^_ \t]{4,}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text16)) !== null) {
    const line = m[0].replace(/\s+/g, " ").trim();
    // Faqat harf-raqam bo'lgan qatorlar (binary shovqin emas)
    if (line.length >= 8 && /[A-Za-zА-Яа-яЁёҒғ]{3,}/.test(line)) parts.push(line);
  }
  const text = normalizeText(parts.join("\n"));
  if (text.length < 20) {
    throw new Error(".doc fayldan matn ajratib bo'lmadi. Uni Word'da ochib .docx sifatida saqlang.");
  }
  return finish(text, "doc", 0);
}

function decodeXml(input: string) {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => safeCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function safeCharCode(code: number) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

// ============================================================================
//  PDF
// ============================================================================

type PdfObject = { dict: string; stream: string };

/**
 * PDF'ni obyektlar bo'yicha indekslaydi. Har bir obyekt uchun lug'at (dict)
 * va (agar mavjud bo'lsa) dekompress qilingan stream saqlanadi.
 *
 * Muhim: `endstream` kaliti ham `stream` bilan boshlanadi вЂ” haqiqiy `stream`
 * kalitlarini ajratib olish kerak, aks holda offsetlar siljib ketadi va
 * ToUnicode jadvallari topilmaydi.
 */
function indexObjects(buffer: Buffer): Map<number, PdfObject> {
  const latin = buffer.toString("latin1");
  const objects = new Map<number, PdfObject>();
  const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;

  while ((m = objRe.exec(latin)) !== null) {
    const num = Number(m[1]);
    const bodyStart = m.index + m[0].length;
    let bodyEnd = latin.indexOf("endobj", bodyStart);
    if (bodyEnd === -1) bodyEnd = bodyStart + 4000;

    const streamRel = latin.indexOf("stream", bodyStart);
    const hasStream = streamRel !== -1 && streamRel < bodyEnd;
    const dict = latin.slice(bodyStart, hasStream ? streamRel : bodyEnd);

    if (!hasStream) {
      objects.set(num, { dict, stream: "" });
      continue;
    }

    let dataStart = streamRel + 6;
    if (latin[dataStart] === "\r") dataStart++;
    if (latin[dataStart] === "\n") dataStart++;

    const endIdx = latin.indexOf("endstream", dataStart);
    let raw = endIdx === -1 ? buffer.slice(dataStart, bodyEnd) : buffer.slice(dataStart, endIdx);

    const declared = dict.match(/\/Length\s+(\d+)\s*$/);
    if (declared) {
      const len = Number(declared[1]);
      if (len > 0 && len <= raw.length) raw = raw.slice(0, len);
    }
    while (raw.length > 0 && (raw[raw.length - 1] === 0x0a || raw[raw.length - 1] === 0x0d)) {
      raw = raw.slice(0, -1);
    }

    let decoded = "";
    try {
      decoded = inflateSync(raw).toString("latin1");
    } catch {
      try {
        decoded = inflateRawSync(raw).toString("latin1");
      } catch {
        decoded = raw.toString("latin1");
      }
    }

    objects.set(num, { dict, stream: decoded });
    objRe.lastIndex = bodyEnd;
  }

  return objects;
}

/** CMap jadval kodlarini o'qib, kod -> unicode jadvalini qaytaradi. */
function parseCMap(src: string): Map<number, string> {
  const map = new Map<number, string>();

  const charRe = /beginbfchar([\s\S]*?)endbfchar/g;
  let cm: RegExpExecArray | null;
  while ((cm = charRe.exec(src)) !== null) {
    const pairRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pairRe.exec(cm[1])) !== null) {
      const code = parseInt(pm[1], 16);
      if (!map.has(code)) map.set(code, hexToUtf16(pm[2]));
    }
  }

  const rangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  let rm: RegExpExecArray | null;
  while ((rm = rangeRe.exec(src)) !== null) {
    const body = rm[1];
    const triRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let tm: RegExpExecArray | null;
    while ((tm = triRe.exec(body)) !== null) {
      const lo = parseInt(tm[1], 16);
      const hi = parseInt(tm[2], 16);
      const dst = parseInt(tm[3], 16);
      if (hi < lo || hi - lo > 65_535) continue;
      for (let c = lo; c <= hi; c++) {
        if (!map.has(c)) map.set(c, String.fromCharCode(dst + (c - lo)));
      }
    }
    const arrRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g;
    let am: RegExpExecArray | null;
    while ((am = arrRe.exec(body)) !== null) {
      const lo = parseInt(am[1], 16);
      const items = am[3].match(/<[0-9a-fA-F]*>/g) || [];
      items.forEach((item, idx) => {
        if (!map.has(lo + idx)) map.set(lo + idx, hexToUtf16(item.replace(/[<>]/g, "")));
      });
    }
  }

  return map;
}

type FontMaps = { byName: Map<string, Map<number, string>>; union: Map<number, string> };

/**
 * Har bir shrift resursi nomi uchun alohida ToUnicode jadvalini topadi.
 * Bitta jami jadval yaratish yetarli emas: subset shrlftlarda bir xil kod
 * turli harflarni belgilaydi (masalan 0x24 bir shriftda "A", boshqasida "1").
 */
function buildFontMaps(objects: Map<number, PdfObject>): FontMaps {
  const byName = new Map<string, Map<number, string>>();
  const union = new Map<number, string>();

  // 1) Har bir /Type /Font obyektida /ToUnicode havolasini olamiz
  const fontObjToMap = new Map<number, Map<number, string>>();
  for (const [num, obj] of objects) {
    if (!/\/Type\s*\/Font/.test(obj.dict)) continue;
    const tuRef = obj.dict.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (!tuRef) continue;
    const tuObj = objects.get(Number(tuRef[1]));
    if (!tuObj?.stream || !/beginbfchar|beginbfrange/.test(tuObj.stream)) continue;
    const map = parseCMap(tuObj.stream);
    if (map.size > 0) fontObjToMap.set(num, map);
  }

  // 2) Resurs lug'atlarida shrift nomi -> obyekt raqamini topamiz
  for (const obj of objects.values()) {
    if (!/\/Font\b/.test(obj.dict)) continue;
    const refRe = /\/([A-Za-z0-9_.+-]+)\s+(\d+)\s+\d+\s+R/g;
    let rm: RegExpExecArray | null;
    while ((rm = refRe.exec(obj.dict)) !== null) {
      const map = fontObjToMap.get(Number(rm[2]));
      if (map) byName.set(rm[1], map);
    }
  }

  // 3) Zaxira jadval: nomi topilmagan shriftlar uchun barcha jadvallar yig'masi
  for (const map of fontObjToMap.values()) {
    for (const [code, value] of map) {
      if (!union.has(code)) union.set(code, value);
    }
  }
  // Ba'zi hujjatlar jadvalni siqilmagan yozadi вЂ” global qidiruv
  if (union.size === 0) {
    for (const obj of objects.values()) {
      if (!/beginbfchar|beginbfrange/.test(obj.stream)) continue;
      for (const [code, value] of parseCMap(obj.stream)) {
        if (!union.has(code)) union.set(code, value);
      }
    }
  }

  return { byName, union };
}

function extractPdf(buffer: Buffer): ExtractedDoc {
  const latin = buffer.toString("latin1");
  const objects = indexObjects(buffer);
  const fonts = buildFontMaps(objects);

  const pageCount =
    (latin.match(/\/Type\s*\/Page(?![s])/g) || []).length ||
    Array.from(objects.values()).filter((o) => /\/Type\s*\/Page(?![s])/.test(o.dict)).length ||
    (latin.includes("/Page") ? 1 : 0);

  const content = Array.from(objects.values())
    .filter((o) => o.stream && (/\bT[jJ]\b/.test(o.stream) || /\bBT\b/.test(o.stream)))
    .map((o) => o.stream)
    .join("\n");

  const text = normalizeText(pullPdfText(content, fonts));

  return {
    ...finish(text, "pdf", pageCount || (text ? 1 : 0)),
    warning:
      text.length < 40
        ? "PDF matni deyarli topilmadi. Ehtimol, fayl rasm ko'rinishida skanlangan (OCR kerak) yoki shrift kodlashgangan."
        : undefined,
  };
}

function hexToUtf16(hex: string) {
  if (!hex) return "";
  let out = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    const code = parseInt(hex.slice(i, i + 4), 16);
    if (Number.isFinite(code)) out += String.fromCharCode(code);
  }
  if (!out && hex.length) {
    const code = parseInt(hex, 16);
    if (Number.isFinite(code) && code < 0x110000) out = String.fromCharCode(code);
  }
  return out;
}

function pullPdfText(content: string, fonts: FontMaps) {
  const out: string[] = [];
  let currentFont: Map<number, string> | null = null;

  // Tokenlar: satr (<hex> yoki (literal)), massiv [ ... ], shrift nomi /F1,
  // raqamlar va matn joylashuv operatorlari.
  const tokenRe =
    /(<[0-9a-fA-F\s]*>|\((?:\\.|[^\\()])*\)|\[[^\]]*\]|\/[A-Za-z0-9_.+-]+|[-+]?\d*\.?\d+|Tf|TD|Td|T\*|Tj|TJ|ET|BT|['"])/g;

  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(content)) !== null) {
    const token = m[0];

    // `/F1 12 Tf` — joriy shriftni almashtiramiz
    if (token.startsWith("/")) {
      currentFont = fonts.byName.get(token.slice(1)) || null;
      continue;
    }
    if (/^[-+]?\d*\.?\d+$/.test(token)) continue;
    if (token === "Tf" || token === "Tj" || token === "TJ") continue;

    if (token === "T*" || token === "Td" || token === "TD" || token === "ET") {
      out.push("\n");
      continue;
    }

    if (token.startsWith("[")) {
      out.push(decodeTjArray(token.slice(1, -1), currentFont, fonts.union));
      continue;
    }

    if (token === '"' || token === "'") {
      out.push("\n");
      continue;
    }

    if (token === "BT") {
      currentFont = null;
      continue;
    }

    if (token.startsWith("<") || token.startsWith("(")) {
      // Operator keyingi belgi bo'lishi mumkin; har doim chiqaramiz
      out.push(decodePdfString(token, currentFont, fonts.union));
    }
  }

  return out.join("");
}

/** `[ (a) -300 (b) ] TJ` — katta manfiy kerning so'z oralig'iga aylantiriladi. */
function decodeTjArray(inner: string, font: Map<number, string> | null, union: Map<number, string>) {
  const strRe = /\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]*>/g;
  const numRe = /(-?\d*\.?\d+)/g;
  let out = "";
  let cursor = 0;
  let sm: RegExpExecArray | null;

  while ((sm = strRe.exec(inner)) !== null) {
    const gap = inner.slice(cursor, sm.index);
    for (const g of gap.match(numRe) || []) {
      if (Math.abs(Number(g)) > 180) out += " ";
    }
    out += decodePdfString(sm[0], font, union);
    cursor = sm.index + sm[0].length;
  }
  for (const g of inner.slice(cursor).match(numRe) || []) {
    if (Math.abs(Number(g)) > 180) out += " ";
  }

  return out;
}

/**
 * PDF satrini ochilgan matnga aylantiradi.
 * `font` — joriy shriftning ToUnicode jadvali; `union` — zaxira jadval.
 */
function decodePdfString(token: string, font: Map<number, string> | null, union: Map<number, string>) {
  if (token.startsWith("<")) {
    const hex = token.replace(/[<>\s]/g, "");
    if (!hex) return "";

    // Identity-H (CID) shriftlarda kod har doim 2 bayt (4 hex belgi)
    const twoByte = hex.length >= 4 && hex.length % 4 === 0;
    const step = twoByte ? 4 : 2;
    let out = "";

    for (let i = 0; i + step <= hex.length; i += step) {
      const code = parseInt(hex.slice(i, i + step), 16);
      if (!Number.isFinite(code)) continue;
      const mapped = font?.get(code) ?? union.get(code);
      if (mapped !== undefined) {
        out += mapped;
        continue;
      }
      // Jadvalda yo'q kod: 1 baytli oddiy shrift bo'lsa, kod o'zi belgi
      if (!twoByte && code >= 32 && code < 0x100) out += String.fromCharCode(code);
      else if (twoByte && code >= 32 && code < 0x100) out += String.fromCharCode(code);
      else out += " ";
    }
    return out;
  }

  // `( ... )` — PDF literal string
  const body = token.slice(1, -1);
  let out = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = body[++i];
    switch (next) {
      case "n":
        out += "\n";
        break;
      case "r":
        out += "\r";
        break;
      case "t":
        out += "\t";
        break;
      case "b":
        out += "\b";
        break;
      case "f":
        out += "\f";
        break;
      case "(":
      case ")":
      case "\\":
        out += next ?? "";
        break;
      default: {
        const octal = body.slice(i, i + 3).match(/^[0-7]{1,3}/);
        if (octal) {
          out += String.fromCharCode(parseInt(octal[0], 8));
          i += octal[0].length - 1;
        } else {
          out += next ?? "";
        }
      }
    }
  }

  // Literal satrlar ba'zan ham kodlangan bo'ladi (odatda kam)
  if (font && font.size > 0 && /[^\x20-\x7e]/.test(out)) {
    let mapped = "";
    for (const ch of out) {
      const hit = font.get(ch.charCodeAt(0));
      mapped += hit !== undefined ? hit : ch;
    }
    return mapped;
  }
  return out;
}

// ============================================================================
//  Oddiy matn
// ============================================================================

function extractPlain(buffer: Buffer) {
  let text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) {
    // UTF-8 emas ekan вЂ” CP1251/ISO-8859-1 bo'lishi mumkin
    text = buffer.toString("latin1");
  }
  if (fileLooksLikeCsv(text)) text = csvToText(text);
  return finish(normalizeText(text), "text", 0);
}

function fileLooksLikeCsv(text: string) {
  const head = text.slice(0, 4000).split(/\r?\n/).filter(Boolean).slice(0, 5);
  if (head.length < 2) return false;
  const commas = head.filter((line) => (line.match(/,/g) || []).length >= 2).length;
  return commas >= Math.ceil(head.length / 2);
}

function csvToText(csv: string) {
  return csv
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
        .map((cell) => cell.replace(/^"|"$/g, "").trim())
        .filter(Boolean)
        .join(" | "),
    )
    .filter(Boolean)
    .join("\n");
}

// ============================================================================
//  Umumiy
// ============================================================================

function normalizeText(text: string) {
  return collapseGlyphLines(
    String(text || "")
      .replace(/\r\n?/g, "\n")
      .replace(/ /g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  );
}

/**
 * Ba'zi PDF'lar har bir glifni alohida satr sifatida chizadi ("A\nK\nE\nL\nA").
 * Ketma-ket yagona belgili satrlarni bitta qatorga yig'amiz.
 */
function collapseGlyphLines(text: string) {
  const lines = text.split("\n");
  const out: string[] = [];
  let run = "";

  const flush = () => {
    if (run) out.push(run);
    run = "";
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 1 && /[^\s]/.test(trimmed)) {
      run += trimmed;
      continue;
    }
    flush();
    out.push(line);
  }
  flush();
  return out.join("\n").trim();
}

function finish(text: string, parser: string, pageCount: number): ExtractedDoc {
  return {
    text,
    parser,
    pageCount,
    charCount: text.length,
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
  };
}

export const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".pptx",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".zip",
] as const;

/**
 * Faylni matnga aylantiradi. XLSX/XLS uchun `xlsx` paketi ishlatiladi
 * (loyihada allaqachon bog'liqlik sifatida bor).
 */
function extractZipBundle(buffer: Buffer): ExtractedDoc {
  const zip = readZip(buffer);
  const parts: string[] = [];
  let files = 0;
  let binary = 0;

  for (const [name, data] of zip) {
    if (/\/(image|media|fonts?)\//i.test(name)) {
      binary++;
      continue;
    }
    const lower = name.toLowerCase();
    if (!/\.(txt|md|markdown|csv|json|ts|tsx|js|jsx|sql|html|htm|yml|yaml|xml|ini|env|py|sh)$/.test(lower)) {
      binary++;
      continue;
    }
    let text: string;
    if (/\.(docx|xlsx)$/.test(lower)) {
      try {
        text = extractTextSync(name, data).text;
      } catch {
        binary++;
        continue;
      }
    } else {
      text = data.toString("utf8");
      if (text.includes("\uFFFD")) text = data.toString("latin1");
    }
    if (text.trim()) parts.push(`# --- ${name} ---\n${text}`);
    files++;
  }

  const text = normalizeText(parts.join("\n\n"));
  return {
    ...finish(text, "zip", 0),
    warning:
      files === 0
        ? "Arxiv ichida o'qiladigan matnli fayl topilmadi (faqat rasm/binary)."
        : binary > 0
          ? `${files} ta matnli fayl o'qildi, ${binary} ta fayl (rasm/binary) o'tkazildi.`
          : undefined,
  };
}

/**
 * Faylni matnga aylantiradi. XLSX/XLS uchun `xlsx` paketi ishlatiladi
 * (loyihada allaqachon bog'liqlik sifatida bor).
 */
export function extractText(fileName: string, buffer: Buffer): Promise<ExtractedDoc> {
  return Promise.resolve(extractTextSync(fileName, buffer));
}

function extractTextSync(fileName: string, buffer: Buffer): ExtractedDoc {
  const lower = fileName.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));

  if (ext === ".pdf") return extractPdf(buffer);
  if (ext === ".docx") return extractDocx(buffer);
  if (ext === ".doc") return extractDoc(buffer);
  if (ext === ".pptx") return extractPptx(buffer);
  if (ext === ".zip") return extractZipBundle(buffer);
  if (ext === ".xlsx" || ext === ".xls") return extractSpreadsheet(fileName, buffer);
  if (ext === ".json") {
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      return finish(normalizeText(squashJson(parsed)), "json", 0);
    } catch {
      return extractPlain(buffer);
    }
  }
  if (!SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number])) {
    throw new Error(
      `Qo'llab-quvvatlanmaydigan format: ${ext || "(kengaytmasiz)"}. Qo'llab-quvvatlanadigan: ${SUPPORTED_EXTENSIONS.join(", ")}`,
    );
  }
  return extractPlain(buffer);
}

function extractSpreadsheet(fileName: string, buffer: Buffer): ExtractedDoc {
  // Lazy import: server-only yo'l, mijoz to'plamiga tushmaydi.
  const XLSX = require("xlsx") as typeof import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) parts.push(`# ${sheetName}\n${csv}`);
  }
  return finish(normalizeText(parts.join("\n\n")), "xlsx", wb.SheetNames.length);
}

function squashJson(value: unknown, depth = 0): string {
  if (depth > 6) return "";
  if (value == null) return "";
  if (typeof value !== "object") return String(value);
  if (Array.isArray(value)) return value.map((v) => squashJson(v, depth + 1)).filter(Boolean).join("\n");
  return Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => {
      const flat = squashJson(v, depth + 1);
      if (!flat) return "";
      return flat.includes("\n") ? `${k}:\n${flat}` : `${k}: ${flat}`;
    })
    .filter(Boolean)
    .join("\n");
}
