import "server-only";
import mammoth from "mammoth";

export type ImportedLessonDoc = {
  title: string;
  summary: string;
  contentHtml: string;
  contentText: string;
  slug: string;
  durationMin: number;
};

export {
  looksLikeLessonPlanWorkbook,
  parseWorkbookLessons,
  type ImportedLessonPlan,
} from "./lesson-plan-import";


function titleFromFileName(name: string) {
  return (
    name
      .replace(/\.(docx|doc|xlsx|xls)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim() || name
  );
}

function slugFromFileName(name: string) {
  const base = name.replace(/\.(docx|doc|xlsx|xls)$/i, "").trim().toLowerCase();
  const slug = base
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `lesson-${Date.now()}`;
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function estimateDurationMin(text: string) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(10, Math.min(90, Math.round(words / 160) * 5 || 15));
}

/** Convert a Word .docx buffer into lesson fields for the UI. */
export async function parseDocxLesson(
  buffer: Buffer,
  fileName: string,
): Promise<ImportedLessonDoc> {
  const result = await mammoth.convertToHtml({ buffer });
  let contentHtml = result.value?.trim() || "";
  if (!contentHtml) {
    const plain = await mammoth.extractRawText({ buffer });
    const text = plain.value?.trim() || titleFromFileName(fileName);
    contentHtml = `<p>${text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .join("</p><p>")}</p>`;
  }

  // Soften mammoth output for our lesson panel
  contentHtml = contentHtml
    .replace(/<\/?div[^>]*>/gi, "")
    .replace(/\s+style="[^"]*"/gi, "");

  const contentText = stripHtml(contentHtml);
  const title =
    contentText.split(/[.!?]/)[0]?.slice(0, 120).trim() ||
    titleFromFileName(fileName);
  // Prefer filename as title (clearer for library)
  const displayTitle = titleFromFileName(fileName);
  const summary =
    contentText.slice(0, 220).trim() + (contentText.length > 220 ? "…" : "");

  return {
    title: displayTitle || title,
    summary: summary || displayTitle,
    contentHtml,
    contentText,
    slug: slugFromFileName(fileName),
    durationMin: estimateDurationMin(contentText),
  };
}
