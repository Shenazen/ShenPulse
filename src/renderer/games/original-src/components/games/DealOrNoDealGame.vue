<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Check,
  PhoneCall,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from 'lucide-vue-next'
import {
  DEFAULT_ENTRY_COST,
  RIGHT_RAIL_GOLD_COUNT,
} from './dealOrNoDealConfig'
import {
  DEAL_OR_NO_DEAL_SETTINGS_EVENT,
  DEAL_OR_NO_DEAL_SETTINGS_STORAGE_KEY,
  loadDealOrNoDealSettings,
} from './dealOrNoDealSettings'
import { publishDealOrNoDealHostState } from './dealOrNoDealHostState'
import { createDealOrNoDealMusicDirector } from './dealOrNoDealMusic'
import { createDealOrNoDealSoundscape } from './dealOrNoDealSoundscape'


const { t, locale } = useI18n()
const GAME_AUDIO_VOLUME_STORAGE_KEY = 'shenpulse.dealOrNoDeal.audioVolume'
let idSeed = 1
const initialSettings = loadDealOrNoDealSettings()
const soundscape = createDealOrNoDealSoundscape()
const musicDirector = createDealOrNoDealMusicDirector()
musicDirector.setTracks(initialSettings.music)
const phase = ref('lobby')
const boxValues = ref(initialSettings.boxValues)
const roundPattern = ref(initialSettings.roundPattern)
const bankerRequests = ref(initialSettings.bankerRequests)
const riggingSettings = ref(initialSettings.rigging)
const spendSettings = ref(initialSettings.spend)
const boxes = ref(createBoxes())
const currentPlayer = ref(null)
const entryCost = ref(initialSettings.entryCost || DEFAULT_ENTRY_COST)
const selectedEntryOptionId = ref('base')
const entryBannerRef = ref(null)
const entryAmountRef = ref(null)
const premiumBasePriceRef = ref(null)
const premiumEntryPriceRef = ref(null)
const entryAmountScale = ref(1)
const premiumBasePriceScale = ref(1)
const premiumEntryPriceScale = ref(1)
const playerCount = ref(0)
const roundIndex = ref(0)
const roundTarget = ref(0)
const openedThisRound = ref(0)
const currentOffer = ref(0)
const currentBankerRequest = ref(null)
const acceptedOffer = ref(null)
const finalValue = ref(null)
const finalDecision = ref('')
const bankerBonus = ref(0)
const badRevealStreak = ref(0)
const musicOverrideScene = ref('')
const isVolumePanelOpen = ref(false)
const gameAudioVolume = ref(loadGameAudioVolume())
const usedForcedBankerRequestKeys = ref([])
const isResolving = ref(false)
const floaters = ref([])
const particles = ref([])
const feed = ref([
  { id: idSeed++, type: 'host', text: t('playableGames.dealOrNoDeal.feed.entry', { amount: formatDiamonds(entryCost.value) }) },
  { id: idSeed++, type: 'host', text: t('playableGames.dealOrNoDeal.feed.waiting') },
  { id: idSeed++, type: 'host', text: t('playableGames.dealOrNoDeal.feed.boardReady') },
])

const sortedBoxValues = computed(() => [...boxValues.value].sort((a, b) => a - b))
const prizeRailSplit = computed(() => Math.ceil(sortedBoxValues.value.length / 2))
const lowPrizeRail = computed(() => sortedBoxValues.value.slice(0, prizeRailSplit.value))
const highPrizeRail = computed(() => sortedBoxValues.value.slice(prizeRailSplit.value))
const bigValueThreshold = computed(() => valueAtPercentile(0.75))
const jackpotValueThreshold = computed(() => valueAtPercentile(0.9))
const weakBoardThreshold = computed(() => valueAtPercentile(0.6))
const ownBox = computed(() => boxes.value.find((box) => box.own))
const otherUnopenedBoxes = computed(() => boxes.value.filter((box) => !box.own && !box.opened))
const openedValues = computed(() => new Set(boxes.value.filter((box) => box.opened).map((box) => box.value)))
const openedNonPlayerBoxCount = computed(() => boxes.value.filter((box) => box.opened && !box.own).length)
const entryOptions = computed(() => availableEntryOptions())
const baseEntryOption = computed(() => entryOptions.value.find((option) => option.id === 'base') || entryOptions.value[0])
const premiumEntryOption = computed(() => entryOptions.value.find((option) => option.id === 'premium') || null)
const selectedEntryOption = computed(() => entryOptions.value.find((option) => option.id === selectedEntryOptionId.value) || entryOptions.value[0])
const activeEntryCost = computed(() => currentPlayer.value?.diamonds || selectedEntryOption.value?.cost || entryCost.value)
const entryAmountText = computed(() => formatEntryAmount(activeEntryCost.value))
const currentPayoutMultiplier = computed(() => normalizeRewardMultiplier(currentPlayer.value?.payoutMultiplier || selectedEntryOption.value?.multiplier || 1))
const isPremiumEntryBanner = computed(() => Boolean(premiumEntryOption.value) || normalizeRewardMultiplier(currentPlayer.value?.payoutMultiplier) > 1)
const baseEntryPriceText = computed(() => formatEntryAmount(baseEntryOption.value?.cost || entryCost.value))
const premiumEntryPriceText = computed(() => formatEntryAmount(premiumEntryOption.value?.cost || currentPlayer.value?.diamonds || entryCost.value))
const premiumEntryGainText = computed(() => t('playableGames.dealOrNoDeal.premiumGain', { multiplier: formatMultiplier(premiumEntryOption.value?.multiplier || currentPlayer.value?.payoutMultiplier || 1) }))
const resultPayout = computed(() => acceptedOffer.value ?? (rewardValue(finalValue.value || 0) + bankerBonus.value))
const hiddenBoxes = computed(() => boxes.value.filter((box) => !box.opened))
const hiddenValues = computed(() => hiddenBoxes.value.map((box) => box.value))
const hiddenBoxCount = computed(() => hiddenValues.value.length)
const maxConfiguredBoxValue = computed(() => sortedBoxValues.value[sortedBoxValues.value.length - 1] || 0)
const majorMusicValueThreshold = computed(() => Math.max(bigValueThreshold.value, Math.round(maxConfiguredBoxValue.value * 0.5)))
const lowValueThreshold = computed(() => valueAtPercentile(0.35))
const finalDuelLowValueThreshold = computed(() => Math.min(lowValueThreshold.value, Math.round(maxConfiguredBoxValue.value * 0.12)))
const majorHiddenCount = computed(() => hiddenValues.value.filter((value) => value >= majorMusicValueThreshold.value).length)
const lowHiddenCount = computed(() => hiddenValues.value.filter((value) => value <= lowValueThreshold.value).length)
const finalPairValues = computed(() => [ownBox.value, otherUnopenedBoxes.value[0]]
  .filter(Boolean)
  .map((box) => box.value))
