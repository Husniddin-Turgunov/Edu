import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Saidakbar'ning Telegram ID ni saqlash
  const user = await prisma.user.findUnique({ where: { email: "inetrn_02@akela.com" } });
  if (user) {
    await prisma.user.update({
      where: { email: "inetrn_02@akela.com" },
      data: { telegramId: "6839364895", role: "admin" },
    });
    console.log("✅ Telegram ID saqlandi: inetrn_02@akela.com → 6839364895 (admin)");
  } else {
    console.log("❌ Foydalanuvchi topilmadi: inetrn_02@akela.com");
  }

  // Barcha userlarni ko'rsat
  const users = await prisma.user.findMany({
    select: { email: true, name: true, status: true, telegramId: true },
  });
  console.log("\n📋 Foydalanuvchilar:");
  users.forEach(u => {
    console.log(`  ${u.email} | ${u.name || "?"} | ${u.status} | TG: ${u.telegramId || "yo'q"}`);
  });

  await prisma.$disconnect();
}

main();
