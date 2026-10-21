# Receptor de inscripción

La API Node independiente valida seis respuestas y dos campos opcionales en `POST /api/forms/inscripcion`, guarda en SQLite y responde 202. El worker llama al receptor de Google Apps Script desde el servidor, para el primer envío y los reintentos. Astro genera únicamente el sitio estático.

## Configuración

1. Copia `apps-script/recibir-inscripcion.js` al proyecto Apps Script, conservando un solo `doPost`.
2. Configura las propiedades `FORM_ID` (ID del editor del formulario), `SHARED_SECRET` (mínimo 32 caracteres) y `REQUEST_ID_ITEM_ID` (ID de la pregunta técnica; ver abajo).
3. Publica una **nueva versión** de la aplicación web, ejecutada con tu cuenta y accesible para Cualquier persona.
4. Configura `GOOGLE_FORMS_SCRIPT_URL` (URL `/exec`) y `GOOGLE_FORMS_SHARED_SECRET` en el servidor Astro. Si cambió la URL de implementación o el formulario, actualiza también esos valores y reinicia el servicio.

## Contrato actual

El JSON del servidor es `{ secret, requestId, data }`. `requestId` es el UUID
de `inscripciones.id` en SQLite y se conserva al reintentar. No se obtiene de
los campos visibles del formulario. La confirmación contiene `success`,
`requestId`, `responseId` y `deduplicated`. Astro solo marca `SENT` cuando
el UUID confirmado coincide con el enviado y existe un `responseId` no vacío.

## Identificadores y confirmación del POST

| Identificador | Quién lo define | Función |
| --- | --- | --- |
| ID de pregunta | Google Forms | Indica dónde guardar un campo; por ejemplo `685898033` para nombre |
| `requestId` | Astro, antes del envío | UUID de `inscripciones.id`, compartido por todos sus intentos |
| `responseId` | Google Forms, al guardar | Identifica la respuesta completa, no una pregunta ni una fila de SQLite |

La pregunta técnica actual es `ID de solicitud`, tipo `TEXT`, con ID
`1507793439`. Configurar `REQUEST_ID_ITEM_ID=1507793439` en las propiedades del
script para este formulario. En otro formulario o copia se debe obtener su ID
de nuevo con `obtenerIdSolicitud()`; el código no fija este número internamente.

Después de autenticar y validar el UUID, Apps Script abre `FORM_ID`, comprueba
la pregunta técnica y adquiere el bloqueo. Recorre las respuestas de Forms con
`getResponses()` y compara el valor de esa pregunta con el UUID recibido.

- Si existe, recupera `respuesta.getId()` y devuelve ese `responseId` con
  `deduplicated: true`, sin crear otra respuesta.
- Si no existe, valida los datos, construye la respuesta incluyendo el UUID y
  ejecuta `const enviada = respuesta.submit()`. Google genera el identificador
  de la respuesta guardada y Apps Script lo obtiene con `enviada.getId()`.
  Devuelve `requestId`, `responseId` y `deduplicated: false`.

El backend comprueba la confirmación y guarda el ID remoto en
`inscripciones.google_response_id`, junto al estado `SENT`. Si se pierde la
confirmación, conserva `UNKNOWN` y el worker vuelve a enviar el UUID original.
La siguiente ejecución puede encontrar la respuesta ya guardada. El UUID se
normaliza a minúsculas en el receptor y el bloqueo se libera en `finally`.

## Cómo llega el UUID a Apps Script

**Apps Script no consulta SQLite ni se conecta a la API para buscar
el UUID.** El worker envía ese identificador dentro de cada POST.
SQLite conserva la solicitud local; Google Forms conserva el mismo UUID dentro
de su respuesta. La relación entre ambos sistemas se establece con ese valor.

```text
Formulario estático → API Node → SQLite: inscripciones.id = UUID
                         │               payload = datos validados
                         └─ Responde 202 sin esperar a Google

Worker → lee UUID y payload de SQLite
       → POST a Apps Script: { secret, requestId: UUID, data }
       → Apps Script busca ese UUID en las respuestas de Google Forms
       → Google guarda ID de solicitud = UUID y datos de inscripción
       → En cada reintento conserva el MISMO requestId
```

En el flujo actual, `encolar()` genera el UUID y guarda la inscripción en SQLite
como `PENDING`, con cero intentos. La API confirma recepción sin contactar a Google.
El worker toma la solicitud, reserva su primer intento y `enviarInscripcion()`
incluye el UUID en la petición:

```js
body: JSON.stringify({
  secret: config.secret,
  requestId: job.id,
  data,
})
```

El worker realiza todos los envíos y recupera `job.id` de la inscripción
existente. Cada intento tiene una fila distinta en `intentos_envio`, pero
`intentos_envio.inscripcion_id` y el `requestId` del POST conservan el UUID
original. No se envía el ID numérico de la fila del intento como `requestId`.

### Qué comprueba el receptor

1. **Autenticación:** compara `body.secret` con `SHARED_SECRET` de las propiedades
   del script. El secreto no se guarda como respuesta en Forms.
2. **Formato:** comprueba que `body.requestId` sea una cadena con estructura de
   UUID y lo normaliza a minúsculas. Esto no demuestra que exista en SQLite:
   el receptor confía en el backend autenticado que lo envía.
3. **Configuración:** lee `REQUEST_ID_ITEM_ID` y verifica que identifique una
   pregunta `TEXT` distinta de las preguntas de negocio.
4. **Existencia en Forms:** adquiere el bloqueo y ejecuta
   `buscarRespuestaPorSolicitud_(form, requestId, itemId)`. Esta función recorre
   `form.getResponses()`, localiza en cada respuesta la pregunta técnica por su
   ID y compara `item.getResponse()` con el UUID recibido.
