"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeTikTokBattle, tiktokBattleEventKind } = require("../src/main/matches/tiktok-battle");
const { normalizeMatchesConfig, normalizeMatchAutomation, createMatchSession } = require("../src/shared/matches-contract");
const { selectStatePaths } = require("../src/main/state-projection");
const { ActionRunner } = require("../src/main/action-runner");
const { StateStore } = require("../src/main/store");
const { projectMatchesOverlayState, projectMatchesOverlayPayload } = require("../src/main/matches-overlay-state");
const { tiktokRoomLiveMetadata } = require("../src/main/sources/tiktok-protocol");

function fixture() {
  let now = 1790000000000;
  const state = { settings: { account: { uid: "fixture", email: "fixture@example.test", refreshTokenSecretId: "account" }, siteVisibility: {},
    tiktok: { username: "creator", broadcaster: { username: "creator", userId: "1" }, status: "live", roomId: "room" }, matches: normalizeMatchesConfig(), overlayConfigs: { wheel: { wheels: [] } } },
    session: { running: true, profileId: "p", startedAt: "fixture" }, commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: createMatchSession(), rules: [{ id: "r", enabled: true, actions: [{ id: "sound", type: "audio.play", config: { url: "https://cdn.example.test/son.mp3" } }] }],
    profiles: [{ id: "p", enabledRuleIds: ["r"] }] };
  const projections = [], calls = [], activities = [], published = [], timers = new Map();
  const store = { getState: () => { throw new Error("Pas de copie complète sur le flux Matchs."); },
    getStateProjection: (paths) => { projections.push(paths); return selectStatePaths(state, paths); },
    getAccountSession: () => state.settings.account, getSecret: () => "fixture-only-secret",
    mutateRuntime: (callback) => callback(state), mutate: (callback) => callback(state) };
  const actionRunner = new ActionRunner({ store, notifyRenderer: (...args) => calls.push(args),
    overlayServer: { publish() {}, playMatch: async (config) => { calls.push(config); return { played: true }; } }, gameHub: { assertAccess() {} } });
  const service = new MatchesService({ store, actionRunner, now: () => now, overlayServer: { publish: (...args) => published.push(args) },
    onActivity: (...args) => activities.push(args), setTimeoutImpl: (callback, delay) => {
      const timer = { callback, at: now + delay, unref() {} }; timers.set(timer, timer); return timer;
    }, clearTimeoutImpl: (timer) => timers.delete(timer) });
  const frame = (phase = "start", scores = [10, 20], extra = {}) => ({ phase, battleId: "battle", id: `${phase}-${now}-${Math.random()}`, roomId: "room", channelUsername: "creator",
    startsAtMs: now, endsAtMs: now + 120000, receivedAtMs: now, confirmedEnd: phase === "end", participants: [
      { id: "1", username: "creator", displayName: "Créateur", score: scores[0], donors: [] },
      { id: "2", username: "rival", displayName: "Rival", score: scores[1], donors: [] }
    ], ...extra });
  const save = (moment, extra = {}) => service.saveAutomation({ id: moment, name: moment, moment, enabled: true,
    reaction: { type: "sound", url: "https://cdn.example.test/son.mp3" }, ...extra });
  const advance = async (ms) => { now += ms; for (const timer of [...timers.keys()]) if (timer.at <= now) { timers.delete(timer); timer.callback(); } await service.whenIdle(); };
  const earn = (multiplier, startsAtMs = now, durationMs = 5000, extra = {}) => {
    service.handle(frame("task", [10, 20], { startsAtMs: 0, endsAtMs: 0, ...extra,
      bonus: { stage: "announced", multiplier, startsAtMs, durationMs, result: "unknown", periodKey: "" } }));
    service.handle(frame("task", [10, 20], { startsAtMs: 0, endsAtMs: 0, ...extra,
      bonus: { stage: "settled", multiplier: null, startsAtMs, durationMs: 0, result: "success", periodKey: "" } }));
  };
  return { state, store, service, calls, activities, published, projections, timers, frame, save, advance, earn, now: () => now };
}

