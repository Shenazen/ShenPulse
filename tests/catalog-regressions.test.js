"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const renderer = fs.readFileSync(
  path.join(root, "src", "renderer", "app.js"),
  "utf8"
);
const rendererHtml = fs.readFileSync(
  path.join(root, "src", "renderer", "index.html"),
  "utf8"
);
const rendererCss = fs.readFileSync(
  path.join(root, "src", "renderer", "styles.css"),
  "utf8"
);
const gameOverlayGenerator = fs.readFileSync(
  path.join(root, "src", "renderer", "game-overlay-generator.js"),
  "utf8"
);
const overlayCss = fs.readFileSync(
  path.join(root, "resources", "overlays", "overlay.css"),
  "utf8"
);
const overlayRuntime = fs.readFileSync(
  path.join(root, "resources", "overlays", "overlay.js"),
  "utf8"
);
const coinJarPhysics = fs.readFileSync(
  path.join(root, "resources", "overlays", "coin-jar-physics.js"),
  "utf8"
);
const overlayHtml = fs.readFileSync(
  path.join(root, "resources", "overlays", "index.html"),
  "utf8"
);
const sourceHub = fs.readFileSync(
  path.join(root, "src", "main", "source-hub.js"),
  "utf8"
);
const overlayDefaults = fs.readFileSync(
  path.join(root, "src", "main", "defaults.js"),
  "utf8"
);
const stateStore = fs.readFileSync(
  path.join(root, "src", "main", "store.js"),
  "utf8"
);
const gameHost = fs.readFileSync(
  path.join(root, "src", "renderer", "games", "host.js"),
  "utf8"
);

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

