
import Database from 'better-sqlite3';

const databasePath = process.env.SQLITE_DB_PATH;

if (!databasePath) {
  throw new Error(
    'SQLITE_DB_PATH no está configurada en el entorno'
  );
}

const db = new Database(databasePath, {
  fileMustExist: true,
  timeout: 5000,
});

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export { db };
