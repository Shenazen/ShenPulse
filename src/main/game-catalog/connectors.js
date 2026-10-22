"use strict";

/** Catalogue de jeux : domaine « connectors », données et identifiants conservés. */


const GTA_LOCAL_BRIDGE = Object.freeze({
  type: "tcp-server",
  host: "127.0.0.1",
  port: 58430,
  timeoutMs: 12000,
  expectResponse: true
});

const CULT_OF_THE_LAMB_BRIDGE = Object.freeze({
  type: "tcp-server",
  host: "127.0.0.1",
  port: 58431,
  timeoutMs: 12000,
  durationMultiplier: 1000,
  expectResponse: true
});

const STARDEW_VALLEY_BRIDGE = Object.freeze({
  type: "tcp-server",
  host: "127.0.0.1",
  port: 58432,
  timeoutMs: 12000,
  durationMultiplier: 1000,
  expectResponse: true
});

const TERRARIA_BRIDGE = Object.freeze({
  type: "tcp-server",
  host: "127.0.0.1",
  port: 58433,
  timeoutMs: 12000,
  durationMultiplier: 1000,
  expectResponse: true
});

const THE_MORTUARY_ASSISTANT_BRIDGE = Object.freeze({
  type: "websocket-server",
  host: "127.0.0.1",
  port: 58434,
  timeoutMs: 12000,
  durationMultiplier: 1000,
  focusProcessOnManualTrigger: "The Mortuary Assistant"
});

const UNTURNED_BRIDGE = Object.freeze({
  type: "tcp-server", host: "127.0.0.1", port: 58435,
  timeoutMs: 12000, expectResponse: true,
  focusProcessOnManualTrigger: "Unturned"
});

const EURO_TRUCK_SIMULATOR_2_BRIDGE = Object.freeze({
  type: "tcp-server",
  host: "127.0.0.1",
  port: 58441,
  timeoutMs: 12000,
  durationMultiplier: 1000,
  expectResponse: true,
  launchConnectionTimeoutMs: 90000,
  launchConnectionFailureMessage: "Euro Truck Simulator 2 n’a pas établi sa connexion à ShenPulse. Confirmez le message du SDK avancé dans le jeu s’il apparaît. Si le jeu était déjà ouvert, fermez-le puis relancez-le depuis ShenPulse. Si nécessaire, réinstallez les interactions dans le dossier de cette édition du jeu."
});

const RESIDENT_EVIL_3_BRIDGE = Object.freeze({
  type: "tcp-server",
  host: "127.0.0.1",
  port: 58443,
  timeoutMs: 12000,
  durationMultiplier: 1000,
  expectResponse: true,
  focusProcessOnManualTrigger: "re3",
  temporaryFailureRetryMs: 15000,
  temporaryFailureRetryIntervalMs: 500,
  temporaryFailureMessage:
    "Resident Evil 3 n’est pas encore dans une phase jouable. Reprenez la partie et fermez les menus, puis réessayez hors cinématique et chargement."
});

module.exports = { GTA_LOCAL_BRIDGE, CULT_OF_THE_LAMB_BRIDGE, STARDEW_VALLEY_BRIDGE, TERRARIA_BRIDGE, EURO_TRUCK_SIMULATOR_2_BRIDGE, RESIDENT_EVIL_3_BRIDGE, THE_MORTUARY_ASSISTANT_BRIDGE, UNTURNED_BRIDGE };

