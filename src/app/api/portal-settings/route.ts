import { NextResponse } from "next/server";
import { getSettings } from "@/lib/settings-storage";

export const dynamic = "force-dynamic";

// Public, xavfsiz kichik to'plam: login/register sahifalar uchun.
// Hech qanday maxfiy maydon qaytarilmaydi.
export async function GET() {
  const s = getSettings();
  return NextResponse.json({
    ok: true,
    settings: {
      registrationOpen: s.registrationOpen,
      supportContact: s.supportContact,
    },
  });
}
