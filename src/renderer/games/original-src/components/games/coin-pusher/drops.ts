/** Cadeaux et apparition des pièces : normalisation, files et probabilités conservées. */
import type { CoinPusherGameResources } from './resources'
import type { CoinItemKind, PusherCoin } from './types'
import { randomInteger, safeAddInteger, dropName, dropUsername, dropAvatar, dropViewerId } from './presentation'
import { coinPusherDesignatedGiftMatches, normalizeCoinPusherDrop, type CoinPusherDropEvent } from '../coinPusherSettings'
import { COIN_PUSHER_COIN_RADIUS_MAX, COIN_PUSHER_COIN_RADIUS_MIN, COIN_PUSHER_PLINKO_LEFT as PLINKO_LEFT, COIN_PUSHER_PLINKO_RIGHT as PLINKO_RIGHT, COIN_PUSHER_PLINKO_TOP as PLINKO_TOP, COIN_PUSHER_WIDTH as WIDTH } from '../coinPusherPhysics'

type DropsResources = Pick<CoinPusherGameResources, 'runtime' | 'spawnQueue' | 'coins' | 'settings' | 'totalSpawnedCoins' | 'roundPhase' | 'fullPushFinishAfter' | 'seenDropIds' | 'totalDiamondsReceived' | 'latestDrop' | 'latestDropPresentedCount' | 'latestDropObjectLabel' | 'latestDropVisible' | 'getScene3d'> & {
  warmAvatar: (url: string) => void
  burst: (x: number, y: number, color: string, count?: number, speed?: number) => void
  tone: (frequency: number, duration?: number, gainValue?: number, priority?: number, key?: string) => void
  activateSideGuard: (durationSeconds: number, shouldAnnounce?: boolean) => void
}

