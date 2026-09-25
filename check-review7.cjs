/* Debug 7: jadval DDL (SHOW CREATE TABLE) */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  for (const t of ["TestResult", "Test", "JobTestResult", "Question", "Choice", "JobDay"]) {
    const [row] = await prisma.$queryRawUnsafe(`SHOW CREATE TABLE \`${t}\``);
    const key = Object.keys(row).find((k) => k.toLowerCase().includes("create"));
    console.log("=====", t);
    console.log(String(row[key]).split("\n").join("\n"));
  }
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
