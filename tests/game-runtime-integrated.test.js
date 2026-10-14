"use strict";
const { readLegacyGameHostSource } = require("./helpers/legacy-game-host-source");
const { readMainSource } = require("./helpers/main-source-bundles");
const { readVueGameSource, readTypeScriptSourceGraph } = require("./helpers/original-game-sources");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { INTEGRATED_GAME_IDS } = require("../src/main/game-installer-manifest");
const { sanitizeGameConfiguration, sanitizeDealOrNoDealHostState, sanitizeThiercelieuxCommand, sanitizeThiercelieuxHostState } = require("../src/main/ipc");
const root = path.join(__dirname, "..");

/** Jeux maison, états privés, réglages et identité Windows. */

test("conserve les photos locales optimisées du Coin Pusher dans la configuration", () => {
  const artwork = `data:image/webp;base64,${"A".repeat(60000)}`;
  const sanitized = sanitizeGameConfiguration("coin-pusher", {
    platformImageUrl: artwork,
    plinkoImageUrl: "https://cdn.example.test/plinko.webp",
    theme: "galactic-palace"
  });

  assert.equal(sanitized.platformImageUrl, artwork);
  assert.equal(
    sanitized.plinkoImageUrl,
    "https://cdn.example.test/plinko.webp"
  );
  assert.equal(sanitized.theme, "galactic-palace");
  assert.equal(
    sanitizeGameConfiguration("coin-pusher", {
      platformImageUrl: "javascript:alert(1)"
    }).platformImageUrl,
    ""
  );
});