export function createCoinPusherDrops({ runtime, spawnQueue, coins, settings, totalSpawnedCoins, roundPhase, fullPushFinishAfter, seenDropIds, totalDiamondsReceived, latestDrop, latestDropPresentedCount, latestDropObjectLabel, latestDropVisible, getScene3d, warmAvatar, burst, tone, activateSideGuard }: DropsResources) {
  function updateSpawnQueue(delta: number) {
    if (!spawnQueue.length) return
    runtime.spawnClock += delta
  
    const batch = spawnQueue[0]
    const delay = batch.remaining > 45 ? 0.05 : batch.remaining > 15 ? 0.06 : 0.075
    runtime.spawnClock = Math.min(runtime.spawnClock, delay * 2)
    while (runtime.spawnClock >= delay && batch && coins.length < settings.value.maxCoins) {
      runtime.spawnClock -= delay
      spawnCoin(batch.drop, batch.remaining, batch.kind)
      batch.remaining -= 1
      if (batch.remaining <= 0) {
        spawnQueue.shift()
        runtime.spawnClock = 0
        break
      }
    }
  }
  
  function spawnCoin(
    drop: CoinPusherDropEvent,
    remaining: number,
    kind: CoinItemKind = 'coin',
  ) {
    const radius = (
      COIN_PUSHER_COIN_RADIUS_MIN
      + Math.random() * (COIN_PUSHER_COIN_RADIUS_MAX - COIN_PUSHER_COIN_RADIUS_MIN)
    ) * settings.value.coinScale
    const batchCount = Math.max(1, Number((drop as any).coinCount) || 1)
    const spread = Math.min(
      (PLINKO_RIGHT - PLINKO_LEFT) / 2 - radius - 4,
      Math.max(radius * 3.5, 80 + batchCount * 2.4),
    )
    const lane = ((remaining * 0.61803398875) % 1) - 0.5
    const name = dropName(drop)
    const username = dropUsername(drop)
    const viewerId = dropViewerId(drop)
    const avatarUrl = dropAvatar(drop)
    const coin: PusherCoin = {
      avatarUrl,
      createdAt: Date.now(),
      dropProgress: 0,
      faceAngle: Math.random() * Math.PI * 2,
      id: `coin-${runtime.idSeed++}`,
      kind,
      lostSide: 0,
      name,
      phase: 'plinko',
      plinkoAge: 0,
      plinkoImpactCooldown: 0,
      plinkoProgressY: PLINKO_TOP - 38,
      plinkoStallSeconds: 0,
      radius,
      rotation: Math.random() * Math.PI * 2,
      scored: false,
      spin: (Math.random() > 0.5 ? 1 : -1) * (2.4 + Math.random() * 4),
      specialValue: kind === 'ticket'
        ? randomInteger(settings.value.tickets.minPoints, settings.value.tickets.maxPoints)
        : 0,
      stackFalling: false,
      stackHeight: 0,
      stackLevel: 0,
      username,
      viewerId,
      vx: lane * 70 + (Math.random() - 0.5) * 42,
      vy: 8 + Math.random() * 42,
      x: Math.max(
        PLINKO_LEFT + radius,
        Math.min(
          PLINKO_RIGHT - radius,
          WIDTH / 2 + lane * spread + (Math.random() - 0.5) * 16,
        ),
      ),
      y: PLINKO_TOP - 38 - Math.random() * 28,
    }
    coin.plinkoProgressY = coin.y
    coins.push(coin)
    totalSpawnedCoins.value += 1
    warmAvatar(avatarUrl)
    burst(coin.x, coin.y + 10, '#f8d776', 4, 52)
    tone(360 + Math.random() * 80, 0.035, 0.025)
    return coin
  }
  
  function enqueueDrop(input: CoinPusherDropEvent | Record<string, any>) {
    if (roundPhase.value === 'finished' || fullPushFinishAfter.value) return
    const drop = normalizeCoinPusherDrop(input as CoinPusherDropEvent)
    const dropId = String((drop as any).eventId || (drop as any).id || '')
    const now = Date.now()
    pruneSeenDrops(now)
    if (dropId && seenDropIds.has(dropId)) return
    if (dropId) seenDropIds.set(dropId, now)
    if (drop.source === 'gift') {
      totalDiamondsReceived.value = safeAddInteger(
        totalDiamondsReceived.value,
        drop.totalDiamonds,
      )
    }
  
    const count = Math.max(
      1,
      Math.min(settings.value.maxCoins, Math.round(Number((drop as any).coinCount) || 1)),
    )
    const repeatCount = Math.max(1, Math.round(Number(drop.repeatCount) || 1))
    const guardMatches = settings.value.sideLossEnabled
      && coinPusherDesignatedGiftMatches(drop.gift, settings.value.guardGift)
    const mysteryMatches = coinPusherDesignatedGiftMatches(
      drop.gift,
      settings.value.mysteryCube,
    )
    const ticketMatches = coinPusherDesignatedGiftMatches(
      drop.gift,
      settings.value.tickets,
    )
    const mysteryCount = settings.value.mysteryCube.enabled
      ? mysteryMatches
        ? repeatCount
        : randomBinomial(repeatCount, settings.value.mysteryCube.spawnChance)
      : 0
    const ticketTriggers = settings.value.tickets.enabled
      ? ticketMatches
        ? repeatCount
        : randomBinomial(repeatCount, settings.value.tickets.spawnChance)
      : 0
    let includeCoinDrop = true
    let queuedSpecialCount = 0
    const specialLabels: string[] = []
  
    if (guardMatches) {
      activateSideGuard(settings.value.guardGift.durationSeconds)
      includeCoinDrop = settings.value.guardGift.includeCoinDrop
      specialLabels.push('BOUCLIERS')
    }
    if (mysteryCount > 0) {
      queuedSpecialCount += enqueueSpawnBatch(drop, 'mystery', mysteryCount)
      if (mysteryMatches && !settings.value.mysteryCube.includeCoinDrop) {
        includeCoinDrop = false
      }
      specialLabels.push('DÉ MYSTÈRE')
    }
    if (ticketTriggers > 0) {
      const ticketCount = ticketTriggers * settings.value.tickets.countPerGift
      queuedSpecialCount += enqueueSpawnBatch(drop, 'ticket', ticketCount)
      if (ticketMatches && !settings.value.tickets.includeCoinDrop) {
        includeCoinDrop = false
      }
      specialLabels.push('TICKETS')
    }
  
    const queuedCoinCount = includeCoinDrop
      ? enqueueSpawnBatch(drop, 'coin', count)
      : 0
    latestDrop.value = drop
    latestDropPresentedCount.value = queuedCoinCount + queuedSpecialCount
    latestDropObjectLabel.value = specialLabels.length && !queuedCoinCount
      ? specialLabels.join(' + ')
      : specialLabels.length
        ? `PIÈCES + ${specialLabels.join(' + ')}`
        : 'PIÈCES'
    latestDropVisible.value = true
    window.clearTimeout(runtime.latestDropTimer)
    runtime.latestDropTimer = window.setTimeout(() => { latestDropVisible.value = false }, 4200)
    warmAvatar(dropAvatar(drop))
    getScene3d()?.giftBurst(Math.max(queuedCoinCount, queuedSpecialCount))
  
    if (queuedCoinCount >= 50) {
      for (let index = 0; index < 42; index += 1) {
        burst(
          70 + Math.random() * 400,
          110 + Math.random() * 90,
          index % 2 ? '#fbbf24' : '#8b5cf6',
          1,
          160,
        )
      }
      tone(210, 0.18, 0.055)
    }
  }
  
  function enqueueSpawnBatch(
    drop: CoinPusherDropEvent,
    kind: CoinItemKind,
    requestedCount: number,
  ) {
    // maxCoins borne la population physique simultanée, pas la file d'attente.
    // Le lot complet est conservé : l'apparition se suspend quand le plateau
    // est plein, sans perdre une partie d'un combo TikTok payé.
    const count = Math.max(0, Math.round(Number(requestedCount) || 0))
    if (count <= 0) return 0
    spawnQueue.push({ drop, kind, remaining: count })
    return count
  }
  
  function randomBinomial(attempts: number, percent: number) {
    const count = Math.max(0, Math.floor(Number(attempts) || 0))
    const probability = Math.max(0, Math.min(1, (Number(percent) || 0) / 100))
    if (!count || probability <= 0) return 0
    if (probability >= 1) return count
  
    if (count <= 4096) {
      let successes = 0
      for (let index = 0; index < count; index += 1) {
        if (Math.random() < probability) successes += 1
      }
      return successes
    }
  
    // L'approximation normale conserve les proportions des combos massifs
    // sans bloquer une frame avec des millions de tirages individuels.
    const mean = count * probability
    const deviation = Math.sqrt(count * probability * (1 - probability))
    const first = Math.max(Number.EPSILON, Math.random())
    const second = Math.random()
    const gaussian = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second)
    return Math.max(0, Math.min(count, Math.round(mean + gaussian * deviation)))
  }
  
  function pruneSeenDrops(now: number) {
    for (const [id, seenAt] of seenDropIds) {
      if (now - seenAt > 5 * 60_000) seenDropIds.delete(id)
    }
  }

  return { updateSpawnQueue, spawnCoin, enqueueDrop, enqueueSpawnBatch, randomBinomial, pruneSeenDrops }
}