const isExtremeFinalDuel = computed(() => {
  if (finalPairValues.value.length < 2) return false
  const highValue = Math.max(...finalPairValues.value)
  const lowValue = Math.min(...finalPairValues.value)
  return highValue >= majorMusicValueThreshold.value && lowValue <= finalDuelLowValueThreshold.value
})
const musicScene = computed(() => musicOverrideScene.value || automaticMusicScene())
const gameAudioVolumePercent = computed(() => Math.round(gameAudioVolume.value * 100))
let entryAmountResizeObserver = null
let entryAmountFitFrame = 0
let musicOverrideTimer = 0

watch(
  [phase, boxes, currentPlayer, currentPayoutMultiplier, selectedEntryOptionId, currentBankerRequest, bankerBonus],
  publishHostState,
  { deep: true, immediate: true },
)
watch(musicScene, (scene) => {
  musicDirector.setScene(scene)
})

watch(gameAudioVolume, applyGameAudioVolume, { immediate: true })

watch([entryAmountText, baseEntryPriceText, premiumEntryPriceText, isPremiumEntryBanner], () => {
  nextTick(scheduleEntryAmountFit)
})

onMounted(() => {
  musicDirector.preload()
  musicDirector.setScene(musicScene.value)

  if (typeof ResizeObserver !== 'undefined' && entryBannerRef.value) {
    entryAmountResizeObserver = new ResizeObserver(scheduleEntryAmountFit)
    entryAmountResizeObserver.observe(entryBannerRef.value)
  }

  window.addEventListener('pointerdown', handleAudioUnlockGesture, { passive: true })
  window.addEventListener('keydown', handleAudioUnlockGesture)
  window.addEventListener('resize', scheduleEntryAmountFit)
  window.addEventListener('storage', handleDealSettingsStorage)
  window.addEventListener(DEAL_OR_NO_DEAL_SETTINGS_EVENT, handleDealSettingsEvent)
  scheduleEntryAmountFit()
})

onBeforeUnmount(() => {
  entryAmountResizeObserver?.disconnect()
  window.removeEventListener('pointerdown', handleAudioUnlockGesture)
  window.removeEventListener('keydown', handleAudioUnlockGesture)
  window.removeEventListener('resize', scheduleEntryAmountFit)
  window.removeEventListener('storage', handleDealSettingsStorage)
  window.removeEventListener(DEAL_OR_NO_DEAL_SETTINGS_EVENT, handleDealSettingsEvent)
  window.cancelAnimationFrame(entryAmountFitFrame)
  window.clearTimeout(musicOverrideTimer)
  musicDirector.stop()
})

function createBoxes() {
  return shuffle([...boxValues.value]).map((value, index) => ({
    id: index + 1,
    value,
    opened: false,
    own: false,
    revealing: false,
  }))
}

function shuffle(items) {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function valueAtPercentile(percentile) {
  const sorted = [...boxValues.value].sort((a, b) => a - b)
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * percentile)))
  return sorted[index]
}

function isBigBoxValue(value) {
  return value >= bigValueThreshold.value
}

function availableEntryOptions() {
  const baseCost = Math.max(1, Math.round(Number(entryCost.value) || DEFAULT_ENTRY_COST))
  const options = [{ id: 'base', cost: baseCost, multiplier: 1 }]
  const premiumCost = Math.round(Number(spendSettings.value?.premiumEntryCost) || 0)
  const premiumMultiplier = normalizeRewardMultiplier(spendSettings.value?.rewardMultiplier)

  if (spendSettings.value?.enabled && premiumCost > 0 && premiumMultiplier > 1) {
    options.push({ id: 'premium', cost: premiumCost, multiplier: premiumMultiplier })
  }

  return options
}

function ensureSelectedEntryOption() {
  if (!entryOptions.value.some((option) => option.id === selectedEntryOptionId.value)) {
    selectedEntryOptionId.value = entryOptions.value[0]?.id || 'base'
  }
}

function normalizeRewardMultiplier(value) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 1
  return Math.max(0.01, Math.min(100, numericValue))
}

function rewardValue(value) {
  return Math.round((Number(value) || 0) * currentPayoutMultiplier.value)
}

function formatRewardDiamonds(value, compact = false) {
  return formatDiamonds(rewardValue(value), compact)
}

function formatDiamonds(value, compact = false) {
  const numericValue = Number(value) || 0
  const formatted = new Intl.NumberFormat(currentIntlLocale(), {
    notation: compact && Math.abs(numericValue) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: compact && Math.abs(numericValue) >= 10000 ? 1 : 0,
  }).format(numericValue)
  return `${formatted} \u{1F48E}`
}

