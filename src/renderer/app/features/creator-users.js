"use strict";

/** Audience du LIVE : résumé persisté et repli sur les anciennes sessions. */
const creatorAudience = new Map();
const creatorAudienceEventIds = new Set();
let creatorAudienceSessionKey = "";
const CREATOR_AUDIENCE_LIMIT = 5000;
let creatorUserSearch = "";
let creatorUserPage = 0;
const CREATOR_USERS_PAGE_SIZE = 100;
let creatorUserStreamer = "";
let creatorUserSort = "diamonds";
let creatorUserOrder = "desc";
let creatorUserRank = "";
let creatorUserPageSize = 50;
let creatorUserDatabase = null;
let creatorUserDatabaseAccount = "";
let creatorUserDatabaseRequest = 0;
let creatorUserDatabasePending = false;
let creatorUserDatabaseRefreshAt = 0;
let creatorUserDatabaseError = "";
let creatorBlockedOpen = false;
let creatorBlockedPage = 0;
const CREATOR_BLOCKED_PAGE_SIZE = 50;
const creatorUserSelection = new Set();
const creatorUserDateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

function creatorHasUsersDatabase() {
  return typeof api !== "undefined" && typeof api.users?.snapshot === "function";
}

function creatorUsersQuery() {
  return { query: creatorUserSearch, streamer: creatorUserStreamer, sort: creatorUserSort, order: creatorUserOrder, rank: creatorUserRank, limit: creatorUserPageSize, offset: creatorUserPage * creatorUserPageSize,
    includeBlocked: creatorBlockedOpen, blockedLimit: CREATOR_BLOCKED_PAGE_SIZE, blockedOffset: creatorBlockedPage * CREATOR_BLOCKED_PAGE_SIZE };
}

function resetCreatorUsersAccount(force = false) {
  const key = String(snapshot?.state?.settings?.account?.uid || "");
  if (!force && key === creatorUserDatabaseAccount) return;
  creatorUserDatabaseAccount = key;
  creatorUserDatabase = null;
  creatorUserDatabaseRequest += 1;
  creatorUserDatabasePending = false;
  creatorUserDatabaseRefreshAt = 0;
  creatorUserDatabaseError = "";
  creatorUserSelection.clear();
  creatorUserPage = 0;
  creatorUserSearch = "";
  creatorUserStreamer = "";
  creatorUserRank = "";
  creatorBlockedOpen = false;
  creatorBlockedPage = 0;
}

/** La base n'est lue que lorsqu'elle est visible, au plus une fois par seconde. */
async function refreshCreatorUsersDatabase({ force = false } = {}) {
  resetCreatorUsersAccount();
  if (!creatorHasUsersDatabase() || !isAccountAuthenticated()) return null;
  if (!force && (creatorUserDatabasePending || Date.now() - creatorUserDatabaseRefreshAt < 1000)) return creatorUserDatabase;
  const request = ++creatorUserDatabaseRequest;
  const account = creatorUserDatabaseAccount;
  creatorUserDatabasePending = true;
  creatorUserDatabaseRefreshAt = Date.now();
  try {
    const result = await api.users.snapshot(creatorUsersQuery());
    if (request !== creatorUserDatabaseRequest || !isAccountAuthenticated() || account !== String(snapshot?.state?.settings?.account?.uid || "")) return null;
    creatorUserDatabase = result;
    creatorUserDatabaseError = "";
    const pages = Math.max(1, Math.ceil(Number(result.filteredTotal || 0) / creatorUserPageSize));
    if (creatorUserPage >= pages) {
      creatorUserPage = pages - 1;
      return refreshCreatorUsersDatabase({ force: true });
    }
    const blockedPages = Math.max(1, Math.ceil(Number(result.blockedTotal || 0) / CREATOR_BLOCKED_PAGE_SIZE));
    if (creatorBlockedOpen && creatorBlockedPage >= blockedPages) {
      creatorBlockedPage = blockedPages - 1;
      return refreshCreatorUsersDatabase({ force: true });
    }
    syncCreatorUsersRuntime({ request: false });
    return result;
  } catch (error) {
    if (request === creatorUserDatabaseRequest && account === String(snapshot?.state?.settings?.account?.uid || "")) {
      creatorUserDatabaseError = error?.message || "Impossible de lire la base utilisateurs.";
      syncCreatorUsersRuntime({ request: false });
    }
    return null;
  } finally {
    if (request === creatorUserDatabaseRequest) creatorUserDatabasePending = false;
  }
}

function creatorSessionKey() {
  const state = snapshot?.state || {};
  return String(state.statistics?.liveSession?.startedAt || state.overlaySession?.startedAt || state.session?.startedAt || "preview");
}

