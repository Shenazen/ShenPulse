"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const catalog = require("../resources/overlays/overlay-catalog");
const { normalizeReaction, normalizeMatchesConfig } = require("../src/shared/matches-contract");
const { normalizeMatchPlaybackRequest } = require("../src/main/overlay-server");
const { createMatchRelayMessage } = require("../src/main/relay/match-messages");

const cyberMatches = ["guantes", "x2", "x3", "taptap", "quiereme", "snipe"];
const root = path.resolve(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "resources/overlays/runtime/widgets/match.js"), "utf8");

function playbackNormalizer() {
  const context = vm.createContext({ overlayCatalog: catalog,
    MATCH_VIDEO_NAMES: new Set(catalog.matches.map((entry) => entry.match)) });
  vm.runInContext(runtimeSource, context);
  return (payload) => JSON.parse(JSON.stringify(context.normalizedMatchPlayback(payload)));
}

test("le catalogue expose exactement les six variantes Cyber réellement importées", () => {
  const actual = catalog.matches.filter((entry) => catalog.animationVariants(entry.match).some(([variant]) => variant === "cyber"));
  assert.deepEqual(actual.map((entry) => entry.match).sort(), [...cyberMatches].sort());
  for (const entry of actual) {
    const definition = catalog.definition(entry.key);
    assert.ok(definition.options.some(([variant, label]) => variant === "cyber" && label === "Cyber"));
    assert.equal(definition.defaultOption, "tikcontrol", "les utilisateurs existants ne changent pas de pack");
  }
  for (const match of ["cofre", "enigma"]) {
    assert.equal(catalog.animationVariants(match).some(([variant]) => variant === "cyber"), false);
  }
});

test("Cyber conserve son identité du contrat à la lecture, sans conversion silencieuse TikControl", () => {
  const normalizePlayback = playbackNormalizer();
  for (const match of cyberMatches) {
    const reaction = normalizeReaction({ type: "animation", match, variant: "cyber", fit: "cover" });
    const playback = normalizeMatchPlaybackRequest(reaction);
    const relayed = createMatchRelayMessage("match", playback);
    assert.equal(reaction.variant, "cyber");
    assert.equal(playback.variant, "cyber");
    assert.equal(relayed.payload.variant, "cyber");
    assert.deepEqual(normalizePlayback(relayed.payload), {
      requestId: playback.requestId, match, variant: "cyber", fit: "cover"
    });
  }
});

test("un Coffre ou Enigma Cyber absent est refusé partout plutôt que substitué", () => {
  const normalizePlayback = playbackNormalizer();
  for (const match of ["cofre", "enigma"]) {
    const input = { requestId: "fixture-missing-cyber", type: "animation", match, variant: "cyber" };
    assert.throws(() => normalizeReaction(input), /pas disponible/);
    assert.throws(() => normalizeMatchPlaybackRequest(input), /indisponible/);
    assert.equal(createMatchRelayMessage("match", input), null);
    assert.equal(normalizePlayback(input), null);
  }
});

test("les anciennes automatisations, références et sorties conservent leur configuration", () => {
  const input = { automations: [
    { id: "legacy-start", name: "Mon coffre", enabled: true, moment: "battleStart", reaction: { type: "animation", match: "cofre", variant: "gladiador", fit: "cover" } },
    { id: "legacy-x3", name: "Mon x3", enabled: false, moment: "multiplierX3", reaction: { type: "animation", match: "x3", variant: "tikcontrol", fit: "contain" } },
    { id: "legacy-multiple", moment: "likeRush", enabled: true, reaction: { type: "bundle", reactions: [
      { type: "animation", match: "taptap", variant: "gladiador" },
      { type: "action", actionId: "my-existing-action" },
      { type: "sound", url: "https://example.invalid/sound.mp3", outputMode: "local", volume: 0.3 }
    ] } },
    { id: "new-cyber", moment: "multiplierX2", enabled: true, reaction: { type: "animation", match: "x2", variant: "cyber" } }
  ] };
  const normalized = normalizeMatchesConfig(input);
  assert.deepEqual(normalized.automations.map(({ id }) => id), input.automations.map(({ id }) => id));
  for (let index = 0; index < 2; index++) {
    assert.deepEqual(normalized.automations[index].reaction, input.automations[index].reaction);
    assert.equal(normalized.automations[index].enabled, input.automations[index].enabled);
  }
  const outputs = normalized.automations[2].reaction.reactions;
  assert.equal(outputs[0].variant, "gladiador");
  assert.equal(outputs[1].actionId, "my-existing-action");
  assert.equal(outputs[2].outputMode, "local");
  assert.equal(outputs[2].volume, 0.3);
  assert.equal(normalized.automations[3].reaction.variant, "cyber");
});

test("les anciens replis inconnus et Enigma/Gladiador restent compatibles, sans choix Cyber implicite", () => {
  const normalizePlayback = playbackNormalizer();
  for (const [match, variant] of [["x2", "unknown-old-pack"], ["enigma", "gladiador"], ["x3", ""]]) {
    const request = normalizeMatchPlaybackRequest({ match, variant });
    assert.equal(request.variant, "tikcontrol");
    assert.equal(createMatchRelayMessage("match", request).payload.variant, "tikcontrol");
    assert.equal(normalizePlayback(request).variant, "tikcontrol");
  }
});

test("le contrat navigateur peut être chargé avant le catalogue sans diverger du contrat Node", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root, "src/shared/matches-contract.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "resources/overlays/catalog/matches.js"), "utf8"), context);
  const input = { type: "animation", match: "x3", variant: "cyber", fit: "cover" };
  assert.deepEqual(JSON.parse(JSON.stringify(context.ShenPulseMatches.normalizeReaction(input))), normalizeReaction(input));
});
