/* Debug 6: butun bazadagi varchar(191) ustunlarda kesilish bor-yo'qligini aniqlash */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  const cols = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, COLUMN_NAME, CHARACTER_MAXIMUM_LENGTH AS len
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE = 'varchar' AND CHARACTER_MAXIMUM_LENGTH >= 190
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  const suspects = [];
  for (const c of cols) {
    const sql = `SELECT COUNT(*) AS c FROM \`${c.TABLE_NAME}\` WHERE CHAR_LENGTH(\`${c.COLUMN_NAME}\`) = ${Number(c.len)}`;
    const [row] = await prisma.$queryRawUnsafe(sql);
    if (Number(row.c) > 0) suspects.push({ table: c.TABLE_NAME, column: c.COLUMN_NAME, len: Number(c.len), truncatedRows: Number(row.c) });
  }
  console.log("=== Kesilgan qiymatli ustunlar (CHAR_LENGTH = limit) ===");
  for (const s of suspects) console.log(s.table + "." + s.column, "limit:", s.len, "rows at limit:", s.truncatedRows);
  if (suspects.length === 0) console.log("(yo'q)");

  // LongText / Text ustunlar (kesilmaydi)
  const big = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE IN ('text','mediumtext','longtext','blob')
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);
  console.log("=== Katta matn ustunlar ===");
  console.log(big.map((b) => `${b.TABLE_NAME}.${b.COLUMN_NAME}:${b.DATA_TYPE}`).join(", "));
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
