"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ChatbotService, MAX_COOLDOWN_ENTRIES, TIMER_TICK_MS, MAX_PENDING_DELIVERIES } = require("../src/main/chatbot-service");

function fixture(overrides = {}) {
  let now = 1000;
  const state = { commands: [{ id: "hello", command: "!hello", response: "Bonjour {{user.displayName}}", enabled: true, cooldownMs: 10000 }],
    connections: [{ id: "source_kick", type: "kick-native", status: "connected", enabled: true }],
    settings: { account: { uid: "owner", email: "owner@example.com", refreshTokenSecretId: "account-token" }, siteVisibility: {}, kick: { live: true }, tiktok: { status: "offline" } },
    session: { running: true, profileId: "profile-1", startedAt: "2026-01-01" },
    commerce: { subscription: { tier: "pro", status: "active" } }, ...overrides };
  const sent = [], published = [], activity = [], changes = [], intervals = new Map();
  const store = { getState: () => state, getSecret: (key) => key === "account-token" ? "fixture-token" : "" };
  const sourceHub = { runtimes: new Map([["source_kick", { closed: false, send: () => {} }]]),
    send: async (source, payload) => { sent.push({ source, payload }); return { sent: true }; } };
  const service = new ChatbotService({ store, sourceHub, overlayServer: { publish: (channel, payload) => published.push({ channel, payload }) },
    onActivity: (...args) => activity.push(args), onChanged: (deferred) => changes.push(deferred), now: () => now,
    setIntervalFn: (callback, interval) => { const handle = { unref: () => {} }; intervals.set(handle, { callback, interval }); return handle; },
    clearIntervalFn: (handle) => intervals.delete(handle) });
  const event = (message = "!hello", user = {}) => ({ type: "chat", source: "source_kick", user: { id: "lou", name: "lou", displayName: "Lou", ...user }, data: { message } });
  return { state, store, sourceHub, service, sent, published, activity, changes, intervals, event, advance: (ms) => { now += ms; } };
}

test("réponse réelle Kick via transport existant, variables et journal privé par profil", async () => {
  const { service, event, sent, activity, published } = fixture();
  const result = await service.handleChat(event());
  assert.equal(result.queued, true);
  await service.whenIdle();
  assert.deepEqual(sent, [{ source: "source_kick", payload: { message: "Bonjour Lou" } }]);
  assert.equal(published.length, 0);
  assert.equal(activity[0][2], "Réponse ChatBot envoyée");
  assert.deepEqual(activity[0][4], { profileId: "profile-1", commandId: "hello", source: "source_kick", platform: "kick", sent: true });
});

test("ChatBot distingue un transfert WebSocket d'une réponse confirmée par la plateforme", async () => {
  const f = fixture();
  f.sourceHub.send = async () => ({ sent: true, forwarded: true, acknowledged: false, confirmation: "socket" });
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.activity[0][4].sent, false);
  assert.equal(f.activity[0][4].forwarded, true);
  assert.equal(f.activity[0][2], "Réponse ChatBot transférée — confirmation indisponible");
  assert.equal(f.published.length, 0);
});

test("ChatBot TikTok autorisé utilise la capacité dynamique et filtre le compte expéditeur", async () => {
  const f = fixture();
  f.state.connections[0].id = "source_tiktok"; f.state.connections[0].type = "tiktok-direct";
  f.state.settings.tiktok = { status: "live", chat: { botUsername: "ShenPulseBot" } };
  f.sourceHub.runtimes = new Map([["source_tiktok", { send: () => {}, closed: false }]]);
  f.sourceHub.getChatCapabilities = () => ({ canSend: true });
  f.state.commands[0].kind = "auto-reply"; f.state.commands[0].matchText = "bonjour";
  assert.equal(f.service.handleChat({ ...f.event("bonjour", { name: "shenpulsebot" }), source: "source_tiktok" }), null);
  f.service.handleChat({ ...f.event("bonjour"), source: "source_tiktok" }); await f.service.whenIdle();
  assert.equal(f.sent.length, 1); assert.equal(f.activity[0][4].sent, true);
});

test("ChatBot ne journalise pas une confirmation tardive dans un transport remplacé", async () => {
  const f = fixture();
  f.sourceHub.send = async () => ({ sent: true, acknowledged: true, stale: true });
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.activity.length, 0); assert.equal(f.published.length, 0);
});

