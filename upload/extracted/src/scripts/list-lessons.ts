/**
 * Debug helper: print the current lesson library.
 *
 *   npx tsx src/scripts/list-lessons.ts
 */
import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const require = createRequire(import.meta.url);
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as NodeModule;

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

async function main() {
  const { db } = await import("../db/index");
  const { ensureDb } = await import("../db/queries");
  const { learningLessons } = await import("../db/schema");

  await ensureDb();
  const rows = await db.select().from(learningLessons);
  const active = rows.filter((row) => row.isActive);

  console.log(`Всего: ${rows.length}, активных: ${active.length}`);
  for (const row of active.slice(0, 10)) {
    console.log(`  [${row.id}] ${row.slug} · ${row.title}`);
  }
  if (active.length > 10) console.log(`  … и ещё ${active.length - 10}`);

  const hidden = rows.filter((row) => !row.isActive);
  console.log(`\nСкрытых (неактивных): ${hidden.length}`);
  for (const row of hidden.slice(0, 10)) {
    console.log(`  [${row.id}] ${row.slug} · ${row.title}`);
  }
  if (hidden.length > 10) console.log(`  … и ещё ${hidden.length - 10}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
