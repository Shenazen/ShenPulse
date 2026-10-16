"use strict";

/** Publication temps réel du canal Match dédié.
 * Une seule écriture en vol, état récent coalescé et file d'effets bornée.
 * Le transport/authentification appartient au relais injecté ; ce composant
 * relit explicitement le compte, le profil et les droits avant chaque PATCH.
 */
const crypto = require("node:crypto");
const { readState } = require("../state-projection");
const { addBoundedSet } = require("../../shared/bounded-collection");
const { createMatchRelayMessage, matchMessageFresh, configuredMatchMediaUrls } = require("./match-messages");
const { MATCH_WIDGET_CONTEXT_PATHS, hasPublicMatchWidgetAccess, publicMatchSource, publicMatchWidgetState } = require("./match-widgets");

const MATCH_DELAY_MS = 8;
const MAX_MESSAGES = 1_000;
const MAX_BATCH = 250;
const identity = (state) => JSON.stringify([state.settings?.account?.uid || "", state.session?.profileId || "", state.settings?.tiktok?.roomId || ""]);

class MatchPublication {
  constructor({ store, write, configuration, running, connected, rotating, proAccess, presence, onFailure, scheduleReconnect }) {
    Object.assign(this, { store, write, configuration, running, connected, rotating, proAccess, presence, onFailure, scheduleReconnect });
    this.promise = Promise.resolve();
    this.flushPromise = null;
    this.pendingState = false;
    this.events = [];
    this.seenRequests = new Set();
    this.batchSequence = 0;
    this.timer = null;
    this.publishedSignature = "";
  }

  publish(channel, payload) {
    const context = readState(this.store, MATCH_WIDGET_CONTEXT_PATHS);
    if (!hasPublicMatchWidgetAccess(this.store, context)) return;
    const mediaContext = channel === "match" ? {} : readState(this.store,
      ["settings.backblaze.publicBaseUrl", "customSounds", "customMedia", "settings.matches.automations", "settings.overlayConfigs.wheel"]);
    // Les actions de l'espace actif restent des références de lecture valides
    // après retrait du catalogue ; aucune copie des workspaces inactifs.
    const hasAction = (reaction) => reaction?.type === "action" || reaction?.type === "bundle" &&
      Array.isArray(reaction.reactions) && reaction.reactions.some((row) => row?.type === "action");
    if ((mediaContext.settings?.matches?.automations || []).some((row) => hasAction(row?.reaction))) {
      Object.assign(mediaContext, this.store.getRuleEngineState?.() || readState(this.store,
        ["rules", "session.profileId", "session.game", "game.interactionRulesByPack"]));
      mediaContext.commerce = context.commerce;
      mediaContext.settings = { ...context.settings, ...mediaContext.settings };
    }
    const message = createMatchRelayMessage(channel, payload, {
      baseUrl: this.configuration().publicBaseUrl,
      publicMediaBaseUrl: mediaContext.settings?.backblaze?.publicBaseUrl,
      trustedMediaUrls: configuredMatchMediaUrls(mediaContext)
    });
    if (!message) throw new Error("La réaction Match ne contient pas une animation ou un média public autorisé. Vérifiez sa sélection dans la bibliothèque.");
    const scope = identity(context);
    const key = JSON.stringify([scope, channel, message.payload.requestId || message.payload.playbackId]);
    if (this.seenRequests.has(key)) return;
    addBoundedSet(this.seenRequests, key, MAX_MESSAGES);
    this.events.push({ message, identity: scope });
    this.#boundQueue();
    this.#schedule();
  }

  publishState() {
    this.pendingState = true;
    this.#schedule();
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  clearQueue() {
    this.events = [];
    this.pendingState = false;
    this.seenRequests.clear();
  }

  #boundQueue() {
    if (this.events.length > MAX_MESSAGES) this.events.splice(0, this.events.length - MAX_MESSAGES);
  }

