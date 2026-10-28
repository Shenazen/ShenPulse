"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { SpotifyService, normalizeTrack } = require("../src/main/spotify-service");
const { spotifyId, runLibraryControl } = require("../src/main/spotify/library-controls");

const TRACK_ID = "4uLU6hMCjMI75M1A2tKUQC";
const PLAYLIST_ID = "37i9dQZF1DXcBWIGoYBM5M";
const TRACK = { id: TRACK_ID, uri: `spotify:track:${TRACK_ID}`, name: "Test", artists: [{ name: "Artiste" }], duration_ms: 180000, album: { name: "Album", images: [{ url: "https://i.scdn.co/image/test-cover" }] } };

function fixture(t, responder = () => ({})) {
  const settings = { refreshTokenSecretId: "refresh", accessTokenSecretId: "access", expiresAt: Date.now() + 3_600_000, account: null };
  const state = { settings: { account: { uid: "owner" }, spotify: settings } };
  const secrets = { access: "dummy-access", refresh: "dummy-refresh" };
  const calls = [];
  t.mock.method(global, "fetch", async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const result = await responder(String(url), options);
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), { status: 200, headers: { "content-type": "application/json" } });
  });
  const store = { getState: () => state, getActiveAccountUid: () => "owner", getSecret: (id) => secrets[id] || "", setSecret: (id, value) => { secrets[id] = value; return id; },
    set: (key, value) => {
      assert.ok(["settings.spotify", "settings.spotify.songRequests"].includes(key));
      if (key === "settings.spotify") state.settings.spotify = value;
      else state.settings.spotify.songRequests = value;
    }, mutate: (mutator) => mutator(state), mutateRuntime: (mutator) => mutator(state) };
  return { calls, settings, state, service: new SpotifyService({ store, notifyRenderer: () => {} }) };
}

test("recherche officielle : limite dix, pagination et pochettes normalisées", async (t) => {
  const f = fixture(t, () => ({ tracks: { items: [TRACK], total: 26 } }));
  const result = await f.service.control({ operation: "search", query: "titre & artiste", limit: 100, offset: 10 });
  const url = new URL(f.calls[0].url);
  assert.equal(url.pathname, "/v1/search"); assert.equal(url.searchParams.get("limit"), "10");
  assert.equal(url.searchParams.get("offset"), "10"); assert.equal(url.searchParams.get("q"), "titre & artiste");
  assert.equal(result.tracks[0].imageUrl, "https://i.scdn.co/image/test-cover");
  assert.equal(result.total, 26);
});

test("file Spotify native : lecture seule et normalisation du morceau en cours", async (t) => {
  const f = fixture(t, () => ({ queue: [TRACK], currently_playing: TRACK }));
  const result = await f.service.control({ operation: "queue_list" });
  assert.equal(f.calls.length, 1); assert.match(f.calls[0].url, /\/me\/player\/queue$/);
  assert.equal(f.calls[0].options.method, "GET");
  assert.equal(result.queue[0].name, "Test"); assert.equal(result.currentlyPlaying.uri, TRACK.uri);
});

test("playlists propres puis items : schéma moderne item et ancien track compatibles", async (t) => {
  const f = fixture(t, (url) => url.includes("/me/playlists")
    ? { items: [{ id: PLAYLIST_ID, name: "Liste", images: [{ url: "https://cover.test/list" }], items: { total: 3 }, owner: { display_name: "Créateur" } }], total: 1 }
    : { items: [{ item: TRACK }, { track: TRACK }, { item: { uri: "spotify:episode:ignored" } }], total: 3 });
  const playlists = await f.service.control({ operation: "playlists" });
  assert.equal(playlists.playlists[0].total, 3); assert.equal(playlists.playlists[0].owner, "Créateur");
  const tracks = await f.service.control({ operation: "playlist_tracks", playlistId: PLAYLIST_ID });
  assert.match(f.calls[1].url, new RegExp(`/playlists/${PLAYLIST_ID}/items`));
  assert.equal(tracks.tracks.length, 2);
});

