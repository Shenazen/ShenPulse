"use strict";

/** Couches personnalisées du lecteur Matchs : vidéo/image et sons bornés.
 * Ce module ne joue rien au chargement et partage uniquement les contrats
 * de configuration et de diagnostic du lecteur principal.
 */

/** URL du média choisi par l'utilisateur, jamais du HTML ni un schéma actif. */
function matchReactionMediaUrl(value) {
  try {
    const url = new URL(String(value || "").trim(), location.href);
    return String(value || "").trim() && ["http:", "https:", "blob:"].includes(url.protocol)
      && !url.username && !url.password ? url.toString() : "";
  } catch { return ""; }
}

function finishMatchMediaPlayback(playbackId = "") {
  const state = playMatchMedia.state;
  if (!state || playbackId && state.id !== playbackId) return;
  playMatchMedia.state = null;
  clearTimeout(state.deadline);
  clearTimeout(state.duration);
  if (state.node.tagName === "VIDEO") {
    stopMatchVideoAudio(state.node);
    state.node.pause(); state.node.removeAttribute("src"); state.node.load();
  }
  state.node.remove();
}

/** Vidéo/image choisie : couche indépendante de l'animation premium. */
function playMatchMedia(payload = {}) {
  if (viewName !== "match" || matchName !== "player") return false;
  const url = matchReactionMediaUrl(payload.mediaUrl);
  const stage = document.getElementById("match-video")?.parentElement;
  if (!url || !stage) { setMatchPlaybackDiagnostic("media-unavailable"); return false; }
  const id = String(payload.playbackId || payload.id || "");
  if (id && matchPlaybackRequestIds.has(`media:${id}`)) return false;
  if (id) {
    matchPlaybackRequestIds.add(`media:${id}`);
    if (matchPlaybackRequestIds.size > 500) matchPlaybackRequestIds.delete(matchPlaybackRequestIds.values().next().value);
  }
  finishMatchMediaPlayback();
  setMatchPlaybackDiagnostic();
  const isVideo = /\.(?:mp4|webm|ogg|mov|m4v)(?:[?#]|$)/i.test(url);
  const node = document.createElement(isVideo ? "video" : "img");
  node.id = "match-custom-media";
  Object.assign(node.style, { position: "absolute", inset: "0", width: "100%", height: "100%",
    objectFit: payload.fit === "cover" ? "cover" : "contain", pointerEvents: "none", zIndex: "4" });
  const state = { id, node, deadline: null, duration: null };
  playMatchMedia.state = state;
  const fail = () => {
    if (playMatchMedia.state !== state) return;
    setMatchPlaybackDiagnostic("media-unavailable"); finishMatchMediaPlayback(id);
  };
  const ready = () => {
    if (playMatchMedia.state !== state) return;
    clearTimeout(state.deadline);
    state.duration = setTimeout(() => finishMatchMediaPlayback(id),
      Math.min(60000, Math.max(500, Number(payload.durationMs) || 5000)));
    if (isVideo) playMatchVideo(node, { isCurrent: () => playMatchMedia.state === state, onFailure: fail });
  };
  node.addEventListener("error", fail, { once: true });
  node.addEventListener(isVideo ? "canplay" : "load", ready, { once: true });
  if (isVideo) {
    node.playsInline = true; node.loop = false;
    node.addEventListener("ended", () => {
      if (playMatchMedia.state === state) finishMatchMediaPlayback(id);
    }, { once: true });
  }
  stage.appendChild(node);
  state.deadline = setTimeout(fail, 10000);
  node.src = url;
  if (isVideo) node.load();
  return true;
}

function stopMatchAudio() {
  const state = playMatchAudio.state;
  playMatchAudio.state = null;
  playMatchAudio.queue = [];
  if (!state) return;
  clearTimeout(state.deadline);
  state.audio.pause(); state.audio.removeAttribute("src"); state.audio.load();
}

/** Une seule piste sonore, file bornée et arrêt immédiat lors de révocation. */
function playMatchAudio(payload = {}) {
  if (viewName !== "match" || matchName !== "player") return false;
  const url = matchReactionMediaUrl(payload.url);
  if (!url) { setMatchPlaybackDiagnostic("audio-unavailable"); return false; }
  const id = String(payload.playbackId || "");
  if (id && matchPlaybackRequestIds.has(`audio:${id}`)) return false;
  if (id) {
    matchPlaybackRequestIds.add(`audio:${id}`);
    if (matchPlaybackRequestIds.size > 500) matchPlaybackRequestIds.delete(matchPlaybackRequestIds.values().next().value);
  }
  playMatchAudio.queue ||= [];
  if (playMatchAudio.state) {
    if (playMatchAudio.queue.length >= 16) playMatchAudio.queue.shift();
    playMatchAudio.queue.push({ ...payload, queuedAtMs: Date.now() });
    return true;
  }
  const audio = new Audio(url), state = { audio, deadline: null };
  playMatchAudio.state = state;
  audio.volume = Math.min(1, Math.max(0, Number(payload.volume ?? 1)));
  audio.preload = "auto";
  const complete = (failed = false) => {
    if (playMatchAudio.state !== state) return;
    clearTimeout(state.deadline);
    playMatchAudio.state = null;
    audio.pause(); audio.removeAttribute("src"); audio.load();
    if (failed) setMatchPlaybackDiagnostic("audio-unavailable");
    let next;
    while (playMatchAudio.queue.length) {
      const candidate = playMatchAudio.queue.shift();
      if (Date.now() - candidate.queuedAtMs <= 15000) { next = candidate; break; }
    }
    if (next) {
      // Le passage en file a déjà réclamé l'identifiant anti-doublon.
      if (next.playbackId) matchPlaybackRequestIds.delete(`audio:${next.playbackId}`);
      playMatchAudio(next);
    }
  };
  audio.addEventListener("ended", () => complete(), { once: true });
  audio.addEventListener("error", () => complete(true), { once: true });
  state.deadline = setTimeout(() => complete(true), 60000);
  audio.play().catch(() => complete(true));
  return true;
}


