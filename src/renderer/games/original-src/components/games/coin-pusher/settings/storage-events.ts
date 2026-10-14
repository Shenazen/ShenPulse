import { readJsonBrowserStorage, writeJsonBrowserStorage } from '../../../../utils/browserStorage'
import type { CoinPusherSettings, CoinPusherDropEvent, CoinPusherDropInput, CoinPusherRoundCommand, CoinPusherRoundCommandInput, CoinPusherRoundCommandType } from './types'
import { loadCoinPusherSettings } from './storage-settings'
import { COIN_PUSHER_DROP_STORAGE_KEY, COIN_PUSHER_DROP_EVENT, COIN_PUSHER_COMMAND_STORAGE_KEY, COIN_PUSHER_COMMAND_EVENT } from './constants'
import { isRecord } from './records'
import { normalizeCoinPusherDrop } from './drops'
import { dispatchBrowserEvent } from './browser-events'
import { normalizeCoinPusherRoundCommand } from './commands'

export function loadCoinPusherDrop(
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherDropEvent | null {
  if (typeof window === 'undefined') return null
  const stored = readJsonBrowserStorage<unknown>('local', COIN_PUSHER_DROP_STORAGE_KEY, null)
  return isRecord(stored) ? normalizeCoinPusherDrop(stored, settings) : null
}

export function pushCoinPusherDrop(
  input: CoinPusherDropInput,
  settings: CoinPusherSettings | Partial<CoinPusherSettings> = loadCoinPusherSettings(),
): CoinPusherDropEvent {
  const drop = normalizeCoinPusherDrop(input, settings)

  if (typeof window !== 'undefined') {
    writeJsonBrowserStorage('local', COIN_PUSHER_DROP_STORAGE_KEY, drop)
    dispatchBrowserEvent(COIN_PUSHER_DROP_EVENT, drop)
  }

  return drop
}

export function loadCoinPusherRoundCommand(): CoinPusherRoundCommand | null {
  if (typeof window === 'undefined') return null
  const stored = readJsonBrowserStorage<unknown>('local', COIN_PUSHER_COMMAND_STORAGE_KEY, null)
  return isRecord(stored) ? normalizeCoinPusherRoundCommand(stored) : null
}

export function pushCoinPusherRoundCommand(
  input: CoinPusherRoundCommandInput | CoinPusherRoundCommandType,
): CoinPusherRoundCommand {
  const command = normalizeCoinPusherRoundCommand(input)

  if (typeof window !== 'undefined') {
    writeJsonBrowserStorage('local', COIN_PUSHER_COMMAND_STORAGE_KEY, command)
    dispatchBrowserEvent(COIN_PUSHER_COMMAND_EVENT, command)
  }

  return command
}

export const normalizeCoinPusherCommand = normalizeCoinPusherRoundCommand

export const loadCoinPusherCommand = loadCoinPusherRoundCommand

export const pushCoinPusherCommand = pushCoinPusherRoundCommand

