"use strict";

/** Le stockage est mutualisé, jamais la bibliothèque privée d'un compte.
 * Aucun réseau, fichier utilisateur ou son réel n'est utilisé par ces tests.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const visibilityTools = require("../src/shared/visibility-catalog");
const { createDefaultState } = require("../src/main/defaults");

const renderer = path.join(__dirname, "..", "src", "renderer", "app");
const read = (file) => fs.readFileSync(path.join(renderer, file), "utf8");
const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

function contextFor(t, { authenticated = true, admin = false, tier = "free" } = {}) {
  const dom = new JSDOM('<main><div data-media-picker-root><input name="url" data-media-value><input name="urlName" data-media-name><div data-media-selection></div></div><button id="upload"></button></main>');
  t.after(() => dom.window.close());
  const state = createDefaultState();
  state.commerce.subscription.tier = tier;
  const context = vm.createContext({
    window: dom.window, document: dom.window.document, visibilityTools, escapeHtml,
    accountSession: { authenticated, email: admin ? "owner@example.invalid" : "viewer@example.invalid", uid: "fixture-account" },
    ADMIN_OWNER_EMAIL: "owner@example.invalid",
    hasProAccess: () => tier !== "free", adminSession: { authorized: admin, email: "owner@example.invalid", uid: "fixture-account" },
    siteVisibility: { schemaVersion: 9, features: { "backblaze:sounds": "admin", "backblaze:media": "hidden", "tts:voices": "hidden" } },
    snapshot: { state }, checkRow: () => "", ttsVoiceField: () => "",
    toast: (...args) => context.toasts.push(args), toasts: [],
    mediaLibraryContext: { kind: "visual", root: dom.window.document.querySelector("[data-media-picker-root]") },
    mediaLibraryUploadButton: dom.window.document.getElementById("upload"),
    mediaLibrarySearchInput: { value: "" }, mediaLibraryDialog: { close: (value) => { context.closedWith = value; } },
    mediaSessionEntries: new Map(), mediaLibrarySelected: null, mediaLibrarySource: "custom", mediaLibraryKind: "all",
    api: { uploadCustomMedia: async () => { throw new Error("L'API doit être remplacée explicitement."); } },
    acceptSnapshot: (value) => { context.acceptedSnapshot = value; }
  });
  vm.runInContext(read("core/access-navigation.js"), context);
  vm.runInContext(read("features/auxiliary-pages.js"), context);
  vm.runInContext(read("features/media/library.js"), context);
  return context;
}

test("les imports sont accessibles aux comptes Free, Pro et administrateur malgré un ancien cache restreint", (t) => {
  for (const options of [{ tier: "free" }, { tier: "pro" }, { tier: "premium" }, { admin: true }]) {
    const context = contextFor(t, options);
    for (const id of visibilityTools.SHARED_MEDIA_FEATURES) assert.equal(context.canAccessFeature(id), true);
    assert.equal(context.canAccessFeature("tts.voices"), false, "les autres interdictions ne changent pas");
  }
});

test("un visiteur ne peut pas importer ni lire une configuration privée de stockage", async (t) => {
  const context = contextFor(t, { authenticated: false });
  for (const id of visibilityTools.SHARED_MEDIA_FEATURES) assert.equal(context.canAccessFeature(id), false);
  await context.uploadMediaFromLibrary();
  assert.match(context.toasts.at(-1)[1], /Connectez-vous/);
  assert.doesNotMatch(context.renderSettings(), /backblazeKeyId|backblazeApplicationKey|settings-form/);
});

test("les réglages normaux ne demandent aucune clé locale, même sur un poste neuf", (t) => {
  const context = contextFor(t);
  assert.equal(context.snapshot.state.settings.backblaze.keyIdSecretId, "");
  const html = context.renderSettings();
  assert.match(html, /GÉRÉ PAR SHENPULSE/);
  assert.match(html, /Disponible pour tous les comptes connectés/);
  assert.doesNotMatch(html, /À CONFIGURER|backblazeKeyId|backblazeApplicationKey|backblazeBucket|backblazeEndpoint/);
  const settingsSubmit = read("core/events/dialog-content.js").split('if (event.target.id !== "settings-form")')[1];
  assert.doesNotMatch(settingsSubmit, /backblaze(?:KeyId|ApplicationKey|Bucket|Endpoint|:)/, "la sauvegarde normale ne doit pas écraser l'ancienne configuration locale");
});

test("la bibliothèque sélectionne l'import partagé avec son URL et son type GIF intacts", async (t) => {
  const context = contextFor(t);
  const media = { id: "custom:fixture", url: "https://media.example.invalid/user/spark.gif", name: "Étincelle", kind: "gif", source: "custom" };
  let calls = 0;
  context.api.uploadCustomMedia = async (kind) => { calls += 1; assert.equal(kind, "visual"); return { media, snapshot: { imported: true } }; };
  await context.uploadMediaFromLibrary();
  assert.equal(calls, 1);
  assert.equal(context.mediaSessionEntries.get(media.url), media);
  assert.equal(context.document.querySelector("[data-media-value]").value, media.url);
  assert.equal(context.closedWith, "selected");
  assert.equal(context.acceptedSnapshot.imported, true);
  assert.equal(context.mediaLibraryUploadButton.disabled, false);
  assert.match(context.mediaLibraryUploadButton.textContent, /hébergement géré par ShenPulse/);
  assert.match(context.toasts.at(-1)[1], /Enregistrez l’action/);
});

test("les sélecteurs et l'application en masse conservent le stockage public fixe", () => {
  assert.match(read("features/admin/page.js"), /item\.fixedScope \? "disabled title=/);
  assert.match(read("features/admin/account.js"), /catalogItem\.fixedScope\) scope = catalogItem\.fixedScope/);
  assert.match(read("features/admin/account.js"), /item\?\.fixedScope \|\| scope/);
  assert.doesNotMatch(read("features/media/library.js"), /stockage personnel Backblaze|espace Backblaze|imports personnels Backblaze/);
});
