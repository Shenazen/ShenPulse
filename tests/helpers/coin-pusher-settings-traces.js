"use strict";

/** Scénarios déterministes des profils, limites, cadeaux et commandes existants. */
function traceCoinPusherSettings(api) {
  const settings = [
    {},
    { topN: 99, roundDurationMinutes: -1, coinScale: 99, maxCoins: 2, volume: "0.45", sideLossEnabled: "false" },
    { capacityModelVersion: 2, maxCoins: 400, winnerCount: 5, platformImageUrl: "javascript:bad", theme: "GALACTIC-PALACE" },
    { mysteryCube: { enabled: true, pointsBonusMin: 100, pointsBonusMax: 1 }, tickets: { spawnChance: 101, minPoints: 800, maxPoints: 4 }, scoreSlots: [1, "-5", "bad"] },
    { giftRules: [{ giftId: "5655", name: "Rose", coinCount: 25 }], diamondCoinTiers: [{ diamonds: 1, coinCount: 3 }, { diamonds: 10, coinCount: 30 }], guardGift: { name: "Test", durationSeconds: 999 } }
  ].map((input) => api.normalizeCoinPusherSettings(input));
  return {
    api: Object.keys(api).sort(), defaults: api.defaultCoinPusherSettings(), settings,
    costs: [0, 1, 9, 10, 999, 5000, Number.MAX_SAFE_INTEGER].map((cost) => ({ cost, coins: api.coinCountForGiftCost(cost), parts: api.decomposeCoinPusherDiamonds(cost) })),
    totals: [[1, 10], [5000, 99], [Number.MAX_SAFE_INTEGER, 2]].map(([cost, repeat]) => api.coinPusherTotalDiamonds(cost, repeat)),
    drops: [
      { id: "drop-1", createdAt: 1700000000000, source: "test", coinCount: 100, viewerId: " @Alice ", name: "Alice" },
      { id: "drop-2", createdAt: 1700000000000, gift: { giftId: "5655", name: "Rose", cost: 1 }, repeatCount: 3, payload: { user: { uniqueId: "alice", nickname: "Alice" } } },
      { id: "drop-3", createdAt: 1700000000000, source: "live", coinCount: Number.MAX_SAFE_INTEGER, avatarUrl: "javascript:bad" }
    ].map((input) => api.normalizeCoinPusherDrop(input, settings[0])),
    commands: ["start", "pause", "resume", "reset", "finish", "invalid"].map((command) => api.normalizeCoinPusherRoundCommand({ command, id: `command-${command}`, createdAt: 1700000000000, roundId: "round-1" }))
  };
}

module.exports = { traceCoinPusherSettings };
