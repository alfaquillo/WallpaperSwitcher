#!/usr/bin/env bash

# Configuración de colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorios y rutas
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
EXTENSION_ID="WallpaperSwitcher@Rishu"
LOG_DIR="${SRC_DIR}/log"
LOG_FILE="${LOG_FILE:-${LOG_DIR}/install.log}"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions"

# Configuración para root
if [[ "$(id -u)" -eq 0 ]]; then
    INSTALL_DIR="/usr/share/gnome-shell/extensions"
fi

# Crear directorios necesarios
mkdir -p "${LOG_DIR}" "${INSTALL_DIR}"

# Funciones de utilidad
print() {
    echo -e "${NC}[+] ${1}${NC}"
    echo -e "[+] ${1}" >> "${LOG_FILE}"
}

print_warning() {
    echo -e "${NC}[${YELLOW}!${NC}] ${1}${NC}"
    echo -e "[!] ${1}" >> "${LOG_FILE}"
}

print_failed() {
    echo -e "${NC}[${RED}x${NC}] ${1}${NC}"
    echo -e "[x] ${1}" >> "${LOG_FILE}"
    exit 1
}

print_success() {
    echo -e "${NC}[${GREEN}✓${NC}] ${1}${NC}"
    echo -e "[✓] ${1}" >> "${LOG_FILE}"
}

# Verificar dependencias
check_dependencies() {
    local missing=()
    local deps=("glib-compile-schemas" "gnome-shell" "zip")
    
    for dep in "${deps[@]}"; do
        if ! command -v "${dep}" >/dev/null 2>&1; then
            missing+=("${dep}")
        fi
    done

    if [[ ${#missing[@]} -gt 0 ]]; then
        print_warning "Dependencias faltantes: ${missing[*]}"
        return 1
    fi
    return 0
}

# Instalar extensión
install_extension() {
    print "Instalando extensión en ${INSTALL_DIR}"
    
    # Eliminar instalación previa
    rm -rf "${INSTALL_DIR}/${EXTENSION_ID}"
    
    # Copiar archivos
    if ! cp -rf "${SRC_DIR}/src" "${INSTALL_DIR}/${EXTENSION_ID}"; then
        print_failed "Error al copiar archivos"
    fi

    # Compilar esquemas GSettings
    if ! glib-compile-schemas --strict \
         --targetdir="${INSTALL_DIR}/${EXTENSION_ID}/schemas" \
         "${INSTALL_DIR}/${EXTENSION_ID}/schemas"; then
        print_warning "Error al compilar esquemas GSettings"
    fi

    # Crear archivo de log
    mkdir -p "${HOME}/.local/var/log/"
    touch "${HOME}/.local/var/log/WallpaperSwitcher.log"

    # Configurar permisos
    chmod -R 755 "${INSTALL_DIR}/${EXTENSION_ID}"

    print_success "Extensión instalada correctamente"
    print "Reinicia GNOME Shell con Alt+F2, luego escribe 'r' y presiona Enter"
}

# Crear paquete ZIP
create_package() {
    print "Creando paquete ZIP para distribución"
    
    local out_dir="${SRC_DIR}/out"
    mkdir -p "${out_dir}"
    
    if ! cd "${SRC_DIR}/src" && \
       zip -6rX "${out_dir}/${EXTENSION_ID}.zip" ./*; then
        print_failed "Error al crear el paquete ZIP"
    fi

    cd ..
    print_success "Paquete creado: ${out_dir}/${EXTENSION_ID}.zip"
}

# Inicializar log
echo -e "\n$(date '+%d/%m/%Y %H:%M:%S')\n" >> "${LOG_FILE}"

# Proceso principal
check_dependencies

case "${1}" in
    -b|--build)
        create_package
        ;;
    *)
        install_extension
        ;;y
        