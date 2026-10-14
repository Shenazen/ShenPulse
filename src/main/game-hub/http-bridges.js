"use strict";

const HTTP_BRIDGE_PROPERTIES = Object.freeze({
  "color-strike-http": "colorStrikeBridge",
  "tiklive-climb-http": "tikLiveClimbBridge",
  "tiklive-cube-wars-http": "tikLiveCubeWarsBridge",
  "tiklive-stack-tower-http": "tikLiveStackTowerBridge",
  "clash-of-live-http": "clashOfLiveBridge"
});

/** Registre partagé par diagnostics et exécution des passerelles HTTP natives. */
function httpBridgeFor(hub, connectorType) {
  const property = HTTP_BRIDGE_PROPERTIES[connectorType];
  return Object.hasOwn(HTTP_BRIDGE_PROPERTIES, connectorType) ? hub[property] : null;
}

module.exports = { httpBridgeFor };
