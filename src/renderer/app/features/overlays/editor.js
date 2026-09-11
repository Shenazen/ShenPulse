"use strict";

/**
 * Éditeurs et page principale des overlays.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function openWheelOverlayConfig(item, rawConfig = null) {
  if (!wheelEditorContext || wheelEditorContext.item.key !== item.key || rawConfig) {
    wheelEditorContext = {
      item,
      config: normalizeWheelConfig(rawConfig || overlayConfig(item.key)),
      section: "setup"
    };
  }
  const config = wheelEditorContext.config;
  const wheel = config.wheels.find((entry) => entry.id === config.selectedWheelId)
    || config.wheels[0];
  config.selectedWheelId = wheel.id;
  const settings = wheel.settings;
  const wheelTriggerText = wheelTriggerSummary(wheel);
  const activeSection = ["setup", "segments", "appearance", "playback"].includes(
    wheelEditorContext.section
  )
    ? wheelEditorContext.section
    : "setup";
  const wheelTabs = config.wheels.map((entry) =>
    `<button type="button" class="${entry.id === wheel.id ? "active" : ""}" data-wheel-command="select" data-wheel-id="${escapeHtml(entry.id)}">
      <span class="wheel-list-dot ${entry.enabled ? "enabled" : ""}"></span>
      <span><strong>${escapeHtml(entry.name)}</strong><small>${entry.segments.length} segments · ${entry.design === "royal" ? "Royal" : "Classique"}</small></span>
    </button>`
  ).join("");
  openEditor({
    title: "Configurer la roue d’actions",
    kicker: "OVERLAY OBS · ROUES & SEGMENTS",
    variant: "overlay-live",
    body: `<div class="wheel-config-editor" data-overlay-config-editor="${escapeHtml(item.key)}">
      <aside class="wheel-config-sidebar">
        <div class="wheel-sidebar-intro"><span>COLLECTION</span><strong>Mes roues</strong><small>Choisissez la roue à modifier.</small></div>
        <div class="wheel-config-list">${wheelTabs}</div>
        <button type="button" class="wheel-add-button" data-wheel-command="add">＋ Créer une roue</button>
        <button type="button" class="wheel-delete-button" data-wheel-command="delete" ${config.wheels.length <= 1 ? "disabled" : ""}>Supprimer cette roue</button>
      </aside>
      <div class="wheel-config-main">
        <section class="wheel-config-identity">
          <div>
            <span class="game-step-kicker">ROUE SÉLECTIONNÉE</span>
            <h3>${escapeHtml(wheel.name)}</h3>
            <p>${wheel.segments.length} secteurs · ${escapeHtml(wheelTriggerText)}</p>
          </div>
          <div class="wheel-live-toggle">
            ${fieldLabelWithInfo("État", OVERLAY_FIELD_HELP.wheelEnabled)}
            <select name="wheelEnabled"><option value="true" ${wheel.enabled ? "selected" : ""}>Active</option><option value="false" ${!wheel.enabled ? "selected" : ""}>Désactivée</option></select>
          </div>
        </section>
        <nav class="wheel-editor-steps" aria-label="Étapes de configuration">
          <button type="button" class="${activeSection === "setup" ? "active" : ""}" data-wheel-command="section" data-wheel-section="setup"><b>1</b><span><strong>Configuration</strong><small>Nom, design et cadeau</small></span></button>
          <button type="button" class="${activeSection === "segments" ? "active" : ""}" data-wheel-command="section" data-wheel-section="segments"><b>2</b><span><strong>Secteurs</strong><small>Résultats et actions</small></span></button>
          <button type="button" class="${activeSection === "appearance" ? "active" : ""}" data-wheel-command="section" data-wheel-section="appearance"><b>3</b><span><strong>Apparence</strong><small>Texte et rendu</small></span></button>
          <button type="button" class="${activeSection === "playback" ? "active" : ""}" data-wheel-command="section" data-wheel-section="playback"><b>4</b><span><strong>Diffusion</strong><small>Animation et résultat</small></span></button>
        </nav>
        <div class="wheel-editor-workspace">
          <div class="wheel-editor-panels">
            <section class="wheel-editor-panel" data-wheel-section-panel="setup" ${activeSection === "setup" ? "" : "hidden"}>
              <header class="wheel-panel-heading"><span>ÉTAPE 1</span><h3>Configurer l’essentiel</h3><p>Donnez un nom clair à la roue, choisissez son style puis décidez comment elle sera déclenchée.</p></header>
              <div class="wheel-settings-card form-grid">
                ${overlayField("wheelName", "Nom de la roue", wheel.name, "text", "required full")}
                ${giftTriggerConditionFields(wheelGiftValueConditions(wheel), {
                  giftName: "wheelTrigger",
                  giftLabel: "Cadeau TikTok",
                  giftValue: wheel.trigger,
                  giftId: wheel.triggerGift?.giftId || "",
                  modeName: "wheelGiftTriggerMode",
                  operatorName: "wheelGiftValueOperator",
                  amountName: "wheelGiftValueAmount"
                })}
                <div class="wheel-inline-note full"><strong>Déclenchement flexible</strong><span>Configurez une méthode, ou laissez son champ vide pour conserver un lancement manuel.</span></div>
              </div>
              <div class="wheel-settings-card">
                <header><div><h4>Design de la roue</h4><p>L’aperçu réel à droite se met à jour dès votre choix.</p></div></header>
                <div class="wheel-design-options">
                  ${wheelDesignOption("classic", "Orange Classique", "Énergique et lisible pour les actions LIVE.", wheel.design)}
                  ${wheelDesignOption("royal", "Royale Prestige", "Ornements dorés pour les défis et événements.", wheel.design)}
                </div>
              </div>
            </section>
            <section class="wheel-editor-panel" data-wheel-section-panel="segments" ${activeSection === "segments" ? "" : "hidden"}>
              <header class="wheel-panel-heading wheel-panel-heading-with-action"><div><span>ÉTAPE 2</span><h3>Définir les secteurs</h3><p>Chaque secteur affiche un résultat et peut lancer une action ShenPulse.</p></div><button type="button" class="button secondary" data-wheel-command="segment-add">＋ Ajouter un secteur</button></header>
              <div class="wheel-segment-help"><span>${wheel.segments.length}</span><div><strong>secteurs configurés</strong><small>Utilisez les flèches pour définir leur ordre sur la roue.</small></div></div>
              <div class="wheel-segment-list">${wheel.segments.map((segment, index) => wheelSegmentEditor(segment, index, wheel.segments.length)).join("")}</div>
            </section>
            <section class="wheel-editor-panel" data-wheel-section-panel="appearance" ${activeSection === "appearance" ? "" : "hidden"}>
              <header class="wheel-panel-heading"><span>ÉTAPE 3</span><h3>Régler l’apparence</h3><p>Commencez par la lisibilité. Les ajustements fins restent disponibles dans les options avancées.</p></header>
              <div class="wheel-settings-card">
                <header><div><h4>Texte des secteurs</h4><p>Les réglages les plus utiles au quotidien.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlaySelect("font", "Police", settings.font, [["Kalam", "Kalam"], ["Inter", "Inter"], ["Impact", "Impact"], ["Arial Rounded", "Arial Rounded"], ["System", "Système"]])}
                  ${overlayField("fontSize", "Taille", settings.fontSize, "number", 'min="10" max="120"')}
                  ${overlayField("textColor", "Couleur", settings.textColor, "color")}
                  ${overlaySelect("textOrientation", "Orientation", settings.textOrientation, [["horizontal", "Horizontale"], ["vertical", "Verticale"]])}
                  ${overlaySelect("textAlign", "Alignement", settings.textAlign, [["left", "Gauche"], ["center", "Centre"], ["right", "Droite"]])}
                  ${overlaySelect("textClamp", "Limiter le texte", String(settings.textClamp), [["true", "Oui"], ["false", "Non"]])}
                </div>
              </div>
              <div class="wheel-settings-card">
                <header><div><h4>Rendu de la roue</h4><p>Taille, lumière et éléments décoratifs.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlayField("scale", "Échelle globale (%)", settings.scale, "number", 'min="50" max="180"')}
                  ${overlayField("glow", "Intensité lumineuse", settings.glow, "number", 'min="0" max="140"')}
                  ${overlaySelect("showBase", "Afficher le socle", String(settings.showBase), [["true", "Oui"], ["false", "Non"]])}
                  ${overlaySelect("pointerPosition", "Position du pointeur", settings.pointerPosition, [["top", "En haut"], ["right", "À droite"], ["bottom", "En bas"], ["left", "À gauche"]])}
                </div>
              </div>
              <details class="wheel-settings-card wheel-advanced-settings">
                <summary><span><strong>Réglages typographiques avancés</strong><small>Ombre, placement et dimensions du texte.</small></span><b>Afficher</b></summary>
                <div class="form-grid wheel-form-grid-3">
                  ${overlayField("textShadowColor", "Couleur de l’ombre", settings.textShadowColor, "color")}
                  ${overlayField("textShadowStrength", "Force de l’ombre", settings.textShadowStrength, "number", 'min="0" max="100"')}
                  ${overlayField("textRadius", "Rayon du texte (%)", settings.textRadius, "number", 'min="20" max="135"')}
                  ${overlayField("textSegmentOffset", "Décalage dans le secteur", settings.textSegmentOffset, "number", 'min="-100" max="100"')}
                  ${overlayField("textBoxWidth", "Largeur du texte", settings.textBoxWidth, "number", 'min="45" max="260"')}
                  ${overlayField("textBoxHeight", "Hauteur du texte", settings.textBoxHeight, "number", 'min="50" max="320"')}
                  ${overlayField("textAngleOffset", "Correction d’angle", settings.textAngleOffset, "number", 'min="-180" max="180"')}
                  ${overlayField("textMaxLines", "Nombre de lignes", settings.textMaxLines, "number", 'min="1" max="4"')}
                  ${overlayField("lineSpacing", "Interligne (%)", settings.lineSpacing, "number", 'min="0" max="100"')}
                  ${overlayField("letterSpacing", "Espacement lettres (%)", settings.letterSpacing, "number", 'min="0" max="100"')}
                </div>
              </details>
            </section>
            <section class="wheel-editor-panel" data-wheel-section-panel="playback" ${activeSection === "playback" ? "" : "hidden"}>
              <header class="wheel-panel-heading"><span>ÉTAPE 4</span><h3>Préparer la diffusion</h3><p>Contrôlez la durée de la rotation, le son et ce que les spectateurs voient avant et après le résultat.</p></header>
              <div class="wheel-settings-card">
                <header><div><h4>Rotation et son</h4><p>La rotation commence toujours immédiatement.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlaySelect("soundActive", "Son de rotation", String(settings.soundActive), [["true", "Activé"], ["false", "Désactivé"]])}
                  ${overlayField("spinDuration", "Durée de rotation (s)", settings.spinDuration, "number", 'min="1" max="30" step="0.1"')}
                  ${overlayField("waitDuration", "Pause avant résultat (s)", settings.waitDuration, "number", 'min="0" max="15" step="0.1"')}
                </div>
              </div>
              <div class="wheel-settings-card">
                <header><div><h4>Affichage et résultat</h4><p>Choisissez quand la roue apparaît et combien de temps le résultat reste visible.</p></div></header>
                <div class="form-grid wheel-form-grid-3">
                  ${overlaySelect("showWinner", "Afficher le résultat", String(settings.showWinner), [["true", "Oui"], ["false", "Non"]])}
                  ${overlayField("resultDuration", "Durée du résultat (s)", settings.resultDuration, "number", 'min="1" max="30" step="0.1"')}
                  ${overlaySelect("alwaysVisible", "Visible au repos", String(settings.alwaysVisible), [["true", "Oui"], ["false", "Seulement pendant l’action"]])}
                  ${overlaySelect("entranceAnimation", "Animation d’entrée", settings.entranceAnimation, [["zoom", "Zoom"], ["fade", "Fondu"], ["slide", "Glissement"], ["none", "Aucune"]])}
                  ${overlaySelect("exitAnimation", "Animation de sortie", settings.exitAnimation, [["fade", "Fondu"], ["zoom", "Zoom"], ["slide", "Glissement"], ["none", "Aucune"]])}
                </div>
              </div>
            </section>
          </div>
          <aside class="wheel-preview-column">
            ${overlayLivePreview(item, config, { compact: true })}
            <div class="wheel-preview-summary">
              <span><small>Secteurs</small><strong>${wheel.segments.length}</strong></span>
              <span><small>Design</small><strong>${wheel.design === "royal" ? "Royal" : "Classique"}</strong></span>
              <span><small>Déclencheur</small><strong>${escapeHtml(wheelTriggerText)}</strong></span>
            </div>
            <div class="overlay-config-source"><span>Source HTTPS · 800 × 900</span><code>${escapeHtml(overlayUrl(item))}</code><small>OBS local</small><code>${escapeHtml(localOverlayUrl(item))}</code></div>
          </aside>
        </div>
      </div>
    </div>`,
    onSubmit: async () => {
      collectWheelEditorForm();
      const next = wheelEditorContext.config;
      const selected = next.wheels.find((entry) => entry.id === next.selectedWheelId) || next.wheels[0];
      if (selected.segments.length < 2) {
        throw new Error("La roue doit contenir au moins deux segments.");
      }
      next.title = selected.name;
      next.design = selected.design;
      next.choices = selected.segments.map((segment) => segment.label);
      next.colors = selected.segments.map((segment) => segment.color);
      Object.assign(next, selected.settings);
      overlayDesignSelections[item.key] = selected.design;
      await saveOverlayConfig(item.key, next, { rerender: false });
      wheelEditorContext = null;
    }
  });
  syncWheelSegmentActionVisibility();
}

function overlayDraftConfig(item, baseConfig, data = new FormData(dialogForm)) {
  const next = { ...baseConfig };
  const stringKeys = [
    "title",
    "theme",
    "model",
    "design",
    "variant",
    "fit",
    "font",
    "layout",
    "animation",
    "progressLabel",
    "whenReached",
    "completionActionId",
    "incrementShortcut",
    "decrementShortcut",
    "resetShortcut",
    "accentColor",
    "secondaryColor",
    "textColor",
    "backgroundColor",
    "shadowColor",
    "nameColor",
    "scoreColor",
    "rankColor",
    "winCounterLabelColorNegative",
    "winCounterLabelColorNeutral",
    "winCounterLabelColorPositive",
    "likeGoalTitleColor",
    "likeGoalContentColor",
    "likeGoalPercentColor"
  ];
  const numberKeys = [
    "scale",
    "xOffset",
    "yOffset",
    "backgroundOpacity",
    "fontSize",
    "displayTime",
    "pauseTime",
    "soundVolume",
    "saturation",
    "hue",
    "current",
    "target",
    "goalBaseline",
    "likeGoalTitleOffsetX",
    "likeGoalTitleOffsetY",
    "likeGoalTitleScale",
    "likeGoalContentOffsetX",
    "likeGoalContentOffsetY",
    "likeGoalContentScale",
    "seconds",
    "timerTitleScale",
    "timerValueScale",
    "multiplier",
    "maxRows",
    "minCoins",
    "winCounterLabelOffsetX",
    "winCounterLabelOffsetY",
    "rowOpacity"
  ];
  const booleanKeys = [
    "enabled",
    "showHeader",
    "showGoal",
    "showPercent",
    "showRank",
    "showAvatars",
    "showCrown",
    "showRankBadges",
    "showMetricLabel",
    "showBase",
    "showHours",
    "showShadow",
    "showWhenIdle",
    "soundEnabled",
    "rtl",
    "timerAutoStart",
    "allowNegative",
    "autoplay",
    "loop"
  ];
  for (const key of stringKeys) {
    if (data.has(key)) next[key] = String(data.get(key) || "");
  }
  for (const key of numberKeys) {
    if (data.has(key)) next[key] = Number(data.get(key) || 0);
  }
  for (const key of booleanKeys) {
    if (data.has(key)) next[key] = data.get(key) === "true";
  }
  if (["timer", "multiplierTimer"].includes(item.key)) next.seconds = timerDurationTotalSeconds(data, next.seconds);
  return next;
}

function overlayLivePreview(item, config, { compact = false } = {}) {
  const size = overlaySourceSize(item);
  const sourceAvailable = Boolean(item.url);
  return `<aside class="overlay-live-preview-panel ${compact ? "compact" : ""}">
    <header>
      <div><span>APERÇU LIVE RÉEL</span><strong>${escapeHtml(item.name)}</strong></div>
      <b>${size.label}</b>
    </header>
    ${overlayRuntimeFrame(item, config, {
      context: "live",
      editable: true,
      loading: "eager"
    })}
    <p>${sourceAvailable
      ? "Le rendu ci-dessus est la vraie source locale. Chaque modification du formulaire y apparaît avant l’enregistrement."
      : "Aperçu local complet de l’overlay Pro. Tous les réglages et designs restent testables ; seule l’URL OBS demeure protégée."}</p>
    <div class="overlay-live-preview-actions">
      <button type="button" class="button primary" data-overlay-preview-test="${escapeHtml(item.key)}">▶ Relancer le test</button>
      ${sourceAvailable
        ? `<button type="button" class="button ghost" data-action="copy" data-value="${escapeHtml(overlayUrl(item, config))}">Copier la source OBS</button>`
        : `<span class="badge warning">URL OBS disponible avec Pro</span>`}
    </div>
  </aside>`;
}

function scheduleOverlayLivePreview() {
  clearTimeout(overlayPreviewRefreshTimer);
  overlayPreviewRefreshTimer = setTimeout(() => {
    const editor = dialogBody.querySelector("[data-overlay-config-editor]");
    const frame = dialogBody.querySelector("[data-overlay-live-preview]");
    if (!editor || !frame) return;
    const item = overlayDefinitions().find(
      (entry) => entry.key === editor.dataset.overlayConfigEditor
    );
    if (!item) return;
    let draft;
    if (item.key === "wheel" && wheelEditorContext) {
      collectWheelEditorForm();
      const selectedWheel = wheelEditorContext.config.wheels.find(
        (entry) => entry.id === wheelEditorContext.config.selectedWheelId
      ) || wheelEditorContext.config.wheels[0];
      draft = {
        ...wheelEditorContext.config,
        title: selectedWheel?.name || wheelEditorContext.config.title
      };
    } else {
      draft = overlayDraftConfig(item, overlayConfig(item.key));
    }
    // Les huit cartes Match partagent une seule URL de diffusion `match=player`,
    // mais chacune possède sa propre source d'aperçu. Le message live doit être
    // construit depuis cette source précise, sinon aucun de leurs champs n'est
    // transmis au lecteur affiché dans l'éditeur.
    const previewUrl = overlayCatalogPreviewUrl(item);
    const previewItem = previewUrl ? { ...item, url: previewUrl } : item;
    const runtimeUrl = overlayUrl(previewItem, draft);
    let payload = {};
    try {
      payload = Object.fromEntries(new URL(runtimeUrl).searchParams.entries());
    } catch {
      return;
    }
    const message = {
      source: "shenpulse-overlay-card",
      channel: "configuration",
      payload
    };
    const send = () => {
      try {
        frame.contentWindow?.postMessage(message, new URL(frame.src).origin);
      } catch {
        // The dialog may close while the debounced preview is being updated.
      }
    };
    send();
    if (!frame.dataset.overlayPreviewReady) {
      frame.addEventListener("load", send, { once: true });
    }
    const copyButton = dialogBody.querySelector(
      ".overlay-live-preview-actions [data-action='copy']"
    );
    if (copyButton) copyButton.dataset.value = overlayUrl(item, draft);
  }, 45);
}

function overlayEditorTab(key, label, description, active = false) {
  return `<button
    type="button"
    role="tab"
    class="${active ? "active" : ""}"
    data-overlay-editor-tab="${escapeHtml(key)}"
    aria-selected="${active ? "true" : "false"}"
    aria-controls="overlay-editor-panel-${escapeHtml(key)}"
  ><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></button>`;
}

function overlayEditorPanel(key, content, active = false) {
  return `<div
    id="overlay-editor-panel-${escapeHtml(key)}"
    class="overlay-editor-panel"
    role="tabpanel"
    data-overlay-editor-panel="${escapeHtml(key)}"
    ${active ? "" : "hidden"}
  >${content}</div>`;
}

function openOverlayConfig(item) {
  if (!item) throw new Error("Overlay introuvable.");
  if (item.key === "wheel") {
    wheelEditorContext = null;
    return openWheelOverlayConfig(item, overlayConfig(item.key));
  }
  const config = overlayConfig(item.key);
  const titledOverlays = [
    "myActions",
    "likeGoal",
    "topDonors",
    "topTappers",
    "timer",
    "multiplierTimer",
    "winCounter"
  ];
  const typographyOverlays = titledOverlays;
  const placement = `${overlaySelect("enabled", "Overlay actif", String(config.enabled !== false), [["true", "Oui"], ["false", "Non"]], true)}
    ${overlayField("scale", "Échelle globale (%)", config.scale ?? 100, "number", 'min="50" max="180"')}
    ${overlayField("xOffset", "Position horizontale (px)", config.xOffset ?? 0, "number", 'min="-1000" max="1000"')}
    ${overlayField("yOffset", "Position verticale (px)", config.yOffset ?? 0, "number", 'min="-1000" max="1000"')}`;

  let specialized = "";
  if (item.parameter === "theme") {
    specialized += overlaySelect("theme", "Thème", config.theme || item.defaultOption, item.options, true);
  }
  if (item.parameter === "model") {
    specialized += overlaySelect("model", "Modèle du bocal", config.model || item.defaultOption, item.options, true);
  }
  if (item.parameter === "variant") {
    specialized += overlaySelect("variant", "Vidéo", config.variant || item.defaultOption, item.options, true);
  }
  if (titledOverlays.includes(item.key)) {
    specialized += overlayField("title", "Titre affiché", config.title || item.name, "text", "full");
  }
  if (["likeGoal", "coinJar", "winCounter"].includes(item.key)) {
    specialized += `${overlayField("current", "Valeur de départ hors session", config.current ?? 0, "number", 'min="-999999" max="999999"')}
      ${overlayField("target", "Objectif", config.target ?? 1000, "number", 'min="1" max="999999"')}`;
  }
  if (item.key === "likeGoal") {
    specialized += `${overlayField("goalBaseline", "Départ de la progression", config.goalBaseline ?? 0, "number")}
      ${overlayField("progressLabel", "Unité / libellé de progression", config.progressLabel || "likes", "text")}
      ${overlaySelect("whenReached", "Lorsque l’objectif est atteint", config.whenReached || "increase", [["keep", "Conserver l’objectif"], ["increase", "Augmenter l’objectif"], ["double", "Doubler l’objectif"], ["hide", "Masquer le Like Goal"]])}
      ${overlayActionSelect("completionActionId", "Action à lancer lorsque l’objectif est atteint", config.completionActionId)}
      ${overlaySelect("showPercent", "Afficher le pourcentage", String(config.showPercent !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlayField("likeGoalTitleOffsetX", "Décalage horizontal du titre (px)", config.likeGoalTitleOffsetX ?? 0, "number", 'min="-500" max="500"')}
      ${overlayField("likeGoalTitleOffsetY", "Décalage vertical du titre (px)", config.likeGoalTitleOffsetY ?? 0, "number", 'min="-500" max="500"')}
      ${overlayField("likeGoalTitleScale", "Taille du titre (%)", config.likeGoalTitleScale ?? 100, "number", 'min="50" max="200"')}
      ${overlayField("likeGoalContentOffsetX", "Décalage horizontal du texte central (px)", config.likeGoalContentOffsetX ?? 0, "number", 'min="-500" max="500"')}
      ${overlayField("likeGoalContentOffsetY", "Décalage vertical du texte central (px)", config.likeGoalContentOffsetY ?? 0, "number", 'min="-500" max="500"')}
      ${overlayField("likeGoalContentScale", "Taille du texte central (%)", config.likeGoalContentScale ?? 100, "number", 'min="50" max="200"')}`;
  }
  if (item.key === "coinJar") {
    specialized += `${overlayField("minCoins", "Minimum de pièces conservé", config.minCoins ?? 0, "number", 'min="0"')}
      ${overlaySelect("showBase", "Afficher le niveau de remplissage", String(config.showBase !== false), [["true", "Oui"], ["false", "Non"]], false, "Affiche ou masque la jauge lumineuse située derrière les cadeaux dans le bocal.")}`;
  }
  if (["timer", "multiplierTimer"].includes(item.key)) {
    specialized += `${overlayTimerDurationFields(config.seconds ?? 300)}
      ${overlaySelect("timerAutoStart", "Démarrage automatique", String(config.timerAutoStart === true), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showHours", "Afficher les heures", String(config.showHours !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlayField("timerTitleScale", "Taille du titre (%)", config.timerTitleScale ?? 100, "number", 'min="50" max="200"')}
      ${overlayField("timerValueScale", "Taille du texte du timer (%)", config.timerValueScale ?? 100, "number", 'min="50" max="200"')}`;
  }
  if (item.key === "timer") {
    specialized += overlayActionSelect(
      "completionActionId",
      "Action à lancer lorsque le timer arrive à zéro",
      config.completionActionId
    );
  }
  if (item.key === "multiplierTimer") {
    specialized += overlayField("multiplier", "Multiplicateur", config.multiplier ?? 2, "number", 'min="2" max="5"');
  }
  if (item.key === "myActions") {
    specialized += overlayField("maxRows", "Nombre de lignes", config.maxRows ?? 5, "number", 'min="1" max="12"');
  }
  if (["topDonors", "topTappers"].includes(item.key)) {
    specialized += `${overlayField("maxRows", "Nombre de places", Math.min(5, config.maxRows ?? 5), "number", 'min="1" max="5"')}
      ${overlaySelect("showRank", "Afficher le rang", String(config.showRank !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showAvatars", "Afficher les photos de profil", String(config.showAvatars !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showRankBadges", "Afficher les médailles et cadres", String(config.showRankBadges !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showCrown", "Couronne sur la première place", String(config.showCrown !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("showMetricLabel", "Afficher les scores", String(config.showMetricLabel !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlayField("nameColor", "Couleur des noms", config.nameColor || "#ffffff", "color")}
      ${overlayField("scoreColor", "Couleur des scores", config.scoreColor || "#ffe575", "color")}
      ${overlayField("rankColor", "Couleur des rangs", config.rankColor || "#ffe575", "color")}
      ${overlayField("rowOpacity", "Opacité du fond des lignes (%)", config.rowOpacity ?? 68, "number", 'min="0" max="100"')}`;
  }
  if (item.key === "winCounter") {
    specialized += `${overlaySelect("allowNegative", "Autoriser les valeurs négatives", String(config.allowNegative !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlayField("winCounterLabelColorNegative", "Couleur si négatif", config.winCounterLabelColorNegative || "#ff4f6d", "color")}
      ${overlayField("winCounterLabelColorNeutral", "Couleur à zéro", config.winCounterLabelColorNeutral || "#f8fafc", "color")}
      ${overlayField("winCounterLabelColorPositive", "Couleur si positif", config.winCounterLabelColorPositive || "#31ff74", "color")}
      ${overlayField("winCounterLabelOffsetX", "Position du libellé X", config.winCounterLabelOffsetX ?? 0, "number", 'min="-500" max="500"')}
      ${overlayField("winCounterLabelOffsetY", "Position du libellé Y", config.winCounterLabelOffsetY ?? 0, "number", 'min="-500" max="500"')}`;
  }
  if (item.previewKind === "match") {
    specialized += `${overlaySelect("fit", "Ajustement dans la source 1080 × 1920", config.fit || "contain", [["contain", "Vidéo entière"], ["cover", "Remplir la source"]], true)}
      ${overlaySelect("autoplay", "Lecture automatique", String(config.autoplay !== false), [["true", "Oui"], ["false", "Non"]])}
      ${overlaySelect("loop", "Lecture en boucle", String(config.loop !== false), [["true", "Oui"], ["false", "Non"]])}`;
  }

  const visibility = `${titledOverlays.includes(item.key) ? overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), [["true", "Oui"], ["false", "Non"]]) : ""}
    ${["likeGoal", "coinJar", "winCounter"].includes(item.key) ? overlaySelect("showGoal", "Afficher l’objectif", String(config.showGoal !== false), [["true", "Oui"], ["false", "Non"]]) : ""}
    ${overlaySelect("showWhenIdle", "Visible au repos", String(config.showWhenIdle !== false), [["true", "Oui"], ["false", "Non"]])}
    ${overlaySelect("showShadow", "Afficher l’ombre", String(config.showShadow !== false), [["true", "Oui"], ["false", "Non"]])}
    ${typographyOverlays.includes(item.key) ? overlaySelect("rtl", "Sens de lecture", String(config.rtl === true), [["false", "Gauche vers droite"], ["true", "Droite vers gauche"]]) : ""}`;

  const appearance = `${typographyOverlays.includes(item.key) ? `${overlaySelect("font", "Police", config.font || "Inter", [["Inter", "Inter"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Verdana", "Verdana"]])}
    ${["timer", "multiplierTimer"].includes(item.key) ? "" : overlayField("fontSize", "Taille du texte (%)", config.fontSize ?? 100, "number", 'min="50" max="200"')}
    ${item.key === "likeGoal"
      ? `${overlayField("likeGoalTitleColor", "Couleur du titre", config.likeGoalTitleColor || config.textColor || "#ffffff", "color")}
        ${overlayField("likeGoalContentColor", "Couleur du texte central", config.likeGoalContentColor || config.textColor || "#ffffff", "color")}
        ${overlayField("likeGoalPercentColor", "Couleur du pourcentage", config.likeGoalPercentColor || config.secondaryColor || "#ff4f86", "color")}`
      : overlayField("textColor", "Couleur générale du texte", config.textColor || "#ffffff", "color")}` : ""}
    ${["myActions", "timer", "multiplierTimer"].includes(item.key) ? overlayField("accentColor", "Couleur principale", config.accentColor || "#22d3ee", "color") : ""}
    ${item.key === "myActions" ? `${overlayField("backgroundColor", "Couleur du panneau", config.backgroundColor || "#111315", "color")}
      ${overlayField("backgroundOpacity", "Opacité du panneau (%)", config.backgroundOpacity ?? 82, "number", 'min="0" max="100"')}` : ""}
    ${overlayField("saturation", "Saturation du rendu (%)", config.saturation ?? 100, "number", 'min="0" max="200"')}
    ${overlayField("hue", "Décalage de teinte (°)", config.hue ?? 0, "number", 'min="-180" max="180"')}`;

  const shortcuts = ["timer", "winCounter"].includes(item.key)
    ? `${overlayField("incrementShortcut", item.key === "timer" ? "Raccourci : ajouter 60 secondes" : "Raccourci : ajouter 1 win", config.incrementShortcut || "Alt+W, Alt+ArrowUp", "text", "full")}
       ${overlayField("decrementShortcut", item.key === "timer" ? "Raccourci : retirer 60 secondes" : "Raccourci : retirer 1 win", config.decrementShortcut || "Alt+S, Alt+ArrowDown", "text", "full")}
       ${overlayField("resetShortcut", "Raccourci de réinitialisation", config.resetShortcut || "Alt+R, Alt+0", "text", "full")}`
    : "";

  const activePanel = "content";
  const panels = {
    placement: dialogSection(
      "Activation & placement",
      "La source OBS conserve ses dimensions ; seul le rendu intérieur est déplacé ou redimensionné.",
      placement,
      "dialog-section-accent"
    ),
    content: dialogSection(
      "Contenu & design",
      "Réglages propres à cet overlay et à son design sélectionné.",
      specialized || `<div class="field full"><small>Aucun réglage spécifique supplémentaire.</small></div>`
    ),
    appearance: dialogSection(
      "Lisibilité & couleurs",
      "Les couleurs et corrections sont appliquées directement au rendu réel.",
      appearance
    ),
    visibility: `${dialogSection(
      "Éléments visibles",
      "Chaque option masque ou affiche uniquement l’élément indiqué.",
      visibility
    )}${shortcuts ? `<details class="dialog-advanced"><summary>Raccourcis rapides</summary><div class="form-grid">${shortcuts}</div></details>` : ""}`
  };

  openEditor({
    title: `Configurer ${item.name}`,
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-live",
    body: `<div class="overlay-config-live-layout" data-overlay-config-editor="${escapeHtml(item.key)}">
      <div class="overlay-config-fields">
        <nav class="overlay-editor-tabs" role="tablist" aria-label="Catégories de réglages">
          ${overlayEditorTab("placement", "Général", "Activation et position", activePanel === "placement")}
          ${overlayEditorTab("content", "Contenu", "Valeurs et design", activePanel === "content")}
          ${overlayEditorTab("appearance", "Apparence", "Texte et couleurs", activePanel === "appearance")}
          ${overlayEditorTab("visibility", "Affichage", "Visibilité et raccourcis", activePanel === "visibility")}
        </nav>
        <div class="overlay-editor-panels">
          ${overlayEditorPanel("placement", panels.placement, activePanel === "placement")}
          ${overlayEditorPanel("content", panels.content, activePanel === "content")}
          ${overlayEditorPanel("appearance", panels.appearance, activePanel === "appearance")}
          ${overlayEditorPanel("visibility", panels.visibility, activePanel === "visibility")}
        </div>
      </div>
      ${overlayLivePreview(item, config)}
    </div>`,
    onSubmit: async (data) => {
      const next = overlayDraftConfig(item, config, data);
      overlayDesignSelections[item.key] = next.theme || next.model || next.variant || "";
      await saveOverlayConfig(item.key, next, {
        rerender: false,
        updateCard: true
      });
    }
  });
}

function openOverlayConfigLegacy(item) {
  if (!item) throw new Error("Overlay introuvable.");
  if (item.key === "wheel") {
    wheelEditorContext = null;
    return openWheelOverlayConfig(item, overlayConfig(item.key));
  }
  const config = { ...overlayConfig(item.key) };
  const common = `${field("title", "Titre / libellé", config.title || item.name, "text", "full")}
    ${field("scale", "Échelle (%)", config.scale ?? 100, "number", 'min="50" max="180"')}
    ${field("xOffset", "Position X (px)", config.xOffset ?? 0, "number", 'min="-1000" max="1000"')}
    ${field("yOffset", "Position Y (px)", config.yOffset ?? 0, "number", 'min="-1000" max="1000"')}
    ${field("accentColor", "Couleur accent", config.accentColor || "#22d3ee", "color")}
    ${field("textColor", "Couleur texte", config.textColor || "#ffffff", "color")}`;
  let specialized = "";
  if (item.parameter === "theme") {
    specialized += overlaySelect("theme", "Thème", config.theme || item.defaultOption, item.options, true);
  }
  if (item.parameter === "model") {
    specialized += overlaySelect("model", "Modèle du bocal", config.model || item.defaultOption, item.options, true);
  }
  if (item.parameter === "design") {
    specialized += overlaySelect("design", "Design de la roue", config.design || item.defaultOption, item.options, true);
  }
  if (item.parameter === "variant") {
    specialized += overlaySelect("variant", "Vidéo", config.variant || item.defaultOption, item.options, true);
  }
  if (["likeGoal", "coinJar", "winCounter"].includes(item.key)) {
    specialized += `${field("current", "Valeur actuelle", config.current ?? 0, "number", 'min="-999999" max="999999"')}${field("target", "Objectif", config.target ?? 1000, "number", 'min="1" max="999999"')}`;
  }
  if (["timer", "multiplierTimer"].includes(item.key)) {
    specialized += overlayTimerDurationFields(config.seconds ?? 300);
  }
  if (item.key === "multiplierTimer") {
    specialized += field("multiplier", "Multiplicateur", config.multiplier ?? 2, "number", 'min="2" max="5"');
  }
  if (item.key === "myActions") {
    specialized += field("maxRows", "Nombre de lignes", config.maxRows ?? 5, "number", 'min="1" max="12"');
  }
  if (["topDonors", "topTappers"].includes(item.key)) {
    specialized += field("maxRows", "Nombre de places", Math.min(5, config.maxRows ?? 5), "number", 'min="1" max="5"');
  }
  if (item.previewKind === "match") {
    specialized += overlaySelect("fit", "Ajustement dans la source 1080 × 1920", config.fit || "contain", [["contain", "Vidéo entière"], ["cover", "Remplir la source"]], true);
  }
  if (item.key === "wheel") {
    specialized += `<label class="field full"><span>Segments (un par ligne)</span><textarea name="choices" rows="7" required>${escapeHtml((config.choices || []).join("\n"))}</textarea></label>`;
  }
  const toggles = `${overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), [["true", "Oui"], ["false", "Non"]])}
    ${["likeGoal", "coinJar", "timer", "multiplierTimer", "winCounter"].includes(item.key) ? overlaySelect("showGoal", "Afficher l’objectif", String(config.showGoal !== false), [["true", "Oui"], ["false", "Non"]]) : ""}
    ${item.key === "wheel" ? overlaySelect("showBase", "Afficher le socle", String(config.showBase !== false), [["true", "Oui"], ["false", "Non"]]) : ""}`;
  openEditor({
    title: `Configurer ${item.name}`,
    kicker: "OVERLAY OBS · RÉGLAGES PERSISTANTS",
    variant: "wide",
    body: `<div class="action-editor overlay-config-editor">
      ${dialogSection("Placement", "Déplacez et redimensionnez le rendu sans modifier les dimensions de la source OBS.", common, "dialog-section-accent")}
      ${dialogSection("Contenu & design", "Seuls les réglages réellement pris en charge par ce moteur sont proposés.", specialized || `<div class="field full"><small>Aucun réglage spécifique supplémentaire.</small></div>`)}
      ${dialogSection("Affichage", "Affinez les éléments visibles dans la source navigateur.", toggles)}
      <div class="overlay-config-source"><span>Source HTTPS recommandée</span><strong>${escapeHtml(overlaySourceSize(item).label)}</strong><code>${escapeHtml(overlayUrl(item))}</code>${item.previewKind === "match" ? "" : `<small>OBS local</small><code>${escapeHtml(localOverlayUrl(item))}</code>`}</div>
    </div>`,
    onSubmit: async (data) => {
      const next = {
        ...config,
        title: data.get("title"),
        scale: Math.min(180, Math.max(50, Number(data.get("scale") || 100))),
        xOffset: Math.min(1000, Math.max(-1000, Number(data.get("xOffset") || 0))),
        yOffset: Math.min(1000, Math.max(-1000, Number(data.get("yOffset") || 0))),
        accentColor: data.get("accentColor"),
        textColor: data.get("textColor")
      };
      for (const key of ["theme", "model", "design", "variant", "fit"]) {
        if (data.has(key)) next[key] = data.get(key);
      }
      for (const key of ["current", "target", "seconds", "multiplier", "maxRows"]) {
        if (data.has(key)) next[key] = Number(data.get(key));
      }
      if (["timer", "multiplierTimer"].includes(item.key)) next.seconds = timerDurationTotalSeconds(data, next.seconds);
      for (const key of ["showHeader", "showGoal", "showBase"]) {
        if (data.has(key)) next[key] = data.get(key) === "true";
      }
      if (data.has("choices")) {
        next.choices = String(data.get("choices") || "")
          .split(/\r?\n/)
          .map((choice) => choice.trim())
          .filter(Boolean)
          .slice(0, 16);
        if (next.choices.length < 2) throw new Error("La roue doit contenir au moins deux segments.");
      }
      overlayDesignSelections[item.key] = next.theme || next.model || next.design || next.variant || "";
      acceptSnapshot(await api.saveSettings({
        ...snapshot.state.settings,
        overlayConfigs: {
          ...(snapshot.state.settings.overlayConfigs || {}),
          [item.key]: next
        }
      }));
    }
  });
}

function renderMatchOverlayGuide() {
  const sourceUrl = snapshot?.overlayUrls?.matchPlayer || "";
  let accountNumber = "—";
  try {
    accountNumber = new URL(sourceUrl).pathname.split("/").filter(Boolean)[1] || "—";
  } catch {
    // La source reste indisponible tant que le compte ou l'accès Pro manque.
  }
  return `<aside class="match-overlay-guide">
    <header>
      <span aria-hidden="true">LIVE</span>
      <div>
        <strong>Comment utiliser ces animations de matchs&nbsp;?</strong>
        <p>Un seul lecteur protégé reçoit toutes les animations. Une nouvelle demande remplace la vidéo en cours et repart à zéro.</p>
      </div>
      <div class="match-overlay-guide-actions">
        <small>Compte n° ${escapeHtml(accountNumber)}</small>
        <button type="button" class="button tiny ghost" data-action="rotate-match-overlay-url">Régénérer l’URL Match</button>
      </div>
    </header>
    <ol>
      <li><b>1</b><span>Copiez l’<strong>URL du lecteur Match</strong> depuis n’importe quelle carte. C’est volontairement la même URL pour les huit animations.</span></li>
      <li><b>2</b><span>Dans TikTok LIVE Studio, ajoutez cette URL <strong>une seule fois</strong> avec <strong>Ajouter une source → Lien</strong>.</span></li>
      <li><b>3</b><span>Laissez cette source visible et active. Elle reste transparente au repos ; les boutons et automatisations ShenPulse lancent les vidéos.</span></li>
      <li class="match-overlay-source-settings">
        <b>4</b>
        <span>
          Réglages recommandés de la source Lien&nbsp;:
          <small><strong>Largeur</strong> · 1080 px</small>
          <small><strong>Hauteur</strong> · 1920 px</small>
          <small><strong>Toujours garder actif</strong> · activé</small>
          <small>Chaque nouvel appui arrête la vidéo active et relance la nouvelle à 0.</small>
          <small>L’URL HTTPS contient le numéro unique du compte et un canal Match révocable, sans adresse locale visible.</small>
          <small>ShenPulse doit rester ouvert avec un abonnement Pro actif. L’accès est revérifié en continu.</small>
          <small>Les fichiers vidéo ne sont jamais exposés par une URL de stockage directe.</small>
        </span>
      </li>
    </ol>
  </aside>`;
}

function renderOverlaysV2() {
  const query = overlaySearch.trim().toLowerCase();
  const accessibleItems = overlayDefinitions().filter(canAccessOverlay);
  const catalogItems = accessibleItems.filter((item) => !item.catalogHidden);
  const categoryDefinitions = [
    ["counters", "Compteurs", "◎"],
    ["rankings", "Classements", "♛"],
    ["interactions", "Interactions", "✦"],
    ["actions", "Actions", "⚡"],
    ["events", "Événements", "◌"],
    ["points", "Points", "★"],
    ["likes", "Likes", "♥"],
    ["gifts", "Cadeaux", "♢"],
    ["games", "Jeux", "◇"],
    ["music", "Musique", "♫"],
    ["seasonal", "Saisonnier", "❄"],
    ["tools", "Outils", "⌁"],
    ["matches", "Matchs", "VS"]
  ];
  const availableCategoryIds = new Set(catalogItems.map((item) => item.category));
  const categories = categoryDefinitions.filter(([id]) => availableCategoryIds.has(id));
  if (overlayCategory !== "all" && !availableCategoryIds.has(overlayCategory)) {
    overlayCategory = "all";
  }
  const items = catalogItems.filter((item) => {
    const matchesCategory =
      overlayCategory === "all" || item.category === overlayCategory;
    const optionLabels = item.options?.flat().join(" ") || "";
    const matchesSearch = !query || `${item.name} ${item.description} ${optionLabels}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });
  const sections = categories
    .map(([id, label, icon]) => ({
      id,
      label,
      icon,
      items: items.filter((item) => item.category === id)
    }))
    .filter((section) => section.items.length);
  return `
    <div class="reference-page overlay-catalog-page">
      <section class="page-hero">
        <div><span class="hero-chip">GALERIE OVERLAYS</span><h2>Overlays & widgets</h2><p>Les overlays ShenPulse classés comme dans ShenazenOverlay, avec leurs réglages persistants.</p></div>
        <span class="hero-count">${catalogItems.length}</span>
      </section>
      ${isAccountAuthenticated() ? `<section class="card public-overlay-relay-card" data-public-overlay-relay>
        <header class="card-header">
          <div>
            <p class="eyebrow">RELAIS PUBLIC SHENPULSE</p>
            <h3>Sources pour TikTok LIVE Studio et OBS</h3>
            <p data-public-overlay-relay-detail>Connexion au relais public… Le lecteur Match utilise lui aussi une URL HTTPS courte sur shenpulse-overlays.web.app, avec un canal révocable et des tickets vidéo temporaires.</p>
          </div>
          <div class="button-row">
            <span class="badge cyan" data-public-overlay-relay-badge>CONNEXION</span>
            <button class="button small ghost" data-action="rotate-public-overlay-urls">Régénérer les URL</button>
          </div>
        </header>
      </section>` : ""}
      <section class="catalog-toolbar overlay-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="overlays" type="search" value="${escapeHtml(overlaySearch)}" placeholder="Rechercher un overlay, un compteur ou un timer"></label>
        <div class="filter-pills">
          <button class="${overlayCategory === "all" ? "active" : ""}" data-action="set-overlay-category" data-value="all">Tous</button>
          ${categories.map(([id, label]) => `<button class="${overlayCategory === id ? "active" : ""}" data-action="set-overlay-category" data-value="${id}">${label}</button>`).join("")}
        </div>
      </section>
      <div class="overlay-section-stack">
        ${sections.map((section) => `<section class="overlay-category-section" data-overlay-category="${escapeHtml(section.id)}">
          <header class="overlay-category-heading">
            <span aria-hidden="true">${section.icon}</span>
            <h3>${escapeHtml(section.label)}</h3>
            <small>${section.items.length} overlay${section.items.length > 1 ? "s" : ""}</small>
          </header>
          ${section.id === "matches" ? renderMatchOverlayGuide() : ""}
          <div class="overlay-catalog-grid">${section.items.map((item) => renderOverlayCard(item)).join("")}</div>
        </section>`).join("")}
      </div>
      ${items.length ? "" : emptyInline("Aucun overlay ne correspond à ces filtres.")}
    </div>`;
}
