import { NextResponse } from "next/server";
import path from "node:path";
import { getStorageRoot, readLocalRelativePath } from "@/lib/local-storage";

export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".pdf": "application/pdf",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xls": "application/vnd.ms-excel",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".doc": "application/msword",
};

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { path: segments } = await context.params;
  const relativePath = segments.map(decodeURIComponent).join("/");
  if (!relativePath || relativePath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const root = await getStorageRoot();
  if (!root) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 503 });
  }

  try {
    const buffer = await readLocalRelativePath(relativePath);
    const ext = path.extname(relativePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
