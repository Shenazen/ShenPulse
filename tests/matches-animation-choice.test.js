"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const root = path.resolve(__dirname, "..");
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(setImmediate);

function fixture(context, hooks = {}) {
  const dom = new JSDOM('<main></main><dialog><form></form></dialog>', { runScripts: "outside-only", url: "https://fixture.invalid" });
  context.after(() => dom.window.close());
  const w = dom.window, calls = [], subscriptions = new Map(), account = { uid: "fixture-owner", authenticated: true };
  const state = { settings: { account: { uid: account.uid }, overlayPort: 21213, overlayToken: "synthetic-preview-token", matches: { automations: [], widgets: {} } },
    session: { profileId: "fixture-profile" }, matchSession: {} };
  const controls = { pro: true, visible: true };
  Object.assign(w, { snapshot: { state, localOverlayUrls: { base: "http://127.0.0.1:21213" }, overlayUrls: { matchPlayer: "https://fixture.invalid/m/never-live" } },
    content: w.document.querySelector("main"), dialog: w.document.querySelector("dialog"), currentPage: "matches", dialogSessionId: 0,
    ACTION_NOT_HANDLED: Symbol("unhandled"), CREATOR_MATCH_WIDGETS: [],
    visibleAccountSession: () => account, isAccountAuthenticated: () => account.authenticated, hasProAccess: () => controls.pro,
    canNavigateTo: () => account.authenticated && controls.pro, rendererVisualsActive: () => controls.visible,
    creatorMatchesIcon: () => "<svg></svg>", cryptoId: () => "fixture-id",
    creatorMatchesOwnerKey: () => `${account.uid}:${state.session.profileId}`, creatorCommandActionRows: () => [],
    creatorMatchesModel: () => ({ config: state.settings.matches, automations: state.settings.matches.automations, capabilities: { cards: false }, runtime: {} }),
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    soundPickerField: (name, value) => `<input name="${name}" value="${value}">`, mediaPickerField: (name, _label, value) => `<input name="${name}" value="${value}">`,
    overlayPlaceholderMatch: (item, variant) => `<span data-fixture-poster="${item.match}:${variant}"></span>`,
    perform: async (work) => work(), toast: () => {}, confirmAction: async () => true,
    acceptSnapshot: (value) => { calls.push({ method: "acceptSnapshot" }); w.snapshot = value; }, syncCreatorMatchesRuntime: () => true,
    render: () => {}, registerActionHandler: (_actions, handler) => { w.matchesHandler = handler; }
  });
  w.dialogForm = w.dialog.querySelector("form");
  w.openEditor = (options) => { w.dialogSessionId += 1; w.editor = options; w.dialog.open = true; w.dialogForm.innerHTML = options.body; };
  w.api = { matches: {
    saveAutomation: async (...args) => { calls.push({ method: "saveAutomation", args: plain(args) });
      if (hooks.saveAutomation) return hooks.saveAutomation(...args);
      const item = args[0], index = state.settings.matches.automations.findIndex(row => row.id === item.id);
      if (index >= 0) state.settings.matches.automations[index] = plain(item); else state.settings.matches.automations.push(plain(item));
      return { snapshot: w.snapshot };
    },
    testAutomation: async (...args) => { calls.push({ method: "testAutomation", args }); }, testWidget: async () => { throw new Error("No LIVE test"); }
  }, on: (channel, listener) => { const set = subscriptions.get(channel) || new Set(); set.add(listener); subscriptions.set(channel, set); return () => set.delete(listener); } };
  const run = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), dom.getInternalVMContext(), { filename: file });
  run("resources/overlays/catalog/matches.js"); run("src/shared/matches-contract.js");
  w.MATCH_OVERLAYS = w.ShenPulseOverlayMatchCatalog.matches.map(row => [row.key, row.name, row.match]);
  w.CREATOR_MATCH_MOMENT_LABELS = Object.fromEntries(w.ShenPulseMatches.MATCH_MOMENTS.map(row => [row.id, [row.label, "", "play"]]));
  run("src/renderer/app/core/components.js"); run("src/renderer/app/core/account-operation-guard.js");
  run("src/renderer/app/features/matches/reactions.js"); run("src/renderer/app/features/matches/editor.js");
  run("src/renderer/app/actions/handlers/creator-matches.js");
  w.field = (...args) => w.inputFieldMarkup(...args);
  const entry = (moment = "multiplierX3", reaction = { type: "animation", match: "x3", variant: "cyber", fit: "contain" }) => ({
    id: `auto-${moment}`, name: moment, enabled: true, moment, card: "any", threshold: 300, windowSeconds: 5, remainingSeconds: 15, cooldownMs: 5000, reaction });
  const click = (action, target = {}) => w.matchesHandler({ action, id: target.id, target: { disabled: false, dataset: { ...target }, ...target } });
  const change = (name, value) => { const field = w.dialog.querySelector(`[name="${name}"]`); field.value = value; field.dispatchEvent(new w.Event("change", { bubbles: true })); };
  return { w, state, account, controls, calls, subscriptions, entry, click, change, form: () => new w.FormData(w.dialogForm),
    emit: (channel, value) => [...(subscriptions.get(channel) || [])].forEach(listener => listener(value)) };
}

