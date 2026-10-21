import { readFileSync } from "node:fs";
import Database from "better-sqlite3";

export const VERSION_ESQUEMA = 1;

// Conexión de API y worker. La base debe existir y estar inicializada (npm run db:init).
export function abrirBase(path = process.env.SQLITE_DB_PATH) {
  if (!path) throw new Error("SQLITE_DB_PATH no está configurada en el entorno.");
  const db = new Database(path, { fileMustExist: true, timeout: 5000 });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  if (db.pragma("user_version", { simple: true }) !== VERSION_ESQUEMA) {
    db.close();
    throw new Error(`SQLite requiere esquema versión ${VERSION_ESQUEMA}. Ejecuta npm run db:init.`);
  }
  return db;
}

// Crea las tablas en una base vacía. Es idempotente y rechaza bases ajenas.
export function inicializarBase(db) {
  db.transaction(() => {
    const version = db.pragma("user_version", { simple: true });
    if (version === VERSION_ESQUEMA) return;
    if (version !== 0) throw new Error(`Versión SQLite no compatible: ${version}`);
    const tabla = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
    ).get();
    if (tabla) throw new Error("La base ya tiene tablas sin versión. Revisa su esquema antes de usarla.");
    db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
    db.pragma(`user_version = ${VERSION_ESQUEMA}`);
  }).immediate();
}
