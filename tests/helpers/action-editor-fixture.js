"use strict";
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../../resources/overlays/overlay-catalog");
const root = path.resolve(__dirname, "../../src/renderer/app");

function actionEditorFixture(t, { actions = [{ id: "media-a", type: "overlay.media", config: { mediaUrl: "https://example.test/a.gif", durationMs: 5000 } }], ruleOverrides = {}, externalActions = [] } = {}) {
  const dom = new JSDOM('<dialog open><form></form></dialog><main></main>', { runScripts: "outside-only" });
  t?.after?.(() => dom.window.close());
  const window = dom.window, form = window.document.querySelector("form"), calls = [];
  const load = relative => vm.runInContext(fs.readFileSync(path.join(root, relative), "utf8"), dom.getInternalVMContext());
  load("editors/core.js");
  const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bootstrap = fs.readFileSync(path.join(root, "core/bootstrap.js"), "utf8");
  const constant = name => vm.runInNewContext(bootstrap.match(new RegExp(`const ${name} = \\{[\\s\\S]*?\\n\\};`))[0] + `\n${name}`);
  const rule = { id: "existing-rule", name: "Mon scénario", enabled: true,
    trigger: { enabled: false, type: "gift", threshold: 1 }, conditions: [], actions, ...ruleOverrides };
  const snapshot = { packs: [], state: { session: {}, settings: { tts: {} }, goals: [], connections: [], rules: [rule] } };
  Object.assign(window, {
    overlayCatalog: catalog, MATCH_OVERLAYS: catalog.matches.map(({ key, name, match }) => [key, name, match]),
    ShenPulseActionAudio: require("../../src/shared/action-audio"),
    snapshot, dialog: window.document.querySelector("dialog"), dialogBody: form, content: window.document.querySelector("main"), escapeHtml: escape,
    accountMenu: { hidden: true }, accountMenuButton: { setAttribute() {} },
    ACTION_TYPE_LABELS: constant("ACTION_TYPE_LABELS"), ACTION_TYPE_ICONS: constant("ACTION_TYPE_ICONS"),
    canonicalActionType: type => type === "overlay.alert" ? "overlay.media" : type,
    hasAutomaticTrigger: value => value.trigger?.enabled === true, visibleGamePacks: () => [], canAccessActionType: () => true,
    isPlugPlusIrlDevice: () => false, overlayConfig: () => ({}), normalizeWheelConfig: () => ({ wheels: [] }),
    flattenActions: () => [...actions, ...externalActions].map((action, actionIndex) => ({ action, actionIndex, rule })),
    field: (name, label, value, type = "text", attributes = "") => `<label class="field${attributes.includes("full") ? " full" : ""}"><span>${label}</span><input name="${name}" type="${type}" value="${escape(value)}" ${attributes}></label>`,
    mediaPickerField: (name, label, value = "", mediaName = "") => `<label>${label}<input type="hidden" name="${name}" value="${escape(value)}"><input type="hidden" name="${name}Name" value="${escape(mediaName)}"></label>`,
    soundPickerField: (name, value = "") => `<input type="hidden" name="${name}" value="${escape(value)}">`,
    ttsVoiceField: () => "", ttsCommentFilterFields: () => "", giftTriggerConditionFields: () => "",
    triggerTypeOptions: () => '<option value="gift">Cadeau</option>', conditionValue: () => "",
    dialogSection: (title, text, body, className = "", extra = "") => `<section class="dialog-section ${className}"><header><h3>${title}</h3><p>${text}</p>${extra}</header><div class="form-grid">${body}</div></section>`,
    openEditor: options => { window.editorOptions = options; form.innerHTML = options.body; window.syncActionEditorVisibility(); },
    api: { upsert: async (...args) => calls.push(args), getSnapshot: async () => snapshot },
    ensureRuleInActiveProfile: async () => {}, cryptoId: () => "fixture-new", toast: () => {},
    actionTypeLabel: type => window.ACTION_TYPE_LABELS[type] || type,
    actionTypeOptionLabel: type => `${window.ACTION_TYPE_ICONS[type] || ''} ${window.ACTION_TYPE_LABELS[type] || type}`,
    actionDescription: action => action.type
  });
  for (const file of ["features/action-sounds.js", "editors/alert-display.js", "editors/action-config-fields.js", "editors/action-config-save.js", "editors/action-components.js", "editors/action-core.js", "editors/game-interactions.js", "core/events/content.js"]) load(file);
  window.openActionEditor({ rule, action: actions[0], actionIndex: 0 });
  const selectType = (index, type) => {
    const select = form.querySelectorAll("[data-action-part-type]")[index];
    select.value = type; select.dispatchEvent(new window.Event("change", { bubbles: true }));
  };
  return { dom, window, form, calls, rule, snapshot, selectType,
    parts: () => [...form.querySelectorAll("[data-action-component]")],
    add: (index = 0) => form.querySelectorAll("[data-action-part-add]")[index].click(),
    remove: (index = 0) => form.querySelectorAll("[data-action-part-remove]")[index].click(),
    save: () => window.editorOptions.onSubmit(new window.FormData(form)) };
}

module.exports = { actionEditorFixture };
