# Sitio estático y servicios independientes con PM2

Astro genera un único `dist/` con HTML, CSS, JavaScript e imágenes. Nginx sirve
esa carpeta. La API se ejecuta desde `api/server.mjs` y el worker desde
`scripts/inscripcion-worker.mjs`, ambos fuera de `dist`. Se retiraron el
adaptador Node, el endpoint/middleware de Astro y las plantillas systemd.

## Desarrollo local

Con Node compatible con strip-types (22.12+), dependencias y `.env` configurados:

```sh
npm run db:init
npm run dev
```

En dos terminales adicionales:

```sh
npm run api
```

```sh
npm run worker
```

Astro sirve el sitio en 4321 y su proxy de desarrollo envía la ruta de inscripción
a 127.0.0.1:4322 (`API_PORT`). El formulario conserva su URL relativa.
`npm start` es un alias de la API; no sirve el sitio. `npm run preview` sirve
el build estático y no incluye el proxy de desarrollo: para probar el formulario
con el build usar Nginx o un proxy equivalente.

## Archivos y configuración del VPS

Desplegar `dist/`, `api/`, `scripts/`, `src/lib/server/`,
`src/server/inscripcion.js`, `package.json`, `package-lock.json` y
`ecosystem.config.cjs`. Instalar dependencias en el VPS con `npm ci`; no copiar
`node_modules` de Windows, porque SQLite tiene un módulo nativo.

Crear `.env` privado en la raíz del proyecto o proporcionar variables en el
entorno del proceso PM2. API y worker cargan `.env` si existe; el entorno tiene
prioridad. El anterior `/etc/une-inscripcion.env` de systemd NO se carga
automáticamente: trasladar sus valores antes de arrancar PM2.

Obligatorias: `SQLITE_DB_PATH` absoluta y persistente, `GOOGLE_FORMS_SCRIPT_URL`
y `GOOGLE_FORMS_SHARED_SECRET`. Para Nginx local:

```dotenv
API_HOST=127.0.0.1
API_PORT=4322
INSCRIPCION_TRUST_PROXY=true
```

Cerrar el puerto 4322 al exterior. Nginx debe sobrescribir X-Real-IP, como hace
el fragmento `deployment/nginx-inscripcion.conf`. Mantener base, WAL/SHM,
respaldos y secretos fuera de `dist` con permisos mínimos del usuario PM2.
La base local versionada usa esquema 2. La base antigua del VPS sin versión
requiere revisar su esquema y preparar su migración; no sustituirla por la local.

## PM2

Con PM2 instalado, ejecutar como el usuario de despliegue:

```sh
pm2 start ecosystem.config.cjs
pm2 status
pm2 logs une-api
pm2 logs une-worker
pm2 save
```

El archivo declara `une-api` y `une-worker`, una instancia fork de cada uno.
Los límites de frecuencia son por proceso; no aumentar instancias sin contadores
compartidos. Para restaurarlos al reiniciar el VPS, ejecutar `pm2 startup`, seguir
la instrucción que genere para ese usuario y ejecutar `pm2 save`.

Si las unidades antiguas `une-inscripcion` y `une-inscripcion-worker` fueron
instaladas, detenerlas y deshabilitarlas antes de arrancar PM2. No usar ambos
gestores simultáneamente. Esta preparación no instaló ni activó PM2 en el VPS.

## Nginx

Usar `/var/www/une_en_linea/dist` como raíz pública. Incluir el fragmento
`deployment/nginx-inscripcion.conf` en el bloque server, conservando TLS y las
reglas del sitio estático. La inscripción se reenvía al puerto privado 4322.
La API no sirve archivos: otras rutas responden 404 y métodos distintos de POST
en inscripción responden 405. No implementa rutas de imágenes ni Server Islands.

```sh
sudo nginx -t
sudo systemctl reload nginx
```

Verificación sin crear registros (ambas deben responder 400 JSON):

```sh
curl -i -H 'Content-Type: application/json' -H 'X-Real-IP: 127.0.0.1' --data '{}' http://127.0.0.1:4322/api/forms/inscripcion
curl -i -H 'Content-Type: application/json' --data '{}' https://maestrias.universidad-une.com/api/forms/inscripcion
```

El primer comando fija X-Real-IP porque este ejemplo habilita modo proxy.
Si solo falla el segundo, revisar Nginx. Estas solicitudes cuentan para el límite.

## Actualizaciones

`deploy.sh` mantiene releases del sitio estático y usa `dist/_astro`. Excluye
datos, bases y entorno del build temporal; no administra PM2 ni migra SQLite.
Si cambia el backend, actualizar sus archivos fuera de dist y reiniciar ambos
procesos desde el mismo usuario PM2:

```sh
pm2 restart ecosystem.config.cjs --update-env
```

`rollback.sh` cambia únicamente la release estática. API, worker y esquema de
SQLite necesitan su propio rollback compatible. No sobrescribir la base con
una copia local al desplegar o revertir el sitio.
