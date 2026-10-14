"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const bot = require("../src/shared/chatbot-command");

const command = (overrides = {}) => ({ id: "bonjour", command: "!bonjour", response: "Bonjour {{user.displayName}} !", enabled: true, cooldownMs: 10000, ...overrides });
const chat = (message, overrides = {}) => ({ type: "chat", platform: "tiktok", source: "source_tiktok", user: { id: "lou", name: "lou_live", displayName: "Lou" }, data: { message }, ...overrides });

test("contrat ChatBot identique dans Node et script navigateur, sans API externe", () => {
  const context = vm.createContext({});
  new vm.Script(fs.readFileSync(path.resolve(__dirname, "../src/shared/chatbot-command.js"), "utf8")).runInContext(context);
  assert.deepEqual(Object.keys(context.ShenPulseChatbotCommand), Object.keys(bot));
  assert.equal(context.ShenPulseChatbotCommand.previewChatbotResponse(command(), chat("!bonjour")).response, "Bonjour Lou !");
});

test("commande historique normalisée sans perdre id, état ou options de profil", () => {
  const item = bot.normalizeChatbotCommand(command({ subscriberOnly: true, oldSetting: { value: 2 } }));
  assert.equal(item.kind, "command");
  assert.equal(item.platform, "all");
  assert.equal(item.audience, "subscriber");
  assert.equal(item.subscriberOnly, true);
  assert.equal(item.id, "bonjour");
  assert.deepEqual(item.oldSetting, { value: 2 });
});

test("noms et alias exacts, casse insensible et arguments isolés", () => {
  const item = bot.normalizeChatbotCommand(command({ aliases: "!salut; !hello" }));
  assert.deepEqual(item.aliases, ["!salut", "!hello"]);
  assert.deepEqual(bot.chatbotCommandMatch(item, chat("  !HELLO   à toutes et tous  ")), { args: "à toutes et tous" });
  for (const message of ["!bonjourXYZ", "texte !bonjour", "bonjour", "!hello2", "!salut!"]) {
    assert.equal(bot.chatbotCommandMatch(item, chat(message)), null, message);
  }
});

test("création refuse noms vides, noms longs et alias invalides, répétitions ou collisions", () => {
  for (const name of ["!", "sans-point", "!bonjour tout", `!${"a".repeat(32)}`]) assert.throws(() => bot.normalizeChatbotCommand(command({ command: name })), /commande/);
  assert.throws(() => bot.normalizeChatbotCommand(command({ aliases: ["hello"] })), /alias/);
  assert.throws(() => bot.normalizeChatbotCommand(command({ aliases: ["!BONJOUR"] })), /différents/);
  assert.throws(() => bot.normalizeChatbotCommand(command({ aliases: Array.from({ length: 9 }, (_, index) => `!a${index}`) })), /8 alias/);
  assert.throws(() => bot.normalizeChatbotCommand(command({ id: "second", command: "!hello" }), { commands: [command({ aliases: ["!HELLO"] })] }), /existe déjà/);
  assert.equal(bot.normalizeChatbotCommand(command({ command: "!été" })).command, "!été");
});

test("édition et bascule conservent les anciennes entrées longues ou nommées avec espaces", () => {
  const legacy = command({ command: "!ancien nom", response: "x".repeat(800), enabled: true });
  const paused = bot.normalizeChatbotCommand({ ...legacy, enabled: false }, { commands: [legacy] });
  assert.equal(paused.response.length, 800);
  assert.equal(paused.command, "!ancien nom");
  assert.equal(paused.enabled, false);
  assert.deepEqual(bot.chatbotCommandMatch(legacy, chat("!ancien nom argument")), { args: "argument" });
  const duplicate = { ...legacy, id: "second" };
  assert.equal(bot.normalizeChatbotCommand({ ...legacy, enabled: false }, { commands: [legacy, duplicate] }).enabled, false);
  const slow = command({ cooldownMs: 7200000, globalCooldownMs: -1 });
  const slowPaused = bot.normalizeChatbotCommand({ ...slow, enabled: false }, { commands: [slow] });
  assert.equal(slowPaused.cooldownMs, 7200000);
  assert.equal(slowPaused.globalCooldownMs, -1);
});

