"use strict";

/** Régressions d'interface : les instantanés sont des fixtures par UID, sans
 * disque utilisateur, réseau, secret, connexion LIVE ni exécution d'action.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");

const rendererRoot = path.resolve(__dirname, "../src/renderer");
const source = (relative) => fs.readFileSync(path.join(rendererRoot, "app", relative), "utf8");

function accountSnapshot(uid, profileId = "profile_stream", suffix = "") {
  const state = createDefaultState();
  state.settings.account = { uid, email: uid ? `${uid}@example.invalid` : "" };
  state.session.profileId = profileId;
  state.profiles = uid ? [
    { id: "profile_stream", name: `Stream ${uid}`, workspace: { rules: [] } },
    { id: "profile_game", name: `Jeu ${uid}`, workspace: { rules: [] } }
  ] : [];
  state.settings.tts.voice = `Voix ${uid}${suffix}`;
  state.settings.irl.devices = uid ? [{ id: `plug_${uid}`, name: `Prise ${uid}` }] : [];
  state.settings.overlayConfigs.likeGoal.title = `Objectif ${uid}${suffix}`;
  state.game.connectorOverrides = uid ? { fixture: { port: uid === "alpha" ? 32101 : 32102 } } : {};
  state.rules = uid ? [{ id: `rule_${uid}${suffix}`, name: `Son ${uid}${suffix}`, actions: [] }] : [];
  return { state, soundCatalog: uid ? [{ id: `sound_${uid}${suffix}`, name: `Son ${uid}${suffix}`, url: `https://media.example.invalid/${uid}${suffix}.mp3`, source: "custom" }] : [],
    mediaCatalog: uid ? [{ id: `gif_${uid}${suffix}`, name: `GIF ${uid}${suffix}`, url: `https://media.example.invalid/${uid}${suffix}.gif`, source: "custom", kind: "gif" }] : [] };
}

function rendererContext(t, initial = accountSnapshot("alpha")) {
  const dom = new JSDOM(fs.readFileSync(path.join(rendererRoot, "index.html"), "utf8"));
  t.after(() => dom.window.close());
  const listeners = new Map();
  const references = {
    sessionButton: "session-button", accountMenuButton: "account-menu-button", accountMenu: "account-menu",
    profileMenu: "profile-menu", profilePickerButton: "profile-picker-button", profileControl: "profile-control",
    profileManageButton: "profile-manage-button", profileSelect: "profile-select", gameSessionSummary: "game-session-summary",
    gameSessionStop: "game-session-stop", tiktokUsernameInput: "tiktok-username", tiktokConnectionButton: "tiktok-connection-button",
    dialogForm: "editor-form", dialog: "editor-dialog", dialogError: "dialog-error", dialogBody: "dialog-body", dialogSubmitButton: "dialog-submit",
    mediaLibrarySearchInput: "media-library-search", mediaLibraryDialog: "media-library-dialog",
    mediaLibraryConfirmButton: "media-library-confirm", mediaLibraryUploadButton: "media-library-upload",
    confirmationForm: "confirmation-form", confirmationDialog: "confirmation-dialog", confirmationCancelButton: "confirmation-cancel"
  };
  const context = vm.createContext({
    window: dom.window, document: dom.window.document, FormData: dom.window.FormData,
    snapshot: initial, SOUND_LIBRARY: initial.soundCatalog, MEDIA_LIBRARY: initial.mediaCatalog, siteVisibility: {},
    accountSession: { authenticated: Boolean(initial.state.settings.account.uid), uid: initial.state.settings.account.uid },
    mediaSessionEntries: new Map(), privateLibraryClosures: 0, renders: [], dialogSessionId: 0,
    render: () => context.renders.push(context.snapshot),
    isAccountAuthenticated: () => context.accountSession.authenticated,
    visibleAccountSession: () => context.accountSession,
    openMembershipPopup() {}, requestAnimationFrame() {},
    globalMediaLibrary: { close: () => { context.privateLibraryClosures += 1; }, confirm() {}, upload() {} },
    openEditor: (config) => { context.editor = config; },
    field: () => "", cryptoId: () => "fixture_created",
    waitForPendingAccountLogout: async () => {}, syncAdminSessionFromAccount: async () => {},
    refreshGameCheatAccess: async () => {}, syncAccountChrome() {},
    api: { getSnapshot: async () => context.serverSnapshot, selectProfile: async () => {}, upsert: async () => {}, account: {} },
    serverSnapshot: initial
  });
  for (const [name, id] of Object.entries(references)) {
    context[name] = dom.window.document.getElementById(id);
    assert.ok(context[name], `Référence DOM réelle : ${id}`);
  }
  for (const name of ["profileMenu", "profileSelect"]) {
    context[name].addEventListener = (type, listener) => listeners.set(`${name}:${type}`, listener);
  }
  vm.runInContext(source("core/ui-foundations.js"), context);
  context.toast = () => {};
  vm.runInContext(source("core/account-operation-guard.js"), context);
  vm.runInContext(source("core/events/chrome-dialogs.js"), context);
  vm.runInContext(source("editors/rules-profiles.js"), context);
  vm.runInContext(source("features/admin/account.js"), context);
  return { context, listeners };
}

test("une reconnexion A → invité → B → A remplace exactement profils, réglages et bibliothèques", (t) => {
  const { context } = rendererContext(t);
  const alpha = accountSnapshot("alpha", "profile_game");
  const beta = accountSnapshot("beta", "profile_stream");
  for (const expected of [alpha, accountSnapshot(""), beta, alpha]) {
    context.mediaSessionEntries.set("private-previous", { name: "Ancien import" });
    context.acceptSnapshot(expected);
    assert.equal(context.snapshot, expected);
    assert.equal(context.SOUND_LIBRARY, expected.soundCatalog);
    assert.equal(context.MEDIA_LIBRARY, expected.mediaCatalog);
    assert.equal(context.snapshot.state.session.profileId, expected.state.session.profileId);
    assert.equal(context.snapshot.state.settings.tts.voice, expected.state.settings.tts.voice);
    assert.equal(context.snapshot.state.settings.irl.devices, expected.state.settings.irl.devices);
    assert.equal(context.snapshot.state.settings.overlayConfigs.likeGoal.title, expected.state.settings.overlayConfigs.likeGoal.title);
    if (expected !== alpha || context.privateLibraryClosures) assert.equal(context.mediaSessionEntries.size, 0);
  }
  assert.equal(context.privateLibraryClosures, 3, "les trois frontières de compte ferment la sélection privée");
  assert.deepEqual(context.snapshot.state.profiles.map((profile) => profile.name), ["Stream alpha", "Jeu alpha"]);
});

test("un catalogue de sons explicitement vide n'hérite pas des imports du compte précédent", (t) => {
  const { context } = rendererContext(t);
  const empty = { ...accountSnapshot("alpha"), soundCatalog: [], mediaCatalog: [] };
  context.acceptSnapshot(empty);
  assert.equal(context.SOUND_LIBRARY.length, 0);
  assert.equal(context.MEDIA_LIBRARY.length, 0);
});

test("menu et select de profils synchronisent les catalogues même sans notification IPC préalable", async (t) => {
  for (const control of ["menu", "select"]) {
    const { context, listeners } = rendererContext(t);
    const selected = accountSnapshot("alpha", "profile_game", "_jeu");
    context.serverSnapshot = selected;
    let target = "";
    context.api.selectProfile = async (id) => { target = id; };
    if (control === "menu") {
      const button = context.document.createElement("button");
      button.dataset.profileSelect = "profile_game";
      await listeners.get("profileMenu:click")({ target: button });
    } else {
      context.profileSelect.innerHTML = '<option value="profile_game">Jeu</option>';
      context.profileSelect.value = "profile_game";
      await listeners.get("profileSelect:change")();
    }
    assert.equal(target, "profile_game");
    assert.equal(context.snapshot, selected);
    assert.equal(context.SOUND_LIBRARY, selected.soundCatalog);
    assert.equal(context.MEDIA_LIBRARY, selected.mediaCatalog);
    assert.equal(context.renders.at(-1), selected);
  }
});

test("une ancienne sélection de profil ne réinjecte jamais le snapshot de A après passage à B", async (t) => {
  const { context } = rendererContext(t);
  let finish;
  context.api.getSnapshot = () => new Promise((resolve) => { finish = resolve; });
  const pending = context.switchProfileFromChrome("profile_game");
  await new Promise((resolve) => setImmediate(resolve));
  const beta = accountSnapshot("beta");
  context.accountSession = { authenticated: true, uid: "beta" };
  context.invalidateCreatorPrivateOperations();
  context.acceptSnapshot(beta);
  finish(accountSnapshot("alpha", "profile_game"));
  await pending;
  assert.equal(context.snapshot, beta);
  assert.equal(context.SOUND_LIBRARY, beta.soundCatalog);
  assert.equal(context.renders.length, 0);
});

test("la connexion restitue le profil sélectionné et ses bibliothèques avant la synchronisation du chrome", async (t) => {
  const { context } = rendererContext(t, accountSnapshot(""));
  const restored = accountSnapshot("alpha", "profile_game");
  context.serverSnapshot = restored;
  context.api.account.login = async () => ({ authenticated: true, uid: "alpha", email: "alpha@example.invalid", emailVerified: true });
  let chromeSnapshot;
  context.syncAccountChrome = () => { chromeSnapshot = context.snapshot; };
  context.openAccountLogin();
  await context.editor.onSubmit(new Map([["email", "alpha@example.invalid"], ["password", "fixture-not-a-real-password"]]));
  assert.equal(chromeSnapshot, restored);
  assert.equal(context.snapshot.state.session.profileId, "profile_game");
  assert.equal(context.SOUND_LIBRARY, restored.soundCatalog);
});

test("créer un profil passe également par le contrat commun d'acceptation du snapshot", async (t) => {
  const { context } = rendererContext(t);
  const created = accountSnapshot("alpha", "profile_fixture_created", "_nouveau");
  context.serverSnapshot = created;
  context.openProfileEditor();
  await context.editor.onSubmit(new Map([["name", "Nouveau profil"], ["description", "Fixture"]]));
  assert.equal(context.snapshot, created);
  assert.equal(context.SOUND_LIBRARY, created.soundCatalog);
  assert.equal(context.MEDIA_LIBRARY, created.mediaCatalog);
});