5. **Resultado:** si encuentra el UUID, devuelve el `responseId` existente. Si
   no lo encuentra, valida los datos y guarda una respuesta nueva con ese UUID.

`REQUEST_ID_ITEM_ID=1507793439` es el ID fijo de la pregunta donde se busca;
el valor guardado dentro de esa pregunta cambia con cada inscripción.
Un reintento conserva ese valor y por eso se puede reconocer. Un nuevo envío
del navegador genera otro UUID y no se deduplica por nombre, correo o teléfono.

La prueba real desde local confirmó que dos peticiones con el mismo UUID
devolvieron el mismo `responseId`, la segunda con `deduplicated: true`.
Esto verifica el receptor configurado; no implica que el worker esté instalado
en el VPS.

## Preparar la deduplicación en Google Forms

1. En el formulario receptor, crea una pregunta de **Respuesta corta** titulada
   **ID de solicitud**, no obligatoria. No cambies los IDs de las preguntas actuales.
   La pregunta no se agrega al formulario web de Astro.
2. Copia la versión actual de `recibir-inscripcion.js` en el editor de Apps Script.
   Puedes guardar el código sin publicar todavía la aplicación web.
3. Ejecuta manualmente `obtenerIdSolicitud()` desde el editor. En el registro
   de ejecución obtendrás su `id` y el tipo `TEXT`.
4. En las propiedades del script, agrega `REQUEST_ID_ITEM_ID` con ese ID numérico.
5. Para probar desde local, utiliza preferentemente un formulario y una
   implementación de Apps Script de prueba, con sus propios IDs y propiedades.
   Configura su URL `/exec` y secreto en `.env`. Guarda la implementación de
   producción hasta que se haya validado el flujo local.

El receptor exige `requestId`: no es compatible con un backend antiguo que
omita ese campo. El backend nuevo también exige que el receptor confirme el UUID;
un receptor antiguo podría guardar sin deduplicar y su respuesta quedaría
`UNKNOWN`. Actualiza ambos lados de forma coordinada, sin tráfico durante el
cambio; no actives un worker mientras alguno siga usando la versión anterior.

Para un UUID ya recibido, el receptor devuelve el `responseId` anterior, incluso
si el formulario cerró o sus opciones de validación cambiaron después del envío.
La búsqueda y el guardado están protegidos por un bloqueo de script con espera
máxima de cinco segundos. Si no lo obtiene devuelve `RECEIVER_BUSY` sin enviar;
la API conserva el resultado como `RETRY`. El bloqueo se libera en `finally`.
Todos los procesos que escriban estas solicitudes deben pasar por el mismo
proyecto de Apps Script para compartir ese bloqueo.

El UUID queda dentro de la propia respuesta de Google Forms. No se depende de
PropertiesService como registro de envíos: si se guarda la respuesta y se pierde
la confirmación, otro intento puede encontrarla. Esto no es una transacción
distribuida ni deduplica dos envíos nuevos del navegador con UUID distintos.
Las respuestas anteriores sin UUID requieren conciliación manual antes de
reintentar. La búsqueda recorre `getResponses()` completo; revisar sus tiempos
cuando crezca el historial. El worker local está documentado en
[Worker de inscripción](../documentación/worker-inscripcion.md).

## Preguntas de negocio

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

Las pruebas simulan Google Forms y no crean respuestas reales. El envío real requiere publicar la versión nueva del receptor y comprobar la configuración de Google Forms/Sheets. Los reintentos automáticos requieren mantener activo `npm run worker`; reutilizan el UUID guardado para deduplicar.

## Integración en UNE en línea

El formulario compartido está en `src/components/inscripcion/Form.astro`. Se muestra en `/formulario-inscripcion` y `/contacto/solicitarinformacion`. Tras guardar en SQLite, la API responde HTTP 202 con `queued: true` y el navegador redirige a `/contacto/gracias`. HTTP 202 confirma recepción local; el worker hace el envío a Google y guarda su resultado después.

Astro 5 genera un único `dist/` estático. La API se ejecuta desde `api/server.mjs`
y el worker desde `scripts/inscripcion-worker.mjs`, fuera del build del sitio.

En producción, PM2 administra `une-api` y `une-worker` mediante
`ecosystem.config.cjs`. Nginx sirve `dist/` y reenvía únicamente la inscripción a
127.0.0.1:4322. Ambos procesos comparten `GOOGLE_FORMS_SCRIPT_URL`,
`GOOGLE_FORMS_SHARED_SECRET` y `SQLITE_DB_PATH`, con esquema versión 2.
Los parámetros están en `.env.example` y la guía vigente en
[Despliegue PM2](../deployment/pm2.md).

Las variables locales se trasladaron desde el proyecto de origen al `.env` ignorado por Git. En producción deben configurarse por separado; no se publican credenciales en el repositorio.

## Procedencia de las respuestas

La web rellena estos campos automáticamente, sin controles visibles:

- `origenFormulario`: `inscripcion` o `contacto`, según la variante. Otros componentes pueden pasar la prop `origenFormulario` al componente `Form` para identificar otro formulario.
- `rutaProcedencia`: `window.location.pathname` de la página que contiene el formulario, por ejemplo `/contacto/solicitarinformacion`. No es la página anterior ni incluye parámetros o fragmentos.

Ambos son strings opcionales de hasta 500 caracteres. Los formularios anteriores que no los envían siguen funcionando. Son datos de seguimiento proporcionados por el navegador y no deben utilizarse como autorización.

Publica una nueva versión de `recibir-inscripcion.js` antes de usar el seguimiento en producción.
