#!/usr/bin/env bash
# ==============================================================================
# Script Estático de Automatización de Releases (publish-release.sh)
# ==============================================================================
# Automatiza el ciclo completo de preparación y publicación de releases:
# 1. Validación SemVer de la versión (v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>]).
# 2. Promoción automática de entradas en CHANGELOG.md ([Unreleased] -> [vX.Y.Z]).
# 3. Actualización automática de la versión en el README.md del proyecto.
# 4. Actualización opcional/automática del catálogo central en README.md de 'main'.
# 5. Generación de commit atómico docs(release) y creación de tag anotado Git.
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

VERSION=""
DESCRIPTION=""
UPDATE_MAIN_CATALOG=false
DRY_RUN=false

show_help() {
    cat << EOF
Uso: bash .agent/hooks/publish-release.sh <VERSION> [DESCRIPCION] [OPCIONES]

Automatiza la preparación de una versión SemVer, actualizando CHANGELOG.md,
README.md (local y de 'main' si aplica catálogo), empaquetando el commit atómico
y creando el tag anotado de Git.

Argumentos:
  <VERSION>             Versión con prefijo 'v' (ej. v1.0.0, v0.2.0, v0.1.0-alpha.1).
  [DESCRIPCION]         Mensaje descriptivo del hito o notas de la versión.

Opciones:
  --update-main-catalog Actualiza la fila del catálogo central en el README.md de 'main'.
  --dry-run             Muestra las transformaciones sin escribir archivos ni comitear.
  -h, --help            Muestra esta ayuda y finaliza.

Ejemplos:
  bash .agent/hooks/publish-release.sh v1.0.0 "Lanzamiento inicial con gobernanza completa"
  bash .agent/hooks/publish-release.sh v0.2.0 "Entrega SA1" --update-main-catalog
EOF
}

# Procesar argumentos (soporta sintaxis posicional y flags)
POSITIONAL_ARGS=()
while [[ $# -gt 0 ]]; do
    case "$1" in
        --update-main-catalog)
            UPDATE_MAIN_CATALOG=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        -*)
            echo -e "${RED}❌ Opción desconocida: $1${NC}" >&2
            show_help
            exit 1
            ;;
        *)
            POSITIONAL_ARGS+=("$1")
            shift
            ;;
    esac
done

