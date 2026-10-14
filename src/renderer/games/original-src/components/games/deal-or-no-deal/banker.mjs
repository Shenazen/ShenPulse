import { pickRandom } from './box-utils.mjs'

export function createDealBanker(context) {
  const { bankerRequests, t, formatRewardDiamonds, formatDiamonds, otherUnopenedBoxes, openedNonPlayerBoxCount, usedForcedBankerRequestKeys, boxValues, boxes, roundIndex, roundPattern, jackpotValueThreshold, weakBoardThreshold } = context

  function createBankerRequest(forcedConfig = null) {
    if (forcedConfig && canUseBankerRequest(forcedConfig, { forced: true })) {
      return createBankerRequestFromConfig(forcedConfig)
    }
  
    const availableRequests = bankerRequests.value.filter((request) => canUseBankerRequest(request))
    const config = pickWeightedBankerRequest(availableRequests) || {
      id: 'cash-offer-fallback',
      type: 'cashOffer',
      enabled: true,
      weight: 1,
      amount: 0,
      targetMode: 'random',
    }
  
    return createBankerRequestFromConfig(config)
  }

  function createBankerRequestFromConfig(config) {
    if (config.type === 'swapBox') return createSwapBankerRequest(config)
    if (config.type === 'buyBox') return createBuyBoxBankerRequest(config)
    return createCashBankerRequest(config)
  }

  function createCashBankerRequest(config) {
    const amount = config.amount > 0 ? config.amount : calculateOffer()
    return {
      id: config.id,
      type: 'cashOffer',
      amount,
      title: t('playableGames.dealOrNoDeal.bankerOffer'),
      detail: formatRewardDiamonds(amount),
      acceptLabel: t('playableGames.dealOrNoDeal.take'),
      rejectLabel: t('playableGames.dealOrNoDeal.leave'),
      feedText: t('playableGames.dealOrNoDeal.feed.bankerOffer', { amount: formatRewardDiamonds(amount) }),
    }
  }

  function createSwapBankerRequest(config) {
    return {
      id: config.id,
      type: 'swapBox',
      targetMode: 'playerChoice',
      requiresTargetChoice: true,
      amount: 0,
      title: t('playableGames.dealOrNoDeal.bankerSwapOffer'),
      detail: t('playableGames.dealOrNoDeal.bankerSwapPlayerChoiceDetail'),
      acceptLabel: t('playableGames.dealOrNoDeal.chooseBox'),
      rejectLabel: t('playableGames.dealOrNoDeal.leave'),
      feedText: t('playableGames.dealOrNoDeal.feed.bankerSwapPlayerChoiceOffer'),
    }
  }

  function createBuyBoxBankerRequest(config) {
    const amount = Math.max(0, Math.round(Number(config.amount) || 0))
    if (config.targetMode === 'playerChoice') {
      return {
        id: config.id,
        type: 'buyBox',
        targetMode: 'playerChoice',
        requiresTargetChoice: true,
        amount,
        title: t('playableGames.dealOrNoDeal.bankerBuyBoxOffer'),
        detail: t('playableGames.dealOrNoDeal.bankerBuyBoxPlayerChoiceDetail', { amount: formatDiamonds(amount) }),
        acceptLabel: t('playableGames.dealOrNoDeal.chooseBox'),
        rejectLabel: t('playableGames.dealOrNoDeal.leave'),
        feedText: t('playableGames.dealOrNoDeal.feed.bankerBuyBoxPlayerChoiceOffer', { amount: formatDiamonds(amount) }),
      }
    }
  
    const targetBox = pickTargetBox(config.targetMode)
    if (!targetBox) return createCashBankerRequest(config)
  
    return {
      id: config.id,
      type: 'buyBox',
      targetBoxId: targetBox.id,
      amount,
      title: t('playableGames.dealOrNoDeal.bankerBuyBoxOffer'),
      detail: t('playableGames.dealOrNoDeal.bankerBuyBoxDetail', { box: targetBox.id, amount: formatDiamonds(amount) }),
      acceptLabel: t('playableGames.dealOrNoDeal.buy'),
      rejectLabel: t('playableGames.dealOrNoDeal.leave'),
      feedText: t('playableGames.dealOrNoDeal.feed.bankerBuyBoxOffer', { box: targetBox.id, amount: formatDiamonds(amount) }),
    }
  }

  function canUseBankerRequest(request, options = {}) {
    if (!request?.enabled) return false
    if (!options.forced && normalizeBankerRequestWeight(request.weight) <= 0) return false
    if (request.type === 'swapBox' || request.type === 'buyBox') return otherUnopenedBoxes.value.length > 0
    return true
  }

  function pickWeightedBankerRequest(requests) {
    const totalWeight = requests.reduce((sum, request) => sum + normalizeBankerRequestWeight(request.weight), 0)
    if (totalWeight <= 0) return null
  
    let cursor = Math.random() * totalWeight
    for (const request of requests) {
      cursor -= normalizeBankerRequestWeight(request.weight)
      if (cursor <= 0) return request
    }
  
    return requests[requests.length - 1] || null
  }

  function findForcedBankerRequest() {
    const openedCount = openedNonPlayerBoxCount.value
    const request = bankerRequests.value.find((candidate) => {
      const forceAfterOpenedCount = normalizeForcedOpenCount(candidate.forceAfterOpenedCount)
      return (
        forceAfterOpenedCount === openedCount
        && !usedForcedBankerRequestKeys.value.includes(forcedBankerRequestKey(candidate))
        && canUseBankerRequest(candidate, { forced: true })
      )
    })
  
    if (request) {
      usedForcedBankerRequestKeys.value = [
        ...usedForcedBankerRequestKeys.value,
        forcedBankerRequestKey(request),
      ]
    }
  
    return request || null
  }

  function forcedBankerRequestKey(request) {
    return `${request.id}:${normalizeForcedOpenCount(request.forceAfterOpenedCount)}`
  }

  function normalizeForcedOpenCount(value) {
    const parsedValue = Math.round(Number(value) || 0)
    return Math.max(0, Math.min(boxValues.value.length - 3, Number.isFinite(parsedValue) ? parsedValue : 0))
  }

  function normalizeBankerRequestWeight(value) {
    const parsedValue = Math.round(Number(value) || 0)
    return Math.max(0, Math.min(999, Number.isFinite(parsedValue) ? parsedValue : 0))
  }

  function pickTargetBox(targetMode = 'random') {
    const candidates = [...otherUnopenedBoxes.value]
    if (candidates.length === 0) return null
    if (targetMode === 'highest') return candidates.sort((left, right) => right.value - left.value)[0]
    if (targetMode === 'lowest') return candidates.sort((left, right) => left.value - right.value)[0]
    return pickRandom(candidates)
  }

  function calculateOffer() {
    const hiddenValues = boxes.value.filter((box) => !box.opened).map((box) => box.value)
    const average = hiddenValues.reduce((sum, value) => sum + value, 0) / hiddenValues.length
    const maxValue = Math.max(...hiddenValues)
    const roundPressure = Math.min(1, roundIndex.value / Math.max(1, roundPattern.value.length - 1))
    let factor = 0.21 + roundPressure * 0.6
  
    if (maxValue >= jackpotValueThreshold.value) factor += 0.07
    if (maxValue <= weakBoardThreshold.value) factor -= 0.08
    if (hiddenValues.length <= 4) factor += 0.12
  
    const jitter = 0.9 + Math.random() * 0.22
    return Math.max(25, Math.round((average * factor * jitter) / 25) * 25)
  }
  return { createBankerRequest, createBankerRequestFromConfig, createCashBankerRequest, createSwapBankerRequest, createBuyBoxBankerRequest, canUseBankerRequest, pickWeightedBankerRequest, findForcedBankerRequest, forcedBankerRequestKey, normalizeForcedOpenCount, normalizeBankerRequestWeight, pickTargetBox, calculateOffer }
}