test("contrat Matchs fermé, widgets et automatismes éteints par défaut, valeurs bornées", () => {
  const config = normalizeMatchesConfig(); assert.equal(Object.keys(config.widgets).length, 7); assert.deepEqual(config.automations, []);
  assert.equal(Object.values(config.widgets).every((widget) => widget.enabled === false), true);
  assert.throws(() => normalizeMatchAutomation({ moment: "battleStart", reaction: { type: "media", mediaUrl: "javascript:alert(1)" } }));
  const item = normalizeMatchAutomation({ moment: "comeback", reaction: { type: "animation", match: "guantes" } });
  assert.equal(item.enabled, false); assert.equal(item.threshold, 1000);
});

test("le SDK normalise les vrais IDs, zéros, scores, armées et résultat WIN=0 sans carte inventée", () => {
  const data = { common: { msgId: "sdk" }, battleId: "battle", action: 5, battleSetting: { startTimeMs: "1790000000000", duration: 300 },
    anchorInfo: { 1: { user: { userId: "1", displayId: "creator", nickName: "Créateur" } } },
    armies: { 1: { anchorIdStr: "1", hostScore: "0", userArmy: [{ userId: "d", nickname: "Donateur", score: "12", diamondScore: "6" }] } },
    battleResult: { 1: { userId: "1", score: "0", result: 0 } } };
  const frame = normalizeTikTokBattle("linkMicBattle", data, { roomId: "room" });
  assert.equal(frame.phase, "end"); assert.equal(frame.participants[0].result, "win"); assert.equal(frame.participants[0].score, 0);
  assert.equal(frame.participants[0].donors[0].diamonds, 6); assert.equal(frame.endsAtMs, 1790000300000);
  assert.equal(normalizeTikTokBattle("linkMicBattleItemCard", data), null);
  assert.equal(normalizeTikTokBattle("linkMicBattle", { battleId: "0", action: 4 }), null);
});

test("BattleStatus=2 est uniquement la fin certifiée du SDK TriggerReason, les cartes restent indisponibles", () => {
  const frame = normalizeTikTokBattle("linkMicArmies", { battleId: "battle", battleStatus: 2, battleItems: { 1: { hostScore: "0" }, 2: { hostScore: "0" } } });
  assert.equal(frame.phase, "end"); assert.equal(frame.confirmedEnd, true);
  const f = fixture(); assert.throws(() => f.save("card"), /pas disponible/); assert.equal(f.state.settings.matches.automations.length, 0);
});

test("la durée supplémentaire du SDK prolonge le chrono mesuré, mais endTimeMs conserve la priorité", () => {
  const packet = { battleId: "battle", action: 4, battleSetting: { startTimeMs: "1790000000000", duration: 300, extraDurationSecond: "60" } };
  assert.equal(normalizeTikTokBattle("linkMicBattle", packet).endsAtMs, 1790000360000);
  packet.battleSetting.endTimeMs = "1790000350000";
  assert.equal(normalizeTikTokBattle("linkMicBattle", packet).endsAtMs, 1790000350000);
  delete packet.battleSetting.endTimeMs; packet.battleSetting.extraDurationSecond = "-10";
  assert.equal(normalizeTikTokBattle("linkMicBattle", packet).endsAtMs, 1790000300000);
});