test("ChatBot ne transforme jamais une résolution vide en envoi réussi", async () => {
  const f = fixture(); f.sourceHub.send = async () => undefined;
  f.service.handleChat(f.event()); await f.service.whenIdle();
  assert.equal(f.activity[0][4].sent, false);
  assert.equal(f.activity[0][2], "Réponse ChatBot locale — non envoyée");
});

test("TikTok direct : réponse locale visible, jamais un faux envoi au chat ou overlay promis", async () => {
  const { state, service, event, sent, activity, published, sourceHub } = fixture();
  state.connections[0].type = "tiktok-direct";
  state.connections[0].id = "source_tiktok";
  state.settings.tiktok.status = "live";
  sourceHub.runtimes = new Map([["source_tiktok", { closed: false }]]);
  const result = await service.handleChat({ ...event(), source: "source_tiktok" });
  assert.equal(result.queued, true);
  await service.whenIdle();
  assert.equal(sent.length, 0);
  assert.equal(activity[0][2], "Réponse ChatBot locale — non envoyée");
  assert.equal(activity[0][3], "Bonjour Lou");
  assert.equal(published[0].channel, "chatbot");
  assert.equal(published[0].payload.sent, false);
});

test("échec asynchrone Kick attendu puis réponse locale, sans rejet non géré", async () => {
  const { service, sourceHub, event, activity } = fixture();
  sourceHub.send = async () => { throw new Error("API indisponible"); };
  const result = await service.handleChat(event());
  assert.equal(result.queued, true);
  await service.whenIdle();
  assert.equal(activity[0][3], "Bonjour Lou");
});

test("aucune réponse hors LIVE, invité, source déconnectée/désactivée, démo ou événement de test", async () => {
  for (const mutate of [
    (f) => { f.state.session.running = false; },
    (f) => { f.state.settings.account = {}; },
    (f) => { f.state.connections[0].status = "disconnected"; },
    (f) => { f.state.connections[0].enabled = false; },
    (f) => { f.state.settings.siteVisibility.navigation = { commands: { scope: "hidden" } }; },
    (f) => { f.state.settings.siteVisibility.actionTypes = { "chat:reply": { scope: "admin" } }; }
  ]) {
    const f = fixture(); mutate(f);
    assert.equal(await f.service.handleChat(f.event()), null);
    assert.equal(f.sent.length, 0);
    assert.equal(f.activity.length, 0);
  }
  const f = fixture();
  assert.equal(await f.service.handleChat({ ...f.event(), test: true }), null);
  assert.equal(await f.service.handleChat({ ...f.event(), source: "source_demo" }), null);
  assert.equal(await f.service.handleChat({ ...f.event(), source: "manual-preview" }), null);
  assert.equal(f.sent.length, 0);
});

test("alias exacts et rôle protègent la réponse ; une seule auto-réponse est envoyée", async () => {
  const f = fixture();
  f.state.commands[0] = { ...f.state.commands[0], aliases: ["!bonjour"], audience: "moderator" };
  assert.equal(await f.service.handleChat(f.event("!helloworld", { moderator: true })), null);
  assert.equal(await f.service.handleChat(f.event("!bonjour")), null);
  assert.equal((await f.service.handleChat(f.event("!bonjour", { moderator: true }))).queued, true);
  await f.service.whenIdle();
  f.state.commands = [
    { id: "one", kind: "auto-reply", matchText: "discord", response: "Premier", enabled: true },
    { id: "two", kind: "auto-reply", matchText: "discord", response: "Deuxième", enabled: true }
  ];
  await f.service.handleChat(f.event("où est ton discord ?"));
  await f.service.whenIdle();
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[1].payload.message, "Premier");
});

test("cooldown viewer et global distincts, isolés par source et profil", async () => {
  const f = fixture();
  f.state.commands[0].globalCooldownMs = 2000;
  await f.service.handleChat(f.event());
  assert.equal(await f.service.handleChat(f.event("!hello", { id: "second" })), null);
  f.advance(2000);
  assert.equal((await f.service.handleChat(f.event("!hello", { id: "second" }))).queued, true);
  f.advance(2000);
  assert.equal(await f.service.handleChat(f.event()), null);
  f.state.session.profileId = "profile-2";
  assert.equal((await f.service.handleChat(f.event())).queued, true);
  f.state.connections.push({ id: "source_kick_other", type: "kick-native", status: "connected", enabled: true });
  f.sourceHub.runtimes.set("source_kick_other", { send: () => {} });
  assert.equal((await f.service.handleChat({ ...f.event(), source: "source_kick_other" })).queued, true);
  await f.service.whenIdle();
});

