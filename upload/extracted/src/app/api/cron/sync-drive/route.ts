import { NextResponse } from "next/server";
import { syncTestsFromDrive } from "@/db/sync-drive";
import { ASSESSMENT_TEST_KINDS } from "@/lib/drive-file-kind";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron + manual: GET /api/cron/sync-drive */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const levels: Record<string, unknown> = {};
  for (const kind of ASSESSMENT_TEST_KINDS) {
    levels[kind] = await syncTestsFromDrive(kind);
  }
  const { syncLessonsFromDrive } = await import("@/db/sync-drive-lessons");
  const lessons = await syncLessonsFromDrive();
  const { syncAttestationsFromDrive } = await import(
    "@/db/sync-drive-attestations"
  );
  const attestations = await syncAttestationsFromDrive();
  return NextResponse.json({
    tests: levels,
    lessons,
    attestations,
  });
}
