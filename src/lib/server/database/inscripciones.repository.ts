
import { randomUUID } from "node:crypto";
import { db } from "./sqlite";

export type EstadoInscripcion =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "RETRY"
  | "FAILED"
  | "UNKNOWN";

export function crearInscripcion(data: unknown): string {
  const id = randomUUID();

  db.prepare(`
    INSERT INTO inscripciones
      (id, payload, estado)
    VALUES (?, ?, 'PENDING')
  `).run(id, JSON.stringify(data));

  return id;
}

export function actualizarEstado(
  id: string,
  estado: EstadoInscripcion,
  error?: string
): void {
  db.prepare(`
    UPDATE inscripciones
    SET estado = ?,
        ultimo_error = ?,
        updated_at = CURRENT_TIMESTAMP,
        enviado_at = CASE
          WHEN ? = 'SENT' THEN CURRENT_TIMESTAMP
          ELSE enviado_at
        END
    WHERE id = ?
  `).run(estado, error ?? null, estado, id);
}

export function registrarIntento(
  id: string,
  estado: string,
  httpStatus?: number,
  error?: string
): void {
  const transaction = db.transaction(() => {
    const row = db.prepare(`
      SELECT intentos
      FROM inscripciones
      WHERE id = ?
    `).get(id) as { intentos: number } | undefined;

    if (!row) {
      throw new Error("Inscripción no encontrada");
    }

    const intento = row.intentos + 1;

    db.prepare(`
      UPDATE inscripciones
      SET intentos = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(intento, id);

    db.prepare(`
      INSERT INTO intentos_envio
        (inscripcion_id, numero_intento, estado, http_status, error)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      id,
      intento,
      estado,
      httpStatus ?? null,
      error ?? null
    );
  });

  transaction();
}
