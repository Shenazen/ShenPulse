"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const contract = require("../src/shared/chatbot-command");
const executionContract = require("../src/shared/command-execution");

const appRoot = path.join(__dirname, "..", "src", "renderer", "app");
const read = (file) => fs.readFileSync(path.join(appRoot, file), "utf8");
const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Fixtures locales : aucune API de plateforme ni événement simulé n’est appelé. */
function chatbotContext(t, { commands = [], authenticated = true } = {}) {
  const dom = new JSDOM('<main id="content"></main><dialog id="editor"><form id="form"><div id="body"></div></form></dialog>', { runScripts: "outside-only", pretendToBeVisual: true, url: "https://shenpulse.test" });
  t.after(() => dom.window.close());
  const window = dom.window;
  const state = createDefaultState();
  state.settings.account = { uid: authenticated ? "owner" : "", email: "test@example.test" };
  state.commands = commands;
  state.activity = [];
  const calls = [];
  let nextId = 0;
  let activeEditor;
  let confirmation = true;
  Object.assign(window, {
    snapshot: { state }, currentPage: "commands", content: window.document.getElementById("content"),
    dialog: window.document.getElementById("editor"), dialogForm: window.document.getElementById("form"),
    escapeHtml: escape, formatTime: (value) => value || "—", ShenPulseChatbotCommand: contract, ShenPulseCommandExecution: executionContract,
    isAccountAuthenticated: () => Boolean(window.snapshot.state.settings.account.uid),
    visibleAccountSession: () => window.snapshot.state.settings.account,
    renderPrivateDataPlaceholder: () => '<p class="private">private</p>',
    cryptoId: () => `fixture_${++nextId}`,
    perform: async (work) => work(),
    confirmAction: async () => confirmation,
    ACTION_NOT_HANDLED: Symbol("not-handled"), registerActionHandler: () => {},
    acceptSnapshot: (next) => { calls.push(["accept"]); window.snapshot = next; },
    render: () => { window.content.innerHTML = window.renderCreatorChatbot(); },
    openEditor: (options) => { activeEditor = options; window.document.getElementById("body").innerHTML = options.body; },
    dialogSection: (title, description, content) => `<section class="dialog-section"><h3>${escape(title)}</h3><p>${escape(description)}</p><div class="form-grid">${content}</div></section>`,
    api: {
      upsert: async (collection, entity) => {
        calls.push(["upsert", collection, entity]);
        const values = window.snapshot.state[collection];
        const index = values.findIndex((entry) => entry.id === entity.id);
        if (index < 0) values.push(entity); else values[index] = entity;
      },
      remove: async (collection, id) => { calls.push(["remove", collection, id]); window.snapshot.state[collection] = window.snapshot.state[collection].filter((entry) => entry.id !== id); },
      getSnapshot: async () => { calls.push(["snapshot"]); return window.snapshot; }
    }
  });
  const run = (code) => vm.runInContext(code, dom.getInternalVMContext());
  for (const file of ["core/components.js", "core/account-operation-guard.js", "features/studio-design.js", "features/chatbot/execution.js", "features/creator-chatbot.js", "features/chatbot/delivery.js"]) run(read(file));
  window.field = window.inputFieldMarkup;
  for (const file of ["features/chatbot/editor.js", "actions/handlers/creator-chatbot.js"]) run(read(file));
  window.render();
  const action = (name, target = window.document.createElement("button"), id) => window.handleCreatorChatbotAction({ action: name, target, id });
  return { window, state, calls, run, action, editor: () => activeEditor, confirmation: (next) => { confirmation = next; } };
}


const command = (overrides = {}) => ({ id: "cmd", kind: "command", command: "!skip", execution: { type: "music", operation: "next" }, response: "", enabled: true, cooldownMs: 10000, audience: "moderator", ...overrides });

