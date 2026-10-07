"use client";

import { useState } from "react";
import { Navbar } from "@/components/akela/Navbar";
import { UI_STRINGS, type Locale } from "@/lib/akela-content";

/**
 * Server komponentlardan (`/guides/[id]`) Navbar'ni ishlatish uchun.
 * Server -> Client o'tkazishda event handler yuborib bo'lmaydi,
 * shuning uchun til holati shu yerda boshqariladi.
 */
export function NavbarStatic({ initial = "uz" }: { initial?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initial);
  return <Navbar locale={locale} strings={UI_STRINGS[locale]} onLocaleChange={setLocale} />;
}
