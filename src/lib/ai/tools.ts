/**
 * lib/ai/tools.ts
 *
 * AI vositalarining registri. Chat va "imkoniyatlar" sahifasi shu ro'yxatdan
 * foydalanadi вЂ” ya'ni chatda ko'rsatiladigan har bir imkoniyat haqiqatan
 * bajariladigan funksiyaga bog'langan (hujjatsiz yoki "keyin qo'shiladi"
 * turgan funksiya yo'q).
 *
 * Xavfsizlik:
 *  - har bir argument zod bilan tekshiriladi
 *  - o'zgartiradigan vositalar audit jadvaliga yoziladi
 *  - xavfli vositalar (o'chirish, bloklash) `confirm: true` talab qiladi
 *  - barcha resurslar bazadan topiladi (SQL/HTML hech qachon modelga tegilmaydi)
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { tmpdir } from "node:os";
import { readFile as readDiskFile, writeFile as writeDiskFile, mkdir as makeDir } from "node:fs/promises";
import nodePath from "node:path";
import type { DocSpec } from "./docgen";
import { isVerifiedTool, verifyToolResult } from "./verify";

/**
 * Kodni ishga tushirish chegaralari.
 *
 * `CODE_TIMEOUT_MS` — kod o'z-o'zidan to'xtamaydigan bo'lishi mumkin
 * (`while(true)`), shuning uchun jarayon majburan o'ldiriladi. 15 s
 * hisob-kitob uchun yetarli, foydalanuvchi esa kutishni sezmaydi.
 * `MAX_CODE_OUTPUT` — natija matni chegarasi: modelga haddan tashqari katta
 * matn yuborish kvotani tez tugatadi va kontekstni to'ldiradi.
 */
const CODE_TIMEOUT_MS = 15_000;
const MAX_CODE_OUTPUT = 20_000;
import { lmsStorage } from "@/lib/lms-storage";
import {
  resolveTestPermissions,
  upsertRule,
  deleteRule,
  deleteRulesForResource,
  type Effect,
  type ResourceType,
  type SubjectType,
} from "./access";
import {
  departmentComparison,
  overviewAnalytics,
  questionStats,
  testAnalytics,
  userAnalytics,
} from "./analytics";
import { generateTest } from "./generator";
import { webSearch, fetchPageText, searchEngineInfo } from "./search";
import { resolveProvider, resolveProviderAsync, estimateTokens, modelHealthReport, providerChainInfo, preferredModelName } from "./provider";
import { clip } from "./json";
import { broadcast, subscriberCount } from "@/lib/telegram-bot";
import { generatePassword } from "@/lib/auth-core";
import { SKILLS, skillByName } from "./skills";
import { configuredServers, mcpCallTool, mcpListTools } from "./mcp";

// ============================================================================
//  Shartlar
// ============================================================================

export type ToolActor = {
  userId: string;
  email: string;
  role: string;
  name: string;
  isAdmin: boolean;
};

export type ToolContext = {
  actor: ToolActor;
  conversationId?: string | null;
  source: "chat" | "capability" | "api";
  /** Joriy user xabari matni (tasdiq haqiqiyligini tekshirish uchun) */
  userMessage?: string;
};

export type ToolResult = {
  ok: boolean;
  summary: string;
  data?: unknown;
  /** UI da ko'rsatish uchun (havola, jadval, ro'yxat) */
  link?: { label: string; href: string } | null;
  /** Audit uchun: qaysi resursga ta'sir qildi (markaziy audit yozadi) */
  resourceType?: string;
  resourceId?: string;
  /** Tekshiruv tizimi: amal haqiqatan bajarildimi (bazadan/diskdan qayta o'qildi) */
  verified?: boolean;
  /** Tekshiruv izohi — foydalanuvchiga ko'rsatiladi */
  verifyNote?: string;
};

export type ToolField = {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "textarea" | "multiselect" | "entity";
  required?: boolean;
  options?: string[];
  hint?: string;
  /** entity turi вЂ” UI tegishli ro'yxatni yuklaydi */
  entity?: "user" | "test" | "lesson" | "course" | "job" | "attachment";
};

export type ToolDef = {
  name: string;
  title: string;
  category: string;
  description: string;
  example: string;
  adminOnly: boolean;
  mutating: boolean;
  needsConfirm?: boolean;
  fields: ToolField[];
  schema: z.ZodType<any>;
  execute(args: any, ctx: ToolContext): Promise<ToolResult>;
};

const ok = (
  summary: string,
  data?: unknown,
  link?: ToolResult["link"],
  resource?: { type: string; id: string },
): ToolResult => ({
  ok: true,
  summary,
  data,
  link: link ?? null,
  resourceType: resource?.type,
  resourceId: resource?.id,
});

const fail = (summary: string, data?: unknown): ToolResult => ({ ok: false, summary, data, link: null });

const str = (v: unknown, max = 300) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// ============================================================================
//  Entitiyalarni topish (model ID bo'lmasa, nom/email bo'yicha qidiradi)
// ============================================================================

export async function findUsers(needle: string, limit = 12) {
  const q = str(needle, 120);
  if (!q) return [];

  const fields: any[] = [
    { id: { contains: q } },
    { email: { contains: q } },
    { name: { contains: q } },
    { surname: { contains: q } },
    { phone: { contains: q } },
    { department: { contains: q } },
    { position: { contains: q } },
  ];

  let rows = await db.user.findMany({
    where: { OR: fields },
    select: { id: true, email: true, name: true, surname: true, department: true, position: true, role: true, status: true },
    take: limit,
  });
  if (rows.length > 0) return rows;

  // В«Abdurashidov SaidakbarВ» kabi to'liq ibora ism va familiyada alohida
  // saqlangan bo'ladi вЂ” so'zlarni bittadan qilib qayta qidiramiz.
  const words = normalizeForSearch(q).split(" ").filter((w) => w.length > 1);
  if (words.length > 1) {
    rows = await db.user.findMany({
      where: {
        OR: words.flatMap((word) => [
          { name: { contains: word } },
          { surname: { contains: word } },
          { email: { contains: word } },
          { department: { contains: word } },
          { position: { contains: word } },
        ]),
      },
      select: { id: true, email: true, name: true, surname: true, department: true, position: true, role: true, status: true },
      take: limit,
    });
    if (rows.length > 0) {
      return rows
        .map((u) => ({
          u,
          score: Math.max(overlapScore(q, `${u.surname || ""} ${u.name || ""}`), overlapScore(q, u.email)),
        }))
        .sort((a, b) => b.score - a.score)
        .map((row) => row.u);
    }
  }

  // So'zlar kesishmasi bo'yicha yumshoq qidiruv
  const all = await db.user.findMany({
    select: { id: true, email: true, name: true, surname: true, department: true, position: true, role: true, status: true },
    take: 900,
  });
  return all
    .map((u) => ({
      u,
      score: Math.max(
        overlapScore(q, `${u.surname || ""} ${u.name || ""}`),
        overlapScore(q, u.email),
        overlapScore(q, u.department || ""),
      ),
    }))
    .filter((row) => row.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row) => row.u);
}

/** Aynan bitta foydalanuvchini topish вЂ” topilmasa yoki ko'p bo'lsa xato. */
export async function resolveOneUser(needle: string) {
  const raw = str(needle, 120);
  if (!raw) throw new Error("Foydalanuvchi ko'rsatilmagan");

  const exact = await db.user.findUnique({ where: { email: raw }, select: USER_SELECT });
  if (exact) return exact;

  const byId = await db.user.findUnique({ where: { id: raw }, select: USER_SELECT });
  if (byId) return byId;

  let candidates = await findUsers(raw, 8);

  // So'zlar kesishmasi bo'yicha yumshoq qidiruv (ism/familiya tartibi farq qilishi mumkin)
  if (candidates.length === 0 || candidates.length > 1) {
    const all = await db.user.findMany({ select: USER_SELECT, take: 800 });
    const scored = all
      .map((u) => ({
        u,
        score: Math.max(
          overlapScore(raw, u.email),
          overlapScore(raw, `${u.surname || ""} ${u.name || ""}`),
        ),
      }))
      .filter((row) => row.score >= 0.6)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) candidates = scored.slice(0, 8).map((row) => row.u);
  }

  if (candidates.length === 0) {
    throw new Error(`Foydalanuvchi topilmadi: "${needle}"`);
  }
  if (candidates.length > 1) {
    const list = candidates
      .map((c) => `${fullNameOf(c)} <${c.email}>${c.department ? ` [${c.department}]` : ""}`)
      .join("; ");
    throw new Error(`Bir nechta foydalanuvchi topildi, aniqlashtiring: ${list}`);
  }
  return candidates[0];
}

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  surname: true,
  department: true,
  position: true,
  role: true,
  status: true,
  isActive: true,
} as const;

function fullNameOf(u: { name?: string | null; surname?: string | null; email?: string | null }) {
  return [u.surname, u.name].filter(Boolean).join(" ").trim() || u.email || "?";
}

/**
 * Matnni qidirish uchun yagona ko'rinishga keltiradi:
 * uzun chiziq turlari, ikki barobar bo'shliq, apostrof va registr farqi xotirlanadi.
 * Model ko'pincha В«SINOQ - testВ» kabi yozadi, haqiqiy nomda esa В«вЂ”В» bo'ladi вЂ”
 * bu farq qidiruvni buzmasligi kerak.
 */
