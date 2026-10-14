"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");

/** Vrai éditeur et vrai handler de formulaire, avec persistance simulée. */
function editor(t, config) {
  const dom = new JSDOM('<dialog><form></form></dialog><main></main>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const window = dom.window, form = window.document.querySelector("form"), calls = [];
  const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const action = { id: "existing-match-action", type: "overlay.match", config };
  const rule = { id: "existing-match-rule", name: "Mon animation", enabled: true,
    trigger: { enabled: false, type: "gift", threshold: 1 }, conditions: [], actions: [action] };
  const snapshot = { packs: [], state: { session: {}, settings: { tts: {} }, goals: [], connections: [] } };
  Object.assign(window, {
    overlayCatalog: catalog,
    MATCH_OVERLAYS: catalog.matches.map(({ key, name, match }) => [key, name, match]),
    snapshot, dialog: window.document.querySelector("dialog"), dialogBody: form,
    content: window.document.querySelector("main"), escapeHtml: escape,
    ACTION_TYPE_LABELS: { "overlay.match": "Animation Match" },
    hasAutomaticTrigger: () => false, visibleGamePacks: () => [], canAccessActionType: () => true,
    isPlugPlusIrlDevice: () => false,
    overlayConfig: () => ({}), normalizeWheelConfig: () => ({ wheels: [] }), flattenActions: () => [],
    conditionalFields: (_type, markup) => markup,
    field: (name, _label, value) => `<input name="${name}" value="${escape(value)}">`,
    mediaPickerField: () => "", soundPickerField: () => "", ttsVoiceField: () => "", ttsCommentFilterFields: () => "",
    actionTypeOptions: () => '<option value="overlay.match">Animation Match</option>',
    triggerTypeOptions: () => '<option value="gift">Cadeau</option>', giftTriggerConditionFields: () => "",
    conditionValue: () => "", dialogSection: (_title, _text, body, _className, extra = "") => body + extra,
    openEditor: (options) => { window.editorOptions = options; form.innerHTML = options.body; },
    api: { upsert: async (...args) => calls.push(args), getSnapshot: async () => snapshot },
    ensureRuleInActiveProfile: async () => {}, cryptoId: () => "fixture-new"
  });
  const source = path.resolve(__dirname, "../src/renderer/app");
  for (const relative of ["editors/action-core.js", "core/events/content.js"]) {
    vm.runInContext(fs.readFileSync(path.join(source, relative), "utf8"), dom.getInternalVMContext());
  }
  window.openActionEditor({ rule, action, actionIndex: 0 });
  const name = form.querySelector('[name="matchName"]'), variant = form.querySelector('[name="matchVariant"]');
  const changeMatch = (match) => { name.value = match; name.dispatchEvent(new window.Event("change", { bubbles: true })); };
  const versions = () => [...variant.options].map((option) => option.value);
  return { window, form, name, variant, changeMatch, versions, calls, rule, config };
}

test("ouvrir une action Coffre ne propose pas Cyber et ne modifie rien avant sauvegarde", (t) => {
  const config = { match: "cofre", variant: "gladiador", fit: "cover", legacy: "preserved" };
  const h = editor(t, config);
  assert.deepEqual(h.versions(), ["tikcontrol", "gladiador"]);
  assert.equal(h.variant.value, "gladiador");
  assert.deepEqual(config, { match: "cofre", variant: "gladiador", fit: "cover", legacy: "preserved" });
  assert.deepEqual(h.calls, []);
});

test("les six animations importées proposent Cyber dans le véritable éditeur partagé", (t) => {
  const h = editor(t, { match: "x2", variant: "cyber" });
  for (const match of ["guantes", "x2", "x3", "taptap", "quiereme", "snipe"]) {
    h.changeMatch(match);
    assert.deepEqual(h.versions(), ["tikcontrol", "gladiador", "cyber"]);
    assert.equal(h.variant.value, "cyber", `le choix reste disponible pour ${match}`);
  }
  assert.deepEqual(h.calls, []);
});

test("changer d’animation conserve un choix compatible ou replie seulement le brouillon vers TikControl", (t) => {
  const config = { match: "x2", variant: "cyber", fit: "contain" };
  const h = editor(t, config);
  h.changeMatch("cofre");
  assert.deepEqual(h.versions(), ["tikcontrol", "gladiador"]);
  assert.equal(h.variant.value, "tikcontrol");
  assert.equal(config.variant, "cyber", "la configuration sauvegardée n’a pas été réécrite");
  h.variant.value = "gladiador";
  h.changeMatch("x3");
  assert.equal(h.variant.value, "gladiador");
  h.changeMatch("enigma");
  assert.deepEqual(h.versions(), ["tikcontrol"]);
  assert.equal(h.variant.value, "tikcontrol");
  assert.deepEqual(h.calls, []);
});

test("une sauvegarde explicite Cyber conserve l’identité de l’action et ses champs historiques", async (t) => {
  const config = { match: "x2", variant: "gladiador", fit: "cover", legacy: "preserved" };
  const h = editor(t, config);
  h.variant.value = "cyber";
  await h.window.editorOptions.onSubmit(new h.window.FormData(h.form));
  assert.equal(h.calls.length, 1);
  const [collection, updated] = h.calls[0];
  assert.equal(collection, "rules");
  assert.equal(updated.id, h.rule.id);
  assert.equal(updated.actions[0].id, "existing-match-action");
  assert.deepEqual(JSON.parse(JSON.stringify(updated.actions[0].config)), {
    match: "x2", variant: "cyber", fit: "cover", legacy: "preserved"
  });
  assert.equal(config.variant, "gladiador", "l’ancien objet n’est pas muté");
});

test("un formulaire forgé Coffre Cyber est refusé sans aucune écriture", async (t) => {
  const h = editor(t, { match: "cofre", variant: "gladiador" });
  const data = new h.window.FormData(h.form);
  data.set("matchVariant", "cyber");
  await assert.rejects(() => h.window.editorOptions.onSubmit(data), /indisponible/);
  assert.deepEqual(h.calls, []);
});
