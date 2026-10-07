import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { handleUpload } from "@vercel/blob/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/upload-video — Vercel Blob'ga TO'G'RI yuklash nuqtasi.
 *
 * NIMA UCHUN O'ZGARTIRILDI (avvalgi nusxa ishlamasdi):
 *
 *  1) `await req.formData()` — Vercel serverless funksiya tanasi ~4.5 MB bilan
 *     cheklangan. Video 100% ga yuklangandan KEYIN server rad qilardi:
 *     "load to'liq bo'ldi, oxirida error".
 *  2) `fs.writeFileSync(process.cwd() + "/public/...")` — Vercel'da filesystem
 *     FAQAT O'QILADI (yo'ziladigan joy — faqat `/tmp`) → `EROFS`.
 *  3) `public/` ichiga yozilgan fayl Vercel'da umumiyatda BERILMAYDI.
 *
 * YECHIM: fayl Vercel Blob'ga to'g'ridan-to'g'ri yuklanadi. Klient
 * `@vercel/blob/client` dagi `upload()` ni chaqiradi, Blob xavfsizlik uchun
 * shu route'ga (handleUploadUrl) kelib token so'raydi. Fayl app serveriga
 * UMUMAN tegilmaydi — demak 4.5 MB limiti ham qo'llanilmaydi.
 */

const ALLOWED_EXT = ["mp4", "webm", "ogv", "ogg", "mov", "m3u8"];
const ALLOWED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "application/vnd.apple.mpegurl",
  "application/x-mpegurl",
];
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ ok: false, error: "Ruxsat berilmagan (Admin kerak)" }, { status: 401 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Video yuklash sozlanmagan: BLOB_READ_WRITE_TOKEN yo'q. Vercel → Settings → Environment Variables → BLOB_READ_WRITE_TOKEN qo'ying.",
        },
        { status: 501 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "So'rov tanasi bo'sh" }, { status: 400 });
    }

    const result = await handleUpload({
      token,
      request: req,
      body: body as any,
      async onBeforeGenerateToken(pathname, clientPayload, multipart) {
        const ext = (pathname.split(".").pop() || "").toLowerCase();
        if (!ALLOWED_EXT.includes(ext)) {
          throw new Error("Video formati emas (mp4/webm/mov/ogv/m3u8)");
        }
        // Multipart — katta fayllar uchun (parchalar bo'lib, qayta uriladi).
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
          allowOverwrite: false,
          multipart,
          tokenPayload: clientPayload ?? null,
        } as any;
      },
    });

    return NextResponse.json(result as any);
  } catch (e: any) {
    console.error("Video upload error:", e);
    return NextResponse.json({ ok: false, error: e?.message || "Yuklashda xatolik" }, { status: 500 });
  }
}