"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("les boutons d'annulation ferment le dialogue sans valider le formulaire", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );

  const closeButtons = html.match(
    /<button[^>]+type="button"[^>]+data-dialog-close[^>]*>/g
  );
  assert.equal(closeButtons?.length, 2);
  assert.match(app, /dialog\.close\("cancel"\)/);
});

test("Minecraft utilise une seule jaquette puis propose Bedrock Box et SandBox", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );

  assert.match(app, /const MINECRAFT_LAUNCHER_ID = "minecraft"/);
  assert.match(
    app,
    /MINECRAFT_MODE_IDS = Object\.freeze\(\[[\s\S]*"minecraft-bedrock-box"[\s\S]*"minecraft-sandbox-3"/
  );
  assert.match(app, /function openMinecraftModeSelector\(launcher\)/);
  assert.match(app, /data-action="open-minecraft-mode"/);
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

test("Minecraft affiche les réglages de manche et bloque un second jeu actif", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );
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

test("Cult of the Lamb ne propose aucun overlay OBS inutile", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const renderStart = app.indexOf("function renderGameOverlays(pack, unlocked)");
  const renderEnd = app.indexOf(
    "function renderGameOverlaysLegacy",
    renderStart
  );
  const itemStart = app.indexOf("function gameOverlayItemsFor(pack)");
  const itemEnd = app.indexOf(
    "function gameInteractionOverlayBackground",
    itemStart
  );

  assert.match(app.slice(renderStart, renderEnd), /pack\.id === "cult-of-the-lamb"/);
  assert.match(app.slice(renderStart, renderEnd), /Aucun overlay requis/);
  assert.match(app.slice(itemStart, itemEnd), /pack\.id === "cult-of-the-lamb"\s*\?\s*\[\]/);
});

test("le compte ShenPulse remplace les commandes LIVE avant authentification", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );

  assert.match(html, /id="account-auth-cta"/);
  assert.match(app, /Créer votre compte ShenPulse/);
  assert.match(app, /S’inscrire avec Google/);
  assert.match(app, /name="passwordConfirmation"/);
  assert.match(app, /Mot de passe oublié/);
  assert.match(app, /profileControl\.hidden = !authenticated/);
  assert.match(app, /tiktokControl\.hidden = !authenticated/);
  assert.match(app, /sessionButton\.hidden = !authenticated/);
  assert.match(styles, /\.profile-control\[hidden\],[\s\S]*\.live-button\[hidden\]/);
});

test("la reconnexion admin place réellement le focus dans le mot de passe", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );
  const loginStart = app.indexOf("function openAdminLogin()");
  const loginEnd = app.indexOf("async function saveAdminVisibilityScope", loginStart);
  const login = app.slice(loginStart, loginEnd);
  const editorStart = app.indexOf("function openEditor({");
  const editorEnd = app.indexOf("function field(", editorStart);
  const editor = app.slice(editorStart, editorEnd);

  assert.match(login, /type="password"/);
  assert.match(login, /autocomplete="current-password"/);
  assert.match(login, /required autofocus/);
  assert.match(editor, /requestAnimationFrame/);
  assert.match(editor, /focusTarget\.focus/);
  assert.match(styles, /dialog input,[\s\S]*-webkit-app-region: no-drag/);
  assert.match(styles, /dialog input,[\s\S]*user-select: text/);
});

test("la configuration TikTok ne demande que le @ et lance la détection", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const start = app.indexOf("function openTikTokEditor()");
  const end = app.indexOf("function openGoalEditor", start);
  const editor = app.slice(start, end);

  assert.match(editor, /field\("username"/);
  assert.doesNotMatch(editor, /relayUrl|secret|autoConnect|connectNow/);
  assert.match(editor, /api\.saveTikTok/);
  assert.match(editor, /api\.startTikTok/);
});