test("les valeurs protobuf 0 n'effacent pas les IDs du setting ou des maps ; seuls les noms SDK sont reconnus", () => {
  const packet = { battleId: "0", action: 4, common: { roomId: "0", msgId: "0" },
    battleSetting: { battleId: "battle", startTimeMs: "1790000000000", duration: 300 },
    anchorInfo: { 1: { user: { userId: "0", displayId: "creator" } } },
    armies: { 1: { anchorIdStr: "0", hostScore: "0" } } };
  const frame = normalizeTikTokBattle("WebcastLinkMicBattle", packet, { roomId: "room" });
  assert.equal(frame.battleId, "battle"); assert.equal(frame.roomId, "room"); assert.equal(frame.id, "");
  assert.equal(frame.participants[0].id, "1"); assert.equal(frame.participants[0].score, 0);
  assert.equal(tiktokBattleEventKind("LINK_MIC_ARMIES"), "linkMicArmies");
  assert.equal(tiktokBattleEventKind("WebcastLinkmicBattleTaskMessage"), "linkMicBattleTask");
  assert.equal(tiktokBattleEventKind("battleStart"), ""); assert.equal(tiktokBattleEventKind("gift"), "");
});

test("la salle annoncée par le vrai paquet de match ne peut pas être écrasée par la salle du runtime", () => {
  assert.equal(normalizeTikTokBattle("linkMicBattle", { battleId: "battle", action: 4, common: { roomId: "old-room" } }, { roomId: "room" }), null);
  assert.equal(normalizeTikTokBattle("linkMicBattle", { battleId: "battle", action: 4, common: { roomId: "room" } }, { roomId: "room" }).roomId, "room");
});

test("le match plus récent rejoint en cours est détecté depuis ses scores sans inventer un début ni une victoire", async () => {
  const f = fixture(); f.save("battleStart"); f.save("victory"); f.save("lead"); f.save("comeback", { threshold: 1 });
  f.service.handle(f.frame()); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
  f.service.disconnect(); await f.advance(130000);
  const next = f.frame("update", [500, 300], { battleId: "next-battle", startsAtMs: f.now() - 10000 });
  assert.equal(f.service.handle(next), true); await f.service.whenIdle();
  assert.equal(f.state.matchSession.battleId, "next-battle"); assert.equal(f.state.matchSession.status, "running");
  assert.equal(f.state.matchSession.participants[0].score, 500); assert.equal(f.state.matchSession.session.battles, 2);
  assert.equal(f.state.matchSession.session.wins, 0); assert.equal(f.calls.length, 1);
});

test("un match récent après fin est repris, mais les anciens scores et OPEN retardés ne remplacent pas le match courant", async () => {
  const f = fixture(); f.service.handle(f.frame()); f.service.handle(f.frame("end", [20, 10]));
  const old = structuredClone(f.state.matchSession); await f.advance(130000);
  const next = f.frame("update", [40, 50], { battleId: "next-battle", startsAtMs: f.now() - 10000 });
  assert.equal(f.service.handle(next), true);
  assert.equal(f.service.handle(f.frame("update", [30, 10], { battleId: "battle", startsAtMs: old.startedAtMs })), false);
  assert.equal(f.service.handle(f.frame("start", [30, 10], { battleId: "unseen-old-battle", startsAtMs: old.startedAtMs })), false);
  assert.equal(f.service.handle(f.frame("update", [30, 10], { battleId: "unknown", startsAtMs: 0 })), false);
  assert.equal(f.service.handle(f.frame("update", [30, 10], { battleId: "expired", startsAtMs: f.now() - 5000, endsAtMs: f.now() - 1 })), false);
  assert.equal(f.state.matchSession.battleId, "next-battle"); assert.equal(f.state.matchSession.session.wins, 1);
});

test("les tâches seules, sources non canoniques et scores postérieurs à une fin ne créent pas de match fantôme", () => {
  const f = fixture(); assert.equal(f.service.handle(f.frame("task")), false);
  assert.equal(f.service.handle(f.frame("start", [10, 20], { source: "other-source" })), false);
  f.service.handle(f.frame()); f.service.handle(f.frame("end", [20, 10]));
  const completed = structuredClone(f.state.matchSession);
  assert.equal(f.service.handle(f.frame("update", [999, 10])), false);
  assert.equal(f.service.handle(f.frame("task", [999, 10], { multiplier: 3 })), false);
  assert.deepEqual(f.state.matchSession, completed);
});

