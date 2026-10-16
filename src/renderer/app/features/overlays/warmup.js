"use strict";

/**
 * Prépare la première visite sans démarrer de lecteur caché.
 *
 * Le catalogue et les styles sont déjà embarqués/chargés par index.html.
 * Seuls les visuels STATIQUES utilisés par les vrais placeholders sont lus,
 * un par un entre deux périodes d'inactivité. Aucun appel applicatif, iframe,
 * transport LIVE, fichier privé, déchiffrement, son ou vidéo n'est nécessaire.
 */
const OVERLAY_ASSET_WARMUP_LIMIT = 24;
const OVERLAY_ASSET_WARMUP_PIN_LIMIT = 8;
const OVERLAY_ASSET_WARMUP_PIN_PIXELS = 4 * 1024 * 1024;
const overlayAssetWarmup = {
  inputs: null, signature: "", owner: "", generation: 0, disposed: false,
  handle: null, usesIdleCallback: false, active: null,
  definitions: null, definitionIndex: 0, queue: [], planned: new Set(),
  warmed: new Set(), pinned: new Map(), pinnedPixels: 0
};

function overlayAssetWarmupVisible() {
  return typeof rendererVisualsActive === "function"
    ? rendererVisualsActive() : document.visibilityState !== "hidden";
}

