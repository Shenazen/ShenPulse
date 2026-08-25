"use strict";

const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./helpers/source-bundles");

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const overlayCatalog = require("../resources/overlays/overlay-catalog");

const overlayScript = readOverlayRuntimeSource();

test("le runtime OBS réserve TTS/audio à l'écran numéroté et ne transforme plus un cadeau en WIN", () => {
  const interactiveWidgets = overlayScript.slice(
    overlayScript.indexOf("function updateInteractiveWidgets"),
    overlayScript.indexOf("function safeLeaderboardAvatarUrl")
  );
  const channels = overlayScript.slice(
    overlayScript.indexOf("const overlayChannels"),
    overlayScript.indexOf('window.addEventListener("resize"')
  );

  assert.doesNotMatch(interactiveWidgets, /winCounter\s*\+=/);
  assert.match(channels, /audio:\s*\(payload\) => queueLivePlayback\("audio", payload\)/);
  assert.match(channels, /tts:\s*\(payload\) => queueLivePlayback\("tts", payload\)/);
  assert.equal(
    overlayCatalog.acceptsChannel({
      view: "alerts",
      channel: "audio",
      payload: { screen: 2 },
      screen: 2,
      hasMediaScreen: true
    }),
    true
  );
  assert.equal(
    overlayCatalog.acceptsChannel({
      view: "alerts",
      channel: "audio",
      payload: { screen: 2 },
      screen: 1,
      hasMediaScreen: true
    }),
    false
  );
  assert.match(overlayScript, /const handledPlaybackIds = new Set\(\)/);
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