export function normalizeForSearch(input: string) {
  return String(input || "")
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\u00ad]/g, "-") // вЂ“, вЂ”, вЂђ, вЂ•, в€’
    .replace(/[''`]/g, "'")
    .replace(/[""вЂћ]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

/** So'zlar kesishma darajasi (0..1). */
function overlapScore(query: string, target: string) {
  const q = new Set(normalizeForSearch(query).split(" ").filter((t) => t.length > 1));
  const t = new Set(normalizeForSearch(target).split(" ").filter((w) => w.length > 1));
  if (q.size === 0 || t.size === 0) return 0;
  let hits = 0;
  for (const token of q) {
    if (t.has(token)) {
      hits++;
      continue;
    }
    // qisman moslik (masalan "menejer" / "menejeri")
    for (const other of t) {
      if (other.length > 3 && token.length > 3 && (other.startsWith(token) || token.startsWith(other))) {
        hits += 0.6;
        break;
      }
    }
  }
  return hits / q.size;
}

export async function resolveTest(needle: string) {
  const q = str(needle, 190);
  if (!q) throw new Error("Test nomi yoki ID kiritilmagan");

  const byId = await db.test.findUnique({ where: { id: q }, include: TEST_INCLUDE });
  if (byId) return byId;

  // 1) Aniq qisman moslik
  let candidates = await db.test.findMany({
    where: { title: { contains: q } },
    include: { _count: { select: { questions: true } } },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  // 2) Barcha testlar orasidan so'zlar kesishma bo'yicha (chiziq/bo'shliq farqi bo'lsa)
  if (candidates.length === 0) {
    const all = await db.test.findMany({
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: 400,
    });
    const scored = all
      .map((t) => ({ t, score: overlapScore(q, t.title) }))
      .filter((row) => row.score >= 0.5)
      .sort((a, b) => b.score - a.score);
    if (scored.length > 0) {
      const best = scored[0];
      const detail = await db.test.findUnique({ where: { id: best.t.id }, include: TEST_INCLUDE });
      if (detail) {
        return detail;
      }
    }
  }

  if (candidates.length === 0) {
    const near = await listSimilarTests(q, 5);
    throw new Error(
      `Test topilmadi: "${q}"` +
        (near.length ? `. Yaqin testlar: ${near.map((t) => `"${t.title}"`).join("; ")}` : ""),
    );
  }
  if (candidates.length > 1) {
    const list = candidates
      .map((c) => `"${c.title}" (${c._count.questions} savol, ${c.status})`)
      .join("; ");
    throw new Error(`Bir nechta test mos keldi, aniq nom yozing: ${list}`);
  }
  return candidates[0];
}

/** O'xshash test nomlarini qaytaradi (model uchun tuzatish imkoniyati). */
async function listSimilarTests(query: string, limit: number) {
  const all = await db.test.findMany({
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  return all
    .map((t) => ({ ...t, score: overlapScore(query, t.title) }))
    .filter((row) => row.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

const TEST_INCLUDE = { _count: { select: { questions: true } } } as const;

export async function resolveLesson(needle: string) {
  const q = str(needle, 190);
  if (!q) throw new Error("Dars nomi yoki ID kiritilmagan");
  const byId = await db.lesson.findUnique({
    where: { id: q },
    include: { module: { select: { title: true, courseId: true } } },
  });
  if (byId) return byId;

  let candidates = await db.lesson.findMany({
    where: { title: { contains: q } },
    include: { module: { select: { title: true, courseId: true } } },
    take: 8,
  });

  if (candidates.length === 0) {
    const all = await db.lesson.findMany({
      include: { module: { select: { title: true, courseId: true } } },
      take: 500,
    });
    const best = all
      .map((l) => ({ l, score: overlapScore(q, l.title) }))
      .filter((row) => row.score >= 0.5)
      .sort((a, b) => b.score - a.score)[0];
    if (best) return best.l;
  }

  if (candidates.length === 0) throw new Error(`Dars topilmadi: "${q}"`);
  if (candidates.length > 1) {
    const list = candidates.map((c) => `"${c.title}" (kurs: ${c.module?.title || "вЂ”"})`).join("; ");
    throw new Error(`Bir nechta dars mos keldi, aniq nom yozing: ${list}`);
  }
  return candidates[0];
}

async function resolveCourse(needle: string) {
  const q = str(needle, 190);
  const byId = await db.course.findUnique({ where: { id: q } });
  if (byId) return byId;
  const candidates = await db.course.findMany({ where: { title: { contains: q } }, take: 6 });
  if (candidates.length === 0) throw new Error(`Kurs topilmadi: "${q}"`);
  if (candidates.length > 1) {
    throw new Error(`Bir nechta kurs mos keldi: ${candidates.map((c) => `"${c.title}"`).join("; ")}`);
  }
  return candidates[0];
}

async function resolveJob(needle: string) {
  const q = str(needle, 190);
  const byId = await db.jobCourse.findUnique({ where: { id: q } });
  if (byId) return byId;
  const bySlug = await db.jobCourse.findUnique({ where: { slug: q } });
  if (bySlug) return bySlug;
  const candidates = await db.jobCourse.findMany({ where: { title: { contains: q } }, take: 6 });
  if (candidates.length === 0) throw new Error(`Kasbiy kurs topilmadi: "${q}"`);
  if (candidates.length > 1) {
    throw new Error(`Bir nechta kasbiy kurs mos keldi: ${candidates.map((c) => `"${c.title}"`).join("; ")}`);
  }
  return candidates[0];
}

// ============================================================================
//  Fayl spec saqlash — "qayta yaratish" uchun haqiqat manbai
// ============================================================================

/**
 * Nega alohida faylda saqlanadi: `doc.*` faylni quradi, lekin keyin "shuni
 * yana yasab ber" degan so'rovda model eski matnni qayta to'qimaydi — balki
 * AYNAN shu spec'dan qayta quradi. Natija har doim bir xil chiqadi.
 */
function specPathFor(storagePath: string) {
  return storagePath.replace(/\.(xlsx|docx|pdf)$/i, "") + ".spec.json";
}

async function saveFileSpec(storagePath: string, spec: DocSpec) {
  try {
    const abs = nodePath.join(process.cwd(), specPathFor(storagePath));
    await makeDir(nodePath.dirname(abs), { recursive: true });
    await writeDiskFile(abs, JSON.stringify(spec), "utf8");
  } catch (err: any) {
    // Spec saqlanmasa ham fayl o'zi saqlanadi — faqat qayta yaratish ishlaydi.
    console.error("[ai-doc] spec saqlanmadi:", err?.message || err);
  }
}

async function readFileSpec(storagePath: string): Promise<DocSpec | null> {
  try {
    const abs = nodePath.join(process.cwd(), specPathFor(storagePath));
    const raw = await readDiskFile(abs, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && "kind" in parsed ? (parsed as DocSpec) : null;
  } catch {
    return null;
  }
}

/** Natija havolasi muddati o'tib ketmasligi uchun imzoni HAR SAFAR yangilaydi. */
async function freshFileUrl(fileId: string) {
  const { signFileUrl, FILE_URL_TTL_MS } = await import("./files");
  return signFileUrl(fileId, Date.now() + FILE_URL_TTL_MS);
}

/** Yaratilgan faylni qayta qurish va yangi AiFile yozish (barcha formatlar). */
async function rebuildFromSpec(opts: {
  source: DocSpec;
  kind: "excel" | "word" | "pdf";
  filename: string;
  title?: string;
  actorId: string;
}) {
  const { convertSpec } = await import("./docconvert");
  const { buildExcel, buildWord, buildPdf, ensureFilesDir } = await import("./docgen");
  const { safeFileName, KIND_MIME, formatBytes } = await import("./files");

  const fileName = safeFileName(opts.filename, opts.kind);
  await ensureFilesDir();
  const fileId = `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const ext = opts.kind === "excel" ? "xlsx" : opts.kind === "word" ? "docx" : "pdf";
  const storagePath = `upload/ai-files/${fileId}.${ext}`;
  const absPath = nodePath.join(process.cwd(), storagePath);

  const spec = convertSpec(opts.source, opts.kind, fileName) as DocSpec;
  if (opts.title && (spec.kind === "word" || spec.kind === "pdf" || spec.kind === "excel")) {
    (spec as { title?: string }).title = opts.title;
  }

  let bytes = 0;
  let pages: number | undefined;
  if (spec.kind === "excel") bytes = (await buildExcel(spec, absPath)).bytes;
  else if (spec.kind === "word") bytes = (await buildWord(spec, absPath)).bytes;
  else ({ bytes, pages } = await buildPdf(spec, absPath));

  await saveFileSpec(storagePath, spec);

  const record = await db.aiFile.create({
    data: {
      ownerId: opts.actorId,
      kind: opts.kind,
      fileName,
      mimeType: KIND_MIME[opts.kind],
      size: bytes,
      storagePath,
      title: str((spec as { title?: string }).title || fileName, 200),
      specSummary: opts.source.kind === spec.kind ? "qayta yaratilgan nusxa" : `${opts.source.kind} → ${spec.kind}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const url = await freshFileUrl(record.id);
  return { record, fileName, bytes, pages, url, specKind: spec.kind };
}

async function logAudit(
  ctx: ToolContext,
  action: string,
  outcome: "ok" | "error" | "denied",
  detail: string,
  args: unknown,
  resourceType = "",
  resourceId = "",
) {
  try {
    await db.aiAuditLog.create({
      data: {
        actorId: ctx.actor.userId,
        actorEmail: ctx.actor.email,
        actorRole: ctx.actor.role,
        action: str(action, 191),
        outcome,
        detail: str(detail, 900),
        args: clip(JSON.stringify(args ?? {}), 8000),
        resourceType,
        resourceId,
        source: ctx.source,
      },
    });
  } catch (err) {
    console.error("[ai-audit] yozilmadi:", err);
  }
}

async function requireAdmin(ctx: ToolContext, tool: string) {
  if (!ctx.actor.isAdmin && ctx.actor.role !== "grader") {
    throw new Error("Bu amalni faqat admin bajarishi mumkin");
  }
}

// ============================================================================
//  Registr
// ============================================================================

const ENTITY_TEST = { entity: "test" as const };
const ENTITY_LESSON = { entity: "lesson" as const };
const ENTITY_USER = { entity: "user" as const };

export const TOOLS: ToolDef[] = [
  // ---------------------------------------------------------------- TESTLAR
  {
    name: "test.create",
    title: "Yangi test yaratish",
    category: "Testlar",
    description:
      "Bo'sh test yaratadi va uni modulga joylaydi. Savollar keyin qo'shiladi (test.generate yoki test.questions.add orqali).",
    example: "В«Chorak oxiridagi xizmat chegaralariВ» nomli test yarat, 20 ta savol, o'tish balli 70",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "title", label: "Test nomi", type: "text", required: true },
      { key: "moduleId", label: "Modul", type: "entity", entity: "course", hint: "Ixtiyoriy. Idsiz bo'lsa mustaqil test bo'lib qoladi" },
      { key: "description", label: "Tavsif", type: "textarea" },
      { key: "passScore", label: "O'tish balli (%)", type: "number" },
      { key: "timeLimit", label: "Vaqt (daqiqa, 0 = cheksiz)", type: "number" },
      { key: "maxAttempts", label: "Urinishlar soni (0 = cheksiz)", type: "number" },
      { key: "questionCount", label: "Beriladigan savollar soni", type: "number" },
      { key: "visibility", label: "Ko'rinish", type: "select", options: ["all", "selected"] },
      { key: "status", label: "Holat", type: "select", options: ["draft", "active", "archived"] },
    ],
    schema: z.object({
      title: z.string().min(2).max(300),
      description: z.string().max(2000).optional(),
      moduleId: z.string().max(64).optional(),
      courseId: z.string().max(64).optional(),
      passScore: z.number().min(1).max(100).optional(),
      timeLimit: z.number().min(0).max(600).optional(),
      maxAttempts: z.number().min(0).max(50).optional(),
      questionCount: z.number().min(1).max(200).optional(),
      visibility: z.enum(["all", "selected"]).optional(),
      status: z.enum(["draft", "active", "archived"]).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.create");
      let moduleId: string | undefined = args.moduleId;
      let courseId: string | undefined = args.courseId;
      if (moduleId) {
        const module = await db.module.findUnique({ where: { id: moduleId }, select: { courseId: true } });
        if (!module) throw new Error("Modul topilmadi");
        courseId = module.courseId;
      }

      const test = await lmsStorage.createTest({
        title: str(args.title, 300),
        description: args.description ? str(args.description, 2000) : undefined,
        moduleId,
        courseId,
        passScore: num(args.passScore, 60),
        timeLimit: num(args.timeLimit, 0),
        maxAttempts: num(args.maxAttempts, 1),
        questionCount: num(args.questionCount, 10),
        visibility: args.visibility === "selected" ? "selected" : "all",
        status: args.status || "draft",
      });

      return ok(`В«${test.title}В» testi yaratildi (holat: ${test.status}).`, { testId: test.id, title: test.title }, {
        label: "Testni ochish",
        href: `/admin/lms/tests/${test.id}`,
      });
    },
  },

  {
    name: "test.search",
    title: "Testni qidirish",
    category: "Testlar",
    description:
      "Test nomi bo'yicha qidiradi (so'zlar bo'yicha, chiziq/bo'shliq farqiga sezgir emas). Nomi aniq bo'lmasa avval shu vosita orqali ID oling.",
    example: "В«Suxbat testiВ» deb nomlangan testlarni top",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "query", label: "Test nomi (qisman bo'lishi mumkin)", type: "text", required: true },
      { key: "limit", label: "Limit", type: "number" },
    ],
    schema: z.object({
      query: z.string().min(1).max(190),
      limit: z.number().min(1).max(200).optional(),
    }),
    async execute(args) {
      const q = str(args.query, 190);
      const all = await db.test.findMany({
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          maxAttempts: true,
          passScore: true,
          _count: { select: { questions: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      const scored = all
        .map((t) => ({ t, score: overlapScore(q, t.title) }))
        .filter((row) => row.score > 0.15)
        .sort((a, b) => b.score - a.score)
        .slice(0, num(args.limit, 10));

      if (scored.length === 0) throw new Error(`В«${q}В» bo'yicha test topilmadi`);
      return ok(
        `${scored.length} ta test topildi.`,
        {
          rows: scored.map((row) => ({
            id: row.t.id,
            title: row.t.title,
            status: row.t.status,
            visibility: row.t.visibility,
            questions: row.t._count.questions,
            maxAttempts: row.t.maxAttempts,
            passScore: row.t.passScore,
            match: Math.round(row.score * 100),
          })),
        },
      );
    },
  },

  {
    name: "test.generate",
    title: "Manba asosida test yaratish (AI)",
    category: "Testlar",
    description:
      "Yuklangan fayllar yoki internet manbalari asosida savollarni yig'ib, TASDIQLASH UCHUN qoralamaga saqlaydi. Hali bazaga yozilmaydi вЂ” avval siz ko'rasiz.",
    example:
      "Yuklangan PDF bo'yicha В«Xizmat ko'rsatish standartiВ» mavzusida 15 ta savolli test tuz, internetdan foydalanma",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "title", label: "Test nomi", type: "text", required: true },
      { key: "topic", label: "Mavzu", type: "text", required: true },
      { key: "attachmentIds", label: "Fayllar", type: "multiselect", entity: "attachment" },
      { key: "mode", label: "Manba", type: "select", options: ["source", "web", "hybrid"] },
      { key: "count", label: "Savollar soni", type: "number" },
      { key: "language", label: "Til", type: "select", options: ["uz", "ru", "en"] },
      { key: "difficulty", label: "Qiyinlik", type: "select", options: ["easy", "medium", "hard", "mixed"] },
      { key: "extraInstructions", label: "Qo'shimcha ko'rsatma", type: "textarea" },
    ],
    schema: z.object({
      title: z.string().min(2).max(300),
      topic: z.string().max(500).optional(),
      attachmentIds: z.array(z.string().max(64)).max(20).optional(),
      mode: z.enum(["source", "web", "hybrid"]).optional(),
      count: z.number().min(3).max(60).optional(),
      language: z.enum(["uz", "ru", "en"]).optional(),
      difficulty: z.enum(["easy", "medium", "hard", "mixed"]).optional(),
      extraInstructions: z.string().max(2000).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.generate");
      const attachmentIds: string[] = args.attachmentIds || [];

      // Takrorlanmaslik uchun: mavzuga yaqin mavjud testlarning savollari
      const topicWords = str(args.topic || args.title, 200)
        .split(/\s+/)
        .filter((w) => w.length >= 4)
        .slice(0, 4);
      const relatedTests = topicWords.length
        ? await db.test.findMany({
            where: { OR: topicWords.map((w) => ({ title: { contains: w } })) },
            select: { id: true },
            take: 12,
          })
        : [];
      const existingQuestions = relatedTests.length
        ? (
            await db.question.findMany({
              where: { testId: { in: relatedTests.map((t) => t.id) } },
              select: { text: true },
              take: 60,
            })
          ).map((q) => q.text)
        : [];

      const result = await generateTest({
        title: str(args.title, 300),
        topic: str(args.topic, 500) || str(args.title, 500),
        count: num(args.count, 12),
        language: args.language || "uz",
        mode: args.mode || (attachmentIds.length ? "source" : "web"),
        difficulty: args.difficulty || "mixed",
        attachmentIds,
        existingQuestions,
        extraInstructions: args.extraInstructions,
      });

      const draft = await db.aiDraft.create({
        data: {
          ownerId: ctx.actor.userId,
          title: result.draft.test.title,
          topic: str(args.topic, 500) || str(args.title, 500),
          sourceMode: args.mode || (attachmentIds.length ? "source" : "web"),
          payload: JSON.stringify(result.draft),
          sourceIds: JSON.stringify(attachmentIds),
          sourceNotes: result.warnings.join("\n"),
          webRefs: JSON.stringify(result.webRefs.slice(0, 10)),
        },
      });

      return ok(
        `${result.draft.questions.length} ta savol tayyor. Hali testga yozilmadi вЂ” qoralamani ko'rib tasdiqlang.`,
        {
          draftId: draft.id,
          title: result.draft.test.title,
          questions: result.draft.questions,
          test: result.draft.test,
          warnings: result.warnings,
          webRefs: result.webRefs,
          generation: result.draft.generation,
          notes: result.draft.notes,
          coverage: result.draft.coverage,
        },
        { label: "Qoralamani ko'rish", href: `/admin/ai?draft=${draft.id}` },
        { type: "draft", id: draft.id },
      );
    },
  },

  {
    name: "test.applyDraft",
    title: "Qoralamani testga aylantirish",
    category: "Testlar",
    description:
      "Tasdiqlangan AI qoralamasini bazadagi haqiqiy testga aylantiradi: test yaratiladi va barcha savollar yoziladi.",
    example: "draft cmt... ni testga aylantir",
    adminOnly: true,
    mutating: true,
    needsConfirm: true,
    fields: [
      { key: "draftId", label: "Qoralama", type: "text", required: true },
      { key: "status", label: "Yangi test holati", type: "select", options: ["draft", "active"] },
      { key: "confirm", label: "Tasdiqlayman", type: "boolean", required: true },
    ],
    schema: z.object({
      draftId: z.string().min(4).max(64),
      status: z.enum(["draft", "active"]).optional(),
      confirm: z.literal(true),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.applyDraft");
      // Egasi faqat o'z qoralamasini qo'llaydi (boshqa adminniki ko'rinmaydi)
      const draft = await db.aiDraft.findFirst({
        where: { id: args.draftId, ownerId: ctx.actor.userId },
      });
      if (!draft) throw new Error("Qoralama topilmadi");
      if (draft.status === "applied") throw new Error("Bu qoralama allaqachon qo'llanilgan");

      const payload = JSON.parse(draft.payload);
      const settings = payload.test || {};
      const questions: any[] = Array.isArray(payload.questions) ? payload.questions : [];
      if (questions.length === 0) throw new Error("Qoralamada savol yo'q");

      const test = await lmsStorage.createTest({
        title: str(settings.title || draft.title, 300),
        description: str(settings.description, 2000) || undefined,
        passScore: num(settings.passScore, 60),
        timeLimit: num(settings.timeLimit, 0),
        maxAttempts: num(settings.maxAttempts, 1),
        questionCount: questions.length,
        shuffleQuestions: settings.shuffleQuestions !== false,
        shuffleChoices: settings.shuffleChoices !== false,
        visibility: "all",
        status: args.status === "active" ? "active" : "draft",
      });

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await lmsStorage.createQuestion({
          testId: test.id,
          text: str(q.text, 2000),
          type: q.type,
          points: num(q.points, 1),
          explanation: str(q.explanation, 2000) || undefined,
          correctAnswer: q.correctAnswer ? str(q.correctAnswer, 2000) : undefined,
          choices: Array.isArray(q.choices)
            ? q.choices.map((c: any) => ({ text: str(c.text, 500), isCorrect: c.isCorrect === true }))
            : undefined,
        });
        void i;
      }

      await db.aiDraft.update({ where: { id: draft.id }, data: { status: "applied", testId: test.id } });

      return ok(
        `В«${test.title}В» testi yaratildi: ${questions.length} ta savol, holat вЂ” ${test.status}.`,
        { testId: test.id, title: test.title, questionCount: questions.length },
        { label: "Testni ochish", href: `/admin/lms/tests/${test.id}` },
      );
    },
  },

  {
    name: "test.update",
    title: "Test parametrlarini o'zgartirish",
    category: "Testlar",
    description:
      "O'tish balli, vaqt limiti, urinishlar soni, savollar soni, aralashtirish va holatni o'zgartiradi.",
    example: "В«Suxbat testi (Ofis-menejer)В» uchun o'tish ballini 80 qil, urinishlar 3 ta",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "test", label: "Test", type: "entity", entity: "test", required: true },
      { key: "passScore", label: "O'tish balli (%)", type: "number" },
      { key: "timeLimit", label: "Vaqt (daqiqa)", type: "number" },
      { key: "maxAttempts", label: "Urinishlar (0 = cheksiz)", type: "number" },
      { key: "questionCount", label: "Beriladigan savollar", type: "number" },
      { key: "shuffleQuestions", label: "Savollar aralash", type: "boolean" },
      { key: "shuffleChoices", label: "Variantlar aralash", type: "boolean" },
      { key: "status", label: "Holat", type: "select", options: ["draft", "active", "archived"] },
      { key: "title", label: "Yangi nom", type: "text" },
      { key: "description", label: "Yangi tavsif", type: "textarea" },
    ],
    schema: z.object({
      test: z.string().min(1).max(190),
      passScore: z.number().min(1).max(100).optional(),
      timeLimit: z.number().min(0).max(600).optional(),
      maxAttempts: z.number().min(0).max(50).optional(),
      questionCount: z.number().min(1).max(200).optional(),
      shuffleQuestions: z.boolean().optional(),
      shuffleChoices: z.boolean().optional(),
      status: z.enum(["draft", "active", "archived"]).optional(),
      title: z.string().max(300).optional(),
      description: z.string().max(2000).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.update");
      const test = await resolveTest(args.test);
      const data: Record<string, unknown> = {};
      if (args.passScore != null) data.passScore = num(args.passScore, test.passScore);
      if (args.timeLimit != null) data.timeLimit = num(args.timeLimit, test.timeLimit);
      if (args.maxAttempts != null) data.maxAttempts = num(args.maxAttempts, test.maxAttempts);
      if (args.questionCount != null) data.questionCount = num(args.questionCount, test.questionCount);
      if (args.shuffleQuestions != null) data.shuffleQuestions = !!args.shuffleQuestions;
      if (args.shuffleChoices != null) data.shuffleChoices = !!args.shuffleChoices;
      if (args.status) data.status = args.status;
      if (args.title) data.title = str(args.title, 300);
      if (args.description != null) data.description = str(args.description, 2000);

      if (Object.keys(data).length === 0) throw new Error("O'zgartiriladigan maydon berilmagan");

      await lmsStorage.updateTest(test.id, data as any);
      const changed = Object.entries(data)
        .map(([key, value]) => `${key} = ${Array.isArray(value) ? value.join(",") : value}`)
        .join(", ");
      return ok(`В«${test.title}В» yangilandi: ${changed}.`, { testId: test.id, changes: data }, {
        label: "Testni ochish",
        href: `/admin/lms/tests/${test.id}`,
      });
    },
  },

  {
    name: "test.setStatus",
    title: "Test holatini o'zgartirish",
    category: "Testlar",
    description: "Testni chop etilgan (active), qoralamaga (draft) yoki arxivga (archived) o'tkazadi.",
    example: "В«Qo'riqlash hizmatiВ» testini arxivga o'tkaz",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "test", label: "Test", type: "entity", entity: "test", required: true },
      { key: "status", label: "Yangi holat", type: "select", required: true, options: ["draft", "active", "archived"] },
    ],
    schema: z.object({
      test: z.string().min(1).max(190),
      status: z.enum(["draft", "active", "archived"]),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.setStatus");
      const test = await resolveTest(args.test);
      await lmsStorage.updateTest(test.id, { status: args.status });
      const label = args.status === "active" ? "chop etilgan" : args.status === "draft" ? "qoralamada" : "arxivda";
      return ok(`В«${test.title}В» endi ${label} (${args.status}).`, { testId: test.id, status: args.status });
    },
  },

  {
    name: "test.delete",
    title: "Testni o'chirish",
    category: "Testlar",
    description:
      "Testni va uning savollari, natijalarini butunlay o'chiradi. Qaytarib bo'lmaydi вЂ” shuning uchun albatta tasdiqlash so'raydi.",
    example: "В«Eski 2023 testiВ» ni o'chir",
    adminOnly: true,
    mutating: true,
    needsConfirm: true,
    fields: [
      { key: "test", label: "Test", type: "entity", entity: "test", required: true },
      { key: "confirm", label: "Ha, qat'iy o'chirsak", type: "boolean", required: true },
    ],
    schema: z.object({
      test: z.string().min(1).max(190),
      confirm: z.literal(true),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.delete");
      const test = await resolveTest(args.test);
      const results = await db.testResult.count({ where: { testId: test.id } });
      await deleteRulesForResource("test", test.id);
      await lmsStorage.deleteTest(test.id);
      return ok(`В«${test.title}В» o'chirildi. Uning ${results} ta natijasi ham o'chirildi.`, { deletedId: test.id }, null, { type: "test", id: test.id });
    },
  },

  {
    name: "test.assign",
    title: "Testni kimga ko'rsatish",
    category: "Ko'rinish va ruxsat",
    description:
      "Test ko'rinishini boshqaradi: hammaga ko'rinadigan, faqat tanlanganlarga, yoki bo'lim/lavozim bo'yicha. Avvaldan ALLOW qoidalari ham yaratiladi.",
    example: "В«Suxbat testiВ» ni faqat IT bo'limiga ko'rsat",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "test", label: "Test", type: "entity", entity: "test", required: true },
      {
        key: "scope",
        label: "Kim ko'rinadi",
        type: "select",
        required: true,
        options: ["all", "users", "department", "position"],
      },
      { key: "values", label: "Ro'yxat (pochta yoki bo'lim/lavozim nomi)", type: "textarea" },
    ],
    schema: z.object({
      test: z.string().min(1).max(190),
      scope: z.enum(["all", "users", "department", "position"]),
      values: z.array(z.string().max(190)).max(500).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.assign");
      const test = await resolveTest(args.test);

      if (args.scope === "all") {
        await lmsStorage.updateTest(test.id, { visibility: "all", assignedUserIds: "[]" });
        await deleteRulesForResource("test", test.id);
        return ok(`В«${test.title}В» endi barcha xodimlarga ko'rinadi.`, { testId: test.id });
      }

      const values = (args.values || []).map((v) => str(v, 190)).filter(Boolean);
      if (values.length === 0) throw new Error("Hech qanday foydalanuvchi yoki bo'lim ko'rsatilmagan");

      const subjectType: SubjectType =
        args.scope === "department" ? "department" : args.scope === "position" ? "position" : "user";

      let resolved = 0;
      let failed: string[] = [];

      if (subjectType === "user") {
        const userIds: string[] = [];
        for (const value of values) {
          try {
            const user = await resolveOneUser(value);
            userIds.push(user.id);
            resolved++;
          } catch (err: any) {
            failed.push(err?.message || value);
          }
        }
        if (userIds.length === 0) throw new Error(`Hech bir foydalanuvchi topilmadi: ${failed.slice(0, 3).join("; ")}`);
        await lmsStorage.updateTest(test.id, {
          visibility: "selected",
          assignedUserIds: JSON.stringify(userIds),
        });
      } else {
        await lmsStorage.updateTest(test.id, { visibility: "selected", assignedUserIds: "[]" });
        for (const value of values) {
          await upsertRule({
            subjectType,
            subjectValue: value,
            resourceType: "test",
            resourceId: test.id,
            effect: "allow",
            createdBy: ctx.actor.userId,
            createdByName: ctx.actor.email,
            reason: "test.assign orqali berilgan",
          });
          resolved++;
        }
      }

      
      return ok(
        `В«${test.title}В» ${resolved} ta ${subjectType} uchun ochiqlandi${failed.length ? `. Topilmagan: ${failed.slice(0, 3).join("; ")}` : ""}.`,
        { testId: test.id, resolved, failed },
      );
    },
  },

  {
    name: "test.retake.grant",
    title: "Qayta topshirishga ruxsat berish",
    category: "Ko'rinish va ruxsat",
    description:
      "Aynan foydalanuvchiga (yoki butun bo'limga) testni qayta topshirishga ruxsat beradi. Urinishlar limiti ham shu yerda o'zgartiriladi.",
    example: "Alisherga В«Suxbat testiВ» ni qayta topshirishga ruxsat ber, urinishlar 5 ta",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "test", label: "Test", type: "entity", entity: "test", required: true },
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user" },
      { key: "department", label: "Bo'lim (butun bo'limga)", type: "text" },
      { key: "maxAttempts", label: "Yangi urinishlar limiti (bo'sh = o'zgarmaydi)", type: "number" },
      { key: "reason", label: "Sabab", type: "text" },
      { key: "expiresAt", label: "Muddati (YYYY-MM-DD)", type: "text" },
    ],
    schema: z.object({
      test: z.string().min(1).max(190),
      user: z.string().max(190).optional(),
      department: z.string().max(190).optional(),
      maxAttempts: z.number().min(1).max(100).optional(),
      reason: z.string().max(500).optional(),
      expiresAt: z.string().max(30).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "test.retake.grant");
      if (!args.user && !args.department) throw new Error("Foydalanuvchi yoki bo'lim ko'rsatish shart");
      const test = await resolveTest(args.test);
      const expiresAt = parseDate(args.expiresAt);

      if (args.user) {
        const user = await resolveOneUser(args.user);
        await upsertRule({
          subjectType: "user",
          subjectValue: user.id,
          resourceType: "test",
          resourceId: test.id,
          effect: "allow",
          allowRetake: true,
          maxAttempts: args.maxAttempts ?? null,
          reason: args.reason || "AI orqali berilgan qayta topshirish ruxsati",
          expiresAt,
          createdBy: ctx.actor.userId,
          createdByName: ctx.actor.email,
        });
        return ok(
          `${fullNameOf(user)} endi В«${test.title}В» testini qayta topshira oladi${args.maxAttempts ? ` (limiti: ${args.maxAttempts})` : ""}.`,
          { testId: test.id, userId: user.id },
        );
      }

      await upsertRule({
        subjectType: "department",
        subjectValue: str(args.department, 190),
        resourceType: "test",
        resourceId: test.id,
        effect: "allow",
        allowRetake: true,
        maxAttempts: args.maxAttempts ?? null,
        reason: args.reason || "Bo'lim uchun qayta topshirish ruxsati",
        expiresAt,
        createdBy: ctx.actor.userId,
        createdByName: ctx.actor.email,
      });
      return ok(`В«${args.department}В» bo'limi В«${test.title}В» testini qayta topshira oladi.`, { testId: test.id });
    },
  },

  // ---------------------------------------------------------------- DARS/KURS
  {
    name: "lesson.setVisibility",
    title: "Darsni ko'rsatish / yashirish",
    category: "Darslar",
    description:
      "Aynan foydalanuvchiga darsni yashiradi yoki ko'rsatadi. В«Shu odamga shu darslik ko'rinmasinВ» вЂ” shu yerda bajariladi. Ko'rinish butun bo'lim uchun ham boshqarilishi mumkin.",
    example: "Alisherga В«Xavfsizlik texnikasiВ» darsini yashir",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "lesson", label: "Dars", type: "entity", entity: "lesson", required: true },
      {
        key: "scope",
        label: "Kimga",
        type: "select",
        required: true,
        options: ["user", "department", "position", "role"],
      },
      { key: "value", label: "Qiymat (pochta / bo'lim / lavozim / rol)", type: "text", required: true },
      { key: "effect", label: "Amal", type: "select", required: true, options: ["deny", "allow"] },
      { key: "reason", label: "Sabab", type: "text" },
    ],
    schema: z.object({
      lesson: z.string().min(1).max(190),
      scope: z.enum(["user", "department", "position", "role"]),
      value: z.string().min(1).max(190),
      effect: z.enum(["allow", "deny"]),
      reason: z.string().max(500).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "lesson.setVisibility");
      const lesson = await resolveLesson(args.lesson);
      const subjectValue = await normalizeSubjectValue(args.scope, args.value);
      await upsertRule({
        subjectType: args.scope,
        subjectValue,
        resourceType: "lesson",
        resourceId: lesson.id,
        effect: args.effect,
        reason: args.reason,
        createdBy: ctx.actor.userId,
        createdByName: ctx.actor.email,
      });
      
      const verb = args.effect === "deny" ? "yashirildi" : "ko'rsatildi";
      return ok(`В«${lesson.title}В» darsi ${subjectValue} uchun ${verb}.`, { lessonId: lesson.id });
    },
  },

  {
    name: "lesson.setStatus",
    title: "Dars holatini o'zgartirish",
    category: "Darslar",
    description: "Darsni faol, qoralamaga yoki arxivga o'tkazadi.",
    example: "В«Mijoz bilan ishlashВ» darsini arxivga o'tkaz",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "lesson", label: "Dars", type: "entity", entity: "lesson", required: true },
      { key: "status", label: "Holat", type: "select", required: true, options: ["draft", "active", "archived"] },
      { key: "isClosed", label: "Yopiq", type: "boolean" },
    ],
    schema: z.object({
      lesson: z.string().min(1).max(190),
      status: z.enum(["draft", "active", "archived"]).optional(),
      isClosed: z.boolean().optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "lesson.setStatus");
      const lesson = await resolveLesson(args.lesson);
      const data: Record<string, unknown> = {};
      if (args.status) data.status = args.status;
      if (args.isClosed != null) data.isClosed = !!args.isClosed;
      if (Object.keys(data).length === 0) throw new Error("O'zgartiriladigan maydon berilmagan");
      await lmsStorage.updateLesson(lesson.id, data as any);
      const changed = Object.entries(data).map(([k, v]) => `${k} = ${v}`).join(", ");
      return ok(`В«${lesson.title}В»: ${changed}.`, { lessonId: lesson.id, changes: data });
    },
  },

  {
    name: "course.enroll",
    title: "Kursga biriktirish",
    category: "Darslar",
    description: "Foydalanuvchini kursga yozadi (kursni ko'rish va testlarini topshirish huquqi beriladi).",
    example: "Alisherni В«TanishtiruvВ» kursiga qo'sh",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true },
      { key: "course", label: "Kurs", type: "text", required: true },
    ],
    schema: z.object({
      user: z.string().min(1).max(190),
      course: z.string().min(1).max(190),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "course.enroll");
      const user = await resolveOneUser(args.user);
      const course = await resolveCourse(args.course);
      const existing = await db.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      });
      if (existing) {
        return ok(`${fullNameOf(user)} allaqachon В«${course.title}В» kursida.`, { courseId: course.id, userId: user.id });
      }
      await db.enrollment.create({ data: { userId: user.id, courseId: course.id } });
      return ok(`${fullNameOf(user)} В«${course.title}В» kursiga biriktirildi.`, { courseId: course.id, userId: user.id });
    },
  },

  {
    name: "course.unenroll",
    title: "Kursdan chiqarish",
    category: "Darslar",
    description: "Foydalanuvchini kursdan olib tashlaydi.",
    example: "Alisherni В«TanishtiruvВ» kursidan chiqar",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true },
      { key: "course", label: "Kurs", type: "text", required: true },
    ],
    schema: z.object({
      user: z.string().min(1).max(190),
      course: z.string().min(1).max(190),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "course.unenroll");
      const user = await resolveOneUser(args.user);
      const course = await resolveCourse(args.course);
      const removed = await db.enrollment.deleteMany({ where: { userId: user.id, courseId: course.id } });
      return ok(
        removed.count > 0
          ? `${fullNameOf(user)} В«${course.title}В» kursidan chiqarildi.`
          : `${fullNameOf(user)} bu kursda bo'lmagan.`,
        { removed: removed.count },
      );
    },
  },

  {
    name: "job.enroll",
    title: "Kasbiy kursga biriktirish",
    category: "Darslar",
    description: "Xodimni kasbiy kursga (job) yozadi.",
    example: "Boburga В«Ofis menejeriВ» kasbiy kursini biriktir",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true },
      { key: "job", label: "Kasbiy kurs", type: "entity", entity: "job", required: true },
    ],
    schema: z.object({
      user: z.string().min(1).max(190),
      job: z.string().min(1).max(190),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "job.enroll");
      const user = await resolveOneUser(args.user);
      const job = await resolveJob(args.job);
      const existing = await db.jobEnrollment.findUnique({
        where: { userId_jobId: { userId: user.id, jobId: job.id } },
      });
      if (existing) return ok(`${fullNameOf(user)} allaqachon В«${job.title}В» kursida.`, { jobId: job.id, userId: user.id });
      await db.jobEnrollment.create({ data: { userId: user.id, jobId: job.id } });
      return ok(`${fullNameOf(user)} В«${job.title}В» kasbiy kursiga biriktirildi.`, { jobId: job.id, userId: user.id });
    },
  },

  // ------------------------------------------------------------- FOYDAYANUVCHI
  {
    name: "user.search",
    title: "Foydalanuvchini qidirish",
    category: "Foydalanuvchi",
    description:
      "Ism, familiya, pochta, telefon yoki bo'lim bo'yicha xodimlarni topadi va ularning ID'sini qaytaradi. Natija aniq bo'lmasa вЂ” shu vosita orqali ID oling, keyin boshqa vositalarda shu ID yoki pochtani ishlating.",
    example: "Alisherni top",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "query", label: "Ism / familiya / pochta / telefon / bo'lim", type: "text", required: true },
      { key: "limit", label: "Limit", type: "number" },
    ],
    schema: z.object({
      query: z.string().min(1).max(190),
      limit: z.number().min(1).max(200).optional(),
    }),
    async execute(args) {
      const needle = str(args.query, 190);
      const users = await findUsers(needle, num(args.limit, 12));
      if (users.length === 0) throw new Error(`В«${needle}В» bo'yicha foydalanuvchi topilmadi`);

      // Aniq bitta topildi вЂ” darhol "aniq" deb belgilaymiz
      const exact =
        users.length === 1 ||
        users.filter(
          (u) =>
            u.email.toLowerCase() === needle.toLowerCase() ||
            `${u.surname || ""} ${u.name || ""}`.trim().toLowerCase() === needle.toLowerCase(),
        ).length === 1;

      const rows = users.map((u) => ({
        id: u.id,
        fullName: fullNameOf(u),
        email: u.email,
        department: u.department || "",
        position: u.position || "",
        role: u.role,
        status: u.status,
      }));

      return ok(
        `${rows.length} ta foydalanuvchi topildi${exact ? " (bitta aniq moslik)" : ""}.`,
        { exact, rows },
      );
    },
  },

  {
    name: "user.setStatus",
    title: "Foydalanuvchi holati",
    category: "Foydalanuvchi",
    description:
      "Ro'yxatni tasdiqlash/rad etish, ish faoliyatini to'xtatish (bloklash) yoki blokdan chiqarish, ro'lini o'zgartirish.",
    example: "Alisherni tasdiqla va admin qil",
    adminOnly: true,
    mutating: true,
    needsConfirm: true,
    fields: [
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true },
      { key: "status", label: "Ro'yxat holati", type: "select", options: ["pending", "approved", "rejected"] },
      { key: "isActive", label: "Ish faoliyatida", type: "boolean" },
      { key: "role", label: "Rol", type: "select", options: ["user", "grader", "admin"] },
    ],
    schema: z.object({
      user: z.string().min(1).max(190),
      status: z.enum(["pending", "approved", "rejected"]).optional(),
      isActive: z.boolean().optional(),
      role: z.enum(["user", "grader", "admin"]).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "user.setStatus");
      const user = await resolveOneUser(args.user);
      if (user.id === ctx.actor.userId && (args.role === "user" || args.isActive === false)) {
        throw new Error("O'z rolingizni pasaytirib bo'lmaydi");
      }
      const data: Record<string, unknown> = {};
      if (args.status) {
        data.status = args.status;
        if (args.status === "approved" && !user.status) data.approvedAt = new Date();
      }
      if (args.isActive != null) data.isActive = !!args.isActive;
      if (args.role) data.role = args.role;
      if (Object.keys(data).length === 0) throw new Error("O'zgartiriladigan maydon berilmagan");

      await db.user.update({ where: { id: user.id }, data: data as any });
      const changed = Object.entries(data)
        .map(([k, v]) => `${k} = ${v instanceof Date ? v.toISOString().slice(0, 10) : v}`)
        .join(", ");
      return ok(`${fullNameOf(user)}: ${changed}.`, { userId: user.id, changes: data });
    },
  },

  {
    name: "user.resetPassword",
    title: "Parolni tiklash",
    category: "Foydalanuvchi",
    description: "Foydalanuvchiga uchun tasodifiy parol yaratadi va Telegram orqali yuboradi (bog'langan bo'lsa).",
    example: "Alisherning parolini tikla",
    adminOnly: true,
    mutating: true,
    fields: [{ key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true }],
    schema: z.object({ user: z.string().min(1).max(190) }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "user.resetPassword");
      const user = await resolveOneUser(args.user);
      // Parol endi scrypt bilan hashlanadi (NextAuth verifyPassword ikkala
      // formatni ham qabul qiladi — eski sha256 ham ishlaydi).
      const password = generatePassword(8);
      const { hashPassword } = await import("@/lib/security/password");
      const passwordHash = hashPassword(password);
      const record = await db.user.findUnique({ where: { id: user.id }, select: { telegramId: true } });
      await db.user.update({ where: { id: user.id }, data: { passwordHash } });

      let sent = false;
      try {
        const { notifyPasswordReset } = await import("@/lib/telegram-bot");
        sent = await notifyPasswordReset({
          fullName: fullNameOf(user),
          email: user.email,
          password,
          telegramId: record?.telegramId || null,
        });
      } catch {
        sent = false;
      }
      return ok(
        `${fullNameOf(user)} uchun yangi parol yaratildi${sent ? " va Telegram orqali yuborildi" : " (Telegram orqali yuborilmadi вЂ” parol shu yerdan oling)"}.`,
        { userId: user.id, email: user.email, password: sent ? null : password, sent },
      );
    },
  },

  // -------------------------------------------------------------- NATIJALAR
  {
    name: "results.list",
    title: "Natijalarni ko'rish",
    category: "Natijalar",
    description: "Test topshirishlarini filtr bilan ro'yxatlaydi (bo'lim, test, sana, holat).",
    example: "IT bo'limining oxirgi 20 ta test natijasi",
    adminOnly: false,
    mutating: false,
    fields: [
      { key: "test", label: "Test", type: "entity", entity: "test" },
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user" },
      { key: "department", label: "Bo'lim", type: "text" },
      { key: "limit", label: "Limit", type: "number" },
    ],
    schema: z.object({
      test: z.string().max(190).optional(),
      user: z.string().max(190).optional(),
      department: z.string().max(190).optional(),
      limit: z.number().min(1).max(200).optional(),
    }),
    async execute(args, ctx) {
      let userId: string | undefined;
      if (args.user) userId = (await resolveOneUser(args.user)).id;
      else if (args.department) {
        const users = await db.user.findMany({
          where: { department: str(args.department, 190) },
          select: { id: true },
        });
        userId = users.length === 1 ? users[0].id : undefined;
        if (users.length > 1) {
          const all = await db.testResult.findMany({
            where: { userId: { in: users.map((u) => u.id) } },
            select: RESULT_SELECT,
            orderBy: { startedAt: "desc" },
            take: num(args.limit, 25),
          });
          const usersById = new Map(users.map((u) => [u.id, u.id]));
          void usersById;
          return ok(
            `В«${args.department}В» bo'limidan ${all.length} ta natija.`,
            { rows: all.map((r) => ({ ...r, startedAt: r.startedAt.toISOString(), completedAt: r.completedAt?.toISOString() ?? null })) },
          );
        }
      }

      const rows = await db.testResult.findMany({
        where: {
          ...(args.test ? { testId: (await resolveTest(args.test)).id } : {}),
          ...(userId ? { userId } : {}),
        },
        select: RESULT_SELECT,
        orderBy: { startedAt: "desc" },
        take: num(args.limit, 25),
      });

      const userIds = [...new Set(rows.map((r) => r.userId))];
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, surname: true, department: true },
      });
      const nameMap = new Map(users.map((u) => [u.id, u]));
      const testIds = [...new Set(rows.map((r) => r.testId))];
      const tests = await db.test.findMany({ where: { id: { in: testIds } }, select: { id: true, title: true } });
      const testMap = new Map(tests.map((t) => [t.id, t.title]));

      return ok(
        `${rows.length} ta natija topildi.`,
        {
          rows: rows.map((r) => ({
            id: r.id,
            user: fullNameOf(nameMap.get(r.userId) || { email: "?" }),
            department: nameMap.get(r.userId)?.department || "",
            test: testMap.get(r.testId) || "?",
            score: r.score,
            passed: r.passed,
            gradingStatus: r.gradingStatus,
            date: r.startedAt.toISOString(),
          })),
        },
      );
      void ctx;
    },
  },

  {
    name: "result.grade",
    title: "Yozma javobni baholash",
    category: "Natijalar",
    description:
      "Baholash kutilayotgan natijani qo'yadi (grader rolida). Ball qo'yilganda test natijasi 'graded' holatiga o'tadi.",
    example: "Alisherning yozma javobini 3 ball bilan baholadigan qilib belgiladim",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true },
      { key: "score", label: "Ball (%)", type: "number", required: true },
    ],
    schema: z.object({
      user: z.string().min(1).max(190),
      score: z.number().min(0).max(100),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "result.grade");
      const user = await resolveOneUser(args.user);
      const pending = await db.testResult.findMany({
        where: { userId: user.id, gradingStatus: "pending" },
        select: { id: true, testId: true, test: { select: { title: true, passScore: true } }, startedAt: true },
        orderBy: { startedAt: "desc" },
      });
      if (pending.length === 0) {
        throw new Error(`${fullNameOf(user)} uchun baholanmagan natija yo'q`);
      }
      const target = pending[0];
      const score = num(args.score, 0);
      const passed = score >= (target.test?.passScore ?? 60);
      await db.testResult.update({
        where: { id: target.id },
        data: {
          score,
          passed,
          gradingStatus: "graded",
          graderId: ctx.actor.userId,
          gradedAt: new Date(),
          completedAt: target.startedAt,
        },
      });
      return ok(
        `${fullNameOf(user)} вЂ” В«${target.test?.title}В»: ${score}% (${passed ? "o'tdi" : "yiqildi"}).`,
        { resultId: target.id, score, passed },
      );
    },
  },

  // --------------------------------------------------------------- ANALITIKA
  {
    name: "analytics.overview",
    title: "Umumiy analitika",
    category: "Analitika",
    description:
      "Butun platforma bo'yicha statistika: foydalanuvchilar, testlar, topshirishlar, o'tish darajasi, kunlik grafik, bo'limlar kesimi, ko'p yiqilayotgan testlar va eng qiyin savollar.",
    example: "Umumiy statistikani ko'rsat",
    adminOnly: true,
    mutating: false,
    fields: [],
    schema: z.object({}),
    async execute() {
      const data = await overviewAnalytics();
      return ok(
        `${data.users.total} xodim, ${data.tests.total} test, ${data.attempts.total} topshirish. O'rtacha ball ${data.performance.avgScore}%, o'tish ${data.performance.passRate}%. Eng ko'p yiqilayotgan test: В«${data.topFailingTests[0]?.title || "yo'q"}В».`,
        data,
      );
    },
  },

  {
    name: "analytics.test",
    title: "Test analitikasi",
    category: "Analitika",
    description:
      "Test bo'yicha batafsil: kimlar topshirgan, o'tish darajasi, ball taqsimoti, o'rtacha vaqt, qaysi savollar qiyin.",
    example: "В«Suxbat testi (API-TizimAdmin)В» analitikasini ko'rsat",
    adminOnly: true,
    mutating: false,
    fields: [{ key: "test", label: "Test", type: "entity", entity: "test", required: true }],
    schema: z.object({ test: z.string().min(1).max(190) }),
    async execute(args) {
      const test = await resolveTest(args.test);
      const data = await testAnalytics(test.id);
      if (!data) throw new Error("Test topilmadi");
      return ok(
        `В«${data.title}В»: ${data.attempts} topshirish, ${data.uniqueTakers} xodim, o'tish ${data.passRate}%, o'rtacha ${data.avgScore}%. Eng qiyin savol: В«${clip(data.hardest[0]?.text || "-", 90)}В» (${data.hardest[0]?.correctRate ?? 0}%).`,
        data,
      );
    },
  },

  {
    name: "analytics.user",
    title: "Xodim analitikasi",
    category: "Analitika",
    description:
      "Bitta xodim bo'yicha hamma natijalar, o'rtacha ball, dars/kurs progressi, zaif testlar, noto'g'ri berilgan savollar va berilgan maxsus ruxsatlar.",
    example: "Alisherning analitikasini ko'rsat",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true },
      { key: "includeAnswers", label: "Barcha natijalarni ro'yxatlash", type: "boolean" },
    ],
    schema: z.object({
      user: z.string().min(1).max(190),
      includeAnswers: z.boolean().optional(),
    }),
    async execute(args) {
      const user = await resolveOneUser(args.user);
      const data = await userAnalytics(user.id);
      if (!data) throw new Error("Foydalanuvchi topilmadi");
      const payload: Record<string, unknown> = { ...data };
      if (args.includeAnswers) {
        const results = await db.testResult.findMany({
          where: { userId: user.id },
          select: RESULT_SELECT,
          orderBy: { startedAt: "desc" },
          take: 50,
        });
        const tests = await db.test.findMany({
          where: { id: { in: [...new Set(results.map((r) => r.testId))] } },
          select: { id: true, title: true },
        });
        const map = new Map(tests.map((t) => [t.id, t.title]));
        payload.results = results.map((r) => ({
          test: map.get(r.testId) || "?",
          score: r.score,
          passed: r.passed,
          gradingStatus: r.gradingStatus,
          date: r.startedAt.toISOString(),
        }));
      }
      return ok(
        `${data.fullName}: ${data.attempts} topshirish, o'rtacha ${data.avgScore}%, o'tish ${data.passRate}%. Darslar ${data.lessonProgress.completed}/${data.lessonProgress.total}. Zaif savollar: ${data.weakQuestions.length} ta.`,
        payload,
      );
    },
  },

  {
    name: "analytics.departments",
    title: "Bo'limlar kesimi",
    category: "Analitika",
    description: "Bo'limlar bo'yicha xodimlar soni, topshirishlar, o'rtacha ball va o'tish darajasi.",
    example: "Bo'limlar bo'yicha natijani taqqosla",
    adminOnly: true,
    mutating: false,
    fields: [],
    schema: z.object({}),
    async execute() {
      const rows = await departmentComparison();
      const top = rows.slice(0, 3).map((r) => `${r.department}: ${r.avgScore}% (${r.passRate}%)`).join(", ");
      return ok(`${rows.length} ta bo'lim. Eng kuchli: ${top || "ma'lumot yo'q"}.`, { rows });
    },
  },

  {
    name: "analytics.weakQuestions",
    title: "O'zlashtirilmagan savollar",
    category: "Analitika",
    description:
      "Xodimlar ko'p noto'g'ri berayotgan savollarni topadi. Shu asosda qo'shimcha test yaratish mumkin.",
    example: "Qaysi savollar hammadan ko'p noto'g'ri berilgan?",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "test", label: "Faqat shu test", type: "entity", entity: "test" },
      { key: "limit", label: "Limit", type: "number" },
    ],
    schema: z.object({
      test: z.string().max(190).optional(),
      limit: z.number().min(1).max(50).optional(),
    }),
    async execute(args) {
      const testIds = args.test ? [(await resolveTest(args.test)).id] : undefined;
      const stats = (await questionStats(testIds))
        .filter((s) => s.answered > 0)
        .sort((a, b) => a.correctRate - b.correctRate)
        .slice(0, num(args.limit, 10));
      if (stats.length === 0) return ok("Hali topshirishlar yo'q вЂ” statistika uchun ma'lumot yetarli emas.");
      return ok(
        `Eng zaif savollar: ${stats
          .slice(0, 3)
          .map((s) => `В«${clip(s.text, 70)}В» (${s.correctRate}%)`)
          .join("; ")}`,
        { rows: stats },
      );
    },
  },

  // ---------------------------------------------------------------- MANBALAR
  {
    name: "files.search",
    title: "Platformadagi darslarda qidirish",
    category: "Manbalar",
    description:
      "Saytdagi barcha dars matnlari ichidan mavzuga mos qatorlarni topadi вЂ” test uchun manba yig'ishda ishlatiladi.",
    example: "Saytdagi darslarda В«qarz olish tartibiВ» degan mavzu bormi?",
    adminOnly: false,
    mutating: false,
    fields: [
      { key: "query", label: "Qidiruv so'zi", type: "text", required: true },
      { key: "limit", label: "Limit", type: "number" },
    ],
    schema: z.object({
      query: z.string().min(2).max(200),
      limit: z.number().min(1).max(60).optional(),
    }),
    async execute(args) {
      const q = str(args.query, 200);
      const lessons = await db.lesson.findMany({
        where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
        select: {
          id: true,
          title: true,
          content: true,
          module: { select: { title: true, courseId: true } },
        },
        take: num(args.limit, 6),
      });
      if (lessons.length === 0) return ok(`В«${q}В» so'zi bo'yicha dars topilmadi.`);
      const rows = lessons.map((l) => {
        const idx = l.content.indexOf(q);
        const excerpt =
          idx >= 0 ? l.content.slice(Math.max(0, idx - 200), idx + 400) : clip(l.content, 500);
        return {
          lessonId: l.id,
          title: l.title,
          module: l.module?.title || "",
          courseId: l.module?.courseId || "",
          excerpt: clip(excerpt, 600),
        };
      });
      return ok(`${lessons.length} ta darsda В«${q}В» topildi.`, { rows });
    },
  },

  {
    name: "web.search",
    title: "Internetdan qidirish",
    category: "Manbalar",
    description:
      "Internetda mavzu bo'yicha manba qidiradi va matnini qaytaradi. Faqat ochiq qidiruv вЂ” kalit kerak emas.",
    example: "O'zbekistonda mehnat himoyasi qonunchiligi bo'yicha rasmiy manbalarni top",
    adminOnly: false,
    mutating: false,
    fields: [
      { key: "query", label: "Qidiruv", type: "text", required: true },
      { key: "limit", label: "Natija soni", type: "number" },
      { key: "openPage", label: "Birinchi sahifaning to'liq matnini olish", type: "boolean" },
    ],
    schema: z.object({
      query: z.string().min(2).max(300),
      limit: z.number().min(1).max(25).optional(),
      openPage: z.boolean().optional(),
    }),
    async execute(args) {
      const outcome = await webSearch(str(args.query, 300), num(args.limit, 5));
      let pageText: string | null = null;
      if (args.openPage && outcome.hits[0]) {
        try {
          pageText = clip((await fetchPageText(outcome.hits[0].url)).text, 4000);
        } catch {
          pageText = null;
        }
      }
      const text = [
        `Qidiruv: ${outcome.engine}`,
        ...outcome.hits.map((h, i) => `${i + 1}. ${h.title}\n${h.url}\n${h.snippet}`),
        pageText ? `\nSahifa matni (${outcome.hits[0].url}):\n${pageText}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      return ok(
        outcome.hits.length
          ? `${outcome.engine} orqali ${outcome.hits.length} ta manba topildi.`
          : `Manba topilmadi${outcome.error ? `: ${outcome.error}` : ""}.`,
        { hits: outcome.hits, pageText, engine: outcome.engine },
      );
      void text;
    },
  },

  // -------------------------------------------------------------- HISOBOT/XABAR
  {
    name: "report.build",
    title: "Xodim hisobotini tayyorlash",
    category: "Hisobot va xabar",
    description:
      "Xodimning natijalarini hisoblab, tayyor PDF hisobot havolasini beradi (haqiqiy A4 PDF fayli).",
    example: "Alisher uchun PDF hisobot tayyorla",
    adminOnly: true,
    mutating: false,
    fields: [{ key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true }],
    schema: z.object({ user: z.string().min(1).max(190) }),
    async execute(args) {
      const user = await resolveOneUser(args.user);
      const data = await userAnalytics(user.id);
      if (!data) throw new Error("Foydalanuvchi topilmadi");
      const href = `/api/admin/skills/user-report?userId=${encodeURIComponent(user.id)}`;
      return ok(
        `${data.fullName} uchun hisobot tayyor: ${data.attempts} topshirish, o'rtacha ${data.avgScore}%, daraja ${
          data.avgScore >= 86 ? "I" : data.avgScore >= 70 ? "II" : "III"
        }.`,
        { ...data, pdfUrl: href },
        { label: "PDF yuklab olish", href },
      );
    },
  },

  // -------------------------------------------------------------- HUJJAT YARATISH (Faza 3)
  {
    name: "doc.excel",
    title: "Excel jadval yaratish",
    category: "Hisobot va xabar",
    description:
      "Ma'lumotlardan haqiqiy .xlsx fayl yaratadi: bir nechta varaq, sarlavha formati, SUM jami qatori, avtomatik filtr, ustun kengligi, sarlavhani qotirish. Diagramma uchun alohida izoh yoziladi.",
    example: "Xodimlar ro'yxatini Excelga chiqar",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "filename", label: "Fayl nomi", type: "text", required: true },
      { key: "title", label: "Sarlavha", type: "text" },
      { key: "sheets", label: "Varaqlar (JSON)", type: "textarea", required: true },
    ],
    schema: z.object({
      filename: z.string().min(1).max(80),
      title: z.string().max(200).optional(),
      sheets: z.array(
        z.object({
          name: z.string().min(1).max(31),
          headers: z.array(z.string().min(1).max(200)).min(1).max(50),
          rows: z.array(z.array(z.union([z.string(), z.number(), z.null()])).max(100).optional()).max(5000),
          columnWidths: z.array(z.number().min(5).max(60)).max(50).optional(),
          autofilter: z.boolean().optional(),
          freezeHeader: z.boolean().optional(),
          totalsRow: z.object({ label: z.string().max(200), columns: z.array(z.number().min(0).max(49)).max(20) }).optional(),
          chartNote: z.object({ title: z.string().max(200), type: z.string().max(20), labelColumn: z.number().min(0), valueColumns: z.array(z.number().min(0)).max(10) }).optional(),
        }),
      ).min(1).max(10),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "doc.excel");
      const { buildExcel, ensureFilesDir } = await import("./docgen");
      const { safeFileName, signFileUrl, KIND_MIME, FILE_URL_TTL_MS, formatBytes } = await import("./files");
      const fileName = safeFileName(args.filename, "excel");
      const dir = await ensureFilesDir();
      const fileId = `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const outPath = `${dir}/${fileId}.xlsx`;
      const storagePath = `upload/ai-files/${fileId}.xlsx`;
      const absPath = `${process.cwd()}/upload/ai-files/${fileId}.xlsx`;
      const spec: DocSpec = {
        kind: "excel",
        filename: fileName,
        title: args.title,
        sheets: args.sheets as never,
      };
      const { bytes } = await buildExcel(spec as never, absPath);
      void outPath;
      await saveFileSpec(storagePath, spec);
      const record: any = await db.aiFile.create({
        data: {
          ownerId: ctx.actor.userId,
          kind: "excel",
          fileName,
          mimeType: KIND_MIME.excel,
          size: bytes,
          storagePath,
          title: str(args.title || fileName, 200),
          specSummary: `${args.sheets.length} varaq`,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      const url = signFileUrl(record.id, Date.now() + FILE_URL_TTL_MS);
      return ok(
        `Excel tayyor: ${fileName} (${formatBytes(bytes)}).`,
        { fileId: record.id, fileName, size: bytes, mimeType: KIND_MIME.excel, downloadUrl: url, kind: "excel" },
        { label: "Yuklab olish", href: url },
        { type: "file", id: record.id },
      );
    },
  },

  {
    name: "doc.word",
    title: "Word hujjat yaratish",
    category: "Hisobot va xabar",
    description:
      "Haqiqiy .docx fayl yaratadi: sarlavhalar (3 daraja), paragraflar, markerli/raqamli ro'yxatlar, jadvallar, sahifa raqami (footer).",
    example: "Yig'ilish bayonnomasini Word'da tayyorla",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "filename", label: "Fayl nomi", type: "text", required: true },
      { key: "title", label: "Sarlavha", type: "text" },
      { key: "blocks", label: "Bloklar (JSON)", type: "textarea", required: true },
    ],
    schema: z.object({
      filename: z.string().min(1).max(80),
      title: z.string().max(200).optional(),
      subtitle: z.string().max(300).optional(),
      footer: z.string().max(200).optional(),
      blocks: z.array(
        z.union([
          z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string().min(1).max(2000) }),
          z.object({ type: z.literal("paragraph"), text: z.string().min(1).max(10000) }),
          z.object({ type: z.literal("bullet"), items: z.array(z.string().min(1).max(2000)).min(1).max(100) }),
          z.object({ type: z.literal("numbered"), items: z.array(z.string().min(1).max(2000)).min(1).max(100) }),
          z.object({ type: z.literal("table"), headers: z.array(z.string().max(500)).min(1).max(50), rows: z.array(z.array(z.string().max(2000)).max(50)).max(500) }),
        ]),
      ).min(1).max(200),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "doc.word");
      const { buildWord, ensureFilesDir } = await import("./docgen");
      const { safeFileName, signFileUrl, KIND_MIME, FILE_URL_TTL_MS, formatBytes } = await import("./files");
      const fileName = safeFileName(args.filename, "word");
      await ensureFilesDir();
      const fileId = `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const storagePath = `upload/ai-files/${fileId}.docx`;
      const absPath = `${process.cwd()}/upload/ai-files/${fileId}.docx`;
      const spec: DocSpec = {
        kind: "word",
        filename: fileName,
        title: args.title,
        subtitle: args.subtitle,
        footer: args.footer,
        blocks: args.blocks as never,
      };
      const { bytes } = await buildWord(spec as never, absPath);
      await saveFileSpec(storagePath, spec);
      const record: any = await db.aiFile.create({
        data: {
          ownerId: ctx.actor.userId,
          kind: "word",
          fileName,
          mimeType: KIND_MIME.word,
          size: bytes,
          storagePath,
          title: str(args.title || fileName, 200),
          specSummary: `${args.blocks.length} blok`,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      const url = signFileUrl(record.id, Date.now() + FILE_URL_TTL_MS);
      return ok(
        `Word tayyor: ${fileName} (${formatBytes(bytes)}).`,
        { fileId: record.id, fileName, size: bytes, mimeType: KIND_MIME.word, downloadUrl: url, kind: "word" },
        { label: "Yuklab olish", href: url },
        { type: "file", id: record.id },
      );
    },
  },

  {
    name: "doc.pdf",
    title: "PDF hujjat yaratish",
    category: "Hisobot va xabar",
    description:
      "Haqiqiy .pdf fayl yaratadi (o'zbekcha belgilar to'g'ri chiqadi — NotoSans): sarlavhalar, paragraflar, ro'yxatlar, jadvallar, sahifa raqami.",
    example: "Hisobotni PDF'da tayyorla",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "filename", label: "Fayl nomi", type: "text", required: true },
      { key: "title", label: "Sarlavha", type: "text" },
      { key: "blocks", label: "Bloklar (JSON)", type: "textarea", required: true },
    ],
    schema: z.object({
      filename: z.string().min(1).max(80),
      title: z.string().max(200).optional(),
      blocks: z.array(
        z.union([
          z.object({ type: z.literal("heading"), level: z.union([z.literal(1), z.literal(2), z.literal(3)]), text: z.string().min(1).max(2000) }),
          z.object({ type: z.literal("paragraph"), text: z.string().min(1).max(10000) }),
          z.object({ type: z.literal("bullet"), items: z.array(z.string().min(1).max(2000)).min(1).max(100) }),
          z.object({ type: z.literal("numbered"), items: z.array(z.string().min(1).max(2000)).min(1).max(100) }),
          z.object({ type: z.literal("table"), headers: z.array(z.string().max(500)).min(1).max(50), rows: z.array(z.array(z.string().max(2000)).max(50)).max(500) }),
        ]),
      ).min(1).max(200),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "doc.pdf");
      const { buildPdf, ensureFilesDir } = await import("./docgen");
      const { safeFileName, signFileUrl, KIND_MIME, FILE_URL_TTL_MS, formatBytes } = await import("./files");
      const fileName = safeFileName(args.filename, "pdf");
      await ensureFilesDir();
      const fileId = `f${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
      const storagePath = `upload/ai-files/${fileId}.pdf`;
      const absPath = `${process.cwd()}/upload/ai-files/${fileId}.pdf`;
      const spec: DocSpec = { kind: "pdf", filename: fileName, title: args.title, blocks: args.blocks as never };
      const { bytes, pages } = await buildPdf(spec as never, absPath);
      await saveFileSpec(storagePath, spec);
      const record: any = await db.aiFile.create({
        data: {
          ownerId: ctx.actor.userId,
          kind: "pdf",
          fileName,
          mimeType: KIND_MIME.pdf,
          size: bytes,
          storagePath,
          title: str(args.title || fileName, 200),
          specSummary: `${pages} sahifa`,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      const url = signFileUrl(record.id, Date.now() + FILE_URL_TTL_MS);
      return ok(
        `PDF tayyor: ${fileName} (${formatBytes(bytes)}, ${pages} sahifa).`,
        { fileId: record.id, fileName, size: bytes, mimeType: KIND_MIME.pdf, downloadUrl: url, kind: "pdf", pages },
        { label: "Yuklab olish", href: url },
        { type: "file", id: record.id },
      );
    },
  },

  {
    name: "doc.recreate",
    title: "Faylni qayta yasash / formatni o'zgartirish",
    category: "Hisobot va xabar",
    description:
      "Siz yaratgan mavjud faylni AYNAN o'sha ma'lumotdan qayta quradi va YANGI yuklab olish havolasi beradi. `as` ko'rsatilsa boshqa formatga o'tadi (Excel→Word/PDF, Word→Excel/PDF). Eski fayl o'chmaydi — yangisi alohida saqlanadi. Nomi topish uchun avval file.list ishlating.",
    example: "«hodimlar_ballari.xlsx» faylini qayta yasab, Word formatida yangi fayl ber",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "file", label: "Fayl nomi yoki ID", type: "text", required: true },
      { key: "as", label: "Yangi format (ixtiyoriy)", type: "select", options: ["excel", "word", "pdf"] },
      { key: "title", label: "Yangi sarlavha", type: "text" },
    ],
    schema: z.object({
      file: z.string().min(1).max(190),
      as: z.enum(["excel", "word", "pdf"]).optional(),
      title: z.string().max(200).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "doc.recreate");

      const needle = str(args.file, 190);
      const rows = await db.aiFile.findMany({
        where: {
          OR: [{ id: needle }, { fileName: { contains: needle } }],
          ...(ctx.actor.isAdmin ? {} : { ownerId: ctx.actor.userId }),
        },
        select: { id: true, fileName: true, kind: true, storagePath: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 6,
      });
      if (rows.length === 0) {
        throw new Error(
          `«${needle}» nomli fayl topilmadi. Avval file.list bilan qanday fayllar borligini ko'ring, keyin to'g'ri nomni bering.`,
        );
      }
      if (rows.length > 1) {
        throw new Error(
          `Bir nechta fayl mos keldi: ${rows.map((r) => `"${r.fileName}"`).join("; ")}. Aniq nom yozing.`,
        );
      }

      const file = rows[0];
      const source = await readFileSpec(file.storagePath);
      if (!source) {
        throw new Error(
          `«${file.fileName}» uchun saqlangan spec topilmadi (fayl eskiroq yoki to'liq yaratilmagan). Uni doc.excel/doc.word/doc.pdf orqali qaytadan yarating.`,
        );
      }

      const target = args.as || file.kind;
      const baseName = file.fileName.replace(/\.(xlsx|docx|pdf)$/i, "");
      // Har qayta yaratish YANGI nom oladi — bir xil fayl ustiga yozilmaydi.
      const nextName = /_v\d+$/.test(baseName)
        ? baseName.replace(/_v\d+$/, `_v${Number(baseName.match(/_v(\d+)$/)?.[1] || 1) + 1}`)
        : `${baseName}_v2`;

      const built = await rebuildFromSpec({
        source,
        kind: target as "excel" | "word" | "pdf",
        filename: nextName,
        title: args.title,
        actorId: ctx.actor.userId,
      });

      const { formatBytes } = await import("./files");
      const label =
        built.specKind === file.kind
          ? "Qayta yaratildi"
          : `${file.kind === "excel" ? "Excel" : file.kind === "word" ? "Word" : "PDF"} → ${
              built.specKind === "excel" ? "Excel" : built.specKind === "word" ? "Word" : "PDF"
            }`;
      return ok(
        `${label}: ${built.fileName} (${formatBytes(built.bytes)}${built.pages ? `, ${built.pages} sahifa` : ""}). Eski fayl saqlanib qoldi.`,
        {
          fileId: built.record.id,
          fileName: built.fileName,
          size: built.bytes,
          pages: built.pages,
          mimeType: built.record.mimeType,
          downloadUrl: built.url,
          kind: built.specKind,
          sourceFileId: file.id,
          sourceFileName: file.fileName,
        },
        { label: "Yuklab olish", href: built.url },
        { type: "file", id: String(built.record.id) },
      );
    },
  },

  {
    name: "file.list",
    title: "AI yaratgan fayllarni ko'rish",
    category: "Hisobot va xabar",
    description:
      "Sizning hamma yaratgan fayllaringiz: nom, tur, sana, hajm va YANGI imzolangan yuklab olish havolasi. 'Faylni qayta yasab ber', 'qaysi fayllar bor' degan so'rovlarda avval shu vosita bilan nomni aniqlashtir.",
    example: "Yaratgan fayllarimni ko'rsat",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "name", label: "Nom bo'yicha qidirish", type: "text" },
      { key: "kind", label: "Format", type: "select", options: ["excel", "word", "pdf"] },
      { key: "limit", label: "Limit", type: "number" },
    ],
    schema: z.object({
      name: z.string().max(190).optional(),
      kind: z.enum(["excel", "word", "pdf"]).optional(),
      limit: z.number().min(1).max(100).optional(),
    }),
    async execute(args, ctx) {
      const rows = await db.aiFile.findMany({
        where: {
          ...(ctx.actor.isAdmin ? {} : { ownerId: ctx.actor.userId }),
          ...(args.kind ? { kind: args.kind } : {}),
          ...(args.name ? { fileName: { contains: str(args.name, 190) } } : {}),
        },
        select: { id: true, fileName: true, kind: true, size: true, createdAt: true, title: true, downloadCount: true },
        orderBy: { createdAt: "desc" },
        take: num(args.limit, 12),
      });
      if (rows.length === 0) return ok("Hali birorta fayl yaratilmagan.", { rows: [] });

      const { formatBytes } = await import("./files");
      const enriched = await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          fileName: r.fileName,
          kind: r.kind,
          size: r.size,
          sizeText: formatBytes(r.size),
          title: r.title,
          downloads: r.downloadCount,
          date: r.createdAt.toISOString(),
          downloadUrl: await freshFileUrl(r.id),
        })),
      );

      return ok(
        `${enriched.length} ta fayl topildi: ${enriched.slice(0, 3).map((r) => r.fileName).join(", ")}${enriched.length > 3 ? "…" : ""}.`,
        { rows: enriched },
      );
    },
  },

  {
    name: "artifact.dashboard",
    title: "Vizual dashboard (artifact)",
    category: "Hisobot va xabar",
    description:
      "Chat ichida ochiladigan mustaqil HTML dashboard yaratadi: KPI kartalar, gorizontal/ustunli diagramma, donut (ring) diagramma va jadvallar. Barcha grafik LOKAL statik SVG — CDN va skript ishlatilmaydi, shuning uchun skriptsiz sandbox'da xavfsiz ishlaydi. Ma'lumotni avval analytics.* vositalaridan ol, keyin shu spec'ni to'ldir.",
    example: "Bo'limlar kesimini choy diagrammasi bilan dashboard qil",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "title", label: "Sarlavha", type: "text", required: true },
      { key: "subtitle", label: "Izoh", type: "text" },
      { key: "kpis", label: "KPI (JSON)", type: "textarea", hint: '[{"label":"Xodimlar","value":47}]' },
      { key: "charts", label: "Diagrammalar (JSON)", type: "textarea", hint: '[{"title":"Bo\'limlar","type":"bar","items":[{"label":"IT","value":12}]}]' },
      { key: "donut", label: "Donut (JSON)", type: "textarea", hint: '{"title":"Holatlar","items":[{"label":"O\'tgan","value":30}]}' },
      { key: "tables", label: "Jadvallar (JSON)", type: "textarea", hint: '[{"title":"Ro\'yxat","headers":["Xodim","Ball"],"rows":[["Alisher",88]]}]' },
    ],
    schema: z.object({
      title: z.string().min(2).max(160),
      subtitle: z.string().max(300).optional(),
      kpis: z
        .array(z.object({ label: z.string().min(1).max(80), value: z.union([z.number(), z.string()]), suffix: z.string().max(8).optional() }))
        .max(8)
        .optional(),
      charts: z
        .array(
          z.object({
            title: z.string().max(120).optional(),
            type: z.enum(["bar", "column"]).optional(),
            items: z.array(z.object({ label: z.string().max(80), value: z.number() })).min(1).max(24),
          }),
        )
        .max(4)
        .optional(),
      donut: z
        .object({
          title: z.string().max(120).optional(),
          items: z.array(z.object({ label: z.string().max(80), value: z.number() })).min(1).max(24),
        })
        .optional(),
      tables: z
        .array(
          z.object({
            title: z.string().max(120).optional(),
            headers: z.array(z.string().max(120)).min(1).max(12),
            rows: z.array(z.array(z.union([z.string(), z.number(), z.null()])).max(12)).max(200),
          }),
        )
        .max(3)
        .optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "artifact.dashboard");
      const { buildDashboardHtml } = await import("./artifacts");
      const html = buildDashboardHtml({
        title: str(args.title, 160),
        subtitle: args.subtitle ? str(args.subtitle, 300) : undefined,
        kpis: args.kpis,
        bars: (args.charts || []).map((c: any) => ({ title: c.title, items: c.items, type: c.type || "bar" })),
        donut: args.donut,
        tables: args.tables,
        badge: "dashboard",
      });
      const record = await db.aiArtifact.create({
        data: {
          ownerId: ctx.actor.userId,
          conversationId: ctx.conversationId || null,
          kind: "dashboard",
          title: str(args.title, 160),
          html,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        select: { id: true, title: true },
      });
      const href = `/api/ai/artifacts/${record.id}`;
      const blocks =
        (args.kpis?.length || 0) + (args.charts?.length || 0) + (args.donut ? 1 : 0) + (args.tables?.length || 0);
      return ok(
        `Dashboard tayyor: ${record.title} (${blocks} ta blok, ${(html.length / 1024).toFixed(1)} KB).`,
        { artifactId: record.id, title: record.title, kind: "dashboard", artifactUrl: href, bytes: html.length },
        { label: "Dashboardni ochish", href },
        { type: "artifact", id: record.id },
      );
    },
  },

  {
    name: "artifact.code",
    title: "Kod ko'rinishida artifact",
    category: "Hisobot va xabar",
    description:
      "Kod yoki texnik matnni chat ichidagi artifact sifatida ko'rsatadi: syntax bo'yalgan, qator raqamlari bilan. Skriptsiz sandbox — ko'rsatish uchun, bajarish uchun emas (bajarish: code.exec).",
    example: "Bu SQL so'roqini kod ko'rinishida ko'rsat",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "title", label: "Sarlavha", type: "text", required: true },
      { key: "language", label: "Til", type: "text" },
      { key: "code", label: "Kod", type: "textarea", required: true },
      { key: "note", label: "Izoh", type: "text" },
    ],
    schema: z.object({
      title: z.string().min(2).max(160),
      language: z.string().max(30).optional(),
      code: z.string().min(1).max(60_000),
      note: z.string().max(300).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "artifact.code");
      const { buildCodeHtml } = await import("./artifacts");
      const html = buildCodeHtml({
        title: str(args.title, 160),
        language: args.language,
        code: str(args.code, 60_000),
        note: args.note ? str(args.note, 300) : undefined,
      });
      const record = await db.aiArtifact.create({
        data: {
          ownerId: ctx.actor.userId,
          conversationId: ctx.conversationId || null,
          kind: "code",
          title: str(args.title, 160),
          html,
          source: str(args.code, 60_000),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        select: { id: true, title: true },
      });
      const href = `/api/ai/artifacts/${record.id}`;
      const lines = str(args.code, 60_000).split("\n").length;
      return ok(
        `Kod artifacti tayyor: ${record.title} (${lines} qator).`,
        { artifactId: record.id, title: record.title, kind: "code", artifactUrl: href, bytes: html.length },
        { label: "Kodni ochish", href },
        { type: "artifact", id: record.id },
      );
    },
  },

  {
    name: "image.generate",
    title: "Rasm yaratish",
    category: "Hisobot va xabar",
    description:
      "Matndan haqiqiy rasm yaratadi (rasmli poster, illyustratsiya, avatar, diagramma). Rasm haqiqiy fayl sifatida saqlanadi va chatda ko'rsatiladi — yuklab olish mumkin. Kunlik limit bor (AI_IMAGE_DAILY_LIMIT).",
    example: "Adaptatsiya portali uchun xush kelibsiz banneri chiz: ko'k gradient, yozuvsiz",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "prompt", label: "Rasm tavsifi", type: "textarea", required: true },
      { key: "size", label: "O'lcham", type: "select", options: ["1:1", "16:9", "4:3", "3:4", "9:16"] },
      { key: "style", label: "Uslub", type: "text", hint: "masalan: yapon minimalizmi, yorqin 3D, watercolor" },
    ],
    schema: z.object({
      prompt: z.string().min(3).max(1000),
      size: z.enum(["1:1", "16:9", "4:3", "3:4", "9:16"]).optional(),
      style: z.string().max(200).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "image.generate");
      const { generateImage, storeGeneratedImage, imageDailyLimit, imagesUsedToday, ImageGenerationError } =
        await import("./image");

      const used = await imagesUsedToday(ctx.actor.userId);
      const limit = imageDailyLimit();
      if (used >= limit) {
        return fail(`Bugungi rasm limiti tugagan (${limit} ta). Ertaga yoki limitni oshirish uchun admin bilan bog'laning.`);
      }

      let image;
      try {
        image = await generateImage({ prompt: str(args.prompt, 1000), size: args.size, style: args.style });
      } catch (err: any) {
        const status = err instanceof ImageGenerationError ? err.providerStatus : 502;
        return fail(err?.message || "Rasm yaratilmadi", { providerStatus: status });
      }

      const stored = await storeGeneratedImage({
        ownerId: ctx.actor.userId,
        conversationId: ctx.conversationId || null,
        image,
        prompt: str(args.prompt, 1000),
        title: str(args.prompt, 60),
      });

      return ok(
        `Rasm tayyor: ${stored.fileName} (${(stored.size / 1024).toFixed(1)} KB, model: ${image.model}).`,
        {
          fileId: stored.id,
          fileName: stored.fileName,
          imageUrl: stored.url,
          mimeType: image.mime,
          size: stored.size,
          prompt: str(args.prompt, 400),
          model: image.model,
          kind: "image",
        },
        { label: "Rasmni yuklab olish", href: stored.url },
        { type: "file", id: stored.id },
      );
    },
  },

  {
    name: "notify.broadcast",
    title: "Telegram orqali xabar yuborish",
    category: "Hisobot va xabar",
    description:
      "Botga obuna bo'lgan BARCHA xodimlarga xabar yuboradi. Ehtiyotkor bo'ling вЂ” bu o'chmas xabar.",
    example: "Barchaga: ertaga soat 09:00 da yig'ilish bor",
    adminOnly: true,
    mutating: true,
    needsConfirm: true,
    fields: [
      { key: "text", label: "Xabar matni", type: "textarea", required: true },
      { key: "confirm", label: "Ha, barchaga yuborilsin", type: "boolean", required: true },
    ],
    schema: z.object({
      text: z.string().min(3).max(2000),
      confirm: z.literal(true),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "notify.broadcast");
      const subscribers = await subscriberCount();
      const result = await broadcast({ text: str(args.text, 2000) });
      return ok(
        `Xabar yuborildi: ${result.sent} ta muvaffaqiyatli${result.failed ? `, ${result.failed} ta xato` : ""}.`,
        { subscribers, ...result },
      );
    },
  },

  // ------------------------------------------------------------------ TIZIM
  {
    name: "access.rules.list",
    title: "Ruxsat qoidalarini ko'rish",
    category: "Ko'rinish va ruxsat",
    description: "Barcha maxsus ko'rinish va ruxsat qoidalarini ro'yxatlaydi.",
    example: "Hozir qanday maxsus ruxsatlar berilgan?",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "resourceType", label: "Resurs turi", type: "select", options: ["test", "lesson", "course", "job"] },
      { key: "limit", label: "Limit", type: "number" },
    ],
    schema: z.object({
      resourceType: z.enum(["test", "lesson", "course", "job"]).optional(),
      limit: z.number().min(1).max(300).optional(),
    }),
    async execute(args) {
      const rules = await db.accessRule.findMany({
        where: args.resourceType ? { resourceType: args.resourceType } : undefined,
        orderBy: { createdAt: "desc" },
        take: num(args.limit, 60),
      });
      const userIds = [...new Set(rules.filter((r) => r.subjectType === "user").map((r) => r.subjectValue))];
      const users = await db.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, surname: true, email: true, department: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));
      const testIds = [...new Set(rules.filter((r) => r.resourceType === "test").map((r) => r.resourceId))];
      const lessonIds = [...new Set(rules.filter((r) => r.resourceType === "lesson").map((r) => r.resourceId))];
      const [tests, lessons] = await Promise.all([
        db.test.findMany({ where: { id: { in: testIds } }, select: { id: true, title: true } }),
        db.lesson.findMany({ where: { id: { in: lessonIds } }, select: { id: true, title: true } }),
      ]);
      const testMap = new Map(tests.map((t) => [t.id, t.title]));
      const lessonMap = new Map(lessons.map((l) => [l.id, l.title]));

      const rows = rules.map((r) => ({
        id: r.id,
        subject:
          r.subjectType === "user"
            ? `${fullNameOf(userMap.get(r.subjectValue) || { email: r.subjectValue })} <${userMap.get(r.subjectValue)?.email || r.subjectValue}>`
            : `${r.subjectType}: ${r.subjectValue}`,
        resource:
          r.resourceType === "test"
            ? testMap.get(r.resourceId) || r.resourceId
            : r.resourceType === "lesson"
              ? lessonMap.get(r.resourceId) || r.resourceId
              : r.resourceId,
        resourceType: r.resourceType,
        effect: r.effect,
        allowRetake: r.allowRetake,
        maxAttempts: r.maxAttempts,
        reason: r.reason,
        createdBy: r.createdByName,
        date: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() || null,
      }));
      return ok(`${rows.length} ta qoida.`, { rows });
    },
  },

  {
    name: "access.rule.remove",
    title: "Ruxsat qoidasini o'chirish",
    category: "Ko'rinish va ruxsat",
    description: "Berilgan maxsus ruxsatni yoki yashirishni bekor qiladi (asosiy ko'rinishga qaytaradi).",
    example: "Alisherga berilgan qayta topshirish ruxsatini olib tashla",
    adminOnly: true,
    mutating: true,
    needsConfirm: true,
    fields: [
      { key: "ruleId", label: "Qoida ID", type: "text" },
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user" },
      { key: "resourceType", label: "Resurs turi", type: "select", options: ["test", "lesson", "course", "job"] },
      { key: "resource", label: "Resurs nomi/ID", type: "text" },
      { key: "confirm", label: "Ha, olib tashlaymiz", type: "boolean", required: true },
    ],
    schema: z.object({
      ruleId: z.string().max(64).optional(),
      user: z.string().max(190).optional(),
      resourceType: z.enum(["test", "lesson", "course", "job"]).optional(),
      resource: z.string().max(190).optional(),
      confirm: z.literal(true),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "access.rule.remove");
      if (args.ruleId) {
        await deleteRule(args.ruleId);
        return ok("Qoida o'chirildi.", { ruleId: args.ruleId });
      }
      if (!args.user || !args.resourceType || !args.resource) {
        throw new Error("Qoida ID yoki (foydalanuvchi + resurs turi + resurs) kerak");
      }
      const user = await resolveOneUser(args.user);
      const resourceId =
        args.resourceType === "test"
          ? (await resolveTest(args.resource)).id
          : args.resourceType === "lesson"
            ? (await resolveLesson(args.resource)).id
            : args.resourceType === "course"
              ? (await resolveCourse(args.resource)).id
              : (await resolveJob(args.resource)).id;

      const removed = await db.accessRule.deleteMany({
        where: {
          subjectType: "user",
          subjectValue: user.id,
          resourceType: args.resourceType,
          resourceId,
        },
      });
      return ok(
        removed.count > 0
          ? `${fullNameOf(user)} uchun maxsus ruxsat olib tashlandi.`
          : `${fullNameOf(user)} uchun bunday qoida yo'q edi.`,
        { removed: removed.count },
      );
    },
  },

  {
    name: "permissions.check",
    title: "Kirmoq huquqini tekshirish",
    category: "Ko'rinish va ruxsat",
    description:
      "Xuddi shu foydalanuvchi shu testni ko'ra oladimi, qayta topshira oladimi вЂ” aniq javob beradi (qoidalar + test sozlamalari hisobga olinadi).",
    example: "Alisher В«Suxbat testiВ» ni ko'ra oladimi va qayta topshira oladimi?",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "user", label: "Foydalanuvchi", type: "entity", entity: "user", required: true },
      { key: "test", label: "Test", type: "entity", entity: "test", required: true },
    ],
    schema: z.object({
      user: z.string().min(1).max(190),
      test: z.string().min(1).max(190),
    }),
    async execute(args) {
      const user = await resolveOneUser(args.user);
      const test = await resolveTest(args.test);
      const attemptCount = await db.testResult.count({ where: { userId: user.id, testId: test.id } });
      const perm = await resolveTestPermissions(
        { id: user.id, department: user.department, position: user.position, role: user.role },
        {
          id: test.id,
          visibility: test.visibility,
          assignedUserIds: test.assignedUserIds,
          status: test.status,
          maxAttempts: test.maxAttempts,
        },
        attemptCount,
      );
      return ok(
        `${fullNameOf(user)} uchun В«${test.title}В»: ${perm.allowed ? "KO'RADI" : "KO'RMASLIGI"}; topshirishlar ${perm.attemptsUsed}/${perm.effectiveMaxAttempts === 0 ? "в€ћ" : perm.effectiveMaxAttempts}; qayta topshirish ${perm.allowRetake ? "ruxsati bor" : "yo'q"}; qoida manbasi: ${perm.matchedBy}.`,
        { testId: test.id, userId: user.id, ...perm },
      );
    },
  },

  {
    name: "draft.list",
    title: "AI qoralamalarini ko'rish",
    category: "Testlar",
    description: "Yaratilgan, lekin hali tasdiqlanmagan test qoralamalarini ro'yxatlaydi.",
    example: "Tasdiqlanmagan qoralamalar bormi?",
    adminOnly: true,
    mutating: false,
    fields: [{ key: "status", label: "Holat", type: "select", options: ["draft", "approved", "applied", "rejected"] }],
    schema: z.object({ status: z.enum(["draft", "approved", "applied", "rejected"]).optional() }),
    async execute(args, ctx) {
      const drafts = await db.aiDraft.findMany({
        where: {
          // Faqat o'z qoralamalari — boshqa adminniki ko'rinmaydi
          ownerId: ctx.actor.userId,
          ...(args.status ? { status: args.status } : {}),
        },
        select: { id: true, title: true, topic: true, status: true, sourceMode: true, updatedAt: true, owner: { select: { email: true } } },
        orderBy: { updatedAt: "desc" },
        take: 30,
      });
      if (drafts.length === 0) return ok("Qoralamalar ro'yxati bo'sh.");
      const payload = drafts.map((d) => ({
        ...d,
        updatedAt: d.updatedAt.toISOString(),
      }));
      return ok(
        `${payload.length} ta qoralama (${payload.filter((d) => d.status === "draft").length} tasi tasdiqlanmagan).`,
        { rows: payload },
        { label: "Qoralamalarni ochish", href: "/admin/ai" },
      );
    },
  },

  {
    name: "draft.reject",
    title: "Qoralamani rad etish",
    category: "Testlar",
    description: "AI qoralamasini rad etadi (o'chirilmaydi, tarixda qoladi).",
    example: "Oxirgi qoralamani rad et",
    adminOnly: true,
    mutating: true,
    fields: [
      { key: "draftId", label: "Qoralama ID", type: "text" },
      { key: "confirm", label: "Ha, rad etamiz", type: "boolean", required: true },
    ],
    schema: z.object({ draftId: z.string().max(64), confirm: z.literal(true) }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "draft.reject");
      // Faqat egasining qoralamasini rad etish mumkin
      const owned = await db.aiDraft.findFirst({
        where: { id: args.draftId, ownerId: ctx.actor.userId },
        select: { id: true },
      });
      if (!owned) throw new Error("Qoralama topilmadi");
      await db.aiDraft.update({ where: { id: args.draftId }, data: { status: "rejected" } });
      return ok("Qoralama rad etildi.", { draftId: args.draftId });
    },
  },

  {
    name: "audit.recent",
    title: "Oxirgi AI harakatlari",
    category: "Tizim",
    description: "AI orqali bajarilgan oxirgi amallarni kim, qachon, nima qilganini ko'rsatadi.",
    example: "AI oxirgi soatda nima qildi?",
    adminOnly: true,
    mutating: false,
    fields: [{ key: "limit", label: "Limit", type: "number" }],
    schema: z.object({ limit: z.number().min(1).max(100).optional() }),
    async execute(args) {
      const rows = await db.aiAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: num(args.limit, 25),
      });
      return ok(`${rows.length} ta amal yozilgan.`, {
        rows: rows.map((r) => ({
          date: r.createdAt.toISOString(),
          actor: r.actorEmail,
          action: r.action,
          outcome: r.outcome,
          detail: r.detail,
          source: r.source,
        })),
      });
    },
  },

  {
    name: "system.aiStatus",
    title: "AI tizimi holati",
    category: "Tizim",
    description:
      "Hozir qaysi model ishlatilayotgani, kunlik kvota, sarflangan narx va qidiruv engine holatini ko'rsatadi.",
    example: "AI tizimi qanday ishlayapti?",
    adminOnly: true,
    mutating: false,
    fields: [],
    schema: z.object({}),
    async execute(_args, ctx) {
      const provider = await resolveProviderAsync();
      const today = new Date().toISOString().slice(0, 10);
      const usage = await db.aiUsage.findMany({
        where: { OR: [{ day: today }, { userId: ctx.actor.userId }] },
        orderBy: { day: "desc" },
      });
      const sum = (pick: (u: (typeof usage)[number]) => number) => usage.reduce((a, u) => a + pick(u), 0);
      const health = modelHealthReport();
      const blocked = health.filter((h) => !h.available);
      // Tizim qaysi modelga o'tgani вЂ” s sozlangandagi emas, amalda ishlayotgani.
      const active = preferredModelName() || provider.model;
      const switched = active !== provider.model;
      return ok(
        `Model: ${provider.name} / ${provider.model}${switched ? ` (hozir faol: ${active})` : ""}. Bugungi so'rovlar: ${sum((u) => u.requests)}. Qidiruv: ${searchEngineInfo()}. Sarf: $${sum((u) => u.estimatedCost).toFixed(4)}. Bloklangan modellar: ${blocked.length ? blocked.map((b) => `${b.model} (${b.blockedForSec}s)`).join(", ") : "yo'q"}.`,
        {
          provider: { name: provider.name, model: provider.model, live: provider.live, kind: provider.kind },
          activeModel: active,
          switched,
          chain: providerChainInfo(provider),
          health,
          today,
          requests: sum((u) => u.requests),
          promptTokens: sum((u) => u.promptTokens),
          completionTokens: sum((u) => u.completionTokens),
          cost: Number(sum((u) => u.estimatedCost).toFixed(6)),
          searchEngine: searchEngineInfo(),
          rows: usage.slice(0, 10),
        },
      );
    },
  },

  {
    name: "code.exec",
    title: "Kodni ishga tushirish va natijani ko'rsatish",
    category: "Tizim",
    description:
      "Kodni ALMASHTIRMAYDI, uni HAQIQATAN ishga tushiradi va natijani (chiqish/xato matni) qaytaradi. Hisob-kitob, ma'lumot tahlili, ro'yxatni saralash, JSON tekshirish kabi vazifalar uchun. Til: 'js' (Node.js) yoki 'sh' (buyruq qatori).",
    example: "1 dan 100 gacha sonlar yig'indisini top",
    adminOnly: true,
    mutating: true,
    needsConfirm: true,
    fields: [
      { key: "code", label: "Kod", type: "textarea", required: true },
      { key: "lang", label: "Til", type: "select", options: ["js", "sh"] },
    ],
    schema: z.object({
      code: z.string().min(1).max(20_000),
      lang: z.enum(["js", "sh"]).optional(),
    }),
    async execute(args, ctx) {
      await requireAdmin(ctx, "code.exec");
      const lang = args.lang === "sh" ? "sh" : "js";
      const { spawn } = await import("node:child_process");

      return new Promise((resolve) => {
        // Kod alohida jarayonda: `node -e` yoki buyruq qatori.
        const child =
          lang === "sh"
            ? spawn("cmd.exe", ["/c", args.code], { cwd: tmpdir(), windowsHide: true })
            : spawn(process.execPath, ["-e", args.code], { cwd: tmpdir(), windowsHide: true });

        let out = "";
        let err = "";
        let killed = false;

        const cap = (buf: string, add: string) => (buf.length >= MAX_CODE_OUTPUT ? buf : buf + add);
        child.stdout?.on("data", (d) => (out = cap(out, d.toString())));
        child.stderr?.on("data", (d) => (err = cap(err, d.toString())));

        // Qat'iy vaqt chegarasi: kod o'z-o'zidan to'xtamaydigan bo'lishi
        // mumkin (`while(true)`) вЂ” jarayonni majburan o'ldiramiz.
        const timer = setTimeout(() => {
          killed = true;
          child.kill();
        }, CODE_TIMEOUT_MS);

        child.on("error", (e: Error) => {
          clearTimeout(timer);
          resolve(ok(`Kodni ishga tushirib bo'lmadi: ${e.message}`, { output: "", error: e.message }));
        });

        child.on("close", (code) => {
          clearTimeout(timer);
          const output = out.trim();
          const error = err.trim();
          // Audit markaziy runTool'da yoziladi (double-write bo'lmasligi uchun bu yerda yozilmaydi)
          if (code === 0) {
            resolve(
              ok(
                output
                  ? `Natija:\n${output}`
                  : "Kod bajarildi, lekin hech narsa chiqarmadi вЂ” console.log qo'shing.",
                { output, stderr: error, exitCode: code, timedOut: false, lang },
              ),
            );
          } else {
            resolve(
              fail(
                `Kod xatoda to'xtadi (${killed ? "vaqt limiti" : `kod ${code}`}).\n${error || output}`,
                { output, error: error || output, exitCode: code, timedOut: killed, lang },
              ),
            );
          }
        });
      });
    },
  },
];

