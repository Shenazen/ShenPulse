"use strict";

/** Cartes des six widgets de match et du tableau de scores, sans iframe au rendu. */
const CREATOR_MATCH_WIDGETS = Object.freeze([
  { key: "wins", urlKey: "matchesWins", name: "Compteur de manches", icon: "trophy", description: "Les manches du duo identifié, distinctes des statistiques de victoires." },
  { key: "starDonor", urlKey: "matchesStarDonor", name: "Dernier donateur", icon: "heart", description: "Un médaillon et un merci pour le dernier cadeau ou tapotage reçu." },
  { key: "topDonor", urlKey: "matchesTopDonor", name: "Plus gros donateur", icon: "trophy", description: "Le premier donateur du LIVE, classé par pièces puis tapotages." },
  { key: "donors", urlKey: "matchesDonors", name: "Classement des donateurs", icon: "grid", description: "Les contributions du LIVE avec photos, pièces et likes." },
  { key: "timer", urlKey: "matchesTimer", name: "Chronomètre de match", icon: "clock", description: "Le temps restant, l’alerte snipe et vos victoires d’affilée." },
  { key: "victory", urlKey: "matchesVictory", name: "Animation de victoire", icon: "trophy", description: "Votre victoire confirmée avec les photos et le compteur de manches." },
  { key: "scoreboard", urlKey: "matchesScoreboard", name: "Scores du match", icon: "grid", description: "Les participants et les scores TikTok de la manche." }
]);

/**
 * Les liens à copier sont exclusivement les sources HTTPS du canal Match privé.
 * Les URL 127.0.0.1 restent réservées aux aperçus internes : elles ne sont jamais
 * substituées silencieusement à une source publique absente.
 */
