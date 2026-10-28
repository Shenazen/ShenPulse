"use strict";

/** Espace Matchs : rendu pur, profil actif et données TikTok réellement reçues. */
let creatorMatchesTab = "dashboard";
let creatorMatchesStatus = null;
let creatorMatchesStatusOwner = "";

const CREATOR_MATCH_MOMENT_LABELS = Object.freeze({
  battleStart: ["Début du match", "Quand TikTok annonce une nouvelle manche.", "play"],
  multiplierX2: ["Bonus ×2", "Quand TikTok confirme votre bonus ×2.", "bolt"],
  multiplierX3: ["Bonus ×3", "Quand TikTok confirme votre bonus ×3.", "bolt"],
  card: ["Carte de match", "Gants, brume, marteau ou temps supplémentaire.", "card"],
  lead: ["Passe devant", "Quand votre score dépasse celui de l’adversaire.", "up"],
  comeback: ["Remontée", "Quand vous reprenez la tête après avoir été mené.", "up"],
  tieEnd: ["Égalité en fin de match", "Quand les scores sont à égalité dans la dernière minute.", "equal"],
  likeRush: ["TapTap", "Un nombre de tapotages dans une fenêtre de temps.", "heart"],
  snipe: ["Dernières secondes", "Une alerte avant la fin de la manche.", "clock"],
  victory: ["Victoire", "Quand TikTok confirme une manche gagnée.", "trophy"],
  defeat: ["Défaite", "Quand TikTok confirme une manche perdue.", "shield"]
});

function creatorMatchesIcon(kind = "trophy") {
  const paths = {
    trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4M12 13v5m-4 3h8m-6-3h4"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    widgets: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4m-6-12h12"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    heart: '<path d="M20 5a5 5 0 0 0-8 1 5 5 0 0 0-8-1c-5 5 8 15 8 15S25 10 20 5Z"/>',
    up: '<path d="M12 20V4m-6 6 6-6 6 6"/>',
    equal: '<path d="M4 8h16M4 16h16"/>',
    card: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="m12 7-3 5h4l-1 5 4-7h-4"/>',
    shield: '<path d="m12 3 8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6l8-3Z"/><path d="m9 9 6 6m0-6-6 6"/>',
    edit: '<path d="m4 16 12-12 4 4-12 12-5 1 1-5ZM13 7l4 4"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    refresh: '<path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5"/>',
    trash: '<path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] || paths.trophy}</svg>`;
}

function creatorMatchesOwnerKey() {
  return `${creatorPrivateOperationUid()}:${String(snapshot?.state?.session?.profileId || "")}`;
}

function creatorMatchesModel() {
  if (!isAccountAuthenticated() || !hasProAccess() || creatorMatchesStatusOwner !== creatorMatchesOwnerKey()) {
    creatorMatchesStatus = null;
    creatorMatchesStatusOwner = "";
  }
  const status = creatorMatchesStatusOwner === creatorMatchesOwnerKey() ? creatorMatchesStatus : null;
  const state = snapshot?.state || {};
  const config = state.settings?.matches || status?.config || { widgets: {}, automations: [] };
  // Une remise à zéro récente prévaut aussi si son horodatage est zéro.
  let runtime = state.matchSession || status?.runtime || {};
  if (runtime.scope?.uid && runtime.scope.uid !== creatorPrivateOperationUid() || runtime.scope?.profileId && runtime.scope.profileId !== String(state.session?.profileId || "")) runtime = {};
  return { config, runtime, capabilities: runtime.capabilities || status?.capabilities || {},
    participants: creatorMatchesPresentationParticipants(runtime),
    automations: Array.isArray(config.automations) ? config.automations : [] };
}

function creatorMatchesNumber(value) {
  return rendererFormatters.integer.format(Math.max(0, Number(value) || 0));
}

/** Un score absent du paquet TikTok n'est pas un score de zéro. */
function creatorMatchesScore(value) {
  return value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) || Number(value) < 0
    ? "—" : creatorMatchesNumber(value);
}

