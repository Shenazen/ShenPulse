"use strict";

/** Formulaires Matchs : bibliothèques existantes, cible explicite, aucun effet au rendu. */
function creatorMatchesCaptureOwner() {
  const owner = { ...captureCreatorPrivateOperation(), profileId: String(snapshot?.state?.session?.profileId || "") };
  assertCreatorMatchesOwner(owner);
  return owner;
}

function assertCreatorMatchesOwner(owner) {
  assertCreatorPrivateOperation(owner);
  if (owner.profileId !== String(snapshot?.state?.session?.profileId || "")) throw new Error("Le profil a changé pendant cette opération. Recommencez depuis le profil actuel.");
  if (!hasProAccess() || !canNavigateTo("matches")) throw new Error("Un accès Pro ou Premium actif est requis pour les Matchs.");
}

function creatorMatchesApiScope(owner) { return { ownerUid: owner.uid, profileId: owner.profileId }; }

function openCreatorMatchesWinsEditor() {
  const owner = creatorMatchesCaptureOwner();
  const { runtime } = creatorMatchesModel();
  const value = runtime.rounds?.own ?? runtime.manualWins ?? runtime.session?.wins ?? 0;
  openEditor({ title: "Corriger le compteur de manches", kicker: "MATCHS · PROFIL ACTIF", successMessage: "Compteur de manches corrigé",
    body: `<div class="form-grid">${field("amount", "Vos manches gagnées", value, "number", 'min="0" max="100000" step="1" required full autofocus')}<p class="matches-editor-note full">Corrige la paire de participants identifiée ou le compteur manuel de ce profil. Les victoires confirmées par TikTok et l’historique restent inchangés.</p></div>`,
    onSubmit: async (data) => {
      assertCreatorMatchesOwner(owner);
      const result = await api.matches.adjustWins({ operation: "set", amount: Number(data.get("amount")) }, creatorMatchesApiScope(owner));
      creatorMatchesAcceptResult(result, owner);
    } });
}

function creatorMatchesAnimationRows() {
  return typeof MATCH_OVERLAYS !== "undefined" ? MATCH_OVERLAYS : [];
}

function creatorMatchesReactionDescription(reaction = {}) {
  if (reaction.type === "bundle") return creatorMatchesReactionOutputs(reaction).map(creatorMatchesReactionDescription).join(" + ") || "Aucun effet configuré";
  if (reaction.type === "animation") {
    return creatorMatchesAnimationLabel(reaction.match, reaction.variant || "tikcontrol", "Animation indisponible");
  }
  if (reaction.type === "action") {
    const row = creatorCommandActionRows().find(({ action }) => String(action.id) === String(reaction.actionId));
    return row ? `Action · ${row.rule.name || row.action.id}` : "Action enregistrée indisponible";
  }
  if (reaction.type === "sound") return reaction.outputMode === "live" ? "Son · source Match du LIVE" : "Son · cet ordinateur";
  if (reaction.type === "media") return "Vidéo / média personnel · source Match";
  return "Choisissez un effet";
}

function creatorMatchesAutomationDefault(moment = "battleStart") {
  if (!Object.hasOwn(CREATOR_MATCH_MOMENT_LABELS, moment)) moment = "battleStart";
  return { id: "", name: CREATOR_MATCH_MOMENT_LABELS[moment][0], enabled: false, moment, card: "any", threshold: moment === "comeback" ? 1000 : 300,
    windowSeconds: 5, remainingSeconds: moment === "tieEnd" ? 60 : 30, cooldownMs: 5000,
    reaction: { type: "bundle", reactions: [] } };
}

