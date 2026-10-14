import type { CoinPusherRoundCommandInput, CoinPusherRoundCommandType, CoinPusherRoundCommand } from './types'
import { asRecord, cleanIdentifier } from './records'
import { normalizeTimestamp, normalizeRoundCommandType } from './primitives'
import { createLocalId } from './local-id'

export function normalizeCoinPusherRoundCommand(
  input: CoinPusherRoundCommandInput | CoinPusherRoundCommandType | unknown = {},
): CoinPusherRoundCommand {
  const payload = typeof input === 'string' ? { command: input } : asRecord(input)
  const createdAt = normalizeTimestamp(payload.createdAt, Date.now())
  const command = normalizeRoundCommandType(payload.command)
  const roundId = cleanIdentifier(payload.roundId, 120)
  const id = cleanIdentifier(payload.id, 180)
    || createLocalId(`coin-pusher-command-${command}`)

  return {
    command,
    createdAt,
    id,
    roundId,
  }
}

