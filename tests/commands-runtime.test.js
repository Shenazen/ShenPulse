"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ChatbotService, MAX_PENDING_DELIVERIES } = require("../src/main/chatbot-service");
const { CommandExecutor } = require("../src/main/commands/executor");
const { ActionRunner } = require("../src/main/action-runner");
const { SpotifyService } = require("../src/main/spotify-service");
const { ShellyService } = require("../src/main/shelly-service");
const { LiveEventActionService } = require("../src/main/core/live-event-actions");
const { selectStatePaths, getRuleEngineState } = require("../src/main/state/projections");
const { createDefaultOverlaySession } = require("../src/main/overlay-session-state");
const { tiktokConnectorPayload } = require("../src/main/sources/tiktok-protocol");
const { normalizeEvent } = require("../src/main/event-normalizer");
const { ingestCreatorEvent } = require("../src/main/core/ingestion");

function fixture(execution = { type: "music", operation: "next" }) {
  const state = {
    commands: [{ id: "cmd", command: "!next", aliases: ["!suivant"], kind: "command", enabled: true,
      audience: "moderator", response: "Ancienne réponse conservée", cooldownMs: 0, globalCooldownMs: 0, execution }],
    connections: [{ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected", config: { username: "creator" } }],
    session: { running: true, profileId: "p1", startedAt: "2026-10-14T00:00:00Z", game: {} },
    profiles: [{ id: "p1", enabledRuleIds: ["rule"] }],
    rules: [{ id: "rule", name: "Son", enabled: true, actions: [{ id: "sound", type: "audio.play", config: { url: "sound.mp3" } }] }],
    settings: { account: { uid: "owner", email: "owner@example.com", refreshTokenSecretId: "account" }, siteVisibility: {},
      tiktok: { status: "live", roomId: "room1", broadcaster: { username: "creator" } }, kick: {},
      overlayConfigs: { wheel: { wheels: [] } } },
    commerce: { subscription: { tier: "pro", status: "active" } }, overlaySession: createDefaultOverlaySession()
  };
  const projections = [], calls = [], activity = [], sent = [], published = [];
  const store = {
    getState: () => { throw new Error("Le flux Commandes doit utiliser une projection."); },
    getStateProjection: (paths) => { projections.push(paths); return selectStatePaths(state, paths); },
    getRuleEngineState: () => getRuleEngineState(state),
    getAccountSession: () => state.settings.account,
    getSecret: (id) => id === "account" ? "fixture" : "",
    mutateRuntime: (callback) => callback(state)
  };
  const runtime = {};
  const sourceHub = { runtimes: new Map([["source_tiktok", runtime]]), getChatCapabilities: () => ({ canSend: false }),
    send: async (...args) => { sent.push(args); return { sent: true }; } };
  const actionRunner = new ActionRunner({ store, overlayServer: { publish: (...args) => published.push(args) },
    gameHub: { assertAccess: () => {} }, notifyRenderer: (...args) => calls.push({ playback: args }),
    spotifyService: { control: async (config, options) => { assert.equal(options.shouldExecute(), true); calls.push(config); return { ok: true }; } } });
  const executor = new CommandExecutor({ store, actionRunner });
  const service = new ChatbotService({ store, sourceHub, commandExecutor: executor, functionalOnly: true, onActivity: (...args) => activity.push(args) });
  const event = (message = "!next", user = {}) => ({ type: "chat", source: "source_tiktok", user: { id: "viewer", name: "viewer", moderator: true, ...user }, data: { message } });
  return { state, store, service, executor, actionRunner, sourceHub, projections, calls, activity, sent, published, event };
}

test("Free refuse création/exécution Commandes musique, action et overlay sans effacer leurs données", async () => {
  for (const execution of [{ type: "music", operation: "next" }, { type: "action", actionId: "sound" },
    { type: "overlay", overlayKey: "likeGoal", operation: "reset" }]) {
    const f = fixture(execution); f.state.commerce.subscription = { tier: "free", status: "free" };
    const previous = structuredClone(f.state.commands);
    assert.throws(() => f.executor.validateTargets(f.state.commands[0]), { code: "PRO_FEATURE_REQUIRED" });
    assert.equal(f.service.handleChat(f.event()), null); await f.service.whenIdle();
    assert.equal(f.calls.length, 0); assert.equal(f.published.length, 0); assert.deepEqual(f.state.commands, previous);
  }
});

test("une commande en file est annulée si l’essai Pro expire pendant la commande précédente", async () => {
  const f = fixture(); let release;
  f.actionRunner.spotifyService.control = async () => {
    f.calls.push("début"); await new Promise((resolve) => { release = resolve; }); return { ok: true };
  };
  f.service.handleChat(f.event()); f.service.handleChat(f.event());
  assert.equal(f.service.pendingDeliveries.length, 1);
  f.state.commerce.subscription = { tier: "pro", source: "trial", status: "active", expiresAtMs: Date.now() - 1 };
  release(); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.published.length, 0);
});

test("commande TikTok fonctionnelle : exécution sans envoi de chat ni réponse, même si chat.reply est masqué", async () => {
  const f = fixture(); f.state.settings.siteVisibility.actionTypes = { "chat:reply": { scope: "hidden" } };
  assert.equal(f.service.handleChat(f.event()).queued, true);
  await f.service.whenIdle();
  assert.equal(f.calls[0].operation, "next"); assert.equal(f.sent.length, 0);
  assert.equal(f.activity[0][2], "Commande exécutée"); assert.equal(f.activity[0][4].executed, true);
  assert.equal(f.state.commands[0].response, "Ancienne réponse conservée");
  assert.equal(f.projections.some((paths) => paths.includes("profiles") || paths.includes("game.interactionRulesByPack") || paths.includes("rules")), false);
});

test("le service LIVE de production ignore les anciens messages conservés et ne crée aucun scheduler", async () => {
  const f = fixture();
  const legacy = [
    { id: "old-command", command: "!next", enabled: true, response: "Ancienne réponse" },
    { id: "old-auto", kind: "auto-reply", enabled: true, matchText: "bonjour", response: "Réponse automatique" },
    { id: "old-timer", kind: "timer", enabled: true, intervalMs: 60000, response: "Message programmé" }
  ];
  f.state.commands = legacy.map((item) => ({ ...item }));
  const live = new LiveEventActionService({ store: f.store, sourceHub: f.sourceHub, actionRunner: f.actionRunner,
    overlayServer: { publish: (...args) => f.published.push(args) }, commandCooldowns: new Map(),
    onActivity: (...args) => f.activity.push(args), onChanged() {} });
  assert.equal(live.chatbot.functionalOnly, true);
  live.chatbot.setIntervalFn = () => { throw new Error("Aucun scheduler de messages en production."); };
  live.chatbot.syncTimers(); await live.chatbot.tick();
  assert.equal(live.handleCommand(f.event()) instanceof Promise, true);
  await live.chatbot.whenIdle();
  assert.equal(live.chatbot.handleChat(f.event("bonjour")), null);
  assert.equal(live.chatbot.handleChat(f.event("!next")), null);
  for (const entry of legacy) {
    assert.deepEqual(await live.chatbot.deliver(entry, f.event(), entry.response, live.chatbot.state(), { timer: entry.kind === "timer" }), { sent: false, cancelled: true });
  }
  assert.equal(live.chatbot.timerHandle, null); assert.equal(live.chatbot.timerJobs.size, 0);
  assert.equal(f.calls.length, 0); assert.equal(f.sent.length, 0); assert.equal(f.published.length, 0); assert.equal(f.activity.length, 0);
  assert.deepEqual(f.state.commands, legacy, "les anciennes données ne sont ni supprimées ni converties");
});

test("une ancienne réponse ne peut intercepter le nom d'une commande fonctionnelle en production", async () => {
  const f = fixture();
  f.state.commands.unshift({ id: "legacy", command: "!next", response: "Ne doit pas partir", enabled: true });
  assert.equal(f.service.hasFunctionalCommand(f.event()), true);
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.sent.length, 0);
  assert.equal(f.activity[0][4].commandId, "cmd");
});