function formatEntryAmount(value) {
  return new Intl.NumberFormat(currentIntlLocale(), {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function formatMultiplier(value) {
  const normalizedValue = normalizeRewardMultiplier(value)
  return new Intl.NumberFormat(currentIntlLocale(), {
    maximumFractionDigits: Number.isInteger(normalizedValue) ? 0 : 2,
  }).format(normalizedValue)
}

function currentIntlLocale() {
  return locale.value === 'fr' ? 'fr-FR' : 'en-US'
}

function loadGameAudioVolume() {
  if (typeof window === 'undefined') return 1

  const savedValue = window.localStorage.getItem(GAME_AUDIO_VOLUME_STORAGE_KEY)
  if (savedValue === null) return 1

  return clampGameAudioVolume(Number(savedValue))
}

function applyGameAudioVolume(value) {
  const clampedValue = clampGameAudioVolume(value)
  if (gameAudioVolume.value !== clampedValue) {
    gameAudioVolume.value = clampedValue
    return
  }

  musicDirector.setVolume(clampedValue)
  soundscape.setVolume(clampedValue)

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(GAME_AUDIO_VOLUME_STORAGE_KEY, String(clampedValue))
  }
}

function setGameAudioVolumeFromInput(event) {
  gameAudioVolume.value = clampGameAudioVolume(Number(event.target.value) / 100)
  activateMusic()
}

function toggleVolumePanel() {
  activateMusic()
  isVolumePanelOpen.value = !isVolumePanelOpen.value
}

function clampGameAudioVolume(value) {
  if (!Number.isFinite(value)) return 1
  return Math.max(0, Math.min(1.5, value))
}

function automaticMusicScene() {
  if (phase.value === 'lobby' || phase.value === 'select') return 'waiting'

  if (phase.value === 'finalChoice') {
    return isExtremeFinalDuel.value ? 'finalDuel' : 'solemnFinal'
  }

  if (phase.value === 'targetChoice') {
    if (isExtremeFinalDuel.value) return 'finalDuel'
    return isLateGameMusicMoment() ? 'solemnFinal' : 'bankerOffer'
  }

  if (phase.value === 'result') {
    if (resultPayout.value >= jackpotValueThreshold.value) return 'heroicTension'
    if (resultPayout.value <= lowValueThreshold.value) return 'dramaticLoss'
    return 'solemnFinal'
  }

  if (phase.value === 'banker') {
    if (isHeroicBankerMoment()) return 'heroicOffer'
    if (isLateGameMusicMoment()) return 'solemnFinal'
    return 'bankerOffer'
  }

  if (badRevealStreak.value >= 2) return 'badRun'
  if (isLateGameMusicMoment()) return 'solemnFinal'
  if (isComplexBoardMusicMoment()) return 'uncertain'

  return 'waiting'
}

function isLateGameMusicMoment() {
  return hiddenBoxCount.value > 0 && hiddenBoxCount.value <= 6
}

function isComplexBoardMusicMoment() {
  return hiddenBoxCount.value <= 14
    && majorHiddenCount.value > 0
    && lowHiddenCount.value > 0
}

function isHeroicBankerMoment() {
  if (!currentBankerRequest.value) return false
  const highOfferFloor = Math.max(majorMusicValueThreshold.value, maxConfiguredBoxValue.value * 0.5)
  return currentOffer.value >= highOfferFloor
    || (hiddenBoxCount.value <= 8 && majorHiddenCount.value >= 2)
}

function isMajorMusicValue(value) {
  return value >= majorMusicValueThreshold.value
}

function activateMusic() {
  musicDirector.unlock()
  musicDirector.setScene(musicScene.value)
}

function handleAudioUnlockGesture() {
  activateMusic()
}

function cueMusicOverride(scene, duration = 10000) {
  musicOverrideScene.value = scene
  window.clearTimeout(musicOverrideTimer)

  if (duration <= 0) return

  musicOverrideTimer = window.setTimeout(() => {
    if (musicOverrideScene.value === scene) musicOverrideScene.value = ''
  }, duration)
}

function releaseMusicOverrideForEvent() {
  if (!musicOverrideScene.value) return

  window.clearTimeout(musicOverrideTimer)
  musicOverrideScene.value = ''
  musicDirector.setScene(musicScene.value)
}

function registerMusicReveal(value) {
  if (value >= maxConfiguredBoxValue.value) {
    badRevealStreak.value += 1
    cueMusicOverride('funeral', 0)
    return
  }

  if (isMajorMusicValue(value)) {
    badRevealStreak.value += 1
    cueMusicOverride(badRevealStreak.value >= 2 ? 'badRun' : 'dramaticLoss', badRevealStreak.value >= 2 ? 14000 : 9500)
    return
  }

  badRevealStreak.value = 0
}

function scheduleEntryAmountFit() {
  if (typeof window === 'undefined') return

  window.cancelAnimationFrame(entryAmountFitFrame)
  entryAmountFitFrame = window.requestAnimationFrame(() => {
    fitEntryAmounts()
  })
}

function entryAmountFitTargets() {
  return [
    { element: entryAmountRef.value, scale: entryAmountScale },
    { element: premiumBasePriceRef.value, scale: premiumBasePriceScale },
    { element: premiumEntryPriceRef.value, scale: premiumEntryPriceScale },
  ].filter(({ element }) => element)
}

function fitEntryAmounts() {
  const targets = entryAmountFitTargets()
  if (!targets.length) return

  targets.forEach(({ scale }) => {
    scale.value = 1
  })
  nextTick(() => {
    targets.forEach((target) => {
      refineEntryAmountFit(target)
    })
  })
}

function refineEntryAmountFit({ element, scale }, attempt = 0) {
  if (!element) return

  const availableWidth = element.clientWidth
  const availableHeight = element.clientHeight
  const requiredWidth = element.scrollWidth
  const requiredHeight = element.scrollHeight
  if (!availableWidth || !availableHeight || !requiredWidth || !requiredHeight) return

  const widthScale = requiredWidth > availableWidth ? availableWidth / requiredWidth : 1
  const heightScale = requiredHeight > availableHeight ? availableHeight / requiredHeight : 1
  const nextRatio = Math.min(1, widthScale, heightScale) * 0.96
  const nextScale = Math.max(0.28, Number((scale.value * nextRatio).toFixed(3)))

  if (nextScale < scale.value) {
    scale.value = nextScale
  }

  if (attempt < 5 && (requiredWidth > availableWidth || requiredHeight > availableHeight)) {
    nextTick(() => refineEntryAmountFit({ element, scale }, attempt + 1))
  }
}

function startNextPlayer() {
  activateMusic()
  soundscape.startPlayer()
  ensureSelectedEntryOption()
  const entryOption = selectedEntryOption.value || entryOptions.value[0]
  playerCount.value += 1
  currentPlayer.value = {
    id: idSeed++,
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
  window.clearTimeout(musicOverrideTimer)
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

  window.setTimeout(() => {
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

  window.setTimeout(() => {
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

function handleDealSettingsEvent(event) {
  applyRuntimeDealSettings(event?.detail || loadDealOrNoDealSettings())
}

function handleDealSettingsStorage(event) {
  if (event?.key && event.key !== DEAL_OR_NO_DEAL_SETTINGS_STORAGE_KEY) return
  applyRuntimeDealSettings(loadDealOrNoDealSettings())
}

function applyRuntimeDealSettings(settings) {
  if (!settings) return

  entryCost.value = settings.entryCost || DEFAULT_ENTRY_COST
  bankerRequests.value = settings.bankerRequests
  roundPattern.value = settings.roundPattern
  riggingSettings.value = settings.rigging
  spendSettings.value = settings.spend
  musicDirector.setTracks(settings.music)

  if (phase.value === 'lobby') {
    boxValues.value = settings.boxValues
    boxes.value = createBoxes()
  }

  ensureSelectedEntryOption()
  scheduleEntryAmountFit()
}

function publishHostState() {
  publishDealOrNoDealHostState({
    phase: phase.value,
    playerName: currentPlayer.value?.name || '',
    payoutMultiplier: currentPayoutMultiplier.value,
    entryOptionId: currentPayoutMultiplier.value > 1 ? 'premium' : 'base',
    updatedAt: Date.now(),
    boxes: boxes.value.map((box) => ({
      id: box.id,
      value: box.value,
      opened: box.opened,
      own: box.own,
    })),
    bankerRequestType: currentBankerRequest.value?.type || '',
    bankerRequestText: currentBankerRequest.value?.detail || '',
    bonusValue: bankerBonus.value,
  })
}

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

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)]
}

function swapBoxValues(leftBox, rightBox) {
  if (!leftBox || !rightBox || leftBox.id === rightBox.id) return
  ;[leftBox.value, rightBox.value] = [rightBox.value, leftBox.value]
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
  window.clearTimeout(musicOverrideTimer)
  addFeed(t('playableGames.dealOrNoDeal.feed.backToWaiting'), 'host')
}

function addFeed(text, type = 'host') {
  feed.value = [{ id: idSeed++, type, text }, ...feed.value].slice(0, 6)
}

function pulseGift(label, type = 'gift') {
  const floater = {
    id: idSeed++,
    label,
    type,
    x: 10 + Math.random() * 72,
    drift: Math.random() * 36 - 18,
  }
  floaters.value.push(floater)
  window.setTimeout(() => {
    floaters.value = floaters.value.filter((item) => item.id !== floater.id)
  }, 2600)
}

function burst(type = 'gold', count = 28) {
  const colors = {
    gold: ['#ffd166', '#ffffff', '#ff8a00', '#38f9d7'],
    cyan: ['#24f7ff', '#ffffff', '#5cf27a', '#ffd166'],
    red: ['#ff4d6d', '#ffd166', '#ffffff', '#9b5cff'],
  }[type]

  const batch = Array.from({ length: count }, () => ({
    id: idSeed++,
    color: colors[Math.floor(Math.random() * colors.length)],
    x: 28 + Math.random() * 44,
    y: 35 + Math.random() * 25,
    tx: Math.random() * 240 - 120,
    ty: -80 - Math.random() * 160,
    delay: Math.random() * 0.15,
  }))

  particles.value.push(...batch)
  window.setTimeout(() => {
    const ids = new Set(batch.map((item) => item.id))
    particles.value = particles.value.filter((item) => !ids.has(item.id))
  }, 1500)
}

</script>

<template>
  <main class="app-shell">
    <section class="live-frame" :class="`is-${phase}`">
      <div class="stage-image" aria-hidden="true"></div>
      <div class="stage-vignette" aria-hidden="true"></div>
      <div class="scanlines" aria-hidden="true"></div>

      <div class="float-layer" aria-hidden="true">
        <span
          v-for="floater in floaters"
          :key="floater.id"
          class="gift-floater"
          :class="`float-${floater.type}`"
          :style="{ left: `${floater.x}%`, '--drift': `${floater.drift}px` }"
        >
          {{ floater.label }}
        </span>
      </div>

      <div class="burst-layer" aria-hidden="true">
        <span
          v-for="particle in particles"
          :key="particle.id"
          class="particle"
          :style="{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            background: particle.color,
            '--tx': `${particle.tx}px`,
            '--ty': `${particle.ty}px`,
            animationDelay: `${particle.delay}s`,
          }"
        ></span>
      </div>

      <div class="audio-control" :class="{ open: isVolumePanelOpen }">
        <button
          class="audio-toggle"
          type="button"
          :aria-label="t('playableGames.dealOrNoDeal.soundVolume')"
          @click="toggleVolumePanel"
        >
          <VolumeX v-if="gameAudioVolume <= 0.01" :size="16" />
          <Volume2 v-else :size="16" />
        </button>
        <div v-if="isVolumePanelOpen" class="audio-panel">
          <div class="audio-panel-header">
            <span>{{ t('playableGames.dealOrNoDeal.sound') }}</span>
            <strong>{{ gameAudioVolumePercent }}%</strong>
          </div>
          <input
            type="range"
            min="0"
            max="150"
            step="1"
            :aria-label="t('playableGames.dealOrNoDeal.soundVolume')"
            :value="gameAudioVolumePercent"
            @input="setGameAudioVolumeFromInput"
          />
        </div>
      </div>

      <header class="top-hud">
        <div class="brand">
          <h1>{{ t('playableGames.dealOrNoDeal.titleLine1') }}<br />{{ t('playableGames.dealOrNoDeal.titleLine2') }}</h1>
        </div>
      </header>

      <div
        ref="entryBannerRef"
        class="entry-banner"
        :class="{ 'is-premium-entry-banner': isPremiumEntryBanner }"
        :aria-label="t('playableGames.dealOrNoDeal.entryAria')"
      >
        <div class="entry-banner-art" aria-hidden="true"></div>
        <template v-if="isPremiumEntryBanner">
          <span
            ref="premiumBasePriceRef"
            class="premium-entry-text premium-entry-base-price"
            :style="{ '--premium-entry-amount-scale': premiumBasePriceScale }"
          >
            {{ baseEntryPriceText }}
          </span>
          <span
            ref="premiumEntryPriceRef"
            class="premium-entry-text premium-entry-premium-price"
            :style="{ '--premium-entry-amount-scale': premiumEntryPriceScale }"
          >
            {{ premiumEntryPriceText }}
          </span>
          <span class="premium-entry-gain">{{ premiumEntryGainText }}</span>
        </template>
        <span
          v-else
          ref="entryAmountRef"
          class="entry-banner-amount"
          :style="{ '--entry-amount-scale': entryAmountScale }"
        >
          {{ entryAmountText }}
        </span>
      </div>

      <aside class="prize-rail prize-left">
        <span
          v-for="value in lowPrizeRail"
          :key="value"
          class="prize-tile left-prize"
          :class="{ gone: openedValues.has(value) }"
        >
          {{ formatRewardDiamonds(value, true) }}
        </span>
      </aside>

      <aside class="prize-rail prize-right">
        <span
          v-for="(value, index) in highPrizeRail"
          :key="value"
          class="prize-tile right-prize"
          :class="{
            'right-gold': index < RIGHT_RAIL_GOLD_COUNT,
            'right-red': index >= RIGHT_RAIL_GOLD_COUNT,
            gone: openedValues.has(value),
          }"
        >
          {{ formatRewardDiamonds(value, true) }}
        </span>
      </aside>

      <section class="game-zone">
        <div v-if="phase === 'lobby'" class="lobby-panel">
          <Sparkles :size="32" />
          <strong>{{ t('playableGames.dealOrNoDeal.lobby') }}</strong>
          <div v-if="entryOptions.length > 1" class="entry-choice-group">
            <button
              v-for="option in entryOptions"
              :key="option.id"
              type="button"
              :class="{ active: selectedEntryOptionId === option.id }"
              @click="selectedEntryOptionId = option.id"
            >
              <span>{{ formatDiamonds(option.cost) }}</span>
              <small>x{{ option.multiplier }}</small>
            </button>
          </div>
          <button class="primary-action" type="button" @click="startNextPlayer">
            <Play :size="18" />
            {{ t('playableGames.common.launch') }}
          </button>
        </div>

        <div class="case-grid" :class="{ muted: phase === 'lobby' }">
          <button
            v-for="box in boxes"
            :key="box.id"
            type="button"
            class="case-box"
            :class="{
              selected: box.own,
              opened: box.opened,
              revealing: box.revealing,
              'target-candidate': phase === 'targetChoice' && canTouchBox(box),
              locked: !canTouchBox(box),
            }"
            :disabled="!canTouchBox(box)"
            @click="handleCaseClick(box)"
          >
            <span class="case-handle" aria-hidden="true"></span>
            <span class="case-latches" aria-hidden="true"></span>
            <span class="case-shine"></span>
            <span class="case-number">{{ box.id }}</span>
            <span class="case-value">
              {{ box.opened ? formatRewardDiamonds(box.value, true) : box.own ? t('playableGames.dealOrNoDeal.ownBox') : '' }}
            </span>
          </button>
        </div>
      </section>

      <section v-if="phase === 'bankerCall'" class="decision-panel banker-call-panel">
        <div class="phone-ring">
          <PhoneCall :size="30" />
        </div>
        <span>{{ t('playableGames.dealOrNoDeal.bankerCall') }}</span>
        <strong>{{ t('playableGames.dealOrNoDeal.bankerCallTitle') }}</strong>
        <small>{{ t('playableGames.dealOrNoDeal.bankerCallDetail') }}</small>
        <div class="decision-actions single-action">
          <button class="take-button" type="button" @click="answerBankerCall">
            <PhoneCall :size="17" />
            {{ t('playableGames.dealOrNoDeal.answer') }}
          </button>
        </div>
      </section>

      <section v-if="phase === 'banker'" class="decision-panel offer-panel">
        <div class="phone-ring">
          <PhoneCall :size="28" />
        </div>
        <span>{{ currentBankerRequest?.title || t('playableGames.dealOrNoDeal.bankerOffer') }}</span>
        <strong>{{ currentBankerRequest?.detail || formatRewardDiamonds(currentOffer) }}</strong>
        <div class="decision-actions">
          <button class="take-button" type="button" @click="acceptOffer">
            <Check :size="17" />
            {{ currentBankerRequest?.acceptLabel || t('playableGames.dealOrNoDeal.take') }}
          </button>
          <button class="leave-button" type="button" @click="rejectOffer">
            <X :size="17" />
            {{ currentBankerRequest?.rejectLabel || t('playableGames.dealOrNoDeal.leave') }}
          </button>
        </div>
      </section>

      <section v-if="phase === 'targetChoice'" class="decision-panel target-choice-panel">
        <RefreshCw :size="30" />
        <span>{{ currentBankerRequest?.title || t('playableGames.dealOrNoDeal.banker') }}</span>
        <strong>{{ t('playableGames.dealOrNoDeal.chooseTargetBox') }}</strong>
        <small>{{ currentBankerRequest?.detail }}</small>
        <div class="decision-actions single-action">
          <button class="leave-button" type="button" @click="rejectOffer">
            <X :size="17" />
            {{ currentBankerRequest?.rejectLabel || t('playableGames.dealOrNoDeal.leave') }}
          </button>
        </div>
      </section>

      <section v-if="phase === 'finalChoice'" class="decision-panel final-panel">
        <Trophy :size="30" />
        <span>{{ t('playableGames.dealOrNoDeal.finalBox') }}</span>
        <strong>{{ t('playableGames.dealOrNoDeal.finalChoice') }}</strong>
        <div class="decision-actions">
          <button class="take-button" type="button" @click="finishFinal(false)">
            <Check :size="17" />
            {{ t('playableGames.dealOrNoDeal.keep') }}
          </button>
          <button class="leave-button" type="button" @click="finishFinal(true)">
            <RefreshCw :size="17" />
            {{ t('playableGames.dealOrNoDeal.trade') }}
          </button>
        </div>
      </section>

      <section v-if="phase === 'result'" class="decision-panel result-panel">
        <Trophy :size="34" />
        <span>{{ finalDecision }}</span>
        <strong>{{ formatDiamonds(resultPayout) }}</strong>
        <small v-if="acceptedOffer !== null">{{ t('playableGames.dealOrNoDeal.yourBoxContained', { amount: formatRewardDiamonds(finalValue) }) }}</small>
        <small v-else-if="bankerBonus">{{ t('playableGames.dealOrNoDeal.finalGainWithBonus', { amount: formatRewardDiamonds(finalValue), bonus: formatDiamonds(bankerBonus) }) }}</small>
        <small v-else>{{ t('playableGames.dealOrNoDeal.finalGain') }}</small>
        <div class="decision-actions">
          <button class="take-button" type="button" @click="startNextPlayer">
            <Play :size="17" />
            {{ t('playableGames.common.next') }}
          </button>
          <button class="leave-button" type="button" @click="backToLobby">
            <RotateCcw :size="17" />
            {{ t('playableGames.common.waiting') }}
          </button>
        </div>
      </section>
    </section>
  </main>
</template>


<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800;900&display=swap');

* {
  box-sizing: border-box;
}

button,
input {
  font: inherit;
}

button {
  border: 0;
}

.app-shell {
  min-height: min(100vh, 960px);
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 0;
}

.live-frame {
  --deal-side-width: clamp(66px, 18%, 82px);
  --deal-side-gap: clamp(4px, 1.6%, 9px);
  --deal-side-clearance: clamp(7px, 1.9%, 11px);
  --deal-prize-top: clamp(224px, 24%, 310px);
  --deal-prize-height: clamp(22px, 2.25vh, 28px);
  --deal-prize-gap: clamp(3px, 0.36vh, 5px);
  --deal-game-top: clamp(218px, 35%, 252px);
  --deal-game-bottom: clamp(54px, 7.8%, 70px);
  position: relative;
  width: min(100vw, 56.25vh);
  height: min(100vh, 177.78vw);
  max-height: 100vh;
  aspect-ratio: 9 / 16;
  overflow: hidden;
  isolation: isolate;
  background: #090912;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08), 0 26px 90px rgba(0, 0, 0, 0.72);
}

.stage-image,
.stage-vignette,
.scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.stage-image {
  z-index: -4;
  background: url("../../assets/games/deal-or-no-deal/live-stage.png") center / cover no-repeat;
  transform: scale(1.04);
  animation: slowZoom 12s ease-in-out infinite alternate;
}

.stage-vignette {
  z-index: -3;
  background:
    linear-gradient(180deg, rgba(5, 5, 12, 0.18), rgba(5, 5, 12, 0.06) 42%, rgba(5, 5, 12, 0.72)),
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.08), transparent 34%),
    radial-gradient(circle at 50% 80%, rgba(12, 248, 196, 0.18), transparent 35%);
}

