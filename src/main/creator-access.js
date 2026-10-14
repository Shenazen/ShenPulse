"use strict";

const { hasActiveGameSubscription } = require("./game-access");
const FREE_CREATOR_LIMITS = Object.freeze({ actions: 3, profiles: 1 });

function creatorActionCount(rules = []) {
  // References reuse library actions and must not consume a second slot.
  return rules.reduce((total, rule) => total + (rule.actions || [])
    .filter((action) => action.type !== "action.group").length, 0);
}

function assertCreatorCapacity(state, collection, item) {
  if (hasActiveGameSubscription(state)) return;
  if (collection === "profiles" && !state.profiles.some((entry) => entry.id === item.id)
    && state.profiles.length >= FREE_CREATOR_LIMITS.profiles) {
    throw new Error("L’offre gratuite comprend 1 profil. Pro permet de créer plusieurs profils, sans supprimer vos profils existants.");
  }
  if (collection !== "rules") return;
  const previous = creatorActionCount(state.rules);
  const nextRules = state.rules.filter((entry) => entry.id !== item.id).concat(item);
  const next = creatorActionCount(nextRules);
  // Preserve historical workspaces; editing or removing existing actions stays possible.
  if (next > FREE_CREATOR_LIMITS.actions && next > previous) {
    throw new Error("L’offre gratuite comprend 3 actions. Réutilisez une action dans un déclencheur, ou choisissez Pro pour en créer davantage.");
  }
}

module.exports = { FREE_CREATOR_LIMITS, creatorActionCount, assertCreatorCapacity };
