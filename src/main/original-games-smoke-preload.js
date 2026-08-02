"use strict";

const { contextBridge, ipcRenderer } = require("electron");

let latestDealHostState = null;

const connectorOverrides = {
  "coin-pusher": {
    capacityModelVersion: 2,
    theme: "galactic-palace",
    topN: 4,
    roundDurationMinutes: 17,
    pusherSpeed: 1.25,
    coinScale: 1.15,
    volume: 0.65,
    maxCoins: 1111,
    sideLossEnabled: true,
    guardGift: {
      giftId: "smoke-guard",
      name: "Bouclier smoke",
      image: "",
      cost: 25,
      durationSeconds: 9,
      includeCoinDrop: false
    },
    mysteryCube: {
      enabled: true,
      giftId: "smoke-mystery",
      name: "Mystère smoke",
      image: "",
      cost: 50,
      spawnChance: 7,
      includeCoinDrop: true,
      pointsBonusEnabled: true,
      pointsBonusMin: 31,
      pointsBonusMax: 73,
      coinRainEnabled: true,
      coinRainMin: 11,
      coinRainMax: 22,
      multiplierEnabled: true,
      multiplierValue: 2.5,
      multiplierDurationSeconds: 13,
      barriersEnabled: true,
      barriersDurationSeconds: 8
    },
    tickets: {
      enabled: true,
      giftId: "smoke-ticket",
      name: "Ticket smoke",
      image: "",
      cost: 75,
      spawnChance: 6,
      includeCoinDrop: false,
      countPerGift: 3,
      minPoints: 17,
      maxPoints: 91
    },
    scoreSlots: [-9, 0, 9, 18],
    diamondCoinTiers: [
      { diamonds: 50, coinCount: 12 },
      { diamonds: 5, coinCount: 2 }
    ],
    winnerPrizePercents: [12, 7, 3, 1],
    giftRules: [
      {
        giftId: "smoke-rose",
        name: "Rose smoke",
        image: "",
        cost: 1,
        coinCount: 4,
        enabled: true
      }
    ]
  },
  "deal-or-no-deal": {
    boxValues: Array.from({ length: 24 }, (_value, index) => index + 1),
    entryCost: 300,
    roundPattern: [4, 3, 2, 1],
    bankerRequests: [
      {
        id: "smoke-cash",
        type: "cashOffer",
        enabled: true,
        weight: 7,
        amount: 222,
        targetMode: "highest",
        forceAfterOpenedCount: 2
      }
    ],
    music: {
      waiting: {
        title: "Attente smoke",
        url: "data:audio/mpeg;base64,SUQz"
      }
    },
    rigging: {
      enabled: true,
      selectedBoxBigValueThreshold: 19,
      selectedBoxBigValueChance: 0.63,
      finalChoiceLowValue: 2,
      finalChoiceHighValueThreshold: 20,
      finalChoiceLowValueChance: 0.71
    },
    spend: {
      enabled: true,
      premiumEntryCost: 1000,
      rewardMultiplier: 2.5
    }
  }
};

contextBridge.exposeInMainWorld("shenPulse", {
  getSnapshot: async () => ({
    state: {
      game: {
        connectorOverrides
      },
      settings: {
        language: "fr"
      }
    }
  }),
  publishDealHostState: async (state) => {
    latestDealHostState = state;
    return { ok: true };
  },
  getSmokeDealHostState: async () => latestDealHostState,
  on: (channel, callback) => {
    if (!["game-effect", "live-event", "state-changed"].includes(channel)) {
      return () => {};
    }
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
