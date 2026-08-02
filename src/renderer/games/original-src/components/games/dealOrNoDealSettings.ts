import {
  DEFAULT_BANKER_REQUESTS,
  DEFAULT_BOX_VALUES,
  DEFAULT_ENTRY_COST,
  FINAL_CHOICE_HIGH_VALUE_THRESHOLD,
  FINAL_CHOICE_LOW_VALUE,
  FINAL_CHOICE_LOW_VALUE_CHANCE,
  ROUND_PATTERN,
  SELECTED_BOX_BIG_VALUE_CHANCE,
  SELECTED_BOX_BIG_VALUE_THRESHOLD,
} from './dealOrNoDealConfig'
import {
  defaultDealOrNoDealMusicSettings,
  normalizeDealOrNoDealMusicSettings,
  type DealOrNoDealMusicSettings,
} from './dealOrNoDealMusic'
import { readJsonBrowserStorage, writeJsonBrowserStorage } from '../../utils/browserStorage'

export const DEAL_OR_NO_DEAL_BOX_COUNT = DEFAULT_BOX_VALUES.length
export const DEAL_OR_NO_DEAL_MAX_BANKER_REQUESTS = 12
export const DEAL_OR_NO_DEAL_MAX_FORCED_OPENED_BOXES = Math.max(1, DEAL_OR_NO_DEAL_BOX_COUNT - 3)

export type DealOrNoDealBankerRequestType = 'cashOffer' | 'swapBox' | 'buyBox'
export type DealOrNoDealTargetMode = 'random' | 'highest' | 'lowest' | 'playerChoice'

export type DealOrNoDealBankerRequest = {
  id: string
  type: DealOrNoDealBankerRequestType
  enabled: boolean
  weight: number
  amount: number
  targetMode: DealOrNoDealTargetMode
  forceAfterOpenedCount: number
}

export type DealOrNoDealRiggingSettings = {
  enabled: boolean
  selectedBoxBigValueThreshold: number
  selectedBoxBigValueChance: number
  finalChoiceLowValue: number
  finalChoiceHighValueThreshold: number
  finalChoiceLowValueChance: number
}

export type DealOrNoDealSpendSettings = {
  enabled: boolean
  premiumEntryCost: number
  rewardMultiplier: number
}

export type DealOrNoDealSettings = {
  boxValues: number[]
  entryCost: number
  roundPattern: number[]
  bankerRequests: DealOrNoDealBankerRequest[]
  music: DealOrNoDealMusicSettings
  rigging: DealOrNoDealRiggingSettings
  spend: DealOrNoDealSpendSettings
}

export const DEAL_OR_NO_DEAL_SETTINGS_STORAGE_KEY = 'shenpulse-deal-or-no-deal-settings'
export const DEAL_OR_NO_DEAL_SETTINGS_EVENT = 'shenpulse:deal-or-no-deal-settings'
export const DEAL_OR_NO_DEAL_DEFAULT_PREMIUM_ENTRY_COST = 1000
export const DEAL_OR_NO_DEAL_DEFAULT_REWARD_MULTIPLIER = 3

export function defaultDealOrNoDealSettings(): DealOrNoDealSettings {
  return {
    boxValues: [...DEFAULT_BOX_VALUES],
    entryCost: DEFAULT_ENTRY_COST,
    roundPattern: [...ROUND_PATTERN],
    bankerRequests: defaultDealOrNoDealBankerRequests(),
    music: defaultDealOrNoDealMusicSettings(),
    rigging: defaultDealOrNoDealRiggingSettings(),
    spend: defaultDealOrNoDealSpendSettings(),
  }
}

export function loadDealOrNoDealSettings(): DealOrNoDealSettings {
  if (typeof window === 'undefined') return defaultDealOrNoDealSettings()
  return normalizeDealOrNoDealSettings(
    readJsonBrowserStorage('local', DEAL_OR_NO_DEAL_SETTINGS_STORAGE_KEY, null),
  )
}

