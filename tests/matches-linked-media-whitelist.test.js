"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { configuredMatchMediaUrls, createMatchRelayMessage } = require("../src/main/relay/match-messages");
const { MatchPublication } = require("../src/main/relay/match-publication");
const { selectStatePaths } = require("../src/main/state-projection");
const { getRuleEngineState } = require("../src/main/state/projections");

const SOUND = "https://media.example.test/account-a/fixture.mp3";
const VIDEO = "https://media.example.test/account-a/fixture.webm";
const UNUSED = "https://media.example.test/account-a/unrelated.mp3";
const audio = (id = "audio", url = SOUND) => ({ id, type: "audio.play", config: { url, outputMode: "live" } });
const rule = (id, actions) => ({ id, enabled: true, actions });
const automation = (reaction = { type: "action", actionId: "audio" }) => ({ id: "automation", enabled: true, moment: "battleStart", reaction });
function fixture() {
  return { settings: { account: { uid: "fixture-a", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" },
    siteVisibility: {}, matches: { automations: [automation()] }, overlayConfigs: { wheel: {} } },
    commerce: { subscription: { tier: "pro", status: "active" } }, session: { profileId: "profile-a" },
    customSounds: [], customMedia: [], rules: [rule("rule-a", [audio()])],
    profiles: [{ id: "profile-a", enabledRuleIds: ["rule-a"] }], game: {} };
}
const message = (state, url = SOUND) => createMatchRelayMessage("match-audio", { playbackId: "fixture-playback", url }, {
  trustedMediaUrls: configuredMatchMediaUrls(state)
});

test("retirer un son importé de la bibliothèque ne casse pas son action liée à Matchs", () => {
  const state = fixture(); state.customSounds = [{ id: "custom:fixture", source: "custom", url: SOUND }];
  const rulesBefore = structuredClone(state.rules), automationsBefore = structuredClone(state.settings.matches.automations);
  assert.ok(message(state)); state.customSounds = [];
  assert.ok(message(state)); assert.deepEqual(state.rules, rulesBefore); assert.deepEqual(state.settings.matches.automations, automationsBefore);
  assert.equal(message(state, UNUSED), null, "Un payload non configuré ne peut pas profiter du retrait");
});

test("seules les actions réellement référencées, actives, uniques et dans le profil actif autorisent leur média", () => {
  const cases = {
    disabledRule: (state) => { state.rules[0].enabled = false; },
    disabledAction: (state) => { state.rules[0].actions[0].enabled = false; },
    otherProfile: (state) => { state.profiles[0].enabledRuleIds = []; },
    missingAction: (state) => { state.settings.matches.automations[0].reaction.actionId = "missing"; },
    ambiguousAction: (state) => { state.rules[0].actions.push(audio()); },
    unrelatedAction: (state) => { state.settings.matches.automations[0].reaction.actionId = "other"; state.rules[0].actions.push(audio("other", UNUSED)); },
    inactiveAccountCache: (state) => { state.rules = []; state.accountWorkspaces = { other: { rules: [rule("rule-a", [audio()])] } }; },
    inactiveProfileWorkspace: (state) => { state.rules = []; state.profiles.push({ id: "profile-b", workspace: { rules: [rule("rule-a", [audio()])] } }); },
    invalidAutomation: (state) => { state.settings.matches.automations[0].moment = "unrecognized"; }
  };
  for (const [name, change] of Object.entries(cases)) {
    const state = fixture(); change(state); assert.equal(configuredMatchMediaUrls(state).has(SOUND), false, name);
  }
});

test("une sortie locale, une requête HTTP et les métadonnées arbitraires ne deviennent pas des médias publics", () => {
  for (const action of [
    { id: "audio", type: "audio.play", config: { url: SOUND, outputMode: "local" } },
    { id: "audio", type: "http.request", config: { url: SOUND } },
    { id: "audio", type: "websocket.send", config: { url: SOUND } },
    { id: "audio", type: "tts.speak", config: { url: SOUND } }
  ]) {
    const state = fixture(); state.rules[0].actions = [action]; assert.equal(message(state), null, action.type);
  }
  const state = fixture(); state.rules[0].actions.push(audio("unlinked", UNUSED));
  state.rules[0].actions[0].config.metadata = { url: UNUSED }; assert.equal(message(state, UNUSED), null);
});

test("les actions Media et l'identifiant historique overlay.alert conservent leur vidéo et leur son choisis", () => {
  for (const type of ["overlay.media", "overlay.alert"]) {
    const state = fixture(); state.rules[0].actions = [{ id: "audio", type, config: { mediaUrl: VIDEO, soundUrl: SOUND, otherUrl: UNUSED } }];
    const trustedMediaUrls = configuredMatchMediaUrls(state);
    assert.equal(trustedMediaUrls.has(VIDEO), true); assert.equal(trustedMediaUrls.has(SOUND), true); assert.equal(trustedMediaUrls.has(UNUSED), false);
    assert.ok(createMatchRelayMessage("match-media", { playbackId: "fixture-playback", mediaUrl: VIDEO, soundUrl: SOUND }, { trustedMediaUrls }));
  }
});

test("une réaction groupée de Matchs peut référencer une action sans élargir aux autres règles", () => {
  const state = fixture(); state.settings.matches.automations = [automation({ type: "bundle", reactions: [
    { type: "animation", match: "x2", variant: "tikcontrol" }, { type: "action", actionId: "audio" }
  ] })];
  assert.ok(message(state)); assert.equal(message(state, UNUSED), null);
});

test("les groupes liés sont parcourus de façon bornée ; groupe invalide ou circulaire n'autorise aucun nouveau média", () => {
  const state = fixture(); state.settings.matches.automations = [automation({ type: "action", actionId: "group" })];
  state.rules[0].actions.push({ id: "group", type: "action.group", config: { actionIds: ["audio"] } });
  assert.ok(message(state));
  for (const ids of [["audio", "missing"], ["audio", "group"]]) {
    state.rules[0].actions.at(-1).config.actionIds = ids; assert.equal(message(state), null);
  }
  state.rules[0].actions.at(-1).config.actionIds = ["nested-0"];
  for (let index = 0; index < 25; index += 1) state.rules[0].actions.push({ id: `nested-${index}`, type: "action.group", config: { actionIds: [index === 24 ? "audio" : `nested-${index + 1}`] } });
  assert.equal(message(state), null, "Une profondeur excessive ne contourne pas le graphe autorisé");
});

test("une roue liée n'autorise que les actions de ses secteurs effectivement exécutables", () => {
  const state = fixture(); state.settings.matches.automations = [automation({ type: "action", actionId: "wheel" })];
  state.rules[0].actions.push({ id: "wheel", type: "wheel.spin", config: { wheelId: "selected" } }, audio("unlinked", UNUSED));
  state.settings.overlayConfigs.wheel = { selectedWheelId: "selected", wheels: [{ id: "selected", enabled: true, segments: [
    { label: "Son", actionId: "audio" }, { label: "Inactif", actionId: "missing" }
  ] }] };
  assert.ok(message(state)); assert.equal(message(state, UNUSED), null);
  state.rules[0].actions.find((row) => row.id === "wheel").config.choices = ["Choix temporaire 1", "Choix temporaire 2"];
  assert.equal(message(state), null, "Les choix temporaires ne déclenchent pas les anciens secteurs");
});

test("seul le pack de jeu en cours du même profil peut fournir une action liée", () => {
  const state = fixture(); state.rules = []; state.session.game = { running: true, packId: "pack", profileId: "profile-a" };
  state.game.interactionRulesByPack = { pack: [rule("game-rule", [audio()])], inactive: [rule("other-rule", [audio("inactive", UNUSED)])] };
  assert.ok(message(state)); assert.equal(message(state, UNUSED), null);
  state.session.game.profileId = "profile-b"; assert.equal(message(state), null);
});

test("les nouveaux médias liés conservent les restrictions HTTPS, hôtes publics et absence d'identifiants URL", () => {
  for (const url of ["http://media.example.test/sound.mp3", "https://127.0.0.1/sound.mp3", "https://localhost/sound.mp3", "https://box.internal/sound.mp3", "https://user:pass@media.example.test/sound.mp3", "https://media.example.test/sound.mp3#private"]) {
    const state = fixture(); state.rules[0].actions[0].config.url = url; assert.equal(message(state, url), null, url);
  }
});

test("MatchPublication relit uniquement les références actives nécessaires, sans fichier ni requête destructive", () => {
  const state = fixture(), projections = []; let referenceReads = 0;
  state.profiles.push({ id: "other-profile", workspace: { private: "must-never-be-copied", rules: [rule("rule-a", [audio()])] } });
  const store = { getAccountSession: () => state.settings.account, getActiveAccountUid: () => state.settings.account.uid, getSecret: () => "fixture-only",
    getStateProjection: (paths) => { projections.push(paths); return selectStatePaths(state, paths); },
    getRuleEngineState: () => { referenceReads += 1; return getRuleEngineState(state); } };
  const publication = new MatchPublication({ store, configuration: () => ({ publicBaseUrl: "https://shenpulse-overlays.web.app" }), rotating: () => true });
  publication.publish("match-audio", { playbackId: "fixture-playback", url: SOUND });
  assert.equal(publication.events.length, 1); assert.equal(publication.events[0].message.payload.url, SOUND); assert.equal(referenceReads, 1);
  assert.doesNotMatch(JSON.stringify(publication.events), /must-never-be-copied|other-profile|fixture-secret|rules|actionId/);
  assert.equal(projections.some((paths) => paths.includes("profiles") || paths.includes("accountWorkspaces")), false);
  state.settings.matches.automations = [automation({ type: "sound", url: SOUND, outputMode: "live" })];
  publication.publish("match-audio", { playbackId: "fixture-playback-2", url: SOUND });
  assert.equal(publication.events.length, 2); assert.equal(referenceReads, 1, "Une réaction directe ne copie pas les actions");
});