test("un message historique déjà en file est annulé lorsque le service passe en mode Commandes uniquement", async () => {
  const f = fixture(); let release;
  f.service.functionalOnly = false;
  f.actionRunner.spotifyService.control = () => new Promise((resolve) => { release = resolve; });
  const legacy = { id: "legacy", command: "!legacy", response: "Message devenu interdit", enabled: true };
  f.state.commands.push(legacy);
  f.service.handleChat(f.event());
  f.service.handleChat(f.event("!legacy"));
  assert.equal(f.service.pendingDeliveries.length, 1);
  f.service.functionalOnly = true;
  release({ ok: true }); await f.service.whenIdle();
  assert.equal(f.sent.length, 0); assert.equal(f.published.length, 0);
  assert.equal(f.activity.length, 1); assert.equal(f.activity[0][4].commandId, "cmd");
});

test("alias exacts, audience et plateforme sont appliqués avant tout effet", async () => {
  const f = fixture();
  assert.equal(f.service.handleChat(f.event("!nextwrong")), null);
  assert.equal(f.service.handleChat(f.event("!suivant", { moderator: false })), null);
  f.state.commands[0].platform = "kick";
  assert.equal(f.service.handleChat(f.event("!suivant")), null);
  f.state.commands[0].platform = "tiktok";
  assert.equal(f.service.handleChat(f.event("!Suivant"))?.queued, true);
  await f.service.whenIdle(); assert.equal(f.calls.length, 1);
});

test("le créateur TikTok identifié par le connecteur et Kick signé peuvent utiliser une commande réservée aux modérateurs", async () => {
  const f = fixture();
  f.service.handleChat(f.event("!next", { name: "creator", moderator: false })); await f.service.whenIdle();
  assert.equal(f.calls.length, 1);
  f.state.connections[0] = { id: "source_kick", type: "kick-native", enabled: true, status: "connected" };
  f.sourceHub.runtimes = new Map([["source_kick", {}]]);
  f.state.settings.kick = { live: true, account: { id: "kick-owner" } };
  f.service.handleChat({ ...f.event("!next", { id: "kick-owner", moderator: false }), source: "source_kick" });
  await f.service.whenIdle(); assert.equal(f.calls.length, 2);
  assert.equal(f.service.handleChat({ ...f.event("!next", { displayName: "creator", moderator: false }), source: "source_kick" }), null);
});

test("les rôles du protocole TikTok moderne restent reconnus jusqu'à l'exécution des commandes", async () => {
  for (const [audience, identity] of [["moderator", { isModeratorOfAnchor: true }], ["subscriber", { isSubscriberOfAnchor: true }]]) {
    const f = fixture(); f.state.commands[0].audience = audience;
    const message = normalizeEvent({ event: "chat", data: tiktokConnectorPayload("chat", {
      user: { id: "viewer", uniqueId: "viewer" }, comment: "!next", userIdentity: identity
    }, "creator") }, "source_tiktok");
    assert.equal(f.service.handleChat(message)?.queued, true, audience);
    await f.service.whenIdle();
    assert.equal(f.calls.length, 1); assert.equal(f.sent.length, 0);
  }
});

