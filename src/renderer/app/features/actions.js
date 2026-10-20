"use strict";

/**
 * Actions, déclencheurs et sorties média.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

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
    case "timer.add": {
      const configuredSeconds = Number(config.seconds || 0);
      const operation =
        (config.operation || "add") === "add" && configuredSeconds < 0
          ? "remove"
          : config.operation || "add";
      const seconds = ["remove", "random"].includes(operation)
        ? Math.abs(configuredSeconds)
        : configuredSeconds;
      return `${timerOperationLabel(operation)} · ${seconds}s · ${config.label || "Minuteur"}`;
    }
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
      <div><span class="panel-accent"></span><div><h3>${title}</h3><p>${audioContext ? "Ces URL diffusent les sons et le TTS sur le LIVE. La préécoute dans ShenPulse fonctionne sans source navigateur." : "Ces champs d’URL servent à visualiser les médias dans ShenPulse et à les afficher sur vos LIVE."}</p></div></div>
      ${configureLabel}
    </${heading}>
    <div class="media-screens-intro">
      <strong>${audioContext ? "Écoutez dans l’interface, diffusez le son dans le LIVE" : "Visualisez dans l’interface, diffusez l’image dans le LIVE"}</strong>
      <p>${audioContext
        ? "« Moi uniquement » et les préécoutes jouent dans ShenPulse sans envoyer de son à ces URL. « Tout le monde » conserve cette écoute locale et ajoute la source LIVE de l’écran choisi. Copiez son URL HTTPS une seule fois dans TikTok LIVE Studio ou OBS. Ne capturez pas également le son de ShenPulse ou du bureau : cela peut doubler la diffusion ou transmettre vos préécoutes privées. Spotify reste lu par l’appareil Spotify actif et doit être capturé séparément."
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
  return `<div class="automation-effect-chips trigger-action-chips">
    ${rows.slice(0, 3).map(({ rule: ownerRule, action }) => renderAutomationActionChip(action, ownerRule.name)).join("")}
    ${rows.length > 3 ? `<span>＋ ${rows.length - 3}</span>` : ""}
    ${missingCount ? `<em>${missingCount} action${missingCount > 1 ? "s" : ""} manquante${missingCount > 1 ? "s" : ""}</em>` : ""}
    ${actionIds.length ? "" : "<em>Aucune action</em>"}
  </div>`;
}

/** Couleurs et libellés partagés entre les actions et leurs déclencheurs. */
function renderAutomationActionChip(action, name = "") {
  const type = canonicalActionType(action.type);
  const audio = ["audio.play", "tts.speak"].includes(type);
  const media = type === "overlay.media";
  return renderAutomationEffectChip({
    label: audio || media ? `${type === "tts.speak" ? "Lire" : "Play"} ${actionDescription(action)}` : name || actionDescription(action),
    kind: type === "audio.play" ? "sound" : type === "tts.speak" ? "voice" : media ? "video" : actionTypeLabel(type),
    tone: audio || media ? "amber" : type.startsWith("irl.") ? "green" : type.startsWith("game.") ? "cyan" : "violet",
    icon: audio ? type === "tts.speak" ? "voice" : "sound" : media ? "play" : type.startsWith("overlay.") ? "overlay" : "action"
  });
}

function automationActionCommands(rule, action, actionIndex) {
  const attributes = `data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}"`;
  return `${renderAutomationIconButton({ action: "test-action", label: `Tester ${actionTypeLabel(action.type)} · ${rule.name}`, attributes, icon: "play", tone: "play" })}
    ${renderAutomationIconButton({ action: "edit-action", label: "Modifier l’action", attributes, icon: "edit" })}
    ${renderAutomationIconButton({ action: "duplicate-action", label: "Dupliquer l’action", attributes, icon: "copy", tone: "copy" })}
    ${renderAutomationIconButton({ action: "delete-action", label: "Supprimer l’action", attributes, icon: "trash", tone: "danger" })}`;
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
  return renderAutomationTable({ key: "actions", label: "Actions du profil actif", className: "actions-automation-list", rows: groups.map(({ rule, rows }) => ({
    id: rule.id,
    name: rule.name,
    trigger: `<div title="Cooldown · ${Math.round(Number(rule.cooldown?.globalMs || 0) / 1000)}s">${triggerPill(rule, { compact: true })}</div>`,
    effects: rows.map(({ action }) => renderAutomationActionChip(action)).join(""),
    status: renderAutomationStatus(rule),
    date: rule.createdAt || "",
    detail: rows.length > 1 ? `${rows.length} actions dans ce scénario` : "",
    commands: rows.length === 1 ? automationActionCommands(rule, rows[0].action, rows[0].actionIndex)
      : `<details class="automation-row-settings automation-scenario-tools"><summary>${automationTableIcon("play")} Outils des ${rows.length} actions</summary><div class="automation-row-settings-body">${rows.map(({ action, actionIndex }) => `<div class="automation-scenario-action"><strong data-studio-user-content>${escapeHtml(actionTypeLabel(action.type))}</strong><div class="automation-row-controls">${automationActionCommands(rule, action, actionIndex)}</div></div>`).join("")}</div></details>`
  })) });
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
    ${rules.length ? renderAutomationTable({ key: "triggers", label: "Déclencheurs du profil actif", rows: rules.map((rule) => ({
      id: rule.id, name: rule.name, trigger: triggerPill(rule, { compact: true }),
      detail: `${Math.round(Number(rule.cooldown?.globalMs || 0) / 1000)}s de cooldown`,
      effects: `${renderTriggerActionChips(rule)}<small class="automation-row-note">${escapeHtml(triggerExecutionLabel(rule))}</small>`,
      status: renderAutomationStatus(rule), date: rule.createdAt || "",
      commands: `${renderAutomationIconButton({ action: "run-rule", label: "Tester le déclencheur", attributes: `data-id="${escapeHtml(rule.id)}"`, icon: "play", tone: "play" })}${renderAutomationIconButton({ action: "edit-trigger", label: "Modifier le déclencheur", attributes: `data-id="${escapeHtml(rule.id)}"`, icon: "edit" })}${triggerContextMenu(rule)}`
    })) }) : `<div class="automation-empty">${emptyInline("Aucun déclencheur. Sélectionnez plusieurs actions existantes pour créer votre premier scénario.")}</div>`}
  </section>`;
}

function renderActions() {
  if (!["actions", "triggers", "timers", "advanced"].includes(actionsSection)) actionsSection = "actions";
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
    ["advanced", "Automatisations avancées", snapshot.state.rules.length]
  ];
  return `
    <div class="reference-page actions-workspace">
      ${renderStudioHero("actions", "Actions & déclencheurs", "Un événement, une ou plusieurs réactions. Créez, associez et testez votre workflow au même endroit.")}
      ${renderCreatorCapacity()}
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
      ${actionsSection === "timers" ? renderTimersPanel() : ""}
      ${actionsSection === "advanced" ? `<p class="automation-advanced-note">Les automatisations avancées combinent plusieurs conditions et actions. Elles complètent les interactions IRL, qui pilotent vos appareils connectés.</p>${renderRules()}` : ""}
    </div>`;
}
