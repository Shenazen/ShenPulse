"use strict";

/**
 * Régression cohost : vrais codecs du SDK installé, aucun service TikTok réel.
 * Le flux SourceHub -> MatchesService reste réel. Les décisions utilisent un
 * collecteur ; les tests de début gardent même le vrai ActionRunner et arrêtent
 * la sortie dans un faux playMatch, sans jouer de média ni lancer d'action.
 * Schémas primaires : tiktok-live-connector/dist/types/tiktok-schema.d.ts,
 * WebcastLinkMicBattle, WebcastLinkMicArmies et BattleTeamUserArmies.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { EventEmitter } = require("node:events");
const sdk = require("tiktok-live-connector");
const { createDefaultState } = require("../src/main/defaults");
const { selectStatePaths } = require("../src/main/state-projection");
const { MatchesService } = require("../src/main/matches/service");
const { ActionRunner } = require("../src/main/action-runner");

const sourcePath = path.resolve(__dirname, "../src/main/source-hub.js");
const realRequire = createRequire(sourcePath);
const settled = () => new Promise((resolve) => setImmediate(resolve));
const copy = (value) => JSON.parse(JSON.stringify(value));
const empty = (codec, extra = {}) => ({ ...codec.decode(new Uint8Array()), ...extra });
const roundtrip = (codec, value) => codec.decode(codec.encode(value).finish());

function bonusPackets(rewardAt, { multiple = 2, result = 0, id = "1100", roomId = "700" } = {}) {
  const common = (suffix) => empty(sdk.CommonMessageData, { roomId, msgId: `${id}${suffix}` });
  const packet = (suffix, extra) => roundtrip(sdk.WebcastLinkmicBattleTaskMessage, empty(sdk.WebcastLinkmicBattleTaskMessage, {
    common: common(suffix), battleId: "900", ...extra
  }));
  return {
    announced: packet("1", { battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_START,
      taskStart: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart, {
        battleBonusConfig: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig, {
          rewardPeriodConfig: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskStart_BattleBonusConfig_RewardPeriodConfig, {
            rewardMultiple: multiple, duration: "20", rewardStartTimestamp: String(rewardAt)
          })
        })
      }) }),
    settled: packet("2", { battleTaskMessageType: sdk.BattleTaskMessageType.BATTLE_TASK_MESSAGE_TYPE_TASK_SETTLE,
      taskSettle: empty(sdk.WebcastLinkmicBattleTaskMessage_BattleTaskSettle, { taskResult: result, rewardStartTimestamp: String(rewardAt) }) })
  };
}

function cohostPackets(membersPerTeam = 2) {
  const now = Date.now();
  const common = (id) => empty(sdk.CommonMessageData, { msgId: id, roomId: "700" });
  const member = (id, score) => empty(sdk.BattleTeamUser, { userId: id, userIdStr: id, score: String(score) });
  const team = (teamId, scores) => empty(sdk.BattleTeamUserArmies, {
    teamId, teamUsers: scores.map(([id, score]) => member(id, score)),
    teamTotalScore: String(scores.reduce((total, [, score]) => total + score, 0)),
    userArmies: empty(sdk.BattleUserArmies, { anchorIdStr: scores[0][0], hostScore: String(scores[0][1]), userArmy: [] })
  });
  const setting = empty(sdk.BattleSetting, { battleId: "900", startTimeMs: String(now - 1000), duration: 300, battleType: sdk.BattleType.BATTLE_TYPE_TEAM_BATTLE });
  const identities = [["1", "creator"], ["2", "demo_teammate"], ["3", "demo_rival"], ["4", "demo_guest"]].filter(([id]) => membersPerTeam !== 1 || ["1", "3"].includes(id));
  const anchors = Object.fromEntries(identities.map(([id, displayId]) => [id, empty(sdk.WebcastLinkMicBattle_BattleUserInfo, {
    user: empty(sdk.WebcastLinkMicBattle_BattleUserInfo_BattleBaseUserInfo, { userId: id, displayId, nickName: displayId }), tags: []
  })]));
  const before = membersPerTeam === 1 ? [team("101", [["1", 100]]), team("202", [["3", 120]])]
    : [team("101", [["1", 20], ["2", 80]]), team("202", [["3", 90], ["4", 30]])];
  const after = membersPerTeam === 1 ? [team("101", [["1", 135]]), team("202", [["3", 120]])]
    : [team("101", [["1", 35], ["2", 100]]), team("202", [["3", 90], ["4", 30]])];
  const start = roundtrip(sdk.WebcastLinkMicBattle, empty(sdk.WebcastLinkMicBattle, {
    common: common("1001"), battleId: "900", action: sdk.BattleAction.BATTLE_ACTION_OPEN,
    battleSetting: setting, anchorInfo: anchors,
    teamUsers: before.map((row) => empty(sdk.WebcastLinkMicBattle_TeamUsersInfo, { teamId: row.teamId, userIds: row.teamUsers.map((user) => user.userId) })),
    teamArmies: before
  }));
  const scores = roundtrip(sdk.WebcastLinkMicArmies, empty(sdk.WebcastLinkMicArmies, {
    common: common("1002"), battleId: "900", battleStatus: sdk.TriggerReason.TRIGGER_REASON_SCORE_UPDATE,
    battleSettings: setting, teamArmies: after
  }));
  const end = roundtrip(sdk.WebcastLinkMicBattle, { ...start, common: common("1003"), action: sdk.BattleAction.BATTLE_ACTION_FINISH,
    teamArmies: after, battleResult: {}, teamBattleResult: [
      empty(sdk.WebcastLinkMicBattle_BattleTeamResult, { teamId: "101", teamUsers: after[0].teamUsers, result: sdk.Result.RESULT_WIN, totalScore: "135" }),
      empty(sdk.WebcastLinkMicBattle_BattleTeamResult, { teamId: "202", teamUsers: after[1].teamUsers, result: sdk.Result.RESULT_LOSE, totalScore: "120" })
    ]
  });
  return { start, scores, end };
}

function workspace(context, type = "tiktok-direct", { executeReactions = false } = {}) {
  let clock = Date.now();
  const connectors = [], sockets = [], matches = [], ordinary = [], moments = [], diagnostics = [], effects = [];
  class FakeConnector extends EventEmitter {
    constructor() { super(); this.roomId = "700"; connectors.push(this); }
    async fetchIsLive() { return true; }
    async connect() { return { roomId: "700", roomInfo: { data: { id_str: "700", owner: { id_str: "1", display_id: "creator", nickname: "Démonstration" } } } }; }
    async disconnect() {}
  }
  class FakeSocket extends EventEmitter {
    constructor() { super(); this.readyState = 1; sockets.push(this); }
    addEventListener(name, callback) { this.on(name, callback); }
    send() {}
    close() { this.emit("close"); }
    message(data) { this.emit("message", { data: JSON.stringify(data) }); }
  }
  const module = { exports: {} };
  new vm.Script(fs.readFileSync(sourcePath, "utf8"), { filename: sourcePath }).runInNewContext({
    require: (request) => request === "tiktok-live-connector" ? { ...sdk, TikTokLiveConnection: FakeConnector } : realRequire(request),
    module, exports: module.exports, WebSocket: FakeSocket, URL, setTimeout, clearTimeout, clearInterval, queueMicrotask, console
  });
  const state = createDefaultState();
  state.settings.account = { uid: "cohost-fixture", email: "demo@example.invalid", refreshTokenSecretId: "test-only" };
  state.settings.tiktok = { ...state.settings.tiktok, username: "creator", roomId: "700", status: "live", broadcaster: { username: "creator", userId: "1" } };
  state.session.running = true;
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  state.connections.push({ id: "source_tiktok", type, enabled: true, status: "disconnected", config: { username: "creator", url: "wss://relay.example.invalid" } });
  const store = { getState: () => copy(state), getStateProjection: (paths) => selectStatePaths(state, paths),
    getAccountSession: () => state.settings.account, getSecret: () => "synthetic-test-only", mutateRuntime: (callback) => callback(state), mutate: (callback) => callback(state) };
  const overlayServer = { publish() {}, playMatch: async (config) => { effects.push(copy(config)); return { played: true }; } };
  const actionRunner = executeReactions ? new ActionRunner({ store, overlayServer, gameHub: { assertAccess() {} },
    notifyRenderer: () => { throw new Error("Aucune lecture audio réelle ne doit être demandée"); } }) : {};
  const timers = new Set();
  const service = new MatchesService({ store, actionRunner, overlayServer, now: () => clock,
    setTimeoutImpl: (callback, ms) => { const item = { callback, at: clock + ms, unref() {} }; timers.add(item); return item; },
    clearTimeoutImpl: (item) => timers.delete(item) });
  if (!executeReactions) service.fireMoment = (moment) => moments.push(moment);
  const hub = new module.exports.SourceHub({ store, fetchFn: async () => { throw new Error("Le test ne doit appeler aucun réseau réel"); } });
  hub.on("event", (event) => ordinary.push(event));
  hub.on("match-event", (event) => { matches.push(copy(event)); service.handle(event); });
  hub.on("diagnostic", (event) => diagnostics.push(event));
  context.after(async () => { service.reset(); await hub.stopAll(); });
  const advance = async (ms) => { clock += ms; for (const item of [...timers]) if (item.at <= clock) { timers.delete(item); item.callback(); } await service.whenIdle(); };
  return { state, hub, service, connectors, sockets, matches, ordinary, moments, diagnostics, effects, now: () => clock, advance };
}

test("les fixtures cohost font un aller-retour par les vrais codecs protobuf installés", () => {
  const { start, scores, end } = cohostPackets();
  assert.deepEqual(start.teamUsers.map((team) => team.userIds), [["1", "2"], ["3", "4"]]);
  assert.deepEqual(scores.teamArmies.map((team) => team.teamTotalScore), ["135", "120"]);
  assert.deepEqual(end.teamBattleResult.map((team) => team.result), [0, 1]);
  assert.equal(scores.battleItems && Object.keys(scores.battleItems).length, 0, "le SDK peut fournir uniquement teamArmies");
});

test("le transport direct conserve les quatre cohosts et déduplique les callbacks décodés", async (context) => {
  const f = workspace(context); const { start, scores, end } = cohostPackets();
  await f.hub.start("source_tiktok"); await settled();
  const connector = f.connectors[0];
  connector.emit(sdk.WebcastEvent.LINK_MIC_BATTLE, start);
  connector.emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkMicBattle", { data: start });
  connector.emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkMicArmies", { data: scores });
  connector.emit(sdk.WebcastEvent.LINK_MIC_ARMIES, scores);
  connector.emit(sdk.WebcastEvent.LINK_MIC_BATTLE, end);
  await settled();
  assert.deepEqual(f.matches.map((event) => event.phase), ["start", "update", "end"]);
  assert.deepEqual(f.matches[1].participants.map((person) => person.id).sort(), ["1", "2", "3", "4"]);
  assert.equal(f.ordinary.length, 0, "un événement de match ne devient jamais un chat/cadeau");
  assert.equal(f.diagnostics.length, 0);
});

test("le relais conserve les paquets cohost natifs et l'enveloppe decodedData du SDK", async (context) => {
  const f = workspace(context, "tiktok-relay"); const { start, scores, end } = cohostPackets();
  await f.hub.start("source_tiktok"); const socket = f.sockets[0]; socket.emit("open");
  socket.message({ event: "status", data: { live: true, roomId: "700" } });
  socket.message({ event: "linkMicBattle", data: start });
  socket.message({ event: "WebcastLinkMicBattle", data: start });
  socket.message({ event: "decodedData", data: { type: "WebcastLinkMicArmies", data: scores } });
  socket.message({ event: "WebcastLinkMicBattle", data: end });
  await settled();
  assert.deepEqual(f.matches.map((event) => event.phase), ["start", "update", "end"]);
  assert.equal(f.matches.every((event) => event.source === "source_tiktok" && event.roomId === "700"), true);
  assert.equal(f.matches[1].participants.length, 4);
  assert.equal(f.ordinary.length, 0);
  assert.equal(f.diagnostics.length, 0);
});

for (const type of ["tiktok-direct", "tiktok-relay"]) for (const membersPerTeam of [1, 2]) {
  test(`${type} : ${membersPerTeam === 1 ? "deux créateurs en 1v1 avec équipes d'un membre" : "quatre créateurs en 2v2"}, décisions réelles sans effet`, async (context) => {
    const f = workspace(context, type); const { start, scores, end } = cohostPackets(membersPerTeam);
    await f.hub.start("source_tiktok"); await settled();
    if (type === "tiktok-direct") {
      f.connectors[0].emit(sdk.WebcastEvent.LINK_MIC_BATTLE, start);
      f.connectors[0].emit(sdk.WebcastEvent.LINK_MIC_ARMIES, scores);
      assert.equal(f.moments.filter((moment) => moment === "lead").length, 1, "la prise de tête est immédiate, avant la fin du match");
      f.connectors[0].emit(sdk.WebcastEvent.LINK_MIC_BATTLE, end);
    } else {
      const socket = f.sockets[0]; socket.emit("open");
      socket.message({ event: "status", data: { live: true, roomId: "700" } });
      socket.message({ event: "linkMicBattle", data: start });
      socket.message({ event: "decodedData", data: { type: "WebcastLinkMicArmies", data: scores } });
      assert.equal(f.moments.filter((moment) => moment === "lead").length, 1, "le relais traite immédiatement le score décodé");
      socket.message({ event: "linkMicBattle", data: end });
    }
    await settled();
    assert.equal(f.moments.filter((moment) => moment === "battleStart").length, 1);
    assert.equal(f.moments.filter((moment) => moment === "lead").length, 1, "l'équipe passe de 100–120 à 135–120 indépendamment du nombre de cohosts");
    assert.equal(f.moments.filter((moment) => moment === "victory").length, 1, "le résultat d'équipe WIN=0 doit être reconnu");
    assert.equal(f.state.matchSession.session.wins, 1);
    assert.equal(f.state.matchSession.result, "win");
    assert.equal(f.state.matchSession.participants.length, membersPerTeam * 2);
    assert.equal(f.ordinary.length, 0);
  });
}

test("le cohost conserve les garde-fous de salle et de runtime remplacé", async (context) => {
  const f = workspace(context); const { start } = cohostPackets();
  await f.hub.start("source_tiktok"); await settled();
  const connector = f.connectors[0], late = connector.listeners(sdk.WebcastEvent.LINK_MIC_BATTLE)[0];
  connector.emit(sdk.WebcastEvent.LINK_MIC_BATTLE, { ...start, common: { ...start.common, roomId: "701", msgId: "1009" } });
  assert.equal(f.matches.length, 0);
  await f.hub.stopAll(); late(start);
  assert.equal(f.matches.length, 0);
  assert.equal(f.moments.length, 0);
});

test("un bonus x2 réel du SDK reste détecté dans un match à quatre cohosts", async (context) => {
  const f = workspace(context); const { start } = cohostPackets();
  await f.hub.start("source_tiktok"); await settled();
  const packets = bonusPackets(f.now() - 100);
  f.connectors[0].emit(sdk.WebcastEvent.LINK_MIC_BATTLE, start);
  f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkmicBattleTaskMessage", { data: packets.announced });
  await settled();
  assert.equal(f.moments.filter((moment) => moment === "multiplierX2").length, 0, "une récompense annoncée n'est pas encore gagnée");
  f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkmicBattleTaskMessage", { data: packets.settled });
  await settled();
  assert.equal(f.matches.at(-1).phase, "task");
  assert.equal(f.state.matchSession.participants.length, 4);
  assert.equal(f.moments.filter((moment) => moment === "multiplierX2").length, 1);
  assert.equal(f.state.matchSession.multiplier, 2);
});

for (const type of ["tiktok-direct", "tiktok-relay"]) test(`${type} : bonus précoce, adversaire seul et deuxième x2 propre sont distingués`, async (context) => {
  const f = workspace(context, type); const { start } = cohostPackets(1);
  await f.hub.start("source_tiktok"); await settled();
  const socket = f.sockets[0];
  if (socket) { socket.emit("open"); socket.message({ event: "status", data: { live: true, roomId: "700" } }); }
  const send = async (kind, packet) => {
    if (type === "tiktok-direct") f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, kind, { data: packet });
    else socket.message({ event: "decodedData", data: { type: kind, data: packet } });
    await settled(); await f.service.whenIdle();
  };
  const first = bonusPackets(f.now() - 1, { id: "1200" });
  await send("WebcastLinkmicBattleTaskMessage", first.announced);
  assert.equal(f.moments.includes("multiplierX2"), false);
  await send("WebcastLinkMicBattle", start);
  await send("WebcastLinkmicBattleTaskMessage", first.settled);
  assert.equal(f.state.matchSession.ownUserId, "1", "l'UID vient du diffuseur de la salle, pas du donateur");
  assert.equal(f.moments.filter((moment) => moment === "multiplierX2").length, 1, "le premier bonus annoncé avant OPEN reste disponible au règlement");
  await f.advance(30000);
  const rivalOnly = bonusPackets(f.now() - 1, { id: "1300", result: 1 });
  await send("WebcastLinkmicBattleTaskMessage", rivalOnly.announced);
  await send("WebcastLinkmicBattleTaskMessage", rivalOnly.settled);
  assert.equal(f.moments.filter((moment) => moment === "multiplierX2").length, 1, "RESULT_FAILED dans notre salle ne déclenche jamais le bonus de l'adversaire");
  assert.equal(f.state.matchSession.multiplier, 1);
  await f.advance(30000);
  const second = bonusPackets(f.now() - 1, { id: "1400", result: 2 });
  await send("WebcastLinkmicBattleTaskMessage", second.announced);
  assert.equal(f.moments.filter((moment) => moment === "multiplierX2").length, 1);
  const foreign = bonusPackets(f.now() - 1, { id: "1500", roomId: "701" });
  await send("WebcastLinkmicBattleTaskMessage", foreign.settled);
  assert.equal(f.moments.filter((moment) => moment === "multiplierX2").length, 1, "une autre salle ne gagne pas notre bonus");
  await send("WebcastLinkmicBattleTaskMessage", second.settled);
  await send("WebcastLinkmicBattleTaskMessage", second.settled);
  assert.equal(f.moments.filter((moment) => moment === "multiplierX2").length, 2, "BOTH_SUCCEED prouve notre deuxième période x2, sans répéter son paquet");
  assert.equal(f.ordinary.length, 0);
});

for (const membersPerTeam of [1, 2]) test(`la fin ${membersPerTeam === 1 ? "1v1" : "2v2"} peut être annoncée uniquement par teamBattleResult du SDK`, async (context) => {
  const f = workspace(context); const { start, end } = cohostPackets(membersPerTeam);
  const resultOnly = roundtrip(sdk.WebcastLinkMicBattle, {
    ...end, anchorInfo: {}, armies: {}, battleResult: {}, teamUsers: [], teamArmies: []
  });
  await f.hub.start("source_tiktok"); await settled();
  f.connectors[0].emit(sdk.WebcastEvent.LINK_MIC_BATTLE, start);
  f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkMicBattle", { data: resultOnly });
  await settled();
  assert.equal(f.matches.at(-1).phase, "end");
  assert.equal(f.state.matchSession.result, "win");
  assert.equal(f.moments.filter((moment) => moment === "victory").length, 1);
});

for (const type of ["tiktok-direct", "tiktok-relay"]) test(`${type} : 1v1 avec composition à OPEN puis totaux d'équipe seuls`, async (context) => {
  const f = workspace(context, type); const { start, scores } = cohostPackets(1);
  const opening = roundtrip(sdk.WebcastLinkMicBattle, { ...start, teamArmies: [] });
  const scorePacket = (id, armies) => roundtrip(sdk.WebcastLinkMicArmies, {
    ...scores, common: { ...scores.common, msgId: id },
    // Le schéma SDK permet des mises à jour partielles sans répéter la
    // composition : elle vient de teamUsers, reçue au début du match.
    teamArmies: armies.map((team) => ({ ...team, teamUsers: [], userArmies: undefined }))
  });
  const initial = scorePacket("1010", start.teamArmies), update = scorePacket("1011", scores.teamArmies);
  await f.hub.start("source_tiktok"); await settled();
  if (type === "tiktok-direct") {
    f.connectors[0].emit(sdk.WebcastEvent.LINK_MIC_BATTLE, opening);
    f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkMicArmies", { data: initial });
    await settled();
    f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, "WebcastLinkMicArmies", { data: update });
  } else {
    const socket = f.sockets[0]; socket.emit("open");
    socket.message({ event: "status", data: { live: true, roomId: "700" } });
    socket.message({ event: "linkMicBattle", data: opening });
    socket.message({ event: "decodedData", data: { type: "WebcastLinkMicArmies", data: initial } });
    socket.message({ event: "decodedData", data: { type: "WebcastLinkMicArmies", data: update } });
  }
  await settled();
  assert.equal(f.state.matchSession.participants.length, 2);
  assert.equal(f.moments.filter((moment) => moment === "lead").length, 1, "100–120 devient 135–120 sans aucun score individuel dans le paquet");
  assert.equal(f.ordinary.length, 0);
});

test("un simple cohébergement sans bataille ne devient pas une automatisation de match", async (context) => {
  const f = workspace(context); const { start } = cohostPackets();
  await f.hub.start("source_tiktok"); await settled();
  for (const type of ["WebcastLinkMicMethod", "WebcastLinkLayerMessage", "WebcastLinkMessage"]) {
    f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, type, { data: start });
  }
  await settled();
  assert.equal(f.matches.length, 0);
  assert.equal(f.moments.length, 0);
  assert.equal(f.state.matchSession.battleId, "");
});

for (const type of ["tiktok-direct", "tiktok-relay"]) for (const hasTeams of [false, true]) test(`${type} : SCORE avant OPEN en 1v1 ${hasTeams ? "avec équipes" : "classique"} lance l'animation de début une seule fois`, async (context) => {
  const f = workspace(context, type, { executeReactions: true });
  let { start, scores } = cohostPackets(1);
  if (!hasTeams) {
    const armies = (teams) => Object.fromEntries(teams.map((team) => {
      const id = team.teamUsers[0].userId;
      return [id, empty(sdk.BattleUserArmies, { anchorIdStr: id, hostScore: team.teamTotalScore })];
    }));
    start = roundtrip(sdk.WebcastLinkMicBattle, { ...start, armies: armies(start.teamArmies), teamUsers: [], teamArmies: [],
      battleSetting: { ...start.battleSetting, battleType: sdk.BattleType.BATTLE_TYPE_NORMAL_BATTLE } });
    scores = roundtrip(sdk.WebcastLinkMicArmies, { ...scores, battleItems: armies(scores.teamArmies), teamArmies: [],
      battleSettings: { ...scores.battleSettings, battleType: sdk.BattleType.BATTLE_TYPE_NORMAL_BATTLE } });
  }
  f.service.saveAutomation({ id: "demo-start", name: "Début · démonstration", enabled: true, moment: "battleStart", cooldownMs: 0, reaction: { type: "animation", match: "cofre" } });
  await f.hub.start("source_tiktok"); await settled();
  const socket = f.sockets[0];
  if (socket) { socket.emit("open"); socket.message({ event: "status", data: { live: true, roomId: "700" } }); }
  const send = async (kind, packet) => {
    if (type === "tiktok-direct") f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, kind, { data: packet });
    else socket.message({ event: "decodedData", data: { type: kind, data: packet } });
    await settled(); await f.service.whenIdle();
  };
  await send("WebcastLinkMicArmies", scores);
  assert.equal(f.state.matchSession.status, "running");
  assert.equal(f.state.matchSession.participants.length, 2);
  assert.equal(f.effects.length, 0, "les scores seuls n'inventent jamais un début de match");
  await send("WebcastLinkMicBattle", start);
  assert.equal(f.effects.length, 1, "OPEN doit lancer le début même si SCORE a créé le match auparavant");
  assert.equal(f.effects[0].match, "cofre");
  for (const id of ["1020", "1021"]) {
    // Nouveaux msgId : ceci teste le garde du moteur, pas seulement la
    // déduplication des callbacks directs/decodedData de SourceHub.
    await send("WebcastLinkMicBattle", roundtrip(sdk.WebcastLinkMicBattle, { ...start, common: { ...start.common, msgId: id } }));
  }
  assert.equal(f.effects.length, 1);
  assert.equal(f.state.matchSession.session.battles, 1);
  assert.equal(f.ordinary.length, 0);
});

for (const type of ["tiktok-direct", "tiktok-relay"]) test(`${type} : premiers scores récents pendant un LIVE établi lancent une seule animation avant OPEN`, async (context) => {
  const f = workspace(context, type, { executeReactions: true });
  const { start, scores } = cohostPackets(1);
  f.state.session.startedAt = new Date(Date.now() - 60000).toISOString();
  f.service.saveAutomation({ id: "demo-recent-start", name: "Départ récent · démonstration", enabled: true, moment: "battleStart", cooldownMs: 0,
    reaction: { type: "animation", match: "cofre" } });
  await f.hub.start("source_tiktok"); await settled();
  const socket = f.sockets[0];
  if (socket) { socket.emit("open"); socket.message({ event: "status", data: { live: true, roomId: "700" } }); }
  const send = async (kind, packet) => {
    if (type === "tiktok-direct") f.connectors[0].emit(sdk.ControlEvent.DECODED_DATA, kind, { data: packet });
    else socket.message({ event: "decodedData", data: { type: kind, data: packet } });
    await settled(); await f.service.whenIdle();
  };
  await send("WebcastLinkMicArmies", scores);
  assert.equal(f.effects.length, 1, "les dates SDK prouvent un nouveau match depuis moins de dix secondes dans le LIVE déjà établi");
  assert.equal(f.state.matchSession.startOrigin, "recent-scores");
  await send("WebcastLinkMicBattle", start);
  for (const id of ["1030", "1031"]) await send("WebcastLinkMicBattle", roundtrip(sdk.WebcastLinkMicBattle, { ...start, common: { ...start.common, msgId: id } }));
  assert.equal(f.effects.length, 1, "OPEN tardif et ses répétitions ne rejouent pas le début déjà confirmé");
  assert.equal(f.state.matchSession.session.battles, 1);
  assert.equal(f.ordinary.length, 0);
});
