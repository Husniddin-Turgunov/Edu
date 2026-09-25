import { NextResponse } from "next/server";
import { ensureDb } from "@/db/queries";
import { getSession } from "@/lib/auth";
import { runGlobalSearch } from "@/lib/global-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ hits: [] });
  }
  await ensureDb();
  const hits = await runGlobalSearch(q, 6);
  return NextResponse.json({ hits });
}
