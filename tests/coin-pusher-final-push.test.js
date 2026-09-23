"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");

test("la page Coin Pusher expose la poussée complète et la route vers le plateau", () => {
  const launchPage = read(
    "src",
    "renderer",
    "app",
    "features",
    "games",
    "overlay-cards.js"
  );
  const host = read("src", "renderer", "games", "original-src", "main.ts");
  const settings = read(
    "src",
    "renderer",
    "games",
    "original-src",
    "components",
    "games",
    "coinPusherSettings.ts"
  );

  assert.match(
    launchPage,
    /pack\.id === "coin-pusher"[\s\S]*data-action="trigger-effect"[\s\S]*data-id="pousser-le-plateau"[\s\S]*Poussée complète/
  );
  assert.match(
    host,
    /effectId === 'pousser-le-plateau'[\s\S]*pushCoinPusherRoundCommand\('push'\)/
  );
  assert.match(settings, /CoinPusherRoundCommandType[^\n]*'push'/);
  assert.match(settings, /value === 'push'/);
});

test("la fin du chrono attend la poussée et le comptage avant le podium", () => {
  const game = read(
    "src",
    "renderer",
    "games",
    "original-src",
    "components",
    "games",
    "CoinPusherGame.vue"
  );
  const finishRound = game.slice(
    game.indexOf("function finishRound()"),
    game.indexOf("function startFullPush(")
  );
  const finalization = game.slice(
    game.indexOf("function completeFullPushCycle()"),
    game.indexOf("function resetRound(")
  );

  assert.match(finishRound, /timeRemainingMs\.value = 0/);
  assert.match(finishRound, /startFullPush\(true\)/);
  assert.doesNotMatch(finishRound, /roundPhase\.value = 'finished'/);
  assert.match(game, /if \(fullPushActive\.value\) updateFullPush\(delta\)/);
  assert.match(game, /FULL_PUSH_EXTEND_SECONDS \* 2/);
  assert.match(finalization, /flushScoreFrameBatches\(\)/);
  assert.match(finalization, /completeFinishedRound\(\)/);
  assert.match(finalization, /roundPhase\.value = 'finished'/);
  assert.match(game, /v-if="roundPhase === 'finished'" class="final-podium"/);
});

test("le rendu 3D couvre le vide arriere pendant la poussee complete", () => {
  const renderer = read(
    "src",
    "renderer",
    "games",
    "original-src",
    "components",
    "games",
    "coinPusher3dRenderer.ts"
  );

  assert.match(renderer, /PUSHER_GAP_REAR_ANCHOR_Z/);
  assert.match(renderer, /this\.pusherGapSurface = this\.buildPusherGapSurface\(\)/);
  assert.match(renderer, /this\.updatePusherGap\(pusherWorldZ\)/);
  assert.match(renderer, /const exposedDepth = Math\.max\(0, movingDeckRearZ - PUSHER_GAP_REAR_ANCHOR_Z\)/);
  assert.match(renderer, /this\.pusherGapSurface\.scale\.z = coveredDepth/);
  assert.match(renderer, /this\.pusherGapTrim\.position\.z = movingDeckRearZ/);
});
