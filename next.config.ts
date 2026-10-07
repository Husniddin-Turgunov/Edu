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
      "connect-src 'self'" + (isProd ? "" : " ws: wss:"),
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
  output: "standalone",
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
