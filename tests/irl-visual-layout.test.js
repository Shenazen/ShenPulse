"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const feature = path.join(__dirname, "..", "src", "renderer", "app", "features", "irl.js");
const heroFeature = path.join(__dirname, "..", "src", "renderer", "app", "features", "studio-design.js");
const components = path.join(__dirname, "..", "src", "renderer", "app", "core", "components.js");

function irlFixture(t, { enabled = false, devices = [], actions = [], query = "", busy = false, missingSettings = false } = {}) {
  const dom = new JSDOM("<main></main>");
  t.after(() => dom.window.close());
  const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const context = vm.createContext({
    snapshot: { state: { settings: missingSettings ? {} : { irl: { enabled, devices } } } },
    irlActionSearch: query, irlBusy: busy, escapeHtml,
    flattenActions: () => actions,
    triggerLabel: (rule) => rule.triggerLabel || "Cadeau Rose",
    triggerPill: (rule) => `<span class="trigger-pill"><strong>${escapeHtml(rule.triggerLabel || "Cadeau Rose")}</strong></span>`,
    actionDescription: (action) => action.description || "Allumer puis éteindre · 3 s",
    localStorage: { getItem: () => null },
    api: new Proxy({}, { get: () => { throw new Error("Le rendu ne doit appeler aucun service IRL"); } })
  });
  vm.runInContext(fs.readFileSync(components, "utf8"), context);
  vm.runInContext(fs.readFileSync(heroFeature, "utf8"), context);
  vm.runInContext(fs.readFileSync(feature, "utf8"), context);
  dom.window.document.querySelector("main").innerHTML = context.renderIrl();
  return { context, document: dom.window.document };
}

function plug(overrides = {}) {
  return { id: "shellyplusplugs-test", name: "Lampe du studio", model: "Shelly Plus Plug S", generation: 2, host: "192.168.1.42", online: true, controllable: true, ...overrides };
}

function interaction(overrides = {}) {
  return { rule: { id: "rule_irl", name: "La lampe réagit", enabled: true }, action: { id: "action_irl", type: "irl.shelly", config: { deviceId: "shellyplusplugs-test", operation: "pulse", durationMs: 3000 } }, actionIndex: 2, ...overrides };
}

test("IRL conserve la bannière photo partagée puis sépare activation, résumé, prises et interactions", (t) => {
  const { document } = irlFixture(t, { devices: [plug()], actions: [interaction()] });
  assert.equal(document.querySelector('[data-studio-hero="irl"] h2').textContent, "Machines IRL");
  const image = document.querySelector(".studio-hero-art");
  assert.ok(image.getAttribute("src").startsWith("assets/studio/"));
  assert.equal(image.getAttribute("decoding"), "async");
  const sections = [...document.querySelector(".irl-page").children];
  assert.ok(sections[0].matches(".studio-hero"));
  assert.ok(sections[1].matches(".irl-control-bar"));
  assert.ok(sections[2].matches(".irl-summary-grid"));
  assert.ok(sections[3].matches(".irl-devices-panel"));
  assert.ok(sections[4].matches(".irl-actions-panel"));
  assert.match(document.querySelector(".irl-safety-note").textContent, /Ne branchez pas le PC ShenPulse ni votre routeur sans protection/);
});

test("les compteurs et les lignes ne présentent que les prises PlugPlus compatibles et les actions IRL", (t) => {
  const { document } = irlFixture(t, {
    devices: [plug(), plug({ id: "shellyplusplugs-second", online: false }), { id: "shellypro3em-test", model: "Shelly Pro 3EM", online: true }],
    actions: [interaction(), interaction({ action: { type: "keyboard.key" } })]
  });
  assert.deepEqual([...document.querySelectorAll(".irl-summary-card strong")].map((node) => node.textContent), ["2", "1", "1"]);
  assert.equal(document.querySelectorAll(".irl-device-row").length, 2);
  assert.equal(document.querySelectorAll(".irl-interaction-row").length, 1);
  assert.equal(document.querySelectorAll(".irl-device-status.is-online").length, 1);
  assert.match(document.querySelector(".irl-device-status.is-offline").title, /dernière recherche/);
});

