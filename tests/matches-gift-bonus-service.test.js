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
    assert.deepEqual(f.state.matchSession, before, "No fictitious duration, multiplier, scores or gift contribution is persisted");
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
  assert.equal(f.gift(3), false, "Another gift or multiplier is not proof of a distinct timed period");
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
  assert.equal(f.gift(2), false); await f.advance(50000); assert.equal(f.gift(3), false);
  assert.equal(f.calls.length, 2);
});

test("un bonus classique déjà actif ou déjà joué supprime le secours par cadeau", async (context) => {
  const f = fixture(context); f.open(); f.earn(3); await f.advance(1000);
  assert.equal(f.gift(3), false); assert.equal(f.gift(2), false);
  await f.advance(60000); assert.equal(f.gift(2), false); await f.service.whenIdle();
  assert.deepEqual(f.calls.map((row) => row.moment), ["multiplierX3"]);
  assert.equal(f.service.bonuses.giftProof, null);
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
