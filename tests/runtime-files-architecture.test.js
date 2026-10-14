"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const emulators = require("../src/main/runtime-files");
const archives = require("../src/main/game-runtime/paths");
const { mapping } = require("../src/main/game-catalog/mapping");

test("les recherches partagées gardent prédicat, insensibilité à la casse et politique des racines", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "shenpulse-file-contract-"));
  try {
    await fs.mkdir(path.join(root, "child"));
    await fs.writeFile(path.join(root, "ROM.GB"), "root");
    await fs.writeFile(path.join(root, "child", "rom.gb"), "child");
    await emulators.assertFile(path.join(root, "ROM.GB"), "absent");
    await assert.rejects(emulators.assertFile(root, "pas un fichier"), /pas un fichier/);
    assert.equal(await emulators.findNamedFile(root, "rom.gb"), path.join(root, "ROM.GB"));
    assert.equal(await emulators.findNamedFile(root, "rom.gb", (file) => file.includes("child")), path.join(root, "child", "rom.gb"));
    assert.equal(await emulators.findNamedFile(path.join(root, "absent"), "rom.gb"), "");
    await assert.rejects(archives.findNamedFile(path.join(root, "absent"), "rom.gb"), /ENOENT/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("les associations de mods gardent normalisation et copie indépendante des paramètres", () => {
  const parameters = { value: "kept" };
  const result = mapping("id", "effect", "titre", { threshold: -4, cooldownSeconds: -1, duration: -3, parameters });
  assert.deepEqual(result, { id: "id", effectId: "effect", title: "titre", triggerType: "gift", giftName: "", threshold: 1, cooldownSeconds: 0, duration: 0, enabled: true, triggerEnabled: true, parameters });
  assert.notEqual(result.parameters, parameters);
  assert.equal(mapping("a", "b", "c", { enabled: false }).enabled, false);
});