test("la barre supérieure permet de créer, modifier et supprimer les profils", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );

  assert.match(html, /id="profile-manage-button"/);
  assert.match(app, /function openProfileManager\(\)/);
  assert.match(app, /function openProfileEditor\(profile\)/);
  assert.match(app, /data-profile-action="create"/);
  assert.match(app, /data-profile-action="edit"/);
  assert.match(app, /data-profile-action="delete"/);
  assert.match(app, /api\.remove\("profiles"/);
});

test("les sons, le TTS, Spotify et les cadeaux utilisent les services globaux", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const html = fs.readFileSync(path.join(rendererDirectory, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(rendererDirectory, "app.js"), "utf8");

  assert.match(html, /id="gift-catalog-options"/);
  assert.match(app, /value\.soundCatalog/);
  assert.match(app, /function openTtsEditor\(row\)/);
  assert.match(app, /data-action="add-tts"/);
  assert.match(app, /api\.searchGifts/);
  assert.match(app, /api\.connectSpotify/);
  assert.match(app, /spotify-control/);
});

test("les sons et le TTS restent uniquement dans leur atelier dédié", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const actionsStart = app.indexOf("function renderActions()");
  const actionsEnd = app.indexOf("function renderRules()", actionsStart);
  const actionsPage = app.slice(actionsStart, actionsEnd);

  assert.match(
    actionsPage,
    /!\["audio\.play", "tts\.speak"\]\.includes\(action\.type\)/
  );
  assert.doesNotMatch(
    actionsPage,
    /Médias, sons, voix, overlays/
  );
});

test("fermer l'éditeur arrête uniquement le son testé dans cette fenêtre", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const dialogPreviewStart = app.indexOf(
    'const mediaPreview = event.target.closest("[data-media-preview-url]")'
  );
  const dialogPreviewEnd = app.indexOf(
    'const giftChoice = event.target.closest("[data-gift-choice]")',
    dialogPreviewStart
  );
  const dialogPreview = app.slice(dialogPreviewStart, dialogPreviewEnd);
  const closeStart = app.indexOf('dialog.addEventListener("close"');
  const closeEnd = app.indexOf(
    'dialog.addEventListener("click"',
    closeStart
  );
  const closeHandler = app.slice(closeStart, closeEnd);

  assert.match(dialogPreview, /previewScope: "editor-dialog"/);
  assert.match(app, /function stopEditorAudioPreview\(\)/);
  assert.match(
    app,
    /activePreviewAudioScope !== "editor-dialog"/
  );
  assert.match(closeHandler, /stopEditorAudioPreview\(\)/);
});

