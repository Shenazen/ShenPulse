"use strict";

const { BROWSER_AUTH_TIMEOUT_MS } = require("./constants");
const { createGoogleIdTokenLoopback } = require("./google-loopback");
const { googleAuthUri } = require("./validation");

/** Échange Google via Firebase, avec état attendu et serveur local toujours libéré. */
async function runBrowserAuth(service, emailHint = "", flow) {
  const callback = await createGoogleIdTokenLoopback({
    port: service.googleLoopbackPort,
    timeoutMs: BROWSER_AUTH_TIMEOUT_MS
  });
  try {
    const authRequest = await flow.identityRequest(
      "accounts:createAuthUri",
      {
        identifier: emailHint || "google@shenpulse.local",
        continueUri: callback.url,
        providerId: "google.com"
      }
    );
    const target = googleAuthUri(authRequest.authUri);
    const expectedState = target.searchParams.get("state") || "";
    if (!expectedState || !authRequest.sessionId) {
      throw new Error(
        "Firebase n’a pas préparé une connexion Google valide."
      );
    }
    if (emailHint) target.searchParams.set("login_hint", emailHint);
    callback.expectState(expectedState);
    await service.openExternal(target.toString());

    const browserResult = await callback.result;
    const payload = await flow.identityRequest(
      "accounts:signInWithIdp",
      {
        requestUri: callback.url,
        postBody: new URLSearchParams({
          id_token: browserResult.idToken,
          providerId: "google.com"
        }).toString(),
        sessionId: String(authRequest.sessionId),
        returnIdpCredential: true,
        returnSecureToken: true
      }
    );
    await flow.acceptAuthPayload(payload, {
      fallbackEmail: emailHint,
      providerId: "google.com"
    });
    await service.syncEntitlements({ silent: true });
    return flow.publicStatus(true);
  } finally {
    callback.close();
  }
}

module.exports = { runBrowserAuth };
