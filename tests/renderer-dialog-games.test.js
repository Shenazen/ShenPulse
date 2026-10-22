"use strict";
const { readRendererSource, readRendererStyles } = require("./helpers/source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/** Catalogues et parcours de configuration des jeux. */

test("Minecraft utilise une seule jaquette puis propose ses trois modes", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();

  assert.match(app, /const MINECRAFT_LAUNCHER_ID = "minecraft"/);
  assert.match(
    app,
    /MINECRAFT_MODE_IDS = Object\.freeze\(\[[\s\S]*"minecraft-bedrock-box"[\s\S]*"minecraft-sandbox-3"[\s\S]*"minecraft-survival-plugin"/
  );
  assert.match(app, /function openMinecraftModeSelector\(launcher\)/);
  assert.match(app, /data-action="open-minecraft-mode"/);
  assert.match(app, /SURVIE INTERACTIVE/);
  const dialogActionHandler = app.slice(
    app.indexOf(
      'dialog.addEventListener("click", (event) => {\n  const accountCommand'
    ),
    app.indexOf('dialog.addEventListener("input"', app.indexOf(
      'dialog.addEventListener("click", (event) => {\n  const accountCommand'
    ))
  );
  assert.match(dialogActionHandler, /"open-minecraft-mode"/);
  assert.match(app, /artwork: "minecraft\.webp"/);
  assert.match(styles, /dialog\[data-variant="minecraft-modes"\]/);
  assert.match(styles, /\.minecraft-mode-grid/);
  assert.match(styles, /\.minecraft-mode-card/);
});

test("les cartes de jeu partagent un titre, les plateformes et le prix avant le bouton", () => {
  const app = readRendererSource();
  const styles = readRendererStyles();
  const renderStart = app.indexOf("function renderGamesV2()");
  const catalog = app.slice(
    renderStart,
    app.indexOf("function openMinecraftModeSelector", renderStart)
  );

  assert.match(app, /function gamePlatformLogos\(pack, settings =/);
  assert.match(app, /<circle cx="16" cy="16" r="15" fill="#1b75bb"\/>/);
  assert.match(app, /fortnite: \["epic-games"\]/);
  assert.match(app, /"rocket-league": \["epic-games", "steam"\]/);
  assert.match(
    app,
    /"gtav-montchiliad": \["rockstar-games", "steam", "epic-games"\]/
  );
  assert.match(catalog, /\$\{gameTileCaption\(pack\)\}/);
  assert.match(app, /function gameTileCaption\(pack\)/);
  assert.match(app, /<div class="tile-caption"><h3>\$\{escapeHtml\(pack\.name\)\}<\/h3><div class="tile-details">\$\{gamePlatformLogos\(pack\)\}/);
  assert.match(styles, /\.game-gallery-tile \.tile-purchase-price/);
  assert.doesNotMatch(catalog, /pack\.source \|\| pack\.connector\.type/);
  assert.doesNotMatch(catalog, /pack\.effects\.length.*gamePrice\(pack\)/);
  assert.match(styles, /\.game-gallery-tile \.tile-platforms/);
  assert.match(styles, /\.game-gallery-tile \.tile-platform-logo/);
  assert.match(styles, /\.tile-platform-logo\.platform-steam svg/);
});

test("la galerie explique où obtenir le jeu et ce que ShenPulse inclut", () => {
  const app = readRendererSource();
  const styles = readRendererStyles();
  const renderStart = app.indexOf("function renderGamesV2()");
  const catalog = app.slice(
    renderStart,
    app.indexOf("function openMinecraftModeSelector", renderStart)
  );

  assert.match(app, /function gameCatalogPlatformLegend\(packs\)/);
  assert.match(app, /Jeu et interactions accessibles avec Pro · achat supplémentaire si indiqué\./);
  assert.match(
    app,
    /Jeu à télécharger sur Steam · accès Pro requis pour les interactions\./
  );
  assert.match(
    app,
    /Jeu Nintendo original requis · accès Pro requis pour les interactions\./
  );
  assert.match(
    catalog,
    /\$\{gameCatalogPlatformLegend\(availablePacks\)\}/
  );
  assert.match(styles, /\.game-platform-legend \{/);
  assert.match(styles, /\.game-platform-legend-item \{/);
  assert.match(styles, /\.game-platform-legend-icon\.platform-steam svg/);
});

test("Super Mario Kart, Resident Evil 3 et Fortnite utilisent le nouveau tableau de session ShenPulse", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();
  const workspace = fs.readFileSync(
    path.join(
      rendererDirectory,
      "app",
      "features",
      "games",
      "super-mario-kart-workspace.js"
    ),
    "utf8"
  );
  const genericStart = app.indexOf("function renderGameWorkspace(pack)");
  const genericEnd = app.indexOf("function gameJourneyFor(pack)", genericStart);
  const generic = app.slice(genericStart, genericEnd);

  assert.match(
    generic,
    /pack\.id === "super-mario-kart"[\s\S]*renderSuperMarioKartWorkspace\(pack\)/
  );
  assert.match(
    generic,
    /pack\.id === "resident-evil-3"[\s\S]*renderResidentEvil3Workspace\(pack\)/
  );
  assert.match(
    generic,
    /pack\.id === "fortnite"[\s\S]*renderFortniteWorkspace\(pack\)/
  );
  assert.match(
    generic,
    /pack\.id === "rocket-league"[\s\S]*renderRocketLeagueWorkspace\(pack\)/
  );
  assert.match(workspace, /smk-workspace-shell/);
  assert.match(workspace, /smk-command-rail/);
  assert.match(workspace, /smk-session-dashboard/);
  assert.match(workspace, /Installation de BizHawk/);
  assert.match(workspace, /Installation de la ROM/);
  assert.match(workspace, /Installation du runtime \.NET 8/);
  assert.match(workspace, /Installation de REFramework/);
  assert.match(workspace, /renderResidentEvil3Workspace/);
  assert.match(workspace, /renderFortniteWorkspace/);
  assert.match(workspace, /renderRocketLeagueWorkspace/);
  assert.match(workspace, /Aucun mod à installer/);
  assert.match(workspace, /Connecteur clavier ShenPulse/);
  assert.match(workspace, /data-game-key-layout/);
  assert.match(workspace, /processLabel: "Fortnite"/);
  assert.match(workspace, /processLabel: "Rocket League"/);
  assert.match(workspace, /Vérifier \$\{escapeHtml\(profile\.processLabel/);
  assert.match(workspace, /assetCount: 1/);
  assert.match(workspace, /satisfiedAssetIds/);
  assert.match(workspace, /componentReady\("dotnet-desktop-runtime-8"\)/);
  assert.match(workspace, /componentReady\("mod"\)/);
  assert.match(workspace, /Tout installer en un clic/);
  assert.match(workspace, /data-action="start-game-session"/);
  assert.match(workspace, /renderStandardGameInteractions\(pack, unlocked/);
  assert.match(workspace, /renderGameOverlays\(pack, unlocked\)/);
  assert.match(workspace, /renderGameLaunchProgressModal\(pack\)/);
  assert.match(workspace, /Overlay de partie/);
  assert.match(workspace, /Démarrer la session/);
  assert.doesNotMatch(workspace, /smk-rail-switcher/);
  assert.doesNotMatch(workspace, /Crowd\s*Control/i);
  const landing = workspace.slice(
    workspace.indexOf("function renderSuperMarioKartSessionLanding"),
    workspace.indexOf("function renderSuperMarioKartActiveSession")
  );
  assert.doesNotMatch(landing, /data-action="launch-game"/);
  assert.match(app, /game-interaction-add-card/);
  assert.match(app, /Nouvelle interaction/);
  assert.match(styles, /\.smk-workspace-shell/);
  assert.match(styles, /\.smk-command-rail/);
  assert.match(styles, /\.smk-session-dashboard/);
  assert.match(styles, /\.smk-install-checklist > article\.ready/);
  assert.match(styles, /\.smk-install-checklist > article\.working/);
  assert.match(styles, /\.game-interaction-add-card/);
});

test("Minecraft affiche les réglages de manche et bloque un second jeu actif", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();
  const preload = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "preload.js"),
    "utf8"
  );

  assert.match(app, /class="minecraft-round-settings"/);
  assert.match(app, /name="durationMinutes"/);
  assert.match(app, /value="\$\{roundSettings\.durationMinutes\}"/);
  assert.match(app, /name="autoRestart"/);
  assert.match(app, /saveGameRoundSettings/);
  assert.match(app, /function showActiveGameConflict\(pack\)/);
  assert.match(app, /Un jeu est déjà actif/);
  assert.match(styles, /\.minecraft-round-settings/);
  assert.match(preload, /game:round-settings:save/);
  assert.match(preload, /game-round-timeout/);
});

test("Cult of the Lamb propose uniquement le générateur d’overlay des cadeaux", () => {
  const app = readRendererSource();
  const renderStart = app.indexOf("function renderGameOverlays(pack, unlocked)");
  const genericOverlaysStart = app.indexOf(
    "const items = gameOverlayItemsFor(pack);",
    renderStart
  );
  const generatorOnlyBranch = app.slice(renderStart, genericOverlaysStart);

  assert.match(app, /GAME_OVERLAY_GENERATOR_ONLY_IDS[\s\S]*"cult-of-the-lamb"/);
  assert.match(generatorOnlyBranch, /renderGameInteractionOverlayCard\(pack, unlocked\)/);
  assert.doesNotMatch(generatorOnlyBranch, /renderOverlayCard|overlay-catalog-grid/);
});

test("Coin Pusher utilise les quatre étapes de GTA et Minecraft, les autres jeux intégrés restent compacts", () => {
  const app = readRendererSource();
  const styles = readRendererStyles();
  const workspaceStart = app.indexOf("function renderGameWorkspace(pack)");
  const workspaceEnd = app.indexOf("function renderMembership()", workspaceStart);
  const workspace = app.slice(workspaceStart, workspaceEnd);
  const journeyStart = app.indexOf("const DEFAULT_GAME_JOURNEY");
  const journeyEnd = app.indexOf("function escapeHtml", journeyStart);
  const journey = app.slice(journeyStart, journeyEnd);

  assert.ok(journey.indexOf('id: "installation"') < journey.indexOf('id: "interactions"'));
  assert.ok(journey.indexOf('id: "interactions"') < journey.indexOf('id: "overlays"'));
  assert.ok(journey.indexOf('id: "overlays"') < journey.indexOf('id: "launch"'));
  assert.doesNotMatch(journey, /Test & LIVE|id: "live"/);
  assert.match(workspace, /function gameJourneyFor/);
  assert.match(
    workspace,
    /if \(pack\.id === "coin-pusher"\)[\s\S]*step\.id !== "overlays"/
  );
  assert.match(
    workspace,
    /\.filter\(\(step\) => step\.id === "installation" \|\| step\.id === "launch"\)/
  );
  assert.match(
    workspace,
    /data-value="launch"[\s\S]*?>Voir le démarrage →<\/button>/
  );
  assert.match(
    app,
    /if \(!gameJourneyFor\(pack\)\.some\(\(step\) => step\.id === nextStep\)\)/
  );
  assert.match(workspace, /function renderGameInstallProgressModal/);
  assert.match(workspace, /Installation en un clic/);
  assert.match(workspace, /Ajouter à mon LIVE/);
  assert.doesNotMatch(workspace, /PASSERELLE ATTENDUE|URL SOURCE NAVIGATEUR|Tester la passerelle/);
  assert.match(styles, /\.game-progress-backdrop/);
  assert.match(styles, /\.game-overlay-card-grid/);
  assert.match(workspace, /game-effects-heading/);
  assert.match(workspace, /game-effect-side/);
  assert.match(workspace, /game-effect-trigger/);
  assert.match(workspace, /toggle-game-interaction/);
  assert.match(workspace, /edit-game-interaction/);
  assert.match(workspace, /function renderCoinPusherInteractions/);
  assert.match(workspace, /data-coin-pusher-interactions/);
  assert.match(workspace, /coinPusherTierDiamonds/);
  assert.match(workspace, /coinPusherGiftRuleName/);
  assert.match(app, /function openGameInteractionEditor/);
  assert.match(app, /giftTriggerConditionFields\(currentRule\.conditions/);
  assert.match(styles, /dialog\[data-variant="effect"\]/);
  assert.match(styles, /\.game-interaction-editor-hero/);
  assert.match(styles, /\.coin-pusher-reward-layout/);
  assert.match(styles, /\.coin-pusher-special-grid/);
});

test("les interactions de jeu disposent d'une bibliothèque visuelle complète", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();

  assert.match(app, /function openGameInteractionCatalog/);
  assert.match(app, /data-action="add-game-interaction"/);
  assert.match(app, /data-select-game-effect/);
  assert.match(app, /data-game-effect-library-search/);
  assert.match(app, /effect\.description/);
  assert.match(app, /effect\.image/);
  assert.match(app, /data-action="delete-game-interaction"/);
  assert.match(app, /api\.initializeGameInteractions/);
  assert.match(styles, /dialog\[data-variant="effect-library"\]/);
  assert.match(styles, /\.game-effect-library-option/);
  assert.match(styles, /\.game-effect-library-search/);
});

test("changer l'effet conserve le brouillon complet de l'interaction", () => {
  const app = readRendererSource();
  const draftBuilder = app.slice(
    app.indexOf("function gameInteractionDraftFromForm"),
    app.indexOf("function openGameInteractionEditor")
  );
  const catalogHandler = app.slice(
    app.indexOf('const openLibrary = event.target.closest('),
    app.indexOf('dialog.addEventListener("click", (event) => {',
      app.indexOf('const openLibrary = event.target.closest(') + 1)
  );

  assert.match(draftBuilder, /buildTriggerConditions\(currentRule\.conditions, data\)/);
  assert.match(draftBuilder, /conditions:\s*automatic/);
  assert.match(draftBuilder, /effectId:\s*effect\.id/);
  assert.match(catalogHandler, /new FormData\(dialogForm\)/);
  assert.match(catalogHandler, /openGameInteractionCatalog\(pack, draftRow\)/);
  assert.match(catalogHandler, /gameInteractionCatalogContext\.row/);
  assert.match(catalogHandler, /openGameInteractionEditor\(pack, effect, row\)/);
  assert.doesNotMatch(
    catalogHandler,
    /dialog\.close\(\);\s*openGameInteractionEditor\(pack, effect, row\)/
  );
});

test("un ancien pack GTA propose explicitement la mise à jour du retournement", () => {
  const app = readRendererSource();
  assert.match(app, /pack\.installerVersion/);
  assert.match(app, /installation\.installerVersion/);
  assert.match(app, /tonneau complet corrigé/);
  assert.match(app, /Retourner le véhicule/);
  assert.match(app, /Mettre à jour le pack/);
});

test("les interactions restent dans leur jeu et la session active reste visible partout", () => {
  const root = path.join(__dirname, "..");
  const rendererDirectory = path.join(root, "src", "renderer");
  const app = readRendererSource();
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );
  const styles = readRendererStyles();
  const gameEditor = app.slice(
    app.indexOf("function openGameInteractionEditor"),
    app.indexOf("function openActionEditor")
  );
  const actionTypes = app.slice(
    app.indexOf("function actionTypeOptions"),
    app.indexOf("function gameInteractionRowData")
  );

  assert.match(html, /id="game-session-control"/);
  assert.match(html, /id="game-session-stop"/);
  assert.match(styles, /\.game-session-control/);
  assert.match(app, /function activeGameSession/);
  assert.match(app, /interactionRulesByPack/);
  assert.match(gameEditor, /api\.saveGameInteraction/);
  assert.doesNotMatch(gameEditor, /api\.upsert\("rules"/);
  assert.doesNotMatch(actionTypes, /"game\.effect"/);
  assert.match(app, /api\.startGameSession/);
  assert.match(app, /api\.stopGameSession/);
});

test("une erreur d’installation de jeu n’est affichée qu’une seule fois", () => {
  const app = readRendererSource();
  const start = app.indexOf('if (action === "install-game")');
  const end = app.indexOf('if (action === "launch-game")', start);
  const handler = app.slice(start, end);
  assert.match(handler, /gamePageMessages\.set\(id/);
  assert.doesNotMatch(handler, /toast\(\s*"Installation impossible"/);
});

test("le lancement Minecraft affiche une attente bloquante jusqu’au serveur prêt", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();
  const handlerStart = app.indexOf('if (action === "launch-game")');
  const handlerEnd = app.indexOf(
    'if (action === "start-game-session")',
    handlerStart
  );
  const handler = app.slice(handlerStart, handlerEnd);

  assert.match(app, /function renderGameLaunchProgressModal/);
  assert.match(app, /PaperMC se prépare/);
  assert.match(app, /Un seul clic suffit/);
  assert.match(app, /gameLaunchBusyId === pack\.id/);
  assert.match(handler, /if \(gameLaunchBusyId\) return/);
  assert.match(handler, /gameLaunchBusyId = id/);
  assert.match(handler, /gameLaunchProgress = \{/);
  assert.match(handler, /finally \{/);
  assert.match(styles, /\.game-launch-progress-modal/);
});

test("les interactions incomplètes sont signalées avant overlay et lancement", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();

  assert.match(app, /function gameInteractionReadinessIssues\(pack\)/);
  assert.match(app, /aucun cadeau TikTok ni filtre de valeur n’est configuré/);
  assert.match(app, /function confirmGameInteractionReadiness\(pack, operationLabel\)/);
  assert.match(app, /Le fonctionnement sera dégradé/);
  assert.match(
    app,
    /confirmGameInteractionReadiness\(\s*pack,\s*"de télécharger l’overlay"/
  );
  assert.match(
    app,
    /confirmGameInteractionReadiness\(\s*pack,\s*"de lancer le jeu et son serveur"/
  );
});

test("les espaces de jeu unifiés démarrent leur session avant de programmer les interactions", () => {
  const app = readRendererSource();
  const start = app.indexOf('if (action === "start-game-session")');
  const end = app.indexOf('if (action === "stop-game-session")', start);
  const handler = app.slice(start, end);

  assert.match(
    handler,
    /"super-mario-kart",[\s\S]*"resident-evil-3",[\s\S]*"fortnite",[\s\S]*"rocket-league"[\s\S]*\.includes\(pack\.id\)/
  );
  assert.match(handler, /confirmGameInteractionReadiness/);
  assert.match(handler, /api\.startGameSession\(id\)/);
});

