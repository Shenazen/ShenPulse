"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const rendererRoot = path.join(__dirname, "..", "src", "renderer");
const source = fs.readFileSync(path.join(rendererRoot, "app", "core", "automation-table.js"), "utf8");
const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Le tableau et ses outils visuels ne doivent appeler aucun effet réel. */
function tableContext(t) {
  const dom = new JSDOM('<main id="content"></main>');
  t.after(() => dom.window.close());
  const context = vm.createContext({
    window: dom.window,
    document: dom.window.document,
    content: dom.window.document.getElementById("content"),
    escapeHtml: escape,
    api: new Proxy({}, { get() { throw new Error("Aucun API n’est autorisé pendant le rendu, le tri ou la sélection."); } }),
    fetch() { throw new Error("Le tableau ne doit pas télécharger de média."); },
    setTimeout() { throw new Error("Le tableau ne doit pas créer de timer."); },
    setInterval() { throw new Error("Le tableau ne doit pas créer de boucle."); },
    Audio: class { constructor() { throw new Error("Aucun son ne doit être préchargé ou joué."); } }
  });
  vm.runInContext(source, context, { filename: "automation-table.js" });
  context.content.addEventListener("change", context.handleAutomationTableSelection);
  context.content.addEventListener("click", context.handleAutomationTableSort);
  context.renderRows = (rows, options = {}) => {
    context.content.innerHTML = context.renderAutomationTable({ key: "actions", label: "Liste des actions", rows, ...options });
    return context.content.querySelector("table");
  };
  context.change = (control) => control.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  return context;
}

function rowFor(context, { id = "rule_1", name = "Accueil", enabled = true, date = "", ...details } = {}) {
  return {
    id,
    name,
    date,
    trigger: '<span class="trigger-pill">Follow</span>',
    effects: context.renderAutomationEffectChip({ label: "Bienvenue", kind: "son", tone: "gold", icon: "sound" }),
    status: context.renderAutomationStatus({ id, name, enabled }),
    commands: context.renderAutomationIconButton({ action: "edit-action", label: "Modifier", attributes: `data-rule="${escape(id)}" data-id="action_1" data-index="0"` }),
    ...details
  };
}

const rowNames = (table) => [...table.tBodies[0].rows].map((row) => row.dataset.automationName);

test("le composant commun affiche les six colonnes demandées et une sélection distincte", (t) => {
  const context = tableContext(t);
  const table = context.renderRows([rowFor(context)]);
  assert.equal(table.getAttribute("aria-label"), "Liste des actions");
  assert.deepEqual([...table.querySelectorAll("thead th")].map((cell) => cell.textContent.trim()), ["", "Nom", "Déclencheur", "Actions exécutées", "Statut", "Date", "Actions"]);
  assert.equal(table.querySelectorAll("colgroup col").length, 7);
  assert.equal(table.querySelectorAll("tbody td").length, 7);
  assert.equal(table.querySelector("[data-automation-select]").type, "checkbox");
  assert.equal(table.querySelector("[data-automation-select]").hasAttribute("data-action"), false);
  const status = table.querySelector('[data-action="toggle-rule"]');
  assert.equal(status.checked, true);
  assert.equal(status.dataset.id, "rule_1");
  assert.notEqual(status, table.querySelector("[data-automation-select]"));
  assert.equal(table.querySelector("thead .automation-column-date").textContent.trim(), "Date");
  assert.equal(table.querySelector("tbody .automation-column-date").textContent.trim(), "—");
  const empty = context.renderRows([]);
  assert.equal(empty.querySelectorAll("[data-automation-row]").length, 0);
  assert.equal(empty.querySelector(".automation-table-empty").colSpan, 7);
  assert.equal(empty.querySelectorAll("thead th").length, 7);
});

