"use strict";

const {migrateStarterDefaults,starterGiftAlreadyUsed,migrateDefaultWinAmounts,migrateKothWinGifts}=require("./starter-defaults");
const { migrateSupermarketDefaults } = require("./supermarket-defaults");
const { defaultGameInteractionRule, repairDefaultGiftInteraction, repairDefaultWinCounterInteraction } = require("./interaction-defaults");

/** Désactive les références visuelles non exécutables. */
function disableUnavailableInteractions(hub) {
  const lockedEffectIdsByPack = new Map(
    hub.packs.map((pack) => [
      pack.id,
      new Set(
        (pack.effects || [])
          // Les fiches en attente d’intégration conservent les associations
          // de l’utilisateur ; trigger refuse déjà les effets non exécutables.
          .filter((effect) => pack.guide?.mode !== "reference" && effect.available === false)
          .map((effect) => effect.id)
      )
    ])
  );
  let disabled = 0;
  hub.store.mutate((state) => {
    const rulesByPack = state.game?.interactionRulesByPack || {};
    for (const [packId, rules] of Object.entries(rulesByPack)) {
      const lockedEffectIds = lockedEffectIdsByPack.get(packId);
      if (!lockedEffectIds?.size || !Array.isArray(rules)) continue;
      for (const rule of rules) {
        const usesLockedEffect = (rule.actions || []).some((action) =>
          lockedEffectIds.has(String(action.config?.effectId || ""))
        );
        if (usesLockedEffect && rule.enabled !== false) {
          rule.enabled = false;
          disabled += 1;
        }
      }
    }
  }, true);
  return { disabled };
}

/** Répare les anciens WINS des deux catalogues Minecraft concernés. */
function repairMinecraftWinCounterInteractions(hub) {
  let repaired = 0;
  hub.store.mutate((state) => {
    const rulesByPack = state.game?.interactionRulesByPack || {};
    for (const packId of [
      "minecraft-bedrock-box",
      "minecraft-sandbox-3"
    ]) {
      const pack = hub.packs.find((entry) => entry.id === packId);
      const mappings = Array.isArray(pack?.defaultMappings)
        ? pack.defaultMappings
        : [];
      const rules = rulesByPack[packId];
      if (!pack || !mappings.length || !Array.isArray(rules)) continue;

      const existingRulesById = new Map(
        rules.map((rule) => [rule.id, rule])
      );
      for (const mapping of mappings) {
        const effect = pack.effects.find(
          (entry) => entry.id === mapping.effectId
        );
        if (!effect?.winCounter) continue;
        const expectedRule = defaultGameInteractionRule(
          pack,
          effect,
          mapping,
          Number(pack.interactionCatalogVersion || 0),
          hub.giftCatalog
        );
        const existingRule = existingRulesById.get(expectedRule.id);
        if (
          existingRule &&
          repairDefaultWinCounterInteraction(
            packId,
            existingRule,
            effect,
            mapping
          )
        ) {
          repaired += 1;
        }
      }
    }
  }, true);
  return { repaired };
}

