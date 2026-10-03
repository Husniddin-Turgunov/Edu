/**
 * scripts/ai-session-token.ts — test uchun admin sessiya token chiqaradi.
 * Ishga tushirish: npx tsx --env-file=.env scripts/ai-session-token.ts
 */
import { encodeSessionToken } from "@/lib/auth-core";
import { db } from "@/lib/db";

async function main() {
  const admin: any = await db.user.findFirst({
    where: { role: "admin" },
    select: { id: true, email: true, name: true, surname: true, role: true },
  });
  if (!admin) {
    console.error("admin topilmadi");
    process.exit(1);
  }
  const token = encodeSessionToken(
    { userId: admin.id, email: admin.email, name: admin.name || "", surname: admin.surname || "", role: admin.role },
    1,
  );
  console.log(token);
}
main();