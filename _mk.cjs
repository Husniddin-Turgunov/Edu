const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const EMAIL = "zz-test-access@akelagroup.uz";
const PASSWORD = "ZzTest12345!";
function hashPassword(p) { return crypto.createHash("sha256").update(p).digest("hex"); }
(async () => {
  const old = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (old) await prisma.user.delete({ where: { email: EMAIL } });
  const u = await prisma.user.create({
    data: {
      email: EMAIL, name: "Test", surname: "Access",
      passwordHash: hashPassword(PASSWORD), role: "user", status: "approved",
      department: "Sinov bo'limi", position: "Tester", phone: "+998900000000",
    },
  });
  console.log("CREATED " + u.id + " " + EMAIL + " / " + PASSWORD);
  await prisma.$disconnect();
})();
