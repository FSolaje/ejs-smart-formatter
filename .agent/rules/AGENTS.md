---
trigger: always_on
---

# Marco de Gobernanza Global y Directrices del Agente (AGENTS.md)

Este documento define la **Constitución de Gobernanza Global**, los estándares de control de versiones Git, las directrices de seguridad (SAS), las reglas de commits y los parámetros operativos obligatorios para los agentes de Inteligencia Artificial y los desarrolladores en este proyecto.

Este marco reside canónicamente en `.agent/rules/AGENTS.md`, permitiendo modularidad, desacoplamiento y compatibilidad transversal entre ramas y entornos de desarrollo.

---

## 1. Arquitectura de Gobernanza y Modelo de Ramas

Para garantizar la estabilidad operativa del repositorio sin restar agilidad a las distintas tareas técnicas, este proyecto adopta un modelo de gobernanza desacoplado:

### 1.1. Núcleo Inmutable de Gobernanza (`main` como Autoridad Única)
1. **Componentes del Núcleo:**
   - `.agent/hooks/` (Scripts de automatización, hooks de Git y puertas de calidad).
   - `.agent/rules/AGENTS.md` (Este documento constitucional).
2. **Regla de Inmutabilidad:** Queda terminantemente prohibido modificar los archivos del núcleo de gobernanza en ramas secundarias (`dev/*`, `feature/*`, `fix/*`, `ra<XX>/*`, etc.). Cualquier cambio, ajuste o evolución del marco global debe nacer, validarse y confirmarse exclusivamente en la rama `main`.
3. **Mandato de Propagación Obligatoria desde `main`:**
   - Toda modificación o evolución del núcleo de gobernanza consolidada en `main` **debe propagarse obligatoriamente a todas las ramas activas del repositorio** antes de proseguir con tareas técnicas en ellas.
   - Para garantizar paridad estricta y evitar que el hook de `pre-commit` bloquee confirmaciones en ramas secundarias, la propagación debe realizarse mediante el proceso estático automatizado:
     ```bash
     bash .agent/hooks/sync-governance.sh
     ```
   - El script `sync-governance.sh` ejecuta de forma determinista y desatendida la sincronización en cada rama local, generando los commits atómicos correspondientes.
4. **Sincronización Manual Puntual:** En caso de requerir sincronización individual en una rama específica:
   ```bash
   git restore --source=main -- .agent/hooks/ .agent/rules/AGENTS.md
   ```
5. **Blindaje Estático:** El hook de `pre-commit` bloquea a nivel estático cualquier intento de confirmación en ramas distintas de `main` que presente diferencias respecto al núcleo oficial.

### 1.2. Activos Modulares y Flexibles por Proyecto o Rama
- **Reglas Contextuales (`.agent/rules/*.md`):** Cada proyecto o rama extiende este marco incorporando especificaciones técnicas particulares (diseño visual, arquitectura de datos, topologías de red, endpoints, etc.).
- **`.gitignore` Específico:** Cada proyecto añade a la base universal las exclusiones propias de su stack tecnológico (Python, Node.js, Docker, Rust, Java, etc.).
- **Habilidades del Agente (`.agent/skills/`):** Habilidades operativas especializadas que amplían la capacidad del asistente en tareas concretas.

---

## 2. Regla Mandatoria: Conventional Commits v1.0.0