test("début, passage devant, grande remontée configurable et victoire déclenchent une réaction unique", async () => {
  const f = fixture(); f.save("battleStart"); f.save("lead"); f.save("comeback", { threshold: 1000 }); f.save("victory");
  f.service.handle(f.frame("start", [10, 1500])); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
  f.service.handle(f.frame("update", [1600, 1500])); await f.service.whenIdle(); assert.equal(f.calls.length, 3);
  const end = f.frame("end", [1600, 1500]); f.service.handle(end); f.service.handle(end); await f.service.whenIdle();
  assert.equal(f.calls.length, 4); assert.equal(f.state.matchSession.session.wins, 1); assert.equal(f.state.matchSession.session.winStreak, 1);
  assert.equal(f.state.matchSession.history.length, 1); assert.deepEqual(f.state.matchSession.rounds, { own: 1, opponent: 0 });
});

test("un avantage d’un point ne constitue pas une grande remontée et un ID propriétaire connu remplace le @ absent", async () => {
  const f = fixture(); f.save("comeback", { threshold: 1000 }); f.service.handle(f.frame("start", [9, 10]));
  f.service.handle(f.frame("update", [11, 10])); await f.service.whenIdle(); assert.equal(f.calls.length, 0);
  const end = f.frame("end", [11, 10]); end.participants.forEach((entry) => { entry.username = ""; });
  f.state.matchSession.participants.forEach((entry) => { entry.username = ""; });
  f.service.handle(end); assert.equal(f.state.matchSession.ownUserId, "1"); assert.equal(f.state.matchSession.result, "win");
  const unknown = fixture(); unknown.state.settings.tiktok.broadcaster = {}; const unrecognized = unknown.frame("end");
  unrecognized.participants.forEach((entry) => { entry.username = ""; }); unknown.service.handle(unrecognized);
  assert.equal(unknown.state.matchSession.result, null); assert.equal(unknown.state.matchSession.session.wins, 0);
});

test("l'UID texte exact de room.owner identifie le streamer du match sans assouplir le garde d'identité", async () => {
  const f = fixture(), ownId = "1234567890123456789"; f.save("lead"); f.save("victory");
  f.state.settings.tiktok.broadcaster = tiktokRoomLiveMetadata({ data: { id_str: "room", owner: {
    id: Number(ownId), id_str: ownId, display_id: "creator"
  } } }, "creator", "room").broadcaster;
  const frame = (phase, scores) => {
    const input = f.frame(phase, scores); input.participants[0].id = ownId; return input;
  };
  f.service.handle(frame("start", [3, 6])); f.service.handle(frame("update", [7, 6])); await f.service.whenIdle();
  assert.equal(f.state.matchSession.ownUserId, ownId);
  assert.deepEqual(f.state.matchSession.participants.map((row) => row.own), [true, false]);
  f.service.handle(frame("end", [7, 6])); await f.service.whenIdle();
  assert.equal(f.state.matchSession.result, "win"); assert.equal(f.state.matchSession.session.wins, 1);
  assert.deepEqual(f.activities.map((entry) => entry[3]), ["lead", "victory"]);
});

test("égalité dans la dernière minute et snipe sont calculés sur le chronomètre mesuré, une fois par match", async () => {
  const f = fixture(); f.save("tieEnd"); f.save("snipe"); f.service.handle(f.frame("start", [10, 10]));
  await f.advance(60000); assert.equal(f.calls.length, 1); assert.equal(f.state.matchSession.status, "running");
  await f.advance(30000); assert.equal(f.calls.length, 2);
  f.service.reschedule(); await f.service.whenIdle(); assert.equal(f.calls.length, 2);
  assert.equal(f.state.matchSession.session.wins, 0);
});