test("l'activation globale reflète la configuration sans modifier les règles ni bloquer leur édition", (t) => {
  const off = irlFixture(t, { devices: [plug()], actions: [interaction()] });
  assert.equal(off.document.querySelector('[data-action="irl-toggle"]').checked, false);
  assert.match(off.document.querySelector(".irl-master-switch").textContent, /Les règles restent enregistrées/);
  assert.equal(off.document.querySelector('[data-action="irl-add-action"]').disabled, false);
  const on = irlFixture(t, { enabled: true });
  assert.equal(on.document.querySelector('[data-action="irl-toggle"]').checked, true);
  assert.ok(on.document.querySelector(".irl-control-bar.is-enabled"));
});

test("les cinq opérations, identifiants et contrôles d'appareils restent raccordés aux gestionnaires existants", (t) => {
  const { document } = irlFixture(t, { devices: [plug()] });
  const tests = [...document.querySelectorAll('[data-action="irl-test"]')];
  assert.deepEqual(tests.map((node) => node.dataset.operation), ["on", "off", "toggle", "cycle", "pulse"]);
  assert.ok(tests.every((node) => node.dataset.id === "shellyplusplugs-test" && !node.disabled));
  for (const action of ["irl-scan", "irl-add-manual", "irl-pair", "irl-rename", "irl-remove"]) {
    assert.ok(document.querySelector(`[data-action="${action}"]`));
  }
  assert.equal(document.querySelector('[data-action="irl-rename"]').dataset.id, "shellyplusplugs-test");
  assert.equal(document.querySelector('[data-action="irl-remove"]').dataset.id, "shellyplusplugs-test");
});

test("les règles gardent leurs identifiants, index d'action, déclencheurs et commandes", (t) => {
  const { document } = irlFixture(t, { devices: [plug()], actions: [interaction()] });
  for (const action of ["edit-action", "test-action", "delete-action"]) {
    for (const button of document.querySelectorAll(`[data-action="${action}"]`)) {
      assert.equal(button.dataset.rule, "rule_irl");
      assert.equal(button.dataset.id, "action_irl");
      assert.equal(button.dataset.index, "2");
    }
  }
  assert.equal(document.querySelector('[data-action="toggle-rule"]').dataset.id, "rule_irl");
  assert.match(document.querySelector(".irl-interaction-trigger").textContent, /Cadeau Rose/);
  assert.equal(document.querySelector('[data-action="test-action"]').disabled, false);
});

test("les appareils non pilotables et les relais manquants n'autorisent aucun test", (t) => {
  const { document } = irlFixture(t, { devices: [plug({ controllable: false })], actions: [interaction(), interaction({ action: { id: "missing", type: "irl.shelly", config: { deviceId: "absent" } } })] });
  assert.ok([...document.querySelectorAll('[data-action="irl-test"], [data-action="test-action"]')].every((node) => node.disabled));
  assert.equal(document.querySelector('[data-action="irl-add-action"]').disabled, true);
  assert.equal(document.querySelectorAll(".irl-interaction-row.unavailable").length, 2);
  assert.match(document.querySelector(".irl-device-row").textContent, /Mesure uniquement · aucun relais/);
});

test("l'état occupé désactive aussi les commandes de test et les boutons des états vides", (t) => {
  const filled = irlFixture(t, { enabled: true, busy: true, devices: [plug()], actions: [interaction()] });
  assert.ok([...filled.document.querySelectorAll(".irl-page button, .irl-page input[type=checkbox]")].every((node) => node.disabled));
  const empty = irlFixture(t, { busy: true });
  assert.equal(empty.document.querySelector('.irl-empty [data-action="irl-pair"]').disabled, true);
});

test("les états vides et la recherche gardent un parcours clair sans données ni commandes fictives", (t) => {
  const empty = irlFixture(t, { missingSettings: true });
  assert.match(empty.document.querySelector(".irl-empty").textContent, /Aucune prise enregistrée/);
  assert.match(empty.document.querySelector(".irl-actions-empty").textContent, /Associez une prise pilotable/);
  assert.deepEqual([...empty.document.querySelectorAll(".irl-summary-card strong")].map((node) => node.textContent), ["0", "0", "0"]);
  const filtered = irlFixture(t, { devices: [plug()], actions: [interaction()], query: "Aucun résultat" });
  assert.equal(filtered.document.querySelectorAll(".irl-interaction-row").length, 0);
  assert.match(filtered.document.querySelector(".irl-actions-empty").textContent, /ne correspond à cette recherche/);
  const search = irlFixture(t, { devices: [plug()], actions: [interaction()], query: "rose" });
  assert.equal(search.document.querySelectorAll(".irl-interaction-row").length, 1);
});

