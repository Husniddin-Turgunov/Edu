// lib/lesson-sections.ts
// Shared parser/serializer for lesson content <-> structured sections.
// Mirrors parseLessonSections() in src/app/courses/onboarding/[mi]/[li]/page.tsx.

export type Section = {
  num: string;          // "1", "2", "•", etc.
  title?: string;
  body: string;         // markdown / plain content
  isTable?: boolean;
};

/**
 * Parse markdown content into a flat list of sections.
 * Recognizes:
 *   # 1. Title      ## Title      ### Title      **1. Title**
 */
export function parseSections(content: string): Section[] {
  if (!content || !content.trim()) return [];

  let normalized = content.replace(/\*{3,}/g, "**");

  // Extract [TABLE] blocks — placeholder
  const tableRegex = /\[TABLE\]([\s\S]*?)\[\/TABLE\]/g;
  const tableBlocks: string[] = [];
  normalized = normalized.replace(tableRegex, (_m, inner) => {
    tableBlocks.push(inner.trim());
    return "__TABLE_PLACEHOLDER__\n";
  });

  const lines = normalized.split("\n");
  const collected: Array<{ num: string; title?: string; lines: string[] }> = [];
  let current: { num: string; title?: string; lines: string[] } | null = null;
  let tableIdx = 0;

  for (const line of lines) {
    const trimLine = line.trim();

    const hMatch = trimLine.match(/^(#{1,3})\s+(\d+\.\s*)?(.*)$/);
    if (hMatch) {
      if (current) collected.push(current);
      const num = hMatch[2]
        ? hMatch[2].replace(".", "").trim()
        : hMatch[1].length === 1
        ? "1"
        : "•";
      const title = hMatch[3].trim().replace(/`+/g, "");
      current = { num, title, lines: [] };
      continue;
    }

    const boldH = trimLine.match(/^\*\*\s*(\d+)\s*\.\s+([^*]+?)\*\*\s*$/);
    if (boldH) {
      if (current) collected.push(current);
      current = { num: boldH[1], title: boldH[2].trim().replace(/`+/g, ""), lines: [] };
      continue;
    }

    if (trimLine === "__TABLE_PLACEHOLDER__") {
      tableIdx++;
      continue;
    }

    if (current) current.lines.push(line);
  }
  if (current) collected.push(current);

  const sections: Section[] = [];
  for (const sec of collected) {
    let body = sec.lines.join("\n");
    const isThisTable = sec.title === "Tarix jadvali" || body.trimStart().startsWith("|");
    if (body.includes("__TABLE_PLACEHOLDER__")) {
      const tb = tableBlocks[tableIdx++] || tableBlocks[0];
      body = body.replace(/__TABLE_PLACEHOLDER__\s*/g, "").trim();
      if (!body) {
        sections.push({ num: sec.num, title: sec.title, body: tb, isTable: true });
        continue;
      }
    }
    if (/[│├└]/.test(body)) {
      body = body.replace(/^\n+|\n+$/g, "").trim();
    } else {
      body = body.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "").trim();
    }
    if (body || sec.title) sections.push({ num: sec.num, title: sec.title, body, isTable: isThisTable });
  }

  if (sections.length === 0 && tableBlocks.length > 0) {
    for (let i = 0; i < tableBlocks.length; i++) {
      sections.push({ num: String(i + 1), title: "Tarix jadvali", body: tableBlocks[i], isTable: true });
    }
  }

  if (sections.length === 0 && normalized.trim()) {
    const cleanBody = normalized
      .replace(/__TABLE_PLACEHOLDER__\s*/g, "")
      .replace(/[#`]+/g, "")
      .trim();
    if (cleanBody) sections.push({ num: "•", body: cleanBody, isTable: false });
  }

  // Filter out Rahbariyat (2) and Bo'limlar (4) — same as lesson page parser
  return sections
    .filter((s) => s.body.trim() || s.title)
    .filter((s) => {
      const title = (s.title || "").toLowerCase();
      if (title.includes("jadval")) return false;
      if (s.num === "2" && title.includes("rahbariyat")) return false;
      if (s.num === "4" && title.includes("bo'lim")) return false;
      return true;
    });
}

/**
 * Serialize a list of structured sections back to markdown content.
 * Each section becomes a `## N. Title` heading followed by its body.
 * Sections with num === "•" get `## Title` (no number).
 * Table sections are wrapped in [TABLE]...[/TABLE].
 */
export function serializeSections(sections: Section[]): string {
  const out: string[] = [];
  for (const sec of sections) {
    const headingParts: string[] = [];
    if (sec.title) headingParts.push(sec.title);
    const heading = headingParts.join(" ").trim() || "Bo'lim";

    let headingLine: string;
    if (sec.num && sec.num !== "•" && /^\d+$/.test(sec.num)) {
      headingLine = `## ${sec.num}. ${heading}`;
    } else {
      headingLine = `## ${heading}`;
    }
    out.push(headingLine);
    out.push("");

    if (sec.isTable) {
      out.push("[TABLE]");
      out.push(sec.body);
      out.push("[/TABLE]");
    } else {
      out.push(sec.body);
    }
    out.push("");
  }
  return out.join("\n").trim();
}

/**
 * Coarse preview text — strips markdown markers so the admin sees what end-users read.
 * Used for the lesson preview inside the admin row (small text under title).
 */
export function previewText(content: string, maxLen = 140): string {
  const sections = parseSections(content);
  if (!sections.length) {
    return content.replace(/[#*`>\-]+/g, "").replace(/\s+/g, " ").trim().slice(0, maxLen);
  }
  const first = sections[0];
  const text = (first.body || first.title || "").replace(/[#*`>\-]+/g, "").replace(/\s+/g, " ").trim();
  return text.slice(0, maxLen) + (text.length > maxLen ? "…" : "");
}