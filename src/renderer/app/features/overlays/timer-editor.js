"use strict";

/** Édition visuelle du timer ; les identifiants d’actions et la session restent conservés. */
function openTimerOverlayConfig(item) {
  const config = overlayConfig(item.key);
  const isMultiplier = item.key === "multiplierTimer";
  const yesNo = [["true", "Oui"], ["false", "Non"]];
  const content = dialogSection("Durée & design", "La durée initiale reste compatible avec les actions et les jeux qui pilotent ce timer.", `
    ${overlaySelect("theme", "Design", config.theme || item.defaultOption, item.options, true)}
    ${overlayTimerDurationFields(config.seconds ?? (isMultiplier ? 120 : 300))}
  `);
  const title = dialogSection("Titre", "Le titre reste automatiquement centré dans la zone haute de chaque design.", `
    ${overlayField("title", "Texte du titre", config.title ?? item.name)}
    ${overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), yesNo)}
    ${overlayField("timerTitleColor", "Couleur du titre", config.timerTitleColor || config.accentColor || "#ffffff", "color")}
  `, "timer-title-settings");
  const clock = dialogSection("Chrono", "Le compte à rebours reste centré dans sa zone, avec ou sans heures.", `
    ${overlayField("timerValueColor", "Couleur du chrono", config.timerValueColor || config.textColor || "#ffffff", "color")}
    ${overlaySelect("showHours", "Afficher les heures", String(config.showHours !== false), yesNo)}
  `);
  const multiplier = isMultiplier ? dialogSection("Multiplicateur", "Les actions et les jeux peuvent continuer à modifier le bonus et sa durée.", `
    ${overlayField("multiplier", "Valeur du multiplicateur", config.multiplier ?? 2, "number", 'min="1" max="100" step="1"')}
    ${overlayField("timerMultiplierColor", "Couleur du multiplicateur", config.timerMultiplierColor || "#ffe575", "color")}
  `) : "";
  const advanced = `<details class="dialog-advanced"><summary>Réglages avancés</summary>
    ${isMultiplier ? "" : dialogSection("Fin du timer", "Conservez ou choisissez l’action à lancer à la fin du compte à rebours.", `
      ${overlayActionSelect("completionActionId", "Action à lancer lorsque le timer arrive à zéro", config.completionActionId)}
    `)}
    ${dialogSection("Démarrage & visibilité", "Les actions et les jeux peuvent toujours démarrer, ajuster ou mettre ce timer en pause.", `
      ${overlaySelect("timerAutoStart", "Démarrage automatique", String(config.timerAutoStart === true), yesNo)}
      ${overlaySelect("enabled", "Overlay actif", String(config.enabled !== false), yesNo)}
      ${overlaySelect("showWhenIdle", "Visible au repos", String(config.showWhenIdle !== false), yesNo)}
    `, "timer-visibility-settings")}
    ${dialogSection("Texte & rendu", "Réglez les tailles de 50 à 400 %. Le texte s’ajuste à la place disponible dans le design.", `
      <div class="timer-typography-row">
        ${overlaySelect("font", "Police", config.font || "Inter", [["Inter", "Inter"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Verdana", "Verdana"]])}
        ${overlaySizeField("timerTitleScale", "Taille du titre", config.timerTitleScale)}
        ${overlaySizeField("timerValueScale", "Taille du chrono", config.timerValueScale)}
      </div>
      ${overlaySelect("showShadow", "Afficher l’ombre", String(config.showShadow !== false), yesNo)}
      ${overlaySelect("rtl", "Sens de lecture", String(config.rtl === true), [["false", "Gauche vers droite"], ["true", "Droite vers gauche"]])}
      ${overlayField("saturation", "Saturation (%)", config.saturation ?? 100, "number", 'min="0" max="200"')}
      ${overlayField("hue", "Teinte (°)", config.hue ?? 0, "number", 'min="-180" max="180"')}
    `, "timer-render-settings")}
    ${isMultiplier ? "" : dialogSection("Raccourcis clavier", "Gardez vos commandes habituelles pour piloter ce timer.", `
      ${overlayField("incrementShortcut", "Ajouter 60 secondes", config.incrementShortcut ?? "Alt+W, Alt+ArrowUp")}
      ${overlayField("decrementShortcut", "Retirer 60 secondes", config.decrementShortcut ?? "Alt+S, Alt+ArrowDown")}
      ${overlayField("resetShortcut", "Réinitialiser", config.resetShortcut ?? "Alt+R, Alt+0")}
    `, "timer-shortcut-settings")}
  </details>`;
  openEditor({
    title: isMultiplier ? "Configurer le timer multiplicateur" : "Configurer le timer",
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-live",
    body: `<div class="overlay-config-live-layout overlay-config-compact" data-overlay-config-editor="${escapeHtml(item.key)}">
      <div class="overlay-config-fields">${content}${title}${clock}${multiplier}${advanced}</div>
      ${overlayLivePreview(item, config)}
    </div>`,
    onSubmit: async (data) => {
      const next = overlayDraftConfig(item, config, data);
      overlayDesignSelections[item.key] = next.theme;
      await saveOverlayConfig(item.key, next, { rerender: false, updateCard: true });
    }
  });
}