test("animation choices: every moment exposes only its own asset and available pack labels, never a fallback", (context) => {
  const f = fixture(context), mapping = { battleStart: "cofre", multiplierX2: "x2", multiplierX3: "x3", card: "guantes", likeRush: "taptap", snipe: "snipe" };
  for (const moment of f.w.ShenPulseMatches.MATCH_MOMENTS) {
    f.w.content.innerHTML = f.w.creatorMatchesAnimationSelect(null, moment.id);
    const options = [...f.w.content.querySelectorAll("option")];
    const packs = mapping[moment.id] ? mapping[moment.id] === "cofre" ? ["tikcontrol", "gladiador"] : ["tikcontrol", "gladiador", "cyber"] : [];
    assert.deepEqual(options.map(row => row.value), ["", ...packs.map(pack => `${mapping[moment.id]}:${pack}`)]);
    assert.deepEqual(options.map(row => row.textContent), ["Aucun", ...packs.map(pack => ({ tikcontrol: "TikControl", gladiador: "Gladiator", cyber: "Cyber" })[pack])]);
    assert.equal(f.w.content.querySelector("iframe, video, audio"), null);
  }
  assert.deepEqual(f.calls, []);
});

test("animation choices: an incompatible historical value shows None and a warning without changing saved settings", (context) => {
  const f = fixture(context), old = f.entry("multiplierX3", { type: "animation", match: "x2", variant: "cyber" });
  f.state.settings.matches.automations.push(old); const before = JSON.stringify(old);
  f.w.content.innerHTML = f.w.creatorMatchesAnimationSelect(old, old.moment);
  assert.equal(f.w.content.querySelector("select").value, "");
  assert.match(f.w.content.textContent, /ancienne animation.*Réglage conservé/s);
  assert.equal(f.w.content.querySelector('[data-action="matches-animation-local-preview"]'), null);
  assert.equal(JSON.stringify(old), before); assert.deepEqual(f.calls, []);
});

test("animation choices: an x3 field cannot save, preview or test x2, malformed packs or unsupported assets", async (context) => {
  const f = fixture(context), old = f.entry(); f.state.settings.matches.automations.push(old);
  for (const value of ["x2:cyber", "x3:unknown", "x3:cyber:extra", "cofre:cyber", "enigma:tikcontrol"]) {
    await assert.rejects(f.click("matches-automation-animation", { id: old.id, value }), /ne correspond pas/);
  }
  f.state.settings.matches.automations[0].reaction.match = "x2";
  await assert.rejects(f.click("matches-animation-local-preview", { id: old.id }), /ne correspond pas/);
  await assert.rejects(f.click("matches-automation-test", { id: old.id }), /compatible/);
  assert.deepEqual(f.calls, []); assert.equal(f.w.dialog.querySelector("iframe"), null);
});

