"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");

const rendererRoot = path.join(__dirname, "..", "src", "renderer");
const readFeature = (file) => fs.readFileSync(path.join(rendererRoot, "app", "features", file), "utf8");
const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function voiceContext(t, { authenticated = true, ttsVisible = true, uploadsVisible = true, hiddenTypes = [], rules } = {}) {
  const dom = new JSDOM('<main id="content"></main>');
  t.after(() => dom.window.close());
  const state = createDefaultState();
  state.rules = rules || [
    { id: "tts_rule", name: "Voix abonnés", enabled: true, trigger: { type: "chat" }, actions: [{ id: "tts_action", type: "tts.speak", config: { voice: "Hortense", volume: 0.7, outputMode: "live", liveScreen: 2, allowedRoles: ["subscriber", "moderator"], maxCharacters: 240, blockedWords: ["spam"], allowLinks: false, allowCommands: false, allowMentions: true } }] },
    { id: "sound_rule", name: "Bienvenue sonore", enabled: true, trigger: { type: "follow" }, actions: [{ id: "sound_action", type: "audio.play", config: { url: "https://example.invalid/welcome.mp3", soundName: "Bienvenue", volume: 0.4, outputMode: "local" } }] },
    { id: "sound_live", name: "Cadeau sonore", enabled: false, trigger: { type: "gift" }, actions: [{ id: "live_action", type: "audio.play", config: { url: "https://example.invalid/gift.mp3", soundName: "Fanfare", volume: 0.6, outputMode: "live", liveScreen: 4 } }] }
  ];
  const context = vm.createContext({
    document: dom.window.document,
    window: dom.window,
    content: dom.window.document.getElementById("content"),
    snapshot: { state, overlayUrls: { mediaScreens: Array.from({ length: 8 }, (_entry, index) => `https://example.invalid/screen/${index + 1}`) } },
    soundSearch: "",
    SOUND_LIBRARY: [],
    mediaSessionEntries: new Map(),
    copiedMediaScreenUrls: new Set(),
    EVENT_LABELS: { chat: "Chat", gift: "Cadeau", follow: "Follow" },
    canonicalActionType: (type) => type,
    hasAutomaticTrigger: () => true,
    ruleGiftName: () => "Rose",
    ruleGiftValueLabel: () => "1 diamant",
    triggerPill: (rule) => `<span class="trigger-pill">${escape(rule.trigger.type)}</span>`,
    normalizeCatalogSearch: (value) => String(value).normalize("NFD").replace(/\p{M}/gu, "").toLowerCase(),
    navigationIcon: (id) => `<svg data-icon="${escape(id)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12h18"/></svg>`,
    isAccountAuthenticated: () => authenticated,
    canAccessFeature: (id) => id === "tts.voices" ? ttsVisible : id === "backblaze.sounds" ? uploadsVisible : true,
    canAccessActionType: (id) => !hiddenTypes.includes(id),
    escapeHtml: escape,
    emptyInline: (message) => `<p class="empty-inline">${escape(message)}</p>`,
    renderPrivateDataPlaceholder: (title, description) => `<section data-private><h2>${escape(title)}</h2><p>${escape(description)}</p></section>`,
    api: new Proxy({}, { get() { throw new Error("Le rendu ne doit appeler aucun API ni jouer un son."); } }),
    setTimeout() { throw new Error("Aucun nouveau timer audio attendu."); },
    fetch() { throw new Error("Aucune requête audio attendue."); }
  });
  vm.runInContext(fs.readFileSync(path.join(rendererRoot, "app", "core", "automation-table.js"), "utf8"), context, { filename: "automation-table.js" });
  for (const file of ["studio-design.js", "actions.js", "audio.js", "creator-voice.js"]) vm.runInContext(readFeature(file), context, { filename: file });
  context.renderTab = (tab) => {
    vm.runInContext(`creatorVoiceTab = ${JSON.stringify(tab)}`, context);
    context.content.innerHTML = context.renderCreatorVoice();
    return context.content;
  };
  return context;
}

test("l’atelier conserve la bannière locale et trois boutons de navigation accessibles", (t) => {
  const context = voiceContext(t);
  const page = context.renderTab("voice");
  const art = page.querySelector('[data-studio-hero="voice"] img');
  assert.equal(art.getAttribute("src"), "assets/studio/voice.webp");
  assert.ok(fs.existsSync(path.join(rendererRoot, art.getAttribute("src"))));
  const tabs = [...page.querySelectorAll(".voice-tab")];
  assert.deepEqual(tabs.map((tab) => tab.dataset.value), ["voice", "sounds", "outputs"]);
  assert.deepEqual(tabs.map((tab) => tab.querySelector(".voice-tab-count").textContent), ["1", "2", "8"]);
  for (const tab of tabs) {
    assert.equal(tab.type, "button");
    assert.equal(tab.dataset.action, "creator-voice-tab");
    assert.equal(tab.getAttribute("aria-controls"), "creator-voice-panel");
    assert.equal(tab.getAttribute("aria-pressed"), String(tab.dataset.value === "voice"));
    assert.ok(tab.querySelector(".voice-tab-icon svg[aria-hidden=true]"));
    assert.ok(tab.querySelector(".voice-tab-label").textContent);
    assert.equal(tab.querySelector("button"), null);
  }
  assert.ok(page.querySelector("#creator-voice-panel"));
  assert.equal(page.querySelector('[role="tablist"]'), null, "Les boutons utilisent le clavier natif sans ARIA incomplet.");
});

