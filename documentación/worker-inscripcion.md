# Worker local de inscripción

La API valida, guarda la solicitud y la deja en `PENDING`, con cero intentos,
disponible para el worker. Responde HTTP 202 después del commit de SQLite, sin
hacer peticiones a Google ni esperar a Apps Script. La página confirma recepción
y redirige a agradecimiento; esto no significa que Google ya haya confirmado.
Si falla el guardado, la API devuelve error y no confirma recepción.

El worker realiza tanto el primer envío como los reintentos. Al tomar el trabajo,
reserva e inserta su primer intento. Si Google confirma, guarda `SENT`; si hay un
fallo temporal o ambiguo programa otro intento. Los rechazos permanentes quedan
en `FAILED` para revisión y ya no se notifican en la respuesta original de la API.
La espera de Google sucede en el worker y no mantiene abierto el envío del usuario.

## Ejecutar en local

Desde la raíz del proyecto, con `.env` configurado:

```sh
npm run db:init
npm run dev
```

En otra terminal inicia `npm run api`. En una tercera, mantener activo:

```sh
npm run worker
```

API y worker deben usar exactamente el mismo `SQLITE_DB_PATH`, URL y secreto.
La implementación de Apps Script debe ser la versión con `requestId` y
`REQUEST_ID_ITEM_ID`, ya verificada en la prueba real de deduplicación.
El worker en local utilizará la URL real de `.env` cuando encuentre trabajo:
las inscripciones de prueba deben identificarse como tales.

Para ejecutar como máximo un trabajo disponible y salir:

```sh
npm run worker -- --once
```

No adelanta fechas de reintento ni espera a trabajos futuros. Sin el proceso
continuo no hay envíos a Google, ni siquiera el primero; los pendientes quedan
guardados en SQLite. La API puede seguir recibiendo solicitudes si el worker
está detenido. Mantenerlo activo y supervisar la cola es necesario en producción.

## Configuración y política

Los valores de `.env.example` son los predeterminados si no se especifican:

| Variable | Predeterminado | Uso |
| --- | --- | --- |
| `INSCRIPCION_MAX_ATTEMPTS` | 5 | Total, incluido el primer envío del worker |
| `INSCRIPCION_RETRY_BASE_MS` | 60000 | Primera espera, aproximadamente un minuto |
| `INSCRIPCION_RETRY_MAX_MS` | 3600000 | Tope de espera calculada, una hora |
| `INSCRIPCION_POLL_MS` | 5000 | Espera entre consultas cuando la cola está vacía |

La espera crece exponencialmente con variación de ±20%, hasta el tope.
Para HTTP 429/503 se respeta `Retry-After` cuando supera la espera calculada.
El timeout de cada petición es 25 segundos y la reserva dura 90 segundos.
La recuperación de una reserva vencida programa una nueva espera.
Cuando hay trabajos disponibles el worker continúa sin esa pausa, uno a la vez.
Si estaba inactivo, un trabajo nuevo puede esperar hasta el intervalo de consulta
antes de comenzar; esa espera no bloquea el navegador. Bajo carga, el tiempo de
entrega también depende de la cantidad de trabajos pendientes.

| Resultado | Estado / acción |
| --- | --- |
| UUID y `responseId` confirmados | `SENT`, guardar identificador remoto |
| Receptor ocupado, HTTP 429/503 | `RETRY`, programar siguiente intento |
| Desconexión, JSON inválido, confirmación que no coincide, fallo ambiguo | `UNKNOWN`, conciliar reenviando el mismo UUID |
| Datos inválidos, secreto, configuración, esquema o formulario cerrado | `FAILED`, detener y revisar |
| Límite alcanzado | Conservar último estado, `needs_review=1`, sin más intentos automáticos |

Una reserva y un token evitan que dos procesos procesen el mismo intento.
Si el proceso cae, el historial conserva el payload y el intento iniciado.
Tras vencer la reserva, el worker lo marca `UNKNOWN / PROCESS_INTERRUPTED`.
Un resultado tardío con el token anterior no puede sobrescribir el intento nuevo.
Al detener el worker se deja terminar la petición activa; si la terminación es
forzada, se aplica la misma recuperación al reiniciar.

## Migración y datos anteriores

`db:init` migra la versión local 1 a la 2 sin borrar inscripciones ni historial.
Antes genera una copia `.before-v2-<marca>.bak` junto al archivo de SQLite.
Es idempotente. Parar API y worker antes de migrar.

Todos los registros anteriores quedan con `retry_enabled=0`: no es posible
asegurar que se enviaron al receptor con deduplicación. No se habilitan en masa.
Las nuevas inscripciones creadas por la API usan `retry_enabled=1`.
Las bases del VPS sin versión siguen requiriendo comparar su esquema y preparar
su migración antes de desplegar; no reemplazar la base del VPS por la local.

## Consultar sin perder datos

Sin instalar la consola `sqlite3`, desde PowerShell:

```powershell
npm run db:query
npm run db:query -- "SELECT id, estado, intentos, needs_review, ultimo_error FROM inscripciones WHERE estado <> 'SENT'"
npm run db:query -- "SELECT * FROM intentos_envio WHERE inscripcion_id = 'UUID' ORDER BY numero_intento"
```

Reemplaza `UUID` por el ID de la inscripción. `db:query` lee `.env`, usa
`SQLITE_DB_PATH` y solo permite consultas de lectura. Para consultas adicionales
en un cliente SQLite:

```sql
-- Fechas de próxima ejecución en milisegundos Unix.
SELECT id, estado, intentos, needs_review, retry_enabled,
       datetime(next_attempt_at / 1000, 'unixepoch') AS siguiente_utc,
       ultimo_error, google_response_id
FROM inscripciones ORDER BY created_at DESC;

SELECT id, payload, estado FROM inscripciones WHERE id = :solicitud_id;

SELECT id, inscripcion_id, numero_intento, payload, estado,
       http_status, error, created_at, finished_at
FROM intentos_envio WHERE inscripcion_id = :solicitud_id
ORDER BY numero_intento;
```

Cada fila de intento conserva el mismo UUID en `inscripcion_id` y su propia copia
de los datos. Los logs no incluyen payloads, secretos ni respuestas completas.
Los casos `needs_review=1` requieren intervención; todavía no hay panel de
alertas ni comando de reactivación manual. La deduplicación cubre reintentos del
mismo UUID; otro envío del navegador sigue generando una solicitud distinta.

## Verificación automática sin Google real

```sh
npm run test:database
npm run test:worker
npm run build
npm run test:inscripcion-integration
```

La prueba de integración verifica el build estático reciente. Levanta la API independiente
y un worker como procesos separados con SQLite temporal. Un receptor HTTP local
simula guardar y perder la confirmación: comprueba que la API responde 202 con
cero peticiones al receptor y la solicitud persistida en `PENDING`. Después el
worker envía, pierde la confirmación, vuelve a ejecutarse y termina `SENT` con
dos intentos y una sola respuesta remota simulada. Se registra el tiempo local
de confirmación como diagnóstico; no es una garantía de latencia del VPS.
No carga `.env` ni envía a Google.

## VPS, para un paso posterior

`ecosystem.config.cjs` declara la API independiente y el worker como `une-api`
y `une-worker`. Requiere Node con strip-types y dependencias instaladas en el VPS.
Las plantillas systemd anteriores fueron retiradas; su EnvironmentFile no se
importa automáticamente a PM2. Astro genera solo `dist/` estático.
Consulta archivos, entorno y arranque en [Despliegue PM2](../deployment/pm2.md).