test("multiplicateur fourni par TikTok se déclenche à sa date réelle, jamais pendant l’annonce anticipée", async () => {
  const f = fixture(); f.save("multiplierX2"); f.service.handle(f.frame());
  f.earn(2, f.now() + 10000);
  await f.service.whenIdle(); assert.equal(f.calls.length, 0); await f.advance(10000); assert.equal(f.calls.length, 1);
  assert.equal(f.state.matchSession.multiplier, 2);
});

test("le snipe n'attend aucun nouveau score TikTok, même si le dernier paquet date de plusieurs dizaines de secondes", async () => {
  const f = fixture(); f.save("snipe", { remainingSeconds: 15 });
  const startedAtMs = f.now(), endsAtMs = startedAtMs + 120000;
  f.service.handle(f.frame("start", [3, 6], { startsAtMs: startedAtMs, endsAtMs }));
  await f.advance(104999); assert.equal(f.calls.length, 0);
  assert.equal(f.state.matchSession.lastEventAtMs, startedAtMs);
  await f.advance(1); assert.equal(f.calls.length, 1);
  assert.equal(f.state.matchSession.lastEventAtMs, startedAtMs, "Aucun faux événement TikTok ne sert de battement d'horloge");
  await f.advance(10000); f.service.reschedule(); await f.service.whenIdle();
  assert.equal(f.calls.length, 1, "Le même snipe ne se rejoue pas après un score retardé");
});

test("les scores espacés ou fréquents ne repoussent jamais l'échéance fixe du snipe", async () => {
  const f = fixture(); f.save("snipe", { remainingSeconds: 15 });
  const startsAtMs = f.now(), endsAtMs = startsAtMs + 120000;
  f.service.handle(f.frame("start", [3, 6], { startsAtMs, endsAtMs }));
  for (const elapsed of [10000, 20000, 30000, 40000, 4999]) {
    await f.advance(elapsed); f.service.handle(f.frame("update", [4, 8], { startsAtMs, endsAtMs }));
    await f.service.whenIdle(); assert.equal(f.calls.length, 0);
  }
  await f.advance(1); assert.equal(f.calls.length, 1);
});

test("deux manches successives gardent chacune leur x2 et leur snipe sans reprendre une échéance de l'ancienne manche", async () => {
  const f = fixture(); f.save("multiplierX2"); f.save("snipe", { remainingSeconds: 15 });
  let startsAtMs = f.now(), endsAtMs = startsAtMs + 120000;
  f.service.handle(f.frame("start", [3, 6], { startsAtMs, endsAtMs }));
  f.earn(2, f.now() + 10000, 10000);
  await f.advance(10000); assert.equal(f.calls.length, 1); assert.equal(f.state.matchSession.multiplier, 2);
  await f.advance(95000); assert.equal(f.calls.length, 2);
  f.service.handle(f.frame("end", [3, 6], { startsAtMs, endsAtMs }));
  await f.advance(16000); startsAtMs = f.now(); endsAtMs = startsAtMs + 120000;
  f.service.handle(f.frame("start", [0, 0], { battleId: "second-round", startsAtMs, endsAtMs }));
  f.earn(2, f.now() + 10000, 10000, { battleId: "second-round" });
  await f.advance(10000); assert.equal(f.calls.length, 3); assert.equal(f.state.matchSession.multiplier, 2);
  await f.advance(95000); assert.equal(f.calls.length, 4);
  assert.equal(f.state.matchSession.session.battles, 2);
  assert.deepEqual(f.activities.map((entry) => entry[3]), ["multiplierX2", "snipe", "multiplierX2", "snipe"]);
});

