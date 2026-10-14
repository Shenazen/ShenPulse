"use strict";

/** Lit les vrais imports TS et styles des jeux, indépendamment du découpage. */
const fs = require("node:fs");
const path = require("node:path");
const { parse, compileStyle } = require("@vue/compiler-sfc");
const postcss = require("postcss");
const { createHash } = require("node:crypto");
const ts = require("typescript");

function sourceDependencies(file, source) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  return ast.statements
    .filter((node) => (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier))
    .map((node) => node.moduleSpecifier.text).filter((relative) => relative.startsWith("."))
    .map((relative) => {
      const target = path.resolve(path.dirname(file), relative);
      return [target, `${target}.ts`, `${target}.mjs`, path.join(target, "index.ts")]
        .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    }).filter((target) => target && /\.(?:ts|mjs)$/.test(target));
}

function readTypeScriptSourceGraph(file, visited = new Set()) {
  const absolute = path.resolve(file);
  if (visited.has(absolute)) return "";
  visited.add(absolute);
  const source = fs.readFileSync(absolute, "utf8");
  const dependencies = sourceDependencies(absolute, source);
  return [...dependencies.map((dependency) => readTypeScriptSourceGraph(dependency, visited)), source].join("\n\n");
}

function readVueStyles(file) {
  const source = fs.readFileSync(file, "utf8");
  const { descriptor } = parse(source, { filename: file });
  return descriptor.styles.map((style) => ({
    file: style.src ? path.resolve(path.dirname(file), style.src) : file,
    source: style.src ? fs.readFileSync(path.resolve(path.dirname(file), style.src), "utf8") : style.content,
    scoped: style.scoped
  }));
}

function readVueGameSource(file) {
  const source = fs.readFileSync(file, "utf8");
  const { descriptor } = parse(source, { filename: file });
  const script = descriptor.scriptSetup?.content || descriptor.script?.content || "";
  const graph = readTypeScriptSourceGraphFromText(file, script);
  return [source, graph, ...readVueStyles(file).map((style) => style.source)].join("\n\n");
}

function readTypeScriptSourceGraphFromText(file, source) {
  const visited = new Set();
  return sourceDependencies(file, source).map((dependency) => readTypeScriptSourceGraph(dependency, visited)).join("\n\n");
}

function compiledScopedStyleTree(file) {
  const project = path.resolve(__dirname, "..", "..");
  const styles = readVueStyles(file);
  return styles.flatMap((style) => {
    const result = compileStyle({ filename: style.file, source: style.source, id: "data-v-equivalence", scoped: style.scoped });
    if (result.errors.length) throw result.errors[0];
    const normalizeValue = (value) => String(value || "").replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (all, _quote, relative) => {
      if (/^(?:https?:|data:|#|\/)/.test(relative)) return all;
      return `url(${path.relative(project, path.resolve(path.dirname(style.file), relative)).replace(/\\/g, "/")})`;
    });
    const canonicalNode = (node) => ({
      type: node.type,
      ...(node.selector ? { selector: node.selector } : {}),
      ...(node.prop ? { prop: node.prop, value: normalizeValue(node.value), important: !!node.important } : {}),
      ...(node.name ? { name: node.name, params: normalizeValue(node.params) } : {}),
      ...(node.nodes ? { nodes: node.nodes.filter((child) => child.type !== "comment").map(canonicalNode) } : {})
    });
    return postcss.parse(result.code).nodes.filter((node) => node.type !== "comment").map(canonicalNode);
  });
}

function scopedStyleSignature(file) {
  return createHash("sha256").update(JSON.stringify(compiledScopedStyleTree(file))).digest("hex");
}

module.exports = { readTypeScriptSourceGraph, readVueGameSource, readVueStyles, compiledScopedStyleTree, scopedStyleSignature };
