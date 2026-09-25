const STOP = new Set([
  "и",
  "по",
  "для",
  "на",
  "в",
  "the",
  "a",
  "от",
  "или",
]);

export function normalizeRole(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[–—\-_/]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function roleTokens(value: string) {
  return normalizeRole(value)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP.has(w));
}

const ALIAS_GROUPS = [
  ["системный администратор", "сисадмин", "sysadmin"],
  ["бухгалтер", "accountant"],
  ["call центр", "колл центр", "call-центр", "колл-центр"],
  ["smm", "контент"],
  ["маркетолог", "marketing"],
  ["таргетолог", "таргет"],
  ["мобилограф"],
  ["дизайнер", "графический"],
  ["туризм", "турист"],
  ["рекрутер", "hr"],
  ["помощник", "ассистент"],
];

function aliasHit(a: string, b: string) {
  const na = normalizeRole(a);
  const nb = normalizeRole(b);
  for (const group of ALIAS_GROUPS) {
    const hitA = group.some((g) => na.includes(normalizeRole(g)));
    const hitB = group.some((g) => nb.includes(normalizeRole(g)));
    if (hitA && hitB) return true;
  }
  return false;
}

/** 0–100: how well an assessment title matches a vacancy role. */
export function roleMatchScore(vacancyRole: string, assessmentTitle: string) {
  const v = normalizeRole(vacancyRole);
  const a = normalizeRole(assessmentTitle);
  if (!v || !a) return 0;
  if (v === a) return 100;
  if (v.includes(a) || a.includes(v)) return 88;
  if (aliasHit(v, a)) return 78;

  const vt = roleTokens(vacancyRole);
  const at = roleTokens(assessmentTitle);
  if (!vt.length || !at.length) return 0;

  let hits = 0;
  for (const token of at) {
    if (vt.some((w) => w.includes(token) || token.includes(w))) hits += 1;
  }

  const ratio = hits / Math.max(at.length, 1);
  if (ratio >= 0.66) return Math.round(70 + ratio * 25);
  if (ratio >= 0.34) return Math.round(50 + ratio * 30);
  return 0;
}

export function pickBestRoleMatch<T extends { title: string }>(
  vacancyRole: string,
  options: T[],
  minScore = 50,
): T | null {
  let best: T | null = null;
  let bestScore = minScore - 1;
  for (const item of options) {
    const score = roleMatchScore(vacancyRole, item.title);
    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

/** Strip intern prefix so «Стажёр · Офис-менеджер» matches «Офис-менеджер». */
export function staffRoleBase(roleTitle: string) {
  return roleTitle
    .replace(/^стаж[её]?р\s*[·•:\-–—]?\s*/i, "")
    .replace(/^intern\s*[·•:\-–—]?\s*/i, "")
    .trim();
}

/**
 * 5-day intern program: textbook `role-day-N` and staffing matrix `role-staff-day-N`
 * (Drive files like «урок_Пятидневное_обучение…» / «уроки_для_стажеров_5_дней»).
 * Junior→Middle (`role-j2m-day-N`) stays for employees.
 * Staffing job titles like «Бухгалтер стажер» are still employees as people.
 */
export function isFiveDayInternProgramSlug(slug: string) {
  const value = slug.trim().toLowerCase();
  if (!value) return false;
  if (/^check-/.test(value)) {
    return isFiveDayInternProgramSlug(value.replace(/^check-/, ""));
  }
  if (/-j2m-day-\d+/.test(value)) return false;
  return /-staff-day-\d+/.test(value) || /-day-\d+/.test(value);
}

/**
 * Lesson/test assignment stores staffing role titles in roleFamiliesJson.
 * Prefer exact titles: fuzzy matching over-assigns similar sales/manager roles
 * (PRINT & PACK ↔ WOODWORK, «менеджер» ↔ «HR менеджер»).
 */
export function lessonAssignedToStaffRole(
  assignedRoleTitles: string[],
  employeeRoleTitle: string,
) {
  if (!assignedRoleTitles.length) return false;
  const emp = staffRoleBase(employeeRoleTitle);
  if (!emp) return false;
  const empNorm = normalizeRole(emp);
  return assignedRoleTitles.some((role) => {
    const base = staffRoleBase(role);
    const norm = normalizeRole(base);
    if (!norm) return false;
    if (norm === empNorm) return true;

    // Near-identical containment only (e.g. tiny punctuation / word-order diffs).
    const shorter = norm.length <= empNorm.length ? norm : empNorm;
    const longer = norm.length <= empNorm.length ? empNorm : norm;
    if (
      longer.includes(shorter) &&
      shorter.length >= Math.max(12, Math.floor(longer.length * 0.75))
    ) {
      return true;
    }

    // Short known aliases only («сисадмин» ↔ «системный администратор»).
    if (aliasHit(emp, base) && Math.min(norm.length, empNorm.length) <= 24) {
      const score = roleMatchScore(emp, base);
      return score >= 78;
    }
    return false;
  });
}
