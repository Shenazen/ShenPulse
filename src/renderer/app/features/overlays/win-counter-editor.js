"use strict";

/** Éditeur visuel WINS : les commandes, associations et données de session sont conservées. */
function openWinCounterOverlayConfig(item) {
  const config = overlayConfig(item.key);
  const yesNo = [["true", "Oui"], ["false", "Non"]];
  const design = dialogSection("Design", "Le titre et le compteur se centrent automatiquement dans chaque design.", `
    ${overlaySelect("theme", "Design", config.theme || item.defaultOption, item.options, true)}
  `);
  const title = dialogSection("Titre", "Personnalisez le titre ou masquez-le en conservant sa zone centrée.", `
    ${overlayField("title", "Texte du titre", config.title ?? "WIN")}
    ${overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), yesNo)}
    ${overlayField("winCounterTitleColor", "Couleur du titre", config.winCounterTitleColor || config.textColor || "#ffffff", "color")}
  `, "win-counter-title-settings");
  const counter = dialogSection("Compteur", "La couleur suit la valeur du compteur. Les actions et les jeux continuent à le piloter.", `
    ${overlayField("winCounterLabelColorNegative", "Couleur si négatif", config.winCounterLabelColorNegative || "#ff4f6d", "color")}
    ${overlayField("winCounterLabelColorNeutral", "Couleur à zéro", config.winCounterLabelColorNeutral || "#f8fafc", "color")}
    ${overlayField("winCounterLabelColorPositive", "Couleur si positif", config.winCounterLabelColorPositive || "#31ff74", "color")}
  `, "win-counter-colors-settings");
  const goal = dialogSection("Objectif", "L’objectif facultatif reste centré sous le compteur.", `
    ${overlayField("target", "Objectif de wins", config.target ?? 20, "number", 'min="1" step="1"')}
    ${overlaySelect("showGoal", "Afficher l’objectif", String(config.showGoal !== false), yesNo)}
    ${overlayField("winCounterGoalColor", "Couleur de l’objectif", config.winCounterGoalColor || config.textColor || "#ffffff", "color")}
  `, "win-counter-goal-settings");
  const advanced = `<details class="dialog-advanced"><summary>Réglages avancés</summary>
    ${dialogSection("Compteur & visibilité", "Adaptez le point de départ et la visibilité à votre LIVE.", `
      ${overlayField("current", "Valeur de départ hors session", config.current ?? 0, "number", 'step="1"')}
      ${overlaySelect("allowNegative", "Autoriser les valeurs négatives", String(config.allowNegative !== false), yesNo)}
      ${overlaySelect("enabled", "Overlay actif", String(config.enabled !== false), yesNo)}
      ${overlaySelect("showWhenIdle", "Visible au repos", String(config.showWhenIdle !== false), yesNo)}
    `, "win-counter-visibility-settings")}
    ${dialogSection("Texte & rendu", "Réglez les tailles de 50 à 400 %. Le texte s’ajuste à la place disponible dans le design.", `
      ${overlaySelect("font", "Police", config.font || "Inter", [["Inter", "Inter"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Verdana", "Verdana"]])}
      ${overlaySizeField("winCounterTitleScale", "Taille du titre", config.winCounterTitleScale)}
      ${overlaySizeField("winCounterValueScale", "Taille du compteur", config.winCounterValueScale)}
      ${overlaySizeField("winCounterGoalScale", "Taille de l’objectif", config.winCounterGoalScale)}
      ${overlaySelect("showShadow", "Afficher l’ombre", String(config.showShadow !== false), yesNo)}
      ${overlaySelect("rtl", "Sens de lecture", String(config.rtl === true), [["false", "Gauche vers droite"], ["true", "Droite vers gauche"]])}
      ${overlayField("saturation", "Saturation (%)", config.saturation ?? 100, "number", 'min="0" max="200"')}
      ${overlayField("hue", "Teinte (°)", config.hue ?? 0, "number", 'min="-180" max="180"')}
    `, "win-counter-render-settings")}
    ${dialogSection("Raccourcis clavier", "Gardez vos commandes habituelles pour ajuster ou réinitialiser les wins.", `
      ${overlayField("incrementShortcut", "Ajouter une win", config.incrementShortcut ?? "Alt+W, Alt+ArrowUp")}
      ${overlayField("decrementShortcut", "Retirer une win", config.decrementShortcut ?? "Alt+S, Alt+ArrowDown")}
      ${overlayField("resetShortcut", "Réinitialiser", config.resetShortcut ?? "Alt+R, Alt+0")}
    `, "win-counter-shortcut-settings")}
  </details>`;
  openEditor({
    title: "Configurer le compteur de wins",
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-live",
    body: `<div class="overlay-config-live-layout overlay-config-compact" data-overlay-config-editor="winCounter">
      <div class="overlay-config-fields">${design}${title}${counter}${goal}${advanced}</div>
      ${overlayLivePreview(item, config)}
    </div>`,
    onSubmit: async (data) => {
      const next = overlayDraftConfig(item, config, data);
      overlayDesignSelections[item.key] = next.theme;
      await saveOverlayConfig(item.key, next, { rerender: false, updateCard: true });
    }
  });
}
