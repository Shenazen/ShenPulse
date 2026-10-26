"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const { renderer, rendererHtml, rendererCss, gameOverlayGenerator, gameHost } = require("./helpers/catalog-regression-fixtures");

/** Profils, catalogue et parcours intégrés des jeux. */

test("la liste des profils utilise un menu lisible et présenté", () => {
  assert.match(rendererHtml, /id="profile-picker-button"/);
  assert.match(rendererHtml, /id="profile-menu"/);
  assert.match(renderer, /class="profile-menu-item/);
  assert.match(rendererCss, /\.profile-menu-item\.active/);
  assert.match(rendererCss, /\.titlebar\s*\{[\s\S]*z-index:\s*1000/);
  assert.match(rendererCss, /\.profile-menu\s*\{[\s\S]*z-index:\s*1100/);
});

test("les catalogues retirent les blocs techniques et classent les overlays comme ShenazenOverlay", () => {
  assert.doesNotMatch(renderer, /Bibliothèque incluse/);
  assert.doesNotMatch(renderer, /API WebSocket locale/);
  for (const label of [
    "Compteurs",
    "Classements",
    "Interactions",
    "Actions",
    "Cadeaux",
    "Matchs"
  ]) {
    assert.match(renderer, new RegExp(`"${label}"`));
  }
  assert.match(renderer, /class="overlay-category-section"/);
});

test("les jeux intégrés ont leurs réglages et leur fenêtre de jeu dédiée", () => {
  assert.match(renderer, /CONFIGURABLE_INTEGRATED_GAMES/);
  assert.match(renderer, /data-integrated-game-settings/);
  assert.match(renderer, /Enregistrer et ouvrir le jeu/);
  assert.match(gameHost, /function renderCoinPusher/);
  assert.match(gameHost, /function renderConnectFour/);
  assert.match(gameHost, /function renderDeal/);
});

test("Coin Pusher retrouve ses deux cartes de design et l’import local de photos", () => {
  assert.match(renderer, /coin-pusher-theme-selector/);
  assert.match(renderer, /SECOND MODÈLE/);
  assert.match(renderer, /Palais galactique/);
  assert.match(renderer, /data-coin-pusher-artwork-file/);
  assert.match(renderer, /function optimizeCoinPusherArtwork/);
  assert.match(renderer, /canvas\.toDataURL\("image\/webp"/);
  assert.match(renderer, /Importer une photo/);
  assert.match(rendererCss, /\.coin-pusher-theme-choice--galactic-palace/);
  assert.match(rendererCss, /\.coin-pusher-artwork-grid/);
});

test("Coin Pusher présente son barème cadeau et ses bonus dans l’étape Interactions", () => {
  for (const field of [
    "guardGiftDurationSeconds",
    "mysterySpawnChance",
    "mysteryPointsMin",
    "mysteryCoinRainMax",
    "mysteryMultiplierDurationSeconds",
    "ticketsCountPerGift",
    "coinPusherTierDiamonds",
    "coinPusherTierCoinCount",
    "coinPusherGiftRuleName",
    "coinPusherGiftRuleCoinCount",
    "winnerPrizePercents",
    "data-coin-pusher-interactions"
  ]) {
    assert.match(renderer, new RegExp(field));
  }
  assert.match(renderer, /Valeur du cadeau → nombre de pièces/);
  assert.match(renderer, /Exceptions par cadeau précis/);
  assert.match(renderer, /ACTIONS ÉVÉNEMENTIELLES/);
  assert.match(rendererCss, /\.coin-pusher-reward-layout/);
  assert.match(rendererCss, /\.coin-pusher-gift-rule-row/);
  assert.match(rendererCss, /\.coin-pusher-special-grid/);
});

test("Coin Pusher passe directement des interactions au démarrage sans onglet Overlays", () => {
  assert.match(
    renderer,
    /if \(pack\.id === "coin-pusher"\) \{[\s\S]*\.filter\(\(step\) => step\.id !== "overlays"\)/
  );
  assert.match(
    renderer,
    /const nextStep = journey\[currentStepIndex \+ 1\][\s\S]*data-value="\$\{escapeHtml\(nextStep\.id\)\}"/
  );
});

test("DealOrNoDeal expose tous ses réglages historiques", () => {
  for (const field of [
    "bankerRequestCount",
    "spendPremiumEntryCost",
    "riggingSelectedChancePercent",
    "riggingFinalLowChancePercent"
  ]) {
    assert.match(renderer, new RegExp(field.replace(/\./g, "\\.")));
  }
  assert.match(renderer, /\["finalDuel", "Duel final"/);
  assert.match(renderer, /name="music\.\$\{scene\}\.url"/);
  assert.match(renderer, /Valeurs des 24 boîtes/);
  assert.match(renderer, /name="boxValue" type="number"/);
  assert.match(renderer, /integratedSettingsTabLabel\("deal-settings-cheat"[\s\S]*"Triche"/);
  assert.match(renderer, /function renderDealPrivateMonitor/);
  assert.match(renderer, /effectiveValue[\s\S]*payoutMultiplier/);
  assert.match(renderer, /GAINS ×/);
  assert.match(renderer, /api\.on\("deal-host-state"/);
  assert.match(renderer, /function canUseDealCheatSettings/);
  assert.match(rendererCss, /#deal-settings-cheat:checked/);
  assert.match(rendererCss, /\.deal-private-box-grid/);
  assert.match(rendererCss, /\.integrated-box-values-grid/);
  assert.match(rendererCss, /grid-template-columns:\s*minmax\(215px,\s*245px\)/);
});

test("le chronomètre LIVE ne peut plus être écrasé par le format des délais", () => {
  assert.equal((renderer.match(/function formatDuration\(/g) || []).length, 1);
  assert.match(renderer, /function formatIntervalDuration\(milliseconds\)/);
  assert.match(
    renderer,
    /formatIntervalDuration\(timer\.repeatDelayMs\)/
  );
  assert.match(
    renderer,
    /sessionLabel\.textContent = state\.session\.running \? `LIVE · \$\{formatDuration\(state\.session\.startedAt\)\}`/
  );
});

test("la page GTA remplace la roue par le générateur lié aux interactions actives", () => {
  assert.match(
    renderer,
    /pack\.id === "gtav-montchiliad"\s*\?\s*\["winCounter", "multiplierTimer"\]/
  );
  assert.match(renderer, /function gtaInteractionOverlayEntries\(pack\)/);
  assert.match(renderer, /function downloadGtaInteractionOverlay\(packId, model = 1\)/);
  assert.match(renderer, /canvas\.width = 1080/);
  assert.match(renderer, /canvas\.height = 1920/);
  assert.match(renderer, /const columns = selectedModel === 1 \? 6 : 8/);
  assert.match(renderer, /overlay_win_add_45/);
  assert.match(renderer, /overlay_win_remove_50/);
  assert.match(renderer, /Télécharger le modèle 1/);
  assert.match(renderer, /Fond du modèle 1/);
});

test("Minecraft place le téléchargement en premier et retire la roue inutile", () => {
  assert.match(
    renderer,
    /MINECRAFT_MODE_IDS\.includes\(pack\.id\)\s*\?\s*\["timer", "multiplierTimer", "winCounter"\]/
  );
  assert.match(
    renderer,
    /game-overlay-composer-layout">\s*\$\{renderGameInteractionOverlayCard\(pack, unlocked\)\}\s*<div class="overlay-catalog-grid/
  );
  assert.match(
    rendererCss,
    /\.game-overlay-composer-layout > \.game-interaction-overlay-card\s*\{\s*order: -1;/
  );
  assert.doesNotMatch(
    renderer,
    /MINECRAFT_MODE_IDS\.includes\(pack\.id\)[\s\S]{0,100}\bwheel\b/
  );
});

test("tous les jeux réutilisent le générateur historique ShenazenOverlay", () => {
  assert.match(rendererHtml, /<script src="game-overlay-generator\.js"><\/script>/);
  assert.match(renderer, /function downloadGameInteractionOverlay\(packId, model = 1\)/);
  assert.match(renderer, /ShenPulseGameOverlay\.renderMinecraftStyledOverlay/);
  assert.match(renderer, /canvas\.width/);
  assert.match(gameOverlayGenerator, /var OVERLAY_WIDTH = 1080/);
  assert.match(gameOverlayGenerator, /var OVERLAY_HEIGHT = 1920/);
  assert.match(gameOverlayGenerator, /function drawWinColumn/);
  assert.match(gameOverlayGenerator, /function drawModelOneInteractionGrid/);
  assert.match(gameOverlayGenerator, /const columns = Math\.max\(1, Math\.min\(6, items\.length\)\)/);
  assert.match(gameOverlayGenerator, /PressStart2P-Regular\.ttf/);
});

test("les jeux avec mod, dont Mortuary, affichent uniquement le générateur de cadeaux", () => {
  const declaration = renderer.match(/const GAME_OVERLAY_GENERATOR_ONLY_IDS = new Set\(\[[\s\S]*?\]\);/);
  assert.ok(declaration);
  const games = require("node:vm").runInNewContext(`${declaration[0]} GAME_OVERLAY_GENERATOR_ONLY_IDS;`);
  for (const id of ["dead-by-daylight", "dredge", "egging-on", "fallout-4", "ark-survival-ascended", "balatro", "blue-prince", "crash-bandicoot-n-sane-trilogy", "unturned", "the-mortuary-assistant", "cult-of-the-lamb", "stardew-valley", "terraria", "hogwarts-legacy", "tcg-card-shop-simulator", "supermarket-simulator", "shift-at-midnight"]) assert.equal(games.has(id), true, id);
  const branchStart = renderer.indexOf(
    "if (GAME_OVERLAY_GENERATOR_ONLY_IDS.has(pack.id))"
  );
  const genericOverlaysStart = renderer.indexOf(
    "const items = gameOverlayItemsFor(pack);",
    branchStart
  );
  const generatorOnlyBranch = renderer.slice(branchStart, genericOverlaysStart);
  assert.ok(branchStart >= 0 && genericOverlaysStart > branchStart);
  assert.match(
    generatorOnlyBranch,
    /Aucun autre overlay n’est proposé pour ce jeu\.[\s\S]*game-overlay-composer-layout--generator-only[\s\S]*renderGameInteractionOverlayCard\(pack, unlocked\)/
  );
  assert.doesNotMatch(generatorOnlyBranch, /renderOverlayCard|overlay-catalog-grid/);
  assert.match(
    renderer,
    /!GAME_OVERLAY_GENERATOR_ONLY_IDS\.has\(pack\.id\) \|\|\s*gameOverlayTriggerType\(row\.rule\) === "gift"/
  );
  assert.doesNotMatch(renderer, /Aucun overlay requis/);
});

test("les raccourcis du dashboard suivent la visibilité de leurs pages", () => {
  assert.match(
    renderer,
    /canNavigateTo\("users"\) \? '<button class="dashboard-text-link" data-navigate="users"/
  );
  assert.match(renderer, /canNavigateTo\("activity"\) \? '<button class="dashboard-text-link" data-navigate="activity"/);
});

test("les WINS natifs actualisent les aperçus sans reconstruire la page du jeu", () => {
  assert.match(renderer, /function gamePageStateSignature\(value\)/);
  assert.match(
    renderer,
    /const refreshGamePage =\s*currentPage === "games"[\s\S]*gamePageStateSignature\(previous\) !== gamePageStateSignature\(value\)/
  );
  assert.match(
    renderer,
    /hasOverlayRuntimePreview\(\) && overlayPreviewSessionChanged\(previous, value\)/
  );
  assert.match(renderer, /postOverlayPreviewEvent\(\s*"session-state"/);
});

test("l'éditeur d'interaction conserve la variation WINS configurée", () => {
  assert.match(
    renderer,
    /effect\.winCounter && isMinecraftWinCounterPack\(config\.packId\)/
  );
  assert.match(renderer, /field\("winCounterAmount", amountLabel, amount/);
  assert.match(
    renderer,
    /function gameWinCounterConfigFromForm\(effect, config, data\)[\s\S]*const sameEffect = config\.effectId === effect\.id[\s\S]*config\.amount \?\? effect\.winCounter\.amount/
  );
  assert.match(
    renderer,
    /\.\.\.gameWinCounterConfigFromForm\(effect, config, data\)/
  );
});
