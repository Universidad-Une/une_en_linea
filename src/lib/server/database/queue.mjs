import { randomUUID } from "node:crypto";

export function crearCola(db, config, { now = Date.now, random = Math.random } = {}) {
  if (db.pragma("user_version", { simple: true }) !== 2) {
    throw new Error("SQLite requiere versión 2. Ejecuta npm run db:init antes de iniciar API y worker.");
  }
  const delay = (attempt) => Math.min(config.maxDelayMs,
    Math.round(config.baseDelayMs * 2 ** Math.min(attempt - 1, 30) * (0.8 + random() * 0.4)));

  function reservar(row, time) {
    const token = randomUUID();
    const attempt = row.intentos + 1;
    db.prepare(`UPDATE inscripciones SET estado='PROCESSING', intentos=?,
      lease_token=?, lease_until=?, next_attempt_at=NULL, updated_at=CURRENT_TIMESTAMP
      WHERE id=?`).run(attempt, token, time + config.leaseMs, row.id);
    db.prepare(`INSERT INTO intentos_envio
      (inscripcion_id, numero_intento, payload, estado) VALUES (?, ?, ?, 'PROCESSING')`)
      .run(row.id, attempt, row.payload);
    return { id: row.id, payload: row.payload, attempt, token };
  }

  const crearYReservar = db.transaction((data) => {
    const id = randomUUID();
    const payload = JSON.stringify(data);
    db.prepare(`INSERT INTO inscripciones (id, payload, retry_enabled) VALUES (?, ?, 1)`)
      .run(id, payload);
    return reservar({ id, payload, intentos: 0 }, now());
  });

  // La API solo confirma recepción duradera. El worker inicia el primer envío.
  const encolar = db.transaction((data) => {
    const id = randomUUID();
    db.prepare(`INSERT INTO inscripciones
      (id, payload, retry_enabled, next_attempt_at) VALUES (?, ?, 1, ?)`)
      .run(id, JSON.stringify(data), now());
    return { id };
  });

  // Recuperar y reservar usan BEGIN IMMEDIATE: dos procesos nunca reclaman
  // el mismo intento. El token impide que un proceso antiguo cierre otro intento.
  const tomarSiguiente = db.transaction(() => {
    const time = now();
    const expired = db.prepare(`SELECT * FROM inscripciones WHERE retry_enabled=1
      AND estado='PROCESSING' AND lease_until<=?`).all(time);
    for (const row of expired) {
      db.prepare(`UPDATE intentos_envio SET estado='UNKNOWN', error='PROCESS_INTERRUPTED',
        finished_at=CURRENT_TIMESTAMP WHERE inscripcion_id=? AND numero_intento=? AND estado='PROCESSING'`)
        .run(row.id, row.intentos);
      const exhausted = row.intentos >= config.maxAttempts;
      db.prepare(`UPDATE inscripciones SET estado='UNKNOWN', ultimo_error='PROCESS_INTERRUPTED',
        lease_token=NULL, lease_until=NULL, next_attempt_at=?, needs_review=?,
        updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(exhausted ? null : time + delay(row.intentos), exhausted ? 1 : 0, row.id);
    }
    // También respeta un límite reducido después de reiniciar el worker.
    db.prepare(`UPDATE inscripciones SET needs_review=1, next_attempt_at=NULL,
      updated_at=CURRENT_TIMESTAMP WHERE retry_enabled=1 AND needs_review=0
      AND estado IN ('RETRY','UNKNOWN','PENDING') AND intentos>=?`).run(config.maxAttempts);
    const row = db.prepare(`SELECT * FROM inscripciones WHERE retry_enabled=1 AND needs_review=0
      AND estado IN ('PENDING','RETRY','UNKNOWN') AND next_attempt_at<=? AND intentos<?
      ORDER BY next_attempt_at, created_at LIMIT 1`).get(time, config.maxAttempts);
    return row ? reservar(row, time) : null;
  });

  const finalizar = db.transaction((job, result) => {
    const row = db.prepare(`SELECT * FROM inscripciones WHERE id=? AND estado='PROCESSING'
      AND lease_token=?`).get(job.id, job.token);
    if (!row) return false;
    const retry = result.estado === "RETRY" || result.estado === "UNKNOWN";
    const exhausted = retry && row.intentos >= config.maxAttempts;
    const next = retry && !exhausted
      ? now() + Math.max(delay(row.intentos), result.retryAfterMs || 0) : null;
    db.prepare(`UPDATE intentos_envio SET estado=?, http_status=?, error=?, finished_at=CURRENT_TIMESTAMP
      WHERE inscripcion_id=? AND numero_intento=? AND estado='PROCESSING'`)
      .run(result.estado, result.httpStatus ?? null, result.error ?? null, job.id, job.attempt);
    db.prepare(`UPDATE inscripciones SET estado=?, ultimo_error=?, next_attempt_at=?,
      needs_review=?, google_response_id=COALESCE(?,google_response_id),
      lease_token=NULL, lease_until=NULL, updated_at=CURRENT_TIMESTAMP,
      enviado_at=CASE WHEN ?='SENT' THEN CURRENT_TIMESTAMP ELSE enviado_at END WHERE id=?`)
      .run(result.estado, result.error ?? null, next, exhausted || result.estado === "FAILED" ? 1 : 0,
        result.responseId ?? null, result.estado, job.id);
    return true;
  });

  return {
    encolar: (data) => encolar.immediate(data),
    crearYReservar: (data) => crearYReservar.immediate(data),
    tomarSiguiente: () => tomarSiguiente.immediate(),
    finalizar: (job, result) => finalizar.immediate(job, result),
  };
}
