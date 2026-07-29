"use strict";

const assert = require("node:assert/strict");
const { createDefaultState } = require("../src/main/defaults");
const { PublicOverlayRelay } = require("../src/main/public-overlay-relay");
const {
  DEFAULT_FIREBASE_API_KEY,
  relayDatabaseUrl
} = require("../src/shared/public-overlay-protocol");

async function main() {
  const state = createDefaultState();
  const secrets = new Map();
  const store = {
    getState: () => state,
    mutate(callback) {
      callback(state);
    },
    setSecret(secretId, value) {
      const id = secretId || `smoke-secret-${secrets.size + 1}`;
      secrets.set(id, String(value));
      return id;
    },
    getSecret(secretId) {
      return secrets.get(secretId) || "";
    }
  };
  const relay = new PublicOverlayRelay({
    store,
    appVersion: "smoke-test"
  });
  let idToken = "";
  try {
    await relay.start();
    assert.equal(relay.status().connected, true);
    relay.publish("win-counter", {
      operation: "set",
      current: 7
    });
    await new Promise((resolve) => setTimeout(resolve, 250));

    const config = state.settings.publicOverlayRelay;
    const relayResponse = await fetch(
      relayDatabaseUrl(config.databaseUrl, config.channelId)
    );
    assert.equal(relayResponse.ok, true);
    const document = await relayResponse.json();
    assert.equal(document.ownerUid, config.uid);
    assert.equal(
      document.lastBatch.messages[0].channel,
      "win-counter"
    );
    assert.equal(document.lastBatch.messages[0].payload.current, 7);

    const widgetResponse = await fetch(relay.urls().timer);
    assert.equal(widgetResponse.ok, true);
    assert.match(await widgetResponse.text(), /ShenPulse Overlay/);
    const mediaResponse = await fetch(
      `${config.publicBaseUrl}/media/widgets/interactive-overlays/win-counter-theme-gta.png`
    );
    assert.equal(mediaResponse.ok, true);

    const password = store.getSecret(config.passwordSecretId);
    const signIn = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
        DEFAULT_FIREBASE_API_KEY
      )}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: config.email,
          password,
          returnSecureToken: true
        })
      }
    );
    assert.equal(signIn.ok, true);
    idToken = (await signIn.json()).idToken;
    console.log(
      `Relais public validé : ${config.publicBaseUrl} · canal ${config.channelId.slice(
        0,
        8
      )}…`
    );
  } finally {
    await relay.stop().catch(() => {});
    const config = state.settings.publicOverlayRelay;
    if (idToken && config.channelId) {
      await fetch(
        `${relayDatabaseUrl(
          config.databaseUrl,
          config.channelId
        )}?auth=${encodeURIComponent(idToken)}`,
        { method: "DELETE" }
      ).catch(() => {});
      await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(
          DEFAULT_FIREBASE_API_KEY
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken })
        }
      ).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