function creatorMatchesReactionFields(current) {
  const reaction = creatorMatchesReactionOutputs(current.reaction)[0] || { type: "animation", fit: "contain" };
  const animation = creatorMatchesOutput(current, "animation"), compatible = creatorMatchesAnimationCompatible(current.moment, animation);
  const match = creatorMatchesMomentAnimation(current.moment);
  const variants = [["", "Aucun"], ...creatorMatchesAnimationChoices(current.moment).map(([id, label]) => [id.split(":")[1], label])];
  const actions = creatorCommandActionRows().map(({ rule, action }) => [action.id, `${rule.name || "Action"} · ${typeof actionTypeLabel === "function" ? actionTypeLabel(action.type) : action.type}`]);
  if (reaction.actionId && !actions.some(([id]) => String(id) === String(reaction.actionId))) actions.push([reaction.actionId, "Action enregistrée indisponible — à remplacer"]);
  return `${selectFieldMarkup("reactionType", "Effet à déclencher", reaction.type || "animation", [["animation", "Animation de match"], ["media", "Média personnel"], ["sound", "Son"], ["action", "Action enregistrée"]], { full: true })}
    <div class="matches-reaction-fields form-grid full" data-matches-reaction="animation" ${reaction.type !== "animation" ? "hidden" : ""}><input type="hidden" name="matchAnimation" value="${escapeHtml(match)}"><input type="hidden" name="matchAnimationChanged" value="0">${selectFieldMarkup("matchVariant", "Modèle de ce temps fort", compatible ? animation.variant || "tikcontrol" : "", variants, { full: true })}${selectFieldMarkup("matchFit", "Ajustement", animation?.fit || "contain", [["contain", "Vidéo entière"], ["cover", "Remplir la source"]])}<small class="matches-animation-warning full" data-matches-animation-warning ${animation && !compatible ? "" : "hidden"}>L’ancienne animation ne correspond pas à ce temps fort. Elle est conservée tant que vous ne choisissez pas explicitement un modèle compatible ou Aucun.<button type="button" class="button small ghost" data-matches-editor-remove-animation>Retirer l’ancienne animation</button></small><div class="matches-local-animation-preview full" data-matches-editor-animation-preview>${compatible ? creatorMatchesAnimationPreviewMarkup(current.moment, animation, { editor: true }) : ""}</div><p class="matches-editor-note full">Seuls les packs réellement disponibles pour ce temps fort sont proposés. Aucun n’enlève que l’animation : sons, vidéos et actions sont conservés. Choisir un modèle affiche un aperçu local muet, jamais un test sur votre LIVE.</p></div>
    <div class="matches-reaction-fields form-grid full" data-matches-reaction="media" ${reaction.type !== "media" ? "hidden" : ""}>${mediaPickerField("matchMediaUrl", "Média à afficher", reaction.mediaUrl || "", "", { optional: false })}${soundPickerField("matchMediaSound", reaction.soundUrl || "", { label: "Son optionnel", optional: true })}${field("matchMediaDuration", "Durée (secondes)", Number(reaction.durationMs || 5000) / 1000, "number", 'min="0.5" max="60" step="0.5"')}<input type="hidden" name="matchMediaScreen" value="${Math.max(1, Number(reaction.screen) || 1)}"><p class="matches-editor-note full">Le média utilise la même source Match que les animations, sans écran média supplémentaire.</p></div>
    <div class="matches-reaction-fields form-grid full" data-matches-reaction="sound" ${reaction.type !== "sound" ? "hidden" : ""}>${soundPickerField("matchSoundUrl", reaction.url || "", { label: "Son à jouer" })}${field("matchSoundVolume", "Volume (%)", Math.round(Number(reaction.volume ?? 1) * 100), "number", 'min="0" max="100" step="1"')}${selectFieldMarkup("matchSoundOutput", "Sortie du son", reaction.outputMode || "live", [["local", "Lecture sur cet ordinateur"], ["live", "Source Match du LIVE"]])}</div>
    <div class="matches-reaction-fields form-grid full" data-matches-reaction="action" ${reaction.type !== "action" ? "hidden" : ""}>${selectFieldMarkup("matchActionId", "Action du profil actif", reaction.actionId || "", [["", "Choisir une action…"], ...actions], { full: true })}<p class="matches-editor-note full">L’action sera réellement exécutée, y compris ses éventuels effets de jeu ou d’appareil IRL. Les autorisations de l’action restent vérifiées.</p></div>`;
}