test("les noms, identifiants et étiquettes sont échappés sans perdre leurs valeurs", (t) => {
  const context = tableContext(t);
  const unsafeName = 'Action <img src=x onerror="bad()"> & "cadeau"';
  const unsafeId = 'rule_" onmouseover="bad()';
  const unsafeKey = 'actions" onclick="bad()';
  const chipLabel = '<script>bad()</script> & son';
  const table = context.renderRows([rowFor(context, {
    id: unsafeId,
    name: unsafeName,
    effects: context.renderAutomationEffectChip({ label: chipLabel, kind: '<img src=x>', tone: 'gold" onmouseover="bad()' }),
    commands: context.renderAutomationIconButton({ action: 'edit" onclick="bad()', label: unsafeName })
  })], { key: unsafeKey, label: unsafeName });
  assert.equal(table.dataset.automationTable, unsafeKey);
  assert.equal(table.getAttribute("aria-label"), unsafeName);
  assert.equal(table.tBodies[0].rows[0].dataset.automationRow, unsafeId);
  assert.equal(table.querySelector(".automation-name-copy strong").textContent, unsafeName);
  assert.equal(table.querySelector('[data-action="toggle-rule"]').dataset.id, unsafeId);
  assert.equal(table.querySelector(".automation-effect-chip").textContent, chipLabel);
  assert.equal(table.querySelector(".automation-effect-kind").textContent, '<img src=x>');
  assert.equal(table.querySelector(".automation-icon-button").getAttribute("aria-label"), unsafeName);
  assert.equal(table.querySelectorAll("script, img, [onclick], [onmouseover], [onerror]").length, 0);
});

test("sélectionner une ligne ou toutes les lignes ne modifie ni règle ni statut", (t) => {
  const context = tableContext(t);
  const rows = [rowFor(context), rowFor(context, { id: "rule_2", name: "Deuxième", enabled: false })];
  const before = JSON.stringify(rows);
  const table = context.renderRows(rows);
  const selects = [...table.querySelectorAll("[data-automation-select]")];
  const statuses = [...table.querySelectorAll('[data-action="toggle-rule"]')];
  const head = table.querySelector("[data-automation-select-all]");
  const summary = context.content.querySelector("[data-automation-selection-summary]");
  selects[0].checked = true;
  context.change(selects[0]);
  assert.equal(selects[0].closest("tr").classList.contains("automation-row-selected"), true);
  assert.equal(head.checked, false);
  assert.equal(head.indeterminate, true);
  assert.equal(summary.hidden, false);
  assert.match(summary.textContent, /1 ligne sélectionnée.*aucune action déclenchée/);
  assert.deepEqual(statuses.map((status) => status.checked), [true, false]);
  head.checked = true;
  context.change(head);
  assert.deepEqual(selects.map((select) => select.checked), [true, true]);
  assert.equal(head.indeterminate, false);
  assert.match(summary.textContent, /2 lignes sélectionnées/);
  head.checked = false;
  context.change(head);
  assert.deepEqual(selects.map((select) => select.checked), [false, false]);
  assert.equal(summary.hidden, true);
  assert.deepEqual(statuses.map((status) => status.checked), [true, false]);
  assert.equal(JSON.stringify(rows), before);
});

test("le tri des noms est naturel, réversible et conserve les éléments et références", (t) => {
  const context = tableContext(t);
  const rows = ["Action 10", "Éclair", "Action 2", "Action 1"].map((name, index) => rowFor(context, { id: `rule_${index}`, name }));
  const before = JSON.stringify(rows);
  const table = context.renderRows(rows);
  const originalRow = table.tBodies[0].rows[0];
  const selection = originalRow.querySelector("[data-automation-select]");
  selection.checked = true;
  context.change(selection);
  const sorter = table.querySelector('[data-automation-sort="name"]');
  sorter.querySelector("svg path").dispatchEvent(new context.window.Event("click", { bubbles: true }));
  assert.deepEqual(rowNames(table), ["Action 1", "Action 2", "Action 10", "Éclair"]);
  assert.equal(sorter.closest("th").getAttribute("aria-sort"), "ascending");
  assert.equal(table.tBodies[0].rows[2], originalRow);
  assert.equal(originalRow.querySelector("[data-automation-select]"), selection);
  assert.equal(selection.checked, true);
  assert.equal(originalRow.querySelector(".automation-icon-button").dataset.rule, "rule_0");
  sorter.click();
  assert.deepEqual(rowNames(table), ["Éclair", "Action 10", "Action 2", "Action 1"]);
  assert.equal(sorter.closest("th").getAttribute("aria-sort"), "descending");
  assert.equal(JSON.stringify(rows), before, "Le tri visuel ne réordonne jamais les objets du profil.");
});

