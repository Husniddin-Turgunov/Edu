/**
 * BotSubscriber jadvalini bazaga qo'shadi (faqat qo'shadi — hech narsani
 * o'chirmaydi). `prisma db push` ishlatilmaydi, chunki u mavjud jadvaldan
 * farq qilgan ustunlarni o'chirib yuborishi mumkin.
 *
 * Ishga tushirish:  npx tsx scripts/apply-bot-schema.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SQL = `
CREATE TABLE IF NOT EXISTS \`BotSubscriber\` (
  \`id\` VARCHAR(191) NOT NULL,
  \`chatId\` VARCHAR(191) NOT NULL,
  \`name\` VARCHAR(191) NULL,
  \`username\` VARCHAR(191) NULL,
  \`isActive\` BOOLEAN NOT NULL DEFAULT true,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL,
  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`BotSubscriber_chatId_key\`(\`chatId\`),
  INDEX \`BotSubscriber_isActive_idx\`(\`isActive\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

async function main() {
  await prisma.$executeRawUnsafe(SQL);
  console.log("✅ BotSubscriber jadvali tayyor");

  const rows = await prisma.$queryRawUnsafe<{ cnt: bigint }[]>(
    "SELECT COUNT(*) AS cnt FROM `BotSubscriber`",
  );
  console.log("📋 Obunachilar soni:", Number(rows[0]?.cnt ?? 0));
}

main()
  .catch((e) => {
    console.error("❌ Xato:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
