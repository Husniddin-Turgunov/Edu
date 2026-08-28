import { scoreToLevel, type LevelCode } from "./levels";

export type QuestionType = "single" | "multiple" | "text";
/** Раздел теста: знания или стремление */
export type SectionKind = "knowledge" | "aspiration";

export type AnswerValue = number | number[] | string;

export type ScorableQuestion = {
  id: number;
  prompt?: string | null;
  type: string;
  correctIndex: number;
  correctIndexesJson: string;
  keywordsJson: string;
  optionsJson: string;
  weight: number;
  difficulty?: string | null;
  knowledgeKind?: string | null;
  section?: string | null;
};

export type BandStat = {
  earned: number;
  total: number;
  pct: number;
};

export type QuestionHit = {
  id: number;
  prompt: string;
  /** true/false = автопроверка; null = открытый / без ключа (для HR) */
  correct: boolean | null;
  answerPreview?: string;
};

export type SectionProfile = {
  name: string;
  kind: SectionKind;
  earned: number;
  total: number;
  pct: number;
  correctCount: number;
  questionCount: number;
  autoCount: number;
  items: QuestionHit[];
};

export type FitCode =
  | "strong"
  | "knowledge_ok"
  | "aspiration_ok"
  | "mixed"
  | "weak"
  | "knowledge_only"
  | "aspiration_only";

export type KnowledgeProfile = {
  overallScore: number;
  /** Сколько автопроверяемых вопросов закрыл / всего */
  autoCorrect: number;
  autoTotal: number;
  knowledgeScore: number | null;
  aspirationScore: number | null;
  sections: SectionProfile[];
  strengths: string[];
  gaps: string[];
  fitCode: FitCode;
  levelCode: Exclude<LevelCode, "unassessed">;
  summary: string;
  byDifficulty?: Partial<Record<string, BandStat>>;
  byKind?: Partial<Record<string, BandStat>>;
};

const PASS = 0.7;
const WEAK = 0.5;

function parseIndexes(q: ScorableQuestion): number[] {
  try {
    const raw = JSON.parse(q.correctIndexesJson || "[]") as unknown;
    if (Array.isArray(raw) && raw.length > 0) {
      return raw.map(Number).filter((n) => Number.isFinite(n));
    }
  } catch {
    // fall through
  }
  return [q.correctIndex];
}

