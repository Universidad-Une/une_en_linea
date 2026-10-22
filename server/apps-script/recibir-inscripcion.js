// IDs de preguntas de Apps Script, no parámetros entry.*.
const CAMPOS_INSCRIPCION = [
  ["origenFormulario", 531603443, "TEXT", false, "Origen del formulario"],
  ["rutaProcedencia", 541397236, "TEXT", false, "Ruta de procedencia"],
  ["nombres", 685898033, "TEXT", true, "Nombre completo"],
  [
    "programaAcademico",
    1781497290,
    "MULTIPLE_CHOICE",
    true,
    "Programa Académico de interés:",
    [
      "Bachillerato en linea",
      "Lic. en administracion",
      "Lic. en ad de sistemas de informacion",
      "Lic. en contaduria",
      "Lic. en comercio y negocios globales",
      "Lic. en comunicacion",
      "Lic. en derecho",
      "Lic. en diseño grafico",
      "Lic. en educacion",
      "Ing. industrial",
      "Lic. en mercadotecnia",
      "Lic. en psicologia",
      "Maestria en administracion de negocios",
      "Maestria en educacion"
    ],
    false
  ],
  [
    "telefonoContacto",
    910929154,
    "TEXT",
    true,
    "Teléfono"
  ],
  [
    "correo",
    1898787164,
    "TEXT",
    true,
    "Correo electrónico"
  ],
  [
    "edad",
    894211712,
    "MULTIPLE_CHOICE",
    true,
    "Edad",
    [
      "18-24",
      "25 - 34",
      "35 - 44",
      "45 - 54",
      "55 +"
    ],
    false
  ],
  [
    "mediosSeleccionados",
    1017864200,
    "CHECKBOX",
    true,
    "¿Cómo nos conociste?",
    [
      "Facebook",
      "Instragram",
      "Television",
      "Radio",
      "Espectacular",
      "Recomendacion",
      "Sesion, expos o ferias",
      "Volante o activacion",
      "Soy ex alumno"
    ],
    true
  ]
];

