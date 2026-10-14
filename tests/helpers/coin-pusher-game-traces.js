"use strict";

/** Exécute le vrai script Vue et ses contrôleurs avec une horloge et un hasard fixes. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const esbuild = require("esbuild");
const { parse } = require("@vue/compiler-sfc");
const { createEnvironment } = require("./game-overlay-trace");

const file = path.resolve(__dirname, "../../src/renderer/games/original-src/components/games/CoinPusherGame.vue");
const exposed = [
  "settings", "players", "roundPhase", "timeRemainingMs", "coins", "spawnQueue", "particles",
  "floatingScores", "pendingTones", "seenDropIds", "mysteryRevealQueue", "mysteryRevealActive",
  "mysteryRevealPhase", "mysteryRevealLabel", "mysteryRevealDetail", "fullPushActive",
  "fullPushFinishAfter", "totalScoredCoins", "totalSpawnedCoins", "totalDiamondsReceived",
  "latestDropPresentedCount", "latestDropObjectLabel", "scoreMultiplier", "topPlayers",
  "fallbackCanvasRef", "frame", "renderScene", "applySettings", "updateSpawnQueue", "spawnCoin",
  "enqueueDrop", "enqueueSpawnBatch", "scoreCoin", "flushScoreFrameBatches", "awardPoints",
  "updatePusher", "updateCoins", "startFullPush", "finishRound", "completeFullPushCycle",
  "updateFullPush", "pauseRound", "resumeRound", "resetRound", "triggerMysteryAction",
  "cancelMysteryReveals", "pruneSeenDrops", "applyRoundCommand", "tone", "muted"
];

function loadCoinPusherGame(script) {
  script ||= parse(fs.readFileSync(file, "utf8"), { filename: file }).descriptor.scriptSetup.content;
  script = script.replace(/import\s+[\s\S]*?\s+from\s+['"]\.\/coinPusher3dRenderer['"]/g, (statement) => {
    // Ne remplacer que cet import, sans absorber les imports précédents.
    const at = statement.lastIndexOf("import");
    return `${statement.slice(0, at)}const createCoinPusher3dRenderer = () => { throw new Error("WebGL non disponible dans ce test") }`;
  }).replace(/import\s+\w+\s+from\s+['"][^'"]+\.vue['"]/g, "");
  const runtime = /const runtime = createCoinPusherRuntime/.test(script)
    ? "runtime"
    : "{ pusherClock, pusherY, previousPusherY, fullPushElapsed, fullPushPendingSpawnCount, fullPushWaitingForEffects, pendingScoredCoins, leaderboardDirty, mysteryOverflowResolved }";
  const output = esbuild.buildSync({
    stdin: { contents: `${script}\nexport const game = { ${exposed.join(",")}, readRuntime: () => (${runtime}) }`, sourcefile: file, resolveDir: path.dirname(file), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external"
  }).outputFiles[0].text;
  const environment = createEnvironment();
  let seed = 0x13579bdf, now = 1_750_000_000_000, timerId = 0;
  const timers = new Map(), mounted = [], unmounted = [], listeners = new Map();
  const schedule = (callback, delay, interval = 0) => {
    const id = ++timerId;
    timers.set(id, { callback, at: now + Number(delay || 0), interval });
    return id;
  };
  const localRequire = createRequire(file);
  const vue = localRequire("vue");
  const module = { exports: {} };
  const math = Object.create(Math);
  math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  class FixedDate extends Date { static now() { return now; } }
  Object.assign(environment.context, {
    module, exports: module.exports, Math: math, Date: FixedDate, URLSearchParams,
    require: (name) => name === "vue" ? { ...vue, onMounted: (callback) => mounted.push(callback), onBeforeUnmount: (callback) => unmounted.push(callback) } : localRequire(name),
    performance: { now: () => now }, requestAnimationFrame: () => 1, cancelAnimationFrame() {},
    ResizeObserver: class { observe() {} disconnect() {} }
  });
  Object.assign(environment.context.window, {
    location: { search: "", hostname: "localhost" }, devicePixelRatio: 1,
    localStorage: { getItem: () => null },
    setTimeout: (callback, delay) => schedule(callback, delay), clearTimeout: (id) => timers.delete(id),
    setInterval: (callback, delay) => schedule(callback, delay, delay), clearInterval: (id) => timers.delete(id),
    addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name)
  });
  vm.runInContext(output, environment.context, { filename: file });
  return {
    ...environment, game: module.exports.game, mounted, unmounted, timers, listeners,
    advance(milliseconds) {
      const target = now + milliseconds;
      let executions = 0;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!next) break;
        if (++executions > 10_000) throw new Error("Boucle de timers inattendue");
        const [id, timer] = next;
        now = timer.at;
        if (timer.interval) timer.at += timer.interval;
        else timers.delete(id);
        timer.callback();
      }
      now = target;
    }
  };
}

function traceCoinPusherGame(script) {
  const environment = loadCoinPusherGame(script), game = environment.game;
  const snapshots = [];
  const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const snapshot = (label) => snapshots.push({
    label, phase: game.roundPhase.value, remaining: game.timeRemainingMs.value,
    spawned: game.totalSpawnedCoins.value, scored: game.totalScoredCoins.value,
    diamonds: game.totalDiamondsReceived.value, queue: game.spawnQueue.map((batch) => [batch.kind, batch.remaining]),
    players: game.players.value.map((player) => ({ ...player })),
    coins: hash(game.coins), particles: hash(game.particles), floating: hash(game.floatingScores),
    fullPush: game.fullPushActive.value, finishAfter: game.fullPushFinishAfter.value,
    mystery: [game.mysteryRevealActive.value, game.mysteryRevealPhase.value, game.mysteryRevealQueue.length],
    multiplier: game.scoreMultiplier.value, latestCount: game.latestDropPresentedCount.value
  });
  game.applySettings({ ...game.settings.value, maxCoins: 80, volume: 0, mysteryCube: { ...game.settings.value.mysteryCube, enabled: false }, tickets: { ...game.settings.value.tickets, enabled: false } });
  const drop = { eventId: "gift-1", source: "gift", coinCount: 12, totalDiamonds: 42, displayName: "Alice", username: "alice", viewerId: "alice", avatarUrl: "", gift: { id: "rose", name: "Rose", cost: 1 } };
  game.enqueueDrop(drop);
  game.enqueueDrop(drop);
  for (let frame = 1; frame <= 120; frame++) {
    game.updateSpawnQueue(0.016); game.updatePusher(0.016); game.updateCoins(0.016);
  }
  snapshot("cadeau-dedup-et-physique");
  const first = game.coins[0];
  for (const [kind, x, specialValue] of [["coin", 90, 0], ["ticket", 260, 123], ["coin", 350, 0]]) {
    game.scoreCoin({ ...first, kind, x, specialValue });
  }
  game.flushScoreFrameBatches();
  snapshot("scores-agreges");
  game.fallbackCanvasRef.value = environment.context.document.createElement("canvas");
  game.fallbackCanvasRef.value.width = 540; game.fallbackCanvasRef.value.height = 900;
  game.renderScene(1.92);
  const canvas = { operations: environment.trace.length, hash: hash(environment.trace) };
  game.resetRound(false);
  game.enqueueSpawnBatch(drop, "coin", 200);
  game.finishRound();
  snapshot("poussee-finale-capacite");
  for (let cycle = 0; cycle < 5 && game.fullPushActive.value; cycle++) {
    for (const coin of game.coins) { game.scoreCoin(coin); coin.scored = true; coin.phase = "falling"; }
    game.completeFullPushCycle();
  }
  snapshot("podium-apres-toutes-les-pieces");
  game.resetRound(true);
  game.applySettings({ ...game.settings.value, mysteryCube: { ...game.settings.value.mysteryCube, enabled: true, pointsBonusEnabled: true, pointsBonusMin: 10, pointsBonusMax: 10, coinRainEnabled: false, multiplierEnabled: false, barriersEnabled: false } });
  const mystery = game.spawnCoin(drop, 1, "mystery");
  for (let index = 0; index < 12; index++) game.triggerMysteryAction(mystery);
  game.flushScoreFrameBatches();
  snapshot("mysteres-file-et-debordement");
  environment.advance(50_000);
  game.flushScoreFrameBatches();
  snapshot("mysteres-resolus");
  game.resetRound(true);
  snapshot("reinitialisation");
  return { snapshots, canvas };
}

module.exports = { loadCoinPusherGame, traceCoinPusherGame };
