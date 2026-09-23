"use strict";

/**
 * Installation, lancement et sources overlay des jeux.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderGameInstallation(pack, unlocked) {
  const integrated = pack.guide?.mode === "integrated";
  if (pack.guide?.mode === "input") {
    return renderInputGameInstallation(pack, unlocked);
  }
  if (integrated && CONFIGURABLE_INTEGRATED_GAMES.has(pack.id)) {
    return renderIntegratedGameSettings(pack, unlocked);
  }
  const automated = AUTOMATED_GAME_INSTALLERS.has(pack.id);
  const managedMinecraft = MINECRAFT_MODE_IDS.includes(pack.id);
  const installation = snapshot.state.game.installations?.[pack.id];
  const updateAvailable = Boolean(
    installation &&
      pack.installerVersion &&
      installation.installerVersion !== pack.installerVersion
  );
  const busy = gameInstallBusyId === pack.id;
  let statusTitle = integrated
    ? "Aucune installation nécessaire"
    : updateAvailable
      ? "Une mise à jour du pack est disponible"
    : installation
      ? `${pack.name} est prêt`
      : "Installation en un clic";
  let statusText = integrated
    ? "Ce jeu est déjà inclus dans ShenPulse. Vous pouvez passer directement aux interactions."
    : updateAvailable
      ? pack.id === "gtav-montchiliad"
        ? "Mettez à jour le pack pour installer le tonneau complet corrigé de l’interaction Retourner le véhicule."
        : `Mettez à jour le pack ${pack.name} pour installer la dernière version du mod et de sa passerelle ShenPulse.`
    : installation
      ? "Tous les éléments nécessaires sont installés. Vous pouvez continuer la configuration."
      : "ShenPulse recherche le jeu puis installe automatiquement tout ce qui est nécessaire. S’il ne le trouve pas, il vous demandera simplement de choisir son dossier.";
  if (managedMinecraft) {
    statusTitle = installation
      ? "Serveur Minecraft ShenPulse installé"
      : "Serveur Minecraft complet en un clic";
    statusText = installation
      ? "PaperMC, Java 21, le mode choisi et ses plugins sont installés. Le serveur se lance automatiquement sur 127.0.0.1."
      : "ShenPulse installe PaperMC, un Java 21 portable, le monde et les plugins dans son propre dossier. Aucun dossier serveur ne vous sera demandé.";
  }
  const installationStateText = managedMinecraft
    ? installation
      ? "Le serveur local est mémorisé et peut être relancé depuis ShenPulse."
      : "Acceptez le CLUF Minecraft puis laissez ShenPulse télécharger, préparer et démarrer le serveur."
    : installation || integrated
      ? "ShenPulse a mémorisé cette installation."
      : "Fermez le jeu avant de commencer. ShenPulse s’occupe du reste et conserve une copie de sécurité si nécessaire.";
  return `<div class="game-simple-step">
    <section class="game-primary-panel game-install-simple">
      <header><div><span>↓ INSTALLATION</span><h3>${escapeHtml(statusTitle)}</h3><p>${escapeHtml(statusText)}</p></div><span class="game-step-count">${updateAvailable ? "MISE À JOUR" : installation || integrated ? "PRÊT" : "1 CLIC"}</span></header>
      ${renderGamePageMessage(pack, "installation")}
      <div class="game-install-state ${installation || integrated ? "ready" : ""}">
        <span>${installation || integrated ? "✓" : "↓"}</span>
        <div>
          <strong>${installation || integrated ? "Prêt à continuer" : `Installer ${escapeHtml(pack.name)}`}</strong>
          <p>${installationStateText}</p>
        </div>
      </div>
      <footer class="game-panel-actions">
        ${automated ? `<button class="button primary game-install-button" data-action="install-game" data-id="${escapeHtml(pack.id)}" ${unlocked && !busy ? "" : "disabled"}>${busy ? "Installation en cours…" : updateAvailable ? "↓ Mettre à jour le pack" : installation ? "↻ Réparer l’installation" : "↓ Installer automatiquement"}</button>` : ""}
        ${!automated && !integrated ? `<button class="button" data-action="open-url" data-value="${escapeHtml(pack.guide?.sources?.[0]?.url || "")}" ${pack.guide?.sources?.[0]?.url ? "" : "disabled"}>Ouvrir l’aide d’installation</button>` : ""}
        <button class="button ${installation || integrated ? "primary" : ""}" data-action="game-step" data-value="interactions" ${unlocked ? "" : "disabled"}>Continuer vers les interactions →</button>
      </footer>
    </section>
    <aside class="game-novice-note">
      <span>✦</span>
      <strong>Vous n’avez rien à configurer</strong>
      <p>Le téléchargement, la copie des éléments et la préparation sont automatisés. Une fenêtre de progression reste visible jusqu’à la fin.</p>
      ${installation ? `<small>Dernière installation : ${escapeHtml(formatAdminDate(installation.installedAt))}</small>` : ""}
    </aside>
  </div>`;
}

function renderInputGameInstallation(pack, unlocked) {
  const configuredLayout = String(
    snapshot.state.game.connectorOverrides?.[pack.id]?.keyLayout ||
      pack.connector?.keyLayout ||
      "wasd"
  ).toLowerCase();
  return `<div class="game-simple-step">
    <section class="game-primary-panel game-install-simple">
      <header><div><span>⌨ CONTRÔLE CIBLÉ</span><h3>Aucun mod à installer</h3><p>ShenPulse envoie uniquement les séquences clavier vérifiées au processus Fortnite officiel.</p></div><span class="game-step-count">PRIVÉ</span></header>
      ${renderGamePageMessage(pack, "installation")}
      <div class="game-install-state ready">
        <span>✓</span>
        <div>
          <strong>Fortnite reste intact</strong>
          <p>Aucun fichier du jeu n’est modifié. Si Fortnite n’est pas ouvert ou perd sa fenêtre, l’envoi est refusé ou interrompu.</p>
        </div>
      </div>
      <label class="field full">
        <span>Touches de déplacement utilisées dans Fortnite</span>
        <select data-fortnite-key-layout>
          <option value="wasd" ${configuredLayout === "wasd" ? "selected" : ""}>WASD — séquence Crowd Control originale</option>
          <option value="azerty" ${configuredLayout === "azerty" ? "selected" : ""}>ZQSD — clavier français</option>
        </select>
        <small>Les autres touches restent Maj, Espace, Ctrl, R, B, M et 1 à 5.</small>
      </label>
      <footer class="game-panel-actions">
        <button class="button" data-action="test-game" data-id="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>Détecter Fortnite ouvert</button>
        <button class="button" data-action="save-fortnite-input-layout" data-id="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>Enregistrer les touches</button>
        <button class="button primary" data-action="game-step" data-value="interactions" ${unlocked ? "" : "disabled"}>Continuer vers les interactions →</button>
      </footer>
    </section>
    <aside class="game-novice-note">
      <span>⌁</span>
      <strong>Réservé au propriétaire</strong>
      <p>Ce jeu n’est transmis au rendu que pour votre compte propriétaire vérifié. Le connecteur ne reconnaît que FortniteClient-Win64-Shipping.exe.</p>
      <small>Lancez Fortnite et chargez une partie avant de tester un effet.</small>
    </aside>
  </div>`;
}

function renderGameLaunch(pack, unlocked) {
  const integrated = pack.guide?.mode === "integrated";
  const inputDriven = pack.guide?.mode === "input";
  const managedMinecraft = MINECRAFT_MODE_IDS.includes(pack.id);
  const installation = snapshot.state.game.installations?.[pack.id];
  const canLaunch = unlocked && (integrated || Boolean(installation));
  const ready = unlocked && (inputDriven || canLaunch);
  const mappings = gameMappedEffects(pack);
  const runningSession = activeGameSession();
  const sessionActive = runningSession?.packId === pack.id;
  const launchBusy = gameLaunchBusyId === pack.id;
  const roundSettings = managedMinecraft
    ? minecraftRoundSettingsFor(pack.id)
    : null;
  const roundRemaining = sessionActive
    ? minecraftRoundRemainingSeconds(runningSession)
    : roundSettings
      ? roundSettings.durationMinutes * 60
      : 0;
  const launchDescription = inputDriven
    ? "Ouvrez Fortnite depuis Epic Games, chargez une partie puis activez la session. ShenPulse ne lancera ni ne modifiera le jeu."
    : managedMinecraft
    ? "Démarrez le serveur depuis ShenPulse, ouvrez Minecraft puis rejoignez 127.0.0.1. Les interactions du mode choisi seront déjà chargées."
    : "Lancez le jeu depuis ShenPulse. Une fois votre partie chargée, les interactions configurées seront prêtes à fonctionner.";
  const launchButtonLabel = managedMinecraft
    ? "▶ Démarrer le serveur et activer"
    : `▶ Lancer ${pack.name} et activer`;
  return `<div class="game-simple-step game-start-layout">
    <section class="game-primary-panel game-start-panel">
      <header><div><span>▶ DÉMARRAGE</span><h3>Tout est prêt pour jouer</h3><p>${escapeHtml(launchDescription)}</p></div></header>
      ${renderGamePageMessage(pack, "launch")}
      <div class="game-start-readiness">
        <article class="${ready ? "ready" : ""}"><span>${ready ? "✓" : "1"}</span><div><strong>${ready ? inputDriven ? "Connecteur prêt" : "Jeu prêt" : "Installation nécessaire"}</strong><small>${ready ? inputDriven ? "Fortnite sera détecté au moment du test." : "ShenPulse peut lancer le jeu." : "Revenez à l’étape Installation."}</small></div></article>
        <article class="${mappings.length ? "ready" : ""}"><span>${mappings.length ? "✓" : "2"}</span><div><strong>${mappings.length ? `${mappings.length} interaction${mappings.length > 1 ? "s" : ""} configurée${mappings.length > 1 ? "s" : ""}` : "Interactions facultatives"}</strong><small>${mappings.length ? "Vos déclencheurs sont enregistrés." : "Vous pourrez en ajouter à tout moment."}</small></div></article>
        <article class="${sessionActive ? "ready" : ""}"><span>${sessionActive ? "✓" : "3"}</span><div><strong>${sessionActive ? "Session de jeu active" : "Session de jeu arrêtée"}</strong><small>${sessionActive ? "Les interactions restent actives sur toutes les pages." : "Activez-la pour autoriser les interactions de ce jeu."}</small></div></article>
      </div>
      <footer class="game-panel-actions">
        ${ready ? "" : `<button class="button" data-action="game-step" data-value="installation">← Revenir à l’installation</button>`}
        ${pack.id === "coin-pusher"
          ? `<button type="button" class="button" data-action="trigger-effect" data-id="pousser-le-plateau" data-pack="coin-pusher" title="Fait sortir entièrement le poussoir et vide le plateau" ${sessionActive ? "" : "disabled"}>⇥ Poussée complète</button>`
          : ""}
        ${sessionActive
          ? `<button class="button danger game-launch-button" data-action="stop-game-session">■ Arrêter la session de jeu</button>`
          : inputDriven
            ? `<button class="button primary game-launch-button" data-action="start-game-session" data-id="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>▶ Activer les interactions Fortnite</button>`
          : canLaunch
            ? `<button class="button primary game-launch-button" data-action="launch-game" data-id="${escapeHtml(pack.id)}" ${launchBusy ? "disabled" : ""}>${launchBusy ? "… Démarrage du serveur" : integrated ? "▶ Ouvrir le jeu et activer" : escapeHtml(launchButtonLabel)}</button>`
            : `<button class="button primary game-launch-button" data-action="start-game-session" data-id="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>▶ Activer les interactions</button>`}
      </footer>
    </section>
    ${managedMinecraft
      ? `<div class="game-launch-side">
          <form class="minecraft-round-settings" data-minecraft-round-settings="${escapeHtml(pack.id)}">
            <header>
              <span>◷</span>
              <div><strong>Durée de la partie</strong><small>Le chrono démarre dès que PaperMC est prêt.</small></div>
            </header>
            <label>
              <span>Temps avant TIME OUT</span>
              <div><input name="durationMinutes" type="number" min="1" max="1440" step="1" value="${roundSettings.durationMinutes}"><b>minutes</b></div>
            </label>
            <label class="minecraft-round-toggle">
              <input name="autoRestart" type="checkbox" ${roundSettings.autoRestart ? "checked" : ""}>
              <span><strong>Relancer automatiquement le chrono</strong><small>Après chaque TIME OUT, une WIN est retirée puis une nouvelle partie commence.</small></span>
            </label>
            <div class="minecraft-round-runtime ${sessionActive ? "running" : ""}">
              <span>${sessionActive ? "TEMPS RESTANT" : "PROCHAINE PARTIE"}</span>
              <strong data-minecraft-round-countdown>${formatCountdown(roundRemaining)}</strong>
              <small>${sessionActive ? (roundSettings.autoRestart ? "Relance automatique active" : "Le chrono s’arrêtera après le TIME OUT") : `${roundSettings.durationMinutes} minute${roundSettings.durationMinutes > 1 ? "s" : ""} configurée${roundSettings.durationMinutes > 1 ? "s" : ""}`}</small>
            </div>
            <button type="button" class="button primary" data-action="save-game-round-settings" data-id="${escapeHtml(pack.id)}">Enregistrer les réglages</button>
          </form>
          <aside class="game-novice-note">
            <span>▶</span>
            <strong>Après le lancement</strong>
            <p>Dans Minecraft, ajoutez le serveur 127.0.0.1 puis rejoignez-le. ShenPulse garde le serveur, le chrono et les interactions actifs.</p>
          </aside>
        </div>`
      : `<aside class="game-novice-note">
          <span>▶</span>
          <strong>Après le lancement</strong>
          <p>${inputDriven ? "Gardez Fortnite au premier plan. Chaque interaction est arrêtée si la fenêtre cible ne peut plus être reconnue." : "Chargez simplement votre partie. ShenPulse reconnaît automatiquement le jeu préparé et utilise votre profil actif."}</p>
        </aside>`}
  </div>`;
}

function renderGameOverlays(pack, unlocked) {
  if (GAME_OVERLAY_GENERATOR_ONLY_IDS.has(pack.id)) {
    return `<div class="game-overlays-page">
      <section class="game-interaction-toolbar">
        <div><span>▱ OVERLAY DES CADEAUX</span><h3>Générer l’overlay des interactions</h3><p>Créez une image à partir des cadeaux associés aux interactions actives de ${escapeHtml(pack.name)}. Aucun autre overlay n’est proposé pour ce jeu.</p></div>
        <span class="game-step-count">1 DISPONIBLE</span>
      </section>
      <section class="game-overlay-composer-layout game-overlay-composer-layout--generator-only">
        ${renderGameInteractionOverlayCard(pack, unlocked)}
      </section>
      <footer class="game-step-footer">
        <div><strong>Générateur lié à ${escapeHtml(pack.name)}</strong><small>Enregistré uniquement pour ${escapeHtml(overlayProfileName())}.</small></div>
        <button class="button primary" data-action="game-step" data-value="launch" ${unlocked ? "" : "disabled"}>Continuer vers le démarrage →</button>
      </footer>
    </div>`;
  }
  const items = gameOverlayItemsFor(pack);
  const cards = items.map((item) =>
    renderOverlayCard(item, {
      allowed: unlocked && overlayUnlocked(item)
    })
  ).join("");
  const overlayContent = `<section class="game-overlay-composer-layout">
      ${renderGameInteractionOverlayCard(pack, unlocked)}
      <div class="overlay-catalog-grid game-overlay-card-grid">${cards}</div>
    </section>`;
  return `<div class="game-overlays-page">
    <section class="game-interaction-toolbar">
      <div><span>▱ OVERLAYS LIÉS</span><h3>Préparer les affichages du LIVE</h3><p>Téléchargez d’abord l’image des interactions, puis ajoutez les compteurs utiles comme sources navigateur. Le même générateur est utilisé par tous les jeux ShenPulse.</p></div>
      <span class="game-step-count">${items.length + 1} DISPONIBLES</span>
    </section>
    ${overlayContent}
    <footer class="game-step-footer">
      <div><strong>Configuration globale liée</strong><small>Enregistrée uniquement pour ${escapeHtml(overlayProfileName())}.</small></div>
      <button class="button primary" data-action="game-step" data-value="launch" ${unlocked ? "" : "disabled"}>Continuer vers le démarrage →</button>
    </footer>
  </div>`;
}

function renderGameOverlaysLegacy(pack, unlocked) {
  const items = gameOverlayItemsFor(pack);
  return `<div class="game-overlays-page">
    <section class="game-interaction-toolbar">
      <div><span>▱ OVERLAYS</span><h3>Habillez votre partie</h3><p>Choisissez les éléments à afficher, prévisualisez-les puis adaptez leur design en quelques clics.</p></div>
      <span class="game-step-count">${items.length} DISPONIBLES</span>
    </section>
    <section class="game-overlay-card-grid">
      ${items.map((item) => {
        const allowed = unlocked && overlayUnlocked(item);
        return `<article class="game-overlay-card ${allowed ? "" : "locked"}">
          <div class="game-overlay-card-preview">${overlayPreview(item)}</div>
          <div class="game-overlay-card-copy">
            <header><span>${escapeHtml(item.icon)}</span><div><small>${item.requiresPro ? "INCLUS AVEC PRO" : "INCLUS"}</small><h4>${escapeHtml(item.name)}</h4></div></header>
            <p>${escapeHtml(item.description)}</p>
            ${overlayDesignPicker(item)}
            <footer>
              <button class="button small" data-action="preview-overlay" data-id="${escapeHtml(item.key)}" ${allowed ? "" : "disabled"}>Aperçu</button>
              <button class="button small primary" data-action="configure-overlay" data-id="${escapeHtml(item.key)}" ${allowed ? "" : "disabled"}>Personnaliser</button>
              <button class="button small ghost" data-action="copy" data-value="${escapeHtml(overlayUrl(item))}" ${allowed ? "" : "disabled"}>Ajouter à mon LIVE</button>
            </footer>
          </div>
        </article>`;
      }).join("")}
    </section>
    <footer class="game-step-footer">
      <div><strong>Vos choix sont enregistrés</strong><small>Ils restent indépendants pour le profil actuellement sélectionné.</small></div>
      <button class="button primary" data-action="game-step" data-value="launch" ${unlocked ? "" : "disabled"}>Continuer vers le démarrage →</button>
    </footer>
  </div>`;
}

function gameOverlayItemsFor(pack) {
  const preferredKeys = pack.id === "gtav-montchiliad"
    ? ["winCounter", "multiplierTimer"]
    : MINECRAFT_MODE_IDS.includes(pack.id)
      ? ["timer", "multiplierTimer", "winCounter"]
      : pack.id === "cult-of-the-lamb"
        ? []
        : ["myActions", "timer", "multiplierTimer", "winCounter", "wheel"];
  const definitions = overlayDefinitions();
  return preferredKeys
    .map((key) => definitions.find((item) => item.key === key))
    .filter((item) => item && canAccessOverlay(item));
}

function gameInteractionOverlayBackground(packId) {
  const configured =
    snapshot.state.settings.overlayConfigs?.gameInteractionOverlays
      ?.[packId]?.backgroundColor ||
    (packId === "gtav-montchiliad"
      ? snapshot.state.settings.overlayConfigs?.gtavInteractionOverlay
        ?.backgroundColor
      : "");
  return /^#[0-9a-f]{6}$/i.test(String(configured || ""))
    ? configured
    : "#082b63";
}

function gtaInteractionOverlayBackground() {
  return gameInteractionOverlayBackground("gtav-montchiliad");
}

function gameOverlayTriggerType(rule) {
  if (!hasAutomaticTrigger(rule)) return "chat";
  const type = String(rule?.trigger?.type || "gift");
  if (type === "like") return "likes";
  if (type === "message") return "chat";
  if (type === "subscription") return "subscribe";
  if (
    [
      "gift",
      "likes",
      "chat",
      "follow",
      "share",
      "subscribe",
      "join",
      "raid"
    ].includes(type)
  ) {
    return type;
  }
  return "chat";
}

function gameInteractionOverlayEntries(pack) {
  const mappedEntries = gameMappedEffects(pack)
    .filter(
      (row) =>
        row.rule.enabled !== false &&
        (!GAME_OVERLAY_GENERATOR_ONLY_IDS.has(pack.id) ||
          gameOverlayTriggerType(row.rule) === "gift")
    )
    .map((row) => {
      const effect = pack.effects.find(
        (item) => item.id === row.action.config?.effectId
      );
      if (!effect || effect.available === false) return null;
      const giftCondition = ruleGiftCondition(row.rule);
      const giftName = giftCondition?.value || "";
      const gift = giftForIdentity(giftName, giftCondition?.giftId);
      const triggerType = gameOverlayTriggerType(row.rule);
      return {
        effectId: effect.id,
        isWinEffect: effect.actionType === "overlay.win-counter",
        title: row.rule.gameInteraction?.title || effect.name,
        trigger: triggerLabel(row.rule),
        triggerType,
        triggerKey:
          triggerType === "gift" && giftCondition?.giftId
            ? String(giftCondition.giftId)
            : giftName || triggerLabel(row.rule),
        likeAmount:
          triggerType === "likes"
            ? Math.max(1, Number(row.rule.trigger?.threshold || 1))
            : 0,
        groupKey: `${effect.id}:${JSON.stringify({
          amount: row.action.config?.amount,
          duration: row.action.config?.duration,
          operation: row.action.config?.operation,
          parameters: row.action.config?.parameters || {}
        })}`,
        effectImageUrl: effect.image || "",
        giftImageUrl:
          gift?.imageUrl || String(giftCondition?.giftImageUrl || ""),
        giftLabel: giftName || triggerLabel(row.rule)
      };
    })
    .filter(Boolean);
  if (pack.id !== "coin-pusher") return mappedEntries;

  const config = integratedGameSettings("coin-pusher");
  const giftEntries = config.giftRules
    .filter((rule) => rule.enabled !== false && (rule.name || rule.giftId))
    .map((rule) => ({
      effectId: `coin-pusher-gift-${rule.giftId || normalizeGiftName(rule.name)}`,
      isWinEffect: false,
      title: `${Math.max(1, Math.round(Number(rule.coinCount) || 1))} PIÈCE${Number(rule.coinCount) > 1 ? "S" : ""}`,
      trigger: rule.name || "Cadeau TikTok",
      triggerType: "gift",
      triggerKey: rule.name || rule.giftId,
      likeAmount: 0,
      groupKey: `coin-pusher-gift:${rule.giftId || normalizeGiftName(rule.name)}:${rule.coinCount}`,
      effectImageUrl: "",
      giftImageUrl: rule.image || giftForName(rule.name)?.imageUrl || "",
      giftLabel: rule.name || "Cadeau TikTok"
    }));
  const specialEntries = [
    config.guardGift?.name
      ? [config.guardGift, "BARRIÈRES", "coin-pusher-guards"]
      : null,
    config.mysteryCube?.enabled && config.mysteryCube?.name
      ? [config.mysteryCube, "DÉ MYSTÈRE", "coin-pusher-mystery"]
      : null,
    config.tickets?.enabled && config.tickets?.name
      ? [config.tickets, "TICKETS BONUS", "coin-pusher-tickets"]
      : null
  ]
    .filter(Boolean)
    .map(([gift, title, effectId]) => ({
      effectId,
      isWinEffect: false,
      title,
      trigger: gift.name,
      triggerType: "gift",
      triggerKey: gift.name,
      likeAmount: 0,
      groupKey: `${effectId}:${gift.giftId || normalizeGiftName(gift.name)}`,
      effectImageUrl: "",
      giftImageUrl: gift.image || giftForName(gift.name)?.imageUrl || "",
      giftLabel: gift.name
    }));
  const tierEntries = config.diamondCoinTiers.map((tier) => ({
    effectId: `coin-pusher-tier-${tier.diamonds}`,
    isWinEffect: false,
    title: `${Math.max(1, Math.round(Number(tier.coinCount) || 1))} PIÈCE${Number(tier.coinCount) > 1 ? "S" : ""}`,
    trigger: `${Math.max(1, Math.round(Number(tier.diamonds) || 1))} diamant${Number(tier.diamonds) > 1 ? "s" : ""}`,
    triggerType: "gift",
    triggerKey: `value:${tier.diamonds}`,
    likeAmount: 0,
    groupKey: `coin-pusher-tier:${tier.diamonds}:${tier.coinCount}`,
    effectImageUrl: "",
    giftImageUrl: "",
    giftLabel: `${tier.diamonds} diamants`
  }));
  return [
    ...giftEntries,
    ...specialEntries,
    ...tierEntries,
    ...mappedEntries
  ];
}

function gameOverlayEntryEffectIdentity(entry) {
  return String(
    entry?.groupKey || entry?.effectId || entry?.title || "interaction"
  ).toLowerCase();
}

function gameOverlayEntryActionLabels(entries) {
  return [...new Set(
    entries.map((entry) => String(entry?.title || "").trim()).filter(Boolean)
  )];
}

function groupGameOverlayEntriesByGift(entries) {
  const groupedEntries = entries.filter((entry) => !entry.isWinEffect);
  const parents = groupedEntries.map((_, index) => index);
  const find = (index) => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const join = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  const effectOwners = new Map();
  const triggerOwners = new Map();
  groupedEntries.forEach((entry, index) => {
    const effectIdentity = gameOverlayEntryEffectIdentity(entry);
    const triggerIdentity = gameOverlayEntryTriggerIdentity(entry);
    if (effectOwners.has(effectIdentity)) join(index, effectOwners.get(effectIdentity));
    if (triggerOwners.has(triggerIdentity)) join(index, triggerOwners.get(triggerIdentity));
    effectOwners.set(effectIdentity, index);
    triggerOwners.set(triggerIdentity, index);
  });

  const connectedGroups = new Map();
  groupedEntries.forEach((entry, index) => {
    const root = find(index);
    const group = connectedGroups.get(root) || [];
    group.push(entry);
    connectedGroups.set(root, group);
  });
  const records = [...connectedGroups.values()].map((group) => {
    const firstIndex = entries.indexOf(group[0]);
    const actionLabels = gameOverlayEntryActionLabels(group);
    const groupKey = `overlay-group-${firstIndex}`;
    const seenTriggers = new Set();
    const triggerEntries = group.filter((entry) => {
      const identity = gameOverlayEntryTriggerIdentity(entry);
      if (seenTriggers.has(identity)) return false;
      seenTriggers.add(identity);
      return true;
    });
    return {
      index: firstIndex,
      entries: triggerEntries.map((entry) => ({
        ...entry,
        actionLabels,
        groupKey,
        badgeLayout: triggerEntries.length > 1 ? "top-row" : "corners",
        effectImageUrl: group[0].effectImageUrl
      }))
    };
  });
  entries.forEach((entry, index) => {
    if (entry.isWinEffect) records.push({ index, entries: [entry] });
  });
  return records
    .sort((left, right) => left.index - right.index)
    .flatMap((record) => record.entries);
}

function gameOverlayRenderedCaseCount(entries) {
  const cases = new Set();
  entries.forEach((entry, index) => {
    cases.add(
      entry.isWinEffect
        ? `win:${index}`
        : gameOverlayEntryEffectIdentity(entry)
    );
  });
  return cases.size;
}

function gtaInteractionOverlayEntries(pack) {
  return gameInteractionOverlayEntries(pack);
}

function renderGameInteractionOverlayCard(pack, unlocked) {
  const entries = gameInteractionOverlayEntries(pack);
  const color = gameInteractionOverlayBackground(pack.id);
  const previewEntries = entries.slice(0, 6);
  return `<article class="gta-interaction-overlay-card game-interaction-overlay-card">
    <header>
      <span class="gta-overlay-download-icon">↓</span>
      <div><small>À TÉLÉCHARGER EN PREMIER</small><h3>Overlay des interactions ${escapeHtml(pack.name)}</h3></div>
      <span class="badge ${entries.length ? "success" : "warning"}">${entries.length} ACTIVE${entries.length > 1 ? "S" : ""}</span>
    </header>
    <p>Cette image reprend uniquement les interactions actives du profil ${escapeHtml(overlayProfileName())}. Elle reproduit les deux modèles historiques ShenazenOverlay : WINS sur les côtés, cadeaux et effets correctement regroupés dans le panneau inférieur.</p>
    <div class="gta-interaction-overlay-preview" style="--gta-overlay-background:${escapeHtml(color)}">
      ${previewEntries.length
        ? previewEntries.map((entry) => `<span><i>${entry.giftImageUrl ? `<img src="${escapeHtml(entry.giftImageUrl)}" alt="">` : "🎁"}</i><strong>${escapeHtml(entry.title)}</strong><small>${escapeHtml(entry.trigger)}</small></span>`).join("")
        : GAME_OVERLAY_GENERATOR_ONLY_IDS.has(pack.id)
          ? `<em>Activez au moins une interaction déclenchée par un cadeau pour générer l’overlay ${escapeHtml(pack.name)}.</em>`
          : "<em>Activez au moins une interaction GTA pour générer le fond.</em>"}
    </div>
    <div class="gta-overlay-instructions">
      <span><b>1</b>Téléchargez l’image après avoir réglé vos interactions.</span>
      <span><b>2</b>Ajoutez-la comme source image dans votre logiciel de LIVE.</span>
      <span><b>3</b>Conservez sa taille 1080 × 1920 et placez-la au-dessus du jeu.</span>
    </div>
    <div class="gta-overlay-background-picker">
      <span><strong>Fond du modèle 1</strong><small>Choisissez la couleur qui remplacera le noir derrière le jeu. Le modèle 2 conserve son panneau bleu historique.</small></span>
      <div>${GTA_INTERACTION_OVERLAY_BACKGROUNDS.map(([value, label]) =>
        `<button type="button" class="${color.toLowerCase() === value ? "active" : ""}" style="--swatch:${value}" data-action="set-game-overlay-background" data-id="${escapeHtml(pack.id)}" data-value="${value}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${color.toLowerCase() === value ? "✓" : ""}</button>`
      ).join("")}<label style="--swatch:${escapeHtml(color)}" title="Couleur personnalisée"><span>◈</span><input type="color" value="${escapeHtml(color)}" data-action="set-game-overlay-background" data-id="${escapeHtml(pack.id)}" aria-label="Couleur personnalisée"></label></div>
    </div>
    <footer>
      <button class="button primary" data-action="download-game-interaction-overlay" data-id="${escapeHtml(pack.id)}" data-model="1" ${unlocked && entries.length ? "" : "disabled"}>↓ Télécharger le modèle 1</button>
      <button class="button" data-action="download-game-interaction-overlay" data-id="${escapeHtml(pack.id)}" data-model="2" ${unlocked && entries.length ? "" : "disabled"}>↓ Télécharger le modèle 2</button>
    </footer>
    <small class="gta-overlay-refresh-note">Après chaque modification des interactions, téléchargez de nouveau l’image pour garder les cadeaux et les intitulés à jour.</small>
  </article>`;
}

async function saveGameInteractionOverlayBackground(packId, value) {
  const color = /^#[0-9a-f]{6}$/i.test(String(value || ""))
    ? String(value)
    : "#082b63";
  acceptSnapshot(await api.saveSettings({
    ...snapshot.state.settings,
    overlayConfigs: {
      ...(snapshot.state.settings.overlayConfigs || {}),
      gameInteractionOverlays: {
        ...(snapshot.state.settings.overlayConfigs?.gameInteractionOverlays || {}),
        [packId]: {
          ...(snapshot.state.settings.overlayConfigs?.gameInteractionOverlays
            ?.[packId] || {}),
          backgroundColor: color
        }
      }
    }
  }));
  render();
}
