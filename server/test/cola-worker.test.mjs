import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import Database from "better-sqlite3";
import { inicializarBase } from "../db/schema.mjs";
import { crearCola } from "../db/cola.mjs";
import { configuracionEnv, enviarInscripcion, procesarTrabajo } from "../inscripcion/entrega.mjs";

const data = {
  nombres: "Prueba ficticia", programaAcademico: "Lic. en administracion", edad: "18-24",
  telefonoContacto: "3300000000", correo: "prueba@example.com", mediosSeleccionados: ["Facebook"],
};
const config = {
  url: "https://script.google.com/macros/s/test/exec", secret: "s".repeat(32),
  maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000, leaseMs: 90000, timeoutMs: 1000,
};
function fixture(t, overrides = {}) {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  inicializarBase(db);
  t.after(() => db.close());
  let time = 1000000;
  const options = { ...config, ...overrides };
  const cola = crearCola(db, options, { now: () => time, random: () => 0.5 });
  return { db, cola, config: options, tick: (ms) => { time += ms; },
    row: (id) => db.prepare("SELECT * FROM inscripciones WHERE id=?").get(id),
    attempts: (id) => db.prepare("SELECT * FROM intentos_envio WHERE inscripcion_id=? ORDER BY numero_intento").all(id) };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("encolar persiste sin iniciar envíos y el worker reserva el primer intento", (t) => {
  const f = fixture(t);
  const queued = f.cola.encolar(data);
  assert.equal(f.row(queued.id).estado, "PENDING");
  assert.equal(f.row(queued.id).intentos, 0);
  assert.deepEqual(JSON.parse(f.row(queued.id).payload), data);
  assert.equal(f.attempts(queued.id).length, 0);
  const first = f.cola.tomarSiguiente();
  assert.equal(first.id, queued.id);
  assert.equal(first.attempt, 1);
  assert.equal(f.row(queued.id).estado, "PROCESSING");
  assert.equal(f.attempts(queued.id)[0].payload, first.payload);
  assert.equal(f.cola.tomarSiguiente(), null);
});

test("el worker respeta la fecha de reintento, UUID, payload y confirma el segundo intento", async (t) => {
  const f = fixture(t);
  const first = f.cola.crearYReservar(data);
  let sent;
  const failure = await procesarTrabajo(f.cola, first, config, async (_, init) => {
    sent = JSON.parse(init.body);
    throw new Error("desconexión simulada");
  });
  assert.equal(failure.estado, "UNKNOWN");
  assert.equal(f.cola.tomarSiguiente(), null);
  f.tick(100);
  const second = f.cola.tomarSiguiente();
  assert.equal(second.id, first.id);
  assert.notEqual(second.token, first.token);
  await procesarTrabajo(f.cola, second, config, async (_, init) => {
    assert.deepEqual(JSON.parse(init.body), sent);
    return json({ success: true, requestId: second.id, responseId: "google-1" });
  });
  assert.equal(f.row(first.id).estado, "SENT");
  assert.equal(f.row(first.id).google_response_id, "google-1");
  assert.equal(f.row(first.id).next_attempt_at, null);
  assert.deepEqual(f.attempts(first.id).map(a => a.estado), ["UNKNOWN", "SENT"]);
  assert.ok(f.attempts(first.id).every(a => a.payload === first.payload && a.finished_at));
  f.tick(1000000);
  assert.equal(f.cola.tomarSiguiente(), null);
});

test("recupera un proceso caído, registra su fallo y rechaza resultados de su reserva antigua", (t) => {
  const f = fixture(t);
  const first = f.cola.crearYReservar(data);
  assert.equal(f.row(first.id).intentos, 1);
  assert.equal(f.attempts(first.id)[0].estado, "PROCESSING");
  assert.equal(f.cola.tomarSiguiente(), null);
  f.tick(config.leaseMs);
  assert.equal(f.cola.tomarSiguiente(), null);
  assert.equal(f.attempts(first.id)[0].error, "PROCESS_INTERRUPTED");
  f.tick(100);
  const second = f.cola.tomarSiguiente();
  assert.equal(second.id, first.id);
  assert.equal(second.attempt, 2);
  assert.equal(f.cola.finalizar(first, { estado: "SENT", responseId: "viejo" }), false);
  assert.equal(f.row(first.id).lease_token, second.token);
});

test("al agotar intentos conserva UNKNOWN y los datos para revisión sin seguir enviando", (t) => {
  const f = fixture(t, { maxAttempts: 2 });
  const first = f.cola.crearYReservar(data);
  f.cola.finalizar(first, { estado: "RETRY", error: "RECEIVER_BUSY" });
  f.tick(100);
  const second = f.cola.tomarSiguiente();
  f.cola.finalizar(second, { estado: "UNKNOWN", error: "GOOGLE_RESPONSE_UNCONFIRMED" });
  f.tick(1000000);
  assert.equal(f.cola.tomarSiguiente(), null);
  assert.equal(f.row(first.id).estado, "UNKNOWN");
  assert.equal(f.row(first.id).needs_review, 1);
  assert.equal(f.row(first.id).next_attempt_at, null);
  assert.equal(f.attempts(first.id).length, 2);
  assert.deepEqual(JSON.parse(f.row(first.id).payload), data);
});

test("un rechazo permanente no se reintenta", async (t) => {
  const f = fixture(t);
  const job = f.cola.crearYReservar(data);
  const result = await procesarTrabajo(f.cola, job, config,
    async () => json({ success: false, error: "FORM_SCHEMA_CHANGED" }));
  assert.equal(result.estado, "FAILED");
  assert.equal(f.row(job.id).needs_review, 1);
  f.tick(1000000);
  assert.equal(f.cola.tomarSiguiente(), null);
});

test("dos conexiones no reservan el mismo trabajo de la API ni el mismo reintento", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "une-queue-"));
  const path = join(directory, "queue.sqlite");
  const db1 = new Database(path);
  const db2 = new Database(path);
  t.after(() => { db1.close(); db2.close(); rmSync(directory, { recursive: true, force: true }); });
  inicializarBase(db1);
  let time = 0;
  const options = { now: () => time, random: () => 0.5 };
  const api = crearCola(db1, config, options);
  const worker = crearCola(db2, config, options);
  const first = api.crearYReservar(data);
  assert.equal(worker.tomarSiguiente(), null);
  api.finalizar(first, { estado: "UNKNOWN" });
  time = 100;
  const job = worker.tomarSiguiente();
  assert.equal(job.id, first.id);
  assert.equal(api.tomarSiguiente(), null);
  assert.equal(db1.prepare("SELECT count(*) AS n FROM intentos_envio WHERE estado='PROCESSING'").get().n, 1);
});