test("le TTS propose les voix Windows et démarre sur les commentaires du chat", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(path.join(rendererDirectory, "app.js"), "utf8");
  const editorStart = app.indexOf("function openTtsEditor(row)");
  const editorEnd = app.indexOf("function openSoundEditor", editorStart);
  const editor = app.slice(editorStart, editorEnd);
  const soundsStart = app.indexOf("function renderSounds()");
  const soundsEnd = app.indexOf("function renderTimersPanel", soundsStart);
  const sounds = app.slice(soundsStart, soundsEnd);
  const ttsSectionStart = sounds.indexOf(
    '<section class="studio-panel audio-panel panel-cyan"'
  );
  const ttsSectionEnd = sounds.indexOf(
    '<section class="studio-panel spotify-panel',
    ttsSectionStart
  );
  const ttsSection = sounds.slice(ttsSectionStart, ttsSectionEnd);
  const actionTypesStart = app.indexOf("function actionTypeOptions");
  const actionTypesEnd = app.indexOf(
    "function gameInteractionRowData",
    actionTypesStart
  );
  const actionTypes = app.slice(actionTypesStart, actionTypesEnd);

  assert.match(app, /function readTtsVoices\(\)/);
  assert.match(app, /window\.speechSynthesis\s*\.getVoices\(\)/);
  assert.match(app, /data-tts-voice-select/);
  assert.match(app, /voiceschanged/);
  assert.match(editor, /type: "chat"/);
  assert.match(editor, /text: "\{\{data\.message\}\}"/);
  assert.match(editor, /conditions: \[\]/);
  assert.match(editor, /cooldown: \{ globalMs: 0, perUserMs: 0 \}/);
  assert.match(editor, /ttsVoiceField\("voice"/);
  assert.match(editor, /ttsCommentFilterFields\(config\)/);
  assert.match(editor, /data\.has\("ttsReadEmojis"\)/);
  assert.match(editor, /data\.has\("ttsAllowMentions"\)/);
  assert.match(editor, /data\.has\("ttsAllowCommands"\)/);
  assert.match(editor, /data\.has\("ttsAllowLinks"\)/);
  assert.match(app, /Lire les emojis/);
  assert.match(app, /Lire les mentions commençant par @/);
  assert.match(app, /Lire les commandes ! et \//);
  assert.match(app, /Lire les messages contenant un lien/);
  assert.doesNotMatch(editor, /field\("language"/);
  assert.doesNotMatch(editor, /name="triggerType"/);
  assert.doesNotMatch(editor, /Choisissez l’interaction/);
  assert.doesNotMatch(ttsSection, /<th>DÉCLENCHEUR<\/th>/);
  assert.match(ttsSection, /<th>VOIX<\/th>/);
  assert.doesNotMatch(ttsSection, /<th>LANGUE<\/th>/);
  assert.doesNotMatch(actionTypes, /tts\.speak/);
  assert.match(
    app,
    /row\?\.action\.type === "tts\.speak"\s*\?\s*openTtsEditor\(row\)/
  );
  assert.match(app, /testEventType: "chat"/);
  assert.match(app, /testMessage: "ShenPulse est prêt/);
});

test("l'éditeur d'action reste progressif et parle de déclencheurs", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(path.join(rendererDirectory, "app.js"), "utf8");
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );
  const start = app.indexOf("function openActionEditor(row)");
  const end = app.indexOf("function openTtsEditor", start);
  const editor = app.slice(start, end);
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );

  assert.match(editor, /variant: "wide"/);
  assert.match(editor, /1\. Action/);
  assert.match(editor, /2\. Déclencheur/);
  assert.match(editor, /name="triggerEnabled"/);
  assert.match(editor, /data-editor-trigger-enabled/);
  assert.match(editor, /data-trigger-enabled/);
  assert.match(editor, /const triggerEnabled = data\.get\("triggerEnabled"\) === "true"/);
  assert.match(editor, /enabled: triggerEnabled/);
  assert.match(editor, /data-editor-action-type/);
  assert.match(editor, /data-trigger-types="gift"/);
  assert.match(editor, /const rawUrl = String\(libraryUrl/);
  assert.match(editor, /Choisissez un son à jouer/);
  assert.match(app, /function syncActionEditorVisibility/);
  assert.match(app, /function setEditorConditionalVisibility/);
  assert.match(app, /control\.disabled = true/);
  assert.match(app, /dialogForm\.addEventListener\(\s*"invalid"/);
  assert.match(app, /showDialogError/);
  assert.match(html, /id="dialog-error"/);
  assert.match(styles, /dialog\[data-variant="wide"\]/);
  assert.match(styles, /\.action-editor-basics/);
  assert.match(styles, /\.dialog-header-toggle/);
  assert.match(styles, /\.trigger-editor-fields/);
  assert.match(styles, /\.dialog-section\.is-trigger-disabled > \.form-grid/);
  assert.doesNotMatch(app, /name="triggerSource"/);
  assert.doesNotMatch(app, /function triggerSourceOptions/);
  assert.match(styles, /\.dialog-error/);
});

test("la page Actions et l'éditeur de déclencheur restent simples et sans doublons", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(path.join(rendererDirectory, "app.js"), "utf8");
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );
  const actionsStart = app.indexOf("function renderActions()");
  const actionsEnd = app.indexOf("function renderTimersPanel", actionsStart);
  const actionsPage = app.slice(actionsStart, actionsEnd);
  const editorStart = app.indexOf("function openRuleEditor(rule)");
  const editorEnd = app.indexOf("function openConnectionEditor", editorStart);
  const editor = app.slice(editorStart, editorEnd);

  assert.doesNotMatch(actionsPage, /view-mode-control|set-actions-view/);
  assert.doesNotMatch(actionsPage, /renderTikTokReadiness/);
  assert.doesNotMatch(actionsPage, /\["events", "Déclencheurs"/);
  assert.doesNotMatch(actionsPage, /actionsSection === "events"/);
  assert.match(
    actionsPage,
    /directement dans chaque action, l’événement qui doit la lancer/
  );
  assert.doesNotMatch(editor, /Actions liées|Actions JSON/);
  assert.doesNotMatch(editor, /Conditions et exécution avancées|dialog-advanced/);
  assert.doesNotMatch(editor, /variant:\s*"wide"/);
  assert.match(editor, /class="trigger-editor"/);
  assert.match(editor, /trigger-editor-source-note/);
  assert.match(editor, /actions:\s*current\.actions \|\| \[\]/);
  assert.match(
    editor,
    /conditions:\s*buildTriggerConditions\(current\.conditions, data\)/
  );
  assert.match(styles, /\.trigger-editor-source-note/);
  assert.match(styles, /\.editor-conditional\.full/);
});

test("les médias, sons et cadeaux utilisent des bibliothèques recherchables", () => {
  const renderer = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const main = fs.readFileSync(
    path.join(__dirname, "..", "src", "main", "main.js"),
    "utf8"
  );
  const html = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "index.html"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );

  assert.match(renderer, /function soundPickerField/);
  assert.match(renderer, /function mediaPickerField/);
  assert.match(renderer, /data-open-media-library/);
  assert.match(renderer, /function openMediaLibrary/);
  assert.match(renderer, /mediaLibraryDialog\.showModal/);
  assert.match(renderer, /api\.searchSounds/);
  assert.match(renderer, /api\.searchMedia/);
  assert.match(renderer, /api\.uploadCustomMedia/);
  assert.match(renderer, /window\.ShenPulseMediaLibrary = globalMediaLibrary/);
  assert.match(renderer, /data-media-preview-url/);
  assert.match(renderer, /mediaName:\s*data\.get\("urlName"\)/);
  assert.match(renderer, /soundName:\s*data\.get\("soundLibraryName"\)/);
  assert.match(html, /id="media-library-dialog"/);
  assert.match(html, /id="media-library-results"/);
  assert.match(html, /vendor\/lottie-player\.js/);
  assert.match(styles, /dialog\.media-library-dialog/);
  assert.match(styles, /\.media-library-results\.visual-results/);
  assert.match(styles, /\.media-library-upload/);
  const sourceOptions = renderer.slice(
    renderer.indexOf("function mediaLibrarySourceOptions"),
    renderer.indexOf("function mediaLibraryFilterOptions")
  );
  assert.match(sourceOptions, /Catalogue web MyInstants/);
  assert.match(sourceOptions, /Catalogue web/);
  assert.doesNotMatch(sourceOptions, /Inclus dans ShenPulse|Inclus & animations/);
  assert.match(renderer, /function giftPickerField/);
  assert.match(renderer, /data-gift-results/);
  assert.match(renderer, /api\.searchGifts\(query, 1000\)/);
  assert.match(renderer, /data-gift-selected/);
  assert.match(renderer, /function updateGiftPickerSelection/);
  assert.match(renderer, /gift\.imageUrl/);
  assert.match(renderer, /Tri : pièces ↑ puis A–Z/);
  assert.match(renderer, /function positionGiftResults/);
  assert.match(renderer, /data-action="upload-sound"/);
  assert.match(renderer, /api\.uploadCustomSound/);
  assert.match(renderer, /audioStage\.replaceChildren\(audio\)/);
  assert.match(main, /http:\/\/127\.0\.0\.1:\*/);
  assert.match(html, /media-src[^"]+http:\/\/127\.0\.0\.1:\*/);
});

test("le mini-onglet Timers planifie une ou plusieurs actions à intervalle régulier", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );

  assert.doesNotMatch(app, /id: "timers",\s*label: "Timers"/);
  assert.match(app, /\["timers", "Timers", scheduledTimers\(\)\.length\]/);
  assert.match(app, /actionsSection === "timers" \? renderTimersPanel\(\)/);
  assert.match(app, /function renderTimersPanel\(\)/);
  assert.match(app, /function openTimerEditor\(timer\)/);
  assert.match(app, /field\("intervalValue"/);
  assert.match(app, /field\("repeatCount"/);
  assert.match(app, /name="actionIds"/);
  assert.match(app, /data-action="test-timer"/);
  assert.match(app, /api\.testTimer\(id\)/);
  assert.doesNotMatch(app, /data-action="timer-control"/);
});

test("le formulaire d'essai garde l'adresse e-mail saisissable après un envoi", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );
  const formStart = app.indexOf("function renderAdminTrials()");
  const formEnd = app.indexOf("function renderAdminCommerce", formStart);
  const form = app.slice(formStart, formEnd);
  const submitStart = app.indexOf(
    'if (event.target.id === "admin-trial-form")'
  );
  const submitEnd = app.indexOf(
    'if (event.target.id === "simulator-form")',
    submitStart
  );
  const submit = app.slice(submitStart, submitEnd);
  const revokeStart = app.indexOf('if (action === "admin-trial-revoke")');
  const revokeEnd = app.indexOf(
    'if (action === "admin-plan-edit")',
    revokeStart
  );
  const revoke = app.slice(revokeStart, revokeEnd);
  const restoreStart = app.indexOf(
    "function restoreAdminTrialFormInteractivity"
  );
  const restoreEnd = app.indexOf(
    "function renderAdminCommerce",
    restoreStart
  );
  const restore = app.slice(restoreStart, restoreEnd);

  assert.match(form, /name="email" type="email"/);
  assert.match(form, /type="submit" \$\{adminBusy \? "disabled" : ""\}/);
  assert.doesNotMatch(submit, /if \(adminModuleError\("trials"\)\)/);
  assert.match(submit, /finally \{\s*adminBusy = false;\s*render\(\);/);
  assert.match(
    submit,
    /restoreAdminTrialFormInteractivity\(\{ focusEmail: true \}\)/
  );
  assert.match(
    revoke,
    /restoreAdminTrialFormInteractivity\(\{ focusEmail: true \}\)/
  );
  assert.match(restore, /adminContent\?\.classList\.remove\("is-busy"\)/);
  assert.match(restore, /control\.disabled = false/);
  assert.match(restore, /emailInput\.readOnly = false/);
  assert.match(restore, /emailInput\.focus\(\{ preventScroll: true \}\)/);
  assert.match(restore, /requestAnimationFrame\(restore\)/);
  assert.match(styles, /\.admin-trial-form input\[name="email"\]/);
  assert.match(
    styles,
    /\.admin-content\.is-busy \.admin-trial-form[\s\S]*pointer-events: auto/
  );
});

test("une session propriétaire resynchronise les accès offerts au démarrage", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const startup = app.slice(app.indexOf("api.getSnapshot()"));

  assert.match(startup, /if \(isVerifiedAdminSession\(\)\)/);
  assert.match(startup, /adminDashboard = await api\.admin\.dashboard\(\)/);
  assert.match(
    startup,
    /adminSession = adminDashboard\.status \|\| adminSession/
  );
});

