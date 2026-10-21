-- Las solicitudes anteriores NO se habilitan automáticamente: pueden haberse
-- enviado a Google con el receptor antiguo, sin deduplicación.
ALTER TABLE inscripciones ADD COLUMN retry_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inscripciones ADD COLUMN next_attempt_at INTEGER;
ALTER TABLE inscripciones ADD COLUMN lease_until INTEGER;
ALTER TABLE inscripciones ADD COLUMN lease_token TEXT;
ALTER TABLE inscripciones ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0;
ALTER TABLE inscripciones ADD COLUMN google_response_id TEXT;
ALTER TABLE intentos_envio ADD COLUMN finished_at TEXT;
CREATE INDEX inscripciones_pendientes
  ON inscripciones(retry_enabled, needs_review, estado, next_attempt_at);
