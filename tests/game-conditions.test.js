"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const { GameHub } = require("../src/main/game-hub");
const { normalizeWindowsInputSequence, WindowsInputService } = require("../src/main/windows-input-service");
const { sanitizeGameConfiguration } = require("../src/main/ipc/sanitizers");
const { authenticatedFixtureStore } = require("./helpers/authenticated-store");

const root = path.resolve(__dirname, "..");
const resources = path.join(root, "resources");
const packs = loadShenazenGameCatalog(resources);
const inputPacks = packs.filter(pack => pack.connector?.type === "windows-input");
const read = file => fs.readFileSync(path.join(root, "src/renderer/app", file), "utf8");

function renderer() {
  const dom = new JSDOM("<main></main>");
  const context = vm.createContext({
    document: dom.window.document,
    snapshot: { packs, state: { game: { installations: {}, connectorOverrides: {} }, session: {}, settings: {} } },
    gameWorkspaceStep: "installation", gameInstallBusyId: "", gameLaunchBusyId: "",
    CONFIGURABLE_INTEGRATED_GAMES: new Set(), MANAGED_BIZHAWK_GAME_IDS: new Set(), MINECRAFT_MODE_IDS: [],
    isGameUnlocked: () => true, gameMappedEffects: () => [], gameArtwork: () => "",
    gameAccessLabel: () => "Pro", activeGameSession: () => null,
    renderGamePageMessage: () => "", renderGameLaunchProgressModal: () => "",
    visibilityTools: { gameScopeFor: () => "public" }, siteVisibility: {},
    escapeHtml: value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]),
    registerActionHandler() {}, ACTION_NOT_HANDLED: Symbol("unhandled"),
    render() { assert.fail("L’ouverture de l’aide ne doit pas recréer les formulaires."); }
  });
  const bootstrap = read("core/bootstrap.js");
  for (const name of ["DEFAULT_GAME_JOURNEY", "AUTOMATED_GAME_INSTALLERS"]) {
    const expression = name === "DEFAULT_GAME_JOURNEY"
      ? /const DEFAULT_GAME_JOURNEY = Object\.freeze\(\[[\s\S]*?\]\);/
      : /const AUTOMATED_GAME_INSTALLERS = new Set\(\[[\s\S]*?\]\);/;
    vm.runInContext(bootstrap.match(expression)[0], context);
  }
  for (const file of ["features/games/control-bindings.js", "features/games/conditions.js", "features/games/access.js", "features/games/overlay-cards.js", "features/games/super-mario-kart-workspace.js", "actions/handlers/navigation-games.js"]) {
    vm.runInContext(read(file), context, { filename: file });
  }
  context.isGameUnlocked = () => true;
  context.gameArtwork = () => "";
  context.gameAccessLabel = () => "Pro";
  return { dom, context, close: () => dom.window.close() };
}

test("chaque jeu propose ses conditions dans son en-tête, y compris les tableaux de session", t => {
  const r = renderer(); t.after(r.close);
  r.context.renderGameWorkspaceStep = () => "";
  r.context.renderSuperMarioKartInstallationRail = () => "";
  r.context.renderSuperMarioKartSessionLanding = () => "";
  for (const pack of packs) {
    const page = JSDOM.fragment(r.context.renderGameWorkspace(pack));
    const button = page.querySelector('[data-action="toggle-game-conditions"]');
    const panel = page.querySelector(".game-conditions-panel");
    assert.ok(button && panel, pack.id);
    assert.equal(button.textContent.trim().replace(/\s+/g, " "), "CONDITION DE JEU");
    assert.equal(button.getAttribute("aria-controls"), panel.id);
    assert.equal(button.getAttribute("aria-expanded"), "false");
    assert.equal(panel.hidden, true);
    assert.ok(button.closest(".game-workspace-hero, .smk-workspace-hero").contains(panel));
    for (const entry of [...(pack.guide.requirements || []), ...pack.guide.notes, ...pack.guide.steps]) {
      assert.ok(panel.textContent.includes(entry), `${pack.id}: ${entry}`);
    }
  }
});

test("ouvrir et refermer les conditions préserve les champs en cours et l’ouverture est propre à chaque jeu", async t => {
  const r = renderer(); t.after(r.close);
  const pack = packs.find(p => p.id === "dead-by-daylight");
  const main = r.dom.window.document.querySelector("main");
  main.innerHTML = `<section class="game-workspace-hero">${r.context.renderGameConditionsButton(pack)}${r.context.renderGameConditionsPanel(pack)}<input value="brouillon"></section>`;
  const button = main.querySelector("button"), panel = main.querySelector(".game-conditions-panel"), field = main.querySelector("input");
  field.value = "modification non enregistrée";
  await r.context.handleNavigationAndGameEditorAction({ action: "toggle-game-conditions", id: pack.id, target: button });
  assert.equal(panel.hidden, false);
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(field, main.querySelector("input"));
  assert.equal(field.value, "modification non enregistrée");
  assert.equal(JSDOM.fragment(r.context.renderGameConditionsPanel(pack)).querySelector("section").hidden, false);
  assert.equal(JSDOM.fragment(r.context.renderGameConditionsPanel(packs.find(p => p.id === "dredge"))).querySelector("section").hidden, true);
  await r.context.handleNavigationAndGameEditorAction({ action: "toggle-game-conditions", id: pack.id, target: button });
  assert.equal(panel.hidden, true);
  assert.equal(button.getAttribute("aria-expanded"), "false");
});