function creatorMatchesAutomationFromForm(data, current) {
  const text = (key) => String(data.get(key) || "").trim();
  const type = text("reactionType");
  let reaction;
  if (type === "animation") {
    const old = creatorMatchesOutput(current, "animation"), moment = text("moment");
    if (old && !creatorMatchesAnimationCompatible(current.moment, old) && moment === current.moment &&
      !text("matchVariant") && text("matchAnimationChanged") !== "1") {
      const updated = { ...old, fit: text("matchFit") === "cover" ? "cover" : "contain" };
      reaction = current.reaction.type === "bundle" ? { ...current.reaction, reactions: current.reaction.reactions.map(row => row === old ? updated : row) } : updated;
    }
    else {
      const output = creatorMatchesAnimationFromChoice(moment, text("matchVariant") ? `${text("matchAnimation")}:${text("matchVariant")}` : "", text("matchFit"));
      reaction = creatorMatchesReplaceOutput(current, "animation", output).reaction;
    }
  }
  else if (type === "action") reaction = { type, actionId: text("matchActionId") };
  else if (type === "sound") reaction = { type, url: text("matchSoundUrl"), volume: Number(data.get("matchSoundVolume")) / 100, outputMode: text("matchSoundOutput"), screen: creatorMatchesOutput(current, "sound")?.screen || 1 };
  else if (type === "media") reaction = { type, mediaUrl: text("matchMediaUrl"), soundUrl: text("matchMediaSound"), durationMs: Number(data.get("matchMediaDuration")) * 1000, screen: Number(data.get("matchMediaScreen")) };
  else throw new Error("Choisissez une animation, un média, un son ou une action.");
  if (type !== "animation" && current.reaction?.type === "bundle") {
    const first = creatorMatchesReactionOutputs(current.reaction)[0];
    const others = creatorMatchesReactionOutputs(current.reaction).filter((entry) => entry !== first && entry.type !== reaction.type);
    reaction = { type: "bundle", reactions: [...others, reaction] };
  }
  return ShenPulseMatches.normalizeMatchAutomation({ ...current, id: current.id || `match_auto_${cryptoId()}`, name: text("name"),
    enabled: data.has("enabled") && creatorMatchesReactionOutputs(reaction).length > 0, moment: text("moment"), card: text("matchCard"), threshold: Number(data.get("matchLikeThreshold")),
    windowSeconds: Number(data.get("matchLikeWindow")), remainingSeconds: Number(data.get("matchRemainingSeconds")), cooldownMs: Number(data.get("matchCooldownSeconds")) * 1000, reaction });
}

