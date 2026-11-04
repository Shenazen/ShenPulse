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
  if (!["connections", "commands"].includes(currentPage) || !isAccountAuthenticated() || !api.chatbot?.transportStatus) return;
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
    "bot-checking": "Vérification du bot ShenPulse…",
    "bot-configuration-required": "Le bot ShenPulse doit être connecté par l’administration. Aucun réglage personnel requis.",
    "bot-authorization-required": "L’administration doit renouveler la connexion du bot ShenPulse.",
    "bot-service-unavailable": "Le service du bot ShenPulse est indisponible. Aucun réglage personnel requis.",
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
  if (entry.transport === "shenpulse-bot") return `Bot ShenPulse connecté${entry.botUsername ? ` · @${entry.botUsername}` : ""}`;
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
  return `<aside class="chatbot-delivery"><span class="chatbot-delivery-icon">${creatorChatbotIcon("bot")}</span><div><strong>Envoi automatique avec le bot ShenPulse</strong><p>Le bot commun est sélectionné par défaut sur TikTok : aucune clé ni aucun jeton à saisir par les créateurs. Il envoie les réponses et les rappels que vous activez pendant votre LIVE. Les commandes d’actions restent indépendantes de ce service.</p><small>${state?.configuration?.automatic && !state.configuration.serviceReady ? escapeHtml(creatorChatbotDeliveryReason({canSend:false,reason:state.configuration.serviceReason})) : "Un transfert au socket n’est pas une confirmation de publication."}</small></div><span class="chatbot-local-badge ${ready ? "is-connected" : ""}">${ready ? `${ready} source(s) avec confirmation` : state?.configuration?.automatic ? "Service en attente" : "Envoi indisponible"}</span></aside>
    <section class="chatbot-section chatbot-transports"><header class="chatbot-section-heading"><div><h3>Envoi de messages</h3><p>${escapeHtml(state?.error || (creatorChatbotDeliveryPending || !state ? "Vérification des capacités…" : "Les droits sont contrôlés avant chaque envoi."))}</p></div><div class="button-row"><button class="button small" data-action="chatbot-delivery-refresh">Actualiser</button><button class="button small" data-action="navigate" data-page="connections">Mes connexions</button><button class="button small" data-action="chatbot-delivery-configure">Réglages d’envoi TikTok</button></div></header><div class="chatbot-transport-list">${connections.map((entry) => `<article><strong data-studio-user-content>${escapeHtml(entry.name || entry.type)}</strong><span class="${entry.canSend ? "is-ready" : ""}">${escapeHtml(creatorChatbotDeliveryReason(entry))}</span></article>`).join("") || '<p>Aucune source disponible pour envoyer des réponses.</p>'}</div></section>`;
}

function syncCreatorChatbotDelivery() {
  if (!["connections", "commands"].includes(currentPage) || !isAccountAuthenticated()) return false;
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
  if (!["connections", "commands"].includes(currentPage)) return "";
  refreshCreatorChatbotDelivery();
  return `<div data-chatbot-delivery data-delivery-signature="${escapeHtml(creatorChatbotDeliveryViewSignature())}">${creatorChatbotDeliveryMarkup()}</div>`;
}

async function openCreatorChatbotDeliveryEditor() {
  if (!["connections", "commands"].includes(currentPage)) return;
  const owner = captureCreatorPrivateOperation();
  const status = await api.chatbot.transportStatus();
  assertCreatorPrivateOperation(owner);
  const config = status.configuration || {};
  openEditor({
    title: "Autorisation d'envoi TikTok", kicker: "MESSAGES · COMPTE ACTIF", variant: "wide",
    successMessage: "Mode d'envoi TikTok enregistré",
    body: `<p>Le bot ShenPulse commun est utilisé automatiquement. Vous pouvez choisir la réception uniquement, ou utiliser votre propre autorisation avancée. Kick et Twitch conservent leurs connexions habituelles.</p><details><summary>Configuration avancée de l’envoi TikTok</summary>${dialogSection("Options d’envoi", "Le bot commun est géré par l’administration. Les identifiants ci-dessous concernent seulement une autorisation personnelle facultative.",
      `${selectFieldMarkup("provider", "Mode d'envoi", config.provider || "shenpulse-bot", [["shenpulse-bot", "Automatique · Bot ShenPulse (par défaut)"], ["none", "Réception uniquement (sans envoi)"], ["euler-oauth", "Autorisation personnelle avancée"]], { full: true })}
      ${field("apiKey", "Clé API Euler (laisser vide pour conserver)", "", "password", 'maxlength="12000" autocomplete="off" full')}
      ${field("accessToken", "Jeton OAuth autorisé (laisser vide pour conserver)", "", "password", 'maxlength="12000" autocomplete="off" full')}
      ${field("expiresAt", "Expiration OAuth (ISO UTC)", config.expiresAt || "", "text", 'placeholder="2026-10-14T12:00:00Z" maxlength="40" full')}
      ${field("botUsername", "@ du compte qui enverra les messages", config.botUsername || "", "text", 'maxlength="80" spellcheck="false" full')}
      <label class="checkbox-label full"><input type="checkbox" name="scopeConfirmed"><span>Le jeton a bien la permission webcast:chat.</span></label>
      <label class="checkbox-label full"><input type="checkbox" name="enableSend"><span>Autoriser l'envoi avec mon autorisation personnelle (mode avancé seulement).</span></label>
      <p class="chatbot-editor-note full">Les secrets sont chiffrés sur cet appareil et ne sont jamais réaffichés. Le fournisseur valide l'autorisation à chaque envoi. Une expiration ou un refus reste visible dans le journal. Le mode réception uniquement efface les identifiants d'envoi enregistrés, sans supprimer vos commandes.</p>`)}
      <p class="chatbot-safety-note">Pour utiliser le service commun sans identifiants personnels, gardez le mode Automatique · Bot ShenPulse. Le mode avancé est facultatif. L'échange et le renouvellement OAuth nécessitent un serveur sécurisé ; aucun secret d'application ne doit être inclus dans l'EXE.</p></details>`,
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
  if (!["connections", "commands"].includes(currentPage) || !CREATOR_CHATBOT_DELIVERY_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === "chatbot-delivery-configure") return openCreatorChatbotDeliveryEditor();
  return refreshCreatorChatbotDelivery(true);
}
