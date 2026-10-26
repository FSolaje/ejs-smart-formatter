# EJS Smart Formatter (`fsolaje-tools.ejs-smart-formatter`)

> **Versión de Entrega:** `v1.0.0`

Formateador inteligente para plantillas **EJS** y **HTML** en Visual Studio Code / Antigravity, diseñado para resolver las limitaciones de los formateadores HTML tradicionales cuando trabajan con bloques de control EJS (`<% if %>`, `<% forEach %>`, `<% switch %>`).

## Características Principales

1. **Indentación Jerárquica Real (HTML + Bloques EJS):**
   - Calcula la sangría combinando la jerarquía de contenedores HTML (`<html>`, `<body>`, `<main>`, `<article>`, `<div>`...) con los bloques lógicos de JavaScript dentro de etiquetas `<% ... %>` (`if`, `else if`, `else`, `forEach`, `for`, `while`, `switch/case/default`, `try/catch/finally`).
2. **Enmascaramiento Seguro de Tokens EJS:**
   - Protege las expresiones EJS antes de analizar el HTML para que operadores como `>` o `<` dentro de condiciones (`<% if (peliculas.length > 0) { %>`) nunca se confundan con cierres de etiquetas HTML.
3. **Protección de Comillas en Atributos HTML:**
   - Evita que se pierdan las comillas en atributos dinámicos y envuelve automáticamente expresiones sin comillas (`src=<%= pelicula.Poster %>` → `src="<%= pelicula.Poster %>"`).
4. **Separación Automática de Líneas Estructurales:**
   - Si al usar un snippet quedan etiquetas de control pegadas a etiquetas HTML (como `<% } else { %> <p>...` o `<% } %> </main>`), las separa automáticamente en sus propias líneas con la sangría exacta.
5. **Autocorrección de Snippets (`<<%`):**
   - Corrige automáticamente el doble signo `<<%` que ocurre al escribir `<` antes de expandir un snippet de EJS.
6. **Soporte de Bloques `<style>`, `<script>` y Scriptlets Multilínea:**
   - Indenta código CSS/JS embebido en etiquetas `<style>` y `<script>` así como bloques `<% ... %>` de varias líneas.

## Instalación en cualquier VS Code / Antigravity

### Opción 1: Desde la interfaz gráfica (recomendada para exportar a otros equipos)
1. Copia el archivo **`ejs-smart-formatter-1.0.0.vsix`**.
2. Abre VS Code → Panel de **Extensiones** (`Ctrl + Shift + X`).
3. Haz clic en el menú **`...`** (arriba a la derecha del panel de extensiones) → **`Install from VSIX...` (`Instalar desde VSIX...`)**.
4. Selecciona `ejs-smart-formatter-1.0.0.vsix`.

### Opción 2: Configuración como formateador por defecto en `settings.json`
```json
{
  "files.associations": {
    "*.ejs": "html"
  },
  "[html]": {
    "editor.defaultFormatter": "fsolaje-tools.ejs-smart-formatter"
  },
  "[ejs]": {
    "editor.defaultFormatter": "fsolaje-tools.ejs-smart-formatter"
  }
}
```

## Regenerar el paquete `.vsix` tras modificar reglas
Si en el futuro deseas ajustar alguna regla en `formatter.js`, basta con ejecutar:
```bash
node pack-vsix.js
```
Esto generará de nuevo el archivo `ejs-smart-formatter-1.0.0.vsix` sin necesitar dependencias externas.

