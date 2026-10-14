"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { JSDOM, requestInterceptor, VirtualConsole } = require("jsdom");
const { version } = require("../package.json");
const { createDefaultState } = require("../src/main/defaults");
const { normalizeChatbotCommand } = require("../src/shared/chatbot-command");

const copy = (value) => JSON.parse(JSON.stringify(value));
const fixtureCommands = () => [
  { id: "bonjour", command: "!bonjour", execution: { type: "music", operation: "play" }, response: "Historique conservé", enabled: true, cooldownMs: 30000 },
  { id: "old-reply", command: "!ancien", response: "Texte de réponse ancien", enabled: true },
  { id: "automatic", kind: "auto-reply", name: "Bienvenue", keywords: ["salut", "bonjour"], matchText: "salut", matchMode: "contains", response: "Bienvenue !", enabled: true, cooldownMs: 30000 },
  { id: "reminder", kind: "timer", name: "Rappel", intervalMs: 300000, response: "Merci de votre présence !", enabled: true }
];

async function until(predicate, message) {
  const deadline = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** Index et scripts réels ; uniquement des doubles locaux et des frames manuelles. */
async function rendererFixture(t, { commands = fixtureCommands(), hidden = false, rules } = {}) {
  const file = path.join(__dirname, "../src/renderer/index.html");
  const state = createDefaultState();
  const account = { authenticated: true, email: "chatbot@example.test", uid: "chatbot-user", displayName: "ChatBot Test", emailVerified: true };
  Object.assign(state.settings.account, account);
  state.commerce.subscription = { tier: "pro", status: "active", source: "own" };
  state.commands = commands;
  if (rules) {
    state.rules = rules;
    state.profiles.find((entry) => entry.id === state.session.profileId).enabledRuleIds = rules.map((entry) => entry.id);
  }
  state.connections = [{ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected", liveStatus: "live", currentViewers: 1, config: { username: "stub_creator" } }];
  state.settings.siteVisibility = { ...state.settings.siteVisibility, schemaVersion: 8,
    navigation: { ...state.settings.siteVisibility?.navigation, ...(hidden ? { commands: { scope: "hidden" } } : {}) } };
  const snapshot = { state, appVersion: version, packs: [], soundCatalog: [], mediaCatalog: [], catalogCounts: {},
    timerRuntime: [], overlayUrls: {}, localOverlayUrls: {}, publicOverlayRelay: {}, liveDirectory: { available: false, rows: [] } };
  const handlers = new Map();
  const errors = [];
  const requests = { snapshots: 0, upserts: [], removes: [], operations: [], network: [] };
  const frames = new Map();
  const timers = new Map();
  let nextHandle = 0;
  let documentVisibility = "visible";
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error));
  const dom = new JSDOM(fs.readFileSync(file, "utf8"), {
    url: pathToFileURL(file).toString(), runScripts: "dangerously", resources: { interceptors: [requestInterceptor((request) => {
      if (request.url.startsWith("file:")) return undefined;
      requests.network.push(request.url);
      return new Response("", { status: 200 });
    })] },
    pretendToBeVisual: true, virtualConsole: console,
    beforeParse(window) {
      Object.defineProperty(window.document, "visibilityState", { get: () => documentVisibility });
      Object.defineProperty(window, "localStorage", { value: { getItem: () => null, setItem() {}, removeItem() {} } });
      window.requestAnimationFrame = (callback) => { const handle = ++nextHandle; frames.set(handle, callback); return handle; };
      window.cancelAnimationFrame = (handle) => frames.delete(handle);
      window.setTimeout = (callback, delay = 0, ...args) => { const handle = ++nextHandle; timers.set(handle, { callback, delay, args }); return handle; };
      window.clearTimeout = (handle) => timers.delete(handle);
      window.setInterval = (callback, delay, ...args) => { const handle = ++nextHandle; timers.set(handle, { callback, delay, args, interval: true }); return handle; };
      window.clearInterval = (handle) => timers.delete(handle);
      window.fetch = async (...args) => { requests.network.push(args); throw new Error("Aucun réseau réel autorisé dans cette fixture."); };
      const operation = (name) => async (...args) => { requests.operations.push({ name, args: copy(args) }); throw new Error(`Opération LIVE/audio inattendue : ${name}`); };
      window.shenPulse = {
        ...Object.fromEntries(["startSession", "stopSession", "simulateEvent", "testEvent", "testAction", "previewAction", "testRule", "startConnection", "startTikTok", "startGameSession", "stopGameSession", "triggerEffect", "controlSpotify"].map((name) => [name, operation(name)])),
        getSnapshot: async () => { requests.snapshots += 1; return copy(snapshot); },
        upsert: async (collection, incoming) => {
          assert.equal(collection, "commands");
          const entity = normalizeChatbotCommand(copy(incoming), { commands: state.commands.filter((entry) => (entry.kind || "command") === "command" && entry.execution) });
          requests.upserts.push({ collection, entity: copy(entity) });
          state.commands = state.commands.filter((entry) => entry.id !== entity.id).concat(entity);
          return copy(state);
        },
        remove: async (collection, id) => {
          requests.removes.push({ collection, id });
          state.commands = state.commands.filter((entry) => entry.id !== id);
          return copy(state);
        },
        searchGifts: async () => ({ gifts: [], total: 0 }), getGameRuntimeStatus: async () => null,
        updates: { check: async () => ({ available: false }) },
        account: { status: async () => copy(account), gameCheatAccess: async () => ({ allowed: false }), syncEntitlements: async () => null },
        admin: { status: async () => ({ authorized: false }), visibility: async () => copy(state.settings.siteVisibility) },
        on: (name, handler) => { handlers.set(name, handler); return () => handlers.delete(name); }
      };
      window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {}, fillRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} });
      window.HTMLMediaElement.prototype.play = operation("media.play");
      window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
      window.HTMLDialogElement.prototype.close = function (value = "") { this.returnValue = value; this.removeAttribute("open"); this.dispatchEvent(new window.Event("close")); };
      window.addEventListener("error", (event) => errors.push(event.error || new Error(event.message)));
      window.addEventListener("unhandledrejection", (event) => errors.push(event.reason || new Error("Promesse rejetée")));
    }
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const flushFrames = () => {
    for (let count = 0; frames.size; count += 1) {
      assert.ok(count < 30, "Le renderer ne doit pas s’auto-planifier sans événement.");
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(0));
    }
  };
  await until(() => requests.snapshots >= 2 && window.document.querySelector(".creator-home-page") && handlers.has("renderer-visibility"), "Le renderer ChatBot ne termine pas son démarrage.");
  await new Promise((resolve) => setTimeout(resolve, 10));
  flushFrames();
  assert.equal(errors.length, 0, errors.map((error) => error.stack || error.message).join("\n"));
  window.eval(`window.chatbotIntegrationCalls = { render: 0, chrome: 0, comparison: 0, journal: 0 };
    const chatbotOriginalRender = render, chatbotOriginalChrome = syncChrome,
      chatbotOriginalComparison = creatorPageDataChanged, chatbotOriginalJournal = syncCreatorChatbotActivity;
    render = (...args) => { window.chatbotIntegrationCalls.render += 1; return chatbotOriginalRender(...args); };
    syncChrome = (...args) => { window.chatbotIntegrationCalls.chrome += 1; return chatbotOriginalChrome(...args); };
    creatorPageDataChanged = (...args) => { window.chatbotIntegrationCalls.comparison += 1; return chatbotOriginalComparison(...args); };
    syncCreatorChatbotActivity = (...args) => { window.chatbotIntegrationCalls.journal += 1; return chatbotOriginalJournal(...args); };`);
  const resetCalls = () => Object.keys(window.chatbotIntegrationCalls).forEach((key) => { window.chatbotIntegrationCalls[key] = 0; });
  const openChatbot = async () => {
    window.document.querySelector('#navigation [data-navigate="commands"]').click();
    await until(() => window.document.querySelector(".creator-chatbot-page"), "Le menu ChatBot ne rend pas la route historique commands.");
    flushFrames();
    return window.document.querySelector(".creator-chatbot-page");
  };
  const setVisibility = (native, documentState = native ? "visible" : "hidden") => {
    documentVisibility = documentState;
    window.document.dispatchEvent(new window.Event("visibilitychange"));
    handlers.get("renderer-visibility")({ visible: native });
  };
  return { window, state, snapshot, requests, errors, handlers, frames, timers, flushFrames, resetCalls, openChatbot, setVisibility };
}

