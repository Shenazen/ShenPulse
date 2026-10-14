"use strict";

/** Snapshots communs aux contrats catalogue, chargés une seule fois avec les mêmes chemins sources. */
const { readLegacyGameHostSource } = require("./legacy-game-host-source");
const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./source-bundles");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const renderer = readRendererSource();
const rendererHtml = fs.readFileSync(
  path.join(root, "src", "renderer", "index.html"),
  "utf8"
);
const rendererCss = readRendererStyles();
const gameOverlayGenerator = fs.readFileSync(
  path.join(root, "src", "renderer", "game-overlay-generator.js"),
  "utf8"
);
const overlayCss = readOverlayStyles();
const overlayRuntime = readOverlayRuntimeSource();
const coinJarPhysics = fs.readFileSync(
  path.join(root, "resources", "overlays", "coin-jar-physics.js"),
  "utf8"
);
const overlayHtml = fs.readFileSync(
  path.join(root, "resources", "overlays", "index.html"),
  "utf8"
);
const sourceHub = ["source-hub.js", "sources/tiktok-protocol.js"]
  .map((file) => fs.readFileSync(path.join(root, "src", "main", file), "utf8"))
  .join("\n\n");
const overlayDefaults = fs.readFileSync(
  path.join(root, "src", "main", "state", "defaults", "overlays.js"),
  "utf8"
);
const stateStore = fs.readFileSync(
  path.join(root, "src", "main", "state", "overlay-configs.js"),
  "utf8"
);
const gameHost = readLegacyGameHostSource();

module.exports = { root, renderer, rendererHtml, rendererCss, gameOverlayGenerator, overlayCss, overlayRuntime, coinJarPhysics, overlayHtml, sourceHub, overlayDefaults, stateStore, gameHost };