/** L’échéance TikTok est une horloge locale, pas un compteur de paquets reçus. */
function creatorMatchesCountdown(runtime, now = Date.now(), fallback = "—") {
  const endsAtMs = Number(runtime.endsAtMs);
  if (runtime.status !== "running" || !Number.isFinite(endsAtMs) || endsAtMs <= 0) return fallback;
  const remaining = Math.max(0, Math.ceil((endsAtMs - now) / 1000));
  return `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
}

/** Uniquement deux textes : ni calcul de scores, ni IPC, ni minuterie par page. */
function syncCreatorMatchesClock() {
  if (currentPage !== "matches" || !isAccountAuthenticated() || !hasProAccess() ||
      typeof rendererVisualsActive === "function" && !rendererVisualsActive()) return false;
  const panel = content.querySelector("[data-creator-matches-panel]");
  if (!panel || panel.dataset.matchesOwner !== creatorMatchesOwnerKey()) return false;
  const { runtime } = creatorMatchesModel();
  const now = Date.now();
  for (const [selector, fallback] of [["[data-matches-time]", "Scores reçus de TikTok"],
    ['[data-matches-widget-preview="timer"] .matches-widget-value', "—"]]) {
    const field = panel.querySelector(selector);
    if (!field) continue;
    const value = creatorMatchesCountdown(runtime, now, fallback);
    if (field.textContent !== value) field.textContent = value;
    if (field.hasAttribute("data-matches-time")) field.classList.toggle("is-label", !/^\d+:\d{2}$/.test(value));
  }
  return true;
}

function creatorMatchesAvatar(person, className = "") {
  const name = String(person.displayName || person.username || "Participant");
  const url = String(person.avatarUrl || "");
  let safe = false;
  try { const parsed = new URL(url); safe = parsed.protocol === "https:" && !parsed.username && !parsed.password; } catch { /* Les initiales restent visibles sans requête. */ }
  return `<span class="matches-avatar ${escapeHtml(className)}"><span aria-hidden="true">${escapeHtml(Array.from(name).slice(0, 2).join("").toUpperCase())}</span>${safe ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : ""}</span>`;
}

function creatorMatchesParticipant(person, maxScore) {
  const percentage = maxScore > 0 ? Math.max(0, Math.min(100, Number(person.score || 0) / maxScore * 100)) : 0;
  return `<article class="matches-participant ${person.own ? "is-own" : ""}" data-matches-person="${escapeHtml(person.id)}">${creatorMatchesAvatar(person)}<div class="matches-participant-copy"><strong data-studio-user-content>${escapeHtml(person.displayName || person.username || "Participant TikTok")}</strong><small data-studio-user-content>${person.username ? `@${escapeHtml(String(person.username).replace(/^@/, ""))}` : person.own ? "Votre compte" : "Adversaire"}</small><div class="matches-score-track"><span style="width:${percentage}%"></span></div></div><strong class="matches-score">${creatorMatchesScore(person.score)}</strong></article>`;
}

/** Une session manuelle ou un WebSocket générique ne prouvent pas un LIVE TikTok. */
function creatorMatchesLiveConnected() {
  const state = snapshot?.state || {};
  return state.session?.running === true && state.settings?.tiktok?.status === "live" &&
    (state.connections || []).some((source) => source.id === "source_tiktok" &&
      ["tiktok-direct", "tiktok-relay"].includes(source.type) && source.enabled === true &&
      source.status === "connected" && (!source.liveStatus || source.liveStatus === "live"));
}

function creatorMatchesDetection(runtime) {
  const connected = creatorMatchesLiveConnected();
  const finished = runtime.status === "finished";
  const detected = connected && runtime.status === "running";
  return {
    label: finished ? "Match terminé" : detected ? "Match détecté automatiquement" : connected
      ? "Détection automatique active · En attente d’un match TikTok" : "Détection en attente · LIVE TikTok déconnecté",
    emptyTitle: detected ? "Match détecté automatiquement" : connected ? "En attente d’un match TikTok" : "Connectez votre LIVE TikTok",
    detail: connected
      ? "Les données apparaissent dès que TikTok transmet un événement de bataille. Une connexion en cours de match attend le prochain événement reçu."
      : "Connectez votre LIVE TikTok pour recevoir les participants, scores et résultats des matchs. Le dernier match reçu reste consultable."
  };
}

/** A gift without a transmitted end proves an observation, not a timed bonus. */
function creatorMatchesMultiplierMarkup(runtime) {
  const active = runtime.status === "running" && [2, 3].includes(runtime.multiplier);
  const observation = runtime.multiplierObservation;
  const observed = !active && runtime.status === "running" && [2, 3].includes(observation?.value) &&
    Number.isSafeInteger(observation.observedAtMs) && observation.observedAtMs >= Math.max(1e12, (runtime.startedAtMs || 0) - 1000) &&
    observation.observedAtMs <= Date.now() + 1000 && Number.isSafeInteger(observation.expiresAtMs) &&
    observation.expiresAtMs > Date.now() && observation.expiresAtMs <= observation.observedAtMs + 6000;
  const label = `×${active ? runtime.multiplier : observed ? observation.value : 1}`;
  const detail = active ? `Bonus ×${runtime.multiplier} confirmé par TikTok.` : observed
    ? `Dernier cadeau crédité ×${observation.value} à ${new Date(observation.observedAtMs).toLocaleTimeString("fr-FR")}. Observation récente, conservée au maximum six secondes après le dernier cadeau boosté. La durée du bonus n’a pas été transmise.`
    : "×1 par défaut · aucun multiplicateur supérieur confirmé par TikTok.";
  return `<span class="matches-multiplier${observed ? " is-observed" : ""}" title="${escapeHtml(detail)}" aria-label="${escapeHtml(detail)}">${label}</span>`;
}

function creatorMatchesDashboardMarkup() {
  const { runtime, participants, capabilities } = creatorMatchesModel();
  return `<div class="matches-dashboard">${creatorMatchesStatisticsMarkup(runtime)}
    <div class="matches-dashboard-grid">${creatorMatchesArenaMarkup(runtime, participants)}${creatorMatchesDonorsMarkup(runtime)}</div>
    ${creatorMatchesHistoryMarkup(runtime)}
    <div data-matches-dashboard-slot="capabilities">${capabilities.cards === false ? '<aside class="matches-capability-note">Les cartes de match ne sont pas détectées automatiquement par la connexion TikTok actuelle. Vous pouvez les configurer et les tester manuellement, sans simulation de détection.</aside>' : ""}</div></div>`;
}

function creatorMatchesTabsMarkup() {
  const enabled = creatorMatchesModel().automations.filter((entry) => entry.enabled === true).length;
  return `<nav class="matches-tabs" aria-label="Sections Matchs">${[["dashboard", "Tableau de bord", "grid"], ["widgets", "Widgets de match", "widgets"], ["automations", "Automatisations", "bolt"]].map(([id, label, icon]) => `<button type="button" class="matches-tab ${creatorMatchesTab === id ? "active" : ""}" data-action="matches-tab" data-value="${id}" aria-pressed="${creatorMatchesTab === id}" aria-controls="creator-matches-panel">${creatorMatchesIcon(icon)}<span>${label}</span>${id === "automations" ? `<small class="matches-tab-count" data-matches-automation-count aria-label="Automatisations actives">${enabled}</small>` : ""}</button>`).join("")}</nav>`;
}

function creatorMatchesHeroMarkup() {
  return `<header class="matches-hero" data-studio-hero="matches"><div class="matches-hero-art"><img src="assets/studio/matches-arena-v1.png" alt="" width="2172" height="724" decoding="async" fetchpriority="high"><span class="matches-hero-brand">SHENPULSE · TIKTOK LIVE</span><h2 class="matches-accessible-title">Matchs</h2></div><p class="matches-hero-caption"><span>Compteur de manches</span><i aria-hidden="true">·</i><span>Donateurs en vedette</span><i aria-hidden="true">·</i><span>Réactions automatiques</span></p></header>`;
}

function creatorMatchesPanelMarkup() {
  return creatorMatchesTab === "widgets" ? creatorMatchesWidgetsMarkup() : creatorMatchesTab === "automations" ? creatorMatchesAutomationsMarkup() : creatorMatchesDashboardMarkup();
}

function creatorMatchesStructureSignature(config, capabilities) {
  return JSON.stringify([creatorMatchesOwnerKey(), creatorMatchesTab, creatorMatchesTab === "dashboard" ? null : config,
    creatorMatchesTab === "automations" ? capabilities.cards : null,
    creatorMatchesTab === "widgets" ? CREATOR_MATCH_WIDGETS.map(creatorMatchesWidgetUrl) : null,
    creatorMatchesTab === "automations" ? [creatorMatchesSourceUrl(), creatorMatchesStudioSourceUrl()] : null]);
}

function renderCreatorMatches() {
  if (!isAccountAuthenticated()) return renderPrivateDataPlaceholder("Vos matchs TikTok", "Connectez votre compte ShenPulse pour retrouver les matchs et les réglages de votre profil.");
  const { config, capabilities } = creatorMatchesModel();
  return `<div class="reference-page creator-matches-page">${creatorMatchesHeroMarkup()}<div class="matches-navigation">${creatorMatchesTabsMarkup()}<button type="button" class="button small ghost matches-refresh" data-action="matches-refresh" aria-label="Actualiser les matchs">${creatorMatchesIcon("refresh")}Actualiser</button></div><div id="creator-matches-panel" data-creator-matches-panel data-matches-owner="${escapeHtml(creatorMatchesOwnerKey())}" data-matches-structure="${escapeHtml(creatorMatchesStructureSignature(config, capabilities))}">${creatorMatchesPanelMarkup()}</div></div>`;
}

function creatorMatchesPatchCurrent(current, next) {
  if (current.dataset.matchesRoster !== next.dataset.matchesRoster) {
    current.innerHTML = next.innerHTML;
    current.dataset.matchesRoster = next.dataset.matchesRoster;
    return;
  }
  for (const selector of [".matches-state", "[data-matches-time]", ".matches-multiplier", ".matches-rounds-control small", ".matches-empty h4", ".matches-clock-caption", ".matches-duel-status", "[data-matches-detection-label]", "[data-matches-detection-detail]"]) {
    const before = current.querySelector(selector), after = next.querySelector(selector);
    if (!before || !after) continue;
    if (before.textContent !== after.textContent) before.textContent = after.textContent;
    if (before.className !== after.className) before.className = after.className;
    if (selector === ".matches-multiplier") for (const name of ["title", "aria-label"]) {
      if (before.getAttribute(name) !== after.getAttribute(name)) before.setAttribute(name, after.getAttribute(name));
    }
  }
  for (const selector of ["[data-matches-rounds]"]) {
    const before = current.querySelector(selector), after = next.querySelector(selector);
    if (before && after && before.innerHTML !== after.innerHTML) before.innerHTML = after.innerHTML;
  }
  const balance = current.querySelector(".matches-balance"), nextBalance = next.querySelector(".matches-balance");
  if (balance && nextBalance) {
    for (const attribute of ["aria-valuenow", "aria-valuetext", "class", "style"]) {
      const value = nextBalance.getAttribute(attribute);
      if (value === null) balance.removeAttribute(attribute);
      else if (balance.getAttribute(attribute) !== value) balance.setAttribute(attribute, value);
    }
  }
  for (const selector of ["[data-matches-side-score]"]) {
    current.querySelectorAll(selector).forEach((before, index) => {
      const after = next.querySelectorAll(selector)[index];
      if (after && before.textContent !== after.textContent) before.textContent = after.textContent;
    });
  }
  const participants = new Map([...current.querySelectorAll("[data-matches-person]")].map((node) => [node.dataset.matchesPerson, node]));
  for (const after of next.querySelectorAll("[data-matches-person]")) {
    const before = participants.get(after.dataset.matchesPerson);
    if (!before) continue;
    const score = before.querySelector(".matches-score"), nextScore = after.querySelector(".matches-score");
    if (score.textContent !== nextScore.textContent) score.textContent = nextScore.textContent;
    const bar = before.querySelector(".matches-score-track span"), nextBar = after.querySelector(".matches-score-track span");
    if (bar.style.width !== nextBar.style.width) bar.style.width = nextBar.style.width;
  }
}

/** Réutilise les avatars et les lignes lorsque seuls likes/pièces/rangs changent. */
function creatorMatchesPatchDonors(current, next) {
  const list = current.querySelector("ol"), nextList = next.querySelector("ol");
  if (!list || !nextList) {
    if (current.innerHTML !== next.innerHTML) current.innerHTML = next.innerHTML;
    return;
  }
  const rows = new Map([...list.children].map((node) => [node.dataset.matchesDonor, node]));
  const ids = new Set();
  [...nextList.children].forEach((after, index) => {
    const id = after.dataset.matchesDonor;
    ids.add(id);
    let before = rows.get(id);
    const identity = (node) => [node.querySelector("strong")?.textContent, node.querySelector("div small")?.textContent, node.querySelector("img")?.getAttribute("src") || ""].join("\n");
    if (!before || identity(before) !== identity(after)) {
      before?.replaceWith(after);
      before = after;
    } else {
      for (const selector of [".matches-donor-rank", ".matches-donor-coins", ".matches-donor-likes", ".matches-donor-gifts"]) {
        const field = before.querySelector(selector), nextField = after.querySelector(selector);
        if (field.textContent !== nextField.textContent) field.textContent = nextField.textContent;
      }
    }
    if (before.className !== after.className) before.className = after.className;
    if (list.children[index] !== before) list.insertBefore(before, list.children[index] || null);
  });
  for (const before of [...list.children]) if (!ids.has(before.dataset.matchesDonor)) before.remove();
  current.querySelector('[data-action="matches-clear-donors"]').disabled = next.querySelector('[data-action="matches-clear-donors"]').disabled;
}

/** Petit rapprochement DOM des panneaux purement visuels et bornés.
 * Les lignes identifiées sont déplacées, pas recréées : un classement qui
 * change conserve les images déjà chargées. Aucun lecteur n’est instancié.
 */
function creatorMatchesPatchVisualNode(current, next) {
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
    const replacement = next.cloneNode(true);
    current.replaceWith(replacement);
    return replacement;
  }
  if (current.nodeType !== 1) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return current;
  }
  for (const attribute of [...current.attributes]) if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  for (const attribute of next.attributes) if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  const previous = [...current.childNodes], used = new Set();
  const key = (node) => node.nodeType === 1 ? node.getAttribute("data-matches-preview-person") || "" : "";
  const identified = new Map(previous.filter((node) => key(node)).map((node) => [key(node), node]));
  let cursor = current.firstChild;
  for (const after of [...next.childNodes]) {
    let before = key(after) ? identified.get(key(after)) : previous.find((node) => !used.has(node) && !key(node) && node.nodeType === after.nodeType && node.nodeName === after.nodeName);
    if (before) {
      const atCursor = before === cursor;
      used.add(before);
      before = creatorMatchesPatchVisualNode(before, after);
      if (atCursor) cursor = before;
    } else before = after.cloneNode(true);
    if (before !== cursor) current.insertBefore(before, cursor);
    cursor = before.nextSibling;
  }
  for (const before of previous) if (!used.has(before) && before.parentNode === current) before.remove();
  return current;
}

/** Sept aperçus HTML, au maximum quatre lignes chacun ; les contrôles et les
 * huit posters sont hors de cette réconciliation des données temps réel.
 */
function creatorMatchesPatchWidgetPreviews(panel, config) {
  for (const widget of CREATOR_MATCH_WIDGETS) {
    const current = panel.querySelector(`[data-matches-widget-preview="${widget.key}"]`);
    if (!current) continue;
    const template = document.createElement("template");
    template.innerHTML = creatorMatchesWidgetPreview(widget, config.widgets?.[widget.key] || {});
    const next = template.content.firstElementChild;
    if (current.innerHTML !== next.innerHTML) creatorMatchesPatchVisualNode(current, next);
  }
}

/** Les scores mettent à jour leur seul panneau ; ni bannière, ni onglets recréés. */
function syncCreatorMatchesRuntime() {
  if (typeof syncCreatorMatchesVisualStatus === "function") syncCreatorMatchesVisualStatus();
  if (currentPage !== "matches" || !isAccountAuthenticated()) return false;
  const panel = content.querySelector("[data-creator-matches-panel]");
  if (!panel) return false;
  const { runtime, config } = creatorMatchesModel();
  const enabledCount = content.querySelector("[data-matches-automation-count]");
  if (enabledCount) enabledCount.textContent = String((config.automations || []).filter((entry) => entry.enabled === true).length);
  const capabilities = runtime.capabilities || {};
  const structure = creatorMatchesStructureSignature(config, capabilities);
  const signature = JSON.stringify([structure, creatorMatchesTab === "automations" ? null : runtime,
    creatorMatchesTab === "dashboard" ? creatorMatchesLiveConnected() : null,
    creatorMatchesTab !== "automations" ? creatorMatchesProfileSignature() : null]);
  if (panel.dataset.matchesSignature === signature) {
    creatorMatchesBindAvatars(panel);
    syncCreatorMatchesClock();
    return true;
  }
  if (creatorMatchesTab === "dashboard" && panel.querySelector(".matches-dashboard")) {
    const template = document.createElement("template");
    template.innerHTML = creatorMatchesDashboardMarkup();
    for (const next of template.content.querySelectorAll("[data-matches-dashboard-slot]")) {
      const current = panel.querySelector(`[data-matches-dashboard-slot="${next.dataset.matchesDashboardSlot}"]`);
      if (!current) continue;
      if (next.dataset.matchesDashboardSlot === "current") creatorMatchesPatchCurrent(current, next);
      else if (next.dataset.matchesDashboardSlot === "donors") creatorMatchesPatchDonors(current, next);
      else if (current.innerHTML !== next.innerHTML) creatorMatchesPatchVisualNode(current, next);
    }
  } else if (creatorMatchesTab === "widgets" && panel.querySelector(".matches-widgets") &&
      (!panel.dataset.matchesStructure || panel.dataset.matchesStructure === structure)) {
    creatorMatchesPatchWidgetPreviews(panel, config);
  } else panel.innerHTML = creatorMatchesPanelMarkup();
  panel.dataset.matchesStructure = structure;
  panel.dataset.matchesSignature = signature;
  panel.dataset.matchesOwner = creatorMatchesOwnerKey();
  creatorMatchesBindAvatars(panel);
  syncCreatorMatchesClock();
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(panel);
  return true;
}
