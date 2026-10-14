"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { root, renderer, rendererHtml, rendererCss, overlayCss, overlayRuntime, overlayHtml } = require("./helpers/catalog-regression-fixtures");

/** Aperçus, sources OBS/LIVE Studio et rafraîchissements économes. */

test("tous les apercus reutilisent la source OBS reelle", () => {
  assert.match(renderer, /function overlayRuntimeFrame\(/);
  assert.match(
    renderer,
    /function overlayPreview\(item, config = null\)[\s\S]*placeholder: overlayCardPlaceholder\(item, effectiveConfig\)/
  );
  assert.match(
    renderer,
    /function overlayLivePreview[\s\S]*overlayRuntimeFrame\(item, config, \{[\s\S]*context: "live"[\s\S]*editable: true/
  );
  assert.match(renderer, /class="overlay-runtime-frame overlay-runtime-frame--/);
  assert.doesNotMatch(renderer, /function themedOverlayPreview\(/);
  assert.doesNotMatch(renderer, /function wheelEditorMachine\(/);
});

test("les aperçus différés gardent immédiatement le vrai design sélectionné", () => {
  const rendererHtml = fs.readFileSync(
    path.join(root, "src", "renderer", "index.html"),
    "utf8"
  );

  assert.match(
    rendererHtml,
    /overlays\/catalog\.js[\s\S]*overlays\/placeholders\.js[\s\S]*overlays\/cards\.js/
  );
  assert.match(
    renderer,
    /\.\.\/\.\.\/resources\/overlays\/media\/\$\{encodedPath\}/
  );
  assert.match(renderer, /overlayPlaceholderThemePath\("like-goal", design\)/);
  assert.match(renderer, /overlayPlaceholderThemePath\("timer", design\)/);
  assert.match(renderer, /overlayPlaceholderThemePath\("leaderboard", design\)/);
  assert.match(renderer, /overlayPlaceholderThemePath\("win-counter", design\)/);
  assert.match(renderer, /widgets\/coin-jar\/\$\{backName\}/);
  assert.match(
    renderer,
    /video\/posters\/\$\{item\.match\}-\$\{variant\}\.webp/
  );
  assert.match(renderer, /decoding="sync"/);
  assert.match(
    rendererCss,
    /\.overlay-runtime-placeholder > div\s*\{[\s\S]*position:\s*absolute;[\s\S]*inset:\s*0;/
  );
  assert.match(
    rendererCss,
    /\.overlay-placeholder-like-goal\[data-placeholder-theme="naruto"\]/
  );
  const videoDirectory = path.join(
    root,
    "resources",
    "overlays",
    "media",
    "video"
  );
  const videos = fs.readdirSync(videoDirectory)
    .filter((name) => name.endsWith(".webm"))
    .map((name) => name.replace(/\.webm$/, ".webp"))
    .sort();
  const posters = fs.readdirSync(path.join(videoDirectory, "posters"))
    .filter((name) => name.endsWith(".webp"))
    .sort();
  assert.deepEqual(posters, videos);
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
  assert.match(renderer, /L’aperçu et les réglages restent accessibles/);
  assert.match(renderer, /Configurer l’aperçu/);
  assert.match(rendererCss, /\.overlay-catalog-card\.locked[\s\S]*rgba\(249,\s*115,\s*22/);
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
  assert.match(renderer, /Sources pour TikTok LIVE Studio et OBS/);
});

test("la page overlays ne recrée pas ses iframes pour un état sans rapport", () => {
  assert.match(renderer, /function overlayPageStateSignature\(value\)/);
  assert.match(renderer, /function overlayRelayPageSignature\(value\)/);
  const relaySignatureStart = renderer.indexOf(
    "function overlayRelayPageSignature(value)"
  );
  const relaySignatureEnd = renderer.indexOf(
    "function overlayPageStateSignature(value)",
    relaySignatureStart
  );
  const relaySignature = renderer.slice(relaySignatureStart, relaySignatureEnd);
  assert.doesNotMatch(relaySignature, /connected|status|lastError|updatedAt/);
  assert.match(
    renderer,
    /const refreshOverlayPage =\s*currentPage === "overlays"[\s\S]*overlayPageStateSignature\(previous\) !== overlayPageStateSignature\(value\)/
  );
  assert.match(renderer, /refreshGamePage \|\|\s*refreshOverlayPage \|\|/);
  const relayStatusStart = renderer.indexOf(
    'api.on("public-overlay-relay-status"'
  );
  const relayStatusEnd = renderer.indexOf(
    'api.on("game-round-timeout"',
    relayStatusStart
  );
  const relayStatusHandler = renderer.slice(relayStatusStart, relayStatusEnd);
  assert.match(relayStatusHandler, /syncPublicOverlayRelayStatus\(status\)/);
  assert.doesNotMatch(relayStatusHandler, /render\(\)/);
});

test("les aperçus overlays se chargent seulement à l'écran et sont libérés à la sortie", () => {
  assert.doesNotMatch(renderer, /scheduleOverlayPreviewWarmup|overlayBackgroundPreviewCache|overlayPreviewWarmupHost/);
  assert.match(renderer, /function overlayRuntimeFrameAllowed\(frame\)/);
  assert.match(renderer, /currentPage === "overlays"/);
  assert.match(renderer, /function suspendOverlayRuntimePreviews\(root = document\)/);
  assert.match(renderer, /function disposeOverlayRuntimePreviews\(root = document\)/);
  assert.match(renderer, /function revealOverlayPreviewFrame\(iframe\)/);
  assert.match(
    renderer,
    /iframe\.getBoundingClientRect\(\);[\s\S]*overlay-runtime-frame--ready/
  );
  assert.match(
    renderer,
    /iframe\.hasAttribute\("data-overlay-live-preview"\)[\s\S]*scheduleOverlayLivePreview\(\)/
  );
  assert.match(
    renderer,
    /disposeOverlayRuntimePreviews\(content\)[\s\S]*content\.innerHTML = nextContentMarkup/
  );
  assert.match(renderer, /data-overlay-preview-key="\$\{escapeHtml\(item\.key\)\}"/);
  assert.match(
    rendererCss,
    /\.overlay-runtime-frame iframe\s*\{[\s\S]*z-index:\s*1;[\s\S]*opacity:\s*1;/
  );
  assert.match(
    rendererCss,
    /\.overlay-runtime-placeholder\s*\{[\s\S]*z-index:\s*2;/
  );
});

test("les actions rapides mettent a jour une seule carte sans reconstruire la galerie", () => {
  const quickActionStart = renderer.indexOf(
    "async function performOverlayQuickAction"
  );
  const quickActionEnd = renderer.indexOf(
    "async function handleAction",
    quickActionStart
  );
  const quickActions = renderer.slice(quickActionStart, quickActionEnd);

  assert.match(quickActions, /rerender:\s*false,\s*updateCard:\s*true/);
  assert.match(quickActions, /postOverlayCardEvent\(key,/);
  assert.match(renderer, /function consumeLocallyHandledOverlayState\(/);
  assert.match(
    renderer,
    /const overlayStateHandledLocally =[\s\S]*consumeLocallyHandledOverlayState\(previous, value\)/
  );
  assert.match(
    renderer,
    /!overlayStateHandledLocally &&\s*overlayPageStateSignature\(previous\) !== overlayPageStateSignature\(value\)/
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

test("chaque source charge uniquement ses propres médias lourds", () => {
  assert.match(
    overlayRuntime,
    /if \(viewName === "coin-jar"\) \{[\s\S]*jarBack\.src[\s\S]*jarFront\.src[\s\S]*\}/
  );
  assert.match(
    overlayRuntime,
    /if \(viewName === "wheel"\) \{[\s\S]*setupWheel\(\)/
  );
  assert.match(overlayRuntime, /if \(viewName === "leaderboard"[\s\S]*setupLeaderboard\(\)/);
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
  assert.match(overlayRuntime, /const designReady = setupOverlayDesign\(\)/);
  assert.match(overlayRuntime, /if \(isCatalogPreview\) \{[\s\S]*await designReady;[\s\S]*markOverlayReady\(\)/);
  assert.match(overlayRuntime, /connectLocalEventSource\(\)/);
  assert.match(overlayRuntime, /overlayChannels\.bootstrap = applyRelayState/);
  assert.match(renderer, /data-overlay-src="\$\{escapeHtml\(runtimeUrl\)\}"/);
  assert.match(renderer, /new IntersectionObserver\([\s\S]*queueDeferredOverlayPreview/);
  assert.match(renderer, /OVERLAY_PREVIEW_LOAD_CONCURRENCY = 2/);
  assert.doesNotMatch(renderer, /OVERLAY_BACKGROUND_PREVIEW_LIMIT/);
  assert.match(renderer, /function overlayCardPlaceholder\(item, config = \{\}\)/);
  assert.match(overlayHtml, /runtime\/dependencies\.js/);
  assert.doesNotMatch(overlayHtml, /<script src="vendor\/lottie-player\.js"/);
  assert.match(
    renderer,
    /context:\s*"live",[\s\S]*editable:\s*true,[\s\S]*loading:\s*"eager"/
  );
});

test("les aperçus et sources reprennent la session overlay courante ou précédente", () => {
  assert.match(
    overlayRuntime,
    /function hydrateOverlaySession\(state = \{\}, options = \{\}\)/
  );
  assert.match(overlayRuntime, /runtime\.leaderboards\?\.\[leaderboardKind\]/);
  assert.match(overlayRuntime, /overlayChannels\["session-state"\] = hydrateOverlaySession/);
  assert.match(renderer, /function postOverlayPreviewEvent\(channel, payload\)/);
  assert.match(renderer, /function hydrateOverlayPreviewFrame\(frame\)/);
  assert.match(renderer, /window\.hydrateOverlayPreviewFrame\?\.\(iframe\)/);
  assert.match(
    renderer,
    /hydrateOverlayPreviewFrame\(frame\)[\s\S]*"session-state"[\s\S]*snapshot\?\.state\?\.overlaySession/
  );
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