test("cooldowns bornés en mémoire et valeurs historiques finies conservées", async () => {
  const f = fixture();
  f.state.commands[0].cooldownMs = 7200000;
  for (let index = 0; index < MAX_COOLDOWN_ENTRIES + 10; index += 1) {
    f.service.handleChat(f.event("!hello", { id: `user-${index}` })); await f.service.whenIdle();
  }
  await f.service.whenIdle();
  assert.equal(f.service.cooldowns.size, MAX_COOLDOWN_ENTRIES);
  f.advance(3600001);
  assert.equal(await f.service.handleChat(f.event("!hello", { id: `user-${MAX_COOLDOWN_ENTRIES}` })), null);
  f.service.reset();
  assert.equal(f.service.cooldowns.size, 0);
});

test("un seul scheduler pour plusieurs timers, zéro envoi avant leur première échéance", async () => {
  const f = fixture();
  f.state.commands = [1, 2].map((index) => ({ id: `timer-${index}`, kind: "timer", response: `Timer ${index}`, intervalMs: 60000, enabled: true }));
  f.service.syncTimers();
  f.service.syncTimers();
  assert.equal(f.intervals.size, 1);
  assert.equal([...f.intervals.values()][0].interval, TIMER_TICK_MS);
  assert.equal(f.service.timerJobs.size, 2);
  f.advance(59999);
  await f.service.tick();
  assert.equal(f.sent.length, 0);
  f.advance(1);
  await f.service.tick();
  await f.service.whenIdle();
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].payload.message, "Timer 1");
  await f.service.tick();
  await f.service.whenIdle();
  assert.equal(f.sent.length, 2);
  f.service.reset();
  assert.equal(f.intervals.size, 0);
});

