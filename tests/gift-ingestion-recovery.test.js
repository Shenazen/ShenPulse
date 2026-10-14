"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ingestCreatorEvent } = require("../src/main/core/ingestion");
const { reconcileGiftReferencesSafely } = require("../src/main/core/gift-recovery");

function fixture(changed) {
  const messages = [];
  let repairs = 0;
  const gift = { id: "8259", name: "Amour en langage des signes", cost: 49, imageUrl: "https://cdn/signs.png" };
  const core = {
    giftCatalog: { gifts: [gift], mergeLiveGift: () => changed },
    followSessionGuard: { accept: () => true },
    viewerService: { recordEvent() {}, isBlocked: () => false },
    overlayServer: { publishEvent() {} },
    notifyRenderer: (channel, payload) => messages.push({ channel, payload }),
    ruleEngine: { process: async () => {} },
    overlayCompletionController: { handleLikeGoalChange: async () => {} }
  };
  const hooks = {
    recordEvent: () => ({}), handleCommand: async () => {},
    handleWheelGiftTriggers: async () => {}, changed() {},
    catalogChanged: () => { repairs += 1; }
  };
  const event = { type: "gift", source: "source_tiktok", user: { id: "private-viewer", name: "Private name" }, data: { giftId: "8259", giftName: "Sign language love", value: 49 } };
  return { core, hooks, event, gift, messages, repairs: () => repairs };
}

test("un dessin nouveau actualise une seule entrée sans envoyer les informations du viewer", async () => {
  const f = fixture(true);
  await ingestCreatorEvent(f.core, f.hooks, f.event);
  const notifications = f.messages.filter((entry) => entry.channel === "gift-catalog-updated");
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0].payload, [f.gift]);
  assert.equal(JSON.stringify(notifications).includes("private-viewer"), false);
  assert.equal(f.repairs(), 1);
});

test("les cadeaux inchangés ne rediffusent pas le catalogue et ne relancent pas la migration", async () => {
  const f = fixture(false);
  for (let i = 0; i < 100; i += 1) await ingestCreatorEvent(f.core, f.hooks, f.event);
  assert.equal(f.messages.some((entry) => entry.channel === "gift-catalog-updated"), false);
  assert.equal(f.repairs(), 0);
  assert.equal(f.messages.filter((entry) => entry.channel === "live-event").length, 100);
});

test("les tapotages ne déclenchent aucune récupération de références cadeaux", async () => {
  const f = fixture(true);
  await ingestCreatorEvent(f.core, f.hooks, { ...f.event, type: "like", data: { count: 25 } });
  assert.equal(f.messages.some((entry) => entry.channel === "gift-catalog-updated"), false);
  assert.equal(f.repairs(), 0);
});

test("le démarrage répare immédiatement, mais les enrichissements LIVE regroupent les écritures", () => {
  const calls = [];
  const core = { giftCatalog: { gifts: [] }, store: { reconcileGiftReferences: (gifts, options) => { calls.push(options); return { changed: 2 }; } } };
  assert.deepEqual(reconcileGiftReferencesSafely(core), { changed: 2 });
  reconcileGiftReferencesSafely(core, { immediate: false });
  assert.deepEqual(calls, [{ immediate: true }, { immediate: false }]);
});

test("un échec de sauvegarde ne bloque pas le LIVE et ne répète pas l’avertissement", () => {
  const warnings = [];
  let failing = true;
  const core = {
    giftCatalog: { gifts: [] },
    store: { reconcileGiftReferences() { if (failing) throw new Error("private filesystem detail"); return { changed: 0 }; } },
    ingestionHooks: { activity: (...args) => warnings.push(args) }
  };
  assert.deepEqual(reconcileGiftReferencesSafely(core), { changed: 0, deferred: true });
  reconcileGiftReferencesSafely(core);
  assert.equal(warnings.length, 1);
  assert.equal(JSON.stringify(warnings).includes("private filesystem detail"), false);
  failing = false;
  reconcileGiftReferencesSafely(core);
  assert.equal(core.giftReferenceRecoveryWarning, false);
});
