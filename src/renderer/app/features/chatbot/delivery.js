"use strict";

/** Capacités d'envoi à la demande, isolées du journal qui change à chaque chat. */
let creatorChatbotDeliveryState = null;
let creatorChatbotDeliverySignature = "";
let creatorChatbotDeliveryRequest = 0;
let creatorChatbotDeliveryPending = false;

function creatorChatbotDeliveryKey() {
  return JSON.stringify([captureCreatorPrivateOperation(), snapshot?.state?.settings?.tiktok?.chat,
    (snapshot?.state?.connections || []).map((entry) => [entry.id, entry.enabled, entry.status, entry.type])]);
}

async function refreshCreatorChatbotDelivery(force = false) {
  if (currentPage !== "connections" || !isAccountAuthenticated() || !api.chatbot?.transportStatus) return;
  const signature = creatorChatbotDeliveryKey();
  if (!force && signature === creatorChatbotDeliverySignature) return;
  const owner = captureCreatorPrivateOperation();
  const request = ++creatorChatbotDeliveryRequest;
  creatorChatbotDeliverySignature = signature;
  creatorChatbotDeliveryState = null;
  creatorChatbotDeliveryPending = true;
  try {
    const result = await api.chatbot.transportStatus();
    assertCreatorPrivateOperation(owner);
    if (request !== creatorChatbotDeliveryRequest) return;
    creatorChatbotDeliveryState = result;
  } catch (error) {
    if (!creatorPrivateOperationActive(owner) || request !== creatorChatbotDeliveryRequest) return;
    creatorChatbotDeliveryState = { error: error.message || "État d'envoi indisponible", connections: [] };
  } finally {
    if (request === creatorChatbotDeliveryRequest) {
      creatorChatbotDeliveryPending = false;
      syncCreatorChatbotDelivery();
    }
  }
}

function creatorChatbotDeliveryReason(entry) {
  const reasons = {
    "not-configured": "Autorisation d'envoi non configurée",
    "credentials-missing": "Identifiants d'envoi manquants",
    "token-expired": "Autorisation expirée : renouvelez le jeton",
    "scope-missing": "Permission webcast:chat manquante",
    "account-mismatch": "Autorisation liée à un autre compte",
    "invalid-configuration": "Configuration à corriger",
    "disconnected": "Source déconnectée",
    "not-live": "En attente du LIVE",
    "relay-authorization-required": "Le relais doit confirmer ses droits d'envoi",
    "kick-scope-missing": "Autorisez à nouveau Kick avec la permission chat:write",
    "kick-authorization-required": "Autorisez à nouveau le compte Kick"
  };
  if (!entry.canSend) return reasons[entry.reason] || "Envoi indisponible";
  if (entry.authorization === "configured") return "Configuré · autorisation vérifiée par le fournisseur à chaque envoi";
  if (entry.confirmation === "socket") return "Transfert uniquement · aucune confirmation de publication";
  if (entry.confirmation === "relay") return "Envoi disponible · confirmation par le relais";
  return "Envoi disponible · confirmation par la plateforme";
}

function creatorChatbotDeliveryMarkup() {
  // Ne réaffiche jamais le cache d'un autre compte, même avant le prochain IPC.
  const state = creatorChatbotDeliverySignature === creatorChatbotDeliveryKey() ? creatorChatbotDeliveryState : null;
  const expired = state?.configuration?.provider === "euler-oauth" && !(Date.parse(state.configuration.expiresAt) > Date.now());
  const connections = (state?.connections || []).map((entry) => expired && entry.transport === "euler-oauth"
    ? { ...entry, canSend: false, reason: "token-expired" } : entry);
  const ready = connections.filter((entry) => entry.canSend && entry.confirmation !== "socket").length;
  return `<aside class="chatbot-delivery"><span class="chatbot-delivery-icon">${creatorChatbotIcon("bot")}</span><div><strong>Envoi d'actions « Réponse chat » · facultatif</strong><p>Les commandes de musique, d'actions et d'overlays fonctionnent à la réception du chat, sans service d'envoi. Cette autorisation concerne uniquement les actions « Réponse chat ».</p><small>Un transfert au socket n'est pas une confirmation de publication.</small></div><span class="chatbot-local-badge ${ready ? "is-connected" : ""}">${ready ? `${ready} source(s) avec confirmation` : "Envoi à configurer"}</span></aside>
    <section class="chatbot-section chatbot-transports"><header class="chatbot-section-heading"><div><h3>Envoi de messages</h3><p>${escapeHtml(state?.error || (creatorChatbotDeliveryPending || !state ? "Vérification des capacités…" : "Les droits sont contrôlés avant chaque envoi."))}</p></div><div class="button-row"><button class="button small" data-action="chatbot-delivery-refresh">Actualiser</button><button class="button small primary" data-action="chatbot-delivery-configure">Envoi TikTok</button></div></header><div class="chatbot-transport-list">${connections.map((entry) => `<article><strong data-studio-user-content>${escapeHtml(entry.name || entry.type)}</strong><span class="${entry.canSend ? "is-ready" : ""}">${escapeHtml(creatorChatbotDeliveryReason(entry))}</span></article>`).join("") || '<p>Aucune source disponible pour envoyer des réponses.</p>'}</div></section>`;
}

