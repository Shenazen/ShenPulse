"use strict";

/**
 * Livraison locale complète : codecs SDK -> MatchesService -> ActionRunner ->
 * vrai OverlayServer/SSE -> vrai runtime du lecteur Matchs.
 * Le compte, le profil et les ports sont synthétiques. Aucune API Firebase/B2,
 * aucun LIVE, aucune instance utilisateur et aucun son réel ne sont utilisés.
 * JSDOM ne décode pas la vidéo : seule la dernière primitive play() est factice.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const sdk = require("tiktok-live-connector");
const { createDefaultState } = require("../src/main/defaults");
const { selectStatePaths } = require("../src/main/state-projection");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
const { ActionRunner } = require("../src/main/action-runner");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const catalog = require("../resources/overlays/overlay-catalog");
const playbackQueue = require("../resources/overlays/match-playback-queue");

const directory = path.join(__dirname, "../resources/overlays");
const blank = (codec, value = {}) => ({ ...codec.decode(new Uint8Array()), ...value });
const roundtrip = (codec, value) => codec.decode(codec.encode(value).finish());
function bonusPackets(rewardAt, { multiple = 2, result = 0, id = "1100" } = {}) {
  const packet = (suffix, extra) => roundtrip(sdk.WebcastLinkmicBattleTaskMessage, blank(sdk.WebcastLinkmicBattleTaskMessage, {
    common: blank(sdk.CommonMessageData, { roomId: "700", msgId: `${id}${suffix}` }), battleId: "900", ...extra
  }));
  return {
    announced: packet("1", { battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_START,
      taskStart: blank(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart, {
        battleBonusConfig: blank(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig, {
          rewardPeriodConfig: blank(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig, {
            rewardMultiple: multiple, rewardStartTimestamp: String(rewardAt), duration: "10"
          })
        })
      }) }),
    settled: packet("2", { battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_TASK_SETTLE,
      taskSettle: blank(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle, { taskResult: result, rewardStartTimestamp: String(rewardAt) }) })
  };
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) { if (await check()) return; await delay(10); }
  throw new Error(`Condition non atteinte : ${label}`);
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** EventSource fondé sur le vrai flux HTTP : ni événement ni payload inventé. */
function eventSourceAdapter(origin, received, failures, streams) {
  return class LocalEventSource {
    constructor(url) {
      this.url = new URL(url, origin); this.listeners = new Map(); this.closed = false;
      assert.equal(this.url.origin, origin, "aucune requête EventSource extérieure");
      this.abort = new AbortController(); streams.push(this);
      this.ready = this.read().catch((error) => { if (!this.closed) failures.push(error.message); });
    }
    addEventListener(name, callback) { const rows = this.listeners.get(name) || []; rows.push(callback); this.listeners.set(name, rows); }
    close() { this.closed = true; this.abort.abort(); }
    async read() {
      const response = await fetch(this.url, { signal: this.abort.signal });
      if (!response.ok) throw new Error(`SSE HTTP ${response.status}`);
      const reader = response.body.getReader(), decoder = new TextDecoder(); let pending = "";
      while (!this.closed) {
        const next = await reader.read(); if (next.done) return;
        pending += decoder.decode(next.value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary;
        while ((boundary = pending.indexOf("\n\n")) >= 0) {
          const frame = pending.slice(0, boundary); pending = pending.slice(boundary + 2);
          const name = /^event: (.+)$/m.exec(frame)?.[1];
          const data = [...frame.matchAll(/^data: (.*)$/gm)].map((match) => match[1]).join("\n");
          if (!name) continue;
          received.push({ name, data: JSON.parse(data) });
          for (const callback of this.listeners.get(name) || []) callback({ data });
        }
      }
    }
  };
}

function reader(context, origin, bridge, now) {
  const dom = new JSDOM('<head><base href="/overlay/"></head><body><section id="alerts-view"></section><section id="match-view"><div class="match-stage"><video id="match-video"></video><strong id="match-title"></strong></div></section></body>', {
    url: `${origin}${bridge}?soundEnabled=false`, runScripts: "outside-only"
  });
  const window = dom.window, sandbox = dom.getInternalVMContext();
  const received = [], failures = [], played = [], requests = [], streams = [], timers = new Map(); let timer = 0;
  context.after(() => { streams.forEach((stream) => stream.close()); dom.window.close(); });
  window.Date.now = now;
  window.setTimeout = (callback, ms) => { timers.set(++timer, { callback, ms }); return timer; };
  window.clearTimeout = (id) => timers.delete(id);
  window.requestAnimationFrame = () => 0;
  window.AbortController = AbortController;
  window.ShenPulseOverlayCatalog = catalog;
  window.MatchPlaybackQueue = playbackQueue;
  window.LikeGoalPolicy = { normalizeBehavior: () => "stay" };
  window.configureNativeOverlayCanvas = () => {};
  window.configureLikeGoalViewport = () => {};
  window.overlayFontStack = () => "sans-serif";
  window.startOverlayRuntimeVersionMonitor = () => {};
  window.mediaUrl = (relative) => `${origin}/overlay/media/${relative}`;
  window.console.warn = (...args) => failures.push(args.join(" "));
  window.EventSource = eventSourceAdapter(origin, received, failures, streams);
  window.fetch = async (url, options) => {
    const target = new URL(url, window.location.href); assert.equal(target.origin, origin, "aucun fetch extérieur");
    const response = await fetch(target, options); requests.push({ path: target.pathname, status: response.status }); return response;
  };
  const prototype = window.HTMLMediaElement.prototype;
  Object.defineProperty(prototype, "readyState", { configurable: true, get: () => 2 });
  prototype.pause = () => {}; prototype.load = () => {};
  prototype.play = function () { played.push({ requestId: this.dataset.matchPlaybackId, src: this.src, muted: this.muted }); return Promise.resolve(); };
  window.Audio = class { constructor() { throw new Error("Aucune lecture audio réelle autorisée"); } };
  for (const file of ["runtime/configuration.js", "runtime/widgets/match-progress.js", "runtime/widgets/match-audio.js", "runtime/widgets/match-reactions.js", "runtime/widgets/match-preview.js", "runtime/widgets/match.js"]) {
    vm.runInContext(fs.readFileSync(path.join(directory, file), "utf8"), sandbox, { filename: file });
  }
  window.setupOverlayDesign = async () => vm.runInContext("setupMatch()", sandbox);
  vm.runInContext(fs.readFileSync(path.join(directory, "runtime/transport.js"), "utf8"), sandbox);
  return { window, received, failures, played, requests, streams };
}

async function fixture(context) {
  let clock = Date.now();
  const state = createDefaultState();
  state.settings.overlayPort = await freePort(); state.settings.apiPort = await freePort();
  state.settings.account = { uid: "cohost-delivery-fixture", email: "demo@example.invalid", refreshTokenSecretId: "fixture-only" };
  state.settings.publicOverlayRelay.matchChannelId = "m".repeat(24);
  state.settings.publicOverlayRelay.publicBaseUrl = "https://example.invalid";
  state.settings.matchAccess.accessKey = "a".repeat(32);
  state.settings.tiktok = { ...state.settings.tiktok, username: "creator", status: "live", roomId: "700", broadcaster: { userId: "1", username: "creator" } };
  state.session.running = true;
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "synthetic-test-only", mutateRuntime: (callback) => callback(state), mutate: (callback) => callback(state) };
  const server = new OverlayServer({ store, staticDirectory: directory,
    onInboundEvent: async () => { throw new Error("Aucun vrai événement LIVE"); }, onEffectRequest: async () => { throw new Error("Aucun vrai effet"); } });
  await server.start();
  context.after(() => server.stop());
  const origin = `http://127.0.0.1:${state.settings.overlayPort}`;
  const bridge = `/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}`;
  const output = reader(context, origin, bridge, () => clock);
  await until(() => server.sseClients.size === 1, "source Matchs locale abonnée");
  const runner = new ActionRunner({ store, overlayServer: server, gameHub: { assertAccess() {} }, notifyRenderer: () => { throw new Error("Aucun lecteur utilisateur"); } });
  const timers = new Set(), activities = [];
  const service = new MatchesService({ store, actionRunner: runner, overlayServer: server, now: () => clock,
    onActivity: (...args) => activities.push(args), setTimeoutImpl: (callback, ms) => { const item = { callback, at: clock + ms, unref() {} }; timers.add(item); return item; }, clearTimeoutImpl: (item) => timers.delete(item) });
  context.after(() => service.reset());
  const dispatch = async (kind, raw) => {
    const frame = normalizeTikTokBattle(kind, raw, { roomId: "700", channelUsername: "creator", receivedAtMs: clock });
    assert.ok(frame); assert.equal(service.handle({ ...frame, source: "source_tiktok" }), true); await service.whenIdle();
  };
  const advance = async (ms) => { clock += ms; for (const item of [...timers]) if (item.at <= clock) { timers.delete(item); item.callback(); } await service.whenIdle(); };
  return { state, server, service, output, activities, dispatch, advance, now: () => clock };
}

