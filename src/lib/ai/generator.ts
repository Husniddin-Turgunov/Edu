/**
 * lib/ai/generator.ts
 *
 * Test yaratish. Ikki rejim:
 *
 *   source — FAQAT yig'ilgan fayllar va/yoki platformadagi dars matnidan savol
 *           yig'iladi. Model tashqi bilimidan foydalanmasligi majburiyat
 *           sifatida beriladi (promptda ham, tekshiruvda ham).
 *   web    — mavzu bo'yicha internetdan manba olib, ular asosida savol yig'iladi.
 *
 * Model ishlamay qolsa (kalit yo'q / xato) deterministik "klose" generator
 * ishga tushadi: manba matnidan kalit so'zlar ajratilib, bo'sh joyli savol va
 * to'g'ri/noto'g'ri variantlar yasaladi. Natijada test doim chiqadi.
 */

import { complete, resolveProviderAsync, estimateTokens, ProviderUnavailableError } from "./provider";
import { parseJsonLoose, clip } from "./json";
import { webSearch, fetchPageText, type SearchHit } from "./search";
import { wrapUntrustedSource } from "./sanitize";

export type GeneratedChoice = { text: string; isCorrect: boolean };
export type GeneratedQuestion = {
  text: string;
  type: "single" | "multiple" | "truefalse" | "written";
  points: number;
  choices: GeneratedChoice[];
  correctAnswer: string | null;
  explanation: string;
  sourceQuote: string;
  sourceKind: "file" | "web" | "lesson";
  sourceRef: string;
};

export type GeneratedDraft = {
  test: {
    title: string;
    description: string;
    language: "uz" | "ru" | "en";
    passScore: number;
    timeLimit: number;
    maxAttempts: number;
    questionCount: number;
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
  };
  questions: GeneratedQuestion[];
  notes: string;
  coverage: { topics: string[]; sourceKinds: Record<string, number> };
  generation: { mode: "ai" | "deterministic"; provider: string; model: string; cost: number };
};

export type GenerateInput = {
  title: string;
  topic: string;
  count: number;
  language?: "uz" | "ru" | "en";
  mode: "source" | "web" | "hybrid";
  difficulty?: "easy" | "medium" | "hard" | "mixed";
  /** Attachment id lar ro'yxati */
  attachmentIds: string[];
  /** Mavjud testlardan olingan savollar (takrorlanmasligi uchun) */
  existingQuestions?: string[];
  /** Platformadagi dars matnlari */
  lessonNotes?: { lessonId: string; title: string; text: string }[];
  extraInstructions?: string;
  signal?: AbortSignal;
};

export type GenerateResult = {
  draft: GeneratedDraft;
  webRefs: { title: string; url: string; snippet: string }[];
  corpusChars: number;
  warnings: string[];
};

const MAX_CORPUS_CHARS = 48_000;
const MAX_EXISTING = 120;

// ============================================================================
//  Umumiy
// ============================================================================

