"use strict";

/**
 * Lit les sources modulaires dans le même ordre que les pages HTML.
 *
 * Les tests historiques inspectaient app.js et overlay.js comme deux gros
 * fichiers texte. Cette aide rend ces tests indépendants du nombre de modules
 * sans masquer leur ordre d'exécution réel.
 */

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "..");
const rendererDirectory = path.join(projectRoot, "src", "renderer");
const overlayDirectory = path.join(projectRoot, "resources", "overlays");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function scriptSources(htmlFile, predicate) {
  const html = read(htmlFile);
  const directory = path.dirname(htmlFile);
  return [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)]
    .map((match) => match[1])
    .filter(predicate)
    .map((relativePath) => read(path.resolve(directory, relativePath)))
    .join("\n\n");
}

function importedStyles(entryFile, visited = new Set()) {
  const absolute = path.resolve(entryFile);
  if (visited.has(absolute)) return "";
  visited.add(absolute);
  const source = read(absolute);
  const directory = path.dirname(absolute);
  const imports = [...source.matchAll(/@import\s+url\(["']([^"']+)["']\)\s*;/g)]
    .map((match) => importedStyles(path.resolve(directory, match[1]), visited));
  const ownRules = source.replace(/@import\s+url\(["'][^"']+["']\)\s*;/g, "");
  return [...imports, ownRules].filter(Boolean).join("\n\n");
}

function rendererSource() {
  return scriptSources(
    path.join(rendererDirectory, "index.html"),
    (source) =>
      source.startsWith("../../resources/overlays/catalog/") ||
      source === "../../resources/overlays/overlay-catalog.js" ||
      source.startsWith("app/")
  );
}

function rendererStyles() {
  return importedStyles(path.join(rendererDirectory, "styles.css"));
}

function overlayRuntimeSource() {
  return scriptSources(
    path.join(overlayDirectory, "index.html"),
    (source) =>
      source.startsWith("catalog/") ||
      source === "overlay-catalog.js" ||
      source.startsWith("runtime/")
  );
}

function overlayStyles() {
  return importedStyles(path.join(overlayDirectory, "overlay.css"));
}

module.exports = {
  readOverlayRuntimeSource: overlayRuntimeSource,
  readOverlayStyles: overlayStyles,
  readRendererSource: rendererSource,
  readRendererStyles: rendererStyles
};