.scanlines {
  z-index: 12;
  opacity: 0.12;
  mix-blend-mode: screen;
  background: repeating-linear-gradient(180deg, transparent 0, transparent 7px, rgba(255, 255, 255, 0.22) 8px);
}

.audio-control {
  position: absolute;
  z-index: 20;
  top: 10px;
  left: 10px;
  display: grid;
  gap: 6px;
  justify-items: start;
  opacity: 0.42;
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.audio-control:hover,
.audio-control.open,
.audio-control:focus-within {
  opacity: 1;
}

.audio-toggle {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(5, 8, 20, 0.68);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.34), 0 0 18px rgba(49, 241, 255, 0.16);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.audio-panel {
  width: 150px;
  display: grid;
  gap: 8px;
  padding: 9px 10px 10px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  background: rgba(5, 8, 20, 0.82);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.audio-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.65rem;
  font-weight: 900;
  text-transform: uppercase;
}

.audio-panel-header strong {
  color: #ffd166;
  font-size: 0.72rem;
}

.audio-panel input[type="range"] {
  width: 100%;
  accent-color: #35f4ff;
  cursor: pointer;
}

.top-hud {
  display: none;
}

.brand {
  display: grid;
  gap: 5px;
}

.brand h1 {
  margin: 0;
  color: #fff;
  font-size: 1.34rem;
  line-height: 0.93;
  letter-spacing: 0;
  text-transform: uppercase;
  text-shadow: 0 3px 16px rgba(0, 0, 0, 0.55), 0 0 22px rgba(255, 209, 102, 0.55);
}

.prize-tile,
.decision-panel,
.lobby-panel {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.entry-banner {
  position: absolute;
  z-index: 5;
  top: 20px;
  left: 50%;
  width: min(500px, calc(100% - 12px));
  aspect-ratio: 1870 / 837;
  overflow: visible;
  color: #fff;
  pointer-events: none;
  transform: translateX(-50%);
}

.entry-banner-art {
  position: absolute;
  inset: 0;
}

.entry-banner-art {
  z-index: 1;
  background: url("../../assets/games/deal-or-no-deal/entry-banner.png") center / contain no-repeat;
  filter: saturate(1.05) contrast(1.04);
}

.entry-banner.is-premium-entry-banner .entry-banner-art {
  background-image: url("../../assets/games/deal-or-no-deal/entry-banner-premium.png");
  background-size: cover;
  filter: saturate(1.08) contrast(1.06);
}

.entry-banner-amount {
  position: absolute;
  z-index: 3;
  left: 22.35%;
  top: 16.8%;
  width: 31%;
  height: 43%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
  color: #ffd166;
  font-family: Georgia, "Times New Roman", serif;
  font-size: calc(4.55rem * var(--entry-amount-scale, 1));
  font-weight: 950;
  letter-spacing: 0;
  line-height: 0.92;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow:
    0 2px 0 #4a2200,
    0 0 12px rgba(255, 209, 102, 0.56),
    0 0 26px rgba(255, 139, 31, 0.42);
}

.premium-entry-text,
.premium-entry-gain {
  position: absolute;
  z-index: 3;
  min-width: 0;
  overflow: hidden;
  color: #ffd166;
  font-family: Georgia, "Times New Roman", serif;
  font-weight: 950;
  letter-spacing: 0;
  line-height: 0.92;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow:
    0 2px 0 #4a2200,
    0 0 12px rgba(255, 209, 102, 0.64),
    0 0 28px rgba(255, 139, 31, 0.46);
}

.premium-entry-text {
  top: 20.6%;
  width: 25%;
  height: 30%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-inline: 0.16em;
  font-size: calc(3.14rem * var(--premium-entry-amount-scale, 1));
}

.premium-entry-base-price {
  left: 6.8%;
}

.premium-entry-premium-price {
  left: 48.2%;
}

.premium-entry-gain {
  left: 48.2%;
  top: 48.2%;
  width: 25%;
  color: #fff4bf;
  font-family: Inter, system-ui, sans-serif;
  font-size: 1.18rem;
  font-weight: 950;
  line-height: 1;
  text-transform: uppercase;
  text-shadow:
    0 2px 0 rgba(74, 34, 0, 0.84),
    0 0 12px rgba(255, 209, 102, 0.58),
    0 0 20px rgba(52, 211, 153, 0.35);
}

.prize-rail {
  position: absolute;
  z-index: 6;
  top: var(--deal-prize-top);
  display: grid;
  grid-auto-rows: var(--deal-prize-height);
  align-content: start;
  gap: var(--deal-prize-gap);
  width: var(--deal-side-width);
  overflow: hidden;
  pointer-events: none;
}

.prize-left {
  left: var(--deal-side-gap);
}

.prize-right {
  right: var(--deal-side-gap);
}

.prize-tile {
  display: grid;
  place-items: center;
  min-width: 0;
  height: var(--deal-prize-height);
  min-height: 0;
  padding: 1px 2px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 6px;
  background: linear-gradient(135deg, rgba(7, 18, 30, 0.74), rgba(14, 12, 24, 0.54));
  color: #050505;
  font-size: clamp(0.56rem, min(1.45vh, 2.65vw), 0.74rem);
  font-weight: 900;
  line-height: 0.95;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  box-shadow: inset 0 0 18px rgba(64, 242, 255, 0.08);
  transition: opacity 0.25s ease, transform 0.25s ease, background 0.25s ease;
}

.prize-tile.left-prize {
  color: #050505;
  border-color: rgba(77, 236, 255, 0.58);
  background:
    linear-gradient(180deg, rgba(126, 244, 255, 0.94), rgba(24, 137, 255, 0.9) 48%, rgba(12, 38, 129, 0.88)),
    #168dff;
  box-shadow:
    inset 0 0 14px rgba(255, 255, 255, 0.2),
    inset 0 -8px 18px rgba(0, 39, 130, 0.34),
    0 0 16px rgba(42, 218, 255, 0.38);
  text-shadow: 0 1px 4px rgba(255, 255, 255, 0.42);
}

.prize-tile.left-prize.gone {
  opacity: 0.27;
  color: #050505;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 18px rgba(255, 255, 255, 0.04);
}

.prize-tile.right-prize {
  color: #050505;
  border-color: rgba(255, 70, 110, 0.56);
  background:
    linear-gradient(180deg, rgba(255, 99, 132, 0.92), rgba(191, 13, 60, 0.9) 48%, rgba(78, 4, 30, 0.86)),
    #d80d48;
  box-shadow:
    inset 0 0 14px rgba(255, 255, 255, 0.18),
    inset 0 -8px 18px rgba(120, 0, 36, 0.34),
    0 0 16px rgba(255, 33, 88, 0.34);
  text-shadow: 0 1px 4px rgba(255, 255, 255, 0.42);
}

.prize-tile.right-prize.right-gold {
  color: #050505;
  border-color: rgba(255, 232, 142, 0.76);
  background:
    linear-gradient(180deg, rgba(255, 251, 199, 0.98), rgba(255, 202, 62, 0.96) 46%, rgba(179, 96, 5, 0.94)),
    #ffd166;
  box-shadow:
    inset 0 0 14px rgba(255, 255, 255, 0.34),
    inset 0 -8px 18px rgba(130, 61, 0, 0.28),
    0 0 18px rgba(255, 209, 102, 0.48);
  text-shadow: 0 1px 4px rgba(255, 255, 255, 0.36);
}

.prize-tile.right-prize.gone {
  opacity: 0.27;
  color: #050505;
  background: rgba(255, 255, 255, 0.06);
  box-shadow: inset 0 0 18px rgba(255, 255, 255, 0.04);
}

.prize-tile.gone {
  opacity: 0.27;
  color: #050505;
  text-decoration: line-through;
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.06);
}

.game-zone {
  position: absolute;
  z-index: 4;
  top: var(--deal-game-top);
  left: calc(var(--deal-side-gap) + var(--deal-side-width) + var(--deal-side-clearance));
  right: calc(var(--deal-side-gap) + var(--deal-side-width) + var(--deal-side-clearance));
  bottom: var(--deal-game-bottom);
  display: grid;
  align-items: start;
}

.case-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  transition: opacity 0.25s ease, transform 0.25s ease;
}

