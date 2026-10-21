# server/

Backend de inscripción. Corre en Node (22.12+) en el VPS, administrado por PM2, fuera
de `dist/`. Recibe el formulario, lo guarda en SQLite y lo envía a Google Forms con
reintentos. Cómo funciona el flujo y qué hacer cuando falla:
[docs/inscripcion.md](../docs/inscripcion.md).

## Qué hay en cada carpeta

```text
server/
├── api.mjs             # Proceso une-api: POST /api/forms/inscripcion → valida, encola, responde 202
├── worker.mjs          # Proceso une-worker: toma la cola y envía a Apps Script
├── inscripcion/
│   ├── validacion.mjs  # Campos del formulario y reglas (CAMPOS_INSCRIPCION, validarInscripcion)
│   ├── entrega.mjs     # Llamada a Apps Script e interpretación de la respuesta
│   └── rate-limit.mjs  # Límite de peticiones por IP y global
├── db/
│   ├── sqlite.mjs      # Conexión (lee SQLITE_DB_PATH; la base debe existir)
│   ├── cola.mjs        # Encolar, reservar con lease, finalizar
│   ├── schema.mjs      # Aplica migraciones según user_version
│   └── migraciones/    # 001-inicial.sql, 002-reintentos.sql
├── scripts/            # init-db.mjs, query-db.mjs (npm run db:init / db:query)
├── test/               # Pruebas con node:test (npm test)
└── apps-script/        # Receptor que corre en Google, no aquí (ver su README)
```

## Comandos

Desde la raíz del proyecto, con `.env` configurado (ver [.env.example](../.env.example)):

```bash
npm run db:init     # crear o migrar la base
npm run api         # 127.0.0.1:4322
npm run worker      # --once para procesar un solo trabajo
npm test            # requiere npm run build antes (la integración revisa dist/)
```

## Reglas al modificar

- **`inscripcion/validacion.mjs` también corre en el navegador:** `Form.astro` lo importa.
  No usar módulos de Node (`node:*`, `fs`, `process`) en ese archivo.
- **El contrato de campos está en dos lugares:** `inscripcion/validacion.mjs` y
  `apps-script/recibir-inscripcion.js` (Apps Script no puede importar). Un cambio de
  preguntas u opciones se hace en los dos y se vuelve a publicar el receptor.
- **Cambios de esquema:** agregar `db/migraciones/003-*.sql`, registrarla en
  `db/schema.mjs` subiendo `user_version` y actualizar la versión que exige `db/cola.mjs`.
  Nunca editar una migración ya aplicada.
- **Una sola instancia de cada proceso:** los contadores del límite viven en memoria.
- **Sin datos personales en logs:** solo UUID, número de intento y estado.
- **Rutas:** si se mueven `api.mjs` o `worker.mjs`, actualizar `deploy/ecosystem.config.cjs`
  y en el VPS hacer `pm2 delete` + `pm2 start` (ver [docs/despliegue.md](../docs/despliegue.md)).
