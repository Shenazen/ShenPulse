"use strict";

/**
 * Contrat d'envoi explicite vers un relais autorisé. Une écriture WebSocket ne
 * prouve pas qu'une plateforme a accepté un commentaire : seul l'accusé corrélé
 * « sent » clôture l'envoi. Le relais reste responsable de ses autorisations.
 * Aucun cookie, compte TikTok ou fournisseur payant n'est créé par ce module.
 */
const { randomUUID } = require("node:crypto");

const RELAY_CHAT_PROTOCOL = "shenpulse-chat-v1";
const RELAY_CHAT_TIMEOUT_MS = 8000;
const MAX_PENDING_RELAY_CHATS = 20;
const RELAY_CHAT_MIN_INTERVAL_MS = 1500;
const MAX_CHAT_MESSAGE_LENGTH = 500;
const CONTROL_KINDS = new Set(["chat-capabilities", "chat-delivery"]);

function relayChatError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

class RelayChatDelivery {
  constructor({ getSocket, isCurrent, getRoomId, onChanged = () => {}, now = Date.now,
    timeoutMs = RELAY_CHAT_TIMEOUT_MS, minimumIntervalMs = RELAY_CHAT_MIN_INTERVAL_MS,
    setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout, requestId = randomUUID }) {
    this.getSocket = getSocket;
    this.isCurrent = isCurrent;
    this.getRoomId = getRoomId;
    this.onChanged = onChanged;
    this.now = now;
    this.timeoutMs = Math.max(1, Math.min(RELAY_CHAT_TIMEOUT_MS, Number(timeoutMs) || RELAY_CHAT_TIMEOUT_MS));
    this.minimumIntervalMs = Math.max(RELAY_CHAT_MIN_INTERVAL_MS, Number(minimumIntervalMs) || RELAY_CHAT_MIN_INTERVAL_MS);
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.requestId = requestId;
    this.pending = new Map();
    this.authorized = false;
    this.lastDispatchAt = null;
  }

  /** État compact sans URL, secret, contenu de commentaire ni snapshot LIVE. */
  status() {
    return { protocol: RELAY_CHAT_PROTOCOL, canSend: this.canSend(),
      acknowledgement: this.authorized, pending: this.pending.size };
  }

  canSend() {
    return this.authorized && this.isCurrent() && this.getSocket()?.readyState === 1 &&
      Boolean(String(this.getRoomId() || "").trim());
  }

  requestCapabilities() {
    if (!this.isCurrent() || this.getSocket()?.readyState !== 1) return;
    this.getSocket().send(JSON.stringify({ action: "chat-capabilities", protocol: RELAY_CHAT_PROTOCOL,
      platform: "tiktok" }));
  }

  /** Les paquets de contrôle sont consommés, jamais normalisés en événement LIVE. */
  handle(raw) {
    if (!raw || typeof raw !== "object") return false;
    const kind = raw.action || raw.event || raw.type;
    if (!CONTROL_KINDS.has(kind)) return false;
    if (raw.protocol !== RELAY_CHAT_PROTOCOL || !this.isCurrent()) return true;
    if (kind === "chat-capabilities") {
      const authorized = raw.platform === "tiktok" && raw.canSend === true &&
        raw.authenticated === true && raw.acknowledgements === true;
      if (authorized !== this.authorized) {
        this.authorized = authorized;
        if (!authorized) this.cancelPending("relay-chat-unauthorized", "Le relais n'autorise plus l'envoi de messages.");
        this.onChanged(this.status());
      }
      return true;
    }
    const job = this.pending.get(raw.requestId);
    if (!job) return true;
    if (raw.roomId !== job.roomId || raw.platform !== "tiktok") return true;
    if (!this.jobIsCurrent(job)) {
      this.finish(raw.requestId, relayChatError("relay-chat-cancelled", "L'envoi appartient à une connexion ou un profil précédent."));
    } else if (raw.sent === true) {
      this.finish(raw.requestId, null, { sent: true, acknowledged: true, transport: "tiktok-relay",
        requestId: raw.requestId });
    } else if (raw.sent === false) {
      // Ne jamais répercuter une erreur distante susceptible de contenir un jeton.
      this.finish(raw.requestId, relayChatError("relay-chat-rejected", "La plateforme a refusé l'envoi via le relais."));
    }
    // « accepted », « queued » ou un simple ok ne sont pas une preuve d'envoi.
    return true;
  }

