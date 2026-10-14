import { pickRandom, swapBoxValues } from './box-utils.mjs'

export function createDealRigging(context) {
  const { riggingSettings, boxes, openedNonPlayerBoxCount, badRevealStreak } = context

  function applySelectedBoxWeight(selectedBox) {
    if (!riggingSettings.value?.enabled || !selectedBox) return
    const originalValue = Number(selectedBox.value) || 0
    const wantsBigValue = Math.random() < riggingSettings.value.selectedBoxBigValueChance
    const candidates = boxes.value.filter((box) => (
      box.value <= originalValue
      && isSelectedBoxBigValue(box.value) === wantsBigValue
    ))
    const targetBox = pickRandom(candidates)
  
    if (targetBox) swapBoxValues(selectedBox, targetBox)
  }

  function applyOpenedBoxWeight(openedBox) {
    if (!riggingSettings.value?.enabled || !openedBox || openedBox.opened) return
    const currentValue = Number(openedBox.value) || 0
    const candidates = boxes.value
      .filter((box) => !box.opened && box.id !== openedBox.id && box.value > currentValue)
      .sort((left, right) => left.value - right.value)
    const targetBox = pickOpenedBoxWeightTarget(candidates)
  
    if (targetBox) swapBoxValues(openedBox, targetBox)
  }

  function pickOpenedBoxWeightTarget(candidates) {
    if (!candidates.length) return null
  
    const isEarlyGame = openedNonPlayerBoxCount.value < 4
    const normalRevealChance = badRevealStreak.value >= 2
      ? 0.78
      : badRevealStreak.value === 1
        ? 0.60
        : isEarlyGame
          ? 0.52
          : 0.36
  
    if (Math.random() < normalRevealChance) return null
  
    const roll = Math.random()
    const topStart = Math.max(0, Math.floor(candidates.length * 0.78))
    const middleStart = Math.max(0, Math.floor(candidates.length * 0.20))
    const middleEnd = Math.max(middleStart + 1, Math.ceil(candidates.length * (isEarlyGame ? 0.70 : 0.82)))
    let pool = candidates
    let bias = isEarlyGame ? 0.75 : 1.25
  
    if (badRevealStreak.value >= 2) {
      pool = roll < 0.90
        ? candidates.slice(0, Math.max(1, topStart))
        : candidates
      bias = 0.75
    } else if (badRevealStreak.value === 1) {
      pool = roll < 0.04
        ? candidates.slice(topStart)
        : roll < 0.82
          ? candidates.slice(middleStart, middleEnd)
          : candidates
      bias = 0.9
    } else if (isEarlyGame) {
      pool = roll < 0.04
        ? candidates.slice(topStart)
        : roll < 0.84
          ? candidates.slice(middleStart, middleEnd)
          : candidates
    } else {
      pool = roll < 0.12
        ? candidates.slice(topStart)
        : roll < 0.74
          ? candidates.slice(middleStart, middleEnd)
          : candidates
    }
  
    return pickRankWeightedBox(pool.length ? pool : candidates, bias)
  }

  function pickRankWeightedBox(items, bias = 1.7) {
    if (!items.length) return null
  
    const weights = items.map((_, index) => Math.pow((index + 1) / items.length, bias))
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let cursor = Math.random() * totalWeight
  
    for (let index = 0; index < items.length; index += 1) {
      cursor -= weights[index]
      if (cursor <= 0) return items[index]
    }
  
    return items[items.length - 1]
  }

  function applyFinalChoiceWeight(selectedBox, unselectedBox) {
    if (!riggingSettings.value?.enabled) return
    const lowValueBox = getFinalChoiceLowValueBox(selectedBox, unselectedBox)
    if (!lowValueBox) return
  
    const selectedShouldReceiveLowValue = Math.random() < riggingSettings.value.finalChoiceLowValueChance
    const selectedHasLowValue = selectedBox.id === lowValueBox.id
  
    if (selectedShouldReceiveLowValue !== selectedHasLowValue) {
      swapBoxValues(selectedBox, unselectedBox)
    }
  }

  function isSelectedBoxBigValue(value) {
    return value >= riggingSettings.value.selectedBoxBigValueThreshold
  }

  function getFinalChoiceLowValueBox(leftBox, rightBox) {
    if (!leftBox || !rightBox) return null
    if (!isFinalChoicePair(leftBox.value, rightBox.value)) return null
    if (leftBox.value === rightBox.value) return null
    return leftBox.value < rightBox.value ? leftBox : rightBox
  }

  function isFinalChoicePair(leftValue, rightValue) {
    const trapValue = riggingSettings.value.finalChoiceLowValue
    const highThreshold = riggingSettings.value.finalChoiceHighValueThreshold
    const hasConfiguredTrapValue = leftValue === trapValue || rightValue === trapValue
    const hasHighValue = leftValue >= highThreshold || rightValue >= highThreshold
  
    return hasHighValue && (hasConfiguredTrapValue || leftValue !== rightValue)
  }
  return { applySelectedBoxWeight, applyOpenedBoxWeight, pickOpenedBoxWeightTarget, pickRankWeightedBox, applyFinalChoiceWeight, isSelectedBoxBigValue, getFinalChoiceLowValueBox, isFinalChoicePair }
}

