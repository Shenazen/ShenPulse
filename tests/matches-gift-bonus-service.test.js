"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const sdk = require("tiktok-live-connector");
const { MatchesService } = require("../src/main/matches/service");
const { normalizeTikTokGiftBonus } = require("../src/main/matches/tiktok-gift-bonus");
const { selectStatePaths } = require("../src/main/state-projection");
const { normalizeMatchesConfig, createMatchSession } = require("../src/shared/matches-contract");

// These are the semantic output frames of the dedicated gift adapter, not
// invented TikTok task packets or simulated LIVE contributions.
const OWN = "9007199254740993123", RIVAL = "9007199254740993456";
function fixture(context, { holdEffect } = {}) {
  let now = 1790000000000, sequence = 0;
  const timers = new Set(), calls = [], contexts = [];
  const state = {
    settings: { account: { uid: "gift-bonus-fixture", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
      tiktok: { username: "creator", roomId: "8080", status: "live", broadcaster: { userId: OWN, username: "creator" } },
      siteVisibility: {}, matches: normalizeMatchesConfig(), overlayConfigs: {} },
    session: { running: true, profileId: "gift-bonus-profile", startedAt: new Date(now).toISOString() },
    commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: createMatchSession(), profiles: [], rules: []
  };
  const store = {
    getStateProjection: (paths) => selectStatePaths(state, paths), getAccountSession: () => state.settings.account,
    getSecret: () => "fixture-only", mutate: (callback) => callback(state), mutateRuntime: (callback) => callback(state)
  };
  const service = new MatchesService({ store, now: () => now,
    actionRunner: { run: async (_action, event) => {
      contexts.push(event);
      if (holdEffect) await holdEffect;
      if (event.shouldExecute()) calls.push({ moment: event.data.moment, at: now });
      return { executed: true };
    } },
    setTimeoutImpl: (callback, delay) => { const timer = { at: now + delay, callback, unref() {} }; timers.add(timer); return timer; },
    clearTimeoutImpl: (timer) => timers.delete(timer)
  });
  context.after(() => service.reset());
  for (const moment of ["multiplierX2", "multiplierX3"]) service.saveAutomation({
    id: moment, name: moment, moment, enabled: true, cooldownMs: 60000,
    reaction: { type: "sound", url: "https://media.example.invalid/fixture.mp3" }
  });
  const frame = (phase, extra = {}) => ({ source: "source_tiktok", phase, id: String(++sequence),
    roomId: "8080", channelUsername: "creator", receivedAtMs: now, battleId: "9001", ...extra });
  const open = (extra = {}) => service.handle(frame("start", { startsAtMs: now, endsAtMs: now + 301000,
    participants: [{ id: OWN, username: "creator", score: 0 }, { id: RIVAL, username: "rival", score: 0 }], ...extra }));
  const giftFrame = (multiplier = 2, extra = {}) => ({ source: "source_tiktok", phase: "gift-bonus", id: String(++sequence),
    roomId: "8080", channelUsername: "creator", receivedAtMs: now, createdAtMs: now,
    giftBonus: { multiplier, recipientIds: [OWN] }, ...extra });
  const gift = (multiplier = 2, extra) => service.handle(giftFrame(multiplier, extra));
  const earn = (multiplier, startsAtMs = now + 1000, durationMs = 50000) => {
    service.handle(frame("task", { bonus: { stage: "announced", multiplier, startsAtMs, durationMs, result: "unknown" } }));
    service.handle(frame("task", { bonus: { stage: "settled", multiplier: null, startsAtMs, durationMs: 0, result: "success" } }));
  };
  const advance = async (milliseconds) => {
    const target = now + milliseconds;
    for (let i = 0; i < 1000; i += 1) {
      const timer = [...timers].filter((row) => row.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!timer) { now = target; await service.whenIdle(); return; }
      now = timer.at; timers.delete(timer); timer.callback(); await service.whenIdle();
    }
    throw new Error("Gift bonus fixture timer loop is unexpectedly unbounded");
  };
  return { state, service, calls, contexts, frame, open, giftFrame, gift, earn, advance,
    now: () => now, shiftClock: (milliseconds) => { now += milliseconds; } };
}

test("cadeau multiplié propre : aucun bonus inventé, puis sa vraie valeur ×2 ou ×3 est jouée immédiatement", async (context) => {
  for (const multiplier of [2, 3]) {
    const f = fixture(context); f.open(); await f.advance(23000);
    assert.deepEqual(f.calls, [], "Elapsed time alone cannot prove any bonus");
    const before = structuredClone(f.state.matchSession);
    assert.equal(f.gift(multiplier), true); await f.service.whenIdle();
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: f.now() }]);
    assert.deepEqual(f.state.matchSession, { ...before, multiplierObservation: { value: multiplier, observedAtMs: f.now(), expiresAtMs: f.now() + 6000 } },
      "Only a labelled instantaneous observation is recorded, never a fictitious active multiplier or duration");
    assert.equal(f.service.bonuses.periods.size, 0, "A multiplied gift does not manufacture a task reward period");
    assert.equal(f.service.bonuses.giftProof.expiresAtMs, f.now() + 5000, "This is only a short execution proof, not a bonus duration");
  }
});

