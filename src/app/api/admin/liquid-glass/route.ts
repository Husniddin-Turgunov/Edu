import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getGlassSettings, saveGlassSettings } from "@/lib/liquid-glass-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
  return NextResponse.json({ ok: true, settings: getGlassSettings() });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
  try {
    const body = await req.json();
    return NextResponse.json({ ok: true, settings: saveGlassSettings(body?.settings ?? body) });
  } catch {
    return NextResponse.json({ ok: false, error: "Saqlab bo'lmadi (server fayl tizimi yozishga ruxsat bermasligi mumkin)" }, { status: 500 });
  }
}