test("les règles TTS gardent toutes leurs commandes et un seul aperçu général", (t) => {
  const context = voiceContext(t);
  const before = JSON.stringify(context.snapshot.state);
  const page = context.renderTab("voice");
  assert.equal(page.querySelectorAll('[data-action="preview-tts"]').length, 1);
  assert.ok(page.querySelector('[data-action="add-tts"]'));
  const card = page.querySelector(".tts-rule-card");
  for (const action of ["test-action", "set-audio-output", "configure-audio-output", "edit-tts", "delete-action"]) {
    const control = card.querySelector(`[data-action="${action}"]`);
    assert.ok(control, action);
    assert.equal(control.dataset.rule, "tts_rule");
    assert.equal(control.dataset.id, "tts_action");
    assert.equal(control.dataset.index, "0");
  }
  assert.equal(card.querySelector('[data-action="toggle-rule"]').dataset.id, "tts_rule");
  assert.equal(card.querySelector('[data-action="toggle-rule"]').checked, true);
  assert.equal(card.querySelector('[data-action="set-audio-output"]').checked, true);
  assert.match(card.textContent, /Hortense.*70 %/s);
  const summary = [...page.querySelectorAll(".voice-summary-card strong")].map((node) => node.textContent);
  assert.deepEqual(summary, ["1 / 1", context.snapshot.state.settings.tts.voice || "Voix Windows", "1"]);
  assert.equal(JSON.stringify(context.snapshot.state), before, "Aucun changement de profil ou réglage pendant le rendu.");
});

test("les politiques TTS sont consultables et modifiables sans dupliquer les éditeurs", (t) => {
  const context = voiceContext(t);
  const page = context.renderTab("voice");
  const policies = page.querySelector("details.voice-policies");
  assert.ok(policies.querySelector("summary"));
  assert.equal(policies.open, false);
  policies.open = true;
  const row = policies.querySelector(".voice-policy-row");
  assert.match(row.textContent, /Abonnés · Modérateurs · 240 caractères maximum · 1 mot\(s\) bloqué\(s\)/);
  assert.deepEqual([...row.querySelectorAll(".voice-policy-flags span")].map((node) => node.textContent), ["Liens filtrés", "Commandes filtrées", "Mentions autorisées"]);
  assert.equal(row.querySelector('[data-action="edit-tts"]').dataset.id, "tts_action");
  assert.equal(row.querySelector('[data-action="edit-tts"]').dataset.rule, "tts_rule");
  assert.equal(row.querySelector('[data-action="edit-tts"]').type, "button");
});

test("les alertes conservent recherche, import, volume, aperçu, édition et sorties", (t) => {
  const context = voiceContext(t);
  const page = context.renderTab("sounds");
  assert.ok(page.querySelector('[data-action="upload-sound"]'));
  assert.ok(page.querySelector('[data-action="add-sound"]'));
  assert.equal(page.querySelectorAll(".audio-rule-card").length, 2);
  const card = page.querySelector(".audio-rule-card");
  for (const action of ["test-action", "set-audio-output", "set-sound-volume", "edit-sound", "delete-action"]) {
    const control = card.querySelector(`[data-action="${action}"]`);
    assert.equal(control.dataset.rule, "sound_rule", action);
    assert.equal(control.dataset.id, "sound_action", action);
    assert.equal(control.dataset.index, "0", action);
  }
  assert.equal(card.querySelector('[data-sound-volume]').value, "0.4");
  assert.equal(card.querySelector('[data-action="set-audio-output"]').checked, false);
  assert.equal(page.querySelectorAll('[data-action="configure-audio-output"]').length, 1);
  const input = page.querySelector('[data-search="sounds"]');
  assert.equal(input.type, "search");
  assert.equal(input.getAttribute("aria-label"), "Rechercher un son");
  context.soundSearch = "fanfare";
  context.renderTab("sounds");
  assert.equal(page.querySelector('[data-search="sounds"]').value, "fanfare");
  assert.equal(page.querySelectorAll(".audio-rule-card").length, 1);
  assert.match(page.querySelector(".audio-rule-card").textContent, /Cadeau sonore/);
  assert.deepEqual([...page.querySelectorAll(".voice-summary-card strong")].map((node) => node.textContent), ["1 / 2", "1", "1"], "Les compteurs restent ceux du profil, pas du filtre.");
});

