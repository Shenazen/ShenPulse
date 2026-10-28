"use strict";

const crypto = require("node:crypto");
const { readState } = require("../state-projection");
const { safeString, clone } = require("../utils");

const { applyMusicSettings, musicSettingsCommandKey } = require("./music-command-links");
const { findChatbotCommand, previewChatbotResponse, chatbotPlatformForConnection } = require("../../shared/chatbot-command");

const HISTORY_LIMIT = 30;
const COOLDOWN_LIMIT = 1000;
const TEST_SOURCES = new Set(["simulator", "test", "rule-test", "manual-preview", "demo", "source_demo"]);
const { normalizeSongRequestSettings, QUEUE_LIMIT } = require("./song-request-settings");

function normalizedArtist(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function commandMatch(message, commands) {
  const text = String(message || "").trim();
  for (const [kind, command] of Object.entries(commands)) {
    if (text.toLowerCase() === command || text.toLowerCase().startsWith(`${command} `)) {
      return { kind, argument: text.slice(command.length).trim() };
    }
  }
  return null;
}

function assertTrackAllowed(track, settings) {
  if (!settings.allowExplicit && track.explicit) throw new Error("Ce titre est explicite et le filtre est actif.");
  if (track.durationMs > settings.maxDurationMinutes * 60_000) throw new Error("Ce titre dépasse la durée maximale autorisée.");
  if ((track.artists || []).some((artist) => settings.blockedArtists.some((blocked) => normalizedArtist(artist).includes(normalizedArtist(blocked))))) throw new Error("L’artiste de ce titre est bloqué dans les demandes musicales.");
}

/** Demandes locales : supprimer une demande n'efface jamais la file native Spotify. */
class SongRequestsService {
  constructor({ store, spotify, notifyRenderer = () => {}, now = Date.now }) {
    this.store = store;
    this.spotify = spotify;
    this.notifyRenderer = notifyRenderer;
    this.now = now;
    this.cooldowns = new Map();
    this.commandCooldowns = new Map();
    this.pendingCount = 0;
    this.operations = Promise.resolve();
    this.lastResponse = null;
    this.responseOwner = "";
  }

  owner() {
    return this.store.getActiveAccountUid?.() || readState(this.store, ["settings.account.uid"]).settings?.account?.uid || "";
  }

  #state() {
    const spotify = readState(this.store, ["settings.spotify.songRequests", "settings.spotify.requestQueue", "settings.spotify.requestHistory"]).settings?.spotify || {};
    return { settings: normalizeSongRequestSettings(spotify.songRequests),
      queue: Array.isArray(spotify.requestQueue) ? spotify.requestQueue.slice(0, QUEUE_LIMIT) : [],
      history: Array.isArray(spotify.requestHistory) ? spotify.requestHistory.slice(-HISTORY_LIMIT) : [] };
  }

  status() {
    return { ...this.#state(), lastResponse: this.responseOwner === this.owner() ? clone(this.lastResponse) : null,
      queueKind: "shenpulse-managed", spotifyQueueMutable: false, ownerUid: this.owner() };
  }

  configure(incoming = {}) {
    const current = this.#state().settings;
    const settings = normalizeSongRequestSettings({ ...current, ...incoming,
      commands: { ...current.commands, ...(incoming.commands || {}) },
      commandEnabled: { ...current.commandEnabled, ...(incoming.commandEnabled || {}) } }, true);
    this.store.mutate((state) => applyMusicSettings(state, settings), true);
    this.#notify();
    return this.status();
  }

  #mutate(mutator) {
    this.store.mutateRuntime((state) => {
      state.settings.spotify ||= {};
      state.settings.spotify.requestQueue = Array.isArray(state.settings.spotify.requestQueue) ? state.settings.spotify.requestQueue.slice(0, QUEUE_LIMIT) : [];
      state.settings.spotify.requestHistory = Array.isArray(state.settings.spotify.requestHistory) ? state.settings.spotify.requestHistory.slice(-HISTORY_LIMIT) : [];
      mutator(state.settings.spotify);
    });
    this.#notify();
  }

  #notify() {
    this.notifyRenderer("song-requests-changed", this.status());
  }

  executionScope() { return JSON.stringify([this.owner(), readState(this.store, ["session.profileId"]).session?.profileId || ""]); }

  #assertOwner(owner) {
    if (this.executionScope() !== owner) throw new Error("Le compte ou le profil ShenPulse a changé pendant la demande musicale. Réessayez depuis votre compte.");
  }

  #serial(operation) {
    if (this.pendingCount >= 50) return Promise.reject(new Error("Trop de demandes musicales simultanées. Réessayez dans quelques secondes."));
    this.pendingCount += 1;
    const run = this.operations.then(operation);
    this.operations = run.catch(() => {});
    return run.finally(() => { this.pendingCount -= 1; });
  }

  add({ query, uri, user = {}, creator = true } = {}) {
    const owner = this.executionScope();
    return this.#serial(async () => {
      this.#assertOwner(owner);
      const { settings, queue } = this.#state();
      if (!creator && !settings.enabled) throw new Error("Les demandes musicales sont désactivées.");
      const identity = { id: safeString(user.id || (creator ? "creator" : ""), 120),
        name: safeString(user.name || "Créateur", 120), displayName: safeString(user.displayName || user.name || "Créateur", 160) };
      if (!identity.id || identity.id === "anonymous") throw new Error("Le spectateur n’a pas d’identifiant disponible.");
      const key = `${owner}:${identity.id}`;
      if (queue.length >= settings.maxQueue) throw new Error("La file de demandes ShenPulse est pleine.");
      if (!creator && queue.filter((entry) => entry.user?.id === identity.id).length >= settings.maxPerViewer) throw new Error("Ce spectateur a atteint sa limite de demandes en attente.");
      if (!creator && this.now() - (this.cooldowns.get(key) ?? -Infinity) < settings.cooldownSeconds * 1000) throw new Error("Patientez avant de proposer un autre titre.");
      // Le délai est posé avant la recherche : les titres invalides ne permettent pas de spammer l'API.
      if (!creator) {
        this.cooldowns.set(key, this.now());
        if (this.cooldowns.size > COOLDOWN_LIMIT) this.cooldowns.delete(this.cooldowns.keys().next().value);
      }
      const track = await this.spotify.resolveTrack({ query: uri || query });
      this.#assertOwner(owner);
      const current = this.#state();
      if (!creator && !current.settings.enabled) throw new Error("Les demandes musicales ont été désactivées pendant la recherche.");
      assertTrackAllowed(track, current.settings);
      if (current.queue.length >= current.settings.maxQueue) throw new Error("La file de demandes ShenPulse est pleine.");
      if (!creator && current.queue.filter((entry) => entry.user?.id === identity.id).length >= current.settings.maxPerViewer) throw new Error("Ce spectateur a atteint sa limite de demandes en attente.");
      const entry = { id: crypto.randomUUID(), track, user: identity, requestedAt: new Date(this.now()).toISOString() };
      this.#mutate((spotify) => { spotify.requestQueue.push(entry); });
      return { ok: true, entry, ...this.status() };
    });
  }

  remove(id) {
    this.#mutate((spotify) => { spotify.requestQueue = spotify.requestQueue.filter((entry) => entry.id !== String(id || "")); });
    return { ok: true, ...this.status() };
  }

  clear() {
    this.#mutate((spotify) => { spotify.requestQueue = []; });
    return { ok: true, ...this.status() };
  }

  playNext() {
    const owner = this.executionScope();
    return this.#serial(async () => {
      this.#assertOwner(owner);
      const { queue, settings } = this.#state();
      const entry = queue[0];
      if (!entry) throw new Error("Aucune demande ShenPulse n’est en attente.");
      assertTrackAllowed(entry.track, settings);
      const result = await this.spotify.control({ operation: "play_track", uri: entry.track.uri });
      this.#assertOwner(owner);
      this.#mutate((spotify) => {
        spotify.requestQueue = spotify.requestQueue.filter((row) => row.id !== entry.id);
        spotify.requestHistory.push({ ...entry, playedAt: new Date(this.now()).toISOString() });
        spotify.requestHistory = spotify.requestHistory.slice(-HISTORY_LIMIT);
      });
      return { ...result, ...this.status() };
    });
  }

  async skip() {
    return this.#state().queue.length ? this.playNext() : this.spotify.control({ operation: "next" });
  }

  async handleChat(event) {
    if (event?.type !== "chat" || TEST_SOURCES.has(event.source) || event.moderationBlocked) return { handled: false };
    const { settings } = this.#state();
    if (!settings.enabled) return { handled: false };
    const state = readState(this.store, ["commands", "connections"]);
    const keyFor = (entry) => musicSettingsCommandKey(entry, settings.commands);
    const rows = (state.commands || []).filter(keyFor);
    const platform = chatbotPlatformForConnection((state.connections || []).find((entry) => entry.id === event.source));
    const entry = findChatbotCommand(rows, { ...event, platform });
    const match = entry ? { kind: keyFor(entry), argument: previewChatbotResponse(entry, { ...event, platform }).args }
      : commandMatch(event.data?.message, Object.fromEntries(Object.entries(settings.commands).filter(([key]) => settings.commandEnabled[key] && !rows.some((row) => keyFor(row) === key))));
    if (!match || !settings.commandEnabled[match.kind]) return { handled: false };
    const owner = this.owner(), scope = this.executionScope();
    try {
      if (entry && !previewChatbotResponse(entry, { ...event, platform }).allowed) throw new Error("Vous n’avez pas le rôle requis pour cette commande musicale.");
      const spamKey = `${owner}:${event.user?.id}:${match.kind}`;
      if (this.now() - (this.commandCooldowns.get(spamKey) ?? -Infinity) < Math.max(2000, Number(entry?.cooldownMs) || 0)) throw new Error("Cette commande musicale vient déjà d’être traitée.");
      const globalKey = `${owner}:global:${match.kind}`;
      const globalCooldown = Number(entry?.globalCooldownMs) || 0;
      if (globalCooldown && this.now() - (this.commandCooldowns.get(globalKey) ?? -Infinity) < globalCooldown) throw new Error("Le délai global de cette commande musicale n’est pas terminé.");
      this.commandCooldowns.set(spamKey, this.now());
      if (globalCooldown) this.commandCooldowns.set(globalKey, this.now());
      if (this.commandCooldowns.size > COOLDOWN_LIMIT) this.commandCooldowns.delete(this.commandCooldowns.keys().next().value);
      let response;
      if (match.kind === "request") {
        if (!match.argument) throw new Error(`Ajoutez un titre ou un lien Spotify après ${settings.commands.request}.`);
        if (entry?.execution.operation === "queue") {
          await this.spotify.control({ operation: "queue", query: match.argument });
          response = "Titre ajouté à la file Spotify.";
        } else {
          const result = await this.add({ query: match.argument, user: event.user, creator: false });
          response = `Demande ajoutée : ${result.entry.track.name} · ${result.entry.track.artists.join(", ")}.`;
        }
      } else if (match.kind === "skip") {
        if (!settings.allowViewerSkip && event.user?.moderator !== true) throw new Error("Seuls les modérateurs peuvent passer le titre avec cette commande.");
        if (entry?.execution.operation === "next") await this.spotify.control({ operation: "next" });
        else await this.skip();
        response = "Titre suivant demandé à Spotify.";
      } else if (match.kind === "nowPlaying") {
        const result = await this.spotify.control({ operation: "now_playing" });
        response = result.playback?.item ? `En lecture : ${result.playback.item.name} · ${result.playback.item.artists.join(", ")}.` : "Aucun titre en lecture transmis par Spotify.";
      } else {
        const queue = this.#state().queue;
        response = queue.length ? `${queue.length} demande(s) ShenPulse : ${queue.slice(0, 3).map((entry) => entry.track.name).join(" · ")}.` : "Aucune demande ShenPulse en attente.";
      }
      this.#assertOwner(scope);
      this.lastResponse = { ok: true, command: match.kind, message: response, timestamp: new Date(this.now()).toISOString(), transport: "local-ui" };
      this.responseOwner = owner; this.#notify();
      return { handled: true, ...this.lastResponse };
    } catch (error) {
      if (this.executionScope() === scope) {
        this.lastResponse = { ok: false, command: match.kind, message: String(error.message || error), timestamp: new Date(this.now()).toISOString(), transport: "local-ui" };
        this.responseOwner = owner; this.#notify();
      }
      return { handled: true, ok: false, message: String(error.message || error), transport: "local-ui" };
    }
  }
}

module.exports = { SongRequestsService, normalizeSongRequestSettings, commandMatch, normalizedArtist, assertTrackAllowed };
