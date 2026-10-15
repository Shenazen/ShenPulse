"use strict";

/** Aucune action, prise, session LIVE ou donnée utilisateur réelle : le seul
 * délai simulé est l'arrêt d'une session de jeu avant sélection du profil.
 */
const assert = require("node:assert/strict");
const test = require("node:test");
const { registerWorkspaceIpc } = require("../src/main/ipc/workspace");

function fixture({ generation = true, accountSession = false } = {}) {
  const handlers = new Map(), calls = [];
  const state = { settings: { account: { uid: "alpha", email: "alpha@example.invalid", refreshTokenSecretId: "ref-alpha" } },
    profiles: [{ id: "profile_shared", name: "Alpha" }], session: { profileId: "profile_old" },
    commerce: { subscription: { tier: "pro", status: "active" } } };
  let activeUid = "alpha", finishStop, failStop;
  const stopped = new Promise((resolve, reject) => { finishStop = resolve; failStop = reject; });
  const accountService = generation ? { sessionGeneration: 7 } : undefined;
  const store = {
    getState: () => state, getActiveAccountUid: () => activeUid,
    ...(accountSession ? { getAccountSession: () => state.settings.account } : {}),
    selectProfile: (id) => { calls.push("select"); state.session.profileId = id; },
    upsert: (collection, entity) => { calls.push("upsert"); state[collection].push(entity); return state; },
    remove: (collection, id) => { calls.push("remove"); state[collection] = state[collection].filter((entry) => entry.id !== id); return state; }
  };
  const core = {
    stopGameSession: async () => { calls.push("stop"); return stopped; },
    matches: { reset: () => calls.push("reset-match") },
    liveEventActions: { chatbot: { reset: () => calls.push("reset-chatbot"), syncTimers: () => calls.push("sync-chatbot") } },
    ruleEngine: { resetProfileState: () => calls.push("reset-rules") },
    snapshot: () => ({ state }), notifyRenderer: () => calls.push("notify")
  };
  registerWorkspaceIpc({ handle: (name, handler) => handlers.set(name, handler), core, store, accountService });
  const switchAccount = (uid) => {
    state.settings.account = { uid, email: uid ? `${uid}@example.invalid` : "", refreshTokenSecretId: uid ? `ref-${uid}` : "" };
    activeUid = uid;
    state.profiles = [{ id: "profile_shared", name: uid }];
    state.session.profileId = "profile_beta_active";
  };
  return { handlers, calls, state, store, accountService, finishStop, failStop, switchAccount,
    setActiveUid: (uid) => { activeUid = uid; }, select: () => handlers.get("profile:select")({}, "profile_shared") };
}

test("une sélection normale reste dans le compte initial après l'arrêt du jeu", async () => {
  for (const options of [{}, { generation: false }, { accountSession: true }]) {
    const f = fixture(options), pending = f.select();
    assert.deepEqual(f.calls, ["reset-match", "reset-chatbot", "stop"]);
    f.finishStop();
    const result = await pending;
    assert.equal(result.state.session.profileId, "profile_shared");
    assert.deepEqual(f.calls, ["reset-match", "reset-chatbot", "stop", "select", "reset-rules", "sync-chatbot", "notify"]);
  }
});

test("la sélection de A ne s'applique jamais à B, même si B possède le même identifiant de profil", async () => {
  for (const generation of [true, false]) {
    const f = fixture({ generation }), pending = f.select();
    f.switchAccount("beta");
    f.finishStop();
    await assert.rejects(pending, { code: "PROFILE_ACCOUNT_CHANGED", staleSession: true });
    assert.equal(f.state.session.profileId, "profile_beta_active");
    assert.deepEqual(f.calls, ["reset-match", "reset-chatbot", "stop"]);
  }
});

test("déconnexion et renouvellement de connexion du même UID invalident une ancienne sélection", async () => {
  for (const change of ["logout", "same-uid-generation", "secret-reference", "email"]) {
    const f = fixture(), pending = f.select();
    if (change === "logout") f.switchAccount("");
    else if (change === "same-uid-generation") f.accountService.sessionGeneration += 1;
    else if (change === "secret-reference") f.state.settings.account.refreshTokenSecretId = "another-reference";
    else f.state.settings.account.email = "other@example.invalid";
    f.finishStop();
    await assert.rejects(pending, { code: "PROFILE_ACCOUNT_CHANGED" });
    assert.equal(f.calls.includes("select"), false);
    assert.equal(f.calls.includes("notify"), false);
  }
});

test("une erreur d'arrêt ne sélectionne aucun profil et ne masque pas la panne", async () => {
  const f = fixture(), pending = f.select();
  const error = new Error("Arrêt du jeu refusé — fixture");
  f.failStop(error);
  await assert.rejects(pending, (received) => received === error);
  assert.equal(f.state.session.profileId, "profile_old");
  assert.deepEqual(f.calls, ["reset-match", "reset-chatbot", "stop"]);
});

test("un espace sans compte ou dont l'UID actif est incohérent ne commence pas de transition", async () => {
  for (const change of ["empty", "mismatch"]) {
    const f = fixture();
    if (change === "empty") f.switchAccount(""); else f.setActiveUid("beta");
    await assert.rejects(f.select(), { code: "PROFILE_ACCOUNT_CHANGED" });
    assert.deepEqual(f.calls, []);
  }
});

test("création et suppression de profils restent synchrones, sans attente laissant changer le compte", () => {
  const f = fixture();
  const created = f.handlers.get("entity:upsert")({}, "profiles", { id: "new", name: "Nouveau" });
  assert.equal(created instanceof Promise, false);
  assert.equal(f.state.profiles.some((profile) => profile.id === "new"), true);
  const removed = f.handlers.get("entity:remove")({}, "profiles", "new");
  assert.equal(removed instanceof Promise, false);
  assert.equal(f.state.profiles.some((profile) => profile.id === "new"), false);
  assert.equal(f.calls.includes("stop"), false);
});
