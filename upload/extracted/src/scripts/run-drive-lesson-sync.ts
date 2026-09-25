/**
 * Run Drive lesson sync locally (avoids Vercel timeout on huge workbooks).
 *   npx tsx src/scripts/run-drive-lesson-sync.ts
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
    if (!process.env[key]) process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();

async function main() {
  const { ensureDb } = await import("../db/queries");
  const { syncLessonsFromDrive } = await import("../db/sync-drive-lessons");
  await ensureDb();
  const started = Date.now();
  const summary = await syncLessonsFromDrive();
  console.log(JSON.stringify(summary, null, 2));
  console.log(`elapsed ${Date.now() - started}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
