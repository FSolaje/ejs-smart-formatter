# Historial de Cambios (Changelog)

Todos los cambios notables de este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [Unreleased]

## [v1.0.0] - 2026-10-26

### Added
- Motor de formateo híbrido EJS + HTML (`formatter.js`) con cálculo combinado de jerarquía de etiquetas contenedor HTML y bloques lógicos JavaScript (`if`, `else if`, `else`, `forEach`, `for`, `while`, `switch/case/default`, `try/catch/finally`).
- Enmascaramiento seguro de bloques `<% ... %>` previo al análisis estructural HTML para proteger operadores relacionales (`>`, `<`).
- entrecomillado automático de atributos HTML dinámicos sin comillas (`src=<%= ... %>` → `src="<%= ... %>"`).
- Separación automática en líneas independientes de etiquetas de control EJS pegadas a etiquetas HTML tras expandir snippets.
- Autocorrección de dobles signos de apertura `<<%` originados al escribir `<` antes de expandir un snippet EJS.
- Soporte de sangría para bloques `<style>`, `<script>` y scriptlets EJS multilínea.
- Empaquetador autónomo sin dependencias externas (`pack-vsix.js`) y paquete instalable `ejs-smart-formatter-1.0.0.vsix`.

