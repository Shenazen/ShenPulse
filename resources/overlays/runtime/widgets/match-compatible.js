"use strict";

/**
 * Secours visuel HTTPS pour les navigateurs qui refusent le pont local.
 * Le poster de l'effet sélectionné est animé pendant huit secondes au maximum.
 * Ce n'est pas une copie de la vidéo : le libellé « Mode compatible » le précise.
 * Aucun effet n'est affiché avant la réception d'un vrai événement de lecture.
 */
function finishMatchCompatiblePlayback(playbackId = "") {
  const state = startMatchCompatiblePlayback.state;
  if (!state || playbackId && state.id !== playbackId) return;
  startMatchCompatiblePlayback.state = null;
  clearTimeout(state.deadline);
  state.node.remove();
  delete document.documentElement.dataset.matchPlaybackMode;
}

function startMatchCompatiblePlayback(request, playbackId) {
  if (!isPublicMatchSource || isCatalogPreview || viewName !== "match" || matchName !== "player") return false;
  const stage = document.getElementById("match-video")?.parentElement;
  if (!stage || !MATCH_VIDEO_NAMES.has(request.match)) return false;
  finishMatchCompatiblePlayback();
  const node = document.createElement("div");
  node.id = "match-compatible-animation";
  node.className = "match-compatible-animation";
  node.dataset.effect = request.match;
  const poster = document.createElement("img");
  poster.alt = MATCH_VIDEO_LABELS[request.match];
  poster.src = mediaUrl(`video/posters/${request.match}-${request.variant}.webp`);
  const label = document.createElement("span");
  label.className = "match-compatible-label";
  label.textContent = "Mode compatible";
  const title = document.createElement("strong");
  title.className = "match-compatible-title";
  title.textContent = MATCH_VIDEO_LABELS[request.match];
  node.append(poster, title, label);
  const state = { id: playbackId, node, poster, deadline: null };
  startMatchCompatiblePlayback.state = state;
  poster.addEventListener("error", () => {
    if (startMatchCompatiblePlayback.state !== state) return;
    // Le libellé de l'effet reste honnête et visible si le poster manque ;
    // pas de chargement infini ni d'image cassée sur le LIVE.
    poster.hidden = true;
    node.classList.add("without-poster");
    document.documentElement.dataset.matchPlaybackError = "poster-unavailable";
  }, { once: true });
  stage.appendChild(node);
  document.documentElement.dataset.matchPlaybackMode = "compatible";
  state.deadline = setTimeout(() => {
    if (startMatchCompatiblePlayback.state === state) finishMatchPlayback(playbackId);
  }, 8000);
  return true;
}