test("le tri des statuts suit les interrupteurs courants, pas un statut périmé", (t) => {
  const context = tableContext(t);
  const table = context.renderRows([rowFor(context, { name: "Active" }), rowFor(context, { id: "rule_2", name: "Inactive", enabled: false })]);
  const sorter = table.querySelector('[data-automation-sort="status"]');
  sorter.click();
  assert.deepEqual(rowNames(table), ["Inactive", "Active"]);
  const active = [...table.tBodies[0].rows].find((row) => row.dataset.automationName === "Active");
  active.querySelector('[data-action="toggle-rule"]').checked = false;
  sorter.click();
  assert.deepEqual(rowNames(table), ["Inactive", "Active"], "Les deux statuts égaux conservent leur ordre actuel.");
});

test("les dates absentes ou invalides restent neutres et le tri des dates est stable", (t) => {
  const context = tableContext(t);
  const table = context.renderRows([
    rowFor(context, { id: "feb", name: "Février", date: "2026-02-15T12:00:00Z" }),
    rowFor(context, { id: "missing", name: "Sans date" }),
    rowFor(context, { id: "jan", name: "Janvier", date: "2026-01-15T12:00:00Z" }),
    rowFor(context, { id: "invalid", name: "Date invalide", date: "pas une date" })
  ]);
  assert.equal(table.querySelector('[data-automation-row="missing"] .automation-column-date').textContent, "—");
  assert.equal(table.querySelector('[data-automation-row="invalid"] .automation-column-date').textContent, "—");
  assert.equal(table.querySelector('[data-automation-row="invalid"]').dataset.automationDate, "0");
  const sorter = table.querySelector('[data-automation-sort="date"]');
  sorter.click();
  assert.deepEqual(rowNames(table), ["Sans date", "Date invalide", "Janvier", "Février"]);
  sorter.click();
  assert.deepEqual(rowNames(table), ["Février", "Janvier", "Sans date", "Date invalide"]);
  assert.equal(table.querySelector('[data-automation-sort="name"]').closest("th").getAttribute("aria-sort"), "none");
  assert.equal(context.automationTableDate("pas une date").text, "—");
});

test("les commandes conservent des icônes accessibles et tous les attributs de ciblage", (t) => {
  const context = tableContext(t);
  const attributes = 'data-rule="rule_1" data-id="action_1" data-index="3"';
  const table = context.renderRows([rowFor(context, {
    commands: [
      context.renderAutomationIconButton({ action: "test-action", label: "Tester", attributes, icon: "play", tone: "play" }),
      context.renderAutomationIconButton({ action: "edit-action", label: "Modifier", attributes }),
      context.renderAutomationIconButton({ action: "duplicate-action", label: "Dupliquer", attributes, icon: "copy" }),
      context.renderAutomationIconButton({ action: "delete-action", label: "Supprimer", attributes, icon: "trash", tone: "danger" })
    ].join("")
  })]);
  const buttons = [...table.querySelectorAll(".automation-icon-button")];
  assert.deepEqual(buttons.map((button) => button.dataset.action), ["test-action", "edit-action", "duplicate-action", "delete-action"]);
  for (const button of buttons) {
    assert.equal(button.type, "button");
    assert.equal(button.dataset.rule, "rule_1");
    assert.equal(button.dataset.id, "action_1");
    assert.equal(button.dataset.index, "3");
    assert.equal(button.getAttribute("aria-label"), button.title);
    assert.equal(button.querySelector("svg").getAttribute("aria-hidden"), "true");
  }
  assert.equal(table.querySelectorAll("audio, video, iframe, script").length, 0);
});

