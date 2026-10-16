"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { GAME_INSTALLERS } = require("../src/main/game-installer-manifest");

/** Exécute la sélection du dossier sans dialogue natif, registre ni lecture du jeu. */
function fixture(manifest, response = 0) {
  const detected = path.resolve("fixture-only", "jeu-installe");
  const dialogs = [];
  const validations = [];
  const window = {};
  const runtime = {
    store: { getState: () => ({ game: { installations: {} } }) },
    getWindow: () => window,
    dialog: {
      async showMessageBox(owner, options) {
        assert.equal(owner, window);
        dialogs.push(options);
        return { response };
      },
      async showOpenDialog() { throw new Error("Aucun dialogue natif n’est autorisé dans ce test."); }
    },
    async validateTarget(directory, options) { validations.push({ directory, options }); },
    async showInvalidTarget() { throw new Error("Le dossier de la fixture est valide."); }
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "../src/main/game-runtime/target-selection.js"), "utf8");
  vm.runInNewContext(source, {
    module,
    require(id) {
      if (id === "node:fs") return fs;
      if (id === "node:path") return path;
      if (id === "../state-projection") return { readState: (store) => store.getState() };
      if (id === "./paths") return { findLaunchTarget() { throw new Error("Pas de lecture du jeu réel."); } };
      if (id === "./discovery") return { async detectInstalledGame() { return detected; } };
      throw new Error(`Dépendance de dialogue non prévue : ${id}`);
    }
  }, { filename: "isolated-game-target-selection.js" });
  return { pickTarget: () => module.exports.pickTarget(runtime, "fixture-game", manifest), detected, dialogs, validations };
}

test("la confirmation de Find The Needle Demo décrit le mod local et les sauvegardes", async () => {
  const manifest = GAME_INSTALLERS["find-the-needle-demo"];
  const f = fixture(manifest);
  assert.equal(await f.pickTarget(), f.detected);
  assert.equal(f.dialogs.length, 1);
  const dialog = f.dialogs[0];
  assert.equal(dialog.title, "Confirmer le dossier de Find The Needle Demo");
  assert.equal(dialog.buttons[0], "Oui, installer le mod local ici");
  assert.match(dialog.detail, /mod ZIP que vous fournissez/);
  assert.match(dialog.detail, /fichiers remplacés seront sauvegardés/);
  assert.match(dialog.detail, /autres réglages de override.cfg seront conservés/);
  assert.match(dialog.detail, /Aucun mod n’est téléchargé par ShenPulse/);
  assert.match(dialog.detail, /Fermez le jeu/);
  assert.equal(f.validations.length, 1);
  assert.equal(f.validations[0].directory, f.detected);
  assert.equal(f.validations[0].options, manifest);
});

test("une simple préparation setupOnly continue à ne promettre aucune modification du jeu", async () => {
  const f = fixture(GAME_INSTALLERS.demonologist);
  await f.pickTarget();
  assert.equal(f.dialogs[0].buttons[0], "Oui, associer ce dossier");
  assert.match(f.dialogs[0].detail, /Aucun fichier du jeu ne sera téléchargé, ajouté ou modifié/);
});

test("les véritables installations conservent leur confirmation de téléchargement", async () => {
  const f = fixture(GAME_INSTALLERS["resident-evil-3"]);
  assert.equal(await f.pickTarget(), f.detected);
  assert.equal(f.dialogs[0].buttons[0], "Oui, installer ici");
  assert.match(f.dialogs[0].detail, /avant de télécharger et d’installer les fichiers/);
  assert.equal(f.validations.length, 1);
});

test("annuler l’association de la démo ne valide ni ne mémorise le dossier", async () => {
  const f = fixture(GAME_INSTALLERS["find-the-needle-demo"], 2);
  assert.equal(await f.pickTarget(), "");
  assert.equal(f.dialogs.length, 1);
  assert.equal(f.validations.length, 0);
});
