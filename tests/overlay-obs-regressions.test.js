"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const overlayScript = fs.readFileSync(
  path.join(__dirname, "..", "resources", "overlays", "overlay.js"),
  "utf8"
);

test("le runtime OBS ignore TTS/audio et ne transforme plus un cadeau en WIN", () => {
  const interactiveWidgets = overlayScript.slice(
    overlayScript.indexOf("function updateInteractiveWidgets"),
    overlayScript.indexOf("function safeLeaderboardAvatarUrl")
  );
  const channels = overlayScript.slice(
    overlayScript.indexOf("const overlayChannels"),
    overlayScript.indexOf('window.addEventListener("resize"')
  );

  assert.doesNotMatch(interactiveWidgets, /winCounter\s*\+=/);
  assert.doesNotMatch(channels, /tts:\s*speak|audio:\s*playAudio/);
  assert.match(channels, /\["audio", "tts"\]\.includes\(normalizedChannel\)/);
});

test("l'hydratation OBS ne relance l'animation WINS que sur une vraie variation", () => {
  assert.match(
    overlayScript,
    /function renderWinCounter\(\{ animate = false \} = \{\}\)/
  );
  assert.match(
    overlayScript,
    /renderWinCounter\(\{ animate: winCounter !== previousCounter \}\)/
  );

  const relayStart = overlayScript.indexOf(
    "} else if (batch?.id && batch.id !== lastRelayBatchId)"
  );
  const relayEnd = overlayScript.indexOf("return;", relayStart);
  const relayUpdate = overlayScript.slice(relayStart, relayEnd);
  assert.ok(
    relayUpdate.indexOf("applyRelayState(relayDocument.state)") <
      relayUpdate.indexOf("for (const message"),
    "l'état connu doit être hydraté avant le nouvel événement"
  );
});