function openCreatorMatchesAutomationEditor(entry, moment) {
  const owner = creatorMatchesCaptureOwner();
  const current = entry || creatorMatchesAutomationDefault(moment);
  const unavailableCard = creatorMatchesModel().capabilities.cards === false;
  openEditor({ title: entry ? "Modifier l’automatisation" : "Créer une automatisation de match", kicker: "MATCHS · PROFIL ACTIF", variant: "wide", successMessage: "Automatisation enregistrée",
    body: `<div class="matches-editor"><div class="form-grid">${field("name", "Nom", current.name, "text", 'maxlength="100" required full autofocus')}${selectFieldMarkup("moment", "Moment du match", current.moment, Object.entries(CREATOR_MATCH_MOMENT_LABELS).map(([id, [label]]) => [id, label]), { full: true })}
      <div class="form-grid full" data-matches-moment="card" ${current.moment !== "card" ? "hidden" : ""}>${selectFieldMarkup("matchCard", "Carte", current.card || "any", [["any", "Toutes les cartes"], ["glove", "Gants de boxe"], ["fog", "Brume"], ["hammer", "Marteau"], ["time", "Temps supplémentaire"]], { full: true })}<p class="matches-editor-note full">Détection automatique des cartes indisponible avec la connexion actuelle. Le test manuel reste possible.</p></div>
      <div class="form-grid full" data-matches-moment="likeRush,comeback" ${!["likeRush", "comeback"].includes(current.moment) ? "hidden" : ""}>${field("matchLikeThreshold", "Seuil de tapotages / retard en points", current.threshold ?? (current.moment === "comeback" ? 1000 : 300), "number", 'min="1" max="1000000" step="1"')}<div data-matches-moment="likeRush" ${current.moment !== "likeRush" ? "hidden" : ""}>${field("matchLikeWindow", "Fenêtre (secondes)", current.windowSeconds ?? 5, "number", 'min="1" max="60" step="1"')}</div><p class="matches-editor-note full">TapTap : nombre de likes reçus dans la fenêtre. Remontée : retard minimal en points avant de reprendre la tête.</p></div>
      <div class="form-grid full" data-matches-moment="snipe,tieEnd" ${!["snipe", "tieEnd"].includes(current.moment) ? "hidden" : ""}>${field("matchRemainingSeconds", "Fenêtre avant la fin (secondes)", current.remainingSeconds ?? (current.moment === "tieEnd" ? 60 : 30), "number", 'min="1" max="120" step="1"')}</div>
      ${creatorMatchesReactionFields(current)}${field("matchCooldownSeconds", "Délai minimal entre deux déclenchements (s)", Number(current.cooldownMs ?? 5000) / 1000, "number", 'min="0" max="3600" step="0.001" full')}<label class="matches-editor-enabled full"><span><strong>Automatisation active</strong><small>Désactivée par défaut. Enregistrer ne teste pas l’effet.</small></span><span class="switch"><input type="checkbox" name="enabled" ${current.enabled === true ? "checked" : ""} ${current.moment === "card" && unavailableCard ? "disabled" : ""}><span></span></span></label><p class="matches-editor-note full">Les tests doivent être lancés explicitement depuis la carte enregistrée. Aucun événement TikTok n’est simulé et aucun message n’est envoyé au chat.</p></div></div>`,
    onSubmit: async (data) => {
      assertCreatorMatchesOwner(owner);
      const result = await api.matches.saveAutomation(creatorMatchesAutomationFromForm(data, current), creatorMatchesApiScope(owner));
      creatorMatchesAcceptResult(result, owner);
    } });
  const editor = dialog.querySelector(".matches-editor");
  const preview = editor?.querySelector("[data-matches-editor-animation-preview]");
  const updateAnimationPreview = (play = false) => {
    assertCreatorMatchesOwner(owner);
    preview?.shenPulseMatchPreviewDispose?.();
    const selectedMoment = editor.querySelector('[name="moment"]').value;
    const variant = editor.querySelector('[name="matchVariant"]').value;
    const reaction = creatorMatchesAnimationFromChoice(selectedMoment, variant ? `${editor.querySelector('[name="matchAnimation"]').value}:${variant}` : "",
      editor.querySelector('[name="matchFit"]').value);
    if (preview) preview.innerHTML = reaction ? creatorMatchesAnimationPreviewMarkup(selectedMoment, reaction, { editor: true }) : "";
    if (reaction) editor.querySelector("[data-matches-animation-warning]").hidden = true;
    if (play && reaction && preview) creatorMatchesMountAnimationPreview(preview, selectedMoment, reaction, owner);
  };
  editor?.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-matches-editor-remove-animation]")) {
      event.preventDefault(); assertCreatorMatchesOwner(owner);
      editor.querySelector('[name="matchAnimationChanged"]').value = "1";
      editor.querySelector('[name="matchVariant"]').value = "";
      updateAnimationPreview(false); editor.querySelector("[data-matches-animation-warning]").hidden = true;
      return;
    }
    if (!event.target.closest?.("[data-matches-editor-preview]")) return;
    event.preventDefault(); updateAnimationPreview(true);
  });
  editor?.addEventListener("change", (event) => {
    if (["matchVariant", "matchFit"].includes(event.target.name)) {
      if (event.target.name === "matchVariant") editor.querySelector('[name="matchAnimationChanged"]').value = "1";
      updateAnimationPreview(Boolean(editor.querySelector('[name="matchVariant"]').value));
      return;
    }
    if (event.target.name === "moment") {
      editor.querySelector('[name="matchAnimationChanged"]').value = "1";
      creatorMatchesSyncVariantSelect(editor);
      updateAnimationPreview(false);
    }
    if (!["reactionType", "moment"].includes(event.target.name)) return;
    const type = editor.querySelector('[name="reactionType"]').value;
    const selectedMoment = editor.querySelector('[name="moment"]').value;
    for (const section of editor.querySelectorAll("[data-matches-reaction]")) section.hidden = section.dataset.matchesReaction !== type;
    for (const section of editor.querySelectorAll("[data-matches-moment]")) section.hidden = !section.dataset.matchesMoment.split(",").includes(selectedMoment);
    const enabled = editor.querySelector('[name="enabled"]');
    enabled.disabled = unavailableCard && selectedMoment === "card";
    if (enabled.disabled) enabled.checked = false;
    if (type !== "animation") preview?.shenPulseMatchPreviewDispose?.();
  });
}

