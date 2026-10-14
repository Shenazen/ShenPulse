"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const rendererRoot = path.join(__dirname, "..", "src", "renderer");
const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

/** Le rendu est testé avec un API interdit : il ne doit jamais diffuser de son. */
function audioTableContext(t) {
  const dom = new JSDOM("<main></main>");
  t.after(() => dom.window.close());
  const state = { settings: { tts: { voice: "Hortense", volume: 0.75 } } };
  const context = vm.createContext({
    document: dom.window.document,
    window: dom.window,
    snapshot: { state },
    escapeHtml: escape,
    canAccessFeature: () => true,
    isLiveAudioOutput: (config) => config?.outputMode === "live",
    normalizedLiveScreen: (config) => Number(config?.liveScreen || 1),
    actionDescription: (action) => action.config?.soundName || "Son local",
    triggerPill: (rule) => `<span class="trigger-pill">${escape(rule.trigger?.type)}</span>`,
    emptyInline: (label) => `<p>${escape(label)}</p>`,
    api: new Proxy({}, { get() { throw new Error("Aucune exécution attendue pendant le rendu audio."); } }),
    fetch() { throw new Error("Aucune requête audio attendue."); },
    setTimeout() { throw new Error("Aucun timer audio attendu."); }
  });
  for (const file of ["core/automation-table.js", "features/audio.js"]) {
    vm.runInContext(fs.readFileSync(path.join(rendererRoot, "app", file), "utf8"), context, { filename: file });
  }
  context.page = dom.window.document.querySelector("main");
  return context;
}

function soundRow({ id = "sound", enabled = true, live = false, index = 2 } = {}) {
  return {
    rule: { id: `${id}_rule`, name: `Alerte ${id}`, enabled, trigger: { type: "follow" } },
    action: { id: `${id}_action`, type: "audio.play", config: { soundName: "Bienvenue à bord", volume: 0.45, outputMode: live ? "live" : "local", liveScreen: 3 } },
    actionIndex: index
  };
}

test("les alertes affichent une ligne de tableau compacte et gardent toutes leurs commandes", (t) => {
  const context = audioTableContext(t);
  const rows = [soundRow(), soundRow({ id: "live", live: true, enabled: false, index: 4 })];
  const before = JSON.stringify(rows);
  context.page.innerHTML = context.renderAudioAlerts(rows);
  const rendered = [...context.page.querySelectorAll("tr.audio-alert-card")];
  assert.equal(rendered.length, 2);
  assert.equal(context.page.querySelectorAll(".audio-card-list, article.audio-rule-card").length, 0);
  assert.equal(rendered[0].querySelectorAll("td").length >= 6, true);
  assert.match(rendered[0].textContent, /Alerte sound.*follow.*Play Bienvenue à bord.*Moi uniquement/s);
  for (const [index, row] of rendered.entries()) {
    for (const action of ["test-action", "edit-sound", "duplicate-action", "delete-action", "set-sound-volume", "set-audio-output"]) {
      const control = row.querySelector(`[data-action="${action}"]`);
      assert.ok(control, action);
      assert.equal(control.dataset.rule, rows[index].rule.id, action);
      assert.equal(control.dataset.id, rows[index].action.id, action);
      assert.equal(control.dataset.index, String(rows[index].actionIndex), action);
    }
    const status = row.querySelector('[data-action="toggle-rule"]');
    assert.equal(status.dataset.id, rows[index].rule.id);
    assert.equal(status.checked, rows[index].rule.enabled);
    assert.equal(row.querySelector("details.audio-row-settings").open, false);
    assert.equal(row.querySelector('[data-sound-volume]').value, "0.45");
    const tools = row.querySelector(".automation-row-controls");
    assert.equal(tools.querySelectorAll("button").length, 4);
    assert.equal(tools.querySelectorAll("details, summary, .compact-context-menu").length, 0);
    assert.equal(row.querySelectorAll('[data-action="edit-sound"]').length, 1);
    const remove = tools.querySelector('[data-action="delete-action"]');
    assert.equal(remove.parentElement, tools, "Supprimer est accessible directement, sans menu extensible.");
    assert.equal(remove.getAttribute("aria-label"), "Supprimer");
    assert.equal(remove.classList.contains("is-danger"), true);
    assert.ok(remove.querySelector('svg[aria-hidden="true"]'));
  }
  assert.match(rendered[0].querySelector('[data-action="test-action"]').title, /uniquement sur cet ordinateur/);
  assert.match(rendered[1].querySelector('[data-action="test-action"]').title, /dans le LIVE/);
  assert.equal(rendered[0].querySelector('[data-action="set-audio-output"]').checked, false);
  assert.equal(rendered[1].querySelector('[data-action="set-audio-output"]').checked, true);
  assert.equal(rendered[0].querySelector('[data-action="configure-audio-output"]'), null);
  assert.equal(rendered[1].querySelector('[data-action="configure-audio-output"]').dataset.index, "4");
  assert.equal(context.page.querySelector("audio, video"), null);
  assert.equal(JSON.stringify(rows), before, "Le tableau ne change aucun réglage.");
});

