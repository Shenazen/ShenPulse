"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { BrumeluneLanService } = require("../src/main/brumelune-lan-service");

const root = path.resolve(__dirname, "..");
const engineUrl = pathToFileURL(
  path.join(
    root,
    "src",
    "renderer",
    "games",
    "original-src",
    "domain",
    "brumeluneEngine.mjs"
  )
).href;

let enginePromise;
const engine = () => (enginePromise ||= import(engineUrl));

function players(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `p${index + 1}`,
    name: `Joueur ${index + 1}`,
    avatar: "✦"
  }));
}

test("le catalogue Brumelune reste original, extensible et intégralement configurable", async () => {
  const { ROLE_CATALOG, EVENTS, OCCUPATIONS } = await engine();
  assert.ok(ROLE_CATALOG.length >= 25);
  assert.ok(EVENTS.length >= 8);
  assert.ok(OCCUPATIONS.length >= 8);
  const requiredFields = [
    "id",
    "name",
    "initialCamp",
    "publicDescription",
    "secretDescription",
    "winCondition",
    "frequency",
    "charges",
    "allowedTargets",
    "immediateEffects",
    "delayedEffects",
    "deathTriggers",
    "immunities",
    "incompatibilities",
    "knownAtStart",
    "resolutionPriority"
  ];
  for (const role of ROLE_CATALOG) {
    for (const field of requiredFields) {
      assert.ok(
        Object.prototype.hasOwnProperty.call(role, field),
        `${role.id} doit définir ${field}`
      );
    }
    assert.doesNotMatch(
      `${role.name} ${role.publicDescription} ${role.secretDescription}`,
      /Thiercelieux|Loup-Garou|Voyante|Sorcière|Cupidon/i
    );
  }
});

test("la composition automatique remplit chaque siège et signale les déséquilibres", async () => {
  const { recommendedRoleIds, validateSetup } = await engine();
  const roster = players(12);
  const roleIds = recommendedRoleIds(roster.length, {
    allowComplex: true,
    allowSolitary: true
  });
  assert.equal(roleIds.length, roster.length);
  const validation = validateSetup({
    players: roster,
    roleIds,
    config: { allowComplex: true, allowSolitary: true }
  });
  assert.equal(validation.valid, true);
  assert.ok(validation.score >= 55);
  const invalid = validateSetup({
    players: roster,
    roleIds: Array.from({ length: 12 }, () => "veilleur"),
    config: {}
  });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(" "), /Brumes/);
});

test("la protection précède la chasse et annule correctement une attaque nocturne", async () => {
  const {
    createGame,
    currentNightStep,
    startNight,
    submitNightAction
  } = await engine();
  const game = createGame({
    players: players(5),
    roleIds: ["brumelin", "gardelueur", "veilleur", "veilleur", "veilleur"],
    config: {},
    random: () => 0.999999
  });
  startNight(game);
  let step = currentNightStep(game);
  assert.equal(step.action, "protect");
  submitNightAction(game, step.id, { targetId: "p3" });
  step = currentNightStep(game);
  assert.equal(step.action, "hostile-vote");
  submitNightAction(game, step.id, { targetId: "p3" });
  assert.equal(game.players.find((player) => player.id === "p3").alive, true);
  assert.equal(game.phase, "dawn");
  assert.deepEqual(game.dawnSummary.victimIds, []);
});

test("les conversions changent immédiatement le camp courant sans remplacer le rôle", async () => {
  const {
    createGame,
    currentNightStep,
    startNight,
    submitNightAction
  } = await engine();
  const game = createGame({
    players: players(6),
    roleIds: ["brumelin", "souche-mere", "astromancienne", "veilleur", "veilleur", "veilleur"],
    config: {},
    random: () => 0.999999
  });
  startNight(game);
  while (currentNightStep(game)) {
    const step = currentNightStep(game);
    if (step.action === "inspect") {
      submitNightAction(game, step.id, { targetId: "p1" });
    } else if (step.action === "hostile-vote") {
      submitNightAction(game, step.id, { targetId: "p4" });
    } else if (step.action === "infect") {
      submitNightAction(game, step.id, { targetId: "p3" });
    }
  }
  const converted = game.players.find((player) => player.id === "p3");
  assert.equal(converted.currentCamp, "hostile");
  assert.equal(converted.currentRoleId, "astromancienne");
  assert.ok(converted.statuses.includes("infected"));
});

