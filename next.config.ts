import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
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
};

export default nextConfig;