test("un tarif de jeu accepte la virgule et est publié en production", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const editorStart = app.indexOf("function openAdminProductEditor");
  const editorEnd = app.indexOf(
    "function openAdminPromotionEditor",
    editorStart
  );
  const editor = app.slice(editorStart, editorEnd);

  assert.match(
    app,
    /function normalizeAdminMoney[\s\S]*replace\(",", "\."\)/
  );
  assert.match(editor, /submitLabel: "Enregistrer et publier"/);
  assert.match(
    editor,
    /saveAdminCommerce\(\s*catalog,\s*"publish-prod"/
  );
});

test("les pages de jeu utilisent le parcours commun simplifié en quatre étapes", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );
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
  assert.match(app, /function openGameInteractionEditor/);
  assert.match(app, /giftPickerField\("giftNameCondition"/);
  assert.match(styles, /dialog\[data-variant="effect"\]/);
  assert.match(styles, /\.game-interaction-editor-hero/);
});

test("les interactions de jeu disposent d'une bibliothèque visuelle complète", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );

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

test("un ancien pack GTA propose explicitement la mise à jour des véhicules", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  assert.match(app, /pack\.installerVersion/);
  assert.match(app, /installation\.installerVersion/);
  assert.match(app, /178 véhicules/);
  assert.match(app, /Mettre à jour le pack/);
});

