/** Cycle de partie et révélations différées ; chaque minuteur appartient au contrôleur. */
export function createDealRound(context){
  const timers = new Set()
  let disposed = false
  function schedule(callback, delay) {
    if (disposed) return 0
    const timer = window.setTimeout(() => {
      timers.delete(timer)
      if (!disposed) callback()
    }, delay)
    timers.add(timer)
    return timer
  }
  function dispose() {
    disposed = true
    for (const timer of timers) window.clearTimeout(timer)
    timers.clear()
  }
const { activateMusic, soundscape, ensureSelectedEntryOption, selectedEntryOption, entryOptions, playerCount, currentPlayer, t, entryCost, normalizeRewardMultiplier, boxes, createBoxes, roundIndex, openedThisRound, roundTarget, roundPattern, currentOffer, currentBankerRequest, acceptedOffer, finalValue, finalDecision, bankerBonus, usedForcedBankerRequestKeys, badRevealStreak, musicOverrideScene, musicController, isResolving, phase, addFeed, burst, applySelectedBoxWeight, otherUnopenedBoxes, pulseGift, releaseMusicOverrideForEvent, applyOpenedBoxWeight, isBigBoxValue, registerMusicReveal, formatRewardDiamonds, findForcedBankerRequest, createBankerRequest, createCashBankerRequest, rewardValue, ownBox, formatDiamonds, applyFinalChoiceWeight, resultPayout, cueMusicOverride, nextId } = context;
function startNextPlayer() {
  activateMusic()
  soundscape.startPlayer()
  ensureSelectedEntryOption()
  const entryOption = selectedEntryOption.value || entryOptions.value[0]
  playerCount.value += 1
  currentPlayer.value = {
    id: nextId(),
    name: t('playableGames.dealOrNoDeal.feed.playerName', { count: playerCount.value }),
    diamonds: entryOption?.cost || entryCost.value,
    payoutMultiplier: normalizeRewardMultiplier(entryOption?.multiplier),
  }
  boxes.value = createBoxes()
  roundIndex.value = 0
  openedThisRound.value = 0
  roundTarget.value = roundPattern.value[0] || 1
  currentOffer.value = 0
  currentBankerRequest.value = null
  acceptedOffer.value = null
  finalValue.value = null
  finalDecision.value = ''
  bankerBonus.value = 0
  usedForcedBankerRequestKeys.value = []
  badRevealStreak.value = 0
  musicOverrideScene.value = ''
  musicController.dispose()
  isResolving.value = false
  phase.value = 'select'
  addFeed(t('playableGames.dealOrNoDeal.feed.playerJoins', { player: currentPlayer.value.name }), 'join')
  burst('cyan')
}

function handleCaseClick(box) {
  activateMusic()

  if (phase.value === 'select') {
    selectOwnBox(box)
    return
  }

  if (phase.value === 'opening') {
    openBox(box)
    return
  }

  if (phase.value === 'targetChoice') {
    resolveBankerTargetChoice(box)
  }
}

function selectOwnBox(box) {
  soundscape.selectBox()
  boxes.value.forEach((item) => {
    item.own = item.id === box.id
  })
  applySelectedBoxWeight(box)
  phase.value = 'opening'
  openedThisRound.value = 0
  roundTarget.value = Math.min(roundPattern.value[0] || 1, Math.max(1, otherUnopenedBoxes.value.length - 1))
  addFeed(t('playableGames.dealOrNoDeal.feed.keepBox', { player: currentPlayer.value.name, box: box.id }), 'host')
  pulseGift(t('playableGames.dealOrNoDeal.feed.box', { box: box.id }), 'gold')
}

function canTouchBox(box) {
  if (isResolving.value || box.opened) return false
  if (phase.value === 'select') return true
  if (phase.value === 'opening') return !box.own
  if (phase.value === 'targetChoice') return !box.own
  return false
}

function openBox(box) {
  if (!canTouchBox(box)) return
  releaseMusicOverrideForEvent()
  soundscape.caseOpening()
  isResolving.value = true
  box.revealing = true

  schedule(() => {
    applyOpenedBoxWeight(box)
    box.opened = true
    box.revealing = false
    openedThisRound.value += 1
    const isBigReveal = isBigBoxValue(box.value)
    registerMusicReveal(box.value)
    soundscape[isBigReveal ? 'caseHigh' : 'caseLow']()
    addFeed(t('playableGames.dealOrNoDeal.feed.boxOpened', { box: box.id, amount: formatRewardDiamonds(box.value) }), isBigReveal ? 'danger' : 'open')
    pulseGift(formatRewardDiamonds(box.value, true), isBigReveal ? 'danger' : 'open')
    burst(isBigReveal ? 'red' : 'gold')
    isResolving.value = false

    if (otherUnopenedBoxes.value.length <= 1) {
      phase.value = 'finalChoice'
      addFeed(t('playableGames.dealOrNoDeal.feed.finalDecision'), 'host')
      return
    }

    const forcedBankerRequest = findForcedBankerRequest()
    if (forcedBankerRequest) {
      showBankerOffer(forcedBankerRequest)
      return
    }

    if (openedThisRound.value >= roundTarget.value) {
      showBankerOffer()
    }
  }, 520)
}

function showBankerOffer(forcedConfig = null) {
  soundscape.bankerCall()
  currentBankerRequest.value = createBankerRequest(forcedConfig)
  currentOffer.value = currentBankerRequest.value?.amount || 0
  phase.value = 'bankerCall'
  addFeed(t('playableGames.dealOrNoDeal.feed.bankerCall'), 'offer')
  pulseGift(t('playableGames.dealOrNoDeal.banker'), 'offer')
}

function answerBankerCall() {
  activateMusic()
  if (!currentBankerRequest.value) {
    currentBankerRequest.value = createBankerRequest()
    currentOffer.value = currentBankerRequest.value?.amount || 0
  }

  phase.value = 'banker'
  releaseMusicOverrideForEvent()
  addFeed(currentBankerRequest.value?.feedText || t('playableGames.dealOrNoDeal.feed.bankerOffer', { amount: formatRewardDiamonds(currentOffer.value) }), 'offer')
  pulseGift(t('playableGames.dealOrNoDeal.banker'), 'offer')
  soundscape.offerReveal()
}

function acceptOffer() {
  activateMusic()
  const request = currentBankerRequest.value || createCashBankerRequest({
    id: 'legacy-cash-offer',
    amount: currentOffer.value,
  })

  if (request.requiresTargetChoice) {
    beginBankerTargetChoice(request)
    return
  }

  if (request.type === 'swapBox') {
    acceptSwapRequest(request)
    return
  }

  if (request.type === 'buyBox') {
    acceptBuyBoxRequest(request)
    return
  }

  soundscape.acceptDeal()
  acceptedOffer.value = rewardValue(request.amount) + bankerBonus.value
  finalValue.value = ownBox.value?.value || 0
  finalDecision.value = t('playableGames.dealOrNoDeal.result.acceptedOffer')
  revealFinalBoxes()
  phase.value = 'result'
  addFeed(t('playableGames.dealOrNoDeal.feed.playerTakes', { player: currentPlayer.value.name, amount: formatDiamonds(acceptedOffer.value) }), 'offer')
  burst('gold', 44)
}

function beginBankerTargetChoice(request) {
  currentBankerRequest.value = request
  phase.value = 'targetChoice'
  releaseMusicOverrideForEvent()
  addFeed(t('playableGames.dealOrNoDeal.feed.playerChoosesBox'), 'host')
}

function resolveBankerTargetChoice(box) {
  if (!canTouchBox(box) || !currentBankerRequest.value) return
  const request = {
    ...currentBankerRequest.value,
    targetBoxId: box.id,
    requiresTargetChoice: false,
  }

  if (request.type === 'swapBox') {
    acceptSwapRequest(request)
    return
  }

  if (request.type === 'buyBox') {
    acceptBuyBoxRequest(request)
  }
}

function rejectOffer() {
  activateMusic()
  soundscape.rejectDeal()
  addFeed(t('playableGames.dealOrNoDeal.feed.playerLeavesOffer', { player: currentPlayer.value.name }), 'host')
  continueAfterBankerDecision('cyan', 18)
}

function acceptSwapRequest(request) {
  const targetBox = boxes.value.find((box) => box.id === request.targetBoxId && !box.opened && !box.own)
  if (!targetBox || !ownBox.value) {
    continueAfterBankerDecision('cyan', 18)
    return
  }

  soundscape.acceptDeal()
  ownBox.value.own = false
  targetBox.own = true
  addFeed(t('playableGames.dealOrNoDeal.feed.playerSwapsBox', { player: currentPlayer.value.name, box: targetBox.id }), 'offer')
  pulseGift(t('playableGames.dealOrNoDeal.feed.box', { box: targetBox.id }), 'gold')
  continueAfterBankerDecision('cyan', 24)
}

function acceptBuyBoxRequest(request) {
  const targetBox = boxes.value.find((box) => box.id === request.targetBoxId && !box.opened && !box.own)
  if (!targetBox) {
    continueAfterBankerDecision('cyan', 18)
    return
  }

  soundscape.acceptDeal()
  isResolving.value = true
  phase.value = 'opening'
  currentBankerRequest.value = null
  targetBox.revealing = true

  schedule(() => {
    targetBox.opened = true
    targetBox.revealing = false

    const purchaseDelta = rewardValue(targetBox.value) - request.amount
    bankerBonus.value += purchaseDelta
    const isBigReveal = isBigBoxValue(targetBox.value)
    registerMusicReveal(targetBox.value)
    soundscape[isBigReveal ? 'caseHigh' : 'caseLow']()
    addFeed(t('playableGames.dealOrNoDeal.feed.playerBuysBox', {
      player: currentPlayer.value.name,
      box: targetBox.id,
      amount: formatRewardDiamonds(targetBox.value),
      price: formatDiamonds(request.amount),
    }), isBigReveal ? 'danger' : 'open')
    pulseGift(formatRewardDiamonds(targetBox.value, true), isBigReveal ? 'danger' : 'open')
    burst(isBigReveal ? 'red' : 'gold')
    isResolving.value = false
    continueAfterBankerDecision('cyan', 18)
  }, 520)
}

function continueAfterBankerDecision(burstType = 'cyan', burstCount = 18) {
  roundIndex.value += 1
  openedThisRound.value = 0
  currentOffer.value = 0
  currentBankerRequest.value = null
  if (otherUnopenedBoxes.value.length <= 1) {
    phase.value = 'finalChoice'
    return
  }
  roundTarget.value = Math.min(roundPattern.value[roundIndex.value] || 1, Math.max(1, otherUnopenedBoxes.value.length - 1))
  phase.value = 'opening'
  burst(burstType, burstCount)
}

function finishFinal(shouldSwap) {
  activateMusic()
  const finalOther = otherUnopenedBoxes.value[0]
  const selectedFinalBox = shouldSwap ? finalOther : ownBox.value
  const unselectedFinalBox = shouldSwap ? ownBox.value : finalOther

  applyFinalChoiceWeight(selectedFinalBox, unselectedFinalBox)

  finalValue.value = selectedFinalBox?.value || 0
  acceptedOffer.value = null
  finalDecision.value = shouldSwap
    ? t('playableGames.dealOrNoDeal.result.swappedBox')
    : t('playableGames.dealOrNoDeal.result.keptBox')
  revealFinalBoxes()
  phase.value = 'result'
  addFeed(`${currentPlayer.value.name}: ${formatDiamonds(resultPayout.value)}`, 'join')
  const isBigFinal = isBigBoxValue(finalValue.value)
  cueMusicOverride(isBigFinal ? 'heroicTension' : 'dramaticLoss', 12000)
  soundscape.finalReveal(isBigFinal)
  burst(isBigFinal ? 'gold' : 'cyan', isBigFinal ? 60 : 32)
}

function revealFinalBoxes() {
  boxes.value.forEach((box) => {
    if (box.own || !box.opened) box.opened = true
  })
}

function backToLobby() {
  activateMusic()
  soundscape.back()
  currentPlayer.value = null
  boxes.value = createBoxes()
  phase.value = 'lobby'
  currentOffer.value = 0
  currentBankerRequest.value = null
  acceptedOffer.value = null
  finalValue.value = null
  finalDecision.value = ''
  bankerBonus.value = 0
  usedForcedBankerRequestKeys.value = []
  badRevealStreak.value = 0
  musicOverrideScene.value = ''
  musicController.dispose()
  addFeed(t('playableGames.dealOrNoDeal.feed.backToWaiting'), 'host')
}
return {startNextPlayer, handleCaseClick, selectOwnBox, canTouchBox, openBox, showBankerOffer, answerBankerCall, acceptOffer, beginBankerTargetChoice, resolveBankerTargetChoice, rejectOffer, acceptSwapRequest, acceptBuyBoxRequest, continueAfterBankerDecision, finishFinal, revealFinalBoxes, backToLobby, dispose}
}