test("vrai codec cadeau SDK puis adaptateur puis service : la valeur créditée déclenche sans attendre la fin de série", async (context) => {
  const blank = (name, value = {}) => ({ ...sdk[name].decode(new Uint8Array()), ...value });
  for (const multiplier of [2, 3]) {
    const f = fixture(context); f.open(); await f.advance(20000);
    const data = blank("WebcastGiftMessage", {
      common: blank("CommonMessageData", { msgId: "6001", roomId: "8080", createTime: String(f.now() + 2385) }),
      giftType: 1, repeatEnd: 0, repeatCount: 1,
      giftExtra: blank("WebcastGiftMessage_GiftMonitorInfo", { toUserId: OWN }),
      matchInfo: blank("WebcastGiftMessage_MatchInfo", { multiplierType: 0, multiplierValue: String(multiplier),
        critical: "0", effectCardInUse: false })
    });
    const decoded = sdk.WebcastGiftMessage.decode(sdk.WebcastGiftMessage.encode(data).finish());
    const observed = normalizeTikTokGiftBonus(decoded, { roomId: "8080", channelUsername: "creator", receivedAtMs: f.now(), clockOffsetMs: 2385 });
    assert.ok(observed); assert.equal("battleId" in observed, false); assert.equal(observed.createdAtMs, f.now());
    assert.equal(f.service.handle({ ...observed, source: "source_tiktok" }), true);
    await f.service.whenIdle();
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: f.now() }]);
    assert.equal(f.state.matchSession.multiplier, 1);
    assert.equal(f.state.matchSession.liveContributors.length, 0, "The proof path never double-counts the ordinary gift");
  }
});

test("aucun cadeau boosté explicite : aucune valeur absente, ×1 ou inconnue ne déclenche une animation", async (context) => {
  for (const multiplier of [undefined, null, 0, 1, 4, "2", "3", NaN, Infinity]) {
    const f = fixture(context); f.open();
    const frame = f.giftFrame(); frame.giftBonus.multiplier = multiplier;
    assert.equal(f.service.handle(frame), false); await f.service.whenIdle(); assert.deepEqual(f.calls, []);
  }
});

test("le premier cadeau boosté ne se rejoue ni à la duplication ni après expiration des cinq secondes", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000);
  const packet = f.giftFrame(2);
  assert.equal(f.service.handle(packet), true); await f.service.whenIdle();
  assert.equal(f.service.handle(packet), false);
  assert.equal(f.gift(2), false, "Repeated credited gifts are not a distinct reward cycle");
  const key = f.service.bonuses.giftProof.key;
  await f.advance(5000); assert.equal(f.service.bonuses.isActive(key), false);
  assert.equal(f.gift(2), false); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
});

test("premier bonus inconnu puis bonus classique connu de même valeur : chacun joue une fois", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000);
  assert.equal(f.gift(2), true); await f.service.whenIdle();
  f.earn(2, f.now() + 30000); await f.advance(30000);
  assert.deepEqual(f.calls.map((row) => row.moment), ["multiplierX2", "multiplierX2"],
    "The known second period has its own key, not the first observed gift's cooldown");
  assert.equal(f.gift(2), false); await f.advance(50000); assert.equal(f.gift(2), false);
  assert.equal(f.calls.length, 2);
});