test("les interactions restent dans leur jeu et la session active reste visible partout", () => {
  const root = path.join(__dirname, "..");
  const rendererDirectory = path.join(root, "src", "renderer");
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );
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
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const start = app.indexOf('if (action === "install-game")');
  const end = app.indexOf('if (action === "launch-game")', start);
  const handler = app.slice(start, end);
  assert.match(handler, /gamePageMessages\.set\(id/);
  assert.doesNotMatch(handler, /toast\(\s*"Installation impossible"/);
});

test("les actions visuelles sont fusionnees en Media et proposent huit ecrans OBS", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(path.join(rendererDirectory, "app.js"), "utf8");
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );
  const labels = app.slice(
    app.indexOf("const ACTION_TYPE_LABELS"),
    app.indexOf("const EVENT_LABELS")
  );
  const typeOptions = app.slice(
    app.indexOf("function actionTypeOptions"),
    app.indexOf("function gameInteractionRowData")
  );

  assert.match(labels, /"overlay\.media": "Media"/);
  assert.doesNotMatch(labels, /"overlay\.alert"/);
  assert.doesNotMatch(typeOptions, /"overlay\.alert"/);
  assert.match(app, /function canonicalActionType/);
  assert.match(app, /function renderMediaScreensPanel/);
  assert.match(app, /snapshot\.overlayUrls\?\.mediaScreens/);
  assert.match(app, /name="mediaScreen"/);
  assert.match(app, /Écrans Media/);
  assert.match(styles, /\.media-screens-panel/);
  assert.match(styles, /\.media-screens-table/);
});

