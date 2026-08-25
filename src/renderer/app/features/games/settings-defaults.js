"use strict";

/**
 * Paramètres des jeux intégrés et écrans de configuration.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function integratedGameSettings(gameId) {
  const defaults = {
    "coin-pusher": {
      capacityModelVersion: 2,
      theme: "arcade",
      topN: 3,
      roundDurationMinutes: 15,
      pusherSpeed: 1,
      coinScale: 1,
      volume: 0.8,
      maxCoins: 1000,
      sideLossEnabled: false,
      guardGift: {
        giftId: "",
        name: "",
        image: "",
        cost: 0,
        durationSeconds: 12,
        includeCoinDrop: true
      },
      mysteryCube: {
        giftId: "",
        name: "",
        image: "",
        cost: 0,
        enabled: false,
        spawnChance: 2,
        includeCoinDrop: false,
        pointsBonusEnabled: true,
        pointsBonusMin: 25,
        pointsBonusMax: 100,
        coinRainEnabled: true,
        coinRainMin: 15,
        coinRainMax: 40,
        multiplierEnabled: true,
        multiplierValue: 2,
        multiplierDurationSeconds: 15,
        barriersEnabled: true,
        barriersDurationSeconds: 12
      },
      tickets: {
        giftId: "",
        name: "",
        image: "",
        cost: 0,
        enabled: false,
        spawnChance: 4,
        includeCoinDrop: false,
        countPerGift: 1,
        minPoints: 10,
        maxPoints: 75
      },
      platformImageUrl: "",
      plinkoImageUrl: "",
      scoreSlots: [-5, 0, 5, 10, 25, 10, 5, 0],
      diamondCoinTiers: [
        { diamonds: 5000, coinCount: 202 },
        { diamonds: 1000, coinCount: 80 },
        { diamonds: 100, coinCount: 20 },
        { diamonds: 10, coinCount: 5 },
        { diamonds: 1, coinCount: 1 }
      ],
      winnerPrizePercents: [10, 5, 2, 0, 0, 0, 0, 0, 0, 0],
      giftRules: []
    },
    "connect-four": {
      columns: 7,
      rows: 6,
      winLength: 4,
      duelEntryCost: 0,
      aiEasyEntryCost: 0,
      aiHardEntryCost: 0,
      rewardsEnabled: false,
      rewards: { horizontal: 0, vertical: 0, diagonal: 0 }
    },
    "deal-or-no-deal": {
      boxValues: [
        1, 5, 10, 20, 30, 49, 88, 90, 99, 100, 149, 199,
        249, 299, 300, 349, 350, 399, 500, 699, 800, 899, 999, 1000
      ],
      entryCost: 300,
      roundPattern: [6, 5, 4, 3, 2, 1, 1, 1],
      bankerRequests: [
        {
          id: "cash-offer",
          type: "cashOffer",
          enabled: true,
          weight: 70,
          amount: 0,
          targetMode: "random",
          forceAfterOpenedCount: 0
        },
        {
          id: "swap-box",
          type: "swapBox",
          enabled: true,
          weight: 20,
          amount: 0,
          targetMode: "playerChoice",
          forceAfterOpenedCount: 0
        },
        {
          id: "buy-box",
          type: "buyBox",
          enabled: true,
          weight: 10,
          amount: 100,
          targetMode: "random",
          forceAfterOpenedCount: 0
        }
      ],
      music: {},
      rigging: {
        enabled: true,
        selectedBoxBigValueThreshold: 500,
        selectedBoxBigValueChance: 0.05,
        finalChoiceLowValue: -500,
        finalChoiceHighValueThreshold: 500,
        finalChoiceLowValueChance: 0.9
      },
      spend: {
        enabled: false,
        premiumEntryCost: 1000,
        rewardMultiplier: 3
      }
    }
  };
  const saved = snapshot.state.game.connectorOverrides?.[gameId] || {};
  const merged = { ...(defaults[gameId] || {}), ...saved };
  if (gameId === "coin-pusher") {
    merged.guardGift = {
      ...defaults["coin-pusher"].guardGift,
      ...(saved.guardGift || {})
    };
    merged.mysteryCube = {
      ...defaults["coin-pusher"].mysteryCube,
      ...(saved.mysteryCube || {})
    };
    merged.tickets = {
      ...defaults["coin-pusher"].tickets,
      ...(saved.tickets || {})
    };
    for (const key of [
      "scoreSlots",
      "diamondCoinTiers",
      "winnerPrizePercents",
      "giftRules"
    ]) {
      merged[key] = Array.isArray(saved[key])
        ? structuredClone(saved[key])
        : structuredClone(defaults["coin-pusher"][key]);
    }
  }
  if (gameId === "connect-four") {
    merged.rewards = {
      ...defaults["connect-four"].rewards,
      ...(saved.rewards || {})
    };
  }
  if (gameId === "deal-or-no-deal") {
    const savedBoxValues = integratedNumberList(saved.boxValues);
    const savedRoundPattern = integratedNumberList(saved.roundPattern);
    merged.boxValues =
      savedBoxValues.length === 24
        ? savedBoxValues
        : [...defaults["deal-or-no-deal"].boxValues];
    merged.roundPattern = savedRoundPattern.length
      ? savedRoundPattern
      : [...defaults["deal-or-no-deal"].roundPattern];
    merged.bankerRequests =
      Array.isArray(saved.bankerRequests) && saved.bankerRequests.length
      ? structuredClone(saved.bankerRequests)
      : structuredClone(defaults["deal-or-no-deal"].bankerRequests);
    merged.music =
      saved.music && typeof saved.music === "object" && !Array.isArray(saved.music)
        ? structuredClone(saved.music)
        : {};
    merged.rigging = {
      ...defaults["deal-or-no-deal"].rigging,
      ...(saved.rigging || {})
    };
    merged.spend = {
      ...defaults["deal-or-no-deal"].spend,
      ...(saved.spend || {})
    };
    if (!saved.spend && Number(saved.premiumMultiplier) > 0) {
      merged.spend.rewardMultiplier = Number(saved.premiumMultiplier);
    }
  }
  return merged;
}
