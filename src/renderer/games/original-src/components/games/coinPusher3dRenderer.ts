import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { CoinPusher3dRenderer, CoinPusher3dFrame } from './coin-pusher/three/types'
import { GOLD, CYAN, MAGENTA, ADAPTIVE_QUALITY_OVERLOAD_SECONDS, ADAPTIVE_QUALITY_MIN, ADAPTIVE_QUALITY_DOWN_COOLDOWN, ADAPTIVE_QUALITY_RECOVERY_SECONDS, ADAPTIVE_QUALITY_UP_COOLDOWN, VIOLET, GALACTIC_BLUE, GALACTIC_PURPLE } from './coin-pusher/three/constants'
import { disposeObject, createSoftPointTexture } from './coin-pusher/three/resources'
import { logicalShelfZ } from './coin-pusher/three/positions'
import { coinPusherAdaptiveQualityCeiling } from './coin-pusher/three/math'
import { CoinInstances } from './coin-pusher/three/coin-instances'
import { ColorCache } from './coin-pusher/three/color-cache'
import { FloatingScores } from './coin-pusher/three/floating-scores'
import { ScoreLanes } from './coin-pusher/three/score-lanes'
import { ParticleEffects } from './coin-pusher/three/particle-effects'
import { SurfaceTextures } from './coin-pusher/three/surface-textures'
import { MachineDecor } from './coin-pusher/three/machine-decor'
import { createMachineMaterials, type MachineMaterials } from './coin-pusher/three/machine-materials'

