"use strict";

/** Un effet disponible au catalogue ne devient pas forcément une carte par défaut. */
function manualShopMapping(effect) {
  return { id: `catalog-${effect.id}`, effectId: effect.id, title: effect.name, triggerType: "gift", threshold: 1, cooldownSeconds: 0, duration: effect.duration || 0, enabled: true, triggerEnabled: false, parameters: {} };
}

const SUPERMARKET_STARTER_VERSION = 20261024;
const SUPERMARKET_STARTERS = [
  ["help", "SpawnCustomers", "+1 client", "Rose", "5655", 1, { count: 1 }],
  ["help", "CustomerRush", "Rush clients", "Finger Heart", "5487", 5],
  ["help", "UpgradeStore", "Agrandir magasin", "Perfume", "5658", 20],
  ["help", "FillShelves", "Rayons pleins", "Doughnut", "5879", 30],
  ["help", "HireEmployees", "+1 employé", "Cap", "6104", 99, { count: 1 }],
  ["help", "Jackpot", "Jackpot", "Corgi", "6267", 299],
  ["trap", "FlipCamera", "Caméra retournée", "TikTok", "5269", 1, { count: 15 }],
  ["trap", "SpawnShoplifter", "Voleur", "Tofu", "10604", 5, {}, ["11015"]],
  ["trap", "LightsOff", "Coupure courant", "S Flowers", "14115", 20, { count: 20 }],
  ["trap", "CartChaos", "Chaos total", "Capybara", "14488", 30, {}, ["17490"]],
  ["trap", "FireAllEmployees", "Employés virés", "Hat and Mustache", "6427", 99],
  ["trap", "Bankrupt", "Faillite", "Boxing Gloves", "6007", 299]
];

function supermarketDefaultMappings(effects) {
  return SUPERMARKET_STARTERS.map(([marketColumn, code, title, giftName, giftId, giftCost, parameters = {}, giftIds = []]) => {
    const effect = effects.find(item => item.code === code);
    if (!effect) throw new Error("Interaction Supermarket introuvable : " + code);
    return { ...manualShopMapping(effect), title, marketColumn, giftName, giftId, giftIds, giftCost, parameters: { ...parameters }, triggerEnabled: true, preserveExisting: true };
  });
}

module.exports = { manualShopMapping, supermarketDefaultMappings, SUPERMARKET_STARTER_VERSION };