test("un payload API/WebSocket local ne peut usurper le connecteur TikTok ou le créateur", async () => {
  for (const source of ["local-api", "local-websocket", "source_tiktok"]) {
    const f = fixture();
    const core = { store: f.store, giftCatalog: { gifts: [] }, followSessionGuard: { accept: () => true },
      viewerService: { recordEvent() {}, isBlocked: () => false }, liveEventActions: { chatbot: f.service },
      overlayServer: { publishEvent() {} }, notifyRenderer() {}, ruleEngine: { process() {} },
      overlayCompletionController: { handleLikeGoalChange() {} } };
    const hooks = { recordEvent: () => ({}), handleCommand: (event) => f.service.handleChat(event), handleWheelGiftTriggers() {}, changed() {} };
    const forged = f.event("!next", { name: "creator", moderator: false });
    const result = await ingestCreatorEvent(core, hooks, forged, source); await f.service.whenIdle();
    assert.equal(result.source, source);
    assert.equal(forged.source, "source_tiktok", "le payload d'origine reste intact");
    assert.equal(f.calls.length, source === "source_tiktok" ? 1 : 0);
    if (source !== "source_tiktok") assert.equal(f.activity.length, 0);
  }
});

test("un rôle manquant ou faux ne donne aucun droit mais explique le refus sans conserver le chat", async () => {
  const f = fixture(); const original = structuredClone(f.state.commands);
  const message = normalizeEvent({ event: "chat", data: tiktokConnectorPayload("chat", {
    user: { id: "viewer", uniqueId: "private-viewer" }, comment: "!next private-arguments", userIdentity: { isModeratorOfAnchor: "false" }
  }, "creator") }, "source_tiktok");
  assert.equal(message.user.moderator, false);
  assert.equal(f.service.handleChat(message), null); await f.service.whenIdle();
  assert.equal(f.calls.length, 0); assert.equal(f.activity[0][4].executionReason, "COMMAND_AUDIENCE_FORBIDDEN");
  assert.equal(f.activity[0][4].executed, false); assert.equal(f.activity[0][4].sent, false);
  assert.doesNotMatch(JSON.stringify(f.activity), /private-viewer|private-arguments/);
  assert.deepEqual(f.state.commands, original, "le refus ne modifie jamais l'audience choisie");
});

test("les refus connus sont bornés et limités par motif, commande et source ; les autres chats restent silencieux", async () => {
  const f = fixture(); let now = 1000; f.service.now = () => now;
  for (let index = 0; index < 200; index += 1) f.service.handleChat(f.event("!next", { id: String(index), moderator: false }));
  assert.equal(f.activity.length, 1);
  f.service.handleChat(f.event("bonjour", { moderator: false })); assert.equal(f.activity.length, 1);
  now += 5000; f.service.handleChat(f.event("!next", { moderator: false })); assert.equal(f.activity.length, 2);
  for (let index = 0; index < 300; index += 1) {
    f.state.commands[0].id = `cmd-${index}`; f.service.handleChat(f.event("!next", { moderator: false }));
  }
  assert.equal(f.service.rejections.size, 256);
  f.service.reset(); assert.equal(f.service.rejections.size, 0);
  await f.service.whenIdle(); assert.equal(f.calls.length, 0);
});

test("un cooldown visible n'exécute aucun second effet et n'imprime ni arguments ni identité", async () => {
  const f = fixture(); f.service.now = () => 1000; f.state.commands[0].cooldownMs = 10000;
  f.service.handleChat(f.event()); await f.service.whenIdle();
  for (let index = 0; index < 20; index += 1) f.service.handleChat(f.event("!next private-arguments"));
  await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.activity.length, 2);
  assert.equal(f.activity[1][4].executionReason, "COMMAND_COOLDOWN_ACTIVE");
  assert.doesNotMatch(JSON.stringify(f.activity), /private-arguments/);
});

test("l'échec différé d'un secteur devient un avertissement privé seulement si la commande appartient toujours au même LIVE", async () => {
  const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin" }); let deferred;
  f.service.commandExecutor = { execute: async (_item, _event, options) => {
    deferred = options.onDeferredActionResult; return { executed: true, description: "Roue lancée" };
  } };
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.activity[0][4].executed, true);
  deferred({ executed: false, reason: "COMMAND_TARGET_MISSING", description: "provider-private-token" });
  assert.equal(f.activity[1][2], "Action de roue non exécutée");
  assert.equal(f.activity[1][4].partial, true); assert.equal(f.activity[1][4].executed, false);
  assert.equal(f.activity[1][4].executionReason, "COMMAND_TARGET_MISSING");
  assert.doesNotMatch(JSON.stringify(f.activity), /provider-private-token/);
  deferred({ executed: true, partial: true, reason: "COMMAND_WHEEL_EFFECT_PARTIAL", description: "provider-private-token" });
  assert.equal(f.activity[2][2], "Action de roue partiellement exécutée");
  assert.equal(f.activity[2][4].executed, true);
  assert.equal(f.activity[2][4].partial, true);
  assert.doesNotMatch(JSON.stringify(f.activity), /provider-private-token/);
  f.state.session.profileId = "other-profile"; deferred({ reason: "COMMAND_TARGET_MISSING" });
  assert.equal(f.activity.length, 3, "le résultat d'un ancien LIVE/profil ne doit pas remplir le journal du nouveau");
});

