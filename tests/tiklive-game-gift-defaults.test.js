"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { GiftCatalog } = require("../src/main/catalogs");
const {
  CLASH_OF_LIVE_DEFAULT_MAPPINGS
} = require("../src/main/clash-of-live-catalog");
const {
  COLOR_STRIKE_DEFAULT_MAPPINGS
} = require("../src/main/color-strike-catalog");
const { GameHub } = require("../src/main/game-hub");
const {
  TIKLIVE_CLIMB_DEFAULT_MAPPINGS
} = require("../src/main/tiklive-climb-catalog");
const {
  TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS
} = require("../src/main/tiklive-stack-tower-catalog");
const { normalizeGiftName } = require("../src/shared/gift-identity");

const resourcesDirectory = path.join(__dirname, "..", "resources");
const tikLiveGiftLibrary = JSON.parse(
  fs.readFileSync(
    path.join(resourcesDirectory, "catalogs", "tiklive-gifts.json"),
    "utf8"
  )
).gifts;

const EXPECTED_PRIMARY_GIFT_IDS = {
  "clash-of-live": {
    "clash-of-live-rouge-squelettes-3": "5655",
    "clash-of-live-rouge-chevalier": "5487",
    "clash-of-live-rouge-barbare": "8913",
    "clash-of-live-rouge-geant": "7569",
    "clash-of-live-rouge-dragon": "8260",
    "clash-of-live-rouge-soin": "7985",
    "clash-of-live-bleu-squelettes-3": "6064",
    "clash-of-live-bleu-chevalier": "10604",
    "clash-of-live-bleu-barbare": "5853",
    "clash-of-live-bleu-geant": "6104",
    "clash-of-live-bleu-dragon": "6267",
    "clash-of-live-bleu-soin": "7168",
    "clash-of-live-roue-native": "6968"
  },
  "color-strike": {
    "color-strike-red-small-1": "5655",
    "color-strike-nausea-6": "5487",
    "color-strike-red-small-15": "8913",
    "color-strike-red-medium-5": "5879",
    "color-strike-blind-6": "13962",
    "color-strike-red-large-7": "5660",
    "color-strike-red-giant": "7122",
    "color-strike-blue-small-1": "6064",
    "color-strike-blue-small-15": "7934",
    "color-strike-roller-15": "8692",
    "color-strike-super-gun-15": "5853",
    "color-strike-grenades-3": "8825",
    "color-strike-blue-medium-5": "14488",
    "color-strike-blue-large-7": "6661",
    "color-strike-fill-25": "6267",
    "color-strike-win-plus-1": "7168",
    "color-strike-win-plus-5": "11046",
    "color-strike-win-plus-20": "5767",
    "color-strike-win-plus-50": "6203",
    "color-strike-win-minus-1": "7985",
    "color-strike-win-minus-5": "11476",
    "color-strike-win-minus-20": "6646",
    "color-strike-win-minus-50": "8417",
    "color-strike-reset-map": "6007",
    "color-strike-reset-wins": "6089",
    "color-strike-random": "5269",
    "color-strike-multiplier": "9537",
    "color-strike-territory-steal-10": "5587",
    "color-strike-blackout-8": "10825",
    "color-strike-nuke": "6563",
    "color-strike-boss-40": "9149"
  },
  "tiklive-climb": {
    "tiklive-climb-souffle": "5655",
    "tiklive-climb-seisme": "5487",
    "tiklive-climb-inverse-8": "9947",
    "tiklive-climb-lourd-10": "8913",
    "tiklive-climb-brouillard-15": "5879",
    "tiklive-climb-glace-10": "6104",
    "tiklive-climb-mob": "7569",
    "tiklive-climb-poing": "6007",
    "tiklive-climb-bond": "5269",
    "tiklive-climb-ballon-10": "5509",
    "tiklive-climb-drapeau-30": "5658",
    "tiklive-climb-bouclier-15": "8259",
    "tiklive-climb-plume-10": "5853",
    "tiklive-climb-win-plus-1": "7168",
    "tiklive-climb-win-plus-5": "11046",
    "tiklive-climb-win-plus-20": "5767",
    "tiklive-climb-win-plus-50": "6203",
    "tiklive-climb-win-minus-1": "7985",
    "tiklive-climb-win-minus-5": "11476",
    "tiklive-climb-win-minus-20": "6646",
    "tiklive-climb-win-minus-50": "8417",
    "tiklive-climb-reset-wins": "6089"
  },
  "tiklive-stack-tower": {
    "tiklive-stack-tower-plus-1": "6064",
    "tiklive-stack-tower-plus-10": "5487",
    "tiklive-stack-tower-plus-50": "14488",
    "tiklive-stack-tower-stabilise-15": "5827",
    "tiklive-stack-tower-ralenti-12": "5333",
    "tiklive-stack-tower-aimant": "7934",
    "tiklive-stack-tower-bouclier": "8692",
    "tiklive-stack-tower-fondations-20": "5853",
    "tiklive-stack-tower-moins-1": "5655",
    "tiklive-stack-tower-moins-10": "8913",
    "tiklive-stack-tower-moins-50": "5879",
    "tiklive-stack-tower-vent-8": "5868",
    "tiklive-stack-tower-seisme-5": "6635",
    "tiklive-stack-tower-oiseau": "8495",
    "tiklive-stack-tower-avion": "9947",
    "tiklive-stack-tower-accelere-8": "6652",
    "tiklive-stack-tower-glissant": "5658",
    "tiklive-stack-tower-brouillard-8": "8825",
    "tiklive-stack-tower-geant": "6560",
    "tiklive-stack-tower-mini": "8655",
    "tiklive-stack-tower-random": "5269",
    "tiklive-stack-tower-multi": "9537",
    "tiklive-stack-tower-win-plus-1": "7168",
    "tiklive-stack-tower-win-plus-5": "11046",
    "tiklive-stack-tower-win-plus-20": "5767",
    "tiklive-stack-tower-win-plus-50": "6203",
    "tiklive-stack-tower-win-minus-1": "7985",
    "tiklive-stack-tower-win-minus-5": "11476",
    "tiklive-stack-tower-win-minus-20": "6646",
    "tiklive-stack-tower-win-minus-50": "8417",
    "tiklive-stack-tower-reset-wins": "6089"
  }
};