// ============================================================================
//  SKILLAR va MCP вЂ” model saytni tushishi uchun
// ============================================================================

const SKILL_TOOLS: ToolDef[] = [
  {
    name: "skill.list",
    title: "Skillar ro'yxati",
    category: "Tizim",
    description:
      "Platforma qoidalari va ish oqimlarining qo'llanmalari (skill) ro'yxati. Sayt qoidalarini aniq bilmoqchi bo'lsang avval shuni chaqir, kerakli skillni keyin 'skill.read' bilan o'qi.",
    example: "Sayt qoidalari qanday?",
    adminOnly: true,
    mutating: false,
    fields: [],
    schema: z.object({}),
    async execute() {
      return ok(
        `${SKILLS.length} ta skill mavjud.`,
        { skills: SKILLS.map((s) => ({ name: s.name, title: s.title, when: s.when })) },
      );
    },
  },
  {
    name: "skill.read",
    title: "Skillni o'qish",
    category: "Tizim",
    description:
      "Berilgan skillning to'liq qo'llanmasini qaytaradi (qoidalar, ish tartibi, vositalar). Nima haqida savol kelsa, tegishli skillni shu yerda o'qi va unga amal qil.",
    example: "test.janrlarini tushuntir",
    adminOnly: true,
    mutating: false,
    fields: [
      {
        key: "name",
        label: "Skill nomi",
        type: "select",
        required: true,
        options: SKILLS.map((s) => s.name),
        hint: "skill.list dan ko'ring",
      },
    ],
    schema: z.object({ name: z.string().min(2).max(64) }),
    async execute(args) {
      const skill = skillByName(args.name);
      if (!skill) {
        return fail(`Bunday skill yo'q. Ro'yxat: ${SKILLS.map((s) => s.name).join(", ")}`);
      }
      return ok(`${skill.title} o'qildi.`, { name: skill.name, title: skill.title, body: skill.body });
    },
  },
];

