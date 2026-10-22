#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# El proyecto es la carpeta donde está este script (producción o preview, ver deploy.sh).
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$PROJECT_DIR" || exit 1
source "$PROJECT_DIR/deploy/entorno.sh"

echo -e "${GREEN}Iniciando rollback (${APP_ENV}) en ${PROJECT_DIR} ...${NC}"

# Lock para evitar rollbacks simultáneos del mismo entorno
LOCKFILE="/var/lock/une_rollback_${APP_ENV}.lock"
if [ -f "$LOCKFILE" ]; then
    echo -e "${RED}ERROR: Ya hay un rollback de ${APP_ENV} en ejecución. Abortando.${NC}"
    exit 1
fi
echo $$ > "$LOCKFILE"
trap "rm -f $LOCKFILE" EXIT

# Configuración de rutas
RELEASES_DIR="$PROJECT_DIR/releases"
CURRENT_LINK="$PROJECT_DIR/dist"

# Verificar que exista el directorio de releases
if [ ! -d "$RELEASES_DIR" ]; then
    echo -e "${RED}ERROR: No existe el directorio de releases.${NC}"
    exit 1
fi

# Obtener el build actualmente desplegado
if [ -L "$CURRENT_LINK" ]; then
    CURRENT_BUILD=$(readlink "$CURRENT_LINK")
    CURRENT_BUILD_NAME=$(basename "$CURRENT_BUILD")
    echo -e "${BLUE}Build actual: ${CURRENT_BUILD_NAME}${NC}"
else
    echo -e "${YELLOW}AVISO: No hay symlink activo. No se puede determinar build actual.${NC}"
    CURRENT_BUILD=""
    CURRENT_BUILD_NAME="(ninguno)"
fi

# Listar builds disponibles
echo -e "\n${BLUE}Builds disponibles para rollback:${NC}"
echo ""

# Crear array con los builds ordenados por fecha (más reciente primero)
BUILDS=($(ls -t "$RELEASES_DIR" | grep "^build_"))

