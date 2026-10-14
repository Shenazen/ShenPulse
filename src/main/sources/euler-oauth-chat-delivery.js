"use strict";

/**
 * Envoi TikTok autorisé, séparé du connecteur gratuit de réception. Le jeton
 * OAuth vient d'un client Euler enregistré ; l'échange/renouvellement qui exige
 * un client_secret doit rester sur un serveur, jamais dans l'EXE distribué.
 * Référence : OpenAPI publique EulerStream/TikTok-Live-Api, 13 octobre 2026.
 */
const EULER_CHAT_API = "https://api.eulerstream.com";
const EULER_CHAT_SCOPE = "webcast:chat";
const EULER_CHAT_TIMEOUT_MS = 8000;
const EULER_CHAT_MIN_INTERVAL_MS = 1500;
const MAX_EULER_CHAT_PENDING = 20;
const MAX_EULER_CHAT_RESPONSE_BYTES = 65536;

function chatError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** Valide uniquement la configuration publique : aucun accès au coffre. */
function validateTikTokChatConfiguration(value, { now = Date.now(), requireCredentials = false } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Configuration du ChatBot TikTok invalide.");
  const provider = value.provider || "none";
  if (!["none", "euler-oauth"].includes(provider)) throw new Error("Fournisseur d'envoi TikTok inconnu.");
  const config = { provider, apiKeySecretId: String(value.apiKeySecretId || "").trim(),
    accessTokenSecretId: String(value.accessTokenSecretId || "").trim(),
    expiresAt: String(value.expiresAt || "").trim(), accountUid: String(value.accountUid || "").trim(),
    botUsername: String(value.botUsername || "").trim().replace(/^@+/, ""),
    scopes: Array.isArray(value.scopes) ? [...new Set(value.scopes.filter((scope) => typeof scope === "string" && scope.length <= 80))].slice(0, 20) : [] };
  if (config.apiKeySecretId.length > 160 || config.accessTokenSecretId.length > 160 || config.accountUid.length > 200 ||
      config.botUsername && !/^[\w.]{1,80}$/.test(config.botUsername) ||
      config.expiresAt && !/^\d{4}-\d{2}-\d{2}T/.test(config.expiresAt) ||
      config.expiresAt && !Number.isFinite(Date.parse(config.expiresAt))) throw new Error("Configuration du ChatBot TikTok invalide.");
  if (requireCredentials && provider === "euler-oauth" && (!config.apiKeySecretId || !config.accessTokenSecretId ||
      !config.accountUid || !config.scopes.includes(EULER_CHAT_SCOPE) || !(Date.parse(config.expiresAt) > now))) {
    throw new Error("Une clé Euler, un jeton OAuth non expiré et la permission webcast:chat sont requis.");
  }
  return config;
}

/** L'état « configuré » n'est pas une validation distante des permissions. */
function tiktokChatConfigurationStatus(value, { accountUid = "", authenticated = false,
  hasApiKey = false, hasAccessToken = false, now = Date.now() } = {}) {
  const base = { canSend: false, transport: "euler-oauth", confirmation: "platform",
    requiresAuthorization: true, authorization: "missing" };
  let config;
  try { config = validateTikTokChatConfiguration(value || { provider: "none" }); }
  catch { return { ...base, reason: "invalid-configuration" }; }
  if (config.provider !== "euler-oauth") return { ...base, transport: "none", reason: "not-configured" };
  if (!authenticated || !accountUid || config.accountUid !== accountUid) return { ...base, reason: "account-mismatch" };
  if (!hasApiKey || !hasAccessToken) return { ...base, reason: "credentials-missing" };
  if (!config.scopes.includes(EULER_CHAT_SCOPE)) return { ...base, reason: "scope-missing" };
  if (!(Date.parse(config.expiresAt) > now)) return { ...base, reason: "token-expired" };
  return { ...base, canSend: true, reason: "configured", authorization: "configured", requiresAuthorization: false };
}

async function readBoundedChatResponse(response) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_EULER_CHAT_RESPONSE_BYTES) throw chatError("tiktok-chat-invalid-response", "Confirmation TikTok invalide.");
    return body;
  }
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_EULER_CHAT_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw chatError("tiktok-chat-invalid-response", "Confirmation TikTok invalide.");
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total).toString("utf8");
  } finally { reader.releaseLock?.(); }
}

class EulerOAuthChatDelivery {
  constructor({ getSession, fetchFn = globalThis.fetch, now = Date.now, timeoutMs = EULER_CHAT_TIMEOUT_MS,
    setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout }) {
    this.getSession = getSession;
    this.fetch = fetchFn;
    this.now = now;
    this.timeoutMs = Math.max(1, Math.min(EULER_CHAT_TIMEOUT_MS, Number(timeoutMs) || EULER_CHAT_TIMEOUT_MS));
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.pending = new Set();
    this.generation = 0;
    this.lastDispatchAt = null;
  }

  status() {
    const session = this.getSession();
    return tiktokChatConfigurationStatus(session?.config, { accountUid: session?.accountUid,
      authenticated: session?.authenticated, hasApiKey: Boolean(session?.apiKey),
      hasAccessToken: Boolean(session?.accessToken), now: this.now() });
  }

