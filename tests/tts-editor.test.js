"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const path = require("node:path");

function editor(t) {
  const dom = new JSDOM('<dialog open><form></form></dialog>');
  t.after(() => dom.window.close());
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const context = vm.createContext({
    document: dom.window.document, window: dom.window, FormData: dom.window.FormData,
    dialog: dom.window.document.querySelector("dialog"), ttsVoices: [],
    ShenPulseTtsVoices: require("../src/shared/tts-voices"),
    snapshot: { state: { settings: { tts: { voice: "natural:fr-FR-CharlineNeural", rate: 1, pitch: 1, volume: .9 } } } },
    escapeHtml: escape, api: {},
    inputFieldMarkup: (name, label, value, type, extra) => `<label class="field ${extra.includes("full") ? "full" : ""}"><span>${escape(label)}</span><input name="${name}" type="${type}" value="${escape(value)}"></label>`,
    checkRow: (title, description, name, checked) => `<label class="check-row"><span>${title}<small>${description}</small></span><input name="${name}" type="checkbox" ${checked ? "checked" : ""}></label>`,
    creatorChatbotCaptureOwner: () => "owner", assertCreatorChatbotOwner: () => {}
  });
  for (const file of ["editors/core.js", "editors/media-timer.js", "features/tts-preview.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), context);
  context.openEditor = (options) => { context.options = options; context.document.querySelector("form").innerHTML = options.body; };
  return context;
}

test("la règle TTS propose test adjacent, catalogue complet, curseurs et filtres conservés", (t) => {
  const context = editor(t);
  context.openTtsEditor({ rule: { name: "Ma règle" }, action: { config: { voice: "natural:fr-BE-CharlineNeural", readEmojis: false, allowedRoles: ["subscriber"] } } });
  const form = context.document.querySelector("form");
  assert.ok(form.querySelector("[data-tts-rule-editor]"));
  assert.ok(form.querySelector(".tts-voice-controls select + button[data-action=tts-voice-preview]"));
  assert.ok(form.querySelectorAll("option[value^='natural:']").length >= 300);
  assert.equal(form.querySelector("select[name=voice]").value, "natural:fr-BE-CharlineNeural");
  assert.equal(form.querySelectorAll("input[type=range]").length, 3);
  assert.equal(form.querySelector("[name=ttsReadEmojis]").checked, false);
  assert.equal(form.querySelector("[name=ttsAllowedRole][value=subscriber]").checked, true);
  for (const name of ["ttsMaxCharacters", "ttsBlockedWords", "ttsBlockedUsers", "ttsAllowMentions", "ttsAllowCommands", "ttsAllowLinks"]) assert.ok(form.querySelector(`[name=${name}]`));
});

test("le bouton teste la voix et les réglages non enregistrés en local sans envoyer au LIVE", async (t) => {
  const context = editor(t);
  context.openTtsEditor();
  const form = context.document.querySelector("form");
  form.querySelector("[name=voice]").value = "natural:fr-CA-ThierryNeural";
  form.querySelector("[name=rate]").value = "1.3";
  form.querySelector("[name=pitch]").value = ".8";
  form.querySelector("[name=volume]").value = ".6";
  let sent;
  context.api.testAction = async (incoming) => { sent = incoming; return { queued: true }; };
  const target = form.querySelector("[data-action=tts-voice-preview]");
  await context.previewSelectedTtsVoice(target);
  assert.equal(sent.config.voice, "natural:fr-CA-ThierryNeural");
  assert.equal(sent.config.rate, 1.3);
  assert.equal(sent.config.pitch, .8);
  assert.equal(sent.config.volume, .6);
  assert.equal(sent.config.outputMode, "local");
  assert.equal(sent.config.previewScope, "editor-dialog");
  assert.equal(sent.testEventType, "chat");
  assert.equal(target.disabled, false);
  assert.match(form.querySelector("[data-voice-preview-status]").textContent, /cet ordinateur uniquement/);
});

test("un échec du service vocal reste visible et permet de retester", async (t) => {
  const context = editor(t); context.openTtsEditor();
  context.api.testAction = async () => { throw new Error("Service indisponible"); };
  const target = context.document.querySelector("[data-action=tts-voice-preview]");
  await context.previewSelectedTtsVoice(target);
  assert.equal(target.disabled, false);
  assert.match(context.document.querySelector("[data-voice-preview-status]").textContent, /Service indisponible/);
});

test("plusieurs synthèses vocales testent les réglages de leur propre ligne", async (t) => {
  const context = editor(t);
  const form = context.document.querySelector("form");
  form.innerHTML = ["Voix A", "Voix B"].map((voice, index) => `<section data-action-component><div class="tts-voice-field"><select name="ttsVoice"><option>${voice}</option></select><button type="button" data-voice-field="ttsVoice">Tester</button><small data-voice-preview-status></small></div><input name="ttsRate" value="${index + 1}"><input name="ttsPitch" value=".8"><input name="ttsVolume" value="${index ? .3 : .9}"></section>`).join("");
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app/editors/action-components.js"), "utf8"), context);
  let sent;
  context.api.testAction = async incoming => { sent = incoming; return { queued: true }; };
  const panels = form.querySelectorAll("[data-action-component]");
  await context.previewSelectedTtsVoice(panels[1].querySelector("button"));
  assert.equal(sent.config.voice, "Voix B");
  assert.equal(sent.config.rate, 2);
  assert.equal(sent.config.volume, .3);
  assert.equal(panels[0].querySelector("[data-voice-preview-status]").textContent, "");
});
