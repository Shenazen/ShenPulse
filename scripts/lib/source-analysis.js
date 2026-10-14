"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const ts = require("typescript");
const { parse } = require("vue/compiler-sfc");

const SOURCE_ROOTS = ["src", "scripts", "resources", "website", "native", "firebase", "sdk", "tests"];
const EXTENSIONS = new Set([".js", ".mjs", ".ts", ".vue", ".css", ".py", ".ps1", ".psm1", ".cc", ".cpp", ".h", ".cs", ".java"]);
const EXCLUDED_DIRECTORIES = new Set(["node_modules", ".git", "dist", "output", "vendor", "media"]);
const GENERATED_FILES = new Set([
  "src/renderer/game-overlay-generator.js",
  "website/styles.css",
  "resources/overlays/runtime/widgets.js",
  "resources/overlays/runtime/wheel-match.js"
]);

/** Inventorie les sources propres au projet. Les bundles et tiers sont distingués explicitement. */
function inventorySources(root = process.cwd()) {
  const files = [];
  const excluded = [];
  function walk(relative) {
    const absolute = path.resolve(root, relative);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = path.join(relative, entry.name).replaceAll("\\", "/");
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRECTORIES.has(entry.name) || child === "src/renderer/games/original" ||
            child === "native/gtav-montchiliad-enhanced/sdk") {
          excluded.push({ path: child, reason: "Dépendance, ressource binaire ou sortie générée" });
        } else walk(child);
      } else if (EXTENSIONS.has(path.extname(child))) {
        const source = fs.readFileSync(path.join(root, child), "utf8");
        files.push({ path: child, lines: source.split(/\r?\n/).length,
          bytes: Buffer.byteLength(source), generated: GENERATED_FILES.has(child) || child.endsWith(".generated.css"), source });
      }
    }
  }
  SOURCE_ROOTS.forEach(walk);
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !EXTENSIONS.has(path.extname(entry.name))) continue;
    const source = fs.readFileSync(path.join(root, entry.name), "utf8");
    files.push({ path: entry.name, lines: source.split(/\r?\n/).length,
      bytes: Buffer.byteLength(source), generated: false, source });
  }
  return { files: files.sort((a, b) => a.path.localeCompare(b.path)), excluded };
}

/** Analyse un script JS/TS ou les blocs script d'un composant Vue, sans exécuter le code. */
function parseScripts(file) {
  const extension = path.extname(file.path);
  let blocks = [];
  const errors = [];
  if (extension === ".vue") {
    const result = parse(file.source, { filename: file.path });
    errors.push(...result.errors.map(String));
    blocks = [result.descriptor.script, result.descriptor.scriptSetup].filter(Boolean)
      .map((block) => ({ text: block.content, offset: block.loc.start.line - 1, typed: block.lang === "ts" }));
  } else if ([".js", ".mjs", ".ts"].includes(extension)) {
    blocks = [{ text: file.source, offset: 0, typed: extension === ".ts" }];
  }
  const scripts = blocks.map((block) => {
    const ast = ts.createSourceFile(file.path, block.text, ts.ScriptTarget.Latest, true,
      block.typed ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    errors.push(...ast.parseDiagnostics.map((diagnostic) => {
      const line = ast.getLineAndCharacterOfPosition(diagnostic.start || 0).line + 1 + block.offset;
      return `${file.path}:${line}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    }));
    return { ast, offset: block.offset };
  });
  return { scripts, errors };
}

/** Résout uniquement les imports locaux existants ; les packages restent des frontières externes. */
function resolveLocalImport(file, requested, root = process.cwd()) {
  const cleanRequest = requested.split(/[?#]/, 1)[0];
  const websiteAbsolute = file.startsWith("website/") && cleanRequest.startsWith("/");
  if (!cleanRequest.startsWith(".") && !websiteAbsolute) return null;
  const absolute = websiteAbsolute
    ? path.resolve(root, "website", "." + cleanRequest)
    : path.resolve(root, path.dirname(file), cleanRequest);
  const candidates = [absolute, ...[".js", ".mjs", ".ts", ".vue", ".css"].map((ext) => absolute + ext),
    ...["index.js", "index.mjs", "index.ts"].map((name) => path.join(absolute, name))];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return resolved ? path.relative(root, resolved).replaceAll("\\", "/") : null;
}

/** Extrait les imports littéraux et les fonctions substantielles pour rechercher les vrais doublons. */
function analyzeScript(file, root = process.cwd()) {
  const { scripts, errors } = parseScripts(file);
  const imports = new Set();
  const functions = [];
  for (const { ast, offset } of scripts) {
    function visit(node) {
      let requested;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier &&
          ts.isStringLiteral(node.moduleSpecifier)) requested = node.moduleSpecifier.text;
      if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0]) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(ast) === "require")) {
        requested = node.arguments[0].text;
      }
      if (requested) {
        const resolved = resolveLocalImport(file.path, requested, root);
        if (resolved) imports.add(resolved);
      }
      if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
          ts.isMethodDeclaration(node)) && node.body) {
        const body = node.body.getText(ast);
        const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, body);
        const tokens = [];
        while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) tokens.push(scanner.getTokenText());
        if (tokens.length >= 80) {
          functions.push({ path: file.path, name: node.name?.getText(ast) || "fonction anonyme",
            line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 + offset,
            tokens: tokens.length, hash: crypto.createHash("sha256").update(tokens.join("\0")).digest("hex") });
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  return { imports: [...imports], functions, errors };
}

/** Détecte les cycles réels d'import, en ignorant les dépendances qui ne font pas partie du graphe. */
function importCycles(graph) {
  const active = new Set();
  const visited = new Set();
  const stack = [];
  const found = new Map();
  function visit(file) {
    if (active.has(file)) {
      const cycle = stack.slice(stack.indexOf(file));
      const key = [...cycle].sort().join("|");
      found.set(key, [...cycle, file]);
      return;
    }
    if (visited.has(file)) return;
    active.add(file);
    stack.push(file);
    for (const dependency of graph[file] || []) if (graph[dependency]) visit(dependency);
    stack.pop();
    active.delete(file);
    visited.add(file);
  }
  Object.keys(graph).forEach(visit);
  return [...found.values()];
}

function architectureReport(root = process.cwd()) {
  const { files, excluded } = inventorySources(root);
  const graph = {};
  const grouped = new Map();
  const errors = [];
  for (const file of files.filter((entry) => !entry.generated)) {
    const analysis = analyzeScript(file, root);
    graph[file.path] = analysis.imports;
    errors.push(...analysis.errors);
    for (const fn of analysis.functions) {
      if (!grouped.has(fn.hash)) grouped.set(fn.hash, []);
      grouped.get(fn.hash).push(fn);
    }
  }
  return {
    files: files.map(({ source: _source, ...entry }) => entry), excluded,
    errors, cycles: importCycles(graph),
    duplicates: [...grouped.values()].filter((entries) => entries.length > 1)
      .sort((a, b) => b[0].tokens - a[0].tokens)
  };
}

module.exports = { inventorySources, parseScripts, resolveLocalImport, analyzeScript, importCycles, architectureReport };