test("les commandes ont une ligne compacte avec effet, accès, cooldown et les trois actions", (t) => {
  const commands = [
    command({ aliases: ["!suivant", "!next"], platform: "kick", globalCooldownMs: 3000 }),
    command({ id: "wheel", command: "!roue", execution: { type: "overlay", overlayKey: "wheel", operation: "spin" }, enabled: false, audience: "subscriber", cooldownMs: 20000 }),
    command({ id: "action", command: "!launch", execution: { type: "action", actionId: "missing" }, audience: "all" })
  ];
  const { window, state, calls } = chatbotContext(t, { commands });
  const before = JSON.stringify(state);
  const table = window.content.querySelector('table[aria-label="Vos commandes"]');
  assert.ok(table);
  assert.equal(table.querySelectorAll("thead th[scope=col]").length, 6);
  assert.equal(table.querySelectorAll("tbody > tr").length, 3);
  assert.equal(window.content.querySelector(".chatbot-entry-grid"), null);
  for (const [index, row] of [...table.querySelectorAll("tbody > tr")].entries()) {
    assert.equal(row.dataset.chatbotEntry, commands[index].id);
    assert.equal(row.querySelectorAll("td").length, 6);
    assert.equal(row.querySelector('[data-action="chatbot-toggle"]').checked, commands[index].enabled !== false);
    for (const action of ["chatbot-preview", "chatbot-edit", "chatbot-delete"]) {
      const button = row.querySelector(`[data-action="${action}"]`);
      assert.equal(button.dataset.id, commands[index].id);
      assert.ok(button.getAttribute("aria-label"));
      assert.ok(button.getAttribute("title"));
    }
  }
  assert.match(table.rows[1].querySelector(".compact-resource-column-audience").textContent, /Modérateurs uniquement.*Kick/s);
  assert.match(table.rows[1].querySelector(".compact-resource-column-cooldown").textContent, /10 s par viewer.*3 s global/s);
  assert.deepEqual([...table.rows[1].querySelectorAll(".chatbot-aliases code")].map((row) => row.textContent), ["!suivant", "!next"]);
  assert.equal(table.rows[2].classList.contains("is-paused"), true);
  assert.equal(JSON.stringify(state), before);
  assert.equal(calls.length, 0, "Afficher des lignes ne sauvegarde ni ne déclenche leurs effets.");
});

test("les identités et libellés de la liste restent du texte, sans injection HTML", (t) => {
  const id = 'id" onmouseover="alert(1)';
  const title = '!<img src=x onerror="alert(1)">';
  const { window, calls } = chatbotContext(t, { commands: [command({ id, command: title, aliases: ["!<script>"] })] });
  const row = window.content.querySelector("tbody > tr.chatbot-entry");
  assert.equal(row.dataset.chatbotEntry, id);
  assert.equal(row.dataset.resourceRowId, id);
  assert.equal(row.getAttribute("onmouseover"), null);
  assert.equal(row.querySelector("h4").textContent, title);
  assert.equal(row.querySelector("img, script"), null);
  for (const control of row.querySelectorAll("[data-action]")) {
    assert.equal(control.dataset.id, id);
    assert.equal(control.getAttribute("onmouseover"), null);
  }
  assert.equal(row.querySelector('[data-action="chatbot-edit"]').getAttribute("aria-label"), `Modifier ${title}`);
  assert.equal(calls.length, 0);
});

test("rafraîchir la liste suit les commandes du profil visible sans altérer les anciennes entrées", (t) => {
  const hidden = { id: "timer", kind: "timer", response: "Texte conservé" };
  const { window, state, calls } = chatbotContext(t, { commands: [command(), hidden] });
  const firstProfileCommands = JSON.stringify(state.commands);
  state.session.profileId = "second";
  state.commands = [command({ id: "second", command: "!pause", execution: { type: "music", operation: "pause" } }), hidden];
  assert.equal(window.syncCreatorChatbotRuntime(), true);
  assert.deepEqual([...window.content.querySelectorAll("[data-chatbot-entry]")].map((row) => row.dataset.chatbotEntry), ["second"]);
  assert.equal(state.commands[1], hidden);
  state.commands = JSON.parse(firstProfileCommands);
  assert.equal(window.syncCreatorChatbotRuntime(), true);
  assert.equal(JSON.stringify(state.commands), firstProfileCommands);
  assert.equal(calls.length, 0);
});

