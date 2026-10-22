# server/

Backend de inscripción. Corre en Node (22.12+) en el VPS, administrado por PM2, fuera
de `dist/`. Recibe el formulario, lo guarda en SQLite y lo envía a Google Forms con
reintentos. Cómo funciona el flujo y qué hacer cuando falla:
[docs/inscripcion.md](../docs/inscripcion.md).

## Archivos

```text
server/
├── api.mjs          # Proceso une-api: POST /api/forms/inscripcion → valida, encola, responde 202
├── worker.mjs       # Proceso une-worker: toma la cola y envía a Apps Script
├── validacion.mjs   # Campos del formulario y reglas (también lo usa el navegador)
├── rate-limit.mjs   # Límite de peticiones por IP y global
├── cola.mjs         # Encolar, reservar con lease, finalizar
├── entrega.mjs      # Llamada a Apps Script e interpretación de la respuesta
├── db.mjs           # Abrir la base e inicializar el esquema
├── schema.sql       # Tablas inscripciones e intentos_envio
├── db-cli.mjs       # npm run db:init / npm run db:query
├── test/            # Pruebas con node:test (npm test)
└── apps-script/     # Receptor que corre en Google, no aquí (ver su README)
```

## Comandos

Desde la raíz del proyecto, con `.env` configurado (ver [.env.example](../.env.example)):

```bash
npm run db:init     # crear la base
npm run api         # 127.0.0.1:4322
npm run worker      # --once para procesar un solo trabajo
npm test            # sin Google real ni .env
```

## Reglas al modificar

- **`validacion.mjs` también corre en el navegador:** `Form.astro` lo importa. No usar
  módulos de Node (`node:*`, `fs`, `process`) en ese archivo.
- **El contrato de campos está en dos lugares:** `validacion.mjs` y
  `apps-script/recibir-inscripcion.js` (Apps Script no puede importar). Un cambio de
  preguntas u opciones se hace en los dos y se vuelve a publicar el receptor.
- **Cambios de esquema:** mientras no haya datos en producción, editar `schema.sql` y
  recrear la base. Después, subir `VERSION_ESQUEMA` en `db.mjs` y agregar ahí el `ALTER`
  que lleva de la versión anterior a la nueva.
- **Una sola instancia de cada proceso:** los contadores del límite viven en memoria.
- **Sin datos personales en logs:** solo UUID, número de intento y estado.
- **Rutas:** si se mueven `api.mjs` o `worker.mjs`, actualizar `deploy/ecosystem.config.cjs`.
  `deploy.sh` recrea los procesos de PM2 cuando cambia `server/` o `deploy/`
  (ver [docs/despliegue.md](../docs/despliegue.md)).
