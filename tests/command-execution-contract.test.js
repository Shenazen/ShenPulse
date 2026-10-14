"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const contract = require("../src/shared/command-execution");
const bot = require("../src/shared/chatbot-command");
const TRACK = "0123456789ABCDEFGHIJKL";
const PLAYLIST = "ABCDEFGHIJKLMNOPQRSTUV";
const command = (execution, overrides = {}) => ({ id: "command_skip", command: "!skip", execution, ...overrides });
const chat = (message, user = {}) => ({ type: "chat", platform: "tiktok", data: { message }, user });

test("Commandes : contrat navigateur/Node commun et aperçu purement descriptif", () => {
  const context = vm.createContext({ URL });
  for (const file of ["command-execution.js", "chatbot-command.js"]) {
    new vm.Script(fs.readFileSync(path.resolve(__dirname, "../src/shared", file), "utf8")).runInContext(context);
  }
  assert.deepEqual(Object.keys(context.ShenPulseCommandExecution), Object.keys(contract));
  const input = Object.freeze(command(Object.freeze({ type: "music", operation: "next" })));
  const expected = bot.previewChatbotResponse(input, chat("!skip"));
  assert.deepEqual(JSON.parse(JSON.stringify(context.ShenPulseChatbotCommand.previewChatbotResponse(input, chat("!skip")))), expected);
  assert.equal(expected.executionDescription, "Passer au morceau suivant");
  assert.equal(expected.response, "");
});

test("Commandes exécutables : réponse facultative, anciens textes conservés", () => {
  assert.equal(bot.normalizeChatbotCommand(command({ type: "music", operation: "next" })).response, "");
  const legacy = { id: "old", command: "!musique", response: "Texte historique", subscriberOnly: true, cooldownMs: 30000 };
  const converted = bot.normalizeChatbotCommand({ ...legacy, execution: { type: "music", operation: "pause" } }, { commands: [legacy] });
  assert.equal(converted.response, legacy.response);
  assert.equal(converted.audience, "subscriber");
  assert.equal(converted.cooldownMs, 30000);
  const back = bot.normalizeChatbotCommand({ ...converted, execution: null }, { commands: [converted] });
  assert.equal(back.response, legacy.response);
  assert.equal(Object.hasOwn(back, "execution"), false);
  assert.throws(() => bot.normalizeChatbotCommand({ command: "!sans", response: "" }), /réponse/);
  assert.throws(() => bot.normalizeChatbotCommand(command({ type: "music", operation: "next" }, { response: "x".repeat(501) })), /500/);
});

test("Les exécutions sont interdites aux réponses automatiques et timers, sans migration", () => {
  for (const kind of ["auto-reply", "timer"]) {
    assert.throws(() => bot.normalizeChatbotCommand({ kind, response: "Bonjour", matchText: "salut", intervalMs: 60000, execution: { type: "music", operation: "next" } }), /Seule une commande/);
    const normalized = bot.normalizeChatbotCommand({ kind, response: "Bonjour", matchText: "salut", intervalMs: 60000 });
    assert.equal(normalized.response, "Bonjour");
    assert.equal(Object.hasOwn(normalized, "execution"), false);
  }
});

test("Noms, début !, collisions, rôle et séparation des arguments restent appliqués", () => {
  const next = bot.normalizeChatbotCommand(command({ type: "music", operation: "next" }, { aliases: ["!suivant"], audience: "moderator" }));
  for (const message of ["!skipper", "!skip2", "Texte !skip", "skip", "!suivant!"]) assert.equal(bot.chatbotCommandMatch(next, chat(message)), null);
  assert.deepEqual(bot.chatbotCommandMatch(next, chat("  !SUIVANT   titre du morceau ")), { args: "titre du morceau" });
  assert.equal(bot.previewChatbotResponse(next, chat("!skip")).allowed, false);
  assert.equal(bot.previewChatbotResponse(next, chat("!skip", { moderator: true })).allowed, true);
  assert.throws(() => bot.normalizeChatbotCommand(command({ type: "music", operation: "next" }, { command: "skip" })), /commencer par !/);
  assert.throws(() => bot.normalizeChatbotCommand(command({ type: "music", operation: "pause" }, { id: "new" }), { commands: [next] }), /existe déjà/);
});

