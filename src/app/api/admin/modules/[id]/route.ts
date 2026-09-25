import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const body = await req.json();
    const mod = await lmsStorage.updateModule(id, body);
    return NextResponse.json({ ok: true, module: mod });
  } catch (error) {
    console.error("PATCH /api/admin/modules/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to update module" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await lmsStorage.deleteModule(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/admin/modules/[id] error:", error);
    return NextResponse.json({ ok: false, error: "Failed to delete module" }, { status: 500 });
  }
}
