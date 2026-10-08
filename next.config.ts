import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/** Global xavfsizlik zagolovkalari. */
const securityHeaders = [
  // MIME-sniffing bloklanadi (fayl turi o'zgartirib hujum qilishga qarshi)
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: faqat o'z saytimiz ichida frame qilinadi
  // (AI artifact paneli ham o'z domenida iframe ishlatadi — SAMEORIGIN shuning uchun)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Ruxsatlar: brauzer funksiyalari yopiq (faqat keraklari ochiq)
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // HTTPS majburlash (faqat ishlab chiqarishda)
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
  // CSP: script/style faqat o'zimiz (Next inline bootstrap uchun 'unsafe-inline'),
  // tashqi fetch faqat o'z API'miz, rasm/blob/data ruxsat, object yopiq.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      // HLS (.m3u8) videolar R2 dan oqadi. `media-src` yo'q edi — CSP uni
      // `default-src 'self'` ga qaytarib, R2 kadrlarini bloklab qo'yardi
      // (video.error.code = 4, ekranda "server ruxsat bermayapti (CORS)").
      // media-src ham, connect-src ham (hls.js segmentlarni shu orqali oladi)
      // ochiq bo'lishi shart. blob: — MSE uchun (hls.js video elementiga
      // blob URL yopadi), data: — ba'zi posterlar uchun.
      "media-src 'self' blob: data: https://*.r2.dev https://*.r2.cloudflarestorage.com",
// Vercel Blob'ga FAYL YUKLASH. `@vercel/blob/client` faylni
      // `https://vercel.com/api/blob/?pathname=...` orqali yuboradi (o'z
      // relay endpoint'i), `*.blob.vercel-storage.com` emas. Bu domen
      // connect-src da yo'q edi -> yuklash CSP tomonidan bloklanib OSILIB
      // QOLARDI: kontakt keladi, lekin keyingi so'rov umuman ketmaydi
      // (konsolda "violates the following Content Security Policy").
      "connect-src 'self' blob: data: https://vercel.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://*.blob.vercel-storage.com" +
        (isProd ? "" : " ws: wss:"),
      // hls.js o'z worker'ini blob: URL dan yaratadi (enableWorker: true)
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      // Video playerlar iframe orqali ishlaydi: YouTube (nocookie), Vimeo,
      // TikTok. Oldin faqat `'self' blob:` ruxsat bor edi — brauzer YouTube
      // kadrlarini bloklab, "video ko'rib bo'lmaydi" holatini berardi
      // (havola to'g'ri bo'lsa ham). Endi faqat KERAKLI domenlar ochiq —
      // `https:` umumiy ruxsat berilmaydi.
      "frame-src 'self' blob: https://www.youtube-nocookie.com https://www.youtube.com https://youtube.com https://youtu.be https://player.vimeo.com https://www.tiktok.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // `standalone` faqat Docker/Debian image uchun kerak (Dockerfile undan foydalanadi).
  // Vercel'da Turbopack + standalone mos kelmaydi va build
  // `next-server.js.nft.json: ENOENT` bilan to'xtaydi — shuning uchun Vercel'da o'chiriladi
  // (Vercel o'z serverless output'ini o'zi yig'adi).
  output: process.env.VERCEL ? undefined : "standalone",
  typescript: {
    // MUKAMMAL TEKSHIRUV: xatolar build'ni to'xtatadi (tsc --noEmit ham
    // CI tekshiruvida ishlaydi) — eskidek xatolarni yashirmaymiz.
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  // Telegram natija kartochkasi (next/og) uchun shriftlar serverless funksiya
  // ichida ham bo'lishi kerak.
  outputFileTracingIncludes: {
    "/api/telegram/**": ["./public/fonts/**"],
    "/api/tests/**": ["./public/fonts/**"],
    // Hodim hisobotlari / yakka test natijasi PDF lari ham shriftlarga bog'liq
    "/api/admin/skills/**": ["./public/fonts/**"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
