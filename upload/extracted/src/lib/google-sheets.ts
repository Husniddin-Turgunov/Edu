import "server-only";

/**
 * Google Sheets integration (optional).
 *
 * Expected sheets (same spreadsheet):
 * 1) Tests — columns: title | description | competency | duration_minutes
 * 2) Questions — columns: test_title | prompt | option_a | option_b | option_c | option_d | correct (A-D)
 * 3) Results — columns: timestamp | employee_email | test_title | score | level | assignment_id
 *
 * Env:
 *  GOOGLE_SHEETS_ID=...
 *  GOOGLE_SERVICE_ACCOUNT_EMAIL=...
 *  GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */

export type SheetsSyncSummary = {
  configured: boolean;
  importedTests?: number;
  importedQuestions?: number;
  message: string;
};

export function isSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEETS_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

export async function syncFromGoogleSheets(): Promise<SheetsSyncSummary> {
  if (!isSheetsConfigured()) {
    return {
      configured: false,
      message:
        "Google Sheets ещё не подключён. Добавьте GOOGLE_SHEETS_ID и ключ сервис-аккаунта в env (Vercel).",
    };
  }

  // Wired in next step after you share the sheet link + service account.
  // Keep a clear contract so deploy can go live without Drive first.
  return {
    configured: true,
    importedTests: 0,
    importedQuestions: 0,
    message:
      "Доступ настроен. Следующий шаг: импорт строк из листов Tests / Questions.",
  };
}

export async function pushResultToGoogleSheets(payload: {
  assignmentId: number;
  score: number;
  levelCode: string;
  completedAt: string;
  employeeEmail?: string;
  testTitle?: string;
}) {
  if (!isSheetsConfigured()) return { ok: false as const, skipped: true };

  // Placeholder — will append a row to the Results sheet via Google Sheets API.
  void payload;
  return { ok: true as const, skipped: false };
}
