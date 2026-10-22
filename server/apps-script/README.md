# Receptor en Google Apps Script

`recibir-inscripcion.js` corre en Google, no en el VPS: se copia a mano al proyecto de
Apps Script. Recibe `{ secret, requestId, data }` del worker, deduplica por `requestId` y
guarda la respuesta en Google Forms. El flujo completo está en
[docs/inscripcion.md](../../docs/inscripcion.md).

## Configurar o actualizar

1. En el Google Form, debe existir una pregunta de **Respuesta corta** llamada
   **ID de solicitud**, no obligatoria. No se muestra en la web.
2. Pegar `recibir-inscripcion.js` en el editor de Apps Script (un solo `doPost`).
3. Ejecutar `obtenerIdSolicitud()` desde el editor y copiar el ID que imprime.
   En el formulario actual es `1507793439`; en una copia del form será otro.
4. En las propiedades del script:
   - `FORM_ID`: ID del formulario (el de la URL del editor).
   - `SHARED_SECRET`: mínimo 32 caracteres, igual a `GOOGLE_FORMS_SHARED_SECRET`.
   - `REQUEST_ID_ITEM_ID`: el ID del paso 3.
   - `DEDUP_DIAS` (opcional, 7 por defecto): cuántos días hacia atrás se buscan respuestas
     con el mismo `requestId`. Subirlo solo si el worker estuvo detenido más tiempo.
5. Publicar una **nueva versión** de la aplicación web: ejecutar como tu cuenta, acceso
   para cualquier persona.
6. Si cambió la URL `/exec`, actualizar `GOOGLE_FORMS_SCRIPT_URL` en el servidor y reiniciar
   API y worker.

Para pruebas, usar un formulario y una implementación propios, no los de producción.
Actualizar el receptor y el backend de forma coordinada: un receptor antiguo sin
`requestId` deja las respuestas en `UNKNOWN`.

## Contrato

Los IDs de pregunta son de Apps Script, no parámetros `entry.*`. La lista completa de
opciones está en `CAMPOS_INSCRIPCION`, duplicada aquí y en
`server/validacion.mjs` (que también usa `Form.astro` para validar en el
navegador). **Cualquier cambio de preguntas u opciones se hace
en los dos archivos.** `server/test/apps-script.test.mjs` comprueba que tengan los mismos
campos y que el receptor acepte cada opción de selección única; no compara todo.

| Campo | ID | Tipo |
| --- | --- | --- |
| origenFormulario | 531603443 | TEXT (opcional) |
| rutaProcedencia | 541397236 | TEXT (opcional) |
| nombres | 685898033 | TEXT |
| programaAcademico | 1781497290 | MULTIPLE_CHOICE |
| telefonoContacto | 910929154 | TEXT (10 dígitos) |
| correo | 1898787164 | TEXT |
| edad | 894211712 | MULTIPLE_CHOICE |
| mediosSeleccionados | 1017864200 | CHECKBOX con la opción nativa **Otro** |

Las opciones se copian tal cual están en el Form, aunque tengan errores (`Instragram`,
programas sin acentos, `18-24` sin espacios). El aviso de privacidad se valida solo en
la web y no se envía.