test("les liens propagent les morts en chaîne avant la vérification de victoire", async () => {
  const {
    createGame,
    currentNightStep,
    startNight,
    submitNightAction
  } = await engine();
  const game = createGame({
    players: players(6),
    roleIds: ["tisseuse", "veilleur", "veilleur", "brumelin", "brumelin", "veilleur"],
    config: {},
    random: () => 0.999999
  });
  startNight(game);
  let step = currentNightStep(game);
  assert.equal(step.action, "bond");
  submitNightAction(game, step.id, { targetIds: ["p2", "p3"] });
  step = currentNightStep(game);
  submitNightAction(game, step.id, { targetId: "p2" });
  assert.equal(game.players.find((player) => player.id === "p2").alive, false);
  assert.equal(game.players.find((player) => player.id === "p3").alive, false);
  assert.deepEqual(
    new Set(game.dawnSummary.victimIds),
    new Set(["p2", "p3"])
  );
});

test("une égalité du conseil déclenche le Paratonnerre et les vues publiques masquent les rôles", async () => {
  const {
    beginDiscussion,
    beginVote,
    createGame,
    publicGameView,
    resolveVote,
    submitVote
  } = await engine();
  const game = createGame({
    players: players(5),
    roleIds: ["brumelin", "paratonnerre", "veilleur", "veilleur", "veilleur"],
    config: { voteMode: "secret" },
    random: () => 0.999999
  });
  const publicView = publicGameView(game);
  assert.ok(publicView.players.every((player) => player.roleId === null));
  assert.ok(publicView.players.every((player) => player.currentCamp === null));
  beginDiscussion(game);
  beginVote(game);
  submitVote(game, "p1", "p3");
  submitVote(game, "p2", "p3");
  submitVote(game, "p3", "p4");
  submitVote(game, "p4", "p4".replace("4", "5"));
  submitVote(game, "p5", "p4");
  const result = resolveVote(game);
  assert.equal(result.outcome, "paratonnerre");
  assert.equal(result.eliminatedId, "p2");
  assert.equal(game.players.find((player) => player.id === "p2").alive, false);
});

test("une partie sauvegardée peut être reprise sans perdre sa chronologie", async () => {
  const { createGame, hydrateGame, serializeGame, startNight } = await engine();
  const game = createGame({
    players: players(5),
    roleIds: ["brumelin", "gardelueur", "veilleur", "veilleur", "veilleur"],
    config: {},
    random: () => 0.999999
  });
  startNight(game);
  const restored = hydrateGame(serializeGame(game));
  assert.equal(restored.id, game.id);
  assert.equal(restored.night, 1);
  assert.equal(restored.phase, "night");
  assert.ok(restored.history.length >= 2);
});

test("l’attribution manuelle conserve exactement le rôle choisi pour chaque joueur", async () => {
  const { createGame } = await engine();
  const roleIds = ["astromancienne", "brumelin", "gardelueur", "veilleur", "sentinelle"];
  const game = createGame({
    players: players(5),
    roleIds,
    config: { assignmentMode: "manual" },
    random: () => 0
  });
  assert.deepEqual(game.players.map((player) => player.initialRoleId), roleIds);
});

