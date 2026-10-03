/**
 * lib/ai/verify.ts
 *
 * TEKSHIRISH TIZIMI: agent ishini bajarishdan keyin UNI QAYTA O'QIYDI.
 *
 * Nima uchun kerak: vosita "muvaffaqiyatli" qaytsa ham, natija real bo'lishi
 * shart — fayl diskda bo'lishi, test savollari bilan, xodim holati yangilangan
 * bo'lishi kerak. Aks holda model "qildim" deb yozib, hech narsa qolmasdi.
 *
 * Qoida: tekshiruv PASS bo'lmasa natija foydalanuvchiga BERILMAYDI. Agent
 * (agent.ts) shunda qayta urinishga qaytadi va faqat hamma narsa tekshirilgach
 * yakuniy javobni chiqaradi.
 */

import { stat } from "node:fs/promises";
import nodePath from "node:path";
import { db } from "@/lib/db";
import type { ToolContext, ToolResult } from "./tools";

export type VerifyResult = { ok: boolean; detail: string };

type VerifyFn = (
  args: Record<string, unknown>,
  ctx: ToolContext,
  result: ToolResult,
) => Promise<VerifyResult>;

const data = (result: ToolResult) => (result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {});
const asId = (v: unknown) => (typeof v === "string" && v.length >= 3 ? v : "");

/** Fayl diskda borligi va bo'sh emasligi tekshiriladi. */
async function fileOnDisk(storagePath: string) {
  const abs = nodePath.join(process.cwd(), storagePath);
  const allowed = nodePath.join(process.cwd(), "upload", "ai-files");
  if (!nodePath.resolve(abs).startsWith(nodePath.resolve(allowed))) return { ok: false, detail: "Fayl yo'li xavfsizlik chegarasidan tashqarida" };
  try {
    const info = await stat(abs);
    return info.isFile() && info.size > 0
      ? { ok: true as const, detail: `${info.size} bayt diskda` }
      : { ok: false, detail: "Fayl diskda bo'sh yoki yo'q" };
  } catch {
    return { ok: false, detail: "Fayl diskda topilmadi" };
  }
}

/** doc.* / doc.recreate: bazadagi yozuv + haqiqiy fayl + spec. */
const verifyDoc: VerifyFn = async (_args, _ctx, result) => {
  const fileId = asId(data(result).fileId);
  if (!fileId) return { ok: false, detail: "Fayl ID qaytarilmadi" };
  const row: any = await db.aiFile.findUnique({ where: { id: fileId } });
  if (!row) return { ok: false, detail: "Bazada fayl yozuvi yo'q" };
  const disk = await fileOnDisk(row.storagePath);
  if (!disk.ok) return { ok: false, detail: `Bazada bor, lekin ${disk.detail}` };
  return { ok: true, detail: `${row.fileName} — tekshirildi (${disk.detail})` };
};

/**
 * Artifact: bazadagi yozuv bor, HTML haqiqatan ichida grafik yoki matn bor
 * va **xavfsiz** — `<script>` hamda `on*` atributlari qolmagan bo'lishi SHART.
 * Aks holda panel skriptsiz sandbox'da bo'sh sahifa ko'rsatib turib, foydalanuvchi
 * "ishlamadi" deydi.
 */
const verifyArtifact: VerifyFn = async (_args, _ctx, result) => {
  const id = asId(data(result).artifactId);
  if (!id) return { ok: false, detail: "artifactId qaytarilmadi" };
  const row: any = await db.aiArtifact.findUnique({ where: { id } });
  if (!row) return { ok: false, detail: "Bazada artifact yozuvi yo'q" };
  const html = String(row.html || "");
  if (html.length < 400) return { ok: false, detail: `HTML juda qisqa (${html.length} belgi)` };
  if (/<script\b|javascript:|\son\w+\s*=/i.test(html)) {
    return { ok: false, detail: "HTML xavfsiz emas: script/on* atributi topildi" };
  }
  return { ok: true, detail: `${(html.length / 1024).toFixed(1)} KB HTML, xavfsiz` };
};

/**
 * Rasm: bazadagi yozuv + diskdagi fayl + **belgilar** (magic bytes).
 *
 * Nega belgilar tekshiriladi: provayder `{"image_url": {...}}` desak, biz
 * PNG/JPEG/WebP dan tashqari narsa (masalan JSON xato sahifasi) ham qaytishi
 * mumkin. Chatda "rasm tayyor" deb ko'rsatilib, brauzerda esa buzilgan rasm
 * chiqmasligi uchun fayzodiy tur ham tekshiriladi.
 */
