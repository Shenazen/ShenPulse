export type ConnectFourWinLength = 4 | 5 | 6
export type ConnectFourRewardDirection = 'horizontal' | 'vertical' | 'diagonal'
export type ConnectFourRewards = Record<ConnectFourRewardDirection, number>

export type ConnectFourSettings = {
  aiEasyEntryCost: number
  aiHardEntryCost: number
  columns: number
  duelEntryCost: number
  rewards: ConnectFourRewards
  rewardsEnabled: boolean
  rows: number
  winLength: ConnectFourWinLength
}

export type ConnectFourEntryCostField = 'aiEasyEntryCost' | 'aiHardEntryCost' | 'duelEntryCost'
export type ConnectFourGridField = 'columns' | 'rows'
export type ConnectFourRewardField = ConnectFourRewardDirection

export const CONNECT_FOUR_SETTINGS_STORAGE_KEY = 'shenpulse.connectFour.settings'
export const CONNECT_FOUR_SETTINGS_EVENT = 'shenpulse:connect-four-settings'
export const CONNECT_FOUR_WIN_LENGTH_OPTIONS = [4, 5, 6] as const
export const CONNECT_FOUR_ENTRY_COST_FIELDS = ['duelEntryCost', 'aiEasyEntryCost', 'aiHardEntryCost'] as const
export const CONNECT_FOUR_REWARD_FIELDS = ['horizontal', 'vertical', 'diagonal'] as const
export const CONNECT_FOUR_MAX_ENTRY_COST = 999999
export const CONNECT_FOUR_MAX_REWARD = 999999
export const CONNECT_FOUR_MIN_COLUMNS = 4
export const CONNECT_FOUR_MAX_COLUMNS = 12
export const CONNECT_FOUR_MIN_ROWS = 4
export const CONNECT_FOUR_MAX_ROWS = 10

export function defaultConnectFourSettings(): ConnectFourSettings {
  return {
    aiEasyEntryCost: 0,
    aiHardEntryCost: 0,
    columns: 7,
    duelEntryCost: 0,
    rewards: {
      diagonal: 0,
      horizontal: 0,
      vertical: 0,
    },
    rewardsEnabled: false,
    rows: 6,
    winLength: 4,
  }
}

export function normalizeConnectFourWinLength(value: unknown): ConnectFourWinLength {
  const numericValue = Math.round(Number(value))
  return CONNECT_FOUR_WIN_LENGTH_OPTIONS.includes(numericValue as ConnectFourWinLength)
    ? numericValue as ConnectFourWinLength
    : defaultConnectFourSettings().winLength
}

export function normalizeConnectFourEntryCost(value: unknown) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue)) return 0
  return Math.max(0, Math.min(CONNECT_FOUR_MAX_ENTRY_COST, numericValue))
}

export function normalizeConnectFourGridColumns(value: unknown) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue)) return defaultConnectFourSettings().columns
  return Math.max(CONNECT_FOUR_MIN_COLUMNS, Math.min(CONNECT_FOUR_MAX_COLUMNS, numericValue))
}

export function normalizeConnectFourGridRows(value: unknown) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue)) return defaultConnectFourSettings().rows
  return Math.max(CONNECT_FOUR_MIN_ROWS, Math.min(CONNECT_FOUR_MAX_ROWS, numericValue))
}

export function normalizeConnectFourRewardAmount(value: unknown) {
  const numericValue = Math.round(Number(value))
  if (!Number.isFinite(numericValue)) return 0
  return Math.max(0, Math.min(CONNECT_FOUR_MAX_REWARD, numericValue))
}

export function normalizeConnectFourRewards(value: unknown): ConnectFourRewards {
  const defaults = defaultConnectFourSettings().rewards
  const candidate = typeof value === 'object' && value !== null ? value as Partial<ConnectFourRewards> : {}
  return {
    diagonal: normalizeConnectFourRewardAmount(candidate.diagonal ?? defaults.diagonal),
    horizontal: normalizeConnectFourRewardAmount(candidate.horizontal ?? defaults.horizontal),
    vertical: normalizeConnectFourRewardAmount(candidate.vertical ?? defaults.vertical),
  }
}

export function loadConnectFourSettings(): ConnectFourSettings {
  if (typeof window === 'undefined') return defaultConnectFourSettings()

  try {
    const stored = window.localStorage.getItem(CONNECT_FOUR_SETTINGS_STORAGE_KEY)
    if (!stored) return defaultConnectFourSettings()

    const parsed = JSON.parse(stored) as Partial<ConnectFourSettings>
    return {
      aiEasyEntryCost: normalizeConnectFourEntryCost(parsed.aiEasyEntryCost),
      aiHardEntryCost: normalizeConnectFourEntryCost(parsed.aiHardEntryCost),
      columns: normalizeConnectFourGridColumns(parsed.columns),
      duelEntryCost: normalizeConnectFourEntryCost(parsed.duelEntryCost),
      rewards: normalizeConnectFourRewards(parsed.rewards),
      rewardsEnabled: Boolean(parsed.rewardsEnabled),
      rows: normalizeConnectFourGridRows(parsed.rows),
      winLength: normalizeConnectFourWinLength(parsed.winLength),
    }
  } catch {
    return defaultConnectFourSettings()
  }
}

export function saveConnectFourSettings(settings: Partial<ConnectFourSettings>): ConnectFourSettings {
  const mergedSettings = {
    ...loadConnectFourSettings(),
    ...settings,
  }
  const nextSettings = {
    aiEasyEntryCost: normalizeConnectFourEntryCost(mergedSettings.aiEasyEntryCost),
    aiHardEntryCost: normalizeConnectFourEntryCost(mergedSettings.aiHardEntryCost),
    columns: normalizeConnectFourGridColumns(mergedSettings.columns),
    duelEntryCost: normalizeConnectFourEntryCost(mergedSettings.duelEntryCost),
    rewards: normalizeConnectFourRewards(mergedSettings.rewards),
    rewardsEnabled: Boolean(mergedSettings.rewardsEnabled),
    rows: normalizeConnectFourGridRows(mergedSettings.rows),
    winLength: normalizeConnectFourWinLength(mergedSettings.winLength),
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(CONNECT_FOUR_SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings))
    } catch {
      // The returned settings still update the current page if storage is blocked.
    }

    try {
      window.dispatchEvent(new CustomEvent(CONNECT_FOUR_SETTINGS_EVENT, { detail: nextSettings }))
    } catch {
      // Some non-browser test environments do not expose CustomEvent.
    }
  }

  return nextSettings
}
