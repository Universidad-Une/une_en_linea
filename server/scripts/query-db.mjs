import Database from "better-sqlite3";

if (!process.env.SQLITE_DB_PATH) {
  throw new Error("Configura SQLITE_DB_PATH en .env antes de consultar SQLite.");
}

const sql = process.argv.slice(2).join(" ") || `
  SELECT id, estado, intentos, needs_review, ultimo_error, created_at
  FROM inscripciones ORDER BY created_at DESC LIMIT 20
`;
const db = new Database(process.env.SQLITE_DB_PATH, {
  readonly: true, fileMustExist: true, timeout: 5000,
});
try {
  const statement = db.prepare(sql);
  if (!statement.readonly || !statement.reader) {
    throw new Error("Este comando solo admite consultas de lectura.");
  }
  const rows = statement.all();
  console.log(JSON.stringify(rows, null, 2));
  console.log(`Filas: ${rows.length}`);
} catch (error) {
  console.error(`No se pudo consultar SQLite: ${error.message}`);
  process.exitCode = 1;
} finally {
  db.close();
}
