"use strict";

/**
 * Atelier voix : présentation des règles TTS, des alertes et de leurs sorties.
 * Les cartes audio et les écrans restent ceux du module audio commun ; aucun
 * éditeur, contrat data-*, filtre moteur ou réglage de profil n'est recopié ici.
 */
let creatorVoiceTab = "voice";

function creatorVoiceTabsMarkup(rows = soundActionRows()) {
  const available = canAccessFeature("tts.voices") && canAccessActionType("tts.speak");
  const tabs = [
    ...(available ? [["voice", "Synthèse vocale", "voice", rows.filter(({ action }) => action.type === "tts.speak").length]] : []),
    ["sounds", "Alertes sonores", "sounds", rows.filter(({ action }) => action.type === "audio.play").length],
    ["outputs", "Diffusion LIVE", "overlays", 8]
  ];
  return `<nav class="voice-tabs" aria-label="Sections voix et sons">${tabs.map(([id, label, icon, count]) => `<button type="button" class="voice-tab ${creatorVoiceTab === id ? "active" : ""}" data-action="creator-voice-tab" data-value="${id}" aria-pressed="${creatorVoiceTab === id}" aria-controls="creator-voice-panel"><span class="voice-tab-icon">${navigationIcon(icon)}</span><span class="voice-tab-label">${label}</span><span class="voice-tab-count">${count}</span></button>`).join("")}</nav>`;
}

function creatorVoiceSummaryCard(icon, label, value, detail, { userContent = false } = {}) {
  return `<article class="voice-summary-card"><span class="voice-summary-icon">${navigationIcon(icon)}</span><div><span class="voice-summary-label">${escapeHtml(label)}</span><strong ${userContent ? "data-studio-user-content" : ""}>${escapeHtml(value)}</strong><p>${escapeHtml(detail)}</p></div></article>`;
}

function renderCreatorVoiceSummary(rows, mode = "voice") {
  const active = rows.filter(({ rule }) => rule.enabled).length;
  const live = rows.filter(({ action }) => isLiveAudioOutput(action.config)).length;
  return `<section class="voice-summary-grid" aria-label="Résumé de l’atelier audio">
    ${creatorVoiceSummaryCard("rules", mode === "voice" ? "Règles TTS actives" : "Alertes actives", `${active} / ${rows.length}`, "Dans votre profil actif")}
    ${mode === "voice"
      ? creatorVoiceSummaryCard("voice", "Voix par défaut", snapshot.state.settings.tts?.voice || "Voix Windows", "Personnalisable dans chaque règle", { userContent: Boolean(snapshot.state.settings.tts?.voice) })
      : creatorVoiceSummaryCard("sounds", "Écoute locale", rows.length - live, "Sons réservés à ShenPulse")}
    ${creatorVoiceSummaryCard("overlays", "Diffusion LIVE", live, "Règles dirigées vers vos écrans audio")}
  </section>`;
}

function renderCreatorVoiceWorkspace(body, rows) {
  return `<div class="reference-page creator-voice-page">
    ${renderStudioHero("voice", "Une voix pour votre communauté.", "Choisissez qui peut parler, filtrez les commentaires et dirigez les voix et les sons vers votre écoute locale ou votre LIVE.")}
    ${creatorVoiceTabsMarkup(rows)}
    <div id="creator-voice-panel" class="voice-workspace">${body}</div>
  </div>`;
}

