"use strict";

/** Compte artificiel pour les tests de transports ; aucun secret réel ni disque. */
function authenticatedFixtureStore(store) {
  const fixture = { uid: "pro-fixture", email: "pro-fixture@example.test", refreshTokenSecretId: "fixture-account" };
  return {
    ...store,
    getAccountSession: () => store.getStateProjection?.(["settings.account"])?.settings?.account || store.getState().settings?.account || fixture,
    getSecret: (id) => id === "fixture-account" ? "fixture-refresh-token" : store.getSecret?.(id) || ""
  };
}

module.exports = { authenticatedFixtureStore };
