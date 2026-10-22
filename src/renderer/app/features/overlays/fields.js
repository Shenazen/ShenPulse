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
  progressLabel: "Texte facultatif affiché après les valeurs dans la barre du Like Goal.",
  whenReached: "Définit le comportement automatique lorsque le Like Goal atteint sa valeur cible.",
  completionActionId: "Action ShenPulse lancée une seule fois lorsque le Like Goal franchit son objectif ou lorsque le timer standard arrive à zéro.",
  showPercent: "Affiche ou masque le pourcentage calculé à côté des valeurs du Like Goal.",
  likeGoalTitleScale: "Agrandit ou réduit uniquement le titre du Like Goal, sans modifier sa position ni le cadre.",
  likeGoalTitleColor: "Modifie uniquement la couleur du titre du Like Goal.",
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
  timerTitleColor: "Modifie uniquement la couleur du titre du timer.",
  timerValueColor: "Modifie uniquement la couleur du compte à rebours.",
  timerMultiplierColor: "Modifie la couleur du multiplicateur affiché à côté du chrono.",
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
  leaderboardTitleColor: "Modifie la couleur du titre du classement sans changer les noms et les scores.",
  leaderboardTitleScale: "Agrandit ou réduit le titre en le gardant centré dans sa zone.",
  leaderboardNameScale: "Règle la taille des noms, ajustés à la place disponible dans chaque ligne.",
  leaderboardScoreScale: "Règle la taille des scores sans changer les totaux du LIVE.",
  leaderboardMetricLabel: "Texte affiché après le score, par exemple coins, likes ou points. Laissez vide pour garder uniquement le nombre.",
  leaderboardShowUnit: "Affiche ou masque le libellé après le score, tout en gardant le nombre visible.",
  leaderboardUnitColor: "Modifie uniquement la couleur du libellé après le score.",
  leaderboardUnitScale: "Règle la taille du libellé indépendamment de celle du nombre.",
  leaderboardAvatarScale: "À 100 %, la photo remplit le logement du design. Réduisez ce réglage pour une photo plus petite dans le cercle.",
  allowNegative: "Autorise le compteur de wins à descendre sous zéro.",
  winCounterLabelColorNegative: "Couleur du nombre lorsque la valeur est négative.",
  winCounterLabelColorNeutral: "Couleur du nombre lorsque la valeur est égale à zéro.",
  winCounterLabelColorPositive: "Couleur du nombre lorsque la valeur est positive.",
  winCounterTitleColor: "Modifie uniquement la couleur du titre du compteur de wins.",
  winCounterGoalColor: "Modifie uniquement la couleur de l’objectif de wins.",
  winCounterTitleScale: "Agrandit ou réduit le titre en le gardant centré dans sa zone.",
  winCounterValueScale: "Agrandit ou réduit le compteur en conservant son centrage et les couleurs selon sa valeur.",
  winCounterGoalScale: "Agrandit ou réduit l’objectif facultatif sous le compteur.",
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
  wheelName: "Nom interne utilisé pour retrouver cette roue dans les actions et les jeux. Le titre affiché se règle séparément.",
  wheelTitle: "Titre affiché dans le cartouche de la roue, indépendant de son nom interne.",
  wheelShowTitle: "Affiche ou masque le titre sans modifier la roue ni ses secteurs.",
  wheelTitleColor: "Couleur du titre affiché sous la roue.",
  wheelTitleScale: "Règle la taille du titre en le gardant centré dans son cartouche.",
  wheelTextScale: "Règle la taille du texte des secteurs. Il s’adapte automatiquement à chaque secteur.",
  wheelWinnerColor: "Couleur du résultat après la rotation.",
  wheelWinnerScale: "Règle la taille du résultat en conservant son centrage.",
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

function overlaySelect(name, label, value, options, full = false, help = OVERLAY_FIELD_HELP[name] || "") {
  return selectFieldMarkup(name, label, value, options, { full, help, informative: true });
}

function overlayField(name, label, value = "", type = "text", extra = "", help = OVERLAY_FIELD_HELP[name] || "") {
  return inputFieldMarkup(name, label, value, type, extra, { help, informative: true });
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

function overlaySizeField(name, label, value = 100, { min = 50, max = 400 } = {}) {
  const parsed = Number(value);
  const size = Math.round(Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : 100)));
  const id = `${escapeHtml(name)}-range`;
  return `<label class="field overlay-size-field">
    ${fieldLabelWithInfo(label, OVERLAY_FIELD_HELP[name])}
    <span class="overlay-size-control">
      <input id="${id}" name="${escapeHtml(name)}" type="range" min="${min}" max="${max}" step="1" value="${size}" data-overlay-size aria-label="${escapeHtml(label)}" aria-valuetext="${size} %">
      <output for="${id}">${size} %</output>
    </span>
  </label>`;
}