test("les jeux maison se lancent dans une fenêtre ShenPulse configurable", () => {
  assert.ok(INTEGRATED_GAME_IDS.includes("deal-or-no-deal"));
  assert.ok(INTEGRATED_GAME_IDS.includes("thiercelieux"));
  const runtime = readMainSource("game-runtime.js");
  assert.match(
    runtime,
    /"coin-pusher",[\s\S]*"connect-four",[\s\S]*"deal-or-no-deal"/
  );
  assert.match(runtime, /"original",[\s\S]*"index\.html"/);
  assert.match(runtime, /"host\.html"/);
  const originalGamesDirectory = path.join(
    root,
    "src",
    "renderer",
    "games",
    "original-src",
    "components",
    "games"
  );
  const coinPusher = readVueGameSource(path.join(originalGamesDirectory, "CoinPusherGame.vue"));
  const connectFour = readVueGameSource(path.join(originalGamesDirectory, "ConnectFourGame.vue"));
  const dealOrNoDeal = readVueGameSource(path.join(originalGamesDirectory, "DealOrNoDealGame.vue"));
  const thiercelieux = readVueGameSource(path.join(originalGamesDirectory, "ThiercelieuxGame.vue"));
  assert.match(coinPusher, /createCoinPusher3dRenderer/);
  assert.match(coinPusher, /coin-pusher-webgl/);
  assert.match(connectFour, /arena-stage\.png/);
  assert.match(connectFour, /class="connect-shell"/);
  assert.match(dealOrNoDeal, /live-stage\.png/);
  assert.match(dealOrNoDeal, /class="case-box"/);
  assert.match(dealOrNoDeal, /ref="premiumBasePriceRef"/);
  assert.match(dealOrNoDeal, /ref="premiumEntryPriceRef"/);
  assert.match(thiercelieux, /format-portrait/);
  assert.match(thiercelieux, /format-landscape/);
  assert.match(thiercelieux, /setGameWindowFormat/);
  assert.match(thiercelieux, /class="moon-table"/);
  assert.match(thiercelieux, /class="board-card"/);
  assert.match(thiercelieux, /publishThiercelieuxHostState/);
  assert.match(thiercelieux, /startAmbience/);
  assert.match(thiercelieux, /setAmbienceVolume/);
  assert.match(thiercelieux, /aria-label="Volume de l’ambiance"/);
  assert.match(thiercelieux, /handleBoardCard/);
  assert.match(thiercelieux, /queueNightResults/);
  assert.match(thiercelieux, /currentPrivateResult/);
  assert.match(thiercelieux, /ACTION_REVEAL_POLICY/);
  assert.match(thiercelieux, /showPlayerAvatarOnCardBack/);
  assert.match(thiercelieux, /isEliminatedRoleVisible/);
  assert.match(thiercelieux, /roleReveals/);
  assert.match(thiercelieux, /MULTIPLE_TARGET_LIMITS[\s\S]*lovers:\s*2/);
  assert.doesNotMatch(thiercelieux, /fox:\s*3/);
  assert.match(thiercelieux, /beginSecondVote/);
  assert.match(thiercelieux, /resolveScapegoatVoters/);
  assert.match(thiercelieux, /selectedTargetIds\.value\.length >= limit/);
  assert.match(thiercelieux, /disabled:\s*!selectableIds\.value\.has\(player\.id\)/);
  assert.match(thiercelieux, /INFORMATION IMMÉDIATE/);
  assert.doesNotMatch(thiercelieux, /class="guide-panel"|class="runtime-tabs"|class="guide-controls"/);
  assert.doesNotMatch(thiercelieux, /lobbyTab|simulateGift|v-model="config\.giftName"/);
  const thiercelieuxSettings = fs.readFileSync(
    path.join(
      root,
      "src",
      "renderer",
      "app",
      "features",
      "games",
      "settings-thiercelieux.js"
    ),
    "utf8"
  );
  assert.match(thiercelieuxSettings, /giftPickerField\("thiercelieuxGiftName"/);
  assert.match(thiercelieuxSettings, /data-thiercelieux-manual-name/);
  assert.match(thiercelieuxSettings, /data-action="thiercelieux-clear-queue"/);
  assert.match(thiercelieuxSettings, /data-action="thiercelieux-requeue-player"/);
  assert.match(thiercelieuxSettings, /data-action="thiercelieux-delete-player"/);
  assert.doesNotMatch(thiercelieuxSettings, /data-action="thiercelieux-remove-player"/);
  assert.match(thiercelieuxSettings, /name="thiercelieuxAssignmentMode" value="random"/);
  assert.match(thiercelieuxSettings, /name="thiercelieuxAssignmentMode" value="manual"/);
  assert.match(thiercelieuxSettings, /data-action="thiercelieux-randomize-roles"/);
  assert.match(thiercelieuxSettings, /Seuls les personnages affichés ici participeront à la partie/);
  assert.match(thiercelieuxSettings, /data-thiercelieux-role-select/);
  assert.match(thiercelieuxSettings, /handleThiercelieuxRegistrationEvent/);
  assert.match(thiercelieuxSettings, /thiercelieux-buy-extension/);
  assert.match(thiercelieuxSettings, /thiercelieux-settings-extensions/);
  assert.match(thiercelieuxSettings, /thiercelieuxCardBackAvatars/);
  assert.match(thiercelieuxSettings, /thiercelieuxAmbienceVolume/);
  assert.match(thiercelieuxSettings, /data-thiercelieux-live-volume/);
  assert.match(thiercelieuxSettings, /THIERCELIEUX_EXTENSION_ARTWORK/);
  assert.match(thiercelieuxSettings, /renderThiercelieuxLivePanel/);
  assert.match(thiercelieuxSettings, /player\.disabled \? "disabled"/);
  assert.match(thiercelieuxSettings, /thiercelieuxRolePoolIds/);
  assert.match(thiercelieuxSettings, /name="thiercelieuxContentMode" value="classic"/);
  assert.match(thiercelieuxSettings, /name="thiercelieuxContentMode" value="extensions"/);
  assert.match(thiercelieuxSettings, /thiercelieuxIncludeBaseRoles/);
  assert.match(thiercelieuxSettings, /3 extensions et le pack Anniversaire/);
  assert.match(thiercelieuxSettings, /hasProductEntitlement/);
  assert.match(thiercelieuxSettings, /THIERCELIEUX_MIN_PLAYERS = 3/);
  assert.match(thiercelieuxSettings, /thiercelieuxRecommendedRoles\(players\.length/);
  assert.doesNotMatch(thiercelieuxSettings, /impose huit joueurs/);
  const navigationGameActions = fs.readFileSync(
    path.join(root, "src", "renderer", "app", "actions", "handlers", "navigation-games.js"),
    "utf8"
  );
  assert.match(navigationGameActions, /"thiercelieux-clear-queue"/);
  assert.match(navigationGameActions, /"thiercelieux-requeue-player"/);
  assert.match(navigationGameActions, /"thiercelieux-delete-player"/);
  assert.match(navigationGameActions, /"thiercelieux-randomize-roles"/);
  assert.match(navigationGameActions, /activeQueueEntryIds/);
  assert.match(navigationGameActions, /Vider la file d’attente/);
  assert.match(navigationGameActions, /Retirer définitivement/);
  assert.match(
    readMainSource("game-runtime.js"),
    /sanitizeThiercelieuxEntitlements/
  );
  assert.match(
    readTypeScriptSourceGraph(path.join(root, "src", "renderer", "games", "original-src", "domain", "thiercelieuxEngine.mjs")),
    /Côte à côte/
  );
  assert.match(
    dealOrNoDeal,
    /font-size:\s*calc\(3\.14rem \* var\(--premium-entry-amount-scale,\s*1\)\)/
  );
  assert.match(
    dealOrNoDeal,
    /targets\.forEach\(\(target\) => \{[\s\S]*refineEntryAmountFit\(target\)/
  );
  const originalHost = fs.readFileSync(
    path.join(root, "src", "renderer", "games", "original-src", "main.ts"),
    "utf8"
  );
  assert.match(
    originalHost,
    /saveCoinPusherSettings\(\{[\s\S]*\.\.\.stored[\s\S]*platformImageUrl:/
  );
  assert.match(
    originalHost,
    /saveDealOrNoDealSettings\(\{[\s\S]*\.\.\.stored[\s\S]*boxValues:/
  );
  assert.match(
    originalHost,
    /api\.on\('state-changed',[\s\S]*migrateDesktopSettings\(gameId, updatedSettings\)/
  );
  assert.match(
    originalHost,
    /subscribeDealOrNoDealHostState\(publishPrivateState\)/
  );
  const preload = fs.readFileSync(
    path.join(root, "src", "main", "preload.js"),
    "utf8"
  );
  const ipc = readMainSource("ipc.js");
  assert.match(preload, /publishDealHostState:[\s\S]*game:deal-host-state/);
  assert.match(preload, /publishThiercelieuxHostState:[\s\S]*game:thiercelieux-host-state/);
  assert.match(preload, /sendThiercelieuxCommand:[\s\S]*game:thiercelieux-command/);
  assert.match(preload, /setGameWindowFormat:[\s\S]*game:window-format/);
  assert.match(preload, /"deal-host-state"/);
  assert.match(ipc, /handle\("game:deal-host-state"/);
  assert.match(ipc, /handle\("game:thiercelieux-host-state"/);
  assert.match(ipc, /handle\("game:thiercelieux-command"/);
  assert.match(ipc, /handle\("game:window-format"/);
  const host = readLegacyGameHostSource();
  assert.match(host, /Cadeau d’entrée/);
  assert.match(host, /roundPattern/);
  assert.match(host, /cashOfferEnabled/);
  assert.match(host, /musicTrack/);
  assert.match(host, /data-host-gift-image/);
  const musicDirectory = path.join(
    root,
    "src",
    "renderer",
    "assets",
    "games",
    "deal-or-no-deal",
    "music"
  );
  assert.equal(
    fs.readdirSync(musicDirectory).filter((file) => file.endsWith(".mp3"))
      .length,
    7
  );
});

test("le suivi privé DealOrNoDeal conserve seulement les boîtes valides", () => {
  const state = sanitizeDealOrNoDealHostState({
    phase: "opening",
    playerName: "Joueuse test",
    payoutMultiplier: 2.5,
    entryOptionId: "premium",
    boxes: [
      { id: 2, value: 9999999, opened: true },
      { id: 1, value: -9999999, own: true },
      { id: 2, value: 10 },
      { id: 25, value: 20 },
      { id: "invalide", value: 30 }
    ],
    bankerRequestText: "Offre test",
    bonusValue: 123
  });
  assert.equal(state.phase, "opening");
  assert.equal(state.playerName, "Joueuse test");
  assert.equal(state.payoutMultiplier, 2.5);
  assert.equal(state.entryOptionId, "premium");
  assert.deepEqual(state.boxes, [
    { id: 1, value: -999999, opened: false, own: true },
    { id: 2, value: 999999, opened: true, own: false }
  ]);
  assert.equal(state.bankerRequestText, "Offre test");
  assert.equal(state.bonusValue, 123);
});

test("la régie Thiercelieux filtre son état privé et ses commandes", () => {
  const state = sanitizeThiercelieuxHostState({
    screen: "game",
    phase: "night",
    dialogue: "Annonce du maître du jeu",
    players: [
      { id: "p1", name: "Alice", seat: 99, alive: true, selected: true },
      { id: "", name: "Fantôme", seat: 2 }
    ],
    availableTargets: [
      { id: "p2", name: "Bob", seat: 2, alive: true }
    ],
    resultPending: true,
    resultUnlocked: true,
    resultPlayerId: "p1",
    resultPlayerName: "Alice",
    resultSeat: 1,
    ambienceVolume: 250,
    remainingSeconds: 99999
  });
  assert.equal(state.phase, "night");
  assert.equal(state.dialogue, "Annonce du maître du jeu");
  assert.deepEqual(state.players, [
    { id: "p1", name: "Alice", seat: 8, alive: true, selected: true, disabled: false, status: "" }
  ]);
  assert.equal(state.availableTargets[0].id, "p2");
  assert.equal(state.resultPending, true);
  assert.equal(state.resultUnlocked, true);
  assert.equal(state.resultPlayerName, "Alice");
  assert.equal(state.ambienceVolume, 100);
  assert.equal(state.remainingSeconds, 3600);
  assert.deepEqual(sanitizeThiercelieuxCommand({
    type: "select-target",
    playerId: "p2",
    multiple: true,
    ignored: "secret"
  }), {
    type: "select-target",
    playerId: "p2",
    choice: "",
    multiple: true,
    value: 0
  });
  assert.equal(sanitizeThiercelieuxCommand({ type: "set-volume", value: 82.7 }).value, 83);
  assert.equal(sanitizeThiercelieuxCommand({ type: "reveal-result" }).type, "reveal-result");
  assert.equal(sanitizeThiercelieuxCommand({ type: "confirm-result" }).type, "confirm-result");
  assert.throws(
    () => sanitizeThiercelieuxCommand({ type: "delete-everything" }),
    /inconnue/
  );
});

test("l’identité visuelle Windows utilise les assets ShenPulse transparents", () => {
  const banner = fs.readFileSync(
    path.join(
      root,
      "src",
      "renderer",
      "assets",
      "brand",
      "shenpulse-banner-transparent.png"
    )
  );
  assert.equal(banner[25], 6);
  assert.ok(fs.statSync(path.join(root, "build", "shenpulse.ico")).size > 80000);
  const main = readMainSource("main.js");
  const html = fs.readFileSync(
    path.join(root, "src", "renderer", "index.html"),
    "utf8"
  );
  assert.match(main, /build", "shenpulse\.ico/);
  assert.match(html, /shenpulse-banner-transparent\.png/);
});