test("timers inexistants, inactifs, trop courts ou TikTok direct ne créent aucun polling ni journal", async () => {
  for (const mutate of [
    (f) => { f.state.commands = []; },
    (f) => { f.state.commands[0].enabled = false; },
    (f) => { f.state.commands[0].intervalMs = 1000; },
    (f) => { f.state.session.running = false; },
    (f) => { f.state.settings.account = {}; },
    (f) => { f.sourceHub.runtimes.clear(); },
    (f) => { f.state.connections[0] = { id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected" }; f.state.settings.tiktok.status = "live"; f.sourceHub.runtimes.set("source_tiktok", {}); }
  ]) {
    const f = fixture();
    f.state.commands = [{ id: "timer", kind: "timer", response: "Bonjour", intervalMs: 60000, enabled: true }];
    mutate(f);
    f.service.syncTimers(); f.advance(3600000); await f.service.tick();
    assert.equal(f.intervals.size, 0);
    assert.equal(f.sent.length, 0);
    assert.equal(f.activity.length, 0);
  }
});

test("pause et reprise ne rattrapent pas en rafale le temps hors ligne", async () => {
  const f = fixture();
  f.state.commands = [{ id: "timer", kind: "timer", response: "Un message", intervalMs: 60000, enabled: true }];
  f.service.syncTimers();
  f.advance(3600000);
  await f.service.tick();
  await f.service.whenIdle();
  await f.service.tick();
  assert.equal(f.sent.length, 1);
  f.state.session.running = false;
  f.service.syncTimers();
  assert.equal(f.intervals.size, 0);
  assert.equal(f.service.timerJobs.size, 0);
  f.state.session.running = true;
  f.service.syncTimers();
  await f.service.tick();
  assert.equal(f.sent.length, 1);
  f.advance(60000); await f.service.tick(); await f.service.whenIdle();
  assert.equal(f.sent.length, 2);
  f.service.reset();
});

test("changement de profil pendant un envoi empêche les jobs suivants et le journal dans le nouveau profil", async () => {
  const f = fixture();
  f.state.commands = [1, 2].map((index) => ({ id: `timer-${index}`, kind: "timer", response: `Timer ${index}`, intervalMs: 60000, enabled: true }));
  f.service.syncTimers(); f.advance(60000);
  f.sourceHub.send = async (source, payload) => {
    f.sent.push({ source, payload });
    f.state.session.profileId = "profile-2";
    f.service.reset();
  };
  await f.service.tick();
  await f.service.whenIdle();
  assert.equal(f.sent.length, 1);
  assert.equal(f.activity.length, 0);
  assert.equal(f.intervals.size, 0);
});

test("délivrance revalide profil, source et suppression avant l'envoi, même avec ancien état capturé", async () => {
  for (const mutate of [
    (f) => { f.state.session.profileId = "profile-2"; },
    (f) => { f.state.connections[0].status = "disconnected"; },
    (f) => { f.state.commands = []; },
    (f) => { f.state.commands[0].response = "Nouvelle réponse"; }
  ]) {
    const f = fixture();
    const state = f.service.state();
    mutate(f);
    const result = await f.service.deliver(state.commands[0], { ...f.event(), type: "timer" }, "Bonjour Lou", state, { timer: true });
    assert.equal(result.cancelled, true);
    assert.equal(f.sent.length, 0);
  }
});

test("filtres de plateforme des timers et arrêt du dernier timer nettoient immédiatement le scheduler", () => {
  const f = fixture();
  f.state.commands = [{ id: "timer", kind: "timer", response: "Bonjour", intervalMs: 60000, enabled: true, platform: "tiktok" }];
  f.service.syncTimers();
  assert.equal(f.intervals.size, 0);
  f.state.commands[0].platform = "kick";
  f.service.syncTimers();
  assert.equal(f.intervals.size, 1);
  f.state.commands[0].enabled = false;
  f.service.syncTimers();
  assert.equal(f.intervals.size, 0);
});

test("une horloge déjà en cours ne déclenche pas de requêtes concurrentes", async () => {
  const f = fixture();
  f.state.commands = [{ id: "timer", kind: "timer", response: "Bonjour", intervalMs: 60000, enabled: true }];
  let release;
  f.sourceHub.send = () => new Promise((resolve) => { release = resolve; f.sent.push({ source: "source_kick" }); });
  f.service.syncTimers(); f.advance(60000);
  const first = f.service.tick();
  await f.service.tick();
  assert.equal(f.sent.length, 1);
  release({ sent: true }); await first;
  await f.service.whenIdle();
  f.service.reset();
});

test("envoi réseau lent découplé du chat, file bornée et vidée à la suspension", async () => {
  const f = fixture();
  f.state.commands[0].cooldownMs = 0;
  let release;
  f.sourceHub.send = () => new Promise((resolve) => { release = resolve; f.sent.push({ source: "source_kick" }); });
  for (let index = 0; index < MAX_PENDING_DELIVERIES + 10; index += 1) {
    const result = f.service.handleChat(f.event("!hello", { id: `user-${index}` }));
    assert.equal(result instanceof Promise, false, "le chat doit pouvoir continuer sans attendre l’API");
  }
  assert.equal(f.sent.length, 1, "un seul envoi concurrent par source");
  assert.equal(f.service.pendingDeliveries.length + f.service.activeDeliveries.size, MAX_PENDING_DELIVERIES);
  f.service.reset();
  assert.equal(f.service.pendingDeliveries.length, 0);
  release({ sent: true }); await f.service.whenIdle();
  assert.equal(f.sent.length, 1);
  assert.equal(f.activity.length, 0);
});

test("auto-réponses ne répondent pas aux propres messages connus Kick/Twitch/relais", async () => {
  for (const type of ["kick-native", "twitch-irc", "tiktok-relay"]) {
    const f = fixture();
    f.state.commands = [{ id: "auto", kind: "auto-reply", matchText: "bonjour", response: "bonjour", enabled: true, cooldownMs: 0 }];
    f.state.connections[0].type = type;
    f.state.connections[0].liveStatus = "live";
    f.state.connections[0].config = { username: "ShenPulseBot", botUsername: "ShenPulseBot" };
    f.state.settings.kick.account = { id: "bot-123" };
    assert.equal(f.service.handleChat(f.event("bonjour", { id: "bot-123", name: "shenpulsebot" })), null);
    assert.equal(f.sent.length, 0);
    assert.equal(f.service.handleChat(f.event("bonjour"))?.queued, true);
    await f.service.whenIdle();
    assert.equal(f.sent.length, 1);
  }
});

test("variables de viewer vides dans un timer ne créent pas de message vide", async () => {
  const f = fixture();
  f.state.commands = [{ id: "timer", kind: "timer", response: "{{args}}{{user.name}}", intervalMs: 60000, enabled: true }];
  f.service.syncTimers(); f.advance(60000); await f.service.tick(); await f.service.whenIdle();
  assert.equal(f.sent.length, 0);
  assert.equal(f.activity.length, 0);
  f.service.reset();
});

test("timers équitables : les plus anciennes échéances passent avant les premières entrées déjà envoyées", async () => {
  const f = fixture();
  f.state.commands = Array.from({ length: 14 }, (_, index) => ({ id: `timer-${index}`, kind: "timer", response: `Timer ${index}`, intervalMs: 60000, enabled: true }));
  f.service.syncTimers(); f.advance(60000);
  for (let index = 0; index < 14; index += 1) { await f.service.tick(); await f.service.whenIdle(); f.advance(5000); }
  assert.equal(new Set(f.sent.map((entry) => entry.payload.message)).size, 14);
  f.service.reset();
});

test("rotation des messages et minimum de chat empêchent les timers dans un LIVE silencieux", async () => {
  const f = fixture();
  f.state.commands = [{ id: "timer", kind: "timer", response: "Un", messages: ["Un", "Deux"], intervalMs: 60000, minChatMessages: 2, enabled: true }];
  f.state.settings.kick.account = { id: "bot" };
  f.service.syncTimers(); f.advance(60000); await f.service.tick(); await f.service.whenIdle();
  assert.equal(f.sent.length, 0);
  f.service.handleChat(f.event("un commentaire", { id: "bot" }));
  assert.equal(f.service.chatCounts.get("source_kick") || 0, 0);
  for (let index = 0; index < 3; index += 1) {
    f.service.handleChat(f.event("un commentaire")); f.service.handleChat(f.event("un autre commentaire"));
    await f.service.tick(); await f.service.whenIdle();
    assert.equal(f.service.chatCounts.get("source_kick"), 0);
    f.advance(60000); await f.service.tick(); await f.service.whenIdle();
    assert.equal(f.sent.length, index + 1, "aucune nouvelle rotation sans messages dans le chat");
  }
  assert.deepEqual(f.sent.map((entry) => entry.payload.message), ["Un", "Deux", "Un"]);
  f.service.reset();
});

test("compteur de chat et rotation sont remis à zéro au changement de profil", async () => {
  const f = fixture();
  f.state.commands = [{ id: "timer", kind: "timer", response: "Un", messages: ["Un", "Deux"], intervalMs: 60000, minChatMessages: 1, enabled: true }];
  f.service.syncTimers(); f.service.handleChat(f.event("bonjour"));
  f.state.session.profileId = "profile-2";
  f.service.syncTimers(); f.advance(60000); await f.service.tick(); await f.service.whenIdle();
  assert.equal(f.sent.length, 0);
  f.service.handleChat(f.event("nouveau commentaire")); await f.service.tick(); await f.service.whenIdle();
  assert.equal(f.sent[0].payload.message, "Un");
  f.service.reset(); assert.equal(f.service.chatCounts.size, 0);
});

test("commentaires reçus pendant l'envoi d'un timer restent comptés pour le suivant", async () => {
  const f = fixture();
  f.state.commands = [{ id: "timer", kind: "timer", response: "Un", intervalMs: 60000, minChatMessages: 2, enabled: true }];
  let release;
  f.sourceHub.send = () => new Promise((resolve) => { release = resolve; f.sent.push({ source: "source_kick" }); });
  f.service.syncTimers(); f.service.handleChat(f.event("un")); f.service.handleChat(f.event("deux"));
  f.advance(60000); await f.service.tick(); f.service.handleChat(f.event("trois"));
  release({ sent: true }); await f.service.whenIdle();
  assert.equal(f.service.chatCounts.get("source_kick"), 1);
  f.service.reset();
});

test("resynchroniser les sources sans timer n'invalide pas le journal d'une commande réseau en cours", async () => {
  const f = fixture();
  let release;
  f.sourceHub.send = () => new Promise((resolve) => { release = resolve; f.sent.push({ source: "source_kick" }); });
  f.service.handleChat(f.event());
  const generation = f.service.generation;
  f.service.syncTimers(); f.service.syncTimers();
  assert.equal(f.service.generation, generation);
  release({ sent: true }); await f.service.whenIdle();
  assert.equal(f.activity.length, 1);
  assert.equal(f.activity[0][4].sent, true);
});