export async function generateTest(input: GenerateInput): Promise<GenerateResult> {
  const warnings: string[] = [];
  const count = clampNumber(input.count, 3, 60, 12);

  const files = input.attachmentIds.length
    ? await loadAttachments(input.attachmentIds)
    : [];
  const fileCorpus = buildFileCorpus(files, warnings);

  const lessonCorpus = buildLessonCorpus(input.lessonNotes || [], warnings);

  const webRefs: SearchHit[] = [];
  let webCorpus = "";
  const wantsWeb = input.mode === "web" || input.mode === "hybrid";
  if (wantsWeb) {
    const query = [input.topic, input.title].filter(Boolean).join(" ").trim();
    try {
      const outcome = await webSearch(query, 5, input.language || "uz");
      webRefs.push(...outcome.hits);
      if (outcome.error) warnings.push(`Qidiruv: ${outcome.error}`);
      const deep = await Promise.all(
        outcome.hits.slice(0, 2).map(async (hit) => {
          try {
            const page = await fetchPageText(hit.url);
            return `# ${hit.title}\n${hit.url}\n${page.text}`;
          } catch {
            return `# ${hit.title}\n${hit.url}\n${hit.snippet}`;
          }
        }),
      );
      webCorpus = deep.filter(Boolean).join("\n\n");
      if (!webCorpus && outcome.hits.length) {
        webCorpus = outcome.hits.map((h) => `# ${h.title}\n${h.url}\n${h.snippet}`).join("\n\n");
      }
    } catch (err: any) {
      warnings.push(`Internet qidiruvi bajarilmadi: ${err?.message || "xato"}`);
    }
    if (!webCorpus) warnings.push("Internetdan foydali ma'lumot topilmadi — faqat manba fayllardan foydalanildi.");
  }

  let corpus = "";
  if (input.mode === "source") corpus = [fileCorpus, lessonCorpus].filter(Boolean).join("\n\n");
  else if (input.mode === "web") corpus = [webCorpus, fileCorpus].filter(Boolean).join("\n\n");
  else corpus = [fileCorpus, lessonCorpus, webCorpus].filter(Boolean).join("\n\n");

  if (!corpus.trim()) {
    throw new Error(
      "Manba topilmadi. Test yaratish uchun kamida bitta fayl yuklang yoki «internet» rejimini yoqing (web-rejim uchun internet kerak).",
    );
  }

  const clipped = clip(corpus, MAX_CORPUS_CHARS);
  if (corpus.length > MAX_CORPUS_CHARS) {
    warnings.push(`Manba ${corpus.length} belgi edi, modelga ${MAX_CORPUS_CHARS} belgi yuborildi.`);
  }

  const provider = await resolveProviderAsync();
  let draft: GeneratedDraft | null = null;

  if (provider.live) {
    try {
      draft = await askModel({ input, count, corpus: clipped, existing: (input.existingQuestions || []).slice(0, MAX_EXISTING), signal: input.signal });
    } catch (err: any) {
      // Xom provayder xatosi ogohlantirishga tushmaydi — u foydalanuvchiga
      // texnik JSON ko'rsatib, xabarni to'sib qo'yadi. Qisqa sabab + server logi.
      console.error("[ai-generator] model chaqiruvi muvaffaqiyatsiz:", err?.message || err);
      const reason = err instanceof ProviderUnavailableError ? err.message : "Model javob bermadi";
      warnings.push(`${reason} O'rnatilgan generatorga o'tildi.`);
      draft = null;
    }
  } else {
    warnings.push("AI kaliti yo'q — o'rnatilgan (deterministik) generator ishlatildi.");
  }

  if (!draft) {
    draft = deterministicDraft({ input, count, corpus });
  }

  draft = normalizeDraft(draft, input, count);
  if (draft.questions.length < count) {
    warnings.push(`Faqat ${draft.questions.length} ta savol yig'indi (so'ralgan: ${count}).`);
  }

  return {
    draft,
    webRefs: webRefs.map((h) => ({ title: h.title, url: h.url, snippet: h.snippet })),
    corpusChars: corpus.length,
    warnings,
  };
}

// ============================================================================
//  Modelga murojaat
// ============================================================================

