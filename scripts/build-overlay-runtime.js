"use strict";

/** Conserve les chemins des anciens loaders sans maintenir deux moteurs. */
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const runtime = path.resolve(__dirname, "..", "resources", "overlays", "runtime");

function selectedFunctions(relative, names) {
  const file = path.join(runtime, relative);
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.ESNext, true);
  if (source.parseDiagnostics.length) throw new Error(`Source de runtime invalide : ${relative}`);
  const declarations = source.statements.filter((node) => ts.isFunctionDeclaration(node) && node.name);
  if (names) {
    const existing = new Set(declarations.map((node) => node.name.text));
    const missing = names.filter((name) => !existing.has(name));
    if (missing.length) throw new Error(`Fonctions de compatibilité absentes dans ${relative} : ${missing.join(", ")}`);
  }
  return declarations.filter((node) => !names || names.includes(node.name.text))
    .map((node) => node.getText(source)).join("\n\n");
}

function buildOverlayRuntime({ write = true } = {}) {
  const groups = {
    "widgets.js": [
      ["widgets/coin-jar.js"], ["widgets/win-counter.js"],
      ["session.js", ["hydrateOverlaySession"]],
      ["widgets/match.js", ["restartMatchVideo"]], ["widgets/game.js"],
      ["widgets/timers.js"], ["widgets/wheel-animation.js"]
    ],
    "wheel-match.js": [
      ["widgets/coin-jar-design.js"],
      ["widgets/wheel-design.js"],
      ["session.js", ["seedStaticLeaderboardPreview", "setupLeaderboard"]]
    ]
  };
  const outputFiles = Object.entries(groups).map(([file, parts]) => ({
    path: path.join(runtime, file),
    text: '"use strict";\n\n/* FICHIER GÉNÉRÉ — compatibilité anciens loaders ; sources : widgets/ et session.js. */\n\n' +
      (file === "wheel-match.js" ? fs.readFileSync(path.join(runtime, "match-reactions-compatibility.js"), "utf8") + "\n" : "") +
      parts.map(([relative, names]) => selectedFunctions(relative, names)).join("\n\n") + "\n"
  }));
  if (write) for (const file of outputFiles) fs.writeFileSync(file.path, file.text);
  return { outputFiles };
}

if (require.main === module) {
  buildOverlayRuntime();
  process.stdout.write("Bundles de compatibilité des overlays générés.\n");
}

module.exports = { buildOverlayRuntime };