test("la migración conserva los registros anteriores y no reenvía UNKNOWN antiguos", (t) => {
  const db = new Database(":memory:");
  t.after(() => db.close());
  db.exec(readFileSync(new URL("../db/migraciones/001-inicial.sql", import.meta.url), "utf8"));
  db.pragma("user_version = 1");
  db.prepare("INSERT INTO inscripciones(id,payload,estado,intentos) VALUES ('anterior',?,'UNKNOWN',1)").run(JSON.stringify(data));
  db.prepare("INSERT INTO intentos_envio(inscripcion_id,numero_intento,payload,estado) VALUES ('anterior',1,?,'UNKNOWN')").run(JSON.stringify(data));
  inicializarBase(db);
  inicializarBase(db);
  const cola = crearCola(db, config);
  assert.equal(cola.tomarSiguiente(), null);
  assert.equal(db.prepare("SELECT retry_enabled FROM inscripciones").get().retry_enabled, 0);
  assert.deepEqual(JSON.parse(db.prepare("SELECT payload FROM intentos_envio").get().payload), data);
});

test("la transacción revierte historial y estado si falla la escritura del resultado", (t) => {
  const f = fixture(t);
  const job = f.cola.crearYReservar(data);
  f.db.exec("CREATE TRIGGER fallo BEFORE UPDATE OF estado ON inscripciones BEGIN SELECT RAISE(ABORT,'fallo'); END");
  assert.throws(() => f.cola.finalizar(job, { estado: "SENT" }), /fallo/);
  assert.equal(f.attempts(job.id)[0].estado, "PROCESSING");
  assert.equal(f.row(job.id).estado, "PROCESSING");
});

test("valida confirmaciones, errores HTTP, payload inválido y Retry-After", async () => {
  const job = { id: "uuid-prueba", payload: JSON.stringify(data) };
  for (const response of [json({ success: true, requestId: "otro", responseId: "r" }),
    json({ success: true, requestId: job.id, responseId: "" }),
    new Response("HTML", { status: 502 })]) {
    assert.equal((await enviarInscripcion(job, config, async () => response)).estado, "UNKNOWN");
  }
  const limited = await enviarInscripcion(job, config,
    async () => new Response("ocupado", { status: 429, headers: { "Retry-After": "120" } }));
  assert.equal(limited.estado, "RETRY");
  assert.equal(limited.retryAfterMs, 120000);
  assert.equal((await enviarInscripcion({ ...job, payload: "{}" }, config,
    async () => { throw new Error("No debe enviar"); })).error, "INVALID_STORED_PAYLOAD");
});

test("un receptor HTTP que guarda y corta la conexión se concilia con el mismo UUID", async (t) => {
  const f = fixture(t);
  const saved = new Map();
  let requests = 0;
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    requests++;
    if (!saved.has(body.requestId)) {
      saved.set(body.requestId, "response-once");
      res.destroy();
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, requestId: body.requestId, responseId: saved.get(body.requestId) }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const settings = { ...config, url: `http://127.0.0.1:${server.address().port}` };
  const first = f.cola.crearYReservar(data);
  assert.equal((await procesarTrabajo(f.cola, first, settings)).estado, "UNKNOWN");
  f.tick(100);
  assert.equal((await procesarTrabajo(f.cola, f.cola.tomarSiguiente(), settings)).estado, "SENT");
  assert.equal(saved.size, 1);
  assert.equal(requests, 2);
});

test("rechaza configuración inválida antes de enviar", () => {
  const env = { GOOGLE_FORMS_SCRIPT_URL: config.url, GOOGLE_FORMS_SHARED_SECRET: config.secret };
  assert.equal(configuracionEnv(env).maxAttempts, 5);
  for (const patch of [{ INSCRIPCION_MAX_ATTEMPTS: "0" }, { INSCRIPCION_POLL_MS: "abc" },
    { GOOGLE_FORMS_SCRIPT_URL: "http://otro" }, { INSCRIPCION_RETRY_MAX_MS: "1" }]) {
    assert.throws(() => configuracionEnv({ ...env, ...patch }));
  }
});