async function askModel(params: {
  input: GenerateInput;
  count: number;
  corpus: string;
  existing: string[];
  signal?: AbortSignal;
}): Promise<GeneratedDraft> {
  const { input, count, corpus, existing } = params;
  const language = input.language || "uz";
  const langName = language === "uz" ? "o'zbek" : language === "ru" ? "rus" : "ingliz";
  const modeText =
    input.mode === "source"
      ? `FAQAT quyidagi MANBA matnidan savol yasа. Tashqi bilim, umumiy bilim va taxminga asoslangan savollarni ISHLATMA. Savol faqat manbada aniq yozilgan ma'lumotga asoslansin.`
      : input.mode === "web"
        ? `Asosan quyidagi INTERNET MANBALARI asosida savol yasа. Har bir savol uchun manba havolasini (sourceRef) ko'rsat.`
        : `Quyidagi manbalar (fayllar + internet) asosida savol yasа. Har bir savolda qayerdan olinganini sourceRef maydonida ko'rsat.`;

  const system = `Sen ta'lim testlari muharririsan. Qat'iy JSON qaytarasan.

MANSAB: ${langName} tilida, ${count} ta savoldan iborat test tuz.

QOIDALAR (buzilsa test rad etiladi):
1. Har bir savol manbaga asoslangan bo'lsin. Tasavvur qilma, taxmin qilma.
2. "single" — 4 ta variant, faqat BITTASI to'g'ri. "multiple" — 4 ta variant, 2-3 ta to'g'ri. "truefalse" — 2 ta variant ("To'g'ri"/"Noto'g'ri"). "written" — variant yo'q, correctAnswer maydonida qisqa kutilgan javob.
3. choices[].isCorrect — to'g'ri variant uchun true.
4. written turida correctAnswer bo'sh bo'lmasin.
5. explanation — nima uchun shu javab to'g'ri (1-2 jumla).
6. sourceQuote — manbadan savolga xos bo'lgan aniq qator (1-2 jumla, aynan shunday yozilgan).
7. ${modeText}
8. Savollar bir-birining takrori bo'lmasin, qiyinlik bosqichma-bosqich oshsin.
9. Matn ichida apostrof va qo'yish belgilaridan foydalan, JSON'da to'g'ri escapela.

JAVOB SHAKLI (boshqa hech narsa qo'shma):
{"test":{"title":"...","description":"...","language":"uz","passScore":70,"timeLimit":20,"maxAttempts":2,"questionCount":${count},"shuffleQuestions":true,"shuffleChoices":true},
 "questions":[{"text":"...","type":"single","points":1,"choices":[{"text":"...","isCorrect":true},{"text":"...","isCorrect":false}],"correctAnswer":null,"explanation":"...","sourceQuote":"...","sourceKind":"file","sourceRef":"fayl nomi yoki URL"}],
 "notes":"...",
 "coverage":{"topics":["..."],"sourceKinds":{"file":${count}}}}`;

  const userParts = [
    `TEST NOMI: ${input.title}`,
    `MAVZU: ${input.topic || input.title}`,
    `SAVOLLAR SONI: ${count}`,
    `QIYINLIK: ${input.difficulty || "mixed"}`,
    `TIL: ${langName}`,
    `REJIM: ${input.mode}`,
  ];
  if (input.extraInstructions?.trim()) {
    userParts.push(`ALOHIDA KO'RSATMA: ${input.extraInstructions.trim()}`);
  }
  if (existing.length) {
    userParts.push(
      `QUYIDAGI SAVOLLAR ALMASHGANDA TAKRORLANMASIN (mavzu farqli bo'lsa ham, shakl bir xil bo'lmasin):\n- ${existing
        .slice(0, 40)
        .map((q) => q.slice(0, 140))
        .join("\n- ")}`,
    );
  }
  userParts.push(
    `<<<MANBA_BOSHLASH>>>\n${corpus}\n<<<MANBA_TUGADI>>>`,
  );

  const completion = await complete(
    [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n\n") },
    ],
    { temperature: 0.3, signal: params.signal },
  );

  const parsed = parseJsonLoose<any>(completion.text, "object");
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error("Model javobi tushunarli JSON emas");
  }

  const questions: GeneratedQuestion[] = parsed.questions.map((q: any) => ({
    text: String(q?.text || "").trim(),
    type: normalizeType(q?.type),
    points: Number(q?.points) > 0 ? Number(q.points) : 1,
    choices: Array.isArray(q?.choices)
      ? q.choices
          .map((c: any) => ({
            text: String(c?.text || "").trim(),
            isCorrect: c?.isCorrect === true || c?.isCorrect === "true",
          }))
          .filter((c: GeneratedChoice) => c.text)
      : [],
    correctAnswer: q?.correctAnswer ? String(q.correctAnswer).trim() : null,
    explanation: String(q?.explanation || "").trim(),
    sourceQuote: String(q?.sourceQuote || "").trim(),
    sourceKind: normalizeKind(q?.sourceKind, input.mode),
    sourceRef: String(q?.sourceRef || "").trim(),
  }));

  return {
    test: {
      title: String(parsed?.test?.title || input.title),
      description: String(parsed?.test?.description || ""),
      language,
      passScore: clampNumber(parsed?.test?.passScore, 1, 100, 70),
      timeLimit: clampNumber(parsed?.test?.timeLimit, 0, 300, Math.ceil(count * 1.5)),
      maxAttempts: clampNumber(parsed?.test?.maxAttempts, 0, 10, 1),
      questionCount: count,
      shuffleQuestions: parsed?.test?.shuffleQuestions !== false,
      shuffleChoices: parsed?.test?.shuffleChoices !== false,
    },
    questions,
    notes: String(parsed?.notes || ""),
    coverage: {
      topics: Array.isArray(parsed?.coverage?.topics) ? parsed.coverage.topics.map(String) : [],
      sourceKinds: normalizeKinds(parsed?.coverage?.sourceKinds, questions),
    },
    generation: {
      mode: "ai",
      provider: completion.provider,
      model: completion.model,
      cost: completion.cost || estimateCostFallback(completion.promptTokens, completion.completionTokens),
    },
  };
}