test("animation choices: successful x3 selection preserves other outputs and opens only the muted protected local preview", async (context) => {
  const f = fixture(context), others = [{ type: "sound", url: "https://fixture.invalid/sound.mp3", outputMode: "live", volume: 0.5 },
    { type: "media", mediaUrl: "https://fixture.invalid/video.mp4", durationMs: 4000, screen: 1 }, { type: "action", actionId: "fixture-irl-never-run" }];
  const old = f.entry("multiplierX3", { type: "bundle", reactions: [f.entry().reaction, ...others] });
  f.state.settings.matches.automations.push(old);
  await f.click("matches-automation-animation", { id: old.id, value: "x3:gladiador" });
  const saved = f.calls.find(row => row.method === "saveAutomation").args[0];
  assert.deepEqual(saved.reaction.reactions.filter(row => row.type !== "animation"), others);
  assert.deepEqual(saved.reaction.reactions.find(row => row.type === "animation"), { type: "animation", match: "x3", variant: "gladiador", fit: "contain" });
  const frame = f.w.dialog.querySelector("iframe"), url = new URL(frame.src);
  assert.equal(url.origin, "http://127.0.0.1:21213"); assert.equal(url.pathname, "/overlay/");
  assert.equal(url.searchParams.get("match"), "x3"); assert.equal(url.searchParams.get("variant"), "gladiador");
  assert.equal(url.searchParams.get("preview"), "animated"); assert.equal(url.searchParams.get("soundEnabled"), "false");
  assert.equal(url.searchParams.get("loop"), "false"); assert.equal(url.searchParams.has("channel"), false);
  assert.equal(frame.getAttribute("sandbox"), "allow-scripts allow-same-origin");
  assert.equal(f.calls.some(row => row.method.startsWith("test")), false);
  assert.match(f.w.dialog.textContent, /Rien n’est envoyé au LIVE/);
});

test("animation choices: None removes only the animation and disarms an otherwise empty automation", async (context) => {
  const f = fixture(context), sound = { type: "sound", url: "https://fixture.invalid/sound.mp3", outputMode: "local", volume: 1 };
  const old = f.entry("multiplierX3", { type: "bundle", reactions: [f.entry().reaction, sound] });
  f.state.settings.matches.automations.push(old);
  await f.click("matches-automation-animation", { id: old.id, value: "" });
  assert.deepEqual(f.calls.find(row => row.method === "saveAutomation").args[0].reaction.reactions, [sound]);
  assert.equal(f.calls.find(row => row.method === "saveAutomation").args[0].enabled, true);
  assert.equal(f.w.dialog.querySelector("iframe"), null);
  const only = f.entry("multiplierX2", { type: "animation", match: "x2", variant: "cyber" });
  f.state.settings.matches.automations.push(only); await f.click("matches-automation-animation", { id: only.id, value: "" });
  assert.equal(f.calls.filter(row => row.method === "saveAutomation").at(-1).args[0].enabled, false);
});

test("legacy removal: a real card button click removes the old animation even though the select already shows None", async (context) => {
  const f = fixture(context), sound = { type: "sound", url: "https://fixture.invalid/keep.mp3", outputMode: "local", volume: 1 };
  const old = f.entry("multiplierX3", { type: "bundle", reactions: [{ type: "animation", match: "x2", variant: "cyber" }, sound] });
  f.state.settings.matches.automations.push(old); f.w.content.innerHTML = f.w.creatorMatchesAnimationSelect(old, old.moment);
  assert.equal(f.w.content.querySelector("select").value, ""); assert.deepEqual(f.calls, []);
  let pending;
  f.w.content.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (button) pending = f.w.matchesHandler({ action: button.dataset.action, id: button.dataset.id, target: button });
  });
  f.w.content.querySelector('[data-action="matches-automation-animation-remove"]').click(); await pending;
  const saved = f.calls.find(row => row.method === "saveAutomation").args[0];
  assert.deepEqual(saved.reaction.reactions, [sound]); assert.equal(saved.enabled, true);
  assert.equal(f.w.dialog.querySelector("iframe"), null);
});

