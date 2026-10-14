"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { commandActivityMetadata } = require("../src/main/core/command-activity");

test("une exécution réussie reste distincte d'un message envoyé", () => {
  const result = commandActivityMetadata({ profileId: "profile", commandId: "skip", source: "source_tiktok", platform: "tiktok",
    executed: true, executionType: "music", sent: false });
  assert.equal(result.executed, true);
  assert.equal(result.sent, false);
  assert.equal(result.executionType, "music");
});

test("le journal conserve les réponses anciennes mais pas les erreurs ou secrets arbitraires", () => {
  const legacy = commandActivityMetadata({ sent: true });
  assert.equal(legacy.sent, true);
  assert.equal(Object.hasOwn(legacy, "executed"), false);
  const result = commandActivityMetadata({ executed: "yes", forwarded: true, executionType: "http.request",
    executionReason: "provider-private-token", apiKey: "private-token", error: "secret" });
  assert.equal(result.executed, false);
  assert.equal(result.forwarded, true);
  assert.doesNotMatch(JSON.stringify(result), /private-token|provider-private|http.request|secret/);
  assert.equal(commandActivityMetadata({ executionReason: "COMMAND_TARGET_MISSING" }).executionReason, "COMMAND_TARGET_MISSING");
});

test("une mise en file ou une exécution partielle ne deviennent pas un succès complet", () => {
  const queued = commandActivityMetadata({ executed: false, queued: true, queuePosition: 2 });
  assert.equal(queued.executed, false);
  assert.equal(queued.queued, true);
  assert.equal(queued.queuePosition, 2);
  const partial = commandActivityMetadata({ executed: true, partial: true, queued: true, queuedCount: 1, executedCount: 1, failedCount: 2,
    requestedCount: 3, selectedCount: 3, queuePosition: Infinity });
  assert.equal(partial.partial, true);
  assert.equal(partial.executedCount, 1);
  assert.equal(partial.failedCount, 2);
  assert.equal(partial.queuedCount, 1);
  assert.equal(Object.hasOwn(partial, "queuePosition"), false);
  assert.equal(Object.hasOwn(commandActivityMetadata({ failedCount: "3", selectedCount: -1 }), "failedCount"), false);
});
