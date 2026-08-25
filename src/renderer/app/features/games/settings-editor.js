function renderIntegratedGameFields(pack, config) {
  if (pack.id === "coin-pusher") {
    const activePanel = [
      "general",
      "board"
    ].includes(integratedSettingsPanels.get(pack.id))
      ? integratedSettingsPanels.get(pack.id)
      : "general";
    return `<div class="integrated-settings-tabs coin-pusher-settings-tabs">
      <input id="coin-settings-general" type="radio" name="integratedSettingsPanel" value="general" ${activePanel === "general" ? "checked" : ""}>
      <input id="coin-settings-board" type="radio" name="integratedSettingsPanel" value="board" ${activePanel === "board" ? "checked" : ""}>
      <nav class="integrated-settings-tab-nav" aria-label="Réglages Coin Pusher">
        ${integratedSettingsTabLabel("coin-settings-general", "01", "Général", "Manche, classement et physique")}
        ${integratedSettingsTabLabel("coin-settings-board", "02", "Plateau & scores", "Design, cases et dotations")}
      </nav>
      <div class="integrated-settings-tab-panels">
        <section data-integrated-panel="general" class="integrated-settings-sections">
          <article class="integrated-settings-card">
            <header><span>01</span><div><h4>Manche et classement</h4><p>Durée, podium et capacité physique du jeu original.</p></div></header>
            <div class="integrated-settings-grid">
              ${integratedNumberField("roundDurationMinutes", "Durée d’une manche (min)", config.roundDurationMinutes, 1, 180)}
              ${integratedNumberField("topN", "Joueurs récompensés", config.topN, 1, 10)}
              ${integratedNumberField("maxCoins", "Capacité simultanée", config.maxCoins, 80, 999999, 20)}
              ${integratedNumberField("volume", "Volume général", config.volume, 0, 1, 0.05)}
            </div>
          </article>
          <article class="integrated-settings-card">
            <header><span>02</span><div><h4>Physique</h4><p>Vitesse du poussoir, taille des pièces et pertes latérales.</p></div></header>
            <div class="integrated-settings-grid">
              ${integratedNumberField("pusherSpeed", "Vitesse du poussoir", config.pusherSpeed, 0.5, 2, 0.1)}
              ${integratedNumberField("coinScale", "Taille des pièces", config.coinScale, 0.6, 2.2, 0.1)}
              ${integratedToggle("sideLossEnabled", "Pertes latérales", "Les pièces peuvent tomber sur les côtés du plateau.", config.sideLossEnabled)}
            </div>
          </article>
        </section>
        <section data-integrated-panel="board" class="integrated-settings-sections">
          <article class="integrated-settings-card integrated-settings-card-wide coin-pusher-design-card">
            <header><span>03</span><div><h4>Direction artistique</h4><p>Retrouvez les deux modèles graphiques complets de ShenazenOverlay.</p></div></header>
            <div class="coin-pusher-theme-selector" role="radiogroup" aria-label="Modèle graphique du Coin Pusher">
              ${renderCoinPusherThemeChoice({
                checked: config.theme !== "galactic-palace",
                description: "Cyan électrique, or brossé et ambiance live arcade.",
                features: ["Lumineux", "Signature", "Dynamique"],
                kicker: "DESIGN ORIGINAL",
                label: "Arcade ShenPulse",
                theme: "arcade"
              })}
              ${renderCoinPusherThemeChoice({
                checked: config.theme === "galactic-palace",
                description: "Obsidienne, joaillerie impériale et néons cosmiques.",
                features: ["Prestige", "Cinématique", "Immersif"],
                kicker: "SECOND MODÈLE",
                label: "Palais galactique",
                theme: "galactic-palace"
              })}
            </div>
          </article>
          <article class="integrated-settings-card integrated-settings-card-wide coin-pusher-artwork-card">
            <header><span>04</span><div><h4>Photos personnalisées</h4><p>Importez directement une photo depuis le PC, comme auparavant. ShenPulse la redimensionne et l’enregistre localement en WebP.</p></div></header>
            <div class="coin-pusher-artwork-grid">
              ${renderCoinPusherArtworkPanel("platform", config)}
              ${renderCoinPusherArtworkPanel("plinko", config)}
            </div>
            <small class="coin-pusher-artwork-help">PNG, JPG, GIF, AVIF ou WebP · 20 Mo maximum. L’image optimisée reste attachée au profil actif et ne dépend d’aucun hébergeur externe.</small>
          </article>
          <article class="integrated-settings-card">
            <header><span>05</span><div><h4>Cases et dotations</h4><p>Valeurs des cases et pourcentage attribué à chaque rang.</p></div></header>
            <div class="integrated-settings-grid">
              ${integratedTextArea("scoreSlots", "Cases de points", config.scoreSlots.join(", "), "De 3 à 12 valeurs, négatives ou positives.")}
              ${integratedTextArea("winnerPrizePercents", "Dotations du classement (%)", config.winnerPrizePercents.join(", "), "Un pourcentage par rang, jusqu’au Top 10.")}
            </div>
          </article>
        </section>
      </div>
    </div>`;
  }
  if (pack.id === "connect-four") {
    return `<div class="integrated-settings-sections">
      <section class="integrated-settings-card">
        <header><span>01</span><div><h4>Grille et victoire</h4><p>Les mêmes limites que le Puissance 4 de ShenazenOverlay.</p></div></header>
        <div class="integrated-settings-grid">
          ${integratedNumberField("columns", "Colonnes", config.columns, 4, 12)}
          ${integratedNumberField("rows", "Lignes", config.rows, 4, 10)}
          <label class="integrated-setting-field"><span>Jetons à aligner</span><select name="winLength">${[4, 5, 6].map((value) => `<option value="${value}" ${Number(config.winLength) === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>
        </div>
      </section>
      <section class="integrated-settings-card">
        <header><span>02</span><div><h4>Entrées et récompenses</h4><p>Les montants sont propres au profil actif.</p></div></header>
        <div class="integrated-settings-grid">
          ${integratedNumberField("duelEntryCost", "Entrée duel", config.duelEntryCost, 0, 999999)}
          ${integratedNumberField("aiEasyEntryCost", "Entrée IA facile", config.aiEasyEntryCost, 0, 999999)}
          ${integratedNumberField("aiHardEntryCost", "Entrée IA difficile", config.aiHardEntryCost, 0, 999999)}
          <label class="integrated-setting-toggle"><input name="rewardsEnabled" type="checkbox" ${config.rewardsEnabled ? "checked" : ""}><span><strong>Récompenses actives</strong><small>Attribuer des points selon l’alignement gagnant.</small></span></label>
          ${integratedNumberField("rewardHorizontal", "Récompense horizontale", config.rewards.horizontal, 0, 999999)}
          ${integratedNumberField("rewardVertical", "Récompense verticale", config.rewards.vertical, 0, 999999)}
          ${integratedNumberField("rewardDiagonal", "Récompense diagonale", config.rewards.diagonal, 0, 999999)}
        </div>
      </section>
    </div>`;
  }
  const bankerRequests = Array.isArray(config.bankerRequests)
    ? config.bankerRequests.slice(0, 12)
    : [];
  const showCheatTab = canUseDealCheatSettings();
  const allowedPanels = [
    "access",
    "boxes",
    "rounds",
    "banker",
    "music",
    ...(showCheatTab ? ["cheat"] : [])
  ];
  const activePanel = allowedPanels.includes(
    integratedSettingsPanels.get(pack.id)
  )
    ? integratedSettingsPanels.get(pack.id)
    : "access";
  return `<div class="integrated-settings-tabs deal-settings-tabs">
    <input id="deal-settings-access" type="radio" name="integratedSettingsPanel" value="access" ${activePanel === "access" ? "checked" : ""}>
    <input id="deal-settings-boxes" type="radio" name="integratedSettingsPanel" value="boxes" ${activePanel === "boxes" ? "checked" : ""}>
    <input id="deal-settings-rounds" type="radio" name="integratedSettingsPanel" value="rounds" ${activePanel === "rounds" ? "checked" : ""}>
    <input id="deal-settings-banker" type="radio" name="integratedSettingsPanel" value="banker" ${activePanel === "banker" ? "checked" : ""}>
    <input id="deal-settings-music" type="radio" name="integratedSettingsPanel" value="music" ${activePanel === "music" ? "checked" : ""}>
    ${showCheatTab ? `<input id="deal-settings-cheat" type="radio" name="integratedSettingsPanel" value="cheat" ${activePanel === "cheat" ? "checked" : ""}>` : ""}
    <nav class="integrated-settings-tab-nav" aria-label="Réglages DealOrNoDeal">
      ${integratedSettingsTabLabel("deal-settings-access", "01", "Accès", "Prix normal et entrée Premium")}
      ${integratedSettingsTabLabel("deal-settings-boxes", "02", "Boîtes", "Les 24 valeurs de la partie")}
      ${integratedSettingsTabLabel("deal-settings-rounds", "03", "Manches", "Rythme des appels du banquier")}
      ${integratedSettingsTabLabel("deal-settings-banker", "04", "Banquier", "Offres, échanges et achats")}
      ${integratedSettingsTabLabel("deal-settings-music", "05", "Musique", "Ambiance de chaque scène")}
      ${showCheatTab ? integratedSettingsTabLabel("deal-settings-cheat", "!", "Triche", "Équilibrage privé du jeu", "cheat-tab-label") : ""}
    </nav>
    <div class="integrated-settings-tab-panels">
      <section data-integrated-panel="access" class="integrated-settings-sections">
        <article class="integrated-settings-card">
          <header><span>01</span><div><h4>Prix d’entrée</h4><p>Coût normal nécessaire pour rejoindre la file du jeu.</p></div></header>
          <div class="integrated-settings-grid">
            ${integratedNumberField("entryCost", "Entrée normale (diamants)", config.entryCost, 1, 999999)}
          </div>
        </article>
        <article class="integrated-settings-card">
          <header><span>+</span><div><h4>Entrée premium</h4><p>Option de dépense supérieure avec récompenses multipliées.</p></div></header>
          <div class="integrated-settings-grid">
            ${integratedToggle("spendEnabled", "Activer l’entrée premium", "Propose une deuxième option au joueur.", config.spend.enabled)}
            ${integratedNumberField("spendPremiumEntryCost", "Prix premium", config.spend.premiumEntryCost, 1, 999999)}
            ${integratedNumberField("spendRewardMultiplier", "Multiplicateur des gains", config.spend.rewardMultiplier, 0.01, 100, 0.01)}
          </div>
        </article>
      </section>
      <section data-integrated-panel="boxes" class="integrated-settings-sections">
        <article class="integrated-settings-card integrated-settings-card-wide">
          <header><span>02</span><div><h4>Valeurs des 24 boîtes</h4><p>La liste originale accepte aussi les valeurs négatives, mais jamais zéro ni doublon.</p></div></header>
          <div class="integrated-settings-metrics">
            <span><small>Plus petite valeur</small><strong>${escapeHtml(formatDealHostValue(Math.min(...config.boxValues)))} ♦</strong></span>
            <span><small>Plus grande valeur</small><strong>${escapeHtml(formatDealHostValue(Math.max(...config.boxValues)))} ♦</strong></span>
            <span><small>Configuration</small><strong>24 / 24</strong></span>
          </div>
          ${renderDealBoxValueFields(config.boxValues)}
        </article>
      </section>
      <section data-integrated-panel="rounds" class="integrated-settings-sections">
        <article class="integrated-settings-card integrated-settings-card-wide">
          <header><span>03</span><div><h4>Rythme des manches</h4><p>Nombre de boîtes ouvertes avant chaque appel du banquier.</p></div></header>
          <div class="integrated-settings-grid">
            ${integratedTextArea("roundPattern", "Boîtes à ouvrir par manche", config.roundPattern.join(", "), "Jusqu’à 12 manches. Réglage original : 6, 5, 4, 3, 2, 1, 1, 1.")}
          </div>
          ${renderDealRoundPreview(config.roundPattern)}
        </article>
      </section>
      <section data-integrated-panel="banker" class="integrated-settings-stack">
        <header class="integrated-section-toolbar">
          <div><strong>Demandes du banquier</strong><small>Offres, échanges et achats pondérés ou forcés selon l’avancement.</small></div>
          <button class="button" type="button" data-action="add-deal-banker-request" ${bankerRequests.length >= 12 ? "disabled" : ""}>＋ Ajouter une demande</button>
        </header>
        <input type="hidden" name="bankerRequestCount" value="${bankerRequests.length}">
        ${bankerRequests.map((request, index) => renderDealBankerRequest(request, index, bankerRequests.length)).join("")}
      </section>
      <section data-integrated-panel="music" class="integrated-music-list">
        <header class="integrated-section-toolbar">
          <div><strong>Ambiances musicales</strong><small>Chaque moment du jeu possède sa piste d’origine et peut recevoir une URL personnalisée.</small></div>
        </header>
        ${renderDealMusicFields(config)}
      </section>
      ${showCheatTab ? `<section data-integrated-panel="cheat" class="integrated-settings-sections integrated-cheat-panel">
        <article class="integrated-settings-card integrated-settings-card-wide">
          <header><span>!</span><div><h4>Triche et équilibrage privé</h4><p>Cet onglet propriétaire reprend exactement les probabilités spéciales de ShenazenOverlay.</p></div></header>
          <div class="integrated-settings-grid">
            ${integratedToggle("riggingEnabled", "Activer les probabilités spéciales", "Autorise les deux règles de triche ci-dessous.", config.rigging.enabled)}
            ${integratedNumberField("riggingSelectedThreshold", "Seuil d’une grosse valeur", config.rigging.selectedBoxBigValueThreshold, -999999, 999999)}
            ${integratedNumberField("riggingSelectedChancePercent", "Chance de grosse valeur dans la boîte choisie (%)", Number(config.rigging.selectedBoxBigValueChance || 0) * 100, 0, 100, 0.01)}
            ${integratedNumberField("riggingFinalLowValue", "Valeur piège du choix final", config.rigging.finalChoiceLowValue, -999999, 999999)}
            ${integratedNumberField("riggingFinalHighThreshold", "Seuil haut du duel final", config.rigging.finalChoiceHighValueThreshold, -999999, 999999)}
            ${integratedNumberField("riggingFinalLowChancePercent", "Chance d’imposer la valeur piège (%)", Number(config.rigging.finalChoiceLowValueChance || 0) * 100, 0, 100, 0.01)}
          </div>
        </article>
      </section>` : ""}
    </div>
  </div>`;
}

function renderIntegratedGameSettings(pack, unlocked) {
  const config = integratedGameSettings(pack.id);
  const coinPusher = pack.id === "coin-pusher";
  return `<div class="integrated-game-config-page">
    ${pack.id === "deal-or-no-deal" ? renderDealPrivateMonitor() : ""}
    <form class="integrated-game-settings" data-integrated-game-settings="${escapeHtml(pack.id)}">
    <section class="game-interaction-toolbar integrated-settings-heading">
      <div><span>⚙ RÉGLAGES DU JEU</span><h3>Configurer ${escapeHtml(pack.name)}</h3><p>Chaque rubrique regroupe une seule partie du jeu. Les changements restent propres au profil ${escapeHtml(overlayProfileName())}.</p></div>
      <div class="integrated-settings-profile"><small>PROFIL ACTIF</small><strong>${escapeHtml(overlayProfileName())}</strong></div>
    </section>
    ${renderGamePageMessage(pack, "installation")}
    ${renderIntegratedGameFields(pack, config)}
    <footer class="game-step-footer integrated-settings-actions">
      <div><strong>Jeu local prêt</strong><small>Aucune installation externe n’est nécessaire.</small></div>
      <button class="button" type="submit" ${unlocked ? "" : "disabled"}>Enregistrer</button>
      ${coinPusher
        ? `<button class="button primary" type="button" data-action="game-step" data-value="interactions" ${unlocked ? "" : "disabled"}>Continuer vers les interactions →</button>`
        : `<button class="button primary game-launch-button" type="submit" data-launch-after-save="true" ${unlocked ? "" : "disabled"}>▶ Enregistrer et ouvrir le jeu</button>
          <button class="button ghost" type="button" data-action="game-step" data-value="launch" ${unlocked ? "" : "disabled"}>Voir le démarrage →</button>`}
    </footer>
    </form>
  </div>`;
}

function integratedGiftDefinition(name, fallback = {}, giftId = "") {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    return { giftId: "", name: "", image: "", cost: 0 };
  }
  const gift = giftForIdentity(cleanName, giftId);
  const sameAsFallback =
    normalizeGiftName(cleanName) === normalizeGiftName(fallback.name);
  return {
    giftId: String(
      gift?.id || (sameAsFallback ? fallback.giftId : "") || ""
    ).trim(),
    name: cleanName,
    image: String(
      gift?.imageUrl || (sameAsFallback ? fallback.image : "") || ""
    ).trim(),
    cost: Math.max(
      0,
      Math.round(
        Number(gift?.cost ?? (sameAsFallback ? fallback.cost : 0)) || 0
      )
    )
  };
}

function integratedSettingsFromForm(gameId, data) {
  const current = integratedGameSettings(gameId);
  const number = (name, fallback, minimum, maximum) => {
    const value = Number(data.get(name));
    return Number.isFinite(value)
      ? Math.min(maximum, Math.max(minimum, value))
      : fallback;
  };
  if (gameId === "coin-pusher") {
    const scoreSlots = integratedNumberList(data.get("scoreSlots"))
      .map((value) => Math.max(-9999, Math.min(9999, Math.round(value))))
      .slice(0, 12);
    const winnerPrizePercents = integratedNumberList(
      data.get("winnerPrizePercents")
    )
      .map((value) => Math.max(0, Math.min(100, value)))
      .slice(0, 10);
    return {
      ...current,
      capacityModelVersion: 2,
      theme: data.get("theme") === "galactic-palace" ? "galactic-palace" : "arcade",
      roundDurationMinutes: Math.round(
        number("roundDurationMinutes", current.roundDurationMinutes, 1, 180)
      ),
      topN: Math.round(number("topN", current.topN, 1, 10)),
      maxCoins: Math.round(
        number("maxCoins", current.maxCoins, 80, Number.MAX_SAFE_INTEGER)
      ),
      pusherSpeed: number("pusherSpeed", current.pusherSpeed, 0.5, 2),
      coinScale: number("coinScale", current.coinScale, 0.6, 2.2),
      volume: number("volume", current.volume, 0, 1),
      sideLossEnabled: data.has("sideLossEnabled"),
      platformImageUrl: String(data.get("platformImageUrl") || "").trim(),
      plinkoImageUrl: String(data.get("plinkoImageUrl") || "").trim(),
      scoreSlots: scoreSlots.length >= 3 ? scoreSlots : current.scoreSlots,
      winnerPrizePercents: winnerPrizePercents.length
        ? winnerPrizePercents
        : current.winnerPrizePercents
    };
  }
  if (gameId === "connect-four") {
    const winLength = Math.round(number("winLength", 4, 4, 6));
    return {
      columns: Math.round(number("columns", 7, 4, 12)),
      rows: Math.round(number("rows", 6, 4, 10)),
      winLength: [4, 5, 6].includes(winLength) ? winLength : 4,
      duelEntryCost: Math.round(number("duelEntryCost", 0, 0, 999999)),
      aiEasyEntryCost: Math.round(number("aiEasyEntryCost", 0, 0, 999999)),
      aiHardEntryCost: Math.round(number("aiHardEntryCost", 0, 0, 999999)),
      rewardsEnabled: data.has("rewardsEnabled"),
      rewards: {
        horizontal: Math.round(number("rewardHorizontal", 0, 0, 999999)),
        vertical: Math.round(number("rewardVertical", 0, 0, 999999)),
        diagonal: Math.round(number("rewardDiagonal", 0, 0, 999999))
      }
    };
  }
  const individualBoxValues = data.getAll("boxValue");
  const boxValues = integratedNumberList(
    individualBoxValues.length ? individualBoxValues : data.get("boxValues")
  )
    .map((value) => Math.max(-999999, Math.min(999999, Math.round(value))))
    .filter((value) => value !== 0);
  if (boxValues.length !== 24 || new Set(boxValues).size !== 24) {
    throw new Error(
      "DealOrNoDeal exige exactement 24 valeurs de boîtes uniques et différentes de zéro."
    );
  }
  const roundPattern = integratedNumberList(data.get("roundPattern"))
    .map((value) => Math.round(value))
    .filter((value) => value > 0)
    .slice(0, 12);
  if (!roundPattern.length) {
    throw new Error("Ajoutez au moins une manche pour DealOrNoDeal.");
  }
  const bankerRequests = [];
  const bankerCount = Math.min(
    12,
    Math.max(0, Math.round(Number(data.get("bankerRequestCount")) || 0))
  );
  for (let index = 0; index < bankerCount; index += 1) {
    const type = String(data.get(`banker.${index}.type`) || "cashOffer");
    const cleanType = ["cashOffer", "swapBox", "buyBox"].includes(type)
      ? type
      : "cashOffer";
    const targetMode = String(
      data.get(`banker.${index}.targetMode`) || "random"
    );
    bankerRequests.push({
      id:
        String(data.get(`banker.${index}.id`) || "").trim() ||
        `banker-request-${Date.now()}-${index + 1}`,
      type: cleanType,
      enabled: data.has(`banker.${index}.enabled`),
      weight: Math.round(
        number(`banker.${index}.weight`, 1, 0, 999)
      ),
      amount: Math.round(
        number(`banker.${index}.amount`, 0, 0, 999999)
      ),
      targetMode:
        cleanType === "swapBox"
          ? "playerChoice"
          : ["random", "highest", "lowest", "playerChoice"].includes(targetMode)
            ? targetMode
            : "random",
      forceAfterOpenedCount: Math.round(
        number(`banker.${index}.forceAfterOpenedCount`, 0, 0, 21)
      )
    });
  }
  if (
    !bankerRequests.some(
      (request) =>
        request.enabled &&
        (request.weight > 0 || request.forceAfterOpenedCount > 0)
    )
  ) {
    throw new Error(
      "Activez au moins une demande du banquier avec un poids ou un déclenchement forcé."
    );
  }
  const music = {};
  for (const scene of [
    "waiting",
    "dramaticLoss",
    "funeral",
    "badRun",
    "uncertain",
    "bankerOffer",
    "heroicOffer",
    "solemnFinal",
    "heroicTension",
    "finalDuel"
  ]) {
    const url = String(data.get(`music.${scene}.url`) || "")
      .trim()
      .slice(0, 1200);
    if (!url || /^javascript:/i.test(url)) continue;
    music[scene] = {
      title: String(data.get(`music.${scene}.title`) || "")
        .trim()
        .slice(0, 160),
      url
    };
  }
  const rigging = canUseDealCheatSettings()
    ? {
        enabled: data.has("riggingEnabled"),
        selectedBoxBigValueThreshold: Math.round(
          number(
            "riggingSelectedThreshold",
            current.rigging.selectedBoxBigValueThreshold,
            -999999,
            999999
          )
        ),
        selectedBoxBigValueChance:
          number(
            "riggingSelectedChancePercent",
            current.rigging.selectedBoxBigValueChance * 100,
            0,
            100
          ) / 100,
        finalChoiceLowValue: Math.round(
          number(
            "riggingFinalLowValue",
            current.rigging.finalChoiceLowValue,
            -999999,
            999999
          )
        ),
        finalChoiceHighValueThreshold: Math.round(
          number(
            "riggingFinalHighThreshold",
            current.rigging.finalChoiceHighValueThreshold,
            -999999,
            999999
          )
        ),
        finalChoiceLowValueChance:
          number(
            "riggingFinalLowChancePercent",
            current.rigging.finalChoiceLowValueChance * 100,
            0,
            100
          ) / 100
      }
    : structuredClone(current.rigging);
  return {
    boxValues: boxValues.sort((left, right) => left - right),
    entryCost: Math.round(number("entryCost", current.entryCost, 1, 999999)),
    roundPattern,
    bankerRequests,
    music,
    rigging,
    spend: {
      enabled: data.has("spendEnabled"),
      premiumEntryCost: Math.round(
        number(
          "spendPremiumEntryCost",
          current.spend.premiumEntryCost,
          1,
          999999
        )
      ),
      rewardMultiplier: number(
        "spendRewardMultiplier",
        current.spend.rewardMultiplier,
        0.01,
        100
      )
    }
  };
}