test("Commandes présente exclusivement des effets et garde toutes les données anciennes sans migration", (t) => {
  const oldRows = [
    { id: "reply", command: "!ancien", response: "Texte ancien privé", enabled: true },
    { id: "auto", kind: "auto-reply", matchText: "salut", response: "Auto-réponse privée" },
    { id: "timer", kind: "timer", response: "Message programmé privé", intervalMs: 60000 },
    { id: "invalid-auto", kind: "auto-reply", execution: { type: "music", operation: "next" }, response: "Pas une commande" }
  ];
  const { window, state } = chatbotContext(t, { commands: [...oldRows, command()] });
  const before = JSON.stringify(state.commands);
  const page = window.content.querySelector(".creator-chatbot-page");
  assert.ok(page.querySelector('[data-studio-hero="chatbot"]'));
  assert.equal(page.querySelectorAll("[data-chatbot-entry]").length, 1);
  assert.equal(page.querySelector("[data-chatbot-entry]").dataset.chatbotEntry, "cmd");
  assert.equal(page.querySelector(".chatbot-tab"), null);
  assert.equal(page.querySelector(".chatbot-delivery"), null);
  assert.doesNotMatch(page.textContent, /Texte ancien privé|Auto-réponse privée|Message programmé privé|Messages automatiques|ancien fonctionnement|SyncLive/iu);
  assert.equal(JSON.stringify(state.commands), before);
  window.syncCreatorChatbotRuntime();
  assert.equal(JSON.stringify(state.commands), before);
});

test("un catalogue contenant uniquement des anciennes entrées affiche une liste vide sans supprimer celles-ci", (t) => {
  const rows = [{ id: "old", command: "!ancien", response: "Ancien message" }];
  const { window, state, calls } = chatbotContext(t, { commands: rows });
  const before = JSON.stringify(state.commands);
  assert.equal(window.content.querySelector(".chatbot-entry"), null);
  assert.ok(window.content.querySelector(".chatbot-empty"));
  assert.equal(window.creatorChatbotRows().length, 0);
  assert.equal(JSON.stringify(state.commands), before);
  assert.equal(calls.length, 0);
});

test("les handlers et éditeurs refusent les anciennes entrées cachées, même appelés directement", async (t) => {
  const old = { id: "old", command: "!ancien", response: "Message historique" };
  const { window, state, action, calls } = chatbotContext(t, { commands: [old] });
  const before = JSON.stringify(state.commands);
  for (const operation of ["chatbot-edit", "chatbot-preview", "chatbot-delete", "chatbot-toggle"]) await assert.rejects(action(operation, window.document.createElement("button"), "old"), /ne correspond pas/);
  assert.throws(() => window.openCreatorChatbotEditor(old), /ne correspond pas/);
  assert.throws(() => window.openCreatorChatbotPreview(old), /ne correspond pas/);
  assert.throws(() => window.openCreatorChatbotEditor(null, "auto-reply"), /Seules les commandes/);
  assert.throws(() => window.openCreatorChatbotEditor(null, "timer"), /Seules les commandes/);
  assert.equal(JSON.stringify(state.commands), before);
  assert.equal(calls.length, 0);
});

test("seuls trois effets sont proposés et un formulaire forgé ne peut créer une réponse texte", async (t) => {
  const { window, action, editor, calls } = chatbotContext(t);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  assert.deepEqual([...window.dialogForm.elements.namedItem("executionType").options].map((row) => row.value), ["music", "action", "overlay"]);
  assert.equal(window.dialogForm.querySelector("textarea"), null);
  assert.equal(window.dialogForm.elements.namedItem("response"), null);
  assert.equal(window.dialogForm.elements.namedItem("messages"), null);
  assert.equal(window.dialogForm.elements.namedItem("keywords"), null);
  const forged = new window.FormData(window.dialogForm);
  forged.set("executionType", "reply");
  forged.set("response", "Interdit");
  await assert.rejects(editor().onSubmit(forged), /doit cibler/);
  assert.equal(calls.length, 0);
});

