"use strict";

const fs = require("node:fs");
const path = require("node:path");

/**
 * Lit une façade et ses vrais modules métier pour les tests de contrat source.
 * Ne charge aucun service : les tests VM conservent leur injection séparée.
 * Les anciens imports publics restent vérifiés dans les tests d'exécution.
 */
function readMainSource(fileName) {
  const mainDirectory = path.resolve(__dirname, "..", "..", "src", "main");
  const domains = {
    "ipc.js": "ipc",
    "core.js": "core",
    "action-runner.js": "actions",
    "source-hub.js": "sources",
    "main.js": "bootstrap",
    "game-runtime.js": "game-runtime",
    "account-service.js": "account",
    "game-hub.js": "game-hub"
  };
  const domain = domains[fileName];
  const domainRoot = domain && path.join(mainDirectory, domain) + path.sep;
  const visited = new Set();
  function readModule(file) {
    if (visited.has(file)) return "";
    visited.add(file);
    const source = fs.readFileSync(file, "utf8");
    const dependencies = [...source.matchAll(/require\(["'](\.[^"']+)["']\)/g)]
      .map((match) => path.resolve(path.dirname(file), match[1] + ".js"))
      .filter((dependency) => domainRoot && dependency.startsWith(domainRoot))
      .map(readModule);
    return [source, ...dependencies].join("\n\n");
  }
  return readModule(path.join(mainDirectory, fileName));
}

module.exports = { readMainSource };
