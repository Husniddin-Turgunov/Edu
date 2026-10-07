/**
 * Client-side fetch helper — har doim yangilangan ma'lumot oladi.
 *
 * Muammo: ba'zi sahifalarda GET fetch'lar brauzer/Next keshi tufayli
 * eski javob qaytarardi — DELETE/PATCH'dan keyin UI yangilanmasdi.
 * `api()` har doim `cache: "no-store"` bilan so'raydi va xatoni bir xil
 * formatda qaytaradi.
 */
export type ApiResult<T = any> = { ok: true; data: T } | { ok: false; error: string; status: number };

export async function api<T = any>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { cache: "no-store", ...(init || {}) });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || (data && data.ok === false)) {
      return { ok: false, error: (data && (data.error || data.message)) || `So'rov xatosi (${res.status})`, status: res.status };
    }
    return { ok: true, data: data ?? ({} as T) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tarmoq xatosi", status: 0 };
  }
}

export function jsonBody(body: unknown): { headers: Record<string, string>; body: string } {
  return { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}
