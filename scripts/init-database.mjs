import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { inicializarBase } from "../src/lib/server/database/schema.mjs";

if (!process.env.SQLITE_DB_PATH) {
  throw new Error("Configura SQLITE_DB_PATH en .env antes de inicializar SQLite.");
}

const databasePath = resolve(process.env.SQLITE_DB_PATH);
mkdirSync(dirname(databasePath), { recursive: true });
const db = new Database(databasePath, { timeout: 5000 });
try {
  db.pragma("foreign_keys = ON");
  if (db.pragma("user_version", { simple: true }) === 1) {
    const backupPath = `${databasePath}.before-v2-${Date.now()}.bak`;
    await db.backup(backupPath);
    console.log(`Respaldo previo a migración: ${backupPath}`);
  }
  inicializarBase(db);
  db.pragma("journal_mode = WAL");
  console.log(`Base SQLite lista: ${databasePath}`);
} finally {
  db.close();
}