test("arguments musicaux : recherche bornée et littérale, jamais un modèle ou du code", async () => {
  const f = fixture({ type: "music", operation: "queue", useArgs: true, uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC" });
  f.service.handleChat(f.event("!suivant {{message}} {{constructor}}; rm -rf /")); await f.service.whenIdle();
  assert.equal(f.calls[0].query, "{{message}} {{constructor}}; rm -rf /");
  assert.equal(f.calls[0].operation, "queue");
  assert.equal(f.calls[0].uri, "", "les arguments remplacent toujours l’ancienne URI fixe");
  f.service.handleChat(f.event("!next")); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.activity.at(-1)[4].executionReason, "COMMAND_ARGUMENT_REQUIRED");
});

test("toutes les opérations musicales autorisées sont mappées au service Spotify", async () => {
  for (const execution of [
    { type: "music", operation: "previous" }, { type: "music", operation: "play" }, { type: "music", operation: "pause" },
    { type: "music", operation: "volume", volume: 35 }, { type: "music", operation: "play_track", query: "Un titre" },
    { type: "music", operation: "play_track", uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC" },
    { type: "music", operation: "play_playlist", playlistId: "4uLU6hMCjMI75M1A2tKUQC" }
  ]) {
    const f = fixture(execution); f.service.handleChat(f.event()); await f.service.whenIdle();
    assert.equal(f.calls.length, 1, execution.operation);
    assert.equal(f.calls[0].operation, execution.operation === "play_track" && !execution.uri ? "queue" : execution.operation);
    if (execution.operation === "play_track" && !execution.uri) assert.equal(f.calls[0].mode, "play");
  }
});

test("référence d'action active : le son est déclenché une seule fois ; absente/désactivée/hors profil refusée", async () => {
  const f = fixture({ type: "action", actionId: "sound" });
  f.service.handleChat(f.event()); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
  for (const mutate of [(x) => { x.state.rules = []; }, (x) => { x.state.rules[0].enabled = false; },
    (x) => { x.state.rules[0].actions[0].enabled = false; }, (x) => { x.state.profiles[0].enabledRuleIds = []; }]) {
    const other = fixture({ type: "action", actionId: "sound" }); mutate(other);
    other.service.handleChat(other.event()); await other.service.whenIdle(); assert.equal(other.calls.length, 0);
    assert.equal(other.activity[0][4].executed, false);
  }
});

test("commandes d'overlays utilisent les compteurs/session et la roue existants", async () => {
  for (const [execution, channel] of [
    [{ type: "overlay", overlayKey: "timer", operation: "add", seconds: 10 }, "timer"],
    [{ type: "overlay", overlayKey: "winCounter", operation: "adjust", amount: 3 }, "win-counter"],
    [{ type: "overlay", overlayKey: "likeGoal", operation: "set", amount: 42 }, "like-goal"],
    [{ type: "overlay", overlayKey: "coinJar", operation: "adjust", amount: 4 }, "coin-jar"],
    [{ type: "overlay", overlayKey: "multiplierTimer", operation: "set", seconds: 30, multiplier: 2 }, "multiplier-timer"],
    [{ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "wheel1" }, "wheel"]
  ]) {
    const f = fixture(execution);
    f.actionRunner.setTimeoutImpl = () => ({ unref() {} }); f.actionRunner.wheelActions.setTimeoutImpl = f.actionRunner.setTimeoutImpl;
    f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true, segments: [{ label: "A" }, { label: "B" }] }];
    f.service.handleChat(f.event()); await f.service.whenIdle();
    assert.equal(f.published[0]?.[0], channel); assert.equal(f.activity[0][4].executed, true);
  }
});

test("droits des fonctionnalités, abonnement des overlays et IRL restent appliqués", async () => {
  for (const [execution, mutate] of [
    [{ type: "music", operation: "next" }, (f) => { f.state.settings.siteVisibility.features = { "spotify:playback": "hidden" }; }],
    [{ type: "overlay", overlayKey: "timer", operation: "pause" }, (f) => { f.state.settings.siteVisibility.overlays = { timer: "admin" }; }],
    [{ type: "overlay", overlayKey: "winCounter", operation: "reset" }, (f) => { f.state.commerce.subscription = { tier: "free" }; }],
    [{ type: "action", actionId: "sound" }, (f) => { f.state.rules[0].actions[0].type = "irl.shelly"; }],
    [{ type: "action", actionId: "sound" }, (f) => { f.state.settings.siteVisibility.actionTypeOverrides = { "audio:play": false }; }]
  ]) {
    const f = fixture(execution); mutate(f); f.service.handleChat(f.event()); await f.service.whenIdle();
    assert.equal(f.calls.length, 0); assert.equal(f.published.length, 0);
    if (f.state.commerce.subscription.tier === "free") assert.equal(f.activity.length, 0);
    else assert.equal(f.activity[0][4].executed, false);
  }
});

test("file bornée/non bloquante : arrêt, profil, source, commande modifiée ou supprimée annulent les effets retardés", async () => {
  for (const mutate of [
    (f) => { f.state.session.running = false; }, (f) => { f.state.session.profileId = "p2"; },
    (f) => { f.state.settings.account.uid = "other"; }, (f) => { f.state.connections[0].status = "disconnected"; },
    (f) => { f.state.commands[0].enabled = false; }, (f) => { f.state.commands[0].execution.operation = "pause"; },
    (f) => { f.state.commands = []; }, (f) => { f.sourceHub.runtimes.set("source_tiktok", {}); }
  ]) {
    const f = fixture(); let release;
    f.actionRunner.spotifyService.control = (_config, options) => new Promise((resolve) => { release = () => {
      if (options.shouldExecute()) f.calls.push("effect"); resolve({ ok: true });
    }; });
    for (let index = 0; index < MAX_PENDING_DELIVERIES + 5; index++) assert.equal(f.service.handleChat(f.event()) instanceof Promise, false);
    assert.equal(f.service.activeDeliveries.size + f.service.pendingDeliveries.length, MAX_PENDING_DELIVERIES);
    mutate(f); release(); await f.service.whenIdle();
    assert.equal(f.calls.length, 0); assert.equal(f.activity.length, 1);
    assert.equal(f.activity[0][4].executionReason, "COMMAND_QUEUE_FULL", "seul le refus préalable de file pleine est journalisé ; aucune exécution tardive");
  }
});

test("le compte LIVE Kick changé pendant une tâche conserve le runtime mais annule l'ancienne commande", async () => {
  const f = fixture(); let release;
  f.state.connections[0] = { id: "source_kick", type: "kick-native", enabled: true, status: "connected" };
  f.state.settings.kick = { live: true, account: { id: "kick-owner" } };
  const runtime = {}; f.sourceHub.runtimes = new Map([["source_kick", runtime]]);
  f.actionRunner.spotifyService.control = (_config, options) => new Promise((resolve) => { release = () => {
    if (options.shouldExecute()) f.calls.push("effect"); resolve({ ok: true });
  }; });
  f.service.handleChat({ ...f.event(), source: "source_kick" });
  f.state.settings.kick.account.id = "other-kick-owner";
  assert.equal(f.sourceHub.runtimes.get("source_kick"), runtime);
  release(); await f.service.whenIdle(); assert.equal(f.calls.length, 0); assert.equal(f.activity.length, 0);
});

