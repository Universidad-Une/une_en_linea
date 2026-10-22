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
