CREATE TABLE inscripciones (
  id TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  estado TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (estado IN ('PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED', 'UNKNOWN')),
  intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
  ultimo_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  enviado_at TEXT
);

CREATE TABLE intentos_envio (
  id INTEGER PRIMARY KEY,
  inscripcion_id TEXT NOT NULL REFERENCES inscripciones(id),
  numero_intento INTEGER NOT NULL CHECK (numero_intento > 0),
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  estado TEXT NOT NULL
    CHECK (estado IN ('PENDING', 'PROCESSING', 'SENT', 'RETRY', 'FAILED', 'UNKNOWN')),
  http_status INTEGER,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (inscripcion_id, numero_intento)
);

CREATE INDEX inscripciones_estado ON inscripciones(estado, created_at);
