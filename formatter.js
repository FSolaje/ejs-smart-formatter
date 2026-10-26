"use strict";

const VOID_HTML_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);

const CONTAINER_BLOCK_TAGS =
  "html|head|body|header|footer|main|nav|aside|section|article|div|form|ul|ol|table|thead|tbody|tfoot|tr|fieldset|dl|figure|details|dialog";

/**
 * Extrae todos los bloques EJS (<% ... %>) de un texto y los reemplaza por
 * marcadores de posición seguros (__EJS_TOKEN_0__) para que los signos < y >
 * dentro de expresiones JS (como `peliculas.length > 0`) nunca se confundan
 * con etiquetas HTML.
 */
function maskEjsTags(text) {
  const tokens = [];
  const ejsRegex = /<%%|%%>|<%[#=\-_]?[\s\S]*?[-_]?%>/g;
  const masked = text.replace(ejsRegex, (match) => {
    const id = tokens.length;
    tokens.push(match);
    return `__EJS_TOKEN_${id}__`;
  });
  return { masked, tokens };
}

function unmaskEjsTags(text, tokens, currentIndentLevel, indentUnit) {
  return text.replace(/__EJS_TOKEN_(\d+)__/g, (_, index) => {
    const tok = tokens[Number(index)];
    if (!tok.includes("\n")) {
      return tok;
    }
    return formatMultilineEjsBlock(tok, currentIndentLevel, indentUnit);
  });
}

/**
 * Formatea un bloque EJS multilínea (<% ... \n ... %>) indentando cada línea JS
 * interna según el nivel de sangría del documento + llaves { } internas.
 */
function formatMultilineEjsBlock(tag, baseIndentLevel, indentUnit) {
  const match = tag.match(/^(<%[#=\-_]?)([\s\S]*?)([-_]?%>)$/);
  if (!match) {
    return tag;
  }

  const openDelim = match[1];
  const rawBody = match[2];
  const closeDelim = match[3];

  const lines = rawBody
    .split("\n")
    .map((l) => l.trim())
    .filter((l, idx, arr) => {
      if (idx === 0 && l === "") return false;
      if (idx === arr.length - 1 && l === "") return false;
      return true;
    });

  if (lines.length === 0) {
    return `${openDelim} ${closeDelim}`;
  }

  if (openDelim === "<%#") {
    const innerIndent = indentUnit.repeat(baseIndentLevel + 1);
    const closeIndent = indentUnit.repeat(baseIndentLevel);
    return (
      `${openDelim}\n` +
      lines.map((l) => (l ? `${innerIndent}${l}` : "")).join("\n") +
      `\n${closeIndent}${closeDelim}`
    );
  }

  let jsIndent = baseIndentLevel + 1;
  const formattedBody = [];

  for (const line of lines) {
    if (!line) {
      formattedBody.push("");
      continue;
    }
    const { leadingClose, netOpenAfterLeading } = countJsLineBraces(line);
    jsIndent = Math.max(baseIndentLevel + 1, jsIndent - leadingClose);
    formattedBody.push(`${indentUnit.repeat(jsIndent)}${line}`);
    jsIndent = Math.max(baseIndentLevel + 1, jsIndent + netOpenAfterLeading);
  }

  const closeIndent = indentUnit.repeat(baseIndentLevel);
  return `${openDelim}\n${formattedBody.join("\n")}\n${closeIndent}${closeDelim}`;
}

/**
 * Limpia strings y comentarios de un fragmento JS/CSS.
 */
function stripJsStringsAndComments(code) {
  return code
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .trim();
}

/**
 * Cuenta llaves `{` y `}` en una línea de código JS o CSS ignorando strings y comentarios.
 */
function countJsLineBraces(codeLine) {
  const clean = stripJsStringsAndComments(codeLine);

  let leadingClose = 0;
  let openAfterLeading = 0;
  let seenOpen = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === "{" || ch === "[") {
      seenOpen = true;
      openAfterLeading++;
    } else if (ch === "}" || ch === "]") {
      if (!seenOpen && openAfterLeading === 0) {
        leadingClose++;
      } else {
        openAfterLeading--;
      }
    }
  }

  return { leadingClose, netOpenAfterLeading: openAfterLeading };
}

/**
 * Normaliza el espaciado interno de una etiqueta EJS individual.
 */
function normalizeSingleEjsTag(tag, options) {
  if (tag === "<%%" || tag === "%%>") {
    return tag;
  }
  if (!options.spaceInsideTags) {
    return tag;
  }
  if (tag.includes("\n")) {
    return tag;
  }

  const match = tag.match(/^(<%[#=\-_]?)([\s\S]*?)([-_]?%>)$/);
  if (!match) {
    return tag;
  }

  const openDelim = match[1];
  let inner = match[2].trim();
  const closeDelim = match[3];

  if (openDelim === "<%#") {
    return `${openDelim} ${inner} ${closeDelim}`;
  }

  if (openDelim === "<%" || openDelim === "<%_") {
    inner = normalizeJsControlSpacing(inner);
  }

  if (inner.length === 0) {
    return `${openDelim} ${closeDelim}`;
  }

  return `${openDelim} ${inner} ${closeDelim}`;
}

/**
 * Normaliza espacios básicos en estructuras de control JS (if, else, for, while, switch, catch)
 * respetando literales de cadena ('...', "...", `...`).
 */
function normalizeJsControlSpacing(code) {
  const stringTokens = [];
  const maskedCode = code.replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => {
    const idx = stringTokens.length;
    stringTokens.push(m);
    return `__JS_STR_${idx}__`;
  });

  const normalized = maskedCode
    .replace(/\b(if|for|while|switch|catch)\s*\(/g, "$1 (")
    .replace(/\}\s*else\s+if\s*\(/g, "} else if (")
    .replace(/\}\s*else\s*\{/g, "} else {")
    .replace(/\}\s*catch\s*\(/g, "} catch (")
    .replace(/\}\s*finally\s*\{/g, "} finally {")
    .replace(/\)\s*\{/g, ") {")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.replace(/__JS_STR_(\d+)__/g, (_, idx) => stringTokens[Number(idx)]);
}

/**
 * Analiza el balance de llaves `{` y `}` y sentencias `case` / `default` / `break`
 * dentro de un scriptlet EJS (<% ... %> o <%_ ... %>).
 * Ignora etiquetas de salida (<%=, <%-) y comentarios (<%#).
 */
function analyzeEjsScriptletBraces(tag) {
  if (tag === "<%%" || tag === "%%>") {
    return {
      isScriptlet: false,
      leadingClose: 0,
      netOpenAfterLeading: 0,
      isSwitchCase: false,
      isBreak: false
    };
  }
  const match = tag.match(/^(<%[#=\-_]?)([\s\S]*?)([-_]?%>)$/);
  if (!match) {
    return {
      isScriptlet: false,
      leadingClose: 0,
      netOpenAfterLeading: 0,
      isSwitchCase: false,
      isBreak: false
    };
  }

  const openDelim = match[1];
  if (openDelim !== "<%" && openDelim !== "<%_") {
    return {
      isScriptlet: false,
      leadingClose: 0,
      netOpenAfterLeading: 0,
      isSwitchCase: false,
      isBreak: false
    };
  }

  const cleanJs = stripJsStringsAndComments(match[2]);
  const { leadingClose, netOpenAfterLeading } = countJsLineBraces(match[2]);
  const isSwitchCase = /^(case\b.+|default)\s*:\s*$/.test(cleanJs);
  const isBreak = /^break\s*;?\s*$/.test(cleanJs);

  return {
    isScriptlet: true,
    leadingClose,
    netOpenAfterLeading,
    isSwitchCase,
    isBreak
  };
}

/**
 * Envuelve entre comillas dobles los atributos HTML cuyo valor sea un token EJS sin comillas:
 * ej. src=__EJS_TOKEN_0__ -> src="__EJS_TOKEN_0__"
 */
function quoteUnquotedEjsAttributes(maskedLine) {
  return maskedLine.replace(
    /(\s[a-zA-Z_:][-a-zA-Z0-9_:.]*\s*=\s*)(__EJS_TOKEN_\d+__)(?=[\s/>]|$)/g,
    '$1"$2"'
  );
}

/**
 * Normaliza el espacio antes de `/>` en etiquetas HTML autocerradas (<meta .../> -> <meta ... />)
 */
function normalizeSelfClosingHtmlTags(maskedLine, selfClosingSpace) {
  return maskedLine.replace(/<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*?)?\s*\/>/g, (full, tagName, attrs = "") => {
    const cleanAttrs = attrs.trimEnd();
    if (selfClosingSpace) {
      return `<${tagName}${cleanAttrs} />`;
    }
    return `<${tagName}${cleanAttrs}/>`;
  });
}

/**
 * Separa en líneas independientes las etiquetas estructurales de control EJS o bloques HTML
 * cuando han quedado pegadas en la misma línea por un snippet (ej. `<% } else { %> <p>...` o `<% } %> </main>`).
 */
function splitMixedStructuralLines(maskedText, tokens) {
  const rawLines = maskedText.split("\n");
  const resultLines = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) {
      resultLines.push("");
      continue;
    }

    const parts = splitLineAroundBlockTokens(line, tokens);
    for (const part of parts) {
      resultLines.push(part);
    }
  }

  return resultLines;
}

function isControlScriptletInfo(info) {
  return (
    info.isScriptlet &&
    (info.leadingClose > 0 || info.netOpenAfterLeading > 0 || info.isSwitchCase || info.isBreak)
  );
}

function splitLineAroundBlockTokens(line, tokens) {
  const tokenRegex = /__EJS_TOKEN_(\d+)__/g;
  let match;
  let hasControlScriptlet = false;

  while ((match = tokenRegex.exec(line)) !== null) {
    const tokenContent = tokens[Number(match[1])];
    const braceInfo = analyzeEjsScriptletBraces(tokenContent);
    if (isControlScriptletInfo(braceInfo)) {
      hasControlScriptlet = true;
      break;
    }
  }

  let currentSegments = [line];

  if (hasControlScriptlet) {
    const nextSegments = [];
    for (const seg of currentSegments) {
      let s = seg.replace(/(__EJS_TOKEN_\d+__)\s*(?=<[a-zA-Z/!]|__EJS_TOKEN_\d+__)/g, (m, tok) => {
        const idx = Number(tok.match(/\d+/)[0]);
        const info = analyzeEjsScriptletBraces(tokens[idx]);
        if (isControlScriptletInfo(info)) {
          return `${tok}\n`;
        }
        return m;
      });
      s = s.replace(/(<\/[a-zA-Z0-9:-]+>|<[a-zA-Z0-9:-]+[^>]*>)\s*(__EJS_TOKEN_\d+__)/g, (m, htmlTag, tok) => {
        const idx = Number(tok.match(/\d+/)[0]);
        const info = analyzeEjsScriptletBraces(tokens[idx]);
        if (isControlScriptletInfo(info)) {
          return `${htmlTag}\n${tok}`;
        }
        return m;
      });
      for (const piece of s.split("\n")) {
        if (piece.trim()) {
          nextSegments.push(piece.trim());
        }
      }
    }
    currentSegments = nextSegments;
  }

  // Separar contenedores de bloque HTML pegados en la misma línea (ej. `</p> </main>` o `<main><article>`)
  const openContainerRegex = new RegExp(
    `(<(?:${CONTAINER_BLOCK_TAGS})(?:\\s[^>]*)?>)\\s*(?=<(?:${CONTAINER_BLOCK_TAGS}|h[1-6]|p|a|img|input|span|button)\\b)`,
    "gi"
  );
  const closeContainerRegex = new RegExp(
    `(<\\/[a-zA-Z0-9:-]+>)\\s*(<\\/(?:${CONTAINER_BLOCK_TAGS})>)`,
    "gi"
  );

  const finalSegments = [];
  for (const seg of currentSegments) {
    const s = seg
      .replace(openContainerRegex, "$1\n")
      .replace(closeContainerRegex, "$1\n$2");
    for (const piece of s.split("\n")) {
      if (piece.trim()) {
        finalSegments.push(piece.trim());
      }
    }
  }

  return finalSegments;
}

/**
 * Analiza las etiquetas HTML y los scriptlets EJS de una línea enmascarada
 * para calcular:
 *  - preOutdent: cuántos niveles debe desindentarse ESTA línea antes de imprimirse
 *  - postIndent: cuántos niveles cambia la indentación para las líneas SIGUIENTES
 */
function computeLineIndentationDelta(maskedLine, tokens, options, state) {
  let preOutdent = 0;
  let postIndent = 0;

  const workingLine = maskedLine.trim();

  // Si estamos dentro de una etiqueta HTML abierta en múltiples líneas (<input \n type="text" \n />)
  if (state.inMultilineHtmlTag) {
    if (workingLine.includes(">")) {
      const endsWithSelfClose = workingLine.endsWith("/>") || VOID_HTML_TAGS.has(state.multilineTagName);
      state.inMultilineHtmlTag = false;
      state.multilineTagName = "";
      if (workingLine === ">" || workingLine === "/>") {
        preOutdent += 1;
        if (!endsWithSelfClose) {
          postIndent += 1;
        }
      } else if (endsWithSelfClose) {
        postIndent -= 1;
      }
    }
    return { preOutdent, postIndent };
  }

  // Manejo de bloques <style> y <script>
  if (state.inStyleOrScript) {
    if (/^<\/(style|script)\b/i.test(workingLine)) {
      state.inStyleOrScript = false;
      preOutdent += 1;
      return { preOutdent, postIndent };
    }
    const lineWithoutEjs = workingLine.replace(/__EJS_TOKEN_\d+__/g, "");
    const { leadingClose, netOpenAfterLeading } = countJsLineBraces(lineWithoutEjs);
    preOutdent += leadingClose;
    postIndent += netOpenAfterLeading;

    if (options.indentEjsBlocks) {
      const ejsMatches = [...workingLine.matchAll(/__EJS_TOKEN_(\d+)__/g)];
      ejsMatches.forEach((m, index) => {
        const info = analyzeEjsScriptletBraces(tokens[Number(m[1])]);
        if (info.isScriptlet) {
          if (index === 0 && workingLine.startsWith(m[0]) && info.leadingClose > 0) {
            preOutdent += info.leadingClose;
            postIndent += info.netOpenAfterLeading;
          } else {
            postIndent += info.netOpenAfterLeading - info.leadingClose;
          }
        }
      });
    }
    return { preOutdent, postIndent };
  }

  // 1. Comprobar si la línea comienza con una etiqueta de cierre HTML (ej. `</div>`, `</main>`)
  const leadingCloseTagMatch = workingLine.match(/^<\/([a-zA-Z][a-zA-Z0-9:-]*)\s*>/);
  let consumedLeadingHtmlClose = false;
  if (leadingCloseTagMatch) {
    const closeTagName = leadingCloseTagMatch[1].toLowerCase();
    if (!VOID_HTML_TAGS.has(closeTagName)) {
      preOutdent += 1;
      consumedLeadingHtmlClose = true;
    }
  }

  // 2. Analizar todos los tokens EJS presentes en la línea
  if (options.indentEjsBlocks) {
    const ejsMatches = [...workingLine.matchAll(/__EJS_TOKEN_(\d+)__/g)];
    ejsMatches.forEach((m, index) => {
      const tokenStr = tokens[Number(m[1])];
      const info = analyzeEjsScriptletBraces(tokenStr);
      if (!info.isScriptlet) {
        return;
      }

      if (info.isSwitchCase) {
        if (state.switchCaseDepth > 0) {
          preOutdent += 1;
          postIndent += 1;
        } else {
          state.switchCaseDepth++;
          postIndent += 1;
        }
        return;
      }

      if (info.isBreak) {
        if (state.switchCaseDepth > 0) {
          state.switchCaseDepth--;
          postIndent -= 1;
        }
        return;
      }

      if (index === 0 && workingLine.startsWith(m[0]) && info.leadingClose > 0) {
        if (state.switchCaseDepth > 0 && info.netOpenAfterLeading === 0) {
          state.switchCaseDepth--;
          preOutdent += 1;
        }
        preOutdent += info.leadingClose;
        postIndent += info.netOpenAfterLeading;
      } else {
        postIndent += info.netOpenAfterLeading - info.leadingClose;
      }
    });
  }

  // 3. Detectar inicio de etiqueta HTML multilínea (empieza por `<tag` y no tiene `>` en la línea)
  const lineWithoutComments = workingLine
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  const unclosedTagMatch = lineWithoutComments.match(/<([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*)?$/);
  if (unclosedTagMatch) {
    state.inMultilineHtmlTag = true;
    state.multilineTagName = unclosedTagMatch[1].toLowerCase();
    postIndent += 1;
    return { preOutdent, postIndent };
  }

  // 4. Analizar todas las etiquetas HTML completas en la línea
  const htmlTagRegex = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(\s[^>]*?)?(\/?)>/g;
  let tagMatch;
  let isFirstHtmlTag = true;

  while ((tagMatch = htmlTagRegex.exec(lineWithoutComments)) !== null) {
    const fullTag = tagMatch[0];
    const tagName = tagMatch[1].toLowerCase();
    const isClosing = fullTag.startsWith("</");
    const isSelfClosing = tagMatch[3] === "/" || VOID_HTML_TAGS.has(tagName);

    if (isClosing) {
      if (isFirstHtmlTag && consumedLeadingHtmlClose) {
        // Ya fue descontado en preOutdent
      } else if (!VOID_HTML_TAGS.has(tagName)) {
        postIndent -= 1;
      }
    } else if (!isSelfClosing) {
      postIndent += 1;
      if ((tagName === "style" || tagName === "script") && !lineWithoutComments.includes(`</${tagName}`)) {
        state.inStyleOrScript = true;
      }
    }

    isFirstHtmlTag = false;
  }

  return { preOutdent, postIndent };
}

/**
 * Formatea un documento EJS/HTML completo aplicando todas las reglas de sangría y normalización.
 *
 * @param {string} text - Contenido original del archivo `.ejs`
 * @param {object} userOptions - Opciones de formateo
 * @returns {string} Código EJS/HTML formateado
 */
function formatEjsDocument(text, userOptions = {}) {
  const options = {
    tabSize: userOptions.tabSize ?? 4,
    insertSpaces: userOptions.insertSpaces ?? true,
    spaceInsideTags: userOptions.spaceInsideTags ?? true,
    quoteUnquotedEjsAttributes: userOptions.quoteUnquotedEjsAttributes ?? true,
    fixDoubleOpenBracket: userOptions.fixDoubleOpenBracket ?? true,
    indentEjsBlocks: userOptions.indentEjsBlocks ?? true,
    selfClosingSpace: userOptions.selfClosingSpace ?? true,
    maxEmptyLines: userOptions.maxEmptyLines ?? 1
  };

  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const indentUnit = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";

  let source = text.replace(/\r\n/g, "\n");

  // 1. Corregir errata común de snippets (`<<%` -> `<%`)
  if (options.fixDoubleOpenBracket) {
    source = source.replace(/<<%(?!%)/g, "<%");
  }

  // 2. Proteger bloques <pre> y <textarea> cuyo espacio interior es literal
  const rawBlocks = [];
  source = source.replace(/<(pre|textarea)(\b[^>]*>[\s\S]*?<\/\1>)/gi, (match) => {
    const id = rawBlocks.length;
    rawBlocks.push(match);
    return `__RAW_HTML_BLOCK_${id}__`;
  });

  // 3. Enmascarar todas las etiquetas EJS y normalizar su interior
  const { masked, tokens } = maskEjsTags(source);
  const normalizedTokens = tokens.map((tok) => normalizeSingleEjsTag(tok, options));

  // 4. Dividir líneas que mezclen estructuras de control EJS o cierres de bloque HTML
  const rawLines = splitMixedStructuralLines(masked, normalizedTokens);

  // 5. Recorrer línea por línea aplicando normalización de atributos y cálculo de sangría
  let indentLevel = 0;
  let consecutiveEmptyLines = 0;
  const formattedLines = [];
  let inMultiLineComment = false;
  const parserState = {
    inMultilineHtmlTag: false,
    multilineTagName: "",
    inStyleOrScript: false,
    switchCaseDepth: 0
  };

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i].trim();

    if (line === "") {
      consecutiveEmptyLines++;
      if (consecutiveEmptyLines <= options.maxEmptyLines && formattedLines.length > 0) {
        formattedLines.push("");
      }
      continue;
    }
    consecutiveEmptyLines = 0;

    if (inMultiLineComment) {
      const restoredCommentLine = unmaskEjsTags(line, normalizedTokens, indentLevel, indentUnit);
      formattedLines.push(indentUnit.repeat(Math.max(0, indentLevel)) + restoredCommentLine);
      if (line.includes("-->")) {
        inMultiLineComment = false;
      }
      continue;
    }
    if (line.startsWith("<!--") && !line.includes("-->")) {
      const restoredCommentLine = unmaskEjsTags(line, normalizedTokens, indentLevel, indentUnit);
      formattedLines.push(indentUnit.repeat(Math.max(0, indentLevel)) + restoredCommentLine);
      inMultiLineComment = true;
      continue;
    }

    if (!parserState.inStyleOrScript) {
      if (options.quoteUnquotedEjsAttributes) {
        line = quoteUnquotedEjsAttributes(line);
      }
      line = normalizeSelfClosingHtmlTags(line, options.selfClosingSpace);
    }

    const { preOutdent, postIndent } = computeLineIndentationDelta(
      line,
      normalizedTokens,
      options,
      parserState
    );

    indentLevel = Math.max(0, indentLevel - preOutdent);

    const finalLineText = unmaskEjsTags(line, normalizedTokens, indentLevel, indentUnit);
    formattedLines.push(indentUnit.repeat(indentLevel) + finalLineText);

    indentLevel = Math.max(0, indentLevel + postIndent);
  }

  while (formattedLines.length > 0 && formattedLines[formattedLines.length - 1] === "") {
    formattedLines.pop();
  }

  let output = formattedLines.join("\n") + "\n";

  // Restaurar bloques <pre> y <textarea>
  output = output.replace(/__RAW_HTML_BLOCK_(\d+)__/g, (_, id) => rawBlocks[Number(id)]);

  return eol === "\r\n" ? output.replace(/\n/g, "\r\n") : output;
}

module.exports = {
  formatEjsDocument
};