function assertSafeFixture(fixture) {
  assert.deepEqual(fixture.requests.operations, [], "Ni aperçu ChatBot ni navigation ne déclenchent un LIVE, une action ou de l’audio.");
  assert.deepEqual(fixture.requests.network, [], "Aucun réseau externe n’est nécessaire pour ces tests.");
  assert.equal(fixture.errors.length, 0, fixture.errors.map((error) => error.stack || error.message).join("\n"));
}


test("l’index réel expose uniquement Commandes après Interactions IRL, sans options de réponse ou de timer", async (t) => {
  const fixture = await rendererFixture(t);
  const { window, state } = fixture;
  const before = JSON.stringify(state.commands);
  const document = window.document;
  for (const script of ["../shared/command-execution.js", "../shared/chatbot-command.js", "app/features/chatbot/execution.js", "app/features/creator-chatbot.js", "app/features/chatbot/editor.js", "app/actions/handlers/creator-chatbot.js"]) assert.equal(document.querySelectorAll(`script[src="${script}"]`).length, 1, script);
  const navItems = [...document.querySelectorAll("#navigation [data-navigate]")];
  const index = navItems.findIndex((entry) => entry.dataset.navigate === "commands");
  assert.ok(index > 0);
  // IRL est réservé aux administrateurs ; son absence pour cette fixture ne
  // doit pas élargir les droits. L'ordre source reste IRL puis Commandes.
  assert.equal(window.eval('pages[pages.findIndex((entry) => entry.id === "commands") - 1].id'), "irl");
  const item = navItems[index];
  assert.match(item.textContent, /Commandes/);
  assert.ok(item.querySelector("svg"));
  const page = await fixture.openChatbot();
  assert.ok(page.querySelector('[data-studio-hero=chatbot] img[src="assets/studio/chatbot.webp"]'));
  assert.equal(item.classList.contains("active"), true);
  assert.equal(document.getElementById("content").getAttribute("aria-label"), "Commandes");
  assert.equal(page.querySelectorAll(".chatbot-entry").length, 1);
  assert.equal(page.querySelector(".chatbot-tab"), null);
  assert.equal(page.querySelector(".chatbot-delivery"), null);
  assert.doesNotMatch(page.textContent, /Auto-réponses|Messages programmés|ancien fonctionnement|Texte de réponse ancien/iu);
  page.querySelector(".chatbot-hero-action").click();
  await until(() => document.querySelector('#editor-dialog[open] [data-chatbot-editor="command"]'), "L'éditeur de commandes manque.");
  fixture.flushFrames();
  const form = document.getElementById("editor-form");
  assert.deepEqual([...form.elements.namedItem("executionType").options].map((entry) => entry.value), ["music", "action", "overlay"]);
  for (const name of ["response", "messages", "keywords", "intervalSeconds"]) assert.equal(form.elements.namedItem(name), null);
  assert.equal(JSON.stringify(state.commands), before);
  assert.deepEqual(fixture.requests.upserts, []);
  assertSafeFixture(fixture);
});

