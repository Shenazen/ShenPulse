"use strict";

/**
 * Pages secondaires et réglages généraux.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderOverlays() {
  const urls = snapshot.overlayUrls;
  const overlays = [
    ["Alertes & médias", "Animations, sons, vidéos et cadeaux.", "alerts", "▱"],
    ["Objectifs", "Progression des likes, follows, cadeaux ou valeurs.", "goals", "◎"],
    ["Flux d’activité", "Dernières interactions du public.", "feed", "≡"],
    ["Effets de jeu", "Affiche les effets lancés et leur auteur.", "game", "◇"],
    ["Compte à rebours", "Temps ajouté ou retiré par les règles.", "timer", "◷"],
    ["Roue des cadeaux", "Sélection aléatoire animée parmi vos choix.", "wheel", "✺"]
  ];
  return `
    <div class="section-toolbar">
      <div><h2>Sources navigateur locales</h2><p>Ajoutez chaque URL comme source navigateur dans OBS ou source lien dans LIVE Studio.</p></div>
      <button class="button" data-action="restart-servers">↻ Redémarrer les services</button>
    </div>
    <div class="overlay-grid">
      ${overlays.map(([name, description, key, icon]) => `
        <article class="card entity-card">
          <div class="entity-top"><span class="effect-icon">${icon}</span><span class="badge success">LOCAL</span></div>
          <h3 style="margin-top:13px">${name}</h3><p>${description}</p>
          <div class="url-field"><code>${escapeHtml(urls[key])}</code><button class="button small" data-action="copy" data-value="${escapeHtml(urls[key])}">Copier</button></div>
          <div class="entity-actions"><button class="button small" data-action="open-url" data-value="${escapeHtml(urls[key])}">Prévisualiser</button></div>
        </article>`).join("")}
    </div>
    <article class="card" style="margin-top:16px">
      <header class="card-header"><div><p class="eyebrow">API DÉVELOPPEUR</p><h3>Endpoint WebSocket local</h3></div><span class="badge cyan">JSON TEMPS RÉEL</span></header>
      <div class="card-body"><p style="margin:0;color:var(--muted);font-size:11px">Recevez tous les événements avec le format <code>{ event, data }</code> ou injectez des événements autorisés via l’API authentifiée.</p><div class="url-field"><code>${escapeHtml(urls.api)}</code><button class="button small" data-action="copy" data-value="${escapeHtml(urls.api)}">Copier</button></div></div>
    </article>`;
}

function renderGames() {
  const state = snapshot.state;
  const pack = snapshot.packs.find((item) => item.id === state.session.activeGamePackId) || snapshot.packs[0];
  return `
    <div class="split-layout">
      <aside class="card pack-list">
        <header class="card-header"><div><p class="eyebrow">BIBLIOTHÈQUE</p><h3>${snapshot.packs.length} packs installés</h3></div></header>
        ${snapshot.packs.map((item) => `
          <button class="pack-item ${item.id === pack.id ? "active" : ""}" data-action="select-game" data-id="${escapeHtml(item.id)}">
            <span class="pack-logo">${escapeHtml(item.name.slice(0, 1))}</span>
            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.connector.type)} · ${item.effects.length} effets</small></span>
            <span class="chevron">›</span>
          </button>`).join("")}
      </aside>
      <section class="card">
        <header class="card-header">
          <div><p class="eyebrow">${escapeHtml(pack.publisher)} · ${escapeHtml(pack.version)}</p><h2>${escapeHtml(pack.name)}</h2><p>${escapeHtml(pack.description)}</p></div>
          <div class="toolbar-actions"><button class="button small" data-action="configure-game" data-id="${escapeHtml(pack.id)}">Configurer</button><button class="button small primary" data-action="test-game" data-id="${escapeHtml(pack.id)}">Tester</button></div>
        </header>
        <div class="card-body">
          <div class="entity-meta" style="margin:0 0 16px">${pack.tags.map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}<span class="badge cyan">${escapeHtml(pack.connector.type)}</span></div>
          <div class="effect-grid">
            ${pack.effects.map((effect) => `
              <article class="effect-card">
                <span class="effect-icon">${escapeHtml(effect.icon || "◇")}</span>
                <h4>${escapeHtml(effect.name)}</h4>
                <p>${escapeHtml(effect.description)}</p>
                <button class="button small" data-action="trigger-effect" data-id="${escapeHtml(effect.id)}">Déclencher</button>
              </article>`).join("")}
          </div>
        </div>
      </section>
    </div>`;
}

function renderGoals() {
  const goals = snapshot.state.goals;
  return `
    <div class="section-toolbar"><div><h2>Objectifs du live</h2><p>Affichez la progression et mettez-la à jour depuis vos règles.</p></div><button class="button primary" data-action="add-goal">＋ Nouvel objectif</button></div>
    <div class="goal-grid">
      ${goals.map((goal) => {
        const progress = Math.min(100, Math.round((Number(goal.current) / Math.max(1, Number(goal.target))) * 100));
        return `<article class="card entity-card">
          <div class="entity-top"><div><h3>${escapeHtml(goal.name)}</h3><p>${escapeHtml(goal.type)} · ${progress}% atteint</p></div><label class="switch"><input type="checkbox" data-action="toggle-goal" data-id="${escapeHtml(goal.id)}" ${goal.enabled ? "checked" : ""}><span></span></label></div>
          <div class="goal-progress"><span style="width:${progress}%;background:linear-gradient(90deg,var(--cyan),${escapeHtml(goal.color || "var(--violet)")})"></span></div>
          <div class="goal-numbers"><span>${asNumber(goal.current)}</span><span>${asNumber(goal.target)}</span></div>
          <div class="entity-actions"><button class="button small" data-action="edit-goal" data-id="${escapeHtml(goal.id)}">Modifier</button><button class="button small ghost" data-action="reset-goal" data-id="${escapeHtml(goal.id)}">Réinitialiser</button><button class="button small ghost" data-action="delete-entity" data-collection="goals" data-id="${escapeHtml(goal.id)}">Supprimer</button></div>
        </article>`;
      }).join("")}
    </div>`;
}

function renderCommands() {
  const commands = snapshot.state.commands;
  return `
    <div class="section-toolbar"><div><h2>Commandes du chat</h2><p>Réponses via la source quand elle l’autorise, sinon affichage dans l’overlay.</p></div><button class="button primary" data-action="add-command">＋ Nouvelle commande</button></div>
    <section class="card">
      <div class="card-body list">
        ${commands.length ? commands.map((command) => `
          <div class="list-row">
            <span class="event-icon">⌘</span>
            <div><h4>${escapeHtml(command.command)} · ${escapeHtml(command.response)}</h4><p>${command.subscriberOnly ? "Abonnés uniquement" : "Tout le monde"} · cooldown ${Math.round(Number(command.cooldownMs || 0) / 1000)}s</p></div>
            <div class="toolbar-actions"><label class="switch"><input type="checkbox" data-action="toggle-command" data-id="${escapeHtml(command.id)}" ${command.enabled ? "checked" : ""}><span></span></label><button class="button small" data-action="edit-command" data-id="${escapeHtml(command.id)}">Modifier</button><button class="button small ghost" data-action="delete-entity" data-collection="commands" data-id="${escapeHtml(command.id)}">Supprimer</button></div>
          </div>`).join("") : emptyInline("Ajoutez votre première commande.")}
      </div>
    </section>`;
}

function renderConnections() {
  if (!isAccountAuthenticated()) {
    return renderPrivateDataPlaceholder(
      "Sources protégées",
      "Les comptes TikTok, relais, connexions locales et leur état ne sont jamais affichés sans compte ShenPulse connecté."
    );
  }
  const connections = snapshot.state.connections;
  return `
    <div class="section-toolbar"><div><h2>Sources d’événements</h2><p>Chaque connexion indique comment ShenPulse reçoit les interactions de votre audience.</p></div></div>
    <section class="connection-help-grid" aria-label="À quoi servent les connexions">
      <article class="card connection-help-card">
        <span class="connector-icon">♪</span>
        <div><strong>TikTok LIVE direct</strong><p>La connexion recommandée : renseignez seulement le @ TikTok. ShenPulse surveille le compte et reçoit les événements du LIVE.</p></div>
      </article>
      <article class="card connection-help-card">
        <span class="connector-icon">⌁</span>
        <div><strong>WebSocket ou relais</strong><p>Relie un outil externe autorisé qui envoie des événements au format { event, data } à ShenPulse.</p></div>
      </article>
      <article class="card connection-help-card">
        <span class="connector-icon">T</span>
        <div><strong>Twitch IRC</strong><p>Reçoit le chat et certaines notifications Twitch avec votre chaîne, votre utilisateur et un jeton OAuth.</p></div>
      </article>
      <article class="card connection-help-card">
        <span class="connector-icon">◈</span>
        <div><strong>Démo manuelle</strong><p>Désactivée par défaut. Elle ne crée aucun viewer et n’émet rien automatiquement ; utilisez Actions → Simulateur pour vos tests volontaires.</p></div>
      </article>
    </section>
    <div class="connection-mode-legend">
      <span><b>AUTO</b> démarre avec les sources actives de la session.</span>
      <span><b>MANUEL</b> démarre uniquement avec le bouton Connecter.</span>
      <span><b>Déconnecter</b> arrête immédiatement la source.</span>
    </div>
    <div class="connector-grid">
      ${connections.map((connection) => {
        const statusClass = connection.status === "connected" ? "success" : connection.status === "error" ? "error" : "";
        return `<article class="card entity-card">
          <div class="entity-top"><span class="connector-icon">${connection.type === "demo" ? "◈" : connection.type === "twitch-irc" ? "T" : "⌁"}</span><span class="badge ${statusClass}">${escapeHtml(connection.status || "disconnected")}</span></div>
          <h3 style="margin-top:13px">${escapeHtml(connection.name)}</h3><p>${escapeHtml(connectionTypeLabel(connection.type))}${connection.config?.url ? ` · ${escapeHtml(connection.config.url)}` : ""}</p>
          <p class="connection-card-description">${escapeHtml(connectionTypeDescription(connection.type))}</p>
          <div class="entity-meta"><span class="badge ${connection.enabled && connection.type !== "demo" ? "cyan" : ""}">${connection.enabled && connection.type !== "demo" ? "AUTO" : "MANUEL"}</span>${connection.hasSecret ? '<span class="badge success">SECRET CHIFFRÉ</span>' : ""}</div>
          <div class="entity-actions">
            <button class="button small ${connection.status === "connected" ? "danger" : "primary"}" data-action="${connection.status === "connected" ? "stop-connection" : "start-connection"}" data-id="${escapeHtml(connection.id)}">${connection.status === "connected" ? "Déconnecter" : "Connecter"}</button>
            ${connection.type === "demo" ? "" : `<button class="button small ghost" data-action="delete-entity" data-collection="connections" data-id="${escapeHtml(connection.id)}">Supprimer</button>`}
          </div>
        </article>`;
      }).join("")}
    </div>
    `;
}

function connectionTypeLabel(type) {
  return ({
    "tiktok-direct": "TikTok LIVE direct",
    "tiktok-relay": "Relais TikTok",
    websocket: "WebSocket",
    "twitch-irc": "Twitch IRC",
    demo: "Démo manuelle"
  })[type] || String(type || "Connexion");
}

function connectionTypeDescription(type) {
  return ({
    "tiktok-direct": "Surveille le @ configuré et reçoit automatiquement cadeaux, likes, follows, partages, abonnements et messages du LIVE.",
    "tiktok-relay": "Reçoit les événements TikTok transmis par un relais WebSocket autorisé.",
    websocket: "Reçoit les événements envoyés par une application ou un relais externe compatible.",
    "twitch-irc": "Reçoit le chat et les notifications Twitch prises en charge via IRC.",
    demo: "Source de test strictement manuelle, sans génération automatique de viewers, likes ou cadeaux."
  })[type] || "Source d’événements personnalisée configurée dans ShenPulse.";
}

function renderActivity() {
  if (!isAccountAuthenticated()) {
    return renderPrivateDataPlaceholder(
      "Journal inaccessible",
      "Connectez-vous pour consulter le journal local de ShenPulse."
    );
  }
  const entries = visibleActivityEntries(snapshot.state);
  return `
    <div class="section-toolbar"><div><h2>${entries.length} entrées locales</h2><p>Les secrets sont masqués et aucune télémétrie n’est envoyée.</p></div><button class="button" data-action="export-data">Exporter la configuration</button></div>
    <section class="card">
      ${entries.length ? `<table class="activity-table"><thead><tr><th>HEURE</th><th>NIVEAU</th><th>CATÉGORIE</th><th>ÉVÉNEMENT</th><th>DÉTAIL</th></tr></thead><tbody>${entries.map((entry) => `<tr><td>${formatTime(entry.timestamp)}</td><td><span class="badge ${entry.level === "error" ? "error" : entry.level === "success" ? "success" : ""}">${escapeHtml(entry.level)}</span></td><td>${escapeHtml(entry.category)}</td><td><strong>${escapeHtml(entry.title)}</strong></td><td>${escapeHtml(entry.detail)}</td></tr>`).join("")}</tbody></table>` : emptyInline("Le journal est vide.")}</section>`;
}

function visibleActivityEntries(state = {}) {
  const live =
    state.session?.running === true ||
    state.session?.game?.running === true;
  if (live) return state.activity || [];
  const seenOfflineErrors = new Set();
  return (state.activity || []).filter((entry) => {
    const category = String(entry?.category || "").toLowerCase();
    if (!["connection", "tiktok"].includes(category)) return true;
    if (String(entry?.level || "").toLowerCase() !== "error") return false;
    const key = `${category}\u0000${entry.title || ""}\u0000${entry.detail || ""}`;
    if (seenOfflineErrors.has(key)) return false;
    seenOfflineErrors.add(key);
    return true;
  });
}

function renderPrivateDataPlaceholder(title, detail) {
  return `<section class="card guest-private-placeholder">
    <span aria-hidden="true">◇</span>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(detail)}</p>
    <button class="button primary" type="button" data-action="account-login">Se connecter ou s’inscrire</button>
  </section>`;
}

function renderSettings() {
  if (!isAccountAuthenticated()) {
    return `<div class="settings-layout guest-settings-overview">
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">APPLICATION</p><h3>Comportement</h3></div></header>
        <div class="card-body"><p>Les services locaux, les préférences de fenêtre et les autorisations système se configurent ici après connexion.</p></div>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">AUDIO</p><h3>Synthèse vocale</h3></div></header>
        <div class="card-body"><p>La voix, la vitesse et le volume restent consultables et modifiables uniquement par le compte connecté.</p></div>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">INTÉGRATIONS</p><h3>OBS, Spotify et stockage</h3></div></header>
        <div class="card-body"><p>Les adresses, identifiants, ports, jetons et secrets enregistrés sur cet appareil sont masqués en mode consultation.</p></div>
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">DONNÉES LOCALES</p><h3>Import, export et suppression</h3></div></header>
        <div class="card-body"><p>Aucune opération sur les données locales n’est autorisée sans connexion à ShenPulse.</p></div>
      </section>
    </div>`;
  }
  const settings = snapshot.state.settings;
  const backblaze = settings.backblaze || {};
  const backblazeConfigured = Boolean(
    backblaze.keyIdSecretId && backblaze.applicationKeySecretId
  );
  return `
    <form id="settings-form" class="page-grid">
      <div class="settings-layout">
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">APPLICATION</p><h3>Comportement</h3></div></header>
          <div class="card-body">
            ${checkRow("Démarrer les services locaux", "Overlays et API disponibles dès l’ouverture.", "startOverlayServer", settings.startOverlayServer)}
            ${checkRow("Réduire à la fermeture", "Préférence conservée pour une future icône de zone de notification.", "minimizeToTray", settings.minimizeToTray)}
            ${checkRow("Autoriser la simulation de touches", "Permet aux règles explicitement configurées de contrôler une application Windows.", "allowKeystrokes", settings.allowKeystrokes)}
            ${checkRow("Télémétrie", "Désactivée : aucune télémétrie n’est actuellement implémentée.", "telemetry", settings.telemetry)}
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">SERVICES LOCAUX</p><h3>Ports & sécurité</h3></div></header>
          <div class="card-body form-grid">
            <label class="field"><span>Port overlays</span><input type="number" name="overlayPort" min="1024" max="65535" value="${escapeHtml(settings.overlayPort)}"></label>
            <label class="field"><span>Port API</span><input type="number" name="apiPort" min="1024" max="65535" value="${escapeHtml(settings.apiPort)}"></label>
            <label class="field full"><span>Jeton API local</span><input type="text" readonly value="${escapeHtml(settings.apiToken)}"><small>Le jeton reste sur cet appareil. Régénérez les données pour le remplacer.</small></label>
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">SYNTHÈSE VOCALE</p><h3>Voix du stream</h3></div></header>
          <div class="card-body form-grid">
            ${ttsVoiceField("ttsVoice", settings.tts.voice || "")}
            <label class="field"><span>Vitesse</span><input type="number" name="ttsRate" min="0.5" max="2" step="0.1" value="${escapeHtml(settings.tts.rate)}"></label>
            <label class="field"><span>Hauteur</span><input type="number" name="ttsPitch" min="0" max="2" step="0.1" value="${escapeHtml(settings.tts.pitch)}"></label>
            <label class="field"><span>Volume</span><input type="number" name="ttsVolume" min="0" max="1" step="0.1" value="${escapeHtml(settings.tts.volume)}"></label>
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">INTÉGRATIONS</p><h3>OBS & Spotify</h3></div><button class="button small" type="button" data-action="test-obs">Tester OBS</button></header>
          <div class="card-body form-grid">
            <label class="field full"><span>OBS WebSocket</span><input name="obsUrl" value="${escapeHtml(settings.obs.url)}"></label>
            <label class="field full"><span>Nouveau mot de passe OBS</span><input type="password" name="obsPassword" placeholder="${settings.obs.passwordSecretId ? "Secret déjà enregistré" : "Facultatif"}"></label>
            <div class="field full"><span>Application Spotify</span><strong>ShenPulse configuré</strong><small>La connexion ouvre automatiquement l’autorisation Spotify. URI de retour : ${escapeHtml(`http://127.0.0.1:${settings.spotify?.redirectPort || 21215}/spotify/callback`)}</small></div>
            <label class="field"><span>Port OAuth Spotify</span><input type="number" name="spotifyRedirectPort" min="1024" max="65535" value="${escapeHtml(settings.spotify?.redirectPort || 21215)}"></label>
            <div class="field"><span>État Spotify</span><strong>${settings.spotify?.refreshTokenSecretId ? "Compte autorisé" : "Prêt à connecter"}</strong><small>Les jetons OAuth sont chiffrés par le coffre-fort Windows.</small></div>
          </div>
        </section>
        <section class="card">
          <header class="card-header"><div><p class="eyebrow">STOCKAGE MÉDIA GLOBAL</p><h3>Backblaze B2</h3><small>Sons, images, GIF et vidéos personnalisés.</small></div><span class="badge ${backblazeConfigured ? "success" : ""}">${backblazeConfigured ? "CONFIGURÉ" : "À CONFIGURER"}</span></header>
          <div class="card-body form-grid">
            ${field("backblazeBucket", "Bucket", backblaze.bucket || "", "text", "full")}
            ${field("backblazeEndpoint", "Endpoint S3", backblaze.endpoint || "", "text", "full")}
            ${field("backblazeRegion", "Région", backblaze.region || "")}
            ${field("backblazePrefix", "Dossier", backblaze.prefix || "mediauploads")}
            ${field("backblazePublicBaseUrl", "URL publique", backblaze.publicBaseUrl || "", "url", "full")}
            ${field("backblazeMaxMb", "Taille maximale (Mo)", Math.round(Number(backblaze.maxBytes || 209715200) / 1024 / 1024), "number", 'min="1" max="200"')}
            <label class="field"><span>Nouveau Key ID</span><input type="password" name="backblazeKeyId" placeholder="${backblaze.keyIdSecretId ? "Clé chiffrée enregistrée" : "À renseigner"}"></label>
            <label class="field"><span>Nouvelle Application Key</span><input type="password" name="backblazeApplicationKey" placeholder="${backblaze.applicationKeySecretId ? "Clé chiffrée enregistrée" : "À renseigner"}"></label>
            <div class="field full"><small>Les clés sont conservées dans le coffre-fort Windows et ne sont jamais envoyées au renderer. Elles servent uniquement à importer les sons choisis dans le bucket.</small></div>
          </div>
        </section>
      </div>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">DONNÉES & CONFIDENTIALITÉ</p><h3>Contrôle local</h3></div></header>
        <div class="card-body">
          <div class="button-row"><button class="button" type="button" data-action="export-data">Exporter</button><button class="button" type="button" data-action="import-data">Importer</button><button class="button danger" type="button" data-action="clear-data">Effacer toutes les données</button></div>
          <p style="margin:14px 0 0;color:var(--muted);font-size:10px">Les fonctions de live restent locales. Les secrets sont chiffrés par le coffre-fort Windows quand il est disponible.</p>
        </div>
      </section>
      <section class="card admin-access-card">
        <header class="card-header">
          <div><p class="eyebrow">ADMINISTRATION PRIVÉE</p><h3>Panneau propriétaire</h3></div>
          <span class="badge ${isVerifiedAdminSession() ? "success" : ""}">${isVerifiedAdminSession() ? "ACCÈS VÉRIFIÉ" : "VERROUILLÉ"}</span>
        </header>
        <div class="card-body">
          <p>${isVerifiedAdminSession()
            ? `Session sécurisée active pour <strong>${escapeHtml(adminSession.email)}</strong>. Les droits sont revérifiés côté serveur pour chaque modification.`
            : "Connexion réservée au compte propriétaire ShenPulse. Un autre compte, même connecté à Firebase, sera refusé par le backend."}</p>
          <div class="button-row">
            ${isVerifiedAdminSession()
              ? `<button class="button primary" type="button" data-action="open-admin">Ouvrir l’administration</button><button class="button ghost" type="button" data-action="admin-logout">Déconnecter l’admin</button>`
              : `<button class="button primary" type="button" data-action="admin-login">Connexion propriétaire</button>`}
          </div>
        </div>
      </section>
      <div class="button-row" style="justify-content:flex-end"><button class="button primary" type="submit">Enregistrer les paramètres</button></div>
    </form>`;
}
