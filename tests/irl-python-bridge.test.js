"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { IrlPythonBridge } = require("../src/main/irl-python-bridge");

const root = path.join(__dirname, "..");
const scriptPath = path.join(
  root,
  "resources",
  "irl-python",
  "shenpulse_irl_server.py"
);

function findPython() {
  const candidates = process.platform === "win32"
    ? [
        { command: "py.exe", args: ["-3"] },
        { command: "python.exe", args: [] }
      ]
    : [
        { command: "python3", args: [] },
        { command: "python", args: [] }
      ];
  return candidates.find((candidate) => {
    const result = spawnSync(candidate.command, [...candidate.args, "--version"], {
      encoding: "utf8",
      windowsHide: true
    });
    return result.status === 0;
  });
}

test("le serveur Python embarqué ne contient plus de règles de cadeaux figées", () => {
  const source = fs.readFileSync(scriptPath, "utf8");
  assert.doesNotMatch(source, /\bGIFT_RULES\b/);
  assert.doesNotMatch(source, /\bDIAMOND_RULES\b/);
  assert.doesNotMatch(source, /TikFinity|TikTokLive|shenpulse_ws/i);
  assert.match(source, /"giftRules": 0/);
  assert.match(source, /"shelly\.control"/);
  assert.match(source, /"pulse"/);
  assert.equal(fs.existsSync(path.join(path.dirname(scriptPath), "gifts.py")), false);
  assert.equal(fs.existsSync(path.join(path.dirname(scriptPath), "config.py")), false);
});

const python = findPython();
test(
  "ShenPulse dialogue avec le sidecar Python par JSON sans cadeaux internes",
  { skip: !python },
  async () => {
    const bridge = new IrlPythonBridge({
      scriptPath,
      commandCandidates: [python]
    });
    try {
      const health = await bridge.health();
      assert.equal(health.protocol, 1);
      assert.equal(health.giftRules, 0);
      assert.ok(health.capabilities.includes("shelly.control"));
      assert.equal(bridge.status().state, "running");
    } finally {
      await bridge.stop();
    }
  }
);

test("le serveur Python est décompressé pour pouvoir être exécuté depuis l'application", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  assert.ok(manifest.build.asarUnpack.includes("resources/irl-python/**"));
});
