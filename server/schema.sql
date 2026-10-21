-- Esquema versión 1 (PRAGMA user_version). Un cambio de esquema futuro sube la
-- versión en db.mjs y agrega su ALTER correspondiente; no editar tablas ya creadas.
CREATE TABLE inscripciones (
  id TEXT PRIMARY KEY NOT NULL,                 -- UUID; es el requestId enviado a Apps Script
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  estado TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (estado IN ('PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED', 'UNKNOWN')),
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ultimo_error TEXT,
  next_attempt_at INTEGER,                      -- ms Unix; NULL = no se reintenta
  lease_until INTEGER,                          -- ms Unix; reserva del worker
  lease_token TEXT,
  needs_review INTEGER NOT NULL DEFAULT 0,
  google_response_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_at TEXT
);

CREATE TABLE intentos_envio (
  id INTEGER PRIMARY KEY,
  inscripcion_id TEXT NOT NULL REFERENCES inscripciones(id),
  numero_intento INTEGER NOT NULL CHECK (numero_intento > 0),
  estado TEXT NOT NULL
    CHECK (estado IN ('PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED', 'UNKNOWN')),
  http_status INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  UNIQUE (inscripcion_id, numero_intento)
);

CREATE INDEX inscripciones_estado ON inscripciones(estado, created_at);
CREATE INDEX inscripciones_pendientes ON inscripciones(needs_review, estado, next_attempt_at);
