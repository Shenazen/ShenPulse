"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const rendererRoot = path.join(__dirname, "..", "src", "renderer", "app");
const source = (file) => fs.readFileSync(path.join(rendererRoot, file), "utf8");

function fixture(t, authenticated = true, count = 2) {
  const dom = new JSDOM('<main id="content"><section class="home-hero"><img><input value="draft"></section><div id="live-slot"></div></main>', { pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const state = createDefaultState();
  const calls = [];
  const directory = {
    available: true, connected: true, enabled: false, publishing: false, capped: false,
    rows: Array.from({ length: count }, (_, index) => ({
      id: `public_${index}`, platform: index % 2 ? "Kick" : "TikTok", username: `creator_${index}`,
      avatarUrl: `https://example.test/host-${index}.png`, viewers: index === 0 ? null : index * 10,
      updatedAt: 123456, own: index === 0
    }))
  };
  const context = vm.createContext({
    document: dom.window.document, window: dom.window, URL, Intl, NodeFilter: dom.window.NodeFilter,
    content: dom.window.document.getElementById("content"), snapshot: { state, liveDirectory: directory },
    authenticated, isAccountAuthenticated: () => context.authenticated,
    canNavigateTo: () => true, studioLocale: () => state.settings.locale,
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    applyStudioLanguage: () => {}, syncStudioPreferences: () => {},
    api: { openExternal: async (url) => calls.push(url) },
    setTimeout() { throw new Error("No renderer polling timer is permitted."); },
    setInterval() { throw new Error("No renderer polling timer is permitted."); }
  });
  vm.runInContext(source("features/creator-home-live.js"), context);
  function mount() {
    context.content.querySelector("#live-slot").innerHTML = context.renderCreatorHomeLive();
    context.syncCreatorHomeLive();
    return context.content.querySelector("[data-home-live]");
  }
  return { context, state, directory, calls, mount };
}

function privateSource(state) {
  state.connections = [{ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected", liveStatus: "live", config: { username: "private_creator" } }];
  Object.assign(state.settings.tiktok, {
    status: "live", username: "private_creator", currentViewers: 917,
    broadcaster: { username: "private_creator", avatarUrl: "https://example.test/private-photo.png" }
  });
  state.settings.account.idToken = "never-public-token";
  state.settings.account.email = "never-public@example.test";
}

test("l’accueil rend uniquement l’annuaire public avec point rouge, cartes LIVE, photos, plateforme et audience", (t) => {
  const { state, calls, mount } = fixture(t);
  privateSource(state);
  const section = mount();
  assert.match(section.textContent, /En direct avec ShenPulse/);
  assert.equal(section.querySelector(".home-live-scope"), null);
  assert.equal(section.querySelectorAll(".home-live-card").length, 2);
  assert.equal(section.querySelector(".home-live-count strong").textContent, "2");
  assert.equal(section.querySelector(".home-live-count > span").textContent, "en direct");
  assert.ok(section.querySelector("h3 > .home-live-heading-dot"));
  assert.equal(section.querySelectorAll(".home-live-badge, .home-live-avatar-dot, .home-live-viewers svg").length, 6);
  assert.equal(section.querySelector('[data-home-live-source="public_0"] .home-live-platform-label').textContent, "En direct sur TikTok");
  assert.equal(section.querySelector('[data-home-live-source="public_1"] .home-live-platform-label').textContent, "En direct sur Kick");
  assert.equal(section.querySelector('[data-home-live-source="public_1"] img').getAttribute("src"), "https://example.test/host-1.png");
  assert.equal(section.querySelector('[data-home-live-source="public_1"] .home-live-viewers strong').textContent, "10");
  assert.equal(section.querySelector('[data-home-live-source="public_0"] .home-live-viewers strong').textContent, "—");
  assert.equal(section.querySelector('[data-home-live-source="public_0"] button').dataset.navigate, "dashboard");
  assert.equal(section.querySelector('[data-home-live-source="public_1"] button').dataset.homeLiveProfile, "https://kick.com/creator_1");
  assert.doesNotMatch(section.outerHTML, /private_creator|private-photo|never-public|917|Sur cet appareil|#1/);
  assert.deepEqual(calls, [], "Rendering never publishes anything or opens a browser.");
});

test("un invité voit les LIVE publics mais jamais ses données locales ni un lien vers le tableau de bord", async (t) => {
  const { context, state, calls, mount } = fixture(t, false);
  privateSource(state);
  const section = mount();
  assert.equal(section.querySelectorAll(".home-live-card").length, 2);
  assert.equal(section.querySelector('[data-navigate="dashboard"]'), null);
  assert.doesNotMatch(section.outerHTML, /private_creator|private-photo|never-public|917/);
  section.querySelector('[data-home-live-source="public_0"] button').click();
  await Promise.resolve();
  assert.deepEqual(calls, ["https://www.tiktok.com/@creator_0/live"]);
  assert.equal(context.creatorHomeLocalLives().length, 0);
});

test("un annuaire absent ou hors ligne n’invente aucune présence globale à partir d’un LIVE local", (t) => {
  const { context, state, mount } = fixture(t);
  privateSource(state);
  delete context.snapshot.liveDirectory;
  const section = mount();
  assert.match(section.textContent, /Annuaire indisponible/);
  assert.equal(section.querySelector(".home-live-count strong").textContent, "—");
  assert.equal(section.querySelectorAll(".home-live-card").length, 0);
  assert.doesNotMatch(section.outerHTML, /private_creator|private-photo|never-public|917/);
  context.snapshot.liveDirectory = { available: true, connected: false, rows: [] };
  context.syncCreatorHomeLive();
  assert.match(section.textContent, /Reconnexion à l’annuaire/);
  context.snapshot.liveDirectory.connected = true;
  context.syncCreatorHomeLive();
  assert.equal(section.querySelector(".home-live-count strong").textContent, "0");
  assert.match(section.textContent, /Aucun créateur en direct/);
});

test("cent updates de viewers préservent cartes, avatars, boutons, hero, brouillon et focus, y compris zéro mesuré", (t) => {
  const { context, directory, mount } = fixture(t);
  const section = mount();
  const hero = context.content.querySelector(".home-hero");
  const artwork = hero.querySelector("img");
  const draft = hero.querySelector("input");
  const card = section.querySelector('[data-home-live-source="public_0"]');
  const avatar = card.querySelector("img");
  const button = card.querySelector("button");
  draft.value = "keep my work";
  button.focus();
  for (let index = 0; index < 100; index += 1) {
    directory.rows[0].viewers = index;
    directory.rows[0].updatedAt += 1;
    context.syncCreatorHomeLive();
    assert.equal(section.querySelector('[data-home-live-source="public_0"]'), card);
    assert.equal(card.querySelector("img"), avatar);
    assert.equal(card.querySelector("button"), button);
    assert.equal(context.document.activeElement, button);
  }
  assert.equal(context.content.querySelector(".home-hero"), hero);
  assert.equal(hero.querySelector("img"), artwork);
  assert.equal(draft.value, "keep my work");
  assert.equal(card.querySelector(".home-live-viewers strong").textContent, "99");
  directory.rows[0].viewers = 0;
  context.syncCreatorHomeLive();
  assert.equal(card.querySelector(".home-live-viewers strong").textContent, "0");
  avatar.dispatchEvent(new context.window.Event("error"));
  assert.equal(card.querySelector("img"), null);
  directory.rows[0].viewers = 2;
  context.syncCreatorHomeLive();
  assert.equal(card.querySelector("img"), null);
  directory.rows = [];
  context.syncCreatorHomeLive();
  assert.equal(section.querySelector(".home-live-card"), null);
});

test("trois cartes par page, compte 100+ si borné, et page recalée après le départ de créateurs", (t) => {
  const { context, directory, mount } = fixture(t, true, 100);
  directory.capped = true;
  const section = mount();
  assert.equal(section.querySelector(".home-live-count strong").textContent, "100+");
  assert.equal(section.querySelectorAll(".home-live-card").length, 3);
  assert.equal(section.querySelector('[data-home-live-page="previous"]').disabled, true);
  section.querySelector('[data-home-live-page="next"]').click();
  assert.equal(section.querySelector(".home-live-card").dataset.homeLiveSource, "public_3");
  assert.equal(section.querySelector(".home-live-pagination span").textContent, "2/34");
  directory.rows = directory.rows.slice(0, 2);
  directory.capped = false;
  context.syncCreatorHomeLive();
  assert.equal(section.querySelector(".home-live-pagination"), null);
  assert.equal(section.querySelectorAll(".home-live-card").length, 2);
  assert.equal(section.querySelector(".home-live-card").dataset.homeLiveSource, "public_0");
});

test("un feed supérieur à cent LIVE indique la borne même si le backend n’a pas fourni capped", (t) => {
  const { context, mount } = fixture(t, true, 101);
  const section = mount();
  assert.equal(context.creatorHomeLiveModel().rows.length, 100);
  assert.equal(section.querySelector(".home-live-count strong").textContent, "100+");
  assert.equal(section.querySelectorAll(".home-live-card").length, 3);
});

test("avatars et noms sont sécurisés, liens limités aux plateformes et attribut URL DOM modifié ignoré", async (t) => {
  const { context, directory, calls, mount } = fixture(t, false);
  directory.rows[0].avatarUrl = "javascript:alert('private')";
  directory.rows[0].username = '<img src=x onerror=alert(1)>';
  directory.rows[0].viewers = "12";
  directory.rows.push({ id: "bad", username: "bad", platform: "Untrusted" });
  const section = mount();
  const card = section.querySelector('[data-home-live-source="public_0"]');
  assert.equal(card.querySelector("img"), null);
  assert.equal(card.querySelector("button"), null);
  assert.equal(section.querySelector("[onerror]"), null);
  assert.equal(card.querySelector(".home-live-viewers strong").textContent, "—");
  assert.match(card.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(section.querySelectorAll(".home-live-card").length, 2);
  const profile = section.querySelector('[data-home-live-source="public_1"] button');
  profile.dataset.homeLiveProfile = "https://attacker.example.test/";
  profile.click();
  await Promise.resolve();
  assert.deepEqual(calls, ["https://kick.com/creator_1"]);
  assert.equal(context.creatorHomeLiveProfileUrl({ platform: "Kick", username: "../../secret" }), "");
});

test("l’annuaire est traduit FR↔EN sans changer les @ et les compteurs", (t) => {
  const { context, state, directory, mount } = fixture(t);
  directory.rows[0].username = "Musique";
  vm.runInContext(source("features/studio-language.js"), context);
  const section = mount();
  state.settings.locale = "en-US";
  context.syncCreatorHomeLive();
  assert.equal(section.querySelector("h3").textContent, "Live with ShenPulse");
  assert.equal(section.querySelector(".home-live-platform-label").textContent, "Live on TikTok");
  assert.equal(section.querySelector(".home-live-count > span").textContent, "live");
  assert.equal(section.querySelector(".home-live-viewers").title, "Viewer count unavailable");
  assert.equal(section.querySelector(".home-live-card-identity strong").textContent, "@Musique");
  directory.rows[0].viewers = 0;
  context.syncCreatorHomeLive();
  assert.equal(section.querySelector(".home-live-viewers strong").textContent, "0");
  assert.equal(section.querySelector(".home-live-viewers").title, "current viewers");
  state.settings.locale = "fr-FR";
  context.syncCreatorHomeLive();
  assert.equal(section.querySelector("h3").textContent, "En direct avec ShenPulse");
});

test("le helper local conserve la validation du diffuseur sans jamais publier ni servir de fallback", (t) => {
  const { context, state, calls } = fixture(t);
  privateSource(state);
  assert.equal(context.creatorHomeLocalLives()[0].avatarUrl, "https://example.test/private-photo.png");
  assert.equal(context.creatorHomeLocalLives()[0].viewers, 917);
  state.settings.tiktok.broadcaster.username = "other_creator";
  assert.equal(context.creatorHomeLocalLives()[0].avatarUrl, "");
  state.settings.tiktok.status = "offline";
  assert.equal(context.creatorHomeLocalLives().length, 0);
  assert.deepEqual(calls, []);
});
