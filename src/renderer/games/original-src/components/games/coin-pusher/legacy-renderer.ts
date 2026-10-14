/** Rendu Canvas de compatibilité lorsque WebGL est indisponible.
 * Les ressources mutables passent par des getters pour éviter un instantané périmé. */
import type { Ref } from 'vue'
import type { CoinPusherSettings } from '../coinPusherSettings'
import type { CoinPhase, PusherCoin, Particle, FloatingScore } from './types'
import { HEIGHT, SCORE_TOP, SCORE_BOTTOM, PUSHER_TRAY_LEFT, PUSHER_TRAY_RIGHT } from './constants'
import { scoreSlotColor, viewerColor, initials } from './presentation'
import { COIN_PUSHER_PLINKO_BOTTOM as PLINKO_BOTTOM, COIN_PUSHER_PLINKO_LEFT as PLINKO_LEFT, COIN_PUSHER_PLINKO_RIGHT as PLINKO_RIGHT, COIN_PUSHER_PLINKO_TOP as PLINKO_TOP, COIN_PUSHER_SHELF_EDGE as SHELF_EDGE, COIN_PUSHER_SHELF_TOP as SHELF_TOP, COIN_PUSHER_WIDTH as WIDTH, type CoinPusherPeg } from '../coinPusherPhysics'

type LegacyRendererResources = {
  fallbackCanvasRef: Readonly<Ref<HTMLCanvasElement | null>>
  coins: PusherCoin[]
  particles: Particle[]
  floatingScores: FloatingScore[]
  avatarCache: Map<string, HTMLImageElement | null>
  settings: Readonly<Ref<CoinPusherSettings>>
  isGalacticTheme: Readonly<Ref<boolean>>
  effectiveScoreSlots: Readonly<Ref<number[]>>
  scoreMultiplier: Readonly<Ref<number>>
  pusherPower: Readonly<Ref<number>>
  sideGuardProgress: Readonly<Ref<number>>
  getPegs: () => CoinPusherPeg[]
  getPlinkoImage: () => HTMLImageElement | null
  getPlatformImage: () => HTMLImageElement | null
  getPusherY: () => number
}