const MCP_TOOLS: ToolDef[] = [
  {
    name: "mcp.servers",
    title: "MCP serverlar",
    category: "Tizim",
    description:
      "Ulangan tashqi MCP serverlar ro'yxati. Tashqi vosita yoki ma'lumot kerak bo'lsa avval shu serverlar mavjudligini tekshir.",
    example: "Qanday MCP serverlar ulangan?",
    adminOnly: true,
    mutating: false,
    fields: [],
    schema: z.object({}),
    async execute() {
      const servers = configuredServers();
      return ok(
        servers.length ? `${servers.length} ta MCP server ulangan.` : "Tashqi MCP server ulanmagan.",
        {
          servers: servers.map((s) => ({ name: s.name, url: s.url, description: s.description || "" })),
          hint: "Ulash uchun .env da MCP_SERVERS = JSON qo'shiladi",
        },
      );
    },
  },
  {
    name: "mcp.tools",
    title: "MCP vositalari",
    category: "Tizim",
    description: "Tanlangan MCP serverdagi barcha vositalar ro'yxati (nom, tavsif, argumentlar).",
    example: "brave serverida qanday vositalar bor?",
    adminOnly: true,
    mutating: false,
    fields: [
      {
        key: "server",
        label: "Server",
        type: "text",
        required: true,
        hint: "mcp.servers dan oling",
      },
    ],
    schema: z.object({ server: z.string().min(1).max(80) }),
    async execute(args) {
      const tools = await mcpListTools(str(args.server, 80));
      return ok(`${args.server}: ${tools.length} ta vosita.`, {
        server: args.server,
        tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
      });
    },
  },
  {
    name: "mcp.call",
    title: "MCP vositasini chaqirish",
    category: "Tizim",
    description:
      "Tashqi MCP serverdagi vositani chaqiradi. Avval 'mcp.tools' bilan vosita nomi va argumentlarini tekshir.",
    example: "internetdan yangi qonun matnini ol",
    adminOnly: true,
    mutating: false,
    fields: [
      { key: "server", label: "Server", type: "text", required: true },
      { key: "tool", label: "Vosita nomi", type: "text", required: true },
      {
        key: "args",
        label: "Argumentlar (JSON)",
        type: "textarea",
        hint: 'masalan {"query":"yangi qonun"}',
      },
    ],
    schema: z.object({
      server: z.string().min(1).max(80),
      tool: z.string().min(1).max(120),
      args: z.record(z.string(), z.any()).optional(),
    }),
    async execute(args) {
      const out = await mcpCallTool(str(args.server, 80), str(args.tool, 120), (args.args || {}) as Record<string, unknown>);
      return out.isError ? fail(out.text.slice(0, 4000)) : ok(out.text.slice(0, 4000), { server: args.server, tool: args.tool });
    },
  },
];