/** Façade publique du rendu : assemble les gestionnaires et préserve la cadence et l'ordre des frames. */
class SceneRenderer implements CoinPusher3dRenderer {
  private adaptiveQuality = 1
  private adaptiveRecoverySeconds = 0
  private adaptiveStressSeconds = 0
  private appliedPixelRatio = 0
  private basePixelRatio = 1
  private readonly bloomPass: UnrealBloomPass
  private readonly camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 80)
  private readonly cameraBase = new THREE.Vector3(-0.18, 6.55, 19.5)
  private readonly cameraTarget = new THREE.Vector3(-0.28, 4.12, -0.35)
  private readonly galacticCameraBase = new THREE.Vector3(-0.18, 13.9, 16.9)
  private readonly galacticCameraTarget = new THREE.Vector3(-0.28, 4, -0.34)
  private readonly canvas: HTMLCanvasElement
  private readonly composer: EffectComposer
  private readonly cyanLight: THREE.PointLight
  private readonly environmentTexture: THREE.Texture
  private readonly fxaaPass: FXAAPass
  private readonly keyLight: THREE.SpotLight
  private readonly machineRoot = new THREE.Group()
  private readonly magentaLight: THREE.PointLight
  private readonly pointTexture: THREE.CanvasTexture
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly starField: THREE.Points
  private disposed = false
  private frameIndex = 0
  private frameTimeEma = 1 / 60
  private giftImpulse = 0
  private lastFrameTime = 0
  private lost = false
  private machineTheme: 'arcade' | 'galactic-palace' = 'arcade'
  private nextAdaptiveQualityChangeAt = 0
  private shake = 0
  private shadowFrameInterval = 1
  private shadowRefreshPending = true
  private viewportHeight = 1
  private viewportWidth = 1
  private readonly handleContextLost = (event: Event) => {
    event.preventDefault()
    this.lost = true
  }
  private readonly handleContextRestored = () => {
    this.lost = false
    this.appliedPixelRatio = 0
    this.shadowRefreshPending = true
    this.resize()
  }
  private readonly colors = new ColorCache()
  private readonly floatingScores = new FloatingScores()
  private readonly coins: CoinInstances
  private readonly materials: MachineMaterials
  private readonly decor: MachineDecor
  private readonly scoreLanes: ScoreLanes
  private readonly surfaces: SurfaceTextures
  private readonly particles: ParticleEffects
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      canvas,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    // Keep enough headroom for the emissive accents. The previous exposure and
    // light stack clipped most of the machine to white as soon as a gift fired.
    this.renderer.toneMappingExposure = 0.76
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    // Dynamic objects still receive fresh shadows, but the cadence can be
    // reduced under extreme load without disabling premium lighting.
    this.renderer.shadowMap.autoUpdate = false
    this.renderer.shadowMap.needsUpdate = true

    this.scene.background = new THREE.Color(0x01030a)
    this.scene.fog = new THREE.FogExp2(0x030712, 0.032)
    this.scene.add(this.machineRoot)
    this.machineRoot.position.x = -0.3

    const room = new RoomEnvironment()
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.environmentTexture = pmrem.fromScene(room, 0.035).texture
    this.scene.environment = this.environmentTexture
    pmrem.dispose()
    disposeObject(room)
    this.coins = new CoinInstances({ root: this.machineRoot, colors: this.colors })
    this.materials = createMachineMaterials()
    this.pointTexture = createSoftPointTexture()
    this.scoreLanes = new ScoreLanes(this.materials.goldMaterial)
    this.decor = new MachineDecor({
      root: this.machineRoot, scoreGroup: this.scoreLanes.scoreGroup,
      materials: this.materials, pointTexture: this.pointTexture,
      onShadowRefresh: () => { this.shadowRefreshPending = true },
    })
    this.surfaces = new SurfaceTextures({
      renderer: this.renderer, getTheme: () => this.machineTheme,
      getPlinkoGeometry: () => this.decor.galacticPlinkoPanelGeometry,
      platformMaterial: this.materials.platformMaterial,
      movingDeckSurfaceMaterial: this.materials.movingDeckSurfaceMaterial,
      pusherGapSurfaceMaterial: this.materials.pusherGapSurfaceMaterial,
      plinkoMaterial: this.materials.plinkoMaterial,
      galacticPlinkoSurfaceMaterial: this.materials.galacticPlinkoSurfaceMaterial,
    })
    this.starField = this.buildStars()
    this.particles = new ParticleEffects({ root: this.machineRoot, pointTexture: this.pointTexture, colors: this.colors })
    this.machineRoot.add(this.floatingScores.floatingScoreGroup)
    this.keyLight = new THREE.SpotLight(0xffd18a, 115, 42, Math.PI / 5.8, 0.5, 2)
    this.keyLight.position.set(-4.8, 12, 9)
    this.keyLight.target.position.set(-0.2, 3.4, -0.4)
    this.keyLight.castShadow = true
    const requestedShadowSize = (window.devicePixelRatio || 1) >= 1.75 ? 2048 : 1536
    const shadowSize = Math.min(this.renderer.capabilities.maxTextureSize, requestedShadowSize)
    this.keyLight.shadow.mapSize.set(shadowSize, shadowSize)
    this.keyLight.shadow.bias = -0.0003
    this.scene.add(this.keyLight, this.keyLight.target)

    this.cyanLight = new THREE.PointLight(CYAN, 18, 17, 2)
    this.cyanLight.position.set(-4.4, 5.7, 4.8)
    this.magentaLight = new THREE.PointLight(MAGENTA, 14, 16, 2)
    this.magentaLight.position.set(4.3, 7.4, 1.8)
    this.scene.add(
      new THREE.HemisphereLight(0x8beaff, 0x080217, 0.38),
      new THREE.AmbientLight(0x7180ff, 0.1),
      this.cyanLight,
      this.magentaLight,
    )

    this.camera.position.copy(this.cameraBase)
    this.camera.lookAt(this.cameraTarget)

    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(540, 960), 0.2, 0.14, 1.18)
    this.composer.addPass(this.bloomPass)
    this.fxaaPass = new FXAAPass()
    this.composer.addPass(this.fxaaPass)
    this.composer.addPass(new OutputPass())
    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    this.resize()
  }
  /** Redimensionne les cibles de rendu dans la limite du budget de pixels. */
  resize() {
    if (this.disposed) return
    const bounds = this.canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(bounds.width || 540))
    const height = Math.max(1, Math.round(bounds.height || 960))
    const preferredRatio = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1))
    const budgetRatio = Math.sqrt(5_000_000 / Math.max(1, width * height))
    const basePixelRatio = Math.max(1, Math.min(preferredRatio, budgetRatio))
    const sizeChanged = width !== this.viewportWidth || height !== this.viewportHeight
    const ratioChanged = Math.abs(basePixelRatio - this.basePixelRatio) >= 0.01
    if (!sizeChanged && !ratioChanged && this.appliedPixelRatio > 0) return

    this.viewportWidth = width
    this.viewportHeight = height
    this.basePixelRatio = basePixelRatio
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.applyAdaptiveQuality(true)
  }
  /** Rend une frame de physique et actualise les ressources uniquement si nécessaire. */
  render(frame: CoinPusher3dFrame) {
    if (this.disposed) return
    if (this.lost) {
      throw new Error('[coin-pusher] WebGL context lost; switching to the compatibility renderer.')
    }

    const rawDelta = frame.time - this.lastFrameTime || 0.016
    const delta = Math.min(0.05, Math.max(0.001, rawDelta))
    this.lastFrameTime = frame.time
    this.frameIndex += 1
    this.applyMachineTheme(frame.machineTheme)
    this.updateAdaptiveQuality(
      rawDelta,
      frame.coins.length,
      frame.particles.length,
      frame.floatingScores.length,
      frame.time,
    )
    this.surfaces.sync(frame.platformImageUrl, frame.plinkoImageUrl || '')
    this.decor.ensurePegs(frame.pegs)
    this.scoreLanes.sync(frame.scoreSlots, frame.scoreMultiplier, this.machineTheme)
    this.coins.sync(frame.coins, this.machineTheme, frame.time, this.frameIndex)
    this.particles.sync(frame.particles)
    this.floatingScores.sync(frame.floatingScores, this.frameIndex)

    const pusherWorldZ = logicalShelfZ(frame.pusherY)
    this.decor.pusherGroup.position.z = pusherWorldZ
    this.decor.mechanics.update(pusherWorldZ, frame.sideGuardProgress, frame.sideLossEnabled, frame.coins, frame.time, this.machineTheme)
    this.materials.pusherGlowMaterial.emissiveIntensity = THREE.MathUtils.damp(
      this.materials.pusherGlowMaterial.emissiveIntensity,
      0.68 + frame.pusherPower * 0.2 + this.giftImpulse * 0.1,
      5,
      delta,
    )

    this.giftImpulse = Math.max(0, this.giftImpulse - delta * 1.35)
    this.shake = Math.max(0, this.shake - delta * 1.7)
    const pulse = (Math.sin(frame.time * 2.2) + 1) * 0.5
    const isGalactic = this.machineTheme === 'galactic-palace'
    this.cyanLight.intensity = isGalactic
      ? 7.5 + pulse * 2.4 + this.giftImpulse * 5
      : 18 + pulse * 7 + this.giftImpulse * 18
    this.magentaLight.intensity = isGalactic
      ? 5.8 + (1 - pulse) * 2 + this.giftImpulse * 4
      : 14 + (1 - pulse) * 6 + this.giftImpulse * 14
    this.keyLight.intensity = isGalactic
      ? 74 + frame.pusherPower * 14
      : 115 + frame.pusherPower * 25
    this.bloomPass.strength = Math.min(
      isGalactic ? 0.22 : 0.3,
      (isGalactic ? 0.125 : 0.18) + this.giftImpulse * (isGalactic ? 0.045 : 0.07),
    )

    const shakeX = Math.sin(frame.time * 61) * this.shake * 0.075
    const shakeY = Math.sin(frame.time * 47 + 1.7) * this.shake * 0.055
    const cameraBase = isGalactic ? this.galacticCameraBase : this.cameraBase
    const cameraTarget = isGalactic ? this.galacticCameraTarget : this.cameraTarget
    const cameraFov = THREE.MathUtils.damp(
      this.camera.fov,
      isGalactic ? 41.3 : 46,
      7.5,
      delta,
    )
    if (Math.abs(cameraFov - this.camera.fov) > 0.001) {
      this.camera.fov = cameraFov
      this.camera.updateProjectionMatrix()
    }
    this.camera.position.set(
      cameraBase.x + shakeX,
      cameraBase.y + shakeY + Math.sin(frame.time * 0.23) * 0.025,
      cameraBase.z + Math.cos(frame.time * 0.19) * 0.035,
    )
    this.camera.lookAt(cameraTarget)
    this.machineRoot.rotation.y = isGalactic ? 0 : Math.sin(frame.time * 0.16) * 0.006
    this.starField.rotation.z = frame.time * 0.004
    this.starField.rotation.y = Math.sin(frame.time * 0.05) * 0.02
    this.decor.animate(frame.time, delta, this.giftImpulse, this.cyanLight, this.magentaLight)
    this.scoreLanes.update(delta)

    if (frame.roundPhase === 'finished') {
      this.bloomPass.strength = Math.min(
        isGalactic ? 0.24 : 0.34,
        this.bloomPass.strength + 0.04 + Math.sin(frame.time * 5) * 0.01,
      )
    }

    this.renderer.shadowMap.needsUpdate = this.shadowRefreshPending
      || this.frameIndex % this.shadowFrameInterval === 0
    this.shadowRefreshPending = false
    this.composer.render(delta)
  }
  /** Déclenche le flash et la secousse de cadeau. */
  giftBurst(coinCount: number) {
    const normalized = THREE.MathUtils.clamp(Math.sqrt(Math.max(1, coinCount)) / 9, 0.2, 1)
    this.giftImpulse = Math.max(this.giftImpulse, 0.45 + normalized * 0.8)
    this.shake = Math.max(this.shake, normalized * 0.65)
  }
  /** Déclenche le flash du couloir et conserve la secousse globale du score. */
  scoreBurst(logicalX: number, points: number) {
    this.scoreLanes.burst(logicalX, points)
    this.shake = Math.max(this.shake, points >= 20 ? 0.65 : 0.18)
  }
  private updateAdaptiveQuality(
    rawDelta: number,
    coinCount: number,
    particleCount: number,
    floatingScoreCount: number,
    now: number,
  ) {
    const ceiling = coinPusherAdaptiveQualityCeiling(
      coinCount,
      particleCount,
      floatingScoreCount,
    )
    // Shadow-map rendering is one of the most expensive stages with a dense
    // coin field. Keeping every second (or, only at the lowest tier, every
    // third) update is visually gradual because the camera itself barely moves.
    const nextShadowInterval = this.adaptiveQuality < 0.76
      ? 3
      : this.adaptiveQuality < 0.96 || ceiling < 1
        ? 2
        : 1
    if (nextShadowInterval !== this.shadowFrameInterval) {
      this.shadowFrameInterval = nextShadowInterval
      this.shadowRefreshPending = true
    }

    // Ignore tab switches, debugger pauses and clock resets. Counting them as
    // overload would permanently lower quality after returning to the game.
    if (
      !Number.isFinite(rawDelta)
      || rawDelta <= 0
      || rawDelta > 0.1
      || (typeof document !== 'undefined' && document.hidden)
    ) {
      this.adaptiveStressSeconds = Math.max(0, this.adaptiveStressSeconds - 0.05)
      this.adaptiveRecoverySeconds = 0
      return
    }

    const sample = THREE.MathUtils.clamp(rawDelta, 1 / 240, 0.075)
    const smoothing = 1 - Math.exp(-sample / 0.72)
    this.frameTimeEma += (sample - this.frameTimeEma) * smoothing

    const workloadPressure = this.adaptiveQuality > ceiling + 0.005
    const timingPressure = this.frameTimeEma > 0.0205
    const severeTimingPressure = this.frameTimeEma > 0.0275
    if (workloadPressure || timingPressure) {
      this.adaptiveStressSeconds += sample * (severeTimingPressure ? 1.7 : 1)
      this.adaptiveRecoverySeconds = 0
    } else {
      this.adaptiveStressSeconds = Math.max(0, this.adaptiveStressSeconds - sample * 0.8)
      if (this.frameTimeEma < 0.0168 && this.adaptiveQuality < ceiling - 0.005) {
        this.adaptiveRecoverySeconds += sample
      } else {
        this.adaptiveRecoverySeconds = Math.max(
          0,
          this.adaptiveRecoverySeconds - sample * 0.65,
        )
      }
    }

    if (!Number.isFinite(now) || now < this.nextAdaptiveQualityChangeAt) return

    if (this.adaptiveStressSeconds >= ADAPTIVE_QUALITY_OVERLOAD_SECONDS) {
      const step = severeTimingPressure ? 0.1 : 0.07
      const performanceFloor = Math.max(ADAPTIVE_QUALITY_MIN, this.adaptiveQuality - step)
      const nextQuality = workloadPressure
        ? Math.max(ceiling, performanceFloor)
        : performanceFloor
      this.setAdaptiveQuality(nextQuality)
      this.adaptiveStressSeconds = 0
      this.adaptiveRecoverySeconds = 0
      this.nextAdaptiveQualityChangeAt = now + ADAPTIVE_QUALITY_DOWN_COOLDOWN
      return
    }

    if (this.adaptiveRecoverySeconds >= ADAPTIVE_QUALITY_RECOVERY_SECONDS) {
      this.setAdaptiveQuality(Math.min(ceiling, this.adaptiveQuality + 0.05))
      this.adaptiveStressSeconds = 0
      this.adaptiveRecoverySeconds = 0
      this.nextAdaptiveQualityChangeAt = now + ADAPTIVE_QUALITY_UP_COOLDOWN
    }
  }
  private setAdaptiveQuality(value: number) {
    const next = Math.round(
      THREE.MathUtils.clamp(value, ADAPTIVE_QUALITY_MIN, 1) * 100,
    ) / 100
    if (Math.abs(next - this.adaptiveQuality) < 0.005) return
    this.adaptiveQuality = next
    this.applyAdaptiveQuality()
  }
  private applyAdaptiveQuality(force = false) {
    const requestedRatio = this.basePixelRatio * this.adaptiveQuality
    const pixelRatio = Math.round(
      THREE.MathUtils.clamp(requestedRatio, 0.75, this.basePixelRatio) * 20,
    ) / 20
    if (!force && Math.abs(pixelRatio - this.appliedPixelRatio) < 0.025) return

    this.appliedPixelRatio = pixelRatio
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(this.viewportWidth, this.viewportHeight, false)
    this.composer.setPixelRatio(pixelRatio)
    this.composer.setSize(this.viewportWidth, this.viewportHeight)
    this.shadowRefreshPending = true
  }
  /** Libère les gestionnaires avant le graphe GPU partagé et retire les événements du canvas. */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)
    this.surfaces.dispose()
    this.environmentTexture.dispose()
    this.coins.dispose()
    this.floatingScores.dispose()
    disposeObject(this.scene)
    for (const pass of this.composer.passes) pass.dispose?.()
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.colors.clear()
  }
  private applyMachineTheme(theme: string | undefined) {
    const nextTheme = String(theme || '').trim().toLowerCase() === 'galactic-palace'
      ? 'galactic-palace'
      : 'arcade'
    if (nextTheme === this.machineTheme) return

    this.machineTheme = nextTheme
    const isGalactic = nextTheme === 'galactic-palace'
    this.decor.classicDecorRoot.visible = !isGalactic
    this.decor.classicHeaderGroup.visible = !isGalactic
    this.decor.classicPegRoot.visible = !isGalactic
    this.decor.classicPlinkoBackShell.visible = !isGalactic
    this.decor.classicPlinkoInsetShell.visible = !isGalactic
    this.decor.classicPlinkoSurface.visible = !isGalactic
    this.decor.galacticThemeRoot.visible = isGalactic
    this.decor.galacticPusherThemeRoot.visible = isGalactic
    this.starField.visible = !isGalactic
    this.decor.setTheme(nextTheme)

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(isGalactic ? 0x010108 : 0x01030a)
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(isGalactic ? 0x080319 : 0x030712)
      this.scene.fog.density = isGalactic ? 0.027 : 0.032
    }
    this.renderer.toneMappingExposure = isGalactic ? 0.68 : 0.76
    this.materials.goldMaterial.color.setHex(isGalactic ? 0xe4b55a : GOLD)
    this.materials.goldMaterial.emissive.setHex(isGalactic ? 0x291300 : 0x6d3700)
    this.materials.goldMaterial.emissiveIntensity = isGalactic ? 0.025 : 0.08
    this.coins.bodyMaterial.color.setHex(isGalactic ? 0xe0ad49 : 0xf9cb62)
    this.coins.bodyMaterial.emissive.setHex(isGalactic ? 0x2b1400 : 0x5c3200)
    this.coins.bodyMaterial.emissiveIntensity = isGalactic ? 0.025 : 0.08
    this.materials.pusherGlowMaterial.color.setHex(isGalactic ? 0xcaf8ff : 0x9af7ff)
    this.materials.pusherGlowMaterial.emissive.setHex(isGalactic ? GALACTIC_BLUE : CYAN)
    this.materials.sideGuardFrameMaterial.color.setHex(isGalactic ? 0x090711 : 0x101a28)
    this.materials.sideGuardFrameMaterial.emissive.setHex(isGalactic ? 0x190920 : 0x06101e)
    this.materials.sideGuardFrameMaterial.emissiveIntensity = isGalactic ? 0.14 : 0.1
    this.materials.sideGuardGlowMaterial.color.setHex(isGalactic ? 0x53d9ff : 0x8cf7ff)
    this.materials.sideGuardGlowMaterial.emissive.setHex(isGalactic ? GALACTIC_PURPLE : CYAN)
    this.coins.mysteryMaterial.emissive.setHex(isGalactic ? 0x3f126f : 0x053e68)
    this.coins.ticketMaterial.emissive.setHex(isGalactic ? 0x3b124d : 0x07385c)
    this.cyanLight.color.setHex(isGalactic ? 0x2cbcff : CYAN)
    this.magentaLight.color.setHex(isGalactic ? 0xc34dff : MAGENTA)
    this.keyLight.color.setHex(isGalactic ? 0xffd99a : 0xffd18a)
    this.surfaces.applyThemeSurfaceColors()

    // Force only the cheap score-lane skin to be rebuilt. Coin instances,
    // avatar buckets, surface textures and all physics-driven poses survive.
    this.scoreLanes.invalidate()
    this.shadowRefreshPending = true
  }
  private buildStars() {
    const count = 260
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const cyan = new THREE.Color(CYAN)
    const violet = new THREE.Color(VIOLET)
    for (let index = 0; index < count; index += 1) {
      const offset = index * 3
      positions[offset] = (Math.random() - 0.5) * 19
      positions[offset + 1] = -2 + Math.random() * 16
      positions[offset + 2] = -8 - Math.random() * 4
      const color = index % 3 ? cyan : violet
      const strength = 0.25 + Math.random() * 0.75
      colors[offset] = color.r * strength
      colors[offset + 1] = color.g * strength
      colors[offset + 2] = color.b * strength
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({
      alphaTest: 0.006,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: this.pointTexture,
      opacity: 0.48,
      size: 0.055,
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true,
    })
    const stars = new THREE.Points(geometry, material)
    this.scene.add(stars)
    return stars
  }
}

/** Crée un renderer indépendant, propriétaire des ressources et événements de ce canvas. */
export function createCoinPusher3dRenderer(canvas: HTMLCanvasElement): CoinPusher3dRenderer {
  return new SceneRenderer(canvas)
}
export type { CoinPusher3dCoinPhase, CoinPusher3dCoin, CoinPusher3dPeg, CoinPusher3dParticle, CoinPusher3dFloatingScore, CoinPusher3dFrame, CoinPusher3dRenderer } from './coin-pusher/three/types'
export { nextCoinPusherInstanceCapacity, coinPusherCoinVerticalHalfExtent, coinPusherAdaptiveQualityCeiling, coinPusherAvatarSnapshotKey } from './coin-pusher/three/math'
