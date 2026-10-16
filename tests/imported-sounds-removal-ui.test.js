"use strict";

/** Suppression de bibliothèque : vrais composants/événements du renderer,
 * DOM isolé, API et aperçus factices. Aucun disque, son ou compte utilisateur. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const visibility = require("../src/shared/visibility-catalog");
const overlayCatalog = require("../resources/overlays/overlay-catalog");

const renderer = path.resolve(__dirname, "../src/renderer");
const read = (file) => fs.readFileSync(path.join(renderer, "app", file), "utf8");
const copy = (value) => JSON.parse(JSON.stringify(value));
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const A = { id: "custom:a", name: "Alerte <A>", source: "custom", category: "Ambiance", detail: "Import de démonstration", url: "https://media.example.invalid/a.mp3" };
const B = { id: "custom:b", name: "Bravo B", source: "custom", category: "Fête", url: "https://media.example.invalid/b.mp3" };
const BUILTIN = { id: "kenney:fixture", name: "Son fourni", source: "kenney", category: "Interface", url: "/overlay/media/kenney/fixture.ogg" };
const WEB = { id: "web:fixture", name: "Son web", source: "myinstants", category: "Web", url: "https://media.example.invalid/web.mp3" };

function snapshot(uid = "alpha", sounds = [A, B]) {
  const state = createDefaultState();
  state.settings.account = { uid, email: uid ? `${uid}@example.invalid` : "" };
  state.customSounds = copy(sounds);
  state.rules = [{ id: "rule-demo", actions: [{ id: "action-demo", type: "audio.play", config: { url: A.url, soundName: A.name } }] }];
  state.profiles = [{ id: "profile-demo", enabledRuleIds: ["rule-demo"], workspace: { rules: copy(state.rules) } }];
  return { state, soundCatalog: [copy(BUILTIN), ...copy(sounds)], mediaCatalog: [] };
}

function fixture(t, initial = snapshot()) {
  const dom = new JSDOM(fs.readFileSync(path.join(renderer, "index.html"), "utf8"), { runScripts: "outside-only" });
  const eventErrors = [];
  dom.window.addEventListener("error", (event) => { eventErrors.push(event.message); event.preventDefault(); });
  t.after(() => { try { assert.deepEqual(eventErrors, [], "aucune erreur masquée dans les événements DOM"); } finally { dom.window.close(); } });
  const window = dom.window, sandbox = dom.getInternalVMContext(), requests = [], confirmations = [], toasts = [], previews = [];
  const run = (code) => vm.runInContext(code, sandbox);
  window.ShenPulseVisibility = visibility; window.ShenPulseOverlayCatalog = overlayCatalog;
  window.requestAnimationFrame = () => 0;
  window.fetch = () => { throw new Error("Aucun réseau réel"); };
  window.HTMLMediaElement.prototype.play = () => { throw new Error("Aucune lecture audio réelle"); };
  window.HTMLMediaElement.prototype.pause = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function (value) { this.open = false; this.returnValue = value; this.dispatchEvent(new window.Event("close")); };
  window.shenPulse = {
    removeCustomSound: async (id, uid) => {
      requests.push({ id, uid });
      return { removed: true, snapshot: snapshot(uid, initial.state.customSounds.filter((item) => item.id !== id)) };
    },
    testAction: async (action) => { previews.push(copy(action)); },
    searchSounds: async () => ({ sounds: [], hasMore: false })
  };
  run(read("core/bootstrap.js"));
  run(read("core/ui-foundations.js"));
  run(read("core/account-operation-guard.js"));
  run(read("core/automation-table.js"));
  run(read("features/media/library.js"));
  window.toast = (...args) => toasts.push(args);
  window.confirmAction = async (...args) => { confirmations.push(args); return true; };
  window.isAccountAuthenticated = () => run("accountSession.authenticated === true");
  window.visibleAccountSession = () => run("accountSession");
  window.stopEditorAudioPreview = () => {};
  window.openMembershipPopup = () => {};
  window.perform = async (operation) => operation();
  window.cryptoId = () => "fixture-preview";
  window.fixtureSnapshot = initial;
  run("snapshot=fixtureSnapshot; SOUND_LIBRARY=fixtureSnapshot.soundCatalog; MEDIA_LIBRARY=fixtureSnapshot.mediaCatalog; accountSession={authenticated:true,uid:fixtureSnapshot.state.settings.account.uid};");
  run(read("core/events/chrome-dialogs.js"));
  const root = window.document.createElement("div");
  root.dataset.mediaPickerRoot = ""; root.dataset.pickerKind = "sound";
  root.innerHTML = '<input name="url" data-media-value><input name="soundName" data-media-name><div data-media-selection></div>';
  root.querySelector("[data-media-value]").value = A.url;
  window.document.getElementById("dialog-body").append(root);
  const selectContext = () => {
    const context = { kind: "sound", root, inputName: "url", optional: false };
    window.fixtureContext = context;
    run("mediaLibraryContext=fixtureContext; mediaLibrarySource='custom'; mediaLibraryKind='all'; mediaLibrarySelected=null; mediaLibrarySearchInput.value=''; mediaLibraryDialog.showModal(); renderMediaLibrary();");
    return context;
  };
  selectContext();
  const audio = (url = A.url, scope = "media-library") => {
    const node = window.document.createElement("audio"); node.setAttribute("src", url);
    let paused = 0, removed = 0;
    node.pause = () => { paused += 1; };
    node.remove = () => { removed += 1; };
    window.fixtureAudio = node; window.fixtureScope = scope;
    run("activePreviewAudio=fixtureAudio; activePreviewAudioScope=fixtureScope;");
    return { node, counts: () => ({ paused, removed }) };
  };
  return { window, run, root, requests, confirmations, toasts, previews, selectContext, audio,
    remove: (id = A.id) => window.ShenPulseMediaLibrary.removeSound(id),
    results: () => window.document.getElementById("media-library-results"),
    switchAccount: (uid) => { window.fixtureNext = snapshot(uid); run("invalidateCreatorPrivateOperations(); accountSession={authenticated:Boolean(fixtureNext.state.settings.account.uid),uid:fixtureNext.state.settings.account.uid}; acceptSnapshot(fixtureNext);"); }
  };
}

test("le vrai markup expose une corbeille accessible uniquement pour les imports du compte", (t) => {
  const f = fixture(t);
  const spoof = { ...A, id: "custom:absent" };
  for (const [item, removable] of [[A, true], [B, true], [BUILTIN, false], [WEB, false], [spoof, false]]) {
    const host = f.window.document.createElement("div"); host.innerHTML = f.window.soundLibraryResultMarkup(item);
    assert.equal(Boolean(host.querySelector("[data-remove-custom-sound]")), removable);
    assert.equal(host.querySelectorAll("button button").length, 0);
    if (removable) {
      const button = host.querySelector("[data-remove-custom-sound]");
      assert.equal(button.type, "button"); assert.ok(button.querySelector("svg"), "icône réelle automationTableIcon");
      assert.match(button.getAttribute("aria-label"), /Supprimer/);
    }
    assert.equal(host.querySelectorAll("script,img").length, 0, "le nom importé reste du texte");
  }
  const hostile = f.window.document.createElement("div");
  hostile.innerHTML = f.window.soundLibraryResultMarkup({ ...A, name: '<img src=x onerror="throw 1"><script>throw 2</script>' });
  assert.equal(hostile.querySelectorAll("script,img").length, 0);
  assert.match(hostile.textContent, /<img src=x/);
});

test("annuler la confirmation ne fait aucun appel IPC ni changement de sélection", async (t) => {
  const f = fixture(t); f.window.confirmAction = async (...args) => { f.confirmations.push(args); return false; };
  f.window.fixtureA = A; f.run("mediaLibrarySelected=fixtureA;");
  await f.remove();
  assert.equal(f.requests.length, 0); assert.equal(f.run("mediaLibrarySelected.id"), A.id);
  assert.equal(f.run("mediaLibraryPendingRemovals.size"), 0);
  assert.equal(f.results().querySelector("[data-remove-custom-sound]").disabled, false);
  assert.match(f.confirmations[0][0], /actions et profils.*conserveront leur son/);
  assert.equal(f.confirmations[0][1].danger, true);
});

test("supprimer retire sélection et caches sans modifier le formulaire ni les actions/profils", async (t) => {
  const f = fixture(t); f.window.fixtureA = A; f.window.fixtureB = B;
  f.run("mediaLibrarySelected=fixtureA; mediaSessionEntries.set(fixtureA.url,fixtureA); mediaSessionEntries.set('alias-a',fixtureA); mediaSessionEntries.set(fixtureB.url,fixtureB);");
  const before = f.run("JSON.stringify([snapshot.state.rules,snapshot.state.profiles])");
  const audio = f.audio(); await f.remove();
  assert.deepEqual(f.requests, [{ id: A.id, uid: "alpha" }]);
  assert.equal(f.run("SOUND_LIBRARY.some(item=>item.id==='custom:a')"), false);
  assert.equal(f.run("mediaSessionEntries.size"), 1);
  assert.equal(f.run("mediaLibrarySelected"), null);
  assert.equal(f.window.document.getElementById("media-library-confirm").disabled, true);
  assert.equal(f.root.querySelector("[data-media-value]").value, A.url, "une action déjà renseignée reste intacte");
  assert.equal(f.run("JSON.stringify([snapshot.state.rules,snapshot.state.profiles])"), before);
  assert.deepEqual(audio.counts(), { paused: 1, removed: 1 });
  assert.equal(f.results().querySelectorAll(".media-sound-row").length, 1);
  assert.equal(f.toasts.at(-1)[0], "Son retiré de la bibliothèque");
});

test("retirer le dernier import remet les filtres à Tous et affiche une bibliothèque vide", async (t) => {
  const f = fixture(t, snapshot("alpha", [A]));
  f.run("mediaLibraryKind='Ambiance'; mediaLibrarySearchInput.value='alerte'; renderMediaLibrary();");
  await f.remove();
  assert.equal(f.run("mediaLibraryKind"), "all");
  assert.equal(f.run("SOUND_LIBRARY.filter(item=>item.source==='custom').length"), 0);
  assert.ok(f.results().querySelector(".media-library-empty"));
  assert.match(f.window.document.getElementById("media-library-status").textContent, /0 résultat/);
});

test("une autre sélection et un aperçu différent ne sont pas affectés", async (t) => {
  const f = fixture(t); f.window.fixtureB = B; f.run("mediaLibrarySelected=fixtureB;");
  const audio = f.audio(B.url); await f.remove();
  assert.equal(f.run("mediaLibrarySelected.id"), B.id);
  assert.equal(f.window.document.getElementById("media-library-confirm").disabled, false);
  assert.deepEqual(audio.counts(), { paused: 0, removed: 0 });
});

test("la suppression n'arrête jamais le son d'une alerte LIVE ou de l'éditeur", async (t) => {
  for (const scope of ["", "editor-dialog", "live"]) {
    const f = fixture(t); const audio = f.audio(A.url, scope); await f.remove();
    assert.deepEqual(audio.counts(), { paused: 0, removed: 0 }, scope);
  }
});

test("la même suppression en attente est désactivée et ne double ni confirmation ni IPC", async (t) => {
  const f = fixture(t), confirm = deferred(), response = deferred(); let confirmations = 0;
  f.window.confirmAction = () => { confirmations += 1; return confirm.promise; };
  f.window.shenPulse.removeCustomSound = async (id, uid) => { f.requests.push({ id, uid }); return response.promise; };
  const first = f.remove(); await f.remove();
  assert.equal(confirmations, 1); assert.equal(f.requests.length, 0);
  assert.equal(f.results().querySelector(`[data-remove-custom-sound="${A.id}"]`).disabled, true);
  confirm.resolve(true); await tick(); await f.remove();
  assert.equal(f.requests.length, 1); assert.equal(confirmations, 1);
  response.resolve({ snapshot: snapshot("alpha", [B]) }); await first;
  assert.equal(f.run("mediaLibraryPendingRemovals.size"), 0);
});

test("un échec IPC préserve les imports et réactive la corbeille", async (t) => {
  const f = fixture(t); f.window.shenPulse.removeCustomSound = async () => { throw new Error("Refus synthétique"); };
  await f.remove();
  assert.equal(f.run("SOUND_LIBRARY.some(item=>item.id==='custom:a')"), true);
  assert.equal(f.run("mediaLibraryPendingRemovals.size"), 0);
  assert.equal(f.results().querySelector(`[data-remove-custom-sound="${A.id}"]`).disabled, false);
  assert.deepEqual(f.toasts.at(-1), ["Suppression impossible", "Refus synthétique", true]);
});

test("les contextes visuels/web, IDs absents et invités ne peuvent pas supprimer", async (t) => {
  for (const invalid of ["visual", "web", "unknown", "guest"]) {
    const f = fixture(t);
    if (invalid === "visual") f.run("mediaLibraryContext.kind='visual';");
    if (invalid === "web") f.run("mediaLibrarySource='web';");
    if (invalid === "guest") f.switchAccount("");
    await f.remove(invalid === "unknown" ? "kenney:fixture" : A.id);
    assert.equal(f.requests.length, 0, invalid);
    assert.equal(f.confirmations.length, 0, invalid);
  }
});

test("changer de compte pendant la confirmation annule avant l'IPC", async (t) => {
  for (const uid of ["beta", ""]) {
    const f = fixture(t), pending = deferred(); f.window.confirmAction = () => pending.promise;
    const request = f.remove(); f.switchAccount(uid); pending.resolve(true); await request;
    assert.equal(f.requests.length, 0); assert.equal(f.toasts.length, 0);
    assert.equal(f.run("snapshot.state.settings.account.uid"), uid);
    assert.equal(f.run("mediaLibraryPendingRemovals.size"), 0);
  }
});

test("une réponse tardive d'un autre compte n'applique ni snapshot, cache, preview ou toast", async (t) => {
  const f = fixture(t), pending = deferred();
  f.window.shenPulse.removeCustomSound = async (id, uid) => { f.requests.push({ id, uid }); return pending.promise; };
  const request = f.remove(); await tick(); f.switchAccount("beta");
  f.window.fixtureB = B; f.run("mediaSessionEntries.set('beta-current',fixtureB);");
  const audio = f.audio(); pending.resolve({ snapshot: snapshot("alpha", [B]) }); await request;
  assert.equal(f.run("snapshot.state.settings.account.uid"), "beta");
  assert.equal(f.run("mediaSessionEntries.has('beta-current')"), true);
  assert.deepEqual(audio.counts(), { paused: 0, removed: 0 });
  assert.equal(f.toasts.length, 0);
});

test("un nouveau sélecteur pendant la confirmation empêche toute suppression", async (t) => {
  const f = fixture(t), pending = deferred(); f.window.confirmAction = () => pending.promise;
  const request = f.remove(); f.selectContext(); pending.resolve(true); await request;
  assert.equal(f.requests.length, 0); assert.equal(f.toasts.length, 0);
});

test("le nouveau sélecteur conserve sa sélection après la réponse d'une suppression déjà confirmée", async (t) => {
  const f = fixture(t), pending = deferred();
  f.window.shenPulse.removeCustomSound = async () => pending.promise;
  const request = f.remove(); await tick();
  f.selectContext(); f.window.fixtureB = B; f.run("mediaLibrarySelected=fixtureB; renderMediaLibrary();");
  pending.resolve({ snapshot: snapshot("alpha", [B]) }); await request;
  assert.equal(f.run("mediaLibrarySelected.id"), B.id);
  assert.equal(f.root.querySelector("[data-media-value]").value, A.url);
  assert.equal(f.results().querySelectorAll(".media-sound-row").length, 1, "la nouvelle vue est rafraîchie");
  assert.equal(f.results().querySelector("[data-remove-custom-sound]").dataset.removeCustomSound, B.id);
});

test("la réponse confirmée invalide une sélection supprimée du nouveau sélecteur mais pas son nouvel aperçu", async (t) => {
  const f = fixture(t), pending = deferred();
  f.window.shenPulse.removeCustomSound = async () => pending.promise;
  const request = f.remove(); await tick();
  f.selectContext(); f.window.fixtureA = A; f.run("mediaLibrarySelected=fixtureA; renderMediaLibrary();");
  const audio = f.audio();
  pending.resolve({ snapshot: snapshot("alpha", [B]) }); await request;
  assert.equal(f.run("mediaLibrarySelected"), null);
  assert.equal(f.window.document.getElementById("media-library-confirm").disabled, true);
  assert.equal(f.results().querySelectorAll(".media-sound-row").length, 1);
  assert.deepEqual(audio.counts(), { paused: 0, removed: 0 }, "le nouveau contexte possède son aperçu");
});

test("un import homonyme du compte B n'est pas désactivé par la suppression en cours du compte A", async (t) => {
  const f = fixture(t), pending = deferred();
  f.window.shenPulse.removeCustomSound = async (id, uid) => {
    f.requests.push({ id, uid });
    return uid === "alpha" ? pending.promise : { snapshot: snapshot(uid, [B]) };
  };
  const first = f.remove(); await tick();
  f.switchAccount("beta"); f.selectContext();
  assert.equal(f.results().querySelector(`[data-remove-custom-sound="${A.id}"]`).disabled, false);
  await f.remove();
  assert.deepEqual(f.requests, [{ id: A.id, uid: "alpha" }, { id: A.id, uid: "beta" }]);
  assert.equal(f.run("snapshot.state.settings.account.uid"), "beta");
  assert.equal(f.run("mediaLibraryPendingRemovals.size"), 1, "seule la requête de A attend encore");
  pending.resolve({ snapshot: snapshot("alpha", [B]) }); await first;
  assert.equal(f.run("snapshot.state.settings.account.uid"), "beta");
  assert.equal(f.run("mediaLibraryPendingRemovals.size"), 0);
  assert.equal(f.toasts.length, 1, "aucun succès périmé du compte A");
});

test("la reconnexion au même UID utilise une nouvelle génération sans bloquer la nouvelle confirmation", async (t) => {
  const f = fixture(t), pending = deferred(); let count = 0;
  f.window.confirmAction = () => { count += 1; return count === 1 ? pending.promise : false; };
  const first = f.remove();
  f.switchAccount("alpha"); f.selectContext();
  assert.equal(f.results().querySelector(`[data-remove-custom-sound="${A.id}"]`).disabled, false);
  await f.remove(); assert.equal(count, 2);
  pending.resolve(true); await first;
  assert.equal(f.requests.length, 0);
  assert.equal(f.run("mediaLibraryPendingRemovals.size"), 0);
});

test("la catégorie disparue revient à Tous avant le filtrage des imports restants", async (t) => {
  const f = fixture(t);
  f.run("mediaLibraryKind='Ambiance'; renderMediaLibrary();");
  await f.remove();
  assert.equal(f.run("mediaLibraryKind"), "all");
  assert.equal(f.results().querySelectorAll(".media-sound-row").length, 1);
  assert.equal(f.results().querySelector("[data-media-select]").dataset.mediaSelect, B.id);
  const search = f.window.document.getElementById("media-library-search");
  search.value = "bRÀvo"; search.dispatchEvent(new f.window.Event("input", { bubbles: true }));
  assert.equal(f.results().querySelectorAll(".media-sound-row").length, 1, "recherche accent-insensible conservée");
});

test("le clic délégué sur la vraie icône supprimer ne choisit pas le son", async (t) => {
  const f = fixture(t); f.window.confirmAction = async () => false;
  const icon = f.results().querySelector("[data-remove-custom-sound] svg");
  const event = new f.window.MouseEvent("click", { bubbles: true, cancelable: true });
  icon.dispatchEvent(event); await tick();
  assert.equal(event.defaultPrevented, true);
  assert.equal(f.run("mediaLibrarySelected"), null);
  assert.equal(f.root.querySelector("[data-media-value]").value, A.url);
  assert.equal(f.requests.length, 0);
});

test("la preview déléguée utilise son scope et fermer la bibliothèque ne coupe que cet aperçu", async (t) => {
  const f = fixture(t);
  f.results().querySelector("[data-media-preview-url]").click(); await tick();
  assert.equal(f.previews.length, 1); assert.equal(f.previews[0].config.previewScope, "media-library");
  assert.equal(f.previews[0].config.outputMode, "local", "écouter un import ne doit jamais le diffuser sur le LIVE");
  const audio = f.audio(); f.window.ShenPulseMediaLibrary.close();
  assert.deepEqual(audio.counts(), { paused: 1, removed: 1 });
  assert.equal(f.run("mediaLibraryContext"), null);
  assert.equal(f.run("activePreviewAudio"), null);
});

test("les boutons et l'événement Annuler ferment la bibliothèque et nettoient l'aperçu", (t) => {
  for (const control of ["media-library-close", "media-library-cancel", "cancel-event"]) {
    const f = fixture(t), audio = f.audio();
    if (control === "cancel-event") {
      const event = new f.window.Event("cancel", { cancelable: true });
      f.window.document.getElementById("media-library-dialog").dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
    } else f.window.document.getElementById(control).click();
    assert.equal(f.run("mediaLibraryContext"), null, control);
    assert.equal(f.run("mediaLibraryDialog.open"), false, control);
    assert.deepEqual(audio.counts(), { paused: 1, removed: 1 }, control);
    assert.equal(f.requests.length, 0);
  }
});

test("sélectionner et confirmer un autre import fonctionne toujours et nettoie l'aperçu", (t) => {
  const f = fixture(t), audio = f.audio();
  f.results().querySelector(`[data-media-select="${B.id}"] strong`).click();
  assert.equal(f.run("mediaLibrarySelected.id"), B.id);
  f.window.document.getElementById("media-library-confirm").click();
  assert.equal(f.root.querySelector("[data-media-value]").value, B.url);
  assert.equal(f.root.querySelector("[data-media-name]").value, B.name);
  assert.equal(f.run("mediaLibraryContext"), null);
  assert.equal(f.run("mediaLibraryDialog.open"), false);
  assert.deepEqual(audio.counts(), { paused: 1, removed: 1 });
  assert.equal(f.requests.length, 0);
});