.case-grid.muted {
  opacity: 0.26;
  transform: scale(0.94);
  pointer-events: none;
}

.case-box {
  position: relative;
  min-width: 0;
  aspect-ratio: 1.16 / 1;
  overflow: hidden;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 2px;
  padding: 12px 2px 5px;
  border: 1px solid rgba(255, 236, 159, 0.72);
  border-radius: 7px;
  background:
    radial-gradient(circle at 21% 16%, rgba(255, 255, 255, 0.85), transparent 11%),
    radial-gradient(circle at 75% 87%, rgba(93, 32, 0, 0.38), transparent 22%),
    linear-gradient(116deg, transparent 0 14%, rgba(255, 255, 255, 0.24) 15% 23%, transparent 24% 100%),
    linear-gradient(180deg, #fff3ba 0%, #ffd04f 17%, #f0a421 43%, #b85a0b 71%, #66320b 100%);
  color: #2b1500;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    inset 0 -9px 15px rgba(72, 22, 0, 0.36),
    inset 0 0 0 2px rgba(255, 255, 255, 0.08),
    0 8px 14px rgba(0, 0, 0, 0.42),
    0 0 16px rgba(255, 194, 71, 0.2);
  transform-style: preserve-3d;
  transition: transform 0.18s ease, filter 0.18s ease, opacity 0.18s ease, box-shadow 0.18s ease;
}

.case-box::before {
  content: "";
  position: absolute;
  inset: 18% 8% auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(64, 21, 0, 0.46), transparent);
  box-shadow: 0 15px 0 rgba(64, 21, 0, 0.2);
  z-index: 1;
}