test("legacy removal: advanced remove button changes only the draft until Submit and disarms an empty result", async (context) => {
  const f = fixture(context), old = f.entry("multiplierX3", { type: "animation", match: "x2", variant: "cyber" });
  f.state.settings.matches.automations.push(old); const before = JSON.stringify(old);
  f.w.openCreatorMatchesAutomationEditor(old);
  assert.equal(f.w.dialog.querySelector('[name="matchVariant"]').value, "");
  f.w.dialog.querySelector("[data-matches-editor-remove-animation]").click();
  assert.equal(f.w.dialog.querySelector('[name="matchAnimationChanged"]').value, "1");
  assert.equal(f.w.dialog.querySelector("[data-matches-animation-warning]").hidden, true);
  assert.equal(JSON.stringify(old), before); assert.deepEqual(f.calls, []);
  await f.w.editor.onSubmit(f.form());
  const saved = f.calls.find(row => row.method === "saveAutomation").args[0];
  assert.deepEqual(saved.reaction.reactions, []); assert.equal(saved.enabled, false);
});

test("advanced editor: only the current moment's packs are offered, switching moments resets the model and x3 previews never become x2", (context) => {
  const f = fixture(context); f.w.openCreatorMatchesAutomationEditor(f.entry("multiplierX2", { type: "animation", match: "x2", variant: "cyber" }));
  assert.deepEqual([...f.w.dialog.querySelector('[name="matchVariant"]').options].map(row => row.textContent), ["Aucun", "TikControl", "Gladiator", "Cyber"]);
  assert.equal(f.w.dialog.querySelector('[name="matchAnimation"]').type, "hidden");
  assert.equal(f.w.dialog.querySelector("iframe"), null);
  f.change("moment", "multiplierX3"); assert.equal(f.w.dialog.querySelector('[name="matchVariant"]').value, "");
  f.change("matchVariant", "cyber");
  assert.equal(new URL(f.w.dialog.querySelector("iframe").src).searchParams.get("match"), "x3");
  const next = f.w.creatorMatchesAutomationFromForm(f.form(), f.entry());
  assert.equal(next.reaction.reactions.find(row => row.type === "animation").match, "x3");
  f.w.dialog.querySelector('[name="matchAnimation"]').value = "x2";
  assert.throws(() => f.w.creatorMatchesAutomationFromForm(f.form(), f.entry()), /ne correspond pas/);
  assert.deepEqual(f.calls, []);
});

test("advanced editor: historical mismatch is preserved until explicit None, and removing animation keeps sound/media/action", (context) => {
  const f = fixture(context), sound = { type: "sound", url: "https://fixture.invalid/sound.mp3", volume: 1, outputMode: "local", screen: 1 };
  const old = f.entry("multiplierX3", { type: "bundle", reactions: [{ type: "animation", match: "x2", variant: "cyber", fit: "contain" }, sound] });
  f.w.openCreatorMatchesAutomationEditor(old); const before = JSON.stringify(old);
  assert.equal(f.w.dialog.querySelector('[name="matchVariant"]').value, "");
  assert.equal(f.w.dialog.querySelector("[data-matches-animation-warning]").hidden, false);
  f.w.dialog.querySelector('[name="name"]').value = "Rename only";
  assert.deepEqual(plain(f.w.creatorMatchesAutomationFromForm(f.form(), old).reaction), plain(old.reaction));
  assert.equal(JSON.stringify(old), before);
  f.change("matchFit", "cover");
  const fitted = f.w.creatorMatchesAutomationFromForm(f.form(), old).reaction.reactions;
  assert.equal(fitted.find(row => row.type === "animation").match, "x2");
  assert.equal(fitted.find(row => row.type === "animation").fit, "cover");
  assert.deepEqual(plain(fitted.filter(row => row.type !== "animation")), [sound]);
  f.change("matchVariant", "");
  assert.deepEqual(plain(f.w.creatorMatchesAutomationFromForm(f.form(), old).reaction.reactions), [sound]);
  f.change("moment", "victory");
  assert.deepEqual([...f.w.dialog.querySelector('[name="matchVariant"]').options].map(row => row.value), [""]);
  assert.equal(f.w.dialog.querySelector("iframe"), null);
});

