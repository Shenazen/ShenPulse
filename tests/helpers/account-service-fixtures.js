"use strict";

/** Fixtures locales du compte : aucun appel Firebase ni secret persisté sur disque. */
const { createDefaultState } = require("../../src/main/defaults");

/** Crée un store mémoire indépendant avec la même isolation des états et des secrets que les anciens scénarios. */
function createStore() {
  const state = createDefaultState();
  const secrets = new Map();
  let secretSequence = 0;
  const store = {
    state,
    secrets,
    activeAccountUid: "",
    getState: () => structuredClone(state),
    mutate(callback) {
      callback(state);
      return structuredClone(state);
    },
    set(path, value) {
      const parts = String(path).split(".");
      let target = state;
      while (parts.length > 1) {
        const part = parts.shift();
        target = target[part];
      }
      target[parts[0]] = structuredClone(value);
    },
    setSecret(secretId, value) {
      const id = secretId || `secret_${++secretSequence}`;
      if (value) secrets.set(id, value);
      else secrets.delete(id);
      return id;
    },
    getSecret: (secretId) => secrets.get(secretId) || "",
    activateAccount(uid) {
      store.activeAccountUid = String(uid || "");
    },
    deactivateAccount() {
      store.activeAccountUid = "";
    }
  };
  return store;
}

/** Fabrique la réponse HTTP JSON utilisée par les serveurs Firebase/commerce simulés. */
function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

module.exports = { createStore, jsonResponse };

