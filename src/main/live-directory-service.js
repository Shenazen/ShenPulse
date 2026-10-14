"use strict";

const { EventEmitter } = require("node:events");
const { randomUUID } = require("node:crypto");
const { LIVE_DIRECTORY_PATH, LIVE_DIRECTORY_TTL_MS, LIVE_DIRECTORY_LIMIT, LIVE_DIRECTORY_DATABASE_URL,
  localLiveStreams, sanitizeDirectoryRows } = require("../shared/live-directory-protocol");

const WRITE_INTERVAL_MS = 10000;
const HEARTBEAT_MS = 30000;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_SSE_BUFFER = 512000;
const SAFE_UID = /^[A-Za-z0-9_-]{1,128}$/;

class LiveDirectoryService extends EventEmitter {
  constructor({ store, identityProvider, canPublish = () => false, fetchImpl = globalThis.fetch,
    now = Date.now, databaseUrl = LIVE_DIRECTORY_DATABASE_URL, instanceId = randomUUID(),
    timers = { setTimeout, clearTimeout, setInterval, clearInterval } } = {}) {
    super();
    this.store = store;
    this.identityProvider = identityProvider;
    this.canPublish = canPublish;
    this.fetchImpl = fetchImpl;
    this.now = now;
    this.databaseUrl = String(databaseUrl).replace(/\/+$/, "");
    this.instanceId = instanceId;
    this.timers = timers;
    this.running = false;
    this.connected = false;
    this.available = false;
    this.publishing = false;
    this.suspended = false;
    this.entries = Object.create(null);
    this.error = "";
    this.feedError = "";
    this.publicationError = "";
    this.clockOffset = 0;
    this.owned = null;
    this.epoch = 0;
    this.lastTarget = "";
    this.lastWriteAt = -Infinity;
    this.lastConfirmedAt = -Infinity;
    this.lastRemovalAt = -Infinity;
    this.lastPublishedSignature = "";
    this.pending = false;
    this.forceHeartbeat = false;
    this.flushPromise = null;
    this.retryCount = 0;
    this.statusSignature = "";
  }

  status() {
    const ownUid = this.#accountUid();
    const now = this.now() + this.clockOffset;
    const rows = sanitizeDirectoryRows(this.entries, { now, ownUid });
    return { available: this.available, connected: this.connected, publishing: this.publishing && this.now() - this.lastConfirmedAt <= LIVE_DIRECTORY_TTL_MS,
      enabled: this.#enabled(), rows,
      capped: rows.length > LIVE_DIRECTORY_LIMIT || Object.values(this.entries).filter((entry) => entry?.protocolVersion === 1 &&
        Number.isInteger(entry.updatedAt) && entry.updatedAt >= now - LIVE_DIRECTORY_TTL_MS && entry.updatedAt <= now + 30000).length >= LIVE_DIRECTORY_LIMIT,
      error: this.publicationError || this.feedError || "" };
  }

  start() {
    if (this.running) return this.status();
    this.running = true;
    this.suspended = false;
    this.#connectFeed();
    this.pruneTimer = this.#interval(() => this.#changed(), 5000);
    this.heartbeatTimer = this.#interval(() => this.#schedule(true), HEARTBEAT_MS);
    this.sync();
    return this.status();
  }

  sync() {
    const target = this.#eligible() ? this.#accountUid() : "";
    if (target !== this.lastTarget) { this.epoch += 1; this.lastTarget = target; }
    if (this.running) this.#schedule(false);
    this.#changed();
    return this.status();
  }

  resumePublication() {
    this.suspended = false;
    return this.sync();
  }

  async suspendPublication() {
    this.suspended = true;
    this.epoch += 1;
    this.#clearTimeout("publishTimer");
    this.pending = false;
    // Finish the bounded in-flight PUT before removing it: aborting an acknowledged server write
    // could otherwise race a DELETE and recreate the presence after opting out.
    await this.flushPromise?.catch(() => {});
    await this.#removeOwned({ force: true });
    this.#changed();
    return this.status();
  }

