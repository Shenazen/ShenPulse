"use strict";

/** Song Requests : vues compactes, requêtes à la demande et données Spotify réelles. */
let creatorMusicTab = "player";
let creatorMusicSearch = "";
let creatorMusicPlaylist = "";
let creatorMusicAccount = "";
let creatorMusicRequest = 0;
let creatorMusicLoading = false;
let creatorMusicError = "";
let creatorMusicData = {};
let creatorMusicPollingTimer = null;
let creatorMusicPollPending = false;

function resetCreatorMusicAccount(force = false) {
  const uid = String(snapshot?.state?.settings?.account?.uid || "");
  if (!force && uid === creatorMusicAccount) return;
  creatorMusicAccount = uid;
  creatorMusicRequest += 1;
  creatorMusicData = {};
  creatorMusicPlaylist = "";
  creatorMusicSearch = "";
  creatorMusicError = "";
  creatorMusicLoading = false;
  if (creatorMusicPollingTimer !== null) window.clearTimeout(creatorMusicPollingTimer);
  creatorMusicPollingTimer = null;
}

function creatorSongRequestSettings() {
  const value = creatorMusicData.requests?.settings || spotifyStatus.songRequests?.settings || snapshot?.state?.settings?.spotify?.songRequests || {};
  return { enabled: false, allowExplicit: false, maxDurationMinutes: 10, maxQueue: 20, maxPerViewer: 3, cooldownSeconds: 10, allowViewerSkip: false, blockedArtists: [], ...value,
    commands: { request: "!sr", skip: "!skip", nowPlaying: "!np", queue: "!queue", ...value.commands } };
}

