"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

function context(t, status) {
  const dom = new JSDOM('<main id="content"><div data-chatbot-delivery></div></main>', { runScripts: "outside-only" });
  t.after(() => dom.window.close());
  const w = dom.window;
  let calls = 0, editor;
  Object.assign(w, { snapshot: { state: { settings: { account: { uid: "owner" }, tiktok: {} }, connections: [] } }, currentPage: "connections",
    content: w.document.querySelector("main"), isAccountAuthenticated: () => Boolean(w.snapshot.state.settings.account.uid),
    escapeHtml: (text) => String(text || "").replace(/</g, "&lt;").replace(/"/g, "&quot;"), creatorChatbotIcon: () => "",
    api: { chatbot: { transportStatus: async () => { calls++; return typeof status === "function" ? status() : status; } } },
    openEditor: (options) => { editor = options; }, dialogSection: (_title, _subtitle, body) => body,
    selectFieldMarkup: () => "<select></select>", field: (_name, _label, value) => `<input value="${value}">` });
  for (const file of ["core/account-operation-guard.js", "features/chatbot/delivery.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"), dom.getInternalVMContext());
  }
  return { w, calls: () => calls, editor: () => editor, run: (code) => vm.runInContext(code, dom.getInternalVMContext()) };
}

test("capacités rafraîchies à la demande sans polling ni compte connecté = autorisation inventée", async (t) => {
  const { w, calls } = context(t, { connections: [{ name: "TikTok", canSend: false, reason: "not-configured" },
    { name: "Socket", canSend: true, confirmation: "socket" }, { name: "Kick", canSend: true, confirmation: "platform" }] });
  await w.refreshCreatorChatbotDelivery();
  await w.refreshCreatorChatbotDelivery();
  assert.equal(calls(), 1);
  const text = w.content.textContent;
  assert.match(text, /1 source\(s\) avec confirmation/);
  assert.match(text, /aucune confirmation de publication/);
  assert.match(text, /Autorisation d'envoi non configurée/);
});

test("réponse tardive d'un compte précédent non affichée et non mémorisée", async (t) => {
  let resolve;
  const { w } = context(t, () => new Promise((done) => { resolve = done; }));
  const pending = w.refreshCreatorChatbotDelivery();
  w.invalidateCreatorPrivateOperations();
  w.snapshot.state.settings.account.uid = "another";
  resolve({ connections: [{ name: "secret-old-owner", canSend: true }] });
  await pending;
  assert.doesNotMatch(w.creatorChatbotDeliveryMarkup(), /secret-old-owner/);
});

test("configuration ne préremplit jamais de clé ou jeton et demande un consentement d'envoi", async (t) => {
  const { w, editor } = context(t, { configuration: { provider: "euler-oauth", hasApiKey: true, hasAccessToken: true,
    expiresAt: "2030-01-01T00:00:00Z", botUsername: "bot.owner" } });
  await w.openCreatorChatbotDeliveryEditor();
  assert.match(editor().body, /Autoriser l'envoi avec mon autorisation personnelle/);
  assert.match(editor().body, /sans supprimer vos commandes/);
  assert.match(editor().body, /value=""/);
  assert.doesNotMatch(editor().body, /apiKeySecretId|accessTokenSecretId/);
});

test("les réglages d’envoi sont accessibles depuis le chatbot et restent privés", async (t) => {
  const { w, calls, editor } = context(t, { connections: [] });
  w.currentPage = "commands";
  await w.refreshCreatorChatbotDelivery(true);
  assert.match(w.renderCreatorChatbotDelivery(), /data-chatbot-delivery/);
  await w.openCreatorChatbotDeliveryEditor();
  assert.ok(calls() >= 2);
  assert.match(editor().body, /Configuration avancée/);
  w.currentPage = "games";
  assert.equal(w.renderCreatorChatbotDelivery(), "");
});

test("le gestionnaire d’envoi reste délégué pour Connexions et Commandes", async (t) => {
  const { w, calls, editor, run } = context(t, { connections: [] });
  for (const file of ["actions/handlers/contracts.js", "actions/handlers/connections-messages.js"]) run(fs.readFileSync(path.join(__dirname, "../src/renderer/app", file), "utf8"));
  const handler = run("ACTION_HANDLERS.find(handler => handler === handleCreatorChatbotDeliveryAction)");
  for (const page of ["commands", "connections"]) {
    w.currentPage = page;
    await handler({ action: "chatbot-delivery-configure" });
    assert.ok(editor());
  }
  assert.equal(calls(), 2);
});

test("une expiration passée ne reste pas présentée comme une source prête", async (t) => {
  const { w } = context(t, { configuration: { provider: "euler-oauth", expiresAt: "2020-01-01T00:00:00Z" },
    connections: [{ name: "TikTok", transport: "euler-oauth", canSend: true, confirmation: "platform" }] });
  await w.refreshCreatorChatbotDelivery();
  assert.match(w.content.textContent, /Autorisation expirée/);
  assert.doesNotMatch(w.content.textContent, /1 source\(s\) avec confirmation/);
});
