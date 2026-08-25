"use strict";

/**
 * Page d'accueil et composants de synthèse.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderDashboard() {
  if (!isAccountAuthenticated()) {
    return `
      <div class="page-grid guest-dashboard">
        <section class="card accent session-hero">
          <div class="session-copy">
            <p class="eyebrow">DÉCOUVRIR SHENPULSE</p>
            <h2>Parcourez les outils avant de connecter votre compte.</h2>
            <p>Les données d’activité, les sources, les URL et les réglages enregistrés sur cet appareil restent protégés pendant la consultation.</p>
            <div class="button-row">
              <button class="button primary" data-action="account-login">Se connecter ou s’inscrire</button>
              <button class="button ghost" data-navigate="overlays">Voir les overlays</button>
              <button class="button ghost" data-navigate="games">Voir les jeux</button>
            </div>
          </div>
          <div class="pulse-visual">
            <div class="pulse-ring"></div>
            <div class="pulse-ring"></div>
            <div class="pulse-core">SP</div>
          </div>
        </section>
      </div>`;
  }
  const { state } = snapshot;
  const stats = state.statistics;
  const connected = state.connections.filter((item) => item.status === "connected").length;
  const recent = visibleActivityEntries(state).slice(0, 6);
  return `
    <div class="page-grid">
      <section class="stats-grid">
        ${statCard("Événements", stats.sessionEvents, "⌁", "var(--cyan)", "cette session")}
        ${statCard("Actions exécutées", stats.sessionActions, "⎇", "var(--violet)", "cette session")}
        ${statCard("Likes reçus", stats.sessionLikes || 0, "♥", "var(--red)", "cette session")}
        ${statCard("Audience unique", stats.sessionUniqueViewers?.length || 0, "◉", "var(--green)", "cette session")}
      </section>
      <section class="hero-grid">
        <article class="card accent session-hero">
          <div class="session-copy">
            <p class="eyebrow">${state.session.running ? "SESSION EN COURS" : "PRÊT À INTERAGIR"}</p>
            <h2>${state.session.running ? "Votre communauté pilote maintenant le show." : "Transformez chaque réaction en moment de jeu."}</h2>
            <p>${state.session.running ? `${connected} source(s) connectée(s), ${stats.sessionEvents} événement(s) traités. Les règles actives continuent de s’exécuter localement.` : "Connectez une source autorisée, choisissez un pack de jeu et laissez le moteur ShenPulse orchestrer alertes, overlays et effets en temps réel."}</p>
            <div class="button-row">
              <button class="button primary" data-action="toggle-session">${state.session.running ? "■ Arrêter la session" : "▶ Démarrer la session"}</button>
              <button class="button" data-action="test-event" data-type="gift">🎁 Tester un cadeau</button>
            </div>
          </div>
          <div class="pulse-visual">
            <div class="pulse-ring"></div>
            <div class="pulse-ring"></div>
            <div class="pulse-core">${state.session.running ? "◉" : "⌁"}</div>
          </div>
        </article>
        <article class="card">
          <header class="card-header"><div><p class="eyebrow">SOURCES</p><h3>État des connexions</h3><p>Le rôle de chaque source, en un coup d’œil.</p></div><div class="dashboard-connection-header-actions"><span class="badge ${connected ? "success" : ""}">${connected} ACTIVE${connected > 1 ? "S" : ""}</span>${canNavigateTo("connections") ? '<button class="button small ghost" data-navigate="connections">Voir les connexions →</button>' : ""}</div></header>
          <div class="card-body list">
            ${state.connections.slice(0, 4).map(connectionRow).join("")}
          </div>
        </article>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">ACTIVITÉ RÉCENTE</p><h3>Tout ce qui traverse ShenPulse</h3></div><button class="button small ghost" data-navigate="activity">Ouvrir le journal</button></header>
        <div class="card-body list">
          ${recent.length ? recent.map(activityRow).join("") : emptyInline("Aucune activité pour le moment.")}
        </div>
      </section>
    </div>`;
}

function statCard(label, value, icon, glow, detail) {
  return `<article class="card stat-card" style="--glow:${glow}">
    <div class="stat-top"><span class="stat-icon">${icon}</span><span class="stat-change">${escapeHtml(detail)}</span></div>
    <div class="stat-value">${asNumber(value)}</div><div class="stat-label">${escapeHtml(label)}</div>
  </article>`;
}

function connectionRow(connection) {
  const statusClass = connection.status === "connected" ? "success" : connection.status === "error" ? "error" : "";
  return `<div class="list-row">
    <span class="connector-icon">${connection.type === "demo" ? "◈" : connection.type === "twitch-irc" ? "T" : "⌁"}</span>
    <div><h4>${escapeHtml(connection.name)}</h4><p>${escapeHtml(connectionDashboardPurpose(connection.type))}${connection.error ? ` · ${escapeHtml(connection.error)}` : ""}</p></div>
    <span class="badge ${statusClass}">${escapeHtml(connectionStatusLabel(connection.status))}</span>
  </div>`;
}

function connectionDashboardPurpose(type) {
  return ({
    "tiktok-direct": "Reçoit les interactions du LIVE TikTok",
    "tiktok-relay": "Reçoit TikTok depuis un relais",
    websocket: "Reçoit les événements d’un outil externe",
    "twitch-irc": "Reçoit le chat Twitch",
    demo: "Sert uniquement aux tests manuels"
  })[type] || "Reçoit des événements externes";
}

function connectionStatusLabel(status) {
  return ({
    connected: "connecté",
    connecting: "connexion…",
    reconnecting: "reconnexion…",
    disconnected: "déconnecté",
    error: "erreur"
  })[status] || String(status || "déconnecté");
}

function activityRow(entry) {
  const icon = eventIcons[entry.category] || (entry.level === "error" ? "!" : "•");
  return `<div class="list-row">
    <span class="event-icon">${icon}</span>
    <div><h4>${escapeHtml(entry.title)}</h4><p>${escapeHtml(entry.detail || entry.category)}</p></div>
    <span class="event-time">${formatTime(entry.timestamp)}</span>
  </div>`;
}

function emptyInline(message) {
  return `<div class="empty-state" style="min-height:130px"><div><span class="empty-icon">⌁</span><p>${escapeHtml(message)}</p></div></div>`;
}