test("les anciens noms ne bloquent pas la création, et les entrées conservées sont inaccessibles depuis les handlers UI", async (t) => {
  const legacy = { id: "old", command: "!skip", aliases: ["!s"], response: "Texte de réponse ancien", enabled: true };
  const fixture = await rendererFixture(t, { commands: [legacy] });
  const { window, requests } = fixture;
  const document = window.document;
  const page = await fixture.openChatbot();
  assert.equal(page.querySelector(".chatbot-entry"), null);
  assert.ok(page.querySelector(".chatbot-empty"));
  assert.throws(() => window.openCreatorChatbotEditor(legacy), /ne correspond pas/);
  assert.throws(() => window.openCreatorChatbotPreview(legacy), /ne correspond pas/);
  await assert.rejects(window.handleCreatorChatbotAction({ action: "chatbot-delete", target: document.createElement("button"), id: legacy.id }), /ne correspond pas/);
  page.querySelector(".chatbot-hero-action").click();
  await until(() => document.querySelector('#editor-dialog[open] [data-chatbot-editor="command"]'), "L'éditeur de commande manque.");
  fixture.flushFrames();
  const form = document.getElementById("editor-form");
  form.elements.namedItem("aliases").value = "!s";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await until(() => requests.upserts.length === 1 && !document.getElementById("editor-dialog").open, "La commande fonctionnelle doit réutiliser un nom retiré de l'ancien catalogue.");
  fixture.flushFrames();
  assert.equal(JSON.stringify(fixture.state.commands[0]), JSON.stringify(legacy));
  assert.equal(fixture.state.commands[1].command, "!skip");
  assert.equal(document.querySelectorAll(".chatbot-entry").length, 1);
  assertSafeFixture(fixture);
});
test("les activités runtime mettent à jour uniquement le journal ChatBot, pas la bannière ou les commandes", async (t) => {
  const fixture = await rendererFixture(t);
  const { window, handlers } = fixture;
  const page = await fixture.openChatbot();
  const hero = page.querySelector("[data-studio-hero=chatbot]");
  const card = page.querySelector(".chatbot-entry");
  const title = card.querySelector("h4");
  const toggle = card.querySelector('[data-action="chatbot-toggle"]');
  toggle.focus();
  fixture.resetCalls();
  const profileId = fixture.state.session.profileId;
  const entry = { id: "response-one", category: "chatbot", executionType: "music", profileId, timestamp: "2026-10-13T12:00:00Z", level: "success", title: "Réponse ChatBot envoyée", detail: "Bonjour Lou !" };
  handlers.get("runtime-state-changed")({ state: { activity: [entry], statistics: { ...fixture.state.statistics, sessionEvents: 20 } } });
  fixture.flushFrames();
  assert.match(page.querySelector(".chatbot-journal").textContent, /Bonjour Lou !/);
  assert.equal(page.querySelector("[data-studio-hero=chatbot]"), hero);
  assert.equal(page.querySelector(".chatbot-entry"), card);
  assert.equal(card.querySelector("h4"), title);
  assert.equal(window.document.activeElement, toggle);
  assert.equal(window.chatbotIntegrationCalls.render, 0);
  const journalRow = page.querySelector(".chatbot-journal-list article");
  handlers.get("runtime-state-changed")({ state: { activity: [entry] } });
  fixture.flushFrames();
  assert.equal(page.querySelector(".chatbot-journal-list article"), journalRow, "Un état identique ne reconstruit pas le journal.");
  assert.equal(window.chatbotIntegrationCalls.render, 0);
  assertSafeFixture(fixture);
});

