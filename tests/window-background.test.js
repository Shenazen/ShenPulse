"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("réduire ShenPulse conserve les services LIVE et les interactions actifs", () => {
  const ipc = fs.readFileSync(
    path.join(root, "src", "main", "ipc.js"),
    "utf8"
  );
  const minimizeStart = ipc.indexOf('handle("window:minimize"');
  const minimizeEnd = ipc.indexOf(
    'handle("window:maximize"',
    minimizeStart
  );
  const minimizeHandler = ipc.slice(minimizeStart, minimizeEnd);

  assert.notEqual(minimizeStart, -1);
  assert.match(minimizeHandler, /\.minimize\(\)/);
  assert.doesNotMatch(
    minimizeHandler,
    /stopSession|stopGameSession|stopAll|shutdown|suspendAccountWorkspace/
  );
});

test("les fenêtres ShenPulse ne sont pas ralenties en arrière-plan", () => {
  const main = fs.readFileSync(
    path.join(root, "src", "main", "main.js"),
    "utf8"
  );
  const gameRuntime = fs.readFileSync(
    path.join(root, "src", "main", "game-runtime.js"),
    "utf8"
  );

  assert.match(main, /backgroundThrottling:\s*false/);
  assert.match(gameRuntime, /backgroundThrottling:\s*false/);
});
