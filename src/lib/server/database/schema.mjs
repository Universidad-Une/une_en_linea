import { readFileSync } from "node:fs";

// Las bases sin versión (VPS antiguo) requieren revisar su esquema primero.
export function inicializarBase(db) {
  db.transaction(() => {
    const version = db.pragma("user_version", { simple: true });
    if (version === 2) return;
    if (version === 1) {
      db.exec(readFileSync(new URL("./migration-002.sql", import.meta.url), "utf8"));
      db.pragma("user_version = 2");
      return;
    }
    if (version !== 0) throw new Error(`Versión SQLite no compatible: ${version}`);
    const tabla = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
    ).get();
    if (tabla) {
      throw new Error("La base ya tiene tablas sin versión. Revisa su esquema antes de migrarla.");
    }
    db.exec(readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
    db.exec(readFileSync(new URL("./migration-002.sql", import.meta.url), "utf8"));
    db.pragma("user_version = 2");
  }).immediate();
}