function renderCreatorVoice() {
  if (!isAccountAuthenticated()) return renderPrivateDataPlaceholder("Votre atelier audio", "Connectez votre compte ShenPulse pour retrouver vos règles TTS, vos sons et vos écrans de diffusion.");
  const available = canAccessFeature("tts.voices") && canAccessActionType("tts.speak");
  if (creatorVoiceTab === "voice" && !available) creatorVoiceTab = "sounds";
  const allRows = soundActionRows();
  if (creatorVoiceTab === "voice") return renderCreatorVoiceDetails(allRows);
  const rows = allRows.filter(({ action }) => action.type === "audio.play");
  const query = normalizeCatalogSearch(soundSearch);
  const filtered = rows.filter(({ rule, action }) => !query || normalizeCatalogSearch(`${rule.name} ${triggerLabel(rule)} ${actionDescription(action)}`).includes(query));
  const body = creatorVoiceTab === "sounds"
    ? `${renderCreatorVoiceSummary(rows, "sounds")}<div class="voice-search-toolbar"><div><h3>Votre bibliothèque d’alertes</h3><p>Un son, un déclencheur, la bonne sortie.</p></div><label class="search-control"><span aria-hidden="true">⌕</span><input data-search="sounds" type="search" value="${escapeHtml(soundSearch)}" placeholder="Rechercher un son ou une règle" aria-label="Rechercher un son"></label></div>${renderAudioAlerts(filtered)}${renderMediaScreensPanel(flattenActions(), { context: "sounds", collapsible: true })}`
    : renderMediaScreensPanel(flattenActions(), { context: "sounds", collapsible: false });
  return renderCreatorVoiceWorkspace(body, allRows);
}

function creatorTtsPolicyLabel(config = {}) {
  const roles = Array.isArray(config.allowedRoles) ? config.allowedRoles : ["all"];
  return roles.includes("all") ? "Tout le chat" : roles.map((role) => ({ subscriber: "Abonnés", moderator: "Modérateurs", team: "Équipe", viewer: "Spectateurs" })[role] || role).join(" · ") || "Aucun rôle autorisé";
}

/** Résumé de modération repliable : les réglages restent dans l'éditeur TTS. */
function renderCreatorVoicePolicies(rows) {
  if (!rows.length) return "";
  return `<details class="voice-policies"><summary><span class="voice-policy-symbol">${navigationIcon("admin")}</span><span><strong>Accès & filtres</strong><small>Rôles autorisés, longueur et modération du chat</small></span><span class="voice-policy-count">${rows.length}</span><span class="voice-disclosure" aria-hidden="true">⌄</span></summary><p class="voice-policy-intro">Le moteur applique ces réglages avant de mettre un commentaire en lecture.</p><div class="voice-policy-list">${rows.map(({ rule, action, actionIndex }) => {
    const config = action.config || {};
    return `<article class="voice-policy-row"><div><h4 data-studio-user-content>${escapeHtml(rule.name)}</h4><p>${escapeHtml(creatorTtsPolicyLabel(config))} · ${Number(config.maxCharacters) > 0 ? `${Math.round(Number(config.maxCharacters))} caractères maximum` : "jusqu’à 1 000 caractères"}${config.blockedWords?.length ? ` · ${config.blockedWords.length} mot(s) bloqué(s)` : ""}</p><div class="voice-policy-flags"><span>${config.allowLinks ? "Liens autorisés" : "Liens filtrés"}</span><span>${config.allowCommands ? "Commandes autorisées" : "Commandes filtrées"}</span><span>${config.allowMentions ? "Mentions autorisées" : "Mentions filtrées"}</span></div></div><button type="button" class="button small" data-action="edit-tts" ${soundRowAttributes(rule, action, actionIndex)}>Configurer</button></article>`;
  }).join("")}</div></details>`;
}

function renderCreatorVoiceDetails(allRows) {
  if (!isAccountAuthenticated()) return renderPrivateDataPlaceholder("Votre atelier audio", "Connectez votre compte ShenPulse pour retrouver vos règles TTS, vos sons et vos écrans de diffusion.");
  const available = canAccessFeature("tts.voices") && canAccessActionType("tts.speak");
  if (!available) return renderPrivateDataPlaceholder("Synthèse vocale indisponible", "L’accès à la synthèse vocale est masqué par la configuration de votre espace ShenPulse.");
  const availableRows = allRows || soundActionRows();
  const rows = availableRows.filter(({ action }) => action.type === "tts.speak");
  return renderCreatorVoiceWorkspace(`${renderCreatorVoiceSummary(rows)}${renderTtsRules(rows)}${renderCreatorVoicePolicies(rows)}${renderMediaScreensPanel(flattenActions(), { context: "sounds", collapsible: true })}`, availableRows);
}