.case-box::after {
  content: "";
  position: absolute;
  inset: 5px;
  border: 1px solid rgba(255, 246, 197, 0.28);
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px rgba(87, 33, 0, 0.22);
  pointer-events: none;
  z-index: 1;
}

.case-box:not(:disabled):hover {
  transform: translateY(-4px) scale(1.04) rotateX(4deg);
  filter: saturate(1.18) brightness(1.05);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    inset 0 -9px 15px rgba(72, 22, 0, 0.32),
    inset 0 0 0 2px rgba(255, 255, 255, 0.12),
    0 12px 20px rgba(0, 0, 0, 0.44),
    0 0 22px rgba(255, 217, 102, 0.34);
}

.case-box.selected {
  border-color: #35f4ff;
  color: #fff;
  background:
    radial-gradient(circle at 22% 17%, rgba(255, 255, 255, 0.9), transparent 12%),
    linear-gradient(116deg, transparent 0 14%, rgba(255, 255, 255, 0.23) 15% 23%, transparent 24% 100%),
    linear-gradient(180deg, rgba(128, 252, 255, 0.98), rgba(37, 141, 255, 0.96) 44%, rgba(20, 38, 135, 0.98)),
    #2b8cff;
  box-shadow:
    0 0 26px rgba(49, 241, 255, 0.76),
    0 0 42px rgba(49, 241, 255, 0.26),
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    inset 0 -9px 15px rgba(4, 24, 99, 0.4);
}

