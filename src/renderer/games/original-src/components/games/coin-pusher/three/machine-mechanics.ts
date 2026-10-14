import * as THREE from 'three'
import type { CoinPusher3dCoin } from './types'
import { PUSHER_GAP_REAR_ANCHOR_Z, PUSHER_DECK_REAR_LOCAL_Z, PUSHER_GAP_FRONT_OVERLAP } from './constants'
import { addRoundedBox } from './geometry'
import type { MachineMaterials } from './machine-materials'

/** Lame mobile et protections latérales, avec conservation des coordonnées physiques et animations. */
export class MachineMechanics {
  private readonly pusherGapSurface: THREE.Mesh
  private readonly pusherGapTrim: THREE.Mesh
  private readonly sideGuardRoot = new THREE.Group()
  private sideGuardVisualProgress = 1
  private machineTheme: 'arcade' | 'galactic-palace' = 'arcade'
  constructor(private readonly options: { root: THREE.Group; materials: MachineMaterials }) {
    this.pusherGapSurface = this.buildPusherGapSurface()
    this.pusherGapTrim = this.buildPusherGapTrim()
    this.buildSideGuards()
  }
  /** Actualise le raccord de plateau et les protections selon la progression du jeu. */
  update(pusherWorldZ: number, progress: number | undefined, sideLossEnabled: boolean | undefined, coins: readonly CoinPusher3dCoin[], time: number, theme: 'arcade' | 'galactic-palace') {
    this.machineTheme = theme
    this.updatePusherGap(pusherWorldZ)
    this.updateSideGuards(progress, sideLossEnabled, coins, time)
  }
  private buildPusherGapSurface() {
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(6.04, 0.05, 1),
      this.options.materials.pusherGapSurfaceMaterial,
    )
    surface.position.set(0, 2.965, PUSHER_GAP_REAR_ANCHOR_Z)
    surface.scale.z = 0.001
    surface.receiveShadow = true
    surface.visible = false
    this.options.root.add(surface)
    return surface
  }
  private buildPusherGapTrim() {
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(6.12, 0.055, 0.055),
      this.options.materials.goldMaterial,
    )
    trim.position.set(0, 2.974, PUSHER_GAP_REAR_ANCHOR_Z)
    trim.castShadow = true
    trim.receiveShadow = true
    trim.visible = false
    this.options.root.add(trim)
    return trim
  }
  private updatePusherGap(pusherWorldZ: number) {
    const movingDeckRearZ = pusherWorldZ + PUSHER_DECK_REAR_LOCAL_Z
    const exposedDepth = Math.max(0, movingDeckRearZ - PUSHER_GAP_REAR_ANCHOR_Z)
    const visible = exposedDepth > 0.006
    this.pusherGapSurface.visible = visible
    this.pusherGapTrim.visible = visible
    if (!visible) return

    const coveredDepth = exposedDepth + PUSHER_GAP_FRONT_OVERLAP
    this.pusherGapSurface.position.z = PUSHER_GAP_REAR_ANCHOR_Z + coveredDepth / 2
    this.pusherGapSurface.scale.z = coveredDepth
    this.pusherGapTrim.position.z = movingDeckRearZ - PUSHER_GAP_FRONT_OVERLAP / 2
  }
  private buildSideGuards() {
    this.sideGuardRoot.name = 'coin-pusher-side-guards'
    for (const side of [-1, 1] as const) {
      const rail = addRoundedBox(
        this.sideGuardRoot,
        [0.19, 0.62, 5.74],
        [side * 3.27, 0, -0.02],
        this.options.materials.sideGuardFrameMaterial,
        0.065,
        true,
      )
      rail.castShadow = true
      const innerX = side * 3.16
      addRoundedBox(
        this.sideGuardRoot,
        [0.034, 0.12, 5.46],
        [innerX, 0.17, -0.03],
        this.options.materials.sideGuardGlowMaterial,
        0.012,
      )
      addRoundedBox(
        this.sideGuardRoot,
        [0.24, 0.15, 0.34],
        [side * 3.27, 0.26, -2.76],
        this.options.materials.goldMaterial,
        0.045,
        true,
      )
      addRoundedBox(
        this.sideGuardRoot,
        [0.24, 0.15, 0.34],
        [side * 3.27, 0.26, 2.72],
        this.options.materials.goldMaterial,
        0.045,
        true,
      )
      for (let segment = 0; segment < 5; segment += 1) {
        const marker = addRoundedBox(
          this.sideGuardRoot,
          [0.032, 0.16, 0.28],
          [innerX, -0.1, -2.12 + segment * 1.06],
          this.options.materials.sideGuardGlowMaterial,
          0.01,
        )
        marker.rotation.x = Math.PI / 4
      }
    }
    this.sideGuardRoot.position.y = 2.65
    this.sideGuardRoot.renderOrder = 8
    this.options.root.add(this.sideGuardRoot)
  }
  private updateSideGuards(
    rawProgress: number | undefined,
    sideLossEnabled: boolean | undefined,
    coins: readonly CoinPusher3dCoin[],
    time: number,
  ) {
    const requested = sideLossEnabled === false || sideLossEnabled === undefined
      ? 1
      : THREE.MathUtils.clamp(
          Number.isFinite(Number(rawProgress)) ? Number(rawProgress) : 1,
          0,
          1,
        )
    // The gameplay runtime owns the authoritative animation curve so visual
    // height and collision activation stay synchronized frame for frame.
    this.sideGuardVisualProgress = requested

    let maximumRadius = 12
    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index]
      if (coin.phase !== 'pusher' && coin.phase !== 'settling' && coin.phase !== 'shelf') {
        continue
      }
      maximumRadius = Math.max(maximumRadius, Number(coin.radius) || 0)
    }
    const heightScale = THREE.MathUtils.clamp(maximumRadius / 18, 1, 2.8)
    const guardHeight = 0.62 * heightScale
    const platformTop = 2.38
    this.sideGuardRoot.scale.y = heightScale
    this.sideGuardRoot.position.y = (
      platformTop
      + guardHeight / 2
      - (1 - this.sideGuardVisualProgress) * (guardHeight + 0.34)
    )
    this.sideGuardRoot.visible = this.sideGuardVisualProgress > 0.015
    this.options.materials.sideGuardGlowMaterial.emissiveIntensity = (
      (this.machineTheme === 'galactic-palace' ? 0.66 : 0.84)
      + Math.sin(time * 4.6) * 0.08
      + this.sideGuardVisualProgress * 0.16
    )
  }
}

