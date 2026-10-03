"use client";

// components/akela/AiWidgetClient.tsx
// Server-gate bir marta ishlaydi: Next.js root layout klient orqali
// navigatsiyada qayta render bo'lmaydi. Shu sababli login'dan keyin
// /admin'ga klient yoli bilan o'tilganda AI tugmasi paydo bo'lmasdi —
// layout kirganda sessiya hali yo'q edi, endi esa bor, lekin komponent
// allaqachon "ruxsat yo'q" holatida turib qolgan bo'lardi.
//
// Yechim: mountda va sahifa almashganda /api/auth/session qayta tekshiriladi.
// Bu FAQAT ko'rsatish qatlami — haqiqiy himoya /api/ai/* ichida
// `requireAiActor()` orqali bazadagi ro'l asosida ishlaydi.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AiFloatingWidget } from "./AiFloatingWidget";

const MANAGER_ROLES = new Set(["admin", "grader"]);

export function AiWidgetClient({ serverAllowed }: { serverAllowed: boolean }) {
  const [allowed, setAllowed] = useState(serverAllowed);
  const pathname = usePathname();

  useEffect(() => {
    if (serverAllowed) return;
    let cancelled = false;

    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const role = data?.user?.role;
        if (typeof role === "string" && MANAGER_ROLES.has(role)) setAllowed(true);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [serverAllowed, pathname]);

  if (!allowed) return null;
  return <AiFloatingWidget />;
}