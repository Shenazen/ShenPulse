"use strict";

/** Apparence du bocal ; les associations et l’état de session restent inchangés. */
function openCoinJarOverlayConfig(item) {
  const config = overlayConfig(item.key);
  const yesNo = [["true", "Oui"], ["false", "Non"]];
  const content = dialogSection("Design", "Les cadeaux du LIVE remplissent automatiquement le bocal.", `
    ${overlaySelect("model", "Design du bocal", config.model || item.defaultOption, item.options)}
  `);
  const title = dialogSection("Titre", "Le titre reste centré au-dessus du bocal, sur chacun des 14 designs.", `
    ${overlayField("title", "Texte du titre", config.title ?? "COIN JAR")}
    ${overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), yesNo)}
    ${overlayField("coinJarTitleColor", "Couleur du titre", config.coinJarTitleColor || config.textColor || "#ffffff", "color")}
  `, "coin-jar-title-settings");
  const advanced = `<details class="dialog-advanced"><summary>Réglages avancés</summary>
    ${dialogSection("Visibilité", "Adaptez la visibilité du bocal à votre LIVE.", `
      ${overlaySelect("enabled", "Overlay actif", String(config.enabled !== false), yesNo)}
      ${overlaySelect("showWhenIdle", "Visible au repos", String(config.showWhenIdle !== false), yesNo)}
    `, "coin-jar-visibility-settings")}
    ${dialogSection("Texte & rendu", "Tailles de 50 à 400 %, avec ajustement automatique à la place disponible.", `
      ${overlaySelect("font", "Police", config.font || "Inter", [["Inter", "Inter"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Verdana", "Verdana"]])}
      ${overlaySizeField("coinJarTitleScale", "Taille du titre", config.coinJarTitleScale)}
      ${overlaySelect("showShadow", "Afficher l’ombre", String(config.showShadow !== false), yesNo)}
      ${overlaySelect("rtl", "Sens de lecture", String(config.rtl === true), [["false", "Gauche vers droite"], ["true", "Droite vers gauche"]])}
      ${overlayField("saturation", "Saturation (%)", config.saturation ?? 100, "number", 'min="0" max="200"')}
      ${overlayField("hue", "Teinte (°)", config.hue ?? 0, "number", 'min="-180" max="180"')}
    `, "coin-jar-render-settings")}
  </details>`;
  openEditor({
    title: "Configurer la Coin Jar",
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-coin-jar",
    body: `<div class="overlay-config-live-layout overlay-config-compact coin-jar-config-compact" data-overlay-config-editor="coinJar"><div class="overlay-config-fields">${content}${title}${advanced}</div>${overlayLivePreview(item, config)}</div>`,
    onSubmit: async (data) => {
      const next = overlayDraftConfig(item, config, data);
      overlayDesignSelections[item.key] = next.model;
      await saveOverlayConfig(item.key, next, { rerender: false, updateCard: true });
    }
  });
}
