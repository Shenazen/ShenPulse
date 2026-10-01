"use strict";

const fs = require("node:fs");
const path = require("node:path");
const overlayCatalog = require("../../resources/overlays/overlay-catalog");

const RETRYABLE_CLEAR_ERRORS = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);

function safeFilePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveMatchVideo(resourcesDirectory, incoming = {}) {
  const key = String(incoming.key || "").trim();
  const definition = overlayCatalog.definition(key);
  if (!definition || definition.previewKind !== "match" || !definition.match) {
    throw new Error("Cette animation Match est introuvable.");
  }

  const options = new Map(definition.options || []);
  const variant = String(
    incoming.variant || definition.defaultOption || "tikcontrol"
  ).trim();
  if (!options.has(variant)) {
    throw new Error("Ce design vidéo n’est pas disponible pour ce Match.");
  }

  const mediaDirectory = path.resolve(
    resourcesDirectory,
    "overlays",
    "media",
    "video"
  );
  const sourcePath = path.resolve(
    mediaDirectory,
    `${definition.match}-${variant}.webm`
  );
  if (path.dirname(sourcePath) !== mediaDirectory || !fs.existsSync(sourcePath)) {
    throw new Error("Le fichier vidéo de ce Match est indisponible.");
  }

  const variantLabel = options.get(variant);
  return {
    key,
    match: definition.match,
    name: definition.name,
    variant,
    variantLabel,
    sourcePath,
    defaultFileName: `ShenPulse-${safeFilePart(definition.name)}-${safeFilePart(variantLabel)}.webm`
  };
}

class MatchVideoCache {
  constructor({
    resourcesDirectory,
    cacheDirectory,
    hasAccess,
    removeDirectory = fs.promises.rm
  }) {
    this.resourcesDirectory = path.resolve(resourcesDirectory);
    this.cacheDirectory = path.resolve(cacheDirectory);
    this.hasAccess = hasAccess;
    this.removeDirectory = removeDirectory;
    this.monitor = null;
    this.operation = Promise.resolve();
  }

  runExclusive(callback) {
    const next = this.operation.then(callback, callback);
    this.operation = next.catch(() => {});
    return next;
  }

  assertSafeCacheDirectory() {
    if (
      path.basename(this.cacheDirectory).toLowerCase() !== "match-videos" ||
      path.basename(path.dirname(this.cacheDirectory)).toLowerCase() !== "shenpulse"
    ) {
      throw new Error("Le dossier temporaire des vidéos Match est invalide.");
    }
  }

  async clearUnlocked({ tolerateBusy = false } = {}) {
    this.assertSafeCacheDirectory();
    try {
      await this.removeDirectory(this.cacheDirectory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 200
      });
      return true;
    } catch (error) {
      if (tolerateBusy && RETRYABLE_CLEAR_ERRORS.has(error?.code)) {
        return false;
      }
      throw error;
    }
  }

  clear() {
    return this.runExclusive(() => this.clearUnlocked({ tolerateBusy: true }));
  }

  reconcile() {
    return this.runExclusive(async () => {
      if (this.hasAccess()) return { allowed: true, cleared: false };
      const cleared = await this.clearUnlocked({ tolerateBusy: true });
      return cleared
        ? { allowed: false, cleared: true }
        : { allowed: false, cleared: false, pending: true };
    });
  }

  prepare(incoming = {}) {
    return this.runExclusive(async () => {
      if (!this.hasAccess()) {
        await this.clearUnlocked({ tolerateBusy: true });
        throw new Error(
          "Un abonnement Pro ou Premium actif est requis pour préparer cette vidéo."
        );
      }
      const video = resolveMatchVideo(this.resourcesDirectory, incoming);
      this.assertSafeCacheDirectory();
      await fs.promises.mkdir(this.cacheDirectory, { recursive: true });
      const filePath = path.join(this.cacheDirectory, video.defaultFileName);
      await fs.promises.copyFile(video.sourcePath, filePath);
      return {
        filePath,
        fileName: path.basename(filePath),
        key: video.key,
        variant: video.variant,
        temporary: true
      };
    });
  }

  startMonitoring(intervalMs = 15000) {
    if (this.monitor) return;
    this.monitor = setInterval(() => {
      this.reconcile().catch(() => {});
    }, Math.max(1000, Number(intervalMs) || 15000));
    this.monitor.unref?.();
  }

  dispose() {
    if (!this.monitor) return;
    clearInterval(this.monitor);
    this.monitor = null;
  }
}

module.exports = {
  MatchVideoCache,
  resolveMatchVideo,
  safeFilePart
};
