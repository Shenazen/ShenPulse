"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { createHash } = require("node:crypto");
const { nativeFunctions, readNativeDirectory } = require("./helpers/native-source-bundles");
const historical = require("./fixtures/native-function-contracts.json");
const root = path.join(__dirname, "..");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cppDirectory = path.join(root, "native/gtav-montchiliad-enhanced/src");
const cultDirectory = path.join(root, "native/cult-of-the-lamb-reliability");

function functionContracts(source, language) {
  return nativeFunctions(source, language).map((entry) => ({
    name: entry.name,
    signature: language === "cpp" ? entry.signature.replace(/\s*=\s*[^,)]+/g, "") : entry.signature,
    sha256: hash(entry.body)
  })).sort((left, right) => left.name.localeCompare(right.name));
}

test("les 78 fonctions natives GTA conservent exactement leur signature et leur corps avant extraction", () => {
  const source = readNativeDirectory(cppDirectory, [".cpp"]);
  assert.deepEqual(functionContracts(source, "cpp"), [...historical.cpp].sort((a, b) => a.name.localeCompare(b.name)));
  const state = fs.readFileSync(path.join(cppDirectory, "state.cpp"), "utf8").split("namespace ShenPulse { namespace MontChiliad {\n")[1].split("\n} }")[0].trim();
  assert.equal(hash(state), historical.cppState);
});

test("les 36 méthodes du plugin Cult conservent exactement leurs corps et signatures privés", () => {
  const source = readNativeDirectory(cultDirectory, [".cs"]);
  assert.deepEqual(functionContracts(source, "cs"), [...historical.cs].sort((a, b) => a.name.localeCompare(b.name)));
  assert.equal((source.match(/BepInPlugin\(/g) || []).length, 1);
  assert.equal((source.match(/BepInDependency\(/g) || []).length, 1);
  assert.equal((source.match(/: BaseUnityPlugin/g) || []).length, 1);
  assert.equal((source.match(/private static ShenPulseCultReliability instance;/g) || []).length, 1);
  assert.equal((source.match(/private bool timeScaleActive;/g) || []).length, 1);
  assert.equal((source.match(/private bool freezeActive;/g) || []).length, 1);
  assert.equal((source.match(/private float barrierDurationSeconds;/g) || []).length, 1);
});

test("les compilations découvrent les vraies unités de domaine et gardent une sortie de vérification distincte", () => {
  const gta = fs.readFileSync(path.join(root, "scripts/build-gtav-enhanced-plugin.ps1"), "utf8");
  const cult = fs.readFileSync(path.join(cultDirectory, "build.ps1"), "utf8");
  assert.match(gta, /\$BuildDirectory/);
  assert.match(gta, /Get-ChildItem[\s\S]*-Filter "\*\.cpp"/);
  assert.match(gta, /\) \+ \$sourcePaths \+ @\(/);
  assert.match(cult, /Join-Path \$PSScriptRoot "Domains"/);
  assert.match(cult, /@sourcePaths/);
  for (const file of fs.readdirSync(cppDirectory).filter((entry) => /\.(?:cpp|h)$/.test(entry))) {
    assert.ok(fs.readFileSync(path.join(cppDirectory, file), "utf8").split("\n").length < 800, file);
  }
  for (const file of fs.readdirSync(path.join(cultDirectory, "Domains"))) {
    assert.ok(fs.readFileSync(path.join(cultDirectory, "Domains", file), "utf8").split("\n").length < 800, file);
  }
});

test("les limites, l’attente locale et les codes de reprise du protocole GTA restent inchangés", () => {
  const source = readNativeDirectory(cppDirectory, [".cpp", ".h"]);
  assert.match(source, /kPort = 58430/);
  assert.match(source, /kMaxQueuedRequests = 250/);
  assert.match(source, /kMaxGiftObjects = 512/);
  assert.match(source, /kEffectRetryStatus = 9/);
  assert.match(source, /buffer\.size\(\) < 65536/);
  assert.match(source, /frame\.push_back\('\\0'\)/);
  assert.match(source, /inet_pton\(AF_INET, "127\.0\.0\.1"/);
  assert.match(source, /g_queue\.push_front\(request\)/);
});
