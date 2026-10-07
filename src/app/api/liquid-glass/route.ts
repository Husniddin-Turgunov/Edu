import { NextResponse } from "next/server";
import { getGlassSettings } from "@/lib/liquid-glass-storage";

export const dynamic = "force-dynamic";

// Ommaviy: faqat dizayn parametrlari (maxfiy ma'lumot yo'q)
export async function GET() {
  return NextResponse.json({ ok: true, settings: getGlassSettings() });
}
