# Receptor de inscripción

Astro valida seis respuestas y dos campos opcionales en `POST /api/forms/inscripcion` y llama al receptor de Google Apps Script desde el servidor.

## Configuración

1. Copia `apps-script/recibir-inscripcion.js` al proyecto Apps Script, conservando un solo `doPost`.
2. Configura las propiedades `FORM_ID` (ID del editor del formulario) y `SHARED_SECRET` (mínimo 32 caracteres).
3. Publica una **nueva versión** de la aplicación web, ejecutada con tu cuenta y accesible para Cualquier persona.
4. Configura `GOOGLE_FORMS_SCRIPT_URL` (URL `/exec`) y `GOOGLE_FORMS_SHARED_SECRET` en el servidor Astro. Si cambió la URL de implementación o el formulario, actualiza también esos valores y reinicia el servicio.

## Contrato actual

| Campo JSON | ID | Tipo |
| --- | --- | --- |
| origenFormulario | 531603443 | TEXT (opcional) |
| rutaProcedencia | 541397236 | TEXT (opcional) |
| nombres (Nombre completo) | 685898033 | TEXT |
| programaAcademico | 1781497290 | MULTIPLE_CHOICE |
| telefonoContacto | 910929154 | TEXT |
| correo | 1898787164 | TEXT |
| edad | 894211712 | MULTIPLE_CHOICE |
| mediosSeleccionados | 1017864200 | CHECKBOX |

Las seis preguntas son obligatorias. Los IDs son de Apps Script, no parámetros `entry.*`.

Se conservan los valores exactos del Google Forms, incluyendo `Instragram`, la ausencia de acentos en los programas y `18-24` sin espacios. Los otros rangos son `25 - 34`, `35 - 44`, `45 - 54`, `55 +`. Los catálogos completos se encuentran en `src/server/inscripcion.js` y en el receptor; las pruebas comprueban su compatibilidad.

`mediosSeleccionados` es una lista de una o mas opciones, sin duplicados. La pregunta debe ser de tipo **Casillas (CHECKBOX)** en Google Forms, conservando el ID `1017864200`. Activa la opcion nativa **Otro** de Google Forms, no una casilla normal llamada Otro. La web habilita un campo obligatorio al marcar Otro y envia su texto en la lista, junto con las casillas seleccionadas. Se admite un solo texto personalizado de hasta 500 caracteres. Telefono requiere diez digitos y correo una direccion valida.

El aviso de privacidad y su checkbox obligatorio permanecen en la web. La aceptación se valida con el formulario del navegador; `compromiso` no se envía a la API ni se guarda en Google Forms. No existe una pregunta de privacidad en este contrato.

## Verificación

`node --test src/server/inscripcion.test.mjs apps-script/recibir-inscripcion.test.mjs`

Las pruebas simulan Google Forms y no crean respuestas reales. El envío real requiere publicar la versión nueva del receptor y comprobar la configuración de Google Forms/Sheets. No hay reintentos automáticos: ante un timeout verifica si se guardó antes de repetir.

## Integración en UNE en línea

El formulario compartido está en `src/components/inscripcion/Form.astro`. Se muestra en `/formulario-inscripcion` y `/contacto/solicitarinformacion`; los envíos confirmados van a `/contacto/gracias`.

Se conserva Astro 5 y se añade el adaptador Node 9 únicamente para la API. Las páginas siguen siendo estáticas. No se necesita `pdf-lib`: el formulario actual no utiliza el generador PDF antiguo.

En producción, la compilación genera `dist/client` (sitio estático) y `dist/server/entry.mjs` (servidor). Inicia el servidor con `HOST=127.0.0.1 PORT=4321 node dist/server/entry.mjs`, proporcionando las dos variables de entorno. Nginx debe servir `dist/client` y reenviar `/api/forms/inscripcion` al servidor Node, o reenviar todo al servidor Node. El script `deploy.sh` existente está diseñado para el sitio estático anterior; requiere adaptar sus rutas y el reinicio del proceso Node antes de desplegar esta rama.

Las variables locales se trasladaron desde el proyecto de origen al `.env` ignorado por Git. En producción deben configurarse por separado; no se publican credenciales en el repositorio.

## Procedencia de las respuestas

La web rellena estos campos automáticamente, sin controles visibles:

- `origenFormulario`: `inscripcion` o `contacto`, según la variante. Otros componentes pueden pasar la prop `origenFormulario` al componente `Form` para identificar otro formulario.
- `rutaProcedencia`: `window.location.pathname` de la página que contiene el formulario, por ejemplo `/contacto/solicitarinformacion`. No es la página anterior ni incluye parámetros o fragmentos.

Ambos son strings opcionales de hasta 500 caracteres. Los formularios anteriores que no los envían siguen funcionando. Son datos de seguimiento proporcionados por el navegador y no deben utilizarse como autorización.

Publica una nueva versión de `recibir-inscripcion.js` antes de usar el seguimiento en producción.
