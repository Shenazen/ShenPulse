"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCrowdControlPortReleaseScript,
  parseCrowdControlPortReleaseResult,
  releaseCrowdControlPort
} = require("../src/main/crowd-control-port");

test("reconnaît le client Crowd Control et libère uniquement son port", async () => {
  let receivedScript = "";
  const result = await releaseCrowdControlPort(58431, {
    platform: "win32",
    runPowerShell: async (script) => {
      receivedScript = script;
      return "CLOSED|39016\r\n";
    }
  });

  assert.deepEqual(result, {
    released: true,
    reason: "crowd-control-closed",
    processId: 39016
  });
  assert.match(receivedScript, /\$port = 58431/);
  assert.match(receivedScript, /CrowdControl\.Client\.Slim\.exe/);
  assert.match(receivedScript, /Programs\\crowdcontrol/);
});

test("ne ferme jamais un programme inconnu qui utilise le port", async () => {
  await assert.rejects(
    releaseCrowdControlPort(58431, {
      platform: "win32",
      runPowerShell: async () => "BUSY|42|another-app.exe"
    }),
    /another-app\.exe/
  );
});

test("ignore le nettoyage hors Windows, sur un port dynamique ou déjà libre", async () => {
  assert.deepEqual(
    await releaseCrowdControlPort(58431, { platform: "linux" }),
    { released: false, reason: "not-applicable" }
  );
  assert.deepEqual(
    await releaseCrowdControlPort(0, { platform: "win32" }),
    { released: false, reason: "not-applicable" }
  );
  assert.deepEqual(
    await releaseCrowdControlPort(58431, {
      platform: "win32",
      runPowerShell: async () => "FREE"
    }),
    { released: false, reason: "free" }
  );
});

test("parse les réponses PowerShell sans accepter un résultat ambigu", () => {
  assert.deepEqual(parseCrowdControlPortReleaseResult("FREE\r\n"), {
    status: "free"
  });
  assert.deepEqual(parseCrowdControlPortReleaseResult("BLOCKED"), {
    status: "blocked"
  });
  assert.deepEqual(parseCrowdControlPortReleaseResult("inconnu"), {
    status: "unknown"
  });
  assert.match(
    buildCrowdControlPortReleaseScript(58431),
    /Get-NetTCPConnection/
  );
});
