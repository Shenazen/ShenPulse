"use strict";

/** Sorties des Matchs : mêmes bibliothèques et mêmes gardes que l’éditeur.
 * Une modification visuelle ajoute/remplace sa sortie sans effacer les autres.
 * Rendre ces cartes ne joue jamais un son, une vidéo ou une action.
 */
function creatorMatchesReactionOutputs(reaction) {
  if (!reaction || typeof reaction !== "object") return [];
  return reaction.type === "bundle" ? (Array.isArray(reaction.reactions) ? reaction.reactions : []) : [reaction];
}

function creatorMatchesOutput(entry, type) {
  return creatorMatchesReactionOutputs(entry?.reaction).find((output) => output.type === type) || null;
}

/** Variantes réellement livrées, partagées par les cartes et les formulaires. */
function creatorMatchesVariantRows(match) {
  return globalThis.ShenPulseOverlayMatchCatalog.animationVariants(match);
}

function creatorMatchesAnimationLabel(match, variant, fallback = "Animation") {
  const row = creatorMatchesAnimationRows().find((entry) => entry[2] === match);
  const name = String(row?.[1] || fallback).replace(/^Match\s*/, "");
  const pack = creatorMatchesVariantRows(match).find(([id]) => id === variant)?.[1] || "Indisponible";
  const cyberNames = { guantes: "Gant de boxe", taptap: "Tap Tap", quiereme: "Merci pour ton cœur" };
  return variant === "cyber" ? `${cyberNames[match] || name} - ${pack}` : `${name} · ${pack}`;
}

function creatorMatchesSyncVariantSelect(editor) {
  const animation = editor.querySelector('[name="matchAnimation"]');
  const select = editor.querySelector('[name="matchVariant"]');
  if (!animation || !select) return;
  const previous = select.value;
  const options = creatorMatchesVariantRows(animation.value);
  select.innerHTML = options.map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join("");
  select.value = options.some(([id]) => id === previous) ? previous : "tikcontrol";
}

function creatorMatchesOutputDraft(entry, moment) {
  return entry || { ...creatorMatchesAutomationDefault(moment), reaction: { type: "bundle", reactions: [] } };
}

function creatorMatchesReplaceOutput(current, type, output) {
  const reactions = creatorMatchesReactionOutputs(current.reaction).filter((reaction) => reaction.type !== type);
  if (output) reactions.push(output);
  return { ...current, id: current.id || `match_auto_${current.moment}_${cryptoId()}`, enabled: reactions.length ? current.enabled === true : false,
    reaction: { type: "bundle", reactions } };
}

function creatorMatchesReactionReady(entry) {
  const outputs = creatorMatchesReactionOutputs(entry?.reaction);
  if (!outputs.length) return false;
  return outputs.every((reaction) => {
    try { ShenPulseMatches.normalizeReaction(reaction); } catch { return false; }
    return reaction.type !== "action" || creatorCommandActionRows().some(({ action }) => String(action.id) === String(reaction.actionId));
  });
}

