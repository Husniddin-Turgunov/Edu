import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lmsStorage } from "@/lib/lms-storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const folders = await lmsStorage.getAllFolders(session.userId);
    return NextResponse.json({ ok: true, folders });
  } catch (error) {
    console.error("GET /api/admin/folders error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch folders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();
    const { name, color } = body;
    if (!name) {
      return NextResponse.json({ ok: false, error: "Folder name is required" }, { status: 400 });
    }
    const folder = await lmsStorage.createFolder({ name, color, authorId: session.userId });
    return NextResponse.json({ ok: true, folder });
  } catch (error) {
    console.error("POST /api/admin/folders error:", error);
    return NextResponse.json({ ok: false, error: "Failed to create folder" }, { status: 500 });
  }
}