test("réponses, cooldowns et intervalles sont bornés sans supprimer des données historiques", () => {
  for (const response of ["", " ", "x".repeat(501)]) assert.throws(() => bot.normalizeChatbotCommand(command({ response })), /500/);
  for (const cooldownMs of [-1, Infinity, NaN, 3600001]) assert.throws(() => bot.normalizeChatbotCommand(command({ cooldownMs })), /cooldown/);
  for (const globalCooldownMs of [-1, Infinity, 3600001]) assert.throws(() => bot.normalizeChatbotCommand(command({ globalCooldownMs })), /cooldown/);
  for (const intervalMs of [0, 59999, Infinity, 3600001]) assert.throws(() => bot.normalizeChatbotCommand(command({ kind: "timer", intervalMs })), /intervalle/);
  assert.equal(bot.normalizeChatbotCommand(command({ kind: "timer", intervalMs: 60000 })).intervalMs, 60000);
});

test("rôles all/subscriber/moderator et permission historique restent distincts", () => {
  const event = chat("!bonjour");
  assert.equal(bot.previewChatbotResponse(command(), event).allowed, true);
  assert.equal(bot.previewChatbotResponse(command({ subscriberOnly: true }), event).allowed, false);
  assert.equal(bot.previewChatbotResponse(command({ audience: "moderator" }), { ...event, user: { moderator: true } }).allowed, true);
  assert.equal(bot.previewChatbotResponse(command({ audience: "subscriber" }), { ...event, user: { moderator: true } }).allowed, false);
  assert.equal(bot.previewChatbotResponse(command({ audience: "subscriber" }), { ...event, user: { subscriber: true } }).allowed, true);
  assert.throws(() => bot.normalizeChatbotCommand(command({ audience: "follower" })), /Autorisation/);
});

test("variables à liste fermée et remplacement unique, sans évaluation ni expansion récursive", () => {
  const item = command({ response: "{{user.displayName}} / {{user.name}} / {{args}} / {{message}} / {user} / {username} / {comment} / {{constructor}}" });
  const event = chat("!bonjour {{user.name}}", { user: { name: "lou", displayName: "<Lou>" } });
  const preview = bot.previewChatbotResponse(item, event);
  assert.equal(preview.response, "<Lou> / lou / {{user.name}} / !bonjour {{user.name}} / <Lou> / lou / !bonjour {{user.name}} / {{constructor}}");
  assert.equal(preview.args, "{{user.name}}");
  assert.equal(bot.renderChatbotResponse(command({ response: "{{message}}" }), chat("x".repeat(1000))).length, 500);
});

test("prévisualiser est un calcul pur : aucune mutation ni connexion ni cooldown", () => {
  const item = Object.freeze(command({ aliases: Object.freeze(["!salut"]) }));
  const event = Object.freeze(chat("!salut test"));
  const first = bot.previewChatbotResponse(item, event);
  assert.deepEqual(bot.previewChatbotResponse(item, event), first);
  assert.equal(first.response, "Bonjour Lou !");
  assert.equal(bot.previewChatbotResponse(item, chat("!inconnu")).matched, false);
});

test("réponses automatiques exact/contains sont simples, insensibles à la casse et sans regex", () => {
  const automatic = bot.normalizeChatbotCommand(command({ kind: "auto-reply", matchText: "Bonjour", matchMode: "exact" }));
  assert.equal(bot.previewChatbotResponse(automatic, chat("BONJOUR")).matched, true);
  assert.equal(bot.previewChatbotResponse(automatic, chat("bonjour tout le monde")).matched, false);
  assert.equal(bot.previewChatbotResponse({ ...automatic, matchMode: "contains" }, chat("bonjour tout le monde")).matched, true);
  assert.equal(bot.previewChatbotResponse({ ...automatic, keywords: [".*"], matchText: ".*" }, chat("bonjour")).matched, false);
  assert.throws(() => bot.normalizeChatbotCommand({ ...automatic, matchMode: "regex" }), /correspondance/);
  assert.throws(() => bot.normalizeChatbotCommand({ ...automatic, keywords: [], matchText: "" }), /mot-clé/);
  const multiple = bot.normalizeChatbotCommand({ ...automatic, keywords: ["bonjour", "salut"] });
  assert.equal(bot.previewChatbotResponse(multiple, chat("SALUT")).matched, true);
  assert.throws(() => bot.normalizeChatbotCommand({ ...automatic, keywords: ["bonjour", "BONJOUR"] }), /différents/);
  assert.throws(() => bot.normalizeChatbotCommand({ ...automatic, keywords: Array.from({ length: 21 }, (_, index) => `clé-${index}`) }), /20 mots-clés/);
});