test("une commande héritant d'un texte historique reste éditable mais ce texte est non visible et immuable", async (t) => {
  const historical = "Texte historique non envoyé";
  const { window, state, action, editor } = chatbotContext(t, { commands: [command({ response: historical })] });
  await action("chatbot-edit", window.document.createElement("button"), "cmd");
  assert.doesNotMatch(window.dialog.textContent, /Texte historique non envoyé/);
  const data = new window.FormData(window.dialogForm);
  data.set("response", "Un remplacement forgé");
  await editor().onSubmit(data);
  assert.equal(state.commands[0].response, historical);
  assert.equal(state.commands[0].execution.type, "music");
});

test("les noms conservés d'anciennes réponses ne réservent plus les commandes fonctionnelles", async (t) => {
  const old = { id: "old", command: "!skip", aliases: ["!s"], response: "Historique" };
  const { window, state, action, editor } = chatbotContext(t, { commands: [old] });
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  window.dialogForm.elements.namedItem("aliases").value = "!s";
  await editor().onSubmit(new window.FormData(window.dialogForm));
  assert.equal(JSON.stringify(state.commands[0]), JSON.stringify(old));
  assert.equal(state.commands[1].command, "!skip");
  assert.deepEqual([...state.commands[1].aliases], ["!s"]);
});

test("les doublons fonctionnels restent interdits sans appel de stockage", async (t) => {
  const { window, action, editor, calls } = chatbotContext(t, { commands: [command()] });
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  await assert.rejects(editor().onSubmit(new window.FormData(window.dialogForm)), /existe déjà/);
  assert.equal(calls.length, 0);
});

test("les alias et noms d'actions sont échappés et protégés des traductions", (t) => {
  const { window, state } = chatbotContext(t, { commands: [command({ aliases: ["!<script>"], execution: { type: "action", actionId: "a" } })] });
  state.rules = [{ id: "r", name: '<img src=x onerror="alert(1)">Accueil', enabled: true, actions: [{ id: "a", type: "audio.play" }] }];
  state.profiles.find((row) => row.id === state.session.profileId).enabledRuleIds = ["r"];
  window.render();
  assert.equal(window.content.querySelector(".chatbot-entry-response img"), null);
  assert.match(window.content.querySelector(".chatbot-entry-response").textContent, /<img/);
  assert.ok(window.content.querySelector(".chatbot-entry-response").hasAttribute("data-studio-user-content"));
  assert.ok(window.content.querySelector(".chatbot-aliases code").hasAttribute("data-studio-user-content"));
  assert.equal(window.content.querySelector(".chatbot-aliases script"), null);
});

test("activer, modifier et supprimer une commande préserve les autres et les données cachées", async (t) => {
  const hidden = { id: "hidden", kind: "timer", response: "Message historique", intervalMs: 120000 };
  const { window, state, action, editor } = chatbotContext(t, { commands: [command(), command({ id: "keep", command: "!pause", execution: { type: "music", operation: "pause" } }), hidden] });
  const target = window.document.createElement("input");
  target.checked = false;
  await action("chatbot-toggle", target, "cmd");
  assert.equal(state.commands[0].enabled, false);
  await action("chatbot-edit", target, "cmd");
  chooseEffectField(window, "executionOperation", "play");
  await editor().onSubmit(new window.FormData(window.dialogForm));
  assert.equal(state.commands[0].id, "cmd");
  assert.equal(state.commands[0].enabled, false);
  assert.equal(state.commands[0].execution.operation, "play");
  await action("chatbot-delete", target, "cmd");
  assert.equal(state.commands.length, 2);
  assert.equal(state.commands[0].id, "keep");
  assert.equal(JSON.stringify(state.commands[1]), JSON.stringify(hidden));
});