if [ ${#POSITIONAL_ARGS[@]} -ge 1 ]; then
    VERSION="${POSITIONAL_ARGS[0]}"
fi
if [ ${#POSITIONAL_ARGS[@]} -ge 2 ]; then
    DESCRIPTION="${POSITIONAL_ARGS[1]}"
fi

if [ -z "$VERSION" ]; then
    echo -e "${RED}❌ [ERROR] Debes especificar la versión a publicar (ej. v1.0.0).${NC}" >&2
    show_help
    exit 1
fi

[ -z "$DESCRIPTION" ] && DESCRIPTION="Publicación de release $VERSION"

# 1. Validación SemVer estricta
SEMVER_REGEX='^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-(0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*))*)?$'
if ! [[ "$VERSION" =~ $SEMVER_REGEX ]]; then
    echo -e "${RED}❌ [ERROR SEMVER] La versión '$VERSION' no cumple con Semantic Versioning 2.0.0.${NC}"
    echo "   Formato obligatorio: v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>]"
    echo "   Ejemplos válidos: v1.0.0, v0.2.1, v0.1.0-alpha.1, v1.0.0-rc.2"
    exit 1
fi

# 2. Comprobar existencia previa del tag
if git rev-parse "$VERSION" >/dev/null 2>&1; then
    echo -e "${RED}❌ [ERROR] El tag '$VERSION' ya existe en el repositorio.${NC}"
    exit 1
fi

echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         Publicación Automatizada de Release SemVer             ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo -e "🏷️  Versión objetivo: ${GREEN}$VERSION${NC}"
echo -e "📝 Descripción:      ${BLUE}$DESCRIPTION${NC}"
[ "$DRY_RUN" = true ] && echo -e "🔍 ${YELLOW}[MODO DRY-RUN ACTIVADO - No se realizarán escrituras]${NC}"
echo ""

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD)"
TODAY="$(date '+%Y-%m-%d')"
CHANGELOG_FILE="$REPO_ROOT/CHANGELOG.md"
README_FILE="$REPO_ROOT/README.md"

# 3. Actualizar CHANGELOG.md
if [ -f "$CHANGELOG_FILE" ]; then
    echo -e "📄 ${CYAN}Procesando CHANGELOG.md...${NC}"
    RELEASE_FILE="$CHANGELOG_FILE" RELEASE_VERSION="$VERSION" RELEASE_TODAY="$TODAY" RELEASE_DESC="$DESCRIPTION" RELEASE_DRY_RUN="$DRY_RUN" python3 - << 'EOF'
import os, sys, re

file_path = os.environ.get("RELEASE_FILE")
version = os.environ.get("RELEASE_VERSION")
today = os.environ.get("RELEASE_TODAY")
desc = os.environ.get("RELEASE_DESC")
dry_run = os.environ.get("RELEASE_DRY_RUN") == "true"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Buscar sección ## [Unreleased]
pattern = r"(##\s*\[Unreleased\]\s*\n)(.*?)(?=\n##\s*\[|\Z)"
match = re.search(pattern, content, re.DOTALL)

if not match:
    print("   ⚠️  No se encontró la cabecera '## [Unreleased]'. Creando bloque...")
    new_release_block = f"## [Unreleased]\n\n## [{version}] - {today}\n\n### Added\n- {desc}\n\n"
    new_content = new_release_block + content
else:
    unreleased_body = match.group(2).strip()
    if not unreleased_body:
        unreleased_body = f"### Added\n- {desc}"
    
    new_block = f"## [Unreleased]\n\n## [{version}] - {today}\n\n{unreleased_body}\n"
    new_content = content[:match.start()] + new_block + content[match.end():]

if dry_run:
    print(f"   [DRY-RUN] CHANGELOG.md se actualizaría con la versión [{version}] - {today}.")
else:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"   ✔ CHANGELOG.md actualizado con éxito: [{version}] - {today}")
EOF
else
    echo -e "   ⚠️  ${YELLOW}No se encontró CHANGELOG.md. Creando nuevo archivo...${NC}"
    if [ "$DRY_RUN" = false ]; then
        cat << EOF > "$CHANGELOG_FILE"
# Historial de Cambios (Changelog)

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

## [$VERSION] - $TODAY

### Added
- $DESCRIPTION
EOF
        echo -e "   ✔ ${GREEN}CHANGELOG.md creado con éxito.${NC}"
    fi
fi

# 4. Actualizar README.md local
if [ -f "$README_FILE" ]; then
    echo -e "📘 ${CYAN}Procesando README.md local...${NC}"
    RELEASE_FILE="$README_FILE" RELEASE_VERSION="$VERSION" RELEASE_DRY_RUN="$DRY_RUN" python3 - << 'EOF'
import os, sys, re

file_path = os.environ.get("RELEASE_FILE")
version = os.environ.get("RELEASE_VERSION")
dry_run = os.environ.get("RELEASE_DRY_RUN") == "true"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

original_content = content

# 1. Actualizar > **Versión de Entrega:** ...
content = re.sub(
    r"(\>\s*\*\*Versión de Entrega:\*\*\s*)(`?[^`\n]+`?)",
    rf"\g<1>`{version}`",
    content
)

# 2. Actualizar badges tipo https://img.shields.io/badge/version-...
content = re.sub(
    r"(https://img\.shields\.io/badge/version-)[^-\)]+(-[a-zA-Z0-9]+)",
    rf"\g<1>{version}\g<2>",
    content
)

if content == original_content:
    print("   ℹ️  No se detectaron campos de versión estandarizados en README.md local.")
else:
    if dry_run:
        print(f"   [DRY-RUN] README.md local se actualizaría con la versión {version}.")
    else:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"   ✔ README.md local actualizado con la versión {version}.")
EOF
fi

# 5. Actualizar catálogo central en 'main' (si aplica)
if [ "$UPDATE_MAIN_CATALOG" = true ] && [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "📚 ${CYAN}Actualizando catálogo central en rama 'main'...${NC}"
    if git rev-parse --verify main >/dev/null 2>&1; then
        REMOTE_URL="$(git config --get remote.origin.url 2>/dev/null || echo '')"
        # Limpiar URL para enlace público si es ssh o con tokens
        REPO_WEB_URL=$(echo "$REMOTE_URL" | sed -E 's|.*github\.com[:/]([^.]+)(\.git)?|https://github.com/\1|')
        [ -z "$REPO_WEB_URL" ] && REPO_WEB_URL="#"

        if [ "$DRY_RUN" = true ]; then
            echo "   [DRY-RUN] Se actualizaría la fila de '$CURRENT_BRANCH' en el catálogo de 'main'."
        else
            git switch main >/dev/null 2>&1
            RELEASE_FILE="$README_FILE" RELEASE_BRANCH="$CURRENT_BRANCH" RELEASE_VERSION="$VERSION" RELEASE_REPO_URL="$REPO_WEB_URL" python3 - << 'EOF'
import os, sys, re

file_path = os.environ.get("RELEASE_FILE")
branch = os.environ.get("RELEASE_BRANCH")
version = os.environ.get("RELEASE_VERSION")
repo_url = os.environ.get("RELEASE_REPO_URL")

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

lines = content.splitlines()
updated_lines = []
found = False

for line in lines:
    if line.strip().startswith("|") and branch in line:
        parts = [p.strip() for p in line.split("|")]
        if len(parts) >= 7:
            release_link = f"[`{version}`]({repo_url}/releases/tag/{version})" if repo_url != "#" else f"`{version}`"
            parts[-3] = release_link
            parts[-2] = "`🟢 Entregado`"
            new_line = " | ".join(parts)
            if not new_line.startswith("|"):
                new_line = "| " + new_line
            if not new_line.endswith("|"):
                new_line = new_line + " |"
            updated_lines.append(new_line)
            found = True
            continue
    updated_lines.append(line)

if found:
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(updated_lines) + "\n")
    print(f"   ✔ Fila de '{branch}' actualizada en el catálogo de 'main'.")
else:
    print(f"   ℹ️  No se encontró fila para la rama '{branch}' en la tabla de 'main'.")
EOF
            if [ -n "$(git status --porcelain "$README_FILE")" ]; then
                git add "$README_FILE"
                git commit -m "docs(catalog): actualizar entrega $VERSION para rama $CURRENT_BRANCH" >/dev/null 2>&1
                echo "   ✔ Commit de catálogo consolidado en 'main'."
            fi
            git switch "$CURRENT_BRANCH" >/dev/null 2>&1
        fi
    else
        echo -e "   ⚠️  ${YELLOW}La rama 'main' no existe localmente. Omitiendo catálogo central.${NC}"
    fi
fi

if [ "$DRY_RUN" = true ]; then
    echo ""
    echo -e "🎉 ${GREEN}[DRY-RUN] Simulación de release $VERSION completada exitosamente.${NC}"
    exit 0
fi

# 6. Commit Atómico de Release
echo -e "💾 ${CYAN}Generando commit atómico de documentación...${NC}"
git add "$CHANGELOG_FILE"
if [ -f "$README_FILE" ]; then
    git add "$README_FILE"
fi
COMMIT_MSG="docs(release): preparar version $VERSION y actualizar changelog/readme"
git commit -m "$COMMIT_MSG"
echo -e "   ✔ ${GREEN}Commit consolidado:${NC} $COMMIT_MSG"

# 7. Creación de Tag Anotado
echo -e "🏷️  ${CYAN}Creando tag anotado de Git...${NC}"
git tag -a "$VERSION" -m "release: $VERSION - $DESCRIPTION"
echo -e "   ✔ ${GREEN}Tag anotado creado:${NC} $VERSION"

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo -e "🚀 ${GREEN}¡Release $VERSION preparada y etiquetada con éxito!${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════════${NC}"
echo "Pasos siguientes para publicar hacia el repositorio remoto:"
echo -e "  1. Publicar la rama de trabajo:"
echo -e "     ${CYAN}git push origin $CURRENT_BRANCH${NC}"
echo -e "  2. Publicar el tag anotado (activa GitHub Actions release si está configurado):"
echo -e "     ${CYAN}git push origin $VERSION${NC}"
echo ""

exit 0
