import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "AKELA GROUP — Yangi xodimning adaptatsiya portali",
  description:
    "AKELA GROUP yangi kelgan xodimlari uchun liquid glass dizayndagi interaktiv tanishtirish portali: kompaniya tarixi, tuzilma, ish intizomi va qoidalar.",
  keywords: [
    "AKELA GROUP",
    "onboarding",
    "adaptatsiya",
    "xodimlar",
    "o'qitish tizimi",
    "ish qoidalari",
    "intizom",
  ],
  authors: [{ name: "AKELA GROUP" }],
  icons: {
    icon: "/akela/logo.png",
    apple: "/akela/apple-icon.png",
  },
  openGraph: {
    title: "AKELA GROUP — Adaptatsiya portali",
    description:
      "Yangi xodimlar uchun interaktiv tanishtirish: kompaniya, tuzilma, qoidalar.",
    siteName: "AKELA GROUP",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jakarta.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
