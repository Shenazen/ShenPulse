"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(
  path.join(root, "src", "renderer", "app.js"),
  "utf8"
);
const rendererHtml = fs.readFileSync(
  path.join(root, "src", "renderer", "index.html"),
  "utf8"
);
const mainProcess = fs.readFileSync(
  path.join(root, "src", "main", "main.js"),
  "utf8"
);
const overlayRuntime = fs.readFileSync(
  path.join(root, "resources", "overlays", "overlay.js"),
  "utf8"
);
const actionRunner = fs.readFileSync(
  path.join(root, "src", "main", "action-runner.js"),
  "utf8"
);
const ipc = fs.readFileSync(
  path.join(root, "src", "main", "ipc.js"),
  "utf8"
);

test("le catalogue et les jeux réutilisent la même carte d’overlay", () => {
  assert.match(renderer, /function renderOverlayCard/);
  assert.match(renderer, /items\.map\(\(item\) => renderOverlayCard\(item\)\)/);
  assert.match(
    renderer,
    /renderOverlayCard\(item,\s*\{\s*allowed: unlocked && overlayUnlocked\(item\)/
  );
  assert.doesNotMatch(
    renderer.match(/function gameOverlayItemsFor[\s\S]*?function renderGameInteractions/)?.[0] || "",
    /\["game"/
  );
});

test("les cartes et fenêtres exposent la taille OBS et la vraie source live", () => {
  assert.match(renderer, /Source OBS recommandée/);
  assert.match(renderer, /function overlayLivePreview/);
  assert.match(renderer, /data-overlay-live-preview/);
  assert.match(renderer, /function scheduleOverlayLivePreview/);
  assert.match(rendererHtml, /frame-src http:\/\/127\.0\.0\.1:\*/);
  assert.match(mainProcess, /frame-src http:\/\/127\.0\.0\.1:\*/);
});

test("les tests s'animent directement dans les cartes et la roue garde ses réglages", () => {
  assert.match(
    renderer,
    /async function previewOverlay\(key\) \{\s*if \(!isAccountAuthenticated\(\)\) return previewGuestOverlay\(key\);\s*return dispatchOverlayTest\(key\);\s*\}/
  );
  assert.match(renderer, /function postOverlayCardEvent\(key, channel, payload\)/);
  assert.doesNotMatch(renderer, /title: `Tester \$\{item\.name\}`/);
  assert.match(overlayRuntime, /event\.data\?\.source !== "shenpulse-overlay-card"/);
  assert.match(overlayRuntime, /handler\(event\.data\.payload \|\| \{\}\)/);
  assert.match(renderer, /font: "Kalam"/);
  assert.match(renderer, /fontSize: 50/);
  assert.match(renderer, /textOrientation: "horizontal"/);
  assert.match(renderer, /textBoxHeight: 240/);
  assert.match(overlayRuntime, /font: parameters\.get\("font"\) \|\| "Kalam"/);
  assert.match(overlayRuntime, /function wheelSegmentLabelStyle/);
});

test("les actions rapides pilotent aussi les sources OBS déjà ouvertes", () => {
  assert.match(actionRunner, /case "overlay\.like-goal"/);
  assert.match(actionRunner, /case "overlay\.coin-jar"/);
  assert.match(actionRunner, /"set", "reset", "multiplier"/);
  assert.match(ipc, /"overlay\.like-goal"/);
  assert.match(ipc, /"overlay\.coin-jar"/);
  assert.match(overlayRuntime, /"like-goal": updateLikeGoal/);
  assert.match(overlayRuntime, /"coin-jar": updateCoinJar/);
});
