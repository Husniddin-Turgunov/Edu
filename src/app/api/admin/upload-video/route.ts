import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB
const ALLOWED = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "application/vnd.apple.mpegurl", "application/x-mpegurl"];

// POST /api/admin/upload-video — kompyuterdan video yuklash (FormData: file)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ ok: false, error: "Ruxsat berilmagan (Admin kerak)" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: "Fayl tanlanmadi" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: "Fayl juda katta (maks 500 MB)" }, { status: 400 });
    }
    const mime = file.type || "";
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    const okMime = ALLOWED.includes(mime) || ["mp4", "webm", "ogv", "ogg", "mov", "m3u8"].includes(ext);
    if (!okMime) {
      return NextResponse.json({ ok: false, error: "Video formati emas (mp4/webm/mov/m3u8)" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "videos");
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const fileName = `${Date.now()}_${safeName}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), buffer);

    return NextResponse.json({
      ok: true,
      url: `/uploads/videos/${fileName}`,
      fileName: file.name,
      size: file.size,
      sizeLabel: file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`,
      mime,
    });
  } catch (e: any) {
    console.error("Video upload error:", e);
    return NextResponse.json({ ok: false, error: e.message || "Yuklashda xatolik" }, { status: 500 });
  }
}