test("annuler une suppression et changer de profil ou de compte empêche toute sauvegarde hors périmètre", async (t) => {
  const { window, action, state, calls, editor, confirmation } = chatbotContext(t, { commands: [command()] });
  confirmation(false);
  await action("chatbot-delete", window.document.createElement("button"), "cmd");
  assert.equal(calls.length, 0);
  await action("chatbot-edit", window.document.createElement("button"), "cmd");
  state.session.profileId = "other-profile";
  await assert.rejects(editor().onSubmit(new window.FormData(window.dialogForm)), /profil a changé/);
  assert.equal(calls.length, 0);
  await action("chatbot-edit", window.document.createElement("button"), "cmd");
  state.settings.account.uid = "other-account";
  await assert.rejects(editor().onSubmit(new window.FormData(window.dialogForm)), /compte a changé/);
  assert.equal(calls.length, 0);
});

test("une opération tardive ne publie pas le snapshot d'un autre compte", async (t) => {
  const { window, action, state, calls } = chatbotContext(t, { commands: [command()] });
  let complete;
  window.api.upsert = () => new Promise((resolve) => { complete = resolve; });
  const target = window.document.createElement("input");
  target.checked = false;
  const pending = action("chatbot-toggle", target, "cmd");
  state.settings.account.uid = "other-account";
  complete();
  await assert.rejects(pending, /compte a changé/);
  assert.equal(calls.length, 0);
  assert.equal(target.checked, true);
  assert.equal(target.disabled, false);
});

test("le journal ne présente que six effets du profil et ses caches ignorent toutes les réponses anciennes", (t) => {
  const { window, state } = chatbotContext(t, { commands: [command()] });
  const hero = window.content.querySelector(".chatbot-hero");
  const card = window.content.querySelector(".chatbot-entry");
  state.activity = [
    { id: "foreign", category: "chatbot", executionType: "music", profileId: "other", title: "Hors profil", detail: "privé" },
    { id: "legacy", category: "chatbot", profileId: state.session.profileId, title: "Réponse automatique ancienne", detail: "Message caché" },
    ...Array.from({ length: 10 }, (_, index) => ({ id: `entry_${index}`, category: "chatbot", executionType: "music", profileId: state.session.profileId, title: "Commande exécutée", detail: `<b>${index}</b>`, timestamp: "2026-10-14T10:00:00Z" }))
  ];
  assert.equal(window.syncCreatorChatbotActivity(), true);
  assert.equal(window.content.querySelector(".chatbot-hero"), hero);
  assert.equal(window.content.querySelector(".chatbot-entry"), card);
  const entries = window.content.querySelectorAll(".chatbot-journal-list > article");
  assert.equal(entries.length, 6);
  assert.equal(entries[0].querySelector("p b"), null);
  assert.equal(entries[0].querySelector("p").textContent, "<b>0</b>");
  assert.doesNotMatch(window.content.querySelector(".chatbot-journal").textContent, /Hors profil|Réponse automatique ancienne|Message caché/);
  state.activity[1].detail = "Modification ancienne ignorée";
  window.syncCreatorChatbotActivity();
  assert.equal(window.content.querySelector(".chatbot-journal-list article"), entries[0]);
  state.activity[2].queued = true;
  state.activity[2].level = "success";
  window.syncCreatorChatbotActivity();
  assert.equal(window.content.querySelector(".chatbot-journal-icon").classList.contains("is-sent"), false);
  assert.equal(window.creatorChatbotActivityIcon(state.activity[2]), "clock");
  state.activity[2].partial = true;
  window.syncCreatorChatbotActivity();
  assert.equal(window.creatorChatbotActivityIcon(state.activity[2]), "shield");
});

test("les aperçus enregistrés et en cours de saisie n'appellent aucune API ni événement LIVE", async (t) => {
  const { window, action, editor, calls, state } = chatbotContext(t, { commands: [command()] });
  const before = JSON.stringify(state);
  await action("chatbot-preview", window.document.createElement("button"), "cmd");
  assert.equal(editor().onSubmit, undefined);
  assert.match(window.dialog.textContent, /Passer au morceau suivant/);
  await action("chatbot-edit", window.document.createElement("button"), "cmd");
  chooseEffectField(window, "executionOperation", "volume");
  chooseEffectField(window, "executionVolume", "35");
  assert.match(window.dialog.querySelector(".chatbot-preview-result").textContent, /35 %/);
  assert.equal(calls.length, 0);
  assert.equal(JSON.stringify(state), before);
});

