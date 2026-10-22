"use strict";

/**
 * Éditeurs et page principale des overlays.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */


function overlayDraftConfig(item, baseConfig, data = new FormData(dialogForm)) {
  const next = { ...baseConfig };
  if (item.key === "winCounter") {
    delete next.winCounterLabelOffsetX;
    delete next.winCounterLabelOffsetY;
  }
  if (item.key === "likeGoal") {
    for (const key of ["likeGoalTitleOffsetX", "likeGoalTitleOffsetY", "likeGoalContentOffsetX", "likeGoalContentOffsetY"]) {
      delete next[key];
    }
  }
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
    "leaderboardTitleColor",
    "leaderboardMetricLabel",
    "leaderboardUnitColor",
    "winCounterLabelColorNegative",
    "winCounterLabelColorNeutral",
    "winCounterLabelColorPositive",
    "winCounterTitleColor",
    "winCounterGoalColor",
    "likeGoalTitleColor",
    "likeGoalContentColor",
    "likeGoalPercentColor",
    "timerTitleColor",
    "timerValueColor",
    "timerMultiplierColor",
    "coinJarTitleColor"
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
    "likeGoalTitleScale",
    "likeGoalContentScale",
    "seconds",
    "timerTitleScale",
    "timerValueScale",
    "leaderboardTitleScale",
    "leaderboardNameScale",
    "leaderboardScoreScale",
    "leaderboardUnitScale",
    "leaderboardAvatarScale",
    "winCounterTitleScale",
    "winCounterValueScale",
    "winCounterGoalScale",
    "multiplier",
    "maxRows",
    "minCoins",
    "rowOpacity",
    "coinJarTitleScale"
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
    "leaderboardShowUnit",
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
        title: selectedWheel?.settings?.wheelTitle ?? selectedWheel?.name ?? wheelEditorContext.config.title
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
  if (["topDonors", "topTappers"].includes(item.key)) return openLeaderboardOverlayConfig(item);
  if (item.key === "likeGoal") return openLikeGoalOverlayConfig(item);
  if (item.key === "winCounter") return openWinCounterOverlayConfig(item);
  if (item.key === "coinJar") return openCoinJarOverlayConfig(item);
  if (["timer", "multiplierTimer"].includes(item.key)) return openTimerOverlayConfig(item);
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
  if (["likeGoal", "winCounter"].includes(item.key)) {
    specialized += `${overlayField("current", "Valeur de départ hors session", config.current ?? 0, "number", 'min="-999999" max="999999"')}
      ${overlayField("target", "Objectif", config.target ?? 1000, "number", 'min="1" max="999999"')}`;
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

function renderOverlaysV2() {
  const query = overlaySearch.trim().toLowerCase();
  const accessibleItems = overlayDefinitions().filter(canAccessOverlay);
  const catalogItems = accessibleItems.filter((item) => !item.catalogHidden && item.category !== "matches" && item.previewKind !== "match");
  const categoryDefinitions = [
    ["counters", "Compteurs"],
    ["rankings", "Classements"],
    ["interactions", "Interactions"],
    ["actions", "Actions"],
    ["events", "Événements"],
    ["points", "Points"],
    ["likes", "Likes"],
    ["gifts", "Cadeaux"],
    ["games", "Jeux"],
    ["music", "Musique"],
    ["seasonal", "Saisonnier"],
    ["tools", "Outils"]
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
    .map(([id, label]) => ({
      id,
      label,
      items: items.filter((item) => item.category === id)
    }))
    .filter((section) => section.items.length);
  return `
    <div class="reference-page overlay-catalog-page">
      ${renderStudioHero("overlays", "Overlays & widgets", `${catalogItems.length} widgets interactifs. Personnalisez chaque source et ajoutez son URL dans OBS ou TikTok LIVE Studio.`)}
      ${isAccountAuthenticated() ? `<section class="card public-overlay-relay-card" data-public-overlay-relay>
        <header class="card-header">
          <div>
            <p class="eyebrow">RELAIS PUBLIC SHENPULSE</p>
            <h3>Sources pour TikTok LIVE Studio et OBS</h3>
            <p data-public-overlay-relay-detail>Connexion au relais public…</p>
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
        ${sections.map(renderOverlayCategorySection).join("")}
      </div>
      ${items.length ? "" : emptyInline("Aucun overlay ne correspond à ces filtres.")}
    </div>`;
}
