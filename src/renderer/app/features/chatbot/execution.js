"use strict";

/**
 * Champs et descriptions des effets des commandes. Toutes ces fonctions sont
 * locales : sélectionner ou prévisualiser un effet n'exécute jamais une action.
 * Les cibles viennent exclusivement du compte et du profil actuellement visibles.
 */
const CREATOR_COMMAND_MUSIC_LABELS = Object.freeze({
  requests_add: "Demander un titre (Song Requests)", requests_skip: "Passer une demande (Song Requests)", requests_current: "Titre en cours (Song Requests)", requests_list: "Voir les demandes (Song Requests)",
  next: "Passer au titre suivant", previous: "Revenir au titre précédent", play: "Lancer / reprendre la musique", pause: "Mettre la musique en pause",
  queue: "Ajouter un titre à la file", play_track: "Choisir et jouer un titre", play_playlist: "Lancer une playlist", volume: "Régler le volume"
});
const CREATOR_COMMAND_OVERLAY_LABELS = Object.freeze({ timer: "Minuteur", winCounter: "Compteur de victoires", likeGoal: "Objectif de likes", coinJar: "Bocal de pièces", wheel: "Roue", multiplierTimer: "Minuteur multiplicateur" });
const CREATOR_COMMAND_OPERATION_LABELS = Object.freeze({ add: "Ajouter du temps", remove: "Retirer du temps", set: "Définir une valeur", pause: "Mettre en pause", resume: "Reprendre", reset: "Remettre à zéro", adjust: "Ajouter / retirer une valeur", multiplier: "Multiplier les victoires", random: "Variation aléatoire des victoires", spin: "Lancer la roue" });

function creatorCommandEffectType(entry) {
  return entry?.execution?.type || "music";
}

function creatorCommandDefaultEffect(type = "music") {
  return type === "action" ? { type, actionId: "" } : type === "overlay" ? { type, overlayKey: "timer", operation: "add", seconds: 30 } : { type: "music", operation: "next", useArgs: false };
}

function creatorCommandActionRows() {
  const state = snapshot?.state || {};
  const profile = (state.profiles || []).find((entry) => entry.id === state.session?.profileId);
  const enabledIds = profile?.enabledRuleIds ? new Set(profile.enabledRuleIds) : null;
  const localRows = typeof flattenActions === "function" ? flattenActions() : (state.rules || []).flatMap((rule) => (rule.actions || []).map((action) => ({ rule, action })));
  const game = state.session?.game || {};
  // Comme le moteur principal, seuls les effets du jeu démarré dans ce profil
  // sont disponibles. Les règles de jeu n'utilisent pas enabledRuleIds.
  const gameRules = game.running === true && game.packId && game.profileId === state.session?.profileId
    ? state.game?.interactionRulesByPack?.[game.packId] || [] : [];
  const rows = [...localRows.filter(({ rule }) => !enabledIds || enabledIds.has(rule.id)),
    ...(Array.isArray(gameRules) ? gameRules : []).flatMap((rule) => (rule.actions || []).map((action) => ({ rule, action })))];
  // Deux actions portant le même identifiant sont ambiguës : aucune n'est proposée.
  const counts = new Map();
  for (const row of rows) counts.set(String(row.action.id), (counts.get(String(row.action.id)) || 0) + 1);
  const available = rows.filter(({ rule, action }) => rule.enabled === true && action.enabled !== false && action.id && (typeof canAccessActionType !== "function" || canAccessActionType(action.type)));
  return available.filter(({ action }) => counts.get(String(action.id)) === 1);
}

function creatorCommandWheels() {
  const config = typeof overlayConfig === "function" ? overlayConfig("wheel") : snapshot?.state?.settings?.overlayConfigs?.wheel || {};
  // Les anciennes configurations peuvent contenir deux roues de même ID.
  // Le moteur utilise la première active : ne pas proposer une seconde cible
  // que cet identifiant ne permettrait jamais de sélectionner.
  const ids = new Set();
  return (config.wheels || []).filter((wheel) => {
    if (wheel.enabled === false || !wheel.id || ids.has(wheel.id)) return false;
    ids.add(wheel.id); return true;
  });
}