test("cooldowns viewer/global des commandes restent distincts sans transport d'envoi", async () => {
  const f = fixture(); let now = 1000; f.service.now = () => now;
  f.state.commands[0].cooldownMs = 10000; f.state.commands[0].globalCooldownMs = 2000;
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.service.handleChat(f.event("!next", { id: "other" })), null);
  now += 2000; f.service.handleChat(f.event("!next", { id: "other" })); await f.service.whenIdle();
  now += 2000; assert.equal(f.service.handleChat(f.event()), null);
  assert.equal(f.calls.length, 2); assert.equal(f.sent.length, 0);
});

test("enfant de groupe et cible musicale modifiés après attente sont refusés", async () => {
  const f = fixture({ type: "action", actionId: "group" });
  f.state.rules[0].actions.push({ id: "group", type: "action.group", config: { actionIds: ["sound"] } });
  f.state.rules[0].actions[0] = { id: "sound", type: "spotify.queue", config: { operation: "next" } };
  let release;
  f.actionRunner.spotifyService.control = (_config, options) => new Promise((resolve) => { release = () => {
    if (options.shouldExecute()) f.calls.push("next"); resolve({ skipped: true });
  }; });
  f.service.handleChat(f.event());
  f.state.rules[0].actions[0].config.operation = "pause";
  release(); await f.service.whenIdle(); assert.equal(f.calls.length, 0);
});

test("références ambiguës et groupes circulaires sont refusés ; graphes partagés auditables sans explosion", async () => {
  const ambiguous = fixture({ type: "action", actionId: "sound" });
  ambiguous.state.rules[0].actions.push({ id: "sound", type: "audio.play", config: { url: "autre.mp3" } });
  assert.throws(() => ambiguous.executor.validateTargets(ambiguous.state.commands[0]), { code: "COMMAND_TARGET_AMBIGUOUS" });
  const f = fixture({ type: "action", actionId: "a" });
  f.state.rules[0].actions = [{ id: "a", type: "action.group", config: { actionIds: ["b"] } },
    { id: "b", type: "action.group", config: { actionIds: ["a"] } }];
  assert.throws(() => f.executor.validateTargets(f.state.commands[0]), /circulaire/);
  f.state.rules[0].actions = [{ id: "sound", type: "audio.play", config: { url: "sound.mp3" } }];
  for (let index = 0; index < 15; index++) f.state.rules[0].actions.push({ id: `group${index}`, type: "action.group",
    config: { actionIds: index ? [`group${index - 1}`, "sound"] : ["sound"] } });
  f.state.commands[0].execution.actionId = "group14";
  assert.equal(f.executor.validateTargets(f.state.commands[0]), true);
});

test("roue liée : re-spins internes légitimes préservés, puis annulés après changement de contexte", async () => {
  const f = fixture({ type: "action", actionId: "spin" }); const timers = [];
  f.state.rules[0].actions = [{ id: "spin", type: "wheel.spin", config: { wheelId: "wheel1" } }];
  f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true, segments: [
    { label: "Encore", action: "spin" }, { label: "Encore aussi", action: "spin" }
  ] }];
  f.actionRunner.wheelActions.setTimeoutImpl = (callback, ms) => { timers.push({ callback, ms }); return { unref() {} }; };
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.published.length, 1);
  // Le callback de fin libère la roue et traite le re-spin qu'elle avait mis
  // en file ; aucun vrai timer, aucune publication réseau n'est utilisé ici.
  timers.shift().callback(); timers.shift().callback(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.published.length, 2, "la configuration interne reSpinDepth n’invalide pas la roue liée");
  f.state.session.profileId = "p2";
  timers.shift().callback(); timers.shift().callback(); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.published.length, 2);
});

test("commande roue : seul le preset réellement sélectionné est audité, sans mutation des autres roues", async () => {
  const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin" });
  const wheel = f.state.settings.overlayConfigs.wheel;
  wheel.selectedWheelId = "plain";
  wheel.wheels = [
    { id: "other-game", enabled: true, segments: [{ label: "Jeu", actionId: "inactive-game-action" }, { label: "Jeu 2" }] },
    { id: "plain", enabled: true, segments: [{ label: "A" }, { label: "B" }] },
    // Un doublon hérité suit le contrat du tirage réel (première occurrence).
    { id: "plain", enabled: true, segments: [{ label: "Ancien", actionId: "other-profile-action" }, { label: "Ancien 2" }] }
  ];
  const previous = structuredClone(wheel);
  assert.equal(f.executor.validateTargets(f.state.commands[0]), true);
  f.actionRunner.wheelActions.setTimeoutImpl = () => ({ unref() {} });
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.deepEqual(f.published[0][1].choices, ["A", "B"]);
  assert.equal(f.activity[0][4].executed, true);
  assert.deepEqual(wheel, previous);
});

