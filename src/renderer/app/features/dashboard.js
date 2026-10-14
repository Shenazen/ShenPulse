"use strict";

/** Tableau de bord : bilan réel persistant, graphiques SVG bornés et simulateur indépendant. */
let dashboardChartTab = "viewers";
const DASHBOARD_TEST_SOURCES = new Set(["simulator", "test", "rule-test", "manual-preview", "demo"]);
const DASHBOARD_SIMULATOR_TYPES = ["gift", "like", "follow", "chat", "share", "subscribe", "join"];

function dashboardLiveSummary() {
  const live = snapshot.state.statistics?.liveSession;
  return live?.schemaVersion === 1 ? live : { hasData: false, events: 0, likes: 0,
    gifts: 0, giftCoins: 0, followers: 0, shares: 0, comments: 0, currentViewers: null,
    peakViewers: null, platformLikes: null, participants: [], audienceHistory: [], engagementHistory: [] };
}

function dashboardDetectedLive() {
  return snapshot.state.settings?.tiktok?.status === "live" || snapshot.state.settings?.kick?.live === true;
}

function renderDashboard() {
  if (!isAccountAuthenticated()) {
    return `<div class="page-grid guest-dashboard"><section class="card dashboard-guest"><h2>Votre tableau de bord, prêt pour le LIVE.</h2><p>Connectez votre compte ShenPulse pour retrouver vos statistiques, votre audience et vos interactions.</p><div class="button-row"><button class="button primary" data-action="account-login">Se connecter ou s’inscrire</button><button class="button ghost" data-navigate="games">Voir les jeux</button></div></section></div>`;
  }
  return `<div class="page-grid creator-dashboard">
    ${renderStudioHero("dashboard", "Votre LIVE, en un coup d’œil.", "Retrouvez les chiffres du LIVE en cours ou le bilan de votre dernière diffusion.")}
    <div class="dashboard-context" data-dashboard-context>${dashboardContextMarkup()}</div>
    <section class="dashboard-metrics" data-dashboard-stats aria-label="Statistiques du LIVE">${dashboardStatsMarkup()}</section>
    ${dashboardSimulatorMarkup()}
    <div class="dashboard-live-grid">
      <section class="card dashboard-chart-panel"><header class="dashboard-panel-header"><h3>Activité en temps réel</h3><div class="dashboard-chart-tabs" role="tablist" aria-label="Graphique d’activité"><button type="button" role="tab" data-dashboard-chart-tab="viewers" aria-selected="${dashboardChartTab === "viewers"}">Viewers</button><button type="button" role="tab" data-dashboard-chart-tab="engagement" aria-selected="${dashboardChartTab === "engagement"}">Engagement</button></div></header><div data-dashboard-chart>${dashboardChartMarkup()}</div></section>
      <section class="card dashboard-donors"><header class="dashboard-panel-header"><h3>Top Donateurs</h3>${canNavigateTo("users") ? '<button class="dashboard-text-link" data-navigate="users">Voir tout <span aria-hidden="true">›</span></button>' : ""}</header><div class="dashboard-ranking" data-dashboard-donors>${dashboardDonorsMarkup()}</div></section>
      <section class="card dashboard-chat-panel"><header class="dashboard-panel-header"><h3>Chat</h3><span class="dashboard-panel-count" data-dashboard-chat-count>${dashboardChatCountMarkup()}</span></header><div class="dashboard-feed" data-dashboard-chat>${dashboardChatMarkup()}</div></section>
      <section class="card dashboard-events-panel"><header class="dashboard-panel-header"><h3>Événements</h3>${canNavigateTo("activity") ? '<button class="dashboard-text-link" data-navigate="activity">Journal <span aria-hidden="true">›</span></button>' : ""}</header><div class="dashboard-feed" data-dashboard-events>${dashboardEventsMarkup()}</div></section>
    </div>
  </div>`;
}