function creatorMatchesAutomationCard(entry, moment) {
  const [title, description, icon, color, hint] = CREATOR_MATCH_CARD_PRESENTATION[moment];
  const unavailable = moment === "card" && creatorMatchesModel().capabilities.cards === false;
  const data = entry ? `data-id="${escapeHtml(entry.id)}"` : `data-moment="${escapeHtml(moment)}"`;
  const ready = creatorMatchesReactionReady(entry);
  const setting = moment === "card"
    ? `<select class="matches-automation-select" data-action="matches-automation-setting" data-setting="card" ${data} aria-label="Carte de match">${[["any", "Toutes les cartes"], ["glove", "Gants de boxe"], ["fog", "Brume"], ["hammer", "Marteau"], ["time", "Temps supplémentaire"]].map(([id, label]) => `<option value="${id}" ${(entry?.card || "any") === id ? "selected" : ""}>${label}</option>`).join("")}</select>`
    : ["likeRush", "comeback", "snipe", "tieEnd"].includes(moment)
      ? `<button type="button" class="matches-automation-select" data-action="matches-automation-edit" ${data}>${escapeHtml(moment === "likeRush" ? `${entry?.threshold ?? 300} likes / ${entry?.windowSeconds ?? 5} s` : moment === "comeback" ? `${entry?.threshold ?? 1000} points de retard` : `${entry?.remainingSeconds ?? (moment === "tieEnd" ? 60 : 30)} dernières secondes`)} · Régler</button>` : "";
  return `<article class="matches-automation-card ${entry?.enabled === true ? "is-enabled" : ""}" data-matches-moment-card="${escapeHtml(moment)}" style="--matches-moment-color:${color}">
    <header><span class="matches-moment-icon">${creatorMatchesAutomationIcon(icon)}</span><div><h4>${title}</h4><small class="matches-moment-subtitle">${description}</small></div><label class="switch"><input type="checkbox" data-action="matches-automation-toggle" ${data} aria-label="Activer ${escapeHtml(entry?.name || title)}" ${entry?.enabled === true ? "checked" : ""} ${unavailable || !ready ? "disabled" : ""}><span></span></label></header>
    <div class="matches-automation-hint"><span aria-hidden="true">💡</span>${hint}</div>${unavailable ? '<small class="matches-card-unavailable">Détection automatique indisponible · test manuel possible</small>' : ""}${setting}
    <div class="matches-automation-effects">${creatorMatchesAnimationSelect(entry, moment)}${creatorMatchesMediaTiles(entry, moment)}</div>
    ${creatorMatchesAutomationAdvanced(entry, moment)}${creatorMatchesAutomationFooter(entry, moment, ready)}</article>`;
}

function creatorMatchesAutomationFooter(entry, moment, ready, groupIds = "") {
  const data = groupIds ? `data-ids="${escapeHtml(groupIds)}"` : entry ? `data-id="${escapeHtml(entry.id)}"` : `data-moment="${escapeHtml(moment)}"`;
  return `<footer><span class="matches-automation-readiness ${ready ? "is-ready" : ""}">${ready ? "✓ Prêt" : "⚠ Choisis une animation, une vidéo ou un son"}</span><button type="button" class="button small ghost" data-action="${groupIds ? "matches-automation-group-test" : "matches-automation-test"}" ${data} ${ready ? "" : "disabled"}>${creatorMatchesIcon("play")}Tester sur mon live</button></footer>`;
}

function creatorMatchesAutomationAdvanced(entry, moment) {
  const data = entry ? `data-id="${escapeHtml(entry.id)}"` : `data-moment="${escapeHtml(moment)}"`;
  return `<details class="matches-automation-advanced"><summary>Réglages avancés${entry ? ` · ${escapeHtml(entry.name)}` : ""}</summary><div><span class="matches-reaction-description" data-studio-user-content>${escapeHtml(entry ? creatorMatchesReactionDescription(entry.reaction) : "Aucun effet configuré")}</span><button type="button" class="button small ghost" data-action="matches-automation-edit" ${data}>${creatorMatchesIcon("edit")}${entry ? "Modifier" : "Configurer"} / action liée</button>${entry ? `<button type="button" class="matches-icon-button danger" data-action="matches-automation-delete" ${data} aria-label="Supprimer ${escapeHtml(entry.name)}">${creatorMatchesIcon("trash")}</button>` : ""}</div></details>`;
}

