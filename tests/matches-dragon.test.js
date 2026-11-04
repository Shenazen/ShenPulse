"use strict";

const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const catalog = require("../resources/overlays/overlay-catalog");
const { normalizeReaction, normalizeMatchesConfig } = require("../src/shared/matches-contract");
const { normalizeMatchPlaybackRequest } = require("../src/main/overlay-server");
const { createMatchRelayMessage } = require("../src/main/relay/match-messages");

const root = path.resolve(__dirname, "..");
const assets = [
  ["guantes", "5fd520b932160d77e501fffe42016aea2a3fd45c388f4f0587f6b80adb0595a6"],
  ["x2", "27b20d199debfb6c67d54a7f408d018766bf1199d8d45c44eb4b68ef94b34620"],
  ["x3", "4bdbdb87e5bcfef72e3391130fa10b364ce00709376c23a70e6c069e3b564895"],
  ["taptap", "3060d2ce88f15f80f1266a7efb78f159785e4b3713f5567a0f1a16695459a0aa"],
  ["quiereme", "632e1189ee4616ec2133b25ed029b51474f48d89cb652d07266e3ddc0e0fb6f6"],
  ["snipe", "4d23b7423a39540f49f029514aaeef12ed240be419f9ca268b3d7f4523a25f01"]
];

test("Dragon: six original VP9/Opus assets, without recompression, each with a transparent WebP poster", () => {
  for (const [name, hash] of assets) {
    const media = path.join(root, "resources/overlays/media/video");
    const video = fs.readFileSync(path.join(media, `${name}-dragon.webm`));
    assert.equal(createHash("sha256").update(video).digest("hex"), hash, name);
    assert.equal(video.subarray(0, 4).toString("hex"), "1a45dfa3");
    assert.ok(video.includes(Buffer.from("V_VP9")));
    assert.ok(video.includes(Buffer.from("A_OPUS")));
    const poster = fs.readFileSync(path.join(media, "posters", `${name}-dragon.webp`));
    assert.equal(poster.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(poster.subarray(8, 16).toString("ascii"), "WEBPVP8X");
    assert.ok(poster[20] & 0x10, `${name}: alpha channel`);
    assert.equal(poster.readUIntLE(24, 3) + 1, 540);
    assert.equal(poster.readUIntLE(27, 3) + 1, 960);
  }
});

test("Dragon is additive: exactly six matching choices, with Cyber and historical defaults preserved", () => {
  const actual = catalog.matches.filter(entry => catalog.animationVariants(entry.match).some(([id]) => id === "dragon"));
  assert.deepEqual(actual.map(entry => entry.match).sort(), assets.map(([name]) => name).sort());
  for (const entry of actual) {
    assert.deepEqual(catalog.animationVariants(entry.match), [["tikcontrol", "TikControl"], ["gladiador", "Gladiador"], ["cyber", "Cyber"], ["dragon", "Dragon"]]);
    assert.equal(catalog.definition(entry.key).defaultOption, "tikcontrol");
  }
});

test("Dragon retains its identity across stored reactions, relay and protected player; absent videos cannot fall back", () => {
  const context = vm.createContext({ overlayCatalog: catalog, MATCH_VIDEO_NAMES: new Set(catalog.matches.map(entry => entry.match)) });
  vm.runInContext(fs.readFileSync(path.join(root, "resources/overlays/runtime/widgets/match.js"), "utf8"), context);
  for (const [match] of assets) {
    const reaction = normalizeReaction({ type: "animation", match, variant: "dragon", fit: "contain" });
    const request = normalizeMatchPlaybackRequest(reaction);
    const relay = createMatchRelayMessage("match", request);
    assert.equal(request.variant, "dragon");
    assert.equal(relay.payload.variant, "dragon");
    assert.equal(context.normalizedMatchPlayback(relay.payload).variant, "dragon");
  }
  for (const match of ["cofre", "enigma"]) {
    const input = { match, variant: "dragon", type: "animation" };
    assert.throws(() => normalizeReaction(input), /pas disponible/);
    assert.throws(() => normalizeMatchPlaybackRequest(input), /indisponible/);
    assert.equal(createMatchRelayMessage("match", input), null);
    assert.equal(context.normalizedMatchPlayback(input), null);
  }
  const config = { automations: ["cyber", "dragon"].map(variant => ({ id: `keep-${variant}`, enabled: true, moment: "multiplierX2",
    reaction: { type: "animation", match: "x2", variant, fit: "cover" } })) };
  const normalized = normalizeMatchesConfig(config);
  assert.deepEqual(normalized.automations.map(entry => [entry.id, entry.enabled, entry.reaction]), config.automations.map(entry => [entry.id, entry.enabled, entry.reaction]));
});