test("un bonus actif exclut le secours ; un multiplicateur différent reste détectable ensuite", async (context) => {
  const f = fixture(context); f.open(); f.earn(3); await f.advance(1000);
  assert.equal(f.gift(3), false); assert.equal(f.gift(2), false);
  await f.advance(60000); assert.equal(f.gift(3), false); assert.equal(f.gift(2), true); await f.service.whenIdle();
  assert.deepEqual(f.calls.map((row) => row.moment), ["multiplierX3", "multiplierX2"]);
});

test("le rattrapage d'une échéance connue joue sa vraie période avant d'écarter le secours cadeau", async (context) => {
  const f = fixture(context); f.open(); f.earn(2); f.shiftClock(1500);
  assert.deepEqual(f.calls, []);
  assert.equal(f.gift(2), false); await f.service.whenIdle();
  assert.deepEqual(f.calls, [{ moment: "multiplierX2", at: f.now() }]);
  assert.equal(f.service.bonuses.giftProof, null);
});

test("le destinataire doit être uniquement l'UID propre exact vérifié, jamais celui du rival ou arrondi", async (context) => {
  for (const recipientIds of [undefined, null, [], [RIVAL], [OWN, RIVAL], ["0"], [""], [Number(OWN)],
    ["09007199254740993123"], ["creator"], [null], Array(17).fill(OWN)]) {
    const f = fixture(context); f.open();
    assert.equal(f.gift(2, { giftBonus: { multiplier: 2, recipientIds } }), false);
    await f.service.whenIdle(); assert.deepEqual(f.calls, []);
  }
  const f = fixture(context); f.open();
  assert.equal(f.gift(2, { giftBonus: { multiplier: 2, recipientIds: [OWN, OWN] } }), true);
  await f.service.whenIdle(); assert.equal(f.calls.length, 1);
});

test("les deux dates sont locales, fraîches et comprises dans le match courant avec tolérance de seconde protobuf", async (context) => {
  for (const change of [f => ({ receivedAtMs: f.now() - 5001 }), f => ({ receivedAtMs: f.now() + 1 }),
    f => ({ createdAtMs: f.now() - 5001 }), f => ({ createdAtMs: f.now() + 1001 }),
    () => ({ createdAtMs: "1790000000000" }), () => ({ receivedAtMs: 0 }),
    () => ({ createdAtMs: NaN }), f => ({ createdAtMs: f.now() - 5000 })]) {
    const f = fixture(context); f.open(); await f.advance(20000);
    assert.equal(f.gift(2, change(f)), false); await f.service.whenIdle(); assert.deepEqual(f.calls, []);
  }
  const f = fixture(context); f.open();
  assert.equal(f.gift(3, { createdAtMs: f.now() - 1001 }), false, "An older match's gift cannot attach to the new battle");
  assert.equal(f.gift(3, { createdAtMs: f.now() - 1000 }), true); await f.service.whenIdle();
  assert.equal(f.calls.length, 1);
});

test("source, salle, chaîne, compte, profil, droits, UID et match actif sont tous obligatoires", async (context) => {
  const cases = [
    f => { delete f.state.settings.tiktok.broadcaster.userId; },
    f => { f.state.settings.tiktok.broadcaster.userId = RIVAL; },
    f => { f.state.settings.account = {}; },
    f => { f.state.commerce.subscription = { tier: "free", status: "active" }; },
    f => { f.state.session.profileId = "other-profile"; },
    f => { f.state.session.running = false; },
    f => { f.state.settings.tiktok.status = "disconnected"; },
    f => { f.state.matchSession.status = "finished"; },
    f => { f.state.matchSession.endsAtMs = f.now(); },
    f => { f.state.matchSession.startedAtMs = 0; },
    f => { f.state.settings.tiktok.username = ""; }
  ];
  for (const mutate of cases) {
    const f = fixture(context); f.open(); mutate(f);
    assert.equal(f.gift(2), false); await f.service.whenIdle(); assert.deepEqual(f.calls, []);
  }
  for (const change of [{ source: undefined }, { source: "source_kick" }, { roomId: "" }, { roomId: "other" },
    { channelUsername: "" }, { channelUsername: "@" }, { channelUsername: "rival" }, { test: true }, { battleId: "9002" }]) {
    const f = fixture(context); f.open(); assert.equal(f.gift(2, change), false);
    await f.service.whenIdle(); assert.deepEqual(f.calls, []);
  }
  const f = fixture(context); assert.equal(f.gift(2), false, "A gift never creates a match");
});

