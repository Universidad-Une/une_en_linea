import { validarInscripcion } from "../../server/inscripcion.js";

export function configuracionEnv(env = process.env) {
  const number = (name, fallback) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isSafeInteger(value) || value < 1) throw new Error(`Configuración inválida: ${name}`);
    return value;
  };
  const config = {
    url: env.GOOGLE_FORMS_SCRIPT_URL,
    secret: env.GOOGLE_FORMS_SHARED_SECRET,
    maxAttempts: number("INSCRIPCION_MAX_ATTEMPTS", 5),
    baseDelayMs: number("INSCRIPCION_RETRY_BASE_MS", 60000),
    maxDelayMs: number("INSCRIPCION_RETRY_MAX_MS", 3600000),
    pollMs: number("INSCRIPCION_POLL_MS", 5000),
    timeoutMs: 25000,
    leaseMs: 90000,
  };
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(config.url || "") ||
      !config.secret || config.secret.length < 32 || config.maxDelayMs < config.baseDelayMs) {
    throw new Error("Revisa la configuración del receptor y los intervalos de inscripción.");
  }
  return config;
}

const permanent = new Set([
  "INVALID_DATA", "INVALID_REQUEST_ID", "INVALID_REQUEST", "INVALID_JSON",
  "UNAUTHORIZED", "SERVER_NOT_CONFIGURED", "REQUEST_ID_NOT_CONFIGURED",
  "FORM_SCHEMA_CHANGED", "FORM_CLOSED",
]);

export async function enviarInscripcion(job, config, fetchImpl = fetch) {
  let data;
  try {
    data = JSON.parse(job.payload);
    if (Object.keys(validarInscripcion(data).errors).length) throw new Error();
  } catch {
    return { estado: "FAILED", error: "INVALID_STORED_PAYLOAD" };
  }
  let response;
  try {
    response = await fetchImpl(config.url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: config.secret, requestId: job.id, data }),
      redirect: "follow", signal: AbortSignal.timeout(config.timeoutMs),
    });
    const retryAfter = response.headers.get("retry-after");
    const seconds = Number(retryAfter);
    const retryAfterMs = retryAfter ? Math.max(0, Number.isFinite(seconds)
      ? seconds * 1000 : Date.parse(retryAfter) - Date.now()) : 0;
    // HTML de un proxy y errores HTTP no se interpretan como confirmaciones.
    if (response.status === 429 || response.status === 503) {
      return { estado: "RETRY", error: `HTTP_${response.status}`, httpStatus: response.status,
        retryAfterMs: Number.isFinite(retryAfterMs) ? retryAfterMs : 0 };
    }
    const result = await response.json();
    if (response.ok && result?.success === true && result.requestId === job.id &&
        typeof result.responseId === "string" && result.responseId.length > 0) {
      return { estado: "SENT", responseId: result.responseId, httpStatus: response.status };
    }
    const code = typeof result?.error === "string" ? result.error : "GOOGLE_NOT_CONFIRMED";
    // Solo persistir códigos conocidos, nunca respuestas remotas o datos personales.
    const error = permanent.has(code) || ["RECEIVER_BUSY", "FORM_SUBMISSION_FAILED"].includes(code)
      ? code : "GOOGLE_NOT_CONFIRMED";
    return { estado: response.ok && permanent.has(code) ? "FAILED" : code === "RECEIVER_BUSY" ? "RETRY" : "UNKNOWN",
      error, httpStatus: response.status };
  } catch {
    return { estado: "UNKNOWN", error: "GOOGLE_RESPONSE_UNCONFIRMED", httpStatus: response?.status };
  }
}

export async function procesarTrabajo(cola, job, config, fetchImpl = fetch) {
  const result = await enviarInscripcion(job, config, fetchImpl);
  if (!cola.finalizar(job, result)) throw new Error("La reserva del trabajo ya no pertenece a este proceso.");
  return result;
}