function creatorPersistedAudience() {
  const session = snapshot?.state?.statistics?.liveSession;
  // Le snapshot courant ne transmet que les meilleurs donateurs : ce sous-ensemble
  // n'est jamais présenté comme la liste complète dans le repli ancien preload.
  if (Number(session?.participantCount) > (session?.participants?.length || 0)) return null;
  return session?.hasData === true && Array.isArray(session.participants) ? session : null;
}

function resetCreatorAudienceIfNeeded() {
  const key = creatorSessionKey();
  if (key === creatorAudienceSessionKey) return;
  creatorAudienceSessionKey = key;
  creatorAudience.clear();
  creatorAudienceEventIds.clear();
  creatorUserPage = 0;
}

function rememberCreatorAudienceEvent(event) {
  if (creatorHasUsersDatabase()) return;
  resetCreatorAudienceIfNeeded();
  // Le noyau agrège désormais chaque événement une seule fois. La fenêtre ne
  // recalcule que les anciennes sessions sans résumé, jamais les nouveaux LIVE.
  if (creatorPersistedAudience()) return;
  if (!event?.user || !event.id || creatorAudienceEventIds.has(event.id)) return;
  if (/^(simulator|test|rule-test|manual-preview|demo)$/.test(String(event.source || ""))) return;
  const startedAt = Date.parse(creatorAudienceSessionKey);
  const occurredAt = Date.parse(event.timestamp);
  if (Number.isFinite(startedAt) && Number.isFinite(occurredAt) && occurredAt < startedAt) return;
  creatorAudienceEventIds.add(event.id);
  // La fenêtre de déduplication reste bornée, comme le journal d'événements.
  if (creatorAudienceEventIds.size > 20000) {
    creatorAudienceEventIds.delete(creatorAudienceEventIds.values().next().value);
  }
  const id = String(event.user.id || event.user.name || "anonymous");
  if (!creatorAudience.has(id) && creatorAudience.size >= CREATOR_AUDIENCE_LIMIT) return;
  const row = creatorAudience.get(id) || { id, comments: 0, shares: 0, gifts: 0, likes: 0, coins: 0, events: 0 };
  const count = Math.max(1, Number(event.data?.count) || 1);
  Object.assign(row, { name: event.user.name || row.name || id, displayName: event.user.displayName || row.displayName || id, avatarUrl: event.user.avatarUrl || row.avatarUrl || "", subscriber: event.user.subscriber === true || row.subscriber, moderator: event.user.moderator === true || row.moderator, lastSeenAt: event.timestamp || row.lastSeenAt });
  row.events += 1;
  if (event.type === "chat") row.comments += 1;
  if (event.type === "share") row.shares += 1;
  if (event.type === "like") row.likes += count;
  if (event.type === "gift") {
    row.gifts += count;
    row.coins += count * Math.max(1, Number(event.data?.value) || 1);
  }
  creatorAudience.set(id, row);
}

function creatorAudienceRows() {
  resetCreatorAudienceIfNeeded();
  const persisted = creatorPersistedAudience();
  if (persisted) return persisted.participants.map((row) => ({
    ...row,
    id: `${row.platform || "live"}:${row.id}`,
    name: row.username || row.id,
    displayName: row.name || row.username || row.id,
    lastSeenAt: row.lastSeen
  })).sort(compareCreatorAudience);
  const runtime = snapshot?.state?.overlaySession || {};
  [...(runtime.recentEvents || [])].reverse().forEach(rememberCreatorAudienceEvent);
  [...liveEvents].reverse().forEach(rememberCreatorAudienceEvent);
  const rows = new Map([...creatorAudience].map(([id, row]) => [id, { ...row }]));
  for (const id of snapshot?.state?.statistics?.sessionUniqueViewers || []) {
    if (!rows.has(String(id))) rows.set(String(id), { id: String(id), name: String(id), displayName: String(id), events: 0, comments: 0, shares: 0, gifts: 0, likes: 0, coins: 0 });
  }
  for (const [kind, field] of [["donors", "coins"], ["tappers", "likes"]]) {
    for (const entry of runtime.leaderboards?.[kind] || []) {
      const id = String(entry.id);
      const row = rows.get(id) || { id, events: 0, comments: 0, shares: 0, gifts: 0, likes: 0, coins: 0 };
      row.displayName = entry.name || row.displayName || id;
      row.name ||= entry.name || id;
      row.avatarUrl = entry.avatarUrl || row.avatarUrl || "";
      row[field] = Math.max(0, Number(entry.score) || 0);
      rows.set(id, row);
    }
  }
  return [...rows.values()].sort(compareCreatorAudience);
}

