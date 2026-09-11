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

const root = path.join(__dirname, "..");
const renderer = readRendererSource();
const rendererCss = readRendererStyles();
const overlayRuntime = readOverlayRuntimeSource();
const overlayCss = readOverlayStyles();
const mainIpc = fs.readFileSync(
  path.join(root, "src", "main", "ipc.js"),
  "utf8"
);
const mainCore = fs.readFileSync(
  path.join(root, "src", "main", "core.js"),
  "utf8"
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, "package.json"), "utf8")
);

test("le Like Goal garde une géométrie et une police identiques dans TikTok Studio", () => {
  assert.match(overlayCss, /@font-face\s*\{[\s\S]*font-family:\s*"Inter"/);
  assert.match(overlayCss, /inter-latin-wght-normal\.woff2/);
  assert.match(overlayCss, /format\("woff2"\)/);
  assert.match(overlayCss, /font-optical-sizing:\s*none/);
  assert.doesNotMatch(overlayCss, /font-weight:\s*(?:9[1-9][0-9]|1000)/);
  assert.match(
    overlayCss,
    /#like-goal-view\.active > \.like-goal-widget\s*\{[\s\S]*flex:\s*0 0 1300px;[\s\S]*height:\s*200px;/
  );
  assert.match(overlayCss, /scale\(var\(--like-goal-viewport-scale, 1\)\)/);
  assert.match(
    overlayCss,
    /\[data-theme\]:not\(\[data-theme="classic"\]\) \.like-goal-content > strong\s*\{[\s\S]*font-size:\s*22px;/
  );
  assert.match(
    overlayCss,
    /\[data-theme\]:not\(\[data-theme="classic"\]\) \.like-goal-content > small\s*\{[\s\S]*font-size:\s*18px;/
  );
  assert.match(overlayCss, /top:\s*calc\(26% - 16px\)/);
  assert.match(overlayCss, /top:\s*calc\(var\(--like-goal-value-top\) - 16px\)/);
  assert.match(overlayCss, /height:\s*32px;[\s\S]*transform-origin:\s*center/);
  assert.doesNotMatch(
    overlayCss,
    /calc\(-50% \+ var\(--like-goal-(?:title|content)-y/
  );
  assert.match(overlayRuntime, /function configureLikeGoalViewport\(viewName, activeView\)/);
  assert.match(overlayRuntime, /width \/ 1300, height \/ 200/);
  assert.match(overlayRuntime, /new ResizeObserver\(synchronize\)/);
  assert.match(overlayRuntime, /document\.fonts\?\.ready/);
  assert.equal(
    fs.existsSync(
      path.join(root, "resources", "overlays", "fonts", "inter-latin-wght-normal.woff2")
    ),
    true
  );
});

test("les sources TikTok Studio ne gardent plus un ancien moteur overlay en cache", () => {
  const firebase = JSON.parse(
    fs.readFileSync(path.join(root, "firebase.json"), "utf8")
  );
  const overlayHtml = fs.readFileSync(
    path.join(root, "resources", "overlays", "index.html"),
    "utf8"
  );
  const runtimeVersion = JSON.parse(
    fs.readFileSync(
      path.join(root, "resources", "overlays", "runtime-version.json"),
      "utf8"
    )
  );
  const rootHeaders = firebase.hosting.headers.find((entry) => entry.source === "/")?.headers || [];
  const rootCacheControl = rootHeaders.find((entry) => entry.key === "Cache-Control")?.value || "";

  assert.equal(runtimeVersion.version, packageJson.version);
  assert.match(overlayHtml, new RegExp(`shenpulse-overlay-version" content="${packageJson.version}`));
  assert.match(rootCacheControl, /no-store/);
  assert.match(rootCacheControl, /max-age=0/);
  assert.match(overlayRuntime, /function startOverlayRuntimeVersionMonitor\(\)/);
  assert.match(overlayRuntime, /setInterval\(checkOverlayRuntimeVersion, 15000\)/);
  assert.match(overlayRuntime, /url\.searchParams\.set\("runtime", overlayRuntimeVersion\)/);
  assert.match(overlayRuntime, /fetch\(versionUrl, \{ cache: "no-store" \}\)/);
});

test("tous les overlays utilisent une scène native identique dans les sources navigateur", () => {
  assert.match(overlayRuntime, /function configureNativeOverlayCanvas\(viewName, activeView, catalog\)/);
  assert.match(overlayRuntime, /activeView\.classList\.add\("native-overlay-canvas"\)/);
  assert.match(overlayRuntime, /configureNativeOverlayCanvas\(viewName, activeView, overlayCatalog\)/);
  assert.match(overlayRuntime, /function mountNativeOverlayShell\(viewName, catalog\)/);
  assert.match(overlayRuntime, /definition\?\.sourceSize \|\| \[1920, 1080\]/);
  assert.match(overlayRuntime, /Math\.min\(1, viewportWidth \/ width, viewportHeight \/ height\)/);
  assert.match(overlayRuntime, /url\.searchParams\.set\("native", "1"\)/);
  assert.match(overlayRuntime, /forwardNativeOverlayShellMessage\(event\)/);
  assert.match(
    overlayRuntime,
    /async function initialize\(\) \{\s*startOverlayRuntimeVersionMonitor\(\);\s*if \(mountNativeOverlayShell\(viewName, overlayCatalog\)\) return;/
  );
  assert.match(overlayCss, /\.native-overlay-shell > iframe\s*\{[\s\S]*transform: translate\(-50%, -50%\) scale/);
  assert.match(overlayCss, /\.view\.active\.native-overlay-canvas\s*\{[\s\S]*var\(--native-canvas-scale, 1\)/);
});

test("chaque champ des configurations overlay possède une aide information", () => {
  const start = renderer.indexOf("function openWheelOverlayConfig");
  const end = renderer.indexOf("function openOverlayConfigLegacy", start);
  const editors = renderer.slice(start, end);
  const helpStart = renderer.indexOf("const OVERLAY_FIELD_HELP");
  const helpEnd = renderer.indexOf("function fieldLabelWithInfo", helpStart);
  const helpCatalog = renderer.slice(helpStart, helpEnd);
  const names = new Set(
    [...editors.matchAll(/(?:overlayField|overlaySelect)\("([^"]+)"/g)]
      .map((match) => match[1])
  );
  for (const name of [
    "wheelEnabled",
    "wheelDesign",
    "wheelTrigger",
    "wheelSegmentLabel",
    "wheelSegmentColor",
    "wheelSegmentAction",
    "wheelSegmentActionId"
  ]) {
    names.add(name);
  }

  assert.ok(names.size >= 60, `inventaire trop court : ${names.size} champs`);
  for (const name of names) {
    assert.match(
      helpCatalog,
      new RegExp(`(?:^|\\n)\\s*${name}:\\s*"`),
      `aide manquante pour ${name}`
    );
  }
  assert.match(renderer, /class="field-info-button"/);
  assert.match(renderer, /role="tooltip"/);
  assert.match(rendererCss, /\.field-info-popover/);
  assert.match(rendererCss, /\.field-label-with-info:focus-within/);
});

test("l'aperçu de configuration se met à jour sans recharger son iframe", () => {
  const start = renderer.indexOf("function scheduleOverlayLivePreview()");
  const end = renderer.indexOf("function openOverlayConfig(item)", start);
  const previewUpdate = renderer.slice(start, end);

  assert.match(previewUpdate, /channel:\s*"configuration"/);
  assert.match(previewUpdate, /const previewUrl = overlayCatalogPreviewUrl\(item\)/);
  assert.match(previewUpdate, /previewUrl \? \{ \.\.\.item, url: previewUrl \} : item/);
  assert.match(previewUpdate, /contentWindow\?\.postMessage/);
  assert.doesNotMatch(previewUpdate, /frame\.src\s*=/);
  assert.match(overlayRuntime, /function updatePreviewConfiguration\(payload = \{\}\)/);
  assert.match(
    overlayRuntime,
    /function updateOverlayConfiguration\(\s*payload = \{\}/
  );
  assert.match(
    overlayRuntime,
    /overlayKey && overlayKey !== activeOverlayConfigKey\(\)/
  );
  assert.match(
    overlayRuntime,
    /overlayChannels\.configuration = updateOverlayConfiguration/
  );
});

test("une configuration enregistrée atteint aussi les sources déjà ouvertes", () => {
  assert.match(renderer, /function publishOverlayConfiguration\(key, config\)/);
  assert.match(renderer, /await publishOverlayConfiguration\(key, nextConfig\)/);
  assert.match(renderer, /"view",[\s\S]*"token",[\s\S]*"channel"/);
  assert.match(renderer, /delete payload\[key\]/);
  assert.match(mainIpc, /handle\("overlay:configuration"/);
  assert.match(
    mainIpc,
    /core\.overlayServer\.publish\("configuration",\s*\{[\s\S]*overlayKey,[\s\S]*config:/
  );
});

test("enregistrer un overlay actualise l'URL publique affichée sans remplacer l'URL locale", () => {
  const editorStart = renderer.indexOf("function openOverlayConfig(item)");
  const editorEnd = renderer.indexOf(
    "function openOverlayConfigLegacy",
    editorStart
  );
  const editor = renderer.slice(editorStart, editorEnd);
  const cardUpdateStart = renderer.indexOf(
    "function updateOverlayCardConfigUi"
  );
  const cardUpdateEnd = renderer.indexOf(
    "function previewOverlayDesignSelection",
    cardUpdateStart
  );
  const cardUpdate = renderer.slice(cardUpdateStart, cardUpdateEnd);

  assert.match(
    editor,
    /saveOverlayConfig\(item\.key, next, \{[\s\S]*rerender:\s*false,[\s\S]*updateCard:\s*true/
  );
  assert.match(
    cardUpdate,
    /\.url-field \[data-action="copy"\], \[data-action="open-url"\]/
  );
  assert.doesNotMatch(
    cardUpdate,
    /querySelectorAll\('\[data-action="copy"\], \[data-action="open-url"\]'\)/
  );
});

test("les sources publiques gardent une URL courte puis synchronisent leur configuration à distance", () => {
  assert.match(renderer, /function isPublicRelayOverlayUrl\(url\)/);
  assert.match(
    renderer,
    /includePublicConfiguration = false/
  );
  assert.match(
    renderer,
    /includePublicConfiguration:\s*true/
  );
  assert.match(
    overlayRuntime,
    /function applyRelayConfiguration\(configurations = \{\}\)/
  );
  assert.match(
    overlayRuntime,
    /applyRelayConfiguration\(relayDocument\?\.configurations\)/
  );
  assert.match(overlayRuntime, /PUBLIC_RELAY_CACHE_PREFIX/);
  assert.match(overlayRuntime, /const frameState = batch\.state/);
  assert.match(overlayRuntime, /authoritativeState: Boolean\(frameState\)/);
  assert.match(
    overlayRuntime,
    /likeGoalInitialTarget = target;\s*likeGoalTarget = target;/
  );
  assert.match(
    overlayRuntime,
    /function configurationWithoutRuntimeReset\(configuration = \{\}\)/
  );
  assert.match(overlayRuntime, /delete next\.current;/);
  assert.match(overlayRuntime, /delete next\.seconds;/);
  assert.match(
    overlayRuntime,
    /relayDocument\?\.state\?\.overlaySession\?\.hasData !== true/
  );
  assert.match(overlayRuntime, /const mutationTouchesRelayState =/);
  assert.match(
    overlayRuntime,
    /Object\.prototype\.hasOwnProperty\.call\(mutationData, "state"\)/
  );
});

test("les actions rapides publient une valeur absolue unique dans l'application et l'URL", () => {
  const start = renderer.indexOf("async function performOverlayQuickAction");
  const end = renderer.indexOf("async function handleAction", start);
  const quickActions = renderer.slice(start, end);
  const counterStart = quickActions.indexOf(
    'if (["likeGoal", "coinJar", "winCounter"].includes(key))'
  );
  const timerStart = quickActions.indexOf(
    '} else if (["timer", "multiplierTimer"].includes(key))',
    counterStart
  );
  const counters = quickActions.slice(counterStart, timerStart);

  assert.ok(counters.indexOf("await api.testAction") < counters.indexOf("await saveOverlayConfig"));
  assert.match(counters, /const synchronizedCurrent = Number\(actionResult\?\.current\)/);
  assert.match(counters, /operation:\s*"set"[\s\S]*current:\s*next\.current/);
});

test("le timer multiplicateur utilise exclusivement son canal dédié", () => {
  assert.match(renderer, /type:\s*"overlay\.multiplier-timer"/);
  assert.match(renderer, /postOverlayCardEvent\(key, "multiplier-timer", payload\)/);
  assert.match(
    renderer,
    /const timerChannel = key === "multiplierTimer"[\s\S]*?"multiplier-timer"[\s\S]*?: "timer"/
  );
  assert.doesNotMatch(
    renderer,
    /id: "preview_multiplier_timer"[\s\S]{0,160}?type: "timer\.add"/
  );
});

test("la roue affiche dans ShenPulse exactement le résultat diffusé à l’URL", () => {
  const start = renderer.indexOf('if (key === "wheel")', renderer.indexOf("async function dispatchOverlayTest"));
  const end = renderer.indexOf('throw new Error("Overlay inconnu.")', start);
  const wheelTest = renderer.slice(start, end);

  assert.match(wheelTest, /const result = await api\.testAction/);
  assert.match(wheelTest, /postOverlayCardEvent\(key, "wheel", result\)/);
  assert.doesNotMatch(wheelTest, /winnerIndex:\s*0/);
});

test("l'éditeur de roue sépare les tâches et garde un aperçu unique", () => {
  const start = renderer.indexOf("function openWheelOverlayConfig");
  const end = renderer.indexOf("function overlayDraftConfig", start);
  const editor = renderer.slice(start, end);

  for (const section of ["setup", "segments", "appearance", "playback"]) {
    assert.match(editor, new RegExp(`data-wheel-section="${section}"`));
    assert.match(
      editor,
      new RegExp(`data-wheel-section-panel="${section}"`)
    );
  }
  assert.match(editor, /wheel-editor-workspace/);
  assert.match(editor, /wheel-preview-column/);
  assert.match(editor, /const wheelTriggerText = wheelTriggerSummary\(wheel\)/);
  assert.match(editor, /Réglages typographiques avancés/);
  assert.match(renderer, /function syncWheelSegmentActionVisibility/);
  assert.match(rendererCss, /\.wheel-editor-steps/);
  assert.match(rendererCss, /\.wheel-preview-column/);
});

test("les éditeurs overlay standards restent compacts dans quatre onglets", () => {
  const start = renderer.indexOf("function overlayEditorTab");
  const end = renderer.indexOf("function openOverlayConfigLegacy", start);
  const editor = renderer.slice(start, end);

  for (const section of ["placement", "content", "appearance", "visibility"]) {
    assert.match(
      editor,
      new RegExp(`overlayEditorTab\\("${section}"`)
    );
    assert.match(
      editor,
      new RegExp(`overlayEditorPanel\\("${section}"`)
    );
  }
  assert.match(renderer, /data-overlay-editor-tab/);
  assert.match(renderer, /data-overlay-editor-panel/);
  assert.match(rendererCss, /\.overlay-editor-tabs/);
  assert.match(rendererCss, /\.overlay-editor-panels\s*\{[\s\S]*overflow:\s*hidden/);
  assert.match(rendererCss, /\.overlay-editor-panel\s*\{[\s\S]*overflow:\s*auto/);
});

test("le générateur d'URL consomme le contrat central des paramètres", () => {
  const start = renderer.indexOf("function overlayUrl(");
  const end = renderer.indexOf("function localOverlayUrl", start);
  const urlBuilder = renderer.slice(start, end);

  assert.match(
    urlBuilder,
    /const mappings = overlayCatalog\.configParameterMappings/
  );
  assert.doesNotMatch(urlBuilder, /likeGoalTitleOffsetX:\s*"titleX"/);
});

test("le Like Goal propose en français les quatre comportements de fin", () => {
  assert.match(renderer, /Lorsque l’objectif est atteint/);
  assert.match(renderer, /Conserver l’objectif/);
  assert.match(renderer, /Augmenter l’objectif/);
  assert.match(renderer, /Doubler l’objectif/);
  assert.match(renderer, /Masquer le Like Goal/);
  assert.match(renderer, /whenReached:\s*"whenReached"/);
  assert.match(overlayRuntime, /LikeGoalPolicy\.resolveCompletion/);
  assert.match(overlayRuntime, /like-goal-reached-hidden/);
});

test("les options du Like Goal restaurent les elements et deplacent ses textes", () => {
  assert.match(overlayRuntime, /element\.hidden = !showHeader/);
  assert.match(
    overlayRuntime,
    /#like-goal-progress-label, \.win-counter-content > small/
  );
  assert.doesNotMatch(
    overlayRuntime,
    /querySelectorAll\("\.like-goal-bar, \.win-counter-content > small"\)/
  );
  assert.match(
    overlayRuntime,
    /progressLabel\.hidden = !showGoal \|\| !likeGoalProgressLabel/
  );
  for (const field of [
    "likeGoalTitleOffsetX",
    "likeGoalTitleOffsetY",
    "likeGoalTitleScale",
    "likeGoalTitleColor",
    "likeGoalContentOffsetX",
    "likeGoalContentOffsetY",
    "likeGoalContentScale",
    "likeGoalContentColor",
    "likeGoalPercentColor"
  ]) {
    assert.match(renderer, new RegExp(`"${field}"`));
  }
  for (const parameter of [
    "titleX",
    "titleY",
    "titleScale",
    "titleColor",
    "contentX",
    "contentY",
    "contentScale",
    "contentColor",
    "percentColor"
  ]) {
    assert.match(overlayRuntime, new RegExp(`"${parameter}"`));
  }
});

test("le Like Goal et le timer standard proposent une action de fin", () => {
  assert.match(
    renderer,
    /Action à lancer lorsque l’objectif est atteint/
  );
  assert.match(
    renderer,
    /Action à lancer lorsque le timer arrive à zéro/
  );
  assert.match(
    renderer,
    /overlayActionSelect\("completionActionId"/
  );
  assert.match(renderer, /Choisir une action ShenPulse/);
  assert.match(renderer, /if \(item\.key === "timer"\)/);
  assert.match(
    overlayRuntime,
    /timerAutoStart\s*&&[\s\S]*\["timer", "multiplier-timer"\]\.includes\(viewName\)/
  );
  assert.match(mainCore, /"overlay-completion-fired"/);
  assert.match(renderer, /api\.on\("overlay-completion-fired"/);
  assert.match(renderer, /Action exécutée/);
});

test("le test du Like Goal ajoute le nombre choisi comme objectif initial", () => {
  const start = renderer.indexOf("function likeGoalTestAmount()");
  const end = renderer.indexOf(
    "async function dispatchOverlayTest",
    start
  );
  const amountResolver = renderer.slice(start, end);
  const dispatchStart = end;
  const dispatchEnd = renderer.indexOf(
    "async function performOverlayQuickAction",
    dispatchStart
  );
  const dispatch = renderer.slice(dispatchStart, dispatchEnd);

  assert.match(amountResolver, /querySelector\('\[name="target"\]'\)/);
  assert.match(amountResolver, /overlayConfig\("likeGoal"\)\.target/);
  assert.match(dispatch, /const amount = likeGoalTestAmount\(\)/);
  assert.match(dispatch, /count:\s*amount/);
  assert.match(dispatch, /likeCount:\s*amount/);
  assert.doesNotMatch(dispatch, /count:\s*5000/);
});

test("les configurations Pro restent éditables en aperçu sans exposer leur URL OBS", () => {
  const cardStart = renderer.indexOf("function renderOverlayCard");
  const cardEnd = renderer.indexOf("function overlayCardElement", cardStart);
  const card = renderer.slice(cardStart, cardEnd);
  const handlerStart = renderer.indexOf('if (action === "configure-overlay")');
  const handlerEnd = renderer.indexOf('if (action === "toggle-session")', handlerStart);
  const handler = renderer.slice(handlerStart, handlerEnd);

  assert.match(card, /Configurer l’aperçu/);
  assert.match(
    card,
    /const url = accountReady && allowed \? overlayUrl\(item\) : ""/
  );
  assert.doesNotMatch(handler, /overlayUnlocked/);
  assert.match(renderer, /URL OBS disponible avec Pro/);
  assert.match(renderer, /Aperçu local complet de l’overlay Pro/);
});

test("les réglages hérités utiles des classements pilotent réellement le moteur", () => {
  for (const field of [
    "showAvatars",
    "showCrown",
    "showRankBadges",
    "showMetricLabel",
    "nameColor",
    "scoreColor",
    "rankColor",
    "rowOpacity"
  ]) {
    assert.match(renderer, new RegExp(`"${field}"`));
    assert.match(overlayRuntime, new RegExp(field));
  }
  assert.match(overlayRuntime, /leaderboard-avatar-image/);
  assert.match(overlayRuntime, /leaderboardRankCrown/);
  assert.match(overlayRuntime, /--leaderboard-row-opacity/);
});

test("les raccourcis configurés pilotent réellement le timer et les wins", () => {
  assert.match(renderer, /function keyboardShortcutMatches\(event, shortcuts = ""\)/);
  assert.match(renderer, /function handleOverlayKeyboardShortcut\(event\)/);
  assert.match(renderer, /for \(const key of \["timer", "winCounter"\]\)/);
  assert.match(renderer, /performOverlayQuickAction\(key, operation, amount\)/);
  assert.match(renderer, /const amount = key === "timer" \? 60 : 1/);
});

test("le cadeau déclencheur d'une roue est exécuté par le moteur", () => {
  const core = fs.readFileSync(
    path.join(root, "src", "main", "core.js"),
    "utf8"
  );
  const runner = fs.readFileSync(
    path.join(root, "src", "main", "action-runner.js"),
    "utf8"
  );

  assert.match(core, /await this\.#handleWheelGiftTriggers\(event\)/);
  assert.match(core, /event\.type !== "gift"/);
  assert.match(core, /giftConditionMatches/);
  assert.match(core, /this\.giftCatalog\.gifts/);
  assert.match(core, /wheel\.triggerGift\?\.giftId/);
  assert.match(core, /wheel\.triggerGift\?\.giftImageUrl/);
  assert.match(core, /wheel\?\.enabled === false/);
  assert.match(core, /wheel\?\.giftValueFilter/);
  assert.match(core, /type:\s*"wheel\.spin"/);
  assert.match(core, /const deliveryCount = giftEventCount\(event\)/);
  assert.match(core, /index < deliveryCount/);
  assert.match(runner, /const enabledWheels = configuredWheels\.filter/);
  assert.match(runner, /Aucune roue active/);
  assert.match(overlayRuntime, /const wheelSpinQueue = \[\]/);
  assert.match(overlayRuntime, /wheelSpinQueue\.push\(payload\)/);
  assert.match(overlayRuntime, /wheelSpinQueue\.shift\(\)/);
});

test("les réglages vidéo des matchs atteignent réellement leur source", () => {
  assert.match(renderer, /autoplay:\s*"autoplay"/);
  assert.match(renderer, /loop:\s*"loop"/);
  assert.match(overlayRuntime, /previewBoolean\(payload,\s*"autoplay"/);
  assert.match(overlayRuntime, /previewBoolean\(payload,\s*"loop"/);
  assert.match(overlayRuntime, /video\.loop\s*=\s*matchLoop/);
  assert.match(
    overlayRuntime,
    /video\.autoplay\s*=\s*isStaticPreview\s*\?\s*false\s*:\s*matchAutoplay/
  );
  assert.match(overlayRuntime, /function setupMatchActivationRecovery\(\)/);
  assert.match(overlayRuntime, /visibilitychange/);
  assert.match(overlayRuntime, /MATCH_SOURCE_SUSPEND_GAP_MS/);
  assert.match(overlayRuntime, /video\.currentTime = 0/);
  assert.match(overlayRuntime, /function enqueueMatchPlayback\(payload = \{\}\)/);
  assert.match(overlayRuntime, /matchName === "player"/);
  assert.doesNotMatch(
    overlayRuntime,
    /renderCoinJar\(\);\s*restartMatchVideo\(\);/
  );
});

test("les timers forcent les heures et dimensionnent titre et valeur séparément", () => {
  const timerStart = overlayRuntime.indexOf("function renderTimer()");
  const timerEnd = overlayRuntime.indexOf("function spinWheel", timerStart);
  const timerRenderer = overlayRuntime.slice(timerStart, timerEnd);

  assert.match(timerRenderer, /const value = showHours\s*\?/);
  assert.doesNotMatch(timerRenderer, /showHours && hours > 0/);
  assert.match(overlayCss, /\[data-theme\]:not\(\[data-theme="classic"\]\) \.timer-panel\s*\{[\s\S]*width:\s*613\.2px;[\s\S]*height:\s*336px;/);
  assert.match(overlayCss, /\[data-theme\]:not\(\[data-theme="classic"\]\) \.timer-panel > p\s*\{[\s\S]*font-size:\s*19\.8px;/);
  assert.match(overlayCss, /\[data-theme\]:not\(\[data-theme="classic"\]\) \.timer-panel > strong\s*\{[\s\S]*font-size:\s*72px;/);
  for (const name of ["timerDays", "timerHours", "timerMinutes", "timerSeconds"]) {
    assert.match(renderer, new RegExp(`part\\("${name}"`));
  }
  assert.match(renderer, /function timerDurationParts\(totalSeconds = 0\)/);
  assert.match(renderer, /function timerDurationTotalSeconds\(data, fallback = 0\)/);
  assert.match(renderer, /value\("timerDays", 999\) \* 86_400/);
  assert.match(renderer, /next\.seconds = timerDurationTotalSeconds\(data, next\.seconds\)/);
  assert.doesNotMatch(renderer, /Durée initiale \(secondes\)/);
  for (const field of ["timerTitleScale", "timerValueScale"]) {
    assert.match(renderer, new RegExp(`"${field}"`));
    assert.match(overlayRuntime, new RegExp(`"${field}"`));
  }
  assert.match(rendererCss, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(rendererCss, /@media \(max-width:\s*900px\)[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(rendererCss, /@media \(max-width:\s*620px\)[\s\S]*grid-template-columns:\s*1fr/);
});

test("le Coin Jar expose une jauge réellement pilotée par ses quatre champs", () => {
  const overlayHtml = fs.readFileSync(
    path.join(root, "resources", "overlays", "index.html"),
    "utf8"
  );
  assert.match(overlayHtml, /id="coin-jar-current"/);
  assert.match(overlayHtml, /id="coin-jar-target"/);
  assert.match(overlayHtml, /id="coin-jar-level"/);
  assert.match(overlayRuntime, /coinJarTarget - coinJarMinimum/);
  assert.match(overlayRuntime, /widget\?\.classList\.toggle\("without-base", !showBase\)/);
  assert.match(overlayRuntime, /meter\.hidden = !showGoal/);
  assert.match(renderer, /\["likeGoal", "coinJar", "winCounter"\]/);
});

test("chaque popup overlay se rouvre en haut avec des champs lisibles", () => {
  const openEditorStart = renderer.indexOf("function openEditor({");
  const openEditorEnd = renderer.indexOf(
    "function clearDialogError",
    openEditorStart
  );
  const openEditor = renderer.slice(openEditorStart, openEditorEnd);

  assert.match(openEditor, /dialog\.scrollTop\s*=\s*0/);
  assert.match(openEditor, /dialogForm\.scrollTop\s*=\s*0/);
  assert.match(openEditor, /dialogBody\.scrollTop\s*=\s*0/);
  assert.match(
    rendererCss,
    /\.overlay-config-fields \.field-label-with-info/
  );
  assert.match(rendererCss, /font-size:\s*13px/);
});

test("les aperçus Match figent une vraie image représentative du design", () => {
  assert.match(
    overlayRuntime,
    /function positionStaticMatchPreview\(video,\s*expectedSource/
  );
  assert.match(overlayRuntime, /duration \* 0\.45/);
  assert.match(overlayRuntime, /video\.pause\(\)/);
  assert.match(overlayRuntime, /video\.currentTime = target/);
  assert.match(
    overlayRuntime,
    /video\.autoplay = isStaticPreview \? false : matchAutoplay/
  );
  assert.match(
    overlayRuntime,
    /if \(isStaticPreview\) positionStaticMatchPreview\(video,\s*source\)/
  );
});

test("les apercus Match jouent leur animation en boucle dans le catalogue", () => {
  const runtimeFrameStart = renderer.indexOf("function overlayRuntimeFrame");
  const runtimeFrameEnd = renderer.indexOf(
    "const observedOverlayRuntimeFrames",
    runtimeFrameStart
  );
  const runtimeFrame = renderer.slice(runtimeFrameStart, runtimeFrameEnd);

  assert.match(runtimeFrame, /item\.previewKind === "match"/);
  assert.match(runtimeFrame, /preview",\s*"animated"/);
  assert.match(runtimeFrame, /autoplay",\s*"true"/);
  assert.match(runtimeFrame, /loop",\s*"true"/);
  assert.match(
    overlayRuntime,
    /isStaticPreview \|\| previewMode === "animated"/
  );
  assert.match(
    overlayRuntime,
    /if \(isCatalogPreview\) \{[\s\S]*markOverlayReady\(\);[\s\S]*return;/
  );
});

test("la carte Like Goal place son apercu compact au-dessus des details", () => {
  assert.match(
    renderer,
    /overlay-catalog-card--\$\{escapeHtml\(previewVariant\)\}/
  );
  assert.match(
    rendererCss,
    /\.overlay-catalog-card--like-goal\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/
  );
  assert.match(
    rendererCss,
    /\.overlay-catalog-card--like-goal > \.overlay-preview\s*\{[\s\S]*height:\s*118px/
  );
  assert.match(
    rendererCss,
    /\.overlay-catalog-card--like-goal > \.overlay-card-copy\s*\{[\s\S]*grid-template-columns:\s*repeat\(2/
  );
});

test("enregistrer un overlay ne redemarre pas les serveurs locaux", () => {
  assert.match(mainIpc, /function localServerSettingsSignature/);
  assert.match(
    mainIpc,
    /if \(serverSettingsChanged\) await core\.restartServers\(\)/
  );
  assert.match(
    mainCore,
    /if \(this\.store\.getState\(\)\.settings\.startOverlayServer\)/
  );
  assert.match(mainCore, /await this\.overlayServer\.stop\(\)/);
});

test("un classement vide garde des profils de demonstration uniquement en apercu", () => {
  assert.match(overlayRuntime, /function seedStaticLeaderboardPreview/);
  assert.match(overlayRuntime, /!isStaticPreview/);
  assert.match(overlayRuntime, /seedStaticLeaderboardPreview\(\);\s*\n\s*renderLeaderboard/);
});
