"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const identity = require("../src/shared/gift-identity");
const { RuleEngine } = require("../src/main/rule-engine");
const { wheelGiftTriggerMatches } = require("../src/main/core/trigger-policy");
const { activationError } = require("../src/shared/game-interaction-validation");

const select = (id, name, excluded = false) => ({ field: "data.giftName", operator: excluded ? "notEquals" : "equals", giftId: id, value: name, giftCost: 1, giftImageUrl: `https://media.example.test/${id}.png` });
const gift = (id, name, count = 1) => ({ id: `event-${id}`, type: "gift", source: "tiktok", user: { id: "viewer", name: "alice" }, data: { giftId: id, giftName: name, count, value: 1 } });
const json = value => JSON.parse(JSON.stringify(value));

function renderer(t) {
  const dom = new JSDOM('<dialog open><form></form></dialog><datalist id="gift-catalog-options"></datalist>');
  t.after(() => dom.window.close());
  const form = dom.window.document.querySelector("form");
  const context = vm.createContext({ document: dom.window.document, window: dom.window, FormData: dom.window.FormData,
    dialog: dom.window.document.querySelector("dialog"), dialogForm: form, dialogBody: form,
    ShenPulseGiftIdentity: identity, giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [],
    rendererFormatters: { integer: new Intl.NumberFormat("fr-FR") } });
  const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
  for (const file of ["core/ui-foundations.js", "editors/core.js", "features/media/gift-picker.js"]) load(file);
  form.addEventListener("click", event => context.handleGiftTriggerSelectionClick(event));
  return { dom, context, form, load };
}

test("plusieurs cadeaux autorisés sont des alternatives, jamais une obligation cumulée", () => {
  const conditions = [select("rose", "Rose"), select("donut", "Donut")];
  assert.equal(identity.giftSelectionMatches(conditions, gift("rose", "Rose")), true);
  assert.equal(identity.giftSelectionMatches(conditions, gift("donut", "Donut")), true);
  assert.equal(identity.giftSelectionMatches(conditions, gift("tiktok", "TikTok")), false);
});

test("une liste d’exclusions autorise tous les autres cadeaux et respecte les IDs exacts", () => {
  const conditions = [select("rose", "Rose", true), select("tiktok", "TikTok", true)];
  assert.equal(identity.giftSelectionMatches(conditions, gift("rose", "Nom localisé")), false);
  assert.equal(identity.giftSelectionMatches(conditions, gift("tiktok", "TikTok")), false);
  assert.equal(identity.giftSelectionMatches(conditions, gift("donut", "Donut")), true);
  assert.equal(identity.giftSelectionMatches(conditions, gift("other-rose", "Rose")), true, "un homonyme n’est pas le cadeau exclu");
});

test("une exclusion prime sur une autorisation du même cadeau, sans bloquer les autres", () => {
  const conditions = [select("rose", "Rose"), select("donut", "Donut"), select("rose", "Rose", true)];
  assert.equal(identity.giftSelectionMatches(conditions, gift("rose", "Rose")), false);
  assert.equal(identity.giftSelectionMatches(conditions, gift("donut", "Donut")), true);
});

test("le moteur applique les listes aux actions globales et aux jeux avec les autres filtres et combos", async () => {
  const base = { enabled: true, trigger: { type: "gift", threshold: 1 }, actions: [{ type: "audio.play", config: { volume: .4 } }] };
  const rules = [{ ...base, id: "global", conditions: [select("rose", "Rose"), select("donut", "Donut"), { field: "user.name", operator: "equals", value: "alice" }] }];
  const gameRule = { ...base, id: "game", trigger: { ...base.trigger, repeatGiftCombos: true }, conditions: [select("rose", "Rose", true)] };
  const state = { rules, profiles: [{ id: "profile", enabledRuleIds: ["global"] }], session: { profileId: "profile", game: { running: true, profileId: "profile", packId: "game" } }, game: { interactionRulesByPack: { game: [gameRule] } } };
  const calls = [], engine = new RuleEngine({ store: { getState: () => state }, actionRunner: { run: async (_action, event) => calls.push(event.rule.id) } });
  await engine.process(gift("rose", "Rose", 5));
  assert.deepEqual(calls, ["global"]);
  await engine.process(gift("donut", "Donut", 5));
  assert.equal(calls.filter(id => id === "global").length, 2);
  assert.equal(calls.filter(id => id === "game").length, 5);
  const other = gift("donut", "Donut"); other.user.name = "bob";
  await engine.process(other);
  assert.equal(calls.filter(id => id === "global").length, 2, "le filtre du viewer continue de s’appliquer");
});

