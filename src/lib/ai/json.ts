/**
 * lib/ai/json.ts
 *
 * Model javobidagi JSON'ni ishonchli ajratib olish. Modellar ba'zan
 * ```json ... ``` qobiq, yoki ortiqcha matn bilan qaytaradi — bu yordamchi
 * funksiya shu holatlarni barchasini ko'taradi va birinchi muvaffaqiyatli
 * parse'ni qaytaradi.
 */

function stripFences(raw: string) {
  const text = raw.trim();
  const fence = text.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fence) return fence[1].trim();
  return text;
}

/** Balandlik bo'yicha mos keladigan birinchi { } yoki [ ] blokini topadi. */
function extractBalanced(text: string, open: string, close: string) {
  const start = text.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Matndan JSON qiymatini oladi. `prefer` — qaysi tur afzal (object yoki array).
 * Muvaffaqiyatsiz bo'lsa `null` qaytaradi.
 */
export function parseJsonLoose<T = unknown>(raw: string, prefer: "object" | "array" = "object"): T | null {
  if (!raw) return null;
  const candidates: string[] = [];

  const cleaned = stripFences(raw);
  candidates.push(cleaned);

  const firstObj = extractBalanced(cleaned, "{", "}");
  const firstArr = extractBalanced(cleaned, "[", "]");
  if (prefer === "object") {
    if (firstObj) candidates.push(firstObj);
    if (firstArr) candidates.push(firstArr);
  } else {
    if (firstArr) candidates.push(firstArr);
    if (firstObj) candidates.push(firstObj);
  }

  // Oxirgi qarama-qarshi belgi boshi (odatda "{...}" orqali keladi)
  const objEnd = cleaned.lastIndexOf("}");
  if (objEnd > cleaned.indexOf("{")) candidates.push(cleaned.slice(cleaned.indexOf("{"), objEnd + 1));

  for (const candidate of candidates) {
    const attempt = tryParse<T>(candidate);
    if (attempt !== null) return attempt;
  }
  return null;
}

function tryParse<T>(candidate: string): T | null {
  try {
    const value = JSON.parse(candidate);
    return value as T;
  } catch {
    // Kengaytirilgan JSON (Python uslubidagi None/True, oxmas apostrof)
    try {
      const patched = candidate
        .replace(/\bNone\b/g, "null")
        .replace(/\bTrue\b/g, "true")
        .replace(/\bFalse\b/g, "false")
        .replace(/,\s*([}\]])/g, "$1");
      const value = JSON.parse(patched);
      return value as T;
    } catch {
      return null;
    }
  }
}

/** Xabarni qisqartiradi — chat tarixi modelga to'liq yuborilmasligi kerak. */
export function clip(text: string, max: number) {
  const value = String(text || "");
  if (value.length <= max) return value;
  return value.slice(0, max) + "\n… [matn qisqartirildi]";
}