TOOLS.push(...SKILL_TOOLS, ...MCP_TOOLS);

const RESULT_SELECT = {
  id: true,
  userId: true,
  testId: true,
  score: true,
  passed: true,
  answers: true,
  gradingStatus: true,
  startedAt: true,
  completedAt: true,
} as const;

// ============================================================================
//  Registry yordamchilari
// ============================================================================

const BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function getTool(name: string) {
  return BY_NAME.get(name) || null;
}

export function visibleTools(actor: ToolActor) {
  return TOOLS.filter((t) => !t.adminOnly || actor.isAdmin || actor.role === "grader");
}

/** Model uchun qisqa va aniq ta'rif (chat promptiga qo'yiladi). */
/**
 * Zod schema'ni ixcham JSON Schema'ga aylantiradi (model uchun).
 * `$schema` olib tashlanadi, keraksiz bo'shliqlar siqiladi — prompt hajmi
 * oshmasligi uchun. Xato bo'lsa eski `key:type` formatiga qaytiladi.
 */
function toolJsonSchema(tool: ToolDef): string {
  try {
    const full = (tool.schema as unknown as { toJSONSchema?: () => unknown }).toJSONSchema?.();
    if (!full || typeof full !== "object") throw new Error("no-schema");
    const { $schema: _drop, ...rest } = full as Record<string, unknown>;
    return JSON.stringify(rest);
  } catch {
    const params = tool.fields.map((f) => `${f.key}${f.required ? "*" : ""}:${f.type}`).join(", ");
    return `{"params":"${params}"}`;
  }
}