function compareCreatorAudience(left, right) {
  return right.coins - left.coins || right.likes - left.likes || right.events - left.events || String(left.displayName).localeCompare(String(right.displayName), "fr");
}

function creatorUserAvatar(user) {
  return `<span class="creator-user-avatar">${user.avatarUrl ? `<img src="${escapeHtml(user.avatarUrl)}" alt="" loading="lazy" decoding="async">` : escapeHtml(String(user.displayName || user.name || "?").slice(0, 2).toUpperCase())}</span>`;
}

function creatorDonorRows(limit = 5) {
  const donors = snapshot?.state?.overlaySession?.leaderboards?.donors || [];
  return donors.length ? donors.slice(0, limit).map((entry, index) => `<div class="list-row creator-donor-row"><span class="creator-rank">${index + 1}</span>${creatorUserAvatar({ ...entry, displayName: entry.name })}<div><h4>${escapeHtml(entry.name)}</h4><p>Contributions de la session</p></div><strong>${asNumber(entry.score)} <small>pièces</small></strong></div>`).join("") : emptyInline("Les premiers cadeaux feront apparaître vos donateurs ici.");
}

function creatorUsersStatsMarkup(rows = creatorAudienceRows()) {
  if (creatorHasUsersDatabase()) {
    const database = creatorUserDatabase;
    const values = [
      ["Utilisateurs totaux", database?.total, "users", "cyan"],
      ["Diamants totaux", database?.stats?.diamonds, "membership", "gold"],
      ["Rang dominant", database?.stats?.dominantRank || "—", "actions", "violet"]
    ];
    return values.map(([label, value, icon, color]) => `<article class="audience-metric audience-metric-${color}"><span class="audience-metric-icon">${typeof navigationIcon === "function" ? navigationIcon(icon) : ""}</span><div><span>${label}</span><strong>${database ? label === "Rang dominant" ? creatorViewerRankMarkup(value, "audience-dominant-rank") : escapeHtml(typeof value === "number" ? asNumber(value) : value || 0) : "—"}</strong></div></article>`).join("");
  }
  const statistics = snapshot.state.statistics || {};
  const unique = typeof ShenPulseLiveStatistics === "object"
    ? ShenPulseLiveStatistics.uniqueViewerCount(statistics, true, rows.length)
    : statistics.sessionUniqueViewerCount ?? (statistics.sessionUniqueViewers?.length || rows.length);
  const donors = rows.filter((row) => row.coins > 0).length;
  const tappers = rows.filter((row) => row.likes > 0).length;
  return `${statCard("Spectateurs uniques", unique, "◉", "var(--cyan)", "cette session")}${statCard("Donateurs", donors, "◇", "var(--violet)", "dans le classement")}${statCard("Participants aux likes", tappers, "♥", "var(--red)", "dans le classement")}${statCard("Événements traités", snapshot.state.statistics.sessionEvents, "⌁", "var(--green)", "cette session")}`;
}

function creatorUsersTableMarkup(rows = creatorAudienceRows()) {
  if (creatorHasUsersDatabase()) return creatorDatabaseTableMarkup();
  const query = normalizeCatalogSearch(creatorUserSearch);
  const filtered = rows.filter((row) => !query || normalizeCatalogSearch(`${row.displayName} ${row.name} ${row.id}`).includes(query));
  const pages = Math.max(1, Math.ceil(filtered.length / CREATOR_USERS_PAGE_SIZE));
  creatorUserPage = Math.min(creatorUserPage, pages - 1);
  const visible = filtered.slice(creatorUserPage * CREATOR_USERS_PAGE_SIZE, (creatorUserPage + 1) * CREATOR_USERS_PAGE_SIZE);
  return `<div class="data-table-wrap"><table class="data-table creator-users-table"><thead><tr><th>SPECTATEUR</th><th>PIÈCES</th><th>LIKES</th><th>COMMENTAIRES OBSERVÉS</th><th>PARTAGES OBSERVÉS</th><th>DERNIÈRE INTERACTION</th></tr></thead><tbody>${visible.length ? visible.map((row) => `<tr data-creator-user-row><td><div class="creator-user-identity">${creatorUserAvatar(row)}<span><strong>${escapeHtml(row.displayName)}</strong><small>${escapeHtml(row.name)}${row.moderator ? " · Modérateur" : row.subscriber ? " · Abonné" : ""}</small></span></div></td><td>${asNumber(row.coins)}</td><td>${asNumber(row.likes)}</td><td>${asNumber(row.comments)}</td><td>${asNumber(row.shares)}</td><td>${formatTime(row.lastSeenAt)}</td></tr>`).join("") : `<tr><td colspan="6">${emptyInline(query ? "Aucun spectateur ne correspond à votre recherche." : "Lancez votre session et recevez une première interaction.")}</td></tr>`}</tbody></table></div><div class="catalog-toolbar creator-users-pagination"><span>${filtered.length} spectateur${filtered.length > 1 ? "s" : ""} · page ${creatorUserPage + 1} / ${pages}</span><div class="button-row"><button class="button small" data-action="creator-user-page" data-direction="-1" ${creatorUserPage ? "" : "disabled"}>← Précédente</button><button class="button small" data-action="creator-user-page" data-direction="1" ${creatorUserPage + 1 < pages ? "" : "disabled"}>Suivante →</button></div></div>`;
}

