#!/usr/bin/env bash
# ==============================================================================
# Script Instalador y Activador Universal de Git Hooks
# ==============================================================================
# Configura Git para ejecutar hooks versionados en .agent/hooks/
# y prepara el entorno de seguridad local en user_data/security/
# ==============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HOOKS_DIR="$REPO_ROOT/.agent/hooks"

echo "⚙️  Configurando ruta de hooks de Git en '.agent/hooks'..."

# Configurar core.hooksPath de forma relativa para máxima portabilidad
git config core.hooksPath .agent/hooks

# Asegurar permisos de ejecución en todos los scripts de hooks y gobernanza
if [ -d "$HOOKS_DIR" ]; then
    chmod +x "$HOOKS_DIR"/* 2>/dev/null || true
fi

# Inicializar archivo confidencial local de patrones prohibidos si no existe
SECURITY_DIR="$REPO_ROOT/user_data/security"
PATTERNS_FILE="$SECURITY_DIR/forbidden_patterns.txt"

if [ ! -f "$PATTERNS_FILE" ]; then
    mkdir -p "$SECURITY_DIR"
    cat << 'EOF' > "$PATTERNS_FILE"
# ==============================================================================
# PATRONES PRIVADOS LOCALES (user_data/security/forbidden_patterns.txt)
# ==============================================================================
# Este archivo reside dentro de user_data/ y está ESTRICTAMENTE IGNORADO en Git.
# Permite definir patrones, nombres de usuario o rutas locales confidenciales que
# el hook de pre-commit debe bloquear sin exponerlos en el repositorio público.
#
# Sintaxis: Expresión regular por línea (se ignoran líneas vacías y con '#').
# ==============================================================================

EOF
    # Autodetectar de forma segura la ruta HOME del desarrollador actual
    if [ -n "${HOME:-}" ] && [ "$HOME" != "/" ]; then
        echo "# Ruta local autodetectada de la estación de trabajo" >> "$PATTERNS_FILE"
        echo "$HOME/" >> "$PATTERNS_FILE"
    fi
    echo "✔ Archivo confidencial local inicializado en: user_data/security/forbidden_patterns.txt"
fi

echo "✔ Git Hooks y herramientas de gobernanza activadas con éxito:"
echo "  - Pre-commit:       $HOOKS_DIR/pre-commit (Live Tracking + Inmutabilidad + SAST)"
echo "  - Pre-push:         $HOOKS_DIR/pre-push (Protección de ramas y jerarquía)"
echo "  - Sync Governance:  $HOOKS_DIR/sync-governance.sh (Propagación estática a ramas)"
echo "  - Publish Release:  $HOOKS_DIR/publish-release.sh (Automatización SemVer y metadatos)"
exit 0