test("les règles vocales utilisent le même tableau sans perdre voix, sorties ou outils", (t) => {
  const context = audioTableContext(t);
  const row = soundRow({ id: "voice", live: true });
  row.action.type = "tts.speak";
  row.action.config.voice = "Paul";
  row.action.config.volume = 0.6;
  row.rule.trigger.type = "chat";
  context.page.innerHTML = context.renderTtsRules([row]);
  const rendered = context.page.querySelector("tr.tts-rule-card");
  assert.ok(rendered);
  assert.match(rendered.textContent, /Lecture du commentaire/);
  assert.match(rendered.querySelector("details.audio-row-settings").textContent, /VOIX.*Paul.*60 %.*LIVE · Écran 3/s);
  for (const action of ["test-action", "edit-tts", "duplicate-action", "delete-action", "set-audio-output", "configure-audio-output"]) {
    assert.equal(rendered.querySelector(`[data-action="${action}"]`).dataset.id, "voice_action");
  }
  assert.equal(context.page.querySelectorAll('[data-action="preview-tts"]').length, 1);
  assert.ok(context.page.querySelector('[data-action="add-tts"]'));
  assert.equal(rendered.querySelector("details.audio-row-settings").open, false);
  assert.equal(rendered.querySelectorAll('[data-action="edit-tts"]').length, 1);
  assert.equal(rendered.querySelectorAll(".automation-row-controls > button").length, 4);
  assert.equal(rendered.querySelector(".compact-context-menu"), null);
  assert.equal(rendered.querySelector('[data-action="delete-action"]').classList.contains("is-danger"), true);
  assert.equal(context.page.querySelector("audio, video"), null);
});

test("les noms, voix et identifiants audio sont échappés dans les nouvelles lignes", (t) => {
  const context = audioTableContext(t);
  const row = soundRow();
  row.rule.name = '<img src=x onerror="alert(1)">';
  row.action.config.soundName = "<script>bad()</script>";
  row.action.id = 'sound" data-danger="true';
  row.rule.id = 'rule" data-danger="true';
  context.page.innerHTML = context.renderAudioAlerts([row]);
  assert.equal(context.page.querySelector("script, img, [data-danger]"), null);
  assert.match(context.page.textContent, /<img src=x onerror="alert\(1\)">/);
  assert.equal(context.page.querySelector('[data-action="test-action"]').dataset.id, row.action.id);
  assert.equal(context.page.querySelector('[data-action="delete-action"]').dataset.id, row.action.id);
  assert.equal(context.page.querySelector('[data-action="delete-action"]').dataset.rule, row.rule.id);
  assert.equal(context.page.querySelector('[data-action="toggle-rule"]').dataset.id, row.rule.id);
  row.action.type = "tts.speak";
  row.action.config.voice = "<svg onload=bad()>";
  context.page.innerHTML = context.renderTtsRules([row]);
  assert.equal(context.page.querySelector("svg[onload]"), null);
  assert.match(context.page.textContent, /<svg onload=bad\(\)>/);
});

