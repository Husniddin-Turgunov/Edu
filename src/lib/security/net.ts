/**
 * lib/security/net.ts — SSRF HIMOSI (markaziy).
 *
 * QOIDA: foydalanuvchi kiritgan HAR QANDAY URL faqat shu modul orqali
 * chaqiriladi. Xavfsizlik darajalari:
 *   1) FAQAT http/https (file:, ftp:, gopher:, data: — rad etiladi)
 *   2) Port chegarasi (80, 443, 8080, 8443, 3000, 4430)
 *   3) DNS resolution + har bir IP tekshiruvi:
 *      private (10/8, 172.16/12, 192.168/16, 127/8, 0/8, 169.254/16,
 *      100.64/10), loopback, link-local, multicast, reserved; IPv6
 *      loopback/link-local/ULA/mapped — HAMMASI BLOCK
 *      (cloud metadata 169.254.169.254 ham).
 *   4) DNS rebinding himoyasi: HTTP so'rovi AYNAN oldindan tekshirilgan
 *      IP'larga pin qilinadi (custom `lookup`), TLS SNI esa asl hostname
 *      bo'lib qoladi — sertifikat to'g'ri tekshiriladi.
 *   5) Redirect'lar HAR BOSQICHTA qayta tekshiriladi (yangi DNS + IP check).
 *   6) Javob hajmi chegaralanadi (maxBytes) — oqimli o'qish.
 *   7) Umumiy timeout (ulanish + o'qish).
 *
 * Chaqiruvchi `SsrfError` oladi va uni foydalanuvchiga xato sifatida
 * qaytaradi (URL o'zi xato ichida ko'rsatilmaydi — portskan uchun).
 */

import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";

export class SsrfError extends Error {
  readonly kind: "scheme" | "host" | "dns" | "private-ip" | "port" | "redirect" | "size" | "timeout" | "http";
  constructor(kind: SsrfError["kind"], message: string) {
    super(message);
    this.name = "SsrfError";
    this.kind = kind;
  }
}

/** Ruxsat etilgan portlar (standart veb-portlar). */
const ALLOWED_PORTS = new Set([80, 443, 8080, 8443, 4430, 3000]);

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}

/** IPv4 manfiy/sirli tarmoqlar. */
function isPrivateV4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // noto'g'ri formatni ham xavfli deb bilamiz
  const ranges: Array<[number, number]> = [
    [0x00000000, 0xff000000], // 0.0.0.0/8
    [0x0a000000, 0xff000000], // 10.0.0.0/8
    [0x64400000, 0xffc00000], // 100.64.0.0/10 (CGNAT)
    [0x7f000000, 0xff000000], // 127.0.0.0/8
    [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 (link-local / cloud metadata)
    [0xac100000, 0xfff00000], // 172.16.0.0/12
    [0xc0a80000, 0xffff0000], // 192.168.0.0/16
    [0xe0000000, 0xf0000000], // 224.0.0.0/4 multicast
    [0xf0000000, 0xf0000000], // 240.0.0.0/4 reserved
  ];
  return ranges.some(([base, mask]) => (n & mask) === base);
}

/** IPv6 manfiy tarmoqlar. */
function isPrivateV6(ip: string): boolean {
  const norm = ip.toLowerCase().split("%")[0];
  if (norm === "::" || norm === "::1") return true;
  if (/^fe[89ab]/.test(norm)) return true; // fe80::/10
  if (norm.startsWith("fc") || norm.startsWith("fd")) return true; // fc00::/7
  if (norm.startsWith("ff")) return true; // multicast
  const m = norm.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (m) return isPrivateV4(m[1]);
  if (norm.startsWith("64:ff9b:")) return true; // NAT64
  return false;
}

/** IP public (xavfsiz) mi? */
export function isPublicIp(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return !isPrivateV4(ip);
  if (family === 6) return !isPrivateV6(ip);
  return false;
}

export type UrlVerdict = { ok: true; url: URL; addresses: string[] } | { ok: false; error: SsrfError };

/**
 * URL'ni to'liq tekshiradi (DNS bilan) — port, sxema, IP tekshiruvi.
 */
export async function checkUrl(rawUrl: string, opts: { allowPorts?: Set<number> } = {}): Promise<UrlVerdict> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: new SsrfError("host", "URL noto'g'ri formatda") };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: new SsrfError("scheme", "Faqat http/https ruxsat etilgan") };
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host) return { ok: false, error: new SsrfError("host", "Host aniqlanmadi") };

  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const allowed = opts.allowPorts || ALLOWED_PORTS;
  if (!allowed.has(port)) {
    return { ok: false, error: new SsrfError("port", `Port ${port} ruxsat etilmagan`) };
  }

  // To'g'ridan-to'g'ri IP yozilgan bo'lsa (DNS'siz ham tekshiramiz)
  if (isIP(host)) {
    if (!isPublicIp(host)) {
      return { ok: false, error: new SsrfError("private-ip", "Ichki/IP manzilga ruxsat yo'q") };
    }
    return { ok: true, url, addresses: [host] };
  }

  const lower = host.toLowerCase();
  if (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal") ||
    lower.endsWith(".localdomain") ||
    lower === "metadata.google.internal"
  ) {
    return { ok: false, error: new SsrfError("private-ip", "Ichki host nomga ruxsat yo'q") };
  }

  let addresses: string[];
  try {
    addresses = await new Promise<string[]>((resolve, reject) => {
      dnsLookup(host, { all: true, verbatim: true }, (err, records) => {
        if (err) reject(err);
        else resolve(records.map((r) => r.address));
      });
    });
  } catch {
    return { ok: false, error: new SsrfError("dns", "DNS so'rovi amalga oshmadi") };
  }
  if (!addresses.length) return { ok: false, error: new SsrfError("dns", "DNS javob bermadi") };

  for (const addr of addresses) {
    if (!isPublicIp(addr)) {
      return { ok: false, error: new SsrfError("private-ip", "Ichki tarmoqqa ruxsat yo'q") };
    }
  }

  return { ok: true, url, addresses };
}