test("les noms, IP, identifiants, descriptions et recherches sont échappés dans textes et attributs", (t) => {
  const payload = '<img src=x onerror="alert(1)">';
  const escapedDevice = plug({ id: `shellyplusplugs-${payload}`, name: payload, model: `Shelly Plus Plug S ${payload}`, generation: payload, host: payload });
  const escapedRule = interaction({ rule: { id: payload, name: payload }, action: { id: payload, type: "irl.shelly", config: { deviceId: escapedDevice.id }, description: payload } });
  const { document } = irlFixture(t, { devices: [escapedDevice], actions: [escapedRule], query: payload });
  assert.equal(document.querySelectorAll(".irl-page img").length, 1);
  assert.equal(document.querySelectorAll(".irl-page [onerror]").length, 0);
  assert.equal(document.querySelector(".irl-device-name strong").textContent, payload);
  assert.equal(document.querySelector(".irl-device-identity > span").textContent, payload);
  assert.equal(document.querySelector('[data-search="irl-actions"]').value, payload);
  assert.equal(document.querySelector('[data-action="edit-action"]').dataset.rule, payload);
  assert.equal(document.querySelector('[data-action="edit-action"]').dataset.id, payload);
  assert.equal(document.querySelector('[data-action="irl-test"]').dataset.id, escapedDevice.id);
});

test("les deux listes partagent le tableau sémantique sans cartes ni contrôles cachés", (t) => {
  const devices = Array.from({ length: 5 }, (_, index) => plug({ id: `shellyplusplugs-${index}`, name: `Prise ${index}` }));
  const actions = Array.from({ length: 4 }, (_, index) => interaction({ rule: { id: `rule_${index}`, name: `Action ${index}`, enabled: index % 2 === 0 }, action: { id: `action_${index}`, type: "irl.shelly", config: { deviceId: devices[index].id } }, actionIndex: index }));
  const before = JSON.stringify({ devices, actions });
  const { document, context } = irlFixture(t, { devices, actions });
  assert.equal(document.querySelectorAll(".compact-resource-table").length, 2);
  assert.equal(document.querySelectorAll(".irl-devices-table tbody tr").length, 5);
  assert.equal(document.querySelectorAll(".irl-interactions-table tbody tr").length, 4);
  assert.deepEqual([...document.querySelectorAll(".irl-devices-table th")].map((node) => node.textContent), ["Prise", "Réseau", "Adresse / identifiant", "Tests immédiats", "Actions"]);
  assert.ok([...document.querySelectorAll(".compact-resource-table th")].every((node) => node.scope === "col"));
  assert.equal(document.querySelector(".irl-devices-table table").getAttribute("aria-label"), "Mes prises PlugPlus");
  for (const row of document.querySelectorAll(".irl-device-row")) {
    assert.equal(row.querySelectorAll('[data-action="irl-test"]').length, 5);
    assert.equal(row.querySelectorAll("button").length, 7);
    assert.equal(row.querySelectorAll("[hidden], details, [style*=display], [onclick]").length, 0);
    assert.ok([...row.querySelectorAll("button")].every((button) => button.getAttribute("aria-label")));
  }
  assert.equal(document.querySelectorAll(".irl-rule-status.is-paused").length, 2);
  assert.equal(document.querySelectorAll(".irl-device-card, .irl-interaction-card").length, 0);
  context.renderIrl();
  assert.equal(JSON.stringify({ devices, actions }), before, "le rendu ne modifie ni appareils ni interactions");
});

test("une action sans identifiant garde son index et son état en pause; la ligne n'invente pas de relais", (t) => {
  const { document } = irlFixture(t, { actions: [interaction({ rule: { id: "rule-no-id", name: "Sans relais", enabled: false }, action: { type: "irl.shelly", config: { deviceId: "absent" } }, actionIndex: 0 })] });
  const row = document.querySelector(".irl-interaction-row");
  assert.equal(row.dataset.rowId, "rule-no-id:0");
  assert.ok(row.classList.contains("disabled"));
  assert.ok(row.classList.contains("unavailable"));
  assert.equal(row.querySelector('[data-action="edit-action"]').dataset.id, "");
  assert.equal(row.querySelector('[data-action="edit-action"]').dataset.index, "0");
  assert.equal(row.querySelector('[data-action="test-action"]').disabled, true);
  assert.match(row.querySelector(".irl-interaction-target").textContent, /Aucun relais/);
  assert.equal(row.querySelector('[data-action="toggle-rule"]').title, "Activer");
});
