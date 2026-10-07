import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { put } from "@vercel/blob";

export const dynamic = "force-dynamic";

// POST — normativ fayl (PDF/Excel/Word) yuklash
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.isAdmin) {
      return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Fayl tanlanmagan" }, { status: 400 });
    }

    // Ruxsat etilgan formatlar
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Faqat PDF, Excel yoki Word fayl yuklash mumkin" }, { status: 400 });
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Fayl hajmi 10MB dan oshmasligi kerak" }, { status: 400 });
    }

    // Vercel Blob Storage ga yuklash
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const blob = await put(`normatives/${filename}`, file, {
      access: "public",
    });

    return NextResponse.json({ ok: true, url: blob.url, filename });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server xatosi" }, { status: 500 });
  }
}
