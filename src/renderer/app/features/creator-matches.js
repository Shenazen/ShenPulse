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
    participants: Array.isArray(runtime.participants) ? runtime.participants : [],
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
  }
  return true;
}

function creatorMatchesAvatar(person, className = "") {
  const name = String(person.displayName || person.username || "Participant");
  const url = String(person.avatarUrl || "");
  let safe = false;
  try { const parsed = new URL(url); safe = parsed.protocol === "https:" && !parsed.username && !parsed.password; } catch { /* Un avatar absent ne fait aucune requête. */ }
  return `<span class="matches-avatar ${escapeHtml(className)}">${safe ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : `<span>${escapeHtml(name.slice(0, 2).toUpperCase())}</span>`}</span>`;
}

function creatorMatchesParticipant(person, maxScore) {
  const percentage = maxScore > 0 ? Math.max(0, Math.min(100, Number(person.score || 0) / maxScore * 100)) : 0;
  return `<article class="matches-participant ${person.own ? "is-own" : ""}" data-matches-person="${escapeHtml(person.id)}">${creatorMatchesAvatar(person)}<div class="matches-participant-copy"><strong data-studio-user-content>${escapeHtml(person.displayName || person.username || "Participant TikTok")}</strong><small data-studio-user-content>${person.username ? `@${escapeHtml(String(person.username).replace(/^@/, ""))}` : person.own ? "Votre équipe" : "Adversaire"}</small><div class="matches-score-track"><span style="width:${percentage}%"></span></div></div><strong class="matches-score">${creatorMatchesScore(person.score)}</strong></article>`;
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

function creatorMatchesDashboardMarkup() {
  const { runtime, participants, capabilities } = creatorMatchesModel();
  const summary = runtime.session || {};
  const running = runtime.status === "running";
  const maxScore = Math.max(0, ...participants.map((person) => Number(person.score || 0)));
  const resultLabel = { win: "Victoire", lose: "Défaite", draw: "Égalité" }[runtime.result];
  const donors = (runtime.liveContributors || []).slice().sort((left, right) => Number(right.diamonds || 0) - Number(left.diamonds || 0) || Number(right.likes || 0) - Number(left.likes || 0)).slice(0, 200);
  const history = (runtime.history || []).slice(0, 10);
  const roster = JSON.stringify(participants.map(({ id, username, displayName, avatarUrl, own }) => [id, username, displayName, avatarUrl, own]));
  const ownRounds = Math.max(0, Number(runtime.rounds?.own ?? runtime.manualWins ?? summary.wins) || 0);
  const rivalRounds = runtime.rounds?.opponent;
  const detection = creatorMatchesDetection(runtime);
  return `<div class="matches-dashboard"><section class="matches-stat-grid" data-matches-dashboard-slot="stats" aria-label="Bilan des matchs du profil">${[
    ["trophy", "Manches", summary.battles], ["trophy", "Victoires", summary.wins], ["shield", "Défaites", summary.losses], ["equal", "Égalités", summary.draws]
  ].map(([icon, label, value]) => `<article class="matches-stat"><span>${creatorMatchesIcon(icon)}</span><strong>${creatorMatchesNumber(value)}</strong><small>${label}</small></article>`).join("")}</section>
    <div class="matches-dashboard-grid"><section class="matches-panel matches-current" data-matches-dashboard-slot="current" data-matches-roster="${escapeHtml(roster)}"><header class="matches-panel-heading"><div><span class="matches-eyebrow">TIKTOK LIVE</span><h3>Le match en direct</h3></div><span class="matches-state ${running ? "is-running" : ""}">${running ? "EN MATCH" : resultLabel || "EN ATTENTE"}</span></header>
      <div class="matches-rounds-control"><div><small>${rivalRounds != null ? "MANCHES · PAIRE IDENTIFIÉE" : "COMPTEUR DE MANCHES"}</small><strong data-matches-rounds>${creatorMatchesNumber(ownRounds)} <span>– ${rivalRounds != null ? creatorMatchesNumber(rivalRounds) : "—"}</span></strong></div><button type="button" class="button small ghost" data-action="matches-correct-wins">Corriger</button></div>
      ${participants.length ? `<div class="matches-duel-topline"><span data-matches-time>${creatorMatchesCountdown(runtime, Date.now(), "Scores reçus de TikTok")}</span><span class="matches-multiplier">×${Math.max(1, Number(runtime.multiplier) || 1)}</span></div><div class="matches-participant-list">${participants.map((person) => creatorMatchesParticipant(person, maxScore)).join("")}</div>` : `<div class="matches-empty"><span>${creatorMatchesIcon("trophy")}</span><h4>${detection.emptyTitle}</h4><p>Les scores, participants et résultats apparaissent lorsqu’une bataille est réellement reçue.</p></div>`}
      <footer class="matches-live-note"><strong data-matches-detection-label>${detection.label}</strong><span data-matches-detection-detail>${detection.detail}</span><span>La détection ne demande aucune automatisation activée. Les effets restent désactivés par défaut. Les points TikTok du match sont distincts des compteurs de cadeaux et de likes du tableau de bord.</span></footer></section>
    <section class="matches-panel matches-donors" data-matches-dashboard-slot="donors"><header class="matches-panel-heading"><div><span class="matches-eyebrow">LES FORCES DU LIVE</span><h3>Donateurs du LIVE</h3></div><button type="button" class="button small ghost" data-action="matches-clear-donors" ${donors.length ? "" : "disabled"}>Vider</button></header>${donors.length ? `<ol>${donors.map((donor, index) => `<li data-matches-donor="${escapeHtml(donor.id)}"><span class="matches-donor-rank">${index + 1}</span>${creatorMatchesAvatar(donor)}<div><strong data-studio-user-content>${escapeHtml(donor.displayName || donor.username || "Donateur")}</strong><small data-studio-user-content>${donor.username ? `@${escapeHtml(String(donor.username).replace(/^@/, ""))}` : ""}</small></div><b><span class="matches-donor-coins">${creatorMatchesNumber(donor.diamonds)} ◇</span><small class="matches-donor-likes">${creatorMatchesNumber(donor.likes)} likes</small><small class="matches-donor-gifts">${creatorMatchesNumber(donor.gifts)} cadeaux</small></b></li>`).join("")}</ol>` : '<div class="matches-muted-empty">Les contributions du LIVE apparaîtront ici lorsqu’elles sont reçues.</div>'}</section></div>
    <section class="matches-panel matches-history" data-matches-dashboard-slot="history"><header class="matches-panel-heading"><div><h3>Historique récent</h3><p>Les dernières manches de ce compte et de ce profil.</p></div><button type="button" class="button small ghost" data-action="matches-reset-wins">Remettre les victoires à zéro</button></header>${history.length ? `<div class="matches-history-list">${history.map((entry) => `<article><span class="matches-result is-${escapeHtml(entry.result || "unknown")}">${escapeHtml({ win: "Victoire", lose: "Défaite", draw: "Égalité" }[entry.result] || "Résultat indisponible")}</span><span>${entry.ownScore != null && entry.rivalScore != null ? `${creatorMatchesNumber(entry.ownScore)} – ${creatorMatchesNumber(entry.rivalScore)}` : "Match TikTok"}</span><time>${entry.endedAtMs ? escapeHtml(new Date(entry.endedAtMs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })) : ""}</time></article>`).join("")}</div>` : '<p class="matches-muted-empty">Aucune manche enregistrée sur ce profil.</p>'}</section>
    <div data-matches-dashboard-slot="capabilities">${capabilities.cards === false ? '<aside class="matches-capability-note">Les cartes de match ne sont pas détectées automatiquement par la connexion TikTok actuelle. Vous pouvez les configurer et les tester manuellement, sans simulation de détection.</aside>' : ""}</div></div>`;
}

function creatorMatchesTabsMarkup() {
  return `<nav class="matches-tabs" aria-label="Sections Matchs">${[["dashboard", "Tableau de bord", "grid"], ["widgets", "Widgets", "widgets"], ["automations", "Automatisations", "bolt"]].map(([id, label, icon]) => `<button type="button" class="matches-tab ${creatorMatchesTab === id ? "active" : ""}" data-action="matches-tab" data-value="${id}" aria-pressed="${creatorMatchesTab === id}" aria-controls="creator-matches-panel">${creatorMatchesIcon(icon)}<span>${label}</span></button>`).join("")}</nav>`;
}

function creatorMatchesPanelMarkup() {
  return creatorMatchesTab === "widgets" ? creatorMatchesWidgetsMarkup() : creatorMatchesTab === "automations" ? creatorMatchesAutomationsMarkup() : creatorMatchesDashboardMarkup();
}

function creatorMatchesStructureSignature(config, capabilities) {
  return JSON.stringify([creatorMatchesOwnerKey(), creatorMatchesTab, creatorMatchesTab === "dashboard" ? null : config,
    creatorMatchesTab === "automations" ? capabilities.cards : null,
    creatorMatchesTab === "widgets" ? [creatorMatchesSourceUrl(), ...CREATOR_MATCH_WIDGETS.map(creatorMatchesWidgetUrl)] : null]);
}

function renderCreatorMatches() {
  if (!isAccountAuthenticated()) return renderPrivateDataPlaceholder("Vos matchs TikTok", "Connectez votre compte ShenPulse pour retrouver les matchs et les réglages de votre profil.");
  const { config, capabilities } = creatorMatchesModel();
  return `<div class="reference-page creator-matches-page">${renderStudioHero("matches", "Matchs", "Vos batailles TikTok. Vos widgets. Vos temps forts.")}<section class="matches-control-bar"><div><span class="matches-platform">TikTok LIVE</span><p>Un espace dédié au profil actif, sans automatisation activée par défaut.</p></div><button type="button" class="button small" data-action="matches-refresh">${creatorMatchesIcon("refresh")}Actualiser</button></section>${creatorMatchesTabsMarkup()}<div id="creator-matches-panel" data-creator-matches-panel data-matches-owner="${escapeHtml(creatorMatchesOwnerKey())}" data-matches-structure="${escapeHtml(creatorMatchesStructureSignature(config, capabilities))}">${creatorMatchesPanelMarkup()}</div></div>`;
}

function creatorMatchesPatchCurrent(current, next) {
  if (current.dataset.matchesRoster !== next.dataset.matchesRoster) {
    current.innerHTML = next.innerHTML;
    current.dataset.matchesRoster = next.dataset.matchesRoster;
    return;
  }
  for (const selector of [".matches-state", "[data-matches-time]", ".matches-multiplier", ".matches-rounds-control small", ".matches-empty h4", "[data-matches-detection-label]", "[data-matches-detection-detail]"]) {
    const before = current.querySelector(selector), after = next.querySelector(selector);
    if (!before || !after) continue;
    if (before.textContent !== after.textContent) before.textContent = after.textContent;
    if (before.className !== after.className) before.className = after.className;
  }
  for (const selector of ["[data-matches-rounds]"]) {
    const before = current.querySelector(selector), after = next.querySelector(selector);
    if (before && after && before.innerHTML !== after.innerHTML) before.innerHTML = after.innerHTML;
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
  if (currentPage !== "matches" || !isAccountAuthenticated()) return false;
  const panel = content.querySelector("[data-creator-matches-panel]");
  if (!panel) return false;
  const { runtime, config } = creatorMatchesModel();
  const capabilities = runtime.capabilities || {};
  const structure = creatorMatchesStructureSignature(config, capabilities);
  const signature = JSON.stringify([structure, creatorMatchesTab === "automations" ? null : runtime,
    creatorMatchesTab === "dashboard" ? creatorMatchesLiveConnected() : null]);
  if (panel.dataset.matchesSignature === signature) {
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
  syncCreatorMatchesClock();
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(panel);
  return true;
}