test("une preuve courte en attente ne traverse ni expiration, reconnexion, compte, profil, UID, équipe ou nouvelle manche", async (context) => {
  const cases = [
    f => { f.shiftClock(5000); },
    f => { f.service.disconnect(); },
    f => { f.service.reset(); },
    f => { f.state.settings.account.uid = "other-account"; },
    f => { f.state.session.profileId = "other-profile"; },
    f => { f.state.settings.tiktok.broadcaster.userId = RIVAL; },
    f => { f.state.matchSession.endsAtMs = f.now(); },
    f => { f.state.matchSession.teams = [{ id: "team-own", own: true, participantIds: [OWN] },
      { id: "team-rival", own: false, participantIds: [RIVAL] }]; },
    f => { f.open({ battleId: "9002" }); }
  ];
  for (const mutate of cases) {
    let release;
    const wait = new Promise((resolve) => { release = resolve; });
    const f = fixture(context, { holdEffect: wait }); f.open(); await f.advance(20000);
    assert.equal(f.gift(2), true); assert.equal(f.contexts.length, 1);
    const key = f.service.bonuses.giftProof.key;
    mutate(f); assert.equal(f.service.bonuses.isActive(key), false);
    release(); await f.service.whenIdle(); assert.deepEqual(f.calls, []);
  }
});

test("une annonce valide puis un cadeau crédité confirme la période sans attendre SETTLE", async (context) => {
  for (const multiplier of [2, 3]) {
    const f = fixture(context); f.open();
    const start = f.now() + 20000;
    f.service.handle(f.frame("task", { bonus: { stage: "announced", multiplier, startsAtMs: start, durationMs: 30000, result: "unknown" } }));
    await f.advance(21000);
    assert.equal(f.state.matchSession.multiplier, 1);
    assert.equal(f.gift(multiplier), true); await f.service.whenIdle();
    assert.equal(f.state.matchSession.multiplier, multiplier);
    assert.deepEqual(f.calls, [{ moment: `multiplierX${multiplier}`, at: f.now() }]);
    assert.equal(f.service.bonuses.giftProof, null, "La durée vient de l'annonce, aucune durée de cadeau inventée");
    // Un règlement tardif et sa répétition ne rejouent pas l'animation.
    f.service.handle(f.frame("task", { bonus: { stage: "settled", multiplier: null, startsAtMs: start, durationMs: 0, result: "success" } }));
    await f.advance(29000);
    assert.equal(f.state.matchSession.multiplier, 1);
    assert.equal(f.calls.length, 1);
  }
});

test("les cadeaux confirment aussi une seconde période annoncée après une première déjà jouée", async (context) => {
  const f = fixture(context); f.open();
  f.gift(2); await f.service.whenIdle(); await f.advance(6000);
  const start = f.now() + 1000;
  f.service.handle(f.frame("task", { bonus: { stage: "announced", multiplier: 3, startsAtMs: start, durationMs: 10000, result: "unknown" } }));
  await f.advance(1500); assert.equal(f.gift(3), true); await f.service.whenIdle();
  assert.equal(f.state.matchSession.multiplier, 3);
  assert.deepEqual(f.calls.map(row => row.moment), ["multiplierX2", "multiplierX3"]);
  await f.advance(9500); assert.equal(f.state.matchSession.multiplier, 1);
});

test("une valeur incompatible, future, ambiguë, terminée ou d'une autre équipe ne confirme jamais la prévision", async (context) => {
  for (const change of ["future", "different", "expired", "failed", "ambiguous", "team"]) {
    const f = fixture(context); f.open();
    const start = f.now() + 10000;
    const bonus = { stage: "announced", multiplier: 2, startsAtMs: start, durationMs: 20000, result: "unknown" };
    f.service.handle(f.frame("task", { bonus }));
    if (change === "ambiguous") f.service.handle(f.frame("task", { bonus: { ...bonus, startsAtMs: start + 1000 } }));
    if (change === "failed") f.service.handle(f.frame("task", { bonus: { stage: "settled", startsAtMs: start, result: "failed" } }));
    await f.advance(change === "future" ? 9000 : change === "expired" ? 31000 : 12000);
    if (change === "team") f.state.matchSession.teams = [{ id: "own-team", own: true, participantIds: [OWN] }];
    f.gift(change === "different" ? 3 : 2); await f.service.whenIdle();
    assert.equal(f.state.matchSession.multiplier, 1, change);
    assert.equal([...f.service.bonuses.periods.values()].some(row => row.result === "success"), false, change);
  }
});

