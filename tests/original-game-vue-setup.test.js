"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadVueGameSetup } = require("./helpers/vue-game-setup");

test("Deal initialise les vrais contrôleurs, ajuste les prix et conserve le délai de révélation", async () => {
  const host = await loadVueGameSetup("DealOrNoDealGame", [
    "phase", "boxes", "currentPlayer", "entryAmountRef", "entryAmountScale", "scheduleEntryAmountFit",
    "startNextPlayer", "handleCaseClick", "backToLobby", "musicScene", "isResolving"
  ]);
  const game = host.game;
  try {
    assert.equal(game.phase.value, "lobby");
    assert.equal(game.musicScene.value, "waiting");
    game.entryAmountRef.value = {
      clientWidth: 100, clientHeight: 40, scrollHeight: 20,
      get scrollWidth() { return 200 * game.entryAmountScale.value; }
    };
    host.mount();
    assert.equal(host.listeners.size, 5);
    await host.flushFrames();
    assert.equal(game.entryAmountScale.value, 0.461);
    game.startNextPlayer();
    assert.equal(game.phase.value, "select");
    assert.ok(game.currentPlayer.value);
    game.handleCaseClick(game.boxes.value[0]);
    assert.equal(game.phase.value, "opening");
    const other = game.boxes.value.find((box) => !box.own);
    game.handleCaseClick(other);
    host.advance(519);
    assert.equal(other.opened, false);
    host.advance(1);
    assert.equal(other.opened, true);
    game.backToLobby();
    assert.equal(game.phase.value, "lobby");
    host.advance(10_000);
    await host.tick();
  } finally {
    host.dispose();
  }
  assert.equal(host.listeners.size, 0);
  assert.equal(host.frames.size, 0);
  assert.equal(host.timers.size, 0);
});

test("Connect Four initialise le moteur réel, joue une victoire et nettoie ses hooks", async () => {
  const host = await loadVueGameSetup("ConnectFourGame", [
    "phase", "board", "currentPlayer", "startGame", "makeMove", "winner", "winningCells", "moveCount"
  ]);
  const game = host.game;
  try {
    assert.equal(game.phase.value, "lobby");
    host.mount();
    game.startGame("duel");
    for (const column of [0, 1, 0, 1, 0, 1, 0]) {
      game.makeMove(column);
      host.advance(260);
    }
    assert.equal(game.phase.value, "victory");
    assert.equal(game.winner.value, 1);
    assert.equal(game.winningCells.value.length, 4);
    assert.equal(game.moveCount.value, 7);
    host.advance(10_000);
    await host.tick();
  } finally {
    host.dispose();
  }
  assert.equal(host.listeners.size, 0);
  assert.equal(host.timers.size, 0);
});