test("l'administration conserve son scroll et ignore les rafraîchissements du LIVE", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const stateChangedHandler = app.slice(
    app.indexOf('api.on("state-changed"'),
    app.indexOf('api.on("live-event"')
  );

  assert.match(app, /function captureAdminScrollState/);
  assert.match(app, /function restoreAdminScrollState/);
  assert.match(app, /data-admin-scroll="visibility-/);
  assert.doesNotMatch(stateChangedHandler, /currentPage === "admin"/);
});

test("les pages compactes utilisent une typographie secondaire plus lisible", () => {
  const styles = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );
  const readability = styles.slice(
    styles.indexOf("Readability pass for the compact creator pages")
  );

  assert.match(readability, /\.actions-workspace/);
  assert.match(readability, /\.sounds-page/);
  assert.match(readability, /\.overlay-catalog-page/);
  assert.match(readability, /\.membership-page/);
  assert.match(readability, /\.data-table \{\s*font-size: 10\.5px/);
  assert.match(readability, /\.subscription-card > p,[\s\S]*font-size: 11px/);
});

test("toutes les cartes du tableau de bord affichent la session active", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const dashboard = app.slice(
    app.indexOf("function renderDashboard"),
    app.indexOf("function renderLive")
  );

  assert.match(dashboard, /stats\.sessionLikes \|\| 0/);
  assert.match(dashboard, /stats\.sessionUniqueViewers\?\.length \|\| 0/);
  assert.doesNotMatch(dashboard, /"total local"/);
  assert.doesNotMatch(dashboard, /"historique local"/);
});