test("Diffusion LIVE garde huit sources et le comptage audio/media du module commun", (t) => {
  const context = voiceContext(t);
  context.snapshot.state.rules.push({ id: "media_rule", name: "Media", actions: [{ id: "media_action", type: "overlay.media", config: { screen: 2 } }] });
  const page = context.renderTab("outputs");
  assert.equal(page.querySelectorAll(".media-screens-table tbody tr").length, 8);
  assert.equal(page.querySelectorAll('[data-action="copy"][data-media-screen-url="true"]').length, 8);
  assert.equal(page.querySelector(".media-screens-panel").tagName, "SECTION");
  assert.equal(page.querySelector(".audio-panel, .voice-search-toolbar, .voice-policies"), null);
  const rows = [...page.querySelectorAll(".media-screens-table tbody tr")];
  assert.equal(rows[1].querySelector(".media-screen-count").textContent, "2 actions");
  assert.equal(rows[3].querySelector(".media-screen-count").textContent, "1 action");
  assert.equal(rows[0].querySelector('[data-action="copy"]').dataset.value, "https://example.invalid/screen/1");
  assert.match(page.textContent, /deux sources avec la même URL joueraient le son deux fois/);
  for (const tab of ["voice", "sounds"]) {
    context.renderTab(tab);
    assert.equal(page.querySelector(".media-screens-panel").tagName, "DETAILS");
  }
});

test("les accès protégés et fonctionnalités masquées ne réapparaissent pas avec la refonte", (t) => {
  const guest = voiceContext(t, { authenticated: false });
  guest.soundActionRows = () => { throw new Error("Ne pas lire les règles privées en consultation."); };
  assert.ok(guest.renderTab("voice").querySelector("[data-private]"));
  assert.doesNotMatch(guest.content.innerHTML, /example.invalid|Voix abonnés/);
  assert.match(guest.renderCreatorVoiceDetails(), /data-private/);
  const hidden = voiceContext(t, { ttsVisible: false, uploadsVisible: false });
  const page = hidden.renderTab("voice");
  assert.equal(page.querySelector('[data-value="voice"]'), null);
  assert.equal(page.querySelector('[data-value="sounds"]').getAttribute("aria-pressed"), "true");
  assert.equal(page.querySelector('[data-action="upload-sound"]'), null);
  assert.equal(page.querySelector('[data-action="add-tts"]'), null);
  assert.equal(page.querySelectorAll(".audio-rule-card").length, 2);
  const disabledType = voiceContext(t, { hiddenTypes: ["tts.speak"] });
  assert.equal(disabledType.renderTab("voice").querySelector('[data-value="voice"]'), null);
});

test("les noms de profils, voix et règles sont échappés ; aucun son n'est préchargé", (t) => {
  const context = voiceContext(t);
  context.snapshot.state.rules[0].name = 'Musique <script>bad()</script>';
  context.snapshot.state.settings.tts.voice = '<img src=x onerror="bad()">';
  const page = context.renderTab("voice");
  assert.equal(page.querySelector("script, audio, video, .voice-summary-card img"), null);
  assert.equal(page.querySelector(".voice-summary-card [data-studio-user-content]").textContent, '<img src=x onerror="bad()">');
  assert.equal(page.querySelector(".voice-policy-row [data-studio-user-content]").textContent, 'Musique <script>bad()</script>');
  const before = JSON.stringify(context.snapshot.state);
  context.renderTab("sounds");
  context.renderTab("outputs");
  assert.equal(JSON.stringify(context.snapshot.state), before);
});

test("les états vides gardent les boutons de création sans inventer de règles", (t) => {
  const context = voiceContext(t, { rules: [] });
  const page = context.renderTab("voice");
  assert.ok(page.querySelector('[data-action="add-tts"]'));
  assert.equal(page.querySelector(".tts-rule-card, .voice-policies"), null);
  assert.match(page.textContent, /Aucune règle de synthèse vocale/);
  context.renderTab("sounds");
  assert.ok(page.querySelector('[data-action="add-sound"]'));
  assert.equal(page.querySelector(".audio-rule-card"), null);
  assert.match(page.textContent, /Aucune alerte sonore/);
  assert.deepEqual([...page.querySelectorAll(".voice-summary-card strong")].map((node) => node.textContent), ["0 / 0", "0", "0"]);
});

test("les styles audio restent locaux et adaptatifs sans animation ni média lourd", () => {
  const css = fs.readFileSync(path.join(rendererRoot, "styles", "creator-voice.css"), "utf8");
  assert.match(css, /\.creator-voice-page \.audio-rule-card/);
  assert.match(css, /\.audio-rule-card:only-child\s*\{\s*grid-column:1\s*\/\s*-1;/, "Une seule règle occupe toute la largeur sans demi-colonne vide.");
  assert.match(css, /\.creator-voice-page :is\(button,summary,input\):focus-visible/);
  assert.match(css, /@media\(max-width:1150px\)/);
  assert.match(css, /@media\(max-width:780px\)/);
  assert.doesNotMatch(css, /(?:animation|backdrop-filter|@font-face)\s*:/);
  const controlsCss = css.replace(/\.voice-policies > summary::-webkit-details-marker\s*\{[^}]+\}/g, "");
  assert.doesNotMatch(controlsCss, /display\s*:\s*none/, "Seul le marqueur natif remplacé par le chevron peut être masqué.");
  assert.doesNotMatch(readFeature("creator-voice.js"), /api\.|fetch\(|setInterval\(|setTimeout\(|new Audio\(/);
});