  jobIsCurrent(job) {
    return this.canSend() && this.getSocket() === job.socket &&
      String(this.getRoomId() || "") === job.roomId && job.shouldSend();
  }

  async send(payload, { shouldSend = () => true } = {}) {
    const message = payload?.message;
    if (typeof message !== "string" || !message.trim() || [...message].length > MAX_CHAT_MESSAGE_LENGTH) {
      throw relayChatError("relay-chat-invalid-message", "Un commentaire doit contenir de 1 à 500 caractères.");
    }
    if (!this.canSend()) throw relayChatError("relay-chat-unavailable", "Un relais authentifié avec confirmation d'envoi est requis.");
    if (!shouldSend()) throw relayChatError("relay-chat-cancelled", "Le compte, le profil ou la connexion a changé.");
    if (this.pending.size >= MAX_PENDING_RELAY_CHATS) throw relayChatError("relay-chat-busy", "Trop de messages attendent une confirmation.");
    const now = this.now();
    if (this.lastDispatchAt !== null && now - this.lastDispatchAt < this.minimumIntervalMs) {
      throw relayChatError("relay-chat-rate-limit", "Les messages du ChatBot sont envoyés trop rapidement.");
    }
    const socket = this.getSocket();
    const roomId = String(this.getRoomId() || "");
    const requestId = this.requestId();
    if (!requestId || this.pending.has(requestId)) throw relayChatError("relay-chat-invalid-id", "Identifiant de confirmation indisponible.");
    return new Promise((resolve, reject) => {
      const job = { socket, roomId, shouldSend, resolve, reject, timer: null };
      this.pending.set(requestId, job);
      job.timer = this.setTimeoutFn(() => this.finish(requestId,
        relayChatError("relay-chat-timeout", "Le relais n'a pas confirmé l'envoi du commentaire.")), this.timeoutMs);
      job.timer?.unref?.();
      try {
        if (!this.jobIsCurrent(job)) throw relayChatError("relay-chat-cancelled", "Le compte, le profil ou la connexion a changé.");
        socket.send(JSON.stringify({ action: "send-chat", protocol: RELAY_CHAT_PROTOCOL,
          requestId, platform: "tiktok", roomId, message }));
        this.lastDispatchAt = now;
      } catch (error) {
        this.finish(requestId, error?.code?.startsWith("relay-chat-") ? error :
          relayChatError("relay-chat-socket-error", "L'envoi au relais a échoué."));
      }
    });
  }

  finish(requestId, error, result) {
    const job = this.pending.get(requestId);
    if (!job) return;
    this.pending.delete(requestId);
    if (job.timer !== null) this.clearTimeoutFn(job.timer);
    if (error) job.reject(error);
    else job.resolve(result);
  }

  cancelPending(code = "relay-chat-cancelled", message = "Connexion au relais interrompue.") {
    for (const requestId of this.pending.keys()) this.finish(requestId, relayChatError(code, message));
  }

  /** Toute reconnexion doit négocier à nouveau ; aucune répétition d'envoi. */
  reset() {
    const changed = this.authorized;
    this.authorized = false;
    this.cancelPending();
    if (changed) this.onChanged(this.status());
  }
}

module.exports = { RelayChatDelivery, RELAY_CHAT_PROTOCOL, RELAY_CHAT_TIMEOUT_MS,
  MAX_PENDING_RELAY_CHATS, RELAY_CHAT_MIN_INTERVAL_MS, MAX_CHAT_MESSAGE_LENGTH };
