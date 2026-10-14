"use strict";

/** Traverse les manches réelles, les appels du banquier et les gains finaux. */
function traceDealRound(api, flushTimers) {
  const ref = (value) => ({ value });
  const calls = [];
  let nextId = 7;
  const createBoxes = () => [10, 50, 100, 500].map((value, index) => ({ id: index + 1, value, opened: false, own: false, revealing: false }));
  const state = Object.fromEntries(Object.entries({
    playerCount: 0, currentPlayer: null, entryCost: 25, boxes: createBoxes(), roundIndex: 0, openedThisRound: 0,
    roundTarget: 1, roundPattern: [1, 1, 1], currentOffer: 0, currentBankerRequest: null, acceptedOffer: null,
    finalValue: null, finalDecision: "", bankerBonus: 0, usedForcedBankerRequestKeys: [], badRevealStreak: 0,
    musicOverrideScene: "", isResolving: false, phase: "lobby", selectedEntryOption: { cost: 25, multiplier: 2 },
    entryOptions: [{ cost: 25, multiplier: 2 }]
  }).map(([key, value]) => [key, ref(value)]));
  const context = {
    ...state, createBoxes, nextId: () => nextId++, musicController: { dispose() { calls.push("reset-music"); } },
    otherUnopenedBoxes: { get value() { return state.boxes.value.filter((box) => !box.own && !box.opened); } },
    ownBox: { get value() { return state.boxes.value.find((box) => box.own); } },
    resultPayout: { get value() { return state.acceptedOffer.value ?? state.finalValue.value * 2 + state.bankerBonus.value; } },
    soundscape: new Proxy({}, { get: (_, name) => (...args) => calls.push(["sound", name, ...args]) }),
    t: (key, parameters = {}) => `${key}:${JSON.stringify(parameters)}`,
    activateMusic: () => calls.push("activate-music"), ensureSelectedEntryOption() {}, normalizeRewardMultiplier: (value) => value || 1,
    addFeed: (...args) => calls.push(["feed", ...args]), burst: (...args) => calls.push(["burst", ...args]),
    pulseGift: (...args) => calls.push(["gift", ...args]), applySelectedBoxWeight() {}, applyOpenedBoxWeight() {},
    applyFinalChoiceWeight() {}, releaseMusicOverrideForEvent() {}, registerMusicReveal() {}, findForcedBankerRequest: () => null,
    isBigBoxValue: (value) => value >= 100, formatRewardDiamonds: (value) => `reward:${value * 2}`,
    formatDiamonds: (value) => String(value), rewardValue: (value) => value * 2,
    createBankerRequest: () => ({ type: "cashOffer", amount: 150, feedText: "bank-offer" }),
    createCashBankerRequest: (config) => ({ type: "cashOffer", ...config }), cueMusicOverride: (...args) => calls.push(["music", ...args])
  };
  const round = api.createDealRound(context);
  const snapshot = () => ({ phase: state.phase.value, round: state.roundIndex.value, target: state.roundTarget.value, busy: state.isResolving.value,
    final: state.finalValue.value, accepted: state.acceptedOffer.value, bonus: state.bankerBonus.value,
    boxes: state.boxes.value.map((box) => [box.id, box.value, box.opened, box.own, box.revealing]) });
  const stages = [];
  round.startNextPlayer(); stages.push(snapshot());
  round.handleCaseClick(state.boxes.value[0]); stages.push(snapshot());
  round.handleCaseClick(state.boxes.value[1]); stages.push(snapshot());
  flushTimers(); stages.push(snapshot());
  round.answerBankerCall(); stages.push(snapshot());
  round.rejectOffer(); stages.push(snapshot());
  round.handleCaseClick(state.boxes.value[2]); flushTimers(); stages.push(snapshot());
  round.finishFinal(true); stages.push(snapshot());
  round.backToLobby(); stages.push(snapshot());
  round.startNextPlayer(); round.selectOwnBox(state.boxes.value[0]);
  state.currentBankerRequest.value = { type: "cashOffer", amount: 300 };
  state.bankerBonus.value = 15;
  round.acceptOffer(); stages.push(snapshot());
  round.startNextPlayer(); round.selectOwnBox(state.boxes.value[0]);
  round.acceptBuyBoxRequest({ type: "buyBox", amount: 25, targetBoxId: 2 });
  flushTimers(); stages.push(snapshot());
  return { stages, calls, player: state.currentPlayer.value, payout: context.resultPayout.value };
}

module.exports = { traceDealRound };
