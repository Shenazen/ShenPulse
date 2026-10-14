"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const rendererRoot = path.join(__dirname, "..", "src", "renderer", "app");
const protectedUrl = "https://shenpulse-overlays.web.app/m/123456789012/abcdefghijklmnopqrstuvwx";
const item = { key: "matchX2", name: "Match x2", description: "Effet x2", icon: "×2",
  category: "matches", previewKind: "match", requiresPro: true, sourceSize: [1080, 1920] };

/** Exerce les vraies cartes et le générateur sécurisé, sans IPC ni lecture vidéo. */
function harness(t, { authenticated = true, pro = true, url = protectedUrl } = {}) {
  const dom = new JSDOM('<main id="content"></main><div id="dialog"></div>');
  t.after(() => dom.window.close());
  const context = vm.createContext({
    URL, document: dom.window.document,
    content: dom.window.document.getElementById("content"),
    dialogBody: dom.window.document.getElementById("dialog"),
    snapshot: { overlayUrls: { matchPlayer: url }, state: {
      session: { profileId: "p1" }, profiles: [{ id: "p1", name: "Mon profil" }]
    } },
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    isAccountAuthenticated: () => authenticated,
    hasProAccess: () => pro,
    overlayUnlocked: () => pro,
    overlayConfig: () => ({}),
    overlayDefinitions: () => [item],
    overlayUrl: () => "http://127.0.0.1/video/non-protegee.webm",
    overlayRuntimeFrame: () => "<span>Aperçu</span>",
    overlayCardPlaceholder: () => "",
    api: new Proxy({}, { get() { throw new Error("Aucun export ou appel API au rendu."); } })
  });
  for (const file of ["features/overlays/cards.js", "features/matches/widgets.js"]) {
    vm.runInContext(fs.readFileSync(path.join(rendererRoot, file), "utf8"), context, { filename: file });
  }
  context.draw = () => {
    context.content.innerHTML = context.renderOverlayCard(item);
    return context.content;
  };
  return context;
}

test("les cartes Match copient uniquement la source HTTPS Studio commune, jamais une vidéo", (t) => {
  const context = harness(t);
  const before = JSON.stringify(context.snapshot);
  const page = context.draw();
  const copied = page.querySelector('.url-field [data-action="copy"]');
  const opened = page.querySelector('[data-action="open-url"]');
  assert.equal(copied.dataset.value, `${protectedUrl}?transport=local`);
  assert.equal(copied.disabled, false);
  assert.equal(opened.dataset.value, copied.dataset.value);
  assert.equal(opened.disabled, false);
  assert.match(copied.textContent, /Copier pour TikTok Studio/);
  assert.doesNotMatch(page.innerHTML, /127\.0\.0\.1|\.webm|prepare-match-video|copy-match-video-path/);
  assert.equal(JSON.stringify(context.snapshot), before);
});

test("les cartes Match n'exposent aucune source aux visiteurs ou sans Pro", (t) => {
  for (const access of [{ authenticated: false }, { pro: false }]) {
    const page = harness(t, access).draw();
    assert.equal(page.querySelector(".overlay-card-footer"), null);
    assert.doesNotMatch(page.innerHTML, /abcdefghijklmnopqrstuvwx|\.webm/);
  }
});

test("une source Match absente ou invalide ne retombe jamais sur un chemin vidéo", (t) => {
  for (const url of ["", "http://127.0.0.1/video/x2.webm", `${protectedUrl}?token=secret`]) {
    const context = harness(t, { url });
    const page = context.draw();
    const copied = page.querySelector('.url-field [data-action="copy"]');
    assert.equal(copied.dataset.value, "");
    assert.equal(copied.disabled, true);
    assert.equal(page.querySelector('[data-action="open-url"]').disabled, true);
    assert.doesNotMatch(page.innerHTML, /127\.0\.0\.1|\.webm|secret/);
  }
});

test("une carte chargée sans le générateur commun ne fournit aucun lien de secours", (t) => {
  const context = harness(t);
  context.creatorMatchesStudioSourceUrl = undefined;
  const page = context.draw();
  const copied = page.querySelector('.url-field [data-action="copy"]');
  assert.equal(copied.dataset.value, "");
  assert.equal(copied.disabled, true);
  assert.doesNotMatch(page.innerHTML, /127\.0\.0\.1|\.webm|abcdefghijklmnopqrstuvwx/);
});

test("la perte de la source invalide aussi les boutons déjà rendus", (t) => {
  const context = harness(t);
  const page = context.draw();
  context.snapshot.overlayUrls.matchPlayer = "";
  context.updateOverlayCardConfigUi(item.key, {});
  for (const button of page.querySelectorAll('.url-field [data-action="copy"], [data-action="open-url"]')) {
    assert.equal(button.dataset.value, "");
    assert.equal(button.disabled, true);
  }
  assert.doesNotMatch(page.innerHTML, /abcdefghijklmnopqrstuvwx|\.webm/);
});

test("le routeur n'exécute plus les anciennes commandes d'export vidéo", async () => {
  const notHandled = Symbol("action inconnue");
  const context = vm.createContext({
    ACTION_NOT_HANDLED: notHandled,
    registerActionHandler(actions) {
      assert.equal(actions.has("prepare-match-video"), false);
      assert.equal(actions.has("copy-match-video-path"), false);
    },
    api: new Proxy({}, { get() { throw new Error("L'ancien export ne doit jamais appeler l'IPC."); } })
  });
  const filename = path.join(rendererRoot, "actions", "handlers", "entities-games.js");
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  for (const action of ["prepare-match-video", "copy-match-video-path"]) {
    assert.equal(await context.handleEntityAndGameRuntimeAction({ action, id: item.key }), notHandled);
  }
});
