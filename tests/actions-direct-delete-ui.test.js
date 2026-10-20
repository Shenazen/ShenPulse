"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const rendererRoot = path.join(__dirname, "..", "src", "renderer", "app");
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Real renderer functions, without any network, sound, LIVE or IRL side effects. */
function actionContext(t, { confirm = () => false } = {}) {
  const dom = new JSDOM('<main id="content"></main>');
  t.after(() => dom.window.close());
  const calls = [];
  const context = vm.createContext({
    document: dom.window.document,
    window: dom.window,
    escapeHtml,
    structuredClone,
    snapshot: { state: { rules: [] } },
    ACTION_TYPE_LABELS: { delay: "Pause" },
    ACTION_TYPE_ICONS: {},
    isAccountAuthenticated: () => true,
    triggerPill: () => '<span class="trigger-pill">Follow</span>',
    emptyInline: (text) => `<p>${escapeHtml(text)}</p>`,
    registerActionHandler: () => {},
    confirmAction: async (...args) => {
      calls.push(["confirm", ...args]);
      return confirm(...args);
    },
    render: () => calls.push(["render"]),
    api: new Proxy({
      upsert: async (...args) => calls.push(["upsert", ...args]),
      remove: async (...args) => calls.push(["remove", ...args]),
      getSnapshot: async () => {
        calls.push(["getSnapshot"]);
        return context.snapshot;
      }
    }, {
      get(target, property) {
        if (property in target) return target[property];
        throw new Error(`Unexpected API during isolated action UI test: ${String(property)}`);
      }
    }),
    fetch() { throw new Error("No network during action UI tests."); },
    Audio: class { constructor() { throw new Error("No audio during action UI tests."); } }
  });
  for (const relative of ["core/automation-table.js", "features/actions.js", "actions/overlays.js", "actions/handlers/content-commerce.js"]) {
    vm.runInContext(fs.readFileSync(path.join(rendererRoot, relative), "utf8"), context, { filename: relative });
  }
  context.page = dom.window.document.getElementById("content");
  context.calls = calls;
  return context;
}

function sampleRule(actions = [{ id: 'action_"<&', type: "delay", config: { durationMs: 1000 } }]) {
  return { id: 'rule_"<&', name: '<img src=x onerror="bad()"> & action', enabled: true, trigger: { type: "follow" }, actions };
}

function assertDirectCommands(element, rule, action, index) {
  const buttons = [...element.querySelectorAll("button")];
  assert.deepEqual(buttons.map((button) => button.dataset.action), ["test-action", "edit-action", "duplicate-action", "delete-action"]);
  for (const button of buttons) {
    assert.equal(button.type, "button");
    assert.equal(button.dataset.rule, rule.id);
    assert.equal(button.dataset.id, action.id || "");
    assert.equal(button.dataset.index, String(index));
    assert.equal(button.getAttribute("aria-label"), button.title);
    assert.ok(button.title);
    assert.equal(button.querySelector("svg").getAttribute("aria-hidden"), "true");
  }
  const remove = buttons[3];
  assert.equal(remove.classList.contains("is-danger"), true);
  assert.match(remove.getAttribute("aria-label"), /Supprimer/);
  assert.ok(remove.querySelector("svg path"), "The delete command has a visible trash icon.");
  assert.equal(element.querySelector("details, summary, .compact-context-menu"), null);
  assert.equal(element.querySelector("[onclick], [onerror], [onmouseover], script, img, audio, video, iframe"), null);
}

test("Actions has four direct accessible commands, without duplicated context menu commands", (t) => {
  const context = actionContext(t);
  const rule = sampleRule();
  const before = JSON.stringify(rule);
  context.page.innerHTML = context.automationActionCommands(rule, rule.actions[0], 0);
  assertDirectCommands(context.page, rule, rule.actions[0], 0);
  assert.equal(JSON.stringify(rule), before);
  assert.deepEqual(context.calls, []);
});

test("a legacy action without an ID retains its exact index as deletion fallback", (t) => {
  const context = actionContext(t);
  const rule = sampleRule([{ type: "delay", config: { durationMs: 1000 } }]);
  context.page.innerHTML = context.automationActionCommands(rule, rule.actions[0], 7);
  assertDirectCommands(context.page, rule, rule.actions[0], 7);
});

