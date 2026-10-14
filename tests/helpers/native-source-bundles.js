"use strict";

/** Analyse lexicale des blocs natifs, en ignorant accolades de chaînes et commentaires. */
const fs = require("node:fs");
const path = require("node:path");

function closeNativeBlock(source, start) {
  let depth = 0, quote = "", line = false, block = false;
  for (let index = start; index < source.length; index++) {
    const character = source[index], next = source[index + 1];
    if (line) { if (character === "\n") line = false; continue; }
    if (block) { if (character === "*" && next === "/") { block = false; index++; } continue; }
    if (quote) { if (character === "\\") index++; else if (character === quote) quote = ""; continue; }
    if (character === "/" && next === "/") { line = true; index++; continue; }
    if (character === "/" && next === "*") { block = true; index++; continue; }
    if (character === "\"" || character === "'") { quote = character; continue; }
    if (character === "{") depth++;
    if (character === "}" && --depth === 0) return index + 1;
  }
  throw new Error("Bloc natif incomplet");
}

function nativeFunctions(source, language = "cpp") {
  source = source.replace(/\r\n/g, "\n");
  const expression = language === "cpp"
    ? /^([^\n]*?\b([A-Za-z_]\w*)\([^;\n]*\)) \{/gm
    : /^ {8}((?:private|public|internal)\s+(?:static\s+)?[\w<>\[\]]+\s+(\w+)\([\s\S]*?\))\s*\{/gm;
  const functions = [];
  let match;
  while ((match = expression.exec(source))) {
    const end = closeNativeBlock(source, source.indexOf("{", match.index));
    const full = source.slice(match.index, end);
    functions.push({
      name: match[2], signature: match[1], full,
      body: full.slice((language === "cpp" ? 0 : 8) + match[1].length)
    });
    expression.lastIndex = end;
  }
  return functions;
}

function nativeFunctionBody(source, name, language = "cpp") {
  const entry = nativeFunctions(source, language).find((item) => item.name === name);
  if (!entry) throw new Error(`Fonction native introuvable : ${name}`);
  return entry.body;
}

function readNativeDirectory(directory, extensions) {
  return fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).map((entry) => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name.toLowerCase() === "tests" ? "" : readNativeDirectory(file, extensions);
    return extensions.includes(path.extname(file)) ? fs.readFileSync(file, "utf8") : "";
  }).join("\n\n");
}

module.exports = { closeNativeBlock, nativeFunctions, nativeFunctionBody, readNativeDirectory };
