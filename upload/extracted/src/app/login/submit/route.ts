import { NextResponse } from "next/server";
import { completeLogin } from "@/lib/login";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicOrigin(request: Request) {
  const forwarded = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const host = (forwarded || hostHeader || "localhost:3000")
    .split(",")[0]
    .trim();
  const isLocal =
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1") ||
    host.endsWith(".local") ||
    /:(3000|3001|8080)$/.test(host);

  // Local development must never bounce to the public edu domain.
  if (isLocal) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "http";
    return `${proto}://${host}`;
  }

  // Shared hosting sometimes exposes an internal host — map to public edu.
  if (!host || host.includes("web3.webspace.uz")) {
    return "https://edu.akelagroup.uz";
  }
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() || "https";
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await completeLogin(formData);
  const origin = publicOrigin(request);
  if (!result.ok) {
    return NextResponse.redirect(`${origin}/login?error=${result.error}`, 303);
  }
  return NextResponse.redirect(`${origin}${result.nextPath}`, 303);
}