test("DBD affiche les deux tutoriels, les touches adaptées, les rôles et les conditions d’installation", t => {
  const r = renderer(); t.after(r.close);
  const pack = packs.find(p => p.id === "dead-by-daylight");
  r.context.snapshot.state.game.connectorOverrides[pack.id] = { keyLayout: "zsqd", gestureKeys: "letters" };
  const panel = JSDOM.fragment(r.context.renderGameConditionsPanel(pack));
  assert.match(panel.textContent, /Terminez l’étape Survival Tutorial/);
  assert.match(panel.textContent, /Terminez l’étape Killer Tutorial/);
  const rows = [...panel.querySelectorAll("tbody tr")];
  const keys = name => [...rows.find(row => row.querySelector("th").textContent === name).querySelectorAll("kbd")].map(key => key.textContent);
  assert.deepEqual(keys("Désigner / pointer du doigt"), ["P"]);
  assert.deepEqual(keys("Suivez-moi / venez ici"), ["O"]);
  assert.deepEqual(keys("Reculer"), ["Q"]);
  assert.deepEqual(keys("Attaquer"), ["Clic gauche"]);
  assert.deepEqual(keys("Utiliser le pouvoir"), ["Clic droit"]);
  assert.deepEqual(keys("Se débattre à gauche"), ["Espace"]);
  assert.deepEqual(keys("Se débattre à droite"), ["Espace"]);
  assert.ok(rows.some(row => row.textContent.includes("Survivant")));
  assert.ok(rows.some(row => row.textContent.includes("Tueur")));
});

test("les conditions indiquent les commandes à régler et couvrent chaque entrée utilisée par les cinq jeux", t => {
  const r = renderer(); t.after(r.close);
  const token = event => event.kind === "keyboard" ? `k:${event.keyCode}` : event.kind === "mouse-button" ? `b:${event.button}` : "r";
  for (const pack of inputPacks) {
    const used = new Set(pack.effects.filter(e => e.available !== false).flatMap(e => normalizeWindowsInputSequence(e.inputSequence).map(token)));
    const rows = r.context.gameConditionInputRows(pack);
    assert.deepEqual(new Set(rows.map(row => row.input)), used, pack.id);
    assert.ok(rows.every(row => row.keys.length === 1 && row.keys[0]));
    const panel = JSDOM.fragment(r.context.renderGameConditionsPanel(pack));
    assert.match(panel.querySelector("thead").textContent, /Commande dans les paramètres du jeu.*Touche à attribuer/);
    assert.doesNotMatch(panel.querySelector("thead").textContent, /Interaction|catégorie|Touches utilisées/);
    assert.doesNotMatch(panel.querySelector(".game-conditions-controls").textContent, /Déplacements désordonnés|Six sauts en rythme|Marche désordonnée|Commandes chaotiques|Dérapage sauvage/);
  }
  const fortnite = packs.find(p => p.id === "fortnite");
  const rows = r.context.gameConditionInputRows(fortnite);
  for (const [command, key] of [["Avancer", "Z"], ["Reculer", "S"], ["Se déplacer à gauche", "Q"], ["Se déplacer à droite", "D"], ["Sauter", "Espace"], ["Outil de collecte / pioche", "X"]]) {
    assert.deepEqual([...rows.find(row => row.name === command).keys], [key]);
  }
});