const verifyImage: VerifyFn = async (_args, _ctx, result) => {
  const fileId = asId(data(result).fileId);
  if (!fileId) return { ok: false, detail: "fileId qaytarilmadi" };
  const row: any = await db.aiFile.findUnique({ where: { id: fileId } });
  if (!row) return { ok: false, detail: "Bazada rasm yozuvi yo'q" };
  if (!String(row.mimeType || "").startsWith("image/")) {
    return { ok: false, detail: `MIME turi rasm emas: ${row.mimeType || "yo'q"}` };
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const nodePath = await import("node:path");
    const abs = nodePath.join(process.cwd(), row.storagePath);
    const allowed = nodePath.join(process.cwd(), "upload", "ai-files");
    if (!nodePath.resolve(abs).startsWith(nodePath.resolve(allowed))) {
      return { ok: false, detail: "Fayl yo'li xavfsizlik chegarasidan tashqarida" };
    }
    const buf = await readFile(abs);
    const { detectImageType } = await import("./image");
    const type = detectImageType(buf);
    if (!type) return { ok: false, detail: "Fayzodiy belgilar rasmni ko'rsatmaydi" };
    if (buf.length < 3_000) return { ok: false, detail: `Rasm juda kichik (${buf.length} bayt)` };
    return { ok: true, detail: `${row.fileName} — ${type.mime}, ${(buf.length / 1024).toFixed(1)} KB` };
  } catch (err: any) {
    return { ok: false, detail: `Faylni o'qib bo'lmadi: ${err?.message || err}` };
  }
};

