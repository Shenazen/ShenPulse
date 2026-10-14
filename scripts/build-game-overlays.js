"use strict";

/** Génère le bundle navigateur stable depuis les modules maintenables d'export. */
const path = require("node:path");
const { build } = require("esbuild");
const { buildOverlayRuntime } = require("./build-overlay-runtime");

function buildGameOverlays({ write = true } = {}) {
  buildOverlayRuntime({ write });
  return build({
    absWorkingDir: path.resolve(__dirname, ".."),
    entryPoints: ["src/renderer/game-overlays/index.mjs"],
    outfile: "src/renderer/game-overlay-generator.js",
    bundle: true,
    format: "iife",
    globalName: "ShenPulseGameOverlay",
    platform: "browser",
    target: "chrome120",
    charset: "utf8",
    legalComments: "none",
    banner: { js: "/* FICHIER GÉNÉRÉ — modifier game-overlays/*.mjs puis npm run overlays:build. */" },
    write,
    logLevel: "silent"
  });
}

if (require.main === module) {
  buildGameOverlays().then(() => {
    process.stdout.write("Bundle d’export des overlays généré depuis les modules de domaine.\n");
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildGameOverlays };
