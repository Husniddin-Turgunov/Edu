import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isLocalStorageConfigured, writeLocalFile } from "@/lib/local-storage";
import { MAX_MEDIA_BYTES } from "@/lib/role-home";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return uploadToLocalDisk(request);
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return uploadToBlob(request);
  }

  return NextResponse.json(
    {
      error:
        "Хранилище не настроено. Задайте LOCAL_STORAGE_ROOT или BLOB_READ_WRITE_TOKEN.",
    },
    { status: 503 },
  );
}

async function uploadToLocalDisk(request: Request): Promise<NextResponse> {
  if (!(await isLocalStorageConfigured())) {
    return NextResponse.json(
      { error: "Локальное хранилище не настроено (LOCAL_STORAGE_ROOT)." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  const pageKey = String(form.get("pageKey") ?? "page").trim() || "page";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (file.size > MAX_MEDIA_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await writeLocalFile({
    subdir: `design/${pageKey}`,
    fileName: file.name,
    buffer,
    randomSuffix: true,
  });

  return NextResponse.json({
    url: saved.url,
    pathname: saved.relativePath,
  });
}

async function uploadToBlob(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const current = await getSession();
        if (!current || current.role !== "admin") {
          throw new Error("Unauthorized");
        }
        if (!pathname.startsWith("design/")) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: [...ALLOWED_TYPES],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_MEDIA_BYTES,
        };
      },
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 },
    );
  }
}
