/** Simulation par pas de temps : collisions, piles et transport des pièces.
 * Algorithmes physiques et limites conservés ; les callbacks gardent le scoring central. */
import type { Ref } from 'vue'
import type { PusherCoin, Particle, FloatingScore } from './types'
import { HEIGHT, SCORE_TOP, PUSHER_TRAY_LEFT, PUSHER_TRAY_RIGHT } from './constants'
import { COIN_PUSHER_MAX_STACK_LEVEL, COIN_PUSHER_PLINKO_EXIT_Y as PLINKO_EXIT_Y, COIN_PUSHER_PLINKO_LEFT as PLINKO_LEFT, COIN_PUSHER_PLINKO_RIGHT as PLINKO_RIGHT, COIN_PUSHER_SHELF_DEPTH_SCALE, COIN_PUSHER_SHELF_EDGE as SHELF_EDGE, COIN_PUSHER_SHELF_TOP as SHELF_TOP, COIN_PUSHER_STACK_SUPPORT_RATIO, COIN_PUSHER_WIDTH as WIDTH, coinPusherBodyShouldRetire, coinPusherFindClosestStackSupport, coinPusherFindLandingStackLevel, coinPusherPusherFaceY, coinPusherRefreshStackSpatialBody, coinPusherStackCollisionLevel, coinPusherStackHasIndexedSupport, coinPusherTransportOnSupport, coinPusherUpperTrayHasSupport, constrainCoinPusherToFace, createCoinPusherStackSpatialIndex, resolveCoinPusherBodyCollisions, stepCoinPusherPlinko, stepCoinPusherSettling, stepCoinPusherShelfBody, stepCoinPusherUpperTray, type CoinPusherPeg, type CoinPusherStackSpatialIndex } from '../coinPusherPhysics'

type SimulationResources = {
  coins: PusherCoin[]
  particles: Particle[]
  floatingScores: FloatingScore[]
  totalSideLosses: Ref<number>
  sideGuardSolid: Readonly<Ref<boolean>>
  getPegs: () => CoinPusherPeg[]
  getPusherY: () => number
  getPreviousPusherY: () => number
  burst: (x: number, y: number, color: string, count?: number, speed?: number) => void
  tone: (frequency: number, duration?: number, gainValue?: number, priority?: number, key?: string) => void
  scoreCoin: (coin: PusherCoin) => void
}

