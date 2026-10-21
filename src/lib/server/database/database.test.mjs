import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { inicializarBase } from "./schema.mjs";

// Nunca usar .env ni la base local para las pruebas.
const directory = mkdtempSync(join(tmpdir(), "une-database-test-"));
const previousPath = process.env.SQLITE_DB_PATH;
process.env.SQLITE_DB_PATH = join(directory, "test.sqlite");
const initial = new Database(process.env.SQLITE_DB_PATH);
inicializarBase(initial);
initial.close();
const { db } = await import("./sqlite.ts");
const { crearInscripcion, registrarResultado } = await import("./inscripciones.repository.ts");
inicializarBase(db);

after(() => {
  db.close();
  if (previousPath === undefined) delete process.env.SQLITE_DB_PATH;
  else process.env.SQLITE_DB_PATH = previousPath;
  rmSync(directory, { recursive: true, force: true });
});

test("cada intento conserva el UUID de la inscripción y los datos recuperables", () => {
  const data = {
    nombres: "Inscripción ficticia", correo: "prueba@example.com",
    telefonoContacto: "3300000000", programaAcademico: "Lic. en administracion",
    edad: "18-24", mediosSeleccionados: ["Facebook"],
    origenFormulario: "inscripcion", rutaProcedencia: "/formulario-inscripcion",
  };
  const id = crearInscripcion(data);
  registrarResultado(id, "UNKNOWN", undefined, "Timeout simulado");
  registrarResultado(id, "SENT", 200);

  const rows = db.prepare(
    "SELECT * FROM intentos_envio WHERE inscripcion_id = ? ORDER BY numero_intento",
  ).all(id);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].id, rows[1].id);
  assert.deepEqual(rows.map(row => row.inscripcion_id), [id, id]);
  assert.deepEqual(rows.map(row => row.numero_intento), [1, 2]);
  assert.deepEqual(rows.map(row => JSON.parse(row.payload)), [data, data]);
  assert.equal(rows[0].error, "Timeout simulado");
  assert.equal(rows[1].http_status, 200);
  const inscription = db.prepare("SELECT * FROM inscripciones WHERE id = ?").get(id);
  assert.equal(inscription.intentos, 2);
  assert.equal(inscription.estado, "SENT");
  assert.ok(inscription.enviado_at);

  // La copia histórica no cambia aunque se actualice el registro principal.
  db.prepare("UPDATE inscripciones SET payload = ? WHERE id = ?").run('{"modificado":true}', id);
  assert.deepEqual(JSON.parse(db.prepare("SELECT payload FROM intentos_envio WHERE id = ?").get(rows[0].id).payload), data);
  inicializarBase(db);
  assert.equal(db.prepare("SELECT count(*) AS total FROM intentos_envio WHERE inscripcion_id = ?").get(id).total, 2);
});

test("un fallo al actualizar el estado revierte también historial y contador", () => {
  const id = crearInscripcion({ nombres: "Prueba de rollback" });
  db.exec(`CREATE TRIGGER simular_fallo BEFORE UPDATE OF estado ON inscripciones
    BEGIN SELECT RAISE(ABORT, 'fallo simulado'); END`);
  try {
    assert.throws(() => registrarResultado(id, "SENT", 200), /fallo simulado/);
    const row = db.prepare("SELECT estado, intentos FROM inscripciones WHERE id = ?").get(id);
    assert.deepEqual(row, { estado: "PENDING", intentos: 0 });
    assert.equal(db.prepare("SELECT count(*) AS total FROM intentos_envio WHERE inscripcion_id = ?").get(id).total, 0);
  } finally {
    db.exec("DROP TRIGGER simular_fallo");
  }
});

test("no registra intentos de una inscripción inexistente", () => {
  assert.throws(() => registrarResultado("no-existe", "UNKNOWN"), /Inscripción no encontrada/);
});

test("el inicializador rechaza bases previas sin modificar sus tablas", () => {
  const existing = new Database(":memory:");
  try {
    existing.exec("CREATE TABLE existente (id INTEGER)");
    assert.throws(() => inicializarBase(existing), /ya tiene tablas sin versión/);
    assert.equal(existing.pragma("user_version", { simple: true }), 0);
    assert.equal(existing.prepare("SELECT count(*) AS total FROM sqlite_master WHERE type = 'table'").get().total, 1);
  } finally {
    existing.close();
  }
});
