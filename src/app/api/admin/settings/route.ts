import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings-storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, settings: getSettings() });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session?.isAdmin) {
    return NextResponse.json({ ok: false, error: "Ruxsat yo'q" }, { status: 403 });
  }
  try {
    const body = await req.json();
    const settings = saveSettings({
      registrationOpen: body.registrationOpen,
      supportContact: body.supportContact,
    });
    return NextResponse.json({ ok: true, settings });
  } catch {
    return NextResponse.json({ ok: false, error: "Saqlab bo'lmadi" }, { status: 500 });
  }
}