test("masquer la fenêtre suspend les dessins puis reprend seulement le dernier journal ChatBot", async (t) => {
  const fixture = await rendererFixture(t);
  const { window, handlers } = fixture;
  const page = await fixture.openChatbot();
  const hero = page.querySelector("[data-studio-hero=chatbot]");
  const card = page.querySelector(".chatbot-entry");
  const journalBefore = page.querySelector("[data-creator-chatbot-activity]").innerHTML;
  fixture.setVisibility(false);
  fixture.resetCalls();
  for (let index = 0; index < 100; index += 1) handlers.get("runtime-state-changed")({ state: {
    activity: [{ id: `hidden-response-${index}`, category: "chatbot", executionType: "music", profileId: fixture.state.session.profileId, timestamp: "2026-10-13T12:00:00Z", level: "info", title: "Réponse ChatBot locale — non envoyée", detail: `Dernière réponse ${index}` }],
    statistics: { ...fixture.state.statistics, sessionEvents: index + 1 }
  } });
  fixture.flushFrames();
  assert.equal(window.chatbotIntegrationCalls.render, 0);
  assert.equal(window.chatbotIntegrationCalls.chrome, 0);
  assert.equal(window.chatbotIntegrationCalls.comparison, 0);
  assert.equal(window.chatbotIntegrationCalls.journal, 0);
  assert.equal(page.querySelector("[data-creator-chatbot-activity]").innerHTML, journalBefore);
  assert.equal(window.eval("snapshot.state.activity[0].detail"), "Dernière réponse 99");
  fixture.setVisibility(true);
  fixture.flushFrames();
  assert.match(page.querySelector(".chatbot-journal").textContent, /Dernière réponse 99/);
  assert.doesNotMatch(page.querySelector(".chatbot-journal").textContent, /Dernière réponse 98/);
  assert.equal(page.querySelector("[data-studio-hero=chatbot]"), hero);
  assert.equal(page.querySelector(".chatbot-entry"), card);
  assert.equal(window.chatbotIntegrationCalls.render, 0);
  assert.equal(window.chatbotIntegrationCalls.comparison, 1);
  assert.equal(window.chatbotIntegrationCalls.journal, 1);
  assertSafeFixture(fixture);
});