test("les roues acceptent les mêmes listes, et une roue vide reste manuelle", () => {
  const wheel = { enabled: true, giftConditions: [select("rose", "Rose", true)] };
  assert.equal(wheelGiftTriggerMatches(wheel, gift("rose", "Rose")), false);
  assert.equal(wheelGiftTriggerMatches(wheel, gift("donut", "Donut")), true);
  assert.equal(wheelGiftTriggerMatches({ enabled: true, giftConditions: [] }, gift("donut", "Donut")), false);
  assert.equal(wheelGiftTriggerMatches({ ...wheel, enabled: false }, gift("donut", "Donut")), false);
});

test("une interaction de jeu avec des exclusions explicites peut être activée, sans accepter une liste vide", () => {
  const rule = { enabled: true, trigger: { enabled: true, type: "gift" }, actions: [], conditions: [select("rose", "Rose", true)] };
  assert.equal(activationError(rule), "");
  assert.match(activationError({ ...rule, conditions: [] }), /cadeau/);
});

test("le formulaire rouvre toutes les lignes et conserve opérateurs, identifiants et métadonnées", t => {
  const { context, form } = renderer(t);
  const existing = [select("rose", "Rose"), select("donut", "Donut"), select("tiktok", "TikTok", true)];
  form.innerHTML = context.giftTriggerConditionFields(existing, { repeatGiftCombos: true });
  assert.equal(form.querySelectorAll("[data-gift-trigger-row]").length, 3);
  assert.deepEqual(json(context.buildTriggerConditions(existing, new context.FormData(form))), existing);
  assert.equal(form.querySelector('[name="repeatGiftCombos"]').checked, true);
  assert.match(context.giftSelectionLabel(existing), /Rose ou Donut sauf TikTok/);
});

test("+ ajoute une ligne, − la retire, et l’enregistrement ne mélange pas les références restantes", t => {
  const { context, form } = renderer(t), existing = [select("rose", "Rose"), select("donut", "Donut")];
  form.innerHTML = context.giftTriggerConditionFields(existing);
  form.querySelector("[data-gift-trigger-add]").click();
  assert.equal(form.querySelectorAll("[data-gift-trigger-row]").length, 3);
  const extra = form.querySelectorAll("[data-gift-trigger-row]")[1];
  extra.querySelector("[data-gift-picker]").value = "TikTok";
  extra.querySelector("[data-gift-id-input]").value = "tiktok";
  extra.querySelector("select").value = "notEquals";
  form.querySelector("[data-gift-trigger-remove]").click();
  const saved = json(context.buildTriggerConditions(existing, new context.FormData(form)));
  assert.deepEqual(saved.map(item => [item.giftId, item.operator]), [["tiktok", "notEquals"], ["donut", "equals"]]);
  assert.equal(saved[1].giftImageUrl, existing[1].giftImageUrl);
});

test("les lignes vides sont ignorées et changer de méthode retire seulement la sélection de cadeaux", t => {
  const { context, form } = renderer(t), existing = [select("rose", "Rose", true), { field: "platform", operator: "equals", value: "tiktok" }];
  form.innerHTML = context.giftTriggerConditionFields(existing);
  form.querySelector("[data-gift-trigger-add]").click();
  assert.deepEqual(json(context.buildTriggerConditions(existing, new context.FormData(form))), [existing[1], existing[0]]);
  form.querySelector('[data-gift-trigger-mode][value="value"]').checked = true;
  context.syncGiftTriggerCondition(form.querySelector("[data-gift-trigger-condition]"));
  form.querySelector('[name="giftValueAmount"]').value = "10";
  assert.deepEqual(json(context.buildTriggerConditions(existing, new context.FormData(form))), [existing[1], { field: "data.value", operator: "greaterOrEqual", value: 10 }]);
});

test("les roues sauvegardent et rouvrent plusieurs exclusions sans réactiver un ancien cadeau", t => {
  const { context, form, load } = renderer(t); load("features/overlays/fields.js");
  const conditions = [select("rose", "Rose", true), select("tiktok", "TikTok", true)];
  const wheel = { id: "wheel", trigger: "Ancien cadeau", giftConditions: conditions, settings: {}, segments: [] };
  context.wheelEditorContext = { config: { selectedWheelId: wheel.id, wheels: [wheel] } };
  form.innerHTML = context.giftTriggerConditionFields(conditions, { giftName: "wheelTrigger", modeName: "wheelGiftTriggerMode", operatorName: "wheelGiftValueOperator", amountName: "wheelGiftValueAmount" });
  context.collectWheelEditorForm();
  assert.equal(wheel.trigger, ""); assert.equal(wheel.triggerGift, null);
  assert.deepEqual(json(wheel.giftConditions), conditions);
  assert.deepEqual(json(context.wheelGiftValueConditions(wheel)), conditions);
});
