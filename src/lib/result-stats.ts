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
  const list = (questions || []).filter(
    (q) => presented.length === 0 || presented.includes(String(q.id)),
  );
  const perQuestion: PerQuestion[] = [];
  let correct = 0;
  let wrong = 0;
  let pending = 0;
  for (const q of list) {
    const selected = answers[q.id] ?? null;
    const ok = isAnswerCorrect(q, selected);
    if (ok === true) correct++;
    else if (ok === false) wrong++;
    else pending++;
    perQuestion.push({ question: q, selected, ok });
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
  };
}