function parseKeywords(q: ScorableQuestion): string[] {
  try {
    const raw = JSON.parse(q.keywordsJson || "[]") as unknown;
    if (Array.isArray(raw)) {
      return raw
        .map((k) => String(k).trim().toLowerCase())
        .filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

function sameIndexSet(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
}

export function normalizeSection(raw: string | null | undefined): string {
  const v = String(raw ?? "").trim();
  return v || "Общий";
}

export function normalizeKind(raw: string | null | undefined): SectionKind {
  const v = String(raw ?? "knowledge").toLowerCase();
  if (
    v.includes("aspir") ||
    v.includes("стрем") ||
    v.includes("мотив") ||
    v.includes("drive") ||
    v.includes("интерес") ||
    v.includes("потенциал")
  ) {
    return "aspiration";
  }
  return "knowledge";
}

export function normalizeDifficulty(raw: string | null | undefined): string {
  return String(raw ?? "junior").toLowerCase() || "junior";
}

/** Открытый без ключевых слов или weight 0 — не идёт в автобалл */
export function isAutoScored(q: ScorableQuestion): boolean {
  if ((q.weight ?? 1) <= 0) return false;
  const type = (q.type || "single") as QuestionType;
  if (type === "text" && parseKeywords(q).length === 0) return false;
  return true;
}

export function isAnswerCorrect(
  q: ScorableQuestion,
  answer: AnswerValue | undefined,
): boolean {
  const type = (q.type || "single") as QuestionType;

  if (type === "text") {
    if (typeof answer !== "string") return false;
    const text = answer.trim().toLowerCase();
    if (!text) return false;
    const keywords = parseKeywords(q);
    if (keywords.length === 0) return false;
    return keywords.every((kw) => text.includes(kw));
  }

  const correct = parseIndexes(q);

  if (type === "multiple") {
    const selected = Array.isArray(answer)
      ? answer.map(Number)
      : typeof answer === "number"
        ? [answer]
        : [];
    return sameIndexSet(selected, correct);
  }

  const selected =
    typeof answer === "number"
      ? answer
      : Array.isArray(answer) && answer.length === 1
        ? answer[0]
        : undefined;
  return selected === correct[0];
}

function previewAnswer(answer: AnswerValue | undefined): string {
  if (answer === undefined || answer === null) return "";
  if (typeof answer === "string") {
    const t = answer.trim();
    return t.length > 160 ? `${t.slice(0, 160)}…` : t;
  }
  if (Array.isArray(answer)) return answer.join(", ");
  return String(answer);
}

function pctOf(earned: number, total: number) {
  return total === 0 ? 0 : earned / total;
}

function decideFit(
  knowledgeScore: number | null,
  aspirationScore: number | null,
): FitCode {
  if (knowledgeScore === null && aspirationScore === null) return "mixed";
  if (knowledgeScore === null) return "aspiration_only";
  if (aspirationScore === null) return "knowledge_only";

  const kOk = knowledgeScore >= PASS;
  const aOk = aspirationScore >= PASS;
  const kWeak = knowledgeScore < WEAK;
  const aWeak = aspirationScore < WEAK;

  if (kOk && aOk) return "strong";
  if (kOk && aWeak) return "knowledge_ok";
  if (aOk && kWeak) return "aspiration_ok";
  if (kWeak && aWeak) return "weak";
  return "mixed";
}

function fitSummary(
  fit: FitCode,
  knowledgePct: number | null,
  aspirationPct: number | null,
  overall: number,
  autoCorrect: number,
  autoTotal: number,
): string {
  const k =
    knowledgePct === null ? null : Math.round(knowledgePct * 100);
  const a =
    aspirationPct === null ? null : Math.round(aspirationPct * 100);
  const parts = [
    `Автобалл ${overall}% (${autoCorrect} из ${autoTotal} тестовых).`,
  ];
  if (k !== null) parts.push(`Знания ${k}%.`);
  if (a !== null) parts.push(`Стремление ${a}%.`);
  parts.push("Открытые ответы — на разбор HR.");

  switch (fit) {
    case "strong":
      parts.push("По авточасти подходит по знаниям и по стремлению.");
      break;
    case "knowledge_ok":
      parts.push("Знания ок, стремление слабое.");
      break;
    case "aspiration_ok":
      parts.push("Стремление ок, знаний не хватает.");
      break;
    case "weak":
      parts.push("И знания, и стремление пока слабые.");
      break;
    case "knowledge_only":
      parts.push("В тесте только разделы знаний.");
      break;
    case "aspiration_only":
      parts.push("В тесте только стремление.");
      break;
    default:
      parts.push("Картина смешанная — смотрите блоки.");
  }
  return parts.join(" ");
}

/**
 * 5 блоков × ~10 вопросов: по каждому видно, что закрыл.
 * Открытые без ключа не штрафуют автобалл.
 * Уровень — по шкале документа (эквивалент 1–10…41–50 на %).
 */
export function analyzeKnowledgeProfile(
  qs: ScorableQuestion[],
  answers: Record<string, AnswerValue>,
): KnowledgeProfile {
  type Acc = {
    name: string;
    kind: SectionKind;
    earned: number;
    total: number;
    correctCount: number;
    autoCount: number;
    items: QuestionHit[];
  };

  const sectionMap = new Map<string, Acc>();
  let overallEarned = 0;
  let overallTotal = 0;
  let knowledgeEarned = 0;
  let knowledgeTotal = 0;
  let aspirationEarned = 0;
  let aspirationTotal = 0;
  let autoCorrect = 0;
  let autoTotal = 0;

  for (const q of qs) {
    const name = normalizeSection(q.section);
    const kind = normalizeKind(q.knowledgeKind);
    const key = `${kind}::${name}`;
    const auto = isAutoScored(q);
    const w = auto ? q.weight || 1 : 0;
    const rawOk = isAnswerCorrect(q, answers[String(q.id)]);
    const correct: boolean | null = auto ? rawOk : null;

    let acc = sectionMap.get(key);
    if (!acc) {
      acc = {
        name,
        kind,
        earned: 0,
        total: 0,
        correctCount: 0,
        autoCount: 0,
        items: [],
      };
      sectionMap.set(key, acc);
    }

    if (auto) {
      acc.total += w;
      acc.autoCount += 1;
      overallTotal += w;
      autoTotal += 1;
      if (kind === "knowledge") knowledgeTotal += w;
      else aspirationTotal += w;

      if (rawOk) {
        acc.earned += w;
        acc.correctCount += 1;
        overallEarned += w;
        autoCorrect += 1;
        if (kind === "knowledge") knowledgeEarned += w;
        else aspirationEarned += w;
      }
    }

    acc.items.push({
      id: q.id,
      prompt: String(q.prompt ?? "").trim() || `Вопрос #${q.id}`,
      correct,
      answerPreview:
        correct === null ? previewAnswer(answers[String(q.id)]) : undefined,
    });
  }

  const sections: SectionProfile[] = [...sectionMap.values()]
    .map((s) => ({
      name: s.name,
      kind: s.kind,
      earned: s.earned,
      total: s.total,
      pct: pctOf(s.earned, s.total),
      correctCount: s.correctCount,
      questionCount: s.items.length,
      autoCount: s.autoCount,
      items: s.items,
    }))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "knowledge" ? -1 : 1;
      return a.name.localeCompare(b.name, "ru");
    });

  const strengths: string[] = [];
  const gaps: string[] = [];
  for (const s of sections) {
    if (s.autoCount === 0) continue;
    const label = `${s.kind}:${s.name}`;
    if (s.pct >= PASS) strengths.push(label);
    else if (s.pct < WEAK) gaps.push(label);
    else gaps.push(`partial:${s.kind}:${s.name}`);
  }

  const knowledgeScore =
    knowledgeTotal > 0 ? pctOf(knowledgeEarned, knowledgeTotal) : null;
  const aspirationScore =
    aspirationTotal > 0 ? pctOf(aspirationEarned, aspirationTotal) : null;
  const overallScore =
    overallTotal === 0
      ? 0
      : Math.round(pctOf(overallEarned, overallTotal) * 100);

  const fitCode = decideFit(knowledgeScore, aspirationScore);
  const levelBasis =
    knowledgeScore !== null ? knowledgeScore * 100 : overallScore;
  const levelCode = scoreToLevel(levelBasis);

  return {
    overallScore,
    autoCorrect,
    autoTotal,
    knowledgeScore,
    aspirationScore,
    sections,
    strengths,
    gaps,
    fitCode,
    levelCode,
    summary: fitSummary(
      fitCode,
      knowledgeScore,
      aspirationScore,
      overallScore,
      autoCorrect,
      autoTotal,
    ),
  };
}

export function scoreAnswers(
  qs: ScorableQuestion[],
  answers: Record<string, AnswerValue>,
) {
  const profile = analyzeKnowledgeProfile(qs, answers);
  return {
    score: profile.overallScore,
    earned: 0,
    total: 0,
    profile,
  };
}
