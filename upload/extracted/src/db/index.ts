import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Client } from "@libsql/client";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * Local file SQLite for safe development (does not touch Turso / prod).
 * Production / edu: Turso over HTTP so deploy hosts never need native binaries.
 *
 * Enable local: AKELA_USE_LOCAL_DB=1 in .env.local
 */
function useLocalSqlite() {
  return process.env.AKELA_USE_LOCAL_DB === "1";
}

function resolveTursoUrl() {
  const url =
    process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!url || url === "[SENSITIVE]") {
    throw new Error(
      "Missing TURSO_DATABASE_URL. Set it in .env.local (or set AKELA_USE_LOCAL_DB=1 for local SQLite).",
    );
  }
  if (url.startsWith("file:")) {
    throw new Error(
      "file: URL in TURSO_DATABASE_URL is not used — set AKELA_USE_LOCAL_DB=1 instead.",
    );
  }
  if (!url.startsWith("libsql://") && !url.startsWith("https://")) {
    throw new Error(
      "TURSO_DATABASE_URL must start with libsql:// (check .vercel/.env.production.local).",
    );
  }
  return url;
}

function resolveLocalFileUrl() {
  const custom = process.env.AKELA_LOCAL_DB_PATH?.trim();
  if (custom) {
    return custom.startsWith("file:") ? custom : pathToFileURL(custom).href;
  }
  return pathToFileURL(path.join(process.cwd(), "data", "akela-local.db")).href;
}

type AppSchema = typeof schema;

function createLocalDb(): {
  client: Client;
  db: LibSQLDatabase<AppSchema>;
} {
  // Native driver — local Node only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/libsql") as typeof import("drizzle-orm/libsql");
  const client = createClient({ url: resolveLocalFileUrl() });
  return { client, db: drizzle(client, { schema }) };
}

function createTursoDb(): {
  client: Client;
  db: LibSQLDatabase<AppSchema>;
} {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client/web") as typeof import("@libsql/client/web");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/libsql/web") as typeof import("drizzle-orm/libsql/web");
  const authToken =
    process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({
    url: resolveTursoUrl(),
    authToken: authToken || undefined,
  });
  // Web driver is API-compatible for our queries; cast to shared LibSQLDatabase type.
  return {
    client: client as unknown as Client,
    db: drizzle(client, { schema }) as unknown as LibSQLDatabase<AppSchema>,
  };
}

const appDb = useLocalSqlite() ? createLocalDb() : createTursoDb();

export const client = appDb.client;
export const db = appDb.db;
