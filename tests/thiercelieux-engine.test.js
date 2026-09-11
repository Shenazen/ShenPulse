"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const enginePromise = import(
  pathToFileURL(
    path.join(
      __dirname,
      "..",
      "src",
      "renderer",
      "games",
      "original-src",
      "domain",
      "thiercelieuxEngine.mjs"
    )
  ).href
);

function players(count = 8) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Joueur ${index + 1}`,
    seat: index + 1
  }));
}

test("Thiercelieux exposes every requested collection and license-safe event slots", async () => {
  const engine = await enginePromise;
  assert.equal(engine.BUILDINGS.length, 14);
  assert.equal(engine.EVENTS.length, 36);
  assert.equal(engine.EVENTS.filter((entry) => entry.type === "spiritism").length, 5);
  assert.ok(engine.EVENTS.every((entry) => entry.disclosure === "public-dawn" && entry.resolveAt === "dawn"));
  assert.deepEqual(
    [...new Set(engine.ROLE_CATALOG.map((role) => role.pack))].sort(),
    ["25-ans", "base", "nouvelle-lune", "personnages", "village"].sort()
  );
  for (const name of [
    "Voyante",
    "Sorcière",
    "Joueur de Flûte",
    "Loup-Garou Blanc",
    "Servante Dévouée",
    "Infect Père des Loups",
    "Colosse",
    "Singe Savant",
    "Marionnettiste",
    "Puissante Mère des Loups"
  ]) {
    assert.ok(engine.ROLE_CATALOG.some((role) => role.name === name), name);
  }
});

test("official disclosure timing is defined for every active character", async () => {
  const { ACTION_REVEAL_POLICY, ROLE_CATALOG } = await enginePromise;
  const activeActions = [...new Set(ROLE_CATALOG.map((role) => role.action).filter((action) => !["none", "death-shot", "tie-sacrifice", "inherit", "colossus"].includes(action)))];
  assert.ok(activeActions.every((action) => ACTION_REVEAL_POLICY[action]), activeActions.filter((action) => !ACTION_REVEAL_POLICY[action]).join(", "));
  assert.equal(ACTION_REVEAL_POLICY["inspect-role"], "private-actor");
  assert.equal(ACTION_REVEAL_POLICY.fox, "private-actor");
  assert.equal(ACTION_REVEAL_POLICY.bear, "public-dawn");
  assert.equal(ACTION_REVEAL_POLICY.raven, "public-dawn");
  assert.equal(ACTION_REVEAL_POLICY.infect, "private-targets");
  assert.equal(ACTION_REVEAL_POLICY["suppress-power"], "private-targets");
});

test("display orientation is normalized to portrait or landscape", async () => {
  const { normalizeConfig } = await enginePromise;
  assert.equal(normalizeConfig({ orientation: "portrait" }).orientation, "portrait");
  assert.equal(normalizeConfig({ orientation: "cinema" }).orientation, "landscape");
});

test("the default gift joins the live queue exactly once", async () => {
  const { createLobby, enqueueGift } = await enginePromise;
  const lobby = createLobby();
  const gift = {
    user: { id: "viewer-1", name: "luna", displayName: "Luna" },
    data: { giftName: "Côte à côte", value: 199, count: 1 }
  };
  const accepted = enqueueGift(lobby, gift, Date.parse("2026-09-11T18:00:00Z"));
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.position, 1);
  assert.equal(lobby.queue[0].totalValue, 199);
  assert.equal(lobby.queue[0].status, "waiting");
  assert.equal(enqueueGift(lobby, gift).accepted, false);
  assert.equal(lobby.queue.length, 1);
});

test("closed registrations and gifts under the configured threshold are rejected", async () => {
  const { createLobby, enqueueGift } = await enginePromise;
  const closed = createLobby({ registrationOpen: false });
  assert.equal(enqueueGift(closed, { user: { id: "a" }, data: { giftName: "Côte à côte", value: 199, count: 1 } }).accepted, false);
  const lobby = createLobby({ giftName: "Lune", giftValue: 500, giftQuantity: 2 });
  assert.equal(enqueueGift(lobby, { user: { id: "b" }, data: { giftName: "Lune", value: 499, count: 2 } }).accepted, false);
  assert.equal(enqueueGift(lobby, { user: { id: "b" }, data: { giftName: "Lune", value: 500, count: 1 } }).accepted, false);
});

test("a lobby can never promote more than eight active players", async () => {
  const { addManualQueueEntry, createLobby, promoteQueueEntry } = await enginePromise;
  const lobby = createLobby({ seats: 8 });
  for (let index = 0; index < 9; index += 1) {
    const result = addManualQueueEntry(lobby, `Joueur ${index + 1}`, { userId: `u${index + 1}` });
    if (index < 8) promoteQueueEntry(lobby, result.entry.id);
  }
  assert.equal(lobby.activePlayers.length, 8);
  assert.throws(() => promoteQueueEntry(lobby, lobby.queue[8].id), /complète/);
  assert.ok(lobby.activePlayers.every((player, index) => player.seat === index + 1));
});

test("official setup adapts balanced roles from three to eight players", async () => {
  const { MIN_ACTIVE_PLAYERS, MAX_ACTIVE_PLAYERS, recommendedRoleIds, validateSetup } = await enginePromise;
  assert.equal(MIN_ACTIVE_PLAYERS, 3);
  assert.equal(MAX_ACTIVE_PLAYERS, 8);
  for (let playerCount = MIN_ACTIVE_PLAYERS; playerCount <= MAX_ACTIVE_PLAYERS; playerCount += 1) {
    const selectedPlayers = players(playerCount);
    const roles = recommendedRoleIds(playerCount);
    const wolfCount = roles.filter((roleId) => roleId === "simple-loup-garou").length;
    const setup = validateSetup({ players: selectedPlayers, roleIds: roles, config: { rulesMode: "official", packs: ["base"] } });
    assert.equal(roles.length, playerCount, `${playerCount} joueurs`);
    assert.equal(wolfCount, playerCount >= 6 ? 2 : 1, `${playerCount} joueurs`);
    assert.equal(setup.valid, true, setup.errors.join(" "));
    if (playerCount < MAX_ACTIVE_PLAYERS) assert.match(setup.warnings.join(" "), /adaptée/);
  }

  const tooSmall = validateSetup({ players: players(2), roleIds: ["simple-loup-garou", "simple-villageois"], config: { rulesMode: "official", packs: ["base"] } });
  assert.equal(tooSmall.valid, false);
  assert.match(tooSmall.errors.join(" "), /au moins 3 joueurs/);
});

test("adaptive compositions only use extensions that are enabled", async () => {
  const { recommendedRoleIds } = await enginePromise;
  assert.deepEqual(recommendedRoleIds(5), ["simple-loup-garou", "voyante", "sorciere", "simple-villageois", "simple-villageois"]);
  assert.ok(recommendedRoleIds(8, { packs: ["base", "nouvelle-lune"] }).includes("salvateur"));
  assert.ok(recommendedRoleIds(8, { packs: ["base", "personnages"] }).includes("renard"));
  assert.ok(recommendedRoleIds(7, { packs: ["base", "25-ans"] }).includes("colosse"));
});

test("night order is rebuilt from living roles and Witch can heal the wolf victim", async () => {
  const engine = await enginePromise;
  const roleIds = [
    "cupidon",
    "voyante",
    "salvateur",
    "simple-loup-garou",
    "simple-loup-garou",
    "sorciere",
    "chasseur",
    "simple-villageois"
  ];
  const game = engine.createGame({
    players: players(),
    roleIds,
    config: { ...engine.DEFAULT_CONFIG, assignmentMode: "manual" }
  });
  engine.startNight(game);
  assert.deepEqual(
    game.nightQueue.map((step) => step.action),
    ["lovers", "inspect-role", "protect", "wolf-vote", "observe-wolves"].filter((action) => action !== "observe-wolves").concat(["witch"])
  );

  while (game.phase === "night") {
    const step = engine.currentNightStep(game);
    const candidates = engine.availableTargets(game, step);
    if (step.action === "lovers") engine.submitNightAction(game, { targetIds: ["p1", "p2"] });
    else if (step.action === "protect") engine.submitNightAction(game, { targetId: "p1" });
    else if (step.action === "wolf-vote") engine.submitNightAction(game, { targetId: "p3" });
    else if (step.action === "witch") engine.submitNightAction(game, { heal: true });
    else if (candidates.length) engine.submitNightAction(game, { targetId: candidates[0].id });
    else engine.submitNightAction(game, { skip: true });
  }
  assert.equal(game.players.find((player) => player.id === "p3").alive, true);
  assert.equal(game.players.find((player) => player.roleId === "sorciere").charges.heal, false);
});

test("infection and power suppression notify only the affected player", async () => {
  const engine = await enginePromise;
  const infectedGame = engine.createGame({
    players: players(5),
    roleIds: ["infect-pere-des-loups", "voyante", "simple-villageois", "simple-villageois", "simple-villageois"],
    config: { ...engine.DEFAULT_CONFIG, assignmentMode: "manual" }
  });
  engine.startNight(infectedGame);
  while (infectedGame.phase === "night") {
    const step = engine.currentNightStep(infectedGame);
    if (step.action === "inspect-role") engine.submitNightAction(infectedGame, { targetId: "p1" });
    else if (step.action === "wolf-vote") engine.submitNightAction(infectedGame, { targetId: "p2" });
    else if (step.action === "infect") engine.submitNightAction(infectedGame, { targetId: "p2" });
    else engine.submitNightAction(infectedGame, { skip: true });
  }
  assert.equal(infectedGame.players[1].camp, "wolves");
  assert.ok(infectedGame.players[1].statuses.includes("infected"));
  assert.equal(infectedGame.privateMessages.p2.filter((entry) => /infecté/.test(entry.message)).length, 1);

  const motherGame = engine.createGame({
    players: players(5),
    roleIds: ["puissante-mere-des-loups", "voyante", "simple-villageois", "simple-villageois", "simple-villageois"],
    config: { ...engine.DEFAULT_CONFIG, assignmentMode: "manual" }
  });
  engine.startNight(motherGame);
  while (motherGame.phase === "night") {
    const step = engine.currentNightStep(motherGame);
    if (step.action === "inspect-role") engine.submitNightAction(motherGame, { targetId: "p1" });
    else if (step.action === "wolf-vote") engine.submitNightAction(motherGame, { targetId: "p3" });
    else if (step.action === "suppress-power") engine.submitNightAction(motherGame, { targetId: "p2" });
    else engine.submitNightAction(motherGame, { skip: true });
  }
  assert.equal(motherGame.players[1].powerEnabled, false);
  assert.match(motherGame.privateMessages.p2.at(-1).message, /neutralisé/);
  assert.equal((motherGame.privateMessages.p1 || []).some((entry) => /neutralisé/.test(entry.message)), false);
});

test("Bear, Raven, fire and New Moon events are announced only at dawn", async () => {
  const engine = await enginePromise;
  const game = engine.createGame({
    players: players(5),
    roleIds: ["montreur-ours", "simple-loup-garou", "corbeau", "pyromane", "simple-villageois"],
    config: { ...engine.DEFAULT_CONFIG, assignmentMode: "manual", packs: ["base", "personnages", "village", "nouvelle-lune"], buildingsEnabled: true, eventsEnabled: true }
  });
  engine.startNight(game);
  while (game.phase === "night") {
    const step = engine.currentNightStep(game);
    if (step.action === "raven") engine.submitNightAction(game, { targetId: "p5" });
    else if (step.action === "burn-building") engine.submitNightAction(game, { targetId: "p3" });
    else if (step.action === "wolf-vote") engine.submitNightAction(game, { targetId: "p4" });
    else engine.submitNightAction(game, { skip: true });
  }
  assert.ok(game.dawnAnnouncements.some((line) => /ours grogne/.test(line)));
  assert.ok(game.dawnAnnouncements.some((line) => /Corbeau accuse Joueur 5/.test(line)));
  assert.ok(game.dawnAnnouncements.some((line) => /incendie/.test(line)));
  assert.equal(game.currentEvent, null, "no event on the first morning");

  engine.startNight(game);
  while (game.phase === "night") {
    const step = engine.currentNightStep(game);
    if (step.action === "raven") engine.submitNightAction(game, { targetId: "p5" });
    else if (step.action === "wolf-vote") engine.submitNightAction(game, { targetId: "p3" });
    else engine.submitNightAction(game, { skip: true });
  }
  assert.equal(game.currentEvent?.disclosure, "public-dawn");
  assert.ok(game.dawnAnnouncements.some((line) => /Événement|Spiritisme/.test(line)));
});

test("private roles never leak through the public view", async () => {
  const engine = await enginePromise;
  const game = engine.createGame({
    players: players(),
    roleIds: engine.recommendedRoleIds(8),
    config: { ...engine.DEFAULT_CONFIG, assignmentMode: "manual" }
  });
  const publicView = engine.publicGameView(game);
  assert.ok(publicView.players.every((player) => player.roleName === ""));
  assert.equal(engine.privatePlayerView(game, "p1").role.name, "Simple Loup-Garou");
});

test("death reactions resolve before victory checks", async () => {
  const engine = await enginePromise;
  const roleIds = [
    "simple-loup-garou",
    "simple-loup-garou",
    "chasseur",
    "voyante",
    "sorciere",
    "salvateur",
    "simple-villageois",
    "simple-villageois"
  ];
  const game = engine.createGame({ players: players(), roleIds, config: { ...engine.DEFAULT_CONFIG, assignmentMode: "manual" } });
  game.phase = "vote";
  for (const player of game.players) game.votes[player.id] = "p3";
  engine.resolveVote(game);
  assert.equal(game.phase, "death-trigger");
  assert.equal(game.finished, false);
  engine.resolveDeathTrigger(game, "p1");
  assert.equal(game.players[0].alive, false);
});

test("saved games round-trip with the same schema", async () => {
  const engine = await enginePromise;
  const game = engine.createGame({ players: players(), roleIds: engine.recommendedRoleIds(8), config: { ...engine.DEFAULT_CONFIG, orientation: "portrait" } });
  const restored = engine.hydrateGame(engine.serializeGame(game));
  assert.equal(restored.id, game.id);
  assert.equal(restored.config.orientation, "portrait");
  assert.equal(restored.players.length, 8);
});
