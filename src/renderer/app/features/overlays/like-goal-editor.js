"use strict";

/** Configuration du Like Goal : contenu courant, puis réglages facultatifs. */
function openLikeGoalOverlayConfig(item) {
  const config = overlayConfig(item.key);
  const yesNo = [["true", "Oui"], ["false", "Non"]];
  const content = dialogSection("Objectif & design", "Les likes du LIVE alimentent automatiquement la progression.", `
    ${overlaySelect("theme", "Design", config.theme || item.defaultOption, item.options)}
    ${overlayField("target", "Objectif de likes", config.target ?? 50000, "number", 'min="1" max="999999999"')}
  `);
  const title = dialogSection("Titre", "Le titre reste automatiquement centré dans la zone haute de chaque design.", `
    ${overlayField("title", "Texte du titre", config.title ?? item.name, "text")}
    ${overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), yesNo)}
    ${overlayField("likeGoalTitleColor", "Couleur du titre", config.likeGoalTitleColor || config.textColor || "#ffffff", "color")}
  `, "like-goal-title-settings");
  const progress = dialogSection("Progression", "Le texte reste centré dans la barre, avec ou sans pourcentage.", `
    <div class="like-goal-progress-label-row">
      ${overlayField("likeGoalContentColor", "Couleur du texte", config.likeGoalContentColor || config.textColor || "#ffffff", "color")}
      ${overlayField("progressLabel", "Libellé après les valeurs", config.progressLabel ?? "likes", "text")}
      ${overlaySelect("showGoal", "Afficher le libellé", String(config.showGoal !== false), yesNo, false, "Affiche le libellé après les valeurs. Le compteur et la barre restent visibles.")}
    </div>
    ${overlaySelect("showPercent", "Afficher le pourcentage", String(config.showPercent !== false), yesNo)}
    ${overlayField("likeGoalPercentColor", "Couleur du pourcentage", config.likeGoalPercentColor || config.secondaryColor || "#ff4f86", "color")}
  `);
  const advanced = `<details class="dialog-advanced"><summary>Réglages avancés</summary>
    ${dialogSection("Fin de l’objectif", "Choisissez le comportement et l’action à chaque palier atteint.", `
      ${overlaySelect("whenReached", "Lorsque l’objectif est atteint", config.whenReached || "increase", [["keep", "Conserver l’objectif"], ["increase", "Augmenter l’objectif"], ["double", "Doubler l’objectif"], ["hide", "Masquer le Like Goal"]])}
      ${overlayActionSelect("completionActionId", "Action à lancer lorsque l’objectif est atteint", config.completionActionId, false)}
    `, "like-goal-completion-settings")}
    ${dialogSection("Compteur & visibilité", "Adaptez le point de départ et la visibilité à votre LIVE.", `
      ${overlayField("current", "Valeur de départ hors session", config.current ?? 0, "number", 'min="0" max="999999999"')}
      ${overlayField("goalBaseline", "Départ de la progression", config.goalBaseline ?? 0, "number", 'min="0" max="999999999"')}
      ${overlaySelect("enabled", "Overlay actif", String(config.enabled !== false), yesNo)}
      ${overlaySelect("showWhenIdle", "Visible au repos", String(config.showWhenIdle !== false), yesNo)}
    `, "like-goal-counter-settings")}
    ${dialogSection("Texte & rendu", "Réglez les tailles de 50 à 400 %. Le texte s’ajuste à la place disponible dans le design.", `
      <div class="like-goal-typography-row">
        ${overlaySelect("font", "Police", config.font || "Inter", [["Inter", "Inter"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Verdana", "Verdana"]])}
        ${overlaySizeField("likeGoalTitleScale", "Taille du titre", config.likeGoalTitleScale)}
        ${overlaySizeField("likeGoalContentScale", "Taille de la progression", config.likeGoalContentScale)}
      </div>
      ${overlaySelect("showShadow", "Afficher l’ombre", String(config.showShadow !== false), yesNo)}
      ${overlaySelect("rtl", "Sens de lecture", String(config.rtl === true), [["false", "Gauche vers droite"], ["true", "Droite vers gauche"]])}
      ${overlayField("saturation", "Saturation (%)", config.saturation ?? 100, "number", 'min="0" max="200"')}
      ${overlayField("hue", "Teinte (°)", config.hue ?? 0, "number", 'min="-180" max="180"')}
    `, "like-goal-render-settings")}
  </details>`;
  openEditor({
    title: "Configurer Like Goal",
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-live",
    body: `<div class="overlay-config-live-layout overlay-config-compact" data-overlay-config-editor="likeGoal">
      <div class="overlay-config-fields">${content}${title}${progress}${advanced}</div>
      ${overlayLivePreview(item, config)}
    </div>`,
    onSubmit: async (data) => {
      const next = overlayDraftConfig(item, config, data);
      overlayDesignSelections[item.key] = next.theme;
      await saveOverlayConfig(item.key, next, { rerender: false, updateCard: true });
    }
  });
}
