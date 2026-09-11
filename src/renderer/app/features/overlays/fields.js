"use strict";

/**
 * Champs documentés et configuration de la roue.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

const OVERLAY_FIELD_HELP = {
  enabled: "Active ou masque entièrement cet overlay dans sa source navigateur, sans supprimer ses réglages.",
  title: "Texte principal affiché dans l’overlay. Le changement apparaît immédiatement dans l’aperçu.",
  scale: "Agrandit ou réduit l’ensemble du rendu à l’intérieur de la source OBS, sans changer ses dimensions.",
  xOffset: "Déplace horizontalement le rendu dans la source : valeur négative vers la gauche, positive vers la droite.",
  yOffset: "Déplace verticalement le rendu dans la source : valeur négative vers le haut, positive vers le bas.",
  accentColor: "Couleur principale des éléments générés par ShenPulse, notamment les progressions et les accents.",
  secondaryColor: "Deuxième couleur utilisée pour les dégradés, pourcentages et détails contrastés.",
  textColor: "Couleur des textes générés par ShenPulse. Les textes intégrés dans une image de design ne sont pas modifiés.",
  backgroundColor: "Couleur du panneau situé derrière le contenu de l’overlay.",
  backgroundOpacity: "Règle la transparence du panneau de fond, de totalement transparent à totalement opaque.",
  showShadow: "Active ou retire les ombres des textes et éléments générés par ShenPulse.",
  showWhenIdle: "Garde l’overlay visible lorsqu’aucun événement n’est reçu. Sinon il se masque après sa durée d’affichage.",
  font: "Police utilisée par les textes générés par ShenPulse.",
  fontSize: "Agrandit ou réduit uniquement les textes, sans modifier la taille du design.",
  saturation: "Intensifie ou atténue toutes les couleurs du rendu, design compris.",
  hue: "Fait tourner la teinte de toutes les couleurs du rendu pour créer une variante chromatique.",
  rtl: "Inverse le sens de lecture pour les langues qui s’écrivent de droite à gauche.",
  theme: "Design graphique appliqué à l’overlay. Tous les designs sont visibles dans l’aperçu, même sans abonnement Pro.",
  model: "Modèle graphique du bocal utilisé dans la source et dans l’aperçu.",
  variant: "Version vidéo de l’animation de match.",
  current: "Valeur de départ utilisée hors live ou quand aucune donnée de session n’est encore disponible.",
  target: "Valeur à atteindre. Elle définit aussi le calcul de la progression quand l’overlay en possède une.",
  goalBaseline: "Point de départ de la progression : les valeurs inférieures ou égales correspondent à 0 %.",
  progressLabel: "Libellé affiché au-dessus de la progression du Like Goal.",
  whenReached: "Définit le comportement automatique lorsque le Like Goal atteint sa valeur cible.",
  completionActionId: "Action ShenPulse lancée une seule fois lorsque le Like Goal franchit son objectif ou lorsque le timer standard arrive à zéro.",
  showPercent: "Affiche ou masque le pourcentage calculé à côté des valeurs du Like Goal.",
  likeGoalTitleOffsetX: "Déplace horizontalement le titre du Like Goal sans déplacer le cadre ni la progression.",
  likeGoalTitleOffsetY: "Déplace verticalement le titre du Like Goal sans déplacer le cadre ni la progression.",
  likeGoalTitleScale: "Agrandit ou réduit uniquement le titre du Like Goal, sans modifier sa position ni le cadre.",
  likeGoalTitleColor: "Modifie uniquement la couleur du titre du Like Goal.",
  likeGoalContentOffsetX: "Déplace horizontalement tout le texte central : valeur actuelle, objectif, libellé et pourcentage.",
  likeGoalContentOffsetY: "Déplace verticalement tout le texte central : valeur actuelle, objectif, libellé et pourcentage.",
  likeGoalContentScale: "Agrandit ou réduit ensemble la valeur actuelle, l’objectif, le libellé et le pourcentage.",
  likeGoalContentColor: "Modifie la couleur des valeurs et du libellé central, sans modifier le pourcentage.",
  likeGoalPercentColor: "Modifie uniquement la couleur du pourcentage du Like Goal.",
  minCoins: "Valeur minimale du bocal après une remise à zéro ou une mise à jour.",
  showBase: "Affiche ou masque la partie de support prévue par le design.",
  seconds: "Durée chargée au démarrage. Les jours sont convertis en heures dans le timer, ou en minutes cumulées si l’affichage des heures est désactivé.",
  timerAutoStart: "Démarre automatiquement le compte à rebours dès que la source navigateur est chargée.",
  showHours: "Force le format heures:minutes:secondes, même lorsque le compteur contient moins d’une heure.",
  timerTitleScale: "Agrandit ou réduit uniquement le titre du timer, sans modifier le cadre ni la valeur.",
  timerValueScale: "Agrandit ou réduit uniquement la valeur du timer, sans modifier le cadre ni le titre.",
  multiplier: "Valeur X2 à X5 affichée sur le Timer multiplicateur.",
  maxRows: "Nombre maximal d’éléments ou de personnes visibles simultanément.",
  showRank: "Affiche ou masque le numéro et le badge de chaque position du classement.",
  showAvatars: "Affiche les photos de profil TikTok, ou l’initiale quand aucune photo n’est disponible.",
  showCrown: "Affiche la couronne graphique au-dessus de la première place.",
  showRankBadges: "Affiche les médailles et cadres graphiques associés aux premières places.",
  showMetricLabel: "Affiche le score et son unité, par exemple coins ou likes.",
  nameColor: "Couleur des noms des viewers dans le classement.",
  scoreColor: "Couleur du score affiché pour chaque viewer.",
  rankColor: "Couleur des numéros de rang lorsque le design les laisse visibles.",
  rowOpacity: "Règle l’opacité du fond généré derrière chaque ligne du classement.",
  allowNegative: "Autorise le compteur de wins à descendre sous zéro.",
  winCounterLabelColorNegative: "Couleur du nombre lorsque la valeur est négative.",
  winCounterLabelColorNeutral: "Couleur du nombre lorsque la valeur est égale à zéro.",
  winCounterLabelColorPositive: "Couleur du nombre lorsque la valeur est positive.",
  winCounterLabelOffsetX: "Déplace horizontalement le bloc libellé, valeur et objectif dans le design.",
  winCounterLabelOffsetY: "Déplace verticalement le bloc libellé, valeur et objectif dans le design.",
  fit: "Détermine si la vidéo entière reste visible ou remplit la source 1080 × 1920 en la recadrant si nécessaire.",
  autoplay: "Lance la vidéo automatiquement au chargement et à chaque déclenchement.",
  loop: "Rejoue l’animation vidéo en continu au lieu de s’arrêter après une lecture.",
  showHeader: "Affiche ou masque le titre principal de l’overlay.",
  showGoal: "Affiche ou masque la zone d’objectif lorsque ce design en possède une.",
  incrementShortcut: "Combinaisons clavier qui ajoutent une unité. Séparez plusieurs raccourcis par une virgule.",
  decrementShortcut: "Combinaisons clavier qui retirent une unité. Séparez plusieurs raccourcis par une virgule.",
  resetShortcut: "Combinaisons clavier qui remettent la valeur à zéro.",
  wheelName: "Nom interne de cette roue et libellé utilisé dans la source lorsqu’il est affiché.",
  wheelEnabled: "Autorise cette roue à être choisie et déclenchée par ShenPulse.",
  wheelDesign: "Style graphique de la roue sélectionnée.",
  wheelTrigger: "Choisissez soit un cadeau TikTok précis, soit un filtre de valeur en pièces pour lancer cette roue.",
  wheelSegmentLabel: "Texte affiché dans cette case de la roue.",
  wheelSegmentColor: "Couleur de fond de cette case.",
  wheelSegmentAction: "Comportement exécuté lorsque cette case gagne : affichage, action ShenPulse ou nouvelle rotation.",
  wheelSegmentActionId: "Action ShenPulse lancée uniquement lorsque le résultat de la case est réglé sur « Lancer une action ».",
  textOrientation: "Orientation du texte à l’intérieur des segments.",
  textShadowColor: "Couleur de l’ombre dessinée derrière le texte des segments.",
  textShadowStrength: "Intensité et visibilité de l’ombre du texte.",
  textRadius: "Distance du texte par rapport au centre de la roue.",
  textSegmentOffset: "Décale le texte le long de son segment sans déplacer le segment.",
  textBoxWidth: "Largeur maximale réservée au texte dans chaque segment.",
  textBoxHeight: "Hauteur maximale réservée au texte dans chaque segment.",
  textAngleOffset: "Corrige l’angle du texte dans tous les segments.",
  textAlign: "Alignement du texte à l’intérieur de sa zone.",
  textClamp: "Limite le texte à la zone et au nombre de lignes prévus.",
  textMaxLines: "Nombre maximal de lignes affichées par segment lorsque la limitation est active.",
  lineSpacing: "Espace vertical entre les lignes du texte.",
  letterSpacing: "Espace horizontal entre les lettres.",
  glow: "Intensité de la lumière autour de la roue.",
  pointerPosition: "Côté de la roue sur lequel le pointeur du résultat est placé.",
  soundActive: "Active ou coupe le son de rotation de la roue.",
  spinDuration: "Durée exacte de la rotation et du son associé.",
  waitDuration: "Pause entre l’arrêt de la roue et l’affichage du résultat.",
  showWinner: "Affiche le libellé de la case gagnante après l’arrêt.",
  resultDuration: "Durée pendant laquelle le résultat gagnant reste visible.",
  alwaysVisible: "Garde la roue visible au repos ou la montre uniquement pendant une rotation.",
  entranceAnimation: "Animation utilisée lorsque la roue apparaît.",
  exitAnimation: "Animation utilisée lorsque la roue disparaît."
};

function fieldLabelWithInfo(label, help) {
  return `<span class="field-label-with-info">
    <span>${escapeHtml(label)}</span>
    <button type="button" class="field-info-button" aria-label="Information : ${escapeHtml(label)}" title="${escapeHtml(help)}">i</button>
    <span class="field-info-popover" role="tooltip">${escapeHtml(help)}</span>
  </span>`;
}

function overlaySelect(name, label, value, options, full = false, help = OVERLAY_FIELD_HELP[name] || "") {
  return `<label class="field ${full ? "full" : ""}">${fieldLabelWithInfo(label, help)}<select name="${escapeHtml(name)}">${options.map(([optionValue, optionLabel]) => `<option value="${escapeHtml(optionValue)}" ${String(value) === String(optionValue) ? "selected" : ""}>${escapeHtml(optionLabel)}</option>`).join("")}</select></label>`;
}

function overlayField(name, label, value = "", type = "text", extra = "", help = OVERLAY_FIELD_HELP[name] || "") {
  return `<label class="field ${extra.includes("full") ? "full" : ""}">${fieldLabelWithInfo(label, help)}<input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" ${extra.replace("full", "")}></label>`;
}

function timerDurationParts(totalSeconds = 0) {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3_600),
    minutes: Math.floor((total % 3_600) / 60),
    seconds: total % 60
  };
}

function timerDurationTotalSeconds(data, fallback = 0) {
  const names = ["timerDays", "timerHours", "timerMinutes", "timerSeconds"];
  if (!names.some((name) => data.has(name))) return Math.max(0, Number(fallback) || 0);
  const value = (name, maximum) => Math.min(
    maximum,
    Math.max(0, Math.floor(Number(data.get(name)) || 0))
  );
  return value("timerDays", 999) * 86_400
    + value("timerHours", 23) * 3_600
    + value("timerMinutes", 59) * 60
    + value("timerSeconds", 59);
}

function overlayTimerDurationFields(totalSeconds = 0) {
  const duration = timerDurationParts(totalSeconds);
  const part = (name, label, value, maximum) => `<label class="timer-duration-part"><span>${label}</span><input name="${name}" type="number" value="${value}" min="0" max="${maximum}" step="1" inputmode="numeric"></label>`;
  return `<div class="field full timer-duration-field">
    ${fieldLabelWithInfo("Durée initiale", OVERLAY_FIELD_HELP.seconds)}
    <div class="timer-duration-grid">
      ${part("timerDays", "Jours", duration.days, 999)}
      ${part("timerHours", "Heures", duration.hours, 23)}
      ${part("timerMinutes", "Minutes", duration.minutes, 59)}
      ${part("timerSeconds", "Secondes", duration.seconds, 59)}
    </div>
  </div>`;
}

function overlayActionSelect(name, label, selectedId = "") {
  return `<label class="field full">${fieldLabelWithInfo(
    label,
    OVERLAY_FIELD_HELP.completionActionId
  )}<select name="${escapeHtml(name)}">${wheelActionOptions(
    selectedId
  )}</select></label>`;
}

function wheelDefaultSettings(overrides = {}) {
  return {
    font: "Kalam",
    fontSize: 50,
    textOrientation: "horizontal",
    textColor: "#fff8ec",
    textShadowColor: "#2b170c",
    textShadowStrength: 55,
    textRadius: 100,
    textSegmentOffset: 0,
    textBoxWidth: 100,
    textBoxHeight: 240,
    textAngleOffset: 0,
    textAlign: "center",
    textClamp: false,
    textMaxLines: 4,
    lineSpacing: 50,
    letterSpacing: 50,
    showBase: true,
    soundActive: true,
    announceDuration: 0,
    spinDuration: 5,
    waitDuration: 3,
    scale: 100,
    glow: 82,
    showWinner: true,
    pointerPosition: "top",
    alwaysVisible: true,
    entranceAnimation: "fade",
    exitAnimation: "fade",
    resultDuration: 4,
    ...overrides,
    announceDuration: 0
  };
}

function wheelSeedSegments(design = "classic") {
  const values = design === "royal"
    ? [
        ["15s pompes", "#7b1fa2"],
        ["4x gainage", "#f59f00"],
        ["Rien", "#2f8f00"],
        ["3x abdos", "#0067b8"],
        ["10x pompes", "#c51f12"],
        ["1x relance", "#9b168d", "spin"],
        ["20x abdos", "#008d8f"],
        ["5x gainage", "#d77a00"],
        ["15s pompes", "#005fae"],
        ["1x abdo", "#2e8b00"],
        ["20x pompes", "#d52a16"],
        ["5x abdos", "#0094a3"]
      ]
    : [
        ["10 pompes", "#ff6a00"],
        ["Choisis un défi", "#111111"],
        ["x2 pendant 1 min", "#f59f00"],
        ["Question chat", "#2a1207"],
        ["Danse 15 sec", "#ff8a1f"],
        ["Rien du tout", "#1e1e1e"],
        ["Action mystère", "#ffb04a"],
        ["Relance", "#371707", "spin"]
      ];
  return values.map(([label, color, action = "none"]) => ({
    id: `segment_${cryptoId()}`,
    label,
    color,
    action,
    actionId: ""
  }));
}

function normalizedWheelSettings(wheel = {}) {
  const settings = wheel.settings || {};
  const usesRegressedDefaults =
    settings.font === "Inter" &&
    Number(settings.fontSize) === 19 &&
    settings.textOrientation === "radial" &&
    Number(settings.textRadius) === 34 &&
    Number(settings.textBoxHeight) === 42;
  if (!usesRegressedDefaults) return wheelDefaultSettings(settings);
  return wheelDefaultSettings(
    wheel.design === "royal"
      ? {
          font: "Georgia",
          fontSize: 50,
          textColor: "#fff5cb",
          glow: 100,
          spinDuration: 7
        }
      : {}
  );
}

function normalizeWheelConfig(rawConfig = {}) {
  const legacyLabels = Array.isArray(rawConfig.choices) && rawConfig.choices.length > 1
    ? rawConfig.choices
    : wheelSeedSegments().map((segment) => segment.label);
  const legacyColors = Array.isArray(rawConfig.colors) ? rawConfig.colors : [];
  const sourceWheels = Array.isArray(rawConfig.wheels) && rawConfig.wheels.length
    ? rawConfig.wheels
    : [{
        id: "wheel_classic",
        name: "Roue classique",
        enabled: true,
        trigger: "",
        giftValueFilter: null,
        design: rawConfig.design || "classic",
        settings: wheelDefaultSettings(rawConfig),
        segments: legacyLabels.map((label, index) => ({
          id: `segment_${cryptoId()}`,
          label,
          color: legacyColors[index] || ["#ff6a00", "#111111", "#f59f00", "#2a1207"][index % 4],
          action: "none",
          actionId: ""
        }))
      }];
  const wheels = sourceWheels.map((wheel, wheelIndex) => ({
    id: wheel.id || `wheel_${cryptoId()}`,
    name: wheel.name || `Roue ${wheelIndex + 1}`,
    enabled: wheel.enabled !== false,
    trigger: wheel.trigger || "",
    triggerGift:
      wheel.triggerGift && typeof wheel.triggerGift === "object"
        ? { ...wheel.triggerGift }
        : null,
    giftValueFilter: normalizeGiftValueFilterConfig(wheel.giftValueFilter),
    design: wheel.design === "royal" ? "royal" : "classic",
    settings: normalizedWheelSettings(wheel),
    segments: (wheel.segments?.length ? wheel.segments : wheelSeedSegments(wheel.design)).map(
      (segment, index) => ({
        id: segment.id || `segment_${cryptoId()}`,
        label: segment.label || `Segment ${index + 1}`,
        color: segment.color || "#ff6a00",
        action:
          segment.action === "spin"
            ? "spin"
            : segment.actionId
              ? "action"
              : segment.action === "action"
                ? "action"
                : "none",
        actionId: segment.actionId || ""
      })
    )
  }));
  if (!wheels.some((wheel) => wheel.design === "classic")) {
    wheels.push({
      id: "wheel_classic",
      name: "Roue Orange Classique - Actions LIVE",
      enabled: true,
      trigger: "",
      giftValueFilter: null,
      design: "classic",
      settings: wheelDefaultSettings(),
      segments: wheelSeedSegments("classic")
    });
  }
  if (!wheels.some((wheel) => wheel.design === "royal")) {
    wheels.push({
      id: "wheel_royal",
      name: "Roue Royale Prestige - Défis Sport",
      enabled: false,
      trigger: "",
      giftValueFilter: null,
      design: "royal",
      settings: wheelDefaultSettings({
        font: "Georgia",
        fontSize: 17,
        textColor: "#fff5cb",
        glow: 100,
        spinDuration: 7
      }),
      segments: wheelSeedSegments("royal")
    });
  }
  return {
    ...rawConfig,
    schemaVersion: 11,
    selectedWheelId: wheels.some((wheel) => wheel.id === rawConfig.selectedWheelId)
      ? rawConfig.selectedWheelId
      : wheels[0].id,
    wheels
  };
}

function wheelTriggerSummary(wheel = {}) {
  return (
    giftValueFilterLabel(wheel.giftValueFilter) ||
    String(wheel.trigger || "").trim() ||
    "Manuel ou action"
  );
}

function wheelGiftValueConditions(wheel = {}) {
  const filter = normalizeGiftValueFilterConfig(wheel.giftValueFilter);
  return filter
    ? [{ field: "data.value", operator: filter.operator, value: filter.value }]
    : [];
}

function wheelDesignOption(value, label, detail, selected) {
  return `<label class="wheel-design-option ${selected === value ? "selected" : ""}">
    <input type="radio" name="wheelDesign" value="${value}" ${selected === value ? "checked" : ""}>
    <span class="wheel-design-thumbnail" data-wheel-design-thumbnail="${value}" aria-hidden="true">
      <i></i><b></b><em></em>
    </span>
    <span class="wheel-design-copy"><strong>${label}</strong><small>${detail}</small></span>
    <span class="wheel-design-check" aria-hidden="true">✓</span>
  </label>`;
}

function wheelActionOptions(selectedId = "") {
  return [
    `<option value="">Choisir une action ShenPulse</option>`,
    ...flattenActions().map(({ rule, action }) =>
      `<option value="${escapeHtml(action.id)}" ${selectedId === action.id ? "selected" : ""}>${escapeHtml(rule.name)} · ${escapeHtml(actionTypeLabel(action.type))}</option>`
    )
  ].join("");
}

function wheelSegmentEditor(segment, index, count) {
  const resultLabel =
    segment.action === "spin"
      ? "Relance la roue"
      : segment.actionId
        ? "Lance une action"
        : "Affiche le résultat";
  return `<article class="wheel-segment-row" data-wheel-segment-row data-segment-id="${escapeHtml(segment.id)}">
    <header class="wheel-segment-header">
      <div class="wheel-segment-heading">
        <span class="wheel-segment-number">${index + 1}</span>
        <span class="wheel-segment-color-preview" style="--wheel-segment-color:${escapeHtml(segment.color)}"></span>
        <span><strong>${escapeHtml(segment.label)}</strong><small>${resultLabel}</small></span>
      </div>
      <div class="wheel-segment-controls" aria-label="Organiser le secteur ${index + 1}">
        <button type="button" title="Monter ce secteur" aria-label="Monter le secteur ${index + 1}" data-wheel-command="segment-up" data-index="${index}" ${index === 0 ? "disabled" : ""}>↑</button>
        <button type="button" title="Descendre ce secteur" aria-label="Descendre le secteur ${index + 1}" data-wheel-command="segment-down" data-index="${index}" ${index === count - 1 ? "disabled" : ""}>↓</button>
        <button type="button" class="danger" title="Supprimer ce secteur" aria-label="Supprimer le secteur ${index + 1}" data-wheel-command="segment-delete" data-index="${index}" ${count <= 2 ? "disabled" : ""}>×</button>
      </div>
    </header>
    <div class="wheel-segment-fields">
      <label class="wheel-segment-label-field">${fieldLabelWithInfo("Texte affiché", OVERLAY_FIELD_HELP.wheelSegmentLabel)}<input name="wheelSegmentLabel" value="${escapeHtml(segment.label)}" maxlength="70" required></label>
      <label class="wheel-color-field">${fieldLabelWithInfo("Couleur", OVERLAY_FIELD_HELP.wheelSegmentColor)}<input name="wheelSegmentColor" type="color" value="${escapeHtml(segment.color)}"></label>
      <label class="wheel-segment-result-field">${fieldLabelWithInfo("Quand ce secteur gagne", OVERLAY_FIELD_HELP.wheelSegmentAction)}<select name="wheelSegmentAction">
        <option value="none" ${segment.action === "none" ? "selected" : ""}>Afficher le résultat uniquement</option>
        <option value="action" ${segment.action === "action" ? "selected" : ""}>Lancer une action ShenPulse</option>
        <option value="spin" ${segment.action === "spin" ? "selected" : ""}>Relancer automatiquement la roue</option>
      </select></label>
      <label class="wheel-segment-action-select">${fieldLabelWithInfo("Action à lancer", OVERLAY_FIELD_HELP.wheelSegmentActionId)}<select name="wheelSegmentActionId">${wheelActionOptions(segment.actionId)}</select></label>
    </div>
  </article>`;
}

function syncWheelSegmentActionVisibility(root = dialogBody) {
  root.querySelectorAll("[data-wheel-segment-row]").forEach((row) => {
    const mode = row.querySelector('[name="wheelSegmentAction"]')?.value;
    const actionField = row.querySelector(".wheel-segment-action-select");
    if (actionField) actionField.hidden = mode !== "action";
  });
}

function collectWheelEditorForm() {
  if (!wheelEditorContext || !dialog.open) return;
  const wheel = wheelEditorContext.config.wheels.find(
    (entry) => entry.id === wheelEditorContext.config.selectedWheelId
  );
  if (!wheel) return;
  const data = new FormData(dialogForm);
  wheel.name = String(data.get("wheelName") || wheel.name).trim() || "Roue sans nom";
  wheel.enabled = data.get("wheelEnabled") === "true";
  const triggerMode = data.get("wheelGiftTriggerMode") === "value"
    ? "value"
    : "specific";
  wheel.trigger = triggerMode === "specific"
    ? String(data.get("wheelTrigger") || "").trim()
    : "";
  const selectedTriggerGift = giftForIdentity(
    wheel.trigger,
    data.get("wheelTriggerGiftId")
  );
  wheel.triggerGift =
    triggerMode === "specific" && selectedTriggerGift
      ? {
          giftId: String(selectedTriggerGift.id || ""),
          giftCost: Math.max(0, Number(selectedTriggerGift.cost) || 0),
          giftImageUrl: String(selectedTriggerGift.imageUrl || "")
        }
      : null;
  wheel.giftValueFilter = triggerMode === "value"
    ? normalizeGiftValueFilterConfig({
        operator: data.get("wheelGiftValueOperator"),
        value: data.get("wheelGiftValueAmount")
      })
    : null;
  wheel.design = data.get("wheelDesign") === "royal" ? "royal" : "classic";
  const settings = wheel.settings;
  const wheelTriggerText = wheelTriggerSummary(wheel);
  for (const key of [
    "font",
    "textOrientation",
    "textColor",
    "textShadowColor",
    "textAlign",
    "pointerPosition",
    "entranceAnimation",
    "exitAnimation"
  ]) {
    if (data.has(key)) settings[key] = data.get(key);
  }
  for (const key of [
    "fontSize",
    "textShadowStrength",
    "textRadius",
    "textSegmentOffset",
    "textBoxWidth",
    "textBoxHeight",
    "textAngleOffset",
    "textMaxLines",
    "lineSpacing",
    "letterSpacing",
    "spinDuration",
    "waitDuration",
    "scale",
    "glow",
    "resultDuration"
  ]) {
    if (data.has(key)) settings[key] = Number(data.get(key));
  }
  for (const key of [
    "textClamp",
    "showBase",
    "soundActive",
    "showWinner",
    "alwaysVisible"
  ]) {
    if (data.has(key)) settings[key] = data.get(key) === "true";
  }
  wheel.segments = [...dialogBody.querySelectorAll("[data-wheel-segment-row]")].map(
    (row) => {
      const actionId =
        row.querySelector('[name="wheelSegmentActionId"]').value;
      const selectedMode =
        row.querySelector('[name="wheelSegmentAction"]').value;
      return {
        id: row.dataset.segmentId || `segment_${cryptoId()}`,
        label: row.querySelector('[name="wheelSegmentLabel"]').value.trim(),
        color: row.querySelector('[name="wheelSegmentColor"]').value,
        action:
          selectedMode === "spin"
            ? "spin"
            : actionId
              ? "action"
              : selectedMode,
        actionId
      };
    }
  ).filter((segment) => segment.label);
}
