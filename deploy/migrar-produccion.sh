#!/bin/bash
# Migración única de producción: del commit desacoplado (sitio estático solo) a la rama
# main con API, worker y SQLite de inscripción. Después, cada actualización es ./deploy.sh.
#
# Producción todavía no tiene este archivo, así que se ejecuta desde preview, con el
# usuario que administra PM2:
#   /var/www/preview_une_en_linea/deploy/migrar-produccion.sh          (pide confirmación)
#   /var/www/preview_une_en_linea/deploy/migrar-produccion.sh --yes
#
# Orden pensado para no romper el formulario: el sitio nuevo envía a /api/forms/inscripcion,
# así que solo se publica cuando la API ya responde a través de nginx. Si algo falla antes
# de publicar, se deshace lo hecho y el sitio actual sigue igual.

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

PROD_DIR="${PROD_DIR:-/var/www/une_en_linea}"
PREVIEW_DIR="${PREVIEW_DIR:-/var/www/preview_une_en_linea}"
NGINX_CONF="/etc/nginx/sites-available/une_en_linea.conf"
NGINX_ANCLA="include /etc/nginx/nginx-redirects.conf;"
NGINX_INCLUDE="include $PROD_DIR/deploy/nginx-inscripcion.conf;"
DOMINIO="une-enlinea.com"
API_PORT=4322
PM2_API="une-api"
PM2_WORKER="une-worker"
BACKUP_DIR="$HOME/migracion_produccion_$(date +%Y%m%d_%H%M%S)"

fallar() { echo -e "${RED}ERROR: $*${NC}"; exit 1; }
paso() { echo -e "\n${YELLOW}== $* ==${NC}"; }

# Igual que deploy/entorno.sh: lee una variable sin ejecutar el .env.
leer_env() {
    grep -E "^$2=" "$1" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d "[:space:]\"'"
}

# Devuelve el código HTTP de un POST vacío a la API (400 = viva y validando).
probar_api() {
    curl -s -o /dev/null -w "%{http_code}" --max-time 5 -X POST \
        -H 'Content-Type: application/json' --data '{}' "$@"
}
api_ok() { [ "$1" = "400" ] || [ "$1" = "429" ]; }

cd "$PROD_DIR" 2>/dev/null || fallar "No existe $PROD_DIR."
[ -d .git ] || fallar "$PROD_DIR no es un repositorio git."

# Lock propio; también se detiene si hay un deploy de producción en curso.
LOCKFILE="/var/lock/une_migracion_production.lock"
[ -f "$LOCKFILE" ] && fallar "Ya hay una migración en ejecución ($LOCKFILE)."
[ -f /var/lock/une_deploy_production.lock ] && fallar "Hay un deploy de producción en ejecución."
echo $$ > "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

# ------------------------------------------------------------------
paso "1/7 Verificaciones previas (no cambian nada)"
# ------------------------------------------------------------------
[ "$(whoami)" = "$(stat -c %U "$PROD_DIR")" ] || fallar "Ejecuta como $(stat -c %U "$PROD_DIR"), dueño de $PROD_DIR y de PM2."
command -v pm2 >/dev/null || fallar "pm2 no está en el PATH de este usuario."
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=12)?0:1)' \
    || fallar "Se requiere Node 22.12 o superior (hay $(node -v))."

[ -f .env ] || fallar "Falta $PROD_DIR/.env."
APP_ENV_PROD=$(leer_env .env APP_ENV)
[ -z "$APP_ENV_PROD" ] || [ "$APP_ENV_PROD" = "production" ] || fallar "APP_ENV=$APP_ENV_PROD en producción."
PORT_PROD=$(leer_env .env API_PORT)
[ -z "$PORT_PROD" ] || [ "$PORT_PROD" = "$API_PORT" ] || fallar "API_PORT=$PORT_PROD; producción usa $API_PORT (nginx-inscripcion.conf)."

