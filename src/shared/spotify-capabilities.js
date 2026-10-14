/* Prérequis Spotify partagés entre le service et l'interface ; aucune donnée secrète. */
(function exposeSpotifyCapabilities(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ShenPulseSpotifyCapabilities = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSpotifyCapabilities() {
  "use strict";

  /** Une ancienne liste vide sans provenance ne prouve pas un refus de permissions. */
  function spotifyCapabilities(status = {}) {
    const scopes = Array.isArray(status.scopes) ? status.scopes : [];
    const scopesKnown = status.scopesKnown === true || scopes.length > 0;
    const canWrite = !scopesKnown || scopes.includes("user-modify-playback-state");
    const product = String(status.account?.product || "").trim().toLowerCase();
    const premium = product === "premium" ? true : ["free", "open"].includes(product) ? false : null;
    const devicesKnown = status.devicesKnown === true;
    const devices = Array.isArray(status.devices) ? status.devices : status.activeDevice ? [status.activeDevice] : [];
    const controllableDevice = devices.find((device) => device?.isRestricted !== true && (device?.isActive === true || device?.id));
    let reason = "";
    if (status.connected !== true) reason = "Connectez ou autorisez à nouveau votre compte Spotify.";
    else if (!canWrite) reason = "Autorisez à nouveau Spotify pour accorder la permission de piloter la lecture.";
    else if (premium === false) reason = "Spotify Premium est requis pour piloter la lecture ; la recherche et les demandes restent disponibles.";
    else if (devicesKnown && !controllableDevice) reason = "Ouvrez Spotify sur votre PC ou téléphone, lancez un titre puis actualisez. Aucun appareil contrôlable n'est disponible.";
    const canControlPlayback = !reason;
    const canControlVolume = canControlPlayback && status.activeDevice?.supportsVolume !== false;
    return { scopesKnown, premium, devicesKnown, canControlPlayback, canControlVolume,
      canSearch: status.connected === true, reason,
      volumeReason: canControlVolume ? "" : reason || "Le volume de cet appareil ne peut pas être modifié par l'API Spotify." };
  }

  return { spotifyCapabilities };
});