.case-box.opened {
  color: #fff;
  background:
    radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.16), transparent 26%),
    linear-gradient(180deg, rgba(32, 30, 52, 0.98), rgba(7, 8, 20, 0.98));
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow:
    inset 0 0 26px rgba(255, 255, 255, 0.06),
    inset 0 -10px 16px rgba(0, 0, 0, 0.36),
    0 5px 12px rgba(0, 0, 0, 0.32);
}

.case-box.revealing {
  animation: revealShake 0.5s ease both;
}

.case-box.locked:not(.opened):not(.selected) {
  opacity: 0.72;
  cursor: default;
}

.case-box.target-candidate {
  border-color: #35f4ff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.78),
    inset 0 -9px 15px rgba(72, 22, 0, 0.32),
    0 0 0 2px rgba(53, 244, 255, 0.22),
    0 0 20px rgba(53, 244, 255, 0.36);
}

.case-handle {
  position: absolute;
  top: 4px;
  left: 32%;
  right: 32%;
  height: 11px;
  border: 2px solid rgba(85, 39, 0, 0.56);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.48),
    0 1px 2px rgba(45, 12, 0, 0.28);
  z-index: 3;
}

.case-latches {
  position: absolute;
  left: 15%;
  right: 15%;
  top: 27%;
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(90deg, #4b1e00, #fff2ac 14%, #7a3300 28%, transparent 29% 71%, #4b1e00 72%, #fff2ac 86%, #7a3300);
  box-shadow: 0 1px 2px rgba(49, 13, 0, 0.32);
  z-index: 3;
}

.case-shine {
  position: absolute;
  inset: -38% auto -38% -70%;
  width: 48%;
  transform: rotate(20deg);
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.58), transparent);
  animation: suitcaseShine 2.55s ease-in-out infinite;
  z-index: 5;
}

.case-number {
  position: relative;
  z-index: 4;
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 20px;
  padding: 0 6px;
  border: 1px solid rgba(255, 238, 174, 0.62);
  border-radius: 6px;
  background:
    linear-gradient(180deg, rgba(45, 21, 1, 0.94), rgba(96, 45, 3, 0.86)),
    #3c1b02;
  color: #fff0b6;
  font-size: 0.83rem;
  font-weight: 900;
  line-height: 1;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 2px 6px rgba(50, 15, 0, 0.34);
}

.case-value {
  position: relative;
  z-index: 4;
  min-height: 13px;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 4px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.18);
  color: inherit;
  font-size: 0.47rem;
  font-weight: 900;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.case-box.selected .case-handle,
.case-box.selected .case-latches {
  border-color: rgba(195, 255, 255, 0.62);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(24, 190, 255, 0.12));
}

.case-box.selected .case-number {
  border-color: rgba(188, 255, 255, 0.84);
  background: linear-gradient(180deg, rgba(5, 29, 76, 0.96), rgba(9, 71, 155, 0.9));
  color: #ffffff;
  box-shadow: 0 0 14px rgba(49, 241, 255, 0.34);
}

.case-box.opened .case-handle,
.case-box.opened .case-latches {
  opacity: 0.28;
}

.case-box.opened .case-number {
  display: none;
}

.case-box.opened .case-value {
  min-height: 38px;
  display: grid;
  place-items: center;
  width: calc(100% - 10px);
  padding: 5px 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(255, 209, 102, 0.24), rgba(49, 241, 255, 0.16)),
    rgba(2, 6, 23, 0.46);
  color: #fff;
  font-size: 0.86rem;
  line-height: 1.08;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.72);
}

.lobby-panel,
.decision-panel {
  position: absolute;
  z-index: 9;
  left: 50%;
  top: 41%;
  width: min(236px, 100%);
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  background: linear-gradient(145deg, rgba(6, 9, 22, 0.86), rgba(32, 16, 33, 0.78));
  box-shadow: 0 22px 56px rgba(0, 0, 0, 0.56), 0 0 28px rgba(49, 241, 255, 0.18);
  text-align: center;
  transform: translate(-50%, -50%);
}

.lobby-panel svg,
.decision-panel svg {
  color: #ffd166;
}

.lobby-panel strong,
.decision-panel strong {
  display: block;
  color: #fff;
  font-size: 1.3rem;
  font-weight: 900;
  line-height: 1.05;
  text-shadow: 0 0 18px rgba(255, 209, 102, 0.36);
}

.decision-panel span {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
}

.result-panel strong {
  color: #ffd166;
  font-size: 1.55rem;
}

.result-panel small {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.72rem;
  font-weight: 800;
}

.decision-panel small {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.35;
}

.banker-call-panel {
  top: 38%;
  width: min(260px, calc(100% - 150px));
}

.banker-call-panel strong {
  font-size: 1.12rem;
}

.target-choice-panel small {
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1.35;
}

