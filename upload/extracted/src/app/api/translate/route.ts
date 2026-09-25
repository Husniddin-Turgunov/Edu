import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const cache = new Map<string, string>();
const TARGETS = new Set(["uz", "en"]);
const MARKER = (index: number) => `__AKELA_SPLIT_${index}__`;

async function googleTranslate(text: string, target: string) {
  const key = `${target}\u0000${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const body = new URLSearchParams({
    client: "gtx",
    sl: "auto",
    tl: target,
    dt: "t",
    q: text,
  });
  const response = await fetch(
    "https://translate.googleapis.com/translate_a/single",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok) throw new Error(`Translation failed: ${response.status}`);

  const payload = (await response.json()) as unknown;
  const segments = Array.isArray(payload) && Array.isArray(payload[0])
    ? payload[0]
    : [];
  const translated = segments
    .map((segment) =>
      Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : "",
    )
    .join("");
  const result = translated || text;
  cache.set(key, result);
  return result;
}

async function translateBatch(texts: string[], target: string) {
  if (texts.length === 1) return [await googleTranslate(texts[0], target)];

  const joined = texts
    .map((text, index) => `${text}\n${MARKER(index)}`)
    .join("\n");
  const translated = await googleTranslate(joined, target);
  const results: string[] = [];
  let rest = translated;

  for (let index = 0; index < texts.length; index += 1) {
    const marker = MARKER(index);
    const markerIndex = rest.indexOf(marker);
    if (markerIndex < 0) {
      return Promise.all(texts.map((text) => googleTranslate(text, target)));
    }
    results.push(rest.slice(0, markerIndex).trim());
    rest = rest.slice(markerIndex + marker.length).trimStart();
  }
  return results;
}

async function translateHtml(html: string, target: string) {
  const parts = html.split(/(<[^>]+>)/g);
  const textParts = parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => part.trim() && !part.startsWith("<"));
  if (!textParts.length) return html;

  const translated = await translateBatch(
    textParts.map(({ part }) => part),
    target,
  );
  textParts.forEach(({ index, part }, translatedIndex) => {
    parts[index] = translated[translatedIndex] || part;
  });
  return parts.join("");
}

function looksLikeHtml(text: string) {
  return /<\/?[a-z][^>]*>/i.test(text);
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      texts?: unknown;
      target?: unknown;
    };
    const target = String(input.target ?? "");
    if (!TARGETS.has(target)) {
      return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
    }
    if (!Array.isArray(input.texts) || input.texts.length > 250) {
      return NextResponse.json({ error: "Invalid texts" }, { status: 400 });
    }

    const texts = input.texts.map((value) => String(value ?? ""));
    if (texts.reduce((sum, text) => sum + text.length, 0) > 60_000) {
      return NextResponse.json({ error: "Payload is too large" }, { status: 413 });
    }

    const translated = new Array<string>(texts.length);
    let batch: { text: string; index: number }[] = [];
    let batchLength = 0;

    const flush = async () => {
      if (!batch.length) return;
      const values = await translateBatch(
        batch.map((item) => item.text),
        target,
      );
      batch.forEach((item, index) => {
        translated[item.index] = values[index] || item.text;
      });
      batch = [];
      batchLength = 0;
    };

    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index];
      if (!text.trim()) {
        translated[index] = text;
        continue;
      }
      if (looksLikeHtml(text)) {
        await flush();
        translated[index] = await translateHtml(text, target);
        continue;
      }
      if (batch.length && batchLength + text.length > 3_500) await flush();
      batch.push({ text, index });
      batchLength += text.length;
      if (text.length > 3_500) await flush();
    }
    await flush();

    return NextResponse.json({ translations: translated });
  } catch (error) {
    console.error("Content translation failed", error);
    return NextResponse.json({ error: "Translation unavailable" }, { status: 502 });
  }
}