function renderCreatorUsers() {
  if (!isAccountAuthenticated()) return renderPrivateDataPlaceholder("Votre audience", "Connectez votre compte ShenPulse pour consulter les interactions et les classements de votre session.");
  resetCreatorUsersAccount();
  if (creatorHasUsersDatabase()) {
    Promise.resolve().then(() => { if (currentPage === "users") void refreshCreatorUsersDatabase(); });
    return `<div class="reference-page creator-users-page creator-audience-database">
      ${renderStudioHero("users", "Les visages derrière votre live.", "Retrouvez les spectateurs rencontrés au fil de vos LIVE et leurs contributions.")}
      <section class="audience-metrics" data-creator-users-stats>${creatorUsersStatsMarkup([])}</section>
      <section class="audience-moderation"><div><h3>Modération</h3><p>Un viewer bloqué ici ne déclenche plus rien : ni actions, ni jeux, ni voix. Il reste dans la base et dans les classements.</p></div><label><span>Utilisateurs bloqués (séparés par une virgule ou une ligne)</span><textarea data-creator-users-blocked placeholder="@pseudo1, @pseudo2" rows="2">${escapeHtml((creatorUserDatabase?.blockedUsers || []).join(", "))}</textarea></label><div class="audience-moderation-actions"><button class="button primary" data-action="audience-apply-blocked">Appliquer</button><button class="button small audience-blocked-toggle" data-action="audience-show-blocked" aria-expanded="${creatorBlockedOpen}" aria-controls="audience-blocked-panel">Utilisateurs bloqués <span data-audience-blocked-count>${creatorUserDatabase?.blockedTotal || 0}</span></button></div></section>
      <section class="studio-panel audience-blocked-panel" id="audience-blocked-panel" data-creator-users-blocked-panel ${creatorBlockedOpen ? "" : "hidden"}>${creatorBlockedUsersMarkup()}</section>
      <div class="audience-ranks"><span>RANGS</span>${creatorViewerRanks().slice().reverse().map((rank) => `<button class="audience-rank-chip ${creatorUserRank === rank.id ? "active" : ""}" style="--rank-color:${rank.color}" data-action="audience-rank" data-id="${rank.id}" aria-pressed="${creatorUserRank === rank.id}" data-studio-viewer-rank title="${escapeHtml(creatorViewerRankCondition(rank))}">${creatorViewerRankIcon(rank)}${escapeHtml(rank.label)}</button>`).join("")}<button class="audience-rank-reset" data-action="audience-rank" data-id="" aria-pressed="${!creatorUserRank}">Tous</button></div>
      ${creatorViewerRankGuideMarkup()}
      <section class="studio-panel audience-database-panel"><div class="audience-database-heading"><h3>Base de données Utilisateurs</h3><span data-creator-users-count>${creatorUserDatabase?.total || 0}</span><p>Historique cumulé des utilisateurs et de leurs activités sur vos LIVE.</p></div>
      <div class="audience-filters"><label class="search-control"><span aria-hidden="true">⌕</span><input type="search" data-creator-user-search value="${escapeHtml(creatorUserSearch)}" placeholder="Rechercher un utilisateur…" aria-label="Rechercher un utilisateur"></label>${creatorUsersFilterFields()}</div>
      <div class="audience-data-actions"><div class="button-row"><button class="button small" data-action="audience-import">Importer JSON</button><button class="button small" data-action="audience-export">Exporter JSON</button><button class="button small" data-action="audience-cleanup">Nettoyer les 0 diamants</button><button class="button small danger" data-action="audience-clear">Supprimer tout</button></div><div class="button-row"><span data-audience-selection-count>0 sélectionné</span><button class="button small" data-action="audience-merge" title="Fusionne uniquement une même identité, sur la même plateforme et le même streamer">Fusionner les doublons</button></div><input type="file" accept="application/json,.json" data-creator-users-import hidden></div>
      <div data-creator-users-table>${creatorDatabaseTableMarkup()}</div><p class="audience-storage-note">Historique privé de votre compte · 10 000 utilisateurs maximum · Rangs de contribution propres à ShenPulse</p></section>
    </div>`;
  }
  const rows = creatorAudienceRows();
  return `<div class="reference-page creator-users-page">${renderStudioHero("users", "Les visages derrière votre live.", "Retrouvez les spectateurs rencontrés dans cette session, leurs contributions et les interactions observées.")}<section class="stats-grid" data-creator-users-stats>${creatorUsersStatsMarkup(rows)}</section><section class="studio-panel panel-cyan"><header class="studio-panel-heading"><div><span class="panel-accent"></span><div><h3>Audience de la session</h3><p>Pièces et likes viennent des classements enregistrés. Commentaires, partages et cadeaux sont comptés depuis les événements observés par cette fenêtre ; les noms sont complétés à leur prochaine interaction.</p></div></div><span class="count-pill" data-creator-users-count>${rows.length}</span></header><div class="catalog-toolbar"><label class="search-control"><span>⌕</span><input type="search" data-creator-user-search value="${escapeHtml(creatorUserSearch)}" placeholder="Rechercher un spectateur…" aria-label="Rechercher un spectateur"></label></div><div data-creator-users-table>${creatorUsersTableMarkup(rows)}</div></section></div>`;
}