test("local preview: close, replaced dialog, account/profile/Pro changes revoke the iframe and its listeners", async (context) => {
  for (const change of [f => { f.w.dialog.open = false; f.w.dialog.dispatchEvent(new f.w.Event("close")); },
    f => { f.w.dialogForm.innerHTML = "<p>Another editor</p>"; }, f => { f.account.uid = "other"; },
    f => { f.state.session.profileId = "other"; }, f => { f.controls.pro = false; }, f => { f.controls.visible = false; }, f => { f.w.currentPage = "home"; }]) {
    const f = fixture(context); f.w.openCreatorMatchesAnimationPreview("multiplierX3", f.entry().reaction);
    assert.ok(f.w.dialog.querySelector("iframe")); change(f); f.emit("state-changed"); await flush();
    assert.equal(f.w.dialog.querySelector("iframe"), null, change.toString());
    assert.equal([...f.subscriptions.values()].reduce((count, rows) => count + rows.size, 0), 0);
  }
});

test("local preview: a closed dialog or another page never creates even a transient iframe", (context) => {
  const f = fixture(context); f.w.openEditor({ body: '<div data-slot></div>' });
  const slot = f.w.dialog.querySelector("[data-slot]"), original = f.w.document.createElement.bind(f.w.document); let frames = 0;
  f.w.document.createElement = (...args) => { if (args[0] === "iframe") frames += 1; return original(...args); };
  f.w.dialog.open = false;
  f.w.creatorMatchesMountAnimationPreview(slot, "multiplierX3", f.entry().reaction, f.w.creatorMatchesCaptureOwner());
  f.w.dialog.open = true; f.w.currentPage = "home";
  f.w.creatorMatchesMountAnimationPreview(slot, "multiplierX3", f.entry().reaction, f.w.creatorMatchesCaptureOwner());
  f.w.currentPage = "matches"; f.controls.visible = false;
  f.w.creatorMatchesMountAnimationPreview(slot, "multiplierX3", f.entry().reaction, f.w.creatorMatchesCaptureOwner());
  assert.equal(frames, 0); assert.equal(f.w.dialog.querySelector("iframe"), null); assert.deepEqual(f.calls, []);
});

test("local preview: no local source means poster only, never a remote/player/raw fallback; access remains mandatory", (context) => {
  const f = fixture(context);
  for (const source of ["", "https://remote.invalid/overlay/?token=synthetic", "http://127.0.0.1:21213/m/never-player", "http://127.0.0.1:21213/media/x3.webm", "http://user:secret@127.0.0.1:21213/", "http://127.0.0.1:9999/", "http://127.0.0.1:21213/overlay/?token=stale-token"]) {
    f.w.snapshot.localOverlayUrls = { base: source }; f.w.openCreatorMatchesAnimationPreview("multiplierX3", f.entry().reaction);
    assert.equal(f.w.dialog.querySelector("iframe"), null);
    assert.match(f.w.dialog.textContent, /Lecteur local indisponible/);
  }
  f.controls.pro = false; assert.throws(() => f.w.openCreatorMatchesAnimationPreview("multiplierX3", f.entry().reaction), /Pro ou Premium/);
  assert.deepEqual(f.calls, []);
});

test("animation save: a late response cannot open preview for another account/profile or replace a newly opened dialog", async (context) => {
  for (const change of [f => { f.account.uid = "other"; }, f => { f.state.session.profileId = "other"; }, f => { f.w.openEditor({ body: "<p>New editor</p>" }); }]) {
    let release;
    const f = fixture(context, { saveAutomation: () => new Promise(resolve => { release = resolve; }) }), old = f.entry();
    f.state.settings.matches.automations.push(old);
    const pending = f.click("matches-automation-animation", { id: old.id, value: "x3:tikcontrol" });
    change(f); release({ snapshot: f.w.snapshot });
    if (f.account.uid !== "fixture-owner" || f.state.session.profileId !== "fixture-profile") await assert.rejects(pending, /changé/);
    else await pending;
    assert.equal(f.w.dialog.querySelector("iframe"), null);
    assert.equal(f.calls.some(row => row.method === "testAutomation"), false);
  }
});
