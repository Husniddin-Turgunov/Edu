import type { Metadata } from "next";
import { Manrope, Syne } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import { CompanyProvider } from "@/components/CompanyProvider";
import { getPublicCompanySettings } from "@/db/system-settings";
import "./globals.css";

const syne = Syne({
  subsets: ["latin", "latin-ext"],
  variable: "--font-syne",
});

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "AKELA Assess — оценка сотрудников",
  description:
    "Платформа проверки знаний, распределения по уровню и маршрута развития",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/akela-logo.png", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const company = await getPublicCompanySettings();
  return (
    <html lang="ru">
      <body className={`${syne.variable} ${manrope.variable}`}>
        <style>{`:root{--font-display:var(--font-syne);--font-body:var(--font-manrope);}`}</style>
        <I18nProvider>
          <CompanyProvider value={company}>{children}</CompanyProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
