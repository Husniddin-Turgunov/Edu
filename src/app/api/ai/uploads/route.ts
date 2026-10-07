import fs from "fs/promises";
import path from "path";
import { requireAiActor, failResponse } from "@/lib/ai/guard";
import { extractText, SUPPORTED_EXTENSIONS } from "@/lib/ai/documents";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 600_000;
const UPLOAD_DIR = path.join(process.cwd(), "upload", "ai");

/**
 * POST /api/ai/uploads вЂ” manba fayl yuklash va matnini chiqarish.
 * Chiqarilgan matn `AiAttachment.jadvalida saqlanadi: test generatsiyasi shu
 * yerdan o'qiydi, ya'ni "tashlangan fayl asosida test" talabi bajariladi.
 *
 * GET    вЂ” yuklangan fayllar ro'yxati
 * DELETE вЂ” faylni o'chirish (?id=...)
 */
export async function POST(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;
  const actor = guard.actor;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return failResponse("Fayl formati noto'g'ri (multipart/form_data kutilgan)");
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const single = form.get("file");
  const all = files.length > 0 ? files : single instanceof File ? [single] : [];

  if (all.length === 0) return failResponse("Fayl tanlanmagan");
  if (all.length > 12) return failResponse("Bir so'rovda ko'pi bilan 12 ta fayl");

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const saved: unknown[] = [];
  const failed: { name: string; error: string }[] = [];

  for (const file of all) {
    const fileName = sanitizeName(file.name);
    try {
      if (file.size > MAX_FILE_BYTES) {
        throw new Error(`Fayl ${Math.round(file.size / 1024 / 1024)} MB вЂ” limit ${MAX_FILE_BYTES / 1024 / 1024} MB`);
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const extracted = await extractText(fileName, buffer);

      if (!extracted.text.trim()) {
        throw new Error(
          extracted.warning || "Fayldan matn topilmadi. Skanlangan (rasm) PDF yoki bo'sh fayl bo'lishi mumkin.",
        );
      }

      const text = extracted.text.slice(0, MAX_TEXT_CHARS);
      const safeBase = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${fileName}`;
      const storagePath = path.join(UPLOAD_DIR, safeBase);
      await fs.writeFile(storagePath, buffer);

      const record = await db.aiAttachment.create({
        data: {
          ownerId: actor.userId,
          fileName,
          mimeType: file.type || "",
          size: file.size,
          storagePath,
          extractedText: text,
          charCount: text.length,
          wordCount: extracted.wordCount,
          pageCount: extracted.pageCount,
          parser: extracted.parser,
          status: "ready",
        },
        select: {
          id: true,
          fileName: true,
          size: true,
          charCount: true,
          wordCount: true,
          pageCount: true,
          parser: true,
          status: true,
          createdAt: true,
        },
      });

      saved.push({ ...record, createdAt: record.createdAt.toISOString(), warning: extracted.warning });
    } catch (err: any) {
      failed.push({ name: file.name, error: err?.message || "Noma'lum xato" });
    }
  }

  if (saved.length === 0) {
    return failResponse(
      failed[0]?.error || "Faylni o'qib bo'lmadi",
      400,
      { failed, supported: SUPPORTED_EXTENSIONS },
    );
  }

  return Response.json({ ok: true, attachments: saved, failed });
}

export async function GET(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const rows = await db.aiAttachment.findMany({
    where: { ownerId: guard.actor.userId },
    select: {
      id: true,
      fileName: true,
      size: true,
      charCount: true,
      wordCount: true,
      pageCount: true,
      parser: true,
      status: true,
      error: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return Response.json({
    ok: true,
    attachments: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
}

export async function DELETE(req: Request) {
  const guard = await requireAiActor();
  if (!guard.ok) return guard.response;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return failResponse("id kerak");

  const row = await db.aiAttachment.findFirst({ where: { id, ownerId: guard.actor.userId } });
  if (!row) return failResponse("Fayl topilmadi", 404);

  try {
    if (row.storagePath && row.storagePath.startsWith(UPLOAD_DIR)) {
      await fs.rm(row.storagePath, { force: true });
    }
  } catch {
    /* fayl diskda yo'q bo'lsa ham bazani tozalaymiz */
  }

  await db.aiAttachment.delete({ where: { id } });
  return Response.json({ ok: true, id });
}

function sanitizeName(name: string) {
  const base = String(name || "fayl")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\.{2,}/g, ".")
    .slice(0, 180);
  return base || "fayl";
}