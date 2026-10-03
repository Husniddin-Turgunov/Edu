// components/akela/AiWidgetGate.tsx
// AI oynasi FAQAT admin va grader uchun. Oddiy foydalanuvchiga hech narsa
// ko'rinmaydi (na tugma, na oyna, ma'lumot ham yuklanmaydi).
//
// MUHIM: ro'l tekshiruvi baza (`User.role`) asosida — sessiya kukiiga
// ishonilmaydi. Sessiya ikkala usulda ham bo'lishi mumkin:
//   1) `akela_session` — akela login shakli
//   2) NextAuth JWT   — next-auth login shakli
// Shuning uchun umumiy `getSession()` ishlatiladi.

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AiWidgetClient } from "./AiWidgetClient";

export async function AiWidgetGate() {
  const session = await getSession();
  if (!session) return <AiWidgetClient serverAllowed={false} />;

  const userId = String(session.userId);
  if (!userId || userId === "0") return <AiWidgetClient serverAllowed={false} />;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });

  const allowed = !!user && user.isActive && (user.role === "admin" || user.role === "grader");

  return <AiWidgetClient serverAllowed={allowed} />;
}