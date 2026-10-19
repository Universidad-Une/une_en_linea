# Habilitar el formulario en Nginx

El 19 de octubre de 2026, `POST https://maestrias.universidad-une.com/api/forms/inscripcion`
con `{}` respondió 404 con HTML de Nginx. La API debería responder 400 con JSON
al recibir esos datos incompletos. El navegador muestra el error genérico porque
no puede interpretar el HTML como JSON.

La build contiene `dist/client` y `dist/server`. El endpoint tiene
`prerender = false` y requiere ejecutar Node. No se genera como archivo estático.

## Instalación en el servidor Ubuntu

Adapta `/var/www/une_en_linea` en el servicio si el proyecto está en otra ruta.
Comprueba `command -v node`; ajusta `ExecStart` si Node no está en `/usr/bin/node`.
Usa una versión de Node compatible con el Astro instalado (Node 22.12 o superior).

1. Instala dependencias y compila en la carpeta del proyecto:

   ```sh
   npm ci
   npm run build
   ```

2. Crea `/etc/une-inscripcion.env` con las variables de `.env.example` y los valores
   de tu implementación de Apps Script. Usa formato `NOMBRE=valor`, sin `export`.
   Protege el archivo con `sudo chmod 600 /etc/une-inscripcion.env`.
   El secreto debe coincidir con `SHARED_SECRET` en Apps Script. No coloques este
   archivo ni `.env` dentro de la raíz pública de Nginx.

3. Instala el servicio:

   ```sh
   sudo cp deployment/une-inscripcion.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now une-inscripcion
   ```

4. En el bloque `server` de `maestrias.universidad-une.com`, usa la ruta absoluta
   `/var/www/une_en_linea/dist/client` como `root` y añade el contenido de
   `deployment/nginx-inscripcion.conf`. Conserva las opciones TLS y rutas existentes.
   Si usas releases, `dist` debe apuntar a la release completa con `client` y `server`.

   ```sh
   sudo nginx -t && sudo systemctl reload nginx
   ```

## Comprobación sin crear registros

Ejecuta ambas solicitudes; deben responder **400** con JSON de validación:

```sh
curl -i -H 'Content-Type: application/json' --data '{}' http://127.0.0.1:4321/api/forms/inscripcion
curl -i -H 'Content-Type: application/json' --data '{}' https://maestrias.universidad-une.com/api/forms/inscripcion
```

Si la primera falla, revisa `sudo journalctl -u une-inscripcion -n 50 --no-pager`.
Si solo falla la segunda, revisa el bloque de Nginx del dominio.
Estas pruebas comprueban la ruta, pero no el guardado en Google Forms.

## Siguientes despliegues

El `deploy.sh` anterior solo recarga Nginx. Antes de reutilizarlo, cambia
`SOURCE_ASSETS="$BUILD_DIR/_astro"` por `SOURCE_ASSETS="$BUILD_DIR/client/_astro"`
y reinicia `une-inscripcion` después de cambiar el enlace `dist`. Al hacer rollback,
reinicia también el servicio. No elimines una release que siga en uso por Node.
Tras cada build o cambio de variables ejecuta:

```sh
sudo systemctl restart une-inscripcion
```