  #schedule() {
    if (this.timer || this.flushPromise || this.rotating()) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch(this.onFailure);
    }, MATCH_DELAY_MS);
    this.timer.unref?.();
  }

  #queue(callback) {
    const publication = this.promise.then(callback);
    this.promise = publication.catch(() => {});
    return publication;
  }

  flush() {
    if (this.flushPromise) return this.flushPromise;
    this.flushPromise = this.#queue(async () => {
      if (!this.running() || this.rotating() || this.configuration().enabled === false) return;
      if (!this.connected()) { this.scheduleReconnect(); return; }
      const context = readState(this.store, MATCH_WIDGET_CONTEXT_PATHS);
      const scope = identity(context);
      const allowed = hasPublicMatchWidgetAccess(this.store, context);
      this.events = this.events.filter((entry) => allowed && entry.identity === scope && matchMessageFresh(entry.message));
      const jobs = this.events.splice(0, MAX_BATCH);
      this.pendingState = false;
      try { await this.#writeLink(true, { jobs }); }
      catch (error) {
        this.pendingState = true;
        this.events.unshift(...jobs);
        this.#boundQueue();
        throw error;
      }
    }).finally(() => {
      this.flushPromise = null;
      if (this.running() && this.connected() && (this.pendingState || this.events.length)) this.#schedule();
    });
    return this.flushPromise;
  }

  writeLink(connected, options = {}) {
    if (!this.#canPublish(connected, options.allowDuringRotation)) return Promise.resolve();
    return this.#queue(() => this.#writeLink(connected, options));
  }

  #canPublish(connected, allowDuringRotation = false) {
    // La présence hors ligne reste publiable après stop. Une présence en ligne
    // exige le relais courant, sauf le handshake initial explicite de connect.
    return !connected || this.running() && this.configuration().enabled !== false &&
      (this.connected() || allowDuringRotation);
  }

  async #writeLink(connected, { force = false, allowDuringRotation = false, jobs = [] } = {}) {
    if (!this.#canPublish(connected, allowDuringRotation) || this.rotating() && !allowDuringRotation) return;
    const channelId = this.configuration().matchChannelId;
    const batch = jobs.length ? {
      id: `${Date.now().toString(36)}-${(++this.batchSequence).toString(36)}-${crypto.randomBytes(5).toString("base64url")}`,
      sequence: this.batchSequence, createdAt: new Date().toISOString()
    } : null;
    let sentSignature = "";
    await this.write(() => {
      sentSignature = "";
      if (!this.#canPublish(connected, allowDuringRotation) || this.rotating() && !allowDuringRotation) return null;
      // Cette fabrique s'exécute après l'authentification et chaque reprise 401.
      const context = readState(this.store, MATCH_WIDGET_CONTEXT_PATHS);
      const config = context.settings?.publicOverlayRelay || {};
      if (config.matchChannelId !== channelId) return null;
      const allowed = hasPublicMatchWidgetAccess(this.store, context);
      const scope = identity(context);
      const messages = connected && allowed ? jobs.filter((entry) => entry.identity === scope && matchMessageFresh(entry.message)).map((entry) => entry.message) : [];
      const matchSource = publicMatchSource(context, this.proAccess(context), allowed);
      const values = {
        sourceChannel: config.channelId, matchSource,
        state: publicMatchWidgetState(context, connected && matchSource.widgetsEnabled),
        presence: this.presence(connected)
      };
      const signature = JSON.stringify([config.databaseUrl, config.uid, channelId,
        values.sourceChannel, values.matchSource, values.state, Boolean(connected)]);
      if (!force && !messages.length && signature === this.publishedSignature) return null;
      sentSignature = signature;
      if (!messages.length && signature === this.publishedSignature) delete values.state;
      if (messages.length) values.lastBatch = { ...batch, contextId: matchSource.contextId, messages };
      return values;
    }, true, channelId);
    if (sentSignature) this.publishedSignature = sentSignature;
  }
}

module.exports = { MatchPublication };
