"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const catalog = require("../resources/overlays/overlay-catalog");

const { actionEditorFixture } = require("./helpers/action-editor-fixture");
function editor(t, config) {
  const action = { id: "existing-match-action", type: "overlay.match", config };
  const h = actionEditorFixture(t, { actions: [action] });
  const name = h.form.querySelector('[name="matchName"]'), variant = h.form.querySelector('[name="matchVariant"]');
  return { ...h, name, variant, config,
    changeMatch: match => { name.value = match; name.dispatchEvent(new h.window.Event("change", { bubbles: true })); },
    versions: () => [...variant.options].map(option => option.value) };
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
    assert.deepEqual(h.versions(), ["tikcontrol", "gladiador", "cyber", "dragon"]);
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
    match: "x2", variant: "cyber", fit: "cover", legacy: "preserved", volume: 1
  });
  assert.equal(config.variant, "gladiador", "l’ancien objet n’est pas muté");
});

test("un formulaire forgé Coffre Cyber est refusé sans aucune écriture", async (t) => {
  const h = editor(t, { match: "cofre", variant: "gladiador" });
  h.variant.add(new h.window.Option("Forgé", "cyber", true, true));
  await assert.rejects(() => h.save(), /indisponible/);
  assert.deepEqual(h.calls, []);
});