export type SafeFetchInit = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string> | Headers;
  method?: string;
  body?: string | Buffer;
};

export type SafeFetchBytesResult =
  | { ok: true; status: number; bytes: Buffer; contentType: string; finalUrl: string }
  | { ok: false; error: string };

function headersToRecord(h?: Record<string, string> | Headers): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (h instanceof Headers) {
    h.forEach((v, k) => (out[k] = v));
    return out;
  }
  for (const [k, v] of Object.entries(h)) out[k] = String(v);
  return out;
}

/**
 * Bitta HTTP so'rov — `addresses` (oldindan tekshirilgan public IP) ga
 * pin qilinadi; TLS SNI/servername asl hostname bo'lib qoladi.
 */
function requestPinned(
  url: URL,
  pinnedAddresses: string[],
  headers: Record<string, string>,
  method: string,
  body: string | Buffer | undefined,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; bytes: Buffer }> {
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? https : http;
  const hostname = url.hostname.replace(/^\[|\]$/g, "");

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const req = lib.request(
      {
        protocol: url.protocol,
        hostname,
        port: url.port ? Number(url.port) : isHttps ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method,
        headers: { ...headers, host: url.host },
        servername: isHttps && isIP(hostname) === 0 ? hostname : undefined, // TLS SNI = asl host nomi
        // DNS pin: oldindan tekshirilgan public IP lar qaytariladi
        lookup: (_hostname, opts, cb) => {
          const all = (opts as { all?: boolean })?.all === true;
          const list = pinnedAddresses.map((address, i) => ({ address, family: isIP(address) }));
          if (all) (cb as unknown as (e: null, a: typeof list) => void)(null, list);
          else (cb as unknown as (e: null, a: string, f: number) => void)(null, list[0].address, list[0].family);
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (chunk: Buffer) => {
          total += chunk.length;
          if (total > maxBytes) {
            res.destroy();
            fail(new SsrfError("size", `Javob hajmi limitdan oshdi (${maxBytes} bait)`));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          resolve({ status: res.statusCode || 0, headers: res.headers, bytes: Buffer.concat(chunks) });
        });
        res.on("error", fail);
      },
    );

    req.on("timeout", () => {
      req.destroy();
      fail(new SsrfError("timeout", "So'rov vaqti tugadi"));
    });
    req.on("error", fail);

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Xavfsiz fetch (baytlar): har bir redirectni qayta tekshiradi (yangi DNS +
 * IP check), IP'ga pin qiladi, javobni maxBytes bilan cheklaydi.
 */
export async function safeFetchBytes(
  rawUrl: string,
  init: SafeFetchInit = {},
): Promise<SafeFetchBytesResult> {
  const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRedirects = init.maxRedirects ?? 3;
  const method = (init.method || "GET").toUpperCase();
  const headers = headersToRecord(init.headers);

  const deadline = Date.now() + timeoutMs;
  let current = rawUrl;

  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const verdict = await checkUrl(current);
      if (!verdict.ok) return { ok: false, error: verdict.error.message };

      const remaining = deadline - Date.now();
      if (remaining <= 0) return { ok: false, error: "So'rov vaqti tugadi" };

      const res = await requestPinned(
        verdict.url,
        verdict.addresses,
        headers,
        hop === 0 ? method : "GET",
        hop === 0 ? init.body : undefined,
        remaining,
        maxBytes,
      );

      // Redirect — yangi manzilni boshidan tekshiramiz
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.location;
        if (!loc) return { ok: false, error: "Redirect manzili yo'q" };
        if (hop === maxRedirects) return { ok: false, error: "Limitdan ko'p redirect" };
        current = new URL(loc, verdict.url).toString();
        continue;
      }

      if (res.status < 200 || res.status >= 300) {
        return { ok: false, error: `HTTP ${res.status}` };
      }

      return {
        ok: true,
        status: res.status,
        bytes: res.bytes,
        contentType: String(res.headers["content-type"] || ""),
        finalUrl: verdict.url.toString(),
      };
    }
    return { ok: false, error: "Redirect limiti oshib ketdi" };
  } catch (e) {
    if (e instanceof SsrfError) return { ok: false, error: e.message };
    return { ok: false, error: `Tashqi resursga ulanib bo'lmadi: ${(e as Error)?.message || "xato"}` };
  }
}

/** API qiymat uchun: URL kiritsa xatoni qaytaruvchi yordamchi. */
export async function assertSafeUrl(rawUrl: string, opts?: { allowPorts?: Set<number> }): Promise<URL> {
  const verdict = await checkUrl(rawUrl, opts);
  if (!verdict.ok) throw verdict.error;
  return verdict.url;
}
