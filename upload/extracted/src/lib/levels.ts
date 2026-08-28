export const LEVEL_ORDER = [
  "intern",
  "junior",
  "middle",
  "senior",
  "lead",
  "expert",
] as const;

export type LevelCode = (typeof LEVEL_ORDER)[number] | "unassessed";

/**
 * Шкала из HR-теста (эквивалент числа верных из 50 как %):
 * 1–10 начальный, 11–20 средний, 21–30 хороший,
 * 31–40 высокий, 41–50 эксперт.
 * Уровень «стажёр» не выставляется баллом теста — только статусом стажировки.
 */
export function scoreToLevel(score: number): Exclude<LevelCode, "unassessed" | "intern"> {
  if (score >= 82) return "expert"; // ~41/50
  if (score >= 62) return "lead"; // ~31/50
  if (score >= 42) return "senior"; // ~21/50
  if (score >= 22) return "middle"; // ~11/50
  return "junior"; // 1–10
}

export function levelLabel(code: string): string {
  const map: Record<string, string> = {
    unassessed: "Не оценён",
    intern: "Стажёр",
    junior: "Junior",
    middle: "Middle",
    senior: "Senior",
    lead: "Lead",
    expert: "Expert",
  };
  return map[code] ?? code;
}

export function staffLevel(
  code: string | null | undefined,
): Exclude<LevelCode, "unassessed"> {
  if (code && LEVEL_ORDER.includes(code as (typeof LEVEL_ORDER)[number])) {
    return code as Exclude<LevelCode, "unassessed">;
  }
  return "junior";
}

export function nextLevel(code: string): string | null {
  const current = staffLevel(code);
  const idx = LEVEL_ORDER.indexOf(current);
  if (idx < 0 || idx >= LEVEL_ORDER.length - 1) return null;
  return LEVEL_ORDER[idx + 1];
}

export function levelTone(code: string): string {
  const map: Record<string, string> = {
    unassessed: "#7a7f96",
    intern: "#5a8f7b",
    junior: "#3aa66e",
    middle: "#786cb4",
    senior: "#3e4095",
    lead: "#c9a44a",
    expert: "#5ec8ff",
  };
  return map[code] ?? "#7a7f96";
}
