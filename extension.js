"use strict";

const vscode = require("vscode");
const { formatEjsDocument } = require("./formatter");

function getFormatterOptions(document, formattingOptions) {
  const config = vscode.workspace.getConfiguration("ejsSmartFormatter", document.uri);
  const useEditorTabSize = config.get("useEditorTabSize", true);
  const configuredTabSize = config.get("tabSize", 4);

  return {
    tabSize: useEditorTabSize
      ? (formattingOptions?.tabSize ?? configuredTabSize)
      : configuredTabSize,
    insertSpaces: formattingOptions?.insertSpaces ?? true,
    spaceInsideTags: config.get("spaceInsideTags", true),
    quoteUnquotedEjsAttributes: config.get("quoteUnquotedEjsAttributes", true),
    fixDoubleOpenBracket: config.get("fixDoubleOpenBracket", true),
    indentEjsBlocks: config.get("indentEjsBlocks", true),
    selfClosingSpace: config.get("selfClosingSpace", true),
    maxEmptyLines: config.get("maxEmptyLines", 1)
  };
}

function createFullDocumentFormattingEdits(document, options) {
  const originalText = document.getText();
  const formattedText = formatEjsDocument(originalText, getFormatterOptions(document, options));

  if (formattedText === originalText) {
    return [];
  }

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(originalText.length)
  );

  return [vscode.TextEdit.replace(fullRange, formattedText)];
}

function activate(context) {
  const selectors = [
    { language: "ejs" },
    { language: "html" },
    { pattern: "**/*.ejs" }
  ];

  const docFormattingProvider = vscode.languages.registerDocumentFormattingEditProvider(
    selectors,
    {
      provideDocumentFormattingEdits(document, options) {
        return createFullDocumentFormattingEdits(document, options);
      }
    }
  );

  const rangeFormattingProvider = vscode.languages.registerDocumentRangeFormattingEditProvider(
    selectors,
    {
      provideDocumentRangeFormattingEdits(document, _range, options) {
        // En plantillas EJS los bloques <% if %> / <% forEach %> abarcan todo el documento,
        // por lo que formatear el documento completo garantiza coherencia de sangría.
        return createFullDocumentFormattingEdits(document, options);
      }
    }
  );

  const formatCommand = vscode.commands.registerCommand(
    "ejsSmartFormatter.formatDocument",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      const doc = editor.document;
      const options = {
        tabSize: Number(editor.options.tabSize) || 4,
        insertSpaces: Boolean(editor.options.insertSpaces ?? true)
      };
      const edits = createFullDocumentFormattingEdits(doc, options);
      if (edits.length > 0) {
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.set(doc.uri, edits);
        await vscode.workspace.applyEdit(workspaceEdit);
      }
    }
  );

  context.subscriptions.push(
    docFormattingProvider,
    rangeFormattingProvider,
    formatCommand
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};

