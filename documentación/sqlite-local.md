# SQLite local e historial de inscripciones

En `.env`, configura `SQLITE_DB_PATH=./data/inscripciones.sqlite`.
Los comandos se ejecutan desde la raíz del proyecto:

```sh
npm run db:init
npm run test:database
npm run dev
```

Inicia `npm run api` y `npm run worker` en otras terminales. El sitio es estático;
la API y el worker son servicios independientes fuera de `dist/`.

`db:init` crea la carpeta, la base y las tablas de una instalación nueva.
Puede ejecutarse de nuevo sobre la base local inicializada sin borrar datos.
El esquema actual es versión 2. Al migrar una base local versión 1 genera un
respaldo previo; parar API y worker antes de ejecutar esa migración.
Rechaza bases con tablas preexistentes sin versión: todavía no es una migración
para la base del VPS. Antes de desplegar, se comparará el esquema real del VPS
y se preparará su migración. No reemplazar esa base con el archivo local.

`npm run dev` y `npm start` leen `.env`; las variables del proceso tienen prioridad.
API y worker se ejecutan por separado con PM2 y cargan `.env` si existe.
El anterior `EnvironmentFile` de systemd no se importa automáticamente.
Las rutas relativas se resuelven desde el directorio de trabajo. En el VPS debe
usarse una ruta absoluta persistente, fuera de `dist`, con permisos de escritura
para el usuario del servicio tanto en el archivo como en la carpeta (WAL/SHM).

## Consultar desde PowerShell sin instalar sqlite3

Si Windows no tiene el ejecutable `sqlite3`, puedes consultar la base sin
instalarlo. Estos comandos cargan `.env` y abren SQLite en modo de solo lectura:

```powershell
npm run db:query
npm run db:query -- "SELECT * FROM intentos_envio ORDER BY id DESC LIMIT 20"
npm run db:query -- "SELECT id, payload FROM inscripciones ORDER BY created_at DESC LIMIT 20"
npm run db:query -- "SELECT * FROM intentos_envio WHERE inscripcion_id = 'UUID' ORDER BY numero_intento"
npm run db:query -- "SELECT id, estado, intentos, ultimo_error, needs_review FROM inscripciones WHERE estado <> 'SENT'"
```

Sin SQL se muestran las últimas 20 inscripciones y su estado. La salida JSON
conserva los valores completos, incluido el payload; no publica datos fuera
de la terminal. No admite sentencias de escritura.

Reemplaza `UUID` por `inscripciones.id`. Cada consulta se ejecuta desde
PowerShell: no se abre una sesión interactiva de `sqlite3` y no se utilizan
comandos como `.tables` o `.quit`.

## Identificadores y datos

- `inscripciones.id`: UUID estable de la solicitud, con su payload validado,
  estado actual y contador de intentos.
- `intentos_envio.id`: identificador distinto de cada fila del historial.
- `intentos_envio.inscripcion_id`: el mismo UUID de la solicitud en cada intento.
- `intentos_envio.numero_intento`: consecutivo dentro de esa solicitud.
- `inscripciones.google_response_id`: identificador de la respuesta confirmada
  por Google Forms, distinto del UUID local.
- `inscripciones.next_attempt_at`: próxima ejecución en milisegundos Unix.
- `inscripciones.needs_review`: `1` si se agotaron los intentos o hubo un fallo
  permanente; `0` no significa por sí solo que el registro esté enviado.
- `intentos_envio.payload`: copia JSON de los datos de inscripción utilizados;
  incluye nombre, correo, teléfono, programa, edad, medios y procedencia.
  No guarda el secreto de Google ni encabezados de autenticación.
- Cada intento conserva estado, HTTP cuando existe, error y fecha. Un índice
  único impide repetir el número de intento de una misma solicitud.

La API guarda la inscripción en `PENDING`, con cero intentos, y responde sin
esperar a Google. El worker reserva y registra cada intento antes de enviarlo;
después confirma su resultado en una transacción. La configuración y la recuperación
de procesos interrumpidos se describen en [Worker local](worker-inscripcion.md).

Para recuperar los datos por UUID en un cliente SQLite:

```sql
SELECT id, payload, estado, intentos FROM inscripciones WHERE id = :solicitud_id;

SELECT id, inscripcion_id, numero_intento, payload, estado, http_status, error, created_at
FROM intentos_envio
WHERE inscripcion_id = :solicitud_id
ORDER BY numero_intento;
```

Los archivos en `data/`, incluidos WAL y SHM, están ignorados por Git y fuera
de la carpeta pública. Las pruebas usan otra base temporal con datos ficticios
y no hacen peticiones a Google. Una base recién creada queda vacía; los envíos
manuales y las pruebas reales sí agregan registros a la base configurada.

Astro transmite el UUID y el receptor incluye deduplicación, verificada en una
prueba real. Para activar el primer envío y los reintentos locales, ejecuta `npm run worker` en otra
terminal. Un nuevo envío del navegador todavía genera un UUID nuevo; el worker
reutiliza el registro existente.
