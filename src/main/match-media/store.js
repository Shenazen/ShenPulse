"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { FORMAT_VERSION, MAX_VIDEO_BYTES, MEDIA_NAME, decryptMedia } = require("./format");
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const CACHE_TTL_MS = 30_000;

/** Lecture privée en mémoire : jamais de WebM déchiffrée sur le disque. */
class ProtectedMatchMediaStore {
  constructor({ directory, maxCacheBytes = MAX_CACHE_BYTES, ttlMs = CACHE_TTL_MS, now = Date.now } = {}) {
    this.directory = path.resolve(directory);
    this.maxCacheBytes = Math.min(MAX_CACHE_BYTES, Math.max(1, maxCacheBytes));
    this.ttlMs = Math.min(CACHE_TTL_MS, Math.max(1, ttlMs));
    this.now = now;
    this.cache = new Map();
    this.cacheBytes = 0;
    this.generation = 0;
    this.operation = Promise.resolve();
    this.manifest = null;
    this.timer = null;
  }

  metadata(name) {
    if (!MEDIA_NAME.test(name)) throw new Error("Vidéo Match inconnue.");
    this.manifest ||= JSON.parse(fs.readFileSync(path.join(this.directory, "manifest.json"), "utf8"));
    const entry = this.manifest.entries?.[name];
    if (this.manifest.version !== FORMAT_VERSION || !entry || entry.file !== `${name}.spm` ||
      !Number.isSafeInteger(entry.size) || entry.size < 1 || entry.size > MAX_VIDEO_BYTES) {
      throw new Error("Vidéo Match protégée indisponible.");
    }
    return { ...entry, name };
  }

  acquire(name) {
    const generation = this.generation;
    const next = this.operation.then(() => this.#acquire(name, generation));
    this.operation = next.catch(() => {});
    return next;
  }

  async #acquire(name, generation) {
    if (generation !== this.generation) throw new Error("Lecture Match révoquée.");
    this.prune();
    let entry = this.cache.get(name);
    if (entry?.stale) throw new Error("Une lecture Match révoquée se termine.");
    if (!entry) {
      const metadata = this.metadata(name);
      if (metadata.size > this.maxCacheBytes) throw new Error("Capacité de lecture Match dépassée.");
      while (this.cacheBytes + metadata.size > this.maxCacheBytes) {
        const oldest = [...this.cache.entries()].filter(([, item]) => item.leases === 0)
          .sort((a, b) => a[1].lastUsedAt - b[1].lastUsedAt)[0];
        if (!oldest) throw new Error("Les lecteurs Match occupent déjà le cache disponible.");
        this.#remove(oldest[0], oldest[1]);
      }
      const encrypted = await fs.promises.readFile(path.join(this.directory, metadata.file));
      let key;
      let bytes;
      try {
        if (generation !== this.generation) throw new Error("Lecture Match révoquée.");
        const stored = JSON.parse(fs.readFileSync(path.join(this.directory, "client-key.json"), "utf8"));
        if (stored.version !== FORMAT_VERSION) throw new Error("Clé de lecture Match incompatible.");
        key = Buffer.from(stored.key, "base64");
        if (key.length !== 32) throw new Error("Clé de lecture Match invalide.");
        bytes = decryptMedia(encrypted, key, name, metadata.size);
      } finally { key?.fill(0); encrypted.fill(0); }
      entry = { bytes, leases: 0, lastUsedAt: this.now(), stale: false };
      this.cache.set(name, entry);
      this.cacheBytes += bytes.length;
    }
    entry.leases += 1;
    entry.lastUsedAt = this.now();
    this.#schedulePrune();
    let released = false;
    return { bytes: entry.bytes, release: () => {
      if (released) return;
      released = true;
      entry.leases -= 1;
      if (entry.stale || this.now() - entry.lastUsedAt >= this.ttlMs) this.#remove(name, entry);
      else this.#schedulePrune();
    } };
  }

  #remove(name, entry) {
    if (entry.leases > 0) { entry.stale = true; return; }
    entry.bytes.fill(0);
    if (this.cache.get(name) === entry) {
      this.cache.delete(name);
      this.cacheBytes -= entry.bytes.length;
    }
  }

  #schedulePrune() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const unleased = [...this.cache.values()].filter((entry) => entry.leases === 0);
    if (!unleased.length) return;
    const deadline = Math.min(...unleased.map((entry) => entry.lastUsedAt + this.ttlMs));
    this.timer = setTimeout(() => { this.timer = null; this.prune(); this.#schedulePrune(); }, Math.max(1, deadline - this.now()));
    this.timer.unref?.();
  }

  prune() {
    for (const [name, entry] of this.cache) {
      if (entry.stale || this.now() - entry.lastUsedAt >= this.ttlMs) this.#remove(name, entry);
    }
  }

  clear() {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const [name, entry] of this.cache) this.#remove(name, entry);
  }

  get hasResources() { return this.cache.size > 0; }
}

module.exports = { ProtectedMatchMediaStore, MAX_CACHE_BYTES, CACHE_TTL_MS };
