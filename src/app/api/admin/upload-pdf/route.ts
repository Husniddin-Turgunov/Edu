import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    // Allow admin or authenticated users if needed
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Ruxsat berilmagan (Admin kerak)" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string || "";
    const moduleName = formData.get("module") as string || "";

    if (!file) {
      return NextResponse.json({ ok: false, error: "Fayl tanlanmadi" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads", "pdf");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Clean filename
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const fileName = `${timestamp}_${safeName}`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/uploads/pdf/${fileName}`;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      fileName: file.name,
      size: file.size,
      title: title || file.name.replace(/\.[^/.]+$/, ""),
      module: moduleName,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("PDF upload error:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Fayl yuklashda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