test("multi-action scenarios keep one direct delete per action and preserve their own targets", (t) => {
  const context = actionContext(t);
  const rule = sampleRule([
    { id: 'first_"<&', type: "delay", config: { durationMs: 1000 } },
    { id: 'second_"<&', type: "delay", config: { durationMs: 2000 } }
  ]);
  const rows = rule.actions.map((action, actionIndex) => ({ rule, action, actionIndex }));
  const before = JSON.stringify(rule);
  context.page.innerHTML = context.renderActionWorkflows([{ rule, rows }]);
  assert.equal(context.page.querySelectorAll(".automation-scenario-tools").length, 1, "The existing grouped scenario disclosure remains available.");
  const controls = [...context.page.querySelectorAll(".automation-scenario-action .automation-row-controls")];
  assert.equal(controls.length, 2);
  controls.forEach((control, index) => assertDirectCommands(control, rule, rule.actions[index], index));
  assert.equal(context.page.querySelectorAll(".compact-context-menu").length, 0);
  assert.equal(JSON.stringify(rule), before);
  assert.deepEqual(context.calls, []);
});

async function deleteFromButton(context, rule, index) {
  context.snapshot.state.rules = [rule];
  context.page.innerHTML = context.automationActionCommands(rule, rule.actions[index], index);
  const target = context.page.querySelector('[data-action="delete-action"]');
  return context.handleContentAndCommerceAction({ action: target.dataset.action, target, id: target.dataset.id });
}

test("direct delete awaits confirmation and cancelling leaves the profile untouched", async (t) => {
  let resolveConfirmation;
  const context = actionContext(t, { confirm: () => new Promise((resolve) => { resolveConfirmation = resolve; }) });
  const rule = sampleRule();
  const before = JSON.stringify(rule);
  const pending = deleteFromButton(context, rule, 0);
  assert.deepEqual(context.calls.map(([operation]) => operation), ["confirm"]);
  assert.equal(JSON.stringify(rule), before);
  assert.equal(context.calls[0][2].confirmLabel, "Supprimer");
  resolveConfirmation(false);
  await pending;
  assert.deepEqual(context.calls.map(([operation]) => operation), ["confirm"]);
  assert.equal(JSON.stringify(context.snapshot.state.rules), JSON.stringify([rule]));
});

test("confirmed deletion removes only the targeted action from a scenario", async (t) => {
  const context = actionContext(t, { confirm: () => true });
  const rule = sampleRule([
    { id: 'keep_"<&', type: "delay", config: { durationMs: 1000 } },
    { id: 'delete_"<&', type: "delay", config: { durationMs: 2000 } }
  ]);
  const before = JSON.stringify(rule);
  await deleteFromButton(context, rule, 1);
  assert.deepEqual(context.calls.map(([operation]) => operation), ["confirm", "upsert", "getSnapshot", "render"]);
  const [, collection, nextRule] = context.calls[1];
  assert.equal(collection, "rules");
  assert.equal(nextRule.id, rule.id);
  assert.deepEqual(Array.from(nextRule.actions), [rule.actions[0]]);
  assert.equal(JSON.stringify(rule), before, "The saved rule is not mutated before API completion.");
});

test("confirmed deletion of a sole legacy action removes its own rule by ID", async (t) => {
  const context = actionContext(t, { confirm: () => true });
  const rule = sampleRule([{ type: "delay", config: { durationMs: 1000 } }]);
  await deleteFromButton(context, rule, 0);
  assert.deepEqual(context.calls.map(([operation]) => operation), ["confirm", "remove", "getSnapshot", "render"]);
  assert.deepEqual(context.calls[1], ["remove", "rules", rule.id]);
});

test("a stale delete target cannot silently remove a different action", async (t) => {
  const context = actionContext(t, { confirm: () => true });
  const rule = sampleRule();
  context.snapshot.state.rules = [rule];
  await assert.rejects(context.handleContentAndCommerceAction({
    action: "delete-action",
    target: { dataset: { rule: rule.id, index: "0" } },
    id: "missing-action"
  }), /Action introuvable/);
  assert.deepEqual(context.calls, []);
});
