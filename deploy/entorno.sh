#!/bin/bash
# Configuración por entorno compartida por deploy.sh y rollback.sh.
# Requiere PROJECT_DIR (la carpeta del proyecto en el servidor) antes de cargarse.
#
# APP_ENV en el .env del proyecto:
#   production (por defecto) → rama main,    PM2 une-api / une-worker
#   preview                  → rama preview, PM2 une-api-preview / une-worker-preview

# Lee una variable del .env del proyecto sin ejecutarlo (ignora comillas y espacios).
leer_env() {
    grep -E "^$1=" "$PROJECT_DIR/.env" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d "[:space:]\"'"
}

APP_ENV=$(leer_env APP_ENV)
APP_ENV="${APP_ENV:-production}"

case "$APP_ENV" in
    production)
        RAMA_ESPERADA="main"
        PM2_SUFIJO=""
        ;;
    preview)
        RAMA_ESPERADA="preview"
        PM2_SUFIJO="-preview"
        ;;
    *)
        echo "ERROR: APP_ENV='$APP_ENV' no es válido en $PROJECT_DIR/.env (usa production o preview)."
        exit 1
        ;;
esac

PM2_API="une-api${PM2_SUFIJO}"
PM2_WORKER="une-worker${PM2_SUFIJO}"
