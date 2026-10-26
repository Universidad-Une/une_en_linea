#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# El proyecto es la carpeta donde está este script: /var/www/une_en_linea (producción)
# o /var/www/preview_une_en_linea (preview). APP_ENV en su .env define el resto.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_DIR" || exit 1
source "$PROJECT_DIR/deploy/entorno.sh"

echo -e "${GREEN}Iniciando deploy (${APP_ENV}) en ${PROJECT_DIR} ...${NC}"

# Lock para evitar deploys simultáneos del mismo entorno
LOCKFILE="/var/lock/une_deploy_${APP_ENV}.lock"
if [ -f "$LOCKFILE" ]; then
    echo -e "${RED}ERROR: Ya hay un deploy de ${APP_ENV} en ejecución. Abortando.${NC}"
    exit 1
fi
echo $$ > "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

# Configuración de rutas
CACHE_GLOBAL="$PROJECT_DIR/persistent_astro_cache"
HISTORY_DIR="$PROJECT_DIR/assets_history"

# Puerto de la API: preview y producción comparten servidor, no pueden usar el mismo.
API_PORT=$(leer_env API_PORT)
API_PORT="${API_PORT:-4322}"
if [ "$APP_ENV" = "preview" ] && [ "$API_PORT" = "4322" ]; then
    echo -e "${RED}ERROR: preview necesita su propio API_PORT en .env (4322 es el de producción).${NC}"
    exit 1
fi

# Cada carpeta despliega solo su rama: evita publicar preview en producción o al revés.
RAMA_ACTUAL=$(git rev-parse --abbrev-ref HEAD)
if [ "$RAMA_ACTUAL" != "$RAMA_ESPERADA" ]; then
    echo -e "${RED}ERROR: ${PROJECT_DIR} está en la rama '${RAMA_ACTUAL}'; APP_ENV=${APP_ENV} despliega '${RAMA_ESPERADA}'.${NC}"
    exit 1
fi

# Asegurar que existan los directorios base
mkdir -p "$CACHE_GLOBAL"
mkdir -p "$HISTORY_DIR/_astro"

# Guardar hash actual antes de actualizar
OLD_HASH=$(git rev-parse HEAD)

# Actualizar desde repositorio
echo -e "${BLUE}Descargando últimos cambios desde Git...${NC}"
git pull

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Fallo al hacer git pull.${NC}"
    exit 1
fi

# Guardar hash después de actualizar
NEW_HASH=$(git rev-parse HEAD)

# Verificar si hubo cambios
if [ "$OLD_HASH" == "$NEW_HASH" ]; then
    echo -e "${YELLOW}AVISO: No se detectaron cambios nuevos en el código.${NC}"

    # Forzado (deploy/migrar-produccion.sh ya actualizó la rama antes de llamar a deploy.sh)
    if [ "$1" == "--force" ]; then
        echo -e "${YELLOW}--force: desplegando de todos modos.${NC}"
    # Modo automático (CI/CD)
    elif [ -n "$CI" ] || [ "$1" == "--auto" ]; then
        echo -e "${GREEN}Modo automático: Saltando deploy (sin cambios).${NC}"
        exit 0
    else
        # Modo manual - pedir confirmación
        read -t 10 -p "¿Deseas forzar el despliegue de todos modos? (s/N): " CONFIRM
        if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
            echo -e "\n${GREEN}Deploy cancelado por el usuario.${NC}"
            exit 0
        fi
    fi
fi

# Crear directorio de releases (también guarda los marcadores del último deploy exitoso)
mkdir -p releases
DEPS_MARK="releases/.deps_lock_sha"
BACKEND_MARK="releases/.backend_commit"

# Instalar dependencias exactas del lockfile, solo si cambió desde la última instalación
LOCK_SHA=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ ! -d node_modules ] || [ "$LOCK_SHA" != "$(cat "$DEPS_MARK" 2>/dev/null)" ]; then
    echo -e "${BLUE}Instalando dependencias (npm ci)...${NC}"
    npm ci

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Fallo al instalar dependencias.${NC}"
        exit 1
    fi
    echo "$LOCK_SHA" > "$DEPS_MARK"
