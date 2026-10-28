"use strict";

/** Commandes de musique : Spotify reste le lecteur, ShenPulse gère les demandes. */
const CREATOR_MUSIC_ACTIONS = new Set([
  "music-tab", "music-control", "music-refresh", "music-search", "music-play-track",
  "music-play-playlist", "music-playlist", "music-playlist-back", "music-request-add",
  "music-request-remove", "music-request-clear", "music-request-next", "music-settings-save"
]);

let creatorMusicSettingsWrite = Promise.resolve();

/** Les interrupteurs et le bouton Enregistrer partagent la même file ordonnée. */
function saveCreatorMusicSettings(settings, owner, { redraw = false } = {}) {
  const profileId = String(snapshot?.state?.session?.profileId || "");
  const assertOwner = () => {
    assertCreatorPrivateOperation(owner);
    if (String(snapshot?.state?.session?.profileId || "") !== profileId) throw new Error("Le profil a changé pendant l’enregistrement des commandes musicales.");
  };
  const pending = creatorMusicSettingsWrite.then(() => perform(async () => {
    assertOwner();
    const result = await api.controlSpotify({ operation: "requests_settings", settings, expectedUid: owner.uid, expectedProfileId: profileId });
    assertOwner();
    creatorMusicData.requests = result;
    const updated = await api.getSnapshot();
    assertOwner();
    acceptSnapshot(updated);
    if (redraw) {
      await refreshSpotifyStatus({ redraw: false });
      assertOwner();
      await refreshCreatorMusicData();
      assertOwner();
    }
    if (!syncCreatorMusicRuntime({ preserveSettings: !redraw }) && typeof syncCreatorChatbotRuntime === "function") syncCreatorChatbotRuntime();
    return result;
  }, redraw ? "Paramètres Song Requests enregistrés" : "État de la commande musicale enregistré"));
  creatorMusicSettingsWrite = pending.catch(() => {});
  return pending;
}

function saveCreatorMusicCommandToggle(target) {
  const name = target.name;
  const keys = ["request", "skip", "nowPlaying", "queue"];
  const key = keys.find((value) => name === value + "Enabled");
  if (name !== "enabled" && name !== "allowViewerSkip" && !key) return false;
  const owner = captureCreatorPrivateOperation();
  const previous = !target.checked;
  const settings = key ? { commandEnabled: { [key]: target.checked } } : { [name]: target.checked };
  target.disabled = true;
  void saveCreatorMusicSettings(settings, owner).catch(() => {
    try {
      assertCreatorPrivateOperation(owner);
      if (target.isConnected) target.checked = previous;
    } catch {}
  }).finally(() => { if (target.isConnected) target.disabled = false; });
  return true;
}

async function creatorMusicOperation(config, feedback = "Musique mise à jour", owner = captureCreatorPrivateOperation()) {
  return perform(async () => {
    assertCreatorPrivateOperation(owner);
    const result = await api.controlSpotify(config);
    assertCreatorPrivateOperation(owner);
    await refreshSpotifyStatus({ redraw: false });
    assertCreatorPrivateOperation(owner);
    await refreshCreatorMusicData();
    assertCreatorPrivateOperation(owner);
    syncCreatorMusicRuntime();
    return result;
  }, feedback);
}

