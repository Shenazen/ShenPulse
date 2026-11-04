(function (root, factory) {
  "use strict";
  const seed = typeof module === "object" && module.exports ? require("./tts-voice-catalog") : root.ShenPulseTtsCatalog;
  const contract = factory(seed);
  if (typeof module === "object" && module.exports) module.exports = contract;
  else root.ShenPulseTtsVoices = contract;
})(typeof globalThis === "object" ? globalThis : this, function (seed) {
  "use strict";
  const NATURAL_VOICES = Object.freeze([
    ["fr-FR-DeniseNeural", "Denise · Français", "fr-FR"],
    ["fr-FR-HenriNeural", "Henri · Français", "fr-FR"],
    ["fr-CA-SylvieNeural", "Sylvie · Français canadien", "fr-CA"],
    ["fr-CA-AntoineNeural", "Antoine · Français canadien", "fr-CA"],
    ["fr-BE-CharlineNeural", "Charline · Français belge", "fr-BE"],
    ["fr-BE-GerardNeural", "Gérard · Français belge", "fr-BE"],
    ["fr-CH-ArianeNeural", "Ariane · Français suisse", "fr-CH"],
    ["fr-CH-FabriceNeural", "Fabrice · Français suisse", "fr-CH"],
    ["en-US-JennyNeural", "Jenny · Anglais américain", "en-US"],
    ["en-US-GuyNeural", "Guy · Anglais américain", "en-US"],
    ["en-GB-SoniaNeural", "Sonia · Anglais britannique", "en-GB"],
    ["es-ES-ElviraNeural", "Elvira · Espagnol", "es-ES"],
    ["de-DE-KatjaNeural", "Katja · Allemand", "de-DE"],
    ["pt-BR-FranciscaNeural", "Francisca · Portugais brésilien", "pt-BR"]
  ].map(([name, label, lang]) => Object.freeze({ id: `natural:${name}`, name, label, lang })));
  let catalog = NATURAL_VOICES;
  function installCatalog(entries) {
    if (!Array.isArray(entries)) return catalog;
    const valid = entries.slice(0, 2000).filter((entry) =>
      /^[a-z]{2,3}-[A-Za-z0-9-]{2,25}-[A-Za-z0-9]+Neural$/.test(entry?.name || "") &&
      /^[a-z]{2,3}-[A-Za-z0-9-]{2,25}$/.test(entry?.lang || "") &&
      entry.name.startsWith(entry.lang + "-") && typeof entry.label === "string"
    ).map((entry) => Object.freeze({ id: `natural:${entry.name}`, name: entry.name, lang: entry.lang, label: entry.label.slice(0, 160) }));
    if (valid.length) catalog = Object.freeze([...new Map([...NATURAL_VOICES, ...valid].map((entry) => [entry.id, entry])).values()]
      .sort((a, b) => Number(!a.lang.startsWith("fr")) - Number(!b.lang.startsWith("fr")) || a.lang.localeCompare(b.lang, "fr") || a.label.localeCompare(b.label, "fr")));
    return catalog;
  }
  installCatalog(seed);
  const naturalVoice = (id) => catalog.find((voice) => voice.id === id);
  const voiceLabel = (id) => naturalVoice(id)?.label || (id === "random:fr" ? "Voix française par viewer" : id || "Voix Windows par défaut");
  const viewerName = (name) => String(name || "").trim().replace(/^@/, "").toLowerCase().slice(0, 80);
  function normalizeAssignments(input = {}) {
    const roles = {};
    for (const key of ["moderator", "subscriber", "team"]) {
      if (typeof input.roles?.[key] === "string") roles[key] = input.roles[key].slice(0, 200);
    }
    const viewers = (Array.isArray(input.viewers) ? input.viewers : []).slice(0, 100)
      .filter((entry) => viewerName(entry?.username) && typeof entry?.voice === "string" && entry.voice.trim())
      .map((entry) => ({ username: viewerName(entry.username), voice: entry.voice.slice(0, 200) }));
    return { roles, viewers: [...new Map(viewers.map((entry) => [entry.username, entry])).values()] };
  }
  function resolveVoice(settings = {}, config = {}, user = {}) {
    const assignments = normalizeAssignments(settings.assignments);
    const own = assignments.viewers.find((entry) => entry.username === viewerName(user.name));
    let voice = own?.voice || (user.moderator && assignments.roles.moderator) ||
      (user.subscriber && assignments.roles.subscriber) || (Number(user.teamLevel) > 0 && assignments.roles.team) ||
      config.voice || settings.voice || "";
    if (voice === "random:fr") {
      const pool = NATURAL_VOICES.filter((entry) => entry.lang.startsWith("fr"));
      let hash = 0;
      for (const char of String(user.id || viewerName(user.name) || "viewer")) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
      voice = pool[hash % pool.length].id;
    }
    return String(voice).slice(0, 200);
  }
  return Object.freeze({ get NATURAL_VOICES() { return catalog; }, installCatalog, naturalVoice, voiceLabel, normalizeAssignments, resolveVoice });
});
