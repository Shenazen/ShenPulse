"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const originalManifest = require("../src/main/game-installers/find-the-needle-demo");

async function fixture(t, { packId = "find-the-needle-demo", executable = true, manifest = originalManifest } = {}) {
  const target = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shenpulse-needle-launch-test-"));
  t.after(() => fs.promises.rm(target, { recursive: true, force: true }));
  if (executable) await fs.promises.writeFile(path.join(target, "FindTheNeedle.exe"), "fixture, jamais exécutée");
  const calls = [];
  let allowed = true;
  const filename = path.join(__dirname, "../src/main/game-runtime.js");
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    module,
    require(id) {
      if (id === "electron") return { shell: {
        async openExternal(uri) { calls.push(["steam", uri]); },
        async openPath(value) { calls.push(["path", value]); return ""; }
      } };
      if (id === "./game-installer-manifest") return { installerForGame: (id) => id === packId ? manifest : null, isIntegratedGame: () => false };
      if (id === "./pro-feature-access") return { createProFeatureGuard: (_store, _section, options) => () => options.assertAdditional() };
      if (id === "./pokemon-red-blue-runtime") return { PokemonRedBlueRuntime: class {} };
      if (id === "./super-mario-kart-runtime") return { SuperMarioKartRuntime: class {} };
      return localRequire(id);
    }
  }, { filename });
  const state = { game: { installations: { [packId]: { path: target } } } };
  const runtime = new module.exports.GameRuntimeService({ app: {}, store: { getState: () => state },
    getWindow: () => null, notifyRenderer: () => {}, assertAccess(id) {
      assert.equal(id, packId);
      if (!allowed) throw new Error("Accès révoqué");
    } });
  return { runtime, calls, target, packId, revoke() { allowed = false; } };
}

test("Find The Needle Demo est ouvert par son URI Steam fixe, jamais directement par son EXE", async (t) => {
  const f = await fixture(t);
  const result = await f.runtime.launch(f.packId);
  assert.deepEqual(f.calls, [["steam", "steam://rungameid/5165210"]]);
  assert.equal(result.launcher, "steam");
  assert.equal(result.steamAppId, "5165210");
  assert.equal(result.path, path.join(f.target, "FindTheNeedle.exe"));
});

test("la démo refuse un identifiant ou URI Steam arbitraire et l’EXE absent", async (t) => {
  for (const steamLaunchAppId of ["5160800", "5165210?anything", "https://untrusted.invalid", ""]) {
    const f = await fixture(t, { manifest: { ...originalManifest, steamLaunchAppId } });
    await assert.rejects(f.runtime.launch(f.packId), /n’est pas autorisé/);
    assert.deepEqual(f.calls, []);
  }
  const missing = await fixture(t, { executable: false });
  await assert.rejects(missing.runtime.launch(missing.packId), /FindTheNeedle.exe n’est plus présent/);
  assert.deepEqual(missing.calls, []);
});

test("le lancement Steam reste soumis aux accès et les autres jeux gardent le lancement historique", async (t) => {
  const revoked = await fixture(t);
  revoked.revoke();
  await assert.rejects(revoked.runtime.launch(revoked.packId), /Accès révoqué/);
  assert.deepEqual(revoked.calls, []);
  const ordinary = await fixture(t, { packId: "ordinary-game" });
  await ordinary.runtime.launch(ordinary.packId);
  assert.deepEqual(ordinary.calls, [["path", path.join(ordinary.target, "FindTheNeedle.exe")]]);
});
