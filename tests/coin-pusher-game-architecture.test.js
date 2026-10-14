"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadCoinPusherGame, traceCoinPusherGame } = require("./helpers/coin-pusher-game-traces");
const beforeExtraction = require("./fixtures/coin-pusher-game-traces.json");

test("Coin Pusher conserve les traces physiques, cadeaux, scores, manches, mystères et Canvas avant extraction", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(traceCoinPusherGame())), beforeExtraction);
});

test("le montage, les événements et le démontage restent reliés aux mêmes contrôleurs", () => {
  const environment = loadCoinPusherGame();
  environment.mounted.forEach((callback) => callback());
  assert.deepEqual([...environment.listeners.keys()].sort(), [
    "keydown", "shenpulse:coin-pusher-command", "shenpulse:coin-pusher-drop", "shenpulse:coin-pusher-settings", "storage"
  ]);
  environment.listeners.get("shenpulse:coin-pusher-drop")({ detail: {
    eventId: "mounted-drop", displayName: "Alice", username: "alice", viewerId: "alice", coinCount: 3
  } });
  assert.equal(environment.game.spawnQueue.length, 1);
  environment.listeners.get("shenpulse:coin-pusher-command")({ detail: { command: "pause" } });
  assert.equal(environment.game.roundPhase.value, "paused");
  environment.listeners.get("shenpulse:coin-pusher-command")({ detail: { command: "resume" } });
  assert.equal(environment.game.roundPhase.value, "playing");
  environment.unmounted.forEach((callback) => callback());
  assert.equal(environment.listeners.size, 0);
  assert.equal(environment.timers.size, 0);
});

test("deux instances ne partagent ni simulation, classement, déduplication ni files", () => {
  const first = loadCoinPusherGame().game, second = loadCoinPusherGame().game;
  const drop = { eventId: "same-id", coinCount: 5, displayName: "Alice", username: "alice", viewerId: "alice" };
  first.enqueueDrop(drop);
  assert.equal(first.spawnQueue.length, 1);
  assert.equal(second.spawnQueue.length, 0);
  second.enqueueDrop(drop);
  assert.equal(second.spawnQueue.length, 1);
  first.updateSpawnQueue(0.08);
  assert.equal(first.coins.length, 1);
  assert.equal(second.coins.length, 0);
  first.scoreCoin(first.coins[0]);
  first.flushScoreFrameBatches();
  assert.equal(first.players.value.length, 1);
  assert.equal(second.players.value.length, 0);
  assert.notEqual(first.readRuntime(), second.readRuntime());
});

test("la rétention des événements et la file audio gardent leurs budgets historiques", () => {
  const environment = loadCoinPusherGame(), game = environment.game;
  game.seenDropIds.set("at-limit", 1_750_000_000_000 - 5 * 60_000);
  game.seenDropIds.set("expired", 1_750_000_000_000 - 5 * 60_000 - 1);
  game.pruneSeenDrops(1_750_000_000_000);
  assert.equal(game.seenDropIds.has("at-limit"), true);
  assert.equal(game.seenDropIds.has("expired"), false);
  for (let index = 0; index < 20; index++) game.tone(100 + index * 50, 0.08, 0.035, 0, `tone-${index}`);
  assert.equal(game.pendingTones.length, 10);
  game.tone(1000, 0.2, 0.08, 3, "priority");
  assert.equal(game.pendingTones.length, 10);
  assert.equal(game.pendingTones.some((tone) => tone.key === "priority"), true);
});