test("les déclencheurs proposés excluent Raid et Tous les déclencheurs", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const options = app.slice(
    app.indexOf("function triggerTypeOptions"),
    app.indexOf("function syncActionEditorVisibility")
  );
  const simulator = app.slice(
    app.indexOf("function renderActions"),
    app.indexOf("function renderRules")
  );

  for (const type of [
    "gift",
    "like",
    "follow",
    "chat",
    "share",
    "subscribe",
    "join"
  ]) {
    assert.match(options, new RegExp(`\\["${type}"`));
  }
  assert.doesNotMatch(options, /\["raid"/);
  assert.doesNotMatch(options, /Tous les déclencheurs/);
  assert.doesNotMatch(simulator, /\["gift","like","follow","chat","share","subscribe","join","raid"\]/);
});

test("les listes d'actions et de déclencheurs affichent une icône à gauche", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const actionIcons = app.slice(
    app.indexOf("const ACTION_TYPE_ICONS"),
    app.indexOf("const NAVIGATION_ICONS")
  );
  const actionOptions = app.slice(
    app.indexOf("function actionTypeOptions"),
    app.indexOf("function gameInteractionRowData")
  );
  const triggerOptions = app.slice(
    app.indexOf("function triggerTypeOptions"),
    app.indexOf("function syncActionEditorVisibility")
  );

  assert.match(actionIcons, /"overlay\.media": "🎬"/);
  assert.match(actionIcons, /"audio\.play": "🔊"/);
  assert.match(actionIcons, /"goal\.add": "🎯"/);
  assert.match(actionIcons, /"system\.keys": "⌨️"/);
  assert.match(actionIcons, /"http\.request": "🌐"/);
  assert.match(actionOptions, /actionTypeOptionLabel\(type\)/);
  assert.match(triggerOptions, /eventIcons\[value\]/);
  assert.match(triggerOptions, /\\u00A0\\u00A0/);
});

test("les pictogrammes et cadeaux ne sont plus enfermés dans un carré coloré", () => {
  const styles = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "styles.css"),
    "utf8"
  );
  const unframedIcons = styles.slice(
    styles.indexOf("/* Les pictogrammes et miniatures"),
    styles.length
  );

  for (const selector of [
    ".event-icon",
    ".event-visual",
    ".compact-media-icon",
    ".compact-media-thumb",
    ".gift-picker-selection",
    ".gift-result-fallback",
    ".admin-item-icon"
  ]) {
    assert.match(unframedIcons, new RegExp(selector.replace(".", "\\.")));
  }
  assert.match(unframedIcons, /border: 0;/);
  assert.match(unframedIcons, /background: transparent;/);
});

test("les mises à jour conservent les éléments du menu sous la souris", () => {
  const app = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "app.js"),
    "utf8"
  );
  const navigationRenderer = app.slice(
    app.indexOf("function renderNavigation"),
    app.indexOf("function tiktokMeta")
  );
  const chromeSync = app.slice(
    app.indexOf("function syncChrome"),
    app.indexOf("function render()")
  );
  const pageRenderer = app.slice(
    app.indexOf("function render()"),
    app.indexOf("function captureAdminScrollState")
  );

  assert.match(navigationRenderer, /nextStructureSignature !== navigationStructureSignature/);
  assert.match(navigationRenderer, /item\.classList\.toggle\("active"/);
  assert.match(navigationRenderer, /countNode\.textContent !== nextCount/);
  assert.match(chromeSync, /nextProfileChromeSignature !== profileChromeSignature/);
  assert.match(chromeSync, /const menuWasOpen = !profileMenu\.hidden/);
  assert.doesNotMatch(chromeSync, /profileMenu\.hidden = true/);
  assert.match(pageRenderer, /renderedContentMarkup === nextContentMarkup/);
  assert.match(pageRenderer, /content\.innerHTML = nextContentMarkup/);
});

test("le lancement Minecraft affiche une attente bloquante jusqu’au serveur prêt", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );
  const styles = fs.readFileSync(
    path.join(rendererDirectory, "styles.css"),
    "utf8"
  );
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
  const app = fs.readFileSync(
    path.join(rendererDirectory, "app.js"),
    "utf8"
  );

  assert.match(app, /function gameInteractionReadinessIssues\(pack\)/);
  assert.match(app, /aucun cadeau TikTok n’est sélectionné/);
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