function creatorCommandWheelAvailability(effect) {
  const config = typeof overlayConfig === "function" ? overlayConfig("wheel") : snapshot?.state?.settings?.overlayConfigs?.wheel || {};
  const wheels = creatorCommandWheels();
  const wheel = effect.wheelId ? wheels.find((entry) => entry.id === effect.wheelId)
    : wheels.find((entry) => entry.id === config.selectedWheelId) || wheels[0];
  const available = new Set(creatorCommandActionRows().map(({ action }) => String(action.id)));
  const unavailable = (wheel?.segments || []).filter((segment) => segment.action !== "spin" && segment.actionId && !available.has(String(segment.actionId))).length;
  return { wheel, unavailable };
}

function creatorCommandEffectDescription(entry) {
  const effect = entry?.execution;
  if (!effect) return "Choisissez un effet de musique, d'action ou d'overlay.";
  if (effect.type === "action") {
    const row = creatorCommandActionRows().find(({ action }) => String(action.id) === String(effect.actionId));
    return row ? `Déclencher : ${row.rule.name || "Action"} · ${typeof actionTypeLabel === "function" ? actionTypeLabel(row.action.type) : row.action.type}` : "Action indisponible dans ce profil : choisissez une action active.";
  }
  let description;
  try { description = typeof ShenPulseCommandExecution !== "undefined" ? ShenPulseCommandExecution.describeCommandExecution(effect) : "Effet de la commande"; }
  catch (error) { return `À compléter : ${error.message}`; }
  if (effect.type === "overlay" && effect.overlayKey === "wheel") {
    const { wheel, unavailable } = creatorCommandWheelAvailability(effect);
    return wheel ? `${description} · ${wheel.name || "Roue"}${unavailable ? ` · ${unavailable} secteur(s) avec une action indisponible : la roue tourne, mais ces actions ne seront pas lancées.` : ""}` : effect.wheelId ? `${description} · roue indisponible` : description;
  }
  return description;
}

function creatorCommandSelection(name, label, selected, rows, missingLabel) {
  const options = [["", "Choisir…"], ...rows];
  // Une référence ancienne manquante est visible et conservée, jamais remplacée
  // silencieusement par la première cible de la liste.
  if (selected && !rows.some(([value]) => String(value) === String(selected))) options.push([selected, missingLabel]);
  return selectFieldMarkup(name, label, selected || "", options, { full: true });
}

function creatorCommandEffectFromForm(data, current = {}, forcedType) {
  const read = (name, fallback = "") => data.has(name) ? String(data.get(name) || "").trim() : fallback;
  const type = forcedType || read("executionType", creatorCommandEffectType(current));
  if (!["music", "action", "overlay"].includes(type)) throw new Error("La commande doit cibler la musique, une action ou un overlay.");
  const previous = current.execution?.type === type ? current.execution : creatorCommandDefaultEffect(type);
  if (type === "action") return { type, actionId: read("executionActionId", previous.actionId || "") };
  const operation = read("executionOperation", previous.operation);
  if (type === "music") {
    const result = { type, operation };
    if (["queue", "play_track"].includes(operation)) Object.assign(result, { useArgs: data.has("executionUseArgs"), query: read("executionQuery", previous.query || ""), uri: read("executionUri", previous.uri || "") });
    if (operation === "play_playlist") {
      const reference = read("executionPlaylistId", previous.playlistId || previous.uri || "");
      if (/^[A-Za-z0-9]{22}$/.test(reference)) result.playlistId = reference;
      else result.uri = reference;
    }
    if (operation === "volume") result.volume = Number(read("executionVolume", previous.volume ?? 50));
    return result;
  }
  const overlayKey = read("executionOverlayKey", previous.overlayKey || "timer");
  const result = { type, overlayKey, operation };
  if (["timer", "multiplierTimer"].includes(overlayKey) && ["add", "remove", "set"].includes(operation)) result.seconds = Number(read("executionSeconds", previous.seconds ?? 30));
  if (["winCounter", "likeGoal", "coinJar"].includes(overlayKey) && ["adjust", "set", "random"].includes(operation)) result.amount = Number(read("executionAmount", previous.amount ?? 1));
  if (operation === "multiplier" || overlayKey === "multiplierTimer" && ["add", "set"].includes(operation)) result.multiplier = Number(read("executionMultiplier", previous.multiplier ?? 2));
  if (overlayKey === "winCounter" && operation === "multiplier") result.seconds = Number(read("executionSeconds", previous.seconds ?? 60));
  if (overlayKey === "wheel") result.wheelId = read("executionWheelId", previous.wheelId || "");
  return result;
}

