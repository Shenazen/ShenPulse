"use strict";

/**
 * Interactions, progression et validation des jeux.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderGameInteractions(pack, unlocked) {
  return pack.id === "coin-pusher"
    ? renderCoinPusherInteractions(pack, unlocked)
    : renderStandardGameInteractions(pack, unlocked);
}

function renderStandardGameInteractions(pack, unlocked) {
  const journey = gameJourneyFor(pack);
  const currentStepIndex = journey.findIndex((step) => step.id === "interactions");
  const nextStep = journey[currentStepIndex + 1] || {
    id: "launch",
    label: "Démarrage"
  };
  const nextStepLabel =
    nextStep.id === "overlays"
      ? "les overlays"
      : nextStep.id === "launch"
        ? "le démarrage"
        : nextStep.label.toLocaleLowerCase("fr");
  const query = gameEffectSearch.trim().toLocaleLowerCase();
  const rows = gameMappedEffects(pack)
    .map((row) => ({
      ...row,
      effect: pack.effects.find(
        (effect) => effect.id === row.action.config?.effectId
      )
    }))
    .filter((row) => row.effect);
  const categories = [
    ...new Set(rows.map((row) => row.effect.category || "Interaction"))
  ].sort((left, right) => left.localeCompare(right, "fr"));
  const visibleRows = rows.filter((row) => {
    const effect = row.effect;
    const title = row.rule.gameInteraction?.title || effect.name;
    const matchesCategory =
      gameEffectCategory === "all" || effect.category === gameEffectCategory;
    const matchesSearch =
      !query ||
      `${title} ${effect.name} ${effect.description} ${effect.code || ""} ${effect.category || ""} ${triggerLabel(row.rule)}`
        .toLocaleLowerCase()
        .includes(query);
    return matchesCategory && matchesSearch;
  });
  return `<div class="game-interactions-page">
    <header class="game-effects-heading">
      <span>${eventIconMarkup("gift")} INTERACTIONS <strong>${rows.length}</strong></span>
      <div class="button-row">
        <span class="game-effect-catalog-count">${pack.effects.length} actions disponibles</span>
        <button class="button primary" data-action="add-game-interaction" data-pack="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>＋ Ajouter une interaction</button>
      </div>
    </header>
    <section class="game-interaction-toolbar">
      <label class="search-control"><span>⌕</span><input data-search="game-effects" type="search" value="${escapeHtml(gameEffectSearch)}" placeholder="Rechercher dans vos interactions"></label>
    </section>
    <div class="game-category-pills">
      <button class="${gameEffectCategory === "all" ? "active" : ""}" data-action="set-game-effect-category" data-value="all">Toutes <span>${rows.length}</span></button>
      ${categories.map((category) => `<button class="${gameEffectCategory === category ? "active" : ""}" data-action="set-game-effect-category" data-value="${escapeHtml(category)}">${escapeHtml(category)} <span>${rows.filter((row) => (row.effect.category || "Interaction") === category).length}</span></button>`).join("")}
    </div>
    <section class="game-interaction-grid">
      ${visibleRows.map((row) => {
        const effect = row.effect;
        const enabled = row.rule.enabled !== false;
        const title = row.rule.gameInteraction?.title || effect.name;
        const editorData = `data-action="edit-game-interaction" data-pack="${escapeHtml(pack.id)}" data-effect="${escapeHtml(effect.id)}" data-rule="${escapeHtml(row.rule.id)}" data-row-action="${escapeHtml(row.action.id || "")}" data-index="${row.actionIndex}"`;
        return `<article class="game-interaction-card configured ${enabled ? "" : "disabled"} ${effect.available === false ? "unavailable" : ""}">
        <div class="game-effect-side">
          <button class="game-effect-icon" data-action="toggle-game-interaction" data-pack="${escapeHtml(pack.id)}" data-rule="${escapeHtml(row.rule.id)}" title="${enabled ? "Désactiver" : "Activer"}" ${unlocked && effect.available !== false ? "" : "disabled"}>
            ${enabled
              ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>'
              : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M6.2 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'}
          </button>
          <button class="game-effect-icon danger" data-action="delete-game-interaction" data-pack="${escapeHtml(pack.id)}" data-rule="${escapeHtml(row.rule.id)}" title="Supprimer" ${unlocked ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
        </div>
        <button class="game-effect-main" ${editorData} title="${escapeHtml(effect.description || effect.name)}" ${unlocked && effect.available !== false ? "" : "disabled"}>
          <span class="game-effect-art">${effect.image ? `<img src="${escapeHtml(effect.image)}" alt="${escapeHtml(effect.name)}" loading="lazy">` : `<span>${escapeHtml(effect.icon || "◇")}</span>`}</span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(effect.category || "Interaction")}</small>
        </button>
        <div class="game-effect-side right">
          <button class="game-effect-icon" ${editorData} title="Modifier" ${unlocked && effect.available !== false ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg></button>
          <button class="game-effect-icon play" data-action="test-game-interaction" data-pack="${escapeHtml(pack.id)}" data-rule="${escapeHtml(row.rule.id)}" data-row-action="${escapeHtml(row.action.id || "")}" data-index="${row.actionIndex}" title="${effect.actionType === "overlay.win-counter" ? "Tester sur l’overlay WINS" : "Tester dans le jeu"}" ${unlocked && effect.available !== false ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg></button>
        </div>
        <div class="game-effect-trigger">
          ${triggerPill(row.rule)}
        </div>
      </article>`;
      }).join("")}
    </section>
    ${visibleRows.length ? "" : emptyInline(rows.length ? "Aucune interaction ne correspond à cette recherche." : "Aucune interaction configurée. Utilisez « Ajouter une interaction » pour choisir une action du jeu.")}
    <footer class="game-step-footer">
      <div><strong>${rows.length} interaction${rows.length > 1 ? "s" : ""} configurée${rows.length > 1 ? "s" : ""}</strong><small>Chaque interaction et chaque déclencheur restent propres au profil actif.</small></div>
      <button class="button primary" data-action="game-step" data-value="${escapeHtml(nextStep.id)}" ${unlocked ? "" : "disabled"}>Continuer vers ${escapeHtml(nextStepLabel)} →</button>
    </footer>
  </div>`;
}

function renderGamePageMessage(pack, scope) {
  const message = gamePageMessages.get(pack.id);
  if (!message || (message.scope && message.scope !== scope)) return "";
  return `<div class="game-page-message ${escapeHtml(message.type || "info")}" role="status">
    <span>${message.type === "error" ? "!" : "✓"}</span>
    <div><strong>${escapeHtml(message.title)}</strong><p>${escapeHtml(message.detail || "")}</p></div>
    <button type="button" data-action="dismiss-game-message" data-id="${escapeHtml(pack.id)}" aria-label="Fermer">×</button>
  </div>`;
}

async function restoreActiveGameInstallProgress(
  preferredGameId = "",
  { renderWhenFound = true } = {}
) {
  if (!snapshot || !isAccountAuthenticated()) return null;
  const gameIds = [
    preferredGameId,
    ...AUTOMATED_GAME_INSTALLERS
  ].filter(
    (gameId, index, entries) =>
      gameId &&
      entries.indexOf(gameId) === index &&
      (snapshot.packs || []).some((pack) => pack.id === gameId)
  );
  const statuses = await Promise.all(
    gameIds.map((gameId) =>
      api.getGameRuntimeStatus(gameId).catch(() => null)
    )
  );
  const active = statuses.find(
    (status) => status?.installing && status.installProgress
  );
  if (!active) return null;
  const repairing = Boolean(
    snapshot.state.game.installations?.[active.gameId]
  );
  gameInstallBusyId = active.gameId;
  gameInstallProgress = {
    ...active.installProgress,
    gameId: active.gameId,
    operation: repairing ? "repair" : "install",
    open: true
  };
  if (renderWhenFound) render();
  return active;
}

function friendlyInstallStage(progress = {}) {
  const repairing = progress.operation === "repair";
  if (progress.phase === "error") {
    return {
      kicker: repairing ? "RÉPARATION INTERROMPUE" : "INSTALLATION INTERROMPUE",
      title: repairing ? "La réparation a échoué" : "L’installation a échoué",
      detail:
        progress.message ||
        "L’opération n’a pas pu se terminer. Vérifiez le dossier du jeu puis réessayez."
    };
  }
  if (progress.phase === "complete") {
    return {
      kicker: "TERMINÉ",
      title: repairing ? "Réparation terminée" : "Installation terminée",
      detail: `${progress.gameTitle || "Le jeu"} est prêt dans ShenPulse.`
    };
  }
  if (progress.phase === "launch") {
    return {
      kicker: "FINALISATION",
      title: "Premier démarrage en cours",
      detail:
        progress.message ||
        "ShenPulse termine la préparation et vérifie que le serveur répond."
    };
  }
  if (progress.phase === "install") {
    return {
      kicker: repairing ? "RÉPARATION" : "INSTALLATION",
      title: repairing
        ? "Réparation automatique en cours"
        : "Préparation automatique en cours",
      detail: progress.message || "ShenPulse installe les éléments nécessaires."
    };
  }
  if (progress.phase === "download") {
    return {
      kicker: "TÉLÉCHARGEMENT",
      title: "Récupération des éléments nécessaires",
      detail: progress.message || "Le téléchargement est sécurisé et peut prendre quelques minutes."
    };
  }
  return {
    kicker: "PRÉPARATION",
    title: "Recherche de votre jeu",
    detail: progress.message || "ShenPulse détecte automatiquement son emplacement."
  };
}

function formatTransferBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes < 1024) return `${Math.round(bytes)} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let amount = bytes / 1024;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount >= 100 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unitIndex]}`;
}

function formatTransferDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  if (value < 60) return `${value} s`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  if (minutes < 60) return `${minutes} min ${String(rest).padStart(2, "0")} s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

function renderGameInstallProgressModal(pack) {
  if (
    !gameInstallProgress?.open ||
    gameInstallProgress.gameId !== pack.id
  ) {
    return "";
  }
  const stage = friendlyInstallStage(gameInstallProgress);
  const percent = Math.min(
    100,
    Math.max(0, Number(gameInstallProgress.percent || 0))
  );
  const complete = gameInstallProgress.phase === "complete";
  const failed = gameInstallProgress.phase === "error";
  const finished = complete || failed;
  const downloading = gameInstallProgress.phase === "download";
  const indeterminate =
    !finished && Boolean(gameInstallProgress.indeterminate);
  const totalBytes = Math.max(
    0,
    Number(gameInstallProgress.totalBytes || 0)
  );
  const receivedBytes = Math.max(
    0,
    Number(gameInstallProgress.bytesReceived || 0)
  );
  const speedBps = Math.max(0, Number(gameInstallProgress.speedBps || 0));
  const rawDownloadPercent = gameInstallProgress.downloadPercent;
  const downloadPercent =
    rawDownloadPercent != null &&
    Number.isFinite(Number(rawDownloadPercent))
    ? Math.max(
        0,
        Math.min(100, Number(rawDownloadPercent))
      )
    : null;
  const startedAt = Date.parse(
    gameInstallProgress.startedAt ||
      gameInstallProgress.occurredAt ||
      new Date().toISOString()
  );
  const lastActivityAt = Date.parse(
    gameInstallProgress.lastActivityAt ||
      gameInstallProgress.occurredAt ||
      new Date().toISOString()
  );
  const elapsedSeconds = Math.max(
    0,
    Math.floor((Date.now() - startedAt) / 1000)
  );
  const idleSeconds = Math.max(
    0,
    Math.floor((Date.now() - lastActivityAt) / 1000)
  );
  const progressWidth = complete ? 100 : Math.max(3, percent);
  const current = Number(gameInstallProgress.current || 0);
  const total = Number(gameInstallProgress.total || 0);
  const waitingForNetwork = downloading && idleSeconds >= 10;
  const activityText = complete
    ? "Installation terminée."
    : failed
      ? "L’opération est arrêtée."
      : gameInstallProgress.phase === "install"
        ? "Préparation locale des fichiers en cours…"
        : idleSeconds < 2
          ? "Activité en cours…"
          : idleSeconds < 10
            ? `Dernière activité il y a ${idleSeconds} s`
            : `Toujours en attente du serveur · ${idleSeconds} s`;
  return `<div class="game-progress-backdrop" role="presentation">
    <section class="game-progress-modal" role="dialog" aria-modal="true" aria-labelledby="game-progress-title">
      <header>
        <div><span>${escapeHtml(stage.kicker)}</span><h3 id="game-progress-title">${escapeHtml(stage.title)}</h3></div>
        <strong>${Math.round(percent)}%</strong>
      </header>
      <div class="game-progress-visual ${complete ? "complete" : ""} ${failed ? "failed" : ""} ${indeterminate ? "is-indeterminate" : ""}">
        <span>${complete ? "✓" : failed ? "!" : downloading ? "↓" : "↻"}</span>
        <div class="game-progress-track ${indeterminate ? "indeterminate" : ""}"><i style="width:${progressWidth}%"></i></div>
      </div>
      <p>${escapeHtml(stage.detail)}</p>
      ${finished ? "" : `<div class="game-progress-stats">
        <span><small>ÉTAPE</small><strong>${current && total ? `${current} sur ${total}` : "Préparation"}</strong></span>
        ${downloading ? `<span><small>TÉLÉCHARGÉ</small><strong>${formatTransferBytes(receivedBytes)}${totalBytes ? ` / ${formatTransferBytes(totalBytes)}` : ""}</strong></span>` : ""}
        ${downloading ? `<span><small>PROGRESSION</small><strong>${downloadPercent === null ? "Calcul…" : `${Math.round(downloadPercent)} %`}</strong></span>` : ""}
        ${downloading ? `<span><small>VITESSE</small><strong>${speedBps ? `${formatTransferBytes(speedBps)}/s` : "Connexion…"}</strong></span>` : ""}
        ${downloading && gameInstallProgress.etaSeconds != null ? `<span><small>RESTANT</small><strong>${formatTransferDuration(gameInstallProgress.etaSeconds)}</strong></span>` : ""}
        <span><small>ÉCOULÉ</small><strong>${formatTransferDuration(elapsedSeconds)}</strong></span>
      </div>`}
      <div class="game-progress-activity ${failed ? "failed" : waitingForNetwork ? "waiting" : ""}">
        <i></i>
        <span>${escapeHtml(activityText)}</span>
      </div>
      <small>${complete ? "Vous pouvez continuer la configuration." : failed ? "Aucun travail ne continue en arrière-plan. Vous pouvez fermer cette fenêtre et réessayer." : waitingForNetwork ? "ShenPulse fonctionne toujours. Si aucune donnée n’arrive pendant une minute, un message d’erreur vous proposera de réessayer." : gameInstallProgress.phase === "install" ? "L’extraction et la copie peuvent prendre plusieurs minutes selon votre disque." : "Gardez ShenPulse ouvert jusqu’à la fin de l’installation."}</small>
      ${finished ? `<footer><button class="button ${failed ? "" : "primary"}" data-action="dismiss-game-progress">${failed ? "Fermer" : "Continuer"}</button></footer>` : ""}
    </section>
  </div>`;
}

function renderGameLaunchProgressModal(pack) {
  if (
    !gameLaunchProgress?.open ||
    gameLaunchProgress.gameId !== pack.id
  ) {
    return "";
  }
  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (Date.now() - Number(gameLaunchProgress.startedAt || Date.now())) / 1000
    )
  );
  return `<div class="game-progress-backdrop game-launch-progress-backdrop" role="presentation">
    <section class="game-progress-modal game-launch-progress-modal" role="dialog" aria-modal="true" aria-labelledby="game-launch-progress-title">
      <header>
        <div><span>DÉMARRAGE DU SERVEUR</span><h3 id="game-launch-progress-title">PaperMC se prépare</h3></div>
        <strong>Veuillez patienter</strong>
      </header>
      <div class="game-progress-visual is-indeterminate">
        <span>↻</span>
        <div class="game-progress-track indeterminate"><i></i></div>
      </div>
      <p>ShenPulse démarre le serveur, attend qu’il soit réellement prêt, puis active les interactions et le chrono.</p>
      <div class="game-progress-stats">
        <span><small>ÉTAT</small><strong>Initialisation en cours…</strong></span>
        <span><small>ÉCOULÉ</small><strong>${formatTransferDuration(elapsedSeconds)}</strong></span>
      </div>
      <div class="game-progress-activity">
        <i></i>
        <span>En attente du message « serveur prêt » de PaperMC…</span>
      </div>
      <small>Un seul clic suffit. Cette fenêtre se fermera automatiquement lorsque le bouton passera sur « Arrêter la session de jeu ».</small>
    </section>
  </div>`;
}

function gameInteractionRules(packId) {
  const rules =
    snapshot?.state?.game?.interactionRulesByPack?.[packId];
  return Array.isArray(rules) ? rules : [];
}

function gameMappedEffects(pack) {
  return gameInteractionRules(pack.id).flatMap((rule) =>
    (rule.actions || [])
      .map((action, actionIndex) => ({
        rule,
        action,
        actionIndex
      }))
      .filter(
        (row) =>
          ["game.effect", "overlay.win-counter"].includes(
            row.action.type
          ) &&
          row.action.config?.effectId
      )
  );
}

function gameInteractionReadinessIssues(pack) {
  if (!pack) return [];
  const activeRules = gameInteractionRules(pack.id).filter(
    (rule) => rule.enabled !== false
  );
  if (!activeRules.length) {
    return [
      {
        name: "Interactions du jeu",
        reason: "aucune interaction n’est active"
      }
    ];
  }
  const availableEffectIds = new Set(
    (pack.effects || [])
      .filter((effect) => effect.available !== false)
      .map((effect) => effect.id)
  );
  return activeRules.flatMap((rule) => {
    const reasons = [];
    const triggerType = String(rule.trigger?.type || "").trim();
    if (hasAutomaticTrigger(rule)) {
      if (!triggerType || triggerType === "*") {
        reasons.push("aucun déclencheur précis n’est défini");
      }
      if (
        triggerType === "gift" &&
        !String(ruleGiftName(rule) || "").trim() &&
        !ruleGiftValueLabel(rule)
      ) {
        reasons.push("aucun cadeau TikTok ni filtre de valeur n’est configuré");
      }
      if (
        ["like", "likes"].includes(triggerType) &&
        (!Number.isFinite(Number(rule.trigger?.threshold)) ||
          Number(rule.trigger?.threshold) <= 0)
      ) {
        reasons.push("le nombre de likes requis n’est pas valide");
      }
    }
    const mappedActions = (rule.actions || []).filter(
      (action) =>
        action.enabled !== false &&
        ["game.effect", "overlay.win-counter"].includes(action.type)
    );
    if (!mappedActions.length) {
      reasons.push("aucun effet de jeu n’est configuré");
    } else if (
      !mappedActions.some((action) =>
        availableEffectIds.has(String(action.config?.effectId || ""))
      )
    ) {
      reasons.push("l’effet configuré n’est pas disponible pour ce jeu");
    }
    const name = String(
      rule.gameInteraction?.title || rule.name || "Interaction sans nom"
    ).trim();
    return reasons.map((reason) => ({ name, reason }));
  });
}

async function confirmGameInteractionReadiness(pack, operationLabel) {
  const issues = gameInteractionReadinessIssues(pack);
  if (!issues.length) return true;
  const visibleIssues = issues
    .slice(0, 10)
    .map((issue) => `• ${issue.name} : ${issue.reason}`)
    .join("\n");
  const hiddenCount = Math.max(0, issues.length - 10);
  return confirmAction(
    `Interactions à vérifier avant ${operationLabel}\n\n` +
      `${visibleIssues}` +
      (hiddenCount ? `\n• … et ${hiddenCount} autre${hiddenCount > 1 ? "s" : ""}` : "") +
      "\n\nLe fonctionnement sera dégradé tant que ces réglages ne seront pas complétés.\n\nContinuer quand même ?",
    {
      title: "Interactions incomplètes",
      confirmLabel: "Continuer quand même"
    }
  );
}

function findGameInteractionRow(
  packId,
  ruleId,
  actionId,
  actionIndex
) {
  const pack = snapshot.packs.find((entry) => entry.id === packId);
  if (!pack) return null;
  return gameMappedEffects(pack).find(
    (row) =>
      row.rule.id === ruleId &&
      (actionId
        ? row.action.id === actionId
        : row.actionIndex === Number(actionIndex))
  );
}