function estimateCostFallback(inTok: number, outTok: number) {
  return (inTok / 1000) * 0.0002 + (outTok / 1000) * 0.0008;
}

// ============================================================================
//  Deterministik generator (model yo'q holati uchun)
// ============================================================================

function deterministicDraft(params: {
  input: GenerateInput;
  count: number;
  corpus: string;
}): GeneratedDraft {
  const { input, count, corpus } = params;
  // Uzun qatorlar bilan boshlanadi. Matn qisqa bo'lsa chegaralarni yumshatamiz —
  // aks holda kichik PDF/maqola bo'yicha savol umuman chiqmaydi.
  const strict = splitSentences(corpus).filter((s) => s.length >= 40 && s.length <= 320 && s.split(/\s+/).length >= 7);
  const relaxed = splitSentences(corpus).filter(
    (s) => s.length >= 18 && s.split(/\s+/).length >= 3 && /[\p{L}]{6,}/u.test(s),
  );
  const sentences = strict.length >= count ? strict : relaxed.length > strict.length ? relaxed : strict;
  const keywords = extractKeywords(corpus, 60);
  const distractors = keywords.filter((k) => k.length >= 4);

  const questions: GeneratedQuestion[] = [];
  const used = new Set<string>();

  const add = (q: GeneratedQuestion) => {
    const signature = q.text.toLowerCase().slice(0, 60);
    if (used.has(signature)) return false;
    used.add(signature);
    questions.push(q);
    return true;
  };

  // 1) Klose savollari: kalit so'zni bo'sh qoldiramiz
  const clozeTarget = Math.max(1, Math.ceil(count * 0.55));
  for (const sentence of sentences) {
    if (questions.length >= clozeTarget) break;
    const blank = pickBlankableWord(sentence, keywords);
    if (!blank) continue;
    const signature = blank.word.toLowerCase();
    if (used.has(signature)) continue;

    const pool = distractors.filter((k) => k.toLowerCase() !== signature);
    const choices: GeneratedChoice[] = shuffleWithSeed(
      [
        { text: blank.word, isCorrect: true },
        ...pool.slice(0, 7).map((word) => ({ text: word, isCorrect: false })),
      ].slice(0, 4),
      blank.word.length + sentence.length,
    );
    if (choices.filter((c) => c.isCorrect).length !== 1 || choices.length < 2) continue;

    add({
      text: `Quyidagi matnda bo'sh joyga to'g'ri so'zni qo'ying: "${sentence.replace(blank.word, "______")}"`,
      type: "single",
      points: 1,
      choices,
      correctAnswer: null,
      explanation: `Manbada aynan shu so'z ishlatilgan: "${sentence.slice(0, 220)}"`,
      sourceQuote: sentence.slice(0, 300),
      sourceKind: "file",
      sourceRef: "manba matni",
    });
  }

  // 2) Ta'rif savollari: "X — bu ..." ko'rinishidagi gaplar
  const definitional = sentences.filter((s) =>
    /(^|\s)(—|-|–|:)\s|deb (nomlanadi|ataldi)|ya'ni|bu esa|o'zi esa/i.test(s),
  );
  for (const sentence of definitional) {
    if (questions.length >= count) break;
    const subject = sentence.split(/(\s—\s|\s-\s|\s:\s)/)[0].trim();
    if (subject.length < 4 || subject.length > 90) continue;
    if (used.has(subject.toLowerCase())) continue;
    add({
      text: `"${subject}" nima haqida?`,
      type: "written",
      points: 2,
      choices: [],
      correctAnswer: subject,
      explanation: `Manba: "${sentence.slice(0, 240)}"`,
      sourceQuote: sentence.slice(0, 300),
      sourceKind: "file",
      sourceRef: "manba matni",
    });
  }

  // 3) Raqam/qiymat savollari
  for (const sentence of sentences) {
    if (questions.length >= count) break;
    const numbers = sentence.match(/\b\d[\d\s.,%/-]{0,18}\b/g);
    if (!numbers || numbers.length === 0) continue;
    const target = numbers[0];
    if (used.has(`n:${target}`)) continue;
    const base = parseInt(target.replace(/\D/g, ""), 10);
    if (!Number.isFinite(base)) continue;
    used.add(`n:${target}`);
    add({
      text: `Quyidagi matnda o'chirilgan raqamni toping: "${sentence.replace(target, "______")}"`,
      type: "single",
      points: 1,
      choices: shuffleWithSeed(
        [
          { text: target.trim(), isCorrect: true },
          { text: String(base + 7), isCorrect: false },
          { text: String(Math.max(0, base - 3)), isCorrect: false },
          { text: String(base * 2 + 1), isCorrect: false },
        ],
        target.length + 11,
      ),
      correctAnswer: null,
      explanation: `Manbada raqam "${target.trim()}".`,
      sourceQuote: sentence.slice(0, 300),
      sourceKind: "file",
      sourceRef: "manba matni",
    });
  }

  // 4) So'z tanlash savollari — matn juda qisqa bo'lsa ham test to'liq bo'ladi
  for (const keyword of keywords) {
    if (questions.length >= count) break;
    const pool = keywords.filter((k) => k !== keyword && k !== target0(keyword));
    if (pool.length < 3) break;
    const context = sentences.find((s) => new RegExp(keyword, "i").test(s)) || "";
    const short = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    add({
      text: context
        ? `Matndagi qaysi so'z "${keyword}" bilan bog'liq?`
        : `Quyidagi so'zlar orasidan ushbu manbaga tegishlisini tanlang: "${keyword}"`,
      type: "single",
      points: 1,
      choices: shuffleWithSeed(
        [
          { text: keyword, isCorrect: true },
          ...pool.slice(0, 6).map((w) => ({ text: w, isCorrect: false })),
        ].slice(0, 4),
        keyword.length * 3 + 7,
      ),
      correctAnswer: null,
      explanation: context ? `Manbada "${keyword}" shu qatorda ishlatilgan: "${context.slice(0, 200)}"` : `Manba kalit so'zi: ${keyword}`,
      sourceQuote: context.slice(0, 300),
      sourceKind: "file",
      sourceRef: "manba matni",
    });
    void short;
  }

  // 5) Bo'lish-bo'lmaslik savollari — hech qanday savol chiqmasa ham test bo'ladi
  if (questions.length === 0 && keywords.length >= 2) {
    for (const keyword of keywords.slice(0, count)) {
      const pool = keywords.filter((k) => k !== keyword).slice(0, 3);
      if (pool.length < 1) break;
      add({
        text: `«${keyword}» ushbu manbada mavjudmi?`,
        type: "truefalse",
        points: 1,
        choices: [
          { text: "To'g'ri", isCorrect: true },
          { text: "Noto'g'ri", isCorrect: false },
        ],
        correctAnswer: null,
        explanation: `Manba matnida «${keyword}» so'zi mavjud.`,
        sourceQuote: (sentences.find((s) => s.includes(keyword)) || "").slice(0, 300),
        sourceKind: "file",
        sourceRef: "manba matni",
      });
    }
  }

  return {
    test: {
      title: input.title,
      description: `${input.topic || input.title} — fayllardan avtomatik yig'ilgan test`,
      language: input.language || "uz",
      passScore: 60,
      timeLimit: Math.ceil(count * 1.5),
      maxAttempts: 1,
      questionCount: count,
      shuffleQuestions: true,
      shuffleChoices: true,
    },
    questions,
    notes:
      "Bu test o'rnatilgan (deterministik) generator bilan yig'ilgan: manba matnidan kalit so'zlar va faktlar ajratib olingan. AI kaliti ishlagan bo'lsa, xuddi shu manba asosida tabiiy savollar yoziladi.",
    coverage: { topics: keywords.slice(0, 8), sourceKinds: { file: questions.length } },
    generation: { mode: "deterministic", provider: "O'rnatilgan generator", model: "deterministic-extractive-v1", cost: 0 },
  };
}