function filterCreatorUsers(input) {
  creatorUserSearch = input?.value || "";
  creatorUserPage = 0;
  if (creatorHasUsersDatabase()) return refreshCreatorUsersDatabase({ force: true });
  syncCreatorUsersRuntime();
}

function syncCreatorUsersRuntime({ request = true } = {}) {
  if (currentPage !== "users" || !isAccountAuthenticated()) return false;
  const table = content.querySelector("[data-creator-users-table]");
  if (!table) return false;
  // Les événements LIVE ne changent pas directement la table historique : seule
  // une nouvelle page IPC la repeint. Une rafale ne reconstruit pas les mêmes lignes.
  if (creatorHasUsersDatabase() && request) {
    void refreshCreatorUsersDatabase();
    return true;
  }
  const rows = creatorHasUsersDatabase() ? [] : creatorAudienceRows();
  table.innerHTML = creatorUsersTableMarkup(rows);
  const stats = content.querySelector("[data-creator-users-stats]");
  if (stats) stats.innerHTML = creatorUsersStatsMarkup(rows);
  const count = content.querySelector("[data-creator-users-count]");
  if (count) count.textContent = creatorHasUsersDatabase() ? creatorUserDatabase?.total || 0 : rows.length;
  if (creatorHasUsersDatabase()) {
    const blocked = content.querySelector("[data-creator-users-blocked]");
    if (blocked && document.activeElement !== blocked && blocked.dataset.edited !== "true") blocked.value = (creatorUserDatabase?.blockedUsers || []).join(", ");
    const streamer = content.querySelector('[data-creator-users-filter="streamer"]');
    if (streamer && document.activeElement !== streamer) streamer.innerHTML = creatorUsersStreamerOptions();
    const blockedPanel = content.querySelector("[data-creator-users-blocked-panel]");
    if (blockedPanel) {
      blockedPanel.hidden = !creatorBlockedOpen;
      if (creatorBlockedOpen) blockedPanel.innerHTML = creatorBlockedUsersMarkup();
    }
    const blockedToggle = content.querySelector('[data-action="audience-show-blocked"]');
    blockedToggle?.setAttribute("aria-expanded", String(creatorBlockedOpen));
    content.querySelectorAll("[data-audience-blocked-count]").forEach((element) => { element.textContent = creatorUserDatabase?.blockedTotal || 0; });
    syncCreatorAudienceSelection();
  }
  if (typeof applyStudioLanguage === "function") applyStudioLanguage(content);
  return true;
}

