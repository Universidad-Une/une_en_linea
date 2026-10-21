// npm run db:init            → crea la base y sus tablas
// npm run db:query -- "SQL"   → consulta de solo lectura (sin SQL: últimas 20)
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { inicializarBase } from "./db.mjs";

const [comando, ...resto] = process.argv.slice(2);
if (!process.env.SQLITE_DB_PATH) throw new Error("Configura SQLITE_DB_PATH en .env.");
const databasePath = resolve(process.env.SQLITE_DB_PATH);

if (comando === "init") {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new Database(databasePath, { timeout: 5000 });
  try {
    inicializarBase(db);
    db.pragma("journal_mode = WAL");
    console.log(`Base SQLite lista: ${databasePath}`);
  } finally {
    db.close();
  }
} else if (comando === "query") {
  const sql = resto.join(" ") || `SELECT id, estado, intentos, needs_review, ultimo_error, created_at
    FROM inscripciones ORDER BY created_at DESC LIMIT 20`;
  const db = new Database(databasePath, { readonly: true, fileMustExist: true, timeout: 5000 });
  try {
    const statement = db.prepare(sql);
    if (!statement.readonly || !statement.reader) throw new Error("Solo se admiten consultas de lectura.");
    const rows = statement.all();
    console.log(JSON.stringify(rows, null, 2));
    console.log(`Filas: ${rows.length}`);
  } catch (error) {
    console.error(`No se pudo consultar SQLite: ${error.message}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
} else {
  console.error("Uso: node server/db-cli.mjs init | query [SQL]");
  process.exitCode = 1;
}
