"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const roots = ["src", "scripts", "tests", path.join("resources", "overlays")];
const files = [];
const generatedDirectories = new Set([
  path.resolve("src", "renderer", "games", "original"),
  path.resolve("resources", "overlays", "media"),
  path.resolve("resources", "overlays", "vendor")
]);

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  if (generatedDirectories.has(path.resolve(directory))) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith(".js")) files.push(fullPath);
  }
}

roots.forEach(walk);
let failed = false;
const errors = [];
for (const file of files) {
  try {
    new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
  } catch (error) {
    failed = true;
    errors.push(`${file}\n${error.stack}`);
  }
}

function htmlAssetPaths(htmlFile, expression) {
  const source = fs.readFileSync(htmlFile, "utf8");
  const directory = path.dirname(htmlFile);
  return [...source.matchAll(expression)].map((match) => ({
    relative: match[1],
    absolute: path.resolve(directory, match[1])
  }));
}

function validateHtmlAssets(htmlFile) {
  const scripts = htmlAssetPaths(
    htmlFile,
    /<script\s+src="([^"]+)"[^>]*><\/script>/g
  );
  const styles = htmlAssetPaths(
    htmlFile,
    /<link\s+rel="stylesheet"\s+href="([^"]+)"[^>]*>/g
  );
  for (const asset of [...scripts, ...styles]) {
    if (!fs.existsSync(asset.absolute)) {
      errors.push(`${htmlFile}: ressource introuvable ${asset.relative}`);
    }
  }
  const localScripts = scripts.filter(
    (asset) => fs.existsSync(asset.absolute) && asset.absolute.endsWith(".js")
  );
  try {
    const bundle = localScripts
      .map((asset) => fs.readFileSync(asset.absolute, "utf8"))
      .join("\n\n");
    new vm.Script(bundle, { filename: `${htmlFile} (bundle ordonné)` });
  } catch (error) {
    errors.push(`${htmlFile}: bundle invalide\n${error.stack}`);
  }
}

function validateCssImports(entryFile, visited = new Set()) {
  const absolute = path.resolve(entryFile);
  if (visited.has(absolute) || !fs.existsSync(absolute)) return;
  visited.add(absolute);
  const source = fs.readFileSync(absolute, "utf8");
  const directory = path.dirname(absolute);
  for (const match of source.matchAll(/@import\s+url\(["']([^"']+)["']\)\s*;/g)) {
    const imported = path.resolve(directory, match[1]);
    if (!fs.existsSync(imported)) {
      errors.push(`${path.relative(process.cwd(), absolute)}: import CSS introuvable ${match[1]}`);
      continue;
    }
    validateCssImports(imported, visited);
  }
}

function filesBelow(directory, extension, maximumLines) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) filesBelow(target, extension, maximumLines);
    else if (path.extname(entry.name) === extension) {
      const lines = fs.readFileSync(target, "utf8").split(/\r?\n/).length;
      if (lines > maximumLines) {
        errors.push(`${target}: ${lines} lignes, limite ${maximumLines}`);
      }
    }
  }
}

validateHtmlAssets(path.join("src", "renderer", "index.html"));
validateHtmlAssets(path.join("resources", "overlays", "index.html"));
validateCssImports(path.join("src", "renderer", "styles.css"));
validateCssImports(path.join("resources", "overlays", "overlay.css"));
filesBelow(path.join("src", "renderer", "app"), ".js", 800);
filesBelow(path.join("resources", "overlays", "catalog"), ".js", 250);
filesBelow(path.join("resources", "overlays", "runtime"), ".js", 800);
filesBelow(path.join("src", "renderer", "styles"), ".css", 1200);
filesBelow(path.join("resources", "overlays", "styles"), ".css", 1200);

if (errors.length) {
  failed = true;
  process.stderr.write(`${errors.join("\n\n")}\n`);
}
if (failed) process.exit(1);
process.stdout.write(
  `Structure et syntaxe valides : ${files.length} fichiers JavaScript, bundles et imports contrôlés.\n`
);
