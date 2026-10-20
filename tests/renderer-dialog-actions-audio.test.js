"use strict";
const { readMainSource } = require("./helpers/main-source-bundles");
const { readRendererSource, readRendererStyles } = require("./helpers/source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** Actions, déclencheurs, médias, sons et TTS. */

test("une interaction conserve le visuel du cadeau homonyme choisi par son identifiant", () => {
  const foundationsPath = path.join(
    __dirname,
    "..",
    "src",
    "renderer",
    "app",
    "core",
    "ui-foundations.js"
  );
  const foundations = fs.readFileSync(foundationsPath, "utf8");
  const relevantSource = foundations.slice(
    0,
    foundations.indexOf("function asNumber")
  );
  const context = {
    giftCatalogById: new Map([
      ["cheap", { id: "cheap", name: "Je t'aime", imageUrl: "cheap.webp" }],
      ["selected", { id: "selected", name: "Je t'aime", imageUrl: "selected.webp" }]
    ]),
    giftCatalogByName: new Map([
      ["je t'aime", { id: "cheap", name: "Je t'aime", imageUrl: "cheap.webp" }]
    ]),
    triggerLabel: () => "Cadeau · Je t'aime"
  };
  vm.runInNewContext(
    `${relevantSource}\n` +
      `globalThis.result = triggerPill({` +
      `trigger: { type: "gift" },` +
      `conditions: [{ field: "data.giftName", operator: "equals", value: "Je t'aime", giftId: "selected" }]` +
      `});`,
    context
  );

  assert.match(context.result, /src="selected\.webp"/);
  assert.doesNotMatch(context.result, /src="cheap\.webp"/);

  const app = readRendererSource();
  const overlayEntries = app.slice(
    app.indexOf("function gameInteractionOverlayEntries(pack)"),
    app.indexOf("function gtaInteractionOverlayEntries(pack)")
  );
  assert.match(
    overlayEntries,
    /giftForSavedReference\(giftName, giftCondition\?\.giftId, giftCondition\)/
  );
  assert.match(overlayEntries, /gift\?\.imageUrl \|\| String\(giftCondition\?\.giftImageUrl/);
});

test("les sons, le TTS, Spotify et les cadeaux utilisent les services globaux", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const html = fs.readFileSync(path.join(rendererDirectory, "index.html"), "utf8");
  const app = readRendererSource();

  assert.match(html, /id="gift-catalog-options"/);
  assert.match(app, /value\.soundCatalog/);
  assert.match(app, /function openTtsEditor\(row\)/);
  assert.match(app, /data-action="add-tts"/);
  assert.match(app, /api\.searchGifts/);
  assert.match(app, /api\.connectSpotify/);
  assert.match(app, /spotify-control/);
});

test("les sons et le TTS choisissent une sortie locale ou un écran LIVE", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();

  assert.match(app, /function audioOutputSwitchMarkup/);
  assert.match(app, /data-action="set-audio-output"/);
  assert.match(app, /function openLiveAudioOutputEditor/);
  assert.match(app, /name="liveScreen"/);
  assert.match(app, /Attention aux doublons/);
  assert.match(app, /renderMediaScreensPanel\(flattenActions\(\), \{ context: "sounds" \}\)/);
  assert.match(app, /snapshot\.overlayUrls\?\.mediaScreens/);
  assert.match(styles, /\.audio-output-switch/);
  assert.match(styles, /\.live-audio-output-dialog/);
});

test("les vues compactes conservent toutes les commandes Actions et Sons", () => {
  const app = readRendererSource();
  const commands = [
    "add-action",
    "test-action",
    "edit-action",
    "duplicate-action",
    "delete-action",
    "toggle-rule",
    "add-trigger",
    "run-rule",
    "edit-trigger",
    "delete-trigger",
    "add-timer",
    "edit-timer",
    "test-timer",
    "toggle-timer",
    "add-sound",
    "upload-sound",
    "edit-sound",
    "set-sound-volume",
    "set-audio-output",
    "configure-audio-output",
    "add-tts",
    "edit-tts",
    "preview-tts",
    "spotify-connect",
    "spotify-refresh",
    "spotify-disconnect",
    "spotify-control"
  ];
  const dynamicCommands = new Set(["edit-sound", "edit-tts", "run-rule", "test-timer", "edit-timer"]);

  for (const command of commands) {
    if (["duplicate-action", "delete-action"].includes(command)) {
      assert.match(app, new RegExp(`renderAutomationIconButton\\(\\{ action: ["']${command}["']`));
      continue;
    }
    assert.match(
      app,
      dynamicCommands.has(command)
        ? new RegExp(`["']${command}["']`)
        : new RegExp(`data-action=["']${command}["']`)
    );
  }
  assert.match(app, /data-action="set-sounds-section"/);
  assert.match(app, /soundsSection === "audio"/);
  assert.match(app, /soundsSection === "tts"/);
  assert.match(app, /soundsSection === "outputs"/);
  assert.match(app, /soundsSection === "spotify"/);
});

