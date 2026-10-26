#!/usr/bin/env bash
# ==============================================================================
# Script Estático de Propagación de Gobernanza (sync-governance.sh)
# ==============================================================================
# Propaga de forma determinista y desatendida las actualizaciones del núcleo
# de gobernanza (.agent/hooks/ y .agent/rules/AGENTS.md) consolidadas en 'main'
# hacia todas las ramas locales activas del repositorio.
# ==============================================================================

set -euo pipefail

# Colores para feedback en consola
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

SOURCE_BRANCH="main"
DRY_RUN=false

show_help() {
    cat << EOF
Uso: bash .agent/hooks/sync-governance.sh [OPCIONES]

Propaga de forma automática y estática el núcleo inmutable de gobernanza
(.agent/hooks/ y .agent/rules/AGENTS.md) desde 'main' a todas las ramas locales.

Opciones:
  --dry-run             Muestra qué ramas necesitan actualización sin modificar nada.
  --source <rama>       Especifica la rama fuente de autoridad (por defecto: 'main').
  -h, --help            Muestra esta ayuda y finaliza.

Ejemplos:
  bash .agent/hooks/sync-governance.sh
  bash .agent/hooks/sync-governance.sh --dry-run
EOF
}

# Procesamiento de argumentos
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --source)
            if [ -n "${2:-}" ]; then
                SOURCE_BRANCH="$2"
                shift 2
            else
                echo -e "${RED}❌ Error: Se requiere especificar la rama fuente tras --source.${NC}" >&2
                exit 1
            fi
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Opción desconocida: $1${NC}" >&2
            show_help
            exit 1
            ;;
    esac
done

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     Sincronización Estática de Gobernanza entre Ramas          ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"

# 1. Comprobar que no haya cambios sin confirmar en el árbol de trabajo
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo -e "${RED}❌ [ERROR PRECONDICIÓN] El árbol de trabajo no está limpio.${NC}"
    echo "   Por favor, realiza commit o stash de tus cambios locales antes de sincronizar ramas."
    exit 1
fi

# 2. Detectar rama actual y validar existencia de rama fuente
CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD)"
if ! git rev-parse --verify "$SOURCE_BRANCH" >/dev/null 2>&1; then
    echo -e "${RED}❌ [ERROR] La rama fuente '$SOURCE_BRANCH' no existe en el repositorio.${NC}"
    exit 1
fi

# 3. Obtener todas las ramas locales excluyendo la rama fuente
ALL_BRANCHES=()
while IFS= read -r branch; do
    [ -n "$branch" ] && ALL_BRANCHES+=("$branch")
done < <(git for-each-ref --format='%(refname:short)' refs/heads/ | grep -v "^${SOURCE_BRANCH}\$" || true)

if [ ${#ALL_BRANCHES[@]} -eq 0 ]; then
    echo -e "${YELLOW}ℹ️  No existen ramas secundarias locales que sincronizar.${NC}"
    echo "   Solo existe la rama principal '$SOURCE_BRANCH'."
    exit 0
fi

echo -e "🌿 Rama de autoridad: ${GREEN}$SOURCE_BRANCH${NC}"
echo -e "📋 Ramas secundarias detectadas (${#ALL_BRANCHES[@]}): ${BLUE}${ALL_BRANCHES[*]}${NC}"
[ "$DRY_RUN" = true ] && echo -e "🔍 ${YELLOW}[MODO DRY-RUN ACTIVADO - No se realizarán escrituras]${NC}"
echo ""

UPDATED=0
ALREADY_SYNCED=0
FAILED=0

for branch in "${ALL_BRANCHES[@]}"; do
    echo -e "👉 Evaluando rama: ${CYAN}$branch${NC}..."

    # Comprobar diferencias entre la rama y la fuente en el núcleo
    DIFF_ITEMS=$(git diff --name-only "$branch" "$SOURCE_BRANCH" -- .agent/hooks/ .agent/rules/AGENTS.md 2>/dev/null || true)

    if [ -z "$DIFF_ITEMS" ]; then
        echo -e "   ✔ ${GREEN}Al día:${NC} La rama ya tiene paridad exacta con el núcleo de '$SOURCE_BRANCH'."
        ALREADY_SYNCED=$((ALREADY_SYNCED + 1))
        continue
    fi

    echo -e "   ⚠️  ${YELLOW}Diferencias detectadas en:${NC}"
    while IFS= read -r item; do
        [ -n "$item" ] && echo "      - $item"
    done <<< "$DIFF_ITEMS"

    if [ "$DRY_RUN" = true ]; then
        UPDATED=$((UPDATED + 1))
        continue
    fi

    # Cambiar de rama y restaurar desde la fuente
    if ! git switch "$branch" >/dev/null 2>&1; then
        echo -e "   ❌ ${RED}Error al cambiar a la rama '$branch'. Omitiendo.${NC}"
        FAILED=$((FAILED + 1))
        continue
    fi

    git restore --source="$SOURCE_BRANCH" -- .agent/hooks/ .agent/rules/AGENTS.md 2>/dev/null || true
    chmod +x .agent/hooks/* 2>/dev/null || true

    CHANGES=$(git status --porcelain -- .agent/hooks/ .agent/rules/AGENTS.md)
    if [ -n "$CHANGES" ]; then
        git add .agent/hooks/ .agent/rules/AGENTS.md
        if git commit -m "chore(governance): sincronizar nucleo de gobernanza desde $SOURCE_BRANCH" >/dev/null 2>&1; then
            echo -e "   ✔ ${GREEN}Sincronizada con éxito:${NC} Commit de sincronización consolidado."
            UPDATED=$((UPDATED + 1))
        else
            echo -e "   ❌ ${RED}Fallo al realizar commit en la rama '$branch'.${NC}"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "   ✔ ${GREEN}Sin cambios pendientes.${NC}"
        ALREADY_SYNCED=$((ALREADY_SYNCED + 1))
    fi
done

# Retornar a la rama original
if [ "$CURRENT_BRANCH" != "$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD)" ]; then
    git switch "$CURRENT_BRANCH" >/dev/null 2>&1 || true
fi

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "📊 ${GREEN}Resumen de Propagación de Gobernanza:${NC}"
echo "   • Rama fuente:           $SOURCE_BRANCH"
echo "   • Ramas analizadas:      ${#ALL_BRANCHES[@]}"
echo "   • Ramas actualizadas:    $UPDATED"
echo "   • Ramas ya al día:       $ALREADY_SYNCED"
if [ $FAILED -gt 0 ]; then
    echo -e "   • ${RED}Ramas con error:       $FAILED${NC}"
fi
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"

if [ $FAILED -gt 0 ]; then
    exit 1
fi

exit 0