function creatorMatchesSourceUrl(urlKey = "matchPlayer") {
  if (!isAccountAuthenticated() || !hasProAccess()) return "";
  const value = String(snapshot?.overlayUrls?.[urlKey] || "");
  try {
    const url = new URL(value);
    const widget = CREATOR_MATCH_WIDGETS.find((entry) => entry.urlKey === urlKey);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
        host === "localhost" || host.endsWith(".localhost") ||
        /^127\./.test(host) || ["[::1]", "0.0.0.0"].includes(host) ||
        !/^\/m\/\d{12}\/[A-Za-z0-9_-]{24,128}\/?$/.test(url.pathname) ||
        url.searchParams.has("token") || url.searchParams.has("channel") ||
        url.searchParams.getAll("widget").length > 1 ||
        (widget ? url.searchParams.get("widget") !== widget.key : urlKey !== "matchPlayer" || url.searchParams.has("widget"))) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function creatorMatchesWidgetUrl(widget) {
  return widget ? creatorMatchesSourceUrl(widget.urlKey) : "";
}

/** Le lien saisi dans Studio reste HTTPS ; seules les vidéos sont locales.
 * Le lecteur explicite utilise le PC qui ouvre la source, jamais un hébergeur.
 */
function creatorMatchesStudioSourceUrl() {
  const value = creatorMatchesSourceUrl();
  if (!value) return "";
  const url = new URL(value);
  url.searchParams.set("transport", "local");
  return url.toString();
}

function creatorMatchesAnimationsMarkup() {
  const definitions = typeof overlayDefinitions === "function" ? overlayDefinitions() : [];
  return `<section class="matches-animations"><header class="matches-section-heading"><div><h3>Vos animations de match</h3><p>Huit effets Pro, avec les versions TikControl, Gladiador et six animations Cyber. Leur source est commune ; chaque effet conserve sa configuration.</p></div></header><div class="matches-animation-grid">${creatorMatchesAnimationRows().map(([key, label, match]) => {
    const item = definitions.find((entry) => entry.key === key);
    const allowed = item && (typeof canAccessOverlay !== "function" || canAccessOverlay(item));
    const variant = item && typeof overlayConfig === "function" ? overlayConfig(key).variant || "tikcontrol" : "tikcontrol";
    const poster = typeof overlayPlaceholderMatch === "function" ? overlayPlaceholderMatch(item || { match }, variant) : creatorMatchesIcon("play");
    const caption = creatorMatchesAnimationLabel(match, variant, label);
    return `<article class="matches-animation-card"><div class="matches-animation-poster">${poster}</div><div><h4>${escapeHtml(variant === "cyber" ? caption : label)}</h4><small>${escapeHtml(creatorMatchesVariantRows(match).find(([id]) => id === variant)?.[1] || "TikControl")}</small></div><button type="button" class="button small" data-action="configure-overlay" data-id="${escapeHtml(key)}" ${allowed ? "" : "disabled"}>Configurer</button></article>`;
  }).join("")}</div></section>`;
}

function creatorMatchesWidgetPreview(widget, config) {
  const { runtime, participants } = creatorMatchesModel();
  let body;
  if (widget.key === "wins") body = `<span class="matches-widget-value">${creatorMatchesNumber(runtime.rounds?.own ?? runtime.manualWins ?? runtime.session?.wins)}</span><small>Manches de la paire reçue ou compteur manuel</small>`;
  else if (widget.key === "starDonor") {
    const donor = runtime.lastContribution?.user || runtime.lastGift?.user;
    body = donor ? `${creatorMatchesAvatar(donor)}<strong data-studio-user-content>${escapeHtml(donor.displayName || donor.username || "Donateur")}</strong><small>Dernière contribution reçue</small>` : '<span class="matches-widget-value">—</span><small>Aucune contribution reçue</small>';
  } else if (["topDonor", "donors"].includes(widget.key)) {
    const rows = (runtime.liveContributors || []).slice().sort((a, b) => Number(b.diamonds || 0) - Number(a.diamonds || 0) || Number(b.likes || 0) - Number(a.likes || 0)).slice(0, widget.key === "topDonor" ? 1 : 4);
    body = rows.length ? rows.map((person) => `<div class="matches-widget-score" data-matches-preview-person="${escapeHtml(person.id)}">${creatorMatchesAvatar(person)}<span data-studio-user-content>${escapeHtml(person.displayName || person.username || "Donateur")}</span><b>${creatorMatchesNumber(person.diamonds)} ◇<small>${creatorMatchesNumber(person.likes)} likes</small></b></div>`).join("") : '<span class="matches-widget-value">—</span><small>Aucune contribution reçue sur le LIVE</small>';
  } else if (widget.key === "timer") {
    body = `<span class="matches-widget-value">${creatorMatchesCountdown(runtime)}</span><small>${runtime.session?.winStreak ? `${creatorMatchesNumber(runtime.session.winStreak)} victoires d’affilée` : "En attente d’une manche"}</small>`;
  } else if (widget.key === "victory") body = runtime.result === "win" ? `${creatorMatchesIcon("trophy")}<strong>VICTOIRE</strong><small>${creatorMatchesNumber(runtime.rounds?.own ?? runtime.session?.wins)} manches gagnées</small>` : '<span class="matches-widget-value">—</span><small>En attente d’une victoire confirmée</small>';
  else body = participants.length ? participants.slice(0, 4).map((person) => `<div class="matches-widget-score" data-matches-preview-person="${escapeHtml(person.id)}"><span data-studio-user-content>${escapeHtml(person.displayName || person.username || "Participant")}</span><b>${creatorMatchesScore(person.score)}</b></div>`).join("") : '<span class="matches-widget-value">—</span><small>En attente des scores TikTok</small>';
  const theme = ["classic", "neon", "gold", "minimal"].includes(config.theme) ? config.theme : "classic";
  return `<div class="matches-widget-preview theme-${theme}" data-matches-widget-preview="${escapeHtml(widget.key)}"><small class="matches-widget-preview-label">APERÇU · DONNÉES REÇUES</small><h4 data-studio-user-content>${escapeHtml(config.title || widget.name)}</h4>${body}</div>`;
}

function creatorMatchesWidgetsMarkup() {
  const { config } = creatorMatchesModel();
  const playerUrl = creatorMatchesSourceUrl();
  return `<section class="matches-widgets"><header class="matches-section-heading"><div><h3>Les temps forts, à l’écran.</h3><p>Ajoutez les sources navigateur dans OBS ou TikTok LIVE Studio. Les réglages et les victoires restent propres au profil actif.</p></div></header><div class="matches-widget-grid">${CREATOR_MATCH_WIDGETS.map((widget) => {
    const settings = config.widgets?.[widget.key] || {};
    const url = creatorMatchesWidgetUrl(widget);
    return `<article class="matches-widget-card"><header><span class="matches-moment-icon">${creatorMatchesIcon(widget.icon)}</span><div><h3>${widget.name}</h3><p>${widget.description}</p></div><span class="matches-widget-status ${settings.enabled ? "is-enabled" : ""}">${settings.enabled ? "ACTIF" : "INACTIF"}</span></header>${creatorMatchesWidgetPreview(widget, settings)}<footer><button type="button" class="button small" data-action="matches-widget-edit" data-id="${widget.key}">${creatorMatchesIcon("edit")}Configurer</button><button type="button" class="button small ghost" data-action="matches-widget-copy" data-id="${widget.key}" ${url ? "" : "disabled"}>Copier la source</button><button type="button" class="button small ghost" data-action="matches-widget-test" data-id="${widget.key}" ${url ? "" : "disabled"}>${creatorMatchesIcon("play")}Tester</button></footer>${url ? "" : '<p class="matches-source-warning">Source HTTPS indisponible. Aucun lien local ou fictif n’est copié à sa place.</p>'}</article>`;
  }).join("")}</div><section class="matches-player-source"><span>${creatorMatchesIcon("play")}</span><div><h3>Une source pour toutes vos animations</h3><p>Pour TikTok Studio sur ce PC, le lien HTTPS ouvre le lecteur local protégé : les vraies vidéos restent dans ShenPulse, sans hébergement supplémentaire. La source navigateur habituelle reste disponible.</p></div><div class="matches-source-buttons"><button type="button" class="button small" data-action="matches-player-copy" data-transport="local" ${playerUrl ? "" : "disabled"}>Copier pour TikTok Studio</button><button type="button" class="button small ghost" data-action="matches-player-copy" ${playerUrl ? "" : "disabled"}>Copier la source navigateur</button></div></section>${creatorMatchesAnimationsMarkup()}<p class="matches-safety-note">Sources HTTPS protégées sur shenpulse-overlays.web.app : ShenPulse doit rester ouvert, le relais public connecté et votre accès Pro actif. Le lecteur local Studio fonctionne sur le même PC que ShenPulse. Ne partagez pas ces liens. Le test affiche un aperçu avec les données disponibles, sans créer de faux match.</p></section>`;
}

function openCreatorMatchesWidgetEditor(key) {
  const owner = creatorMatchesCaptureOwner();
  const widget = CREATOR_MATCH_WIDGETS.find((entry) => entry.key === key);
  if (!widget) throw new Error("Widget Match inconnu.");
  const current = creatorMatchesModel().config.widgets?.[key] || {};
  const colors = current.colors || {};
  openEditor({ title: `Configurer ${widget.name}`, kicker: "WIDGET MATCH · PROFIL ACTIF", variant: "wide", successMessage: "Widget enregistré",
    body: `<div class="matches-widget-editor form-grid">${field("title", "Titre affiché", current.title || widget.name, "text", 'maxlength="80" required full autofocus')}${selectFieldMarkup("theme", "Présentation", current.theme || "classic", [["classic", "Classique"], ["neon", "Néon violet / cyan"], ["gold", "Or / rose"], ["minimal", "Minimaliste"]], { full: true })}${selectFieldMarkup("animation", "Animation d’apparition", current.animation || "none", [["none", "Aucune"], ["fade", "Fondu"], ["slide", "Glissement"], ["zoom", "Zoom"]])}${field("backgroundOpacity", "Opacité du fond (%)", current.backgroundOpacity ?? 50, "number", 'min="0" max="100" step="1"')}${field("borderRadius", "Arrondi (pixels)", current.borderRadius ?? 12, "number", 'min="0" max="64" step="1"')}${field("primary", "Couleur principale", colors.primary || "#A855F7", "color")}${field("secondary", "Couleur secondaire", colors.secondary || "#22D3EE", "color")}${field("text", "Couleur du texte", colors.text || "#FFFFFF", "color")}${key === "wins" ? `${field("goal", "Objectif de victoires", current.goal || 10, "number", 'min="1" max="100000" step="1"')}${field("switchSeconds", "Bascule photos / manches (secondes)", current.switchSeconds ?? 6, "number", 'min="1" max="60" step="1"')}<label class="matches-widget-option"><input type="checkbox" name="donorPhoto" ${current.donorPhoto !== false ? "checked" : ""}><span>Photo du donateur sur un cadeau</span></label><label class="matches-widget-option"><input type="checkbox" name="showScores" ${current.showScores !== false ? "checked" : ""}><span>Points du match sous les noms</span></label>` : ""}${key === "starDonor" ? `${field("likeMessage", "Message pour les tapotages", current.likeMessage || "Merci pour {n} likes !", "text", 'maxlength="300" full')}${field("giftMessage", "Message pour un cadeau", current.giftMessage || "Merci pour {gift} x{n} !", "text", 'maxlength="300" full')}<p class="matches-editor-note full">Variables : {n} est la quantité reçue, {gift} le nom du cadeau.</p>` : ""}${key === "timer" ? `<label class="matches-widget-option"><input type="checkbox" name="showSnipe" ${current.showSnipe !== false ? "checked" : ""}><span>Afficher l’alerte snipe</span></label><label class="matches-widget-option"><input type="checkbox" name="showStreak" ${current.showStreak !== false ? "checked" : ""}><span>Afficher les victoires d’affilée</span></label>${field("snipeSeconds", "Alerte avant la fin (secondes)", current.snipeSeconds ?? 30, "number", 'min="1" max="120" step="1"')}` : ""}${key === "victory" ? field("durationSeconds", "Durée de l’animation (secondes)", current.durationSeconds ?? 5, "number", 'min="1" max="15" step="1"') : ""}${field("customText", "Texte complémentaire (optionnel)", current.customText || "", "text", 'maxlength="300" full')}<label class="matches-editor-enabled full"><span><strong>Widget actif</strong><small>Désactivé par défaut. L’enregistrement n’envoie aucun test.</small></span><span class="switch"><input type="checkbox" name="enabled" ${current.enabled === true ? "checked" : ""}><span></span></span></label><p class="matches-editor-note full">La source s’actualise avec les données réelles du match. Le lien ne donne pas accès aux informations privées du compte.</p></div>`,
    onSubmit: async (data) => {
      assertCreatorMatchesOwner(owner);
      const colors = Object.fromEntries(["primary", "secondary", "text"].map((name) => [name, String(data.get(name) || "")]));
      const next = { ...current, enabled: data.has("enabled"), title: String(data.get("title") || "").trim(), theme: String(data.get("theme") || "classic"), colors,
        animation: String(data.get("animation") || "none"), backgroundOpacity: Number(data.get("backgroundOpacity")), borderRadius: Number(data.get("borderRadius")), customText: String(data.get("customText") || "").trim(),
        ...(key === "wins" ? { goal: Number(data.get("goal")), donorPhoto: data.has("donorPhoto"), showScores: data.has("showScores"), switchSeconds: Number(data.get("switchSeconds")) } : {}),
        ...(key === "starDonor" ? { likeMessage: String(data.get("likeMessage") || ""), giftMessage: String(data.get("giftMessage") || "") } : {}),
        ...(key === "timer" ? { showSnipe: data.has("showSnipe"), showStreak: data.has("showStreak"), snipeSeconds: Number(data.get("snipeSeconds")) } : {}),
        ...(key === "victory" ? { durationSeconds: Number(data.get("durationSeconds")) } : {}) };
      const result = await api.matches.saveConfig({ widgets: { [key]: next } }, creatorMatchesApiScope(owner));
      creatorMatchesAcceptResult(result, owner);
    } });
}
