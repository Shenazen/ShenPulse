"use strict";

/** Les deux classements partagent le formulaire, avec des configurations indépendantes. */
function openLeaderboardOverlayConfig(item) {
  const config = overlayConfig(item.key);
  const yesNo = [["true", "Oui"], ["false", "Non"]];
  const content = dialogSection("Classement & design", "Choisissez le design et le nombre de places affichées. Les scores du LIVE sont conservés.", `
    ${overlaySelect("theme", "Design", config.theme || item.defaultOption, item.options)}
    ${overlaySelect("maxRows", "Nombre de places", String(Math.min(5, config.maxRows ?? 5)), [1, 2, 3, 4, 5].map((count) => [String(count), String(count)]))}
  `);
  const title = dialogSection("Titre", "Le titre reste centré dans la zone haute de chaque design.", `
    ${overlayField("title", "Texte du titre", config.title ?? item.name)}
    ${overlaySelect("showHeader", "Afficher le titre", String(config.showHeader !== false), yesNo)}
    ${overlayField("leaderboardTitleColor", "Couleur du titre", config.leaderboardTitleColor || config.textColor || "#ffffff", "color")}
  `, "leaderboard-title-settings");
  const scores = dialogSection("Noms & scores", "Chaque nom et chaque score restent centrés dans leur ligne.", `
    ${overlayField("nameColor", "Couleur des noms", config.nameColor || "#ffffff", "color")}
    ${overlayField("scoreColor", "Couleur des scores", config.scoreColor || (item.key === "topTappers" ? "#ff8db8" : "#ffe575"), "color")}
    ${overlaySelect("showMetricLabel", "Afficher les scores", String(config.showMetricLabel !== false), yesNo)}
    <div class="leaderboard-unit-settings">
      ${overlayField("leaderboardMetricLabel", "Libellé après le score", config.leaderboardMetricLabel ?? (item.key === "topTappers" ? "likes" : "coins"))}
      ${overlaySelect("leaderboardShowUnit", "Afficher le libellé", String(config.leaderboardShowUnit !== false), yesNo)}
      ${overlayField("leaderboardUnitColor", "Couleur du libellé", config.leaderboardUnitColor || config.scoreColor || (item.key === "topTappers" ? "#ff8db8" : "#ffe575"), "color")}
    </div>
  `, "leaderboard-score-settings");
  const profiles = dialogSection("Profils & rangs", "Personnalisez les photos, les rangs et les décorations du podium.", `
    ${overlaySelect("showAvatars", "Photos de profil", String(config.showAvatars !== false), yesNo)}
    ${overlaySelect("showRank", "Afficher les rangs", String(config.showRank !== false), yesNo)}
    ${overlaySelect("showRankBadges", "Médailles & cadres", String(config.showRankBadges !== false), yesNo)}
    ${overlaySelect("showCrown", "Couronne du premier", String(config.showCrown !== false), yesNo)}
  `, "leaderboard-profile-settings");
  const advanced = `<details class="dialog-advanced"><summary>Réglages avancés</summary>
    ${dialogSection("Visibilité & lignes", "Réglez la présence du classement et le fond de ses lignes.", `
      ${overlaySelect("enabled", "Overlay actif", String(config.enabled !== false), yesNo)}
      ${overlaySelect("showWhenIdle", "Visible au repos", String(config.showWhenIdle !== false), yesNo)}
      ${overlayField("rowOpacity", "Opacité des lignes (%)", config.rowOpacity ?? 68, "number", 'min="0" max="100"')}
      ${overlayField("rankColor", "Couleur des rangs", config.rankColor || "#ffe575", "color")}
    `, "leaderboard-visibility-settings")}
    ${dialogSection("Texte & rendu", "Réglez les tailles de 50 à 400 %. Les textes s’ajustent à la place disponible dans le design.", `
      ${overlaySelect("font", "Police", config.font || "Inter", [["Inter", "Inter"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Impact", "Impact"], ["Verdana", "Verdana"]])}
      ${overlaySizeField("leaderboardTitleScale", "Taille du titre", config.leaderboardTitleScale)}
      ${overlaySizeField("leaderboardNameScale", "Taille des noms", config.leaderboardNameScale)}
      ${overlaySizeField("leaderboardScoreScale", "Taille des scores", config.leaderboardScoreScale)}
      ${overlaySizeField("leaderboardUnitScale", "Taille du libellé", config.leaderboardUnitScale)}
      ${overlaySizeField("leaderboardAvatarScale", "Taille des photos", config.leaderboardAvatarScale, { max: 100 })}
      ${overlaySelect("showShadow", "Afficher l’ombre", String(config.showShadow !== false), yesNo)}
      ${overlaySelect("rtl", "Sens de lecture", String(config.rtl === true), [["false", "Gauche vers droite"], ["true", "Droite vers gauche"]])}
      ${overlayField("saturation", "Saturation (%)", config.saturation ?? 100, "number", 'min="0" max="200"')}
      ${overlayField("hue", "Teinte (°)", config.hue ?? 0, "number", 'min="-180" max="180"')}
    `, "leaderboard-render-settings")}
  </details>`;
  openEditor({
    title: item.key === "topTappers" ? "Configurer le classement tapoteurs" : "Configurer le classement donateurs",
    kicker: `OVERLAY OBS · ${overlayProfileName().toLocaleUpperCase("fr")}`,
    variant: "overlay-live",
    body: `<div class="overlay-config-live-layout overlay-config-compact" data-overlay-config-editor="${escapeHtml(item.key)}">
      <div class="overlay-config-fields">${content}${title}${scores}${profiles}${advanced}</div>
      ${overlayLivePreview(item, config)}
    </div>`,
    onSubmit: async (data) => {
      const next = overlayDraftConfig(item, config, data);
      overlayDesignSelections[item.key] = next.theme;
      await saveOverlayConfig(item.key, next, { rerender: false, updateCard: true });
    }
  });
}
