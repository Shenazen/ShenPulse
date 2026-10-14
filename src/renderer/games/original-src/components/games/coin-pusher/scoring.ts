/** Scores et classements : agrégation par frame, règles de points inchangées. */
import type { CoinPusherGameResources } from './resources'
import type { PusherCoin } from './types'
import { SCORE_TOP, MAX_FLOATING_SCORES } from './constants'
import { scoreSlotColor } from './presentation'
import { COIN_PUSHER_PLINKO_LEFT as PLINKO_LEFT, COIN_PUSHER_PLINKO_RIGHT as PLINKO_RIGHT } from '../coinPusherPhysics'

type ScoringResources = Pick<CoinPusherGameResources, 'runtime' | 'effectiveScoreSlots' | 'scoreMultiplier' | 'scoreFrameBatches' | 'playerByViewerId' | 'players' | 'scoreFramePlayers' | 'totalScoredCoins' | 'floatingScores' | 'getScene3d'> & {
  triggerMysteryAction: (coin: PusherCoin) => void
  burst: (x: number, y: number, color: string, count?: number, speed?: number) => void
  tone: (frequency: number, duration?: number, gainValue?: number, priority?: number, key?: string) => void
}

export function createCoinPusherScoring({ runtime, effectiveScoreSlots, scoreMultiplier, scoreFrameBatches, playerByViewerId, players, scoreFramePlayers, totalScoredCoins, floatingScores, getScene3d, triggerMysteryAction, burst, tone }: ScoringResources) {
  function scoreCoin(coin: PusherCoin) {
    const slots = effectiveScoreSlots.value
    const usableWidth = PLINKO_RIGHT - PLINKO_LEFT
    const normalizedX = Math.max(0, Math.min(0.9999, (coin.x - PLINKO_LEFT) / usableWidth))
    const slotIndex = Math.min(slots.length - 1, Math.floor(normalizedX * slots.length))
    const lanePoints = Number(slots[slotIndex]) || 0
    const basePoints = coin.kind === 'ticket' ? coin.specialValue : lanePoints
    const points = Math.round(basePoints * scoreMultiplier.value)
    const color = scoreSlotColor(points, slotIndex)
  
    awardPoints(coin, points, true)
    runtime.pendingScoredCoins += 1
  
    const batchKey = `${slotIndex}:${points}:${coin.kind}`
    const existingBatch = scoreFrameBatches.get(batchKey)
    if (existingBatch) {
      existingBatch.count += 1
    } else {
      scoreFrameBatches.set(batchKey, {
        color,
        count: 1,
        points,
        slotIndex,
        x: PLINKO_LEFT + (slotIndex + 0.5) * usableWidth / slots.length,
      })
    }
  
    if (coin.kind === 'mystery') triggerMysteryAction(coin)
  }
  
  function awardPoints(coin: PusherCoin, points: number, countScore: boolean) {
    let player = playerByViewerId.get(coin.viewerId)
    if (!player) {
      player = {
        avatarUrl: coin.avatarUrl,
        coinsScored: 0,
        lastScore: 0,
        name: coin.name,
        points: 0,
        rankPulse: 0,
        username: coin.username,
        viewerId: coin.viewerId,
      }
      playerByViewerId.set(player.viewerId, player)
      players.value.push(player)
    }
  
    player.avatarUrl = coin.avatarUrl || player.avatarUrl
    player.name = coin.name || player.name
    player.username = coin.username || player.username
    player.points += points
    if (countScore) player.coinsScored += 1
    player.lastScore = points
    scoreFramePlayers.add(player)
    runtime.leaderboardDirty = true
  }
  
  function flushScoreFrameBatches() {
    if (runtime.leaderboardDirty) {
      const pulseAt = Date.now()
      for (const player of scoreFramePlayers) player.rankPulse = pulseAt
      players.value = [...players.value]
      scoreFramePlayers.clear()
      runtime.leaderboardDirty = false
    }
  
    if (runtime.pendingScoredCoins > 0) {
      totalScoredCoins.value += runtime.pendingScoredCoins
      runtime.pendingScoredCoins = 0
    }
  
    if (!scoreFrameBatches.size) return
    const batches = [...scoreFrameBatches.values()]
      .sort((left, right) => left.slotIndex - right.slotIndex)
    scoreFrameBatches.clear()
  
    for (const batch of batches) {
      const countSuffix = batch.count > 1 ? ` ×${batch.count}` : ''
      floatingScores.push({
        color: batch.color,
        id: runtime.floatingScoreIdSeed++,
        life: 1.2,
        text: `${batch.points > 0 ? '+' : ''}${batch.points}${countSuffix}`,
        x: batch.x,
        y: SCORE_TOP + 42,
      })
  
      const countBoost = Math.min(18, Math.ceil(Math.log2(batch.count + 1) * 4))
      const isJackpot = batch.points >= 20
      burst(
        batch.x,
        SCORE_TOP + 46,
        batch.color,
        (isJackpot ? 28 : 14) + countBoost,
        (isJackpot ? 165 : 100) + Math.min(30, batch.count * 2),
      )
      getScene3d()?.scoreBurst(batch.x, batch.points)
      tone(
        batch.points < 0
          ? 145
          : batch.points === 0
            ? 260
            : 610 + Math.min(280, batch.points * 9),
        isJackpot ? 0.16 : 0.08,
        Math.min(0.075, (isJackpot ? 0.06 : 0.035) + Math.log2(batch.count + 1) * 0.004),
        2,
        `score-slot-${batch.slotIndex}`,
      )
    }
  
    if (floatingScores.length > MAX_FLOATING_SCORES) {
      floatingScores.splice(0, floatingScores.length - MAX_FLOATING_SCORES)
    }
  }

  return { scoreCoin, awardPoints, flushScoreFrameBatches }
}