/** Monte uniquement les composants purs, avec les mêmes références de profil. */
function actionTableContext(t, { hiddenTypes = [] } = {}) {
  const context = tableContext(t);
  const gift = { id: "selected", name: "Cœur du jour", cost: 1, imageUrl: "selected.webp" };
  Object.assign(context, {
    snapshot: { state: { rules: [], timers: [], settings: { tts: {}, irl: { devices: [] } } } },
    actionsSection: "actions",
    actionsSearch: "",
    onlyEnabledActions: false,
    giftCatalogById: new Map([["selected", gift], ["cheap", { ...gift, id: "cheap", cost: 10, imageUrl: "wrong.webp" }]]),
    giftCatalogByName: new Map([["coeur du jour", [gift]]]),
    GIFT_CATALOG: [],
    rendererFormatters: { integer: new Intl.NumberFormat("fr-FR") },
    ACTION_TYPE_LABELS: { "wheel.spin": "Roue", delay: "Pause", "system.keys": "Clavier", "audio.play": "Son", "tts.speak": "Voix" },
    ACTION_TYPE_ICONS: {},
    EVENT_LABELS: { gift: "Cadeau", chat: "Chat", follow: "Follow" },
    SOUND_LIBRARY: [],
    mediaSessionEntries: new Map(),
    mediaLibraryEntry: () => null,
    isAccountAuthenticated: () => true,
    canAccessActionType: (type) => !hiddenTypes.includes(type),
    canAccessFeature: () => true,
    emptyInline: (text) => `<p class="empty-inline">${escape(text)}</p>`,
    renderStudioHero: () => '<section data-test-hero></section>',
    renderCreatorCapacity: () => ""
  });
  const foundations = fs.readFileSync(path.join(rendererRoot, "app", "core", "ui-foundations.js"), "utf8");
  vm.runInContext(foundations.slice(0, foundations.indexOf("function asNumber")), context, { filename: "ui-foundations-gifts.js" });
  vm.runInContext(fs.readFileSync(path.join(rendererRoot, "app", "features", "actions.js"), "utf8"), context, { filename: "actions.js" });
  context.renderMediaScreensPanel = () => '<section data-test-screens></section>';
  context.renderPage = () => {
    context.content.innerHTML = context.renderActions();
    return context.content;
  };
  return context;
}

test("les scénarios restent groupés et chaque action conserve ses propres outils et identifiants", (t) => {
  const context = actionTableContext(t);
  const group = {
    id: 'rule_"group', name: 'Scénario <script>bad()</script>', enabled: true,
    trigger: { type: "gift", threshold: 1 }, cooldown: { globalMs: 5000 },
    conditions: [{ field: "data.giftName", operator: "equals", value: "Cœur du jour", giftId: "selected" }],
    actions: [{ id: 'wheel_"action', type: "wheel.spin", config: {} }, { id: "delay_action", type: "delay", config: { durationMs: 1000 } }]
  };
  context.snapshot.state.rules = [group];
  const before = JSON.stringify(context.snapshot.state);
  const page = context.renderPage();
  const table = page.querySelector('[data-automation-table="actions"]');
  assert.equal(table.tBodies[0].rows.length, 1);
  assert.equal(table.querySelectorAll('[data-action="toggle-rule"]').length, 1, "Le statut est celui du scénario entier.");
  assert.equal(table.querySelector('[data-action="toggle-rule"]').dataset.id, group.id);
  assert.equal(table.querySelector(".automation-name-copy strong").textContent, group.name);
  assert.match(table.textContent, /2 actions dans ce scénario/);
  assert.equal(table.querySelector('.automation-column-trigger > div').title, "Cooldown · 5s");
  assert.equal(table.querySelectorAll(".automation-effect-chip").length, 2);
  for (const [index, action] of group.actions.entries()) {
    for (const operation of ["test-action", "edit-action", "duplicate-action", "delete-action"]) {
      const buttons = [...table.querySelectorAll(`[data-action="${operation}"]`)].filter((button) => button.dataset.id === action.id);
      assert.ok(buttons.length, `${operation} pour ${action.id}`);
      for (const button of buttons) {
        assert.equal(button.dataset.rule, group.id);
        assert.equal(button.dataset.index, String(index));
      }
    }
  }
  assert.equal(table.querySelector(".trigger-pill img").getAttribute("src"), "selected.webp");
  assert.equal(table.querySelector(".automation-gift-price").textContent, "1");
  assert.equal(table.querySelector('img[src="wrong.webp"]'), null, "Le cadeau homonyme n’est jamais choisi à la place de l’ID sauvegardé.");
  assert.equal(table.querySelector("script, audio, video, iframe"), null);
  assert.equal(JSON.stringify(context.snapshot.state), before);
});

