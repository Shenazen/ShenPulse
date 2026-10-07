"use strict";

const {
  readOverlayRuntimeSource,
  readOverlayStyles,
  readRendererSource,
  readRendererStyles
} = require("./helpers/source-bundles");

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
  MINECRAFT_SANDBOX_EFFECTS,
  MINECRAFT_SURVIVAL_DEFAULT_MAPPINGS,
  MINECRAFT_SURVIVAL_EFFECTS
} = require("../src/main/minecraft-game-catalog");
const {
  EURO_TRUCK_SIMULATOR_2_DEFAULT_MAPPINGS,
  EURO_TRUCK_SIMULATOR_2_EFFECTS
} = require("../src/main/euro-truck-simulator-2-catalog");
const {
  RESIDENT_EVIL_3_DEFAULT_MAPPINGS,
  RESIDENT_EVIL_3_EFFECTS
} = require("../src/main/resident-evil-3-catalog");

const root = path.join(__dirname, "..");

test("conserve les jeux existants et ajoute les jeux ShenPulse sans doublon", () => {
  const games = loadShenazenGameCatalog(path.join(root, "resources"));
  assert.equal(games.length, 42);
  assert.equal(new Set(games.map((game) => game.id)).size, 42);
  assert.equal(
    games.filter((game) => !["fortnite", "thiercelieux"].includes(game.id)).length,
    40
  );
  assert.equal(games.find((game) => game.id === "fortnite")?.ownerOnly, true);
  assert.equal(games.find((game) => game.id === "thiercelieux")?.included, true);
  assert.equal(
    games.find((game) => game.id === "minecraft-survival-plugin")?.name,
    "Minecraft Survival"
  );
  assert.equal(
    games.find((game) => game.id === "minecraft-survival-plugin")?.connector.type,
    "minecraft-runtime"
  );
  assert.match(games.find((game) => game.id === "thiercelieux")?.description || "", /3 à 8 joueurs/);
  assert.deepEqual(
    games.find((game) => game.id === "thiercelieux")?.addOns.map(
      ({ packId, price }) => ({ packId, price })
    ),
    [
      { packId: "nouvelle-lune", price: 3.99 },
      { packId: "village", price: 3.99 },
      { packId: "personnages", price: 3.99 },
      { packId: "25-ans", price: 3.99 }
    ]
  );
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

test("reprend les 30 interactions actives du pack Crowd Control Euro Truck Simulator 2", () => {
  const game = loadShenazenGameCatalog(path.join(root, "resources")).find(
    (entry) => entry.id === "euro-truck-simulator-2"
  );

  assert.ok(game);
  assert.equal(game.guide.mode, "crowd-control-mod");
  assert.equal(game.installerVersion, "1.0.4");
  assert.deepEqual(game.connector, {
    type: "tcp-server",
    host: "127.0.0.1",
    port: 51337,
    timeoutMs: 12000,
    durationMultiplier: 1000,
    expectResponse: true
  });
  assert.equal(EURO_TRUCK_SIMULATOR_2_EFFECTS.length, 30);
  assert.equal(EURO_TRUCK_SIMULATOR_2_DEFAULT_MAPPINGS.length, 30);
  assert.equal(
    new Set(EURO_TRUCK_SIMULATOR_2_EFFECTS.map((effect) => effect.code)).size,
    30
  );
  assert.ok(
    EURO_TRUCK_SIMULATOR_2_DEFAULT_MAPPINGS.every((mapping) =>
      EURO_TRUCK_SIMULATOR_2_EFFECTS.some(
        (effect) => effect.id === mapping.effectId
      )
    )
  );
  assert.ok(
    EURO_TRUCK_SIMULATOR_2_EFFECTS.every(
      (effect) =>
        effect.available === true &&
        effect.service === "native" &&
        effect.image.startsWith(
          "https://resources.crowdcontrol.live/images/EuroTruckSimulator2/"
        )
    )
  );
  assert.deepEqual(
    EURO_TRUCK_SIMULATOR_2_EFFECTS
      .filter((effect) => effect.duration > 0)
      .map((effect) => [effect.code, effect.duration]),
    [
      ["hazards", 10],
      ["gear_chaos", 10],
      ["lights_disco", 10],
      ["speed_boost", 10],
      ["speed_governor", 20],
      ["airhorn", 5],
      ["trailer_brake", 5],
      ["blinker_party", 10],
      ["slow_down", 10],
      ["brake_slam", 3],
      ["steering_chaos", 12],
      ["horn_spam", 8],
      ["camera_chaos", 10]
    ]
  );
});

test("reprend les 67 interactions du pack Crowd Control Resident Evil 3 recommandé", () => {
  const game = loadShenazenGameCatalog(path.join(root, "resources")).find(
    (entry) => entry.id === "resident-evil-3"
  );

  assert.ok(game);
  assert.equal(game.guide.mode, "native");
  assert.equal(game.installerVersion, "2.1.2");
  assert.deepEqual(game.connector, {
    type: "tcp-server",
    host: "127.0.0.1",
    port: 58431,
    timeoutMs: 12000,
    durationMultiplier: 1000,
    expectResponse: true
  });
  assert.equal(RESIDENT_EVIL_3_EFFECTS.length, 67);
  assert.equal(RESIDENT_EVIL_3_DEFAULT_MAPPINGS.length, 67);
  assert.equal(
    new Set(RESIDENT_EVIL_3_EFFECTS.map((effect) => effect.code)).size,
    67
  );
  assert.ok(
    RESIDENT_EVIL_3_DEFAULT_MAPPINGS.every((mapping) =>
      RESIDENT_EVIL_3_EFFECTS.some(
        (effect) => effect.id === mapping.effectId
      )
    )
  );
  assert.ok(
    RESIDENT_EVIL_3_EFFECTS.every(
      (effect) =>
        effect.available === true &&
        effect.service === "native" &&
        effect.image.startsWith(
          "https://resources.crowdcontrol.live/images/ResidentEvil3/"
        )
    )
  );
  assert.deepEqual(
    RESIDENT_EVIL_3_EFFECTS
      .filter((effect) => effect.duration > 0)
      .map((effect) => [effect.code, effect.duration]),
    [
      ["ohko", 30],
      ["invul", 60],
      ["wide", 30],
      ["narrow", 30],
      ["giant", 30],
      ["tiny", 30],
      ["egiant", 30],
      ["etiny", 30],
      ["efast", 15],
      ["eslow", 15]
    ]
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

test("réunit les interactions Bedrock Box, SandBox et Survival dans Minecraft", () => {
  assert.equal(MINECRAFT_BEDROCK_EFFECTS.length, 41);
  assert.equal(MINECRAFT_BEDROCK_DEFAULT_MAPPINGS.length, 28);
  assert.equal(MINECRAFT_SANDBOX_EFFECTS.length, 101);
  assert.equal(MINECRAFT_SANDBOX_DEFAULT_MAPPINGS.length, 18);
  assert.equal(MINECRAFT_SURVIVAL_EFFECTS.length, 65);
  assert.equal(MINECRAFT_SURVIVAL_DEFAULT_MAPPINGS.length, 0);

  for (const [effects, mappings] of [
    [MINECRAFT_BEDROCK_EFFECTS, MINECRAFT_BEDROCK_DEFAULT_MAPPINGS],
    [MINECRAFT_SANDBOX_EFFECTS, MINECRAFT_SANDBOX_DEFAULT_MAPPINGS],
    [MINECRAFT_SURVIVAL_EFFECTS, MINECRAFT_SURVIVAL_DEFAULT_MAPPINGS]
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
  assert.equal(
    MINECRAFT_SURVIVAL_EFFECTS.find(
      (effect) => effect.id === "survival-tnt"
    )?.command,
    "/survival tnt {{timer}} {{power}} {{radius}} {{viewer}}"
  );
  assert.ok(
    MINECRAFT_SURVIVAL_EFFECTS.some(
      (effect) => effect.id === "survival-zombie-netherite"
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
  const renderer = readRendererSource();
  const overlayRuntime = readOverlayRuntimeSource();
  const overlayStyles = readOverlayStyles();
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