/** Migration versionnée des associations et roues sans doubler les règles existantes. */
function initializeDefaultInteractions(hub, packId) {
  const pack = hub.assertAccess(packId);
  const mappings = Array.isArray(pack.defaultMappings)
    ? pack.defaultMappings
    : [];
  const wheelPresets = Array.isArray(pack.wheelPresets)
    ? pack.wheelPresets
    : [];
  const version = Math.max(
    0,
    Number(pack.interactionCatalogVersion || 0)
  );
  if (!mappings.length || !version) {
    return { added: 0, version: 0 };
  }

  let added = 0;
  let repaired = 0;
  let removed = 0;
  hub.store.mutate((state) => {
    state.game.interactionCatalogVersions ||= {};
    const currentVersion = Number(
      state.game.interactionCatalogVersions[pack.id] || 0
    );
    const canAddDefaults = currentVersion < version;

    state.game.interactionRulesByPack ||= {};
    const interactionRules =
      state.game.interactionRulesByPack[pack.id] ||= [];
    const supermarketMigration = canAddDefaults
      ? migrateSupermarketDefaults(pack, interactionRules, currentVersion)
      : { removed: 0, preserve: false };
    removed += supermarketMigration.removed;
    if(canAddDefaults){
      repaired+=migrateKothWinGifts(hub,pack,interactionRules,currentVersion).repaired;
      repaired+=migrateDefaultWinAmounts(hub,pack,interactionRules,currentVersion).repaired;
      removed+=migrateStarterDefaults(hub,pack,interactionRules,currentVersion).removed;
    }
    const deprecatedPresetIds = new Set(
      Array.isArray(pack.deprecatedDefaultMappingIds)
        ? pack.deprecatedDefaultMappingIds
        : []
    );
    const currentPresetIds = new Set(
      mappings.map((mapping) => String(mapping.id || "")).filter(Boolean)
    );
    for (let index = interactionRules.length - 1; index >= 0; index -= 1) {
      const rule = interactionRules[index];
      if (
        rule?.gameInteraction?.default === true &&
        deprecatedPresetIds.has(rule.gameInteraction.presetId) &&
        !currentPresetIds.has(rule.gameInteraction.presetId) &&
        Number(rule.gameInteraction.catalogVersion || 0) < version
      ) {
        interactionRules.splice(index, 1);
        removed += 1;
      }
    }
    const existingRulesById = new Map(
      interactionRules.map((rule) => [rule.id, rule])
    );
    for (const mapping of mappings) {
      const effect = pack.effects.find(
        (entry) => entry.id === mapping.effectId
      );
      if (!effect) continue;
      const rule = defaultGameInteractionRule(
        pack,
        effect,
        mapping,
        version,
        hub.giftCatalog
      );
      const existingRule = existingRulesById.get(rule.id);
      if (existingRule) {
        if (
          repairDefaultGiftInteraction(
            existingRule,
            rule,
            mapping,
            version
          )
        ) {
          repaired += 1;
          continue;
        }
        if (
          repairDefaultWinCounterInteraction(
            pack.id,
            existingRule,
            effect,
            mapping
          )
        ) {
          repaired += 1;
        }
        continue;
      }
      if (!canAddDefaults || supermarketMigration.preserve) continue;
      if(pack.starterDefaultsVersion&&mapping.marketColumn&&starterGiftAlreadyUsed(rule,interactionRules))continue;
      if(mapping.fillMissingWinLevel&&interactionRules.some(existing=>existing.actions?.some(action=>action.type==='overlay.win-counter'&&action.config?.packId===pack.id&&(action.config.operation||'adjust')==='adjust'&&Number(action.config.amount)===mapping.amount)))continue;
      interactionRules.push(rule);
      existingRulesById.set(rule.id, rule);
      added += 1;
    }
    if (wheelPresets.length) {
      state.settings ||= {};
      state.settings.overlayConfigs ||= {};
      const wheelConfig = state.settings.overlayConfigs.wheel ||= {};
      const wheels = Array.isArray(wheelConfig.wheels)
        ? wheelConfig.wheels
        : (wheelConfig.wheels = []);
      const wheelIds = new Set(wheels.map((wheel) => wheel.id));
      for (const wheelPreset of wheelPresets) {
        if (!wheelPreset?.id || wheelIds.has(wheelPreset.id)) continue;
        wheels.push(structuredClone(wheelPreset));
        wheelIds.add(wheelPreset.id);
      }
    }
    if (canAddDefaults) {
      state.game.interactionCatalogVersions[pack.id] = version;
    }
  }, true);
  return { added, removed, repaired, version };
}

module.exports = { disableUnavailableInteractions, repairMinecraftWinCounterInteractions, initializeDefaultInteractions };