Todos los commits realizados en este repositorio deben seguir **estrictamente** la especificación de [Conventional Commits v1.0.0](https://www.conventionalcommits.org/):

### Formato Obligatorio
```text
<tipo>(<ámbito>): <descripción concisa en imperativo>

[cuerpo opcional detallando el motivo y contexto del cambio]

[pie opcional con notas de rotura o referencias a issues/tareas]
```

### Tipos Permitidos
- **`feat`**: Nueva funcionalidad, servicio o característica orientada al usuario o producto.
- **`fix`**: Corrección de un fallo, bug, error de lógica, configuración o ruta.
- **`docs`**: Cambios exclusivos en documentación técnica, especificaciones, manuales de usuario o `README.md`.
- **`refactor`**: Refactorización o reorganización de código que no altera funcionalidad ni corrige errores.
- **`test`**: Creación o ajuste de pruebas automatizadas, suites unitarias o bancos de verificación.
- **`chore`**: Tareas auxiliares de mantenimiento, dependencias, actualización de `.gitignore` o setup del repositorio.
- **`style`**: Formateo de código, indentación o ajuste visual sin impacto en la lógica o semántica.

### Ámbitos Sugeridos (`scope`)
- **Gobernanza y Repositorio:** `global`, `agent`, `rules`, `hooks`, `security`, `repo`, `ci`, `deps`, `spec`.
- **Versionado y Catálogo:** `release`, `catalog`, `adr`.
- **Específicos del Proyecto:** Ámbitos adaptados a los módulos o arquitectura del proyecto definidos en sus reglas de perfil.

### 2.1. Prohibición Terminante de Commits Híbridos y Atomicidad Estricta
- **Prohibición de Mezcla `fix` + `feat`:** Queda terminantemente vetado agrupar en un mismo commit tipos dispares, en especial correcciones de errores (`fix`) con nuevas características (`feat`). Todo bugfix debe aislarse en su propio commit.
- **Prohibición de Mezcla con Documentación Pública:** Queda estrictamente prohibido empaquetar código funcional o configuraciones (`feat`, `fix`) con manuales de usuario, documentación pública o especificaciones (`docs`).
- **Ciclo Atómico Estándar por Fase:**
  1. `docs(spec): ...`: Diseño de especificación, plan técnico y desglose de tareas (previo al desarrollo).
  2. `feat(...)` o `fix(...)`: Implementación de la lógica funcional o corrección.
  3. `test(...)`: Batería de pruebas unitarias o de integración asociadas.
  4. `docs(...)`: Actualización de documentación de usuario, changelog y manuales públicos.

---

## 3. Navegación Git y Estrategia de Ramas

1. **Comandos Git Modernos Obligatorios (`git switch` y `git restore`):**
   - Queda obsoleto y prohibido el uso del comando sobrecargado `git checkout`.
   - Para cambiar o crear ramas se usará exclusivamente `git switch` (ej. `git switch <rama>` o `git switch -c <nueva-rama>`).
   - Para descartar cambios o gestionar el área de preparación se usará exclusivamente `git restore` (ej. `git restore <archivo>` o `git restore --staged <archivo>`).
2. **Preservación de Histórico e Integridad:**
   - Queda prohibido el uso de `git rebase` destructivo o `git push --force` sobre ramas compartidas o sobre `main`.
   - Cada entrega debe preservar un historial limpio, atómico y verificable.

---

## 4. Automatización de Calidad y Git Hooks (`pre-commit` y `pre-push`)

El repositorio incorpora hooks de Git nativos y versionados en `.agent/hooks/`, activados mediante `git config core.hooksPath .agent/hooks`:

### 4.1. Hook de Pre-commit (`.agent/hooks/pre-commit`)
Se ejecuta de forma automática e imperativa antes de cada commit:
1. **Live Tracking y Telemetría Git:** Si existe `PROXIMOS_PASOS.md`, actualiza de forma automática la rama activa, el último commit y la fecha/hora de sincronización, incorporándolo al staging (`git add PROXIMOS_PASOS.md`).
2. **Blindaje de Inmutabilidad del Núcleo:** En ramas secundarias, aborta el commit si se detectan diferencias no autorizadas respecto a `main` en `.agent/hooks/` o `.agent/rules/AGENTS.md`.
3. **Escáner SAST de Seguridad en Staging:**
   - Bloquea cualquier archivo procedente del directorio confidencial `user_data/`.
   - Detecta y aborta ante marcadores de conflicto Git sin resolver (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Inspecciona exclusivamente las líneas añadidas (`+`) en `git diff --cached`:
     - Claves privadas (`BEGIN RSA/OPENSSH/DSA/EC/PGP PRIVATE KEY`).
     - Tokens conocidos de API (GitHub PAT, AWS keys, Stripe, OpenAI, Anthropic, Discord webhooks, JWT).
     - Rutas absolutas locales privadas (`/home/<usuario>/`, `/Users/<usuario>/`, `C:\Users\<usuario>\`).
     - Ruta dinámica `$HOME` de la estación de trabajo actual.
     - Patrones confidenciales locales cargados desde `user_data/security/forbidden_patterns.txt` (ignorado en Git).
4. **Hook Chaining Local (Opcional):** Si existe `.agent/hooks/pre-commit-local.sh`, lo ejecuta para comprobaciones específicas del proyecto (linters, compiladores, tests).

### 4.2. Hook de Pre-push (`.agent/hooks/pre-push`)
Se ejecuta de forma automática antes de enviar cambios al repositorio remoto:
1. **Protección de la Rama `main`:** Emite advertencias ante pushes directos a `main`, recordando la necesidad de revisión y autorización previa.
2. **Validación de Convención de Nombres de Ramas:** Comprueba que la rama a publicar cumpla las convenciones establecidas para el proyecto, auditando la jerarquía de subdirectorios para prevenir colisiones internas en Git.

### 4.3. Scripts y Herramientas del Núcleo de Gobernanza
- **Instalación y Activación de Hooks:**
  ```bash
  bash .agent/hooks/install-hooks.sh
  ```
- **Propagación Estática entre Ramas:**
  ```bash
  bash .agent/hooks/sync-governance.sh [--dry-run]
  ```
- **Publicación y Automatización de Releases:**
  ```bash
  bash .agent/hooks/publish-release.sh <VERSION> "<DESCRIPCION>" [--update-main-catalog]
  ```

---

## 5. Versionado Semántico (SemVer), Tags y Releases

El repositorio adopta la especificación [Semantic Versioning 2.0.0](https://semver.org/lang/es/) en conjunción con Conventional Commits y las directrices de publicación en GitHub:

### 5.1. Formato de Versión
```text
v<MAJOR>.<MINOR>.<PATCH>[-<PRERELEASE>]
```
- El prefijo **`v`** es obligatorio para todos los tags y releases (ej. `v0.1.0-alpha.1`, `v1.0.0`).
- **`MAJOR` (X.0.0):** Cambios que rompen la compatibilidad hacia atrás (*Breaking Changes*).
- **`MINOR` (X.Y.0):** Nuevas funcionalidades compatibles hacia atrás (*Features*).
- **`PATCH` (X.Y.Z):** Correcciones de errores o bugs compatibles hacia atrás (*Fixes*).
- **`<PRERELEASE>` (`-alpha.N`, `-beta.N`, `-rc.N`):** Versiones preliminares de prueba y validación.

### 5.2. Tags Anotados Obligatorios
1. **Tags Anotados Obligatorios:** Queda terminantemente prohibido el uso de tags ligeros (*lightweight*). Siempre se utilizarán tags anotados con mensaje descriptivo del hito:
   ```bash
   git tag -a v1.0.0 -m "release: v1.0.0 con funcionalidad completa"
   ```
2. **Mantenimiento Obligatorio de `CHANGELOG.md`:** Todo cambio versionado debe registrarse siguiendo el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) (`Added`, `Fixed`, `Changed`, `Security`, `Documentation`).

### 5.3. Checklist Mandatario Pre-Tag / Pre-Release (Aprobación Humana Obligatoria)
Antes de proponer o crear un tag formal de versión, se verificará obligatoriamente:
1. `[CHECK 1 - Build / Lint / Tests]:` Compilación o validación técnica limpia según el stack del proyecto (linters, compiladores o suites de validación si aplica).
2. `[CHECK 2 - Verificación Técnica]:` Comprobación de que configuraciones, scripts y código no contienen errores sintácticos ni referencias rotas.
3. `[CHECK 3 - Escáner SAST de Seguridad]:` Salida limpia de los hooks sin credenciales, tokens ni rutas privadas.
4. `[CHECK 4 - Sincronización de Estado y Metadatos]:` Actualización de `PROXIMOS_PASOS.md`, cierre ordenado de la versión en `CHANGELOG.md` (`[vX.Y.Z] - YYYY-MM-DD`) y actualización de `README.md` (del proyecto y de `main` si existe catálogo).

### 5.4. Automatización de Releases (`publish-release.sh`)
Para garantizar consistencia y evitar discrepancias documentales, la publicación de un release se apoya en el script estático:
```bash
bash .agent/hooks/publish-release.sh <VERSION> "<DESCRIPCION>" [--update-main-catalog]
```
Este proceso realiza automáticamente:
1. **Actualización de `CHANGELOG.md`:** Convierte la sección `[Unreleased]` en la versión fechada `[vX.Y.Z] - YYYY-MM-DD` y abre un nuevo bloque `[Unreleased]` vacío.
2. **Actualización de `README.md` del Proyecto:** Actualiza el badge o etiqueta de versión (`**Versión de Entrega:** <VERSION>`).
3. **Actualización de `README.md` de `main` (si aplica catálogo):** En repositorios con catálogo central en `main`, actualiza la fila de entrega correspondiente con el nuevo tag y estado.
4. **Commit Atómico y Tag:** Genera el commit `docs(release): preparar version <VERSION> y actualizar changelog/readme` y crea el tag anotado `vX.Y.Z`.

---

## 6. Gobernanza Git: Prohibición de Operaciones Autónomas

- **Prohibición Terminante de `git push` Autónomo:** Queda estrictamente prohibido que la IA ejecute `git push` sin autorización humana previa.
- **Prohibición de `git commit` Autónomo:** Queda **terminantemente prohibido ejecutar `git commit`** sin cumplir el siguiente protocolo:
  1. Presentar al usuario un resumen claro de los archivos modificados (`git status`, `git diff`).
  2. Ejecutar las validaciones locales pertinentes (linters, compilación o tests).
  3. Ejecutar la verificación de seguridad (confirmar que no existen credenciales, tokens ni datos privados).
  4. Mostrar el reporte de validación limpio.
  5. **Esperar la orden y aprobación humana explícita:** *"Procede con el commit"*.

---

## 7. Constitución de Seguridad y Privacidad (SAS)

- **Cero Credenciales y Cero Secretos:**
  - Queda estrictamente prohibido incluir en archivos versionados contraseñas, tokens de API, hashes privados, claves SSH privadas (`id_rsa`, `id_ed25519`), certificados privados, cookies de sesión o cadenas de conexión a bases de datos con credenciales.
  - Queda prohibido incluir rutas absolutas privadas locales (ej. `/home/<usuario>`). Utilizar siempre rutas relativas o variables de entorno estándar.
  - **Políticas de Datos Simulados (Mock Data):** Toda la información de usuario, pruebas de acceso o correos en configuraciones y manuales debe ser ficticia e inventada (ej. `admin@example.org`, `postmaster@domain.local`).
- **Aislamiento Estricto de `user_data/`:**
  - El directorio `user_data/` (herramientas locales, cachés, perfiles o notas confidenciales) queda **SIEMPRE EXCLUIDO** mediante `.gitignore`.
  - Bajo ninguna circunstancia se eliminará `user_data/` del `.gitignore` ni se comitearán archivos de este directorio.
- **Gitignore Retroactivo:**
  - Si se modifica `.gitignore` para añadir nuevas exclusiones sobre archivos previamente versionados, la IA purgará la caché mediante `git rm -r --cached <ruta>` y re-indexará antes de presentar los cambios para evitar "Ghost Tracking".

---

## 8. Principios de Metodología y Lifecycle Rules del Agente

- **Think-Before-Act:** Antes de modificar código, configuración o documentación, la IA debe explicar brevemente qué va a realizar, su justificación y a qué objetivo sirve.
- **Read-Before-Edit:** Queda prohibido modificar o sobrescribir un archivo sin haber leído previamente su contenido completo en la sesión activa.
- **Petición de Contexto Obligatoria ("Cero configuraciones a ciegas"):** Cuando el usuario introduzca o solicite una configuración técnica, arquitectónica o parámetro de diseño sin explicar el motivo, el agente **debe preguntarle por la motivación y el contexto técnico** antes de documentarlo o implementarlo, registrando la justificación correspondiente.
- **Trazabilidad y Preservación de Decisiones:** Las decisiones arquitectónicas modificadas o superadas no se eliminan sin dejar rastro; se documentan marcándolas formalmente como sustituidas, registrando el motivo del cambio y la solución que las reemplaza.
- **Desacoplamiento Temprano de Requerimientos:** Si durante el desarrollo se descubre un fallo o bug ajeno a la tarea en curso, se desacoplará inmediatamente; el bugfix se abordará y comiteará en su propio ciclo (`fix(...)`) sin mezclarse con la rama o tarea activa.
- **Uncertainty Marker (`[NEEDS CLARIFICATION]`):** Si se detectan ambigüedades, vacíos de diseño o contradicciones técnicas, la IA se detendrá y lanzará un bloque `[NEEDS CLARIFICATION]` interrogando directamente al usuario, sin asumir ni inventar soluciones.

---

## 9. Continuidad de Sesión y Estado (Live Tracking)

1. **Al iniciar cualquier sesión:**
   - Comprobar automáticamente la existencia del archivo `PROXIMOS_PASOS.md` en el espacio de trabajo.
   - Leer su contenido para retomar el contexto exacto antes de realizar cualquier acción.
2. **Al finalizar un hito o sesión:**
   - Actualizar `PROXIMOS_PASOS.md` reflejando las tareas completadas, el estado del proyecto y los pasos inmediatos siguientes.
   - El hook de pre-commit actualizará automáticamente la telemetría Git asociada en el siguiente commit.

---

## 10. Mantenimiento Mandatorio de la Documentación Pública

Tras el desarrollo o integración de cada nueva característica o corrección:
1. **Actualización Obligatoria de `README.md`:** Reflejar cualquier cambio en capacidades principales, configuración o requisitos.
2. **Actualización Obligatoria de `CHANGELOG.md`:** Registrar los cambios bajo la sección `[Unreleased]` con las categorías correspondientes (`Added`, `Fixed`, `Changed`, `Security`, `Documentation`).
3. **Commit Atómico Independiente de Documentación (`docs:`):**
   - La documentación pública debe comitearse siempre de forma aislada e independiente en un commit posterior al del código funcional o corrección:
     ```bash
     docs: actualizar manual de usuario, readme y changelog
     ```
   - Queda terminantemente prohibido incluir modificaciones a la documentación pública dentro de commits de tipo `feat(...)` o `fix(...)`.

