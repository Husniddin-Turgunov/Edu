// Server-side proxy: tashqi tizim (akela.osnovaedu.uz) dan Tanishtiruv kursi ma'lumotlarini olib keladi.
// Login qilib, token oladi, keyin osnova-get-course-knative endpointga so'rov yuboradi.
// Ma'lumot server-side cache'lanadi (in-memory, 5 daqiqa TTL).

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const OSNOVA_BASE = process.env.OSNOVAEDU_BASE_URL || "https://api.osnovaedu.uz";
const ORG_ID = process.env.OSNOVAEDU_ORG_ID || "74043f29-2b54-4121-a58a-56de17728e6f";
const EMAIL = process.env.OSNOVAEDU_EMAIL || "test@test.com";
const PASSWORD = process.env.OSNOVAEDU_PASSWORD || "test_9561";
const COURSE_ID =
  process.env.OSNOVAEDU_ONBOARDING_COURSE_ID || "7595f23a-dc85-4988-a1f6-a1ba8b7add59";

type CacheEntry = { token: string; expiresAt: number };
let cache: CacheEntry | null = null;
let dataCache: { data: unknown; expiresAt: number } | null = null;
const DATA_TTL_MS = 5 * 60 * 1000; // 5 daqiqa
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 daqiqa (token ~60min, xavfsizlik uchun kamroq)

async function loginAndGetToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now()) return cache.token;

  // 1-qadam: identify
  const idRes = await fetch(`${OSNOVA_BASE}/v1/saas/auth/identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, org_id: ORG_ID }),
    cache: "no-store",
  });
  if (!idRes.ok) {
    const t = await idRes.text();
    throw new Error(`identify failed: ${idRes.status} ${t.substring(0, 200)}`);
  }

  // 2-qadam: login
  const loginRes = await fetch(`${OSNOVA_BASE}/v1/saas/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      selected_role: "student",
      org_id: ORG_ID,
    }),
    cache: "no-store",
  });
  if (!loginRes.ok) {
    const t = await loginRes.text();
    throw new Error(`login failed: ${loginRes.status} ${t.substring(0, 200)}`);
  }
  const loginJson: any = await loginRes.json();
  const token: string | undefined = loginJson?.data?.access_token || loginJson?.access_token;
  if (!token) {
    throw new Error("token not found in login response");
  }
  cache = { token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return token;
}

async function fetchCourseData(): Promise<any> {
  if (dataCache && dataCache.expiresAt > Date.now()) return dataCache.data;

  const token = await loginAndGetToken();

  const res = await fetch(
    `${OSNOVA_BASE}/v2/invoke_function/osnova-get-course-knative`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ data: { course_id: COURSE_ID } }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    // token eskirgan bo'lishi mumkin — yangilab qayta urinib ko'ramiz
    if (res.status === 401 || res.status === 403) {
      cache = null;
      const freshToken = await loginAndGetToken();
      const retry = await fetch(
        `${OSNOVA_BASE}/v2/invoke_function/osnova-get-course-knative`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${freshToken}`,
          },
          body: JSON.stringify({ data: { course_id: COURSE_ID } }),
          cache: "no-store",
        }
      );
      if (!retry.ok) {
        const t = await retry.text();
        throw new Error(`course fetch retry failed: ${retry.status} ${t.substring(0, 200)}`);
      }
      const json = await retry.json();
      dataCache = { data: json, expiresAt: Date.now() + DATA_TTL_MS };
      return json;
    }
    const t = await res.text();
    throw new Error(`course fetch failed: ${res.status} ${t.substring(0, 200)}`);
  }

  const json = await res.json();
  dataCache = { data: json, expiresAt: Date.now() + DATA_TTL_MS };
  return json;
}

// Faqat kerakli maydonlarni qaytarish (frontend uchun yengil)
function normalize(raw: any) {
  const inner = raw?.data?.data?.data ?? raw?.data?.data ?? raw?.data ?? raw;
  if (!inner || typeof inner !== "object") return null;

  const modules = (inner.modules || []).map((m: any) => ({
    guid: m.guid,
    title: m.title,
    sort: m.sort,
    countLessons: m.count_lesson || (m.lessons || []).length,
    lessons: (m.lessons || []).map((l: any) => ({
      guid: l.guid,
      title: (l.title || "").trim(),
      sort: l.sort,
      types: l.types || [],
      isRead: !!l.is_read,
      isClosed: !!l.is_closed,
    })),
  }));

  return {
    guid: inner.guid,
    title: inner.title,
    description: inner.description,
    countModules: inner.count_modules,
    countLessons: inner.count_lessons,
    countStudents: inner.count_students,
    modules,
  };
}

export async function GET() {
  try {
    const raw = await fetchCourseData();
    const normalized = normalize(raw);
    if (!normalized) {
      return NextResponse.json(
        { error: "Invalid data structure from external API" },
        { status: 502 }
      );
    }
    return NextResponse.json({ source: "akela.osnovaedu.uz", course: normalized });
  } catch (e: any) {
    console.error("[akela-onboarding]", e?.message);
    return NextResponse.json(
      { error: e?.message || "unknown error" },
      { status: 502 }
    );
  }
}
