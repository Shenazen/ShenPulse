"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { AccountService } = require("../src/main/account-service");
const { createStore, jsonResponse } = require("./helpers/account-service-fixtures");

test("la première inscription Google ne demande ni e-mail ni mot de passe et accepte le compte vérifié Firebase", async () => {
  const store = createStore();
  let redirectUri = "";
  const methods = [];
  const state = "synthetic-google-state";
  const googleToken = "g".repeat(160);
  const service = new AccountService({
    store,
    googleLoopbackPort: 0,
    openExternal: async (url) => {
      const target = new URL(url);
      assert.equal(target.searchParams.has("login_hint"), false);
      const response = await fetch(new URL("/callback/complete", redirectUri), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, idToken: googleToken })
      });
      assert.equal(response.status, 200);
    },
    fetchImpl: async (url, options = {}) => {
      const target = new URL(url);
      const method = target.pathname.split("/").pop();
      methods.push(method);
      if (method === "accounts:createAuthUri") {
        const body = JSON.parse(options.body);
        assert.equal(body.identifier, "google@shenpulse.local");
        redirectUri = body.continueUri;
        const authUri = new URL("https://accounts.google.com/o/oauth2/auth");
        authUri.searchParams.set("state", state);
        return jsonResponse({ authUri: authUri.href, sessionId: "synthetic-session" });
      }
      if (method === "accounts:signInWithIdp") {
        const body = JSON.parse(options.body);
        assert.equal(body.returnSecureToken, true);
        assert.equal(body.sessionId, "synthetic-session");
        assert.equal(new URLSearchParams(body.postBody).get("id_token"), googleToken);
        return jsonResponse({
          isNewUser: true, localId: "new_google_user", email: "new@example.test",
          idToken: "synthetic-firebase-token", refreshToken: "synthetic-refresh",
          expiresIn: "3600"
        });
      }
      if (method === "accounts:lookup") {
        return jsonResponse({ users: [{
          localId: "new_google_user", email: "new@example.test", displayName: "Nouveau membre",
          emailVerified: true, photoUrl: "https://example.test/avatar.png",
          providerUserInfo: [{ providerId: "google.com" }]
        }] });
      }
      if (target.pathname === "/api/account/entitlements") {
        return jsonResponse({ tier: "free", source: "free", gameEntitlements: [] });
      }
      throw new Error("Requête inattendue : " + method);
    }
  });
  const result = await service.loginWithBrowser();
  assert.equal(result.authenticated, true);
  assert.equal(result.uid, "new_google_user");
  assert.equal(result.email, "new@example.test");
  assert.equal(result.emailVerified, true);
  assert.equal(result.providerId, "google.com");
  assert.equal(result.photoUrl, "https://example.test/avatar.png");
  assert.equal(store.activeAccountUid, "new_google_user");
  assert.equal(methods.includes("accounts:signUp"), false);
  assert.equal(Object.hasOwn(result, "idToken"), false);
  assert.equal(Object.hasOwn(result, "refreshToken"), false);
  service.logout();
});