test("un règlement sans horaire peut invalider la période confirmée par cadeau sans la ressusciter", async (context) => {
  const f = fixture(context); f.open(); const start = f.now() + 10000;
  f.service.handle(f.frame("task", { bonus: { stage: "announced", multiplier: 2, startsAtMs: start, durationMs: 30000, result: "unknown" } }));
  await f.advance(11000); f.gift(2); await f.service.whenIdle();
  assert.equal(f.state.matchSession.multiplier, 2);
  f.service.handle(f.frame("task", { bonus: { stage: "settled", startsAtMs: 0, durationMs: 0, result: "failed" } }));
  assert.equal(f.state.matchSession.multiplier, 1);
  f.gift(2); await f.service.whenIdle();
  assert.equal(f.state.matchSession.multiplier, 1);
});

test("la confirmation anticipée utilise les vrais codecs tâche/cadeau et la fin réglementaire hors prolongation", async (context) => {
  const f = fixture(context), blank = (name, value = {}) => ({ ...sdk[name].decode(new Uint8Array()), ...value });
  const { normalizeTikTokBattle } = require("../src/main/matches/tiktok-battle");
  f.open({ bonusEndsAtMs: f.now() + 300000, endsAtMs: f.now() + 330000 });
  const prefix = "WebcastLinkmicBattleTaskMessage_BattleTaskStart";
  const raw = blank("WebcastLinkmicBattleTaskMessage", {
    common: blank("CommonMessageData", { roomId: "8080", msgId: "8881" }),
    battleId: "9001", battleTaskMessageType: 0,
    taskStart: blank(prefix, { battleBonusConfig: blank(prefix + "_BattleBonusConfig", {
      rewardPeriodConfig: blank(prefix + "_BattleBonusConfig_RewardPeriodConfig",
        { rewardMultiple: 2, duration: "30", rewardStartTime: "280", rewardStartTimestamp: String((f.now() + 59000) / 1000) })
    }) })
  });
  const task = sdk.WebcastLinkmicBattleTaskMessage.decode(sdk.WebcastLinkmicBattleTaskMessage.encode(raw).finish());
  f.service.handle({ ...normalizeTikTokBattle("linkMicBattleTask", task, { roomId: "8080", channelUsername: "creator", receivedAtMs: f.now() }), source: "source_tiktok" });
  await f.advance(21000);
  const gift = blank("WebcastGiftMessage", {
    common: blank("CommonMessageData", { roomId: "8080", msgId: "8882", createTime: String(f.now()) }),
    giftExtra: blank("WebcastGiftMessage_GiftMonitorInfo", { toUserId: OWN }),
    matchInfo: blank("WebcastGiftMessage_MatchInfo", { multiplierValue: "2", multiplierType: 0, critical: "0", effectCardInUse: false })
  });
  const data = sdk.WebcastGiftMessage.decode(sdk.WebcastGiftMessage.encode(gift).finish());
  f.service.handle({ ...normalizeTikTokGiftBonus(data, { roomId: "8080", channelUsername: "creator", receivedAtMs: f.now() }), source: "source_tiktok" });
  await f.service.whenIdle();
  assert.equal(f.state.matchSession.multiplier, 2);
  assert.equal(f.calls.length, 1);
  await f.advance(29000); assert.equal(f.state.matchSession.multiplier, 1);
});

test("la preuve de cadeau peut être affichée sans durée inventée et ne recule pas avec un paquet retardé", async (context) => {
  const f = fixture(context); f.open(); await f.advance(20000);
  f.gift(2); await f.service.whenIdle();
  assert.deepEqual(f.state.matchSession.multiplierObservation, { value: 2, observedAtMs: f.now(), expiresAtMs: f.now() + 6000 });
  await f.advance(1000);
  f.gift(3, { createdAtMs: f.now() - 2000 }); await f.service.whenIdle();
  assert.deepEqual(f.state.matchSession.multiplierObservation, { value: 2, observedAtMs: f.now() - 1000, expiresAtMs: f.now() + 5000 });
  f.gift(3); await f.service.whenIdle();
  assert.deepEqual(f.state.matchSession.multiplierObservation, { value: 3, observedAtMs: f.now(), expiresAtMs: f.now() + 6000 });
  assert.equal(f.state.matchSession.multiplier, 1);
  assert.equal(f.calls.length, 2, "Chaque valeur joue une seule fois : le ×3 suivant ne reste pas bloqué par ×2");
  f.service.disconnect();
  assert.equal(f.state.matchSession.multiplierObservation, null);
});