/** Liste privée paginée : inclut les blocages saisis avant toute interaction. */
function creatorBlockedUsersMarkup() {
  const database = creatorUserDatabase;
  const rows = database?.blockedEntries || [];
  const total = Number(database?.blockedTotal || 0);
  const pages = Math.max(1, Math.ceil(total / CREATOR_BLOCKED_PAGE_SIZE));
  const ready = Array.isArray(database?.blockedEntries);
  const empty = creatorUserDatabaseError || (!ready ? "Chargement des utilisateurs bloqués…" : "Aucun utilisateur bloqué pour ce streamer.");
  return `<header class="audience-blocked-heading"><div><h3>Utilisateurs bloqués</h3><p>Retirez un blocage sans supprimer la fiche ni ses contributions. Le blocage concerne uniquement les interactions dans ShenPulse.</p></div><button class="button small" data-action="audience-show-blocked" aria-label="Fermer les utilisateurs bloqués">Fermer</button></header>
    <div class="audience-blocked-list">${rows.length ? rows.map((row) => `<article class="audience-blocked-entry"><div class="creator-user-identity">${creatorUserAvatar({ ...row, displayName: row.name || row.username })}<span data-studio-user-content><strong>${row.username ? `@${escapeHtml(row.username)}` : escapeHtml(row.name)}</strong><small>${row.platform === "kick" ? "Kick" : "TikTok"} · Streamer @${escapeHtml(row.streamer)}</small></span></div><button class="button small" data-action="audience-unblock" data-id="${escapeHtml(row.id)}" aria-label="Débloquer ${escapeHtml(row.username || row.name)}">Débloquer</button></article>`).join("") : `<div class="audience-empty ${creatorUserDatabaseError ? "is-error" : ""}">${escapeHtml(empty)}${creatorUserDatabaseError ? '<button class="button small" data-action="audience-refresh">Réessayer</button>' : ""}</div>`}</div>
    <div class="catalog-toolbar creator-users-pagination"><span>${total} blocage${total > 1 ? "s" : ""} · page ${creatorBlockedPage + 1} / ${pages}</span><div class="button-row"><button class="button small" data-action="audience-blocked-page" data-direction="-1" ${creatorBlockedPage ? "" : "disabled"}>← Précédente</button><button class="button small" data-action="audience-blocked-page" data-direction="1" ${creatorBlockedPage + 1 < pages ? "" : "disabled"}>Suivante →</button></div></div>`;
}

function creatorViewerRanks() {
  return typeof ShenPulseViewerRanks === "object" ? ShenPulseViewerRanks.ranks : [];
}

function creatorViewerRank(value) {
  return typeof ShenPulseViewerRanks === "object" ? ShenPulseViewerRanks.rankForDiamonds(value) : { id: "new", label: "Nouveau", color: "#9ca3ba" };
}

/** Repli visuel pour les anciens snapshots sans métadonnée d'icône. */
const CREATOR_VIEWER_RANK_ICONS = Object.freeze({
  new: "🌱", fan: "🔰", supporter: "💙", active: "⭐", loyal: "💎", vip: "🏆",
  legend: "👑", mythic: "🌟", divine: "🔱", cosmic: "🌌", immortal: "☄️"
});

function creatorViewerRankMetadata(value) {
  const ranks = creatorViewerRanks();
  return typeof value === "string"
    ? ranks.find((rank) => rank.id === value || rank.label === value) || null
    : ranks.find((rank) => rank.id === value?.id) || value || null;
}

/** Le libellé reste lu par les lecteurs d'écran, l'emoji est décoratif. */
function creatorViewerRankIcon(value) {
  const rank = creatorViewerRankMetadata(value);
  const icon = rank?.icon || CREATOR_VIEWER_RANK_ICONS[rank?.id];
  return icon ? `<span class="audience-rank-icon" aria-hidden="true">${escapeHtml(icon)}</span>` : "";
}

function creatorViewerRankCondition(value) {
  const rank = creatorViewerRankMetadata(value);
  if (!rank) return "";
  if (typeof ShenPulseViewerRanks === "object" && typeof ShenPulseViewerRanks.describeRank === "function") return ShenPulseViewerRanks.describeRank(rank);
  return Number.isFinite(Number(rank.minimum)) ? `À partir de ${rank.minimum} diamants cumulés · palier ShenPulse` : "";
}

/** Rendu unique pour le tableau, le rang dominant et la fiche détaillée. */
function creatorViewerRankMarkup(value, className = "audience-rank-pill") {
  const rank = creatorViewerRankMetadata(value);
  if (!rank) return escapeHtml(typeof value === "string" ? value : "—");
  return `<span class="${className}" style="--rank-color:${escapeHtml(rank.color || "#9ca3ba")}" data-studio-viewer-rank title="${escapeHtml(creatorViewerRankCondition(rank))}">${creatorViewerRankIcon(rank)}${escapeHtml(rank.label)}</span>`;
}