test("le Like Goal classique garde son ratio et remplit le cadre intérieur", () => {
  assert.match(rendererCss, /\.preview-theme-classic/);
  assert.match(rendererCss, /aspect-ratio:\s*6\.5\s*\/\s*1/);
  assert.match(overlayCss, /\[data-theme="classic"\] \.like-goal-bar/);
  assert.match(overlayCss, /inset:\s*21% 8\.5% 19%/);
  assert.match(
    renderer,
    /likeGoal:\s*\{[\s\S]*schemaVersion:\s*2[\s\S]*scale:\s*100/
  );
  assert.match(
    overlayDefaults,
    /likeGoal:\s*\{[\s\S]*schemaVersion:\s*2[\s\S]*scale:\s*100/
  );
  assert.match(
    stateStore,
    /overlayId === "likeGoal"[\s\S]*Number\(stored\.scale\) === 60[\s\S]*merged\.scale = 100/
  );
  assert.match(
    stateStore,
    /overlayId === "likeGoal"[\s\S]*Number\(saved\.scale\) === 60[\s\S]*merged\.scale = 100/
  );
});

test("les anciennes couleurs Like Goal alimentent les trois couleurs de texte", () => {
  assert.match(
    stateStore,
    /merged\.likeGoalTitleColor\s*=\s*[\s\S]*stored\.textColor/
  );
  assert.match(
    stateStore,
    /merged\.likeGoalContentColor\s*=\s*[\s\S]*stored\.textColor/
  );
  assert.match(
    stateStore,
    /merged\.likeGoalPercentColor\s*=\s*[\s\S]*stored\.secondaryColor/
  );
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

test("tous les apercus reutilisent la source OBS reelle", () => {
  assert.match(renderer, /function overlayRuntimeFrame\(/);
  assert.match(
    renderer,
    /function overlayPreview\(item, config = null\) \{\s*return overlayRuntimeFrame\(item, config, \{ context: "card" \}\);\s*\}/
  );
  assert.match(
    renderer,
    /function overlayLivePreview[\s\S]*overlayRuntimeFrame\(item, config, \{[\s\S]*context: "live"[\s\S]*editable: true/
  );
  assert.match(renderer, /class="overlay-runtime-frame overlay-runtime-frame--/);
  assert.doesNotMatch(renderer, /function themedOverlayPreview\(/);
  assert.doesNotMatch(renderer, /function wheelEditorMachine\(/);
});

test("les zones d'apercu des overlays restent visuellement transparentes", () => {
  const runtimeFrame =
    rendererCss.match(/\.overlay-runtime-frame\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const cardFrame =
    rendererCss.match(/\.overlay-runtime-frame--card\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const liveFrame =
    rendererCss.match(
      /\.overlay-live-frame-shell,\s*\n\.overlay-runtime-frame--live\s*\{([\s\S]*?)\n\}/
    )?.[1] || "";

  assert.match(runtimeFrame, /background:\s*transparent/);
  assert.doesNotMatch(runtimeFrame, /background-image|background-size/);
  assert.match(cardFrame, /border:\s*0/);
  assert.match(liveFrame, /background:\s*transparent/);
  assert.match(liveFrame, /border:\s*0/);
});

test("les deux designs de roue prevus utilisent aussi le rendu OBS reel", () => {
  assert.match(renderer, /\["classic", "Orange classique"\]/);
  assert.match(renderer, /\["royal", "Royale Prestige"\]/);
  assert.match(
    renderer,
    /overlayLivePreview\(item, config, \{ compact: true \}\)/
  );
  assert.match(renderer, /data-wheel-design-thumbnail/);
  assert.match(
    renderer,
    /wheelDesignOption\("classic"[\s\S]*wheelDesignOption\("royal"/
  );
});

test("la roue ne superpose plus de rayons jaunes aux secteurs", () => {
  const finalWheelRules = overlayCss.slice(
    overlayCss.indexOf(".wheel-stage .wheel-frame::after")
  );
  assert.doesNotMatch(
    finalWheelRules,
    /repeating-conic-gradient\(from -90deg,\s*rgba\(255,\s*235,\s*176/
  );
  assert.doesNotMatch(
    finalWheelRules,
    /repeating-conic-gradient\(from -90deg,\s*rgba\(255,\s*255,\s*255,\s*\.22\)/
  );
  assert.doesNotMatch(
    finalWheelRules,
    /repeating-conic-gradient\(from -90deg,\s*rgba\(255,\s*221,\s*99/
  );
  assert.doesNotMatch(overlayRuntime, /sectorSeparators|repeating-conic-gradient\(from -90deg/);
});

test("les textes, les couleurs et le gagnant de la roue utilisent le même angle", () => {
  assert.match(overlayRuntime, /conic-gradient\(from 0deg/);
  assert.match(
    overlayRuntime,
    /const stopAngle = 360 - \(winnerIndex \+ 0\.5\) \* segmentAngle/
  );
});

test("les cartes montrent les aperçus Pro mais masquent leurs sources verrouillées", () => {
  assert.match(renderer, /label:\s*`Largeur \$\{width\} px · Hauteur \$\{height\} px`/);
  assert.match(
    renderer,
    /class="overlay-source-dimensions"[\s\S]*?<small>Largeur<\/small><strong>\$\{size\.width\} px<\/strong>[\s\S]*?<small>Hauteur<\/small><strong>\$\{size\.height\} px<\/strong>/
  );
  assert.match(
    rendererCss,
    /\.overlay-source-dimensions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    renderer,
    /const url = accountReady && allowed \? overlayUrl\(item\) : ""/
  );
  assert.match(renderer, /\$\{allowed && accountReady[\s\S]*?overlay-card-footer/);
  assert.match(renderer, /<div class="overlay-preview">\$\{overlayPreview\(item\)\}<\/div>/);
  assert.match(renderer, /function overlayCatalogPreviewUrl\(item\)/);
  assert.match(
    renderer,
    /key: "multiplierTimer"[\s\S]*?previewView: "multiplier-timer"[\s\S]*?requiresPro: true/
  );
  assert.match(
    renderer,
    /key: "winCounter"[\s\S]*?previewView: "win-counter"[\s\S]*?requiresPro: true/
  );
  assert.match(
    renderer,
    /defaultOption: "tikcontrol"[\s\S]*?previewView: "match"[\s\S]*?requiresPro: true/
  );
  assert.match(renderer, /url: overlayCatalogPreviewUrl\(item\)/);
  assert.match(
    overlayRuntime,
    /classList\.toggle\("overlay-idle-hidden", !isCatalogPreview && !showWhenIdle\)/
  );
  assert.doesNotMatch(renderer, /Overlay réservé/);
  assert.match(renderer, /L’aperçu et tous les réglages restent accessibles/);
  assert.match(renderer, /Configurer l’aperçu/);
  assert.match(rendererCss, /\.overlay-catalog-card\.locked[\s\S]*rgba\(249,\s*115,\s*22/);
});

test("les timers gardent seulement les commandes icone lecture pause et reset", () => {
  const timerActions =
    renderer.match(
      /if \(\["timer", "multiplierTimer"\]\.includes\(item\.key\)\) \{([\s\S]*?)\n  \}\n  const definitions/
    )?.[1] || "";

  assert.match(timerActions, /data-operation="pause"/);
  assert.match(timerActions, /data-operation="reset"/);
  assert.match(timerActions, /overlay-quick-icon/);
  assert.match(timerActions, /aria-label="\$\{toggleLabel\}"/);
  assert.doesNotMatch(timerActions, /data-operation="add"|data-operation="remove"/);
});

test("les URLs restent a gauche des boutons en bas de chaque carte", () => {
  const card =
    renderer.match(/function renderOverlayCard\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(
    card,
    /class="overlay-card-footer"[\s\S]*class="url-field"[\s\S]*class="entity-actions"/
  );
  assert.match(
    rendererCss,
    /\.overlay-card-footer\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/
  );
});

test("les cartes séparent la source HTTPS LIVE Studio de la source OBS locale", () => {
  const card =
    renderer.match(/function renderOverlayCard\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(renderer, /function localOverlayUrl\(item, configOverride = null\)/);
  assert.match(renderer, /snapshot\?\.localOverlayUrls\?\.\[item\?\.key\]/);
  assert.match(card, /OBS local/);
  assert.match(card, /localOverlayUrl\(item\)/);
  assert.match(renderer, /Sources HTTPS pour TikTok LIVE Studio/);
});

test("la Coin Jar utilise les images cadeaux et les empile au fond", () => {
  assert.match(overlayRuntime, /event\.data\?\.giftImageUrl/);
  assert.match(overlayRuntime, /document\.createElement\("img"\)/);
  assert.match(overlayRuntime, /CoinJarPhysics\.giftDiameter/);
  assert.match(overlayRuntime, /Math\.floor\(requestedCount\)/);
  assert.match(overlayRuntime, /scheduleGift\(index \+ 1\)/);
  assert.match(overlayRuntime, /gift\.state !== "spilled"/);
  assert.doesNotMatch(overlayRuntime, /Math\.min\(40,/);
  assert.doesNotMatch(overlayRuntime, /coinJarDrops\.length >= 120/);
  assert.match(overlayRuntime, /if \(operation === "reset"\) clearCoinJarDrops\(\)/);
  assert.doesNotMatch(overlayRuntime, /fill\.style\.height/);
  assert.doesNotMatch(overlayRuntime, /classList\.add\("packing"\)/);
  assert.match(overlayRuntime, /runtime\.recentEvents[\s\S]*spawnCoinJarDrop\(event\)/);
  assert.doesNotMatch(overlayRuntime, /setTimeout\(\(\) => node\.remove\(\), 8000\)/);
  assert.match(overlayHtml, /coin-jar-physics\.js[\s\S]*overlay\.js/);
  assert.match(
    overlayCss,
    /\.coin-jar-widget\s*\{[\s\S]*width:\s*min\(69\.444444vw,\s*96\.153846vh\)[\s\S]*aspect-ratio:\s*1/
  );
  assert.doesNotMatch(overlayCss, /data-jar-model[^\{]*#coin-jar-back/);
  assert.doesNotMatch(overlayCss, /#coin-jar-back\s*\{[\s\S]*?transform:/);
  assert.match(overlayHtml, /id="coin-jar-glass-clip"/);
  assert.match(
    overlayHtml,
    /M \.31 \.075 L \.69 \.075[\s\S]*L \.785 \.80[\s\S]*L \.34 \.925[\s\S]*L \.215 \.31/
  );
  assert.match(overlayHtml, /id="coin-jar-contained-drops"[\s\S]*id="coin-jar-overflow-drops"/);
  assert.match(overlayCss, /\.coin-jar-contained-drops\s*\{[\s\S]*clip-path:\s*url\("#coin-jar-glass-clip"\)/);
  assert.match(overlayRuntime, /gift\.y - visualRadius >= coinJarGeometry\.mouthTop/);
  assert.match(overlayRuntime, /jar-test-back-clean-localized\.png/);
  assert.doesNotMatch(overlayHtml, /coin-jar-meter/);
  assert.doesNotMatch(overlayCss, /\.coin-jar-meter/);
  assert.doesNotMatch(overlayRuntime, /packContainedBodies/);
  assert.doesNotMatch(coinJarPhysics, /packContainedBodies/);
  assert.doesNotMatch(overlayCss, /rgba\(255,\s*213,\s*82/);
  assert.doesNotMatch(overlayHtml, /class="coin-jar-label"/);
  assert.match(renderer, /giftImageUrl:\s*selectedGift\?\.imageUrl/);
});

test("les objectifs gardent leur cadre devant la progression et les timers n'ont plus de barre", () => {
  assert.match(overlayHtml, /class="like-goal-frame-slice slice-bottom"/);
  assert.match(
    overlayCss,
    /:where\(\[data-theme\]:not\(\[data-theme="classic"\]\)\) \.like-goal-widget/
  );
  assert.match(overlayCss, /\.like-goal-frame-foreground\s*\{[\s\S]*z-index:\s*3/);
  assert.match(
    overlayCss,
    /\[data-theme\]:not\(\[data-theme="classic"\]\) \.like-goal-bar\s*\{[\s\S]*z-index:\s*2/
  );
  assert.doesNotMatch(overlayHtml, /class="timer-line"/);
  assert.doesNotMatch(overlayCss, /\.timer-line/);
});

test("les matchs expliquent leur installation OBS et les super fans ne deviennent pas des abonnements", () => {
  assert.match(renderer, /function renderMatchOverlayGuide\(\)/);
  assert.match(renderer, /Largeur<\/strong> · 1080 px/);
  assert.match(renderer, /Hauteur<\/strong> · 1920 px/);
  assert.match(renderer, /Rafraîchir le navigateur lorsque la scène devient active/);
  assert.doesNotMatch(sourceHub, /WebcastEvent\.SUPER_FAN/);
  assert.match(sourceHub, /messageType === "WebcastSubNotifyMessage"/);
});

test("la roue et son son démarrent immédiatement puis le son s'arrête avec la rotation", () => {
  assert.match(
    overlayRuntime,
    /wheel\.style\.animationDelay = "0s"/
  );
  assert.doesNotMatch(
    overlayRuntime,
    /soundStartTimer/
  );
  assert.match(
    overlayRuntime,
    /if \(wheelBoolean\(wheelRuntimeSettings\.soundActive, true\)\) \{\s*startSpinSound\(\);\s*\}/
  );
  assert.match(
    overlayRuntime,
    /}, spinSeconds \* 1000\);/
  );
  assert.doesNotMatch(overlayRuntime, /const announceSeconds =/);
});

test("le Like Goal montre le palier atteint avant de calculer le suivant", () => {
  assert.match(
    overlayRuntime,
    /renderLikeGoal\(\{ preserveTarget: true, forceVisible: true \}\)/
  );
  assert.match(
    overlayRuntime,
    /likeGoalCompletionTimer = setTimeout\(\(\) => \{[\s\S]*renderLikeGoal\(\);[\s\S]*\}, 1200\)/
  );
  assert.match(
    overlayRuntime,
    /options\.preserveTarget \?\? Boolean\(likeGoalCompletionTimer\)/
  );
  assert.match(
    overlayRuntime,
    /if \(eventId && interactiveEventIds\.has\(eventId\)\) return/
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

test("le bouton des sources suit la visibilité de sa page", () => {
  assert.match(
    renderer,
    /canNavigateTo\("connections"\) \? '<button class="button small ghost" data-navigate="connections"/
  );
});

test("la page overlays ne recrée pas ses iframes pour un état sans rapport", () => {
  assert.match(renderer, /function overlayPageStateSignature\(value\)/);
  assert.match(
    renderer,
    /const refreshOverlayPage =\s*currentPage === "overlays"[\s\S]*overlayPageStateSignature\(snapshot\) !== overlayPageStateSignature\(value\)/
  );
  assert.match(renderer, /refreshGamePage \|\|\s*refreshOverlayPage \|\|/);
});

test("les WINS natifs actualisent les aperçus sans reconstruire la page du jeu", () => {
  assert.match(renderer, /function gamePageStateSignature\(value\)/);
  assert.match(
    renderer,
    /const refreshGamePage =\s*currentPage === "games"[\s\S]*gamePageStateSignature\(snapshot\) !== gamePageStateSignature\(value\)/
  );
  assert.match(
    renderer,
    /function overlaySessionLifecycleSignature\(value\) \{[\s\S]*return JSON\.stringify\(runtime\)/
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

test("les actions rapides mettent a jour une seule carte sans reconstruire la galerie", () => {
  const quickActions =
    renderer.match(
      /async function performOverlayQuickAction\([\s\S]*?\n\}\n\nasync function handleAction/
    )?.[0] || "";

  assert.match(quickActions, /rerender:\s*false,\s*updateCard:\s*true/);
  assert.match(quickActions, /postOverlayCardEvent\(key,/);
  assert.match(renderer, /function consumeLocallyHandledOverlayState\(/);
  assert.match(
    renderer,
    /const overlayStateHandledLocally =[\s\S]*consumeLocallyHandledOverlayState\(snapshot, value\)/
  );
  assert.match(
    renderer,
    /!overlayStateHandledLocally &&\s*overlayPageStateSignature\(snapshot\) !== overlayPageStateSignature\(value\)/
  );
});

test("la galerie overlay utilise deux colonnes tant que la largeur utile le permet", () => {
  assert.match(rendererCss, /\.overlay-catalog-grid\s*\{[\s\S]*min-width:\s*0/);
  assert.match(
    rendererCss,
    /\.overlay-catalog-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/
  );
  assert.match(
    rendererCss,
    /@media \(max-width:\s*1180px\)\s*\{[\s\S]*\.overlay-catalog-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/
  );
  assert.match(rendererCss, /\.url-field\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
  assert.match(rendererCss, /\.overlay-card-meta strong\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
});

test("les apercus rendent d'abord la taille OBS native puis reduisent l'image complete", () => {
  assert.match(renderer, /data-overlay-native-frame/);
  assert.match(renderer, /data-overlay-source-width="\$\{size\.width\}"/);
  assert.match(renderer, /data-overlay-source-height="\$\{size\.height\}"/);
  assert.match(renderer, /function bindOverlayRuntimeFrames\(root = document\)/);
  assert.match(renderer, /frame\.clientWidth \/ sourceWidth/);
  assert.match(renderer, /frame\.clientHeight \/ sourceHeight/);
  assert.match(renderer, /bindOverlayRuntimeFrames\(content\)/);
  assert.match(renderer, /bindOverlayRuntimeFrames\(dialogBody\)/);
  assert.match(rendererCss, /width:\s*var\(--overlay-source-width,\s*100%\)/);
  assert.match(rendererCss, /height:\s*var\(--overlay-source-height,\s*100%\)/);
  assert.match(
    rendererCss,
    /scale\(var\(--overlay-render-scale,\s*1\)\)/
  );
});

test("les sources OBS utilisent toute leur hauteur et contiennent les widgets", () => {
  assert.match(overlayCss, /html,\s*body,\s*#overlay-root\s*\{[\s\S]*height:\s*100%/);
  assert.match(
    overlayCss,
    /#timer-view\.active,[\s\S]*#multiplier-timer-view\.active[\s\S]*align-items:\s*center/
  );
  assert.match(
    overlayCss,
    /\[data-theme\]:not\(\[data-theme="classic"\]\) \.timer-panel[\s\S]*calc\(\(100vh - 24px\) \* 1\.825\)/
  );
  assert.match(
    overlayCss,
    /#leaderboard-view \.leaderboard-widget[\s\S]*calc\(\(100vh - 44px\) \* 0\.75\)/
  );
  assert.match(
    overlayCss,
    /\.wheel-stage \.wheel-machine[\s\S]*calc\(\(100vh - 20px\) \/ 1\.22\)/
  );
  assert.match(
    overlayRuntime,
    /let overlayFontSize = viewName === "wheel"\s*\?\s*1/
  );
});

test("les classements alignent les profils dans chaque cadre et restaurent le classique royal", () => {
  assert.match(
    overlayRuntime,
    /const leaderboardRankCrown = "widgets\/leaderboard\/rank-crown\.webp"/
  );
  assert.match(
    overlayRuntime,
    /leaderboardRankMedals[\s\S]*rank-medal-1\.webp[\s\S]*rank-medal-3\.webp/
  );
  assert.match(
    overlayRuntime,
    /leaderboardRankRings[\s\S]*rank-ring-1\.webp[\s\S]*rank-ring-3\.webp/
  );
  assert.match(
    overlayRuntime,
    /avatarUrl: safeLeaderboardAvatarUrl\(user\.avatarUrl\) \|\| current\.avatarUrl/
  );
  assert.match(
    overlayRuntime,
    /Array\.from\(\{ length: maxRows \}[\s\S]*leaderboard-avatar-image[\s\S]*leaderboard-avatar-fallback/
  );
  assert.match(
    overlayCss,
    /\[data-theme="classic"\] #leaderboard-view \.leaderboard-widget[\s\S]*border:\s*2px solid[\s\S]*linear-gradient/
  );
  assert.match(
    overlayCss,
    /grid-template-rows:\s*repeat\(var\(--leaderboard-row-count,\s*5\),\s*minmax\(0,\s*1fr\)\)/
  );
  for (const theme of [
    "akatsuki",
    "assassination-classroom",
    "cult-of-the-lamb",
    "demon-slayer",
    "dragon-ball",
    "fairy-tail",
    "gta",
    "harry-potter",
    "minecraft",
    "naruto",
    "one-piece",
    "stardew-valley",
    "terraria"
  ]) {
    assert.match(
      overlayCss,
      new RegExp(
        `\\[data-theme="${theme}"\\] #leaderboard-view \\.leaderboard-widget[\\s\\S]*?--leaderboard-rows-top:`
      )
    );
  }
  assert.match(
    overlayCss,
    /\[data-theme="assassination-classroom"\] #leaderboard-view \.leaderboard-widget[\s\S]*?--leaderboard-rows-right:\s*10\.75%[\s\S]*?--leaderboard-rows-left:\s*12\.69%[\s\S]*?aspect-ratio:\s*67\s*\/\s*120[\s\S]*?overflow:\s*hidden/
  );
  assert.match(
    overlayCss,
    /\[data-theme="assassination-classroom"\] #leaderboard-view #leaderboard-frame\s*\{[\s\S]*?inset:\s*0 auto 0 -34\.328%[\s\S]*?width:\s*134\.328%/
  );
  for (const asset of [
    "rank-crown.webp",
    "rank-medal-1.webp",
    "rank-medal-2.webp",
    "rank-medal-3.webp",
    "rank-ring-1.webp",
    "rank-ring-2.webp",
    "rank-ring-3.webp"
  ]) {
    assert.ok(
      fs.existsSync(
        path.join(root, "resources", "overlays", "media", "widgets", "leaderboard", asset)
      ),
      `${asset} doit rester embarqué`
    );
  }
});

test("chaque source charge uniquement ses propres médias lourds", () => {
  assert.match(
    overlayRuntime,
    /if \(viewName === "coin-jar"\) \{[\s\S]*jarBack\.src[\s\S]*jarFront\.src[\s\S]*\}/
  );
  assert.match(
    overlayRuntime,
    /if \(viewName === "wheel"\) \{[\s\S]*setupWheel\(\)/
  );
  assert.match(overlayRuntime, /if \(viewName === "leaderboard"\) setupLeaderboard\(\)/);
  assert.match(
    overlayCss,
    /#coin-jar-view\s*\{[\s\S]*align-items:\s*center;[\s\S]*justify-content:\s*center;/
  );
  assert.match(
    overlayCss,
    /\.coin-jar-widget\s*\{[\s\S]*69\.444444vw[\s\S]*96\.153846vh/
  );
});

test("les cartes ne saturent pas les connexions réservées aux aperçus live", () => {
  assert.match(
    renderer,
    /const previewUrl = new URL\(runtimeUrl\);[\s\S]*searchParams\.set\("preview", "static"\)/
  );
  assert.match(overlayRuntime, /const isStaticPreview = previewMode === "static"/);
  assert.match(
    overlayRuntime,
    /const isCatalogPreview =\s*isStaticPreview \|\| previewMode === "animated"/
  );
  assert.match(
    overlayRuntime,
    /setupOverlayDesign\(\);\s*renderTimer\(\);[\s\S]*fetch\(`\/api\/state[\s\S]*if \(isCatalogPreview\) return;/
  );
  assert.match(
    renderer,
    /context:\s*"live",[\s\S]*editable:\s*true,[\s\S]*loading:\s*"eager"/
  );
});

test("les aperçus et sources reprennent la session overlay courante ou précédente", () => {
  assert.match(overlayRuntime, /function hydrateOverlaySession\(state = \{\}\)/);
  assert.match(overlayRuntime, /runtime\.leaderboards\?\.\[leaderboardKind\]/);
  assert.match(overlayRuntime, /overlayChannels\["session-state"\] = hydrateOverlaySession/);
  assert.match(renderer, /function postOverlayPreviewEvent\(channel, payload\)/);
  assert.match(renderer, /postOverlayPreviewEvent\("event", event\)/);
  assert.match(renderer, /postOverlayPreviewEvent\(\s*"session-state"/);
});

test("un changement de design reste local, instantané et disponible en aperçu Pro", () => {
  assert.match(
    renderer,
    /data-overlay-preview-only="\$\{allowed \? "false" : "true"\}"/
  );
  assert.doesNotMatch(
    renderer,
    /data-overlay-design="\$\{escapeHtml\(item\.key\)\}" \$\{allowed \? "" : "disabled"\}/
  );
  assert.match(
    renderer,
    /previewOverlayDesignSelection\(item, value\)[\s\S]*rerender:\s*false,[\s\S]*updateCard:\s*true/
  );
  assert.match(renderer, /postOverlayCardEvent\(item\.key, "design"/);
  assert.match(
    overlayRuntime,
    /overlayChannels\.design = updatePreviewDesign/
  );
});