test("le Masque-miroir emprunte réellement un talent une seule fois", async () => {
  const { createGame, currentNightStep, privatePlayerView, startNight, submitNightAction } = await engine();
  const game = createGame({
    players: players(5),
    roleIds: ["masque-miroir", "brumelin", "veilleur", "veilleur", "veilleur"],
    config: { assignmentMode: "manual" },
    random: () => 0
  });
  startNight(game);
  const step = currentNightStep(game);
  assert.equal(step.action, "borrow");
  submitNightAction(game, step.id, { borrowedAction: "inspect", targetId: "p2" });
  assert.deepEqual(game.players[0].borrowedActions, ["inspect"]);
  assert.match(privatePlayerView(game, "p1").self.messages.at(-1).message, /Brumes/);
});

test("l’Héritière reprend le rôle et le camp d’un condamné", async () => {
  const { beginDiscussion, beginVote, createGame, resolveVote, submitVote } = await engine();
  const game = createGame({
    players: players(5),
    roleIds: ["heritiere", "brumelin", "veilleur", "veilleur", "veilleur"],
    config: { assignmentMode: "manual" },
    random: () => 0
  });
  beginDiscussion(game);
  beginVote(game);
  submitVote(game, "p1", "p2");
  submitVote(game, "p2", "p3");
  submitVote(game, "p3", "p2");
  submitVote(game, "p4", "p2");
  submitVote(game, "p5", "p2");
  resolveVote(game);
  assert.equal(game.players[0].currentRoleId, "brumelin");
  assert.equal(game.players[0].currentCamp, "hostile");
});

test("le compagnon LAN protège les rôles avec un code personnel", async (context) => {
  const companionDirectory = path.join(
    root,
    "src",
    "renderer",
    "games",
    "brumelune-companion"
  );
  const service = new BrumeluneLanService({
    companionDirectory,
    preferredPort: 24840
  });
  context.after(() => service.stop());
  const info = await service.start({
    roomCode: "BRUME1",
    players: [{ id: "p1", name: "Alice", pin: "1234" }],
    spectatorEnabled: true,
    publicState: { phase: "night", players: [{ id: "p1", name: "Alice" }] },
    privateStates: { p1: { phase: "night", self: { role: { name: "Astromancienne" } } } },
    omniscientState: { phase: "night", secret: true }
  });
  assert.equal(info.active, true);
  const badJoin = await fetch(`http://127.0.0.1:${info.port}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "BRUME1", mode: "player", playerId: "p1", pin: "0000" })
  });
  assert.equal(badJoin.status, 403);
  const joinResponse = await fetch(`http://127.0.0.1:${info.port}/api/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roomCode: "BRUME1", mode: "player", playerId: "Alice", pin: "1234" })
  });
  assert.equal(joinResponse.status, 200);
  const join = await joinResponse.json();
  const stateResponse = await fetch(`http://127.0.0.1:${info.port}/api/state?room=BRUME1&token=${encodeURIComponent(join.token)}`);
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json();
  assert.equal(state.self.role.name, "Astromancienne");
  const anonymousState = await fetch(`http://127.0.0.1:${info.port}/api/state?room=BRUME1`);
  assert.equal(anonymousState.status, 401);
});

test("le jeu est branché au catalogue, au runtime original et possède son illustration", () => {
  const catalog = fs.readFileSync(path.join(root, "src", "main", "game-catalog.js"), "utf8");
  const manifest = fs.readFileSync(path.join(root, "src", "main", "game-installer-manifest.js"), "utf8");
  const runtime = fs.readFileSync(path.join(root, "src", "main", "game-runtime.js"), "utf8");
  const host = fs.readFileSync(path.join(root, "src", "renderer", "games", "original-src", "main.ts"), "utf8");
  assert.match(catalog, /game\("brumelune", "Veilleurs de Brumelune"/);
  assert.match(manifest, /"brumelune"/);
  assert.match(runtime, /"brumelune"/);
  assert.match(host, /BrumeluneGame/);
  assert.ok(fs.statSync(path.join(root, "src", "renderer", "assets", "games", "catalog", "brumelune.png")).size > 100_000);
});
