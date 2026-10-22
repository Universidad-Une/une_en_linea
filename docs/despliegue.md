# Despliegue en el VPS

En producción hay tres piezas:

- **nginx** sirve `dist/` (raíz `/var/www/une_en_linea/dist`) y reenvía solo
  `/api/forms/inscripcion` a `127.0.0.1:4322`.
- **PM2** mantiene `une-api` y `une-worker` (`deploy/ecosystem.config.cjs`), una
  instancia de cada uno.
- **SQLite**, en la ruta absoluta de `SQLITE_DB_PATH`.

## Primera instalación

1. Desplegar `dist/`, `server/`, `deploy/`, `package.json` y `package-lock.json`.
2. Ejecutar `npm ci` en el VPS. No copiar `node_modules` desde Windows: `better-sqlite3`
   es un módulo nativo. Requiere Node 22.12 o superior.
3. Crear `.env` en la raíz con las variables de [`.env.example`](../.env.example). En el VPS:
   `SQLITE_DB_PATH` absoluta y `INSCRIPCION_TRUST_PROXY=true`.
4. `npm run db:init`. Crea la base; si ya existe con el esquema actual no hace nada, y
   rechaza cualquier base con otras tablas. Nunca copiar la base local al VPS.
5. Incluir `deploy/nginx-inscripcion.conf` dentro del bloque `server` del dominio y luego:
   ```sh
   sudo nginx -t && sudo systemctl reload nginx
   ```
6. Arrancar los procesos con el usuario de despliegue:
   ```sh
   pm2 start deploy/ecosystem.config.cjs
   pm2 save
   pm2 startup   # seguir la instrucción que imprime
   ```
   Si existen unidades systemd antiguas (`une-inscripcion`, `une-inscripcion-worker`),
   detenerlas y deshabilitarlas antes. No usar los dos gestores a la vez.

Cerrar el puerto 4322 al exterior. Base, WAL/SHM, respaldos y `.env` van fuera de `dist/`,
con permisos solo para el usuario de PM2.

## Comprobar

Las dos deben responder 400 JSON sin crear registros (y cuentan para el límite):

```sh
curl -i -H 'Content-Type: application/json' -H 'X-Real-IP: 127.0.0.1' --data '{}' http://127.0.0.1:4322/api/forms/inscripcion
curl -i -H 'Content-Type: application/json' --data '{}' https://maestrias.universidad-une.com/api/forms/inscripcion
```

Si solo falla la segunda, el problema está en nginx.

```sh
pm2 status
pm2 logs une-api
pm2 logs une-worker
```

## Actualizar

`./deploy.sh`, ejecutado **con el mismo usuario que administra PM2**, hace todo:

1. `git pull`.
2. `npm ci`, solo si `package-lock.json` cambió desde la última instalación.
3. Compila el sitio, publica una nueva release de `dist/` y recarga nginx.
4. Si cambió `server/`, `deploy/` o las dependencias desde el último deploy de backend
   exitoso (o nunca se registró uno): `npm run db:init`, `pm2 delete` y `pm2 start` de
   `une-api` y `une-worker`, y `pm2 save`.
5. Verifica que la API responda 400 a un JSON vacío y que `une-worker` esté en línea.
   Si no, termina con error.

Los marcadores del último deploy exitoso están en `releases/.deps_lock_sha` y
`releases/.backend_commit`. Borrar el segundo fuerza a redesplegar el backend en el
siguiente `./deploy.sh`. Si `db:init` falla, API y worker siguen con la versión anterior.

`./rollback.sh` solo revierte el sitio estático. API, worker y esquema SQLite no se
revierten con él. No sobrescribir la base al desplegar ni al revertir.

## Servidor de preview

Preview y producción viven en el mismo VPS, cada uno en su carpeta y con su propio
`.env`. `deploy.sh` y `rollback.sh` operan sobre la carpeta donde están, y `APP_ENV`
define todo lo demás (`deploy/entorno.sh`):

| | Producción | Preview |
|---|---|---|
| Carpeta | `/var/www/une_en_linea` | `/var/www/preview_une_en_linea` |
| Rama que despliega | `main` | `preview` |
| `APP_ENV` | `production` (o sin definir) | `preview` |
| Procesos PM2 | `une-api`, `une-worker` | `une-api-preview`, `une-worker-preview` |
| `API_PORT` | 4322 | otro, p. ej. 4323 (obligatorio) |
| Indexación | sí | nunca: `SITE_NOINDEX` se fuerza a `true` |

`deploy.sh` se detiene si la carpeta está en otra rama que la de su `APP_ENV`, o si
preview usa el puerto 4322.

### Primera instalación

1. Clonar la rama `preview`:
   ```sh
   git clone -b preview https://github.com/Universidad-Une/une_en_linea.git /var/www/preview_une_en_linea
   ```
2. Crear `/var/www/preview_une_en_linea/.env`:
   ```dotenv
   APP_ENV=preview
   API_PORT=4323
   INSCRIPCION_TRUST_PROXY=true
   SQLITE_DB_PATH=/var/www/preview_data/inscripciones.sqlite
   GOOGLE_FORMS_SCRIPT_URL=   # Apps Script y Form DE PRUEBA, no los de producción
   GOOGLE_FORMS_SHARED_SECRET=
   ```
   Base y Form separados: si apunta a los de producción, lo que se envíe en preview
   aparecerá como inscripciones reales.
3. En `/etc/nginx/sites-available/preview_une_en_linea.conf`, dentro del bloque `server`:
   ```nginx
   include /var/www/preview_une_en_linea/deploy/nginx-inscripcion-preview.conf;
   ```
   (el puerto del fragmento debe coincidir con `API_PORT`). Luego
   `sudo nginx -t && sudo systemctl reload nginx`.
4. Desde la carpeta de preview, con el mismo usuario que administra PM2:
   ```sh
   ./deploy.sh
   ```

Después, cada actualización es `git push` a `preview` y `./deploy.sh` en esa carpeta.
`./rollback.sh` en esa carpeta revierte solo el sitio de preview.

### Indexación

Con `APP_ENV=preview` el build agrega
`<meta name="robots" content="noindex, nofollow, noarchive, …">` en todas las páginas,
genera un `robots.txt` con `Disallow: /` y no genera el sitemap. El `canonical` sigue
apuntando a `https://une-enlinea.com`. Para archivos que no son HTML (PDF, imágenes),
nginx de preview ya envía `X-Robots-Tag "noindex, nofollow, noarchive"`.

`robots.txt` y la etiqueta meta son peticiones que los rastreadores respetan por
cortesía. Si el preview no debe ser público, protegerlo además con `auth_basic` en nginx.
