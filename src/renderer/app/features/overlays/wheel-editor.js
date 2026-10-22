"use strict";

/** Configuration compacte des roues, sans recréer leurs identifiants et associations. */
function openWheelOverlayConfig(item, rawConfig = null) {
  if (!wheelEditorContext || wheelEditorContext.item.key !== item.key || rawConfig) {
    wheelEditorContext = { item, config: normalizeWheelConfig(rawConfig || overlayConfig(item.key)) };
  }
  const config = wheelEditorContext.config;
  const wheel = config.wheels.find((entry) => entry.id === config.selectedWheelId) || config.wheels[0];
  config.selectedWheelId = wheel.id;
  const settings = wheel.settings;
  const yesNo = [["true", "Oui"], ["false", "Non"]];
  const collection = dialogSection("Mes roues", "Chaque roue conserve ses secteurs, ses déclencheurs et ses actions.", `
    <div class="wheel-collection-toolbar">
      <label class="field wheel-collection-picker"><span>Roue à modifier</span><select data-wheel-selection aria-label="Roue à modifier">${config.wheels.map((entry, index) =>
        `<option value="${escapeHtml(entry.id)}" ${entry.id === wheel.id ? "selected" : ""}>${index + 1} · ${escapeHtml(entry.name)}</option>`
      ).join("")}</select></label>
      <div class="wheel-collection-actions">
        <button type="button" class="button small" data-wheel-command="add">＋ Créer</button>
        <button type="button" class="button small ghost" data-wheel-command="delete" ${config.wheels.length <= 1 ? "disabled" : ""}>Supprimer</button>
      </div>
    </div>
    ${overlayField("wheelName", "Nom interne de la roue", wheel.name, "text", "required")}
    ${overlaySelect("wheelDesign", "Design", wheel.design, item.options)}
  `);
  const title = dialogSection("Titre", "Le titre reste centré dans son cartouche, sur les deux designs.", `
    ${overlayField("wheelTitle", "Texte du titre", settings.wheelTitle ?? wheel.name)}
    ${overlaySelect("wheelShowTitle", "Afficher le titre", String(settings.wheelShowTitle !== false), yesNo)}
    ${overlayField("wheelTitleColor", "Couleur du titre", settings.wheelTitleColor || "#fff1c2", "color")}
  `, "wheel-title-settings");
  const segments = `<section class="dialog-section wheel-sectors-settings">
    <header class="wheel-sectors-heading"><div><h3>Secteurs & actions</h3><p>Le texte est centré automatiquement dans chaque secteur.</p></div><button type="button" class="button small" data-wheel-command="segment-add" ${wheel.segments.length >= 16 ? "disabled" : ""}>＋ Ajouter un secteur</button></header>
    <div class="wheel-segment-list">${wheel.segments.map((segment, index) => wheelSegmentEditor(segment, index, wheel.segments.length)).join("")}</div>
  </section>`;
  const advanced = `<details class="dialog-advanced"><summary>Réglages avancés</summary>
    ${dialogSection("Déclenchement", "Lancez cette roue manuellement, par une action ou par un cadeau TikTok.", giftTriggerConditionFields(wheelGiftValueConditions(wheel), {
      giftName: "wheelTrigger", giftLabel: "Cadeau TikTok", giftValue: wheel.trigger,
      giftId: wheel.triggerGift?.giftId || "", savedReference: wheel.triggerGift,
      modeName: "wheelGiftTriggerMode", operatorName: "wheelGiftValueOperator", amountName: "wheelGiftValueAmount"
    }))}
    ${dialogSection("État & visibilité", "Adaptez la roue à votre LIVE.", `
      ${overlaySelect("wheelEnabled", "Roue active", String(wheel.enabled), yesNo)}
      ${overlaySelect("alwaysVisible", "Visible au repos", String(settings.alwaysVisible), yesNo)}
      ${overlaySelect("showBase", "Afficher le socle", String(settings.showBase), yesNo)}
    `, "wheel-visibility-settings")}
    ${dialogSection("Texte & rendu", "Les textes s’ajustent à leur zone. Les tailles vont jusqu’à 400 %.", `
      ${overlaySelect("font", "Police", settings.font, [["Kalam", "Kalam"], ["Inter", "Inter"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Arial Rounded", "Arial Rounded"], ["System", "Système"]])}
      ${overlaySizeField("wheelTitleScale", "Taille du titre", settings.wheelTitleScale)}
      ${overlaySizeField("wheelTextScale", "Taille des secteurs", settings.wheelTextScale)}
      ${overlaySizeField("wheelWinnerScale", "Taille du résultat", settings.wheelWinnerScale)}
      ${overlayField("textColor", "Couleur des secteurs", settings.textColor, "color")}
      ${overlaySelect("textOrientation", "Orientation", settings.textOrientation === "vertical" || settings.textOrientation === "radial" ? "vertical" : "horizontal", [["horizontal", "Horizontale"], ["vertical", "Verticale"]])}
      ${overlayField("textShadowColor", "Couleur de l’ombre", settings.textShadowColor, "color")}
      ${overlayField("textShadowStrength", "Force de l’ombre", settings.textShadowStrength, "number", 'min="0" max="100"')}
      ${overlaySelect("textClamp", "Limiter les lignes", String(settings.textClamp), yesNo)}
      ${overlayField("textMaxLines", "Nombre de lignes", settings.textMaxLines, "number", 'min="1" max="4"')}
      ${overlayField("lineSpacing", "Interligne (%)", settings.lineSpacing, "number", 'min="0" max="100"')}
      ${overlayField("letterSpacing", "Espacement des lettres (%)", settings.letterSpacing, "number", 'min="0" max="100"')}
      ${overlaySizeField("glow", "Intensité lumineuse", settings.glow, { min: 0, max: 140 })}
    `, "wheel-render-settings")}
    ${dialogSection("Rotation & résultat", "Réglez la durée, le son et l’affichage du résultat.", `
      ${overlaySelect("soundActive", "Son de rotation", String(settings.soundActive), yesNo)}
      ${overlayField("spinDuration", "Durée de rotation (s)", settings.spinDuration, "number", 'min="1" max="30" step="0.1"')}
      ${overlayField("waitDuration", "Pause avant résultat (s)", settings.waitDuration, "number", 'min="0" max="15" step="0.1"')}
      ${overlaySelect("showWinner", "Afficher le résultat", String(settings.showWinner), yesNo)}
      ${overlayField("resultDuration", "Durée du résultat (s)", settings.resultDuration, "number", 'min="1" max="30" step="0.1"')}
      ${overlayField("wheelWinnerColor", "Couleur du résultat", settings.wheelWinnerColor || "#fff7d3", "color")}
      ${overlaySelect("pointerPosition", "Position du pointeur", settings.pointerPosition, [["top", "En haut"], ["right", "À droite"], ["bottom", "En bas"], ["left", "À gauche"]])}
      ${overlaySelect("entranceAnimation", "Animation d’entrée", settings.entranceAnimation, [["zoom", "Zoom"], ["fade", "Fondu"], ["slide", "Glissement"], ["none", "Aucune"]])}
      ${overlaySelect("exitAnimation", "Animation de sortie", settings.exitAnimation, [["fade", "Fondu"], ["zoom", "Zoom"], ["slide", "Glissement"], ["none", "Aucune"]])}
    `, "wheel-playback-settings")}
  </details>`;
  openEditor({
    title: "Configurer la roue d’actions",
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-wheel",
    body: `<div class="overlay-config-live-layout overlay-config-compact wheel-config-compact" data-overlay-config-editor="wheel"><div class="overlay-config-fields">${collection}${title}${segments}${advanced}</div>${overlayLivePreview(item, config)}</div>`,
    onSubmit: async () => {
      collectWheelEditorForm();
      const next = wheelEditorContext.config;
      const selected = next.wheels.find((entry) => entry.id === next.selectedWheelId) || next.wheels[0];
      if (selected.segments.length < 2) throw new Error("La roue doit contenir au moins deux segments.");
      next.title = selected.settings.wheelTitle ?? selected.name;
      next.design = selected.design;
      next.choices = selected.segments.map((segment) => segment.label);
      next.colors = selected.segments.map((segment) => segment.color);
      Object.assign(next, selected.settings);
      overlayDesignSelections[item.key] = selected.design;
      await saveOverlayConfig(item.key, next, { rerender: false, updateCard: true });
      wheelEditorContext = null;
    }
  });
  syncGiftTriggerCondition(dialogBody.querySelector("[data-gift-trigger-condition]"));
  syncWheelSegmentActionVisibility();
  dialogBody.querySelector("[data-wheel-selection]").addEventListener("change", (event) => {
    const selectedId = event.target.value;
    if (!config.wheels.some((entry) => entry.id === selectedId)) return;
    collectWheelEditorForm();
    config.selectedWheelId = selectedId;
    openWheelOverlayConfig(item);
  });
}