export function saveDealOrNoDealSettings(settings: Partial<DealOrNoDealSettings>) {
  const normalized = normalizeDealOrNoDealSettings(settings)
  if (typeof window !== 'undefined') {
    writeJsonBrowserStorage('local', DEAL_OR_NO_DEAL_SETTINGS_STORAGE_KEY, normalized)
    window.dispatchEvent(new CustomEvent(DEAL_OR_NO_DEAL_SETTINGS_EVENT, { detail: normalized }))
  }
  return normalized
}

export function normalizeDealOrNoDealSettings(value: unknown): DealOrNoDealSettings {
  const payload = value && typeof value === 'object' ? value as Partial<DealOrNoDealSettings> : {}
  const parsedValues = normalizeBoxValues(payload.boxValues)
  const entryCost = normalizeEntryCost(payload.entryCost)
  const roundPattern = normalizeRoundPattern(payload.roundPattern)
  const bankerRequests = normalizeBankerRequests(payload.bankerRequests)
  const music = normalizeDealOrNoDealMusicSettings(payload.music)
  const rigging = normalizeRiggingSettings(payload.rigging)
  const spend = normalizeSpendSettings(payload.spend)

  return {
    boxValues: parsedValues.length === DEAL_OR_NO_DEAL_BOX_COUNT ? parsedValues : [...DEFAULT_BOX_VALUES],
    entryCost,
    roundPattern,
    bankerRequests,
    music,
    rigging,
    spend,
  }
}

export function parseBoxValuesText(value: string) {
  return normalizeBoxValues(String(value || '').split(/[\s,;|]+/))
}

export function formatBoxValuesText(values: number[]) {
  return normalizeBoxValues(values).join(', ')
}

function normalizeBoxValues(values: unknown) {
  const source = Array.isArray(values) ? values : []
  const unique = new Set<number>()

  for (const item of source) {
    const numericValue = Number(String(item).replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(numericValue)) continue

    const roundedValue = Math.round(numericValue)
    if (roundedValue === 0) continue

    unique.add(Math.max(-999999, Math.min(999999, roundedValue)))
  }

  return [...unique].sort((left, right) => left - right)
}

export function defaultDealOrNoDealBankerRequests(): DealOrNoDealBankerRequest[] {
  return DEFAULT_BANKER_REQUESTS.map((request) => createDealOrNoDealBankerRequest(request))
}

export function createDealOrNoDealBankerRequest(value: unknown = {}): DealOrNoDealBankerRequest {
  const normalized = normalizeBankerRequest(value, cryptoSafeId())
  return normalized || normalizeBankerRequest(DEFAULT_BANKER_REQUESTS[0], cryptoSafeId())!
}

export function defaultDealOrNoDealRiggingSettings(): DealOrNoDealRiggingSettings {
  return {
    enabled: true,
    selectedBoxBigValueThreshold: SELECTED_BOX_BIG_VALUE_THRESHOLD,
    selectedBoxBigValueChance: SELECTED_BOX_BIG_VALUE_CHANCE,
    finalChoiceLowValue: FINAL_CHOICE_LOW_VALUE,
    finalChoiceHighValueThreshold: FINAL_CHOICE_HIGH_VALUE_THRESHOLD,
    finalChoiceLowValueChance: FINAL_CHOICE_LOW_VALUE_CHANCE,
  }
}

export function defaultDealOrNoDealSpendSettings(): DealOrNoDealSpendSettings {
  return {
    enabled: false,
    premiumEntryCost: DEAL_OR_NO_DEAL_DEFAULT_PREMIUM_ENTRY_COST,
    rewardMultiplier: DEAL_OR_NO_DEAL_DEFAULT_REWARD_MULTIPLIER,
  }
}

function normalizeRoundPattern(value: unknown) {
  const source = Array.isArray(value) ? value : ROUND_PATTERN
  const pattern = source
    .map((item) => Math.round(Number(item)))
    .filter((item) => Number.isFinite(item) && item > 0)
    .slice(0, 12)

  return pattern.length ? pattern : [...ROUND_PATTERN]
}

