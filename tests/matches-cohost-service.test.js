"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MatchesService } = require("../src/main/matches/service");
const { createMatchSession, normalizeMatchesConfig, normalizeMatchTeams } = require("../src/shared/matches-contract");
const { selectStatePaths } = require("../src/main/state-projection");

/** Données et horloge en mémoire : aucun LIVE, fichier client ou effet réel. */
function fixture() {
  let now = 1790000000000, message = 0;
  const state = { settings: { account: { uid: "fixture-owner", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
    siteVisibility: {}, tiktok: { roomId: "fixture-room", username: "creator", status: "live", broadcaster: { userId: "1", username: "creator" } },
    matches: normalizeMatchesConfig(), overlayConfigs: {} }, session: { running: true, profileId: "fixture-profile" },
    commerce: { subscription: { tier: "pro", status: "active" } }, matchSession: createMatchSession(), rules: [], profiles: [{ id: "fixture-profile", enabledRuleIds: [] }] };
  const calls = [], timers = new Map(), activity = [];
  const store = { getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account, getSecret: () => "fixture-only",
    mutateRuntime: (callback) => callback(state), mutate: (callback) => callback(state) };
  const actionRunner = { run: async (_action, context) => { if (context.shouldExecute()) calls.push(context.data.moment); return { executed: true }; } };
  const service = new MatchesService({ store, actionRunner, now: () => now, onActivity: (...args) => activity.push(args),
    setTimeoutImpl: (callback, delay) => { const timer = { callback, at: now + delay, unref() {} }; timers.set(timer, timer); return timer; }, clearTimeoutImpl: (timer) => timers.delete(timer) });
  const frame = (phase = "start", scores = [10, 20], extra = {}) => ({ source: "source_tiktok", phase, battleId: "cohost-battle", id: `message-${++message}`,
    roomId: "fixture-room", channelUsername: "creator", receivedAtMs: now, startsAtMs: now, endsAtMs: now + 120000, confirmedEnd: phase === "end",
    participants: [
      { id: "1", username: "creator", score: 1, teamId: "a" }, { id: "2", username: "ally", score: 999, teamId: "a" },
      { id: "3", username: "rival", score: 900, teamId: "b" }, { id: "4", username: "rival-ally", score: 900, teamId: "b" }
    ], teams: [{ id: "a", participantIds: ["1", "2"], score: scores[0], donors: [], result: null }, { id: "b", participantIds: ["3", "4"], score: scores[1], donors: [], result: null }], ...extra });
  const save = (moment, extra = {}) => service.saveAutomation({ id: moment, moment, enabled: true, reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" }, ...extra });
  const advance = async (milliseconds) => { now += milliseconds; for (const timer of [...timers.keys()]) if (timer.at <= now) { timers.delete(timer); timer.callback(); } await service.whenIdle(); };
  const earn = (multiplier, startsAtMs = now, durationMs = 10000) => {
    service.handle(frame("task", [10, 20], { startsAtMs: 0, endsAtMs: 0,
      bonus: { stage: "announced", multiplier, startsAtMs, durationMs, result: "unknown", periodKey: "" } }));
    service.handle(frame("task", [10, 20], { startsAtMs: 0, endsAtMs: 0,
      bonus: { stage: "settled", multiplier: null, startsAtMs, durationMs: 0, result: "success", periodKey: "" } }));
  };
  return { state, service, actionRunner, calls, timers, activity, frame, save, advance, earn, now: () => now };
}

test("cohébergement 2v2 : les totaux explicites des équipes pilotent devant, remontée et victoire", async () => {
  const f = fixture();
  for (const moment of ["battleStart", "multiplierX2", "lead", "comeback", "victory"]) f.save(moment, { threshold: 1 });
  f.service.handle(f.frame()); await f.service.whenIdle();
  f.earn(2); await f.service.whenIdle();
  f.service.handle(f.frame("update", [30, 20])); await f.service.whenIdle();
  const end = f.frame("end", [30, 20]); f.service.handle(end); f.service.handle(end); await f.service.whenIdle();
  assert.deepEqual(f.calls, ["battleStart", "multiplierX2", "lead", "comeback", "victory"]);
  assert.equal(f.state.matchSession.ownUserId, "1"); assert.equal(f.state.matchSession.ownTeamId, "a");
  assert.equal(f.state.matchSession.participants[0].score, 1, "Le score personnel ne devient pas le total d'équipe");
  assert.equal(f.state.matchSession.result, "win"); assert.equal(f.state.matchSession.session.wins, 1);
  assert.equal(f.state.matchSession.history[0].ownScore, 30); assert.equal(f.state.matchSession.history[0].rivalScore, 20);
});

test("cohébergement : égalité et snipe fonctionnent sur les équipes sans exiger deux personnes", async () => {
  const f = fixture(); f.save("tieEnd"); f.save("snipe"); f.service.handle(f.frame("start", [20, 20]));
  await f.advance(60000); assert.deepEqual(f.calls, ["tieEnd"]);
  await f.advance(30000); assert.deepEqual(f.calls, ["tieEnd", "snipe"]);
  f.service.reschedule(); await f.service.whenIdle(); assert.equal(f.calls.length, 2);
});

test("cohébergement : une fin muette ne transforme pas les totaux en victoire ; le résultat réel tardif reste unique", async () => {
  const f = fixture(); f.save("victory"); f.save("defeat"); f.service.handle(f.frame("start", [1000, 1]));
  f.service.handle(f.frame("end", [], { participants: [], teams: [] })); await f.service.whenIdle();
  assert.equal(f.state.matchSession.result, null); assert.equal(f.calls.length, 0);
  const late = f.frame("end", [], { participants: [], teams: [{ id: "a", participantIds: [], score: null, result: "lose", donors: [] }] });
  f.service.handle(late); await f.service.whenIdle(); f.service.handle({ ...late, id: "other-end" }); await f.service.whenIdle();
  assert.equal(f.state.matchSession.result, "lose"); assert.equal(f.state.matchSession.session.losses, 1);
  assert.equal(f.state.matchSession.history.length, 1); assert.deepEqual(f.calls, ["defeat"]);
});

test("cohébergement : des scores individuels ne remplacent jamais des totaux d'équipe absents", async () => {
  const f = fixture(); f.save("lead"); f.save("victory");
  f.service.handle(f.frame("start", [null, null])); f.service.handle(f.frame("update", [null, null]));
  f.service.handle(f.frame("end", [null, null])); await f.service.whenIdle();
  assert.equal(f.state.matchSession.result, null); assert.equal(f.calls.length, 0); assert.equal(f.state.matchSession.session.wins, 0);
});

test("cohébergement : une appartenance ambiguë ou un autre UID ne permet pas d'attribuer une équipe au streamer", async () => {
  for (const invalid of ["membership", "uid"]) {
    const f = fixture(); f.save("lead"); f.save("victory");
    const start = f.frame();
    if (invalid === "membership") start.teams[1].participantIds.push("1");
    else { start.participants[0].id = "999"; start.teams[0].participantIds[0] = "999"; }
    f.service.handle(start);
    const end = { ...start, phase: "end", id: "end", confirmedEnd: true, teams: start.teams.map((entry, index) => ({ ...entry, score: index ? 1 : 999, result: index ? "lose" : "win" })) };
    f.service.handle(end); await f.service.whenIdle();
    assert.equal(f.state.matchSession.ownTeamId, "", invalid); assert.equal(f.state.matchSession.result, null, invalid); assert.equal(f.calls.length, 0, invalid);
  }
});

test("cohébergement : les équipes sans score ne suppriment pas le dernier total mesuré et restent distinctes des personnes", () => {
  const f = fixture(); f.service.handle(f.frame("start", [100, 200]));
  f.service.handle(f.frame("update", [null, null]));
  assert.equal(f.state.matchSession.teams.find((entry) => entry.id === "a").score, 100);
  assert.equal(f.state.matchSession.participants.find((entry) => entry.id === "1").score, 1);
});

test("cohébergement : les donateurs d'une armée d'équipe ne sont pas réattribués aux cadeaux personnels", () => {
  const f = fixture();
  f.service.handleLiveEvent({ source: "source_tiktok", type: "gift", user: { id: "donor", name: "viewer" }, data: { value: 3, count: 1, giftName: "Fixture" } });
  const start = f.frame(); start.teams[0].donors = [{ id: "ally-donor", username: "other", score: 500, diamonds: 500 }];
  f.service.handle(start);
  assert.deepEqual(f.state.matchSession.liveContributors.map(({ id, diamonds }) => ({ id, diamonds })), [{ id: "donor", diamonds: 3 }]);
  assert.equal(f.state.matchSession.lastGift.user.id, "donor");
});

test("une annulation de match est terminale pour ce battleId et neutralise les réactions retardées", async () => {
  const f = fixture(); f.save("snipe"); f.save("victory"); f.save("multiplierX2"); f.service.handle(f.frame());
  f.earn(2, f.now() + 10000, 10000);
  f.service.handle(f.frame("cancel"));
  assert.equal(f.state.matchSession.status, "cancelled"); assert.equal(f.timers.size, 0);
  assert.equal(f.service.handle(f.frame("update", [999, 1])), false);
  assert.equal(f.service.handle(f.frame("end", [999, 1])), false);
  await f.advance(100000); assert.equal(f.calls.length, 0); assert.equal(f.state.matchSession.session.wins, 0);
  assert.equal(f.service.handle(f.frame("start", [10, 20], { battleId: "next-battle" })), true);
});

test("les IDs de messages ne dédupliquent pas par erreur deux vrais matchs différents", async () => {
  const f = fixture(); f.save("battleStart");
  f.service.handle(f.frame("start", [10, 20], { id: "same-message-id" })); await f.service.whenIdle(); await f.advance(1);
  assert.equal(f.service.handle(f.frame("start", [10, 20], { id: "same-message-id", battleId: "another-battle" })), true);
  await f.service.whenIdle(); assert.deepEqual(f.calls, ["battleStart", "battleStart"]);
});

test("cohébergement : changement de profil ou d'équipe invalide une sortie asynchrone déjà préparée", async () => {
  for (const change of ["profile", "team"]) {
    const f = fixture(); f.save(change === "profile" ? "battleStart" : "lead"); let release, checked;
    f.actionRunner.run = async (_action, context) => { await new Promise((resolve) => { release = resolve; }); checked = context.shouldExecute(); return { executed: checked }; };
    f.service.handle(f.frame());
    await Promise.resolve();
    if (change === "team") f.service.handle(f.frame("update", [30, 20]));
    assert.equal(typeof release, "function");
    if (change === "profile") f.state.session.profileId = "new-profile";
    else {
      const changed = f.frame("update"); changed.teams[0].participantIds = ["1", "5"];
      changed.participants.push({ id: "5", username: "new-ally", teamId: "a", score: 0 }); f.service.handle(changed);
    }
    release(); await f.service.whenIdle(); assert.equal(checked, false, change); assert.equal(f.calls.length, 0, change);
  }
});

test("quatre cohosts sans équipes explicites ne sont jamais additionnés en un faux duel", async () => {
  const f = fixture(); f.save("battleStart"); f.save("lead"); f.save("victory"); f.save("snipe");
  f.service.handle(f.frame("start", [], { teams: [] })); await f.service.whenIdle();
  f.service.handle(f.frame("end", [], { teams: [] })); await f.service.whenIdle();
  assert.deepEqual(f.calls, ["battleStart"]); assert.equal(f.state.matchSession.result, null); assert.equal(f.state.matchSession.session.wins, 0);
});

test("cohébergement : les nouveaux scores et donateurs n'annulent pas une animation asynchrone de la même équipe", async () => {
  const f = fixture(); f.save("battleStart"); let release, checked;
  f.actionRunner.run = async (_action, context) => { await new Promise((resolve) => { release = resolve; }); checked = context.shouldExecute(); return { executed: checked }; };
  f.service.handle(f.frame());
  const update = f.frame("update", [20, 30]); update.teams[0].donors = [{ id: "new-donor", username: "viewer", score: 10, diamonds: 10 }];
  update.teams[0].participantIds.reverse(); f.service.handle(update);
  release(); await f.service.whenIdle(); assert.equal(checked, true); assert.equal(f.activity.length, 1);
});

test("cohébergement : le résultat individuel ne contredit pas le résultat certifié de l'équipe", async () => {
  const f = fixture(); f.save("victory"); f.save("defeat"); f.service.handle(f.frame());
  const end = f.frame("end", [100, 200]); end.participants[0].result = "win"; end.participants[0].score = 9999;
  end.teams[0].result = "lose"; end.teams[1].result = "win";
  f.service.handle(end); await f.service.whenIdle();
  assert.equal(f.state.matchSession.result, "lose"); assert.deepEqual(f.calls, ["defeat"]);
});

test("contrat d'équipe borné : absence distincte de zéro, IDs uniques, aucun indicateur own importé", () => {
  const teams = normalizeMatchTeams([
    { id: "0", participantIds: ["1"], score: 100 },
    { id: "a", participantIds: ["1", "1", "0", "2"], score: "0", own: true, result: "other" },
    { id: "a", participantIds: ["3"], score: 999 },
    { id: "b", participantIds: Array.from({ length: 20 }, (_, index) => String(index + 3)), score: false },
    { id: "c", score: " " }
  ]);
  assert.deepEqual(teams.map((row) => row.id), ["a", "b", "c"]);
  assert.deepEqual(teams[0].participantIds, ["1", "2"]); assert.equal(teams[0].score, 0); assert.equal(teams[0].result, null);
  assert.equal(teams[0].own, undefined); assert.equal(teams[1].score, null); assert.equal(teams[2].score, null); assert.equal(teams[1].participantIds.length, 8);
});

test("cohébergement 1v1 : deux équipes d'une personne utilisent leurs vrais totaux, pas un score personnel divergent", async () => {
  const f = fixture(); f.save("lead"); f.save("victory");
  const frame = (phase, scores) => {
    const row = f.frame(phase, scores);
    row.participants = row.participants.filter((person) => ["1", "3"].includes(person.id));
    row.teams[0].participantIds = ["1"]; row.teams[1].participantIds = ["3"];
    return row;
  };
  f.service.handle(frame("start", [10, 20])); f.service.handle(frame("update", [30, 20])); await f.service.whenIdle();
  f.service.handle(frame("end", [30, 20])); await f.service.whenIdle();
  assert.deepEqual(f.calls, ["lead", "victory"]); assert.equal(f.state.matchSession.session.wins, 1);
  assert.equal(f.state.matchSession.participants.find((person) => person.own).score, 1);
  assert.deepEqual(f.state.matchSession.rounds, { own: null, opponent: null }, "Une équipe n'est pas réutilisée comme identifiant de paire historique");
});

test("cohébergement 1v1 sans équipes : les scores individuels courants restent compatibles, jamais ceux du cache à la fin", async () => {
  const f = fixture(); f.save("lead"); f.save("victory");
  const frame = (phase, scores) => {
    const row = f.frame(phase, [], { teams: [] });
    row.participants = row.participants.filter((person) => ["1", "3"].includes(person.id)).map((person, index) => ({ ...person, score: scores[index] }));
    return row;
  };
  f.service.handle(frame("start", [10, 20])); f.service.handle(frame("update", [30, 20])); await f.service.whenIdle();
  f.service.handle({ ...frame("end", [30, 20]), participants: [] }); await f.service.whenIdle();
  assert.deepEqual(f.calls, ["lead"]); assert.equal(f.state.matchSession.result, null);
  f.service.handle(frame("end", [30, 20])); await f.service.whenIdle();
  assert.deepEqual(f.calls, ["lead", "victory"]); assert.equal(f.state.matchSession.session.wins, 1);
});

test("une décision asynchrone sans équipes devient périmée si le même match acquiert une composition d'équipes", async () => {
  const f = fixture(); f.save("lead"); let release, checked;
  f.actionRunner.run = async (_action, context) => { await new Promise((resolve) => { release = resolve; }); checked = context.shouldExecute(); return { executed: checked }; };
  const start = f.frame("start", [], { teams: [] }); start.participants = start.participants.filter((person) => ["1", "3"].includes(person.id)).map((person, index) => ({ ...person, score: index ? 20 : 10 }));
  f.service.handle(start);
  await f.service.whenIdle();
  f.service.handle({ ...start, id: "lead-update", phase: "update", participants: start.participants.map((person, index) => ({ ...person, score: index ? 20 : 30 })) });
  const update = f.frame("update"); update.participants = start.participants;
  update.teams[0].participantIds = ["1"]; update.teams[1].participantIds = ["3"]; f.service.handle(update);
  release(); await f.service.whenIdle(); assert.equal(checked, false);
});

test("un changement de composition n'est pas une remontée des mêmes équipes", async () => {
  const f = fixture(); f.save("lead"); f.save("comeback", { threshold: 1 }); f.service.handle(f.frame("start", [10, 20]));
  const changed = f.frame("update", [30, 20]); changed.teams[0].participantIds = ["1", "5"];
  changed.participants.push({ id: "5", username: "new-ally", score: 20, teamId: "a" }); f.service.handle(changed);
  await f.service.whenIdle(); assert.equal(f.calls.length, 0);
});

test("cohébergement 1v1 : UPDATE avant OPEN déclenche le vrai début à l'arrivée d'OPEN, exactement une fois", async () => {
  for (const hasTeams of [false, true]) {
    const f = fixture(); f.save("battleStart", { cooldownMs: 0 }); const startsAtMs = f.now();
    const frame = (phase) => {
      const row = f.frame(phase, [10, 20], { startsAtMs, endsAtMs: startsAtMs + 120000 });
      row.participants = row.participants.filter((person) => ["1", "3"].includes(person.id));
      row.teams = hasTeams ? row.teams.map((team, index) => ({ ...team, participantIds: [index ? "3" : "1"] })) : [];
      return row;
    };
    f.service.handle(frame("update")); await f.service.whenIdle();
    assert.equal(f.calls.length, 0, "Des scores seuls n'inventent jamais l'événement début");
    f.service.handle(frame("start")); await f.service.whenIdle();
    assert.deepEqual(f.calls, ["battleStart"], `teams=${hasTeams}`);
    assert.equal(f.state.matchSession.startObserved, true); assert.equal(f.state.matchSession.session.battles, 1);
    await f.advance(6000); f.service.handle(frame("start")); await f.service.whenIdle();
    assert.deepEqual(f.calls, ["battleStart"], "Même un autre msgId après le cooldown ne répète pas OPEN");
  }
});

test("la première composition d'équipe n'annule pas début, multiplicateur, snipe ou rafale de likes asynchrones", async () => {
  for (const moment of ["battleStart", "multiplierX2", "multiplierX3", "snipe", "likeRush"]) {
    const f = fixture(); f.save(moment, { remainingSeconds: 120, threshold: 1 }); let release, checked;
    f.actionRunner.run = async (_action, context) => { await new Promise((resolve) => { release = resolve; }); checked = context.shouldExecute(); return { executed: checked }; };
    const start = f.frame("start", [], { teams: [] }); start.participants = start.participants.filter((person) => ["1", "3"].includes(person.id));
    f.service.handle(start);
    await Promise.resolve();
    if (moment.startsWith("multiplier")) {
      f.service.handle({ ...start, phase: "task", id: "bonus-announce", bonus: { stage: "announced", multiplier: Number(moment.at(-1)), startsAtMs: f.now(), durationMs: 10000, periodKey: "" } });
      f.service.handle({ ...start, phase: "task", id: "bonus-earned", bonus: { stage: "settled", multiplier: null, startsAtMs: f.now(), durationMs: 0, result: "success", periodKey: "" } });
    }
    if (moment === "likeRush") f.service.handleLiveEvent({ source: "source_tiktok", type: "like", user: { id: "viewer", name: "viewer" }, data: { count: 1 } });
    assert.equal(typeof release, "function", moment);
    const update = f.frame("update"); update.participants = start.participants; update.teams[0].participantIds = ["1"]; update.teams[1].participantIds = ["3"];
    f.service.handle(update); release(); await f.service.whenIdle(); assert.equal(checked, true, moment);
  }
});

test("OPEN retardé après fin ou annulation ne joue pas le début du match terminé", async () => {
  for (const phase of ["end", "cancel"]) {
    const f = fixture(); f.save("battleStart"); f.service.handle(f.frame("update")); f.service.handle(f.frame(phase));
    assert.equal(f.service.handle(f.frame("start")), false); await f.service.whenIdle(); assert.equal(f.calls.length, 0, phase);
  }
});

test("un nouveau match récent peut être repris par ses seuls totaux d'équipe, sans fabriquer un OPEN", async () => {
  const f = fixture(); f.save("battleStart"); f.service.handle(f.frame()); await f.service.whenIdle(); await f.advance(130000);
  const next = f.frame("update", [100, 200], { battleId: "next-battle", participants: [], startsAtMs: f.now() - 10000 });
  assert.equal(f.service.handle(next), true); await f.service.whenIdle();
  assert.equal(f.state.matchSession.battleId, "next-battle"); assert.equal(f.state.matchSession.startObserved, false);
  assert.deepEqual(f.calls, ["battleStart"]);
});

test("des premiers scores récents prouvent un début pendant un LIVE établi, une fois même si OPEN arrive ensuite", async () => {
  for (const hasTeams of [false, true]) {
    for (const age of [0, 10000]) {
      const f = fixture(); f.save("battleStart", { cooldownMs: 0 });
      f.state.session.startedAt = new Date(f.now() - 60000).toISOString();
      const row = f.frame("update", [10, 20], { startsAtMs: f.now() - age });
      row.participants = row.participants.filter((person) => ["1", "3"].includes(person.id));
      row.teams = hasTeams ? row.teams.map((team, index) => ({ ...team, participantIds: [index ? "3" : "1"] })) : [];
      f.service.handle(row); await f.service.whenIdle();
      assert.deepEqual(f.calls, ["battleStart"], `teams=${hasTeams}, age=${age}`);
      assert.equal(f.state.matchSession.startOrigin, "recent-scores");
      f.service.handle({ ...row, id: "real-open", phase: "start" }); await f.service.whenIdle();
      await f.advance(6000); f.service.handle({ ...row, id: "late-open", phase: "start" }); await f.service.whenIdle();
      assert.deepEqual(f.calls, ["battleStart"], "Le vrai OPEN tardif ne répète pas le début déjà observé");
    }
  }
});

test("les scores de reconnexion ou sans preuve temporelle ne simulent jamais le début", async () => {
  const cases = {
    noStart: (_f, row) => { row.startsAtMs = 0; },
    oldStart: (f, row) => { row.startsAtMs = f.now() - 10001; },
    futureStart: (f, row) => { row.startsAtMs = f.now() + 1; },
    ended: (f, row) => { row.endsAtMs = f.now(); },
    noEnd: (_f, row) => { row.endsAtMs = 0; },
    noLiveDate: (f) => { delete f.state.session.startedAt; },
    invalidLiveDate: (f) => { f.state.session.startedAt = "fixture"; },
    reconnectedAfterStart: (f, row) => { row.startsAtMs = f.now() - 5000; f.state.session.startedAt = new Date(f.now() - 1000).toISOString(); },
    noScores: (_f, row) => { row.participants.forEach((person) => { person.score = null; }); row.teams.forEach((team) => { team.score = null; }); },
    wrongRoom: (_f, row) => { row.roomId = "other-room"; },
    offline: (f) => { f.state.settings.tiktok.status = "offline"; },
    stopped: (f) => { f.state.session.running = false; }
  };
  for (const [name, change] of Object.entries(cases)) {
    const f = fixture(); f.save("battleStart"); f.state.session.startedAt = new Date(f.now() - 60000).toISOString();
    const row = f.frame("update", [10, 20], { startsAtMs: f.now() - 1000 }); change(f, row);
    f.service.handle(row); await f.service.whenIdle(); assert.equal(f.calls.length, 0, name); assert.notEqual(f.state.matchSession.startObserved, true, name);
  }
});

test("une preuve ajoutée à un UPDATE ultérieur ne réinterprète pas le premier paquet comme un nouveau début", async () => {
  const f = fixture(); f.save("battleStart"); const first = f.frame("update");
  f.service.handle(first); await f.service.whenIdle(); assert.equal(f.calls.length, 0);
  f.state.session.startedAt = new Date(f.now() - 60000).toISOString();
  f.service.handle({ ...first, id: "next-score" }); await f.service.whenIdle(); assert.equal(f.calls.length, 0);
});