/** Guide fermé au chargement : les conditions viennent du barème partagé. */
function creatorViewerRankGuideMarkup() {
  return `<details class="audience-rank-guide"><summary>Conditions des rangs</summary><div class="audience-rank-guide-content"><p>Seule la valeur cumulée des cadeaux détermine le rang. Elle est conservée entre vos LIVE, séparément pour chaque spectateur, plateforme et streamer. Les likes, les messages du chat et les nouveaux abonnés ne modifient pas le rang.</p><ul class="audience-rank-guide-grid">${creatorViewerRanks().map((rank) => `<li>${creatorViewerRankMarkup(rank)}<span>${escapeHtml(creatorViewerRankCondition(rank))}</span></li>`).join("")}</ul></div></details>`;
}

/** Fiche réutilisable, sans nouveau calcul ni lecture de la base privée. */
function creatorViewerRankProgressMarkup(value) {
  if (typeof ShenPulseViewerRanks !== "object" || typeof ShenPulseViewerRanks.progressForDiamonds !== "function") return "";
  const progress = ShenPulseViewerRanks.progressForDiamonds(value);
  const heading = progress.nextRank ? "Prochain rang" : "Rang maximal atteint";
  return `<section class="audience-rank-progress" style="--rank-color:${progress.rank.color}"><div class="audience-rank-progress-heading"><span>${heading}</span>${creatorViewerRankMarkup(progress.nextRank || progress.rank)}</div>${progress.nextRank ? `<progress max="${progress.required}" value="${progress.earned}" aria-label="Progression dans le palier"></progress><p><strong>${asNumber(progress.remaining)}</strong> <span>${progress.remaining === 1 ? "diamant restant" : "diamants restants"}</span></p>` : ""}<small>Progression calculée avec les contributions cumulées de cette fiche. Elle ne repart pas à zéro à chaque LIVE.</small></section>`;
}