function normalizeBankerRequests(value: unknown) {
  const source = Array.isArray(value) ? value : DEFAULT_BANKER_REQUESTS
  const requests = source
    .map((request, index) => normalizeBankerRequest(request, `banker-request-${index + 1}`))
    .filter(Boolean)
    .slice(0, DEAL_OR_NO_DEAL_MAX_BANKER_REQUESTS) as DealOrNoDealBankerRequest[]

  return requests.length ? requests : defaultDealOrNoDealBankerRequests()
}

function normalizeBankerRequest(value: unknown, fallbackId: string) {
  const payload = value && typeof value === 'object' ? value as Partial<DealOrNoDealBankerRequest> : {}
  const type = normalizeBankerRequestType(payload.type)
  const targetMode = type === 'swapBox' ? 'playerChoice' : normalizeTargetMode(payload.targetMode)
  const weight = normalizeInteger(payload.weight, 1, 999)
  const amount = normalizeInteger(payload.amount, 0, 999999)
  const forceAfterOpenedCount = normalizeInteger(payload.forceAfterOpenedCount, 0, DEAL_OR_NO_DEAL_MAX_FORCED_OPENED_BOXES)
  const id = String(payload.id || fallbackId || cryptoSafeId()).trim().slice(0, 80) || cryptoSafeId()

  return {
    id,
    type,
    enabled: payload.enabled !== false,
    weight,
    amount,
    targetMode,
    forceAfterOpenedCount,
  }
}

function normalizeRiggingSettings(value: unknown): DealOrNoDealRiggingSettings {
  const defaults = defaultDealOrNoDealRiggingSettings()
  const payload = value && typeof value === 'object' ? value as Partial<DealOrNoDealRiggingSettings> : {}

  return {
    enabled: payload.enabled !== false,
    selectedBoxBigValueThreshold: normalizeInteger(payload.selectedBoxBigValueThreshold, defaults.selectedBoxBigValueThreshold, 999999, -999999),
    selectedBoxBigValueChance: normalizeChance(payload.selectedBoxBigValueChance, defaults.selectedBoxBigValueChance),
    finalChoiceLowValue: normalizeInteger(payload.finalChoiceLowValue, defaults.finalChoiceLowValue, 999999, -999999),
    finalChoiceHighValueThreshold: normalizeInteger(payload.finalChoiceHighValueThreshold, defaults.finalChoiceHighValueThreshold, 999999, -999999),
    finalChoiceLowValueChance: normalizeChance(payload.finalChoiceLowValueChance, defaults.finalChoiceLowValueChance),
  }
}

function normalizeSpendSettings(value: unknown): DealOrNoDealSpendSettings {
  const defaults = defaultDealOrNoDealSpendSettings()
  const payload = value && typeof value === 'object' ? value as Partial<DealOrNoDealSpendSettings> : {}

  return {
    enabled: payload.enabled === true,
    premiumEntryCost: normalizePositiveInteger(payload.premiumEntryCost, defaults.premiumEntryCost, 999999),
    rewardMultiplier: normalizeRewardMultiplier(payload.rewardMultiplier, defaults.rewardMultiplier),
  }
}

function normalizeBankerRequestType(value: unknown): DealOrNoDealBankerRequestType {
  return value === 'swapBox' || value === 'buyBox' || value === 'cashOffer' ? value : 'cashOffer'
}

function normalizeTargetMode(value: unknown): DealOrNoDealTargetMode {
  return value === 'highest' || value === 'lowest' || value === 'playerChoice' || value === 'random' ? value : 'random'
}

function normalizeChance(value: unknown, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(0, Math.min(1, numericValue))
}

function normalizePositiveInteger(value: unknown, fallback: number, maximum: number) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return Math.min(maximum, numericValue)
}

function normalizeInteger(value: unknown, fallback: number, maximum: number, minimum = 0) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue)) return fallback
  return Math.max(minimum, Math.min(maximum, numericValue))
}

function normalizeRewardMultiplier(value: unknown, fallback: number) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return Math.max(0.01, Math.min(100, Math.round(numericValue * 100) / 100))
}

function cryptoSafeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `banker-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeEntryCost(value: unknown) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue) || numericValue <= 0) return DEFAULT_ENTRY_COST
  return Math.min(999999, numericValue)
}