test("cohost 1v1 : début, x2, x3 et snipe atteignent le vrai lecteur via le vrai serveur SSE", { timeout: 15000 }, async (context) => {
  const f = await fixture(context);
  for (const [moment, match] of [["battleStart", "cofre"], ["multiplierX2", "x2"], ["multiplierX3", "x3"], ["snipe", "snipe"]]) {
    f.service.saveAutomation({ id: moment, name: `Démo ${moment}`, moment, enabled: true, cooldownMs: 0, remainingSeconds: 30,
      reaction: { type: "animation", match, variant: "gladiador" } });
  }
  const common = (msgId) => blank(sdk.CommonMessageData, { roomId: "700", msgId });
  const setting = blank(sdk.BattleSetting, { battleId: "900", startTimeMs: String(f.now() - 1000), duration: 120, battleType: sdk.BattleType.BATTLE_TYPE_NORMAL_BATTLE });
  const start = roundtrip(sdk.WebcastLinkMicBattle, blank(sdk.WebcastLinkMicBattle, {
    common: common("1001"), battleId: "900", action: sdk.BattleAction.BATTLE_ACTION_OPEN, battleSetting: setting,
    anchorInfo: Object.fromEntries([["1", "creator"], ["2", "demo_rival"]].map(([id, displayId]) => [id, blank(sdk.WebcastLinkMicBattle_BattleUserInfo, {
      user: blank(sdk.WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo, { userId: id, displayId })
    })]))
  }));
  await f.dispatch("linkMicBattle", start);
  await until(() => f.output.played.length === 1, "début reçu et demandé au lecteur");
  for (const [multiple, msgId] of [[2, "1002"], [3, "1003"]]) {
    if (multiple === 3) await f.advance(11000);
    const tasks = bonusPackets(f.now() - 1, { multiple, id: msgId });
    await f.dispatch("linkMicBattleTask", tasks.announced);
    assert.equal(f.output.played.length, multiple - 1, "START seul n'envoie aucune animation de bonus au studio");
    await f.dispatch("linkMicBattleTask", tasks.settled);
    await until(() => f.output.played.length === multiple, `x${multiple} reçu et demandé au lecteur`);
  }
  await f.advance(79000);
  await until(() => f.output.played.length === 4, "snipe reçu et demandé au lecteur");
  const packets = f.output.received.filter((event) => event.name === "match").map((event) => event.data.payload);
  assert.deepEqual(packets.map((packet) => packet.match), ["cofre", "x2", "x3", "snipe"]);
  assert.equal(new Set(packets.map((packet) => packet.requestId)).size, 4, "IDs générés par le vrai OverlayServer");
  assert.deepEqual(f.output.played.map((playback) => playback.requestId), packets.map((packet) => packet.requestId));
  assert.equal(f.output.played.every((playback) => playback.muted && new URL(playback.src).pathname.startsWith("/match-media/")), true);
  assert.equal(f.output.requests.filter((request) => request.path.endsWith("/ticket") && request.status === 200).length, 4);
  assert.deepEqual(f.output.failures, []);
  assert.equal(f.activities.filter((entry) => entry[0] === "success").length, 4);
});