test("une confirmation anticipée en file attend encore les droits et l'identité au moment d'exécuter", async (context) => {
  for (const change of ["account", "profile", "owner", "team", "expired", "disconnect", "free"]) {
    let release; const wait = new Promise(resolve => { release = resolve; });
    const f = fixture(context, { holdEffect: wait }); f.open();
    const start = f.now() + 10000;
    f.service.handle(f.frame("task", { bonus: { stage: "announced", multiplier: 2, startsAtMs: start, durationMs: 20000, result: "unknown" } }));
    await f.advance(11000);
    f.gift(2); assert.equal(f.state.matchSession.multiplier, 2);
    if (change === "account") f.state.settings.account.uid = "different";
    if (change === "profile") f.state.session.profileId = "different";
    if (change === "owner") f.state.settings.tiktok.broadcaster.userId = RIVAL;
    if (change === "team") f.state.matchSession.teams = [{ id: "different", own: true, participantIds: [OWN] }];
    if (change === "expired") f.shiftClock(20000);
    if (change === "disconnect") f.service.disconnect();
    if (change === "free") f.state.commerce.subscription = { tier: "free", status: "active" };
    release(); await f.service.whenIdle(); assert.deepEqual(f.calls, [], change);
  }
});

test("un cadeau d'un bonus actif ne confirme pas un second bonus de même valeur qui se chevauche", async (context) => {
 const f = fixture(context); f.open(); f.earn(2, f.now() + 1000, 50000);
 await f.advance(2000);
 f.service.handle(f.frame("task", { bonus: { stage: "announced", multiplier: 2, startsAtMs: f.now(), durationMs: 30000, result: "unknown" } }));
 assert.equal(f.gift(2), false); await f.service.whenIdle();
 assert.equal(f.calls.length, 1);
 assert.equal([...f.service.bonuses.periods.values()].filter(row=>row.result==="pending").length, 1);
});

test("un ancien bonus actif reçu avant OPEN ne se dédouble pas sur une nouvelle annonce chevauchante", async (context) => {
 const f = fixture(context), start = f.now() + 1000;
 f.service.handle(f.frame("task", { bonus: { stage: "announced", multiplier: 2, startsAtMs: start, durationMs: 50000, result: "unknown" } }));
 f.open();
 f.service.handle(f.frame("task", { bonus: { stage: "settled", startsAtMs: start, result: "success" } }));
 await f.advance(2000);
 f.service.handle(f.frame("task", { bonus: { stage: "announced", multiplier: 2, startsAtMs: f.now(), durationMs: 30000, result: "unknown" } }));
 assert.equal(f.gift(2), false); await f.service.whenIdle(); assert.equal(f.calls.length, 1);
});

test("sans annonce, chaque cadeau boosté propre rafraîchit l'affichage pour six secondes puis revient à ×1", async (context) => {
 const f = fixture(context); f.open(); await f.advance(20000);
 f.gift(2); await f.service.whenIdle();
 assert.deepEqual(f.state.matchSession.multiplierObservation, { value:2, observedAtMs:f.now(), expiresAtMs:f.now()+6000 });
 await f.advance(4000); assert.equal(f.state.matchSession.multiplierObservation.value,2);
 assert.equal(f.gift(2),false); await f.service.whenIdle();
 const until=f.now()+6000;
 assert.equal(f.state.matchSession.multiplierObservation.expiresAtMs,until);
 await f.advance(5999); assert.equal(f.state.matchSession.multiplierObservation.value,2);
 await f.advance(1); assert.equal(f.state.matchSession.multiplierObservation,null);
 assert.equal(f.state.matchSession.multiplier,1); assert.equal(f.calls.length,1);
});