function creatorMatchesAutomationIcon(kind) {
  const paths = {
    video: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18m10-18v18M3 8h4m10 0h4M3 16h4m10 0h4m-10-8 4 3-4 3V8Z"/>',
    sound: '<path d="m4 9 5 0 5-4v14l-5-4H4V9Zm13-2a7 7 0 0 1 0 10m2-13a11 11 0 0 1 0 16"/>',
    magic: '<path d="m4 20 12-12 4 4-12 12-4-4ZM13 11l4 4M5 3v4M3 5h4m13-4v4m-2-2h4M9 2v2m-1-1h2"/>',
    flag: '<path d="M5 21V3m0 1c5-4 9 5 14 0v10c-5 5-9-4-14 0M9 3v10m5-8v10"/>',
    flame: '<path d="M12 3c2 5-3 6-1 10 1-2 4-3 4-6 8 9 4 14-3 14S2 15 7 9c0 3 2 3 2 3-2-4 3-5 3-9Z"/>',
    tap: '<path d="M8 12V5a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v4-2a2 2 0 0 1 4 0v6c0 3-3 5-6 5H9L3 14a2 2 0 0 1 3-2l2 2"/>'
  };
  return paths[kind] ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>` : creatorMatchesIcon(kind);
}

const CREATOR_MATCH_CARD_PRESENTATION = Object.freeze({
  battleStart: ["Début du match", "Le match commence.", "flag", "#dc2626", "Votre vidéo d’entrée « C’est parti ! » pour chauffer votre communauté."],
  multiplierX2: ["Multiplicateur ×2 / ×3", "Votre bonus ×2 ou ×3 est confirmé par TikTok.", "bolt", "#f59e0b", "Un clip « ENVOYEZ TOUT ! » quand votre bonus de cadeaux est réellement actif."],
  card: ["Carte posée", "Un gant, une brume, un marteau ou du temps supplémentaire.", "card", "#ea580c", "Une vidéo de gants de boxe quand la carte est réellement reçue."],
  lead: ["Tu passes devant", "Tu reprends la tête au score.", "up", "#059669", "Un son de foule quand vous repassez devant."],
  comeback: ["Grosse remontée", "Tu reviens après avoir été largement derrière.", "flame", "#9333ea", "Un clip « LA REMONTADA » pour célébrer votre retour."],
  tieEnd: ["Égalité en fin de match", "Scores à égalité dans la dernière minute.", "equal", "#6351ed", "Un son de suspense pour pousser au dernier cadeau."],
  likeRush: ["Tap Tap", "Tes viewers tapotent l’écran pendant le match.", "tap", "#0891b2", "Une vidéo « TAP TAP ! » quand les likes s’envolent."],
  snipe: ["Snipe · dernières secondes", "Une alerte avant la fin de la manche.", "clock", "#dc2626", "Une vidéo « SNIPE ! » dans les derniers instants."],
  victory: ["Victoire", "TikTok confirme la manche gagnée.", "trophy", "#ca8a04", "Célébrez votre victoire avec une animation et votre musique."],
  defeat: ["Défaite", "TikTok confirme la manche perdue.", "shield", "#64748b", "Un effet de fin de manche pour préparer la revanche."]
});

function creatorMatchesAnimationSelect(entry, moment, label = "Animation Premium") {
  const reaction = creatorMatchesOutput(entry, "animation");
  const value = reaction ? `${reaction.match}:${reaction.variant || "tikcontrol"}` : "";
  const data = entry ? `data-id="${escapeHtml(entry.id)}"` : `data-moment="${escapeHtml(moment)}"`;
  const options = [["", "Aucune animation"], ...creatorMatchesAnimationRows().flatMap(([, name, match]) =>
    creatorMatchesVariantRows(match).map(([variant]) => [`${match}:${variant}`, creatorMatchesAnimationLabel(match, variant, name)]))];
  return `<label class="matches-automation-effect"><span>${creatorMatchesAutomationIcon("magic")}${escapeHtml(label)}</span><select class="matches-automation-select" data-action="matches-automation-animation" ${data} aria-label="${escapeHtml(label)} · ${escapeHtml(CREATOR_MATCH_MOMENT_LABELS[moment][0])}">${options.map(([id, name]) => `<option value="${escapeHtml(id)}" ${id === value ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}</select></label>`;
}

function creatorMatchesMediaTiles(entry, moment, suffix = "", groupEntries = null) {
  const data = groupEntries ? `data-ids="${escapeHtml(JSON.stringify(groupEntries.map((item) => item.id)))}"` : entry ? `data-id="${escapeHtml(entry.id)}"` : `data-moment="${escapeHtml(moment)}"`;
  return `<div class="matches-media-tiles">${[["media", "video", "Ajouter une vidéo", "plein écran sur votre live"], ["sound", "sound", "Ajouter un son", "depuis votre bibliothèque"]].map(([type, icon, label, detail]) => {
    const output = groupEntries ? groupEntries.some((item) => creatorMatchesOutput(item, type)) : creatorMatchesOutput(entry, type);
    return `<button type="button" class="matches-media-tile ${output ? "is-configured" : ""}" data-action="${groupEntries ? "matches-automation-group-output" : "matches-automation-output"}" data-output="${type}" ${data}>${creatorMatchesAutomationIcon(icon)}<strong>${output ? `${type === "media" ? "Modifier la vidéo" : "Modifier le son"}${suffix}` : `${label}${suffix}`}</strong><small>${output ? "Sortie configurée · modifier ou retirer" : detail}</small></button>`;
  }).join("")}</div>`;
}

function openCreatorMatchesOutputEditor(entry, moment, type, groupEntries = null) {
  if (!["media", "sound"].includes(type)) throw new Error("Sortie de match invalide.");
  const owner = creatorMatchesCaptureOwner();
  const current = creatorMatchesOutputDraft(entry, moment);
  const output = creatorMatchesOutput(current, type) || {};
  const bonus = groupEntries ? selectFieldMarkup("matchOutputBonus", "Appliquer cette sortie", "both", [["both", "Aux bonus ×2 et ×3"], ["multiplierX2", "Au bonus ×2 uniquement"], ["multiplierX3", "Au bonus ×3 uniquement"]], { full: true }) : "";
  const fields = type === "media"
    ? `${mediaPickerField("matchOutputUrl", "Vidéo, image ou animation", output.mediaUrl || "", "", { optional: true })}${field("matchOutputDuration", "Durée (secondes)", Number(output.durationMs || 5000) / 1000, "number", 'min="0.5" max="60" step="0.5"')}${soundPickerField("matchOutputMediaSound", output.soundUrl || "", { label: "Accompagnement optionnel", optional: true })}`
    : `${soundPickerField("matchOutputUrl", output.url || "", { label: "Son de votre bibliothèque", optional: true })}${field("matchOutputVolume", "Volume (%)", Math.round(Number(output.volume ?? 1) * 100), "number", 'min="0" max="100" step="1"')}${selectFieldMarkup("matchOutputMode", "Sortie du son", output.outputMode || "live", [["live", "Source Match du LIVE"], ["local", "Lecture sur cet ordinateur"]])}`;
  openEditor({ title: type === "media" ? "Vidéo du temps fort" : "Son du temps fort", kicker: `MATCHS · ${CREATOR_MATCH_MOMENT_LABELS[current.moment][0]}`, successMessage: "Sortie de match enregistrée",
    body: `<div class="form-grid">${bonus}${fields}<p class="matches-editor-note full">La vidéo et le son LIVE utilisent la source Match protégée, comme les animations. Les autres sorties sont conservées${groupEntries ? " ; chaque bonus reste une automatisation distincte et conserve son activation" : ""}. Retirez la sélection pour supprimer uniquement cette sortie. Enregistrer ne joue aucun effet.</p></div>`,
    onSubmit: async (data) => {
      assertCreatorMatchesOwner(owner);
      const url = String(data.get("matchOutputUrl") || "").trim();
      const mode = groupEntries ? String(data.get("matchOutputBonus") || "") : "";
      if (groupEntries && !["both", "multiplierX2", "multiplierX3"].includes(mode)) throw new Error("Choisissez les bonus auxquels appliquer cette sortie.");
      const destinations = groupEntries ? ["multiplierX2", "multiplierX3"].filter((id) => mode === "both" || mode === id).map((id) => creatorMatchesOutputDraft(groupEntries.find((item) => item.moment === id), id)) : [current];
      let result;
      for (const destination of destinations) {
        assertCreatorMatchesOwner(owner);
        const screen = creatorMatchesOutput(destination, type)?.screen || 1;
        const reaction = !url ? null : type === "media"
          ? { type, mediaUrl: url, soundUrl: String(data.get("matchOutputMediaSound") || ""), durationMs: Number(data.get("matchOutputDuration")) * 1000, screen }
          : { type, url, volume: Number(data.get("matchOutputVolume")) / 100, outputMode: String(data.get("matchOutputMode") || "live"), screen };
        result = await api.matches.saveAutomation(creatorMatchesReplaceOutput(destination, type, reaction), creatorMatchesApiScope(owner));
      }
      creatorMatchesAcceptResult(result, owner);
    } });
}
