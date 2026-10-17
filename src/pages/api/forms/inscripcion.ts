import type { APIRoute } from "astro";
import { CAMPOS_INSCRIPCION, validarInscripcion } from "../../../server/inscripcion.js";

export const prerender = false;
const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

export const POST: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ success: false, message: "Se requiere JSON." }, 415);
  }
  let payload;
  try {
    const text = await request.text();
    if (text.length > 32768)
      return json(
        { success: false, message: "Solicitud demasiado grande." },
        413,
      );
    payload = JSON.parse(text);
  } catch {
    return json({ success: false, message: "JSON inválido." }, 400);
  }
  const { data, errors } = validarInscripcion(payload);
  if (Object.keys(errors).length)
    return json(
      {
        success: false,
        fields: errors,
        message: `Revisa los campos: ${Object.keys(errors).join(", ")}.`,
      },
      400,
    );

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
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, data }),
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    });
    const result = await response.json();
    if (
      response.ok &&
      result.success === true &&
      typeof result.responseId === "string"
    ) {
      return json({ success: true }, 200);
    }
    if (result.error === "INVALID_DATA")
      return json(
        {
          success: false,
          message: `Google Forms rechazó estos campos: ${Object.keys(result.fields || {}).join(", ") || "revisa tus datos"}.`,
        },
        400,
      );
    const schema = result.schema;
    const campoSchema = schema && CAMPOS_INSCRIPCION.find(
      ([campo, id]) => campo === schema.field && id === schema.id,
    );
    const detalleSchema = campoSchema &&
      ["TEXT", "LIST", "MULTIPLE_CHOICE", "CHECKBOX", "DATE", "PARAGRAPH_TEXT"].includes(schema.expected) &&
      ["TEXT", "LIST", "MULTIPLE_CHOICE", "CHECKBOX", "DATE", "PARAGRAPH_TEXT", "MISSING"].includes(schema.actual)
      ? ` Pregunta: ${campoSchema[4]} (ID ${campoSchema[1]}). Tipo esperado por Apps Script publicado: ${schema.expected}; tipo encontrado: ${schema.actual}.`
      : "";
    const erroresReceptor: Record<string, string> = {
      UNAUTHORIZED: "UNAUTHORIZED: la clave no coincide con SHARED_SECRET en Apps Script.",
      SERVER_NOT_CONFIGURED: "SERVER_NOT_CONFIGURED: revisa FORM_ID y SHARED_SECRET en las propiedades de Apps Script.",
      FORM_SCHEMA_CHANGED: "FORM_SCHEMA_CHANGED: los IDs o tipos de preguntas no coinciden con el formulario de Google." + detalleSchema,
      FORM_CLOSED: "FORM_CLOSED: el formulario de Google no acepta respuestas.",
      FORM_SUBMISSION_FAILED: "FORM_SUBMISSION_FAILED: Apps Script falló al abrir el formulario o guardar la respuesta. Revisa FORM_ID y los permisos de la implementación.",
    };
    return json(
      {
        success: false,
        message: erroresReceptor[result.error] ||
          "Google Forms no confirmó el registro. Revisa la configuración del receptor.",
      },
      502,
    );
  } catch {
    return json(
      {
        success: false,
        message:
          "No pudimos confirmar el registro. Antes de repetir el envío, verifica si ya se guardó.",
      },
      502,
    );
  }
};
