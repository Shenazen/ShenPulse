"use strict";

const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), os = require("node:os"), path = require("node:path");
const { StateStore } = require("../src/main/store");
const { GiftCatalog } = require("../src/main/catalogs/gifts");

function fixture(context) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-heart-backup-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load();
  store.upsert("rules", { id: "custom-gift-rule", name: "Mon action", enabled: true,
    trigger: { type: "gift" }, cooldown: { globalMs: 3000, perUserMs: 7000 },
    conditions: [{ field: "data.giftName", operator: "equals", value: "Cœur sur moi", giftId: "157842",
      giftFamily: "community-heart", giftIds: ["7934", "heart-me"], giftCost: 1 }],
    actions: [{ id: "sound", type: "audio.play", enabled: true, config: { soundId: "fixture-sound" } }] });
  store.flush();
  const originalWrite = store.storage.atomicWrite.bind(store.storage);
  context.after(() => { store.storage.atomicWrite = originalWrite; store.flush(); fs.rmSync(directory, { recursive: true, force: true }); });
  const v1 = path.join(directory, "shenpulse-state.before-gift-references-v1.json");
  store.storage.atomicWrite(v1, JSON.stringify({ oldGeneration: "must-not-replace" }), false);
  return { store, originalWrite, directory, v1, v2: path.join(directory, "shenpulse-state.before-gift-identity-v2.json"),
    gifts: new GiftCatalog(path.join(__dirname, "../resources")).gifts };
}

test("heart identity correction makes a fresh v2 backup even when the old reference backup already exists", (context) => {
  const f = fixture(context), before = fs.readFileSync(f.store.filePath, "utf8"), oldBackup = fs.readFileSync(f.v1, "utf8");
  const result = f.store.reconcileGiftReferences(f.gifts);
  assert.ok(result.changed > 0); assert.equal(result.backupPath, f.v2);
  const backup = JSON.parse(fs.readFileSync(f.v2, "utf8"));
  assert.equal(backup.rules[0].conditions[0].value, "Cœur sur moi");
  assert.equal(backup.rules[0].conditions[0].giftId, "157842");
  assert.deepEqual(backup.rules, JSON.parse(before).rules);
  assert.equal(fs.readFileSync(f.v1, "utf8"), oldBackup);
  const rule = f.store.getState().rules[0];
  assert.equal(rule.conditions[0].value, "Shenazen Pulse");
  assert.equal(rule.conditions[0].giftId, "157842");
  assert.equal(rule.conditions[0].giftCost, 1);
  assert.deepEqual(rule.actions, backup.rules[0].actions); assert.deepEqual(rule.cooldown, backup.rules[0].cooldown);
  const v2Bytes = fs.readFileSync(f.v2, "utf8");
  assert.equal(f.store.reconcileGiftReferences(f.gifts).changed, 0);
  assert.equal(fs.readFileSync(f.v2, "utf8"), v2Bytes);
});

test("failure to create the dedicated heart backup prevents every correction in memory and on disk", (context) => {
  const f = fixture(context), before = f.store.getState(), disk = fs.readFileSync(f.store.filePath, "utf8");
  f.store.storage.atomicWrite = (target, ...args) => {
    if (target === f.v2) throw Object.assign(new Error("fixture-only backup failure"), { code: "EPERM" });
    return f.originalWrite(target, ...args);
  };
  assert.throws(() => f.store.reconcileGiftReferences(f.gifts), { code: "EPERM" });
  assert.deepEqual(f.store.getState(), before);
  assert.equal(fs.readFileSync(f.store.filePath, "utf8"), disk);
  assert.equal(fs.existsSync(f.v2), false);
});
