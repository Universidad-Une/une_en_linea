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
4. `npm run db:init`. Acepta una base nueva o una versión 1 (crea un respaldo
   `.before-v2-*.bak`). **Rechaza una base con tablas y sin versión:** si el VPS tiene una
   base antigua, hay que revisar su esquema y migrarla aparte. Nunca reemplazarla por la local.
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

- **Solo sitio:** `./deploy.sh` compila, publica una nueva release de `dist/` y recarga nginx.
  No toca PM2 ni SQLite.
- **Backend:** actualizar `server/` y, si cambió el esquema, detener ambos procesos y
  ejecutar `npm run db:init`. Luego:
  ```sh
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
  ```
- **Si cambian las rutas de los scripts** (como al pasar de `api/` a `server/`),
  `restart` no basta:
  ```sh
  pm2 delete une-api une-worker
  pm2 start deploy/ecosystem.config.cjs
  pm2 save
  ```

`./rollback.sh` solo revierte el sitio estático. API, worker y esquema SQLite no se
revierten con él. No sobrescribir la base al desplegar ni al revertir.
