import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

function hashPassword(password: string) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  // Admin user (admin@akelagroup.com / AGM_9561)
  const adminEmail = "admin@akelagroup.com";
  const adminPass = "AGM_9561";
  const legacyEmail = "test@test.com";
  // Eski test adminini yangisiga migratsiya qilish
  const legacy = await prisma.user.findUnique({ where: { email: legacyEmail } });
  if (legacy) {
    const newExists = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!newExists) {
      await prisma.user.update({
        where: { email: legacyEmail },
        data: {
          email: adminEmail,
          passwordHash: hashPassword(adminPass),
          role: "admin",
          status: "approved",
        },
      });
      console.log("✓ Admin migratsiya qilindi:", legacyEmail, "->", adminEmail);
    } else {
      await prisma.user.delete({ where: { email: legacyEmail } });
      console.log("✓ Eski admin o'chirildi:", legacyEmail);
    }
  }
  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Test",
        surname: "Admin",
        passwordHash: hashPassword(adminPass),
        role: "admin",
        status: "approved",
        approvedAt: new Date(),
      },
    });
    console.log("✓ Admin yaratildi:", adminEmail);
  } else {
    await prisma.user.update({
      where: { email: adminEmail },
      data: { passwordHash: hashPassword(adminPass), role: "admin", status: "approved" },
    });
    console.log("✓ Admin yangilandi:", adminEmail);
  }
  console.log("Login: admin@akelagroup.com / AGM_9561");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
