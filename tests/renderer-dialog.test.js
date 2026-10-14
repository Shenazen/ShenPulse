"use strict";
const { readRendererSource, readRendererStyles } = require("./helpers/source-bundles");
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

/** Shell, profils, tableaux de bord et connexions. */

test("les boutons d'annulation ferment le dialogue sans valider le formulaire", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );
  const app = readRendererSource();

  const closeButtons = html.match(
    /<button[^>]+type="button"[^>]+data-dialog-close[^>]*>/g
  );
  assert.equal(closeButtons?.length, 2);
  assert.match(app, /dialog\.close\("cancel"\)/);
});

test("le compte ShenPulse remplace les commandes LIVE avant authentification", () => {
  const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
  const html = fs.readFileSync(
    path.join(rendererDirectory, "index.html"),
    "utf8"
  );
  const app = readRendererSource();
  const styles = readRendererStyles();

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
  const app = readRendererSource();
  const styles = readRendererStyles();
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
  const app = readRendererSource();
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
  const app = readRendererSource();

  assert.match(html, /id="profile-manage-button"/);
  assert.match(app, /function openProfileManager\(\)/);
  assert.match(app, /function openProfileEditor\(profile\)/);
  assert.match(app, /data-profile-action="create"/);
  assert.match(app, /data-profile-action="edit"/);
  assert.match(app, /data-profile-action="delete"/);
  assert.match(app, /api\.remove\("profiles"/);
  const profileActions = app.slice(
    app.indexOf('const target = event.target.closest("[data-profile-action]")'),
    app.indexOf('content.addEventListener("submit"')
  );
  assert.doesNotMatch(
    profileActions,
    /if \(action === "create" \|\| action === "edit"\) \{\s*dialog\.close\(\)/
  );
  assert.match(
    profileActions,
    /if \(action === "create" \|\| action === "edit"\) \{\s*openProfileEditor/
  );
});

test("l'administration conserve son scroll et ignore les rafraîchissements du LIVE", () => {
  const app = readRendererSource();
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
  const styles = readRendererStyles();
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

test("le tableau de bord utilise le bilan du LIVE, jamais les cumuls locaux ni les tests", () => {
  const app = readRendererSource();
  const dashboard = app.slice(
    app.indexOf("function renderDashboard"),
    app.indexOf("function renderLive")
  );

  assert.match(dashboard, /dashboardLiveSummary\(\)/);
  assert.match(dashboard, /ShenPulseLiveStatistics\.liveLikeCount\(live\)/);
  assert.match(dashboard, /live\.currentViewers/);
  assert.doesNotMatch(dashboard, /statistics\.(?:lifetimeEvents|likes|gifts|follows)/);
  assert.doesNotMatch(dashboard, /"total local"/);
  assert.doesNotMatch(dashboard, /"historique local"/);
});

test("la vue d’ensemble rassemble graphique, donateurs, chat et événements sans ancien bloc Studio", () => {
  const app = readRendererSource();
  const dashboard = app.slice(
    app.indexOf("function renderDashboard"),
    app.indexOf("function statCard")
  );
  for (const block of ["chart", "donors", "chat", "events"]) assert.match(dashboard, new RegExp(`data-dashboard-${block}`));
  assert.match(dashboard, /data-dashboard-chart-tab="viewers"/);
  assert.match(dashboard, /data-dashboard-chart-tab="engagement"/);
  assert.doesNotMatch(dashboard, /data-navigate="studio"/);
  assert.doesNotMatch(dashboard, /État des connexions/);
  assert.match(app, /function connectionDashboardPurpose/);
  assert.match(app, /Reçoit les interactions du LIVE TikTok/);
  assert.match(app, /Sert uniquement aux tests manuels/);
  assert.match(app, /function connectionStatusLabel/);
});

test("la page Connexions explique chaque source et le mode Démo manuel", () => {
  const app = readRendererSource();
  const connections = app.slice(
    app.indexOf("function renderConnections"),
    app.indexOf("function renderActivity")
  );

  assert.match(connections, /TikTok LIVE direct/);
  assert.match(connections, /WebSocket ou relais/);
  assert.match(connections, /Twitch IRC/);
  assert.match(connections, /Démo manuelle/);
  assert.match(connections, /Désactivée par défaut/);
  assert.match(connections, /ne crée aucun viewer/);
  assert.match(connections, /AUTO[\s\S]*MANUEL[\s\S]*Déconnecter/);
  assert.match(connections, /connectionTypeDescription/);
  assert.doesNotMatch(connections, /data-action="add-connection"/);
  assert.doesNotMatch(connections, /data-action="edit-connection"/);
});

test("les pictogrammes et cadeaux ne sont plus enfermés dans un carré coloré", () => {
  const styles = readRendererStyles();
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
  const app = readRendererSource();
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
