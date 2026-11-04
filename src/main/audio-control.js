"use strict";
const { stateControl } = require("../../resources/overlays/audio-control");
const { readState } = require("./state-projection");

function readAudioControl(store) {
  const state = readState(store, ["settings.audioMixer", "settings.matches.automations"]);
  return stateControl({ ...state, ...(store.getRuleEngineState?.() || readState(store, ["rules"])) });
}

/** Ne publie que des niveaux sonores et des identifiants opaques d'actions. */
function synchronizeAudioControl(core, state) {
  if (!core.overlayServer || !state?.settings) return;
  const payload = stateControl(state), signature = JSON.stringify(payload);
  if (core.audioControlSignature === signature) return;
  core.audioControlSignature = signature;
  core.overlayServer.publish("audio-control", payload);
}
module.exports = { synchronizeAudioControl, readAudioControl };