async function handleCreatorMusicAction({ action, target, id }) {
  if (!CREATOR_MUSIC_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  const owner = captureCreatorPrivateOperation();
  if (!canAccessFeature("spotify.playback") || !canAccessActionType("spotify.queue")) throw new Error("La musique est indisponible pour votre espace.");
  if (action === "music-tab") {
    creatorMusicTab = ["player", "queue", "search", "playlists", "settings"].includes(target.dataset.value) ? target.dataset.value : "player";
    synchronizeCreatorMusicPolling();
    syncCreatorMusicRuntime({ preserveSettings: false });
    return refreshCreatorMusicData();
  }
  if (action === "music-refresh") {
    await refreshSpotifyStatus({ redraw: false });
    assertCreatorPrivateOperation(owner);
    return refreshCreatorMusicData();
  }
  if (action === "music-control") return creatorMusicOperation({ operation: target.dataset.operation }, "Commande Spotify envoyée");
  if (action === "music-play-track") return creatorMusicOperation({ operation: "play_tracks", uris: [target.dataset.uri] }, "Titre lancé sur Spotify");
  if (action === "music-play-playlist") return creatorMusicOperation({ operation: "play_playlist", playlistId: id }, "Playlist lancée sur Spotify");
  if (action === "music-playlist" || action === "music-playlist-back") {
    creatorMusicPlaylist = action === "music-playlist" ? id : "";
    delete creatorMusicData.playlistTracks;
    syncCreatorMusicRuntime();
    return refreshCreatorMusicData();
  }
  if (action === "music-search") {
    const input = content.querySelector("[data-music-search]");
    creatorMusicSearch = String(input?.value || "").trim();
    if (!creatorMusicSearch) throw new Error("Indiquez un titre ou un artiste à rechercher.");
    const request = ++creatorMusicRequest;
    const account = creatorMusicAccount;
    creatorMusicLoading = true;
    creatorMusicError = "";
    try {
      const result = await api.controlSpotify({ operation: "search", query: creatorMusicSearch, limit: 10 });
      if (!isCurrentCreatorMusicRequest(request, account)) return;
      creatorMusicData.search = result;
    } catch (error) {
      if (isCurrentCreatorMusicRequest(request, account)) creatorMusicError = error.message || "Recherche Spotify indisponible.";
    } finally {
      if (isCurrentCreatorMusicRequest(request, account)) { creatorMusicLoading = false; syncCreatorMusicRuntime(); }
    }
    return;
  }
  if (action === "music-request-add") return creatorMusicOperation({ operation: "requests_add", uri: target.dataset.uri }, "Titre ajouté aux demandes ShenPulse");
  if (action === "music-request-remove") return creatorMusicOperation({ operation: "requests_remove", id }, "Demande retirée");
  if (action === "music-request-next") return creatorMusicOperation({ operation: "requests_play_next" }, "Demande lancée sur Spotify");
  if (action === "music-request-clear") {
    if (!(await confirmAction("Vider uniquement les demandes ShenPulse en attente ? La file native Spotify et le titre en cours ne seront pas modifiés.", { title: "Vider les demandes", confirmLabel: "Vider", danger: true }))) return;
    return creatorMusicOperation({ operation: "requests_clear" }, "Demandes ShenPulse vidées", owner);
  }
  if (action === "music-settings-save") {
    return saveCreatorMusicSettings(creatorMusicSettingsFromControls(), owner, { redraw: true });
  }
}

function creatorMusicSettingsFromControls() {
  const panel = content.querySelector("[data-music-settings]");
  if (!panel) throw new Error("Le formulaire des paramètres n’est plus ouvert.");
  for (const input of panel.querySelectorAll("input")) {
    if (!input.reportValidity()) throw new Error("Corrigez les champs de paramètres indiqués.");
  }
  const field = (name) => panel.querySelector(`[name="${name}"]`);
  return {
    enabled: field("enabled").checked, allowExplicit: field("allowExplicit").checked,
    allowViewerSkip: field("allowViewerSkip").checked,
    maxQueue: Number(field("maxQueue").value), maxPerViewer: Number(field("maxPerViewer").value),
    cooldownSeconds: Number(field("cooldownSeconds").value), maxDurationMinutes: Number(field("maxDurationMinutes").value),
    blockedArtists: field("blockedArtists").value.split(/[,\n\r]+/).map((value) => value.trim()).filter(Boolean),
    commands: Object.fromEntries(["request", "skip", "nowPlaying", "queue"].map((name) => [name, field(name).value.trim()])),
    commandEnabled: Object.fromEntries(["request", "skip", "nowPlaying", "queue"].map((name) => [name, field(name + "Enabled").checked]))
  };
}

registerActionHandler(CREATOR_MUSIC_ACTIONS, handleCreatorMusicAction);