function creatorUsersStreamerOptions() {
  const options = [["", "Streamer actuel"], ["*", "Tous les streamers"], ...(creatorUserDatabase?.streamers || []).map((value) => [typeof value === "string" ? value : value.id, typeof value === "string" ? `@${value}` : value.label])];
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${creatorUserStreamer === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function creatorUsersFilterFields() {
  const picker = (key, value, options, label) => `<label><span>${label}</span><select data-creator-users-filter="${key}" aria-label="${label}">${options.map(([id, text]) => `<option value="${id}" ${String(value) === id ? "selected" : ""}>${text}</option>`).join("")}</select></label>`;
  return `<label><span>Streamer</span><select data-creator-users-filter="streamer" aria-label="Streamer">${creatorUsersStreamerOptions()}</select></label>${picker("sort", creatorUserSort, [["diamonds", "Diamants"], ["name", "Nom"], ["firstSeen", "Première activité"], ["lastSeen", "Dernière activité"]], "Trier par")}${picker("order", creatorUserOrder, [["desc", "Décroissant"], ["asc", "Croissant"]], "Ordre")}${picker("pageSize", creatorUserPageSize, [["50", "50"], ["100", "100"], ["200", "200"]], "Par page")}`;
}

function creatorUserDate(value) {
  const date = new Date(value);
  return value && Number.isFinite(date.getTime()) ? creatorUserDateFormat.format(date) : "—";
}

function creatorUserRelativeDate(value) {
  const elapsed = Math.max(0, Date.now() - Date.parse(value));
  if (!Number.isFinite(elapsed)) return "";
  if (elapsed < 60000) return "à l’instant";
  if (elapsed < 3600000) return `il y a ${Math.floor(elapsed / 60000)} min`;
  if (elapsed < 86400000) return `il y a ${Math.floor(elapsed / 3600000)} h`;
  return `il y a ${Math.floor(elapsed / 86400000)} j`;
}

function creatorDatabaseTableMarkup() {
  const database = creatorUserDatabase;
  const rows = database?.rows || [];
  const total = Number(database?.filteredTotal || 0);
  const pages = Math.max(1, Math.ceil(total / creatorUserPageSize));
  const empty = creatorUserDatabaseError || (!database ? "Chargement de la base utilisateurs…" : "Aucun utilisateur ne correspond à ces filtres. Les prochaines interactions réelles enrichiront votre historique.");
  return `<div class="data-table-wrap"><table class="data-table creator-users-table audience-history-table"><thead><tr><th><input type="checkbox" data-creator-users-select-all aria-label="Sélectionner la page"></th><th>#</th><th>UTILISATEUR</th><th>RANG</th><th>DIAMANTS</th><th>PREMIÈRE ACTIVITÉ</th><th>DERNIÈRE ACTIVITÉ</th><th>ACTIONS</th></tr></thead><tbody>${rows.length ? rows.map((row, index) => {
    const rank = creatorViewerRank(row.diamonds);
    const position = creatorUserPage * creatorUserPageSize + index + 1;
    const user = { ...row, displayName: row.name || row.username, name: row.username };
    return `<tr data-creator-user-row class="${row.blocked ? "is-blocked" : ""}"><td><input type="checkbox" data-creator-users-select="${escapeHtml(row.id)}" aria-label="Sélectionner ${escapeHtml(row.username || row.name)}" ${creatorUserSelection.has(row.id) ? "checked" : ""}></td><td class="audience-position position-${position <= 3 ? position : "other"}">${position <= 3 ? ["", "🥇", "🥈", "🥉"][position] : position}</td><td><div class="creator-user-identity">${creatorUserAvatar(user)}<span><strong>${escapeHtml(user.displayName)}</strong><small>@${escapeHtml(String(row.username || "").replace(/^@/, ""))}<span class="audience-platform">${row.platform === "kick" ? "Kick" : "TikTok"}</span>${row.blocked ? '<span class="audience-blocked-label">Bloqué</span>' : ""}</small></span></div></td><td>${creatorViewerRankMarkup(rank)}</td><td class="audience-diamonds">${asNumber(row.diamonds)} <span aria-hidden="true">◆</span></td><td>${creatorUserDate(row.firstSeen)}</td><td>${creatorUserDate(row.lastSeen)}<small class="audience-relative-time">${creatorUserRelativeDate(row.lastSeen)}</small></td><td><div class="audience-row-actions"><button class="audience-row-button ${row.blocked ? "is-active" : ""}" data-action="audience-block" data-id="${escapeHtml(row.id)}" title="${row.blocked ? "Débloquer" : "Bloquer globalement"}" aria-label="${row.blocked ? "Débloquer" : "Bloquer"} ${escapeHtml(row.username || row.name)}">${row.blocked ? "Débloquer" : "Bloquer"}</button><button class="audience-row-button" data-action="audience-details" data-id="${escapeHtml(row.id)}">Détails</button><button class="audience-row-button danger" data-action="audience-delete" data-id="${escapeHtml(row.id)}" aria-label="Supprimer ${escapeHtml(row.username || row.name)}">×</button></div></td></tr>`;
  }).join("") : `<tr><td colspan="8"><div class="audience-empty ${creatorUserDatabaseError ? "is-error" : ""}">${escapeHtml(empty)}${creatorUserDatabaseError ? '<button class="button small" data-action="audience-refresh">Réessayer</button>' : ""}</div></td></tr>`}</tbody></table></div><div class="catalog-toolbar creator-users-pagination"><span>${total} utilisateur${total > 1 ? "s" : ""} · page ${creatorUserPage + 1} / ${pages}</span><div class="button-row"><button class="button small" data-action="audience-page" data-direction="-1" ${creatorUserPage ? "" : "disabled"}>← Précédente</button><button class="button small" data-action="audience-page" data-direction="1" ${creatorUserPage + 1 < pages ? "" : "disabled"}>Suivante →</button></div></div>`;
}

function syncCreatorAudienceSelection() {
  const count = content.querySelector("[data-audience-selection-count]");
  if (count) count.textContent = `${creatorUserSelection.size} sélectionné${creatorUserSelection.size > 1 ? "s" : ""}`;
}

/** Retourne vrai si l'événement a été traité par la délégation de contenu. */
function handleCreatorAudienceChange(target) {
  if (target.matches("[data-creator-users-filter]")) {
    const key = target.dataset.creatorUsersFilter;
    if (key === "streamer") creatorUserStreamer = target.value;
    if (key === "sort") creatorUserSort = target.value;
    if (key === "order") creatorUserOrder = target.value;
    if (key === "pageSize") creatorUserPageSize = Number(target.value) || 50;
    creatorUserPage = 0;
    if (key === "streamer") creatorBlockedPage = 0;
    creatorUserSelection.clear();
    void refreshCreatorUsersDatabase({ force: true });
    return true;
  }
  if (target.matches("[data-creator-users-select], [data-creator-users-select-all]")) {
    const checkboxes = target.hasAttribute("data-creator-users-select-all") ? content.querySelectorAll("[data-creator-users-select]") : [target];
    for (const checkbox of checkboxes) {
      checkbox.checked = target.checked;
      if (checkbox.checked) creatorUserSelection.add(checkbox.dataset.creatorUsersSelect);
      else creatorUserSelection.delete(checkbox.dataset.creatorUsersSelect);
    }
    syncCreatorAudienceSelection();
    return true;
  }
  if (target.matches("[data-creator-users-import]")) {
    void importCreatorAudienceFile(target).catch((error) => toast("Import impossible", error.message || String(error), true));
    return true;
  }
  if (target.matches("[data-creator-users-blocked]")) { target.dataset.edited = "true"; return true; }
  return false;
}
