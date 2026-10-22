"use strict";

const { game } = require("./builders");

function nativeGame(id, name, sourceId, description, connector) {
  const effects = require(`../../../resources/catalogs/${id}-effects.json`);
  return game(id, name, {
    included: true, source: `Crowd Control · ${name}`,
    artworkUrl: `https://resources.crowdcontrol.live/images/${sourceId}/box.jpg`,
    description, tags: ["inclus", "interactions PC"],
    installerVersion: id === "fallout-4" ? "1.0.1" : "1.0.0", interactionCatalogVersion: 20261021,
    connector, effects,
    defaultMappings: effects.map(effect => ({
      id: `catalog-${effect.id}`, effectId: effect.id, title: effect.name,
      triggerType: "gift", threshold: 1, cooldownSeconds: 0,
      duration: effect.duration || 0, enabled: effect.available !== false,
      triggerEnabled: false, parameters: {}
    }))
  });
}

function tcp(port, processName, message) {
  return {
    type: "tcp-server", host: "127.0.0.1", port,
    timeoutMs: 12000, durationMultiplier: 1000, expectResponse: true,
    launchConnectionTimeoutMs: 90000,
    temporaryFailureRetryMs: 4000, temporaryFailureRetryIntervalMs: 500,
    temporaryFailureMessage: message, focusProcessOnManualTrigger: processName
  };
}

module.exports = {
  DEAD_BY_DAYLIGHT: nativeGame("dead-by-daylight", "Dead by Daylight", "DeadbyDaylight",
    "20 interactions clavier et souris pour survivants et tueurs. Préparation Steam ou Xbox Game Pass.",
    { type: "windows-input", processName: "DeadByDaylight-Win64-Shipping.exe", keyLayout: "azerty" }),
  DREDGE: nativeGame("dredge", "DREDGE", "Dredge",
    "Interactions sur le bateau, les ressources, la cargaison, la météo et les capacités. Installation Steam ou Xbox Game Pass.",
    tcp(58438, "DREDGE", "Cet effet DREDGE est indisponible : quittez le quai, la pêche et les menus, puis vérifiez les ressources nécessaires.")),
  EGGING_ON: nativeGame("egging-on", "Egging On", "EggingOn",
    "37 interactions sur l’œuf, la progression, la gravité, les sauts et la caméra. Installation du module officiel MelonLoader.",
    tcp(58439, "Egging On", "Cet effet Egging On est indisponible dans cette situation. Reprenez une partie, fermez les menus, puis réessayez.")),
  FALLOUT_4: nativeGame("fallout-4", "Fallout 4", "Fallout4",
    "298 interactions pour Fallout 4 Steam 1.11.240 avec les six DLC et F4SE 0.7.9. Édition Xbox Game Pass incompatible avec le module officiel.",
    tcp(5846, "Fallout4", "Cet effet Fallout 4 est indisponible. Chargez une partie après la sortie de l’Abri 111, hors menus, et vérifiez ses prérequis."))
};
