"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");
const { selectStatePaths } = require("../src/main/state-projection");

function fixture() {
  let now = 1790000000000, sequence = 0;
  const state = { settings: { account: { uid: "bonus-owner", email: "fixture@example.invalid", refreshTokenSecretId: "fixture" },
    tiktok: { username: "creator", roomId: "room", status: "live", broadcaster: { userId: "111", username: "creator" } }, siteVisibility: {},
    matches: normalizeMatchesConfig(), overlayConfigs: {} }, session: { running: true, profileId: "profile" },
    commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), rules: [], profiles: [] };
  const timers = new Map(), calls = [], contexts = [];
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-only", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state) };
  const actionRunner = { run: async (_action, context) => { contexts.push(context); if (context.shouldExecute()) calls.push(context.data.moment); return { executed: true }; } };
  const service = new MatchesService({ store, actionRunner, now: () => now, setTimeoutImpl: (callback, ms) => {
    const timer = { at: now + ms, callback, unref() {} }; timers.set(timer, timer); return timer;
  }, clearTimeoutImpl: (timer) => timers.delete(timer) });
  for (const moment of ["multiplierX2", "multiplierX3"]) service.saveAutomation({ id: moment, name: moment, moment,
    enabled: true, cooldownMs: 60000, reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" } });
  const frame = (phase, extra = {}) => ({ source: "source_tiktok", roomId: "room", channelUsername: "creator", battleId: "battle", phase,
    id: `fixture-${++sequence}`, receivedAtMs: now, startsAtMs: 0, endsAtMs: 0, participants: [], ...extra });
  const open = (extra = {}) => service.handle(frame("start", { startsAtMs: now, endsAtMs: now + 300000,
    participants: [{ id: "111", username: "creator", score: 0 }, { id: "333", username: "rival", score: 0 }], ...extra }));
  const task = (stage, extra = {}, input = {}) => service.handle(frame("task", { bonus: { stage, multiplier: null,
    startsAtMs: 0, durationMs: 0, result: "unknown", periodKey: "", ...extra }, ...input }));
  const announce = (multiplier = 2, startsAtMs = now + 10000, durationMs = 10000, input = {}) => task("announced", { multiplier, startsAtMs, durationMs }, input);
  const settle = (result = "success", startsAtMs = now + 10000, input = {}) => task("settled", { result, startsAtMs }, input);
  const advance = async (ms) => {
    now += ms;
    for (const timer of [...timers.keys()]) if (timer.at <= now) { timers.delete(timer); timer.callback(); }
    await service.whenIdle();
  };
  return { state, service, calls, contexts, timers, frame, task, open, announce, settle, advance, now: () => now };
}

test("une annonce et le seul bonus adverse (SETTLE échoué) ne lancent aucune animation du diffuseur", async () => {
  const f = fixture(); f.open(); f.announce();
  await f.advance(11000); assert.deepEqual(f.calls, []); assert.equal(f.state.matchSession.multiplier, 1);
  f.settle("failed", f.now() - 1000); await f.advance(20000);
  assert.deepEqual(f.calls, []); assert.equal(f.state.matchSession.multiplier, 1);
});

test("SETTLE seul retrouve le multiplicateur annoncé et respecte le début réel corrigé", async () => {
  const f = fixture(); f.open(); f.announce(3, f.now() + 60000, 20000);
  f.settle("success", f.now() + 5000);
  await f.advance(4999); assert.deepEqual(f.calls, []);
  await f.advance(1); assert.deepEqual(f.calls, ["multiplierX3"]); assert.equal(f.state.matchSession.multiplier, 3);
  await f.advance(20000); assert.equal(f.state.matchSession.multiplier, 1);
  await f.advance(35000); assert.deepEqual(f.calls, ["multiplierX3"], "L'ancienne prévision n'a plus de minuterie");
});

test("un compte à rebours TikTok de 134 s se résout depuis la fin du match, sans paquet de score ultérieur", async () => {
  const f = fixture(); f.open({ endsAtMs: f.now() + 301000 });
  f.task("announced", { multiplier: 3, startsBeforeEndMs: 134000, durationMs: 60000 });
  f.task("settled", { result: "success" });
  await f.advance(166999); assert.deepEqual(f.calls, []);
  await f.advance(1); assert.deepEqual(f.calls, ["multiplierX3"]);
  assert.equal(f.state.matchSession.multiplier, 3);
});

test("un bonus déjà actif confirmé ne dépend pas du prochain paquet de scores", async () => {
  const f = fixture(); f.open();
  await f.advance(20000);
  f.announce(2, f.now() - 500, 20000); f.settle("success", f.now() - 500);
  const receivedAt = f.now();
  await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX2"]);
  assert.equal(f.now(), receivedAt, "Aucune échéance ni prochain paquet de scores nécessaire");
});

test("une prolongation du match ne décale pas un bonus relatif déjà résolu", async () => {
  const f = fixture(); const originalEnd = f.now() + 301000; f.open({ endsAtMs: originalEnd });
  f.task("announced", { multiplier: 2, startsBeforeEndMs: 134000, durationMs: 50000 });
  f.task("settled", { result: "success" });
  await f.advance(160000);
  f.service.handle(f.frame("update", { endsAtMs: originalEnd + 30000 }));
  await f.advance(7000); assert.deepEqual(f.calls, ["multiplierX2"]);
  f.service.handle(f.frame("update", { endsAtMs: originalEnd + 60000 }));
  assert.equal(f.state.matchSession.multiplier, 2);
  await f.advance(50000); assert.equal(f.state.matchSession.multiplier, 1);
  assert.deepEqual(f.calls, ["multiplierX2"]);
});

test("affiner l'horloge ne crée jamais une seconde période pour le même horodatage serveur", async () => {
  const f = fixture(); f.open(); const serverTime = f.now() + 2000;
  f.task("announced", { multiplier: 2, startsAtMs: f.now(), sourceStartsAtMs: serverTime, durationMs: 20000 });
  f.task("settled", { result: "success", startsAtMs: f.now(), sourceStartsAtMs: serverTime });
  await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX2"]);
  f.task("announced", { multiplier: 2, startsAtMs: f.now() - 100, sourceStartsAtMs: serverTime, durationMs: 20000 });
  f.task("settled", { result: "success", startsAtMs: f.now() - 100, sourceStartsAtMs: serverTime });
  await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX2"]);
  assert.equal(f.service.bonuses.periods.size, 1);
});

test("premier bonus avant OPEN est mis en attente sans faux match et part après identification du diffuseur", async () => {
  const f = fixture(); f.announce(2, f.now() + 1000); f.settle("success", f.now() + 1000);
  assert.equal(f.state.matchSession.battleId, ""); await f.advance(1000); assert.deepEqual(f.calls, []);
  f.open(); await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX2"]);
  assert.equal(f.state.matchSession.session.battles, 1);
});

test("les ×2 initial, intermédiaire et final sont trois périodes distinctes, jamais trois duplications", async () => {
  const f = fixture(); f.open();
  for (let index = 0; index < 3; index += 1) {
    const startsAtMs = f.now() + 1000;
    f.announce(2, startsAtMs, 1000); f.announce(2, startsAtMs, 1000);
    f.settle(index === 1 ? "both" : "success", startsAtMs);
    await f.advance(1000); assert.equal(f.calls.length, index + 1);
    f.settle("success", startsAtMs); f.announce(2, startsAtMs, 1000);
    await f.service.whenIdle(); assert.equal(f.calls.length, index + 1);
    await f.advance(1000); assert.equal(f.state.matchSession.multiplier, 1);
  }
  assert.deepEqual(f.calls, ["multiplierX2", "multiplierX2", "multiplierX2"]);
});

test("un SETTLE ancien dupliqué ne valide pas le nouveau bonus encore en attente", async () => {
  const f = fixture(); f.open(); const first = f.now() + 1000;
  f.announce(2, first, 1000); f.settle("success", first); await f.advance(2000);
  f.announce(3, f.now() + 1000, 1000); f.settle("success", first);
  await f.advance(1000); assert.deepEqual(f.calls, [], "Le premier bonus expiré n'est pas joué en rattrapage");
  assert.equal(f.state.matchSession.multiplier, 1);
});

test("aucun bonus sans annonce, périmé, impossible, inconnu, hors salle, profil ou droits", async () => {
  for (const change of ["no-announcement", "expired", "ancient-time", "future-after-battle", "unknown", "room", "channel", "identity", "profile", "free", "disconnected"]) {
    const f = fixture(); f.open(); let start = f.now() + 1000;
    if (change === "expired") start = f.now() - 20000;
    if (change === "ancient-time") start = 30000;
    if (change === "future-after-battle") start = f.now() + 400000;
    if (change !== "no-announcement") f.announce(2, start, 10000);
    const input = change === "room" ? { roomId: "other" } : change === "channel" ? { channelUsername: "other" } : {};
    if (change === "identity") f.state.settings.tiktok.broadcaster.userId = "other";
    if (change === "profile") f.state.session.profileId = "other";
    if (change === "free") f.state.commerce.subscription = { tier: "free", status: "free" };
    if (change === "disconnected") f.service.disconnect();
    f.settle(change === "unknown" ? "unknown" : "success", start, input); await f.advance(20000);
    assert.deepEqual(f.calls, [], change);
  }
});

test("un bonus identifié tardivement reprend sans paquet supplémentaire à sa propre échéance", async () => {
  const f = fixture(); f.state.settings.tiktok.broadcaster.userId = "unknown"; f.open();
  f.announce(2, f.now() + 10000); f.settle("success", f.now() + 10000);
  await f.advance(5000); assert.deepEqual(f.calls, []);
  f.state.settings.tiktok.broadcaster.userId = "111"; f.service.handle(f.frame("update"));
  await f.advance(5000); assert.deepEqual(f.calls, ["multiplierX2"]);
});

test("fin de bonus, annulation, changement de compte/identité/équipes et fin de période invalident les sorties asynchrones", async () => {
  for (const change of ["reward-end", "battle-cancel", "account", "owner", "team", "expiry"]) {
    const f = fixture(); f.open(); f.announce(2, f.now(), 1000); f.settle("success", f.now());
    await f.service.whenIdle(); assert.equal(f.contexts[0].shouldExecute(), true);
    if (change === "reward-end") f.task("ended");
    if (change === "battle-cancel") f.service.handle(f.frame("cancel"));
    if (change === "account") f.state.settings.account.uid = "other";
    if (change === "owner") f.state.settings.tiktok.broadcaster.userId = "other";
    if (change === "team") {
      f.service.handle(f.frame("update", { teams: [{ id: "a", participantIds: ["111"], score: 0 }, { id: "b", participantIds: ["333"], score: 0 }] }));
      assert.equal(f.contexts[0].shouldExecute(), true, "La première composition complète une identité encore partielle");
      f.service.handle(f.frame("update", { teams: [{ id: "a", participantIds: ["111", "444"], score: 0 }, { id: "b", participantIds: ["333"], score: 0 }] }));
    }
    if (change === "expiry") await f.advance(1000);
    assert.equal(f.contexts[0].shouldExecute(), false, change);
  }
});

test("REWARD_SETTLE sans identifiant termine le bonus actif, pas l'annonce de la période suivante", async () => {
  const f = fixture(); f.open(); f.announce(2, f.now(), 20000); f.settle("success", f.now()); await f.service.whenIdle();
  f.announce(3, f.now() + 10000, 5000); f.task("ended");
  assert.equal(f.state.matchSession.multiplier, 1);
  f.settle("success", f.now() + 10000); await f.advance(10000);
  assert.deepEqual(f.calls, ["multiplierX2", "multiplierX3"]);
});

test("l'ancienne échéance ne traverse pas une nouvelle manche et l'ancien champ global seul n'arme rien", async () => {
  const f = fixture(); f.open(); f.announce(2, f.now() + 10000, 5000); f.settle("success", f.now() + 10000);
  await f.advance(1); f.open({ battleId: "next-battle" });
  f.service.handle(f.frame("task", { battleId: "next-battle", multiplier: 3, rewardStartsAtMs: f.now(), rewardDurationMs: 10000 }));
  await f.advance(15000); assert.deepEqual(f.calls, []); assert.equal(f.state.matchSession.multiplier, 1);
});

test("le cache et les alias de bonus restent bornés sans minuterie pour les annonces", () => {
  const f = fixture(); f.open();
  for (let index = 0; index < 100; index += 1) f.announce(2, f.now() + index * 1000);
  assert.equal(f.service.bonuses.periods.size, 32); assert.equal(f.timers.size, 0);
});

test("une tâche reçue sans match n'est pas ressuscitée après trente secondes d'attente", async () => {
  const f = fixture(); f.announce(2, f.now() + 60000, 10000); f.settle("success", f.now() + 60000);
  await f.advance(31000); f.open(); await f.advance(29000);
  assert.deepEqual(f.calls, []); assert.equal(f.state.matchSession.multiplier, 1);
});

test("START_BONUS disponible lance le premier ×2 à vingt secondes sans prochain paquet de scores ni SETTLE", async () => {
  const f = fixture(); f.open(); const startsAtMs = f.now() + 20000;
  f.task("available", { result: "available", multiplier: 2, ownerUserId: "111", periodKey: `server:${startsAtMs}`,
    startsAtMs, durationMs: 30000 });
  await f.service.whenIdle(); assert.deepEqual(f.calls, []); assert.equal(f.state.matchSession.multiplier, 1);
  await f.advance(19999); assert.deepEqual(f.calls, []);
  await f.advance(1); assert.deepEqual(f.calls, ["multiplierX2"]); assert.equal(f.state.matchSession.multiplier, 2);
  await f.advance(30000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("START_BONUS déjà actif part dès sa récupération sans attendre les scores", async () => {
  const f = fixture(); f.open(); const startsAtMs = f.now() + 20000;
  await f.advance(25000);
  f.task("available", { result: "available", multiplier: 3, ownerUserId: "111", periodKey: `server:${startsAtMs}`,
    startsAtMs, durationMs: 30000 });
  const receivedAtMs = f.now(); await f.service.whenIdle();
  assert.deepEqual(f.calls, ["multiplierX3"]); assert.equal(f.now(), receivedAtMs);
});

test("START_BONUS conserve sa clé exacte malgré le raffinement de l'horloge et les duplications HTTP", async () => {
  const f = fixture(); f.open(); await f.advance(20000);
  const serverTime = f.now() + 2318, periodKey = `server:${serverTime}`;
  for (const correction of [2318, 2400, 2400]) {
    f.task("available", { result: "available", multiplier: 2, ownerUserId: "111", periodKey,
      startsAtMs: serverTime - correction, sourceStartsAtMs: serverTime, durationMs: 30000 });
    await f.service.whenIdle();
  }
  assert.deepEqual(f.calls, ["multiplierX2"]); assert.equal(f.service.bonuses.periods.size, 1);
});

test("START_BONUS ne traverse ni UID adverse/inconnu, salle, compte, profil, droits ou match", async () => {
  for (const change of ["rival", "missing-owner", "numeric-owner", "unknown-identity", "room", "channel", "profile", "account", "free", "disconnected", "other-battle"]) {
    const f = fixture(); f.open(); const startsAtMs = f.now() + 20000;
    const bonus = { result: "available", multiplier: 2, ownerUserId: "111", periodKey: `server:${startsAtMs}`,
      startsAtMs, durationMs: 30000 };
    const input = {};
    if (change === "rival") bonus.ownerUserId = "333";
    if (change === "missing-owner") delete bonus.ownerUserId;
    if (change === "numeric-owner") bonus.ownerUserId = 111;
    if (change === "unknown-identity") f.state.settings.tiktok.broadcaster.userId = "unknown";
    if (change === "room") input.roomId = "other";
    if (change === "channel") input.channelUsername = "other";
    if (change === "profile") f.state.session.profileId = "other";
    if (change === "account") f.state.settings.account.uid = "other";
    if (change === "free") f.state.commerce.subscription = { tier: "free", status: "free" };
    if (change === "disconnected") f.service.disconnect();
    if (change === "other-battle") input.battleId = "other";
    f.task("available", bonus, input); await f.advance(25000);
    assert.deepEqual(f.calls, [], change); assert.equal(f.service.bonuses.periods.size, 0, change);
  }
});

test("START_BONUS exige une période explicitement nommée, bornée et comprise dans le vrai match", async () => {
  const cases = [
    { periodKey: "" }, { periodKey: "x".repeat(181) }, { periodKey: "server:bad\n" }, { periodKey: null },
    { multiplier: 1 }, { multiplier: "2" }, { multiplier: 4 }, { result: "success" },
    { startsAtMs: NaN }, { startsAtMs: "1790000000000" }, { startsAtMs: 1790000000000 - 1 },
    { startsAtMs: 1790000000000 + 290000, durationMs: 20000 },
    { durationMs: 0 }, { durationMs: -1 }, { durationMs: NaN }, { durationMs: "30000" },
    { durationMs: 0.5 }, { durationMs: 3600001 }
  ];
  for (const change of cases) {
    const f = fixture(); f.open();
    f.task("available", { result: "available", multiplier: 2, ownerUserId: "111", periodKey: "server:fixture",
      startsAtMs: f.now() + 20000, durationMs: 30000, ...change });
    await f.advance(25000); assert.deepEqual(f.calls, [], JSON.stringify(change));
    assert.equal(f.service.bonuses.periods.size, 0, JSON.stringify(change));
  }
});

test("START_BONUS périmé, sans dates de match et pré-OPEN n'est jamais ressuscité", async () => {
  for (const change of ["expired", "no-start", "no-end", "preOPEN"]) {
    const f = fixture(); const start = f.now();
    if (change !== "preOPEN") f.open(change === "no-end" ? { endsAtMs: 0 } : {});
    if (change === "no-start") f.state.matchSession.startedAtMs = 0;
    if (change === "expired") await f.advance(50000);
    f.task("available", { result: "available", multiplier: 2, ownerUserId: "111", periodKey: `server:${start + 20000}`,
      startsAtMs: start + 20000, durationMs: 30000 });
    if (change === "preOPEN") f.open();
    await f.advance(25000); assert.deepEqual(f.calls, [], change); assert.equal(f.service.bonuses.periods.size, 0, change);
  }
});

test("START_BONUS utilise les gardes asynchrones existants lors d'un changement de profil ou d'identité", async () => {
  for (const change of ["profile", "owner", "room", "free", "end"]) {
    const f = fixture(); f.open();
    f.task("available", { result: "available", multiplier: 2, ownerUserId: "111", periodKey: "server:fixture",
      startsAtMs: f.now() + 20000, durationMs: 30000 });
    if (change === "profile") f.state.session.profileId = "other";
    if (change === "owner") f.state.settings.tiktok.broadcaster.userId = "333";
    if (change === "room") f.state.settings.tiktok.roomId = "other";
    if (change === "free") f.state.commerce.subscription = { tier: "free", status: "free" };
    if (change === "end") f.service.handle(f.frame("end", { confirmedEnd: true }));
    await f.advance(20000); assert.deepEqual(f.calls, [], change);
  }
});

test("une annonce ordinaire sans SETTLE reste inactive et une période terminée ne renaît pas via available", async () => {
  const f = fixture(); f.open(); const start = f.now() + 20000;
  f.task("announced", { multiplier: 2, periodKey: "ordinary", startsAtMs: start, durationMs: 30000 });
  await f.advance(20000); assert.deepEqual(f.calls, []);
  f.task("available", { result: "available", multiplier: 2, ownerUserId: "111", periodKey: "start-bonus",
    startsAtMs: start, durationMs: 30000 });
  await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX2"]);
  f.task("ended", { periodKey: "start-bonus" });
  f.task("available", { result: "available", multiplier: 2, ownerUserId: "111", periodKey: "start-bonus",
    startsAtMs: start, durationMs: 30000 });
  await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX2"]); assert.equal(f.state.matchSession.multiplier, 1);
});

test("START_BONUS wire déclenche uniquement son ×2 ou ×3 à l'échéance explicite sans SETTLE ni score ultérieur", async () => {
  for (const multiplier of [2, 3]) {
    const f = fixture(); f.open();
    f.task("start-bonus", { result: "available", multiplier, startsAtMs: f.now() + 20000, durationMs: 30000 });
    await f.advance(19999); assert.deepEqual(f.calls, []);
    await f.advance(1); assert.deepEqual(f.calls, [`multiplierX${multiplier}`]);
    assert.equal(f.state.matchSession.multiplier, multiplier);
    await f.advance(30000); assert.equal(f.state.matchSession.multiplier, 1);
  }
});

test("START_BONUS wire relatif se résout une fois, ne suit pas une prolongation et se déduplique", async () => {
  const f = fixture(); const initialEnd = f.now() + 300000; f.open({ endsAtMs: initialEnd });
  const bonus = { result: "available", multiplier: 3, startsBeforeEndMs: 280000, durationMs: 30000 };
  f.task("start-bonus", bonus); f.task("start-bonus", bonus);
  await f.advance(10000);
  f.service.handle(f.frame("update", { endsAtMs: initialEnd + 30000 }));
  f.task("start-bonus", bonus);
  await f.advance(10000); assert.deepEqual(f.calls, ["multiplierX3"]);
  f.task("start-bonus", bonus); await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX3"]);
  assert.equal(f.service.bonuses.periods.size, 1);
  await f.advance(30000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("START_BONUS wire et HTTP partagent la même preuve temporelle sans double animation", async () => {
  for (const wireFirst of [true, false]) {
    const f = fixture(); f.open(); const startsAtMs = f.now() + 20000;
    const wire = () => f.task("start-bonus", { result: "available", multiplier: 2, startsAtMs, durationMs: 30000 });
    const http = () => f.task("available", { result: "available", multiplier: 2, startsAtMs, durationMs: 30000,
      ownerUserId: "111", periodKey: `server:${startsAtMs}` });
    if (wireFirst) { wire(); http(); } else { http(); wire(); }
    await f.advance(20000); assert.deepEqual(f.calls, ["multiplierX2"]);
    wire(); http(); await f.service.whenIdle(); assert.deepEqual(f.calls, ["multiplierX2"]);
    assert.equal(f.service.bonuses.periods.size, 1);
  }
});

test("START_BONUS wire exige la salle exacte, le diffuseur vérifié et le profil courant", async () => {
  for (const change of ["room", "missing-room", "numeric-room", "unknown-owner", "unverified-owner", "profile", "account", "free", "disconnected", "preOPEN"]) {
    const f = fixture(); if (change !== "preOPEN") f.open();
    const input = change === "room" ? { roomId: "other" } : change === "missing-room" ? { roomId: "" } : change === "numeric-room" ? { roomId: 123 } : {};
    if (change === "unknown-owner") f.state.settings.tiktok.broadcaster.userId = "unknown";
    if (change === "unverified-owner") delete f.state.settings.tiktok.broadcaster.userId;
    if (change === "profile") f.state.session.profileId = "other";
    if (change === "account") f.state.settings.account.uid = "other";
    if (change === "free") f.state.commerce.subscription = { tier: "free", status: "free" };
    if (change === "disconnected") f.service.disconnect();
    f.task("start-bonus", { result: "available", multiplier: 2, startsAtMs: f.now() + 20000, durationMs: 30000 }, input);
    if (change === "preOPEN") f.open();
    await f.advance(20000); assert.deepEqual(f.calls, [], change);
    assert.equal(f.service.bonuses.periods.size, 0, change);
  }
});

test("START_BONUS wire ne joue ni valeur inconnue, ni fenêtre impossible ou périmée, ni cycle déjà échoué", async () => {
  const invalid = [{ multiplier: null }, { multiplier: 1 }, { multiplier: 4 }, { multiplier: "2" },
    { result: "unknown" }, { result: "failed" }, { result: "success" },
    { durationMs: 0 }, { durationMs: 1.5 }, { durationMs: 3600001 },
    { startsAtMs: 0 }, { startsAtMs: NaN }, { startsAtMs: "1790000020000" },
    { startsAtMs: 1790000000000 - 1 }, { startsAtMs: 1790000000000 + 290000 },
    { startsAtMs: 0, startsBeforeEndMs: 0 }, { startsAtMs: 0, startsBeforeEndMs: 7200001 }];
  for (const change of invalid) {
    const f = fixture(); f.open();
    f.task("start-bonus", { result: "available", multiplier: 2, startsAtMs: f.now() + 20000, durationMs: 30000, ...change });
    await f.advance(25000); assert.deepEqual(f.calls, [], JSON.stringify(change));
    assert.equal(f.service.bonuses.periods.size, 0, JSON.stringify(change));
  }
  const expired = fixture(); expired.open(); const oldStart = expired.now() + 1000; await expired.advance(40000);
  expired.task("start-bonus", { result: "available", multiplier: 2, startsAtMs: oldStart, durationMs: 30000 });
  await expired.service.whenIdle(); assert.deepEqual(expired.calls, []); assert.equal(expired.service.bonuses.periods.size, 0);
  const failed = fixture(); failed.open(); const startsAtMs = failed.now() + 20000, periodKey = `server:${startsAtMs}`;
  failed.task("announced", { multiplier: 2, startsAtMs, durationMs: 30000, periodKey });
  failed.task("settled", { result: "failed", startsAtMs, periodKey });
  failed.task("start-bonus", { result: "available", multiplier: 2, startsAtMs, durationMs: 30000 });
  await failed.advance(20000); assert.deepEqual(failed.calls, []);
});

test("START_BONUS wire reste invalide après un changement de salle, identité ou droits asynchrone", async () => {
  for (const change of ["room", "owner", "unverified-owner", "profile", "free", "end"]) {
    const f = fixture(); f.open();
    f.task("start-bonus", { result: "available", multiplier: 3, startsAtMs: f.now() + 20000, durationMs: 30000 });
    if (change === "room") f.state.settings.tiktok.roomId = "other";
    if (change === "owner") f.state.settings.tiktok.broadcaster.userId = "333";
    if (change === "unverified-owner") delete f.state.settings.tiktok.broadcaster.userId;
    if (change === "profile") f.state.session.profileId = "other";
    if (change === "free") f.state.commerce.subscription = { tier: "free", status: "free" };
    if (change === "end") f.service.handle(f.frame("end", { confirmedEnd: true }));
    await f.advance(20000); assert.deepEqual(f.calls, [], change);
  }
});
