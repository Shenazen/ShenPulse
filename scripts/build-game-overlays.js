"use strict";

/** Génère le bundle navigateur stable depuis les modules maintenables d'export. */
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("esbuild");
const { buildOverlayRuntime } = require("./build-overlay-runtime");

async function buildGameOverlays({ write = true } = {}) {
  buildOverlayRuntime({ write });
  const result = await build({
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
  const publicResult=await build({absWorkingDir:path.resolve(__dirname,".."),entryPoints:["src/renderer/game-overlays/index.mjs"],outfile:"resources/overlays/vendor/game-pack-generator.js",bundle:true,format:"iife",globalName:"ShenPulseGameOverlay",platform:"browser",target:"chrome120",charset:"utf8",legalComments:"none",write,logLevel:"silent"});
  if(write){const root=path.resolve(__dirname,"..");for(const [from,to]of [["src/renderer/assets/brand/shenpulse-banner-transparent.png","resources/overlays/brand/game-pack-legacy-logo.png"],["src/renderer/assets/game-overlays/minecraft-bedrock/PressStart2P-Regular.ttf","resources/overlays/fonts/game-pack-pixel.ttf"]])fs.copyFileSync(path.join(root,from),path.join(root,to));}
  return {...result,publicOutputFiles:publicResult.outputFiles};
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