test("les filtres et droits de la liste Actions restent inchangés par le tableau", (t) => {
  const context = actionTableContext(t, { hiddenTypes: ["system.keys"] });
  context.snapshot.state.rules = [
    { id: "live", name: "Active", enabled: true, trigger: { type: "follow" }, actions: [{ id: "wheel", type: "wheel.spin", config: {} }, { id: "sound", type: "audio.play", config: { soundName: "Bienvenue" } }, { id: "voice", type: "tts.speak", config: {} }, { id: "keys", type: "system.keys", config: {} }] },
    { id: "off", name: "Inactive", enabled: false, trigger: { type: "chat" }, actions: [{ id: "delay", type: "delay", config: { durationMs: 1000 } }] }
  ];
  const before = JSON.stringify(context.snapshot.state);
  let page = context.renderPage();
  assert.deepEqual(rowNames(page.querySelector('[data-automation-table="actions"]')), ["Active", "Inactive"]);
  assert.equal(page.querySelector('[data-action="test-action"][data-id="sound"]'), null);
  assert.equal(page.querySelector('[data-action="test-action"][data-id="voice"]'), null);
  assert.equal(page.querySelector('[data-action="test-action"][data-id="keys"]'), null);
  context.onlyEnabledActions = true;
  page = context.renderPage();
  assert.deepEqual(rowNames(page.querySelector('[data-automation-table="actions"]')), ["Active"]);
  context.onlyEnabledActions = false;
  context.actionsSearch = "1000 ms";
  page = context.renderPage();
  assert.deepEqual(rowNames(page.querySelector('[data-automation-table="actions"]')), ["Inactive"]);
  assert.equal(page.querySelector('[data-search="actions"]').value, "1000 ms");
  context.actionsSearch = "absente";
  page = context.renderPage();
  assert.equal(page.querySelector('[data-automation-table="actions"]'), null);
  assert.match(page.textContent, /Aucune action ne correspond/);
  assert.ok(page.querySelector('[data-action="add-action"]'));
  assert.equal(JSON.stringify(context.snapshot.state), before);
});

test("les déclencheurs gardent le mode aléatoire, les références manquantes et les outils de règle", (t) => {
  const context = actionTableContext(t);
  const owner = {
    id: "owner", name: "Roue et pause", enabled: true,
    trigger: { type: "follow", enabled: false },
    actions: [{ id: "wheel", type: "wheel.spin", config: {} }, { id: "delay", type: "delay", config: { durationMs: 1000 } }]
  };
  const trigger = {
    id: 'trigger_"id', name: "Tirage au hasard", enabled: false, trigger: { type: "chat" }, cooldown: { globalMs: 3000 }, actions: [],
    actionSelection: { mode: "random", randomCount: 3, actionIds: ["wheel", "delay", "absent", "wheel"] }
  };
  context.snapshot.state.rules = [owner, trigger];
  context.actionsSection = "triggers";
  const before = JSON.stringify(context.snapshot.state);
  const page = context.renderPage();
  const table = page.querySelector('[data-automation-table="triggers"]');
  assert.equal(table.tBodies[0].rows.length, 1);
  assert.match(table.textContent, /3 au hasard sur 3/);
  assert.match(table.textContent, /1 action manquante/);
  assert.match(table.textContent, /3s de cooldown/);
  for (const operation of ["run-rule", "edit-trigger", "delete-trigger", "toggle-rule"]) {
    assert.equal(table.querySelector(`[data-action="${operation}"]`).dataset.id, trigger.id);
  }
  assert.equal(table.querySelector('[data-action="toggle-rule"]').checked, false);
  assert.equal(table.querySelectorAll(".automation-effect-chip").length, 2);
  assert.equal(JSON.stringify(context.snapshot.state), before);
});
