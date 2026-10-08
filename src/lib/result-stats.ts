/**
 * Test natijasi statistikasi: to'g'ri / noto'g'ri / jami savollar.
 * Server (PDF hisobot, bot) va admin panel bir xil hisoblashi uchun umumiy helper.
 */
import { parseAnswersJson } from "@/lib/answers-json";

export type StatChoice = { id: string; text?: string | null; isCorrect: boolean };

export type StatQuestion = {
  id: string;
  type: string;
  text?: string | null;
  correctAnswer?: string | null;
  points?: number | null;
  order?: number | null;
  explanation?: string | null;
  choices?: StatChoice[] | null;
};

export type PerQuestion = { question: StatQuestion; selected: any; ok: boolean | null };

/**
 * Ball bo'yicha bilim darajasi. Bitta manba: PDF hisobot, Telegram bot va
 * admin panel — hammasi shu chegaralardan foydalanadi.
 *   86-100 → I daraja, 70-85 → II daraja, 1-69 → III daraja, 0 → Baholanmagan
 * (pdf-report.ts bu funksiyani o'zida qayta eksport qiladi.)
 */
export function levelOfScore(score: number | null | undefined): string {
  const s = typeof score === "number" ? score : 0;
  if (s >= 86) return "I daraja";
  if (s >= 70) return "II daraja";
  if (s > 0) return "III daraja";
  return "Baholanmagan";
}

/** Bitta savolga berilgan javob to'g'rimi (true/false). Yozma savolda
 *  to'g'ri javob belgilanmagan bo'lsa — null (baholanmagan). */
export function isAnswerCorrect(question: StatQuestion, selected: any): boolean | null {
  if (selected == null || selected === "" || (Array.isArray(selected) && selected.length === 0)) {
    return false;
  }
  if (question.type === "written") {
    if (!question.correctAnswer) return null;
    return String(selected).trim().toLowerCase() === String(question.correctAnswer).trim().toLowerCase();
  }
  const correctIds = (question.choices || []).filter((c) => c.isCorrect).map((c) => c.id);
  return Array.isArray(selected)
    ? selected.length === correctIds.length && selected.every((s: any) => correctIds.includes(s))
    : correctIds.includes(selected);
}

export type ResultStats = {
  answers: Record<string, any>;
  questions: StatQuestion[];
  perQuestion: PerQuestion[];
  correct: number;
  wrong: number;
  pending: number;
  total: number;
  truncated: boolean;
  /**
   * Natija saqlangandan keyin testning savollari YANGILANGAN: javoblar
   * (`__questionIds`) joriy savol ro'yxatida umuman yo'q. Bunday natijada
   * to'g'ri/xato hisoblanmaydi — hisobot bo'sh ("Savollar topilmadi")
   * chiqmasligi uchun joriy savollar ko'rsatiladi, lekin "Baholanmagan"
   * deb belgilanadi va PDF'da tushuntirish yoziladi.
   */
  staleQuestionIds: boolean;
};

/** Natijani savollar bo'yicha tahlil qiladi (cheklangan testda faqat
 *  ko'rsatilgan savollar hisobga olinadi — `__questionIds`). */
export function computeResultStats(
  questions: StatQuestion[] | null | undefined,
  rawAnswers: string | null | undefined,
): ResultStats {
  const parsed = parseAnswersJson(rawAnswers);
  const answers = parsed.answers;
  const presented: string[] = Array.isArray(answers.__questionIds)
    ? answers.__questionIds.map(String)
    : [];

  const all = questions || [];
  // Natija eski savol versiyasiga tegishlimi? (javob kalitlari joriy savollar
  // ro'yxatida yo'q bo'lsa — savollar testni tahrirlashda almashtirilgan)
  const knownIds = new Set(all.map((q) => String(q.id)));
  const matched = presented.filter((id) => knownIds.has(id));
  let staleQuestionIds = presented.length > 0 && matched.length === 0;

  // ENG MUHIM: natija saqlanganda `__snapshot` ichida savollar nusxasi
  // bor (lms-storage.ts). Agar joriy savollar mos kelmasa, HISOBOT shu
  // nusxadan olinadi — natija o'z holicha to'g'ri qo'yiladi.
  let source = all;
  if (staleQuestionIds && Array.isArray((answers as any).__snapshot)) {
    const snap = (answers as any).__snapshot as StatQuestion[];
    if (snap.length > 0) {
      source = snap;
      staleQuestionIds = false; // nusxa bor — hisobot to'liq tiklanadi
    }
  }

  const sourceIds = new Set(source.map((q) => String(q.id)));
  const matchedInSource = presented.filter((id) => sourceIds.has(id));
  const useAll = presented.length === 0 || matchedInSource.length === 0;
  const list = useAll ? source.slice() : source.filter((q) => matchedInSource.includes(String(q.id)));

  const perQuestion: PerQuestion[] = [];
  let correct = 0;
  let wrong = 0;
  let pending = 0;
  for (const q of list) {
    const selected = answers[q.id] ?? null;
    // Eski savol versiyasida "noto'g'ri" deb hisoblash noto'g'ri bo'lardi —
    // javob kaliti butunlay boshqa savolga tegishli. Shuning uchun "null".
    const ok = staleQuestionIds ? null : isAnswerCorrect(q, selected);
    if (ok === true) correct++;
    else if (ok === false) wrong++;
    else pending++;
    perQuestion.push({ question: q, selected, ok });
  }

  // Eski natija (savollar o'chirilgan, nusxa yo'q): savollar bo'yicha
  // TAQSIMOT ma'nosiz. 30 ta "Baholanmagan" qatori chiqarmaslik kerak —
  // bu natijani "hammasi baholanmagan" deb ko'rsatib, haqiqiy boshqaruvchi
  // ball (90%)ni yashiradi. Shuning uchun qatorlar bo'sh qoldiriladi,
  // umumiy son esa `__questionIds` dagi haqiqiy urinishlar soni bo'ladi.
  if (staleQuestionIds) {
    return {
      answers,
      questions: [],
      perQuestion: [],
      correct: 0,
      wrong: 0,
      pending: 0,
      total: presented.length || list.length,
      truncated: parsed.truncated,
      staleQuestionIds: true,
    };
  }

  return {
    answers,
    questions: list,
    perQuestion,
    correct,
    wrong,
    pending,
    total: list.length,
    truncated: parsed.truncated,
    staleQuestionIds,
  };
}