function dashboardContextMarkup() {
  const live = dashboardLiveSummary();
  const active = dashboardDetectedLive();
  const date = live.startedAt ? formatTime(live.startedAt) : "";
  return `<span class="dashboard-live-context ${active ? "is-live" : ""}"><i aria-hidden="true"></i>${active ? "LIVE en cours" : live.hasData ? "Dernier LIVE" : "En attente de votre premier LIVE"}${date ? ` <small>· ${escapeHtml(date)}</small>` : ""}</span><span class="dashboard-context-note">Les tests du simulateur ne modifient pas ces chiffres.</span>`;
}

function dashboardMetricIcon(kind) {
  const paths = {
    viewers: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    likes: '<path d="M20.8 4.8a5.5 5.5 0 0 0-7.8 0L12 5.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
    gifts: '<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12"/><path d="M12 9H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>',
    diamonds: '<path d="m3 8 4-5h10l4 5-9 13L3 8ZM3 8h18M7 3l5 18L17 3"/>',
    followers: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v6M16 11h6"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] || paths.viewers}</svg>`;
}

function dashboardMetricCard(kind, label, value, detail, extra = "") {
  return `<article class="dashboard-metric dashboard-metric-${kind}"><div class="dashboard-metric-top"><span class="dashboard-metric-icon">${dashboardMetricIcon(kind)}</span>${extra}</div><strong class="dashboard-metric-value">${escapeHtml(value)}</strong><span class="dashboard-metric-label">${escapeHtml(label)}</span><div class="dashboard-metric-detail">${detail}</div></article>`;
}

function dashboardStatsMarkup() {
  const live = dashboardLiveSummary();
  const number = (value) => value == null ? "—" : asNumber(value);
  const history = live.audienceHistory || [];
  const delta = history.length > 1 ? history.at(-1).viewers - history.at(-2).viewers : null;
  const change = delta == null ? "" : `<span class="dashboard-metric-delta ${delta < 0 ? "negative" : ""}" title="Évolution depuis le précédent point d’audience">${delta > 0 ? "+" : ""}${number(delta)}</span>`;
  return [
    dashboardMetricCard("viewers", "Viewers", number(live.currentViewers), `Peak : <strong>${number(live.peakViewers)}</strong>`, change),
    dashboardMetricCard("likes", "Likes", number(ShenPulseLiveStatistics.liveLikeCount(live)), `Session : <strong>${number(live.likes)}</strong>`),
    dashboardMetricCard("gifts", "Cadeaux", number(live.gifts), `Valeur : <strong>${number(live.giftCoins)} <span class="dashboard-diamond">◇</span></strong>`),
    dashboardMetricCard("diamonds", "Diamants", number(live.giftCoins), '<span title="La valeur transmise par les cadeaux ne permet pas de calculer le revenu net du créateur.">EUR non fourni par la plateforme</span>'),
    dashboardMetricCard("followers", "Followers", number(live.followers), `Partages : <strong>${number(live.shares)}</strong>`)
  ].join("");
}

function dashboardSimulatorMarkup() {
  const type = typeof simulatorType !== "undefined" ? simulatorType : "gift";
  const label = (kind) => typeof EVENT_LABELS !== "undefined" ? EVENT_LABELS[kind] || kind : ({ gift: "Cadeau", like: "Like", follow: "Follow", chat: "Chat", share: "Partage", subscribe: "Abonnement", join: "Arrivée" })[kind];
  return `<section class="studio-panel panel-violet dashboard-simulator"><header class="dashboard-panel-header"><div><h3>Simulateur de cadeaux & interactions</h3><p>Testez vos déclencheurs avec les mêmes interactions que pendant votre LIVE.</p></div><span class="badge cyan">TEST LOCAL</span></header>
    <div class="dashboard-simulator-types" aria-label="Type d’interaction à simuler">${DASHBOARD_SIMULATOR_TYPES.map((kind) => `<button type="button" class="dashboard-simulator-type ${type === kind ? "active" : ""}" data-action="select-simulator-type" data-type="${kind}" aria-pressed="${type === kind}"><span>${typeof eventIconMarkup === "function" ? eventIconMarkup(kind) : "◇"}</span>${escapeHtml(label(kind))}</button>`).join("")}</div>
    <form id="simulator-form" class="dashboard-simulator-form"><input type="hidden" name="type" value="${escapeHtml(type)}"><div class="dashboard-simulator-fields">
      <label class="field"><span>@ du spectateur test</span><input name="username" value="test_viewer" required></label><label class="field"><span>Nom affiché</span><input name="nickname" value="Spectateur test" required></label>
      ${type === "gift" ? giftPickerField("giftName", "Choisir un cadeau", "Rose") : ""}
      ${["gift", "like"].includes(type) ? `<label class="field"><span>${type === "gift" ? "Nombre de cadeaux" : "Nombre de likes"}</span><input name="count" type="number" min="1" max="1000" value="${type === "like" ? 25 : 1}" required></label>` : ""}
      ${type !== "gift" ? '<label class="field"><span>Valeur</span><input name="value" type="number" min="0" value="5"></label>' : ""}${type === "chat" ? '<label class="field dashboard-simulator-message"><span>Message</span><input name="message" value="!help" required></label>' : ""}
    </div><div class="dashboard-simulator-submit"><span>Les déclencheurs configurés peuvent exécuter leurs actions réelles.</span><button class="button primary" type="submit">${type === "gift" ? "Envoyer le cadeau de test" : `Simuler : ${escapeHtml(label(type))}`} <span aria-hidden="true">→</span></button></div></form>
    ${type === "gift" ? `<div class="dashboard-gift-shortcuts" data-dashboard-gifts>${dashboardGiftShortcutsMarkup()}</div>` : ""}<div class="dashboard-simulator-presets"><button class="button small ghost" data-action="preview-overlay" data-id="timer">Aperçu du timer</button><button class="button small ghost" data-action="preview-overlay" data-id="wheel">Aperçu de la roue</button><button class="button small ghost" data-action="preview-sound" data-id="kenney:confirmation_001">Tester un son</button></div>
  </section>`;
}

/** Le choix du type ne reconstruit ni KPI ni chat et garde le spectateur saisi. */
function setDashboardSimulatorType(requestedType) {
  if (!DASHBOARD_SIMULATOR_TYPES.includes(requestedType)) return false;
  simulatorType = requestedType;
  const panel = content.querySelector(".dashboard-simulator");
  if (!panel) return false;
  const identity = Object.fromEntries(["username", "nickname"].map((name) =>
    [name, panel.querySelector(`[name="${name}"]`)?.value || ""]
  ));
  const wrapper = content.ownerDocument.createElement("div");
  wrapper.innerHTML = dashboardSimulatorMarkup();
  const replacement = wrapper.firstElementChild;
  for (const [name, value] of Object.entries(identity)) replacement.querySelector(`[name="${name}"]`).value = value;
  panel.replaceWith(replacement);
  replacement.querySelector(`[data-type="${requestedType}"]`)?.focus({ preventScroll: true });
  return true;
}

function dashboardGiftShortcutsMarkup() {
  const gifts = new Map();
  for (const event of snapshot.state.overlaySession?.recentEvents || []) {
    if (event.type !== "gift") continue;
    const gift = giftForIdentity(event.data?.giftName, event.data?.giftId);
    if (gift) gifts.set(String(gift.id), gift);
  }
  for (const name of ["Rose", "TikTok", "Finger Heart", "GG", "Heart", "Ice Cream"]) {
    const gift = giftForIdentity(name);
    if (gift && !gifts.has(String(gift.id))) gifts.set(String(gift.id), gift);
  }
  const selected = [...gifts.values()].slice(0, 6);
  return selected.length ? `<span class="eyebrow">CADEAUX RÉCENTS & RACCOURCIS</span><div>${selected.map((gift) => `<button type="button" class="dashboard-gift-button" data-action="creator-simulate-gift" data-id="${escapeHtml(gift.id)}" title="Tester ${escapeHtml(gift.name)}">${eventIconMarkup("gift", { giftId: gift.id, giftName: gift.name, giftIds: gift.alternateIds, giftFamily: gift.giftFamily, giftCost: gift.cost, imageUrl: gift.imageUrl })}<strong>${escapeHtml(gift.name)}</strong><small>${asNumber(gift.cost)} pièce${gift.cost > 1 ? "s" : ""}</small></button>`).join("")}</div>` : "";
}

/** SVG sans bibliothèque de graphiques ; au maximum 120 points agrégés par le noyau. */
function dashboardChartMarkup() {
  const live = dashboardLiveSummary();
  const engagement = dashboardChartTab === "engagement";
  const points = ((engagement ? live.engagementHistory : live.audienceHistory) || []).slice(-120);
  const key = engagement ? "likes" : "viewers";
  if (!points.length) return `<div class="dashboard-chart-empty"><span>${dashboardMetricIcon(engagement ? "likes" : "viewers")}</span><p>${engagement ? "Les interactions du LIVE feront apparaître votre courbe d’engagement." : "L’audience transmise par la plateforme fera apparaître votre courbe."}</p></div>`;
  const width = 720; const height = 232; const left = 45; const right = 14; const top = 16; const bottom = 37;
  const max = Math.max(1, ...points.map((point) => Number(point[key]) || 0));
  const start = Date.parse(points[0].timestamp); const end = Date.parse(points.at(-1).timestamp);
  const x = (point) => left + (end > start ? (Date.parse(point.timestamp) - start) / (end - start) : 0.5) * (width - left - right);
  const y = (point) => top + (1 - (Number(point[key]) || 0) / max) * (height - top - bottom);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(point).toFixed(1)},${y(point).toFixed(1)}`).join(" ");
  const baseline = height - bottom;
  const area = `${line} L${x(points.at(-1)).toFixed(1)},${baseline} L${x(points[0]).toFixed(1)},${baseline} Z`;
  const ticks = [0, 0.5, 1].map((fraction) => { const yy = top + fraction * (height - top - bottom); return `<line x1="${left}" x2="${width - right}" y1="${yy}" y2="${yy}" class="dashboard-chart-grid-line"/><text x="${left - 10}" y="${yy + 4}" text-anchor="end">${escapeHtml(asNumber(Math.round(max * (1 - fraction))))}</text>`; }).join("");
  const times = [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)].map((point, index) => `<text x="${[left, (width + left - right) / 2, width - right][index]}" y="${height - 9}" text-anchor="${["start", "middle", "end"][index]}">${escapeHtml(formatTime(point.timestamp))}</text>`).join("");
  return `<div class="dashboard-chart ${engagement ? "is-engagement" : ""}"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${engagement ? "Likes observés pendant le LIVE" : "Audience du LIVE"}"><defs><linearGradient id="dashboard-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="currentColor" stop-opacity=".2"/><stop offset="100%" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>${ticks}${times}<path d="${area}" fill="url(#dashboard-chart-fill)"/><path d="${line}" fill="none" stroke="currentColor" stroke-width="2.5" vector-effect="non-scaling-stroke"/><circle cx="${x(points.at(-1)).toFixed(1)}" cy="${y(points.at(-1)).toFixed(1)}" r="4" fill="currentColor"/></svg><span class="dashboard-chart-legend"><i></i>${engagement ? "Likes reçus depuis la connexion au LIVE" : "Spectateurs présents"}</span></div>`;
}

function dashboardDonorsMarkup() {
  const live = dashboardLiveSummary();
  const rows = (live.topDonors?.length ? live.topDonors : live.participants || []).filter((row) => row.coins > 0).sort((a, b) => b.coins - a.coins || b.gifts - a.gifts).slice(0, 5);
  return rows.length ? rows.map((row, index) => `<div class="dashboard-donor-row rank-${index + 1}"><span class="dashboard-rank">${index + 1}</span>${dashboardAvatar(row)}<span class="dashboard-donor-name"><strong>${escapeHtml(row.name || row.username || row.id)}</strong><small>@${escapeHtml(row.username || row.id)}</small></span><strong class="dashboard-donor-score">${asNumber(row.coins)} <span aria-label="diamants">◇</span></strong></div>`).join("") : emptyInline("Vos donateurs apparaîtront ici à la réception des premiers cadeaux du LIVE.");
}

function dashboardAvatar(row = {}) {
  const name = row.displayName || row.name || row.username || "?";
  return `<span class="dashboard-avatar">${row.avatarUrl ? `<img src="${escapeHtml(row.avatarUrl)}" alt="" loading="lazy" decoding="async">` : escapeHtml(String(name).slice(0, 2).toUpperCase())}</span>`;
}

function dashboardRecentLiveEvents() {
  const live = dashboardLiveSummary();
  if (!live.hasData) return [];
  const after = Date.parse(live.startedAt || "");
  const before = live.endedAt ? Date.parse(live.endedAt) : Infinity;
  const seen = new Set(); const events = [];
  for (const event of [...liveEvents, ...(snapshot.state.overlaySession?.recentEvents || [])]) {
    if (!event?.id || seen.has(event.id) || DASHBOARD_TEST_SOURCES.has(event.source) || /(?:^|_)demo(?:_|$)/i.test(event.source || "")) continue;
    const time = Date.parse(event.timestamp);
    if (!Number.isFinite(time) || (Number.isFinite(after) && time < after) || time > before) continue;
    seen.add(event.id); events.push(event);
  }
  return events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)).slice(0, 100);
}

function dashboardChatCountMarkup() {
  const count = dashboardLiveSummary().comments || 0;
  return `${asNumber(count)} message${count > 1 ? "s" : ""}`;
}

function dashboardChatMarkup() {
  const events = dashboardRecentLiveEvents().filter((event) => event.type === "chat");
  return events.length ? events.map((event) => `<div class="dashboard-chat-row">${dashboardAvatar(event.user)}<div><div class="dashboard-message-meta">${event.user?.moderator ? '<span class="dashboard-role-badge">MOD</span>' : event.user?.subscriber ? '<span class="dashboard-role-badge">SUB</span>' : ""}<strong>${escapeHtml(event.user?.displayName || event.user?.name || "Spectateur")}</strong><time>${escapeHtml(formatTime(event.timestamp))}</time></div><p>${escapeHtml(event.data?.message || "")}</p></div></div>`).join("") : emptyInline("Les messages reçus pendant votre LIVE s’afficheront ici.");
}

function dashboardEventsMarkup() {
  const events = dashboardRecentLiveEvents().filter((event) => event.type !== "chat");
  const labels = { like: "a envoyé des likes", follow: "s’est abonné à votre compte", share: "a partagé le LIVE", subscribe: "s’est abonné au LIVE", join: "a rejoint le LIVE" };
  return events.length ? events.map((event) => `<div class="dashboard-event-row"><span class="dashboard-event-kind">${typeof eventIconMarkup === "function" ? eventIconMarkup(event.type, { ...event.data, giftName: event.data?.giftName, imageUrl: event.data?.giftImageUrl }) : dashboardMetricIcon("gifts")}</span>${dashboardAvatar(event.user)}<div><strong>${escapeHtml(event.user?.displayName || event.user?.name || "Spectateur")}</strong><p>${event.type === "gift" ? `a envoyé ${escapeHtml(event.data?.giftName || "un cadeau")} ×${asNumber(event.data?.count || 1)}` : escapeHtml(labels[event.type] || event.type)}</p></div><time>${escapeHtml(formatTime(event.timestamp))}</time></div>`).join("") : emptyInline("Les cadeaux, likes et nouveaux followers du LIVE s’afficheront ici.");
}

/** Mettre à jour les seuls blocs runtime : les champs et le focus du simulateur sont préservés. */
function syncDashboardRuntime() {
  if (currentPage !== "dashboard" || !isAccountAuthenticated()) return false;
  const blocks = [["context", dashboardContextMarkup], ["stats", dashboardStatsMarkup], ["donors", dashboardDonorsMarkup], ["gifts", dashboardGiftShortcutsMarkup], ["chart", dashboardChartMarkup], ["chat-count", dashboardChatCountMarkup], ["chat", dashboardChatMarkup], ["events", dashboardEventsMarkup]];
  let found = false;
  for (const [key, renderer] of blocks) {
    const node = content.querySelector(`[data-dashboard-${key}]`);
    if (!node) continue;
    found = true;
    const markup = renderer();
    if (node.innerHTML !== markup) { const scrollTop = node.scrollTop; node.innerHTML = markup; node.scrollTop = scrollTop; }
  }
  return found;
}

// Délégation unique dans core/events/content ; le module reste sans effet au chargement.
function handleDashboardChartClick(event) {
  const target = event.target.closest("[data-dashboard-chart-tab]");
  if (!target || currentPage !== "dashboard") return false;
  dashboardChartTab = target.dataset.dashboardChartTab === "engagement" ? "engagement" : "viewers";
  for (const tab of content.querySelectorAll("[data-dashboard-chart-tab]")) tab.setAttribute("aria-selected", String(tab === target));
  const chart = content.querySelector("[data-dashboard-chart]");
  if (chart) chart.innerHTML = dashboardChartMarkup();
  return true;
}

/** Cartes génériques conservées pour les écrans LIVE et Utilisateurs historiques. */
function statCard(label, value, icon, glow, detail) {
  return `<article class="card stat-card" style="--glow:${glow}"><div class="stat-top"><span class="stat-icon">${icon}</span><span class="stat-change">${escapeHtml(detail)}</span></div><div class="stat-value">${asNumber(value)}</div><div class="stat-label">${escapeHtml(label)}</div></article>`;
}

function connectionRow(connection) {
  const statusClass = connection.status === "connected" ? "success" : connection.status === "error" ? "error" : "";
  return `<div class="list-row"><span class="connector-icon">${connection.type === "demo" ? "◈" : connection.type === "twitch-irc" ? "T" : "⌁"}</span><div><h4>${escapeHtml(connection.name)}</h4><p>${escapeHtml(connectionDashboardPurpose(connection.type))}${connection.error ? ` · ${escapeHtml(connection.error)}` : ""}</p></div><span class="badge ${statusClass}">${escapeHtml(connectionStatusLabel(connection.status))}</span></div>`;
}

function connectionDashboardPurpose(type) {
  return ({ "tiktok-direct": "Reçoit les interactions du LIVE TikTok", "tiktok-relay": "Reçoit TikTok depuis un relais", websocket: "Reçoit les événements d’un outil externe", "twitch-irc": "Reçoit le chat Twitch", demo: "Sert uniquement aux tests manuels" })[type] || "Reçoit des événements externes";
}

function connectionStatusLabel(status) {
  return ({ connected: "connecté", connecting: "connexion…", reconnecting: "reconnexion…", disconnected: "déconnecté", error: "erreur" })[status] || String(status || "déconnecté");
}

function activityRow(entry) {
  const icon = eventIcons[entry.category] || (entry.level === "error" ? "!" : "•");
  return `<div class="list-row"><span class="event-icon">${icon}</span><div><h4>${escapeHtml(entry.title)}</h4><p>${escapeHtml(entry.detail || entry.category)}</p></div><span class="event-time">${formatTime(entry.timestamp)}</span></div>`;
}

function emptyInline(message) {
  return `<div class="empty-state" style="min-height:130px"><div><span class="empty-icon">⌁</span><p>${escapeHtml(message)}</p></div></div>`;
}
