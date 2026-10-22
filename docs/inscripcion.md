# Inscripción: cómo funciona y qué hacer cuando falla

## Flujo

```text
Navegador ── POST /api/forms/inscripcion ──► server/api.mjs
  (Form.astro)                                 │ valida, rate-limit
                                               │ guarda en SQLite: PENDING
             ◄── 202 { requestId } ────────────┘ (no espera a Google)

server/worker.mjs ── toma un trabajo de la cola (lease de 90 s)
                  ── POST { secret, requestId, data } ──► Apps Script ──► Google Forms
                  ◄── { success, requestId, responseId } ┘
                  ── guarda el resultado y, si toca, programa el reintento
```

- **Por qué hay API + worker y no se llama a Google desde el navegador:** el secreto
  no puede ir en el cliente, y Apps Script tarda segundos o falla. El usuario recibe
  respuesta en cuanto la solicitud está guardada; el envío a Google ocurre después.
- **202 no significa que Google ya la tenga.** Significa que quedó guardada en SQLite.
  Sin worker activo no se envía nada, ni siquiera el primer intento.
- **`requestId`** es el UUID de `inscripciones.id`. Se reutiliza en cada reintento.
  Apps Script lo guarda en la pregunta técnica "ID de solicitud" y, si ya existe, devuelve
  el `responseId` anterior en vez de crear otra respuesta. Solo busca en las respuestas de
  los últimos 7 días (propiedad `DEDUP_DIAS` del script): un reintento más tardío, por
  ejemplo con el worker detenido más de una semana, podría crear un duplicado. Un nuevo
  envío desde el navegador genera otro UUID: no se deduplica por nombre, correo ni teléfono.
- El formulario está en `src/components/inscripcion/Form.astro` y se usa en
  `/formulario-inscripcion` y `/contacto/solicitarinformacion`. Tras el 202 redirige a
  `/contacto/gracias`. Importa `server/validacion.mjs` para validar en el
  navegador con las mismas reglas que la API; por eso ese archivo no debe usar módulos de
  Node. Rellena solo `origenFormulario` y `rutaProcedencia`
  (`window.location.pathname`), que son de seguimiento, no de autorización.

## Estados

| Estado | Qué pasó | Qué sigue |
| --- | --- | --- |
| `PENDING` | Guardada por la API | El worker la toma |
| `PROCESSING` | El worker la está enviando | Si el proceso muere, al vencer el lease pasa a `UNKNOWN / PROCESS_INTERRUPTED` |
| `SENT` | Google confirmó el mismo UUID y un `responseId` | Fin. `google_response_id` guarda el ID de Google |
| `RETRY` | Receptor ocupado, HTTP 429/503 | Reintento con espera exponencial (respeta `Retry-After`) |
| `UNKNOWN` | Timeout, desconexión, JSON inválido o confirmación que no coincide | Reintento con el mismo UUID: si Google ya la guardó, la deduplicación lo detecta |
| `FAILED` | Rechazo permanente: datos, secreto, configuración, esquema del form o form cerrado | No se reintenta. `needs_review=1` |

Al agotar `INSCRIPCION_MAX_ATTEMPTS` se conserva el último estado con `needs_review=1` y
no hay más intentos automáticos. Los parámetros de reintento están en
[`.env.example`](../.env.example). Cada petición a Google tiene un timeout de 25 s.

Un token de reserva impide que dos procesos envíen el mismo intento y que un resultado
tardío sobrescriba uno nuevo.

## Protección de la API

- Solo existe `POST /api/forms/inscripcion`; otras rutas dan 404 y otros métodos 405.
- Cuerpo JSON de máximo 32 KiB, con tiempos de lectura limitados.
- Límite de peticiones por IP y global en ventana deslizante (valores en
  [`.env.example`](../.env.example)). Al excederse responde 429 con `Retry-After`,
  sin leer el cuerpo ni escribir en SQLite.
- Los contadores son en memoria y por proceso: se reinician al reiniciar la API, y con
  varias instancias cada una tendría su propio cupo (por eso PM2 usa una sola).
- Con `INSCRIPCION_TRUST_PROXY=true` la IP sale solo de `X-Real-IP`, que nginx
  sobrescribe. Si se agrega Cloudflare u otro proxy delante, hay que configurar su
  cadena de IP real o todos los visitantes compartirán un cupo.
- No sustituye protección DDoS ni CAPTCHA.

## Base de datos

`server/schema.sql` define dos tablas:

- `inscripciones`: una fila por solicitud (`id` = UUID, `payload` JSON, `estado`,
  `intentos`, `next_attempt_at` en ms Unix, `needs_review`, `google_response_id`).
- `intentos_envio`: una fila por intento, con estado, HTTP, error y fechas.

El payload contiene datos personales (nombre, correo, teléfono). No se guardan secretos.
Los logs solo incluyen UUID, número de intento y estado.

## Cuando algo falla

`npm run db:query` abre la base en solo lectura. Sin argumentos muestra las últimas 20.

```powershell
# Todo lo que no llegó a Google
npm run db:query -- "SELECT id, estado, intentos, needs_review, ultimo_error, datetime(next_attempt_at/1000,'unixepoch') AS siguiente_utc FROM inscripciones WHERE estado <> 'SENT' ORDER BY created_at DESC"

# Historial de una solicitud
npm run db:query -- "SELECT numero_intento, estado, http_status, error, created_at, finished_at FROM intentos_envio WHERE inscripcion_id = 'UUID' ORDER BY numero_intento"

# Datos para capturarla a mano
npm run db:query -- "SELECT payload FROM inscripciones WHERE id = 'UUID'"
```

| Síntoma | Revisar |
| --- | --- |
| Muchas en `PENDING` y ninguna avanza | ¿Corre el worker? `pm2 status`, `pm2 logs une-worker` |
| `FAILED` con `UNAUTHORIZED` | `GOOGLE_FORMS_SHARED_SECRET` distinto de `SHARED_SECRET` en Apps Script |
| `FAILED` con `FORM_SCHEMA_CHANGED` | Alguien cambió o borró una pregunta del Google Form |
| `FAILED` con `FORM_CLOSED` | El Google Form dejó de aceptar respuestas |
| Muchas `UNKNOWN` por timeout | Apps Script lento; si hay muchas respuestas por día, bajar `DEDUP_DIAS` |
| `RETRY` con `RECEIVER_BUSY` | Bloqueo de Apps Script ocupado; se resuelve solo |

Para `needs_review=1` todavía no hay comando de reactivación: corregir la causa y
capturar el lead a mano con su payload, o reactivarlo con SQL directo con API y worker
detenidos.
