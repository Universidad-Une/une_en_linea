# Limpieza de la integración de formularios

Rama: `actualizacionFormularios`.

## Fusiones realizadas

| Antes | Después | Motivo |
| --- | --- | --- |
| `WelcomeCard.astro` importaba `WelcomePhoto.astro` | Fotografía, fondo, contenido y estilos en `src/components/inscripcion/WelcomeCard.astro` | La fotografía solo se utilizaba en ese panel. Se conserva el centrado vertical en móvil y la alineación izquierda. |
| Contacto importaba `FormularioPrincipal.astro`, que solo renderizaba `Form` | `src/pages/contacto/solicitarinformacion.astro` usa directamente `<Form variant="contacto" />` | Elimina un envoltorio sin lógica ni estilos. |

El formulario sigue definido una sola vez en `src/components/inscripcion/Form.astro`. Las variantes conservan los textos de Inscripción y los badges de Contacto. También se simplificó un título condicional cuya alternativa nunca se ejecutaba.

## Archivos eliminados

- `src/components/inscripcion/WelcomePhoto.astro`: fusionado en `WelcomeCard.astro`.
- `src/components/inscripcion/WelcomeBrand.astro`: ya no se renderizaba desde que se retiró el logo.
- `src/components/sections/contacto/FormularioPrincipal.astro`: envoltorio reemplazado por el componente compartido.
- `src/assets/imagenes/formularios/logo-une-linea.png`: imagen sin uso después de quitar el logo.
- `src/assets/imagenes/formularios/estudiante_une_enlinea.png`: composición antigua sin referencias; se utiliza `chica.png`.

También se eliminó la carpeta vacía `src/components/sections/contacto`. No se borraron directorios de forma recursiva.

## Archivos conservados y razones

- `src/styles/global.css`: coincide con la base de Git; no se importó ni fusionó el CSS global del otro proyecto. Sigue siendo utilizado por el layout principal.
- Layout, encabezado y pie existentes: se reutilizan, sin importar los del proyecto de origen.
- `src/server/inscripcion.js`: contrato y validación utilizados por el componente, el navegador y la API. No contiene credenciales.
- `src/pages/api/forms/inscripcion.ts`: endpoint necesario para enviar a Google Forms desde el servidor.
- `apps-script/`: receptor que se publica en Google y pruebas con servicios simulados. No es una página ni se sirve como recurso público.
- Las pruebas de validación y recepción: comprueban el contrato de Google Forms.
- `.env.example`: nombres de las dos variables necesarias, sin valores secretos. `.env` sigue ignorado por Git.
- `@astrojs/node`: único paquete añadido directamente por la integración; necesario para el endpoint dinámico. La limpieza no cambia dependencias ni el archivo de bloqueo respecto al estado previo a esta revisión.
- Archivos anteriores del proyecto ajenos a esta integración: se conservan para evitar eliminar funciones fuera del alcance de la limpieza.

## Verificación realizada

- `git diff --check`: correcto.
- `npm run build`: correcto.
- `node --test src/server/inscripcion.test.mjs apps-script/recibir-inscripcion.test.mjs`: 12 pruebas aprobadas.
- Las 31 rutas HTML generadas con `index.html` respondieron HTTP 200 en el servidor compilado.
- Ambas páginas de formulario se revisaron a 1440, 768 y 390 px, sin desbordamiento horizontal y con una sola fotografía en el panel.
- Se comprobaron las variantes, los tres badges de Contacto, apertura y cierre del diálogo, validación de teléfono y activación del campo Otro.
- Se simuló un error de envío y se comprobó que el botón se habilita para volver a intentar.
- Se simuló un envío exitoso con las siete respuestas y la redirección a `/contacto/gracias`.
- La API rechazó datos incompletos con 400 y contenido no JSON con 415.
- No se registraron errores JavaScript del navegador durante las comprobaciones.

Las pruebas de envío se interceptaron en el navegador y utilizaron servicios simulados; no se crearon respuestas reales en Google Forms. No verifican la configuración del receptor publicado ni su escritura en Sheets.

## Condición para producción

La integración ya requiere Node para la API; no es un requisito introducido por esta limpieza. El despliegue estático anterior de `deploy.sh` necesita adaptar las rutas a `dist/client` y ejecutar `dist/server/entry.mjs`, con las dos variables de entorno y el proxy de Nginx. Los detalles están en `apps-script/README.md`. No se modificó ni ejecutó el despliegue.
