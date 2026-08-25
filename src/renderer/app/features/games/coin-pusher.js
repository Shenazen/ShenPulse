"use strict";

/**
 * Interactions et barèmes propres à Coin Pusher.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderCoinPusherTierRow(tier = { diamonds: 1, coinCount: 1 }) {
  return `<div class="coin-pusher-tier-row" data-coin-pusher-tier-row>
    <label>
      <span>Valeur du cadeau</span>
      <div><input name="coinPusherTierDiamonds" type="number" min="1" max="999999999" step="1" value="${escapeHtml(Math.max(1, Math.round(Number(tier.diamonds) || 1)))}" required><small>diamants</small></div>
    </label>
    <span class="coin-pusher-tier-arrow" aria-hidden="true">→</span>
    <label>
      <span>Pièces générées</span>
      <div><input name="coinPusherTierCoinCount" type="number" min="1" max="999999999" step="1" value="${escapeHtml(Math.max(1, Math.round(Number(tier.coinCount) || 1)))}" required><small>pièces</small></div>
    </label>
    <button type="button" class="coin-pusher-row-remove" data-action="remove-coin-pusher-tier" title="Supprimer ce palier" aria-label="Supprimer ce palier">×</button>
  </div>`;
}

function renderCoinPusherGiftRuleRow(rule = {}) {
  return `<div class="coin-pusher-gift-rule-row" data-coin-pusher-gift-rule-row>
    ${giftPickerField(
      "coinPusherGiftRuleName",
      "Cadeau TikTok",
      rule.name || "",
      "",
      "",
      rule.giftId || ""
    )}
    <label class="coin-pusher-compact-field">
      <span>Pièces générées</span>
      <div><input name="coinPusherGiftRuleCoinCount" type="number" min="1" max="999999999" step="1" value="${escapeHtml(Math.max(1, Math.round(Number(rule.coinCount) || 1)))}" required><small>pièces</small></div>
    </label>
    <label class="coin-pusher-compact-field">
      <span>État</span>
      <select name="coinPusherGiftRuleEnabled">
        <option value="true" ${rule.enabled !== false ? "selected" : ""}>Active</option>
        <option value="false" ${rule.enabled === false ? "selected" : ""}>Inactive</option>
      </select>
    </label>
    <button type="button" class="coin-pusher-row-remove" data-action="remove-coin-pusher-gift-rule" title="Supprimer cette exception" aria-label="Supprimer cette exception">×</button>
  </div>`;
}

function coinPusherInteractionSettingsFromForm(data) {
  const current = integratedGameSettings("coin-pusher");
  const number = (name, fallback, minimum, maximum) => {
    const value = Number(data.get(name));
    return Number.isFinite(value)
      ? Math.min(maximum, Math.max(minimum, value))
      : fallback;
  };
  const sortedRange = (minimumName, maximumName, fallbackMinimum, fallbackMaximum, limit) => [
    Math.round(number(minimumName, fallbackMinimum, 1, limit)),
    Math.round(number(maximumName, fallbackMaximum, 1, limit))
  ].sort((left, right) => left - right);
  const diamonds = data.getAll("coinPusherTierDiamonds");
  const coinCounts = data.getAll("coinPusherTierCoinCount");
  const tierByValue = new Map();
  diamonds.slice(0, 20).forEach((value, index) => {
    const diamondValue = Math.round(Number(value));
    const coinCount = Math.round(Number(coinCounts[index]));
    if (diamondValue > 0 && coinCount > 0) {
      tierByValue.set(diamondValue, { diamonds: diamondValue, coinCount });
    }
  });
  if (!tierByValue.has(1)) {
    tierByValue.set(1, {
      diamonds: 1,
      coinCount:
        current.diamondCoinTiers.find((tier) => Number(tier.diamonds) === 1)
          ?.coinCount || 1
    });
  }
  const oneDiamondTier = tierByValue.get(1);
  const diamondCoinTiers = [
    ...[...tierByValue.values()]
      .filter((tier) => tier.diamonds !== 1)
      .sort((left, right) => right.diamonds - left.diamonds)
      .slice(0, 19),
    oneDiamondTier
  ].sort((left, right) => right.diamonds - left.diamonds);

  const giftNames = data.getAll("coinPusherGiftRuleName");
  const giftIds = data.getAll("coinPusherGiftRuleNameGiftId");
  const giftCoinCounts = data.getAll("coinPusherGiftRuleCoinCount");
  const giftEnabledValues = data.getAll("coinPusherGiftRuleEnabled");
  const giftRules = giftNames
    .slice(0, 100)
    .map((name, index) => {
      const cleanName = String(name || "").trim();
      const fallback = current.giftRules.find(
        (rule) => normalizeGiftName(rule.name) === normalizeGiftName(cleanName)
      ) || current.giftRules[index] || {};
      return {
        ...integratedGiftDefinition(cleanName, fallback, giftIds[index]),
        coinCount: Math.max(1, Math.round(Number(giftCoinCounts[index]) || 1)),
        enabled: giftEnabledValues[index] !== "false"
      };
    })
    .filter((rule) => rule.name || rule.giftId);
  const giftRuleByKey = new Map();
  for (const rule of giftRules) {
    const key = rule.giftId || normalizeGiftName(rule.name);
    if (key) giftRuleByKey.set(key, rule);
  }
  const pointsRange = sortedRange(
    "mysteryPointsMin",
    "mysteryPointsMax",
    current.mysteryCube.pointsBonusMin,
    current.mysteryCube.pointsBonusMax,
    1000000
  );
  const rainRange = sortedRange(
    "mysteryCoinRainMin",
    "mysteryCoinRainMax",
    current.mysteryCube.coinRainMin,
    current.mysteryCube.coinRainMax,
    10000
  );
  const ticketRange = sortedRange(
    "ticketsMinPoints",
    "ticketsMaxPoints",
    current.tickets.minPoints,
    current.tickets.maxPoints,
    1000000
  );

  return {
    ...current,
    capacityModelVersion: 2,
    diamondCoinTiers,
    giftRules: [...giftRuleByKey.values()],
    guardGift: {
      ...integratedGiftDefinition(
        data.get("guardGiftName"),
        current.guardGift,
        data.get("guardGiftNameGiftId")
      ),
      durationSeconds: number(
        "guardGiftDurationSeconds",
        current.guardGift.durationSeconds,
        1,
        300
      ),
      includeCoinDrop: data.has("guardGiftIncludeCoinDrop")
    },
    mysteryCube: {
      ...integratedGiftDefinition(
        data.get("mysteryGiftName"),
        current.mysteryCube,
        data.get("mysteryGiftNameGiftId")
      ),
      enabled: data.has("mysteryEnabled"),
      spawnChance: number(
        "mysterySpawnChance",
        current.mysteryCube.spawnChance,
        0,
        100
      ),
      includeCoinDrop: data.has("mysteryIncludeCoinDrop"),
      pointsBonusEnabled: data.has("mysteryPointsEnabled"),
      pointsBonusMin: pointsRange[0],
      pointsBonusMax: pointsRange[1],
      coinRainEnabled: data.has("mysteryCoinRainEnabled"),
      coinRainMin: rainRange[0],
      coinRainMax: rainRange[1],
      multiplierEnabled: data.has("mysteryMultiplierEnabled"),
      multiplierValue: number(
        "mysteryMultiplierValue",
        current.mysteryCube.multiplierValue,
        1.1,
        10
      ),
      multiplierDurationSeconds: number(
        "mysteryMultiplierDurationSeconds",
        current.mysteryCube.multiplierDurationSeconds,
        1,
        300
      ),
      barriersEnabled: data.has("mysteryBarriersEnabled"),
      barriersDurationSeconds: number(
        "mysteryBarriersDurationSeconds",
        current.mysteryCube.barriersDurationSeconds,
        1,
        300
      )
    },
    tickets: {
      ...integratedGiftDefinition(
        data.get("ticketsGiftName"),
        current.tickets,
        data.get("ticketsGiftNameGiftId")
      ),
      enabled: data.has("ticketsEnabled"),
      spawnChance: number(
        "ticketsSpawnChance",
        current.tickets.spawnChance,
        0,
        100
      ),
      includeCoinDrop: data.has("ticketsIncludeCoinDrop"),
      countPerGift: Math.round(
        number("ticketsCountPerGift", current.tickets.countPerGift, 1, 50)
      ),
      minPoints: ticketRange[0],
      maxPoints: ticketRange[1]
    }
  };
}

function renderCoinPusherInteractions(pack, unlocked) {
  const config = integratedGameSettings(pack.id);
  const activeSpecialCount = [
    Boolean(config.guardGift?.name),
    Boolean(config.mysteryCube?.enabled),
    Boolean(config.tickets?.enabled)
  ].filter(Boolean).length;
  return `<div class="coin-pusher-interactions-page">
    <form class="coin-pusher-reward-form" data-coin-pusher-interactions>
      <section class="game-interaction-toolbar coin-pusher-interaction-heading">
        <div><span>🎁 CADEAUX → PIÈCES</span><h3>Construire les interactions du Coin Pusher</h3><p>Choisissez combien de pièces tombe selon la valeur du cadeau, puis ajoutez des exceptions pour les cadeaux qui doivent avoir leur propre gain.</p></div>
        <span class="game-step-count">PROFIL ${escapeHtml(overlayProfileName())}</span>
      </section>
      ${renderGamePageMessage(pack, "interactions")}
      <section class="coin-pusher-reward-stats" aria-label="Résumé des interactions Coin Pusher">
        <article><span>◈</span><div><strong>${config.diamondCoinTiers.length}</strong><small>paliers de valeur</small></div></article>
        <article><span>🎁</span><div><strong>${config.giftRules.length}</strong><small>cadeaux personnalisés</small></div></article>
        <article><span>✦</span><div><strong>${activeSpecialCount}/3</strong><small>bonus spéciaux actifs</small></div></article>
      </section>
      <section class="coin-pusher-reward-layout">
        <article class="coin-pusher-reward-card coin-pusher-reward-card--tiers">
          <header><span class="coin-pusher-card-icon">◈</span><div><small>RÈGLE AUTOMATIQUE</small><h4>Valeur du cadeau → nombre de pièces</h4><p>Un cadeau est décomposé du plus grand palier au plus petit. Le palier 1 diamant garantit toujours le calcul du reste.</p></div></header>
          <div class="coin-pusher-tier-list" data-coin-pusher-tier-list>
            ${config.diamondCoinTiers.map(renderCoinPusherTierRow).join("")}
          </div>
          <footer><span>Exemple : avec les paliers 10 → 5 et 1 → 1, un cadeau de 23 diamants génère 13 pièces.</span><button type="button" class="button small" data-action="add-coin-pusher-tier" ${config.diamondCoinTiers.length >= 20 ? "disabled" : ""}>＋ Ajouter un palier</button></footer>
        </article>
        <article class="coin-pusher-reward-card coin-pusher-reward-card--gifts">
          <header><span class="coin-pusher-card-icon">🎁</span><div><small>PRIORITÉ HAUTE</small><h4>Exceptions par cadeau précis</h4><p>Si un cadeau figure ici et que sa règle est active, son nombre de pièces remplace entièrement le calcul par valeur.</p></div></header>
          <div class="coin-pusher-gift-rule-list" data-coin-pusher-gift-rule-list>
            ${config.giftRules.length
              ? config.giftRules.map(renderCoinPusherGiftRuleRow).join("")
              : '<div class="coin-pusher-empty-rules" data-coin-pusher-empty-rules><span>＋</span><strong>Aucune exception</strong><small>Tous les cadeaux utilisent actuellement leur valeur.</small></div>'}
          </div>
          <footer><span>Le catalogue TikTok affiche le visuel et le prix du cadeau pendant la recherche.</span><button type="button" class="button small" data-action="add-coin-pusher-gift-rule" ${config.giftRules.length >= 100 ? "disabled" : ""}>＋ Choisir un cadeau</button></footer>
        </article>
      </section>
      <section class="coin-pusher-special-heading">
        <div><span>✦ BONUS SPÉCIAUX</span><h3>Donner un rôle unique à certains cadeaux</h3><p>Ces cadeaux peuvent conserver leur pluie de pièces normale ou la remplacer par leur bonus.</p></div>
      </section>
      <section class="coin-pusher-special-grid">
        <article class="coin-pusher-special-card coin-pusher-special-card--guards">
          <header><span>▥</span><div><small>PROTECTION</small><h4>Barrières latérales</h4><p>Relève temporairement les protections du plateau.</p></div></header>
          <div class="integrated-settings-grid">
            ${giftPickerField("guardGiftName", "Cadeau des barrières", config.guardGift.name, "", "", config.guardGift.giftId)}
            ${integratedNumberField("guardGiftDurationSeconds", "Durée (secondes)", config.guardGift.durationSeconds, 1, 300)}
            ${integratedToggle("guardGiftIncludeCoinDrop", "Ajouter aussi les pièces normales", "Le bonus et la pluie de pièces sont cumulés.", config.guardGift.includeCoinDrop)}
          </div>
        </article>
        <article class="coin-pusher-special-card coin-pusher-special-card--mystery">
          <header><span>?</span><div><small>SURPRISE</small><h4>Dé mystère</h4><p>Fait tomber un cube qui choisit un bonus aléatoire.</p></div></header>
          <div class="integrated-settings-grid">
            ${integratedToggle("mysteryEnabled", "Activer le dé mystère", "Autorise le cadeau et les apparitions aléatoires.", config.mysteryCube.enabled)}
            ${giftPickerField("mysteryGiftName", "Cadeau du dé", config.mysteryCube.name, "", "", config.mysteryCube.giftId)}
            ${integratedNumberField("mysterySpawnChance", "Chance sur les autres cadeaux (%)", config.mysteryCube.spawnChance, 0, 100, 0.5)}
            ${integratedToggle("mysteryIncludeCoinDrop", "Ajouter les pièces normales", "Le cadeau conserve aussi son gain habituel.", config.mysteryCube.includeCoinDrop)}
            ${integratedToggle("mysteryPointsEnabled", "Bonus de points", "Ajoute un score aléatoire.", config.mysteryCube.pointsBonusEnabled)}
            ${integratedNumberField("mysteryPointsMin", "Points minimum", config.mysteryCube.pointsBonusMin, 1, 1000000)}
            ${integratedNumberField("mysteryPointsMax", "Points maximum", config.mysteryCube.pointsBonusMax, 1, 1000000)}
            ${integratedToggle("mysteryCoinRainEnabled", "Pluie de pièces", "Ajoute une quantité aléatoire de pièces.", config.mysteryCube.coinRainEnabled)}
            ${integratedNumberField("mysteryCoinRainMin", "Pièces minimum", config.mysteryCube.coinRainMin, 1, 10000)}
            ${integratedNumberField("mysteryCoinRainMax", "Pièces maximum", config.mysteryCube.coinRainMax, 1, 10000)}
            ${integratedToggle("mysteryMultiplierEnabled", "Multiplicateur de score", "Multiplie temporairement les cases.", config.mysteryCube.multiplierEnabled)}
            ${integratedNumberField("mysteryMultiplierValue", "Multiplicateur", config.mysteryCube.multiplierValue, 1.1, 10, 0.1)}
            ${integratedNumberField("mysteryMultiplierDurationSeconds", "Durée du multiplicateur", config.mysteryCube.multiplierDurationSeconds, 1, 300)}
            ${integratedToggle("mysteryBarriersEnabled", "Barrières bonus", "Relève aussi les protections latérales.", config.mysteryCube.barriersEnabled)}
            ${integratedNumberField("mysteryBarriersDurationSeconds", "Durée des barrières", config.mysteryCube.barriersDurationSeconds, 1, 300)}
          </div>
        </article>
        <article class="coin-pusher-special-card coin-pusher-special-card--tickets">
          <header><span>票</span><div><small>POINTS</small><h4>Tickets bonus</h4><p>Fait tomber des tickets physiques à valeur variable.</p></div></header>
          <div class="integrated-settings-grid">
            ${integratedToggle("ticketsEnabled", "Activer les tickets", "Autorise le cadeau et les tickets aléatoires.", config.tickets.enabled)}
            ${giftPickerField("ticketsGiftName", "Cadeau des tickets", config.tickets.name, "", "", config.tickets.giftId)}
            ${integratedNumberField("ticketsSpawnChance", "Chance sur les autres cadeaux (%)", config.tickets.spawnChance, 0, 100, 0.5)}
            ${integratedNumberField("ticketsCountPerGift", "Tickets par cadeau", config.tickets.countPerGift, 1, 50)}
            ${integratedNumberField("ticketsMinPoints", "Valeur minimale", config.tickets.minPoints, 1, 1000000)}
            ${integratedNumberField("ticketsMaxPoints", "Valeur maximale", config.tickets.maxPoints, 1, 1000000)}
            ${integratedToggle("ticketsIncludeCoinDrop", "Ajouter les pièces normales", "Les tickets s’ajoutent au gain habituel.", config.tickets.includeCoinDrop)}
          </div>
        </article>
      </section>
      <footer class="game-step-footer coin-pusher-reward-actions">
        <div><strong>Priorité claire et sans doublon</strong><small>Cadeau précis → valeur du cadeau → bonus spécial selon vos options.</small></div>
        <button class="button primary" type="submit" ${unlocked ? "" : "disabled"}>Enregistrer les cadeaux</button>
      </footer>
    </form>
    <section class="coin-pusher-event-actions">
      <header><span>⚡ ACTIONS ÉVÉNEMENTIELLES</span><h3>Déclencheurs complémentaires</h3><p>Comme sur GTA et Minecraft, associez un cadeau, une valeur, des likes, un follow ou un message aux actions natives du jeu.</p></header>
      ${renderStandardGameInteractions(pack, unlocked)}
    </section>
  </div>`;
}
