"use strict";

/** Configuration d'envoi propre au compte : aucun jeton dans le renderer ou les exports. */
const { readState } = require("../state-projection");
const { assertAuthenticatedAccount } = require("../account-access");
const { assertChatbotAccess } = require("../chatbot-service");
const { validateTikTokChatConfiguration } = require("../sources/euler-oauth-chat-delivery");

function chatbotTransportStatus(core, store) {
  const state = readState(store, ["settings.tiktok.chat", "settings.account.uid", "connections"]);
  const config = state.settings.tiktok?.chat || {};
  const uid = state.settings.account?.uid || "";
  return {
    configuration: {
      provider: config.accountUid === uid ? config.provider || "none" : "none",
      expiresAt: config.accountUid === uid ? config.expiresAt || "" : "",
      botUsername: config.accountUid === uid ? config.botUsername || "" : "",
      hasApiKey: config.accountUid === uid && Boolean(config.apiKeySecretId && store.getSecret(config.apiKeySecretId)),
      hasAccessToken: config.accountUid === uid && Boolean(config.accessTokenSecretId && store.getSecret(config.accessTokenSecretId))
    },
    connections: (state.connections || []).filter((entry) => entry.type !== "demo").map((entry) => {
      const capability = core.sourceHub.getChatCapabilities(entry.id);
      const connected = entry.enabled === true && entry.status === "connected";
      return { id: entry.id, name: entry.name, type: entry.type, connected, ...capability,
        canSend: connected && capability.canSend === true };
    })
  };
}

function registerChatbotTransportIpc({ handle, core, store, integrationChange }) {
  handle("chatbot:transport-status", () => chatbotTransportStatus(core, store));
  handle("chatbot:transport-configure", (_event, incoming) => integrationChange(() => {
    assertChatbotAccess(store);
    assertAuthenticatedAccount(store);
    const uid = String(readState(store, ["settings.account.uid"]).settings.account?.uid || "");
    const previous = readState(store, ["settings.tiktok.chat"]).settings.tiktok?.chat || {};
    const ownPrevious = previous.accountUid === uid ? previous : {};
    if (!incoming || !["none", "euler-oauth"].includes(incoming.provider)) throw new Error("Choisissez le mode d'envoi TikTok.");
    if (incoming.provider === "euler-oauth" && incoming.enableSend !== true) throw new Error("Confirmez l'activation des réponses automatiques avant d'enregistrer.");
    const secret = (value) => {
      if (value === undefined || value === "") return "";
      if (typeof value !== "string" || value.length > 12000 || /[\r\n\0]/.test(value)) throw new Error("Identifiant d'envoi invalide.");
      return value.trim();
    };
    const apiKey = secret(incoming.apiKey), accessToken = secret(incoming.accessToken);
    // On n'accepte jamais un ID de coffre fourni par le renderer : il pourrait
    // pointer vers un autre compte. Validation complète avant toute écriture.
    const config = validateTikTokChatConfiguration(incoming.provider === "none" ? { provider: "none", accountUid: uid } : {
      provider: incoming.provider, accountUid: uid,
      apiKeySecretId: apiKey ? "pending-api-key" : ownPrevious.apiKeySecretId,
      accessTokenSecretId: accessToken ? "pending-access-token" : ownPrevious.accessTokenSecretId,
      expiresAt: incoming.expiresAt || ownPrevious.expiresAt,
      scopes: incoming.scopes, botUsername: incoming.botUsername
    }, { requireCredentials: incoming.provider === "euler-oauth" });
    if (config.provider === "euler-oauth") {
      if (store.safeStorage?.isEncryptionAvailable() !== true) throw new Error("Le chiffrement Windows du coffre est indisponible. L'envoi TikTok reste désactivé.");
      if (!config.botUsername) throw new Error("Indiquez le @ du compte qui enverra les messages, pour éviter les réponses en boucle.");
      if (!apiKey && !store.getSecret(ownPrevious.apiKeySecretId || "")) throw new Error("La clé Euler est requise.");
      if (!accessToken && !store.getSecret(ownPrevious.accessTokenSecretId || "")) throw new Error("Le jeton OAuth est requis.");
    }
    // Écrit de nouvelles entrées avant le commit, jamais par-dessus les clés
    // actives. Un échec de la seconde écriture conserve l'ancien transport.
    const allocated = [];
    try {
      if (config.provider === "euler-oauth") {
        if (apiKey) { config.apiKeySecretId = store.setSecret("", apiKey); allocated.push(config.apiKeySecretId); }
        if (accessToken) { config.accessTokenSecretId = store.setSecret("", accessToken); allocated.push(config.accessTokenSecretId); }
      }
      store.set("settings.tiktok.chat", config);
    } catch (error) {
      for (const key of allocated) { try { store.setSecret(key, ""); } catch { /* Une entrée orpheline n'est jamais utilisée. */ } }
      throw error;
    }
    for (const key of ["apiKeySecretId", "accessTokenSecretId"]) {
      if (ownPrevious[key] && ownPrevious[key] !== config[key]) {
        try { store.setSecret(ownPrevious[key], ""); } catch { /* Référence déjà révoquée ; ne pas annoncer le commit comme échoué. */ }
      }
    }
    core.sourceHub.resetChatDelivery?.();
    // Ne pas publier avec la nouvelle autorisation des réponses mises en file
    // avant la validation du formulaire. Seuls les prochains événements restent.
    core.liveEventActions?.chatbot?.reset?.();
    core.sourceHub.refreshChatCapabilities();
    core.liveEventActions?.chatbot.syncTimers();
    return chatbotTransportStatus(core, store);
  }));
}

module.exports = { registerChatbotTransportIpc, chatbotTransportStatus };