test("commande roue : un secteur désactivé, absent ou hors profil n’empêche pas le tirage ni ne déclenche son effet", async () => {
  for (const mutate of [
    (f) => { f.state.rules[0].enabled = false; },
    (f) => { f.state.rules[0].actions[0].enabled = false; },
    (f) => { f.state.profiles[0].enabledRuleIds = []; },
    (f) => { f.state.rules = []; }
  ]) {
    const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "wheel1" });
    f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true,
      segments: [{ label: "Son", actionId: "sound" }, { label: "Son aussi", actionId: "sound" }] }];
    mutate(f);
    const previous = structuredClone({ rules: f.state.rules, commands: f.state.commands, wheel: f.state.settings.overlayConfigs.wheel });
    const timers = [];
    f.actionRunner.wheelActions.setTimeoutImpl = (callback) => { timers.push(callback); return { unref() {} }; };
    assert.equal(f.executor.validateTargets(f.state.commands[0]), true);
    f.service.handleChat(f.event()); await f.service.whenIdle();
    assert.equal(f.published[0][0], "wheel"); assert.equal(f.published[0][1].effectSkipped, true);
    assert.equal(f.published[0][1].effectReason, "COMMAND_TARGET_MISSING");
    assert.equal(f.calls.length, 0); assert.equal(timers.length, 1, "aucun timer d’effet n’est créé");
    assert.equal(f.activity[0][2], "Commande partiellement exécutée");
    assert.equal(f.activity[0][4].executed, true); assert.equal(f.activity[0][4].partial, true);
    assert.match(f.activity[0][3], /secteur gagnant.*indisponible/);
    assert.deepEqual({ rules: f.state.rules, commands: f.state.commands, wheel: f.state.settings.overlayConfigs.wheel }, previous);
  }
});

test("roue commandée : les secteurs utilisés restent soumis aux droits et aux références non ambiguës", () => {
  for (const mutate of [
    (f) => { f.state.rules[0].actions.push({ id: "sound", type: "audio.play", config: {} }); },
    (f) => { f.state.settings.siteVisibility.actionTypeOverrides = { "audio:play": false }; }
  ]) {
    const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "wheel1" });
    f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true,
      segments: [{ label: "Son", actionId: "sound" }, { label: "Son aussi", actionId: "sound" }] }];
    mutate(f);
    assert.throws(() => f.executor.validateTargets(f.state.commands[0]));
    assert.equal(f.calls.length, 0); assert.equal(f.published.length, 0);
  }
});

test("préflight de roue : choix temporaires et relances ne consultent pas leurs anciennes liaisons inutilisées", () => {
  for (const choices of [undefined, ["A", "B"]]) {
    const f = fixture({ type: "action", actionId: "spin" });
    f.state.rules[0].actions.push({ id: "spin", type: "wheel.spin", config: { wheelId: "wheel1", ...(choices ? { choices } : {}) } });
    f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true, segments: [
      { label: "Relance", action: choices ? "action" : "spin", actionId: "sound" },
      { label: "Relance 2", action: choices ? "action" : "spin", actionId: "sound" }
    ] }];
    f.state.settings.siteVisibility.actionTypeOverrides = { "audio:play": false };
    assert.equal(f.executor.validateTargets(f.state.commands[0]), true);
  }
});

test("effet de roue différé : référence désactivée ou modifiée revalidée et erreur locale visible sans fuite fournisseur", async () => {
  for (const failure of ["disabled", "edited", "provider"]) {
    const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "wheel1" });
    f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true,
      segments: [{ label: "Son", actionId: "sound" }, { label: "Son aussi", actionId: "sound" }] }];
    const timers = [], outcomes = [];
    f.actionRunner.wheelActions.setTimeoutImpl = (callback) => { timers.push(callback); return { unref() {} }; };
    const outcome = await f.executor.execute(f.state.commands[0], f.event(), { onDeferredActionResult: (value) => outcomes.push(value) });
    assert.equal(outcome.executed, true); assert.equal(timers.length, 2);
    if (failure === "disabled") f.state.rules[0].enabled = false;
    if (failure === "edited") f.state.rules[0].actions[0].config.url = "other.mp3";
    if (failure === "provider") f.actionRunner.notifyRenderer = () => { throw new Error("https://provider.test/?secret=ne-pas-journaliser"); };
    timers[0](); await Promise.resolve(); await Promise.resolve();
    assert.equal(f.calls.length, 0); assert.equal(outcomes.length, 1);
    assert.equal(outcomes[0].reason, failure === "disabled" ? "COMMAND_TARGET_MISSING" : failure === "edited" ? "COMMAND_CONTEXT_CHANGED" : "COMMAND_EXECUTION_FAILED");
    assert.doesNotMatch(JSON.stringify(outcomes), /provider|secret|ne-pas-journaliser/);
  }
});

test("effet de roue différé valide exécuté une seule fois, sans journal tardif dans un autre contexte", async () => {
  for (const cancel of [false, true]) {
    const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "wheel1" });
    f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true,
      segments: [{ label: "Son", actionId: "sound" }, { label: "Son aussi", actionId: "sound" }] }];
    const timers = [], outcomes = []; let allowed = true;
    f.actionRunner.wheelActions.setTimeoutImpl = (callback) => { timers.push(callback); return { unref() {} }; };
    await f.executor.execute(f.state.commands[0], f.event(), { shouldExecute: () => allowed, onDeferredActionResult: (value) => outcomes.push(value) });
    if (cancel) allowed = false;
    timers[0](); await Promise.resolve(); await Promise.resolve();
    assert.equal(f.calls.length, cancel ? 0 : 1); assert.equal(outcomes.length, 0);
  }
});

test("roue dans un groupe : le tirage sans effet gagnant conserve l’avertissement partiel", async () => {
  const f = fixture({ type: "action", actionId: "group" });
  f.state.rules[0].actions.push({ id: "spin", type: "wheel.spin", config: { wheelId: "wheel1" } },
    { id: "group", type: "action.group", config: { actionIds: ["spin"] } });
  f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true,
    segments: [{ label: "Ancien effet", actionId: "absent" }, { label: "Ancien effet aussi", actionId: "absent" }] }];
  f.actionRunner.wheelActions.setTimeoutImpl = () => ({ unref() {} });
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.calls.length, 0); assert.equal(f.published.length, 1);
  assert.equal(f.activity[0][2], "Commande partiellement exécutée"); assert.equal(f.activity[0][4].partial, true);
});