test("commande explicite prioritaire, un seul résultat et timers exclus du chat", () => {
  const automatic = { ...command(), id: "auto", kind: "auto-reply", matchText: "bonjour" };
  const timer = { ...command(), id: "timer", kind: "timer", intervalMs: 60000 };
  const exact = command();
  assert.equal(bot.findChatbotCommand([automatic, timer, exact], chat("!bonjour")), exact);
  assert.equal(bot.findChatbotCommand([timer], chat("!bonjour")), undefined);
  assert.equal(bot.previewChatbotResponse(timer, { type: "timer", platform: "tiktok" }).matched, true);
  assert.equal(bot.findChatbotCommand([command({ enabled: false })], chat("!bonjour")), undefined);
});

test("plateformes et transports partagent un contrat sans inventer de possibilité d'envoi", () => {
  assert.equal(bot.chatbotPlatformForConnection({ type: "tiktok-direct" }), "tiktok");
  assert.equal(bot.chatbotPlatformForConnection({ type: "kick-native" }), "kick");
  assert.equal(bot.chatbotPlatformForConnection({ type: "twitch-irc" }), "twitch");
  assert.equal(bot.previewChatbotResponse(command({ platform: "kick" }), chat("!bonjour")).matched, false);
  assert.equal(bot.previewChatbotResponse(command({ platform: "kick" }), chat("!bonjour", { platform: "kick" })).matched, true);
  assert.throws(() => bot.normalizeChatbotCommand(command({ platform: "remote-url" })), /Plateforme/);
});

test("messages de timer bornés et ancienne réponse multiligne conservée comme un seul message", () => {
  const legacy = { id: "legacy-timer", kind: "timer", response: "Première ligne\nDeuxième ligne", enabled: true, intervalMs: 60000 };
  const normalized = bot.normalizeChatbotCommand(legacy);
  assert.deepEqual(bot.chatbotTimerMessages(normalized), ["Première ligne\nDeuxième ligne"]);
  assert.equal(normalized.minChatMessages, 0);
  assert.equal(Object.hasOwn(normalized, "messages"), false);
  const multiple = bot.normalizeChatbotCommand({ kind: "timer", messages: ["Un", "Deux"], intervalMs: 60000, minChatMessages: 5 });
  assert.deepEqual(multiple.messages, ["Un", "Deux"]);
  assert.equal(multiple.response, "Un");
  assert.equal(multiple.minChatMessages, 5);
  for (const messages of [[], [""], ["x".repeat(501)], Array.from({ length: 11 }, () => "Bonjour")]) {
    assert.throws(() => bot.normalizeChatbotCommand({ ...legacy, messages }), /(timer|réponse)/);
  }
  for (const minChatMessages of [-1, 1.5, 1001, Infinity]) assert.throws(() => bot.normalizeChatbotCommand({ ...legacy, minChatMessages }), /minimum/);
});

test("timer historique long avec espaces reste éditable sans convertir sa réponse en liste", () => {
  const legacy = { id: "legacy-long", kind: "timer", response: `  ${"x".repeat(700)}\n `, intervalMs: 60000 };
  const normalized = bot.normalizeChatbotCommand({ ...legacy, intervalMs: 120000 }, { commands: [legacy] });
  assert.equal(normalized.response, "x".repeat(700));
  assert.equal(normalized.intervalMs, 120000);
  assert.equal(Object.hasOwn(normalized, "messages"), false);
  assert.throws(() => bot.normalizeChatbotCommand({ ...legacy, response: "y".repeat(700) }, { commands: [legacy] }), /500 caractères/);
  assert.throws(() => bot.normalizeChatbotCommand({ ...legacy, messages: [legacy.response] }, { commands: [legacy] }), /timer/);
});