function respuestaJson_(contenido) {
  return ContentService.createTextOutput(JSON.stringify(contenido)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function objeto_(valor) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

function validarDatosInscripcion_(datos) {
  const valores = {};
  const errores = {};
  for (const [campo, , tipo, obligatorio, , opciones = [], permiteOtro = false] of CAMPOS_INSCRIPCION) {
    const original = datos[campo];
    if (tipo === "CHECKBOX") {
      const lista = original === undefined ? [] : original;
      if (!Array.isArray(lista) || lista.some(v => typeof v !== "string" || !v.trim() || v.length > 500)) {
        errores[campo] = "EXPECTED_ARRAY";
        continue;
      }
      valores[campo] = lista.map(v => v.trim());
      if (obligatorio && !lista.length) errores[campo] = "REQUIRED";
      else if (lista.length > opciones.length + (permiteOtro ? 1 : 0) || valores[campo].filter(v => !opciones.includes(v)).length > (permiteOtro ? 1 : 0)) errores[campo] = "INVALID_OPTION";
      else if (new Set(valores[campo]).size !== lista.length) errores[campo] = "DUPLICATE_SELECTION";
      continue;
    }
    if (original !== undefined && typeof original !== "string") {
      errores[campo] = "EXPECTED_STRING";
      continue;
    }
    const valor = (original || "").trim();
    valores[campo] = valor;
    if (obligatorio && !valor) errores[campo] = "REQUIRED";
    else if (valor.length > 500) errores[campo] = "TOO_LONG";
    else if (tipo === "MULTIPLE_CHOICE" && !opciones.includes(valor))
      errores[campo] = "INVALID_OPTION";
  }
  if (valores.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valores.correo))
    errores.correo = "INVALID_EMAIL";
  if (valores.telefonoContacto && !/^[0-9]{10}$/.test(valores.telefonoContacto))
    errores.telefonoContacto = "INVALID_PHONE";
  return { valores, errores };
}

// Los reintentos de un mismo requestId llegan en minutos u horas, así que solo se revisan
// las respuestas recientes en vez de todo el historial del formulario. La propiedad
// opcional DEDUP_DIAS amplía la ventana si el worker estuvo detenido más tiempo.
const DEDUP_DIAS_PREDETERMINADO = 7;

function diasDeduplicacion_(valor) {
  const dias = Number(valor);
  return Number.isInteger(dias) && dias > 0 && dias <= 3650 ? dias : DEDUP_DIAS_PREDETERMINADO;
}

function buscarRespuestaPorSolicitud_(form, requestId, itemId, dias) {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const recientes = form.getResponses(desde);
  // De la más nueva a la más vieja: el duplicado casi siempre es de hace minutos.
  for (let i = recientes.length - 1; i >= 0; i--) {
    const item = recientes[i].getItemResponses().find(
      (r) => r.getItem().getId() === itemId,
    );
    if (item && item.getResponse() === requestId) return recientes[i].getId();
  }
  return null;
}

// Ejecutar manualmente después de crear la pregunta técnica en Google Forms.
function obtenerIdSolicitud() {
  const formId = PropertiesService.getScriptProperties().getProperty("FORM_ID");
  if (!formId) throw new Error("Falta configurar FORM_ID en las propiedades del script.");
  const form = FormApp.openById(formId);
  const coincidencias = [];
  for (const item of form.getItems()) {
    const titulo = item.getTitle();
    const detalle = { titulo, id: item.getId(), tipo: String(item.getType()) };
    console.log(JSON.stringify(detalle));
    if (titulo.trim().replace(/\s+/g, " ").toLowerCase() === "id de solicitud") {
      coincidencias.push(detalle);
    }
  }
  if (coincidencias.length === 0) {
    throw new Error('No se encontró "ID de solicitud". Crea y guarda esa pregunta en el formulario indicado por FORM_ID. Revisa arriba los títulos de ese formulario.');
  }
  if (coincidencias.length > 1) {
    throw new Error('Hay varias preguntas "ID de solicitud". Conserva una sola para identificarla sin ambigüedad.');
  }
  if (coincidencias[0].tipo !== "TEXT") {
    throw new Error('La pregunta "ID de solicitud" debe ser de tipo Respuesta corta (TEXT).');
  }
  console.log("REQUEST_ID_ITEM_ID=" + coincidencias[0].id);
  return coincidencias[0].id;
}

function doPost(e) {
  const inicio = Date.now();
  let lock;
  let acquired = false;
  try {
    const propiedades = PropertiesService.getScriptProperties();
    const formId = propiedades.getProperty("FORM_ID");
    const secreto = propiedades.getProperty("SHARED_SECRET");
    if (!formId || !secreto || secreto.length < 32) {
      return respuestaJson_({ success: false, error: "SERVER_NOT_CONFIGURED" });
    }
    const contenido = e && e.postData && e.postData.contents;
    if (typeof contenido !== "string" || contenido.length > 32768) {
      return respuestaJson_({ success: false, error: "INVALID_REQUEST" });
    }
    let body;
    try {
      body = JSON.parse(contenido);
    } catch (_) {
      return respuestaJson_({ success: false, error: "INVALID_JSON" });
    }
    if (
      !objeto_(body) ||
      typeof body.secret !== "string" ||
      body.secret !== secreto
    ) {
      return respuestaJson_({ success: false, error: "UNAUTHORIZED" });
    }
    if (
      typeof body.requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)
    ) {
      return respuestaJson_({ success: false, error: "INVALID_REQUEST_ID" });
    }
    const requestId = body.requestId.toLowerCase();
    const itemIdValue = propiedades.getProperty("REQUEST_ID_ITEM_ID");
    const itemId = Number(itemIdValue);
    if (
      !itemIdValue || !/^\d+$/.test(itemIdValue) || !Number.isSafeInteger(itemId) ||
      CAMPOS_INSCRIPCION.some(([, id]) => id === itemId)
    ) {
      return respuestaJson_({ success: false, error: "REQUEST_ID_NOT_CONFIGURED" });
    }
    const form = FormApp.openById(formId);
    const requestItem = form.getItemById(itemId);
    if (!requestItem || String(requestItem.getType()) !== "TEXT") {
      return respuestaJson_({
        success: false, error: "FORM_SCHEMA_CHANGED",
        schema: { field: "requestId", id: itemId, expected: "TEXT", actual: requestItem ? String(requestItem.getType()) : "MISSING" },
      });
    }

    // El bloqueo de script abarca buscar y guardar, también entre UUID distintos.
    lock = LockService.getScriptLock();
    acquired = lock.tryLock(5000);
    if (!acquired) {
      return respuestaJson_({ success: false, error: "RECEIVER_BUSY" });
    }
    const previousId = buscarRespuestaPorSolicitud_(
      form, requestId, itemId, diasDeduplicacion_(propiedades.getProperty("DEDUP_DIAS")),
    );
    if (previousId) {
      return respuestaJson_({ success: true, requestId, responseId: previousId, deduplicated: true });
    }
    if (!objeto_(body.data)) {
      return respuestaJson_({ success: false, error: "INVALID_DATA" });
    }
    const { valores, errores } = validarDatosInscripcion_(body.data);
    if (Object.keys(errores).length) {
      return respuestaJson_({
        success: false,
        error: "INVALID_DATA",
        fields: errores,
      });
    }

    // En una aplicación web se abre por ID: no depender de getActiveForm().
    if (!form.isAcceptingResponses()) {
      return respuestaJson_({ success: false, error: "FORM_CLOSED" });
    }
    const respuestas = [];
    for (const [campo, id, tipo, obligatorio] of CAMPOS_INSCRIPCION) {
      const item = form.getItemById(id);
      if (!item || String(item.getType()) !== tipo) {
        return respuestaJson_({
          success: false,
          error: "FORM_SCHEMA_CHANGED",
          schema: {
            field: campo,
            id,
            expected: tipo,
            actual: item ? String(item.getType()) : "MISSING",
          },
        });
      }
      const pregunta =
        tipo === "LIST"
          ? item.asListItem()
          : tipo === "TEXT"
            ? item.asTextItem()
            : tipo === "DATE"
              ? item.asDateItem()
              : tipo === "CHECKBOX"
                ? item.asCheckboxItem()
                : item.asMultipleChoiceItem();
      const valor = valores[campo];
      if (valor === "" || (Array.isArray(valor) && valor.length === 0)) {
        if (obligatorio || pregunta.isRequired()) errores[campo] = "REQUIRED";
        continue;
      }
      if (
        tipo === "CHECKBOX" ||
        tipo === "MULTIPLE_CHOICE" ||
        tipo === "LIST"
      ) {
        const opciones = pregunta
          .getChoices()
          .map((opcion) => opcion.getValue());
        const seleccionadas = Array.isArray(valor) ? valor : [valor];
        const otras = seleccionadas.filter(
          (opcion) => !opciones.includes(opcion),
        );
        if (
          otras.length &&
          (tipo === "LIST" || !pregunta.hasOtherOption() || otras.length > 1)
        ) {
          errores[campo] = "INVALID_OPTION";
          continue;
        }
      }
      respuestas.push(pregunta.createResponse(valor));
    }
    if (Object.keys(errores).length) {
      return respuestaJson_({
        success: false,
        error: "INVALID_DATA",
        fields: errores,
      });
    }
    const respuesta = form.createResponse();
    respuesta.withItemResponse(requestItem.asTextItem().createResponse(requestId));
    respuestas.forEach((itemResponse) =>
      respuesta.withItemResponse(itemResponse),
    );
    const enviada = respuesta.submit();
    console.log(
      JSON.stringify({
        form: "inscripcion",
        status: "success",
        duration: Date.now() - inicio,
      }),
    );
    return respuestaJson_({ success: true, requestId, responseId: enviada.getId(), deduplicated: false });
  } catch (_) {
    // No registrar el payload, el secreto ni excepciones con datos personales.
    console.error(
      JSON.stringify({
        form: "inscripcion",
        status: "error",
        duration: Date.now() - inicio,
      }),
    );
    return respuestaJson_({ success: false, error: "FORM_SUBMISSION_FAILED" });
  } finally {
    if (acquired) lock.releaseLock();
  }
}