test("secteur gagnant de roue : un groupe partiel différé rend compte des seuls effets réussis", async () => {
  const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "wheel1" });
  f.state.rules[0].actions.push({ id: "other", type: "audio.play", config: { url: "missing.mp3" } },
    { id: "group", type: "action.group", config: { actionIds: ["sound", "other"] } });
  f.state.settings.overlayConfigs.wheel.wheels = [{ id: "wheel1", enabled: true,
    segments: [{ label: "Groupe", actionId: "group" }, { label: "Groupe aussi", actionId: "group" }] }];
  const timers = [], outcomes = [];
  f.actionRunner.wheelActions.setTimeoutImpl = (callback) => { timers.push(callback); return { unref() {} }; };
  f.actionRunner.notifyRenderer = (_channel, payload) => {
    if (payload.url === "missing.mp3") throw new Error("Erreur fournisseur avec secret à ne pas journaliser");
    f.calls.push(payload);
  };
  await f.executor.execute(f.state.commands[0], f.event(), { onDeferredActionResult: (value) => outcomes.push(value) });
  timers[0]();
  for (let index = 0; index < 12; index++) await Promise.resolve();
  assert.equal(f.calls.length, 1); assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].reason, "COMMAND_WHEEL_EFFECT_PARTIAL"); assert.equal(outcomes[0].partial, true);
  assert.equal(outcomes[0].executed, true); assert.doesNotMatch(JSON.stringify(outcomes), /fournisseur|secret/);
});

test("roue occupée : journal mise en file, jamais un effet exécuté ; file des commandes bornée", async () => {
  const f = fixture({ type: "overlay", overlayKey: "wheel", operation: "spin" });
  f.actionRunner.wheelActions.wheelSpinActive = true;
  for (let index = 0; index < 51; index++) { f.service.handleChat(f.event()); await f.service.whenIdle(); }
  assert.equal(f.published.length, 0); assert.equal(f.actionRunner.wheelActions.wheelSpinQueue.length, 50);
  assert.equal(f.activity[0][2], "Commande mise en file"); assert.equal(f.activity[0][0], "info");
  assert.equal(f.activity[0][4].executed, false); assert.equal(f.activity[0][4].queued, true);
  assert.equal(f.activity.at(-1)[2], "Commande non exécutée");
});

test("groupe partiellement exécuté : journal warning et nombres distincts, aucun succès complet fictif", async () => {
  const f = fixture({ type: "action", actionId: "group" });
  f.state.rules[0].actions.push({ id: "other", type: "audio.play", config: { url: "missing.mp3" } },
    { id: "group", type: "action.group", config: { actionIds: ["sound", "other"] } });
  f.actionRunner.notifyRenderer = (_channel, payload) => { if (payload.url === "missing.mp3") throw new Error("Simulé indisponible"); f.calls.push(payload); };
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.activity[0][2], "Commande partiellement exécutée");
  assert.equal(f.activity[0][0], "warning"); assert.equal(f.activity[0][4].partial, true);
  assert.equal(f.activity[0][4].executedCount, 1); assert.equal(f.activity[0][4].failedCount, 1);
  assert.equal(f.activity[0][4].requestedCount, 2); assert.equal(f.activity[0][4].selectedCount, 2);
});

test("un groupe imbriqué partiel propage son avertissement et ses compteurs feuilles", async () => {
  const f = fixture({ type: "action", actionId: "outer" });
  f.state.rules[0].actions.push({ id: "bad", type: "audio.play", config: { url: "missing.mp3" } },
    { id: "inner", type: "action.group", config: { actionIds: ["sound", "bad"] } },
    { id: "outer", type: "action.group", config: { actionIds: ["inner"] } });
  f.actionRunner.notifyRenderer = (_channel, payload) => { if (payload.url === "missing.mp3") throw new Error("Erreur simulée"); f.calls.push(payload); };
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.activity[0][2], "Commande partiellement exécutée"); assert.equal(f.activity[0][0], "warning");
  assert.equal(f.activity[0][4].partial, true); assert.equal(f.activity[0][4].executedCount, 1);
  assert.equal(f.activity[0][4].failedCount, 1); assert.equal(f.activity[0][4].requestedCount, 2);
});

test("groupe imbriqué avec roue en attente : file seule ou partielle selon les effets déjà exécutés", async () => {
  for (const withSound of [false, true]) {
    const f = fixture({ type: "action", actionId: "outer" });
    f.state.rules[0].actions.push({ id: "spin", type: "wheel.spin", config: {} },
      { id: "inner", type: "action.group", config: { actionIds: ["spin"] } },
      { id: "outer", type: "action.group", config: { actionIds: withSound ? ["inner", "sound"] : ["inner"] } });
    f.actionRunner.wheelActions.wheelSpinActive = true;
    f.service.handleChat(f.event()); await f.service.whenIdle();
    assert.equal(f.activity[0][4].queued, true); assert.equal(f.activity[0][4].queuedCount, 1);
    assert.equal(f.activity[0][4].executedCount, withSound ? 1 : 0); assert.equal(f.activity[0][4].failedCount, 0);
    assert.equal(f.activity[0][4].executed, withSound);
    assert.equal(f.activity[0][2], withSound ? "Commande partiellement exécutée" : "Commande mise en file");
    assert.equal(f.activity[0][0], withSound ? "warning" : "info");
    assert.equal(f.calls.length, withSound ? 1 : 0); assert.equal(f.published.length, 0);
  }
});

test("échec complet d'un groupe imbriqué : zéro effet exécuté et erreurs feuilles conservées", async () => {
  const f = fixture({ type: "action", actionId: "outer" });
  f.state.rules[0].actions.push({ id: "bad", type: "audio.play", config: { url: "missing.mp3" } },
    { id: "inner", type: "action.group", config: { actionIds: ["sound", "bad"] } },
    { id: "outer", type: "action.group", config: { actionIds: ["inner"] } });
  f.actionRunner.notifyRenderer = () => { throw new Error("Erreur simulée"); };
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.activity[0][2], "Commande non exécutée"); assert.equal(f.activity[0][4].executed, false);
  assert.equal(f.activity[0][4].executedCount, 0); assert.equal(f.activity[0][4].failedCount, 2);
});

