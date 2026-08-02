"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createDefaultOverlayConfigs } = require("../src/main/defaults");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const {
  GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS,
  GTAV_MONT_CHILIAD_EFFECTS
} = require("../src/main/gtav-mont-chiliad-catalog");
const {
  CULT_OF_THE_LAMB_DEFAULT_MAPPINGS,
  CULT_OF_THE_LAMB_EFFECTS
} = require("../src/main/cult-of-the-lamb-catalog");
const {
  MINECRAFT_BEDROCK_DEFAULT_MAPPINGS,
  MINECRAFT_BEDROCK_EFFECTS,
  MINECRAFT_SANDBOX_DEFAULT_MAPPINGS,
  MINECRAFT_SANDBOX_EFFECTS
} = require("../src/main/minecraft-game-catalog");

const root = path.join(__dirname, "..");

test("recrée les 37 jeux conservés sans doublon et avec les tarifs réels", () => {
  const games = loadShenazenGameCatalog(path.join(root, "resources"));
  assert.equal(games.length, 37);
  assert.equal(new Set(games.map((game) => game.id)).size, 37);
  assert.ok(games.some((game) => game.id === "gtav-montchiliad"));
  assert.equal(
    games.find((game) => game.id === "gtav-montchiliad")?.installerVersion,
    "1.0.4"
  );
  assert.deepEqual(
    games
      .filter((game) =>
        [
          "liveinteractive-boat-cleaner",
          "liveinteractive-carrot-party",
          "liveinteractive-clear-pool",
          "liveinteractive-spacial-cleaner",
          "liveinteractive-gta-server"
        ].includes(game.id)
      )
      .map((game) => game.id),
    []
  );
  assert.deepEqual(
    Object.fromEntries(
      games
        .filter((game) => game.accessMode === "purchase")
        .map((game) => [game.id, game.price])
    ),
    {
      "coin-pusher": 4.99,
      "connect-four": 4.99,
      "deal-or-no-deal": 4.99,
      "diamond-drop": 4.99
    }
  );
  assert.ok(
    games
      .filter((game) => game.accessMode === "included")
      .every((game) => game.price === 0)
  );
  assert.ok(games.every((game) => game.effects.length > 0));
  assert.ok(games.every((game) => game.guide?.steps?.length >= 3));
  assert.ok(games.every((game) => Array.isArray(game.guide?.notes)));
  assert.ok(games.every((game) => game.requiresPro === true));
  assert.ok(
    games.every((game) => game.tags.includes("abonnement requis"))
  );
  assert.ok(
    games
      .filter((game) => game.source.includes("Crowd Control"))
      .every((game) => game.guide.sources.length >= 1)
  );
});

test("charge les 669 visuels d'interactions copiés depuis ShenazenOverlay", () => {
  const directory = path.join(root, "resources", "game-interactions");
  const files = fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".webp"));
  assert.equal(files.length, 669);
});

test("restaure le catalogue GTA complet, ses visuels et ses déclencheurs initiaux", () => {
  assert.equal(GTAV_MONT_CHILIAD_EFFECTS.length, 66);
  assert.equal(
    new Set(GTAV_MONT_CHILIAD_EFFECTS.map((effect) => effect.id)).size,
    66
  );
  assert.equal(GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS.length, 31);
  const effectIds = new Set(
    GTAV_MONT_CHILIAD_EFFECTS.map((effect) => effect.id)
  );
  assert.ok(
    GTAV_MONT_CHILIAD_DEFAULT_MAPPINGS.every((mapping) =>
      effectIds.has(mapping.effectId)
    )
  );
  assert.ok(
    GTAV_MONT_CHILIAD_EFFECTS.every((effect) => {
      const image = path.join(
        root,
        "resources",
        "game-interactions",
        "gtav-montchiliad",
        path.basename(effect.image)
      );
      return fs.existsSync(image) && fs.statSync(image).size > 0;
    })
  );
});