function overlayActionSelect(name, label, selectedId = "", full = true) {
  const missingAction = selectedId && !flattenActions().some(({ action }) => action.id === selectedId);
  return `<label class="field ${full ? "full" : ""}">${fieldLabelWithInfo(
    label,
    OVERLAY_FIELD_HELP.completionActionId
  )}<select name="${escapeHtml(name)}">${wheelActionOptions(
    selectedId
  )}${missingAction ? `<option value="${escapeHtml(selectedId)}" selected>Action liée indisponible dans ce profil</option>` : ""}</select></label>`;
}

function wheelDefaultSettings(overrides = {}) {
  return {
    wheelShowTitle: true,
    wheelTitleColor: "#fff1c2",
    wheelTitleScale: 100,
    wheelTextScale: 100,
    wheelWinnerColor: "#fff7d3",
    wheelWinnerScale: 100,
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
  return wheelDefaultSettings({
    ...settings,
    font: wheel.design === "royal" ? "Georgia" : "Kalam",
    fontSize: 50,
    textOrientation: "horizontal",
    textRadius: 100,
    textBoxWidth: 100,
    textBoxHeight: 240
  });
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
  const wheels = overlayCatalog.normalizeWheelIdentities(sourceWheels).map((wheel, wheelIndex) => ({
    ...wheel,
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
        ...segment,
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
      <label class="field wheel-segment-label-field">${fieldLabelWithInfo("Texte affiché", OVERLAY_FIELD_HELP.wheelSegmentLabel)}<input name="wheelSegmentLabel" value="${escapeHtml(segment.label)}" maxlength="70" required></label>
      <label class="field wheel-color-field">${fieldLabelWithInfo("Couleur", OVERLAY_FIELD_HELP.wheelSegmentColor)}<input name="wheelSegmentColor" type="color" value="${escapeHtml(segment.color)}"></label>
      <label class="field wheel-segment-result-field">${fieldLabelWithInfo("Quand ce secteur gagne", OVERLAY_FIELD_HELP.wheelSegmentAction)}<select name="wheelSegmentAction">
        <option value="none" ${segment.action === "none" ? "selected" : ""}>Résultat uniquement</option>
        <option value="action" ${segment.action === "action" ? "selected" : ""}>Action ShenPulse</option>
        <option value="spin" ${segment.action === "spin" ? "selected" : ""}>Relancer la roue</option>
      </select></label>
      <label class="field wheel-segment-action-select">${fieldLabelWithInfo("Action à lancer", OVERLAY_FIELD_HELP.wheelSegmentActionId)}<select name="wheelSegmentActionId">${wheelActionOptions(segment.actionId)}${segment.actionId && !flattenActions().some(({ action }) => action.id === segment.actionId) ? `<option value="${escapeHtml(segment.actionId)}" selected>Action liée indisponible dans ce profil</option>` : ""}</select></label>
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
  const previousTriggerGift = { ...wheel.triggerGift, value: wheel.trigger };
  wheel.trigger = triggerMode === "specific"
    ? String(data.get("wheelTrigger") || "").trim()
    : "";
  const selectedTriggerGift = giftReferenceForSave(
    wheel.trigger,
    data.get("wheelTriggerGiftId"),
    previousTriggerGift
  );
  wheel.triggerGift =
    triggerMode === "specific" && selectedTriggerGift
      ? selectedTriggerGift
      : null;
  wheel.giftValueFilter = triggerMode === "value"
    ? normalizeGiftValueFilterConfig({
        operator: data.get("wheelGiftValueOperator"),
        value: data.get("wheelGiftValueAmount")
      })
    : null;
  wheel.design = data.get("wheelDesign") === "royal" ? "royal" : "classic";
  const settings = wheel.settings;
  settings.textAlign = "center";
  for (const key of [
    "font",
    "wheelTitle",
    "wheelTitleColor",
    "wheelWinnerColor",
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
    "wheelTitleScale",
    "wheelTextScale",
    "wheelWinnerScale",
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
    "wheelShowTitle",
    "showBase",
    "soundActive",
    "showWinner",
    "alwaysVisible"
  ]) {
    if (data.has(key)) settings[key] = data.get(key) === "true";
  }
  const previousSegments = new Map(wheel.segments.map((segment) => [segment.id, segment]));
  wheel.segments = [...dialogBody.querySelectorAll("[data-wheel-segment-row]")].map(
    (row) => {
      const actionId =
        row.querySelector('[name="wheelSegmentActionId"]').value;
      const selectedMode =
        row.querySelector('[name="wheelSegmentAction"]').value;
      return {
        ...previousSegments.get(row.dataset.segmentId),
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