function target0(value: string) {
  return value;
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?…])\s+|\n+/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

const STOPWORDS = new Set([
  "va", "yoki", "ham", "bu", "u", "shu", "bunday", "shunday", "uchun", "bilan", "ga", "dan",
  "da", "de", "ki", " emas", "bo'lgan", "bo'ladi", "bo'lgan", "the", "and", "for", "that", "this",
  "with", "from", "was", "were", "are", "not", "but", "all", "其", "bir", "yoki", "keyin",
  "oldin", "kerak", "mumkin", "bo'lsa", "ish", "ular", "unda", "shuning", "kabi", "gacha",
  "orqali", "tomonidan", "trafikasiya", "ish", "yo'l", "orqali", "bo'lgan",
]);

function extractKeywords(text: string, limit: number) {
  const counts = new Map<string, number>();
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9а-яёўқҳғ'`-]+/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([word]) => word);
}

function pickBlankableWord(sentence: string, keywords: string[]): { word: string } | null {
  const words = sentence.split(/\s+/);
  const keywordSet = new Set(keywords.map((k) => k.toLowerCase()));
  for (const word of words) {
    const clean = word.replace(/[.,;:!?)]/g, "");
    if (clean.length < 5) continue;
    if (!keywordSet.has(clean.toLowerCase())) continue;
    if (/\d/.test(clean)) continue;
    return { word };
  }
  // Kalit so'z topilmasa — eng uzun so'zni olamiz
  const candidate = words
    .map((w) => w.replace(/[.,;:!?)]/g, ""))
    .filter((w) => w.length >= 6 && !STOPWORDS.has(w.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  return candidate ? { word: candidate } : null;
}

function shuffleWithSeed<T>(items: T[], seed: number) {
  const out = [...items];
  let state = Math.abs(seed) + 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ============================================================================
//  Manba yig'ish
// ============================================================================

async function loadAttachments(ids: string[]) {
  const { db } = await import("@/lib/db");
  return db.aiAttachment.findMany({
    where: { id: { in: ids } },
    select: { id: true, fileName: true, extractedText: true, charCount: true },
  });
}

function buildFileCorpus(
  files: { id: string; fileName: string; extractedText: string; charCount: number }[],
  warnings: string[],
) {
  if (files.length === 0) {
    warnings.push("Tanlangan fayl topilmadi.");
    return "";
  }
  // Yuklangan fayl matni — TASHQI MA'LUMOT: sentinel bilan o'raladi,
  // ichidagi ko'rsatma-naqshlar zararsizlantiriladi (prompt-injection himoyasi).
  return files
    .filter((f) => f.extractedText.trim().length > 0)
    .map((f) => {
      const wrapped = wrapUntrustedSource(f.extractedText, `fayl: ${f.fileName}`);
      if (wrapped.flagged > 0) {
        warnings.push(`"${f.fileName}" faylida shubhali matn aniqlandi (${wrapped.flags.join(", ")}) — ma'lumot sifatida ishlatildi.`);
      }
      return wrapped.text;
    })
    .join("\n\n");
}

function buildLessonCorpus(lessons: { lessonId: string; title: string; text: string }[], warnings: string[]) {
  if (lessons.length === 0) return "";
  if (lessons.some((l) => !l.text?.trim())) {
    warnings.push("Ba'zi darslarning matni bo'sh — ular savol uchun ishlatilmadi.");
  }
  return lessons
    .filter((l) => l.text?.trim())
    .map((l) => wrapUntrustedSource(String(l.text), `dars: ${l.title}`).text)
    .join("\n\n");
}

// ============================================================================
//  Tozalash / tekshirish
// ============================================================================

function normalizeDraft(draft: GeneratedDraft, input: GenerateInput, count: number): GeneratedDraft {
  const seen = new Set<string>();
  const questions: GeneratedQuestion[] = [];

  for (const q of draft.questions) {
    if (!q.text || q.text.length < 8) continue;

    const signature = tokenSignature(q.text);
    if (seen.has(signature)) continue;
    seen.add(signature);

    const type = q.type;
    const choices = q.choices.filter((c) => c.text && c.text.length > 0).slice(0, 6);
    const correctCount = choices.filter((c) => c.isCorrect).length;

    if (type === "single" || type === "truefalse") {
      if (choices.length < 2 || correctCount !== 1) continue;
      if (choices.length === 2 && type === "truefalse") {
        const texts = choices.map((c) => c.text.toLowerCase());
        if (!texts.includes("to'g'ri") || !texts.includes("noto'g'ri")) continue;
      }
    } else if (type === "multiple") {
      if (choices.length < 3 || correctCount < 1) continue;
      if (correctCount === choices.length) continue;
    } else if (type === "written") {
      if (!q.correctAnswer || q.correctAnswer.length < 2) continue;
    } else {
      continue;
    }

    questions.push({ ...q, type, choices, points: q.points > 0 ? q.points : 1 });
    if (questions.length >= count) break;
  }

  const kinds = normalizeKinds(draft.coverage?.sourceKinds, questions);

  return {
    test: {
      title: (draft.test?.title || input.title || "AI test").slice(0, 300),
      description: draft.test?.description || "",
      language: draft.test?.language || input.language || "uz",
      passScore: clampNumber(draft.test?.passScore, 1, 100, 60),
      timeLimit: clampNumber(draft.test?.timeLimit, 0, 300, 0),
      maxAttempts: clampNumber(draft.test?.maxAttempts, 0, 20, 1),
      questionCount: Math.max(count, questions.length),
      shuffleQuestions: draft.test?.shuffleQuestions !== false,
      shuffleChoices: draft.test?.shuffleChoices !== false,
    },
    questions,
    notes: draft.notes || "",
    coverage: { topics: draft.coverage?.topics || [], sourceKinds: kinds },
    generation: draft.generation,
  };
}

function normalizeKinds(raw: unknown, questions: GeneratedQuestion[]) {
  const out: Record<string, number> = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (Number.isFinite(Number(value))) out[key] = Number(value);
    }
  }
  for (const q of questions) out[q.sourceKind] = (out[q.sourceKind] || 0) + 1;
  return out;
}

function normalizeType(value: unknown): GeneratedQuestion["type"] {
  const v = String(value || "").toLowerCase();
  if (v === "multiple" || v === "multi" || v === "ko'p") return "multiple";
  if (v === "truefalse" || v === "true_false" || v === "bool" || v === "to'g'ri/noto'g'ri") return "truefalse";
  if (v === "written" || v === "open" || v === "text" || v === "yozma") return "written";
  return "single";
}

function normalizeKind(value: unknown, mode: string): GeneratedQuestion["sourceKind"] {
  const v = String(value || "").toLowerCase();
  if (v === "web" || v === "internet") return "web";
  if (v === "lesson" || v === "dars") return "lesson";
  if (v === "file" || v === "fayl") return "file";
  return mode === "source" ? "file" : mode === "web" ? "web" : "file";
}

function tokenSignature(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9а-яёўқҳғ\s]/gi, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3)
    .sort()
    .slice(0, 12)
    .join(" ");
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}