else
    echo -e "${BLUE}Dependencias sin cambios.${NC}"
fi

# Generar nombres únicos para este build
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_DIR="$PROJECT_DIR/releases/build_$TIMESTAMP"
TEMP_BUILD="/tmp/une_build_${APP_ENV}_$TIMESTAMP"

echo -e "${YELLOW}Preparando entorno de build temporal...${NC}"
START=$(date +%s)

# Crear directorio temporal y copiar archivos necesarios
mkdir -p "$TEMP_BUILD"
rsync -a --exclude='node_modules' --exclude='dist' --exclude='releases' --exclude='.git' --exclude='data' --exclude='.env*' --exclude='*.sqlite*' ./ "$TEMP_BUILD/"

# Copiar node_modules al directorio temporal
cp -r node_modules "$TEMP_BUILD/"

# Conectar caché persistente de Astro (acelera builds subsecuentes)
echo -e "${BLUE}Conectando caché persistente de Astro...${NC}"
mkdir -p "$TEMP_BUILD/node_modules/.astro"
rm -rf "$TEMP_BUILD/node_modules/.astro"
ln -s "$CACHE_GLOBAL" "$TEMP_BUILD/node_modules/.astro"

# El build temporal no copia .env: pasar SITE_NOINDEX. Preview nunca se indexa.
SITE_NOINDEX=$(leer_env SITE_NOINDEX)
[ "$APP_ENV" = "preview" ] && SITE_NOINDEX=true
export SITE_NOINDEX="${SITE_NOINDEX:-false}"
if [ "$SITE_NOINDEX" = "true" ]; then
    echo -e "${YELLOW}SITE_NOINDEX=true: el sitio se publicará sin indexación (preview).${NC}"
fi

# Ejecutar build en directorio temporal
echo -e "${YELLOW}Ejecutando build de Astro...${NC}"
cd "$TEMP_BUILD" || exit 1
npm run build

BUILD_EXIT_CODE=$?
END=$(date +%s)
DURATION=$((END - START))

# Volver al directorio del proyecto
cd $PROJECT_DIR || exit 1

# Verificar resultado del build
if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo -e "${RED}ERROR: El build falló.${NC}"
    rm -rf "$TEMP_BUILD"
    exit 1
fi

echo -e "${GREEN}Build completado exitosamente en ${DURATION} segundos.${NC}"

# Mover resultado del build a releases
echo -e "${BLUE}Guardando build en directorio de releases...${NC}"
mv "$TEMP_BUILD/dist" "$BUILD_DIR"

# Limpiar directorio temporal
rm -rf "$TEMP_BUILD"

# Ajustar permisos del nuevo build para Nginx
echo -e "${BLUE}Ajustando permisos del build...${NC}"
sudo chown -R www-data:www-data "$BUILD_DIR"
sudo chmod -R 755 "$BUILD_DIR"

# Swap atómico - Zero downtime deployment
echo -e "${YELLOW}Aplicando nuevo build (swap instantáneo)...${NC}"
ln -snf "$BUILD_DIR" dist_new
mv -Tf dist_new dist

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Fallo al actualizar symlink de dist.${NC}"
    exit 1
fi

# Actualizar historial de assets (evita errores 404 en usuarios con caché antigua)
echo -e "${BLUE}Actualizando historial de assets...${NC}"
SOURCE_ASSETS="$BUILD_DIR/_astro"

if [ -d "$SOURCE_ASSETS" ]; then
    # Copiar solo archivos nuevos (no sobrescribir existentes). Sin -a: las carpetas son
    # de www-data y no se les pueden cambiar fechas ni permisos como web_deployer.
    rsync -r --ignore-existing "$SOURCE_ASSETS"/ "$HISTORY_DIR/_astro/"
    sudo chown -R www-data:www-data "$HISTORY_DIR"
    echo -e "${GREEN}Historial de assets actualizado.${NC}"
else
    echo -e "${YELLOW}AVISO: No se encontraron assets para respaldar.${NC}"
fi

