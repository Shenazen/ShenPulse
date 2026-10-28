"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createGoogleIdTokenLoopback } = require("../src/main/account/google-loopback");

test("le retour Google refuse un état UTF-8 de même longueur sans arrêter l’application", async () => {
  const callback = await createGoogleIdTokenLoopback({ port: 0, timeoutMs: 2000 });
  callback.expectState("a".repeat(64));
  try {
    const rejected = assert.rejects(callback.result, /n'a pas pu être vérifié/);
    const response = await fetch(new URL("/callback/complete", callback.url), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: "g".repeat(160), state: "é".repeat(64) })
    });
    assert.equal(response.status, 400);
    await rejected;
  } finally {
    callback.close();
  }
});

test("la page Google efface le fragment et ne charge aucune ressource distante", async () => {
  const callback = await createGoogleIdTokenLoopback({ port: 0, timeoutMs: 2000 });
  try {
    const response = await fetch(callback.url);
    assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    const html = await response.text();
    assert.match(html, /history\.replaceState/);
    assert.match(html, /fetch\("\/callback\/complete"/);
    assert.doesNotMatch(html, /<(?:script|img|link)[^>]+(?:src|href)=["']https?:/i);
  } finally {
    callback.close();
  }
});
