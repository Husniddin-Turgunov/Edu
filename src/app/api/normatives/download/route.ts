import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Normativ faylni YUKLAB OLISH.
 *
 * Vercel Blob boshqa domen'da saqlanadi, shuning uchun brauzerdagi
 * `download` atributi ishlamaydi. Shu sababli fayl server orqali o'tkazib,
 * `Content-Disposition: attachment` bilan qaytariladi.
 */

// Faqat Vercel Blob manzillariga ruxsat (SSRF himoyasi)
function isAllowedBlobUrl(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    return /(^|\.)public\.blob\.vercel-storage\.com$/.test(u.hostname) || /(^|\.)blob\.vercel-storage\.com$/.test(u.hostname);
  } catch {
    return false;
  }
}

function safeFileName(name: string) {
  const base = (name || "normativ-hujjat").split("/").pop() || "normativ-hujjat";
  return base.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "normativ-hujjat";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url).searchParams.get("url") || "";
    const name = new URL(req.url).searchParams.get("name") || "";
    if (!url || !isAllowedBlobUrl(url)) {
      return NextResponse.json({ error: "Noto'g'ri fayl manzili" }, { status: 400 });
    }

    const upstream = await fetch(url, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Faylni yuklab bo'lmadi" }, { status: 502 });
    }

    const filename = safeFileName(name || decodeURIComponent(new URL(url).pathname.split("/").pop() || ""));
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": upstream.headers.get("content-length") || "",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e: any) {
    console.error("GET /api/normatives/download error:", e?.message || e);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