test("sans compte aucune commande privée ni création ne reste accessible", async (t) => {
  const { window, action, calls } = chatbotContext(t, { commands: [command({ response: "Texte privé" })], authenticated: false });
  assert.ok(window.content.querySelector(".private"));
  assert.doesNotMatch(window.content.textContent, /Texte privé/);
  await assert.rejects(action("chatbot-add", window.document.createElement("button")), /compte a changé/);
  assert.equal(calls.length, 0);
});

function chooseEffectField(window, name, value) {
  const control = window.dialogForm.elements.namedItem(name);
  assert.ok(control, `Le champ ${name} doit être présent.`);
  if (control.type === "checkbox") control.checked = Boolean(value);
  else control.value = value;
  control.dispatchEvent(new window.Event("input", { bubbles: true }));
}

test("une nouvelle commande pilote la musique sans réponse et possède des protections sûres par défaut", async (t) => {
  const { window, state, action, editor, calls } = chatbotContext(t);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  assert.equal(window.dialogForm.elements.namedItem("command").value, "!skip");
  assert.equal(window.dialogForm.elements.namedItem("response"), null);
  assert.equal(window.dialogForm.elements.namedItem("audience").value, "moderator");
  assert.equal(window.dialogForm.elements.namedItem("cooldownSeconds").value, "10");
  assert.equal(window.dialogForm.elements.namedItem("globalCooldownSeconds").value, "3");
  assert.match(window.dialog.querySelector("[data-chatbot-draft-preview]").textContent, /Passer au morceau suivant/);
  assert.equal(calls.length, 0, "Le rendu et l'aperçu n'exécutent rien.");
  await editor().onSubmit(new window.FormData(window.dialogForm));
  assert.deepEqual(JSON.parse(JSON.stringify(state.commands[0].execution)), { type: "music", operation: "next" });
  assert.equal(state.commands[0].response, "");
  assert.equal(state.commands[0].cooldownMs, 10000);
  window.render();
  assert.match(window.content.querySelector(".chatbot-entry-response").textContent, /Passer au morceau suivant/);
  assert.equal(window.content.querySelector(".chatbot-effect-badge").textContent, "Musique");
});

test("les trois cibles musique, action et overlay se créent avec leurs paramètres et sans appel réel", async (t) => {
  const { window, state, action, editor, calls } = chatbotContext(t);
  state.rules = [{ id: "rule_active", name: "Mon son", enabled: true, actions: [{ id: "action_audio", type: "audio.play", config: { url: "fixture.mp3" } }] }];
  state.profiles.find((entry) => entry.id === state.session.profileId).enabledRuleIds = ["rule_active"];
  const cases = [
    { type: "music", name: "!song", fields: { executionOperation: "queue", executionUseArgs: true }, expected: { type: "music", operation: "queue", useArgs: true, query: "", uri: "" } },
    { type: "action", name: "!son", fields: { executionActionId: "action_audio" }, expected: { type: "action", actionId: "action_audio" } },
    { type: "overlay", name: "!temps", fields: { executionOverlayKey: "timer", executionOperation: "remove", executionSeconds: "45" }, expected: { type: "overlay", overlayKey: "timer", operation: "remove", seconds: 45 } }
  ];
  for (const [index, { type, name, fields, expected }] of cases.entries()) {
    await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
    chooseEffectField(window, "command", name);
    chooseEffectField(window, "executionType", type);
    for (const [key, value] of Object.entries(fields)) chooseEffectField(window, key, value);
    assert.ok(window.dialog.querySelector(".chatbot-preview-result p").textContent);
    assert.equal(calls.filter(([call]) => call === "upsert").length, index);
    await editor().onSubmit(new window.FormData(window.dialogForm));
    assert.deepEqual(JSON.parse(JSON.stringify(state.commands.at(-1).execution)), expected);
  }
  assert.equal(state.commands.length, 3);
  assert.ok(calls.every(([type]) => ["upsert", "snapshot", "accept"].includes(type)));
});

