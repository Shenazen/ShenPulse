/** Boîtes mystère : file bornée, débordement résolu et timers annulables. */
import type { CoinPusherGameResources } from './resources'
import type { CoinItemKind, PusherCoin, MysteryResolutionAction } from './types'
import { SCORE_TOP, MAX_MYSTERY_REVEAL_QUEUE } from './constants'
import { randomInteger, formatMultiplier } from './presentation'
import { normalizeCoinPusherDrop, type CoinPusherDropEvent } from '../coinPusherSettings'

type MysteryResources = Pick<CoinPusherGameResources, 'runtime' | 'roundPhase' | 'mysteryRevealQueue' | 'mysteryRevealActive' | 'settings' | 'floatingScores' | 'scoreMultiplier' | 'scoreMultiplierSeconds' | 'mysteryRevealPhase' | 'mysteryRevealAccent' | 'mysteryRevealLabel' | 'mysteryRevealDetail' | 'mysteryToneTimers' | 'getScene3d'> & {
  awardPoints: (coin: PusherCoin, points: number, countScore: boolean) => void
  enqueueSpawnBatch: (drop: CoinPusherDropEvent, kind: CoinItemKind, requested: number) => number
  activateSideGuard: (durationSeconds: number, shouldAnnounce?: boolean) => void
  tone: (frequency: number, duration?: number, gainValue?: number, priority?: number, key?: string) => void
  burst: (x: number, y: number, color: string, count?: number, speed?: number) => void
}

