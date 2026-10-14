<script setup>
import { getGameNumberFormatter } from '../../utils/numberFormat'
import { createDealRound } from './deal-or-no-deal/round.mjs'
import { createDealBanker } from './deal-or-no-deal/banker.mjs'
import { createDealRigging } from './deal-or-no-deal/rigging.mjs'
import { createDealMusicScene } from './deal-or-no-deal/music-scene.mjs'
import { createDealPriceFitter } from './deal-or-no-deal/price-fitter.mjs'
import { shuffle, pickRandom, swapBoxValues } from './deal-or-no-deal/box-utils.mjs'
import { loadGameAudioVolume, clampGameAudioVolume } from './deal-or-no-deal/audio-volume.mjs'
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



const bankController = createDealBanker({ bankerRequests, t, formatRewardDiamonds, formatDiamonds, otherUnopenedBoxes, openedNonPlayerBoxCount, usedForcedBankerRequestKeys, boxValues, boxes, roundIndex, roundPattern, jackpotValueThreshold, weakBoardThreshold })
const { createBankerRequest, createBankerRequestFromConfig, createCashBankerRequest, createSwapBankerRequest, createBuyBoxBankerRequest, canUseBankerRequest, pickWeightedBankerRequest, findForcedBankerRequest, forcedBankerRequestKey, normalizeForcedOpenCount, normalizeBankerRequestWeight, pickTargetBox, calculateOffer } = bankController

const riggingController = createDealRigging({ riggingSettings, boxes, openedNonPlayerBoxCount, badRevealStreak })
const { applySelectedBoxWeight, applyOpenedBoxWeight, pickOpenedBoxWeightTarget, pickRankWeightedBox, applyFinalChoiceWeight, isSelectedBoxBigValue, getFinalChoiceLowValueBox, isFinalChoicePair } = riggingController

const musicController = createDealMusicScene({ gameAudioVolume, musicDirector, soundscape, isVolumePanelOpen, phase, isExtremeFinalDuel, resultPayout, jackpotValueThreshold, lowValueThreshold, badRevealStreak, hiddenBoxCount, majorHiddenCount, lowHiddenCount, currentBankerRequest, majorMusicValueThreshold, maxConfiguredBoxValue, currentOffer, musicScene, musicOverrideScene })
const { applyGameAudioVolume, setGameAudioVolumeFromInput, toggleVolumePanel, automaticMusicScene, isLateGameMusicMoment, isComplexBoardMusicMoment, isHeroicBankerMoment, isMajorMusicValue, activateMusic, handleAudioUnlockGesture, cueMusicOverride, releaseMusicOverrideForEvent, registerMusicReveal } = musicController

const pricesController = createDealPriceFitter({ entryAmountRef, entryAmountScale, premiumBasePriceRef, premiumBasePriceScale, premiumEntryPriceRef, premiumEntryPriceScale })
const { scheduleEntryAmountFit, entryAmountFitTargets, fitEntryAmounts, refineEntryAmountFit } = pricesController

const roundController = createDealRound({
  activateMusic, soundscape, ensureSelectedEntryOption, selectedEntryOption, entryOptions, playerCount, currentPlayer, t, entryCost, normalizeRewardMultiplier, boxes, createBoxes, roundIndex, openedThisRound, roundTarget, roundPattern, currentOffer, currentBankerRequest, acceptedOffer, finalValue, finalDecision, bankerBonus, usedForcedBankerRequestKeys, badRevealStreak, musicOverrideScene, musicController, isResolving, phase, addFeed, burst, applySelectedBoxWeight, otherUnopenedBoxes, pulseGift, releaseMusicOverrideForEvent, applyOpenedBoxWeight, isBigBoxValue, registerMusicReveal, formatRewardDiamonds, findForcedBankerRequest, createBankerRequest, createCashBankerRequest, rewardValue, ownBox, formatDiamonds, applyFinalChoiceWeight, resultPayout, cueMusicOverride, nextId: () => idSeed++,
})
const { startNextPlayer, handleCaseClick, selectOwnBox, canTouchBox, openBox, showBankerOffer, answerBankerCall, acceptOffer, beginBankerTargetChoice, resolveBankerTargetChoice, rejectOffer, acceptSwapRequest, acceptBuyBoxRequest, continueAfterBankerDecision, finishFinal, revealFinalBoxes, backToLobby } = roundController

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
  roundController.dispose()
  entryAmountResizeObserver?.disconnect()
  window.removeEventListener('pointerdown', handleAudioUnlockGesture)
  window.removeEventListener('keydown', handleAudioUnlockGesture)
  window.removeEventListener('resize', scheduleEntryAmountFit)
  window.removeEventListener('storage', handleDealSettingsStorage)
  window.removeEventListener(DEAL_OR_NO_DEAL_SETTINGS_EVENT, handleDealSettingsEvent)
  pricesController.dispose()
  musicController.dispose()
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
  const formatted = getGameNumberFormatter(currentIntlLocale(), {
    notation: compact && Math.abs(numericValue) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: compact && Math.abs(numericValue) >= 10000 ? 1 : 0,
  }).format(numericValue)
  return `${formatted} \u{1F48E}`
}

function formatEntryAmount(value) {
  return getGameNumberFormatter(currentIntlLocale(), {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

function formatMultiplier(value) {
  const normalizedValue = normalizeRewardMultiplier(value)
  return getGameNumberFormatter(currentIntlLocale(), {
    maximumFractionDigits: Number.isInteger(normalizedValue) ? 0 : 2,
  }).format(normalizedValue)
}

function currentIntlLocale() {
  return locale.value === 'fr' ? 'fr-FR' : 'en-US'
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


<style scoped src="./styles/deal-or-no-deal/index.generated.css"></style>
