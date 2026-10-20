#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Iniciando deploy ...${NC}"

# Lock para evitar deploys simultáneos
LOCKFILE="/var/lock/une_deploy.lock"
if [ -f "$LOCKFILE" ]; then
    echo -e "${RED}ERROR: Ya hay un deploy en ejecución. Abortando.${NC}"
    exit 1
fi
echo $$ > "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

# Configuración de rutas
PROJECT_DIR="/var/www/une_en_linea"
CACHE_GLOBAL="$PROJECT_DIR/persistent_astro_cache"
HISTORY_DIR="$PROJECT_DIR/assets_history"

cd $PROJECT_DIR || exit 1

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
    
    # Modo automático (CI/CD)
    if [ -n "$CI" ] || [ "$1" == "--auto" ]; then
        echo -e "${GREEN}Modo automático: Saltando deploy (sin cambios).${NC}"
        exit 0
    fi
    
    # Modo manual - pedir confirmación
    read -t 10 -p "¿Deseas forzar el despliegue de todos modos? (s/N): " CONFIRM
    if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
        echo -e "\n${GREEN}Deploy cancelado por el usuario.${NC}"
        exit 0
    fi
fi

# Instalar/actualizar dependencias
echo -e "${BLUE}Verificando e instalando dependencias...${NC}"
npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Fallo al instalar dependencias.${NC}"
    exit 1
fi

# Crear directorio de releases
mkdir -p releases

# Generar nombres únicos para este build
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUILD_DIR="$PROJECT_DIR/releases/build_$TIMESTAMP"
TEMP_BUILD="/tmp/une_build_$TIMESTAMP"

echo -e "${YELLOW}Preparando entorno de build temporal...${NC}"
START=$(date +%s)

# Crear directorio temporal y copiar archivos necesarios
mkdir -p "$TEMP_BUILD"
rsync -a --exclude='node_modules' --exclude='dist' --exclude='releases' --exclude='.git' ./ "$TEMP_BUILD/"

# Copiar node_modules al directorio temporal
cp -r node_modules "$TEMP_BUILD/"

# Conectar caché persistente de Astro (acelera builds subsecuentes)
echo -e "${BLUE}Conectando caché persistente de Astro...${NC}"
mkdir -p "$TEMP_BUILD/node_modules/.astro"
rm -rf "$TEMP_BUILD/node_modules/.astro"
ln -s "$CACHE_GLOBAL" "$TEMP_BUILD/node_modules/.astro"

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
    # Copiar solo archivos nuevos (no sobrescribir existentes)
    cp -rn "$SOURCE_ASSETS"/* "$HISTORY_DIR/_astro/"
    sudo chown -R www-data:www-data "$HISTORY_DIR"
    echo -e "${GREEN}Historial de assets actualizado.${NC}"
else
    echo -e "${YELLOW}AVISO: No se encontraron assets para respaldar.${NC}"
fi

# Mantener solo los últimos 3 builds (limpieza de espacio)
echo -e "${BLUE}Limpiando builds antiguos...${NC}"
cd releases
ls -t | grep "^build_" | tail -n +4 | xargs -r rm -rf
cd ..

# Recargar configuración de Nginx
echo -e "${YELLOW}Recargando Nginx...${NC}"
sudo systemctl reload nginx

# Resumen final
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}DEPLOY COMPLETADO EXITOSAMENTE${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}Estadísticas del deploy:${NC}"
echo -e "  Duración del build: ${DURATION}s"
echo -e "  Versión desplegada: $TIMESTAMP"
echo -e "  Commit: $(git log -1 --oneline)"
echo ""
echo -e "${BLUE}Builds disponibles en el servidor:${NC}"
ls -lht releases/ | head -n 4