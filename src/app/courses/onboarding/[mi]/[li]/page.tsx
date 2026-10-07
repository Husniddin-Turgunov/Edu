"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { Navbar } from "@/components/akela/Navbar";
import Animated3DBackground from "@/components/Animated3DBackground";
import VideoPlayer from "@/components/VideoPlayer";
import { ArrowLeft, BookOpen, Loader2, Hash, Sparkles, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";
import { useState } from "react";
import { useMyCourses } from "@/hooks/useMyCourses";
import { NoAccess } from "@/components/akela/NoAccess";
import { useProgressTimer } from "@/hooks/useProgressTimer";
import { RelatedVideos } from "@/components/akela/RelatedVideos";
import onboardingData from "@/data/akela-onboarding.json";

// Normalize hard-wrapped lines: join lines that don't end with sentence-ending punctuation
// Also handles organogram tree lines (├──, └──, │) which should stay together
function normalizeHardWrap(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      if (result[result.length - 1] !== "") {
        result.push("");
      }
      continue;
    }
    
    // Check if this is an organogram tree line - keep it separate
    if (/^[│├└]/.test(trimmed) || trimmed.startsWith("├──") || trimmed.startsWith("└──")) {
      result.push(trimmed);
      continue;
    }
    
    // Strip backticks and leading heading markers for joining logic
    let cleaned = trimmed
      .replace(/^#{1,6}\s+/, "")
      .replace(/`+/g, "");
    
    const last = result[result.length - 1];
    
    // Don't join if last line was an organogram line
    if (last && /^[│├└]/.test(last)) {
      result.push(cleaned);
      continue;
    }
    
    // Join if last line doesn't end with sentence-ending punctuation
    if (last && !/[.?!;]\s*$/.test(last)) {
      result[result.length - 1] = last + " " + cleaned;
    } else {
      result.push(cleaned);
    }
  }
  
  while (result.length > 0 && result[result.length - 1] === "") {
    result.pop();
  }
  
  return result.join("\n\n");
}

function parseLessonSections(content: string): Array<{ num: string; title?: string; body: string; isTable?: boolean }> {
  if (!content || !content.trim()) return [];
  let normalized = content.replace(/\*{3,}/g, "**");

  // === 1. Extract [TABLE] blocks — replace with placeholder ===
  const tableRegex = /\[TABLE\]([\s\S]*?)\[\/TABLE\]/g;
  const tableBlocks: string[] = [];
  normalized = normalized.replace(tableRegex, (_m, inner) => {
    tableBlocks.push(inner.trim());
    return "__TABLE_PLACEHOLDER__\n";
  });

  // === 2. Detect headings (# 1, ## Sub, ### Sub-sub) ===
  // Also support **N. Title** style headings
  const sections: Array<{ num: string; title?: string; body: string; isTable?: boolean }> = [];

  // Split by lines
  const lines = normalized.split("\n");
  let currentSection: { num: string; title?: string; lines: string[] } | null = null;
  const collected: Array<{ num: string; title?: string; lines: string[] }> = [];

  let tableIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimLine = line.trim();

    // #, ##, ### headings
    const hMatch = trimLine.match(/^(#{1,3})\s+(\d+\.\s*)?(.*)$/);
    if (hMatch) {
      if (currentSection) collected.push(currentSection);
      const num = hMatch[2] ? hMatch[2].replace(".", "").trim() : hMatch[1].length === 1 ? "1" : "•";
      const title = hMatch[3].trim().replace(/`+/g, "");
      currentSection = { num, title, lines: [] };
      continue;
    }

    // **N. Title** heading
    const boldH = trimLine.match(/^\*\*\s*(\d+)\s*\.\s+([^*]+?)\*\*\s*$/);
    if (boldH) {
      if (currentSection) collected.push(currentSection);
      currentSection = { num: boldH[1], title: boldH[2].trim().replace(/`+/g, ""), lines: [] };
      continue;
    }

    // Table placeholder — skip entirely, TABLE is not a lesson section
    if (trimLine === "__TABLE_PLACEHOLDER__") {
      tableIdx++;
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    }
    // Lines before any heading are ignored (intro text or organigramma header)
  }
  if (currentSection) collected.push(currentSection);

  // === 3. Convert collected to sections with proper body ===
  for (const sec of collected) {
    let body = sec.lines.join("\n");
    const isThisTable = sec.title === "Tarix jadvali" || body.trimStart().startsWith("|");
    // Replace placeholder with table block content
    if (body.includes("__TABLE_PLACEHOLDER__")) {
      // Find which table block this is — first unused
      const tb = tableBlocks[tableIdx++] || tableBlocks[0];
      body = body.replace(/__TABLE_PLACEHOLDER__\s*/g, "").trim();
      // If body is empty, use table
      if (!body) {
        sections.push({ num: sec.num, title: sec.title, body: tb, isTable: true });
        continue;
      }
    }
    // Preserve organogram line breaks and structure
    if (/[│├└]/.test(body)) {
      // Don't collapse multiple newlines for organogram content
      body = body.replace(/^\n+|\n+$/g, "").trim();
    } else {
      body = body.replace(/\n{3,}/g, "\n\n").replace(/^\n+|\n+$/g, "").trim();
    }
    if (body || sec.title) {
      sections.push({ num: sec.num, title: sec.title, body, isTable: isThisTable });
    }
  }

  // === 4. If we found table blocks but no sections, create table sections ===
  if (sections.length === 0 && tableBlocks.length > 0) {
    for (let i = 0; i < tableBlocks.length; i++) {
      sections.push({ num: String(i + 1), title: "Tarix jadvali", body: tableBlocks[i], isTable: true });
    }
  }

  // === 5. If sections still empty but content exists, create a single section ===
  if (sections.length === 0 && normalized.trim()) {
    const cleanBody = normalized
      .replace(/__TABLE_PLACEHOLDER__\s*/g, "")
      .replace(/[#`]+/g, "")
      .trim();
    if (cleanBody) {
      sections.push({ num: "•", body: cleanBody, isTable: false });
    }
  }

  // Filter out: TABLE sections (no meaningful body), Rahbariyat section 2, Bo'limlar section 4
  return sections.filter((s) => s.body.trim() || s.title).filter((s) => {
    const title = (s.title || "").toLowerCase();
    // Skip TABLE sections (title contains "jadval")
    if (title.includes("jadval")) return false;
    // Skip section 2 "Rahbariyat" — user said not needed
    if (s.num === "2" && title.includes("rahbariyat")) return false;
    // Skip section 4 "Bo'limlar" — user said not needed
    if (s.num === "4" && title.includes("bo'lim")) return false;
    return true;
  });
}