if [ ${#BUILDS[@]} -eq 0 ]; then
    echo -e "${RED}ERROR: No hay builds disponibles para rollback.${NC}"
    exit 1
fi

# Mostrar lista numerada de builds
BUILD_INDEX=1
declare -A BUILD_MAP

for BUILD in "${BUILDS[@]}"; do
    BUILD_PATH="$RELEASES_DIR/$BUILD"
    
    # Marcar el build actual
    if [ "$BUILD_PATH" == "$CURRENT_BUILD" ]; then
        echo -e "  ${GREEN}[$BUILD_INDEX] $BUILD ${YELLOW}(ACTUAL)${NC}"
    else
        echo -e "  [$BUILD_INDEX] $BUILD"
    fi
    
    # Mostrar información adicional si existe
    BUILD_TIMESTAMP=$(echo "$BUILD" | sed 's/build_//')
    BUILD_DATE=$(echo "$BUILD_TIMESTAMP" | sed 's/_/ /')
    echo -e "      Fecha: $BUILD_DATE"
    
    # Mapear índice a nombre de build
    BUILD_MAP[$BUILD_INDEX]=$BUILD
    BUILD_INDEX=$((BUILD_INDEX + 1))
done

echo ""

# Modo automático - rollback al build anterior
if [ "$1" == "--previous" ] || [ "$1" == "-p" ]; then
    echo -e "${YELLOW}Modo automático: Rollback al build anterior${NC}"
    
    # Buscar el primer build que no sea el actual
    TARGET_BUILD=""
    for BUILD in "${BUILDS[@]}"; do
        BUILD_PATH="$RELEASES_DIR/$BUILD"
        if [ "$BUILD_PATH" != "$CURRENT_BUILD" ]; then
            TARGET_BUILD=$BUILD
            break
        fi
    done
    
    if [ -z "$TARGET_BUILD" ]; then
        echo -e "${RED}ERROR: No hay un build anterior disponible.${NC}"
        exit 1
    fi
    
    SELECTED_BUILD=$TARGET_BUILD
    
elif [ "$1" == "--build" ] && [ -n "$2" ]; then
    # Modo directo - especificar nombre de build
    TARGET_BUILD="$2"
    
    if [ ! -d "$RELEASES_DIR/$TARGET_BUILD" ]; then
        echo -e "${RED}ERROR: El build '$TARGET_BUILD' no existe.${NC}"
        exit 1
    fi
    
    SELECTED_BUILD=$TARGET_BUILD
    
else
    # Modo interactivo - seleccionar de la lista
    echo -e "${YELLOW}Selecciona el número del build al que deseas hacer rollback:${NC}"
    read -p "Ingresa el número [1-${#BUILDS[@]}]: " SELECTION
    
    # Validar selección
    if ! [[ "$SELECTION" =~ ^[0-9]+$ ]] || [ "$SELECTION" -lt 1 ] || [ "$SELECTION" -gt ${#BUILDS[@]} ]; then
        echo -e "${RED}ERROR: Selección inválida.${NC}"
        exit 1
    fi
    
    SELECTED_BUILD=${BUILD_MAP[$SELECTION]}
fi

SELECTED_BUILD_PATH="$RELEASES_DIR/$SELECTED_BUILD"

# Verificar que no sea el build actual
if [ "$SELECTED_BUILD_PATH" == "$CURRENT_BUILD" ]; then
    echo -e "${YELLOW}El build seleccionado ya está desplegado. No es necesario hacer rollback.${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}CONFIRMACIÓN DE ROLLBACK${NC}"
echo -e "${YELLOW}========================================${NC}"
echo -e "${BLUE}Build actual:${NC}    $CURRENT_BUILD_NAME"
echo -e "${BLUE}Rollback a:${NC}     $SELECTED_BUILD"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Pedir confirmación en modo interactivo
if [ "$1" != "--previous" ] && [ "$1" != "-p" ] && [ "$1" != "--build" ]; then
    read -p "¿Confirmas el rollback? (s/N): " CONFIRM
    if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
        echo -e "\n${GREEN}Rollback cancelado por el usuario.${NC}"
        exit 0
    fi
fi

# Verificar que el build de destino exista y sea válido
if [ ! -d "$SELECTED_BUILD_PATH" ]; then
    echo -e "${RED}ERROR: El directorio del build no existe.${NC}"
    exit 1
fi

# Verificar que el build tenga contenido
if [ -z "$(ls -A $SELECTED_BUILD_PATH)" ]; then
    echo -e "${RED}ERROR: El build seleccionado está vacío.${NC}"
    exit 1
fi

# Realizar el swap atómico
echo -e "${YELLOW}Aplicando rollback (swap instantáneo)...${NC}"

# Crear backup del symlink actual por si falla
if [ -L "$CURRENT_LINK" ]; then
    BACKUP_LINK="${CURRENT_LINK}.backup"
    cp -P "$CURRENT_LINK" "$BACKUP_LINK"
fi

# Swap atómico
ln -snf "$SELECTED_BUILD_PATH" dist_new
mv -Tf dist_new dist

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Fallo al actualizar symlink de dist.${NC}"
    
    # Restaurar backup si existe
    if [ -L "$BACKUP_LINK" ]; then
        echo -e "${YELLOW}Restaurando symlink anterior...${NC}"
        mv -f "$BACKUP_LINK" "$CURRENT_LINK"
    fi
    
    exit 1
fi

# Limpiar backup si todo salió bien
rm -f "${CURRENT_LINK}.backup"

# Recargar Nginx
# Este rollback cambia solo el sitio estático; no revierte API, worker ni SQLite.
echo -e "${YELLOW}Recargando Nginx...${NC}"
sudo systemctl reload nginx

if [ $? -ne 0 ]; then
    echo -e "${RED}ADVERTENCIA: Fallo al recargar Nginx. Verifica manualmente.${NC}"
fi

# Resumen final
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}ROLLBACK COMPLETADO EXITOSAMENTE${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${BLUE}Build desplegado:${NC}  $SELECTED_BUILD"
echo ""
echo -e "${BLUE}Para verificar el despliegue:${NC}"
echo -e "  curl -I https://tu-dominio.com"
echo ""
echo -e "${BLUE}Si necesitas revertir este rollback:${NC}"
echo -e "  ./rollback.sh --build $CURRENT_BUILD_NAME"
echo ""
echo -e "${BLUE}Builds disponibles:${NC}"
ls -lht releases/ | head -n 4