SQLITE_DB_PATH=$(leer_env .env SQLITE_DB_PATH)
[[ "$SQLITE_DB_PATH" = /* ]] || fallar "SQLITE_DB_PATH debe ser una ruta absoluta."
[ "$SQLITE_DB_PATH" != "$(leer_env "$PREVIEW_DIR/.env" SQLITE_DB_PATH)" ] || fallar "SQLITE_DB_PATH es la misma base que preview."
case "$SQLITE_DB_PATH" in "$PROD_DIR"/dist/*|"$PROD_DIR"/releases/*) fallar "SQLITE_DB_PATH no puede estar dentro del sitio publicado." ;; esac

# Apps Script y Form: si faltan en producción se toman de preview (comparten los mismos).
for VAR in GOOGLE_FORMS_SCRIPT_URL GOOGLE_FORMS_SHARED_SECRET; do
    if [ -z "$(leer_env .env "$VAR")" ]; then
        [ -n "$(leer_env "$PREVIEW_DIR/.env" "$VAR")" ] || fallar "$VAR falta en producción y en preview."
        FALTAN_DE_PREVIEW="$FALTAN_DE_PREVIEW $VAR"
    fi
done
SECRETO=$(leer_env .env GOOGLE_FORMS_SHARED_SECRET)
[ -n "$SECRETO" ] || SECRETO=$(leer_env "$PREVIEW_DIR/.env" GOOGLE_FORMS_SHARED_SECRET)
[ ${#SECRETO} -ge 32 ] || fallar "GOOGLE_FORMS_SHARED_SECRET debe tener al menos 32 caracteres."

# El puerto debe estar libre, salvo que la API de producción ya exista (re-ejecución).
if ! pm2 describe "$PM2_API" >/dev/null 2>&1 && [ -n "$(ss -ltnH "sport = :$API_PORT")" ]; then
    fallar "El puerto $API_PORT ya está en uso por otro proceso."
fi
for UNIDAD in une-inscripcion une-inscripcion-worker; do
    systemctl is-active --quiet "$UNIDAD" 2>/dev/null && fallar "La unidad systemd $UNIDAD está activa; detenla antes (no usar systemd y PM2 a la vez)."
done

# Solo se ignoran cambios de permisos (rollback.sh quedó con chmod +x); cambios de contenido abortan.
if [ -n "$(git -c core.fileMode=false status --porcelain --untracked-files=no)" ]; then
    git -c core.fileMode=false status --short --untracked-files=no
    fallar "Hay cambios locales en $PROD_DIR. Revísalos antes de migrar."
fi

echo -e "${BLUE}Pidiendo sudo (nginx, permisos de la base)...${NC}"
sudo -v || fallar "Se necesita sudo."
sudo nginx -t 2>/dev/null || fallar "nginx -t ya falla antes de tocar nada."
[ "$(grep -cF "$NGINX_ANCLA" "$NGINX_CONF")" = "1" ] || grep -qF "$NGINX_INCLUDE" "$NGINX_CONF" \
    || fallar "No encuentro una única línea '$NGINX_ANCLA' en $NGINX_CONF para insertar el include."

git fetch origin main || fallar "git fetch falló."
OLD_HEAD=$(git rev-parse HEAD)
NEW_HEAD=$(git rev-parse origin/main)
git merge-base --is-ancestor "$OLD_HEAD" "$NEW_HEAD" || fallar "El commit actual no es ancestro de origin/main."

echo -e "${GREEN}Verificaciones OK.${NC}"
echo -e "  Commit actual:  $(git log -1 --format='%h %s' "$OLD_HEAD")"
echo -e "  Nuevo (main):   $(git log -1 --format='%h %s' "$NEW_HEAD") ($(git rev-list --count "$OLD_HEAD..$NEW_HEAD") commits)"
echo -e "  Base SQLite:    $SQLITE_DB_PATH"
echo -e "  PM2:            $PM2_API / $PM2_WORKER en 127.0.0.1:$API_PORT"
[ -n "$FALTAN_DE_PREVIEW" ] && echo -e "  De preview:    $FALTAN_DE_PREVIEW"
if [ "$1" != "--yes" ]; then
    read -p "¿Migrar producción? (s/N): " CONFIRM
    [[ "$CONFIRM" = "s" || "$CONFIRM" = "S" ]] || { echo "Cancelado."; exit 0; }
fi

# ------------------------------------------------------------------
paso "2/7 Respaldo en $BACKUP_DIR"
# ------------------------------------------------------------------
mkdir -p "$BACKUP_DIR" || fallar "No se pudo crear $BACKUP_DIR."
chmod 700 "$BACKUP_DIR"
cp -p .env "$BACKUP_DIR/env"
echo "$OLD_HEAD" > "$BACKUP_DIR/commit_anterior"
readlink -f dist > "$BACKUP_DIR/dist_anterior"
sudo cp -p "$NGINX_CONF" "$BACKUP_DIR/une_en_linea.conf"

# Deshace lo hecho antes de publicar el sitio nuevo. El sitio publicado no se tocó.
revertir() {
    echo -e "${RED}Revirtiendo: $*${NC}"
    if ! grep -qF "$NGINX_INCLUDE" "$BACKUP_DIR/une_en_linea.conf" && grep -qF "$NGINX_INCLUDE" "$NGINX_CONF"; then
        sudo cp -p "$BACKUP_DIR/une_en_linea.conf" "$NGINX_CONF" && sudo nginx -t 2>/dev/null && sudo systemctl reload nginx
    fi
    pm2 delete "$PM2_API" "$PM2_WORKER" >/dev/null 2>&1 && pm2 save >/dev/null
    git checkout -q --detach "$OLD_HEAD"
    cp -p "$BACKUP_DIR/env" .env
    rm -f releases/.deps_lock_sha releases/.backend_commit
    echo -e "${YELLOW}Producción quedó en $(git log -1 --format='%h' HEAD) con el sitio anterior. node_modules quedó con las dependencias nuevas (no afecta al sitio estático).${NC}"
    exit 1
}

# ------------------------------------------------------------------
paso "3/7 .env de producción"
# ------------------------------------------------------------------
# Solo agrega lo que falta; nunca sobrescribe valores existentes.
agregar_env() {
    if ! grep -qE "^$1=" .env; then
        echo "$1=$2" >> .env
        echo -e "  + $1"
    fi
}
[ -n "$(tail -c 1 .env)" ] && echo >> .env
agregar_env APP_ENV production
agregar_env API_HOST 127.0.0.1
agregar_env API_PORT "$API_PORT"
agregar_env INSCRIPCION_TRUST_PROXY true
for VAR in $FALTAN_DE_PREVIEW; do
    sed -i "/^$VAR=/d" .env
    echo "$VAR=\"$(leer_env "$PREVIEW_DIR/.env" "$VAR")\"" >> .env
    echo -e "  + $VAR (de preview)"
done
# Detrás de nginx el límite por IP necesita X-Real-IP; con false todos compartirían 127.0.0.1.
if [ "$(leer_env .env INSCRIPCION_TRUST_PROXY)" != "true" ]; then
    sed -i 's/^INSCRIPCION_TRUST_PROXY=.*/INSCRIPCION_TRUST_PROXY=true/' .env
    echo -e "  ~ INSCRIPCION_TRUST_PROXY=true"
fi
chmod 600 .env

# ------------------------------------------------------------------
paso "4/7 Checkout de main"
# ------------------------------------------------------------------
# rollback.sh tiene chmod +x local y en git es 644: sin esto cada pull lo vería modificado.
git config core.fileMode false
git checkout -q main || revertir "git checkout main falló."
git branch -q --set-upstream-to=origin/main main
git merge -q --ff-only origin/main || revertir "main local no avanza en línea recta a origin/main."
chmod +x deploy.sh rollback.sh
echo -e "${GREEN}En main: $(git log -1 --oneline)${NC}"

# ------------------------------------------------------------------
paso "5/7 Dependencias, base SQLite y PM2"
# ------------------------------------------------------------------
npm ci || revertir "npm ci falló."
mkdir -p releases
sha256sum package-lock.json | cut -d' ' -f1 > releases/.deps_lock_sha

DB_DIR=$(dirname "$SQLITE_DB_PATH")
if [ ! -d "$DB_DIR" ]; then
    sudo mkdir -p "$DB_DIR" && sudo chown "$(whoami):$(whoami)" "$DB_DIR" && chmod 750 "$DB_DIR" \
        || revertir "No se pudo crear $DB_DIR."
fi
[ -w "$DB_DIR" ] || revertir "$(whoami) no puede escribir en $DB_DIR (SQLite necesita crear WAL/SHM)."
npm run db:init || revertir "db:init falló."

pm2 delete "$PM2_API" "$PM2_WORKER" >/dev/null 2>&1
pm2 start deploy/ecosystem.config.cjs || revertir "pm2 start falló."
pm2 describe "une-api-preview" >/dev/null 2>&1 || echo -e "${YELLOW}AVISO: une-api-preview no aparece en PM2.${NC}"

API_STATUS=000
for _ in $(seq 1 10); do
    API_STATUS=$(probar_api -H 'X-Real-IP: 127.0.0.1' "http://127.0.0.1:$API_PORT/api/forms/inscripcion")
    api_ok "$API_STATUS" && break
    sleep 1
done
api_ok "$API_STATUS" || { pm2 logs "$PM2_API" --lines 20 --nostream; revertir "La API no responde en 127.0.0.1:$API_PORT (HTTP $API_STATUS)."; }
pm2 describe "$PM2_WORKER" 2>/dev/null | grep -q "online" || { pm2 logs "$PM2_WORKER" --lines 20 --nostream; revertir "$PM2_WORKER no está en línea."; }
pm2 save
# deploy.sh no volverá a reiniciar el backend: ya está en este commit.
git rev-parse HEAD > releases/.backend_commit
echo -e "${GREEN}API (HTTP $API_STATUS) y worker en línea.${NC}"

# ------------------------------------------------------------------
paso "6/7 nginx: /api/forms/inscripcion → 127.0.0.1:$API_PORT"
# ------------------------------------------------------------------
if grep -qF "$NGINX_INCLUDE" "$NGINX_CONF"; then
    echo -e "${BLUE}El include ya estaba.${NC}"
else
    # Solo en el bloque HTTPS: es el único que tiene la línea de redirects.
    sudo sed -i "\|$NGINX_ANCLA|a\\    $NGINX_INCLUDE" "$NGINX_CONF"
    grep -qF "$NGINX_INCLUDE" "$NGINX_CONF" || revertir "No se pudo insertar el include en $NGINX_CONF."
    sudo nginx -t || revertir "nginx -t falló con el include."
fi
sudo systemctl reload nginx || revertir "No se pudo recargar nginx."

API_STATUS=000
for _ in $(seq 1 5); do
    API_STATUS=$(probar_api --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/api/forms/inscripcion")
    api_ok "$API_STATUS" && break
    sleep 1
done
api_ok "$API_STATUS" || revertir "La API no responde a través de nginx (HTTP $API_STATUS)."
echo -e "${GREEN}https://$DOMINIO/api/forms/inscripcion responde (HTTP $API_STATUS).${NC}"

# ------------------------------------------------------------------
paso "7/7 Build y publicación del sitio (deploy.sh)"
# ------------------------------------------------------------------
# Desde aquí ya no se revierte solo: si deploy.sh falla después del swap, usar ./rollback.sh -p.
./deploy.sh --force
DEPLOY_EXIT=$?
if [ $DEPLOY_EXIT -ne 0 ]; then
    echo -e "${RED}deploy.sh terminó con código $DEPLOY_EXIT.${NC}"
    if [ "$(readlink -f dist)" = "$(cat "$BACKUP_DIR/dist_anterior")" ]; then
        echo -e "${YELLOW}El sitio publicado sigue siendo el anterior. API y nginx ya quedaron listos; corrige y vuelve a correr ./deploy.sh --force.${NC}"
    else
        echo -e "${YELLOW}El sitio nuevo ya se publicó. Si hay problemas: cd $PROD_DIR && ./rollback.sh --build $(basename "$(cat "$BACKUP_DIR/dist_anterior")")${NC}"
    fi
    exit 1
fi

SITIO_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 --resolve "$DOMINIO:443:127.0.0.1" "https://$DOMINIO/")
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}MIGRACIÓN DE PRODUCCIÓN COMPLETADA${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "  Sitio:     https://$DOMINIO/ (HTTP $SITIO_STATUS)"
echo -e "  Commit:    $(git log -1 --oneline)"
echo -e "  Respaldo:  $BACKUP_DIR"
echo -e "  Volver al sitio anterior (solo estático): ./rollback.sh --build $(basename "$(cat "$BACKUP_DIR/dist_anterior")")"
echo -e "  Próximas actualizaciones: git push a main y ./deploy.sh en $PROD_DIR"
