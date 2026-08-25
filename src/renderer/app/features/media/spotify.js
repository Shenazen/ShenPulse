async function refreshSpotifyStatus({ redraw = true } = {}) {
  try {
    spotifyStatus = await api.getSpotifyStatus();
  } catch (error) {
    spotifyStatus = {
      configured: true,
      connected: false,
      account: snapshot?.state.settings.spotify?.account || null,
      devices: [],
      message: error.message
    };
  }
  if (redraw && currentPage === "sounds") render();
  return spotifyStatus;
}

function spotifyTrackLabel(track) {
  if (!track) return "";
  const artists = Array.isArray(track.artists) ? track.artists.join(", ") : "";
  return [track.name, artists].filter(Boolean).join(" · ");
}