test("refus de playlist 403 explicite, aucun contournement vers une autre route", async (t) => {
  const f = fixture(t, () => new Response(JSON.stringify({ error: { message: "Missing scope" } }), { status: 403 }));
  await assert.rejects(f.service.control({ operation: "playlist_tracks", playlistId: PLAYLIST_ID }), /Premium, permissions/);
  assert.equal(f.calls.length, 1);
});

test("contrôles de lecture : titres, playlist, précédent, volume et position avec méthodes API", async (t) => {
  const f = fixture(t, (url) => url.endsWith("/devices") ? { devices: [{ id: "device", is_active: true, is_restricted: false }] } : new Response(null, { status: 204 }));
  await f.service.control({ operation: "play_tracks", uris: [TRACK.uri] });
  await f.service.control({ operation: "play_playlist", playlistId: PLAYLIST_ID });
  await f.service.control({ operation: "previous" });
  await f.service.control({ operation: "volume", volume: 33 });
  await f.service.control({ operation: "seek", positionMs: 1200 });
  const writes = f.calls.filter((call) => call.options.method !== "GET");
  assert.deepEqual(writes.map((call) => call.options.method), ["PUT", "PUT", "POST", "PUT", "PUT"]);
  assert.deepEqual(JSON.parse(writes[0].options.body), { uris: [TRACK.uri] });
  assert.deepEqual(JSON.parse(writes[1].options.body), { context_uri: `spotify:playlist:${PLAYLIST_ID}` });
  assert.match(writes[3].url, /volume_percent=33/); assert.match(writes[4].url, /position_ms=1200/);
});

test("les entrées invalides ne provoquent aucune requête ni transfert d’appareil", async (t) => {
  const f = fixture(t);
  for (const config of [{ operation: "volume", volume: 101 }, { operation: "seek", positionMs: -1 }, { operation: "play_track", uri: "https://evil.test" }, { operation: "play_playlist", playlistId: "../../secret" }]) {
    await assert.rejects(f.service.control(config));
  }
  assert.equal(f.calls.length, 0);
});

test("aucun appareil contrôlable : pas de lecture envoyée à un appareil restreint", async (t) => {
  const f = fixture(t, () => ({ devices: [{ id: "restricted", is_active: true, is_restricted: true }] }));
  await assert.rejects(f.service.control({ operation: "play_track", uri: TRACK.uri }), /Ouvrez Spotify/);
  assert.equal(f.calls.length, 1);
});

test("le rafraîchissement du jeton est partagé entre les requêtes parallèles", async (t) => {
  const f = fixture(t, (url) => url.includes("/api/token") ? { access_token: "new-dummy-access", expires_in: 3600, scope: "user-read-playback-state playlist-read-private" }
    : url.endsWith("/me") ? { id: "profile" }
      : url.endsWith("/devices") ? { devices: [] } : { is_playing: false, item: TRACK });
  f.settings.expiresAt = 0;
  const status = await f.service.status();
  assert.equal(f.calls.filter((call) => call.url.includes("/api/token")).length, 1);
  assert.equal(status.connected, true); assert.equal(status.playback.item.name, "Test");
  assert.deepEqual(status.scopes, ["user-read-playback-state", "playlist-read-private"]);
});

