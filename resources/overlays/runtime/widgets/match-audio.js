"use strict";

/**
 * Son natif des vidéos Matchs : actif sur la vraie source, muet dans le catalogue.
 * Un refus d'autoplay sonore conserve le visuel, mais signale explicitement le
 * son coupé. Le bouton réessaie dans le geste utilisateur, jamais au repos.
 * Aucun timer, boucle de rendu ou média supplémentaire n'est créé ici.
 */
(function exposeMatchVideoAudio(globalScope) {
  const activeVideos = new Map();
  let enableButton = null;

  function soundSettings() {
    const preview = typeof isCatalogPreview !== "undefined" && isCatalogPreview;
    const enabled = typeof overlaySoundEnabled === "undefined" || overlaySoundEnabled;
    const rawVolume = typeof parameters !== "undefined" ? parameters.get("soundVolume") : null;
    const parsed = rawVolume === null || String(rawVolume).trim() === "" ? 1 : Number(rawVolume) / 100;
    const volume = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1;
    const muted = Boolean(preview || !enabled);
    return { muted, volume, audible: !muted && volume > 0 };
  }

  function sourceOf(video) {
    return String(video?.getAttribute?.("src") || "").trim();
  }

  function current(state) {
    if (!state.active || activeVideos.get(state.video) !== state ||
        state.video.isConnected === false || state.video.ended ||
        !sourceOf(state.video) || sourceOf(state.video) !== state.source) return false;
    try { return state.isCurrent() !== false; } catch { return false; }
  }

  function removeState(state) {
    state.active = false;
    state.attempt += 1;
    if (activeVideos.get(state.video) !== state) return;
    activeVideos.delete(state.video);
    delete state.video.dataset.matchAudioError;
  }

  function updateNotice() {
    for (const state of activeVideos.values()) if (!current(state)) removeState(state);
    const blocked = [...activeVideos.values()].filter((state) => state.blocked);
    const root = globalScope.document?.documentElement;
    if (!blocked.length) {
      enableButton?.remove();
      enableButton = null;
      if (root) delete root.dataset.matchAudioError;
      return;
    }
    if (root) root.dataset.matchAudioError = "audio-autoplay-refused";
    if (enableButton?.isConnected) return;
    const document = globalScope.document;
    if (!document) return;
    enableButton = document.createElement("button");
    enableButton.id = "match-enable-audio";
    enableButton.type = "button";
    enableButton.textContent = "Activer le son";
    enableButton.title = "Le navigateur a bloqué le son des vidéos de matchs.";
    enableButton.setAttribute("aria-label", "Activer le son des vidéos de matchs");
    Object.assign(enableButton.style, { position: "absolute", bottom: "18px", left: "18px",
      zIndex: "10", padding: "8px 12px", border: "1px solid rgba(196,132,252,.65)",
      borderRadius: "9px", background: "rgba(22,12,37,.94)", color: "#fff",
      font: "14px/1.4 sans-serif", cursor: "pointer", pointerEvents: "auto" });
    enableButton.addEventListener("click", () => {
      // Pas de await avant play() : les appels conservent le geste utilisateur.
      for (const state of [...activeVideos.values()]) {
        if (!current(state)) { removeState(state); continue; }
        if (state.blocked && soundSettings().audible) attemptPlay(state, false);
      }
      updateNotice();
    });
    (blocked[0].video.parentElement || document.body)?.appendChild(enableButton);
  }

  function fail(state) {
    if (!current(state)) { removeState(state); updateNotice(); return false; }
    removeState(state);
    updateNotice();
    state.onFailure("autoplay-refused");
    return false;
  }

  function attemptPlay(state, forceMuted) {
    if (!current(state)) { removeState(state); updateNotice(); return Promise.resolve(false); }
    const settings = soundSettings();
    const muted = forceMuted || settings.muted;
    const attempt = ++state.attempt;
    state.video.volume = settings.volume;
    state.video.defaultMuted = muted;
    if (muted) state.video.setAttribute("muted", "");
    else state.video.removeAttribute("muted");
    state.video.muted = muted;
    const stillCurrent = () => current(state) && state.attempt === attempt;
    const rejected = (error) => {
      if (!stillCurrent()) {
        if (!current(state)) { removeState(state); updateNotice(); }
        return false;
      }
      if (!muted && settings.audible && error?.name === "NotAllowedError") {
        state.blocked = true;
        state.video.dataset.matchAudioError = "audio-autoplay-refused";
        updateNotice();
        return attemptPlay(state, true);
      }
      // Une erreur de décodeur/réseau n'est pas un refus sonore : ne pas
      // masquer l'échec en relançant gratuitement une vidéo muette.
      return fail(state);
    };
    let playback;
    try { playback = state.video.play(); }
    catch (error) { return Promise.resolve(rejected(error)); }
    return Promise.resolve(playback).then(() => {
      if (!stillCurrent()) {
        if (!current(state)) { removeState(state); updateNotice(); }
        return false;
      }
      if (!muted) {
        state.blocked = false;
        delete state.video.dataset.matchAudioError;
        updateNotice();
      }
      return true;
    }, rejected);
  }

  function stopMatchVideoAudio(video) {
    const state = activeVideos.get(video);
    if (state) removeState(state);
    updateNotice();
  }

  function playMatchVideo(video, { isCurrent = () => true, onFailure = () => {} } = {}) {
    stopMatchVideoAudio(video);
    const source = sourceOf(video);
    if (!video || !source || video.isConnected === false) return Promise.resolve(false);
    const state = { video, source, isCurrent, onFailure, active: true, blocked: false, attempt: 0 };
    activeVideos.set(video, state);
    return attemptPlay(state, false);
  }

  globalScope.playMatchVideo = playMatchVideo;
  globalScope.stopMatchVideoAudio = stopMatchVideoAudio;
  if (typeof module !== "undefined" && module.exports) module.exports = { playMatchVideo, stopMatchVideoAudio };
})(typeof globalThis !== "undefined" ? globalThis : window);
