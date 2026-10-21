import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import Database from "better-sqlite3";
import { inicializarBase } from "../db/schema.mjs";

// Requiere npm run build para verificar dist estático. API y worker son procesos reales,
// pero Google se reemplaza por un servidor HTTP local y SQLite es temporal.
test("API confirma antes de contactar Google y el worker envía y recupera sin duplicar", { timeout: 30000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "une-api-worker-"));
  const databasePath = join(directory, "test.sqlite");
  const db = new Database(databasePath);
  inicializarBase(db);
  const children = [];
  const saved = new Map();
  let requests = 0;
  const receiver = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks));
    requests++;
    if (!saved.has(body.requestId)) {
      saved.set(body.requestId, "one-google-response");
      res.destroy();
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ success: true, requestId: body.requestId,
      responseId: saved.get(body.requestId), deduplicated: true }));
  });
  t.after(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        const exit = once(child, "exit");
        child.kill();
        await exit;
      }
    }
    receiver.closeAllConnections();
    await new Promise(resolve => receiver.close(resolve));
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  receiver.listen(0, "127.0.0.1");
  await once(receiver, "listening");
  const portFinder = createServer();
  portFinder.listen(0, "127.0.0.1");
  await once(portFinder, "listening");
  const port = portFinder.address().port;
  await new Promise(resolve => portFinder.close(resolve));
  const preload = join(directory, "mock-google.mjs");
  writeFileSync(preload, `const original = globalThis.fetch;
    globalThis.fetch = (url, options) => original(
      new URL(url).hostname === 'script.google.com' ? process.env.TEST_RECEIVER_URL : url, options);
  `);
  const env = { ...process.env, API_HOST: "127.0.0.1", API_PORT: String(port),
    SQLITE_DB_PATH: databasePath, GOOGLE_FORMS_SCRIPT_URL: "https://script.google.com/macros/s/test/exec",
    GOOGLE_FORMS_SHARED_SECRET: "s".repeat(32), INSCRIPCION_MAX_ATTEMPTS: "3",
    INSCRIPCION_RETRY_BASE_MS: "1", INSCRIPCION_RETRY_MAX_MS: "10",
    INSCRIPCION_RATE_LIMIT_PER_IP: "3", INSCRIPCION_RATE_LIMIT_GLOBAL: "20",
    INSCRIPCION_RATE_LIMIT_WINDOW_MS: "60000", INSCRIPCION_TRUST_PROXY: "false",
    TEST_RECEIVER_URL: `http://127.0.0.1:${receiver.address().port}` };
  function launch(args, overrides = {}) {
    const child = spawn(process.execPath, ["--import", pathToFileURL(preload).href, ...args], { env: { ...env, ...overrides }, windowsHide: true });
    children.push(child);
    let logs = "";
    child.stdout.on("data", chunk => { logs += chunk; });
    child.stderr.on("data", chunk => { logs += chunk; });
    return { child, logs: () => logs };
  }
  const api = launch([resolve("server/api.mjs")]);
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (api.child.exitCode !== null) throw new Error(api.logs());
    try {
      await fetch(base + "/api/forms/inscripcion", { signal: AbortSignal.timeout(500) });
      ready = true;
      break;
    } catch { await sleep(50); }
  }
  assert.ok(ready, api.logs());
  const payload = { nombres: "Prueba integración ficticia", correo: "test@example.com",
    programaAcademico: "Lic. en administracion", edad: "18-24",
    telefonoContacto: "3300000000", mediosSeleccionados: ["Facebook"] };
  const started = performance.now();
  const response = await fetch(base + "/api/forms/inscripcion", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(response.status, 202, api.logs());
  const body = await response.json();
  assert.equal(body.queued, true);
  assert.equal(body.success, true);
  t.diagnostic(`Confirmación local de recepción: ${Math.round(performance.now() - started)} ms`);
  // La API respondió sin depender de Google y el trabajo sobrevive sin worker.
  assert.equal(requests, 0);
  assert.equal(saved.size, 0);
  const pending = db.prepare("SELECT * FROM inscripciones WHERE id=?").get(body.requestId);
  assert.equal(pending.estado, "PENDING");
  assert.equal(pending.intentos, 0);
  assert.equal(db.prepare("SELECT count(*) AS n FROM intentos_envio").get().n, 0);
  const worker = launch([resolve("server/worker.mjs"), "--once"]);
  const [code] = await once(worker.child, "exit");
  assert.equal(code, 0, worker.logs());
  assert.equal(db.prepare("SELECT estado FROM inscripciones WHERE id=?").get(body.requestId).estado, "UNKNOWN");
  const retry = launch([resolve("server/worker.mjs"), "--once"]);
  const [retryCode] = await once(retry.child, "exit");
  assert.equal(retryCode, 0, retry.logs());
  const row = db.prepare("SELECT * FROM inscripciones WHERE id=?").get(body.requestId);
  assert.equal(row.estado, "SENT");
  assert.equal(row.google_response_id, "one-google-response");
  const attempts = db.prepare("SELECT * FROM intentos_envio WHERE inscripcion_id=? ORDER BY numero_intento").all(body.requestId);
  assert.deepEqual(attempts.map(a => a.estado), ["UNKNOWN", "SENT"]);
  assert.deepEqual(attempts.map(a => a.numero_intento), [1, 2]);
  assert.ok(attempts.every(a => JSON.parse(a.payload).correo === payload.correo));
  assert.equal(saved.size, 1);
  assert.equal(requests, 2);

  // El middleware cuenta también JSON inválido y no guarda peticiones bloqueadas.
  const spoof = await fetch(base + "/api/forms/inscripcion", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.1" }, body: "{}",
  });
  assert.equal(spoof.status, 400);
  for (let i = 0; i < 1; i++) {
    const invalid = await fetch(base + "/api/forms/inscripcion", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": `198.51.100.${i + 1}` }, body: "{}",
    });
    assert.equal(invalid.status, 400);
  }
  const limited = await fetch(base + "/api/forms/inscripcion", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "198.51.100.3" }, body: JSON.stringify(payload),
  });
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("Retry-After")) > 0);
  assert.equal((await limited.json()).success, false);
  const encoded = await fetch(base + "/api/forms/%69nscripcion", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
  });
  assert.equal(encoded.status, 429);
  assert.equal(db.prepare("SELECT count(*) AS n FROM inscripciones").get().n, 1);
  assert.equal(db.prepare("SELECT count(*) AS n FROM intentos_envio").get().n, 2);
  assert.equal((await fetch(base + "/formulario-inscripcion")).status, 404);
  assert.ok(existsSync("dist/formulario-inscripcion/index.html"));
  assert.equal(existsSync("dist/client"), false);
  assert.equal(existsSync("dist/server"), false);

  // Probar también el modo de producción con un proxy que fija X-Real-IP.
  portFinder.listen(0, "127.0.0.1");
  await once(portFinder, "listening");
  const proxyPort = portFinder.address().port;
  await new Promise(resolve => portFinder.close(resolve));
  const proxied = launch([resolve("server/api.mjs")], {
    API_PORT: String(proxyPort), INSCRIPCION_TRUST_PROXY: "true", INSCRIPCION_RATE_LIMIT_PER_IP: "1",
  });
  const proxyBase = `http://127.0.0.1:${proxyPort}`;
  let proxyReady = false;
  for (let i = 0; i < 100; i++) {
    if (proxied.child.exitCode !== null) throw new Error(proxied.logs());
    try { await fetch(proxyBase + "/api/forms/inscripcion", { signal: AbortSignal.timeout(500) }); proxyReady = true; break; }
    catch { await sleep(50); }
  }
  assert.ok(proxyReady, proxied.logs());
  const proxyPost = (real, forwarded) => fetch(proxyBase + "/api/forms/inscripcion", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": real, "X-Forwarded-For": forwarded }, body: "{}",
  });
  assert.equal((await proxyPost("192.0.2.1", "203.0.113.1")).status, 400);
  assert.equal((await proxyPost("192.0.2.1", "203.0.113.2")).status, 429);
  assert.equal((await proxyPost("192.0.2.2", "203.0.113.2")).status, 400);
  assert.equal(db.prepare("SELECT count(*) AS n FROM inscripciones").get().n, 1);
  const tooLarge = await fetch(proxyBase + "/api/forms/inscripcion", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "192.0.2.10" },
    body: "x".repeat(32769),
  });
  assert.equal(tooLarge.status, 413);
  const streamed = await fetch(proxyBase + "/api/forms/inscripcion", {
    method: "POST", headers: { "Content-Type": "application/json", "X-Real-IP": "192.0.2.11" },
    body: new ReadableStream({ start(controller) {
      controller.enqueue(new Uint8Array(20000));
      controller.enqueue(new Uint8Array(20000));
      controller.close();
    } }), duplex: "half",
  });
  assert.equal(streamed.status, 413);
  assert.equal((await fetch(proxyBase + "/api/forms/inscripcion")).status, 405);
  assert.equal((await fetch(proxyBase + "/_image")).status, 404);
  assert.equal((await fetch(proxyBase + "/_server-islands/test")).status, 404);

  // El sitio de desarrollo sigue usando la URL relativa del formulario.
  portFinder.listen(0, "127.0.0.1");
  await once(portFinder, "listening");
  const sitePort = portFinder.address().port;
  await new Promise(resolve => portFinder.close(resolve));
  const site = launch([resolve("node_modules/astro/astro.js"), "dev", "--host", "127.0.0.1", "--port", String(sitePort)]);
  const siteBase = `http://127.0.0.1:${sitePort}`;
  let siteReady = false;
  for (let i = 0; i < 100; i++) {
    if (site.child.exitCode !== null) throw new Error(site.logs());
    try {
      const ping = await fetch(siteBase + "/api/forms/inscripcion", { signal: AbortSignal.timeout(500) });
      if (ping.status === 405) { siteReady = true; break; }
    } catch { /* Esperar a que Vite esté listo. */ }
    await sleep(50);
  }
  assert.ok(siteReady, site.logs());
  const proxiedLimit = await fetch(siteBase + "/api/forms/inscripcion", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
  });
  assert.equal(proxiedLimit.status, 429);
  assert.equal(db.prepare("SELECT count(*) AS n FROM inscripciones").get().n, 1);
});