test("changer de type ou d'opération conserve les brouillons et ne vole pas le focus en saisie", async (t) => {
  const { window, action, calls } = chatbotContext(t);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  chooseEffectField(window, "executionOperation", "queue");
  const query = window.dialogForm.elements.namedItem("executionQuery");
  query.focus();
  chooseEffectField(window, "executionQuery", "Mon artiste");
  assert.equal(window.document.activeElement, query);
  const operation = window.dialogForm.elements.namedItem("executionOperation");
  operation.focus();
  chooseEffectField(window, "executionOperation", "pause");
  assert.equal(window.document.activeElement.name, "executionOperation");
  assert.equal(window.dialogForm.elements.namedItem("executionQuery"), null);
  chooseEffectField(window, "executionOperation", "queue");
  assert.equal(window.dialogForm.elements.namedItem("executionQuery").value, "Mon artiste");
  chooseEffectField(window, "executionType", "overlay");
  chooseEffectField(window, "executionSeconds", "75");
  chooseEffectField(window, "executionType", "music");
  assert.equal(window.dialogForm.elements.namedItem("executionQuery").value, "Mon artiste");
  chooseEffectField(window, "executionType", "overlay");
  assert.equal(window.dialogForm.elements.namedItem("executionSeconds").value, "75");
  assert.equal(calls.length, 0);
});

test("les actions désactivées, inaccessibles ou ambiguës ne sont pas proposées et une ancienne cible absente reste visible", async (t) => {
  const { window, state, action, editor, calls } = chatbotContext(t, { commands: [command({ response: "Bonjour {{user.displayName}}, {{args}}", execution: { type: "action", actionId: "missing" } })] });
  state.rules = [
    { id: "enabled", name: "Actif", enabled: true, actions: [{ id: "good", type: "audio.play" }, { id: "paused", type: "audio.play", enabled: false }, { id: "duplicate", type: "audio.play" }] },
    { id: "disabled", name: "Désactivé", enabled: false, actions: [{ id: "inactive", type: "audio.play" }] },
    { id: "second", name: "Ambigu", enabled: true, actions: [{ id: "duplicate", type: "audio.play" }] },
    { id: "out", name: "Hors profil", enabled: true, actions: [{ id: "outside", type: "audio.play" }] }
  ];
  state.profiles.find((entry) => entry.id === state.session.profileId).enabledRuleIds = ["enabled", "disabled", "second"];
  await action("chatbot-edit", window.document.createElement("button"), "cmd");
  const select = window.dialogForm.elements.namedItem("executionActionId");
  assert.deepEqual([...select.options].map((option) => option.value), ["", "good", "missing"]);
  assert.equal(select.value, "missing");
  assert.match(select.selectedOptions[0].textContent, /indisponible/);
  chooseEffectField(window, "executionActionId", "good");
  await editor().onSubmit(new window.FormData(window.dialogForm));
  assert.equal(state.commands[0].execution.actionId, "good");
  assert.equal(state.commands[0].response, "Bonjour {{user.displayName}}, {{args}}", "Le texte ancien est conservé sans être exigé ni envoyé par cet éditeur.");
  assert.equal(calls.filter(([type]) => type === "upsert").length, 1);
});

test("les paramètres incomplets restent éditables et un lien de playlist est normalisé correctement", async (t) => {
  const { window, state, action, editor, calls } = chatbotContext(t);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  chooseEffectField(window, "executionOperation", "play_playlist");
  assert.match(window.dialog.querySelector(".chatbot-preview-result").textContent, /À compléter/);
  const playlist = "37i9dQZF1DXcBWIGoYBM5M";
  chooseEffectField(window, "executionPlaylistId", `https://open.spotify.com/playlist/${playlist}?si=fixture`);
  await editor().onSubmit(new window.FormData(window.dialogForm));
  assert.equal(state.commands[0].execution.playlistId, playlist);
  assert.equal(state.commands[0].execution.uri, `spotify:playlist:${playlist}`);
  assert.equal(calls.filter(([type]) => type === "upsert").length, 1);
});

