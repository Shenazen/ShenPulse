"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { IrlPythonBridge } = require("../src/main/irl-python-bridge");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { createProFeatureGuard } = require("../src/main/pro-feature-access");

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

test("le démarrage Python différé revalide Premium, compte et profil avant control/provision, sans requête Shelly", async () => {
  for (const operation of ["control", "provision"]) {
    for (const mutate of [
      (state) => { state.commerce.subscription = { tier: "free", status: "free" }; },
      (state) => { state.commerce.subscription = { tier: "pro", status: "active" }; },
      (state) => { state.settings.account.uid = "autre-compte"; },
      (state) => { state.session.profileId = "autre-profil"; }
    ]) {
      const state = { commerce: { subscription: { tier: "premium", status: "active" } }, session: { profileId: "profil" },
        settings: { account: { uid: "fixture", email: "fixture@example.test", refreshTokenSecretId: "account" }, siteVisibility: {} } };
      const store = { getState: () => state, getAccountSession: () => state.settings.account, getSecret: () => "fixture-only-token" };
      const child = new EventEmitter(); const writes = [];
      child.stdout = new PassThrough(); child.stderr = new PassThrough();
      child.stdin = { writable: true, write: (line, _encoding, done) => {
        const message = JSON.parse(line); writes.push(message); done();
        queueMicrotask(() => child.stdout.write(`${JSON.stringify({ id: message.id, ok: true, result: {} })}\n`));
      } };
      child.kill = () => { child.emit("exit", 0); child.stdout.end(); child.stderr.end(); };
      const bridge = new IrlPythonBridge({ scriptPath, spawnImpl: () => child,
        commandCandidates: [{ command: "FAUX-PYTHON-NON-EXECUTE", args: [] }] });
      const options = { assertAccess: createProFeatureGuard(store, "irl") };
      const pending = operation === "control" ? bridge.control({ host: "192.168.1.42" }, "on", 1000, options) :
        bridge.provision({ host: "192.168.1.42", generation: 2, ssid: "fixture", password: "fixture" }, options);
      mutate(state); child.stdout.write(`${JSON.stringify({ type: "ready", protocol: 1 })}\n`);
      await assert.rejects(pending, (error) => ["PREMIUM_FEATURE_REQUIRED", "FEATURE_CONTEXT_CHANGED"].includes(error.code));
      assert.deepEqual(writes, [], "aucune demande Shelly ne part après le démarrage différé");
      assert.equal(bridge.pending.size, 0);
      await bridge.stop();
    }
  }
});