/** Une seule carte visuelle, deux moments TikTok distincts et conservés. */
function creatorMatchesMultiplierCard(x2, x3) {
  const [title, description, icon, color, hint] = CREATOR_MATCH_CARD_PRESENTATION.multiplierX2;
  const entries = [x2, x3].filter(Boolean), active = entries.filter((entry) => entry.enabled === true);
  const ready = entries.some(creatorMatchesReactionReady);
  const ids = JSON.stringify(entries.map((entry) => entry.id));
  const mode = active.length === 1 ? active[0].moment : "both";
  return `<article class="matches-automation-card ${active.length ? "is-enabled" : ""}" data-matches-moment-card="multiplier" style="--matches-moment-color:${color}">
    <header><span class="matches-moment-icon">${creatorMatchesAutomationIcon(icon)}</span><div><h4>${title}</h4><small class="matches-moment-subtitle">${description}</small></div><label class="switch"><input type="checkbox" data-action="matches-automation-group-toggle" data-ids="${escapeHtml(ids)}" aria-label="Activer les multiplicateurs" ${active.length ? "checked" : ""} ${ready ? "" : "disabled"}><span></span></label></header>
    <div class="matches-automation-hint"><span aria-hidden="true">💡</span>${hint}</div>
    <select class="matches-automation-select" data-action="matches-automation-multiplier-mode" data-ids="${escapeHtml(ids)}" aria-label="Bonus actifs" ${active.length ? "" : "disabled"}>${[["both", "×2 et ×3"], ["multiplierX2", "×2 uniquement"], ["multiplierX3", "×3 uniquement"]].map(([id, label]) => `<option value="${id}" ${mode === id ? "selected" : ""}>${label}</option>`).join("")}</select>
    <div class="matches-automation-effects">${creatorMatchesAnimationSelect(x2, "multiplierX2", "Animation ×2")}${creatorMatchesAnimationSelect(x3, "multiplierX3", "Animation ×3")}${creatorMatchesMediaTiles(x2 || x3, "multiplierX2", "", entries)}</div>
    ${creatorMatchesAutomationAdvanced(x2, "multiplierX2")}${creatorMatchesAutomationAdvanced(x3, "multiplierX3")}${creatorMatchesAutomationFooter(entries.find(creatorMatchesReactionReady), "multiplierX2", ready, ids)}</article>`;
}

function creatorMatchesAutomationsMarkup() {
  const { automations } = creatorMatchesModel();
  const cards = (moments) => moments.flatMap((moment) => {
    if (moment === "multiplierX2") {
      const x2 = automations.filter((entry) => entry.moment === "multiplierX2"), x3 = automations.filter((entry) => entry.moment === "multiplierX3");
      return Array.from({ length: Math.max(1, x2.length, x3.length) }, (_, index) => creatorMatchesMultiplierCard(x2[index], x3[index]));
    }
    const rows = automations.filter((entry) => entry.moment === moment);
    return rows.length ? rows.map((entry) => creatorMatchesAutomationCard(entry, moment)) : [creatorMatchesAutomationCard(null, moment)];
  }).join("");
  return `<section class="matches-automations"><header class="matches-section-heading"><div><h3>Chaque temps fort, votre réaction.</h3><p>Combinez une animation, une vidéo et un son. Rien ne se déclenche avant d’avoir configuré et activé le temps fort.</p></div><div class="matches-vision-actions"><button type="button" class="button ghost small" data-action="matches-visual-configure">Lecture visuelle locale</button><button type="button" class="button primary small" data-action="matches-automation-add">${creatorMatchesIcon("plus")}Ajouter</button></div></header>${typeof creatorMatchesAutomationOnboardingMarkup === "function" ? creatorMatchesAutomationOnboardingMarkup() : ""}${typeof creatorMatchesVisualStatusMarkup === "function" ? creatorMatchesVisualStatusMarkup() : ""}<section class="matches-automation-section"><header class="matches-automation-section-heading"><h3>Pendant le match</h3><p>Pour pousser votre communauté à envoyer au bon moment</p></header><div class="matches-automation-grid">${cards(["battleStart", "multiplierX2", "card", "lead", "comeback", "tieEnd", "likeRush", "snipe"])}</div></section><section class="matches-automation-section"><header class="matches-automation-section-heading"><h3>Après le match</h3><p>Pour accompagner le résultat confirmé par TikTok</p></header><div class="matches-automation-grid">${cards(["victory", "defeat"])}</div></section><p class="matches-safety-note">Ajoutez une seule fois la source Match des widgets pour les animations, vidéos et sons LIVE. Les tests jouent réellement les sorties configurées, uniquement après confirmation. Ils ne modifient ni les scores, ni les victoires, ni l’historique des matchs. Une action IRL reste soumise à ses autorisations.</p></section>`;
}
