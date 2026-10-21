import { createServer } from "node:http";
import { db } from "./db/sqlite.mjs";
import { crearCola } from "./db/cola.mjs";
import { configuracionEnv } from "./inscripcion/entrega.mjs";
import { configuracionRateLimit, crearProteccionRateLimit } from "./inscripcion/rate-limit.mjs";
import { validarInscripcion } from "./inscripcion/validacion.mjs";

const config = configuracionEnv();
const cola = crearCola(db, config);
const protect = crearProteccionRateLimit(configuracionRateLimit());
const port = Number(process.env.API_PORT || 4322);
const host = process.env.API_HOST || "127.0.0.1";
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("API_PORT inválido.");

function send(req, res, status, body, extra = {}) {
  // No mantener conexiones con cuerpos rechazados sin consumir.
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store",
    "Connection": "close", ...extra });
  res.once("finish", () => { if (!req.complete) req.destroy(); });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    const chunks = [];
    const fail = (status) => { cleanup(); req.pause(); reject(Object.assign(new Error(), { status })); };
    const onData = (chunk) => {
      bytes += chunk.length;
      if (bytes > 32768) return fail(413);
      chunks.push(chunk);
    };
    const onEnd = () => { cleanup(); resolve(Buffer.concat(chunks).toString("utf8")); };
    const onError = () => fail(400);
    const timer = setTimeout(() => fail(408), 10000);
    function cleanup() {
      clearTimeout(timer);
      req.off("data", onData); req.off("end", onEnd); req.off("error", onError); req.off("aborted", onError);
    }
    req.on("data", onData); req.once("end", onEnd); req.once("error", onError); req.once("aborted", onError);
  });
}

const server = createServer(async (req, res) => {
  try {
    // Origen fijo: no confiar en Host/X-Forwarded-Host para construir la URL.
    const url = new URL(req.url, "http://localhost");
    let pathname;
    try { pathname = decodeURI(url.pathname).replace(/\/+$/, ""); }
    catch { return send(req, res, 400, { success: false, message: "Ruta inválida." }); }
    if (pathname !== "/api/forms/inscripcion") return send(req, res, 404, { success: false, message: "Ruta no encontrada." });
    if (req.method !== "POST") return send(req, res, 405, { success: false, message: "Se requiere POST." }, { Allow: "POST" });
    const request = new Request(url, { method: "POST", headers: req.headers });
    const rejection = protect(request, req.socket.remoteAddress);
    if (rejection) {
      return send(req, res, rejection.status, await rejection.json(),
        rejection.headers.has("Retry-After") ? { "Retry-After": rejection.headers.get("Retry-After") } : {});
    }
    const type = (req.headers["content-type"] || "").split(";")[0].trim().toLowerCase();
    if (type !== "application/json") return send(req, res, 415, { success: false, message: "Se requiere JSON." });
    if (Number(req.headers["content-length"]) > 32768) return send(req, res, 413, { success: false, message: "Solicitud demasiado grande." });
    let payload;
    try { payload = JSON.parse(await readBody(req)); }
    catch (error) {
      const status = error.status || 400;
      return send(req, res, status, { success: false, message: status === 413 ? "Solicitud demasiado grande." : status === 408 ? "Se agotó el tiempo de lectura." : "JSON inválido." });
    }
    const { data, errors } = validarInscripcion(payload);
    if (Object.keys(errors).length) return send(req, res, 400, { success: false, fields: errors, message: `Revisa los campos: ${Object.keys(errors).join(", ")}.` });
    const job = cola.encolar(data);
    console.info(`[Inscripcion:${job.id}] PENDING`);
    return send(req, res, 202, { success: true, queued: true, requestId: job.id, message: "Tu solicitud fue recibida. Estamos procesando su envío." });
  } catch {
    console.error("[API] No se pudo procesar la solicitud.");
    if (!res.headersSent) send(req, res, 503, { success: false, message: "No pudimos registrar tu solicitud. Inténtalo nuevamente." });
    else res.destroy();
  }
});
server.headersTimeout = 10000;
server.requestTimeout = 15000;
server.maxHeadersCount = 50;
server.on("error", () => { console.error("[API] No se pudo iniciar el servidor."); db.close(); process.exitCode = 1; });
server.listen(port, host, () => console.info(`[API] Escuchando en ${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => { server.close(() => db.close()); });
}
