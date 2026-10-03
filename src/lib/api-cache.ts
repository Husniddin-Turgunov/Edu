// Server tomondagi qisqa muddatli JSON kesh.
//
// MUAMMO: admin endpoint'lari uzoq MySQL (VPS) ga ulanadi — bitta so'rov
// 0.3-3 s. Bo'limdan bo'limga o'tganda har bir sahifa o'z ma'lumotini
// qaytadan so'raydi va "alohida yuklash" taassuroti qoladi.
//
// YECHIM: modul darajasidagi kesh. Bir nechta route fayli bo'lgani uchun
// registry umumiy modulda turadi — mutation qilgan har qanday route keshni
// tozalay oladi (apiCacheClear).
//
// TTL qisqa (10 s): foydalanuvchi tez-tez o'tsa ma'lumot keshdan olinadi,
// o'zgartirishdan keyin eng ko'pi bilan 10 s ichida yangilanadi.

type Entry = { at: number; data: unknown };

const store = new Map<string, Entry>();

export const API_CACHE_TTL_MS = 10_000;

export function apiCacheGet<T>(key: string, ttl: number = API_CACHE_TTL_MS): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at >= ttl) {
    store.delete(key);
    return undefined;
  }
  return hit.data as T;
}

export function apiCacheSet(key: string, data: unknown): void {
  store.set(key, { at: Date.now(), data });
}

export function apiCacheClear(key?: string): void {
  if (!key) {
    store.clear();
    return;
  }
  store.delete(key);
}

// Ishlatiladigan kalitlar
export const CACHE_KEYS = {
  adminOnboarding: "admin:onboarding",
  adminTests: "admin:tests",
} as const;
