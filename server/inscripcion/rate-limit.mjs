import { isIP } from "node:net";

export function configuracionRateLimit(env = process.env) {
  const integer = (name, fallback, max) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1 || value > max) {
      throw new Error(`Configuración inválida: ${name}`);
    }
    return value;
  };
  const trust = env.INSCRIPCION_TRUST_PROXY ?? "false";
  if (trust !== "true" && trust !== "false") throw new Error("INSCRIPCION_TRUST_PROXY debe ser true o false.");
  return {
    perIp: integer("INSCRIPCION_RATE_LIMIT_PER_IP", 5, 1000),
    global: integer("INSCRIPCION_RATE_LIMIT_GLOBAL", 60, 100000),
    windowMs: integer("INSCRIPCION_RATE_LIMIT_WINDOW_MS", 60000, 86400000),
    maxKeys: 10000,
    trustProxy: trust === "true",
  };
}

export function esPostInscripcion(request) {
  if (request.method !== "POST") return false;
  try {
    // Astro decodifica la ruta antes de resolver el endpoint.
    return decodeURI(new URL(request.url).pathname).replace(/\/+$/, "") === "/api/forms/inscripcion";
  } catch { return false; }
}

function normalizarIp(value) {
  if (typeof value !== "string" || value.length > 64) return null;
  const ip = value.trim();
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6 || ip.includes("%")) return null;
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  // Unificar IPv4 y su representación IPv6 para evitar contadores distintos.
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return [high >> 8, high & 255, low >> 8, low & 255].join(".");
  }
  return canonical;
}

export function identificarIp(request, clientAddress, trustProxy) {
  if (trustProxy) {
    // Solo activar con Node inaccesible desde Internet y un proxy que
    // sobrescriba X-Real-IP. Nunca usar un X-Forwarded-For arbitrario.
    return normalizarIp(request.headers.get("x-real-ip"));
  }
  // El servidor independiente entrega req.socket.remoteAddress, no el XFF.
  // En modo directo todos los encabezados de IP del cliente se ignoran.
  return normalizarIp(clientAddress);
}

function json(status, message, retryAfter) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (retryAfter !== undefined) headers["Retry-After"] = String(retryAfter);
  return new Response(JSON.stringify({ success: false, message }), { status, headers });
}

export function crearProteccionRateLimit(config, now = Date.now) {
  const ips = new Map();
  const global = [];
  let nextSweep = 0;
  const prune = (times, time) => {
    while (times.length && times[0] <= time - config.windowMs) times.shift();
  };
  const denied = (times, time) => json(429,
    "Has realizado demasiadas solicitudes. Espera un momento antes de volver a intentarlo.",
    Math.max(1, Math.ceil((times[0] + config.windowMs - time) / 1000)));

  return (request, clientAddress) => {
    if (!esPostInscripcion(request)) return null;
    const ip = identificarIp(request, clientAddress, config.trustProxy);
    if (!ip) return json(400, "No se pudo verificar el origen de la conexión.");
    const time = now();
    if (time >= nextSweep) {
      for (const [key, times] of ips) {
        prune(times, time);
        if (!times.length) ips.delete(key);
      }
      nextSweep = time + Math.min(config.windowMs, 10000);
    }
    let times = ips.get(ip);
    if (times) {
      prune(times, time);
      if (times.length >= config.perIp) return denied(times, time);
    }
    prune(global, time);
    if (global.length >= config.global) return denied(global, time);
    if (!times) {
      if (ips.size >= config.maxKeys) return json(429, "El servicio está ocupado. Inténtalo más tarde.", 10);
      times = [];
      ips.set(ip, times);
    }
    // Contar antes de validar/leer el cuerpo, también JSON y datos inválidos.
    // Los rechazos por IP no consumen el cupo global de otros usuarios.
    times.push(time);
    global.push(time);
    return null;
  };
}