test("les sons et le TTS restent uniquement dans leur atelier dédié", () => {
  const app = readRendererSource();
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
  const app = readRendererSource();
  const dialogPreviewStart = app.indexOf(
    'const mediaPreview = event.target.closest("[data-media-preview-url]")'
  );
  const dialogPreviewEnd = app.indexOf(
    'const giftChoice = event.target.closest("[data-gift-choice]")',
    dialogPreviewStart
  );
  const dialogPreview = app.slice(dialogPreviewStart, dialogPreviewEnd);
  const dialogEvents = fs.readFileSync(path.join(__dirname, "..", "src", "renderer", "app", "core", "events", "chrome-dialogs.js"), "utf8");
  const closeStart = dialogEvents.indexOf('dialog.addEventListener("close"');
  const closeEnd = dialogEvents.indexOf(
    'dialog.addEventListener("click"',
    closeStart
  );
  const closeHandler = dialogEvents.slice(closeStart, closeEnd);

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
  const app = readRendererSource();
  const editorStart = app.indexOf("function openTtsEditor(row)");
  const editorEnd = app.indexOf("function openSoundEditor", editorStart);
  const editor = app.slice(editorStart, editorEnd);
  const ttsSectionStart = app.indexOf("function renderTtsRules(rows)");
  const ttsSectionEnd = app.indexOf(
    "function renderSpotifyPanel",
    ttsSectionStart
  );
  const ttsSection = app.slice(ttsSectionStart, ttsSectionEnd);
  const soundSettingsSection = app.slice(
    app.indexOf("function soundTableSettings"),
    app.indexOf("function soundTableOutputChip")
  );
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
  assert.match(ttsSection, /renderAutomationTable\(/);
  assert.match(ttsSection, /trigger:\s*triggerPill\(rule/);
  assert.match(ttsSection, /soundTableSettings\(rule, action, actionIndex, \{ voice: true \}\)/);
  assert.match(soundSettingsSection, />VOIX</);
  assert.doesNotMatch(ttsSection, />LANGUE</);
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
  const app = readRendererSource();
  const styles = readRendererStyles();
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
  assert.match(app, /function giftTriggerConditionFields/);
  assert.match(app, /name="\$\{escapeHtml\(modeName\)\}" value="specific"/);
  assert.match(app, /name="\$\{escapeHtml\(modeName\)\}" value="value"/);
  assert.match(app, /data-gift-trigger-mode/);
  assert.match(app, /function syncGiftTriggerCondition/);
  assert.match(app, /giftTriggerMode === "specific" && giftName/);
  assert.match(app, /giftTriggerMode === "value" &&/);
  assert.match(app, /operatorName = "giftValueOperator"/);
  assert.match(app, /amountName = "giftValueAmount"/);
  assert.match(app, /\["less", "< · Moins de"\]/);
  assert.match(app, /\["greater", "> · Plus de"\]/);
  assert.match(styles, /\.gift-value-condition/);
  assert.match(styles, /\.gift-trigger-mode-option:has\(input:checked\)/);
  assert.doesNotMatch(app, /les deux critères doivent correspondre/);
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

test("la page Actions possède un mini-onglet de déclencheurs groupés ou aléatoires", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();
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
    /\["triggers", "Déclencheurs", automaticTriggerRules\(\)\.length\]/
  );
  assert.match(actionsPage, /actionsSection === "triggers" \? renderTriggersPanel\(\)/);
  assert.match(app, /function renderTriggersPanel\(\)/);
  assert.match(app, /data-action="add-trigger"/);
  assert.match(editor, /2\. Actions existantes/);
  assert.match(editor, /name="actionIds"/);
  assert.match(editor, /name="actionSelectionMode"/);
  assert.match(editor, /name="randomCount"/);
  assert.match(editor, /Nombre obligatoire à tirer/);
  assert.doesNotMatch(editor, /Conditions et exécution avancées|dialog-advanced/);
  assert.match(editor, /variant:\s*"wide"/);
  assert.match(editor, /class="trigger-editor action-editor"/);
  assert.match(editor, /trigger-editor-source-note/);
  assert.match(editor, /actions:\s*current\.actions \|\| \[\]/);
  assert.match(editor, /actionSelection:\s*\{/);
  assert.match(
    editor,
    /conditions:\s*buildTriggerConditions\(current\.conditions, data\)/
  );
  assert.match(styles, /\.trigger-editor-source-note/);
  assert.match(styles, /\.editor-conditional\.full/);
});

test("les médias, sons et cadeaux utilisent des bibliothèques recherchables", () => {
  const renderer = readRendererSource();
  const main = readMainSource("main.js");
  const html = fs.readFileSync(
    path.join(__dirname, "..", "src", "renderer", "index.html"),
    "utf8"
  );
  const styles = readRendererStyles();

  assert.match(renderer, /function soundPickerField/);
  assert.match(renderer, /function mediaPickerField/);
  assert.match(renderer, /data-open-media-library/);
  assert.match(renderer, /function openMediaLibrary/);
  assert.match(renderer, /mediaLibraryDialog\.showModal/);
  assert.match(renderer, /api\.searchSounds/);
  assert.match(renderer, /api\.searchMedia/);
  assert.match(renderer, /api\.uploadCustomMedia/);
  const uploadMediaFlow = renderer.slice(
    renderer.indexOf("async function uploadMediaFromLibrary"),
    renderer.indexOf("const globalMediaLibrary")
  );
  assert.match(
    uploadMediaFlow,
    /mediaLibrarySelected = item;[\s\S]*confirmMediaLibrarySelection\(\);/
  );
  assert.match(uploadMediaFlow, /Enregistrez l’action pour conserver ce choix/);
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
  assert.match(renderer, /api\.searchGifts\(query, String\(query \|\| ""\)\.trim\(\) \? 1000 : 10000\)/);
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
  const app = readRendererSource();

  assert.doesNotMatch(app, /id: "timers",\s*label: "Timers"/);
  assert.match(app, /\["timers", "Timers", scheduledTimers\(\)\.length\]/);
  assert.match(app, /actionsSection === "timers" \? renderTimersPanel\(\)/);
  assert.match(app, /function renderTimersPanel\(\)/);
  assert.match(app, /function openTimerEditor\(timer\)/);
  assert.match(app, /field\("intervalValue"/);
  assert.match(app, /field\("repeatCount"/);
  assert.match(app, /name="actionIds"/);
  assert.match(app, /renderAutomationIconButton\(\{ action: "test-timer"/);
  assert.match(app, /api\.testTimer\(id\)/);
  assert.doesNotMatch(app, /data-action="timer-control"/);
});

test("les actions visuelles sont fusionnees en Media et proposent huit ecrans OBS", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const app = readRendererSource();
  const styles = readRendererStyles();
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
  assert.match(app, /function isCopiedMediaScreenUrl/);
  assert.match(app, /data-media-screen-url="true"/);
  assert.match(app, /ready \? "Prêt" : "Hors ligne"/);
  assert.match(app, /Ces champs d’URL servent à visualiser les médias/);
  assert.match(app, /Ces URL diffusent les sons et le TTS sur le LIVE/);
  assert.match(app, /La préécoute dans ShenPulse fonctionne sans source navigateur/);
  assert.match(app, /name="mediaScreen"/);
  assert.match(app, /Écrans Media/);
  assert.match(styles, /\.media-screens-panel/);
  assert.match(styles, /\.media-screens-table/);
});

test("les déclencheurs proposés excluent Raid et Tous les déclencheurs", () => {
  const app = readRendererSource();
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
  const app = readRendererSource();
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

test("le simulateur utilise le cout catalogue du cadeau selectionne", () => {
  const app = readRendererSource();
  const simulatorStart = app.indexOf("function dashboardSimulatorMarkup");
  const simulatorEnd = app.indexOf("function dashboardGiftShortcutsMarkup", simulatorStart);
  const simulator = app.slice(simulatorStart, simulatorEnd);
  const start = app.indexOf('if (event.target.id === "simulator-form")');
  const end = app.indexOf('if (event.target.id !== "settings-form")', start);
  const submit = app.slice(start, end);

  assert.match(submit, /values\.type === "gift" && selectedGift/);
  assert.match(submit, /selectedGift\.cost/);
  assert.doesNotMatch(submit, /value: Number\(values\.value \|\| 0\)/);
  assert.match(simulator, /type === "gift" \? "Nombre de cadeaux"/);
  assert.match(simulator, /type === "like" \? 25 : 1/);
  assert.doesNotMatch(simulator, /type === "like" \? 25 : 5/);
});

test("dupliquer une action cree une regle independante", () => {
  const app = readRendererSource();
  const start = app.indexOf("async function duplicateActionRow(row)");
  const end = app.indexOf("async function deleteActionRow(row)", start);
  const duplicateAction = app.slice(start, end);

  assert.match(duplicateAction, /const nextRule = structuredClone\(row\.rule\)/);
  assert.match(duplicateAction, /nextRule\.id = `rule_\$\{cryptoId\(\)\}`/);
  assert.match(duplicateAction, /nextRule\.actions = \[nextAction\]/);
  assert.doesNotMatch(
    duplicateAction,
    /actions: \[\.\.\.\(row\.rule\.actions \|\| \[\]\), nextAction\]/
  );
});

