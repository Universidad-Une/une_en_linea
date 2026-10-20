
import type { APIRoute } from "astro";
import {
  CAMPOS_INSCRIPCION,
  validarInscripcion,
} from "../../../server/inscripcion.js";

import {
  crearInscripcion,
  actualizarEstado,
  registrarIntento,
} from "../../../lib/server/database/inscripciones.repository";

export const prerender = false;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

const registrarResultado = (
  id: string,
  estado: "SENT" | "FAILED" | "UNKNOWN",
  httpStatus?: number,
  error?: string,
) => {
  registrarIntento(id, estado, httpStatus, error);
  actualizarEstado(id, estado, error);
};

export const POST: APIRoute = async ({ request }) => {
  // 1. Validar Content-Type.
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json(
      { success: false, message: "Se requiere JSON." },
      415,
    );
  }

  // 2. Leer y analizar el payload.
  let payload: unknown;

  try {
    const text = await request.text();

    if (text.length > 32768) {
      return json(
        {
          success: false,
          message: "Solicitud demasiado grande.",
        },
        413,
      );
    }

    payload = JSON.parse(text);
  } catch {
    return json(
      {
        success: false,
        message: "JSON inválido.",
      },
      400,
    );
  }

  // 3. Validar los campos del formulario.
  const { data, errors } = validarInscripcion(payload);

  if (Object.keys(errors).length) {
    return json(
      {
        success: false,
        fields: errors,
        message: `Revisa los campos: ${Object.keys(errors).join(", ")}.`,
      },
      400,
    );
  }

  // 4. Obtener configuración de Google Apps Script.
  const url =
    process.env.GOOGLE_FORMS_SCRIPT_URL ||
    import.meta.env.GOOGLE_FORMS_SCRIPT_URL;

  const secret =
    process.env.GOOGLE_FORMS_SHARED_SECRET ||
    import.meta.env.GOOGLE_FORMS_SHARED_SECRET;

  if (
    !url ||
    !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url) ||
    !secret ||
    secret.length < 32
  ) {
    return json(
      {
        success: false,
        message: "El servicio de inscripción no está configurado.",
      },
      503,
    );
  }

  // 5. Persistir la inscripción en SQLite.
  let inscripcionId: string;

  try {
    inscripcionId = crearInscripcion(data);

    console.info(
      `[Inscripcion] Registro guardado: ${inscripcionId}`,
    );
  } catch (error) {
    console.error(
      "[Inscripcion] Error al guardar en SQLite:",
      error,
    );

    return json(
      {
        success: false,
        message:
          "No pudimos registrar tu solicitud. Inténtalo nuevamente.",
      },
      503,
    );
  }

  // 6. Registrar que comienza el procesamiento.
  try {
    actualizarEstado(inscripcionId, "PROCESSING");
  } catch (error) {
    console.error(
      `[Inscripcion:${inscripcionId}] Error de SQLite:`,
      error,
    );

    return json(
      {
        success: false,
        message:
          "Tu solicitud fue recibida, pero no pudo procesarse.",
      },
      503,
    );
  }

  // 7. Enviar a Google Apps Script.
  let response: Response | undefined;
  let result: any;

  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        secret,
        data,
      }),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });

    result = await response.json();
  } catch (error) {
    console.error(
      `[Inscripcion:${inscripcionId}] Resultado de Google desconocido:`,
      error,
    );

    try {
      registrarResultado(
        inscripcionId,
        "UNKNOWN",
        response?.status,
        "No se pudo confirmar la respuesta de Google",
      );
    } catch (dbError) {
      console.error(
        `[Inscripcion:${inscripcionId}] No se pudo registrar UNKNOWN:`,
        dbError,
      );
    }

    if (!response) {
  return json(
    {
      success: false,
      message: "No se recibió respuesta del servicio externo.",
    },
    502,
  );
}

  // 8. Google confirmó el registro.
  if (
    response.ok &&
    result?.success === true &&
    typeof result.responseId === "string"
  ) {
    try {
      registrarResultado(
        inscripcionId,
        "SENT",
        response.status,
      );
    } catch (error) {
      console.error(
        `[Inscripcion:${inscripcionId}] Google confirmó el registro, pero SQLite no pudo actualizarse:`,
        error,
      );

      // No convertir una confirmación válida en un error
      // que provoque que el usuario repita la inscripción.
    }

    console.info(
      `[Inscripcion:${inscripcionId}] Confirmada por Google Forms`,
    );

    return json({ success: true }, 200);
  }

  // 9. Google rechazó explícitamente la validación.
  if (result?.error === "INVALID_DATA") {
    try {
      registrarResultado(
        inscripcionId,
        "FAILED",
        response.status,
        "INVALID_DATA",
      );
    } catch (error) {
      console.error(
        `[Inscripcion:${inscripcionId}] Error registrando rechazo:`,
        error,
      );
    }

    return json(
      {
        success: false,
        message:
          `Google Forms rechazó estos campos: ${
            Object.keys(result.fields || {}).join(", ") ||
            "revisa tus datos"
          }.`,
      },
      400,
    );
  }

  // 10. Interpretar errores del receptor.
  const schema = result?.schema;

  const campoSchema =
    schema &&
    CAMPOS_INSCRIPCION.find(
      ([campo, id]) =>
        campo === schema.field && id === schema.id,
    );

  const detalleSchema =
    campoSchema &&
    [
      "TEXT",
      "LIST",
      "MULTIPLE_CHOICE",
      "CHECKBOX",
      "DATE",
      "PARAGRAPH_TEXT",
    ].includes(schema.expected) &&
    [
      "TEXT",
      "LIST",
      "MULTIPLE_CHOICE",
      "CHECKBOX",
      "DATE",
      "PARAGRAPH_TEXT",
      "MISSING",
    ].includes(schema.actual)
      ? ` Pregunta: ${campoSchema[4]} (ID ${campoSchema[1]}). Tipo esperado por Apps Script publicado: ${schema.expected}; tipo encontrado: ${schema.actual}.`
      : "";

  const erroresReceptor: Record<string, string> = {
    UNAUTHORIZED:
      "UNAUTHORIZED: la clave no coincide con SHARED_SECRET en Apps Script.",

    SERVER_NOT_CONFIGURED:
      "SERVER_NOT_CONFIGURED: revisa FORM_ID y SHARED_SECRET en las propiedades de Apps Script.",

    FORM_SCHEMA_CHANGED:
      "FORM_SCHEMA_CHANGED: los IDs o tipos de preguntas no coinciden con el formulario de Google." +
      detalleSchema,

    FORM_CLOSED:
      "FORM_CLOSED: el formulario de Google no acepta respuestas.",

    FORM_SUBMISSION_FAILED:
      "FORM_SUBMISSION_FAILED: Apps Script falló al abrir el formulario o guardar la respuesta. Revisa FORM_ID y los permisos de la implementación.",
  };

  const errorCode =
    typeof result?.error === "string"
      ? result.error
      : "GOOGLE_NOT_CONFIRMED";

  // Algunos errores representan rechazos definitivos.
  // Otros podrían haber ocurrido después de guardar
  // la respuesta en Google y requieren conciliación.
  const erroresDefinitivos = new Set([
    "UNAUTHORIZED",
    "SERVER_NOT_CONFIGURED",
    "FORM_SCHEMA_CHANGED",
    "FORM_CLOSED",
  ]);

  const estado =
    erroresDefinitivos.has(errorCode)
      ? "FAILED"
      : "UNKNOWN";

  try {
    registrarResultado(
      inscripcionId,
      estado,
      response.status,
      errorCode,
    );
  } catch (error) {
    console.error(
      `[Inscripcion:${inscripcionId}] Error actualizando SQLite:`,
      error,
    );
  }

  console.error(
    `[Inscripcion:${inscripcionId}] Google no confirmó: ${errorCode}`,
  );

  return json(
    {
      success: false,
      message:
        erroresReceptor[errorCode] ||
        "Google Forms no confirmó el registro. Revisa la configuración del receptor.",
    },
    502,
  );
};