test("Une ancienne réponse au nom non conforme reste éditable mais ne devient pas une exécution", () => {
  for (const name of ["bonjour", "!ancien nom"]) {
    const legacy = { id: "legacy", command: name, response: "Texte historique" };
    const paused = bot.normalizeChatbotCommand({ ...legacy, enabled: false }, { commands: [legacy] });
    assert.equal(paused.command, name);
    assert.equal(paused.response, legacy.response);
    assert.throws(() => bot.normalizeChatbotCommand({ ...legacy, execution: { type: "music", operation: "next" } }, { commands: [legacy] }), /commencer par !/);
  }
});

test("Musique : opérations fermées, URI et recherches ne deviennent pas du code", () => {
  for (const operation of ["next", "previous", "play", "pause"]) {
    assert.deepEqual(contract.normalizeCommandExecution({ type: "music", operation, query: "ignored", volume: 100, config: { url: "https://bad.example" } }), { type: "music", operation });
  }
  assert.deepEqual(contract.normalizeCommandExecution({ type: "music", operation: "queue", useArgs: true }), { type: "music", operation: "queue", useArgs: true, query: "", uri: "" });
  const query = "{{constructor}} ; process.exit()";
  assert.equal(contract.normalizeCommandExecution({ type: "music", operation: "play_track", query }).query, query);
  assert.equal(contract.normalizeCommandExecution({ type: "music", operation: "queue", uri: `https://open.spotify.com/track/${TRACK}?si=test` }).uri, `spotify:track:${TRACK}`);
  assert.equal(contract.normalizeCommandExecution({ type: "music", operation: "play_track", uri: `spotify:track:${TRACK}` }).uri, `spotify:track:${TRACK}`);
  assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "queue" }), /Choisissez un titre/);
  assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "queue", query: "a", uri: `spotify:track:${TRACK}` }), /pas les deux/);
  assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "queue", useArgs: "true" }), /booléen/);
  assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "queue", query: "a".repeat(301) }), /recherche musicale/);
  for (const uri of ["https://evil.example/track/a", `http://open.spotify.com/track/${TRACK}`, `https://open.spotify.com.evil.example/track/${TRACK}`, `https://user:password@open.spotify.com/track/${TRACK}`, "javascript:alert(1)", `spotify:album:${TRACK}`, "spotify:track:short"]) {
    assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "queue", uri }), /Spotify/);
  }
  assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "http.request" }), /Opération/);
});

test("Playlist et volume : références cohérentes et valeurs entières bornées", () => {
  assert.deepEqual(contract.normalizeCommandExecution({ type: "music", operation: "play_playlist", playlistId: PLAYLIST }), { type: "music", operation: "play_playlist", playlistId: PLAYLIST, uri: `spotify:playlist:${PLAYLIST}` });
  assert.equal(contract.normalizeCommandExecution({ type: "music", operation: "play_playlist", uri: `https://open.spotify.com/intl-fr/playlist/${PLAYLIST}` }).playlistId, PLAYLIST);
  assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "play_playlist", playlistId: PLAYLIST, uri: `spotify:playlist:${TRACK}` }), /même playlist/);
  assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "play_playlist", playlistId: "bad" }), /playlist Spotify/);
  for (const volume of [0, 100, "75"]) assert.equal(contract.normalizeCommandExecution({ type: "music", operation: "volume", volume }).volume, Number(volume));
  for (const volume of [-1, 101, 0.5, Infinity, NaN, true, {}, []]) assert.throws(() => contract.normalizeCommandExecution({ type: "music", operation: "volume", volume }), /volume/);
});

