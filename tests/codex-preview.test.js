"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const {
  bridgeSource,
  loadPersistedAccountState,
  snapshot
} = require("../scripts/start-codex-preview");

function stateFixture(uid) {
  const state = createDefaultState();
  state.activeAccountUid = uid;
  state.settings.account = {
    ...state.settings.account,
    email: "test@example.com",
    uid
  };
  state.settings.overlayToken = "private-overlay-token";
  state.settings.apiToken = "private-api-token";
  state.profiles.push({
    ...structuredClone(state.profiles[0]),
    id: "profile_saved",
    name: "Profil sauvegardé"
  });
  state.rules.push({ id: "rule_saved", name: "Règle sauvegardée" });
  state.accountWorkspaces = {
    another_account: { ownerUid: "another-user", private: true }
  };
  return state;
}

test("l'aperçu recharge uniquement l'espace local de l'UID Firebase", (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-codex-preview-")
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "shenpulse-state.json");
  fs.writeFileSync(file, JSON.stringify(stateFixture("firebase-uid")));

  const restored = loadPersistedAccountState("firebase-uid", file);

  assert.equal(restored.profiles.length, 2);
  assert.equal(restored.rules.at(-1).name, "Règle sauvegardée");
  assert.equal(restored.settings.overlayToken, "codex-preview");
  assert.equal(restored.settings.apiToken, "codex-preview");
  assert.equal("accountWorkspaces" in restored, false);
  assert.equal("activeAccountUid" in restored, false);
});

test("l'aperçu ne révèle pas l'espace local d'un autre compte", (t) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "shenpulse-codex-preview-")
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "shenpulse-state.json");
  fs.writeFileSync(file, JSON.stringify(stateFixture("owner-uid")));

  const restored = loadPersistedAccountState("different-uid", file);

  assert.equal(restored.profiles.length, 1);
  assert.equal(restored.rules.some((rule) => rule.id === "rule_saved"), false);
});

test("le banc de test expose les vrais catalogues et les overlays", () => {
  const preview = snapshot();

  assert.ok(preview.catalogCounts.gifts > 0);
  assert.ok(preview.catalogCounts.sounds > 0);
  assert.ok(preview.catalogCounts.media > 0);
  assert.ok(preview.packs.length > 0);
  assert.ok(Object.keys(preview.previewOverlayUrls).length > 0);
});

test("le pont navigateur câble les événements et les effets de jeu", () => {
  const source = bridgeSource();

  assert.match(source, /__codex-preview-api\/settings/);
  assert.match(source, /__codex-preview-api\/catalog\/gifts/);
  assert.match(source, /__codex-preview-api\/event\/simulate/);
  assert.match(source, /__codex-preview-api\/game\/effect/);
});