function syncCreatorChatbotDelivery() {
  if (currentPage !== "connections" || !isAccountAuthenticated()) return false;
  const section = content.querySelector("[data-chatbot-delivery]");
  if (!section) return false;
  const signature = creatorChatbotDeliveryViewSignature();
  if (section.dataset.deliverySignature === signature) return true;
  section.innerHTML = creatorChatbotDeliveryMarkup();
  section.dataset.deliverySignature = signature;
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(section);
  return true;
}

function creatorChatbotDeliveryViewSignature() {
  const key = creatorChatbotDeliveryKey();
  const state = creatorChatbotDeliverySignature === key ? creatorChatbotDeliveryState : null;
  return JSON.stringify([key, state, creatorChatbotDeliveryPending,
    state?.configuration?.provider === "euler-oauth" && !(Date.parse(state.configuration.expiresAt) > Date.now())]);
}

function renderCreatorChatbotDelivery() {
  if (currentPage !== "connections") return "";
  refreshCreatorChatbotDelivery();
  return `<div data-chatbot-delivery data-delivery-signature="${escapeHtml(creatorChatbotDeliveryViewSignature())}">${creatorChatbotDeliveryMarkup()}</div>`;
}

async function openCreatorChatbotDeliveryEditor() {
  if (currentPage !== "connections") return;
  const owner = captureCreatorPrivateOperation();
  const status = await api.chatbot.transportStatus();
  assertCreatorPrivateOperation(owner);
  const config = status.configuration || {};
  openEditor({
    title: "Autorisation d'envoi TikTok", kicker: "MESSAGES · COMPTE ACTIF", variant: "wide",
    successMessage: "Mode d'envoi TikTok enregistré",
    body: `${dialogSection("Un envoi autorisé, sans cookies TikTok", "Euler Stream exige un accès compatible et un jeton OAuth valide. La saisie ci-dessous ne crée ni abonnement ni autorisation OAuth.",
      `${selectFieldMarkup("provider", "Mode d'envoi", config.provider || "none", [["none", "Réception uniquement (sans envoi)"], ["euler-oauth", "Euler Stream · OAuth autorisé"]], { full: true })}
      ${field("apiKey", "Clé API Euler (laisser vide pour conserver)", "", "password", 'maxlength="12000" autocomplete="off" full')}
      ${field("accessToken", "Jeton OAuth autorisé (laisser vide pour conserver)", "", "password", 'maxlength="12000" autocomplete="off" full')}
      ${field("expiresAt", "Expiration OAuth (ISO UTC)", config.expiresAt || "", "text", 'placeholder="2026-10-14T12:00:00Z" maxlength="40" full')}
      ${field("botUsername", "@ du compte qui enverra les messages", config.botUsername || "", "text", 'maxlength="80" spellcheck="false" full')}
      <label class="checkbox-label full"><input type="checkbox" name="scopeConfirmed"><span>Le jeton a bien la permission webcast:chat.</span></label>
      <label class="checkbox-label full"><input type="checkbox" name="enableSend"><span>Autoriser l'envoi des actions « Réponse chat ».</span></label>
      <p class="chatbot-editor-note full">Les secrets sont chiffrés sur cet appareil et ne sont jamais réaffichés. Le fournisseur valide l'autorisation à chaque envoi. Une expiration ou un refus reste visible dans le journal. Le mode réception uniquement efface les identifiants d'envoi enregistrés, sans supprimer vos commandes.</p>`)}
      <p class="chatbot-safety-note">Vous n'avez pas cet accès ? Gardez la réception uniquement, ou utilisez un relais autorisé qui annonce ses capacités et confirme les envois. L'échange et le renouvellement OAuth nécessitent un serveur sécurisé ; aucun secret d'application ne doit être inclus dans l'EXE.</p>`,
    onSubmit: async (data) => {
      assertCreatorPrivateOperation(owner);
      const result = await api.chatbot.configureTransport({
        provider: String(data.get("provider") || "none"), apiKey: String(data.get("apiKey") || ""),
        accessToken: String(data.get("accessToken") || ""), expiresAt: String(data.get("expiresAt") || "").trim(),
        botUsername: String(data.get("botUsername") || "").trim(),
        scopes: data.has("scopeConfirmed") ? ["webcast:chat"] : [], enableSend: data.has("enableSend")
      });
      assertCreatorPrivateOperation(owner);
      const nextSnapshot = await api.getSnapshot();
      assertCreatorPrivateOperation(owner);
      acceptSnapshot(nextSnapshot);
      creatorChatbotDeliverySignature = creatorChatbotDeliveryKey();
      creatorChatbotDeliveryState = result;
      syncCreatorChatbotDelivery();
      return result;
    }
  });
}

const CREATOR_CHATBOT_DELIVERY_ACTIONS = new Set(["chatbot-delivery-refresh", "chatbot-delivery-configure"]);
async function handleCreatorChatbotDeliveryAction({ action }) {
  if (currentPage !== "connections" || !CREATOR_CHATBOT_DELIVERY_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === "chatbot-delivery-configure") return openCreatorChatbotDeliveryEditor();
  return refreshCreatorChatbotDelivery(true);
}
