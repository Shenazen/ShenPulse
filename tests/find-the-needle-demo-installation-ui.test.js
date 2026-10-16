"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const GAME_ID = "find-the-needle-demo";

/** Rendu isolé : aucun compte, IPC, réseau, lancement ou installation réelle. */
function render({ associated = false, legacyAssociation = false, busy = false, unlocked = true, packId = GAME_ID } = {}) {
  const installation = { installedAt: "2026-10-15T12:00:00Z", source: legacyAssociation ? "local-setup" : "user-provided-mod", installerVersion: legacyAssociation ? "1.0.0" : "1.1.0" };
  const context = vm.createContext({
    snapshot: { state: { game: { installations: associated ? { [packId]: installation } : {} } } },
    gameInstallBusyId: busy ? packId : "",
    MANAGED_BIZHAWK_GAME_IDS: new Set(),
    CONFIGURABLE_INTEGRATED_GAMES: new Set(),
    AUTOMATED_GAME_INSTALLERS: new Set([GAME_ID, "ordinary-game"]),
    MINECRAFT_MODE_IDS: [],
    escapeHtml: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"),
    renderGamePageMessage: () => "",
    formatAdminDate: () => "15/10/2026"
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/features/games/overlay-cards.js"), "utf8"), context);
  const html = context.renderGameInstallation({ id: packId, name: "Find The Needle Demo", installerVersion: "9.9.9", guide: { mode: "native" } }, unlocked);
  return JSDOM.fragment(html);
}

test("la démo non préparée demande son ZIP local sans prétendre distribuer le mod", () => {
  const view = render();
  assert.match(view.textContent, /Installer votre mod local/);
  assert.match(view.textContent, /ZIP Find The Needle v1 que vous fournissez/);
  assert.match(view.textContent, /Les scripts du mod sont ajoutés au jeu/);
  assert.match(view.textContent, /autres réglages sont conservés et les fichiers remplacés sauvegardés/);
  assert.match(view.textContent, /ShenPulse ne contient et ne distribue pas ce mod tiers/);
  assert.doesNotMatch(view.textContent, /Installer automatiquement|Mettre à jour le pack|Aucun patch ni mod n’est installé|copie des éléments.*automatisés/);
  const association = view.querySelector('[data-action="install-game"]');
  assert.equal(association.textContent, "Installer le mod local");
  assert.equal(association.dataset.id, GAME_ID);
  assert.equal(association.disabled, false);
  assert.equal(view.querySelector('[data-value="interactions"]').disabled, true);
});

test("la démo modifiée ouvre les interactions uniquement après installation du mod", () => {
  const view = render({ associated: true });
  assert.match(view.textContent, /Mod de la démo installé/);
  assert.match(view.textContent, /Interactions locales de Find The Needle Demo préparées/);
  assert.match(view.textContent, /Mod installé le 15\/10\/2026/);
  assert.equal(view.querySelector('[data-action="install-game"]').textContent, "Vérifier ou réinstaller le mod local");
  assert.equal(view.querySelector('[data-value="interactions"]').disabled, false);
  assert.doesNotMatch(view.textContent, /mise à jour du pack|Réparer|téléchargement.*automatisés/i);
});

test("l’ancienne association de dossier seule n’est jamais présentée comme un mod installé", () => {
  const view = render({ associated: true, legacyAssociation: true });
  assert.match(view.textContent, /La simple association du dossier ne suffit pas/);
  assert.equal(view.querySelector('[data-value="interactions"]').disabled, true);
  assert.equal(view.querySelector('[data-action="install-game"]').textContent, "Installer le mod local");
});

test("association en cours et accès verrouillé désactivent les commandes de préparation", () => {
  const pending = render({ associated: true, busy: true });
  assert.equal(pending.querySelector('[data-action="install-game"]').textContent, "Installation du mod en cours…");
  assert.equal(pending.querySelector('[data-action="install-game"]').disabled, true);
  assert.equal(pending.querySelector('[data-value="interactions"]').disabled, true);
  const locked = render({ associated: true, unlocked: false });
  assert.equal(locked.querySelector('[data-action="install-game"]').disabled, true);
  assert.equal(locked.querySelector('[data-value="interactions"]').disabled, true);
});

test("les autres jeux conservent leur interface d’installation habituelle", () => {
  const view = render({ packId: "ordinary-game" });
  assert.match(view.textContent, /Installation en un clic/);
  assert.equal(view.querySelector('[data-action="install-game"]').textContent, "↓ Installer automatiquement");
  assert.doesNotMatch(view.textContent, /STEAM · MOD LOCAL|Votre ZIP, sans téléchargement/);
});