export function createCoinPusherSimulation({ coins, particles, floatingScores, totalSideLosses, sideGuardSolid, getPegs, getPusherY, getPreviousPusherY, burst, tone, scoreCoin }: SimulationResources) {
  function isPusherTransportSupport(coin: PusherCoin) {
    return coin.phase === 'pusher' && !coin.stackFalling
  }
  
  function isShelfTransportSupport(coin: PusherCoin) {
    return coin.phase === 'shelf' && !coin.stackFalling
  }
  
  function updateCoins(delta: number) {
    const currentFaceY = coinPusherPusherFaceY(getPusherY())
    const previousFaceY = coinPusherPusherFaceY(getPreviousPusherY())
    const stackFrameStart = new Map(
      coins
        .filter((coin) => coin.phase === 'pusher' || coin.phase === 'shelf')
        .map((coin) => [coin.id, { x: coin.x, y: coin.y }]),
    )
  
    for (const coin of coins) {
      coin.rotation += coin.spin * delta
      coin.faceAngle += coin.spin * 1.45 * delta
  
      if (coin.phase === 'plinko') {
        const plinkoStep = stepCoinPusherPlinko(coin, delta, getPegs())
        for (const peg of plinkoStep.impacts) {
          showPegImpact(peg)
        }
  
        if (plinkoStep.escaped) {
          coin.phase = 'pusher'
          coin.dropProgress = 0
          // La chute reste fixée au meuble. Son point d'impact en coordonnées
          // monde touche l'arrière du plateau étendu ou l'avant du plateau
          // rétracté, au lieu de suivre artificiellement le poussoir.
          coin.y = PLINKO_EXIT_Y
          coin.vx *= 0.22
          coin.vy = 0
          coin.spin *= 0.38
          constrainUpperTrayCoin(coin)
          assignLandingStack(coin, 'pusher')
          burst(coin.x, coin.y, '#6ee7ff', 6, 52)
          tone(420, 0.025, 0.018)
        }
        continue
      }
  
      if (coin.phase === 'pusher') {
        stepCoinPusherUpperTray(coin, {
          currentPusherY: getPusherY(),
          delta,
          previousPusherY: getPreviousPusherY(),
        })
        constrainUpperTrayCoin(coin)
        continue
      }
  
      if (coin.phase === 'settling') {
        if (stepCoinPusherSettling(coin, delta)) {
          coin.phase = 'shelf'
          coin.dropProgress = 1
          coin.vx *= 0.32
          coin.vy = 0
          coin.spin *= 0.62
          const faceVelocity = Math.max(
            0,
            (currentFaceY - previousFaceY) / Math.max(1 / 1000, delta),
          )
          constrainCoinPusherToFace(coin, currentFaceY, faceVelocity)
          constrainShelfCoin(coin)
          assignLandingStack(coin, 'shelf')
          burst(coin.x, coin.y, '#d7b56d', 7, 48)
          tone(235, 0.045, 0.024)
        }
        continue
      }
  
      if (coin.phase === 'shelf') {
        stepCoinPusherShelfBody(coin, {
          currentFaceY,
          delta,
          previousFaceY,
        })
        constrainShelfCoin(coin)
        continue
      }
  
      coin.stackHeight = Math.max(0, coin.stackHeight - delta * 8)
      coin.vy += 880 * delta
      coin.vx *= Math.pow(0.992, delta * 60)
      coin.x += coin.vx * delta
      coin.y += coin.vy * delta
  
      if (!coin.scored && coin.y >= SCORE_TOP + 18) {
        coin.scored = true
        scoreCoin(coin)
      }
    }
  
    resolvePlinkoCollisions()
    const frameStartSupportIndex = createCoinPusherStackSpatialIndex(coins, {
      normalizeLevels: false,
      positions: stackFrameStart,
    })
    resolveUpperTrayCollisions(stackFrameStart, frameStartSupportIndex)
    resolveShelfCollisions(
      previousFaceY,
      currentFaceY,
      delta,
      stackFrameStart,
      frameStartSupportIndex,
    )
    stabilizeCoinStacks(delta)
  
    let retainedCoinCount = 0
    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index]
      if (coinPusherBodyShouldRetire(coin, HEIGHT + 70)) continue
      coins[retainedCoinCount] = coin
      retainedCoinCount += 1
    }
    coins.length = retainedCoinCount
  }
  
  function beginSettlingCoin(coin: PusherCoin) {
    if (coin.phase === 'settling') return
    coin.phase = 'settling'
    coin.dropProgress = 0
    coin.stackFalling = false
    coin.vy = 0
    coin.spin *= 0.74
    burst(coin.x, coin.y, '#9deeff', 4, 36)
  }
  
  function beginFallingCoin(coin: PusherCoin) {
    if (coin.phase === 'falling') return
    coin.phase = 'falling'
    coin.lostSide = 0
    coin.dropProgress = 1
    coin.stackLevel = 0
    coin.stackFalling = false
    coin.vy = 90 + Math.random() * 45
    coin.vx += (Math.random() - 0.5) * 36
    coin.spin = (Math.random() > 0.5 ? 1 : -1) * (5.2 + Math.random() * 5)
    burst(coin.x, SHELF_EDGE + 8, '#fbbf24', 7, 85)
  }
  
  function beginSideFallingCoin(coin: PusherCoin, side: -1 | 1) {
    if (coin.phase === 'falling') return
    coin.phase = 'falling'
    coin.lostSide = side
    coin.dropProgress = 1
    coin.stackLevel = 0
    coin.stackFalling = false
    coin.scored = true
    coin.vy = 72 + Math.random() * 36
    coin.vx = side * (92 + Math.random() * 64)
    coin.spin = -side * (6.2 + Math.random() * 5.5)
    totalSideLosses.value += 1
    burst(coin.x, coin.y, '#fb7185', 10, 105)
    tone(128, 0.09, 0.04, 1, 'side-loss')
  }
  
  function showPegImpact(peg: CoinPusherPeg) {
    burst(peg.x, peg.y, peg.row % 2 ? '#a78bfa' : '#67e8f9', 3, 42)
    tone(540 + peg.row * 35, 0.025, 0.02)
  }
  
  function resolveUpperTrayCollisions(
    frameStart: ReadonlyMap<string, { x: number; y: number }>,
    frameStartSupportIndex: CoinPusherStackSpatialIndex<PusherCoin>,
  ) {
    const supportEdgeY = coinPusherPusherFaceY(getPusherY())
    for (let level = 0; level <= COIN_PUSHER_MAX_STACK_LEVEL; level += 1) {
      if (level > 0) {
        const activeUpperCoins = coins.filter((coin) => coin.phase === 'pusher')
        const settlingCoins = coins.filter((coin) => coin.phase === 'settling')
        const stableSupportIndex = createCoinPusherStackSpatialIndex(
          activeUpperCoins.filter((coin) => !coin.stackFalling),
          { normalizeLevels: false },
        )
        const settlingSupportIndex = createCoinPusherStackSpatialIndex(settlingCoins, {
          normalizeLevels: false,
        })
        for (const coin of activeUpperCoins.filter((candidate) => candidate.stackLevel === level)) {
          const hasStableSupport = coinPusherFindClosestStackSupport(
            coin,
            stableSupportIndex,
            {
              ratio: COIN_PUSHER_STACK_SUPPORT_RATIO,
              supportLevel: level - 1,
            },
          ) !== null
          const followsDroppingSupport = !hasStableSupport
            && coinPusherFindClosestStackSupport(
              coin,
              settlingSupportIndex,
              {
                ratio: COIN_PUSHER_STACK_SUPPORT_RATIO,
                supportLevel: level - 1,
              },
            ) !== null
          if (!hasStableSupport && followsDroppingSupport) beginSettlingCoin(coin)
        }
        transportCoinStackLevel(
          'pusher',
          level,
          frameStart,
          frameStartSupportIndex,
        )
      }
  
      const layerCoins = stackCoinsAtLevel('pusher', level)
      resolveCoinPusherBodyCollisions(layerCoins, {
        iterations: 4,
        padding: 0,
        restitution: 0.04,
        yScale: COIN_PUSHER_SHELF_DEPTH_SCALE,
      })
  
      for (const coin of layerCoins) {
        constrainUpperTrayCoin(coin)
        if (
          level === 0
          && !coinPusherUpperTrayHasSupport(coin, supportEdgeY)
        ) beginSettlingCoin(coin)
      }
    }
  }
  
  function resolveShelfCollisions(
    previousFaceY: number,
    currentFaceY: number,
    delta: number,
    frameStart: ReadonlyMap<string, { x: number; y: number }>,
    frameStartSupportIndex: CoinPusherStackSpatialIndex<PusherCoin>,
  ) {
    const faceVelocity = Math.max(
      0,
      (currentFaceY - previousFaceY) / Math.max(1 / 1000, delta),
    )
  
    for (let level = 0; level <= COIN_PUSHER_MAX_STACK_LEVEL; level += 1) {
      if (level > 0) {
        transportCoinStackLevel(
          'shelf',
          level,
          frameStart,
          frameStartSupportIndex,
        )
      }
      const layerCoins = stackCoinsAtLevel('shelf', level)
      for (let iteration = 0; iteration < 4; iteration += 1) {
        resolveCoinPusherBodyCollisions(layerCoins, {
          iterations: 1,
          padding: 0,
          restitution: 0.06,
          yScale: COIN_PUSHER_SHELF_DEPTH_SCALE,
        })
  
        // Une collision en chaîne peut presser la pièce arrière contre la face.
        // Cette contrainte corrige uniquement une pénétration réelle ; elle
        // ne tire jamais une pièce quand le poussoir se rétracte.
        for (const coin of layerCoins) {
          constrainCoinPusherToFace(coin, currentFaceY, faceVelocity)
          constrainShelfCoin(coin)
        }
      }
    }
  
    const shelfCoins = coins.filter((coin) => coin.phase === 'shelf')
    for (const coin of shelfCoins) {
      constrainShelfCoin(coin)
      if (
        coin.stackLevel === 0
        && !coinPusherUpperTrayHasSupport(coin, SHELF_EDGE)
      ) beginFallingCoin(coin)
    }
  }
  
  function assignLandingStack(coin: PusherCoin, phase: 'pusher' | 'shelf') {
    const candidates = coins.filter((candidate) => (
      candidate.id !== coin.id
      && candidate.phase === phase
      && !candidate.stackFalling
    ))
    coin.stackLevel = coinPusherFindLandingStackLevel(coin, candidates)
    if (coin.stackLevel === 0) {
      coin.stackHeight = 0
      coin.stackFalling = false
      return
    }
    coin.stackHeight = Math.max(coin.stackHeight, coin.stackLevel + 0.32)
    coin.stackFalling = true
  }
  
  function stabilizeCoinStacks(delta: number) {
    for (const phase of ['pusher', 'shelf'] as const) {
      const phaseCoins = coins
        .filter((coin) => coin.phase === phase)
        .sort((left, right) => left.stackLevel - right.stackLevel)
      const supportIndex = createCoinPusherStackSpatialIndex(phaseCoins)
  
      for (const coin of phaseCoins) {
        if (coin.stackFalling) {
          coin.stackHeight = Math.max(coin.stackLevel, coin.stackHeight - delta * 7)
          if (coin.stackHeight <= coin.stackLevel + 0.005) {
            coin.stackHeight = coin.stackLevel
            coin.stackFalling = false
          }
          continue
        }
  
        if (coin.stackLevel > 0 && !coinPusherStackHasIndexedSupport(coin, supportIndex)) {
          coin.stackLevel -= 1
          coin.stackFalling = true
          coinPusherRefreshStackSpatialBody(supportIndex, coin)
          continue
        }
        coin.stackHeight = coin.stackLevel
      }
    }
  }
  
  function stackCoinsAtLevel(phase: 'pusher' | 'shelf', level: number) {
    return coins.filter((coin) => (
      coin.phase === phase
      && coinPusherStackCollisionLevel(coin) === level
    ))
  }
  
  function transportCoinStackLevel(
    phase: 'pusher' | 'shelf',
    level: number,
    frameStart: ReadonlyMap<string, { x: number; y: number }>,
    frameStartSupportIndex: CoinPusherStackSpatialIndex<PusherCoin>,
  ) {
    const phaseCoins = coins.filter((coin) => coin.phase === phase)
  
    for (const coin of phaseCoins) {
      if (coin.stackLevel !== level || coin.stackFalling) continue
      const coinStart = frameStart.get(coin.id)
      if (!coinStart) continue
  
      const support = coinPusherFindClosestStackSupport(
        coin,
        frameStartSupportIndex,
        {
          accept: phase === 'pusher'
            ? isPusherTransportSupport
            : isShelfTransportSupport,
          position: coinStart,
          ratio: COIN_PUSHER_STACK_SUPPORT_RATIO,
          supportLevel: level - 1,
        },
      )
      if (!support) continue
  
      const supportStart = frameStart.get(support.id)
      if (!supportStart) continue
      if (!coinPusherTransportOnSupport(coin, coinStart, support, supportStart)) continue
      if (phase === 'pusher') constrainUpperTrayCoin(coin)
      else {
        constrainShelfCoin(coin)
      }
    }
  }
  
  function resolvePlinkoCollisions() {
    const plinkoCoins = resolveCoinCollisions('plinko', 2, 0.16)
    for (const coin of plinkoCoins) {
      if (coin.x - coin.radius < PLINKO_LEFT) {
        coin.x = PLINKO_LEFT + coin.radius
        coin.vx = Math.abs(coin.vx) * 0.5
      } else if (coin.x + coin.radius > PLINKO_RIGHT) {
        coin.x = PLINKO_RIGHT - coin.radius
        coin.vx = -Math.abs(coin.vx) * 0.5
      }
    }
  }
  
  function resolveCoinCollisions(
    phase: 'plinko' | 'pusher',
    iterations: number,
    restitution: number,
    yScale = 1,
  ) {
    const phaseCoins = coins.filter((coin) => coin.phase === phase)
    resolveCoinPusherBodyCollisions(phaseCoins, {
      iterations,
      padding: phase === 'plinko' ? 0.25 : 0,
      restitution,
      yScale,
    })
    return phaseCoins
  }
  
  function constrainUpperTrayCoin(coin: PusherCoin) {
    if (!sideGuardSolid.value) {
      if (coin.x < PUSHER_TRAY_LEFT) beginSideFallingCoin(coin, -1)
      else if (coin.x > PUSHER_TRAY_RIGHT) beginSideFallingCoin(coin, 1)
      return
    }
    if (coin.x - coin.radius < PUSHER_TRAY_LEFT) {
      coin.x = PUSHER_TRAY_LEFT + coin.radius
      coin.vx = Math.abs(coin.vx) * 0.22
    } else if (coin.x + coin.radius > PUSHER_TRAY_RIGHT) {
      coin.x = PUSHER_TRAY_RIGHT - coin.radius
      coin.vx = -Math.abs(coin.vx) * 0.22
    }
  }
  
  function constrainShelfCoin(coin: PusherCoin) {
    const depth = Math.max(0, Math.min(1, (coin.y - SHELF_TOP) / (SHELF_EDGE - SHELF_TOP)))
    const left = 48 + depth * 13
    const right = WIDTH - left
    if (!sideGuardSolid.value) {
      if (coin.x < left) beginSideFallingCoin(coin, -1)
      else if (coin.x > right) beginSideFallingCoin(coin, 1)
      return
    }
    if (coin.x - coin.radius < left) {
      coin.x = left + coin.radius
      coin.vx = Math.abs(coin.vx) * 0.3
    } else if (coin.x + coin.radius > right) {
      coin.x = right - coin.radius
      coin.vx = -Math.abs(coin.vx) * 0.3
    }
  }
  
  function updateParticles(delta: number) {
    let writeIndex = 0
    for (let readIndex = 0; readIndex < particles.length; readIndex += 1) {
      const particle = particles[readIndex]
      particle.life -= delta
      particle.vy += 155 * delta
      particle.x += particle.vx * delta
      particle.y += particle.vy * delta
      if (particle.life <= 0) continue
      particles[writeIndex] = particle
      writeIndex += 1
    }
    particles.length = writeIndex
  }
  
  function updateFloatingScores(delta: number) {
    for (const score of floatingScores) {
      score.life -= delta
      score.y -= 42 * delta
    }
    for (let index = floatingScores.length - 1; index >= 0; index -= 1) {
      if (floatingScores[index].life <= 0) floatingScores.splice(index, 1)
    }
  }

  return { isPusherTransportSupport, isShelfTransportSupport, updateCoins, beginSettlingCoin, beginFallingCoin, beginSideFallingCoin, showPegImpact, resolveUpperTrayCollisions, resolveShelfCollisions, assignLandingStack, stabilizeCoinStacks, stackCoinsAtLevel, transportCoinStackLevel, resolvePlinkoCollisions, resolveCoinCollisions, constrainUpperTrayCoin, constrainShelfCoin, updateParticles, updateFloatingScores }
}