test("deux périodes x2 gagnées atteignent le lecteur, mais le bonus de l'adversaire seul ne crée ni ticket ni animation", { timeout: 15000 }, async (context) => {
  const f = await fixture(context);
  f.service.saveAutomation({ id: "double-own-x2", name: "Deux bonus propres", moment: "multiplierX2", enabled: true, cooldownMs: 0,
    reaction: { type: "animation", match: "x2", variant: "cyber" } });
  const start = roundtrip(sdk.WebcastLinkMicBattle, blank(sdk.WebcastLinkMicBattle, {
    common: blank(sdk.CommonMessageData, { roomId: "700", msgId: "2001" }), battleId: "900", action: sdk.BattleAction.BATTLE_ACTION_OPEN,
    battleSetting: blank(sdk.BattleSetting, { battleId: "900", startTimeMs: String(f.now() - 1000), duration: 300 }),
    anchorInfo: Object.fromEntries([["1", "creator"], ["2", "demo_rival"]].map(([id, displayId]) => [id, blank(sdk.WebcastLinkMicBattle_BattleUserInfo, {
      user: blank(sdk.WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo, { userId: id, displayId })
    })]))
  }));
  await f.dispatch("linkMicBattle", start);
  const rival = bonusPackets(f.now() - 1, { result: 1, id: "2100" });
  await f.dispatch("linkMicBattleTask", rival.announced);
  await f.dispatch("linkMicBattleTask", rival.settled);
  await delay(30);
  assert.equal(f.output.played.length, 0);
  assert.equal(f.output.requests.filter((request) => request.path.endsWith("/ticket")).length, 0);
  for (let index = 0; index < 2; index += 1) {
    await f.advance(30000);
    const own = bonusPackets(f.now() - 1, { id: `220${index}`, result: index === 0 ? 0 : 2 });
    await f.dispatch("linkMicBattleTask", own.announced);
    assert.equal(f.output.played.length, index);
    await f.dispatch("linkMicBattleTask", own.settled);
    await until(() => f.output.played.length === index + 1, `la période propre x2 ${index + 1} atteint le lecteur`);
    f.output.window.document.getElementById("match-video").dispatchEvent(new f.output.window.Event("ended"));
    await delay(10);
  }
  const packets = f.output.received.filter((event) => event.name === "match").map((event) => event.data.payload);
  assert.deepEqual(packets.map((packet) => packet.match), ["x2", "x2"]);
  assert.equal(new Set(packets.map((packet) => packet.requestId)).size, 2);
  assert.equal(f.output.requests.filter((request) => request.path.endsWith("/ticket") && request.status === 200).length, 2);
  assert.equal(f.state.matchSession.ownUserId, "1");
  assert.deepEqual(f.output.failures, []);
});