function renderInline(text: string): React.ReactNode {
  // Strip leading markdown heading markers (#) and backticks for inline display
  let cleaned = text
    .replace(/^#{1,6}\s+/, "") // leading heading markers
    .replace(/`+/g, "");        // backticks (inline code)

  // Simple **bold** handling
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="font-bold text-[color:var(--emerald-deep)]">{p.slice(2, -2)}</strong>;
    }
    return <span key={i}>{p}</span>;
  });
}

function renderTable(body: string): React.ReactNode {
  // Normalize: handle both literal \\n (from JSON) and actual \n, \r
  let normalized = body
    .replace(/\\n\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\\\/g, "\\");

  // === Format 2 (PRIMARY for Akela content): Akela-style "pipe-separated cells" ===
  // Content pattern: [TABLE]\n\n |\n\n**Col1**\n\n |\n\n**Col2**\n\n |\n\n**Data1**\n\n |\n\nData1 description...
  // Each line is just "|" (or "|") as separator; cells are the content between separators
  if (normalized.includes("|") || normalized.includes("**")) {
    // Strategy: split by lines that are JUST a pipe (with optional whitespace)
    // Then the cells are the content between those pipe lines
    const lines = normalized.split(/\n/);
    const segments: string[] = [];
    let current: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // If line is just "|" (or multiple), it's a separator
      if (/^\|+$/.test(trimmed)) {
        // Push current segment
        const seg = current.join("\n").trim();
        if (seg) segments.push(seg);
        current = [];
      } else {
        current.push(line);
      }
    }
    // Don't forget the last segment
    const last = current.join("\n").trim();
    if (last) segments.push(last);

    if (segments.length >= 2) {
      const headers: string[] = [];
      const rows: string[][] = [];

      // Detect headers: collect consecutive **bold** segments at the start (max 2 headers for 2-column table)
      // Header rule: bold segment AND (not numeric, OR is the only single-digit context)
      // Better rule: first 1-2 segments that are **bold** AND not year-like
      let i = 0;
      // Skip [TABLE] tags
      while (i < segments.length) {
        const seg = segments[i].replace(/\s+/g, " ").trim();
        if (seg === "[TABLE]" || seg === "[/TABLE]") {
          i++;
          continue;
        }
        break;
      }
      // Collect headers — at most 2 bold segments that look like column titles
      // (not just a number — a year or single number is data, not a header)
      while (i < segments.length && headers.length < 2) {
        const seg = segments[i].replace(/\s+/g, " ").trim();
        if (/^\*\*[^*]+\*\*$/.test(seg)) {
          const inner = seg.replace(/^\*\*|\*\*$/g, "").trim();
          // A header is a phrase (has spaces) or a non-numeric word
          // A bare number (e.g. **2004**, **2015**) is data
          const isNumber = /^\d{1,4}([–\-]\d{0,4})?( hozirgacha)?$/.test(inner);
          if (isNumber) break; // not a header — start of data
          headers.push(inner);
          i++;
        } else {
          break;
        }
      }

      // Remaining segments come in pairs: (data, description)
      while (i < segments.length) {
        const row: string[] = [];
        // First cell (data — could be **bold** for years)
        row.push(segments[i].replace(/^\*\*|\*\*$/g, "").trim());
        i++;
        // Second cell (description) — collect until next **bold** header
        if (i < segments.length) {
          const rest: string[] = [];
          while (i < segments.length) {
            const seg = segments[i].replace(/\s+/g, " ").trim();
            if (/^\*\*[^*]+\*\*$/.test(seg)) break;
            rest.push(seg);
            i++;
          }
          row.push(rest.join(" ").replace(/\s+/g, " ").trim());
        }
        if (row[0]) rows.push(row);
      }

      if (headers.length > 0 || rows.length > 0) {
        if (headers.length === 0) headers.push("Bo'lim");
        const allCells: string[][] = [];
        if (headers.length > 0) allCells.push(headers);
        allCells.push(...rows);
        return renderTableCells(allCells, headers.length > 0 ? 0 : -1);
      }
    }
  }

  // === Format 1: Real markdown table — lines starting with | ===
  const rawRows = normalized.split(/\n+/).map((r) => r.trim()).filter((r) => r.startsWith("|") && r.length > 1);
  if (rawRows.length >= 2) {
    const allCells = rawRows.map((row) =>
      row.split("|").map((c) => c.trim()).filter((c) => c !== "")
    );
    const colCount = Math.max(...allCells.map((r) => r.length));
    const headerRowIndex = allCells.findIndex((cells) => cells.some((c) => c.includes("**")));
    if (headerRowIndex === -1 && allCells.length >= 2) {
      return renderTableCells(allCells, -1);
    }
    return renderTableCells(allCells, headerRowIndex);
  }

  // Fallback: show as styled pre block
  return (
    <pre className="mt-3 w-full overflow-x-auto rounded-2xl bg-white/40 p-4 text-xs text-[color:var(--ink)] font-mono leading-relaxed ring-1 ring-black/5">
      {body.replace(/\[TABLE\]|\[\/TABLE\]/g, "").replace(/\\n/g, "\n")}
    </pre>
  );
}

function renderTableCells(allCells: string[][], headerRowIndex: number): React.ReactNode {
  if (allCells.length < 2) return null;
  const colCount = Math.max(...allCells.map((r) => r.length));
  const actualHeaderIdx = headerRowIndex >= 0 ? headerRowIndex : 0;
  const hasHeader = headerRowIndex >= 0;

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl ring-1 ring-black/5">
      <table className="w-full border-collapse text-sm">
        {hasHeader && (
          <thead>
            <tr>
              {allCells[actualHeaderIdx].map((h, ci) => (
                <th
                  key={ci}
                  className="bg-gradient-to-r from-indigo-600/90 to-teal-600/90 px-4 py-3 text-left font-extrabold text-white first:rounded-tl-xl last:rounded-tr-xl"
                >
                  {renderInline(h)}
                </th>
              ))}
              {allCells[actualHeaderIdx].length < colCount &&
                Array.from({ length: colCount - allCells[actualHeaderIdx].length }).map((_, ci) => (
                  <th key={`eh-${ci}`} className="bg-gradient-to-r from-indigo-600/90 to-teal-600/90 first:rounded-tl-xl last:rounded-tr-xl" />
                ))}
            </tr>
          </thead>
        )}
        <tbody>
          {(hasHeader
            ? allCells.slice(0, actualHeaderIdx).concat(allCells.slice(actualHeaderIdx + 1))
            : allCells
          ).map((row, ri) => (
            <tr key={ri} className={`border-b border-black/5 last:border-0 ${ri % 2 === 0 ? "bg-white/50" : "bg-white/20"}`}>
              {row.map((cell, ci) => (
                <td key={ci} className={`px-4 py-3 text-[color:var(--ink)] ${ci === 0 && hasHeader ? "font-semibold text-[color:var(--emerald-deep)]" : ""}`}>
                  {renderInline(cell)}
                </td>
              ))}
              {row.length < colCount &&
                Array.from({ length: colCount - row.length }).map((_, ci) => (
                  <td key={`empty-${ci}`} className="px-4 py-3" />
                ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OnboardingLessonPage() {
  const params = useParams<{ mi: string; li: string }>();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("uz");
  const strings = UI_STRINGS[locale];
  const mi = parseInt(params.mi);
  const li = parseInt(params.li);

  const [course, setCourse] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const access = useMyCourses();
  const moduleItem = course?.modules?.[mi] as any;
  const lesson = moduleItem?.lessons?.[li] as any;
  // O'zlashtirish: vaqt yurak urishi + keyingi qadamda yakunlash
  const { finish } = useProgressTimer({ lessonId: lesson?.id });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) setCourse(data.course);
      } catch (e) {
        console.error("Failed to load onboarding", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [activeSec, setActiveSec] = useState(0);
  const [maxSec, setMaxSec] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    setActiveSec(0);
    setMaxSec(0);
  }, [mi, li]);

  const goToSection = (next: number) => {
    if (next < 0) return;
    if (next > maxSec) return;
    setActiveSec(next);
    if (next > maxSec) setMaxSec(next);
  };

  const advanceSection = (total: number) => {
    setActiveSec((s) => {
      const next = Math.min(total - 1, s + 1);
      setMaxSec((m) => Math.max(m, next));
      return next;
    });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [mi, li]);

  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  if (!loading && (!course || !moduleItem || !lesson)) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">Dars topilmadi</h1>
          <p className="mt-2 text-sm text-[color:var(--ink-soft)]">Admin panel orqali avval darslarni qo&apos;shing.</p>
          <Link href="/courses" className="mt-4 inline-block text-amber-600 underline">← Kurslar</Link>
        </div>
      </main>
    );
  }

  if (loading || !moduleItem || !lesson) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <LiquidBackground />
        <div className="relative glass-card rounded-3xl p-8 text-center">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-[color:var(--ink-soft)]">Yuklanmoqda...</p>
        </div>
      </main>
    );
  }

  // Biriktirilmagan foydalanuvchi bu darsni ko'ra olmaydi
  if (!access.loading && !access.hasOnboarding) {
    return <NoAccess />;
  }

  const allLessons = (course?.modules ?? []).flatMap((m: any, i: number) =>
    (m.lessons ?? []).map((l: any, j: number) => ({ ...l, mIdx: i, lIdx: j }))
  );
  const flatIdx = allLessons.findIndex((l: any) => l.mIdx === mi && l.lIdx === li);
  const prev = allLessons[flatIdx - 1];
  const next = allLessons[flatIdx + 1];
  const progress = allLessons.length > 0 ? ((flatIdx + 1) / allLessons.length) * 100 : 0;

  return (
    <main className="min-h-screen bg-background">
      <LiquidBackground />
      <Animated3DBackground />
      <Navbar locale={locale} strings={strings} onLocaleChange={setLocale} />

      {/* Header — enhanced cream style */}
      <header className="relative pt-28 pb-8">
        <div className="mx-auto max-w-4xl px-6">
          <Link href="/courses" className="inline-flex items-center gap-2 text-sm font-medium text-[color:var(--ink-soft)] hover:text-[color:var(--emerald-deep)] transition-colors">
            <ArrowLeft className="h-4 w-4" /> Barcha kurslar
          </Link>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
            <BookOpen className="h-3.5 w-3.5" />
            <span>Modul {mi + 1}: {moduleItem.title}</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold text-[color:var(--emerald-deep)] leading-tight">{lesson.title}</h1>
        </div>
        {/* Enhanced progress bar */}
        <div className="mx-auto max-w-4xl px-6 mt-6">
          <div className="h-2 rounded-full bg-gradient-to-r from-black/5 to-black/10 overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-indigo-400 to-indigo-500 transition-all duration-700 ease-out shadow-lg"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-3 flex justify-between items-center">
            <span className="text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
              Progress
            </span>
            <span className="text-xs font-bold text-[color:var(--emerald-deep)]">
              {flatIdx + 1} / {allLessons.length} dars
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        {/* Test CTA — tepada */}
        {(() => {
          // Check types from static JSON (database doesn't have types field)
          const staticLesson = (onboardingData as any[])?.[mi]?.lessons?.[li];
          const hasTest = staticLesson?.types?.includes("test") || staticLesson?.types?.includes("quiz");
          if (!hasTest) return null;
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-card rounded-3xl p-6 bg-gradient-to-br from-amber-50/60 to-amber-100/30 ring-2 ring-amber-300/50"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-extrabold text-amber-900">✏️ Dars bo'yicha test</h3>
                  <p className="text-sm text-amber-800 mt-1">Bilimlaringizni sinab ko'ring — 5 ta savol.</p>
                </div>
                <Link
                  href={`/test/akela-onboarding/${mi}/${li}`}
                  onClick={finish}
                  className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:scale-105 transition-transform"
                >
                  Testni boshlash →
                </Link>
              </div>
            </motion.div>
          );
        })()}

        {/* Dars kontenti — umumiy avtomatik dizayn */}
        {(() => {
          const sections = parseLessonSections(lesson.content || "");
          const hasSections = sections.length > 0;
          const displaySections: Array<{ num: string; title?: string; body: string; isTable?: boolean }> = hasSections ? sections : [{ num: "•", body: lesson.content || "Bu dars uchun kontent tayyor emas. Iltimos, dars matnini so'rang." }];
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="glass-pill inline-flex items-center gap-2 text-xs font-bold text-[color:var(--emerald-deep)]">
                  <BookOpen className="h-3.5 w-3.5" /> 📖 Dars kontenti
                </span>
                <span className="text-xs text-[color:var(--ink-soft)]">
                  {displaySections.length} bo'lim • {lesson.title}
                </span>
                <span className="ml-auto glass-pill px-4 py-1.5 text-sm font-bold text-[color:var(--emerald-deep)]">
                  Dars {flatIdx + 1} / {allLessons.length} ({Math.round(progress)}%)
                </span>
              </div>

                <div className="relative">
                  <motion.div
                    layout
                    transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
                    className="glass-card relative overflow-hidden rounded-3xl p-8 sm:p-10"
                  >
                    {(() => {
                      const sec = displaySections[activeSec];
                      const idx = activeSec;
                      const palette = idx % 2 === 0 ? "from-indigo-600 to-teal-600" : "from-amber-500 to-orange-500";
                      const secNum = sec.num;
                      const lines = sec.body.split("\n").map((s) => s.trim()).filter((l) => l !== "");
                      // At least 2 list lines AND list lines >= 30% of total lines
                      const listLines = lines.filter((l) => l.startsWith("-") || l.startsWith("•"));
                      const isList = listLines.length >= 2 && listLines.length >= lines.length * 0.3;
                      const isTable = sec.isTable;

                      // Table icon — use CalendarDays for historical data
                      const TableIcon = isTable
                        ? ({ className }: { className?: string }) => (
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
                              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
                            </svg>
                          )
                        : Sparkles;

                      return (
                        <motion.div
                          key={activeSec}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${palette} opacity-[0.08] blur-2xl`} />
                          <div className="relative flex gap-4">
                            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${palette} text-white shadow-md`}>
                              {secNum === "•" ? <Sparkles className="h-4 w-4" /> : <span className="text-sm font-extrabold">{secNum}</span>}
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                              {sec.title && (
                                <h3 className="text-base font-extrabold text-[color:var(--emerald-deep)] leading-snug mb-2">
                                  {isTable ? <span className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>{renderInline(sec.title)}</span> : renderInline(sec.title)}
                                </h3>
                              )}
                              {isTable ? (
                                renderTable(sec.body)
                              ) : isList ? (
                                (() => {
                                  const rawLines = sec.body.split("\n").map((s: string) => s.trim()).filter((l: string) => l !== "");
                                  const listItems: string[] = [];
                                  const proseLines: string[] = [];
                                  for (let li = 0; li < rawLines.length; li++) {
                                    const ln = rawLines[li];
                                    if (ln.startsWith("-") || ln.startsWith("•")) {
                                      let item = ln;
                                      while (
                                        li + 1 < rawLines.length &&
                                        !rawLines[li + 1].startsWith("-") &&
                                        !rawLines[li + 1].startsWith("•") &&
                                        !/^#{1,3}\s/.test(rawLines[li + 1])
                                      ) {
                                        li++;
                                        item += " " + rawLines[li];
                                      }
                                      listItems.push(item);
                                    } else {
                                      proseLines.push(ln);
                                    }
                                  }
                                  const mergedProse = proseLines.length > 0 ? normalizeHardWrap(proseLines.join("\n")).split("\n\n").filter((p: string) => p.trim()) : [];
                                  return (
                                    <div className="space-y-2">
                                      {mergedProse.map((para: string, pi: number) => (
                                        <p key={`p${pi}`} className="text-base leading-relaxed text-[color:var(--ink)]">
                                          {renderInline(para)}
                                        </p>
                                      ))}
                                      {listItems.map((line: string, li: number) => {
                                        const clean = line.replace(/^[-•]\s*/, "").replace(/;$/, "");
                                        if (!clean) return null;
                                        return (
                                          <p key={`l${li}`} className="text-base leading-relaxed text-[color:var(--ink)]">
                                            {renderInline(clean)}
                                          </p>
                                        );
                                      })}
                                    </div>
                                  );
                                })()
                              ) : (
                                (() => {
                                  // Detect organogram content
                                  const hasOrgTree = /[│├└]/.test(sec.body) && (sec.body.includes("├──") || sec.body.includes("└──") || sec.body.includes("│"));
                                  if (hasOrgTree) {
                                    // Parse organogram - extract department names only
                                    const rawLines = sec.body.replace(/`+/g, "").split("\n");
                                    const departments: string[] = [];
                                    
                                    for (const rawLine of rawLines) {
                                      const line = rawLine.trim();
                                      if (!line) continue;
                                      
                                      // Extract department names from tree lines
                                      if (line.startsWith("├──") || line.startsWith("└──")) {
                                        let text = line.replace(/^├──\s*/, "").replace(/^└──\s*/, "").trim();
                                        // Remove tree characters and clean up
                                        text = text.replace(/[│├└─]/g, "").replace(/\s+/g, " ").trim();
                                        // Remove person names (everything after common separators)
                                        text = text.split(/[—-]/)[0].trim();
                                        // Clean up department name
                                        text = text.replace(/bo'limi|department|division/gi, "").trim();
                                        
                                        if (text && text.length > 1) {
                                          departments.push(text);
                                        }
                                      }
                                    }
                                    
                                    // New organogram component with proper structure
                                    const deptCount = departments.length;
                                    
                                    return (
                                      <div className="mt-8 mb-4 overflow-x-auto py-2">
                                        <div className="flex flex-col items-center min-w-max mx-auto px-4">
                                          {/* Director Node */}
                                          <div className="relative z-10 flex flex-col items-center">
                                            <div className="px-6 py-3 rounded-2xl bg-gradient-to-br from-amber-100 via-amber-50 to-orange-50 border-2 border-amber-400 shadow-md flex flex-col items-center justify-center">
                                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full mb-1">
                                                Boshqaruv
                                              </span>
                                              <span className="text-sm font-black text-amber-900">Bosh direktor</span>
                                            </div>
                                            {/* Stem down from director */}
                                            <div className="w-0.5 h-6 bg-emerald-500" />
                                          </div>

                                          {/* Department Nodes Row with Connected Tree Lines */}
                                          <div className="relative flex justify-center">
                                            <div className="flex">
                                              {departments.map((dept, idx) => {
                                                const isFirst = idx === 0;
                                                const isLast = idx === departments.length - 1;
                                                const isOnly = departments.length === 1;

                                                return (
                                                  <div key={idx} className="relative flex flex-col items-center px-2 sm:px-3">
                                                    {/* Connector lines above card */}
                                                    <div className="h-6 w-full relative flex justify-center">
                                                      {/* Horizontal line */}
                                                      {!isOnly && (
                                                        <div
                                                          className={`absolute top-0 h-0.5 bg-emerald-500 ${
                                                            isFirst
                                                              ? "left-1/2 right-0"
                                                              : isLast
                                                              ? "left-0 right-1/2"
                                                              : "left-0 right-0"
                                                          }`}
                                                        />
                                                      )}
                                                      {/* Vertical drop line to card */}
                                                      <div className="w-0.5 h-6 bg-emerald-500" />
                                                    </div>

                                                    {/* Department Card */}
                                                    <div className="w-24 sm:w-28 h-14 rounded-xl bg-white border-2 border-emerald-300 hover:border-emerald-500 flex items-center justify-center p-2 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                                                      <span className="text-xs font-bold text-emerald-800 text-center leading-tight">
                                                        {dept}
                                                      </span>
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  // Normal text: use normalizeHardWrap to join hard-wrapped lines
                                  const body = sec.body.replace(/^[-•]\s*/gm, "");
                                  return (
                                    <div className="text-base leading-relaxed text-[color:var(--ink)] space-y-3">
                                      {normalizeHardWrap(body).split("\n\n").filter((p) => p.trim()).map((para, pi) => (
                                        <p key={pi} style={{ textWrap: "balance" }}>
                                          {renderInline(para.trim())}
                                        </p>
                                      ))}
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })()}
                  </motion.div>

                {displaySections.length > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      onClick={() => goToSection(activeSec - 1)}
                      disabled={activeSec === 0}
                      className="inline-flex items-center gap-1.5 rounded-xl glass px-4 py-2 text-sm font-semibold text-[color:var(--emerald-deep)] transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                    >
                      <ChevronLeft className="h-4 w-4" /> Oldingi
                    </button>

                    <div className="flex items-center gap-2">
                      <div className="hidden sm:flex items-center gap-1.5">
                        {displaySections.map((_, i) => {
                          const locked = i > maxSec;
                          return (
                            <button
                              key={i}
                              onClick={() => goToSection(i)}
                              disabled={locked}
                              title={locked ? "Avval joriy bo'limni yakunlang" : undefined}
                              className={`h-1.5 rounded-full transition-all disabled:cursor-not-allowed ${i === activeSec ? "w-6 bg-indigo-600" : locked ? "w-1.5 bg-black/10" : "w-1.5 bg-black/15 hover:bg-black/25"}`}
                              aria-label={`Bo'lim ${i + 1}`}
                              aria-disabled={locked}
                            />
                          );
                        })}
                      </div>
                      <span className="glass-pill text-xs font-bold text-[color:var(--emerald-deep)]">
                        {activeSec + 1} / {displaySections.length}
                      </span>
                    </div>

                    <button
                      onClick={() => advanceSection(displaySections.length)}
                      disabled={activeSec === displaySections.length - 1}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
                    >
                      Keyingi <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Next/Prev lesson button — always shown at the end of the section content */}
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-black/5 pt-6">
                  {prev ? (
                    <Link
                      href={`/courses/onboarding/${prev.mIdx}/${prev.lIdx}`}
                      className="lesson-nav-btn lesson-nav-prev group"
                    >
                      <ChevronLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                      <span className="truncate max-w-[200px]">
                        {prev.title?.length > 30 ? prev.title.slice(0, 30) + "…" : prev.title}
                      </span>
                    </Link>
                  ) : (
                    <div />
                  )}

                  {next ? (
                    <Link
                      href={`/courses/onboarding/${next.mIdx}/${next.lIdx}`}
                      onClick={finish}
                      className="lesson-nav-btn lesson-nav-next group"
                    >
                      <span className="truncate max-w-[200px]">
                        {next.title?.length > 30 ? next.title.slice(0, 30) + "…" : next.title}
                      </span>
                      <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  ) : (
                    <Link
                      href="/courses"
                      onClick={finish}
                      className="lesson-nav-btn lesson-nav-next flex items-center gap-2"
                    >
                      🎉 Kurs tugadi
                    </Link>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Enhanced progress indicator */}
        <div className="lesson-progress-card">
          <div className="flex items-center gap-3">
            <div className="lesson-progress-badge">
              {flatIdx + 1}
            </div>
            <div>
              <p className="text-xs font-semibold text-[color:var(--ink-soft)] uppercase tracking-wider">
                Dars progress
              </p>
              <p className="text-sm font-bold text-[color:var(--emerald-deep)]">
                {flatIdx + 1} / {allLessons.length}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">
              {Math.round(progress)}%
            </p>
          <p className="text-xs text-[color:var(--ink-soft)]">completed</p>
            </div>
          </div>

          {/* Darsga joylashtirilgan tegishli videolar */}
          <RelatedVideos />
        </div>
      </main>
    );
  }