export function toolPrompt(actor: ToolActor) {
  return visibleTools(actor)
    .map((tool) => {
      const schema = toolJsonSchema(tool);
      return `- ${tool.name} — ${tool.title}. args=${schema}. ${tool.description}${
        tool.needsConfirm ? " [TASDIQLASH TALAB QILADI: confirm:true siz bajarilmaydi]" : ""
      }${tool.mutating ? " [O'ZGARTIRUVCHI]" : ""}`;
    })
    .join("\n");
}

export type { Effect, ResourceType, SubjectType };

async function normalizeSubjectValue(scope: SubjectType, raw: string) {
  const value = str(raw, 190);
  if (scope === "user") return (await resolveOneUser(value)).id;
  return value;
}

function parseDate(value: unknown): Date | null {
  const raw = str(value, 30);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Argumentlarni yumshatadi — modelning chegaradan oshgan sonlarini RAD
 * etmaydi, balki chegaraga QISQARTIRIB qayta tekshiradi.
 *
 * Nima uchun: model `limit: 100` so'raganda schema "Too big: <=25" deb
 * butunlay rad etardi va vazifa bajarilmay qolardi — bitta noto'g'ri son
 * uchun foydalanuvchi bo'sh javob olardi. Endi chegara oshilsa ham natija
 * chiqadi: qidiruv 25 ta emas 200 ta, lekin ISHLAYDI.
 *
 * Zod ichki strukturasi (v3/v4 farq qiladi) o'qilmaydi — shuning o'rnash
 * `limit` kamaytirilib turib qayta tekshiriladi. Bu usul har qanday sxema
 * bilan ishlaydi.
 */
function parseArgsLenient(tool: ToolDef, args: Record<string, unknown>) {
  let first = tool.schema.safeParse(args);
  if (first.success) return first;

  const rawLimit = (args as Record<string, unknown>).limit;
  if (typeof rawLimit !== "number" || rawLimit <= 0) return first;

  // Chegaraga yaqinlashib boramiz: har urinishda limitni kamaytiramiz.
  for (const candidate of [100, 50, 25, 10, 5]) {
    if (candidate >= rawLimit) continue;
    const retry = tool.schema.safeParse({ ...args, limit: candidate });
    if (retry.success) return retry;
  }
  return first;
}

/**
 * Vositani bajaradi: validatsiya -> audit -> ijro -> natija.
 * Xato holatida ham auditga yoziladi.
 */
export async function runTool(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return fail(`Bunday vosita yo'q: ${name}`, {
      available: TOOLS.map((t) => t.name),
    });
  }
  if (tool.adminOnly && !ctx.actor.isAdmin && ctx.actor.role !== "grader") {
    await logAudit(ctx, name, "denied", "Admin kerak", rawArgs);
    return fail("Bu amalni faqat admin bajarishi mumkin.");
  }
  if (tool.needsConfirm && (rawArgs as any)?.confirm !== true) {
    return fail(
      `"${tool.title}" — xavfli amal. Avval foydalanuvchidan tasdiqlash so'rang, keyin confirm: true bilan qayta yuboring.`,
      { needsConfirm: true, tool: tool.name },
    );
  }

  // TASDIQ HAQIQIYLIGI (2 shart, ikkalasi ham bo'lishi shart):
  // 1) JORIY user xabari qisqa TASDIQ matni bo'lishi kerak ("ha, yarat",
  //    "tasdiqlayman", "bajar" va h.k. — tugma bosilganda keladi). Uzoq
  //    buyruq ("test yarat...") — tasdiq EMAS, model o'zi confirm:true
  //    qo'ygan bo'ladi (soxta tasdiq).
  // 2) Shu suhbat tarixida bu tool oldin chaqirilgan bo'lishi kerak (demak,
  //    needsConfirm olingan va foydalanuvchiga karta chiqqan).
  // `capability` manbasida conversationId bo'lmaydi — u yerda UI o'zi
  // tasdiqlaydi, shuning uchun tekshiruv faqat chat uchun.
  if (tool.needsConfirm && (rawArgs as any)?.confirm === true && ctx.source === "chat" && ctx.conversationId) {
    const userMsg = String((ctx as { userMessage?: unknown }).userMessage || "");
    const isShortConfirm =
      userMsg.length > 0 &&
      userMsg.length <= 60 &&
      /^(ha|x[ao]|yes|ok|tasdiq|bajar|yarat|o[‘']chir|davom|albatta|roziman|to[‘']g[‘']ri)\b/i.test(userMsg.trim());
    if (!isShortConfirm) {
      return fail(
        `"${tool.title}" — tasdiqsiz bajarib bo'lmaydi. Foydalanuvchiga tasdiq kartasi ko'rsating, u "Ha" ni bossagina confirm: true bilan qayta yuboring.`,
        { needsConfirm: true, tool: tool.name },
      );
    }
    try {
      const asked = await db.aiMessage.findFirst({
        where: {
          conversationId: ctx.conversationId,
          role: "assistant",
          actions: { contains: `"tool":"${name}"` },
        },
        select: { id: true },
      });
      if (!asked) {
        return fail(
          `"${tool.title}" — bu suhbatda tasdiq kartasi chiqmagan. Avval kartani ko'rsating.`,
          { needsConfirm: true, tool: tool.name },
        );
      }
    } catch {
      /* tarix o'qilmasa — ehtiyotkorlik tomonida: tasdiq so'raymiz */
      return fail(
        `"${tool.title}" — tasdiq tarixini tekshirib bo'lmadi. Xavfsizlik uchun tasdiq kartasi ko'rsating.`,
        { needsConfirm: true, tool: tool.name },
      );
    }
  }

  // IDEMPOTENTLIK: o'zgartiruvchi amal bir xil parametrlar bilan so'nggi
  // 5 daqiqada muvaffaqiyatli bajarilgan bo'lsa — takrorlashdan oldin
  // tasdiq so'raladi (ikki marta yaratish/o'chirish oldini olish).
  // `confirm:true` bilan kelgan chaqiruv (foydalanuvchi tasdiqlagan) o'tadi.
  if (tool.mutating && (rawArgs as any)?.confirm !== true) {
    try {
      const argsKey = clip(JSON.stringify(rawArgs ?? {}), 4000);
      const recent = await db.aiAuditLog.findFirst({
        where: {
          actorId: ctx.actor.userId,
          action: name,
          outcome: "ok",
          args: argsKey,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recent) {
        return fail(
          `"${tool.title}" — bu amal shu parametrlar bilan oxirgi 5 daqiqada bajarilgan. Takrorlash uchun tasdiq kerak: confirm: true bilan qayta yuboring.`,
          { needsConfirm: true, tool: tool.name, duplicate: true },
        );
      }
    } catch {
      /* audit o'qilmasa — amalni to'xtatmaymiz */
    }
  }

  const parsed = parseArgsLenient(tool, (rawArgs ?? {}) as Record<string, unknown>);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".") || "argument"}: ${i.message}`)
      .join("; ");
    return fail(`Argumentlar noto'g'ri (${tool.name}): ${issues}`, { tool: tool.name });
  }

  try {
    const result = await tool.execute(parsed.data, ctx);

    // TEKSHIRUV TIZIMI: vosita "muvaffaqiyatli" desa ham, natija bazadan va
    // diskdan QAYTA O'QILADI. Tekshiruv o'tmasa — natija `verified: false`
    // bilan qaytadi va agent uni foydalanuvchiga bermaydi, balki qayta
    // urinishga qaytadi (agent.ts).
    let verified: boolean | undefined;
    let verifyNote = "";
    if (isVerifiedTool(name)) {
      const check = await verifyToolResult(name, parsed.data, ctx, result);
      verified = check.ok;
      verifyNote = check.detail;
    }

    const withVerify: ToolResult = {
      ...result,
      verified,
      verifyNote: verifyNote || undefined,
      // Tekshiruv o'tmagan bo'lsa, foydalanuvchiga "bajarildi" ko'rinishini
      // berMAYmiz — natija muvaffaqiyatsiz deb ko'rsatiladi.
      ok: result.ok && verified !== false,
      summary: result.ok && verified === false ? `${result.summary} — TEKSHIRUV: ${verifyNote}` : result.summary,
    };

    // MARKAZIY AUDIT: har bir bajarilgan chaqiruv (ok + error) bir joyda
    // yoziladi — kim, qachon, qaysi tool, qanday parametr, natija.
    // `execute` ichida alohida logAudit chaqirilmaydi (double-write bo'lmasligi uchun).
    await logAudit(
      ctx,
      name,
      withVerify.ok ? "ok" : "error",
      withVerify.summary,
      parsed.data,
      withVerify.resourceType || "",
      withVerify.resourceId || "",
    );
    return withVerify;
  } catch (err: any) {
    const message = err?.message || "Vosita bajarilmadi";
    await logAudit(ctx, name, "error", message, parsed.data);
    return fail(message);
  }
}

export function estimatePromptTokensFor(toolCount: number) {
  return estimateTokens(toolPrompt({
    userId: "0",
    email: "",
    role: "admin",
    name: "",
    isAdmin: true,
  }).slice(0, toolCount * 200));
}