test("une réponse profil lente ne réécrit pas les demandes et réglages modifiés entre-temps", async (t) => {
  let releaseProfile;
  let profileStarted;
  const profileResponse = new Promise((resolve) => { releaseProfile = resolve; });
  const profileRequest = new Promise((resolve) => { profileStarted = resolve; });
  t.after(() => releaseProfile({ id: "profile" }));
  const f = fixture(t, (url) => {
    if (url.includes("/api/token")) return { access_token: "new-dummy-access", expires_in: 3600, scope: "playlist-read-private" };
    if (url.endsWith("/me")) { profileStarted(); return profileResponse; }
    return url.endsWith("/devices") ? { devices: [] } : { is_playing: false, item: TRACK };
  });
  f.settings.expiresAt = 0;
  f.settings.requestQueue = [{ id: "removed", track: normalizeTrack(TRACK) }, { id: "kept", track: normalizeTrack(TRACK) }];
  const pending = f.service.status();
  await profileRequest;
  await f.service.control({ operation: "requests_remove", id: "removed" });
  await f.service.control({ operation: "requests_settings", settings: { enabled: true, maxQueue: 17, blockedArtists: ["Artiste interdit"] } });
  releaseProfile({ id: "profile" });
  const status = await pending;
  assert.equal(status.connected, true);
  assert.deepEqual(status.songRequests.queue.map((row) => row.id), ["kept"]);
  assert.equal(status.songRequests.settings.enabled, true);
  assert.equal(status.songRequests.settings.maxQueue, 17);
  assert.deepEqual(status.songRequests.settings.blockedArtists, ["Artiste interdit"]);
  assert.deepEqual(f.state.settings.spotify.requestQueue.map((row) => row.id), ["kept"]);
  assert.equal(f.state.settings.spotify.account.id, "profile");
  assert.deepEqual(status.scopes, ["playlist-read-private"]);
});

test("un double refus 401 n’affiche jamais une connexion Spotify fictive", async (t) => {
  const f = fixture(t, (url) => url.includes("/api/token") ? { access_token: "bad-token", expires_in: 3600 }
    : url.endsWith("/me") ? { id: "profile" } : new Response(JSON.stringify({ error: { message: "Invalid token" } }), { status: 401 }));
  const status = await f.service.status();
  assert.equal(status.connected, false); assert.match(status.message, /Invalid token/);
});

test("un jeton de renouvellement révoqué n’affiche jamais une connexion fictive", async (t) => {
  const f = fixture(t, () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "Refresh token revoked" }), { status: 400 }));
  f.settings.expiresAt = 0;
  const status = await f.service.status();
  assert.equal(status.connected, false);
  assert.match(status.message, /Reconnectez votre compte Spotify/);
  assert.equal(f.calls.length, 1);
});

test("une déconnexion en cours de statut ne restitue ni anciens appareils ni lecture", async (t) => {
  const f = fixture(t, (url) => {
    f.state.settings.spotify = { ...f.state.settings.spotify, refreshTokenSecretId: "", accessTokenSecretId: "", account: null };
    return url.endsWith("/devices") ? { devices: [{ id: "old-device", is_active: true }] } : { item: TRACK, is_playing: true };
  });
  const status = await f.service.status();
  assert.equal(status.connected, false);
  assert.deepEqual(status.devices, []);
  assert.equal(status.playback, null);
});

test("les IDs Spotify sont validés, aucune URL arbitraire et aucune route privée", async () => {
  assert.equal(spotifyId(`https://open.spotify.com/playlist/${PLAYLIST_ID}?si=x`), PLAYLIST_ID);
  assert.equal(spotifyId(TRACK.uri, "track"), TRACK_ID);
  assert.throws(() => spotifyId("https://evil.test/playlist/" + PLAYLIST_ID));
  const result = await runLibraryControl({ operation: "unknown", config: {}, normalizeTrack });
  assert.equal(result, undefined);
});

test("une sauvegarde musicale d’un ancien profil est refusée avant toute mutation", async (t) => {
  const f = fixture(t);
  f.state.session = { profileId: "current-profile" };
  const before = JSON.stringify(f.state);
  await assert.rejects(f.service.control({ operation: "requests_settings", settings: { enabled: true }, expectedUid: "owner", expectedProfileId: "old-profile" }), /profil a changé/);
  await assert.rejects(f.service.control({ operation: "requests_settings", settings: { enabled: true }, expectedUid: "other", expectedProfileId: "current-profile" }), /compte ou le profil a changé/);
  assert.equal(JSON.stringify(f.state), before);
  assert.equal(f.calls.length, 0);
});