test("un ×3 reçu après ×2 est détecté une fois lui aussi, sans inventer un cycle de durée", async (context) => {
 const f=fixture(context);f.open();await f.advance(20000);
 f.gift(2);await f.service.whenIdle();await f.advance(1000);
 assert.equal(f.gift(3),true);await f.service.whenIdle();
 assert.deepEqual(f.calls.map(r=>r.moment),["multiplierX2","multiplierX3"]);
 assert.equal(f.state.matchSession.multiplierObservation.value,3);
 assert.equal(f.gift(2),false); assert.equal(f.gift(3),false);
 await f.service.whenIdle();assert.equal(f.calls.length,2);
 assert.equal(f.service.bonuses.periods.size,0);
});

test("l'expiration d'un affichage de cadeau ne coupe jamais une vraie période reçue ensuite", async (context) => {
 const f=fixture(context);f.open();await f.advance(20000);
 f.gift(2);await f.service.whenIdle();
 f.earn(3,f.now()+1000,30000);await f.advance(1000);
 assert.equal(f.state.matchSession.multiplier,3);
 assert.equal(f.state.matchSession.multiplierObservation,null);
 await f.advance(6000);assert.equal(f.state.matchSession.multiplier,3);
 await f.advance(24000);assert.equal(f.state.matchSession.multiplier,1);
});

test("les valeurs de cadeau sont dédupliquées par manche et la mémoire se libère à la déconnexion", async (context) => {
 const f=fixture(context);f.open();await f.advance(20000);
 f.gift(2);await f.service.whenIdle();
 assert.equal(f.gift(2),false);
 f.open({battleId:"9002"});await f.advance(1000);
 assert.equal(f.gift(2),true);await f.service.whenIdle();
 assert.equal(f.calls.length,2);
 f.service.disconnect();assert.equal(f.service.bonuses.giftValues.size,0);
});

test("le timer d'affichage ne modifie jamais l'état d'un nouveau compte ou profil", async (context) => {
 for(const change of ["account","profile","battle"]){
  const f=fixture(context);f.open();await f.advance(20000);f.gift(2);await f.service.whenIdle();
  const old=f.state.matchSession.multiplierObservation;
  if(change==="account")f.state.settings.account.uid="new-account";
  if(change==="profile")f.state.session.profileId="new-profile";
  if(change==="battle")f.state.matchSession.battleId="new-battle";
  const replacement={value:3,observedAtMs:old.observedAtMs,expiresAtMs:old.expiresAtMs};
  f.state.matchSession.multiplierObservation=replacement;
  await f.advance(6000);assert.deepEqual(f.state.matchSession.multiplierObservation,replacement,change);
 }
});

test("du vrai paquet SDK au texte de la page : ×1 puis ×2 puis ×3 puis retour automatique à ×1", async (context) => {
 const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
 const f=fixture(context);f.open();await f.advance(20000);
 class TestDate extends Date { static now(){return f.now();} }
 const view=vm.createContext({ Date:TestDate, runtime:f.state.matchSession,
  ShenPulseMatches:require("../src/shared/matches-contract"),
  escapeHtml:value=>String(value).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])) });
 vm.runInContext(fs.readFileSync(path.join(__dirname,"../src/renderer/app/features/creator-matches.js"),"utf8"),view);
 const displayed=()=>{view.runtime=f.state.matchSession;return vm.runInContext("creatorMatchesMultiplierMarkup(runtime)",view).match(/>(×[^<]*)</)[1];};
 assert.equal(displayed(),"×1");
 const blank=(name,input)=>({...sdk[name].decode(new Uint8Array()),...input});
 for(const multiplier of [2,3]){
  const raw=blank("WebcastGiftMessage", {
   common:blank("CommonMessageData",{roomId:"8080",msgId:String(multiplier+8000),createTime:String(f.now())}),
   giftExtra:blank("WebcastGiftMessage_GiftMonitorInfo",{toUserId:OWN}),
   matchInfo:blank("WebcastGiftMessage_MatchInfo",{multiplierValue:String(multiplier),multiplierType:0,effectCardInUse:false,critical:"0"})
  });
  const packet=sdk.WebcastGiftMessage.decode(sdk.WebcastGiftMessage.encode(raw).finish());
  f.service.handle({...normalizeTikTokGiftBonus(packet,{roomId:"8080",channelUsername:"creator",receivedAtMs:f.now()}),source:"source_tiktok"});
  await f.service.whenIdle();assert.equal(displayed(),"×"+multiplier);
  await f.advance(1000);
 }
 await f.advance(5000);assert.equal(displayed(),"×1");
 assert.deepEqual(f.calls.map(row=>row.moment),["multiplierX2","multiplierX3"]);
});