export function createCoinPusherMystery({ runtime, roundPhase, mysteryRevealQueue, mysteryRevealActive, settings, floatingScores, scoreMultiplier, scoreMultiplierSeconds, mysteryRevealPhase, mysteryRevealAccent, mysteryRevealLabel, mysteryRevealDetail, mysteryToneTimers, getScene3d, awardPoints, enqueueSpawnBatch, activateSideGuard, tone, burst }: MysteryResources) {
  function triggerMysteryAction(coin: PusherCoin) {
    if (roundPhase.value === 'finished') return
    if (mysteryRevealQueue.length >= MAX_MYSTERY_REVEAL_QUEUE) {
      const overflowActions = buildMysteryActions(coin)
      overflowActions[Math.floor(Math.random() * overflowActions.length)].run()
      runtime.mysteryOverflowResolved += 1
      return
    }
    mysteryRevealQueue.push({ coin })
    if (!mysteryRevealActive.value && !runtime.mysteryResultTimer && !runtime.mysteryCloseTimer) {
      startNextMysteryReveal()
    }
  }
  
  function buildMysteryActions(coin: PusherCoin): MysteryResolutionAction[] {
    const mystery = settings.value.mysteryCube
    const actions: MysteryResolutionAction[] = []
  
    if (mystery.pointsBonusEnabled) {
      actions.push({
        accent: '#f8d776',
        label: 'TRÉSOR BONUS',
        run: () => {
          const bonus = randomInteger(mystery.pointsBonusMin, mystery.pointsBonusMax)
          awardPoints(coin, bonus, false)
          floatingScores.push({
            color: '#f8d776',
            id: runtime.floatingScoreIdSeed++,
            life: 1.55,
            text: `TRÉSOR +${bonus}`,
            x: coin.x,
            y: SCORE_TOP + 18,
          })
          return `+${bonus} POINTS POUR ${coin.name.toUpperCase()}`
        },
      })
    }
  
    if (mystery.coinRainEnabled) {
      actions.push({
        accent: '#67e8f9',
        label: 'PLUIE DE PIÈCES',
        run: () => {
          const requested = randomInteger(mystery.coinRainMin, mystery.coinRainMax)
          const rainDrop = normalizeCoinPusherDrop({
            avatarUrl: coin.avatarUrl,
            coinCount: requested,
            createdAt: Date.now(),
            displayName: coin.name,
            eventId: `mystery-rain-${Date.now()}-${coin.id}`,
            gift: {
              cost: 0,
              id: 'mystery-coin-rain',
              imageUrl: '',
              name: 'Pluie mystère',
            },
            source: 'manual',
            username: coin.username,
            viewerId: coin.viewerId,
          })
          const queued = enqueueSpawnBatch(rainDrop, 'coin', requested)
          return `${queued} NOUVELLES PIÈCES POUR ${coin.name.toUpperCase()}`
        },
      })
    }
  
    if (mystery.multiplierEnabled) {
      actions.push({
        accent: '#f472b6',
        label: `SCORE ×${formatMultiplier(mystery.multiplierValue)}`,
        run: () => {
          scoreMultiplier.value = mystery.multiplierValue
          scoreMultiplierSeconds.value = mystery.multiplierDurationSeconds
          return `TOUS LES SCORES SONT MULTIPLIÉS PENDANT ${Math.ceil(mystery.multiplierDurationSeconds)} S`
        },
      })
    }
  
    if (mystery.barriersEnabled && settings.value.sideLossEnabled) {
      actions.push({
        accent: '#60a5fa',
        label: 'BOUCLIERS SAUVEURS',
        run: () => {
          activateSideGuard(mystery.barriersDurationSeconds, false)
          return `BORDS PROTÉGÉS PENDANT ${Math.ceil(mystery.barriersDurationSeconds)} S`
        },
      })
    }
  
    if (!actions.length) {
      actions.push({
        accent: '#94a3b8',
        label: 'AUCUNE ACTION ACTIVE',
        run: () => 'ACTIVEZ AU MOINS UN EFFET DANS LES PARAMÈTRES',
      })
    }
  
    return actions
  }
  
  function startNextMysteryReveal() {
    const job = mysteryRevealQueue.shift()
    if (!job) {
      mysteryRevealActive.value = false
      return
    }
  
    clearMysteryRevealTimers()
    const actions = buildMysteryActions(job.coin)
    const selected = actions[Math.floor(Math.random() * actions.length)]
    let previewIndex = Math.floor(Math.random() * actions.length)
    mysteryRevealActive.value = true
    mysteryRevealPhase.value = 'rolling'
    mysteryRevealAccent.value = '#c084fc'
    mysteryRevealLabel.value = actions[previewIndex].label
    mysteryRevealDetail.value = `LE DÉ DE ${job.coin.name.toUpperCase()} CHOISIT…`
  
    runtime.mysteryRollInterval = window.setInterval(() => {
      previewIndex = (previewIndex + 1) % actions.length
      mysteryRevealLabel.value = actions[previewIndex].label
    }, actions.length > 1 ? 135 : 240)
  
    const rollNotes = [420, 470, 530, 600, 680, 770, 880]
    rollNotes.forEach((frequency, index) => {
      mysteryToneTimers.push(window.setTimeout(() => {
        tone(
          frequency,
          0.045 + index * 0.004,
          0.025 + index * 0.003,
          2,
          `mystery-roll-${index}`,
        )
      }, 240 + index * 245))
    })
  
    runtime.mysteryResultTimer = window.setTimeout(() => {
      runtime.mysteryResultTimer = 0
      window.clearInterval(runtime.mysteryRollInterval)
      runtime.mysteryRollInterval = 0
      if (roundPhase.value === 'finished') {
        cancelMysteryReveals()
        return
      }
      mysteryRevealPhase.value = 'revealed'
      mysteryRevealAccent.value = selected.accent
      mysteryRevealLabel.value = selected.label
      const detail = selected.run()
      const overflowCount = runtime.mysteryOverflowResolved
      runtime.mysteryOverflowResolved = 0
      mysteryRevealDetail.value = overflowCount > 0
        ? `${detail} · ${overflowCount} EFFET${overflowCount > 1 ? 'S' : ''} RÉSOLU${overflowCount > 1 ? 'S' : ''} EN RAFALE`
        : detail
      burst(job.coin.x, SCORE_TOP + 18, selected.accent, 76, 245)
      getScene3d()?.giftBurst(70)
      tone(960, 0.26, 0.082, 3, 'mystery-reveal-high')
      mysteryToneTimers.push(window.setTimeout(() => {
        tone(640, 0.3, 0.07, 3, 'mystery-reveal-low')
      }, 95))
  
      runtime.mysteryCloseTimer = window.setTimeout(() => {
        runtime.mysteryCloseTimer = 0
        mysteryRevealActive.value = false
        runtime.mysteryCloseTimer = window.setTimeout(() => {
          runtime.mysteryCloseTimer = 0
          startNextMysteryReveal()
        }, 260)
      }, 2600)
    }, 2100)
  }
  
  function clearMysteryRevealTimers() {
    window.clearInterval(runtime.mysteryRollInterval)
    window.clearTimeout(runtime.mysteryResultTimer)
    window.clearTimeout(runtime.mysteryCloseTimer)
    runtime.mysteryRollInterval = 0
    runtime.mysteryResultTimer = 0
    runtime.mysteryCloseTimer = 0
    for (const timer of mysteryToneTimers) window.clearTimeout(timer)
    mysteryToneTimers.splice(0)
  }
  
  function cancelMysteryReveals() {
    clearMysteryRevealTimers()
    mysteryRevealQueue.splice(0)
    runtime.mysteryOverflowResolved = 0
    mysteryRevealActive.value = false
    mysteryRevealPhase.value = 'rolling'
  }

  return { triggerMysteryAction, buildMysteryActions, startNextMysteryReveal, clearMysteryRevealTimers, cancelMysteryReveals }
}
