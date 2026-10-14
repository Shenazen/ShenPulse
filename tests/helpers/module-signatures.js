"use strict";

/** Empreintes des vrais corps et valeurs : déplacés, pas réécrits silencieusement. */
const ts = require("typescript");
const { createHash } = require("node:crypto");
const { readTypeScriptSourceGraph } = require("./original-game-sources");

function moduleSignatures(file) {
  const source = ts.createSourceFile(file, readTypeScriptSourceGraph(file), ts.ScriptTarget.Latest, true);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const signatures = {};
  const hash = (node, hint = ts.EmitHint.Unspecified) => createHash("sha256").update(printer.printNode(hint, node, source)).digest("hex");
  for (const node of source.statements) {
    if (ts.isFunctionDeclaration(node)) signatures[node.name.text] = hash(node.body);
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) signatures[declaration.name.getText(source)] = hash(declaration.initializer, ts.EmitHint.Expression);
  }
  return signatures;
}

module.exports = { moduleSignatures };
