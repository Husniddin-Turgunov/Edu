/**
 * `TestResult.answers` / `JobTestResult.answers` JSON ini O'QISH (parse).
 *
 * Bu fayl ataylab Prisma/DB ga bog'lanmagan — uni ham server, ham client
 * komponentlar (masalan admin grading sahifasi) ishlatishi mumkin.
 *
 * MUHIM (eski xato): ilgari bu ustunlar MySQL da `VARCHAR(191)` edi (Prisma
 * `String` → varchar(191)). 191 belgidan uzun JSON bazaga yozilganda MariaDB
 * uni JIMGINA kesib qo'yardi (masalan 30 javobdan faqat ~6 tasi saqlanardi).
 * Kesilgan JSON `JSON.parse` da xato beradi — natijada test natijasini
 * ko'rishda (review) tanlangan javoblar umuman ko'rinmay, faqat yashil
 * "To'g'ri" belgilari chiqib qolardi: "hammasi to'g'ri" degan taassurot.
 *
 * Endi schema da ustunlar `@db.Text` — yangi natijalar to'liq saqlanadi. Lekin
 * bazada eski (kesilgan) qatorlar qolgan, shuning uchun o'qishda "yumshoq"
 * rejim ishlatiladi: JSON butun bo'lsa oddiy parse, kesilgan bo'lsa — to'liq
 * yopilgan `"kalit":"qiymat"` juftliklari qo'lda yig'iladi (tiklanadi).
 */

export type ParsedAnswers = {
  /** Topilgan/tiklangan javoblar (bo'sh bo'lishi mumkin) */
  answers: Record<string, any>;
  /** Qiymat kesilgan/buzilgan JSON edi (true bo'lsa UI ogohlantiradi) */
  truncated: boolean;
};

export function parseAnswersJson(raw: string | null | undefined): ParsedAnswers {
  if (!raw) return { answers: {}, truncated: false };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { answers: parsed as Record<string, any>, truncated: false };
    }
    return { answers: {}, truncated: false };
  } catch {
    /* Kesilgan (truncated) JSON — to'liq juftliklarni tiklaymiz */
    const answers: Record<string, any> = {};
    // "kalit": "satr" | [massiv] | {obyekt} | raqam/bool
    const pair = /"((?:[^"\\]|\\.)*)"\s*:\s*("(?:[^"\\]|\\.)*"|\[[^\]]*\]|\{[^{}]*\}|[^,{}]+)/g;
    let m: RegExpExecArray | null;
    while ((m = pair.exec(raw))) {
      const key = m[1];
      const rawVal = m[2].trim();
      let val: any = rawVal;
      try {
        val = JSON.parse(rawVal);
      } catch {
        val = rawVal.replace(/^"|"$/g, "");
      }
      // Yordamchi kalitlar (`__questionIds`, `__retake`) faqat to'liq
      // o'qilgan bo'lsa saqlanadi — aks holda ular shovqin bo'ladi.
      if (key.startsWith("__") && !Array.isArray(val) && typeof val !== "boolean") continue;
      answers[key] = val;
    }
    // Kesilgan `__questionIds` massividan TO'LIQ ID larni tiklaymiz — cheklangan
    // testda foydalanuvchiga qaysi savollar ko'rsatilganini bilish uchun.
    if (!Array.isArray(answers.__questionIds)) {
      const qidsMatch = raw.match(/"__questionIds"\s*:\s*\[([\s\S]*?)(?:\]|$)/);
      if (qidsMatch) {
        const ids = Array.from(qidsMatch[1].matchAll(/"([^"]+)"/g)).map((x) => x[1]);
        if (ids.length) answers.__questionIds = ids;
      }
    }
    return { answers, truncated: true };
  }
}

export default parseAnswersJson;