test("un changement de compte ou de profil refuse aussi la création d'une commande fonctionnelle", async (t) => {
  const { window, state, action, editor, calls } = chatbotContext(t);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  state.session.profileId = "changed";
  await assert.rejects(editor().onSubmit(new window.FormData(window.dialogForm)), /profil a changé/);
  assert.equal(calls.length, 0);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  state.settings.account.uid = "changed";
  await assert.rejects(editor().onSubmit(new window.FormData(window.dialogForm)), /compte a changé/);
  assert.equal(calls.length, 0);
});

test("les commandes proposent seulement les actions locales et du jeu actif, avec les mêmes ambiguïtés que le moteur", (t) => {
  const { window, state } = chatbotContext(t);
  state.rules = [{ id: "local", enabled: true, actions: [{ id: "good", type: "audio.play" }, { id: "ambiguous", type: "audio.play" }] },
    { id: "paused", enabled: false, actions: [{ id: "ambiguous", type: "audio.play" }] }];
  state.profiles.find((entry) => entry.id === state.session.profileId).enabledRuleIds = ["local", "paused"];
  state.session.game = { running: true, packId: "fixture", profileId: state.session.profileId };
  state.game.interactionRulesByPack = {
    fixture: [{ id: "game", enabled: true, actions: [{ id: "game_effect", type: "game.effect" }] }],
    other: [{ id: "other", enabled: true, actions: [{ id: "private_game", type: "game.effect" }] }]
  };
  const ids = () => [...window.creatorCommandActionRows()].map(({ action }) => action.id);
  assert.deepEqual(ids(), ["good", "game_effect"]);
  state.session.game.profileId = "other-profile";
  assert.deepEqual(ids(), ["good"]);
  state.session.game.profileId = state.session.profileId;
  state.session.game.running = false;
  assert.deepEqual(ids(), ["good"]);
});

test("une roue conserve ses secteurs indisponibles, indique leur statut et ne propose pas les identifiants dupliqués", async (t) => {
  const { window, state, action, calls } = chatbotContext(t);
  state.settings.overlayConfigs.wheel = { selectedWheelId: "selected", wheels: [
    { id: "selected", name: "Ma roue", enabled: true, segments: [{ actionId: "paused" }, { actionId: "deleted" }, { action: "spin", actionId: "ignored" }, { actionId: "" }] },
    { id: "selected", name: "Doublon historique", enabled: true, segments: [] },
    { id: "hidden", enabled: false, segments: [] }
  ] };
  const before = JSON.stringify(state.settings.overlayConfigs.wheel);
  assert.deepEqual([...window.creatorCommandWheels()].map((wheel) => wheel.name), ["Ma roue"]);
  assert.match(window.creatorCommandEffectDescription({ execution: { type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "selected" } }), /2 secteur.*action indisponible/);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  chooseEffectField(window, "executionType", "overlay");
  chooseEffectField(window, "executionOverlayKey", "wheel");
  chooseEffectField(window, "executionWheelId", "selected");
  assert.deepEqual([...window.dialogForm.elements.namedItem("executionWheelId").options].map((entry) => entry.value), ["", "selected"]);
  assert.match(window.dialog.querySelector(".chatbot-preview-result").textContent, /Ma roue.*2 secteur/);
  assert.equal(JSON.stringify(state.settings.overlayConfigs.wheel), before);
  assert.equal(calls.length, 0);
});

test("le formulaire explique les droits par défaut et affiche un refus d'enregistrement sans enveloppe Electron", async (t) => {
  const { window, action, editor } = chatbotContext(t);
  await action("chatbot-add", window.content.querySelector(".chatbot-hero-action"));
  assert.match(window.dialog.textContent, /compte de test non modérateur/);
  const raw = new Error("Error invoking remote method 'entity:upsert': Error: La roue liée est désactivée ou introuvable.");
  window.api.upsert = async () => { throw raw; };
  await assert.rejects(editor().onSubmit(new window.FormData(window.dialogForm)), (error) => {
    assert.equal(error.message, "La roue liée est désactivée ou introuvable.");
    assert.equal(error.cause, raw);
    return true;
  });
  assert.equal(window.dialogForm.elements.namedItem("command").value, "!skip");
});
