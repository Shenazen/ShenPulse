"use strict";

/**
 * Sons, voix et timers planifiés.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function audioOutputSwitchMarkup(rule, action, actionIndex) {
  const live = isLiveAudioOutput(action.config);
  const screen = normalizedLiveScreen(action.config);
  const attributes = `data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}"`;
  return `<div class="audio-output-control ${live ? "is-live" : "is-local"}">
    <label class="audio-output-switch" title="Choisir entre une écoute locale et la diffusion dans le LIVE">
      <small class="audio-output-local">Moi uniquement</small>
      <span class="switch"><input type="checkbox" data-action="set-audio-output" ${attributes} ${live ? "checked" : ""}><span></span></span>
      <small class="audio-output-live">LIVE${live ? ` · Écran ${screen}` : ""}</small>
    </label>
    ${live ? `<button class="audio-output-configure" title="Changer l’écran de diffusion" data-action="configure-audio-output" ${attributes}>Configurer</button>` : ""}
  </div>`;
}

function soundRowAttributes(rule, action, actionIndex) {
  return `data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}"`;
}

function soundContextMenu(rule, action, actionIndex, editorAction) {
  const attributes = soundRowAttributes(rule, action, actionIndex);
  return `<details class="compact-context-menu"><summary title="Plus d’options" aria-label="Plus d’options">•••</summary><div>
    <button data-action="${editorAction}" ${attributes}>Modifier</button>
    <button class="danger" data-action="delete-action" ${attributes}>Supprimer</button>
  </div></details>`;
}

function soundVolumeControl(rule, action, actionIndex) {
  const volume = Math.max(0, Math.min(1, Number(action.config?.volume ?? 1)));
  return `<label class="audio-volume-control"><span>Volume <output data-sound-volume-output>${Math.round(volume * 100)} %</output></span><input class="volume-slider" type="range" min="0" max="1" step="0.05" value="${escapeHtml(volume)}" data-sound-volume data-action="set-sound-volume" ${soundRowAttributes(rule, action, actionIndex)}></label>`;
}

function renderAudioAlerts(rows) {
  return `<section class="studio-panel audio-panel panel-violet">
    <header class="studio-panel-heading">
      <div><span class="panel-accent"></span><div><h3>Alertes sonores</h3><p>Une vue compacte, avec la bibliothèque complète disponible au moment de choisir le son.</p></div></div>
      <div class="button-row">
        ${canAccessFeature("backblaze.sounds") ? '<button class="button" data-action="upload-sound">↑ Importer un son</button>' : ""}
        <button class="button primary" data-action="add-sound">＋ Créer une alerte</button>
      </div>
    </header>
    ${rows.length ? `<div class="audio-card-list">${rows.map(({ rule, action, actionIndex }) => {
      const attributes = soundRowAttributes(rule, action, actionIndex);
      return `<article class="audio-rule-card">
        <button class="audio-preview-button" title="Écouter" data-action="test-action" ${attributes}>▶</button>
        <div class="audio-rule-copy"><strong>${escapeHtml(rule.name)}</strong><span class="sound-name"><span>♫</span>${escapeHtml(actionDescription(action))}</span></div>
        <div class="audio-rule-trigger"><small>DÉCLENCHEUR</small>${triggerPill(rule)}</div>
        ${audioOutputSwitchMarkup(rule, action, actionIndex)}
        ${soundVolumeControl(rule, action, actionIndex)}
        <label class="audio-rule-state"><span class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></span><small>${rule.enabled ? "Actif" : "Inactif"}</small></label>
        ${soundContextMenu(rule, action, actionIndex, "edit-sound")}
      </article>`;
    }).join("")}</div>` : `<div class="automation-empty">${emptyInline("Aucune alerte sonore. Créez votre première règle audio.")}</div>`}
  </section>`;
}

function renderTtsRules(rows) {
  return `<section class="studio-panel audio-panel panel-cyan">
    <header class="studio-panel-heading"><div><span class="panel-accent"></span><div><h3>Synthèse vocale</h3><p>Chaque commentaire du chat peut être lu avec la voix Windows de votre choix.</p></div></div><div class="button-row"><button class="button" data-action="preview-tts">Tester la voix</button><button class="button primary" data-action="add-tts">＋ Ajouter une règle TTS</button></div></header>
    ${rows.length ? `<div class="audio-card-list tts-card-list">${rows.map(({ rule, action, actionIndex }) => {
      const attributes = soundRowAttributes(rule, action, actionIndex);
      const volume = Math.round(Number(action.config?.volume ?? snapshot.state.settings.tts.volume) * 100);
      return `<article class="audio-rule-card tts-rule-card">
        <button class="audio-preview-button" title="Tester la voix" data-action="test-action" ${attributes}>▶</button>
        <div class="audio-rule-copy"><strong>${escapeHtml(rule.name)}</strong><span>Commentaire du chat</span></div>
        <div class="audio-rule-trigger"><small>DÉCLENCHEUR</small>${triggerPill(rule)}</div>
        <div class="tts-voice-summary"><small>VOIX</small><strong>${escapeHtml(action.config?.voice || snapshot.state.settings.tts.voice || "Voix Windows par défaut")}</strong><span>${volume} %</span></div>
        ${audioOutputSwitchMarkup(rule, action, actionIndex)}
        <label class="audio-rule-state"><span class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></span><small>${rule.enabled ? "Actif" : "Inactif"}</small></label>
        ${soundContextMenu(rule, action, actionIndex, "edit-tts")}
      </article>`;
    }).join("")}</div>` : `<div class="automation-empty">${emptyInline("Aucune règle de synthèse vocale.")}</div>`}
  </section>`;
}

function renderSpotifyPanel() {
  return `<section class="studio-panel spotify-panel ${spotifyStatus.connected ? "is-connected" : ""}">
        <header class="studio-panel-heading">
          <div><span class="spotify-mark">●</span><div><h3>Spotify en direct</h3><p>Contrôlez la musique et ajoutez des titres depuis les interactions du live.</p></div></div>
          <div class="button-row">
            ${spotifyStatus.connected ? `<button class="button" data-action="spotify-refresh">↻ Actualiser</button><button class="button danger" data-action="spotify-disconnect">Déconnecter</button>` : `<button class="button spotify-connect-button" data-action="spotify-connect">Connecter Spotify</button>`}
          </div>
        </header>
        <div class="spotify-summary">
          <article><span>COMPTE</span><strong>${escapeHtml(spotifyStatus.account?.displayName || spotifyStatus.account?.email || "Non connecté")}</strong><small>${spotifyStatus.connected ? "Compte autorisé" : spotifyStatus.configured ? "Cliquez sur Connecter Spotify" : "Connexion Spotify indisponible"}</small></article>
          <article><span>APPAREIL</span><strong>${escapeHtml(spotifyStatus.activeDevice?.name || "Aucun appareil actif")}</strong><small>${escapeHtml(spotifyStatus.activeDevice?.type || "Ouvrez Spotify et lancez une musique")}</small></article>
          <article><span>EN COURS</span><strong>${escapeHtml(spotifyTrackLabel(spotifyStatus.playback?.item) || "Aucun titre")}</strong><small>${spotifyStatus.playback?.isPlaying ? "Lecture en cours" : "En pause"}</small></article>
        </div>
        <div class="spotify-controls">
          <button class="button" data-action="spotify-control" data-operation="play" ${spotifyStatus.connected ? "" : "disabled"}>▶ Lecture</button>
          <button class="button" data-action="spotify-control" data-operation="pause" ${spotifyStatus.connected ? "" : "disabled"}>Ⅱ Pause</button>
          <button class="button" data-action="spotify-control" data-operation="next" ${spotifyStatus.connected ? "" : "disabled"}>≫ Suivant</button>
          <span>Les actions Spotify des déclencheurs utilisent cette connexion globale.</span>
        </div>
      </section>`;
}

function renderSounds() {
  const allRows = soundActionRows();
  const query = normalizeCatalogSearch(soundSearch);
  const audioRows = allRows.filter(({ action }) => action.type === "audio.play");
  const ttsRows = allRows.filter(({ action }) => action.type === "tts.speak");
  const ttsAvailable = canAccessFeature("tts.voices") && canAccessActionType("tts.speak");
  const spotifyAvailable = canAccessFeature("spotify.playback") && canAccessActionType("spotify.queue");
  const availableSections = new Set(["audio", "outputs"]);
  if (ttsAvailable) availableSections.add("tts");
  if (spotifyAvailable) availableSections.add("spotify");
  if (!availableSections.has(soundsSection)) soundsSection = "audio";
  const visibleRows = (rows) => rows.filter(({ rule, action }) =>
    !query || normalizeCatalogSearch(`${rule.name} ${triggerLabel(rule)} ${actionDescription(action)}`).includes(query)
  );
  const tabs = [
    ["audio", "Alertes sonores", audioRows.length],
    ...(ttsAvailable ? [["tts", "Synthèse vocale", ttsRows.length]] : []),
    ["outputs", "Diffusion LIVE", 8],
    ...(spotifyAvailable ? [["spotify", "Spotify", spotifyStatus.connected ? "ON" : "OFF"]] : [])
  ];
  return `<div class="reference-page sounds-page">
    <section class="page-hero compact">
      <div><span class="hero-chip">ATELIER AUDIO</span><h2>Sons & voix</h2><p>Associez une alerte sonore ou une voix à chaque déclencheur, puis choisissez clairement où elle doit être entendue.</p></div>
      ${["audio", "tts"].includes(soundsSection) ? `<label class="search-control"><span>⌕</span><input data-search="sounds" type="search" value="${escapeHtml(soundSearch)}" placeholder="Rechercher un son ou une règle"></label>` : ""}
    </section>
    <nav class="module-tabs sounds-module-tabs" aria-label="Sections audio">
      ${tabs.map(([id, label, count]) => `<button class="${soundsSection === id ? "active" : ""}" data-action="set-sounds-section" data-value="${id}">${label}<span>${count}</span></button>`).join("")}
    </nav>
    ${soundsSection === "audio" ? renderAudioAlerts(visibleRows(audioRows)) : ""}
    ${soundsSection === "tts" ? renderTtsRules(visibleRows(ttsRows)) : ""}
    ${soundsSection === "outputs" ? renderMediaScreensPanel(flattenActions(), { context: "sounds" }) : ""}
    ${soundsSection === "spotify" ? renderSpotifyPanel() : ""}
  </div>`;
}

function renderTimersPanel() {
  const timers = scheduledTimers();
  const actionRows = flattenActions();
  const actionById = new Map(
    actionRows.map((row) => [row.action.id, row])
  );
  const runtimeById = new Map(
    (snapshot.timerRuntime || []).map((entry) => [entry.id, entry])
  );
  return `
    <div class="timers-page actions-timers-panel">
      <section class="studio-panel panel-violet">
        <header class="studio-panel-heading">
          <div><span class="panel-accent"></span><div><h3>Timers d’actions</h3><p>Exécutez automatiquement une ou plusieurs actions toutes les X secondes, minutes ou heures.</p></div></div>
          <button class="button primary" data-action="add-timer">＋ Créer un timer</button>
        </header>
      </section>
      <section class="timer-scheduler-summary">
        <article><span>PLANIFICATEURS</span><strong>${timers.length}</strong><small>Propres au profil actif</small></article>
        <article><span>ACTIFS</span><strong>${timers.filter((timer) => timer.enabled !== false).length}</strong><small>Armés tant que ShenPulse est ouvert</small></article>
        <article><span>ACTIONS DISPONIBLES</span><strong>${actionRows.length}</strong><small>Sélection multiple autorisée</small></article>
      </section>
      <section class="studio-panel panel-cyan">
        <header class="studio-panel-heading">
          <div><span class="panel-accent"></span><div><h3>Planification</h3><p>Chaque passage exécute les actions cochées dans l’ordre, puis répète le cycle si demandé.</p></div></div>
          <span class="count-pill">${timers.length}</span>
        </header>
        <div class="data-table-wrap">
          <table class="data-table timers-data-table">
            <thead><tr><th>OUTILS</th><th>ACTIF</th><th>NOM</th><th>FRÉQUENCE</th><th>RÉPÉTITIONS</th><th>ACTIONS</th><th>PROCHAINE EXÉCUTION</th></tr></thead>
            <tbody>${timers.length ? timers.map((timer) => {
              const runtime = runtimeById.get(timer.id);
              const selectedRows = (timer.actionIds || [])
                .map((actionId) => actionById.get(actionId))
                .filter(Boolean);
              return `
              <tr>
                <td class="table-tools">
                  <button title="Exécuter maintenant" data-action="test-timer" data-id="${escapeHtml(timer.id)}">▶</button>
                  <button title="Modifier" data-action="edit-timer" data-id="${escapeHtml(timer.id)}">✎</button>
                  <button title="Supprimer" data-action="delete-entity" data-collection="timers" data-id="${escapeHtml(timer.id)}">×</button>
                </td>
                <td><label class="switch"><input type="checkbox" data-action="toggle-timer" data-id="${escapeHtml(timer.id)}" ${timer.enabled !== false ? "checked" : ""}><span></span></label></td>
                <td><strong>${escapeHtml(timer.name)}</strong><small class="table-subline">${timer.lastRunAt ? `Dernière : ${escapeHtml(formatTime(timer.lastRunAt))}` : "Jamais exécuté"}</small></td>
                <td><span class="timer-frequency-pill">${escapeHtml(timerIntervalLabel(timer.intervalMs))}</span></td>
                <td><strong>× ${Math.max(1, Number(timer.repeatCount || 1))}</strong><small class="table-subline">${Number(timer.repeatDelayMs || 0) > 0 ? `${formatIntervalDuration(timer.repeatDelayMs)} entre chaque passage` : "à la suite"}</small></td>
                <td><div class="timer-action-chips">${selectedRows.length ? selectedRows.map(({ rule, action }) => `<span title="${escapeHtml(actionTypeLabel(action.type))}">${escapeHtml(rule.name)}</span>`).join("") : `<em>Action manquante</em>`}</div></td>
                <td>${timer.enabled === false ? `<span class="badge">DÉSACTIVÉ</span>` : runtime?.running ? `<span class="badge success">EN COURS</span>` : runtime?.nextRunAt ? `<strong>${escapeHtml(formatTime(runtime.nextRunAt))}</strong>` : `<span class="badge">ARMEMENT…</span>`}</td>
              </tr>`;
            }).join("") : `<tr><td colspan="7">${emptyInline("Aucun timer. Créez-en un puis sélectionnez les actions à exécuter.")}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </div>`;
}

function timerIntervalLabel(intervalMs) {
  const value = Math.max(1000, Number(intervalMs) || 60000);
  if (value % 3600000 === 0) {
    const hours = value / 3600000;
    return `Toutes les ${hours} heure${hours > 1 ? "s" : ""}`;
  }
  if (value % 60000 === 0) {
    const minutes = value / 60000;
    return `Toutes les ${minutes} minute${minutes > 1 ? "s" : ""}`;
  }
  const seconds = value / 1000;
  return `Toutes les ${seconds} seconde${seconds > 1 ? "s" : ""}`;
}

function formatIntervalDuration(milliseconds) {
  const seconds = Math.max(0, Number(milliseconds) || 0) / 1000;
  return seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds} s`;
}

function timerOperationLabel(operation = "add") {
  return {
    add: "Ajouter / retirer",
    set: "Définir",
    pause: "Pause",
    resume: "Reprendre",
    reset: "Réinitialiser"
  }[operation] || operation;
}