function creatorCommandEffectFields(entry) {
  const type = creatorCommandEffectType(entry);
  const effect = entry.execution || creatorCommandDefaultEffect();
  if (!["music", "action", "overlay"].includes(type)) throw new Error("La commande doit cibler la musique, une action ou un overlay.");
  if (type === "action") {
    const rows = creatorCommandActionRows().map(({ rule, action }) => [action.id, `${rule.name || "Action"} · ${typeof actionTypeLabel === "function" ? actionTypeLabel(action.type) : action.type}`]);
    return `${creatorCommandSelection("executionActionId", "Action à déclencher", effect.actionId, rows, "Action enregistrée indisponible — à remplacer")}<p class="chatbot-editor-note chatbot-effect-warning full">Cette commande lance réellement l'action sélectionnée, y compris ses effets de jeu, sons ou appareils IRL. Réservez les effets sensibles aux modérateurs et conservez un cooldown.</p>${!rows.length ? '<p class="chatbot-editor-note full">Aucune action active disponible. Créez ou activez une action dans l’onglet Actions, puis revenez ici.</p>' : ""}`;
  }
  if (type === "music") {
    const operation = effect.operation || "next";
    const operations = Object.entries(CREATOR_COMMAND_MUSIC_LABELS);
    let fields = selectFieldMarkup("executionOperation", "Commande musicale", operation, operations, { full: true });
    if (["queue", "play_track"].includes(operation)) fields += `<label class="chatbot-effect-check full"><input type="checkbox" name="executionUseArgs" ${effect.useArgs ? "checked" : ""}><span>Utiliser le titre saisi après la commande <small>Exemple : !song nom du titre ou lien Spotify</small></span></label>${field("executionQuery", "Titre / artiste fixe (optionnel)", effect.query || "", "text", 'maxlength="200" full')}${field("executionUri", "Lien ou URI Spotify fixe (optionnel)", effect.uri || "", "text", 'maxlength="300" full spellcheck="false"')}<p class="chatbot-editor-note full">Activez les arguments pour laisser le viewer choisir. Sinon, renseignez un titre ou un lien Spotify fixe.</p>`;
    if (operation === "play_playlist") fields += field("executionPlaylistId", "Lien, URI ou identifiant de la playlist Spotify", effect.playlistId || effect.uri || "", "text", 'maxlength="400" required full spellcheck="false"');
    if (operation === "volume") fields += field("executionVolume", "Volume (%)", effect.volume ?? 50, "number", 'min="0" max="100" step="1" required full');
    return `${fields}<p class="chatbot-editor-note full">Spotify doit être connecté et un appareil de lecture disponible. Les conditions Spotify habituelles s'appliquent ; la commande ne connecte ni n'abonne le compte automatiquement.</p>`;
  }
  const key = effect.overlayKey || "timer";
  const allowed = typeof ShenPulseCommandExecution !== "undefined" ? ShenPulseCommandExecution.OVERLAY_OPERATIONS[key] || [] : ["add", "set", "pause", "resume", "reset"];
  const operation = allowed.includes(effect.operation) ? effect.operation : allowed[0];
  let fields = selectFieldMarkup("executionOverlayKey", "Overlay à contrôler", key, Object.entries(CREATOR_COMMAND_OVERLAY_LABELS), { full: true });
  fields += selectFieldMarkup("executionOperation", "Modification", operation, allowed.map((value) => [value, CREATOR_COMMAND_OPERATION_LABELS[value] || value]), { full: true });
  if (["timer", "multiplierTimer"].includes(key) && ["add", "remove", "set"].includes(operation)) fields += field("executionSeconds", "Durée (secondes)", effect.seconds ?? 30, "number", 'min="0" max="86400" step="1" required');
  if (["winCounter", "likeGoal", "coinJar"].includes(key) && ["adjust", "set", "random"].includes(operation)) fields += field("executionAmount", operation === "random" ? "Amplitude de la variation (±)" : "Valeur", effect.amount ?? 1, "number", 'min="-1000000" max="1000000" step="1" required');
  if (operation === "multiplier" || key === "multiplierTimer" && ["add", "set"].includes(operation)) fields += field("executionMultiplier", "Multiplicateur", effect.multiplier ?? 2, "number", 'min="1" max="5" step="1" required');
  if (key === "winCounter" && operation === "multiplier") fields += field("executionSeconds", "Durée du multiplicateur (secondes)", effect.seconds ?? 60, "number", 'min="1" max="3600" step="1" required');
  if (key === "wheel") fields += creatorCommandSelection("executionWheelId", "Roue à lancer", effect.wheelId, creatorCommandWheels().map((wheel) => [wheel.id, wheel.name || "Roue"]), "Roue enregistrée indisponible — à remplacer");
  return `${fields}<p class="chatbot-editor-note full">L'overlay doit être configuré et ajouté à votre scène pour être visible. Une roue peut déclencher les actions de ses segments : vérifiez ses réglages et limitez l'accès aux effets sensibles. Les actions désactivées, supprimées ou hors du profil ne sont jamais réactivées par une commande.</p>`;
}

