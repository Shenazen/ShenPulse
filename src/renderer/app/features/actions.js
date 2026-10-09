"use strict";

/**
 * Pages LIVE, actions, déclencheurs et sorties média.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderLive() {
  if (!isAccountAuthenticated()) {
    return renderPrivateDataPlaceholder(
      "Session en direct protégée",
      "Connectez-vous pour voir les événements reçus, les statistiques de session et les sources actives."
    );
  }
  const state = snapshot.state;
  return `
    <div class="page-grid">
      <div class="section-toolbar">
        <div><h2>Flux temps réel</h2><p>Les derniers événements normalisés par le moteur.</p></div>
        <div class="toolbar-actions">
          <button class="button" data-action="test-event" data-type="chat">Tester le chat</button>
          <button class="button" data-action="test-event" data-type="follow">Tester un follow</button>
          <button class="button primary" data-action="test-event" data-type="gift">Tester un cadeau</button>
        </div>
      </div>
      <section class="stats-grid">
        ${statCard("Durée", formatDuration(state.session.startedAt), "◷", "var(--cyan)", state.session.running ? "LIVE" : "hors ligne")}
        ${statCard("Événements", state.statistics.sessionEvents, "⌁", "var(--violet)", "session")}
        ${statCard("Actions", state.statistics.sessionActions, "⎇", "var(--green)", "exécutées")}
        ${statCard("Sources actives", state.connections.filter((item) => item.status === "connected").length, "◉", "var(--amber)", "connectées")}
      </section>
      <section class="card">
        <header class="card-header"><div><p class="eyebrow">LIVE FEED</p><h3>Événements entrants</h3></div><span class="badge ${state.session.running ? "success" : ""}">${state.session.running ? "ÉCOUTE ACTIVE" : "EN PAUSE"}</span></header>
        <div class="card-body list">
          ${liveEvents.length ? liveEvents.map(liveEventRow).join("") : emptyInline("Démarrez la session ou envoyez un événement de test.")}
        </div>
      </section>
    </div>`;
}

function liveEventRow(event) {
  const detail = event.type === "chat" ? event.data.message : event.type === "gift" ? `${event.data.giftName} ×${event.data.count}` : event.type;
  return `<div class="list-row">
    <span class="event-icon">${eventIconMarkup(event.type, {
      giftName: event.data?.giftName
    })}</span>
    <div><h4>${escapeHtml(event.user?.displayName || "Viewer")}</h4><p>${escapeHtml(detail)} · ${escapeHtml(event.source)}</p></div>
    <span class="event-time">${formatTime(event.timestamp)}</span>
  </div>`;
}

let flattenedActionsSource = null;
let flattenedActionsRows = [];

function flattenActions() {
  const rules = snapshot?.state?.rules;
  if (!rules) return [];
  if (flattenedActionsSource === rules) return flattenedActionsRows;
  flattenedActionsSource = rules;
  flattenedActionsRows = rules.flatMap((rule) =>
    (rule.actions || []).map((action, actionIndex) => ({
      rule,
      action,
      actionIndex
    }))
  );
  return flattenedActionsRows;
}

function soundActionRows() {
  return flattenActions().filter(({ action }) =>
    canAccessActionType(action.type) &&
    ["audio.play", "tts.speak"].includes(action.type)
  );
}

function scheduledTimers() {
  return Array.isArray(snapshot?.state?.timers) ? snapshot.state.timers : [];
}

function actionTypeLabel(type) {
  const canonicalType = canonicalActionType(type);
  return ACTION_TYPE_LABELS[canonicalType] || canonicalType || "Action";
}

function actionTypeOptionLabel(type) {
  const canonicalType = canonicalActionType(type);
  const icon = ACTION_TYPE_ICONS[canonicalType] || "◆";
  return `${icon}\u00A0\u00A0${actionTypeLabel(canonicalType)}`;
}

function canonicalActionType(type) {
  return type === "overlay.alert" ? "overlay.media" : type;
}

function triggerLabel(rule) {
  if (!hasAutomaticTrigger(rule)) return "Lancement manuel";
  const trigger = rule.trigger || {};
  const threshold = Number(trigger.threshold || 1);
  const type = trigger.type || "*";
  const giftName = type === "gift" ? ruleGiftName(rule) : "";
  const giftValue = type === "gift" ? ruleGiftValueLabel(rule) : "";
  return `${EVENT_LABELS[type] || type}${giftName ? ` · ${giftName}` : ""}${giftValue ? ` · ${giftValue}` : ""}${threshold > 1 ? ` ×${threshold}` : ""}`;
}

function soundLibraryEntry(url) {
  return (
    SOUND_LIBRARY.find((item) => item.url === url) ||
    mediaSessionEntries.get(url) ||
    null
  );
}

function actionDescription(action) {
  const config = action.config || {};
  if (
    !isAccountAuthenticated() &&
    Object.entries(config).some(
      ([key, value]) =>
        /(?:url|uri)$/i.test(key) &&
        String(value || "").trim()
    )
  ) {
    return "Détail protégé · connexion requise";
  }
  switch (action.type) {
    case "overlay.alert":
      return config.title || config.message || "Affichage dans l’overlay";
    case "overlay.media":
      return (
        mediaLibraryEntry(config.mediaUrl)?.name ||
        config.mediaName ||
        config.mediaUrl ||
        "Média à choisir"
      );
    case "tts.speak":
      return config.text || "Texte lu à voix haute";
    case "audio.play":
      return (
        soundLibraryEntry(config.url)?.name ||
        config.soundName ||
        config.url ||
        "Son local"
      );
    case "goal.add":
      return `${config.goalId || "objectif"} +${config.amount || 1}`;
    case "timer.add":
      return `${timerOperationLabel(config.operation)} · ${config.seconds || 0}s · ${config.label || "Minuteur"}`;
    case "wheel.spin":
      return Array.isArray(config.choices) ? config.choices.join(", ") : "Roue";
    case "action.group": {
      const actionCount = Array.isArray(config.actionIds)
        ? new Set(config.actionIds.map(String).filter(Boolean)).size
        : 0;
      if (config.mode !== "random") {
        return `Toutes · ${actionCount} action${actionCount > 1 ? "s" : ""}`;
      }
      const randomCount = Math.min(
        actionCount,
        Math.max(1, Math.floor(Number(config.randomCount) || 1))
      );
      return `${randomCount} au hasard sur ${actionCount}`;
    }
    case "overlay.match":
      return MATCH_OVERLAYS.find((entry) => entry[2] === config.match)?.[1] || "Animation Match";
    case "game.effect":
      return config.effectId || "Effet du pack actif";
    case "irl.shelly": {
      const device = (snapshot?.state.settings.irl?.devices || []).find(
        (entry) => entry.id === config.deviceId
      );
      const operation = {
        on: "Allumer",
        off: "Éteindre",
        toggle: "Basculer",
        cycle: `Éteindre puis rallumer après ${Math.round(Number(config.durationMs || 3000) / 1000)}s`,
        pulse: `Allumer puis éteindre après ${Math.round(Number(config.durationMs || 3000) / 1000)}s`
      }[config.operation || "toggle"];
      return `${device?.name || "Prise non sélectionnée"} · ${operation}`;
    }
    case "delay":
      return `${config.durationMs || 0} ms`;
    default:
      return config.url || config.operation || config.requestType || "Configuration avancée";
  }
}

function findActionRow(ruleId, actionId, actionIndex) {
  return flattenActions().find(
    (row) =>
      row.rule.id === ruleId &&
      (actionId ? row.action.id === actionId : row.actionIndex === Number(actionIndex))
  );
}

function normalizedLiveScreen(config = {}) {
  return Math.min(
    8,
    Math.max(1, Math.round(Number(config.liveScreen) || 1))
  );
}

function rememberCopiedMediaScreenUrl(url) {
  const value = String(url || "").trim();
  if (!value) return;
  copiedMediaScreenUrls.add(value);
  try {
    window.localStorage.setItem(
      COPIED_MEDIA_SCREEN_URLS_KEY,
      JSON.stringify([...copiedMediaScreenUrls].slice(-32))
    );
  } catch {
    // L’état reste valable pour la session si le stockage local est indisponible.
  }
}

function isCopiedMediaScreenUrl(url) {
  return Boolean(url && copiedMediaScreenUrls.has(String(url)));
}

function isLiveAudioOutput(config = {}) {
  return config.outputMode === "live";
}

function mediaScreenUsage(rows) {
  const usage = Array.from({ length: 8 }, () => 0);
  for (const { action } of rows) {
    const type = canonicalActionType(action.type);
    let screen = 0;
    if (type === "overlay.media") {
      screen = Math.min(
        8,
        Math.max(1, Math.round(Number(action.config?.screen) || 1))
      );
    } else if (
      ["audio.play", "tts.speak"].includes(type) &&
      isLiveAudioOutput(action.config)
    ) {
      screen = normalizedLiveScreen(action.config);
    }
    if (screen) usage[screen - 1] += 1;
  }
  return usage;
}

function renderMediaScreensTable(rows) {
  const urls = Array.isArray(snapshot.overlayUrls?.mediaScreens)
    ? snapshot.overlayUrls.mediaScreens
    : [];
  const usage = mediaScreenUsage(rows);
  return `<div class="media-screens-table-wrap">
    <table class="media-screens-table">
      <thead><tr><th>ÉCRAN</th><th>URL DE LA SOURCE NAVIGATEUR</th><th>ACTIONS LIÉES</th><th>ÉTAT</th><th></th></tr></thead>
      <tbody>
        ${Array.from({ length: 8 }, (_value, index) => {
          const screen = index + 1;
          const url = urls[index] || "";
          const actionCount = usage[index];
          const ready = isCopiedMediaScreenUrl(url);
          return `<tr>
            <td><strong>Écran ${screen}</strong></td>
            <td><code title="${escapeHtml(url)}">${escapeHtml(url || "Serveur d’overlay indisponible")}</code></td>
            <td><span class="media-screen-count">${actionCount} action${actionCount > 1 ? "s" : ""}</span></td>
            <td><span class="media-screen-status ${ready ? "ready" : "offline"}" title="${ready ? "URL copiée depuis ShenPulse" : "Copiez cette URL pour préparer la source navigateur"}"><i></i>${ready ? "Prêt" : "Hors ligne"}</span></td>
            <td><button class="button small ${url ? "primary" : ""}" data-action="copy" data-media-screen-url="true" data-value="${escapeHtml(url)}" ${url ? "" : "disabled"}>${ready ? "Recopier" : "Copier"}</button></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>
  </div>`;
}

function renderMediaScreensPanel(
  rows,
  { context = "actions", collapsible = context === "actions" } = {}
) {
  const audioContext = context === "sounds";
  const title = audioContext ? "Écrans audio du LIVE" : "Écrans Media";
  const wrapper = collapsible ? "details" : "section";
  const heading = collapsible ? "summary" : "header";
  const configureLabel = collapsible
    ? '<span class="media-screens-disclosure">Configurer la diffusion <span aria-hidden="true">⌄</span></span>'
    : '<span class="badge cyan">TIKTOK LIVE STUDIO · OBS</span>';
  if (!isAccountAuthenticated()) {
    return `<${wrapper} class="studio-panel panel-cyan media-screens-panel guest-media-screens">
      <${heading} class="studio-panel-heading">
        <div><span class="panel-accent"></span><div><h3>${title}</h3><p>Les URL de vos sources navigateur sont protégées.</p></div></div>
        ${collapsible ? configureLabel : '<span class="badge">CONNEXION REQUISE</span>'}
      </${heading}>
      <div class="media-screens-intro">
        <strong>Connectez-vous pour préparer vos écrans</strong>
        <p>Aucune URL locale ou publique n’est affichée et aucune copie n’est possible en mode consultation.</p>
      </div>
    </${wrapper}>`;
  }
  return `<${wrapper} class="studio-panel panel-cyan media-screens-panel">
    <${heading} class="studio-panel-heading">
      <div><span class="panel-accent"></span><div><h3>${title}</h3><p>${audioContext ? "Ces champs d’URL servent à préécouter dans ShenPulse et à faire entendre les sons et le TTS sur vos LIVE." : "Ces champs d’URL servent à visualiser les médias dans ShenPulse et à les afficher sur vos LIVE."}</p></div></div>
      ${configureLabel}
    </${heading}>
    <div class="media-screens-intro">
      <strong>${audioContext ? "Écoutez dans l’interface, diffusez le son dans le LIVE" : "Visualisez dans l’interface, diffusez l’image dans le LIVE"}</strong>
      <p>${audioContext
        ? "Chaque ligne est un champ de source navigateur : copiez l’URL HTTPS de l’écran choisi dans TikTok LIVE Studio ou OBS pour que les spectateurs entendent les sons. Vérifiez d’abord qu’elle n’est pas déjà présente : deux sources avec la même URL joueraient le son deux fois. Spotify reste lu par l’appareil Spotify actif et doit être capturé séparément."
        : "Chaque ligne est un champ de source navigateur : copiez son URL HTTPS dans TikTok LIVE Studio ou OBS en 1920 × 1080, puis choisissez le même écran dans l’action Media pour le visualiser dans ShenPulse et sur le LIVE."}</p>
    </div>
    ${renderMediaScreensTable(rows)}
  </${wrapper}>`;
}

function automaticTriggerRules() {
  return (snapshot?.state?.rules || []).filter(
    (rule) =>
      hasAutomaticTrigger(rule) &&
      (rule.actionSelection ||
        !(rule.actions || []).length ||
        !(rule.actions || []).every(
          (action) => action.type === "tts.speak"
        ))
  );
}

function triggerActionIds(rule) {
  const configuredIds = rule?.actionSelection?.actionIds;
  const values = Array.isArray(configuredIds)
    ? configuredIds
    : (rule?.actions || []).map((action) => action.id);
  return [...new Set(values.map(String).filter(Boolean))];
}

function triggerActionRows(rule) {
  const rowsById = new Map(
    flattenActions().map((row) => [String(row.action.id || ""), row])
  );
  return triggerActionIds(rule)
    .map((actionId) => rowsById.get(actionId))
    .filter(Boolean);
}

function triggerExecutionLabel(rule) {
  const actionCount = triggerActionIds(rule).length;
  if (rule?.actionSelection?.mode !== "random") {
    return `Toutes · ${actionCount}`;
  }
  const randomCount = Math.min(
    actionCount,
    Math.max(1, Math.floor(Number(rule.actionSelection.randomCount) || 1))
  );
  return `${randomCount} au hasard sur ${actionCount}`;
}

function renderTriggerActionChips(rule) {
  const actionIds = triggerActionIds(rule);
  const rows = triggerActionRows(rule);
  const missingCount = Math.max(0, actionIds.length - rows.length);
  return `<div class="timer-action-chips trigger-action-chips">
    ${rows.slice(0, 3).map(({ rule: ownerRule, action }) => `<span title="${escapeHtml(`${actionTypeLabel(action.type)} · ${actionDescription(action)}`)}">${escapeHtml(ownerRule.name)}</span>`).join("")}
    ${rows.length > 3 ? `<span>＋ ${rows.length - 3}</span>` : ""}
    ${missingCount ? `<em>${missingCount} action${missingCount > 1 ? "s" : ""} manquante${missingCount > 1 ? "s" : ""}</em>` : ""}
    ${actionIds.length ? "" : "<em>Aucune action</em>"}
  </div>`;
}

function groupActionRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = String(row.rule.id);
    if (!groups.has(key)) groups.set(key, { rule: row.rule, rows: [] });
    groups.get(key).rows.push(row);
  }
  return [...groups.values()];
}

function actionContextMenu(rule, action, actionIndex) {
  const attributes = `data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}"`;
  return `<details class="compact-context-menu">
    <summary title="Plus d’options" aria-label="Plus d’options">•••</summary>
    <div>
      <button data-action="edit-action" ${attributes}>Modifier</button>
      <button data-action="duplicate-action" ${attributes}>Dupliquer</button>
      <button class="danger" data-action="delete-action" ${attributes}>Supprimer</button>
    </div>
  </details>`;
}

function triggerContextMenu(rule) {
  return `<details class="compact-context-menu">
    <summary title="Plus d’options" aria-label="Plus d’options">•••</summary>
    <div>
      <button data-action="edit-trigger" data-id="${escapeHtml(rule.id)}">Modifier</button>
      <button class="danger" data-action="delete-trigger" data-id="${escapeHtml(rule.id)}">Supprimer</button>
    </div>
  </details>`;
}

function renderActionWorkflows(groups) {
  if (!groups.length) {
    return `<div class="automation-empty">${emptyInline("Aucune action ne correspond à cette recherche.")}</div>`;
  }
  return `<div class="automation-list actions-automation-list">
    <div class="automation-list-head" aria-hidden="true"><span>ACTION</span><span>AUTOMATISATION</span><span>ÉTAT</span><span>COMMANDES</span></div>
    ${groups.map(({ rule, rows }) => {
      const cooldown = Math.round(Number(rule.cooldown?.globalMs || 0) / 1000);
      if (rows.length === 1) {
        const [{ action, actionIndex }] = rows;
        const description = actionDescription(action);
        return `<article class="action-workflow-card single-action-row">
          <div class="action-workflow-identity"><strong>${escapeHtml(rule.name)}</strong><small><span class="type-pill">${escapeHtml(actionTypeLabel(action.type))}</span> ${escapeHtml(description)}</small></div>
          <div class="action-workflow-automation">${triggerPill(rule)}<small>${cooldown ? `Cooldown · ${cooldown}s` : "Sans cooldown"}</small></div>
          <label class="workflow-state"><span class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></span><small>${rule.enabled ? "Actif" : "Inactif"}</small></label>
          <div class="action-step-commands">
            <button class="button small" title="Tester" data-action="test-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">▶ Tester</button>
            ${actionContextMenu(rule, action, actionIndex)}
          </div>
        </article>`;
      }
      return `<article class="action-workflow-card">
        <header class="action-workflow-header">
          <div class="action-workflow-identity"><strong>${escapeHtml(rule.name)}</strong><small>${rows.length} action${rows.length > 1 ? "s" : ""} dans ce scénario</small></div>
          <div class="action-workflow-automation">${triggerPill(rule)}<small>${cooldown ? `Cooldown · ${cooldown}s` : "Sans cooldown"}</small></div>
          <label class="workflow-state"><span class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></span><small>${rule.enabled ? "Actif" : "Inactif"}</small></label>
          <span class="workflow-command-hint">${rows.length > 1 ? "Commandes par action" : "Commande"}</span>
        </header>
        <div class="action-workflow-steps">
          ${rows.map(({ action, actionIndex }, index) => {
            const description = actionDescription(action);
            return `<div class="action-workflow-step">
              <span class="action-step-index">${index + 1}</span>
              <details class="action-step-details">
                <summary><span class="type-pill">${escapeHtml(actionTypeLabel(action.type))}</span><strong>${escapeHtml(description)}</strong><span aria-hidden="true">⌄</span></summary>
                <div><span>Type complet</span><strong>${escapeHtml(actionTypeLabel(action.type))}</strong><span>Détail</span><strong>${escapeHtml(description)}</strong><span>Déclenchement</span><strong>${escapeHtml(triggerLabel(rule))}</strong></div>
              </details>
              <div class="action-step-commands">
                <button class="button small" title="Tester" data-action="test-action" data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}">▶ Tester</button>
                ${actionContextMenu(rule, action, actionIndex)}
              </div>
            </div>`;
          }).join("")}
        </div>
      </article>`;
    }).join("")}
  </div>`;
}

function renderTriggersPanel() {
  const rules = automaticTriggerRules();
  return `<section class="studio-panel panel-cyan triggers-panel">
    <header class="studio-panel-heading">
      <div><span class="panel-accent"></span><div><h3>Déclencheurs</h3><p>Associez un événement à plusieurs actions existantes, toutes ensemble ou selon un tirage aléatoire.</p></div></div>
      <span class="count-pill">${rules.length}</span>
    </header>
    <div class="catalog-toolbar">
      <button class="button primary" data-action="add-trigger" ${flattenActions().length ? "" : "disabled"}>＋ Créer un déclencheur</button>
      <span class="table-subline">En mode aléatoire, ShenPulse tire obligatoirement le nombre indiqué parmi les actions sélectionnées.</span>
    </div>
    ${rules.length ? `<div class="trigger-card-list">${rules.map((rule) => `
      <article class="trigger-card">
        <div class="trigger-card-state"><label class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></label></div>
        <div class="trigger-card-copy"><strong>${escapeHtml(rule.name)}</strong><small>${Math.round(Number(rule.cooldown?.globalMs || 0) / 1000)}s de cooldown</small></div>
        <div class="trigger-card-event">${triggerPill(rule)}</div>
        <div><span class="trigger-execution-pill ${rule.actionSelection?.mode === "random" ? "random" : "all"}">${escapeHtml(triggerExecutionLabel(rule))}</span>${renderTriggerActionChips(rule)}</div>
        <div class="trigger-card-commands">
          <button class="button small" title="Tester le déclencheur" data-action="run-rule" data-id="${escapeHtml(rule.id)}">▶ Tester</button>
          ${triggerContextMenu(rule)}
        </div>
      </article>`).join("")}</div>` : `<div class="automation-empty">${emptyInline("Aucun déclencheur. Sélectionnez plusieurs actions existantes pour créer votre premier scénario.")}</div>`}
  </section>`;
}

function renderActions() {
  const allRows = flattenActions();
  const rows = allRows.filter(
    ({ action }) =>
      !["audio.play", "tts.speak"].includes(action.type) &&
      canAccessActionType(action.type)
  );
  const query = actionsSearch.trim().toLowerCase();
  const filteredRows = rows.filter(({ rule, action }) => {
    if (onlyEnabledActions && !rule.enabled) return false;
    return !query || [
      rule.name,
      actionTypeLabel(action.type),
      triggerLabel(rule),
      actionDescription(action)
    ].join(" ").toLowerCase().includes(query);
  });
  const groupedRows = groupActionRows(filteredRows);
  const tabs = [
    ["actions", "Actions", rows.length],
    ["triggers", "Déclencheurs", automaticTriggerRules().length],
    ["timers", "Timers", scheduledTimers().length],
    ["simulator", "Simulateur", 8]
  ];
  return `
    <div class="reference-page actions-workspace">
      <section class="page-hero compact">
        <div>
          <span class="hero-chip">WORKFLOW SHENPULSE</span>
          <h2>Actions & déclencheurs</h2>
          <p>Créez vos actions, puis associez-les seules ou par groupes à un événement depuis l’onglet Déclencheurs.</p>
        </div>
      </section>
      <nav class="module-tabs" aria-label="Sections des actions">
        ${tabs.map(([id, label, count]) => `<button class="${actionsSection === id ? "active" : ""}" data-action="set-actions-section" data-value="${id}">${label}<span>${count}</span></button>`).join("")}
      </nav>
      ${actionsSection === "actions" ? `
        <section class="studio-panel panel-violet">
          <header class="studio-panel-heading">
            <div><span class="panel-accent"></span><div><h3>Actions</h3><p>Médias, overlays, intégrations et commandes de jeu exécutés par le moteur local.</p></div></div>
            <span class="count-pill">${filteredRows.length}</span>
          </header>
          <div class="catalog-toolbar">
            <button class="button primary" data-action="add-action">＋ Créer une action</button>
            <label class="filter-check"><input type="checkbox" data-action="filter-enabled-actions" ${onlyEnabledActions ? "checked" : ""}><span>Actives uniquement</span></label>
            <label class="search-control"><span>⌕</span><input data-search="actions" type="search" value="${escapeHtml(actionsSearch)}" placeholder="Rechercher une action, un déclencheur…"></label>
          </div>
          ${renderActionWorkflows(groupedRows)}
        </section>
        ${renderMediaScreensPanel(allRows)}` : ""}
      ${actionsSection === "triggers" ? renderTriggersPanel() : ""}
      ${actionsSection === "simulator" ? `
        <section class="studio-panel panel-pink">
          <header class="studio-panel-heading"><div><span class="panel-accent"></span><div><h3>Simulateur</h3><p>Injectez des déclencheurs de test dans le même pipeline que le live.</p></div></div><span class="badge success">LOCAL</span></header>
          <div class="simulator-grid">
            ${["gift","like","follow","chat","share","subscribe","join"].map((type) => `<button class="simulator-card ${simulatorType === type ? "active" : ""}" data-action="select-simulator-type" data-type="${type}">${eventIconMarkup(type)}<strong>${escapeHtml(EVENT_LABELS[type] || type)}</strong><small>${simulatorType === type ? "Sélectionné" : "Choisir"}</small></button>`).join("")}
          </div>
          <form id="simulator-form" class="simulator-form">
            <input type="hidden" name="type" value="${escapeHtml(simulatorType)}">
            <div>
              <label class="field"><span>@ du viewer test</span><input name="username" value="test_viewer" required></label>
              <label class="field"><span>Nom affiché</span><input name="nickname" value="Spectateur test" required></label>
              <label class="field"><span>${simulatorType === "like" ? "Nombre de likes" : simulatorType === "gift" ? "Nombre de cadeaux" : "Quantité"}</span><input name="count" type="number" min="1" value="${simulatorType === "like" ? 25 : 1}" ${["gift", "like"].includes(simulatorType) ? "" : "disabled"}></label>
              <label class="field"><span>Valeur (hors cadeau)</span><input name="value" type="number" min="0" value="5" ${simulatorType === "gift" ? "disabled" : ""}></label>
              ${giftPickerField("giftName", "Cadeau", "Rose", simulatorType === "gift" ? "" : "disabled")}
              <label class="field"><span>Message</span><input name="message" value="!help" ${simulatorType === "chat" ? "" : "disabled"}></label>
            </div>
            <div class="simulator-submit">
              <span>Compte cible : <strong>${snapshot.state.settings.tiktok?.username ? `@${escapeHtml(snapshot.state.settings.tiktok.username)}` : "non configuré"}</strong></span>
              <button class="button primary" type="submit">▶ Simuler le déclencheur ${escapeHtml(simulatorType)}</button>
            </div>
          </form>
          <div class="simulator-presets">
            <button class="button" data-action="preview-overlay" data-id="timer">＋ 30 secondes</button>
            <button class="button" data-action="preview-overlay" data-id="wheel">Lancer la roue</button>
            <button class="button" data-action="preview-sound" data-id="kenney:confirmation_001">Tester un son</button>
          </div>
        </section>` : ""}
      ${actionsSection === "timers" ? renderTimersPanel() : ""}
    </div>`;
}
