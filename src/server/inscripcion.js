// Contrato de las seis preguntas y dos campos opcionales de Google Forms; no incluye campos locales.
export const CAMPOS_INSCRIPCION = [
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

export function validarInscripcion(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    return { data: {}, errors: { formulario: "INVALID_DATA" } };
  const { valores, errores } = validarDatosInscripcion_(input);
  return { data: valores, errors: errores };
}