test("les réglages de contrôle affichés correspondent aux entrées réellement envoyées dans chaque jeu", async t => {
  const r = renderer(); t.after(r.close);
  const state = { settings: { account: { uid: "owner-fixture", email: "alexandre.leuridan@gmail.com", emailVerified: true, refreshTokenSecretId: "fixture-account" } }, session: { activeGamePackId: "fortnite" }, commerce: { subscription: { tier: "pro", status: "active", source: "subscription" }, gameEntitlements: [] }, game: { installations: {}, connectorOverrides: {}, recentPacks: [], interactionCatalogVersions: {}, interactionRulesByPack: {} }, rules: [] };
  const calls = [];
  const hub = new GameHub({ store: authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) }), resourcesDirectory: resources, packsDirectory: path.join(resources, "packs"), windowsInputService: new WindowsInputService({ execute: async (...args) => { calls.push(args); return { ok: true }; } }) });
  hub.loadPacks();
  const label = event => event.kind === "mouse-button" ? ["Clic gauche", "Clic droit", "Clic molette"][event.button] : event.kind === "mouse-move" ? "Mouvement de la souris" : ({ 9: "Tab", 16: "Maj gauche", 17: "Ctrl gauche", 32: "Espace" })[event.keyCode] || String.fromCharCode(event.keyCode);
  for (const pack of inputPacks) for (const layout of ["azerty", "wasd", ...(pack.id === "dead-by-daylight" ? ["zsqd"] : [])]) for (const gestureKeys of pack.id === "dead-by-daylight" ? ["numbers", "letters"] : ["numbers"]) {
    const config = { keyLayout: layout, gestureKeys };
    state.game.connectorOverrides[pack.id] = config;
    r.context.snapshot.state.game.connectorOverrides[pack.id] = config;
    const rows = r.context.gameConditionInputRows(pack);
    for (const effect of pack.effects.filter(e => e.available !== false)) {
      const original = normalizeWindowsInputSequence(effect.inputSequence);
      await hub.trigger(effect.id, {}, { packId: pack.id });
      const sent = calls.at(-1)[2];
      for (let index = 0; index < original.length; index++) {
        const event = original[index];
        const input = event.kind === "keyboard" ? `k:${event.keyCode}` : event.kind === "mouse-button" ? `b:${event.button}` : "r";
        assert.equal(rows.find(row => row.input === input).keys[0], label(sent[index]), `${pack.id}/${layout}/${gestureKeys}/${effect.code}/${input}`);
      }
    }
  }
});

test("les cinq jeux au clavier proposent ZQSD par défaut et conservent les dispositions enregistrées", t => {
  const r = renderer(); t.after(r.close);
  for (const pack of inputPacks) {
    assert.equal(pack.connector.keyLayout, "azerty");
    for (const saved of [null, "wasd", "azerty", ...(pack.id === "dead-by-daylight" ? ["zsqd"] : [])]) {
      r.context.snapshot.state.game.connectorOverrides = saved ? { [pack.id]: { keyLayout: saved } } : {};
      const html = ["fortnite", "rocket-league"].includes(pack.id)
        ? r.context.renderSuperMarioKartInstallationRail(pack, true, r.context.superMarioKartWorkspaceState(pack))
        : r.context.renderInputGameInstallation(pack, true);
      assert.equal(JSDOM.fragment(html).querySelector("[data-game-key-layout]").value, saved || "azerty", pack.id);
    }
  }
  for (const id of ["fortnite", "rocket-league", "demonologist"]) {
    assert.equal(sanitizeGameConfiguration(id, {}).keyLayout, "azerty");
    assert.equal(sanitizeGameConfiguration(id, { keyLayout: "wasd" }).keyLayout, "wasd");
  }
});

test("le moteur utilise ZQSD sans réglage et préserve un WASD explicite", async () => {
  const state = { settings: { account: { uid: "owner-fixture", email: "alexandre.leuridan@gmail.com", emailVerified: true, refreshTokenSecretId: "fixture-account" } }, session: { activeGamePackId: "fortnite" }, commerce: { subscription: { tier: "pro", status: "active", source: "subscription" }, gameEntitlements: [] }, game: { installations: {}, connectorOverrides: {}, recentPacks: [], interactionCatalogVersions: {}, interactionRulesByPack: {} }, rules: [] };
  const store = authenticatedFixtureStore({ getState: () => state, mutate: fn => fn(state) });
  const calls = [];
  const hub = new GameHub({ store, resourcesDirectory: resources, packsDirectory: path.join(resources, "packs"), windowsInputService: new WindowsInputService({ execute: async (...args) => { calls.push(args); return { ok: true }; } }) });
  hub.loadPacks();
  for (const pack of inputPacks) {
    const effect = pack.effects.find(e => e.available !== false && e.inputSequence.startsWith("k,0,87,0"));
    assert.ok(effect, pack.id);
    await hub.trigger(effect.id, {}, { packId: pack.id });
    assert.equal(calls.at(-1)[2][0].keyCode, 90, pack.id);
    state.game.connectorOverrides[pack.id] = { keyLayout: "wasd" };
    await hub.trigger(effect.id, {}, { packId: pack.id });
    assert.equal(calls.at(-1)[2][0].keyCode, 87, pack.id);
  }
});

test("les conditions échappent les textes et ne proposent que des liens HTTPS", t => {
  const r = renderer(); t.after(r.close);
  const pack = { id: 'test"', name: '<img src=x onerror="alert(1)">', effects: [], guide: { notes: ["<script>bad()</script>"], steps: ["<b>texte</b>"], sources: [{ label: "Piège", url: "javascript:alert(1)" }, { label: "Guide", url: "https://example.com/guide" }] } };
  const panel = JSDOM.fragment(r.context.renderGameConditionsPanel(pack));
  assert.equal(panel.querySelectorAll("img,script,b").length, 0);
  assert.equal(panel.querySelectorAll('[data-action="open-url"]').length, 1);
  assert.match(panel.textContent, /<script>bad\(\)<\/script>/);
});