test("Actions : seulement une référence, aucune configuration arbitraire exécutée", () => {
  assert.deepEqual(contract.normalizeCommandExecution({ type: "action", actionId: "stored-action", config: { url: "https://bad.example" }, action: { type: "system.keys", config: {} } }), { type: "action", actionId: "stored-action" });
  assert.equal(contract.normalizeCommandExecution({ type: "action", actionId: "stored-action" }, { actions: [{ id: "stored-action" }] }).actionId, "stored-action");
  assert.throws(() => contract.normalizeCommandExecution({ type: "action", actionId: "missing" }, { actions: [{ id: "stored-action" }] }), /introuvable/);
  for (const actionId of ["", " ", {}, "a".repeat(161)]) assert.throws(() => contract.normalizeCommandExecution({ type: "action", actionId }), /référence d'action/);
});

test("Overlays : cibles et opérations existantes, champs supplémentaires éliminés", () => {
  for (const [overlayKey, operations] of Object.entries(contract.OVERLAY_OPERATIONS)) {
    for (const operation of operations) {
      const execution = contract.normalizeCommandExecution({ type: "overlay", overlayKey, operation, config: { arbitrary: true }, effectId: "arbitrary-effect", actionId: "arbitrary-action", choices: ["a", "b"] });
      assert.equal(execution.overlayKey, overlayKey);
      assert.equal(execution.operation, operation);
      for (const field of ["config", "effectId", "actionId", "choices"]) assert.equal(Object.hasOwn(execution, field), false);
    }
  }
  for (const overlayKey of ["constructor", "__proto__", "overlay.alert", "unknown"]) assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey, operation: "set" }), /Overlay/);
  assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey: "wheel", operation: "set" }), /Opération/);
  assert.deepEqual(contract.normalizeCommandExecution({ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "my-wheel" }, { wheels: [{ id: "my-wheel" }] }), { type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "my-wheel" });
  assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey: "wheel", operation: "spin", wheelId: "other-wheel" }, { wheels: [] }), /introuvable/);
});

test("Overlays : valeurs, temps et multiplicateurs respectent les limites du moteur", () => {
  assert.equal(contract.normalizeCommandExecution({ type: "overlay", overlayKey: "timer", operation: "add", seconds: -contract.MAX_TIMER_SECONDS }).seconds, -contract.MAX_TIMER_SECONDS);
  for (const seconds of [contract.MAX_TIMER_SECONDS + 1, -contract.MAX_TIMER_SECONDS - 1, Infinity, 0.5]) assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey: "timer", operation: "add", seconds }), /temps/);
  assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey: "timer", operation: "set", seconds: -1 }), /négatif/);
  for (const [overlayKey, maximum] of [["winCounter", 100000], ["likeGoal", 100000000], ["coinJar", 100000000]]) {
    for (const amount of [-maximum, maximum]) assert.equal(contract.normalizeCommandExecution({ type: "overlay", overlayKey, operation: "adjust", amount }).amount, amount);
    for (const amount of [-maximum - 1, maximum + 1, Infinity, NaN, 0.5]) assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey, operation: "adjust", amount }), /compteur/);
  }
  for (const overlayKey of ["winCounter", "multiplierTimer"]) {
    const operation = overlayKey === "winCounter" ? "multiplier" : "set";
    for (const multiplier of [1, 2.5, 100]) assert.equal(contract.normalizeCommandExecution({ type: "overlay", overlayKey, operation, multiplier }).multiplier, multiplier);
    for (const multiplier of [0, 101, Infinity, NaN]) assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey, operation, multiplier }), /multiplicateur/);
  }
  for (const seconds of [0, 3601]) assert.throws(() => contract.normalizeCommandExecution({ type: "overlay", overlayKey: "winCounter", operation: "multiplier", seconds }), /durée/);
});

test("Contrat pur : entrées absentes permises, objets invalides refusés, aucune mutation", () => {
  assert.equal(contract.normalizeCommandExecution(undefined), null);
  assert.equal(contract.describeCommandExecution(null), "Réponse dans le chat");
  for (const input of [false, "music", [], new Date(), { type: "http.request" }, { type: "system.keys" }]) assert.throws(() => contract.normalizeCommandExecution(input), /(exécution|musique)/);
  const input = Object.freeze({ type: "overlay", overlayKey: "winCounter", operation: "adjust", amount: 2 });
  assert.deepEqual(contract.normalizeCommandExecution(input), input);
  assert.equal(contract.describeCommandExecution(input), "Compteur de victoires : modifier la valeur (+2)");
  assert.equal(Object.isFrozen(contract.MUSIC_OPERATIONS), true);
  assert.equal(Object.isFrozen(contract.OVERLAY_OPERATIONS), true);
  for (const operations of Object.values(contract.OVERLAY_OPERATIONS)) assert.equal(Object.isFrozen(operations), true);
});