test("les contributions LIVE restent exactes, sont regroupées sur une frame et survivent au nouveau match", async () => {
  const f = fixture(); const user = { id: "donor", name: "Donateur", displayName: "Donateur" };
  for (let i = 0; i < 100; i += 1) f.service.handleLiveEvent({ type: "like", source: "source_tiktok", user, data: { count: 3 } });
  assert.equal(f.state.matchSession.liveContributors[0].likes, 300); assert.equal(f.published.length, 0); assert.equal(f.timers.size, 1);
  assert.equal(f.projections.filter((paths) => paths.includes("matchSession")).length, 1, "pas de clone des 200 contributeurs à chaque tapotage");
  await f.advance(250); assert.equal(f.published.length, 1);
  f.service.handleLiveEvent({ type: "gift", source: "source_tiktok", user, data: { count: 2, value: 10, giftName: "Rose" } });
  f.service.handle(f.frame()); assert.equal(f.state.matchSession.lastGift.giftName, "Rose"); assert.equal(f.state.matchSession.lastContribution.type, "gift");
  assert.equal(f.state.matchSession.liveContributors[0].diamonds, 20);
});

test("rafale de likes respecte la fenêtre et le seuil, sans compteurs inventés par les tests de widgets", async () => {
  const f = fixture(); f.save("likeRush", { threshold: 300, windowSeconds: 5 }); f.service.handle(f.frame());
  const event = { type: "like", source: "source_tiktok", user: { id: "u", name: "u" }, data: { count: 299 } };
  f.service.handleLiveEvent(event); await f.service.whenIdle(); assert.equal(f.calls.length, 0);
  f.service.handleLiveEvent({ ...event, data: { count: 1 } }); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
  const before = structuredClone(f.state.matchSession); f.service.testWidget("victory");
  assert.deepEqual(f.state.matchSession.session, before.session); assert.deepEqual(f.state.matchSession.participants, before.participants);
  assert.equal(f.state.matchSession.result, before.result); await f.advance(5000); assert.equal(f.state.matchSession.preview, undefined);
});

test("Free, scope inattendu, automatisation modifiée et changement de profil annulent tout effet différé", async () => {
  const free = fixture(); free.state.commerce.subscription = { tier: "free", status: "free" };
  assert.equal(free.service.handle(free.frame()), false); assert.throws(() => free.save("battleStart"), { code: "PRO_FEATURE_REQUIRED" });
  assert.throws(() => free.service.testWidget("wins"), { code: "PRO_FEATURE_REQUIRED" });
  const f = fixture(); assert.throws(() => f.service.saveConfig({}, { ownerUid: "autre", profileId: "p" }), { code: "FEATURE_CONTEXT_CHANGED" });
  f.save("snipe"); f.service.handle(f.frame()); f.state.session.profileId = "autre";
  await f.advance(100000); assert.equal(f.calls.length, 0);
});

test("corriger les manches ne réécrit ni résultats confirmés ni total des victoires ; config widget conserve automatismes", async () => {
  const f = fixture(); f.save("victory"); f.service.handle(f.frame()); f.service.handle(f.frame("end", [20, 10])); await f.service.whenIdle();
  const history = structuredClone(f.state.matchSession.history), stats = structuredClone(f.state.matchSession.session);
  f.service.adjustWins({ operation: "set", amount: 11 }); assert.equal(f.state.matchSession.rounds.own, 11);
  assert.deepEqual(f.state.matchSession.history, history); assert.deepEqual(f.state.matchSession.session, stats);
  f.service.saveConfig({ widgets: { wins: { enabled: true } }, automations: [] }); assert.equal(f.state.settings.matches.automations.length, 1);
  const config = f.state.settings.matches.automations[0]; f.service.removeAutomation(config.id); assert.equal(f.state.settings.matches.automations.length, 0);
});

test("Matchs par profil : configurations, compteurs et historique restent isolés sans perdre les règles/cadeaux", () => {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-matches-fixture-memory")); store.touch = () => {};
  const first = store.state.session.profileId; store.upsert("profiles", { id: "other", name: "Autre" });
  store.state.settings.matches = normalizeMatchesConfig({ automations: [{ id: "test", moment: "battleStart", reaction: { type: "action", actionId: "gift-action" } }] });
  store.state.matchSession.session.wins = 3; const rules = structuredClone(store.state.rules);
  store.selectProfile("other"); assert.equal(store.state.settings.matches.automations.length, 0); assert.equal(store.state.matchSession.session.wins, 0);
  store.selectProfile(first); assert.equal(store.state.settings.matches.automations[0].reaction.actionId, "gift-action");
  assert.equal(store.state.matchSession.session.wins, 3); assert.deepEqual(store.state.rules, rules);
});