/** Uniquement les assets livrés avec ShenPulse : jamais un hôte distant. */
function overlayAssetWarmupSafeUrl(value) {
  try {
    const url = new URL(value, location.href);
    if (url.username || url.password || url.hash) return "";
    const path = decodeURIComponent(url.pathname);
    if (!/\.(?:png|webp|svg)$/i.test(path)) return "";
    if (url.protocol === "file:" && location.protocol === "file:") {
      const mediaRoot = decodeURIComponent(new URL("../../resources/overlays/media/", location.href).pathname);
      const studioRoot = decodeURIComponent(new URL("assets/studio/", location.href).pathname);
      if (url.host || !((path.startsWith(mediaRoot) &&
          /^(?:widgets|video\/posters)\//.test(path.slice(mediaRoot.length))) ||
          (path.startsWith(studioRoot) &&
           /\/(?:overlays|overlay-section-frame|overlay-section-divider)\.webp$/.test(path)))) return "";
    } else {
      if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") return "";
      const localSource = snapshot?.localOverlayUrls?.base || snapshot?.previewOverlayUrls?.base || "";
      const mediaOrigin = localSource ? new URL(localSource).origin : "";
      const studioOrigin = location.protocol === "http:" && location.hostname === "127.0.0.1" ? location.origin : "";
      if (!((url.origin === mediaOrigin && /^\/overlay\/media\/(?:widgets|video\/posters)\//.test(path)) ||
          (url.origin === studioOrigin && /^\/assets\/studio\/(?:overlays|overlay-section-frame|overlay-section-divider)\.webp$/.test(path)))) return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function queueOverlayAssetWarmup(value) {
  const source = overlayAssetWarmupSafeUrl(value);
  if (!source || overlayAssetWarmup.planned.has(source) ||
      overlayAssetWarmup.planned.size >= OVERLAY_ASSET_WARMUP_LIMIT) return;
  overlayAssetWarmup.planned.add(source);
  if (!overlayAssetWarmup.warmed.has(source)) overlayAssetWarmup.queue.push(source);
}

function pauseOverlayAssetWarmup() {
  if (overlayAssetWarmup.handle !== null || overlayAssetWarmup.active) overlayAssetWarmup.generation += 1;
  if (overlayAssetWarmup.handle !== null) {
    if (overlayAssetWarmup.usesIdleCallback) window.cancelIdleCallback?.(overlayAssetWarmup.handle);
    else clearTimeout(overlayAssetWarmup.handle);
    overlayAssetWarmup.handle = null;
  }
  const active = overlayAssetWarmup.active;
  if (!active) return;
  overlayAssetWarmup.active = null;
  clearTimeout(active.timeout);
  active.image.onload = null;
  active.image.onerror = null;
  active.image.removeAttribute("src");
  overlayAssetWarmup.queue.unshift(active.source);
}

function disposeOverlayAssetWarmup() {
  pauseOverlayAssetWarmup();
  overlayAssetWarmup.disposed = true;
  overlayAssetWarmup.queue.length = 0;
  overlayAssetWarmup.definitions = null;
  overlayAssetWarmup.planned.clear();
  overlayAssetWarmup.warmed.clear();
  overlayAssetWarmup.pinned.clear();
  overlayAssetWarmup.pinnedPixels = 0;
  overlayAssetWarmup.inputs = null;
}

function synchronizeOverlayAssetWarmup() {
  if (overlayAssetWarmup.disposed || !snapshot?.state?.settings) return;
  const light = typeof studioLightMode !== "undefined" && studioLightMode;
  const settings = snapshot.state.settings;
  const inputs = [settings.account?.uid || "", settings.overlayToken || "", snapshot.appVersion || "",
    snapshot.overlayUrls, snapshot.localOverlayUrls, snapshot.previewOverlayUrls, settings.overlayConfigs, light];
  if (!overlayAssetWarmup.inputs || inputs.some((value, index) => value !== overlayAssetWarmup.inputs[index])) {
    overlayAssetWarmup.inputs = inputs;
    const signature = JSON.stringify(inputs);
    if (signature !== overlayAssetWarmup.signature) {
      pauseOverlayAssetWarmup();
      const owner = JSON.stringify(inputs.slice(0, 3));
      if (owner !== overlayAssetWarmup.owner) {
        overlayAssetWarmup.warmed.clear();
        preparedOverlayDefinitions = null;
      }
      overlayAssetWarmup.owner = owner;
      overlayAssetWarmup.signature = signature;
      overlayAssetWarmup.pinned.clear();
      overlayAssetWarmup.pinnedPixels = 0;
      overlayAssetWarmup.planned.clear();
      overlayAssetWarmup.queue.length = 0;
      overlayAssetWarmup.definitions = null;
      overlayAssetWarmup.definitionIndex = 0;
    }
  }
  if (!overlayAssetWarmupVisible()) return pauseOverlayAssetWarmup();
  scheduleOverlayAssetWarmup();
}

function scheduleOverlayAssetWarmup() {
  if (overlayAssetWarmup.disposed || overlayAssetWarmup.handle !== null ||
      overlayAssetWarmup.active || !overlayAssetWarmupVisible()) return;
  if (overlayAssetWarmup.definitions && !overlayAssetWarmup.queue.length &&
      overlayAssetWarmup.definitionIndex >= overlayAssetWarmup.definitions.length) return;
  const generation = overlayAssetWarmup.generation;
  const work = (deadline) => {
    if (generation !== overlayAssetWarmup.generation) return;
    overlayAssetWarmup.handle = null;
    if (overlayAssetWarmup.disposed || !overlayAssetWarmupVisible()) return;
    if (deadline && !deadline.didTimeout && deadline.timeRemaining() < 4) return scheduleOverlayAssetWarmup();
    performOverlayAssetWarmupStep();
  };
  overlayAssetWarmup.usesIdleCallback = typeof window.requestIdleCallback === "function";
  overlayAssetWarmup.handle = overlayAssetWarmup.usesIdleCallback
    ? window.requestIdleCallback(work, { timeout: 1500 })
    : setTimeout(work, 100);
}

function performOverlayAssetWarmupStep() {
  if (!overlayAssetWarmup.definitions) {
    // Ce résultat est réutilisé par la vraie galerie, au lieu de recloner les
    // dix-huit manifestes et leurs options pendant sa première ouverture.
    overlayAssetWarmup.definitions = overlayDefinitions();
    if (typeof studioLightMode !== "undefined" && studioLightMode) {
      overlayAssetWarmup.definitionIndex = overlayAssetWarmup.definitions.length;
      return;
    }
    for (const asset of ["overlays", "overlay-section-frame", "overlay-section-divider"]) {
      queueOverlayAssetWarmup(new URL(`assets/studio/${asset}.webp`, location.href));
    }
  }
  if (overlayAssetWarmup.queue.length) return loadOverlayAssetWarmupImage(overlayAssetWarmup.queue.shift());
  const item = overlayAssetWarmup.definitions[overlayAssetWarmup.definitionIndex++];
  if (item) {
    // Un template est inerte : même les images ne chargent qu'après la mise
    // en file contrôlée. Réutiliser le vrai markup évite un second catalogue.
    const template = document.createElement("template");
    template.innerHTML = overlayCardPlaceholder(item, overlayConfig(item.key));
    for (const image of template.content.querySelectorAll("img[src]")) queueOverlayAssetWarmup(image.getAttribute("src"));
  }
  scheduleOverlayAssetWarmup();
}

function loadOverlayAssetWarmupImage(source) {
  const image = new Image();
  const generation = overlayAssetWarmup.generation;
  const active = { source, image, timeout: null };
  overlayAssetWarmup.active = active;
  image.decoding = "async";
  image.fetchPriority = "low";
  const finish = (loaded) => {
    if (overlayAssetWarmup.active !== active || generation !== overlayAssetWarmup.generation) return;
    clearTimeout(active.timeout);
    image.onload = null;
    image.onerror = null;
    overlayAssetWarmup.active = null;
    if (loaded) {
      // Historique et références fortes sont tous deux bornés ; Chromium
      // garde la main sur son cache compressé et peut libérer ses bitmaps.
      if (overlayAssetWarmup.warmed.size >= 64) overlayAssetWarmup.warmed.delete(overlayAssetWarmup.warmed.values().next().value);
      overlayAssetWarmup.warmed.add(source);
      const pixels = image.naturalWidth * image.naturalHeight;
      if (pixels > 0 && overlayAssetWarmup.pinned.size < OVERLAY_ASSET_WARMUP_PIN_LIMIT &&
          overlayAssetWarmup.pinnedPixels + pixels <= OVERLAY_ASSET_WARMUP_PIN_PIXELS) {
        overlayAssetWarmup.pinned.set(source, image);
        overlayAssetWarmup.pinnedPixels += pixels;
      }
    }
    scheduleOverlayAssetWarmup();
  };
  image.onload = () => {
    // Le repli sans decode() conserve le cache d'image normal du navigateur.
    if (typeof image.decode !== "function") return finish(true);
    Promise.resolve().then(() => {
      if (overlayAssetWarmup.active === active && generation === overlayAssetWarmup.generation) return image.decode();
    }).then(() => finish(true), () => finish(true));
  };
  image.onerror = () => finish(false);
  active.timeout = setTimeout(() => { image.removeAttribute("src"); finish(false); }, 3000);
  image.src = source;
}

window.addEventListener("pagehide", disposeOverlayAssetWarmup, { once: true });
window.addEventListener("beforeunload", disposeOverlayAssetWarmup, { once: true });
