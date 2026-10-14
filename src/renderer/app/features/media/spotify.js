let creatorSpotifyStatusRequest = 0;

/** Vide immédiatement les métadonnées musicales privées et invalide les lectures en vol. */
function clearCreatorSpotifyStatus() {
  creatorSpotifyStatusRequest += 1;
  spotifyStatus = { configured: true, connected: false, account: null, devices: [], activeDevice: null, playback: null, songRequests: null, message: "" };
}

async function refreshSpotifyStatus({ redraw = true } = {}) {
  const owner = captureCreatorPrivateOperation();
  if (!creatorPrivateOperationActive(owner)) return null;
  const request = ++creatorSpotifyStatusRequest;
  const active = () => request === creatorSpotifyStatusRequest && creatorPrivateOperationActive(owner);
  try {
    const status = await api.getSpotifyStatus();
    if (!active()) return null;
    spotifyStatus = status;
  } catch (error) {
    if (!active()) return null;
    spotifyStatus = {
      configured: true,
      connected: false,
      account: snapshot?.state.settings.spotify?.account || null,
      devices: [],
      message: error.message
    };
  }
  if (active() && redraw && ["sounds", "music"].includes(currentPage)) render();
  return spotifyStatus;
}

function spotifyTrackLabel(track) {
  if (!track) return "";
  const artists = Array.isArray(track.artists) ? track.artists.join(", ") : "";
  return [track.name, artists].filter(Boolean).join(" · ");
}
