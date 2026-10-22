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
const overlayCatalog = require("../resources/overlays/overlay-catalog");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { hasGameAccess, assertGameAccess } = require("../src/main/game-access");
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
  assert.equal(games.length, 53);
  assert.equal(new Set(games.map((game) => game.id)).size, 53);
  assert.equal(
    games.filter((game) => !["fortnite", "thiercelieux"].includes(game.id)).length,
    51
  );
  assert.equal(games.find((game) => game.id === "fortnite")?.ownerOnly, true);
  assert.equal(
    games.find((game) => game.id === "rocket-league")?.effects.length,
    21
  );
  assert.equal(games.find((game) => game.id === "thiercelieux")?.included, false);
  assert.equal(
    games.find((game) => game.id === "thiercelieux")?.accessMode,
    "purchase"
  );
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
      thiercelieux: 4.99,
      "coin-pusher": 4.99,
      "connect-four": 4.99,
      "clash-of-live": 12.99,
      "color-strike": 19.99,
      "tiklive-climb": 9.99,
      "tiklive-cube-wars": 9.99,
      "tiklive-stack-tower": 9.99,
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
  assert.ok(games.filter((game) => game.accessMode === "purchase").every((game) => game.requiresPro === false));
  assert.ok(games.filter((game) => game.requiresPro === false).every((game) => !game.tags.includes("abonnement requis")));
  assert.ok(
    games
      .filter((game) => game.source.includes("Crowd Control"))
      .every((game) => game.guide.sources.length >= 1)
  );
});

test("le catalogue exige Pro pour tous les jeux et préserve les droits d'achat séparés", () => {
  const games = loadShenazenGameCatalog(path.join(root, "resources"));
  const free = { commerce: { subscription: { tier: "free", source: "none", status: "inactive" }, gameEntitlements: [] } };
  const pro = { commerce: { subscription: { tier: "pro", source: "subscription", status: "active" }, gameEntitlements: [] } };
  const includedFree = games.filter((game) => game.accessMode === "included" && game.requiresPro === false);
  const purchases = games.filter((game) => game.accessMode === "purchase");
  const includedPro = games.filter((game) => game.accessMode === "included" && game.requiresPro === true);
  assert.ok(includedFree.length > 0);
  assert.ok(purchases.length > 0);
  assert.ok(includedPro.length > 0);
  for (const game of includedFree) {
    assert.equal(hasGameAccess(free, game), false, game.id);
    assert.throws(() => assertGameAccess(free, game), /abonnement/);
    assert.equal(hasGameAccess(pro, game), true, game.id);
    assert.equal(assertGameAccess(pro, game), game);
  }
  for (const game of purchases) {
    assert.equal(game.requiresPro, false, game.id);
    assert.equal(hasGameAccess(free, game), false, game.id);
    assert.equal(hasGameAccess(pro, game), false, `${game.id} ne devient pas gratuit avec Pro`);
    assert.throws(() => assertGameAccess(free, game), /achat|essai/);
    const purchased = { commerce: { ...free.commerce, gameEntitlements: [{ gameId: game.id, source: "purchase", status: "paid" }] } };
    assert.equal(hasGameAccess(purchased, game), false, `${game.id} acheté conserve son droit en Free sans ouvrir l'accès`);
    assert.throws(() => assertGameAccess(purchased, game), /abonnement/);
    const subscribedPurchase = { commerce: { ...pro.commerce, gameEntitlements: purchased.commerce.gameEntitlements } };
    assert.equal(hasGameAccess(subscribedPurchase, game), true, `${game.id} acheté fonctionne avec Pro`);
    assert.equal(assertGameAccess(subscribedPurchase, game), game);
    assert.equal(purchased.commerce.gameEntitlements[0].status, "paid", "aucun achat ne doit être modifié par les vérifications d'accès");
    assert.equal(hasGameAccess({ commerce: { ...pro.commerce, gameEntitlements: [{ gameId: game.id, source: "purchase", status: "refunded" }] } }, game), false, `${game.id} remboursé reste verrouillé même avec Pro`);
    assert.equal(hasGameAccess({ commerce: { ...pro.commerce, gameEntitlements: [{ gameId: game.id, source: "trial", status: "trial", expiresAtMs: Date.now() - 1000 }] } }, game), false, `${game.id} essai expiré reste verrouillé même avec Pro`);
  }
  for (const game of includedPro) {
    assert.equal(hasGameAccess(free, game), false, game.id);
    assert.throws(() => assertGameAccess(free, game), /abonnement/);
    assert.equal(hasGameAccess(pro, game), true, game.id);
  }
});

test("reprend les 30 interactions actives du pack Crowd Control Euro Truck Simulator 2", () => {
  const game = loadShenazenGameCatalog(path.join(root, "resources")).find(
    (entry) => entry.id === "euro-truck-simulator-2"
  );

  assert.ok(game);
  assert.equal(game.guide.mode, "crowd-control-mod");
  assert.equal(game.installerVersion, "1.0.5");
  assert.deepEqual(game.connector, {
    type: "tcp-server",
    host: "127.0.0.1",
    port: 58441,
    timeoutMs: 12000,
    durationMultiplier: 1000,
    expectResponse: true,
    launchConnectionTimeoutMs: 90000,
    launchConnectionFailureMessage: "Euro Truck Simulator 2 n’a pas établi sa connexion à ShenPulse. Confirmez le message du SDK avancé dans le jeu s’il apparaît. Si le jeu était déjà ouvert, fermez-le puis relancez-le depuis ShenPulse. Si nécessaire, réinstallez les interactions dans le dossier de cette édition du jeu."
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
  assert.equal(game.installerVersion, "2.1.4");
  assert.deepEqual(game.connector, {
    type: "tcp-server",
    host: "127.0.0.1",
    port: 58443,
    timeoutMs: 12000,
    durationMultiplier: 1000,
    expectResponse: true,
    focusProcessOnManualTrigger: "re3",
    temporaryFailureRetryMs: 15000,
    temporaryFailureRetryIntervalMs: 500,
    temporaryFailureMessage:
      "Resident Evil 3 n’est pas encore dans une phase jouable. Reprenez la partie et fermez les menus, puis réessayez hors cinématique et chargement."
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
  assert.equal(configs.coinJar.current, undefined);
  assert.equal(configs.coinJar.target, undefined);
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
  assert.deepEqual(overlayCatalog.definition("wheel").options.map(([design]) => design), ["classic", "royal"]);
  assert.match(renderer, /overlaySelect\("wheelDesign"/);
  assert.match(overlayRuntime, /wheel-rim-star/);
  assert.match(overlayRuntime, /wheel-royal-light/);
  assert.match(overlayRuntime, /wheel-royal-bead/);
  assert.match(overlayStyles, /\.wheel-stage\.royal \.wheel-frame/);
  assert.match(overlayStyles, /\.wheel-rim-star/);
});

test("embarque exactement les vidéos de match déclarées par le catalogue canonique", () => {
  const videoDirectory = path.join(root, "resources", "overlays", "media", "video");
  const videos = fs.readdirSync(videoDirectory).filter((file) => file.endsWith(".webm"));
  const declared = overlayCatalog.matches.flatMap(({ match }) =>
    overlayCatalog.animationVariants(match).map(([variant]) => `${match}-${variant}.webm`));
  assert.equal(new Set(declared).size, declared.length, "aucune déclaration ne duplique un fichier");
  assert.deepEqual(videos.sort(), declared.sort(), "ni variante manquante ni vidéo orpheline");
  for (const filename of declared) assert.ok(fs.statSync(path.join(videoDirectory, filename)).size > 0, filename);
});