test("restaure les interactions Bedrock Box et SandBox de ShenazenOverlay", () => {
  assert.equal(MINECRAFT_BEDROCK_EFFECTS.length, 41);
  assert.equal(MINECRAFT_BEDROCK_DEFAULT_MAPPINGS.length, 28);
  assert.equal(MINECRAFT_SANDBOX_EFFECTS.length, 101);
  assert.equal(MINECRAFT_SANDBOX_DEFAULT_MAPPINGS.length, 18);

  for (const [effects, mappings] of [
    [MINECRAFT_BEDROCK_EFFECTS, MINECRAFT_BEDROCK_DEFAULT_MAPPINGS],
    [MINECRAFT_SANDBOX_EFFECTS, MINECRAFT_SANDBOX_DEFAULT_MAPPINGS]
  ]) {
    const ids = new Set(effects.map((effect) => effect.id));
    assert.equal(ids.size, effects.length);
    assert.ok(mappings.every((mapping) => ids.has(mapping.effectId)));
    assert.ok(
      effects.every((effect) => {
        const image = path.resolve(
          root,
          "src",
          "renderer",
          effect.image
        );
        return fs.existsSync(image) && fs.statSync(image).size > 0;
      })
    );
  }

  assert.equal(
    MINECRAFT_SANDBOX_EFFECTS.filter((effect) =>
      effect.id.startsWith("sandbox-sand-")
    ).length,
    38
  );
  assert.ok(
    MINECRAFT_BEDROCK_EFFECTS.some(
      (effect) => effect.id === "bedrock-blackhole"
    )
  );
});

test("restaure les 32 interactions Cult of the Lamb et leurs visuels", () => {
  assert.equal(CULT_OF_THE_LAMB_EFFECTS.length, 32);
  assert.equal(CULT_OF_THE_LAMB_DEFAULT_MAPPINGS.length, 34);
  const effectIds = new Set(
    CULT_OF_THE_LAMB_EFFECTS.map((effect) => effect.id)
  );
  assert.equal(effectIds.size, CULT_OF_THE_LAMB_EFFECTS.length);
  assert.ok(
    CULT_OF_THE_LAMB_DEFAULT_MAPPINGS.every((mapping) =>
      effectIds.has(mapping.effectId)
    )
  );
  assert.ok(
    CULT_OF_THE_LAMB_EFFECTS.every((effect) => {
      const image = path.join(
        root,
        "resources",
        "game-interactions",
        "cult-of-the-lamb",
        path.basename(effect.image)
      );
      return fs.existsSync(image) && fs.statSync(image).size > 0;
    })
  );
});

test("limite la galerie aux 17 overlays activés et conserve leurs réglages", () => {
  const configs = createDefaultOverlayConfigs();
  assert.equal(Object.keys(configs).length, 17);
  assert.deepEqual(
    Object.keys(configs).filter((id) => id.startsWith("match")),
    [
      "matchX2",
      "matchX3",
      "matchGants",
      "matchCoffre",
      "matchSnipe",
      "matchTapTap",
      "matchQuiereme",
      "matchEnigma"
    ]
  );
  assert.equal(configs.coinJar.current, 0);
  assert.equal(configs.wheel.schemaVersion, 11);
  assert.equal(configs.wheel.wheels.length, 2);
  assert.equal(configs.wheel.choices.length, 8);
  assert.equal(configs.wheel.wheels[0].segments.length, 8);
  assert.equal(configs.wheel.wheels[1].segments.length, 12);
  assert.deepEqual(
    configs.wheel.wheels.map((wheel) => wheel.design),
    ["classic", "royal"]
  );
  assert.equal(configs.wheel.wheels[1].design, "royal");
});

test("réintègre les deux rendus de roue ShenazenOverlay dans l’éditeur et la source OBS", () => {
  const renderer = fs.readFileSync(
    path.join(root, "src", "renderer", "app.js"),
    "utf8"
  );
  const overlayRuntime = fs.readFileSync(
    path.join(root, "resources", "overlays", "overlay.js"),
    "utf8"
  );
  const overlayStyles = fs.readFileSync(
    path.join(root, "resources", "overlays", "overlay.css"),
    "utf8"
  );
  assert.match(renderer, /wheelDesignOption\("classic"/);
  assert.match(renderer, /wheelDesignOption\("royal"/);
  assert.match(overlayRuntime, /wheel-rim-star/);
  assert.match(overlayRuntime, /wheel-royal-light/);
  assert.match(overlayRuntime, /wheel-royal-bead/);
  assert.match(overlayStyles, /\.wheel-stage\.royal \.wheel-frame/);
  assert.match(overlayStyles, /\.wheel-rim-star/);
});

test("embarque toutes les vidéos de match utilisées par les deux variantes", () => {
  const videoDirectory = path.join(root, "resources", "overlays", "media", "video");
  const videos = fs.readdirSync(videoDirectory).filter((file) => file.endsWith(".webm"));
  assert.equal(videos.length, 15);
  assert.ok(videos.includes("x2-tikcontrol.webm"));
  assert.ok(videos.includes("x2-gladiador.webm"));
  assert.ok(videos.includes("enigma-tikcontrol.webm"));
});