  async stop() {
    this.running = false;
    this.epoch += 1;
    this.feedController?.abort();
    this.feedController = null;
    this.#clearTimeout("reconnectTimer");
    this.#clearTimeout("publishTimer");
    for (const key of ["heartbeatTimer", "pruneTimer"]) {
      if (this[key]) this.timers.clearInterval(this[key]);
      this[key] = null;
    }
    await this.suspendPublication();
    this.connected = false;
    this.#changed();
  }

  #state() { return this.store?.getLiveDirectoryState?.() || this.store?.getState?.() || {}; }
  #accountUid() { return String(this.#state().settings?.account?.uid || ""); }
  #enabled() { return this.#state().settings?.liveDirectory?.publishEnabled === true; }
  #eligible() {
    return this.running && !this.suspended && this.#enabled() && this.canPublish() === true &&
      SAFE_UID.test(this.#accountUid()) && Object.keys(localLiveStreams(this.#state())).length > 0;
  }
  #interval(callback, delay) {
    const timer = this.timers.setInterval(callback, delay);
    timer?.unref?.();
    return timer;
  }
  #timeout(callback, delay) {
    const timer = this.timers.setTimeout(callback, delay);
    timer?.unref?.();
    return timer;
  }
  #clearTimeout(key) {
    if (this[key]) this.timers.clearTimeout(this[key]);
    this[key] = null;
  }
  #changed() {
    const status = this.status();
    const signature = JSON.stringify(status);
    if (signature !== this.statusSignature) { this.statusSignature = signature; this.emit("changed", status); }
  }
  #url(uid = "") {
    return new URL(`${this.databaseUrl}/${LIVE_DIRECTORY_PATH}${uid ? `/${encodeURIComponent(uid)}` : ""}.json`);
  }

  #schedule(heartbeat) {
    if (!this.running) return;
    this.pending = true;
    this.forceHeartbeat ||= heartbeat;
    const eligible = this.#eligible();
    const delay = eligible && (!this.owned || this.owned.uid === this.#accountUid())
      ? Math.max(0, this.lastWriteAt + WRITE_INTERVAL_MS - this.now()) : 0;
    if (this.publishTimer && delay !== 0) return;
    this.#clearTimeout("publishTimer");
    this.publishTimer = this.#timeout(() => { this.publishTimer = null; this.#flush(); }, delay);
  }

  #flush() {
    if (this.flushPromise) return this.flushPromise;
    if (!this.pending) return Promise.resolve();
    this.pending = false;
    const heartbeat = this.forceHeartbeat;
    this.forceHeartbeat = false;
    this.flushPromise = this.#publish(heartbeat).catch(() => {
      this.publicationError = "La publication du LIVE est temporairement indisponible.";
      this.#changed();
    }).finally(() => {
      this.flushPromise = null;
      if (this.pending && this.running) this.#schedule(this.forceHeartbeat);
    });
    return this.flushPromise;
  }

  async #publish(heartbeat) {
    if (!this.#eligible()) { await this.#removeOwned(); return; }
    const uid = this.#accountUid();
    if (this.owned && this.owned.uid !== uid) await this.#removeOwned();
    const streams = localLiveStreams(this.#state());
    const signature = JSON.stringify(streams);
    if (!heartbeat && this.publishing && signature === this.lastPublishedSignature) return;
    const epoch = this.epoch;
    // Failed writes/auth refreshes must be throttled too, not just successful heartbeats.
    this.lastWriteAt = this.now();
    const identity = await this.#identity();
    if (!this.#eligible() || this.epoch !== epoch || this.#accountUid() !== uid || identity?.uid !== uid || !identity.idToken) return;
    const url = this.#url(uid);
    url.searchParams.set("auth", identity.idToken);
    // Retain cleanup ownership even when the PUT response is lost after the server accepted it.
    this.owned = { uid, idToken: identity.idToken };
    const response = await this.#request(url, { method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ protocolVersion: 1, instanceId: this.instanceId, updatedAt: { ".sv": "timestamp" }, streams }) });
    const accepted = response.data;
    if (Number.isInteger(accepted?.updatedAt)) this.clockOffset = accepted.updatedAt - this.now();
    this.lastWriteAt = this.now();
    this.lastConfirmedAt = this.now();
    this.lastPublishedSignature = signature;
    this.publishing = true;
    this.publicationError = "";
    if (!this.#eligible() || this.epoch !== epoch || this.#accountUid() !== uid) await this.#removeOwned();
    this.#changed();
  }

  async #request(url, options) {
    const controller = new AbortController();
    const timer = this.#timeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(String(url), { ...options, signal: controller.signal });
      if (!response.ok) throw new Error("Directory request failed");
      const data = await response.json();
      return { data, headers: response.headers };
    } finally { this.timers.clearTimeout(timer); }
  }

  async #identity() {
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(() => this.identityProvider()),
        new Promise((resolve, reject) => { timer = this.#timeout(() => reject(new Error("Directory identity timed out")), REQUEST_TIMEOUT_MS); })]);
    } finally { this.timers.clearTimeout(timer); }
  }

  async #removeOwned({ force = false } = {}) {
    const owned = this.owned;
    if (!owned) { this.publishing = false; return; }
    if (!force && this.now() - this.lastRemovalAt < WRITE_INTERVAL_MS) return;
    this.lastRemovalAt = this.now();
    try {
      let idToken = owned.idToken;
      if (this.#accountUid() === owned.uid && this.canPublish() === true) {
        try {
          const identity = await this.#identity();
          if (identity?.uid === owned.uid && identity.idToken) idToken = identity.idToken;
        } catch { /* The previous token may still be valid for best-effort cleanup. */ }
      }
      const url = this.#url(owned.uid);
      url.searchParams.set("auth", idToken);
      const response = await this.#request(url, { method: "GET", headers: { "X-Firebase-ETag": "true" } });
      const entry = response.data;
      if (entry?.instanceId === this.instanceId) {
        const etag = response.headers.get("etag");
        if (!etag) throw new Error("Missing conditional deletion version");
        const deleted = await this.#conditionalDelete(url, etag);
        if (!deleted) { this.publishing = false; this.owned = null; this.#changed(); return; }
      }
      this.owned = null;
      this.publishing = false;
      this.lastPublishedSignature = "";
      this.publicationError = "";
    } catch {
      this.publishing = false;
      this.publicationError = "La présence expirera automatiquement si sa suppression ne peut pas être confirmée.";
    }
    this.#changed();
  }

  async #conditionalDelete(url, etag) {
    const controller = new AbortController();
    const timer = this.#timeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(String(url), { method: "DELETE", headers: { "If-Match": etag }, signal: controller.signal });
      if (response.status === 412) return false; // A newer instance/heartbeat won the race; never erase it.
      if (!response.ok) throw new Error("Directory deletion failed");
      return true;
    } finally { this.timers.clearTimeout(timer); }
  }

  async #connectFeed() {
    if (!this.running || this.feedController) return;
    const controller = new AbortController();
    this.feedController = controller;
    const connectTimer = this.#timeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const url = this.#url();
      url.searchParams.set("orderBy", JSON.stringify("updatedAt"));
      url.searchParams.set("startAt", String(Math.floor(this.now() + this.clockOffset - LIVE_DIRECTORY_TTL_MS)));
      url.searchParams.set("limitToLast", String(LIVE_DIRECTORY_LIMIT));
      const response = await this.fetchImpl(String(url), { headers: { Accept: "text/event-stream" }, signal: controller.signal });
      this.timers.clearTimeout(connectTimer);
      if (!response.ok || !response.body?.getReader) throw new Error("Directory stream unavailable");
      const serverTime = Date.parse(response.headers.get("date") || "");
      if (Number.isFinite(serverTime)) {
        const correctedOffset = serverTime - this.now();
        const drift = Math.abs(correctedOffset - this.clockOffset);
        this.clockOffset = correctedOffset;
        if (drift > 10000) {
          // A public reader may have a skewed PC clock too. Rebuild the initial cutoff once
          // using the server's HTTP clock instead of hiding all otherwise-valid creators.
          await response.body.cancel().catch(() => {});
          throw new Error("Directory query clock corrected");
        }
      }
      this.connected = true;
      this.feedError = "";
      this.retryCount = 0;
      this.#changed();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let activityTimer = this.#timeout(() => controller.abort(), 65000);
      try {
        while (this.running && !controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          this.timers.clearTimeout(activityTimer);
          activityTimer = this.#timeout(() => controller.abort(), 65000);
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
          if (buffer.length > MAX_SSE_BUFFER) throw new Error("Directory stream exceeded its bound");
          let boundary;
          while ((boundary = buffer.indexOf("\n\n")) !== -1) {
            this.#feedEvent(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);
          }
        }
      } finally {
        this.timers.clearTimeout(activityTimer);
        await reader.cancel().catch(() => {});
      }
    } catch {
      if (this.running) this.feedError = "L’annuaire LIVE est temporairement indisponible.";
    } finally {
      this.timers.clearTimeout(connectTimer);
      if (this.feedController === controller) this.feedController = null;
      this.connected = false;
      this.#changed();
      if (this.running) {
        const delay = Math.min(30000, 1000 * (2 ** Math.min(this.retryCount++, 5)));
        this.reconnectTimer = this.#timeout(() => { this.reconnectTimer = null; this.#connectFeed(); }, delay);
      }
    }
  }

  #feedEvent(frame) {
    let type = "message";
    const lines = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("event:")) type = line.slice(6).trim();
      else if (line.startsWith("data:")) lines.push(line.slice(5).trimStart());
    }
    if (type === "keep-alive" || type === "message") return;
    if (type === "cancel" || type === "auth_revoked") throw new Error("Directory stream was rejected");
    if (!["put", "patch"].includes(type)) return;
    const payload = JSON.parse(lines.join("\n"));
    if (!payload || typeof payload.path !== "string" || payload.path.length > 500) throw new Error("Invalid directory event");
    const segments = payload.path.split("/").filter(Boolean);
    if (segments.length > 5 || segments.some((key) => ["__proto__", "constructor", "prototype"].includes(key))) return;
    if (segments.length && !SAFE_UID.test(segments[0])) return;
    if (type === "put" && !segments.length) {
      this.entries = Object.create(null);
      if (payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)) {
        for (const [key, value] of Object.entries(payload.data)) if (SAFE_UID.test(key)) this.entries[key] = value;
      }
    } else {
      const apply = (path, data) => {
        if (!path.length || path.some((key) => ["__proto__", "constructor", "prototype"].includes(key))) return;
        let parent = this.entries;
        for (const key of path.slice(0, -1)) {
          if (!parent[key] || typeof parent[key] !== "object") parent[key] = Object.create(null);
          parent = parent[key];
        }
        const key = path.at(-1);
        if (data === null) delete parent[key]; else parent[key] = data;
      };
      if (type === "put") apply(segments, payload.data);
      else if (payload.data && typeof payload.data === "object") {
        for (const [key, value] of Object.entries(payload.data)) {
          const path = [...segments, ...key.split("/").filter(Boolean)];
          if (path.length <= 5 && SAFE_UID.test(path[0] || "")) apply(path, value);
        }
      }
    }
    const bounded = Object.entries(this.entries).sort((a, b) => Number(b[1]?.updatedAt || 0) - Number(a[1]?.updatedAt || 0))
      .slice(0, LIVE_DIRECTORY_LIMIT);
    this.entries = Object.assign(Object.create(null), Object.fromEntries(bounded));
    this.available = true;
    this.#changed();
  }
}

module.exports = { LiveDirectoryService, WRITE_INTERVAL_MS, HEARTBEAT_MS };