test("les métadonnées d’audience d’une source n’invalident pas l’atelier ChatBot", async (t) => {
  const fixture = await rendererFixture(t);
  const { window, handlers } = fixture;
  const page = await fixture.openChatbot();
  const hero = page.querySelector("[data-studio-hero=chatbot]");
  const card = page.querySelector(".chatbot-entry");
  const intro = page.querySelector(".chatbot-functional-intro");
  fixture.resetCalls();
  for (let index = 0; index < 100; index += 1) handlers.get("runtime-state-changed")({ state: {
    connections: fixture.state.connections.map((entry) => ({ ...entry, currentViewers: index, lastEventAt: `event-${index}`, liveStatus: "live" }))
  } });
  fixture.flushFrames();
  assert.equal(window.eval("snapshot.state.connections[0].currentViewers"), 99);
  assert.equal(page.querySelector("[data-studio-hero=chatbot]"), hero);
  assert.equal(page.querySelector(".chatbot-entry"), card);
  assert.equal(page.querySelector(".chatbot-functional-intro"), intro);
  assert.equal(page.querySelector(".chatbot-local-badge"), null);
  assert.equal(window.chatbotIntegrationCalls.render, 0);
  assertSafeFixture(fixture);
});

test("une route ChatBot masquée est absente du menu et ne peut pas être forcée par navigation", async (t) => {
  const fixture = await rendererFixture(t, { hidden: true });
  const { window } = fixture;
  assert.equal(window.document.querySelector('#navigation [data-navigate="commands"]'), null);
  window.eval('currentPage = "commands"; render();');
  fixture.flushFrames();
  assert.notEqual(window.eval("currentPage"), "commands");
  assert.equal(window.document.querySelector(".creator-chatbot-page"), null);
  assert.equal(window.document.querySelector('[data-action="chatbot-add"]'), null);
  assert.deepEqual(fixture.requests.upserts, []);
  assertSafeFixture(fixture);
});

test("l'index réel crée et édite les commandes musique, action et overlay sans exécuter leurs effets", async (t) => {
  const fixture = await rendererFixture(t, { commands: [], rules: [{ id: "rule_voice", name: "Annonce", enabled: true, actions: [{ id: "voice_action", type: "tts.speak", config: { text: "Fixture" } }] }] });
  const { window, requests } = fixture;
  const document = window.document;
  await fixture.openChatbot();
  assert.equal(document.querySelector(".chatbot-delivery"), null, "Les droits d'envoi de texte ne sont pas requis pour piloter les effets.");
  const cases = [
    { type: "music", name: "!pause", fields: { executionOperation: "pause" }, expected: { type: "music", operation: "pause" } },
    { type: "action", name: "!annonce", fields: { executionActionId: "voice_action" }, expected: { type: "action", actionId: "voice_action" } },
    { type: "overlay", name: "!wins", fields: { executionOverlayKey: "winCounter", executionOperation: "adjust", executionAmount: "3" }, expected: { type: "overlay", overlayKey: "winCounter", operation: "adjust", amount: 3 } }
  ];
  for (const [index, entry] of cases.entries()) {
    document.querySelector(".chatbot-hero-action").click();
    await until(() => document.querySelector('#editor-dialog[open] [data-chatbot-editor="command"]'), "L'éditeur de commande fonctionnelle manque.");
    fixture.flushFrames();
    const form = document.getElementById("editor-form");
    const update = (name, value) => {
      const input = form.elements.namedItem(name);
      assert.ok(input, name);
      input.value = value;
      input.dispatchEvent(new window.Event("change", { bubbles: true }));
    };
    update("command", entry.name);
    update("executionType", entry.type);
    for (const [name, value] of Object.entries(entry.fields)) update(name, value);
    if (entry.type === "action") assert.equal(form.elements.namedItem("executionActionId").value, "voice_action", form.elements.namedItem("executionActionId").innerHTML);
    assert.equal(form.elements.namedItem("response"), null);
    assert.match(form.querySelector(".chatbot-preview-result").textContent, /aucun test réel/);
    assert.equal(requests.upserts.length, index);
    form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await until(() => requests.upserts.length === index + 1 && !document.getElementById("editor-dialog").open, `La commande ${entry.type} n'a pas été créée : ${document.getElementById("dialog-error").textContent}`);
    fixture.flushFrames();
    assert.deepEqual(requests.upserts.at(-1).entity.execution, entry.expected);
    assert.equal(requests.upserts.at(-1).entity.audience, "moderator");
    assert.equal(requests.upserts.at(-1).entity.response, "");
  }
  const actionEntry = document.querySelector(`[data-chatbot-entry="${requests.upserts[1].entity.id}"]`);
  actionEntry.querySelector('[data-action="chatbot-edit"]').click();
  await until(() => document.querySelector('#editor-dialog[open] [data-chatbot-editor="command"]'), "La commande existante ne s'édite pas.");
  assert.equal(document.getElementById("editor-form").elements.namedItem("executionActionId").value, "voice_action");
  assertSafeFixture(fixture);
});