test("groupe de commandes : les actions du jeu actif sont résolues comme au préflight, puis refusées hors session", async () => {
  const f = fixture({ type: "action", actionId: "group" });
  f.state.rules[0].actions.push({ id: "group", type: "action.group", config: { actionIds: ["game-sound"] } });
  f.state.session.game = { running: true, profileId: "p1", packId: "fixture-game" };
  f.state.game = { interactionRulesByPack: { "fixture-game": [{ id: "game-rule", enabled: true,
    actions: [{ id: "game-sound", type: "audio.play", config: { url: "game.mp3" } }] }] } };
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.calls.length, 1); assert.equal(f.activity[0][4].executedCount, 1); assert.equal(f.activity[0][4].failedCount, 0);
  f.state.session.game.running = false;
  f.service.handleChat(f.event()); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
  assert.equal(f.activity.at(-1)[4].executed, false);
});

test("IRL : une annulation pendant découverte n'actionne aucune prise et ne mémorise aucun appareil", async () => {
  const f = fixture(); let allowed = true; const writes = [];
  f.state.settings.account.email = "alexandre.leuridan@gmail.com"; f.state.settings.account.emailVerified = true;
  f.state.settings.irl = { enabled: true, devices: [{ id: "shellyplusplugs-aabbcc", host: "192.168.1.42", generation: 2, model: "Shelly Plus Plug S", channel: 0 }] };
  f.store.mutate = () => { throw new Error("Aucune mutation après annulation."); };
  const service = new ShellyService({ store: f.store, fetchImpl: async (url, options = {}) => {
    if (options.method === "POST") writes.push(url);
    if (url.endsWith("/shelly")) return new Response(JSON.stringify({ id: "shellyplusplugs-aabbcc", model: "SNPL-00112EU", gen: 2 }));
    allowed = false; return new Response(JSON.stringify({ "switch:0": { output: false } }));
  }, mdnsDiscoverer: async () => [], delayImpl: async () => {} });
  await assert.rejects(service.control({ deviceId: "shellyplusplugs-aabbcc", operation: "on" }, { shouldExecute: () => allowed }), { code: "COMMAND_CONTEXT_CHANGED" });
  assert.equal(writes.length, 0);
});

test("IRL : une impulsion déjà commencée est toujours éteinte sur la prise capturée après annulation", async () => {
  const f = fixture(); let allowed = true; const writes = [];
  f.state.settings.account.email = "alexandre.leuridan@gmail.com"; f.state.settings.account.emailVerified = true;
  f.state.settings.irl = { enabled: true, devices: [{ id: "shellyplusplugs-aabbcc", host: "192.168.1.42", generation: 2, model: "Shelly Plus Plug S", channel: 0 }] };
  f.store.mutate = () => { throw new Error("Aucune mémorisation dans un autre profil."); };
  const service = new ShellyService({ store: f.store, fetchImpl: async (url, options = {}) => {
    if (options.method === "POST") writes.push({ url, body: JSON.parse(options.body) });
    if (url.endsWith("/shelly")) return new Response(JSON.stringify({ id: "shellyplusplugs-aabbcc", model: "SNPL-00112EU", gen: 2 }));
    return new Response(JSON.stringify({ "switch:0": { output: false } }));
  }, mdnsDiscoverer: async () => [], delayImpl: async () => { allowed = false; f.state.settings.irl.devices = []; } });
  await service.control({ deviceId: "shellyplusplugs-aabbcc", operation: "pulse", durationMs: 500 }, { shouldExecute: () => allowed });
  assert.equal(writes.length, 2); assert.equal(writes[0].body.on, true); assert.equal(writes[1].body.on, false);
  assert.equal(writes[1].url.startsWith("http://192.168.1.42/"), true);
});

test("Spotify : changement de contexte pendant recherche, résolution d'appareil ou OAuth empêche les HTTP d'écriture", async (t) => {
  for (const waitAt of ["search", "devices", "oauth"]) {
    const f = fixture(); let allowed = true; const writes = [];
    const secrets = { access: "fixture-access", refresh: "fixture-refresh" };
    f.state.settings.spotify = { refreshTokenSecretId: "refresh", accessTokenSecretId: "access", expiresAt: waitAt === "oauth" ? 0 : Date.now() + 120000,
      account: { product: "premium" } };
    f.store.getSecret = (id) => secrets[id] || "fixture-account";
    f.store.set = (path, value) => { if (path === "settings.spotify") f.state.settings.spotify = value; };
    f.store.setSecret = (id, value) => { secrets[id] = value; return id; };
    const service = new SpotifyService({ store: f.store, notifyRenderer() {} });
    t.mock.method(globalThis, "fetch", async (url, options = {}) => {
      if (url.includes("/api/token")) {
        if (waitAt === "oauth") allowed = false;
        return new Response(JSON.stringify({ access_token: "new-token", refresh_token: "new-refresh", expires_in: 3600 }), { status: 200 });
      }
      if (options.method && options.method !== "GET") writes.push(url);
      let data = {};
      if (url.includes("/search?")) { if (waitAt === "search") allowed = false; data = { tracks: { items: [{ uri: "spotify:track:4uLU6hMCjMI75M1A2tKUQC" }] } }; }
      else if (url.endsWith("/devices")) { if (waitAt === "devices") allowed = false; data = { devices: [{ id: "pc", is_active: true }] }; }
      else if (url.endsWith("/me")) data = { id: "fixture-spotify", product: "premium" };
      return new Response(JSON.stringify(data), { status: 200 });
    });
    await assert.rejects(service.control({ operation: "queue", query: "Titre" }, { shouldExecute: () => allowed }), { code: "COMMAND_CONTEXT_CHANGED" });
    assert.equal(writes.length, 0, waitAt);
    t.mock.restoreAll();
  }
});
