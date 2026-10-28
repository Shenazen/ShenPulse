(function (root, factory) {
  "use strict";
  const contract = factory();
  if (typeof module === "object" && module.exports) module.exports = contract;
  else root.ShenPulseCommandExecution = contract;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  /** Cibles des commandes de chat. Ce contrat ne déclenche aucun effet.
   * La liste fermée empêche un message de fournir du code, une URL réseau,
   * une configuration d'action ou un objet overlay arbitraire.
   * Les références sont résolues à nouveau dans le profil actif à l'exécution.
   */
  const MUSIC_OPERATIONS = Object.freeze([
    "next", "previous", "play", "pause", "queue", "play_track", "play_playlist", "volume",
    "requests_add", "requests_skip", "requests_current", "requests_list"
  ]);
  const OVERLAY_OPERATIONS = Object.freeze({
    timer: Object.freeze(["add", "remove", "set", "pause", "resume", "reset"]),
    winCounter: Object.freeze(["adjust", "set", "reset", "multiplier", "random"]),
    likeGoal: Object.freeze(["adjust", "set", "reset"]),
    coinJar: Object.freeze(["adjust", "set", "reset"]),
    wheel: Object.freeze(["spin"]),
    multiplierTimer: Object.freeze(["add", "set", "pause", "resume", "reset"])
  });
  const MAX_TIMER_SECONDS = 86_399_999;
  const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
  const own = (value, key) => Object.hasOwn(value, key);

  function plainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    // Les objets du navigateur ou d'un autre contexte VM restent des données.
    return prototype === null || Object.prototype.toString.call(value) === "[object Object]";
  }

  function text(value, maximum, label, { required = false } = {}) {
    if (value == null) value = "";
    if (typeof value !== "string") throw new Error(`${label} invalide.`);
    const clean = value.replace(/\0/g, "").trim();
    if (clean.length > maximum || required && !clean) throw new Error(`${label} invalide.`);
    return clean;
  }

  function numeric(value, fallback, minimum, maximum, label, { integer = true } = {}) {
    if (value != null && !["number", "string"].includes(typeof value)) throw new Error(`${label} invalide.`);
    const number = value == null || value === "" ? fallback : Number(value);
    if (!Number.isFinite(number) || integer && !Number.isInteger(number) || number < minimum || number > maximum) {
      throw new Error(`${label} doit être compris entre ${minimum} et ${maximum}.`);
    }
    return number;
  }

  function boolean(value, label) {
    if (value == null) return false;
    if (typeof value !== "boolean") throw new Error(`${label} doit être un booléen.`);
    return value;
  }

  function spotifyUri(value, kind) {
    const uri = text(value, 400, "La référence Spotify");
    if (!uri) return "";
    const direct = new RegExp(`^spotify:${kind}:([A-Za-z0-9]{22})$`).exec(uri);
    if (direct) return `spotify:${kind}:${direct[1]}`;
    // Le lien est uniquement analysé, jamais ouvert ni téléchargé ici.
    let url;
    try { url = new URL(uri); } catch { throw new Error(`Une URI Spotify ${kind} valide est requise.`); }
    const link = new RegExp(`^/(?:intl-[a-z]{2}/)?${kind}/([A-Za-z0-9]{22})/?$`).exec(url.pathname);
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com" || url.port || url.username || url.password || !link) {
      throw new Error(`Une URI Spotify ${kind} valide est requise.`);
    }
    return `spotify:${kind}:${link[1]}`;
  }

  function normalizeMusic(input) {
    if (!MUSIC_OPERATIONS.includes(input.operation)) throw new Error("Opération de musique invalide.");
    const result = { type: "music", operation: input.operation };
    if (["queue", "play_track"].includes(result.operation)) {
      result.useArgs = boolean(input.useArgs, "L'utilisation des arguments");
      result.query = text(input.query, 300, "La recherche musicale");
      result.uri = spotifyUri(input.uri, "track");
      if (!result.useArgs && !result.query && !result.uri) throw new Error("Choisissez un titre Spotify, une recherche ou les arguments du chat.");
      if (result.query && result.uri) throw new Error("Choisissez une recherche ou un titre Spotify, pas les deux.");
    } else if (result.operation === "play_playlist") {
      const playlistId = text(input.playlistId, 22, "L'identifiant de playlist");
      const uri = spotifyUri(input.uri, "playlist");
      if (playlistId && !SPOTIFY_ID.test(playlistId)) throw new Error("Une playlist Spotify valide est requise.");
      if (!playlistId && !uri) throw new Error("Choisissez une playlist Spotify.");
      if (playlistId && uri && uri !== `spotify:playlist:${playlistId}`) throw new Error("Les références de playlist doivent désigner la même playlist.");
      result.playlistId = playlistId || uri.slice("spotify:playlist:".length);
      result.uri = `spotify:playlist:${result.playlistId}`;
    } else if (result.operation === "volume") {
      result.volume = numeric(input.volume, 50, 0, 100, "Le volume");
    }
    return result;
  }

  function normalizeOverlay(input, { wheels } = {}) {
    if (!own(OVERLAY_OPERATIONS, input.overlayKey)) throw new Error("Overlay de commande invalide.");
    const operations = OVERLAY_OPERATIONS[input.overlayKey];
    if (!operations.includes(input.operation)) throw new Error("Opération d'overlay invalide.");
    const result = { type: "overlay", overlayKey: input.overlayKey, operation: input.operation };
    if (result.overlayKey === "wheel") {
      const wheelId = text(input.wheelId, 160, "La référence de roue");
      if (wheelId) {
        if (Array.isArray(wheels) && !wheels.some((wheel) => wheel.id === wheelId)) throw new Error("La roue choisie est introuvable dans ce profil.");
        result.wheelId = wheelId;
      }
    } else if (result.overlayKey === "timer" || result.overlayKey === "multiplierTimer") {
      if (["add", "remove", "set"].includes(result.operation)) {
        result.seconds = numeric(input.seconds, 0, -MAX_TIMER_SECONDS, MAX_TIMER_SECONDS, "Le temps");
        if (result.operation === "set" && result.seconds < 0) throw new Error("Le temps défini ne peut pas être négatif.");
      }
      if (result.overlayKey === "multiplierTimer" && ["add", "set"].includes(result.operation)) {
        result.multiplier = numeric(input.multiplier, 2, 1, 100, "Le multiplicateur", { integer: false });
      }
    } else if (result.overlayKey === "winCounter" && result.operation === "multiplier") {
      result.multiplier = numeric(input.multiplier, 2, 1, 100, "Le multiplicateur", { integer: false });
      result.seconds = numeric(input.seconds, 60, 1, 3600, "La durée du multiplicateur");
    } else if (["adjust", "set", "random"].includes(result.operation)) {
      const maximum = result.overlayKey === "winCounter" ? 100000 : 100000000;
      result.amount = numeric(input.amount, 0, -maximum, maximum, "La valeur du compteur");
      if (["likeGoal", "coinJar"].includes(result.overlayKey) && result.operation === "set" && result.amount < 0) {
        throw new Error("La valeur définie ne peut pas être négative.");
      }
    }
    return result;
  }

  function normalizeCommandExecution(input, { actions, wheels } = {}) {
    if (input == null) return null;
    if (!plainObject(input)) throw new Error("Une exécution de commande valide est requise.");
    if (input.type === "music") return normalizeMusic(input);
    if (input.type === "overlay") return normalizeOverlay(input, { wheels });
    if (input.type === "action") {
      const actionId = text(input.actionId, 160, "La référence d'action", { required: true });
      if (Array.isArray(actions) && !actions.some((action) => action.id === actionId)) throw new Error("L'action choisie est introuvable dans ce profil.");
      return { type: "action", actionId };
    }
    throw new Error("La commande doit cibler la musique, une action ou un overlay.");
  }

  /** Description française sans effet, utilisable dans une liste ou un aperçu.
   * Les intitulés personnalisés proviennent uniquement des références fournies.
   */
  function describeCommandExecution(input, options = {}) {
    const execution = normalizeCommandExecution(input);
    if (!execution) return "Réponse dans le chat";
    if (execution.type === "action") {
      const action = options.actions?.find((item) => item.id === execution.actionId);
      return `Déclencher l'action : ${action?.name || execution.actionId}`;
    }
    if (execution.type === "music") {
      const labels = { requests_add: "Demander un titre", requests_skip: "Passer une demande", requests_current: "Titre en cours", requests_list: "Voir les demandes", next: "Passer au morceau suivant", previous: "Revenir au morceau précédent", play: "Lancer la musique", pause: "Mettre la musique en pause", queue: "Ajouter un titre à la file", play_track: "Lire un titre", play_playlist: "Lancer une playlist", volume: "Régler le volume" };
      const detail = execution.useArgs ? "titre fourni après la commande" : execution.query || execution.uri;
      return `${labels[execution.operation]}${execution.operation === "volume" ? ` : ${execution.volume} %` : detail ? ` : ${detail}` : ""}`;
    }
    const overlays = { timer: "Chronomètre", winCounter: "Compteur de victoires", likeGoal: "Objectif de likes", coinJar: "Pot de diamants", wheel: "Roue", multiplierTimer: "Chronomètre multiplicateur" };
    const operations = { add: "ajouter du temps", remove: "retirer du temps", set: "définir la valeur", pause: "mettre en pause", resume: "reprendre", reset: "réinitialiser", adjust: "modifier la valeur", multiplier: "activer un multiplicateur", random: "ajuster aléatoirement", spin: "faire tourner" };
    const value = execution.multiplier != null ? ` ×${execution.multiplier}${execution.seconds != null ? ` pendant ${execution.seconds} s` : ""}` : execution.seconds != null ? ` (${execution.seconds} s)` : execution.amount != null ? ` (${execution.amount > 0 ? "+" : ""}${execution.amount})` : "";
    const wheel = execution.wheelId && options.wheels?.find((item) => item.id === execution.wheelId);
    return `${overlays[execution.overlayKey]} : ${operations[execution.operation]}${value}${wheel ? ` — ${wheel.name || wheel.id}` : ""}`;
  }

  return Object.freeze({ MUSIC_OPERATIONS, OVERLAY_OPERATIONS, MAX_TIMER_SECONDS, normalizeCommandExecution, describeCommandExecution });
});