test("projection publique du vrai service puis double sanitization conserve scores/chrono mais jamais UID/actions/historique", () => {
  const f = fixture(); f.service.handle(f.frame());
  const first = projectMatchesOverlayState(f.state, f.now()), second = projectMatchesOverlayPayload(first, f.now());
  assert.equal(second.session.participants[0].score, 10); assert.equal(second.session.timing.endsAtMs, f.state.matchSession.endsAtMs);
  assert.equal(second.session.status, "active");
  assert.equal(JSON.stringify(second).includes("fixture"), false); assert.equal(second.session.history, undefined); assert.equal(second.session.scope, undefined);
});

test("déconnexion annule les échéances et réactions tout en conservant l’historique réel", async () => {
  const f = fixture(); f.save("snipe"); f.service.handle(f.frame());
  assert.equal(f.timers.size > 0, true); f.service.disconnect();
  assert.equal(f.timers.size, 0); assert.equal(f.state.matchSession.status, "disconnected");
  await f.advance(100000); assert.equal(f.calls.length, 0);
});

test("une fin sans score ni résultat ne déduit pas une victoire du cache et accepte le vrai résultat tardif une fois", async () => {
  const f = fixture(); f.save("victory"); f.save("defeat"); f.service.handle(f.frame("start", [100, 1]));
  f.service.handle(f.frame("end", [100, 1], { participants: [] })); await f.service.whenIdle();
  assert.equal(f.state.matchSession.result, null); assert.equal(f.state.matchSession.session.wins, 0); assert.equal(f.calls.length, 0);
  const late = f.frame("end", [100, 1], { participants: [{ id: "1", result: "lose", score: null }] });
  f.service.handle(late); await f.service.whenIdle(); f.service.handle({ ...late, id: "duplicate-result" }); await f.service.whenIdle();
  assert.equal(f.state.matchSession.result, "lose"); assert.equal(f.state.matchSession.session.wins, 0); assert.equal(f.state.matchSession.session.losses, 1);
  assert.equal(f.state.matchSession.history.length, 1); assert.equal(f.calls.length, 1);
});

test("le multiplicateur cesse à sa durée mesurée et une annonce retardée ne modifie aucun état hors LIVE", async () => {
  const f = fixture(); f.service.handle(f.frame());
  f.earn(2, f.now(), 5000);
  assert.equal(f.state.matchSession.multiplier, 2); await f.advance(5000); assert.equal(f.state.matchSession.multiplier, 1);
  f.earn(3, f.now() + 5000, 5000);
  f.state.session.running = false; await f.advance(5000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("les manches du duo sont corrigibles même sans scores et les signaux non finaux cessent après fin ou échéance", async () => {
  const f = fixture(); f.service.handle(f.frame("start", [null, null]));
  f.service.adjustWins({ operation: "set", amount: 5 }); assert.deepEqual(f.state.matchSession.rounds, { own: 5, opponent: 0 });
  assert.equal(f.state.matchSession.manualWins, null); assert.equal(f.state.matchSession.session.wins, 0);
  f.save("likeRush", { threshold: 1 }); f.save("lead"); f.save("snipe");
  const like = { type: "like", source: "source_tiktok", user: { id: "u", name: "u" }, data: { count: 10 } };
  f.state.matchSession.endsAtMs = f.now() - 1; f.service.handleLiveEvent(like); f.service.fireMoment("lead"); await f.service.whenIdle();
  assert.equal(f.calls.length, 0); f.state.matchSession.status = "finished"; f.service.fireMoment("snipe"); await f.service.whenIdle(); assert.equal(f.calls.length, 0);
});