test("le clic sur la corbeille audio et voix garde le contrat et la confirmation de suppression", async (t) => {
  const context = audioTableContext(t);
  const sound = soundRow({ id: 'son"<&', index: 2 });
  const voice = soundRow({ id: "voice", index: 4 });
  voice.action.type = "tts.speak";
  voice.action.id = ""; // Les anciens profils peuvent n'avoir qu'un index d'action.
  const rows = [sound, voice];
  for (const row of rows) {
    row.rule.actions = Array.from({ length: row.actionIndex }, (_value, index) => ({
      id: `autre_${index}`, type: "delay", config: { durationMs: 1 }
    })).concat(row.action);
  }
  context.snapshot.state.rules = rows.map((row) => row.rule);
  context.page.innerHTML = context.renderAudioAlerts([sound]) + context.renderTtsRules([voice]);
  const before = JSON.stringify(context.snapshot.state);
  const confirmations = [];
  context.confirmAction = async (...arguments_) => { confirmations.push(arguments_); return false; };
  context.ACTION_TYPE_LABELS = { "audio.play": "Son", "tts.speak": "Voix" };
  context.ACTION_NOT_HANDLED = Symbol("not-handled");
  context.registerActionHandler = (actions, handler) => {
    assert.equal(actions.has("delete-action"), true);
    context.registeredHandler = handler;
  };
  for (const file of ["features/actions.js", "actions/overlays.js", "actions/handlers/content-commerce.js"]) {
    vm.runInContext(fs.readFileSync(path.join(rendererRoot, "app", file), "utf8"), context, { filename: file });
  }
  let clickResult;
  context.page.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (target) clickResult = context.registeredHandler({ action: target.dataset.action, target, id: target.dataset.id });
  });
  for (const remove of context.page.querySelectorAll('[data-action="delete-action"]')) {
    remove.querySelector("svg").dispatchEvent(new context.window.MouseEvent("click", { bubbles: true }));
    await clickResult;
  }
  assert.deepEqual(confirmations.map(([message]) => message), ['Supprimer l’action « Son » ?', 'Supprimer l’action « Voix » ?']);
  for (const [, options] of confirmations) {
    assert.equal(options.title, "Supprimer cette action");
    assert.equal(options.confirmLabel, "Supprimer");
  }
  assert.equal(JSON.stringify(context.snapshot.state), before, "Une suppression annulée ne change aucune règle.");
  assert.equal(context.page.querySelectorAll("details[open], .compact-context-menu").length, 0);
  assert.equal(context.page.querySelectorAll('[data-action="delete-action"]').length, 2);
});

test("les tableaux vides conservent création et restrictions d’import", (t) => {
  const context = audioTableContext(t);
  context.canAccessFeature = () => false;
  context.page.innerHTML = context.renderAudioAlerts([]);
  assert.equal(context.page.querySelector('[data-action="upload-sound"]'), null);
  assert.ok(context.page.querySelector('[data-action="add-sound"]'));
  assert.equal(context.page.querySelector("tr.audio-rule-card"), null);
  assert.match(context.page.textContent, /Aucune alerte sonore/);
  context.page.innerHTML = context.renderTtsRules([]);
  assert.ok(context.page.querySelector('[data-action="add-tts"]'));
  assert.equal(context.page.querySelector("tr.tts-rule-card"), null);
  assert.match(context.page.textContent, /Aucune règle de synthèse vocale/);
});

test("la planification reprend les styles et icônes sans changer les contrats des timers", (t) => {
  const context = audioTableContext(t);
  const timer = { id: 'timer"test', name: "Minuteur", enabled: true, intervalMs: 60000, repeatCount: 2, repeatDelayMs: 1000, actionIds: ["linked"] };
  context.scheduledTimers = () => [timer];
  context.flattenActions = () => [{ rule: { name: "Alerte liée" }, action: { id: "linked", type: "audio.play" } }];
  context.actionTypeLabel = () => "Son";
  context.snapshot.timerRuntime = [{ id: timer.id, running: false, nextRunAt: "2026-10-14T10:00:00Z" }];
  context.formatTime = (value) => value;
  const before = JSON.stringify(timer);
  context.page.innerHTML = context.renderTimersPanel();
  const table = context.page.querySelector(".timers-data-table.automation-table");
  assert.ok(table);
  assert.equal(table.querySelectorAll("thead th").length, 7);
  assert.equal(table.querySelectorAll("tbody tr").length, 1);
  assert.equal(table.querySelectorAll("tbody td").length, 7);
  for (const action of ["test-timer", "edit-timer", "delete-entity"]) {
    const control = table.querySelector(`[data-action="${action}"]`);
    assert.equal(control.dataset.id, timer.id);
    assert.ok(control.querySelector("svg[aria-hidden=true]"));
  }
  assert.equal(table.querySelector('[data-action="delete-entity"]').dataset.collection, "timers");
  assert.equal(table.querySelector('[data-action="toggle-timer"]').checked, true);
  assert.equal(table.querySelector('[data-action="toggle-timer"]').dataset.id, timer.id);
  assert.match(table.textContent, /Toutes les 1 minute.*× 2.*1 s.*Alerte liée.*2026-10-14T10:00:00Z/s);
  assert.equal(JSON.stringify(timer), before);
});