const mappingsByPack = {
  "clash-of-live": CLASH_OF_LIVE_DEFAULT_MAPPINGS,
  "color-strike": COLOR_STRIKE_DEFAULT_MAPPINGS,
  "tiklive-climb": TIKLIVE_CLIMB_DEFAULT_MAPPINGS,
  "tiklive-stack-tower": TIKLIVE_STACK_TOWER_DEFAULT_MAPPINGS
};

test("reproduit tous les cadeaux TikLive par défaut des trois jeux", () => {
  for (const [packId, mappings] of Object.entries(mappingsByPack)) {
    const giftMappings = mappings.filter(
      (mapping) => mapping.triggerType === "gift"
    );
    assert.deepEqual(
      Object.fromEntries(
        giftMappings.map((mapping) => [mapping.id, mapping.giftId])
      ),
      EXPECTED_PRIMARY_GIFT_IDS[packId],
      packId
    );

    for (const mapping of giftMappings) {
      const configuredIds = [mapping.giftId, ...(mapping.giftIds || [])];
      for (const giftId of configuredIds) {
        const libraryGift = tikLiveGiftLibrary.find(
          (gift) => String(gift.id) === String(giftId)
        );
        assert.ok(libraryGift, `${packId}/${mapping.id}: cadeau ${giftId}`);
        assert.equal(
          normalizeGiftName(libraryGift.name),
          normalizeGiftName(mapping.giftName),
          `${packId}/${mapping.id}: nom ${giftId}`
        );
        assert.equal(
          Number(libraryGift.cost),
          mapping.giftCost,
          `${packId}/${mapping.id}: coût ${giftId}`
        );
        assert.match(
          libraryGift.imageUrl,
          /^https:\/\//,
          `${packId}/${mapping.id}: image ${giftId}`
        );
      }
    }
  }
});

test("migre les règles existantes et leur associe les images du catalogue", () => {
  const state = subscribedState();
  for (const [packId, mappings] of Object.entries(mappingsByPack)) {
    const firstGiftMapping = mappings.find(
      (mapping) => mapping.triggerType === "gift"
    );
    state.game.interactionCatalogVersions[packId] = 1;
    state.game.interactionRulesByPack[packId] = [
      {
        id: `rule_${packId}_${firstGiftMapping.id}`,
        name: "Ancienne association",
        enabled: false,
        trigger: { enabled: true, type: "gift" },
        conditions: [{ field: "data.giftName", operator: "equals", value: "Mauvais cadeau" }],
        gameInteraction: {
          catalogVersion: 1,
          default: true,
          presetId: firstGiftMapping.id
        },
        actions: []
      }
    ];
  }

  const giftCatalog = new GiftCatalog(resourcesDirectory);
  const hub = new GameHub({
    store: storeFor(state),
    resourcesDirectory,
    packsDirectory: path.join(resourcesDirectory, "packs"),
    giftCatalog
  });
  hub.loadPacks();

  for (const [packId, mappings] of Object.entries(mappingsByPack)) {
    const initialization = hub.initializeDefaultInteractions(packId);
    assert.equal(initialization.repaired, 1, packId);
    assert.equal(initialization.added, mappings.length - 1, packId);

    const expectedById = new Map(mappings.map((mapping) => [mapping.id, mapping]));
    const rules = state.game.interactionRulesByPack[packId];
    const giftRules = rules.filter((rule) => rule.trigger.type === "gift");
    assert.equal(
      giftRules.length,
      Object.keys(EXPECTED_PRIMARY_GIFT_IDS[packId]).length,
      packId
    );
    for (const rule of giftRules) {
      const mapping = expectedById.get(rule.gameInteraction.presetId);
      const condition = rule.conditions[0];
      assert.equal(condition.giftId, mapping.giftId, rule.id);
      assert.equal(condition.value, mapping.giftName, rule.id);
      assert.equal(condition.giftCost, mapping.giftCost, rule.id);
      assert.match(condition.giftImageUrl, /^https:\/\//, rule.id);
      for (const alternateId of mapping.giftIds || []) {
        assert.ok(condition.giftIds.includes(alternateId), rule.id);
      }
    }

    const migratedRule = rules.find(
      (rule) => rule.gameInteraction.presetId === mappings[0].id
    );
    assert.equal(migratedRule.enabled, false, `${packId}: choix utilisateur`);
  }
});

function subscribedState() {
  return {
    settings: {
      account: {
        email: "viewer@example.com",
        emailVerified: true,
        uid: "viewer-uid",
        refreshTokenSecretId: "viewer-secret"
      },
      overlayConfigs: {}
    },
    session: { activeGamePackId: "coin-pusher" },
    commerce: {
      subscription: {
        tier: "pro",
        source: "subscription",
        status: "active"
      },
      gameEntitlements: Object.keys(mappingsByPack)
    },
    game: {
      recentPacks: [],
      connectorOverrides: {},
      interactionCatalogVersions: {},
      interactionRulesByPack: {}
    },
    rules: []
  };
}

function storeFor(state) {
  return {
    getState: () => state,
    getSecret: () => "refresh-token",
    mutate: (callback) => callback(state)
  };
}