  async send(roomId, payload, { shouldSend = () => true } = {}) {
    const message = payload?.message;
    if (typeof message !== "string" || !message.trim() || [...message].length > 500) {
      throw chatError("tiktok-chat-invalid-message", "Un commentaire doit contenir de 1 à 500 caractères.");
    }
    if (typeof roomId !== "string" || !/^[1-9]\d{0,29}$/.test(roomId)) throw chatError("tiktok-chat-invalid-room", "Le salon TikTok du LIVE est introuvable.");
    if (!this.status().canSend) throw chatError("tiktok-chat-authorization-required", "Autorisez le ChatBot TikTok avec un compte Euler et la permission webcast:chat.");
    if (!shouldSend()) throw chatError("tiktok-chat-cancelled", "Le compte, le profil ou la connexion a changé.");
    if (this.pending.size >= MAX_EULER_CHAT_PENDING) throw chatError("tiktok-chat-busy", "Trop de commentaires attendent une confirmation.");
    const now = this.now();
    if (this.lastDispatchAt !== null && now - this.lastDispatchAt < EULER_CHAT_MIN_INTERVAL_MS) {
      throw chatError("tiktok-chat-rate-limit", "Les messages du ChatBot sont envoyés trop rapidement.");
    }
    const session = this.getSession();
    const generation = this.generation;
    const controller = new AbortController();
    this.pending.add(controller);
    let timer, timedOut = false;
    const isCurrent = () => {
      const fresh = this.getSession();
      return generation === this.generation && shouldSend() && this.status().canSend &&
        fresh?.accountUid === session.accountUid && fresh?.apiKey === session.apiKey &&
        fresh?.accessToken === session.accessToken;
    };
    try {
      const timeout = new Promise((_, reject) => {
        timer = this.setTimeoutFn(() => {
          timedOut = true;
          controller.abort();
          reject(chatError("tiktok-chat-timeout", "Le fournisseur n'a pas confirmé l'envoi ; aucun nouvel essai automatique n'est effectué."));
        }, this.timeoutMs);
        timer?.unref?.();
      });
      const cancellation = new Promise((_, reject) => controller.signal.addEventListener("abort", () => {
        if (!timedOut) reject(chatError("tiktok-chat-cancelled", "La connexion ou l'autorisation d'envoi a changé."));
      }, { once: true }));
      if (!isCurrent()) throw chatError("tiktok-chat-cancelled", "Le compte, le profil ou la connexion a changé.");
      this.lastDispatchAt = now;
      const request = Promise.resolve().then(async () => {
        // Garde immédiatement avant le POST, pas seulement avant la mise en file.
        if (!isCurrent()) throw chatError("tiktok-chat-cancelled", "Le compte, le profil ou la connexion a changé.");
        const response = await this.fetch(`${EULER_CHAT_API}/webcast/rooms/${roomId}/chat`, {
          method: "POST", redirect: "error", headers: { "Content-Type": "application/json",
            "x-api-key": session.apiKey, "x-oauth-token": session.accessToken },
          body: JSON.stringify({ content: message, targetRoomId: roomId }), signal: controller.signal
        });
        if (!response.ok) {
          const code = response.status === 401 || response.status === 403 ? "tiktok-chat-authorization-rejected" :
            response.status === 429 ? "tiktok-chat-rate-limit" : "tiktok-chat-provider-error";
          throw chatError(code, "Le fournisseur TikTok a refusé l'envoi. Vérifiez l'autorisation, le forfait et les limites de votre compte.");
        }
        const length = Number(response.headers?.get?.("content-length"));
        if (length > MAX_EULER_CHAT_RESPONSE_BYTES) throw chatError("tiktok-chat-invalid-response", "Confirmation TikTok invalide.");
        const body = await readBoundedChatResponse(response);
        let result;
        try { result = JSON.parse(body); } catch { throw chatError("tiktok-chat-invalid-response", "Confirmation TikTok invalide."); }
        // HTTP 200 ou « mis en file » ne suffisent pas : TikTok doit accepter.
        if (result.code !== 200 || result.data?.status_code !== 0 || !result.data?.data || result.error) {
          throw chatError("tiktok-chat-not-confirmed", "TikTok n'a pas confirmé l'acceptation du commentaire.");
        }
        return { sent: true, acknowledged: true, confirmation: "platform", transport: "euler-oauth" };
      });
      const result = await Promise.race([request, timeout, cancellation]);
      if (!isCurrent()) return { ...result, stale: true };
      return result;
    } catch (error) {
      if (error?.code?.startsWith("tiktok-chat-")) throw error;
      throw chatError("tiktok-chat-network-error", "La confirmation TikTok est indisponible ; aucun nouvel essai automatique n'est effectué.");
    } finally {
      if (timer !== undefined) this.clearTimeoutFn(timer);
      this.pending.delete(controller);
    }
  }

  reset() {
    this.generation += 1;
    for (const controller of this.pending) controller.abort();
    this.pending.clear();
  }
}

module.exports = { EulerOAuthChatDelivery, validateTikTokChatConfiguration, tiktokChatConfigurationStatus,
  EULER_CHAT_API, EULER_CHAT_SCOPE, EULER_CHAT_TIMEOUT_MS, EULER_CHAT_MIN_INTERVAL_MS,
  MAX_EULER_CHAT_PENDING, MAX_EULER_CHAT_RESPONSE_BYTES };
