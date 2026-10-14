"use strict";
const { safeString } = require("../utils");

const LIBRARY_OPERATIONS = new Set(["queue_list", "list_queue", "search", "playlists", "playlist_tracks", "play_track", "play_tracks", "play_playlist", "previous", "volume", "seek"]);

function spotifyId(value, kind = "playlist") {
  const text = String(value || "").trim();
  const match = text.match(new RegExp(`^(?:spotify:${kind}:|https:\\/\\/open\\.spotify\\.com\\/${kind}\\/)?([A-Za-z0-9]{22})(?:\\?.*)?$`));
  if (!match) throw new Error(`Identifiant Spotify ${kind} invalide.`);
  return match[1];
}

function normalizePlaylist(value = {}) {
  return { id: safeString(value.id, 200), name: safeString(value.name, 300),
    uri: safeString(value.uri, 300), url: safeString(value.external_urls?.spotify, 1000),
    imageUrl: safeString(value.images?.[0]?.url, 2000), owner: safeString(value.owner?.display_name || value.owner?.id, 160),
    total: Number(value.items?.total ?? value.tracks?.total ?? 0), collaborative: value.collaborative === true };
}

function pagination(config, max = 50) {
  const limit = Math.min(max, Math.max(1, Math.floor(Number(config.limit) || Math.min(20, max))));
  const offset = Math.max(0, Math.min(10000, Math.floor(Number(config.offset) || 0)));
  return { limit, offset };
}

/** Endpoints officiels ; pages bornées et routes playlist compatibles au schéma 2026. */
async function runLibraryControl({ operation, config, request, ensureDevice, normalizeTrack }) {
  if (!LIBRARY_OPERATIONS.has(operation)) return undefined;
  if (operation === "queue_list" || operation === "list_queue") {
    const result = await request("/me/player/queue");
    return { ok: true, operation, queue: (result?.queue || []).slice(0, 100).map(normalizeTrack),
      currentlyPlaying: result?.currently_playing ? normalizeTrack(result.currently_playing) : null };
  }
  if (operation === "search") {
    const query = safeString(config.query || config.q, 300).trim();
    if (!query) throw new Error("Indiquez un titre ou un artiste à rechercher.");
    const page = pagination(config, 10);
    const result = await request(`/search?type=track&limit=${page.limit}&offset=${page.offset}&q=${encodeURIComponent(query)}`);
    return { ok: true, operation, tracks: (result?.tracks?.items || []).map(normalizeTrack),
      total: Number(result?.tracks?.total || 0), ...page };
  }
  if (operation === "playlists") {
    const page = pagination(config);
    const result = await request(`/me/playlists?limit=${page.limit}&offset=${page.offset}`);
    return { ok: true, operation, playlists: (result?.items || []).filter(Boolean).map(normalizePlaylist),
      total: Number(result?.total || 0), ...page };
  }
  if (operation === "playlist_tracks") {
    const playlistId = spotifyId(config.playlistId || config.id);
    const page = pagination(config);
    let result;
    try { result = await request(`/playlists/${playlistId}/items?limit=${page.limit}&offset=${page.offset}`); }
    catch (error) {
      // Les applications déjà en quota étendu peuvent encore employer l'ancienne route.
      // Ne jamais contourner un refus 401/403 ou une limite 429.
      if (error.statusCode !== 404) throw error;
      result = await request(`/playlists/${playlistId}/tracks?limit=${page.limit}&offset=${page.offset}`);
    }
    return { ok: true, operation, tracks: (result?.items || []).map((entry) => entry?.item || entry?.track).filter((track) => track?.uri?.startsWith("spotify:track:")).map(normalizeTrack),
      total: Number(result?.total || 0), ...page };
  }
  if (operation === "previous") {
    await ensureDevice();
    await request("/me/player/previous", { method: "POST" });
  } else if (operation === "volume") {
    const volume = Number(config.volume ?? config.percent);
    if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw new Error("Le volume Spotify doit être compris entre 0 et 100.");
    await ensureDevice();
    await request(`/me/player/volume?volume_percent=${Math.round(volume)}`, { method: "PUT" });
    return { ok: true, operation, volume: Math.round(volume) };
  } else if (operation === "seek") {
    const position = Number(config.positionMs ?? config.position);
    if (!Number.isFinite(position) || position < 0) throw new Error("La position de lecture est invalide.");
    await ensureDevice();
    await request(`/me/player/seek?position_ms=${Math.floor(position)}`, { method: "PUT" });
  } else if (operation === "play_playlist") {
    const playlistId = spotifyId(config.playlistId || config.id || config.uri);
    await ensureDevice();
    await request("/me/player/play", { method: "PUT", body: { context_uri: `spotify:playlist:${playlistId}` } });
  } else {
    const values = Array.isArray(config.uris) ? config.uris.slice(0, 50) : [config.uri || config.track];
    if (!values.length) throw new Error("Choisissez au moins un titre Spotify.");
    const uris = values.map((uri) => `spotify:track:${spotifyId(uri, "track")}`);
    await ensureDevice();
    await request("/me/player/play", { method: "PUT", body: { uris } });
  }
  return { ok: true, operation };
}

module.exports = { runLibraryControl, normalizePlaylist, spotifyId, LIBRARY_OPERATIONS };
