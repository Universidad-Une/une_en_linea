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

// headers: req.headers de node:http (claves en minúsculas).
export function identificarIp(headers, socketAddress, trustProxy) {
  if (trustProxy) {
    // Solo activar con Node inaccesible desde Internet y un proxy que
    // sobrescriba X-Real-IP. Nunca usar un X-Forwarded-For arbitrario.
    return normalizarIp(headers["x-real-ip"]);
  }
  // En modo directo todos los encabezados de IP del cliente se ignoran.
  return normalizarIp(socketAddress);
}

const rechazo = (status, message, retryAfter) => ({ status, message, retryAfter });

export function crearProteccionRateLimit(config, now = Date.now) {
  const ips = new Map();
  const global = [];
  let nextSweep = 0;
  const prune = (times, time) => {
    while (times.length && times[0] <= time - config.windowMs) times.shift();
  };
  const denied = (times, time) => rechazo(429,
    "Has realizado demasiadas solicitudes. Espera un momento antes de volver a intentarlo.",
    Math.max(1, Math.ceil((times[0] + config.windowMs - time) / 1000)));

  // Devuelve null si se admite, o { status, message, retryAfter? } si se rechaza.
  // Se llama antes de leer el cuerpo: cuenta también JSON y datos inválidos.
  return (headers, socketAddress) => {
    const ip = identificarIp(headers, socketAddress, config.trustProxy);
    if (!ip) return rechazo(400, "No se pudo verificar el origen de la conexión.");
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
      if (ips.size >= config.maxKeys) return rechazo(429, "El servicio está ocupado. Inténtalo más tarde.", 10);
      times = [];
      ips.set(ip, times);
    }
    // Los rechazos por IP no consumen el cupo global de otros usuarios.
    times.push(time);
    global.push(time);
    return null;
  };
}