function creatorCommandEffectSection(entry) {
  return `${selectFieldMarkup("executionType", "Ce que fait la commande", creatorCommandEffectType(entry), [["music", "Musique · contrôler Spotify"], ["action", "Action · lancer une action ShenPulse"], ["overlay", "Overlay · modifier votre scène"]], { full: true })}<div class="chatbot-effect-fields full form-grid" data-command-effect-fields>${creatorCommandEffectFields(entry)}</div>`;
}

/** Conserve les brouillons par type/operation sans reconstruire le formulaire. */
function syncCreatorCommandEffectDraft(editor, data) {
  if (editor.dataset.chatbotEditor !== "command") return;
  const fields = editor.querySelector("[data-command-effect-fields]");
  const focusedField = fields?.contains(document.activeElement) ? document.activeElement.name : "";
  const initial = editor._commandInitial || { kind: "command" };
  const oldType = editor.dataset.commandEffectType || creatorCommandEffectType(initial);
  const nextType = String(data.get("executionType") || oldType);
  const oldEffect = creatorCommandEffectFromForm(data, { execution: editor._commandEffect || initial.execution }, oldType);
  const cache = editor._commandDrafts || (editor._commandDrafts = {});
  const descriptor = (effect) => `${effect.type}:${effect.overlayKey || ""}:${effect.operation || ""}`;
  const previousSignature = editor.dataset.commandEffectSignature;
  // Le précédent brouillon a été mis à jour à chaque saisie, avant que le
  // sélecteur ne change. Les champs masqués ne sont pas perdus en revenant.
  if (editor._commandEffect && previousSignature !== descriptor(oldEffect)) cache[previousSignature] = { ...editor._commandEffect };
  let effect = oldEffect;
  let redraw = oldType !== nextType;
  if (redraw) {
    cache[oldType] = { execution: oldEffect };
    const next = cache[nextType] || { execution: creatorCommandDefaultEffect(nextType) };
    effect = next.execution;
    editor.querySelector("[data-command-effect-fields]").innerHTML = creatorCommandEffectFields(next);
  } else if (effect && previousSignature !== descriptor(effect)) {
    redraw = true;
    effect = cache[descriptor(effect)] || effect;
    editor.querySelector("[data-command-effect-fields]").innerHTML = creatorCommandEffectFields({ execution: effect });
  }
  editor.dataset.commandEffectType = nextType;
  editor._commandEffect = effect;
  // Relecture après rendu : un autre overlay peut ne pas accepter l'opération
  // précédente ; le sélecteur affiche alors sa première opération autorisée.
  if (redraw) effect = creatorCommandEffectFromForm(new FormData(dialogForm), { execution: effect });
  editor._commandEffect = effect;
  editor.dataset.commandEffectSignature = descriptor(effect);
  if (redraw && typeof applyStudioLanguage === "function") applyStudioLanguage(editor.querySelector("[data-command-effect-fields]"));
  if (redraw && focusedField) [...fields.querySelectorAll("[name]")].find((entry) => entry.name === focusedField)?.focus();
}