function creatorMusicIcon(kind = "headphones") {
  const shapes = {
    headphones: '<path d="M4 14v-3a8 8 0 0 1 16 0v3M4 12H3v7a2 2 0 0 0 2 2h2v-9H4Zm16 0h1v7a2 2 0 0 1-2 2h-2v-9h3Z"/>',
    spotify: '<circle cx="12" cy="12" r="10"/><path d="M6 9c4-1.5 8-1.2 12 .8M7 12c3-1 6-.8 9.5 1M8 15c2.5-.5 4.5-.3 7 1"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>', pause: '<path d="M7 4v16M17 4v16"/>',
    previous: '<path d="M5 4v16m14-15-12 7 12 7Z"/>', next: '<path d="M19 4v16M5 5l12 7-12 7Z"/>',
    queue: '<path d="M3 5h15M3 10h15M3 15h9M17 14l5 4-5 4Z"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>', playlist: '<path d="M4 4h16M4 9h16M4 14h8M18 13v7"/><circle cx="15" cy="20" r="3"/>',
    settings: '<path d="M4 7h2m6 0h8M4 17h8m6 0h2"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[kind] || shapes.headphones}</svg>`;
}

function creatorMusicTabsMarkup() {
  const tabs = [["player", "Lecteur", "headphones"], ["queue", "File d’attente", "queue"], ["search", "Rechercher", "search"], ["playlists", "Mes playlists", "playlist"], ["settings", "Paramètres", "settings"]];
  const count = creatorMusicData.requests?.queue?.length || 0;
  return `<nav class="music-tabs" aria-label="Sections musique">${tabs.map(([id, label, icon]) => `<button type="button" data-action="music-tab" data-value="${id}" class="music-tab ${creatorMusicTab === id ? "active" : ""}" aria-pressed="${creatorMusicTab === id}" aria-controls="creator-music-panel"><span class="music-tab-icon">${creatorMusicIcon(icon)}</span><span class="music-tab-label">${label}</span>${id === "queue" && count ? `<span class="music-tab-count">${count}</span>` : ""}</button>`).join("")}</nav>`;
}

function creatorMusicTabsSignature() {
  return `${creatorMusicTab}:${creatorMusicData.requests?.queue?.length || 0}`;
}

/** Le service expose les preuves connues ; les anciens statuts restent compatibles. */
function creatorMusicCapabilities() {
  return spotifyStatus.capabilities || window.ShenPulseSpotifyCapabilities?.spotifyCapabilities(spotifyStatus) || {
    canControlPlayback: spotifyStatus.connected === true, canControlVolume: spotifyStatus.connected === true,
    canSearch: spotifyStatus.connected === true, reason: "", volumeReason: ""
  };
}

function creatorMusicConnectionMarkup() {
  const connected = spotifyStatus.connected === true;
  const capabilities = creatorMusicCapabilities();
  const account = spotifyStatus.account?.displayName || spotifyStatus.account?.email || "Compte autorisé";
  return `<section class="music-connection ${connected ? "is-connected" : ""}"><span class="music-service-icon">${creatorMusicIcon("spotify")}</span><div><strong>${connected ? `<span>Spotify connecté</span> · <span data-studio-user-content>${escapeHtml(account)}</span>` : "Spotify n’est pas connecté"}</strong><small ${connected && spotifyStatus.activeDevice?.name ? "data-studio-user-content" : ""}>${connected ? escapeHtml(spotifyStatus.activeDevice?.name || "Ouvrez Spotify sur un appareil pour lancer la lecture.") : "Connectez votre compte pour les demandes de titres. Spotify Premium requis pour piloter la lecture."}</small>${connected && capabilities.reason ? `<small class="music-error">${escapeHtml(capabilities.reason)}</small>` : ""}${connected && capabilities.canControlPlayback && !capabilities.canControlVolume ? `<small class="music-error">${escapeHtml(capabilities.volumeReason)}</small>` : ""}${spotifyStatus.message ? `<small class="music-error" data-studio-user-content>${escapeHtml(spotifyStatus.message)}</small>` : ""}</div><div class="button-row">${connected ? '<button class="button small" data-action="spotify-refresh">Actualiser</button><button class="button small" data-action="spotify-connect">Autoriser à nouveau</button><button class="button small" data-action="spotify-disconnect">Déconnecter</button>' : '<button class="button music-connect" data-action="spotify-connect">Connecter Spotify</button>'}</div></section>`;
}

function creatorMusicTrackCover(track, className = "") {
  return `<span class="music-track-cover ${className}">${track?.imageUrl ? `<img src="${escapeHtml(track.imageUrl)}" alt="" loading="lazy" decoding="async">` : creatorMusicIcon("headphones")}</span>`;
}

function creatorMusicTime(ms = 0) {
  const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function creatorMusicTrackCopy(track) {
  const artists = Array.isArray(track?.artists) ? track.artists.join(", ") : "";
  return `<strong>${escapeHtml(track?.name || "Titre inconnu")}${track?.explicit ? '<span class="music-explicit" title="Contenu explicite">E</span>' : ""}</strong><small>${escapeHtml(artists || track?.album || "")}</small>`;
}

function renderCreatorMusicPlayer() {
  const playback = spotifyStatus.playback;
  const track = playback?.item;
  const capabilities = creatorMusicCapabilities();
  const disabled = capabilities.canControlPlayback ? "" : "disabled";
  const volumeDisabled = capabilities.canControlVolume ? "" : "disabled";
  const volume = Math.max(0, Math.min(100, Number(spotifyStatus.activeDevice?.volume ?? 50)));
  return `<section class="music-player ${track ? "has-track" : ""}"><div class="music-player-glow" aria-hidden="true"></div>${track ? `<div class="music-now-playing">${creatorMusicTrackCover(track, "music-player-cover")}<div>${creatorMusicTrackCopy(track)}<span class="music-playing-state">${playback.isPlaying ? "En lecture" : "En pause"}</span></div></div><div class="music-progress"><span>${creatorMusicTime(playback.progressMs)}</span><input type="range" aria-label="Position dans le titre" data-music-seek min="0" max="${Math.max(1, Number(track.durationMs) || 1)}" step="1000" value="${Math.min(Number(track.durationMs) || 0, Number(playback.progressMs) || 0)}" ${disabled}><span>${creatorMusicTime(track.durationMs)}</span></div>` : `<div class="music-player-empty"><span>${creatorMusicIcon("headphones")}</span><h3>Rien en lecture</h3><p>Lancez Spotify sur votre appareil, puis choisissez une musique.</p></div>`}<div class="music-player-controls"><button data-action="music-control" data-operation="previous" title="Titre précédent" aria-label="Titre précédent" ${disabled}>${creatorMusicIcon("previous")}</button><button class="music-play-button" data-action="music-control" data-operation="${playback?.isPlaying ? "pause" : "play"}" title="${playback?.isPlaying ? "Mettre en pause" : "Lire"}" aria-label="${playback?.isPlaying ? "Mettre en pause" : "Lire"}" ${disabled}>${creatorMusicIcon(playback?.isPlaying ? "pause" : "play")}</button><button data-action="music-control" data-operation="next" title="Titre suivant" aria-label="Titre suivant" ${disabled}>${creatorMusicIcon("next")}</button></div><label class="music-volume"><span>Volume</span><input type="range" data-music-volume min="0" max="100" step="1" value="${volume}" aria-label="Volume Spotify" ${volumeDisabled}><output>${volume} %</output></label></section><div class="music-player-footer"><span>La lecture reste dans Spotify. ShenPulse ne capture ni ne redistribue son audio.</span><button class="button small" data-action="music-refresh">Actualiser le lecteur</button></div>`;
}

function renderCreatorMusicQueue() {
  const requests = creatorMusicData.requests || {};
  const queue = requests.queue || [];
  const native = creatorMusicData.queue?.queue || [];
  return `<section class="music-section"><div class="music-section-heading"><div><h3>Demandes ShenPulse <span>${queue.length}</span></h3><p>Les demandes validées de vos viewers, avant leur envoi à Spotify.</p></div><div class="button-row"><button class="button small primary" data-action="music-request-next" ${queue.length && creatorMusicCapabilities().canControlPlayback ? "" : "disabled"}>Lire la suivante</button><button class="button small" data-action="music-request-clear" ${queue.length ? "" : "disabled"}>Vider les demandes ShenPulse</button><button class="button small" data-action="music-refresh">Actualiser</button></div></div>${queue.length ? `<div class="music-track-list">${queue.map((request, index) => { const track = request.track || request; const user = request.username || request.user?.name || request.user?.displayName || "Créateur"; return `<article class="music-track-row"><span class="music-track-position">${index + 1}</span>${creatorMusicTrackCover(track)}<div class="music-track-copy">${creatorMusicTrackCopy(track)}<small class="music-request-user">Demandé par ${escapeHtml(user)}</small></div><span class="music-track-duration">${creatorMusicTime(track.durationMs)}</span><button class="music-icon-button danger" data-action="music-request-remove" data-id="${escapeHtml(request.id)}" aria-label="Retirer ${escapeHtml(track.name)}">×</button></article>`; }).join("")}</div>` : musicEmptyMarkup("queue", "Aucune demande en attente", "Activez les Song Requests dans Paramètres. Les prochaines demandes valides apparaîtront ici.")}</section><details class="music-native-queue"><summary>File Spotify actuelle <span>${native.length}</span></summary><p>Cette file est gérée par Spotify. Elle est consultable, mais Spotify ne permet pas de la vider ou de retirer un titre via cette intégration.</p>${native.length ? `<div class="music-track-list">${native.slice(0, 50).map((track) => creatorMusicTrackRow(track, { actions: false })).join("")}</div>` : '<div class="music-empty-inline">Aucun titre transmis par Spotify.</div>'}</details>${requests.lastResponse ? `<p class="music-request-feedback">Dernière réponse ShenPulse : ${escapeHtml(typeof requests.lastResponse === "string" ? requests.lastResponse : requests.lastResponse.message || "")}</p>` : ""}`;
}

function creatorMusicTrackRow(track, { actions = true } = {}) {
  return `<article class="music-track-row">${creatorMusicTrackCover(track)}<div class="music-track-copy">${creatorMusicTrackCopy(track)}</div><span class="music-track-duration">${creatorMusicTime(track.durationMs)}</span>${actions ? `<div class="button-row"><button class="button small" data-action="music-request-add" data-uri="${escapeHtml(track.uri)}" ${spotifyStatus.connected ? "" : "disabled"}>＋ Demander</button><button class="music-icon-button" data-action="music-play-track" data-uri="${escapeHtml(track.uri)}" title="Lire ce titre sur Spotify" aria-label="Lire ${escapeHtml(track.name)}" ${creatorMusicCapabilities().canControlPlayback ? "" : "disabled"}>${creatorMusicIcon("play")}</button></div>` : ""}</article>`;
}

function musicEmptyMarkup(icon, title, detail) {
  return `<div class="music-empty-state"><span>${creatorMusicIcon(icon)}</span><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p></div>`;
}

function renderCreatorMusicSearch() {
  const tracks = creatorMusicData.search?.tracks || [];
  return `<section class="music-section"><div class="music-search-toolbar"><label class="search-control"><span>${creatorMusicIcon("search")}</span><input type="search" data-music-search value="${escapeHtml(creatorMusicSearch)}" placeholder="Titre, artiste ou URL Spotify…" aria-label="Rechercher une musique"></label><button class="button primary" data-action="music-search" ${spotifyStatus.connected ? "" : "disabled"}>Rechercher</button></div>${tracks.length ? `<div class="music-track-list">${tracks.map((track) => creatorMusicTrackRow(track)).join("")}</div>` : musicEmptyMarkup("search", creatorMusicSearch && creatorMusicData.search ? "Aucun titre trouvé" : "Trouvez votre prochain titre", "Recherchez une musique sur Spotify, puis ajoutez-la aux demandes ou lancez-la sur votre appareil.")}</section>`;
}

function renderCreatorMusicPlaylists() {
  if (!spotifyStatus.connected) return `<section class="music-playlist-intro"><span>${creatorMusicIcon("playlist")}</span><div><h3>Lancer une playlist</h3><p>Choisissez une de vos playlists et lancez-la en un clic, même hors live.</p></div><button class="button small" data-action="music-refresh">Actualiser</button></section><section class="music-section">${musicEmptyMarkup("spotify", "Connectez Spotify pour voir vos playlists", "Vos playlists apparaîtront après la connexion de votre compte.")}</section>`;
  if (creatorMusicPlaylist) {
    const playlist = creatorMusicData.playlists?.playlists?.find((row) => row.id === creatorMusicPlaylist);
    const tracks = creatorMusicData.playlistTracks?.tracks || [];
    return `<section class="music-section"><div class="music-section-heading"><div><h3 data-studio-user-content>${escapeHtml(playlist?.name || "Votre playlist")}</h3><p>Les titres disponibles de cette playlist Spotify.</p></div><div class="button-row"><button class="button small" data-action="music-playlist-back">← Mes playlists</button><button class="button small primary" data-action="music-play-playlist" data-id="${escapeHtml(creatorMusicPlaylist)}" ${creatorMusicCapabilities().canControlPlayback ? "" : "disabled"}>Lire la playlist</button></div></div>${tracks.length ? `<div class="music-track-list">${tracks.map((track) => creatorMusicTrackRow(track)).join("")}</div>` : musicEmptyMarkup("playlist", "Aucun titre disponible", "Actualisez la playlist ou vérifiez ses droits d’accès dans Spotify.")}</section>`;
  }
  const rows = creatorMusicData.playlists?.playlists || [];
  return `<section class="music-section"><div class="music-section-heading"><div><h3>Mes playlists</h3><p>Vos playlists disponibles via votre compte Spotify.</p></div><button class="button small" data-action="music-refresh">Actualiser</button></div>${rows.length ? `<div class="music-playlist-grid">${rows.map((row) => `<button class="music-playlist-card" data-action="music-playlist" data-id="${escapeHtml(row.id)}">${creatorMusicTrackCover(row)}<strong>${escapeHtml(row.name)}</strong><small>${Number.isFinite(row.total) ? `${row.total} titres` : escapeHtml(row.description || row.owner || "Spotify")}</small></button>`).join("")}</div>` : musicEmptyMarkup("playlist", "Aucune playlist disponible", "Connectez Spotify puis actualisez. Certains droits d’accès peuvent dépendre de votre application Spotify.")}</section>`;
}

function creatorMusicSwitch(name, label, detail, checked) {
  return `<label class="music-setting-switch"><div><strong>${label}</strong><small>${detail}</small></div><span class="switch"><input type="checkbox" name="${name}" ${checked ? "checked" : ""}><span></span></span></label>`;
}

function renderCreatorMusicSettings() {
  const settings = creatorSongRequestSettings();
  const number = (name, label, value, max) => `<label><span>${label}</span><input type="number" name="${name}" min="${name === "cooldownSeconds" ? 0 : 1}" max="${max}" value="${Number(value) || 0}" required></label>`;
  const command = (name, label) => `<label><span>${label}</span><input name="${name}" value="${escapeHtml(settings.commands[name])}" maxlength="22" pattern="![A-Za-z][A-Za-z0-9_-]{0,20}" required></label>`;
  return `<div class="music-settings" data-music-settings><div class="music-settings-switches">${creatorMusicSwitch("enabled", "Song Requests", "Activer les demandes de titres via le chat de votre LIVE.", settings.enabled)}${creatorMusicSwitch("allowExplicit", "Contenu explicite", "Autoriser les titres marqués explicites par Spotify.", settings.allowExplicit)}</div><section class="music-section"><div class="music-section-heading"><div><h3>Limites</h3><p>Gardez la main sur la file et évitez les demandes répétées.</p></div></div><div class="music-limits">${number("maxQueue", "File d’attente maximum", settings.maxQueue, 50)}${number("maxPerViewer", "Demandes par viewer", settings.maxPerViewer, 10)}${number("cooldownSeconds", "Cooldown (secondes)", settings.cooldownSeconds, 3600)}${number("maxDurationMinutes", "Durée maximum (minutes)", settings.maxDurationMinutes, 120)}</div></section><section class="music-section"><div class="music-section-heading"><div><h3>Artistes bloqués</h3><p>Les demandes correspondant à ces artistes sont refusées.</p></div></div><label class="music-artists-field"><span>Un nom d’artiste par ligne ou séparé par une virgule</span><textarea name="blockedArtists" rows="3" placeholder="Artiste 1, Artiste 2">${escapeHtml((settings.blockedArtists || []).join("\n"))}</textarea></label></section><section class="music-section"><div class="music-section-heading"><div><h3>Commandes du chat</h3><p>Les réponses de commande sont consultables dans ShenPulse ; aucun envoi automatique au chat n’est promis.</p></div></div><div class="music-command-fields">${command("request", "Demander un titre")}${command("skip", "Passer un titre")}${command("nowPlaying", "Titre en cours")}${command("queue", "File d’attente")}</div>${creatorMusicSwitch("allowViewerSkip", "Tout le monde peut passer un titre", "Sinon, seuls le streamer et les modérateurs peuvent utiliser la commande de passage.", settings.allowViewerSkip)}</section><div class="music-settings-footer"><p>Les demandes locales sont validées puis lues avec « Lire la suivante ». Les règles Spotify existantes restent disponibles ci-dessous.</p><button class="button primary" data-action="music-settings-save">Enregistrer les paramètres</button></div></div>`;
}

function creatorMusicPanelMarkup() {
  const body = { player: renderCreatorMusicPlayer, queue: renderCreatorMusicQueue, search: renderCreatorMusicSearch, playlists: renderCreatorMusicPlaylists, settings: renderCreatorMusicSettings }[creatorMusicTab] || renderCreatorMusicPlayer;
  return `${creatorMusicError ? `<div class="music-error-banner" role="status">${escapeHtml(creatorMusicError)}<button class="button small" data-action="music-refresh">Réessayer</button></div>` : ""}${creatorMusicLoading ? '<div class="music-loading" role="status">Actualisation…</div>' : ""}${body()}`;
}

function creatorMusicRuleRowsMarkup() {
  const rows = flattenActions().filter(({ action }) => action.type === "spotify.queue");
  return `<details class="music-automation-rules"><summary>Demandes de titres & règles Spotify <span>${rows.length}</span></summary><div class="music-rules-toolbar"><p>Ces règles conservent leurs déclencheurs, leurs filtres et leurs actions Spotify.</p><button class="button small primary" data-action="creator-add-music">＋ Créer une règle</button></div>${rows.length ? renderAutomationTable({ key: "music-rules", label: "Règles Spotify du profil actif", rows: rows.map(({ rule, action, actionIndex }) => ({
    id: action.id || `${rule.id}_${actionIndex}`, name: rule.name,
    trigger: triggerPill(rule, { compact: true }),
    effects: renderAutomationEffectChip({ label: actionDescription(action), kind: "Spotify", tone: "green", icon: "sound" }),
    status: renderAutomationStatus(rule), date: rule.createdAt || "",
    commands: `${renderAutomationIconButton({ action: "test-action", label: "Tester l’action Spotify", attributes: soundRowAttributes(rule, action, actionIndex), icon: "play", tone: "play" })}${renderAutomationIconButton({ action: "edit-action", label: "Modifier l’action Spotify", attributes: soundRowAttributes(rule, action, actionIndex), icon: "edit" })}`
  })) }) : '<p class="music-empty-inline">Aucune règle Spotify configurée.</p>'}</details>`;
}

function renderCreatorMusic() {
  resetCreatorMusicAccount();
  if (!isAccountAuthenticated()) return renderPrivateDataPlaceholder("Votre musique", "Connectez votre compte ShenPulse pour accéder à Spotify et à vos demandes de titres.");
  if (!canAccessFeature("spotify.playback") || !canAccessActionType("spotify.queue")) return renderPrivateDataPlaceholder("Musique indisponible", "L’accès à Spotify est masqué par la configuration de votre espace ShenPulse.");
  if (!creatorMusicData.requests && !creatorMusicLoading) Promise.resolve().then(() => { if (currentPage === "music" && !creatorMusicLoading) void refreshCreatorMusicData(); });
  synchronizeCreatorMusicPolling();
  return `<div class="reference-page creator-music-page"><section class="music-banner"><img src="assets/studio/music.webp" alt="" decoding="async"><div><span>VOTRE LIVE A SA BANDE-SON</span><h2>Song Requests</h2><p>Vos viewers peuvent demander des musiques via le chat de votre LIVE.</p></div></section><div data-creator-music-connection>${creatorMusicConnectionMarkup()}</div><div data-creator-music-tabs data-music-tabs-state="${creatorMusicTabsSignature()}">${creatorMusicTabsMarkup()}</div><div id="creator-music-panel" data-creator-music-panel>${creatorMusicPanelMarkup()}</div>${creatorMusicRuleRowsMarkup()}</div>`;
}

/** Aucun polling ni lecteur média local : l'API est interrogée dans la vue demandée. */
async function refreshCreatorMusicData() {
  resetCreatorMusicAccount();
  if (!isAccountAuthenticated() || typeof api.controlSpotify !== "function") return;
  const request = ++creatorMusicRequest;
  const account = creatorMusicAccount;
  const tab = creatorMusicTab;
  const playlist = creatorMusicPlaylist;
  creatorMusicLoading = true;
  creatorMusicError = "";
  try {
    const requests = await api.controlSpotify({ operation: "requests_status" });
    if (!isCurrentCreatorMusicRequest(request, account)) return;
    creatorMusicData.requests = requests;
    if (spotifyStatus.connected) {
      let result;
      if (tab === "queue") result = await api.controlSpotify({ operation: "queue_list" });
      if (tab === "playlists") result = await api.controlSpotify(playlist ? { operation: "playlist_tracks", playlistId: playlist, limit: 50 } : { operation: "playlists", limit: 50 });
      if (!isCurrentCreatorMusicRequest(request, account)) return;
      if (tab === "queue") creatorMusicData.queue = result;
      if (tab === "playlists") creatorMusicData[playlist ? "playlistTracks" : "playlists"] = result;
    }
  } catch (error) {
    if (isCurrentCreatorMusicRequest(request, account)) creatorMusicError = error?.message || "Impossible d’actualiser la musique.";
  } finally {
    if (isCurrentCreatorMusicRequest(request, account)) { creatorMusicLoading = false; syncCreatorMusicRuntime(); }
  }
}

function isCurrentCreatorMusicRequest(request, account = creatorMusicAccount) {
  return request === creatorMusicRequest && isAccountAuthenticated() && account === String(snapshot?.state?.settings?.account?.uid || "");
}

function acceptCreatorSongRequestsStatus(status) {
  resetCreatorMusicAccount();
  if (!isAccountAuthenticated()) return;
  if (status?.ownerUid != null && String(status.ownerUid) !== creatorMusicAccount) return;
  creatorMusicData.requests = status;
  syncCreatorMusicRuntime();
}

function syncCreatorMusicRuntime({ preserveSettings = true } = {}) {
  if (currentPage !== "music" || !isAccountAuthenticated()) return false;
  const panel = content.querySelector("[data-creator-music-panel]");
  if (!panel) return false;
  const search = panel.querySelector("[data-music-search]");
  const searchEditing = search ? { value: search.value, focused: document.activeElement === search, start: search.selectionStart, end: search.selectionEnd } : null;
  const editingRange = panel.contains(document.activeElement) && document.activeElement.matches("[data-music-volume], [data-music-seek]");
  if (!editingRange && !(preserveSettings && creatorMusicTab === "settings" && panel.querySelector("[data-music-settings]"))) panel.innerHTML = creatorMusicPanelMarkup();
  const updatedSearch = panel.querySelector("[data-music-search]");
  if (searchEditing && updatedSearch) {
    updatedSearch.value = searchEditing.value;
    if (searchEditing.focused) { updatedSearch.focus(); updatedSearch.setSelectionRange(searchEditing.start, searchEditing.end); }
  }
  const connection = content.querySelector("[data-creator-music-connection]");
  if (connection) connection.innerHTML = creatorMusicConnectionMarkup();
  const tabs = content.querySelector("[data-creator-music-tabs]");
  if (tabs) {
    // Les rafraîchissements Spotify ne doivent pas recréer les boutons inchangés,
    // ni perdre le focus lorsqu'un badge ou l'onglet actif a réellement changé.
    const focusedTab = tabs.contains(document.activeElement) ? document.activeElement.closest('[data-action="music-tab"]')?.dataset.value : null;
    const signature = creatorMusicTabsSignature();
    if (tabs.dataset.musicTabsState !== signature) {
      tabs.innerHTML = creatorMusicTabsMarkup();
      tabs.dataset.musicTabsState = signature;
      if (focusedTab) tabs.querySelector(`[data-value="${focusedTab}"]`)?.focus();
    }
  }
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(content);
  return true;
}

function handleCreatorMusicChange(target) {
  if (!target.matches("[data-music-volume], [data-music-seek]")) return false;
  const config = target.matches("[data-music-volume]") ? { operation: "volume", volume: Number(target.value) } : { operation: "seek", positionMs: Number(target.value) };
  const owner = captureCreatorPrivateOperation();
  void perform(async () => {
    assertCreatorPrivateOperation(owner);
    await api.controlSpotify(config);
    assertCreatorPrivateOperation(owner);
    await refreshSpotifyStatus({ redraw: false });
    assertCreatorPrivateOperation(owner);
    syncCreatorMusicRuntime();
  }, "Spotify mis à jour").catch(() => {});
  return true;
}

function creatorMusicPlayerPollingActive() {
  const visible = typeof rendererVisualsActive === "function" ? rendererVisualsActive() : document.visibilityState !== "hidden";
  return visible && currentPage === "music" && creatorMusicTab === "player" && spotifyStatus.connected === true && isAccountAuthenticated();
}

/** Un seul rafraîchissement, uniquement du lecteur visible ; aucune bibliothèque repollée. */
function synchronizeCreatorMusicPolling() {
  if (!creatorMusicPlayerPollingActive()) {
    if (creatorMusicPollingTimer !== null) window.clearTimeout(creatorMusicPollingTimer);
    creatorMusicPollingTimer = null;
    return;
  }
  if (creatorMusicPollingTimer !== null || creatorMusicPollPending) return;
  creatorMusicPollingTimer = window.setTimeout(async () => {
    creatorMusicPollingTimer = null;
    if (!creatorMusicPlayerPollingActive()) return;
    creatorMusicPollPending = true;
    const account = creatorMusicAccount;
    try {
      await refreshSpotifyStatus({ redraw: false });
      if (creatorMusicPlayerPollingActive() && account === String(snapshot?.state?.settings?.account?.uid || "")) syncCreatorMusicRuntime();
    } catch (error) {
      if (creatorMusicPlayerPollingActive() && account === String(snapshot?.state?.settings?.account?.uid || "")) {
        creatorMusicError = error?.message || "Impossible d’actualiser le lecteur Spotify.";
        syncCreatorMusicRuntime();
      }
    } finally {
      creatorMusicPollPending = false;
      synchronizeCreatorMusicPolling();
    }
  }, 5000);
}
