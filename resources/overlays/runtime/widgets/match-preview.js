"use strict";

/** Aperçus locaux : poster gratuit, ticket Pro et lecture muette en mémoire.
 * Aucun chemin vidéo brut ni adresse distante n'est accepté. Le changement
 * de modèle annule la requête précédente avant de pouvoir charger un média.
 */
function stopProtectedMatchPreview(video) {
  if (typeof stopMatchVideoAudio === "function") stopMatchVideoAudio(video);
  video.matchPreviewRevision = (video.matchPreviewRevision || 0) + 1;
  video.matchPreviewController?.abort();
  video.matchPreviewController = null;
  clearTimeout(video.matchPreviewDeadline);
  video.matchPreviewDeadline = null;
}

async function startProtectedMatchPreview(video, request, previewKey) {
  stopProtectedMatchPreview(video);
  const revision = video.matchPreviewRevision;
  const current = () => video.isConnected !== false && video.matchPreviewRevision === revision &&
    video.dataset.previewSource === previewKey;
  video.pause();
  video.removeAttribute("src");
  video.muted = true;
  video.playsInline = true;
  video.poster = mediaUrl(`video/posters/${request.match}-${request.variant}.webp`);
  video.dataset.matchPreviewStatus = "poster";
  video.parentElement?.classList.add("has-video");
  video.load();
  // Les aperçus statiques et le catalogue HTTPS n'appellent jamais la boucle
  // locale : pas de vidéo déchiffrée inutile, ni de requête inter-origines.
  if (isStaticPreview || !token || location.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(location.hostname)) return;
  const controller = new AbortController();
  video.matchPreviewController = controller;
  const deadline = setTimeout(() => controller.abort(), 6000);
  video.matchPreviewDeadline = deadline;
  const query = new URLSearchParams({ ...request, token });
  try {
    const response = await fetch(`/match-preview/ticket?${query}`, {
      signal: controller.signal, cache: "no-store", credentials: "same-origin"
    });
    if (!current() || controller.signal.aborted) return;
    if (!response.ok) {
      video.dataset.matchPreviewStatus = response.status === 403 ? "pro-required" : "unavailable";
      return;
    }
    const ticket = await response.json();
    if (!current() || controller.signal.aborted) return;
    const target = new URL(ticket.url, location.href);
    const expiresAt = typeof ticket.expiresAt === "string" ? Date.parse(ticket.expiresAt) : Number(ticket.expiresAt);
    if (target.origin !== location.origin || target.username || target.password ||
        target.search || target.hash || !/^\/match-media\/[a-zA-Z0-9_-]{24,128}$/.test(target.pathname) ||
        !Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + 95000) {
      video.dataset.matchPreviewStatus = "unavailable";
      return;
    }
    video.dataset.matchPreviewStatus = "ready";
    video.src = target.toString();
    video.load();
  } catch {
    if (current()) video.dataset.matchPreviewStatus = "unavailable";
  } finally {
    clearTimeout(deadline);
    if (current()) {
      video.matchPreviewDeadline = null;
      video.matchPreviewController = null;
    }
  }
}
