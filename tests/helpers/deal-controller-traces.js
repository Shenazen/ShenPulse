"use strict";

/** Contrats de banque, pondération et ambiance, sans dépendance au DOM Vue. */
function traceDealControllers(api) {
  const ref = (value) => ({ value });
  const boxes = ref([10, 50, 100, 500, 1000, 5000].map((value, index) => ({ id: index + 1, value, opened: false, own: index === 0 })));
  const otherUnopenedBoxes = { get value() { return boxes.value.filter((box) => !box.opened && !box.own); } };
  const openedNonPlayerBoxCount = ref(1);
  const usedForcedBankerRequestKeys = ref([]);
  const bankerRequests = ref([
    { id: "cash", type: "cashOffer", enabled: true, weight: 3, amount: 0 },
    { id: "buy", type: "buyBox", enabled: true, weight: 1, amount: 250, targetMode: "highest", forceAfterOpenedCount: 1 },
    { id: "swap", type: "swapBox", enabled: true, weight: 1 }
  ]);
  const banker = api.createDealBanker({
    boxes, otherUnopenedBoxes, openedNonPlayerBoxCount, usedForcedBankerRequestKeys, bankerRequests,
    boxValues: ref(boxes.value.map((box) => box.value)), roundIndex: ref(2), roundPattern: ref([5, 4, 3, 2, 1]),
    jackpotValueThreshold: ref(1000), weakBoardThreshold: ref(100),
    t: (key, parameters = {}) => `${key}:${JSON.stringify(parameters)}`, formatDiamonds: (value) => String(value), formatRewardDiamonds: (value) => `reward:${value}`
  });
  const bank = {
    offer: banker.calculateOffer(), requests: bankerRequests.value.map((config) => banker.createBankerRequestFromConfig(config)),
    targets: ["highest", "lowest", "random"].map((mode) => banker.pickTargetBox(mode)?.id),
    forced: [banker.findForcedBankerRequest()?.id, banker.findForcedBankerRequest()?.id ?? null],
    forcedKeys: [...usedForcedBankerRequestKeys.value],
    limits: [-5, 1, 999, Infinity].map((value) => [banker.normalizeForcedOpenCount(value), banker.normalizeBankerRequestWeight(value)])
  };
  const rigging = api.createDealRigging({ boxes, openedNonPlayerBoxCount, badRevealStreak: ref(0), riggingSettings: ref({ enabled: true, selectedBoxBigValueChance: .8, selectedBoxBigValueThreshold: 100, finalChoiceLowValueChance: .8, finalChoiceLowValue: 10, finalChoiceHighValueThreshold: 100 }) });
  rigging.applySelectedBoxWeight(boxes.value[5]);
  rigging.applyOpenedBoxWeight(boxes.value[1]);
  rigging.applyFinalChoiceWeight(boxes.value[0], boxes.value[5]);

  const state = Object.fromEntries(Object.entries({
    gameAudioVolume: .75, isVolumePanelOpen: false, phase: "lobby", isExtremeFinalDuel: false, resultPayout: 1500,
    jackpotValueThreshold: 1000, lowValueThreshold: 100, badRevealStreak: 0, hiddenBoxCount: 6, majorHiddenCount: 2,
    lowHiddenCount: 1, currentBankerRequest: null, majorMusicValueThreshold: 1000, maxConfiguredBoxValue: 5000,
    currentOffer: 300, musicScene: "waiting", musicOverrideScene: ""
  }).map(([key, value]) => [key, ref(value)]));
  const calls = [];
  const music = api.createDealMusicScene({ ...state, musicDirector: { unlock() { calls.push("unlock"); }, setScene(scene) { calls.push(["scene", scene]); }, setVolume(volume) { calls.push(["music-volume", volume]); } }, soundscape: { setVolume(volume) { calls.push(["sound-volume", volume]); } } });
  const scenes = ["lobby", "select", "open", "banker", "finalChoice", "targetChoice", "result"].map((phase) => { state.phase.value = phase; return [phase, music.automaticMusicScene()]; });
  state.isExtremeFinalDuel.value = true; state.phase.value = "finalChoice";
  scenes.push(["extreme-final", music.automaticMusicScene()]);
  state.phase.value = "open";
  music.applyGameAudioVolume(.4);
  music.applyGameAudioVolume(.4);
  music.cueMusicOverride("heroic", 500);
  const override = state.musicOverrideScene.value;
  music.releaseMusicOverrideForEvent();
  music.dispose();
  return { bank, riggedValues: boxes.value.map((box) => box.value), scenes, override, released: state.musicOverrideScene.value, calls };
}

module.exports = { traceDealControllers };
