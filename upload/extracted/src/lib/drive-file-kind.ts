/** Drive import kind from the start of the file name. */
export type DriveContentKind =
  | "lesson"
  | "candidate"
  | "trial"
  | "intern"
  | "level"
  | "attestation";

/** Admin assessment library kinds (Excel from Drive). Lesson checks live in /learning-tests. */
export type AssessmentTestKind =
  | "candidate"
  | "trial"
  | "intern"
  | "level";

export const ASSESSMENT_TEST_KINDS: AssessmentTestKind[] = [
  "candidate",
  "trial",
  "intern",
  "level",
];

export function isAssessmentTestKind(
  value: string,
): value is AssessmentTestKind {
  return (ASSESSMENT_TEST_KINDS as string[]).includes(value);
}

/**
 * Rule (start of file name):
 * «Урок…» → lesson
 * «Кандидат…» → candidate hiring tests
 * «Пробный…» → 5-day trial tests
 * «Стажёр…» → intern tests
 * «Уровень…» → level / rank promotion tests
 * «Аттестация…» → attestation
 * Everything else is ignored.
 */
export function driveContentKindFromFileName(
  fileName: string,
): DriveContentKind | null {
  const base = fileName
    .replace(/\.(xlsx|xls|docx?)$/i, "")
    .trim()
    .replace(/^[\s_\-–—.]+/, "");

  if (/^уроки?([\s_.\-–—]|$)/i.test(base)) return "lesson";
  if (/^кандидат(?:ы|а)?([\s_.\-–—]|$)/i.test(base)) return "candidate";
  if (/^пробн(?:ый|ая|ое|ые)?([\s_.\-–—]|$)/i.test(base)) return "trial";
  if (/^стаж[её]р(?:ы|а)?([\s_.\-–—]|$)/i.test(base)) return "intern";
  if (/^уровень([\s_.\-–—]|$)/i.test(base)) return "level";
  if (/^аттестаци(?:я|и)([\s_.\-–—]|$)/i.test(base)) return "attestation";

  if (/^lessons?([\s_.\-–—]|$)/i.test(base)) return "lesson";
  if (/^candidates?([\s_.\-–—]|$)/i.test(base)) return "candidate";
  if (/^trials?([\s_.\-–—]|$)/i.test(base)) return "trial";
  if (/^interns?([\s_.\-–—]|$)/i.test(base)) return "intern";
  if (/^levels?([\s_.\-–—]|$)/i.test(base)) return "level";
  if (/^attestations?([\s_.\-–—]|$)/i.test(base)) return "attestation";
  return null;
}

export function assessmentSourceForDriveKind(
  kind: AssessmentTestKind,
): AssessmentTestKind {
  return kind;
}