# Mantener solo los últimos 3 builds (limpieza de espacio)
echo -e "${BLUE}Limpiando builds antiguos...${NC}"
# Los builds son de www-data (ver chown arriba): borrarlos requiere sudo. Solo se tocan
# carpetas build_* de este proyecto y nunca la que está publicada en dist.
BUILD_PUBLICADO=$(readlink -f "$PROJECT_DIR/dist")
for VIEJO in $(ls -t "$PROJECT_DIR/releases" | grep "^build_" | tail -n +4); do
    [ "$PROJECT_DIR/releases/$VIEJO" = "$BUILD_PUBLICADO" ] && continue
    sudo rm -rf -- "$PROJECT_DIR/releases/$VIEJO"
done

# Recargar configuración de Nginx
echo -e "${YELLOW}Recargando Nginx...${NC}"
sudo systemctl reload nginx

# Backend (API y worker con PM2): solo si cambió su código, su config o sus dependencias
# desde el último deploy de backend exitoso. Debe ejecutarse con el usuario que administra PM2.
BACKEND_LAST=$(cat "$BACKEND_MARK" 2>/dev/null)
if [ -z "$BACKEND_LAST" ] || ! git cat-file -e "${BACKEND_LAST}^{commit}" 2>/dev/null; then
    BACKEND_CHANGED="sin despliegue previo registrado"
else
    BACKEND_CHANGED=$(git diff --name-only "$BACKEND_LAST" HEAD -- server deploy package.json package-lock.json)
fi

if [ -n "$BACKEND_CHANGED" ]; then
    echo -e "${YELLOW}Desplegando backend...${NC}"
    if ! command -v pm2 >/dev/null; then
        echo -e "${RED}ERROR: pm2 no está instalado o no está en el PATH de este usuario.${NC}"
        exit 1
    fi

    # Idempotente: crea la base si falta y aborta si no es compatible.
    npm run db:init
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: db:init falló. API y worker siguen con la versión anterior.${NC}"
        exit 1
    fi

    # delete + start (no reload) para que PM2 tome siempre las rutas actuales del ecosystem.
    pm2 delete "$PM2_API" "$PM2_WORKER" >/dev/null 2>&1
    pm2 start deploy/ecosystem.config.cjs && pm2 save
    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: No se pudieron iniciar API y worker con PM2.${NC}"
        exit 1
    fi
else
    echo -e "${BLUE}Backend sin cambios.${NC}"
fi

# Verificar que la API responde: un JSON vacío debe dar 400 (o 429 si hay límite activo).
API_URL="http://127.0.0.1:${API_PORT}/api/forms/inscripcion"
echo -e "${BLUE}Verificando API en ${API_URL}...${NC}"
API_STATUS=000
for _ in $(seq 1 10); do
    API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 -X POST \
        -H 'Content-Type: application/json' -H 'X-Real-IP: 127.0.0.1' --data '{}' "$API_URL")
    [ "$API_STATUS" = "400" ] || [ "$API_STATUS" = "429" ] && break
    sleep 1
done
if [ "$API_STATUS" != "400" ] && [ "$API_STATUS" != "429" ]; then
    echo -e "${RED}ERROR: La API no responde como se espera (HTTP ${API_STATUS}). Revisa: pm2 status, pm2 logs ${PM2_API}${NC}"
    exit 1
fi
echo -e "${GREEN}API respondiendo (HTTP ${API_STATUS}).${NC}"
if ! pm2 describe "$PM2_WORKER" 2>/dev/null | grep -q "online"; then
    echo -e "${RED}ERROR: ${PM2_WORKER} no está en línea. Revisa: pm2 logs ${PM2_WORKER}${NC}"
    exit 1
fi
echo -e "${GREEN}Worker en línea.${NC}"
git rev-parse HEAD > "$BACKEND_MARK"

# Resumen final
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}DEPLOY COMPLETADO EXITOSAMENTE${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}Estadísticas del deploy:${NC}"
echo -e "  Duración del build: ${DURATION}s"
echo -e "  Entorno: $APP_ENV ($PROJECT_DIR)"
echo -e "  Versión desplegada: $TIMESTAMP"
echo -e "  Commit: $(git log -1 --oneline)"
echo ""
echo -e "${BLUE}Builds disponibles en el servidor:${NC}"
ls -lht releases/ | head -n 4