const VERIFIERS: Record<string, VerifyFn> = {
  "doc.excel": verifyDoc,
  "doc.word": verifyDoc,
  "doc.pdf": verifyDoc,
  "doc.recreate": verifyDoc,

  "test.create": async (_a, _c, result) => {
    const id = asId(data(result).testId);
    if (!id) return { ok: false, detail: "testId qaytarilmadi" };
    const row = await db.test.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
    return row ? { ok: true, detail: `«${row.title}» bazada (${row.status})` } : { ok: false, detail: "Test bazada yo'q" };
  },

  "test.applyDraft": async (_a, _c, result) => {
    const id = asId(data(result).testId);
    if (!id) return { ok: false, detail: "testId qaytarilmadi" };
    const row = await db.test.findUnique({ where: { id }, select: { id: true, title: true } });
    if (!row) return { ok: false, detail: "Test bazada yo'q" };
    const questions = await db.question.count({ where: { testId: id } });
    if (questions === 0) return { ok: false, detail: "Test yaratildi, lekin savollar yozilmadi" };
    return { ok: true, detail: `«${row.title}» — ${questions} ta savol bazada` };
  },

  "test.update": async (args, _c, result) => {
    const id = asId(data(result).testId);
    if (!id) return { ok: false, detail: "testId qaytarilmadi" };
    const row: any = await db.test.findUnique({ where: { id } });
    if (!row) return { ok: false, detail: "Test bazada yo'q" };
    const changes = (data(result).changes || {}) as Record<string, unknown>;
    const mismatched = Object.entries(changes).filter(([k, v]) => row[k] !== v);
    if (mismatched.length) return { ok: false, detail: `Maydonlar mos emas: ${mismatched.map(([k]) => k).join(", ")}` };
    void args;
    return { ok: true, detail: `${Object.keys(changes).length} ta maydon bazada tasdiqlandi` };
  },

  "test.setStatus": async (_a, _c, result) => {
    const id = asId(data(result).testId);
    if (!id) return { ok: false, detail: "testId qaytarilmadi" };
    const row = await db.test.findUnique({ where: { id }, select: { status: true } });
    return row && row.status === data(result).status
      ? { ok: true, detail: `holat bazada: ${row.status}` }
      : { ok: false, detail: "Test holati bazada mos emas" };
  },

  "test.delete": async (_a, _c, result) => {
    const id = asId(data(result).deletedId);
    if (!id) return { ok: false, detail: "deletedId qaytarilmadi" };
    const left = await db.test.count({ where: { id } });
    return left === 0 ? { ok: true, detail: "Test bazadan butunlay o'chgan" } : { ok: false, detail: "Test hali ham bazada bor" };
  },

  "test.assign": async (_a, _c, result) => {
    const id = asId(data(result).testId);
    if (!id) return { ok: false, detail: "testId qaytarilmadi" };
    const row: any = await db.test.findUnique({ where: { id }, select: { visibility: true, assignedUserIds: true } });
    if (!row) return { ok: false, detail: "Test bazada yo'q" };
    return { ok: true, detail: `ko'rinish bazada: ${row.visibility}` };
  },

  "user.setStatus": async (args, _c, result) => {
    const id = asId(data(result).userId);
    if (!id) return { ok: false, detail: "userId qaytarilmadi" };
    const row: any = await db.user.findUnique({ where: { id }, select: { status: true, isActive: true, role: true } });
    if (!row) return { ok: false, detail: "Foydalanuvchi bazada yo'q" };
    if (typeof args.status === "string" && row.status !== args.status) return { ok: false, detail: "Holat bazada yangilanmagan" };
    if (typeof args.isActive === "boolean" && row.isActive !== args.isActive) return { ok: false, detail: "Ish holati bazada yangilanmagan" };
    if (typeof args.role === "string" && row.role !== args.role) return { ok: false, detail: "Rol bazada yangilanmagan" };
    return { ok: true, detail: `bazada: ${row.status}, faol=${row.isActive}, rol=${row.role}` };
  },

  "lesson.setStatus": async (args, _c, result) => {
    const id = asId(data(result).lessonId);
    if (!id) return { ok: false, detail: "lessonId qaytarilmadi" };
    const row: any = await db.lesson.findUnique({ where: { id }, select: { status: true, isClosed: true } });
    if (!row) return { ok: false, detail: "Dars bazada yo'q" };
    if (typeof args.status === "string" && row.status !== args.status) return { ok: false, detail: "Dars holati bazada mos emas" };
    return { ok: true, detail: `bazada: ${row.status}` };
  },

  "lesson.setVisibility": async (args, _c, result) => {
    const id = asId(data(result).lessonId);
    if (!id) return { ok: false, detail: "lessonId qaytarilmadi" };
    const lesson = await db.lesson.findUnique({ where: { id }, select: { id: true } });
    if (!lesson) return { ok: false, detail: "Dars bazada yo'q" };
    const rules = await db.accessRule.count({ where: { resourceType: "lesson", resourceId: id } });
    if (args.effect === "deny" && rules === 0) return { ok: false, detail: "Yashirish qoidasi bazada yozilmadi" };
    return { ok: true, detail: `${rules} ta ko'rinish qoidasi bazada` };
  },

  "course.enroll": async (_a, _c, result) => {
    const courseId = asId(data(result).courseId);
    const userId = asId(data(result).userId);
    if (!courseId || !userId) return { ok: false, detail: "courseId/userId qaytarilmadi" };
    const row = await db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
    return row ? { ok: true, detail: "biriktirish bazada" } : { ok: false, detail: "Kursga biriktirish bazada yo'q" };
  },

  "job.enroll": async (_a, _c, result) => {
    const jobId = asId(data(result).jobId);
    const userId = asId(data(result).userId);
    if (!jobId || !userId) return { ok: false, detail: "jobId/userId qaytarilmadi" };
    const rows = await db.jobEnrollment.findMany({ where: { userId, jobId } });
    return rows.length ? { ok: true, detail: "kasbiy kursga biriktirilgan" } : { ok: false, detail: "Biriktirish bazada yo'q" };
  },

  "course.unenroll": async (_a, _c, result) => {
    if (Number(data(result).removed) > 0) return { ok: true, detail: "kursdan olib tashlandi" };
    return { ok: false, detail: "Kursdan olib tashlanmagan (bazada yozuv topilmadi)" };
  },

  "draft.reject": async (_a, _c, result) => {
    const id = asId(data(result).draftId);
    if (!id) return { ok: false, detail: "draftId qaytarilmadi" };
    const row = await db.aiDraft.findUnique({ where: { id }, select: { status: true } });
    return row?.status === "rejected" ? { ok: true, detail: "qoralama rad etilgan" } : { ok: false, detail: "Qoralama holati bazada mos emas" };
  },

  "access.rule.remove": async (_a, _c, result) => {
    const removed = Number(data(result).removed);
    const ruleId = asId(data(result).ruleId);
    if (ruleId) {
      const row = await db.accessRule.findUnique({ where: { id: ruleId }, select: { id: true } });
      return row ? { ok: false, detail: "Qoida hali ham bazada bor" } : { ok: true, detail: "qoida bazadan o'chgan" };
    }
    return removed > 0 ? { ok: true, detail: `${removed} ta qoida olib tashlandi` } : { ok: false, detail: "O'chirilgan qoida topilmadi" };
  },

  "notify.broadcast": async (_a, _c, result) => {
    const sent = Number(data(result).sent ?? 0);
    return sent > 0 ? { ok: true, detail: `${sent} ta xabar yuborildi` } : { ok: false, detail: "Hech kimga xabar yuborilmadi" };
  },

  "artifact.dashboard": verifyArtifact,
  "artifact.code": verifyArtifact,
  "image.generate": verifyImage,
};

/**
 * Vosita natijasini tekshiradi.
 *
 * Ro'yxatda yo'q vosita uchun `ok: true` — tekshirilmaydigan amallar model
 * ishonchi va audit iziga tayanadi. Ro'yxatdagi vositalar esa MAJBURIY
 * tekshiriladi: ular fayldan, bazadan va diskdan qayta o'qiladi.
 */
export async function verifyToolResult(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
  result: ToolResult,
): Promise<VerifyResult> {
  const verifier = VERIFIERS[name];
  if (!verifier) return { ok: true, detail: "" };
  if (!result.ok) return { ok: false, detail: result.summary };
  try {
    return await verifier(args || {}, ctx, result);
  } catch (err: any) {
    return { ok: false, detail: `Tekshiruvni bajarib bo'lmadi: ${err?.message || err}` };
  }
}

export function isVerifiedTool(name: string) {
  return Object.prototype.hasOwnProperty.call(VERIFIERS, name);
}