.target-choice-panel {
  top: 64px;
  width: min(300px, calc(100% - 168px));
  gap: 6px;
  padding: 10px 12px;
  transform: translateX(-50%);
}

.target-choice-panel svg {
  width: 22px;
  height: 22px;
}

.target-choice-panel strong {
  font-size: 1.05rem;
}

.target-choice-panel .decision-actions button {
  min-height: 30px;
}

.phone-ring {
  position: relative;
  width: 52px;
  height: 52px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 209, 102, 0.13);
}

.phone-ring::before,
.phone-ring::after {
  content: "";
  position: absolute;
  inset: 0;
  border: 1px solid rgba(255, 209, 102, 0.58);
  border-radius: inherit;
  animation: phoneWave 1.35s ease-out infinite;
}

.phone-ring::after {
  animation-delay: 0.45s;
}

.decision-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.decision-actions.single-action {
  grid-template-columns: minmax(0, 1fr);
}

.entry-choice-group {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}

.entry-choice-group button {
  min-width: 0;
  min-height: 48px;
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.76);
  color: #e5e7eb;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
}

.entry-choice-group button.active {
  border-color: rgba(255, 209, 102, 0.78);
  background: linear-gradient(135deg, rgba(255, 209, 102, 0.32), rgba(255, 139, 31, 0.24));
  color: #fff;
  box-shadow: 0 0 18px rgba(255, 209, 102, 0.26);
}

.entry-choice-group span,
.entry-choice-group small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-choice-group small {
  color: #7cf2c1;
  font-size: 0.7rem;
  font-weight: 950;
}

.primary-action,
.decision-actions button {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 900;
  transition: transform 0.16s ease, opacity 0.16s ease, filter 0.16s ease;
}

.primary-action,
.take-button {
  background: linear-gradient(135deg, #10d879, #35f4ff);
  color: #041012;
}

.leave-button {
  background: linear-gradient(135deg, #ff3d71, #ffb347);
  color: #17050b;
}

.primary-action:hover,
.decision-actions button:hover {
  transform: translateY(-2px);
  filter: brightness(1.06);
}

.float-layer,
.burst-layer {
  position: absolute;
  inset: 0;
  z-index: 11;
  pointer-events: none;
}

.gift-floater {
  position: absolute;
  bottom: 178px;
  display: inline-grid;
  place-items: center;
  min-width: 54px;
  min-height: 26px;
  padding: 5px 9px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  background: rgba(4, 7, 18, 0.76);
  color: #fff;
  font-size: 0.67rem;
  font-weight: 900;
  text-shadow: 0 1px 8px rgba(0, 0, 0, 0.56);
  box-shadow: 0 0 18px rgba(64, 242, 255, 0.22);
  animation: giftFloat 2.6s ease-out forwards;
}

.float-gold,
.float-offer {
  background: rgba(78, 46, 6, 0.82);
  box-shadow: 0 0 24px rgba(255, 209, 102, 0.42);
}

.float-danger,
.float-warn {
  background: rgba(78, 8, 25, 0.82);
  box-shadow: 0 0 24px rgba(255, 77, 109, 0.36);
}

.particle {
  position: absolute;
  width: 7px;
  height: 11px;
  border-radius: 2px;
  box-shadow: 0 0 12px currentColor;
  animation: particlePop 1.15s cubic-bezier(0.12, 0.74, 0.24, 1) forwards;
}

@media (max-height: 760px) {
  .top-hud {
    top: 8px;
  }

  .brand h1 {
    font-size: 1.1rem;
  }

  .entry-banner {
    top: 14px;
    width: min(440px, calc(100% - 12px));
  }

  .entry-banner-amount {
    font-size: calc(4rem * var(--entry-amount-scale, 1));
  }

  .premium-entry-text {
    font-size: calc(2.82rem * var(--premium-entry-amount-scale, 1));
  }

  .premium-entry-gain {
    font-size: 1.04rem;
  }

  .live-frame {
    --deal-side-width: clamp(62px, 17.4%, 74px);
    --deal-side-gap: clamp(4px, 1.35%, 7px);
    --deal-side-clearance: clamp(6px, 1.5%, 9px);
    --deal-prize-top: clamp(190px, 25%, 240px);
    --deal-prize-height: clamp(20px, 2.2vh, 25px);
    --deal-prize-gap: clamp(2px, 0.32vh, 4px);
    --deal-game-top: clamp(194px, 34%, 218px);
    --deal-game-bottom: clamp(50px, 7.4%, 58px);
  }

  .prize-tile {
    font-size: clamp(0.52rem, min(1.22vh, 2.5vw), 0.65rem);
  }

  .case-grid {
    gap: 5px;
  }

  .case-number {
    font-size: 0.78rem;
  }

  .target-choice-panel {
    top: 46px;
    width: min(280px, calc(100% - 158px));
    padding: 9px 11px;
  }

  .target-choice-panel strong {
    font-size: 0.98rem;
  }

}

@media (max-width: 390px) {
  .live-frame {
    --deal-side-width: clamp(58px, 18.5%, 70px);
    --deal-side-gap: 5px;
    --deal-side-clearance: 6px;
    --deal-prize-top: clamp(190px, 25%, 236px);
    --deal-prize-height: clamp(20px, 2.25vh, 25px);
    --deal-prize-gap: 3px;
  }

  .entry-banner {
    width: calc(100% - 20px);
  }

  .entry-banner-amount {
    font-size: calc(3.45rem * var(--entry-amount-scale, 1));
  }

  .premium-entry-text {
    font-size: calc(2.46rem * var(--premium-entry-amount-scale, 1));
  }

  .premium-entry-gain {
    font-size: 0.98rem;
  }

}

@keyframes slowZoom {
  from {
    transform: scale(1.04) translateY(0);
  }
  to {
    transform: scale(1.09) translateY(-1.2%);
  }
}

@keyframes suitcaseShine {
  0%,
  42% {
    transform: translateX(0) rotate(20deg);
    opacity: 0;
  }
  54% {
    opacity: 1;
  }
  100% {
    transform: translateX(330%) rotate(20deg);
    opacity: 0;
  }
}

@keyframes revealShake {
  0%,
  100% {
    transform: translateX(0) rotateY(0deg);
  }
  25% {
    transform: translateX(-3px) rotateY(-12deg);
  }
  55% {
    transform: translateX(3px) rotateY(14deg);
  }
  78% {
    transform: translateX(-2px) rotateY(-8deg);
  }
}

@keyframes phoneWave {
  from {
    opacity: 0.72;
    transform: scale(0.78);
  }
  to {
    opacity: 0;
    transform: scale(1.55);
  }
}

@keyframes giftFloat {
  0% {
    opacity: 0;
    transform: translate3d(-50%, 18px, 0) scale(0.85);
  }
  12% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate3d(calc(-50% + var(--drift)), -185px, 0) scale(1.12);
  }
}

@keyframes particlePop {
  0% {
    opacity: 1;
    transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
  }
  100% {
    opacity: 0;
    transform: translate3d(var(--tx), var(--ty), 0) rotate(420deg) scale(0.6);
  }
}

</style>