export function createCoinPusherLegacyRenderer({ fallbackCanvasRef, coins, particles, floatingScores, avatarCache, settings, isGalacticTheme, effectiveScoreSlots, scoreMultiplier, pusherPower, sideGuardProgress, getPegs, getPlinkoImage, getPlatformImage, getPusherY }: LegacyRendererResources) {
  function drawLegacyScene(time: number) {
    const canvas = fallbackCanvasRef.value
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
  
    context.save()
    context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0)
    context.clearRect(0, 0, WIDTH, HEIGHT)
  
    drawBackdrop(context, time)
    drawMachine(context, time)
    drawPegs(context, time)
    drawPusher(context, time)
  
    const orderedCoins = [...coins].sort((left, right) => {
      const phaseOrder: Record<CoinPhase, number> = {
        plinko: 0,
        pusher: 1,
        settling: 2,
        shelf: 3,
        falling: 4,
      }
      return phaseOrder[left.phase] - phaseOrder[right.phase] || left.y - right.y
    })
    for (const coin of orderedCoins) drawCoin(context, coin)
  
    drawMachineForeground(context, time)
    drawParticles(context)
    drawFloatingScores(context)
    context.restore()
  }
  
  function drawBackdrop(context: CanvasRenderingContext2D, time: number) {
    const galactic = isGalacticTheme.value
    const background = context.createLinearGradient(0, 0, 0, HEIGHT)
    background.addColorStop(0, galactic ? '#02030b' : '#050818')
    background.addColorStop(0.46, galactic ? '#090518' : '#090b22')
    background.addColorStop(1, galactic ? '#010207' : '#03040d')
    context.fillStyle = background
    context.fillRect(0, 0, WIDTH, HEIGHT)
  
    const glow = context.createRadialGradient(WIDTH / 2, 370, 10, WIDTH / 2, 370, 430)
    glow.addColorStop(0, galactic ? 'rgba(88, 55, 174, 0.16)' : 'rgba(36, 211, 238, 0.19)')
    glow.addColorStop(0.46, galactic ? 'rgba(16, 151, 211, 0.07)' : 'rgba(109, 40, 217, 0.1)')
    glow.addColorStop(1, 'rgba(2, 6, 23, 0)')
    context.fillStyle = glow
    context.fillRect(0, 0, WIDTH, HEIGHT)
  
    context.save()
    context.globalAlpha = 0.22
    for (let index = 0; index < 38; index += 1) {
      const x = ((index * 137.5) % WIDTH + Math.sin(time * 0.25 + index) * 6)
      const y = ((index * 83.2 + time * (4 + index % 3)) % HEIGHT)
      context.fillStyle = galactic
        ? index % 5 === 0 ? '#f2cf7a' : index % 2 ? '#74dcff' : '#bd7cff'
        : index % 4 === 0 ? '#f8d776' : '#72e8ff'
      context.beginPath()
      context.arc(x, y, index % 5 === 0 ? 1.7 : 0.8, 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
  
    context.save()
    context.translate(WIDTH / 2, 520)
    context.rotate(-0.09)
    const beam = context.createLinearGradient(-280, 0, 280, 0)
    beam.addColorStop(0, 'rgba(34,211,238,0)')
    beam.addColorStop(0.5, `rgba(34,211,238,${0.025 + Math.sin(time * 0.8) * 0.012})`)
    beam.addColorStop(1, 'rgba(34,211,238,0)')
    context.fillStyle = beam
    context.fillRect(-310, -410, 620, 820)
    context.restore()
  }
  
  function drawMachine(context: CanvasRenderingContext2D, time: number) {
    context.save()
    roundedRect(context, 23, 104, 494, 830, 28)
    const frame = context.createLinearGradient(0, 104, WIDTH, 934)
    frame.addColorStop(0, '#b98228')
    frame.addColorStop(0.08, '#17213a')
    frame.addColorStop(0.5, '#060a16')
    frame.addColorStop(0.91, '#25304e')
    frame.addColorStop(1, '#d7a33d')
    context.fillStyle = frame
    context.shadowColor = 'rgba(63, 212, 255, 0.34)'
    context.shadowBlur = 26
    context.fill()
    context.shadowBlur = 0
  
    roundedRect(context, 37, 120, 466, 798, 21)
    context.fillStyle = '#060914'
    context.fill()
    context.strokeStyle = 'rgba(125, 211, 252, 0.32)'
    context.lineWidth = 1.5
    context.stroke()
  
    const board = context.createLinearGradient(0, PLINKO_TOP, 0, PLINKO_BOTTOM)
    board.addColorStop(0, '#080d20')
    board.addColorStop(1, '#101025')
    context.fillStyle = board
    context.fillRect(PLINKO_LEFT, PLINKO_TOP - 16, PLINKO_RIGHT - PLINKO_LEFT, PLINKO_BOTTOM - PLINKO_TOP + 32)
    const plinkoImage = getPlinkoImage()
    if (plinkoImage?.complete && plinkoImage.naturalWidth > 0) {
      context.save()
      context.beginPath()
      context.rect(
        PLINKO_LEFT,
        PLINKO_TOP - 16,
        PLINKO_RIGHT - PLINKO_LEFT,
        PLINKO_BOTTOM - PLINKO_TOP + 32,
      )
      context.clip()
      context.globalAlpha = 0.78
      drawImageCover(
        context,
        plinkoImage,
        PLINKO_LEFT,
        PLINKO_TOP - 16,
        PLINKO_RIGHT - PLINKO_LEFT,
        PLINKO_BOTTOM - PLINKO_TOP + 32,
      )
      context.fillStyle = 'rgba(2, 6, 23, 0.3)'
      context.fillRect(
        PLINKO_LEFT,
        PLINKO_TOP - 16,
        PLINKO_RIGHT - PLINKO_LEFT,
        PLINKO_BOTTOM - PLINKO_TOP + 32,
      )
      context.restore()
    }
  
    context.save()
    context.beginPath()
    context.moveTo(PLINKO_LEFT, SHELF_TOP)
    context.lineTo(PLINKO_RIGHT, SHELF_TOP)
    context.lineTo(PLINKO_RIGHT - 12, SHELF_EDGE)
    context.lineTo(PLINKO_LEFT + 12, SHELF_EDGE)
    context.closePath()
    context.clip()
  
    const platformImage = getPlatformImage()
    if (platformImage?.complete && platformImage.naturalWidth > 0) {
      context.globalAlpha = 0.88
      drawImageCover(
        context,
        platformImage,
        PLINKO_LEFT,
        SHELF_TOP,
        PLINKO_RIGHT - PLINKO_LEFT,
        SHELF_EDGE - SHELF_TOP,
      )
    } else {
      const shelf = context.createLinearGradient(0, SHELF_TOP, 0, SHELF_EDGE)
      shelf.addColorStop(0, '#13223a')
      shelf.addColorStop(1, '#07101e')
      context.fillStyle = shelf
      context.fillRect(PLINKO_LEFT, SHELF_TOP, PLINKO_RIGHT - PLINKO_LEFT, SHELF_EDGE - SHELF_TOP)
    }
  
    const shelfShade = context.createLinearGradient(0, SHELF_TOP, 0, SHELF_EDGE)
    shelfShade.addColorStop(0, 'rgba(2, 6, 23, 0.08)')
    shelfShade.addColorStop(0.66, 'rgba(2, 6, 23, 0.05)')
    shelfShade.addColorStop(1, 'rgba(0, 0, 0, 0.48)')
    context.fillStyle = shelfShade
    context.fillRect(PLINKO_LEFT, SHELF_TOP, PLINKO_RIGHT - PLINKO_LEFT, SHELF_EDGE - SHELF_TOP)
  
    context.globalAlpha = 0.12
    context.strokeStyle = '#5ee9ff'
    context.lineWidth = 1
    for (let y = SHELF_TOP + 20; y < SHELF_EDGE; y += 31) {
      context.beginPath()
      context.moveTo(PLINKO_LEFT, y)
      context.lineTo(PLINKO_RIGHT, y)
      context.stroke()
    }
    context.restore()
  
    context.fillStyle = '#02040a'
    context.fillRect(PLINKO_LEFT + 10, SHELF_EDGE, PLINKO_RIGHT - PLINKO_LEFT - 20, SCORE_TOP - SHELF_EDGE)
    const voidGlow = context.createLinearGradient(0, SHELF_EDGE, 0, SCORE_TOP)
    voidGlow.addColorStop(0, 'rgba(0,0,0,0.92)')
    voidGlow.addColorStop(1, 'rgba(124,58,237,0.18)')
    context.fillStyle = voidGlow
    context.fillRect(PLINKO_LEFT + 10, SHELF_EDGE, PLINKO_RIGHT - PLINKO_LEFT - 20, SCORE_TOP - SHELF_EDGE)
  
    drawScoreSlots(context, time)
    if (isGalacticTheme.value) drawGalacticFallbackOrnaments(context, time)
    context.restore()
  }
  
  function drawGalacticFallbackOrnaments(
    context: CanvasRenderingContext2D,
    time: number,
  ) {
    context.save()
  
    const header = context.createLinearGradient(80, 0, WIDTH - 80, 0)
    header.addColorStop(0, 'rgba(3,4,11,0)')
    header.addColorStop(0.18, 'rgba(14,12,27,0.96)')
    header.addColorStop(0.5, 'rgba(4,5,13,0.98)')
    header.addColorStop(0.82, 'rgba(14,12,27,0.96)')
    header.addColorStop(1, 'rgba(3,4,11,0)')
    context.fillStyle = header
    context.fillRect(76, 105, WIDTH - 152, 58)
  
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = '#d9ad52'
    context.lineWidth = 6
    context.beginPath()
    context.moveTo(106, 111)
    context.lineTo(187, 130)
    context.lineTo(230, 116)
    context.moveTo(WIDTH - 106, 111)
    context.lineTo(WIDTH - 187, 130)
    context.lineTo(WIDTH - 230, 116)
    context.stroke()
  
    context.strokeStyle = 'rgba(74, 220, 255, 0.82)'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(116, 118)
    context.lineTo(187, 136)
    context.lineTo(229, 123)
    context.stroke()
    context.strokeStyle = 'rgba(184, 83, 255, 0.82)'
    context.beginPath()
    context.moveTo(WIDTH - 116, 118)
    context.lineTo(WIDTH - 187, 136)
    context.lineTo(WIDTH - 229, 123)
    context.stroke()
  
    const pulse = 0.82 + Math.sin(time * 2.2) * 0.08
    context.translate(WIDTH / 2, 126)
    context.shadowColor = '#a855f7'
    context.shadowBlur = 18 * pulse
    context.fillStyle = '#12091f'
    context.strokeStyle = '#e4b95f'
    context.lineWidth = 5
    context.beginPath()
    context.moveTo(0, -31)
    context.lineTo(27, -4)
    context.lineTo(18, 25)
    context.lineTo(0, 36)
    context.lineTo(-18, 25)
    context.lineTo(-27, -4)
    context.closePath()
    context.fill()
    context.stroke()
  
    const gem = context.createLinearGradient(-13, -17, 14, 19)
    gem.addColorStop(0, '#f3d8ff')
    gem.addColorStop(0.28, '#c66cff')
    gem.addColorStop(0.68, '#7131c9')
    gem.addColorStop(1, '#32105f')
    context.fillStyle = gem
    context.strokeStyle = '#fff0bc'
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(0, -20)
    context.lineTo(14, -2)
    context.lineTo(0, 22)
    context.lineTo(-14, -2)
    context.closePath()
    context.fill()
    context.stroke()
    context.restore()
  
    context.save()
    context.strokeStyle = 'rgba(242, 198, 95, 0.9)'
    context.lineWidth = 4
    for (const side of [-1, 1]) {
      const x = side < 0 ? 62 : WIDTH - 62
      context.beginPath()
      context.moveTo(x - side * 9, 287)
      context.lineTo(x + side * 4, 301)
      context.lineTo(x - side * 9, 315)
      context.stroke()
    }
    context.restore()
  }
  
  function drawScoreSlots(context: CanvasRenderingContext2D, time: number) {
    const slots = effectiveScoreSlots.value
    const width = (PLINKO_RIGHT - PLINKO_LEFT) / slots.length
    for (let index = 0; index < slots.length; index += 1) {
      const x = PLINKO_LEFT + index * width
      const value = Number(slots[index]) || 0
      const color = scoreSlotColor(value, index)
  
      context.save()
      context.beginPath()
      context.moveTo(x + 2, SCORE_TOP)
      context.lineTo(x + width - 2, SCORE_TOP)
      context.lineTo(x + width - 7, SCORE_BOTTOM)
      context.lineTo(x + 7, SCORE_BOTTOM)
      context.closePath()
      context.fillStyle = 'rgba(2, 4, 10, 0.96)'
      context.shadowColor = color
      context.shadowBlur = 9 + Math.sin(time * 2.2 + index) * 2
      context.fill()
      context.shadowBlur = 0
      context.strokeStyle = 'rgba(255, 255, 255, 0.82)'
      context.lineWidth = 2
      context.stroke()
  
      const slotGlow = context.createLinearGradient(0, SCORE_TOP, 0, SCORE_BOTTOM)
      slotGlow.addColorStop(0, colorWithAlpha(color, 0.08))
      slotGlow.addColorStop(0.58, colorWithAlpha(color, 0.14))
      slotGlow.addColorStop(1, colorWithAlpha(color, 0.3))
      context.fillStyle = slotGlow
      context.fill()
  
      context.fillStyle = '#f8fafc'
      context.font = `950 ${slots.length >= 12 ? 18 : slots.length >= 9 ? 21 : 25}px Inter, system-ui, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.lineJoin = 'round'
      context.strokeStyle = 'rgba(0, 0, 0, 0.96)'
      context.lineWidth = slots.length >= 12 ? 4 : 5
      context.shadowColor = color
      context.shadowBlur = 12
      const displayedValue = Math.round(value * scoreMultiplier.value)
      const scoreText = `${displayedValue > 0 ? '+' : ''}${displayedValue}`
      context.strokeText(scoreText, x + width / 2, SCORE_TOP + 34)
      context.fillText(scoreText, x + width / 2, SCORE_TOP + 34)
      context.restore()
    }
  }
  
  function drawPegs(context: CanvasRenderingContext2D, time: number) {
    context.save()
    for (const peg of getPegs()) {
      const pulse = 0.7 + Math.sin(time * 2 + peg.x * 0.03) * 0.14
      context.shadowColor = isGalacticTheme.value
        ? '#e8bb61'
        : peg.row % 2 ? '#8b5cf6' : '#22d3ee'
      context.shadowBlur = 10 * pulse
      const metal = context.createRadialGradient(peg.x - 2, peg.y - 2, 1, peg.x, peg.y, 7)
      metal.addColorStop(0, '#fff8d9')
      metal.addColorStop(0.32, '#d9b35b')
      metal.addColorStop(0.72, '#5b421d')
      metal.addColorStop(1, '#15101b')
      context.fillStyle = metal
      context.beginPath()
      context.arc(peg.x, peg.y, 5.7, 0, Math.PI * 2)
      context.fill()
      context.shadowBlur = 0
      context.strokeStyle = 'rgba(255,255,255,0.28)'
      context.lineWidth = 0.8
      context.stroke()
    }
    context.restore()
  }
  
  function drawPusher(context: CanvasRenderingContext2D, time: number) {
    context.save()
    const y = getPusherY()
    const strength = pusherPower.value
    context.shadowColor = strength > 0.1 ? '#22d3ee' : '#7c3aed'
    context.shadowBlur = 10 + strength * 18
  
    const sideInset = 44 + Math.max(0, y - SHELF_TOP) * 0.035
    const pusherWidth = WIDTH - sideInset * 2
    const bar = context.createLinearGradient(0, y, 0, y + 36)
    bar.addColorStop(0, '#f0c977')
    bar.addColorStop(0.12, '#24324e')
    bar.addColorStop(0.55, '#0c1220')
    bar.addColorStop(0.88, '#273453')
    bar.addColorStop(1, '#d3a44b')
    roundedRect(context, sideInset, y, pusherWidth, 34, 9)
    context.fillStyle = bar
    context.fill()
    context.shadowBlur = 0
    context.strokeStyle = `rgba(103,232,249,${0.42 + strength * 0.42})`
    context.lineWidth = 1.5
    context.stroke()
  
    const light = context.createLinearGradient(sideInset, 0, sideInset + pusherWidth, 0)
    light.addColorStop(0, 'rgba(34,211,238,0)')
    light.addColorStop(0.18, '#22d3ee')
    light.addColorStop(0.5, '#f8d776')
    light.addColorStop(0.82, '#a855f7')
    light.addColorStop(1, 'rgba(168,85,247,0)')
    context.fillStyle = light
    context.globalAlpha = 0.56 + Math.sin(time * 4) * 0.1
    roundedRect(context, sideInset + 12, y + 7, pusherWidth - 24, 3, 2)
    context.fill()
    context.restore()
  }
  
  function drawCoin(context: CanvasRenderingContext2D, coin: PusherCoin) {
    const deckCoin = coin.phase === 'pusher' || coin.phase === 'settling' || coin.phase === 'shelf'
    const shelfDepth = deckCoin
      ? Math.max(0, Math.min(1, (coin.y - SHELF_TOP) / (SHELF_EDGE - SHELF_TOP)))
      : 0
    const perspective = deckCoin ? 0.87 + shelfDepth * 0.18 : 1
    const radius = coin.radius * perspective
    const faceScale = coin.phase === 'falling'
      ? 0.24 + Math.abs(Math.cos(coin.faceAngle)) * 0.76
      : deckCoin
        ? 0.64 + Math.abs(Math.cos(coin.faceAngle)) * 0.16
        : 0.78 + Math.abs(Math.cos(coin.faceAngle)) * 0.22
    const settlingLift = coin.phase === 'pusher'
      ? -5
      : coin.phase === 'settling'
        ? -5 * (1 - coin.dropProgress * coin.dropProgress)
        : 0
    const stackLift = deckCoin ? coin.stackHeight * 4.2 : 0
  
    context.save()
    context.translate(coin.x, coin.y + settlingLift - stackLift)
    context.rotate(coin.rotation * 0.16)
  
    context.save()
    context.scale(1, 0.36)
    context.fillStyle = coin.phase === 'falling' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.48)'
    context.shadowColor = 'rgba(0,0,0,0.62)'
    context.shadowBlur = 9
    context.beginPath()
    context.ellipse(2, radius * 1.55, radius * 0.92, radius * 0.52, 0, 0, Math.PI * 2)
    context.fill()
    context.restore()
  
    if (coin.kind === 'mystery') {
      context.scale(1, Math.max(0.56, faceScale))
      const size = radius * 1.52
      const cube = context.createLinearGradient(-size, -size, size, size)
      cube.addColorStop(0, '#f5e8ff')
      cube.addColorStop(0.25, '#d06cff')
      cube.addColorStop(0.68, '#7132c7')
      cube.addColorStop(1, '#29104d')
      roundedRect(context, -size / 2, -size / 2, size, size, radius * 0.28)
      context.fillStyle = cube
      context.shadowColor = '#c084fc'
      context.shadowBlur = 18
      context.fill()
      context.shadowBlur = 0
      context.strokeStyle = '#ffe8a3'
      context.lineWidth = Math.max(1.4, radius * 0.12)
      context.stroke()
      context.fillStyle = '#fff8db'
      context.font = `950 ${Math.max(11, radius * 1.05)}px Inter, system-ui, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText('?', 0, 1)
      context.restore()
      return
    }
  
    if (coin.kind === 'ticket') {
      context.scale(1, Math.max(0.48, faceScale))
      const ticketWidth = radius * 1.82
      const ticketHeight = radius * 1.18
      const ticket = context.createLinearGradient(-ticketWidth, 0, ticketWidth, 0)
      ticket.addColorStop(0, '#0e7490')
      ticket.addColorStop(0.5, '#67e8f9')
      ticket.addColorStop(1, '#7c3aed')
      roundedRect(
        context,
        -ticketWidth / 2,
        -ticketHeight / 2,
        ticketWidth,
        ticketHeight,
        radius * 0.2,
      )
      context.fillStyle = ticket
      context.shadowColor = '#67e8f9'
      context.shadowBlur = 14
      context.fill()
      context.shadowBlur = 0
      context.strokeStyle = '#fff3b0'
      context.lineWidth = Math.max(1.2, radius * 0.1)
      context.stroke()
      context.fillStyle = '#07111e'
      context.font = `950 ${Math.max(6, radius * 0.48)}px Inter, system-ui, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(`+${coin.specialValue}`, 0, 0)
      context.restore()
      return
    }
  
    context.scale(1, faceScale)
    const rim = context.createRadialGradient(-radius * 0.35, -radius * 0.42, radius * 0.1, 0, 0, radius)
    rim.addColorStop(0, '#fff7c5')
    rim.addColorStop(0.24, '#f6c95b')
    rim.addColorStop(0.7, '#a76410')
    rim.addColorStop(1, '#4c2506')
    context.fillStyle = rim
    context.shadowColor = '#fbbf24'
    context.shadowBlur = coin.phase === 'falling' ? 16 : 7
    context.beginPath()
    context.arc(0, 0, radius, 0, Math.PI * 2)
    context.fill()
    context.shadowBlur = 0
  
    context.fillStyle = '#08101d'
    context.beginPath()
    context.arc(0, 0, radius * 0.76, 0, Math.PI * 2)
    context.fill()
  
    if (isGalacticTheme.value) {
      const enamel = context.createLinearGradient(-radius, -radius, radius, radius)
      enamel.addColorStop(0, viewerColor(coin.viewerId, 0))
      enamel.addColorStop(1, viewerColor(coin.viewerId, 1))
      context.strokeStyle = enamel
      context.lineWidth = Math.max(1.6, radius * 0.13)
      context.beginPath()
      context.arc(0, 0, radius * 0.77, 0, Math.PI * 2)
      context.stroke()
    }
  
    const avatar = coin.avatarUrl ? avatarCache.get(coin.avatarUrl) : null
    context.save()
    context.beginPath()
    context.arc(0, 0, radius * 0.68, 0, Math.PI * 2)
    context.clip()
    if (avatar?.complete && avatar.naturalWidth > 0) {
      drawImageCover(context, avatar, -radius * 0.68, -radius * 0.68, radius * 1.36, radius * 1.36)
    } else {
      const fallback = context.createLinearGradient(-radius, -radius, radius, radius)
      fallback.addColorStop(0, viewerColor(coin.viewerId, 0))
      fallback.addColorStop(1, viewerColor(coin.viewerId, 1))
      context.fillStyle = fallback
      context.fillRect(-radius, -radius, radius * 2, radius * 2)
      context.fillStyle = '#ffffff'
      context.font = `900 ${Math.max(8, radius * 0.7)}px Inter, system-ui, sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(initials(coin.name), 0, 1)
    }
    context.restore()
  
    context.strokeStyle = 'rgba(255,255,255,0.72)'
    context.lineWidth = Math.max(1, radius * 0.07)
    context.beginPath()
    context.arc(0, 0, radius * 0.73, 0, Math.PI * 2)
    context.stroke()
  
    context.strokeStyle = 'rgba(80,38,4,0.65)'
    context.lineWidth = Math.max(1, radius * 0.055)
    context.setLineDash([2.1, 2.5])
    context.beginPath()
    context.arc(0, 0, radius * 0.9, 0, Math.PI * 2)
    context.stroke()
    context.setLineDash([])
    context.restore()
  }
  
  function drawMachineForeground(context: CanvasRenderingContext2D, time: number) {
    context.save()
    const railGradient = context.createLinearGradient(0, 0, WIDTH, 0)
    railGradient.addColorStop(0, '#f1c15b')
    railGradient.addColorStop(0.08, '#15213a')
    railGradient.addColorStop(0.92, '#15213a')
    railGradient.addColorStop(1, '#f1c15b')
    context.strokeStyle = railGradient
    context.lineWidth = 9
    context.beginPath()
    context.moveTo(43, 134)
    context.lineTo(43, 914)
    context.moveTo(497, 134)
    context.lineTo(497, 914)
    context.stroke()
  
    context.strokeStyle = `rgba(103,232,249,${0.38 + Math.sin(time * 2.4) * 0.09})`
    context.lineWidth = 2
    context.beginPath()
    context.moveTo(48, 143)
    context.lineTo(48, 904)
    context.moveTo(492, 143)
    context.lineTo(492, 904)
    context.stroke()
  
    context.fillStyle = '#f8d776'
    context.shadowColor = '#fbbf24'
    context.shadowBlur = 12
    context.beginPath()
    context.moveTo(54, SHELF_EDGE - 3)
    context.lineTo(486, SHELF_EDGE - 3)
    context.lineTo(479, SHELF_EDGE + 7)
    context.lineTo(61, SHELF_EDGE + 7)
    context.closePath()
    context.fill()
    context.shadowBlur = 0
  
    drawSideGuards(context, time)
  
    context.fillStyle = 'rgba(255,255,255,0.045)'
    context.beginPath()
    context.moveTo(53, 136)
    context.lineTo(165, 136)
    context.lineTo(82, 716)
    context.lineTo(53, 716)
    context.closePath()
    context.fill()
    context.restore()
  }
  
  function drawSideGuards(context: CanvasRenderingContext2D, time: number) {
    const progress = Math.max(0, Math.min(1, sideGuardProgress.value))
    if (progress <= 0.002) return
    context.save()
    context.globalAlpha = 0.35 + progress * 0.65
    context.lineCap = 'round'
    context.lineWidth = 6 + progress * 3
    context.shadowColor = '#67e8f9'
    context.shadowBlur = 9 + progress * 14
    const rail = context.createLinearGradient(0, SHELF_TOP, 0, SHELF_EDGE)
    rail.addColorStop(0, '#f8d776')
    rail.addColorStop(0.35, '#67e8f9')
    rail.addColorStop(1, '#a855f7')
    context.strokeStyle = rail
    const retract = (1 - progress) * 52
    for (const side of [-1, 1]) {
      const rearX = side < 0 ? PUSHER_TRAY_LEFT : PUSHER_TRAY_RIGHT
      const frontX = side < 0 ? 61 : WIDTH - 61
      context.beginPath()
      context.moveTo(rearX, SHELF_TOP + retract)
      context.lineTo(frontX, SHELF_EDGE - 4 + retract)
      context.stroke()
    }
    context.globalAlpha *= 0.42 + Math.sin(time * 3.2) * 0.08
    context.lineWidth = 2
    context.strokeStyle = '#ffffff'
    for (const side of [-1, 1]) {
      const rearX = side < 0 ? PUSHER_TRAY_LEFT : PUSHER_TRAY_RIGHT
      const frontX = side < 0 ? 61 : WIDTH - 61
      context.beginPath()
      context.moveTo(rearX, SHELF_TOP + retract)
      context.lineTo(frontX, SHELF_EDGE - 4 + retract)
      context.stroke()
    }
    context.restore()
  }
  
  function drawParticles(context: CanvasRenderingContext2D) {
    context.save()
    for (const particle of particles) {
      const alpha = Math.max(0, particle.life / particle.maxLife)
      context.globalAlpha = alpha
      context.fillStyle = particle.color
      context.shadowColor = particle.color
      context.shadowBlur = 7
      context.beginPath()
      context.arc(particle.x, particle.y, particle.radius * Math.max(0.35, alpha), 0, Math.PI * 2)
      context.fill()
    }
    context.restore()
  }
  
  function drawFloatingScores(context: CanvasRenderingContext2D) {
    context.save()
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '950 30px Inter, system-ui, sans-serif'
    for (const score of floatingScores) {
      const alpha = Math.max(0, Math.min(1, score.life * 1.5))
      context.globalAlpha = alpha
      context.fillStyle = score.color
      context.shadowColor = score.color
      context.shadowBlur = 18
      context.fillText(score.text, score.x, score.y)
    }
    context.restore()
  }
  
  function drawImageCover(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const sourceRatio = image.naturalWidth / image.naturalHeight
    const targetRatio = width / height
    let sourceWidth = image.naturalWidth
    let sourceHeight = image.naturalHeight
    let sourceX = 0
    let sourceY = 0
    if (sourceRatio > targetRatio) {
      sourceWidth = image.naturalHeight * targetRatio
      sourceX = (image.naturalWidth - sourceWidth) / 2
    } else {
      sourceHeight = image.naturalWidth / targetRatio
      sourceY = (image.naturalHeight - sourceHeight) / 2
    }
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height)
  }
  
  function roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    context.beginPath()
    context.roundRect(x, y, width, height, radius)
  }
  
  function colorWithAlpha(color: string, alpha: number) {
    const value = color.trim()
    if (/^#[0-9a-f]{6}$/i.test(value)) {
      const red = Number.parseInt(value.slice(1, 3), 16)
      const green = Number.parseInt(value.slice(3, 5), 16)
      const blue = Number.parseInt(value.slice(5, 7), 16)
      return `rgba(${red},${green},${blue},${alpha})`
    }
    return value
  }

  return { drawLegacyScene }
}
