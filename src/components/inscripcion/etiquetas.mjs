// Texto que ve el usuario. Lo que se envía a la API sigue siendo el valor de
// CAMPOS_INSCRIPCION (server/validacion.mjs), que debe coincidir letra por letra con
// las opciones del Google Form aunque tengan errores ("Instragram", sin acentos).

export const ETIQUETAS_CAMPOS = {
  nombres: "Nombre completo",
  programaAcademico: "Programa académico de interés",
  telefonoContacto: "Teléfono",
  correo: "Correo electrónico",
  edad: "Edad",
  mediosSeleccionados: "¿Cómo nos conociste?",
};

export const ETIQUETAS_OPCIONES = {
  programaAcademico: {
    "Bachillerato en linea": "Bachillerato en línea",
    "Lic. en administracion": "Lic. en Administración",
    "Lic. en ad de sistemas de informacion": "Lic. en Administración de Sistemas de Información",
    "Lic. en contaduria": "Lic. en Contaduría",
    "Lic. en comercio y negocios globales": "Lic. en Comercio y Negocios Globales",
    "Lic. en comunicacion": "Lic. en Comunicación",
    "Lic. en derecho": "Lic. en Derecho",
    "Lic. en diseño grafico": "Lic. en Diseño Gráfico",
    "Lic. en educacion": "Lic. en Educación",
    "Ing. industrial": "Ing. Industrial",
    "Lic. en mercadotecnia": "Lic. en Mercadotecnia",
    "Lic. en psicologia": "Lic. en Psicología",
    "Maestria en administracion de negocios": "Maestría en Administración de Negocios",
    "Maestria en educacion": "Maestría en Educación",
  },
  edad: {
    "18-24": "18 a 24 años",
    "25 - 34": "25 a 34 años",
    "35 - 44": "35 a 44 años",
    "45 - 54": "45 a 54 años",
    "55 +": "55 años o más",
  },
  mediosSeleccionados: {
    Facebook: "Facebook",
    Instragram: "Instagram",
    Television: "Televisión",
    Radio: "Radio",
    Espectacular: "Espectacular",
    Recomendacion: "Recomendación",
    "Sesion, expos o ferias": "Sesiones, expos o ferias",
    "Volante o activacion": "Volante o activación",
    "Soy ex alumno": "Soy exalumno",
  },
};

/** Texto visible de una opción; si no tiene etiqueta, se muestra el valor tal cual. */
export const etiquetaOpcion = (campo, valor) => ETIQUETAS_OPCIONES[campo]?.[valor] ?? valor;
