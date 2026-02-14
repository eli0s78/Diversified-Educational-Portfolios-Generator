import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";

const DB_PATH = path.join(process.cwd(), "data", "supervisors.db");

// Singleton for dev hot-reload
const globalForDb = globalThis as unknown as {
  __db: ReturnType<typeof drizzle> | undefined;
  __sqlite: Database.Database | undefined;
};

function createDb() {
  if (globalForDb.__db) return globalForDb.__db;

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });

  globalForDb.__sqlite = sqlite;
  globalForDb.__db = db;

  return db;
}

export const db = createDb();
export type AppDb = typeof db;
