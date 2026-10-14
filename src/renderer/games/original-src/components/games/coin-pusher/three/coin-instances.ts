import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { AvatarAtlasEntry, CoinPose, CoinPusher3dCoin } from './types'
import { BODY_INITIAL_CAPACITY, SPECIAL_ITEM_INITIAL_CAPACITY, COIN_THICKNESS, GALACTIC_PLINKO_PLANE_QUATERNION, COIN_OBJECT_BOUND_RADIUS, MYSTERY_OBJECT_BOUND_RADIUS, TICKET_OBJECT_BOUND_RADIUS, MYSTERY_VISUAL_SCALE, TICKET_VISUAL_SCALE, GALACTIC_COIN_RIM_COLORS } from './constants'
import { hashText } from './resources'
import { createMysteryDieTexture, createPointTicketTexture } from './machine-textures'
import { setGalacticPlinkoPoint, setLogicalPoint, offsetGalacticPlinkoObject, plinkoObjectScale } from './positions'
import { nextCoinPusherInstanceCapacity, coinPusherAvatarSnapshotKey, coinPusherCoinVerticalHalfExtent, rotatedObjectVerticalHalfExtent } from './math'
import { AvatarAtlas } from './avatar-atlas'
import { ColorCache } from './color-cache'

/** Pièces et récompenses instanciées : capacités croissantes, poses lissées et atlas partagé. */
export class CoinInstances {
  private bodyCapacity = BODY_INITIAL_CAPACITY
  private readonly bodyGeometry: THREE.CylinderGeometry
  readonly bodyMaterial: THREE.MeshPhysicalMaterial
  private bodyMesh: THREE.InstancedMesh
  private readonly circleGeometry: THREE.CircleGeometry
  private readonly dummy = new THREE.Object3D()
  private readonly faceBackLocal = new THREE.Matrix4()
  private readonly faceFrontLocal = new THREE.Matrix4()
  private readonly faceMatrix = new THREE.Matrix4()
  private readonly galacticCoinRimColorCache = new Map<string, THREE.Color>()
  private readonly galacticCoinRimGeometry: THREE.BufferGeometry
  private readonly galacticCoinRimMaterial: THREE.MeshStandardMaterial
  private galacticCoinRimMesh: THREE.InstancedMesh
  private mysteryCapacity = SPECIAL_ITEM_INITIAL_CAPACITY
  private readonly mysteryGeometry: THREE.BufferGeometry
  readonly mysteryMaterial: THREE.MeshPhysicalMaterial
  private mysteryMesh: THREE.InstancedMesh
  private ticketCapacity = SPECIAL_ITEM_INITIAL_CAPACITY
  private readonly ticketGeometry: THREE.BufferGeometry
  readonly ticketMaterial: THREE.MeshPhysicalMaterial
  private ticketMesh: THREE.InstancedMesh
  private readonly poseByCoinId = new Map<string, CoinPose>()
  private readonly targetPosition = new THREE.Vector3()
  private readonly targetQuaternion = new THREE.Quaternion()
  private readonly targetEuler = new THREE.Euler()
  // Huit collections de travail réutilisées : pas de nouveau tableau/Map par frame.
  private readonly regularCoins: CoinPusher3dCoin[] = []
  private readonly mysteryItems: CoinPusher3dCoin[] = []
  private readonly tickets: CoinPusher3dCoin[] = []
  private readonly avatarKeys: string[] = []
  private readonly avatarRepresentatives = new Map<string, CoinPusher3dCoin>()
  private readonly avatarEntriesByKey = new Map<string, AvatarAtlasEntry>()
  private readonly avatarEntries: AvatarAtlasEntry[] = []
  private readonly pageRequirements = new Map<number, number>()
  private readonly atlas: AvatarAtlas
  private machineTheme: 'arcade' | 'galactic-palace' = 'arcade'
  private frameIndex = 0
  private lastFrameTime = 0
  constructor(private readonly options: { root: THREE.Group; colors: ColorCache }) {
    this.bodyGeometry = new THREE.CylinderGeometry(1, 1, COIN_THICKNESS, 48, 1, false)
    this.bodyGeometry.rotateX(Math.PI / 2)
    this.circleGeometry = new THREE.CircleGeometry(0.84, 48)
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      color: 0xf9cb62,
      emissive: 0x5c3200,
      emissiveIntensity: 0.08,
      envMapIntensity: 0.9,
      metalness: 1,
      roughness: 0.34,
    })
    this.bodyMesh = this.createBodyMesh(this.bodyCapacity)
    this.options.root.add(this.bodyMesh)
    // The massive outer edge remains gold (the cylinder body). The coloured
    // enamel is only a fine inner bezel around the portrait, like the reference.
    const frontGalacticRim = new THREE.TorusGeometry(0.765, 0.034, 8, 32)
    const backGalacticRim = new THREE.TorusGeometry(0.765, 0.034, 8, 32)
    const rimFaceOffset = COIN_THICKNESS / 2 + 0.018
    frontGalacticRim.translate(0, 0, rimFaceOffset)
    backGalacticRim.translate(0, 0, -rimFaceOffset)
    const mergedGalacticRims = mergeGeometries([frontGalacticRim, backGalacticRim], false)
    frontGalacticRim.dispose()
    backGalacticRim.dispose()
    if (!mergedGalacticRims) {
      throw new Error('[coin-pusher] Failed to build the galactic coin rims.')
    }
    this.galacticCoinRimGeometry = mergedGalacticRims
    this.galacticCoinRimMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x24133f,
      emissiveIntensity: 0.24,
      metalness: 0.76,
      roughness: 0.24,
      vertexColors: true,
    })
    this.galacticCoinRimMesh = this.createGalacticCoinRimMesh(this.bodyCapacity)
    this.options.root.add(this.galacticCoinRimMesh)

    const mysteryTexture = createMysteryDieTexture()
    this.mysteryGeometry = new RoundedBoxGeometry(1.24, 1.24, 1.24, 4, 0.13)
    this.mysteryMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      color: 0xffffff,
      emissive: 0x32106d,
      emissiveIntensity: 0.26,
      envMapIntensity: 1,
      map: mysteryTexture,
      metalness: 0.58,
      roughness: 0.22,
    })
    this.mysteryMesh = this.createSpecialItemMesh(
      this.mysteryGeometry,
      this.mysteryMaterial,
      this.mysteryCapacity,
    )
    const ticketTexture = createPointTicketTexture()
    this.ticketGeometry = new RoundedBoxGeometry(1.72, 0.86, 0.1, 4, 0.075)
    this.ticketMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.92,
      clearcoatRoughness: 0.14,
      color: 0xffffff,
      emissive: 0x07385c,
      emissiveIntensity: 0.22,
      envMapIntensity: 0.76,
      map: ticketTexture,
      metalness: 0.34,
      roughness: 0.24,
    })
    this.ticketMesh = this.createSpecialItemMesh(
      this.ticketGeometry,
      this.ticketMaterial,
      this.ticketCapacity,
    )
    this.options.root.add(this.mysteryMesh, this.ticketMesh)
    this.faceFrontLocal.compose(
      new THREE.Vector3(0, 0, COIN_THICKNESS / 2 + 0.012),
      new THREE.Quaternion(),
      new THREE.Vector3(1, 1, 1),
    )
    this.faceBackLocal.compose(
      new THREE.Vector3(0, 0, -COIN_THICKNESS / 2 - 0.012),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI),
      new THREE.Vector3(1, 1, 1),
    )
    this.atlas = new AvatarAtlas({ root: options.root, circleGeometry: this.circleGeometry })
  }
  /** Synchronise les objets avec le contexte de frame, sans recopier les tableaux de physique. */
  sync(coins: readonly CoinPusher3dCoin[], theme: 'arcade' | 'galactic-palace', time: number, frameIndex: number) {
    this.machineTheme = theme
    this.lastFrameTime = time
    this.frameIndex = frameIndex
    this.atlas.setFrame(frameIndex)
    this.syncCoins(coins)
  }
  private createBodyMesh(capacity: number) {
    const mesh = new THREE.InstancedMesh(this.bodyGeometry, this.bodyMaterial, capacity)
    mesh.count = 0
    mesh.castShadow = true
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.renderOrder = 4
    return mesh
  }
  private createGalacticCoinRimMesh(capacity: number) {
    const mesh = new THREE.InstancedMesh(
      this.galacticCoinRimGeometry,
      this.galacticCoinRimMaterial,
      capacity,
    )
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.renderOrder = 6
    return mesh
  }
  private createSpecialItemMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
  ) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.count = 0
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.renderOrder = 7
    return mesh
  }
  private ensureSpecialItemCapacity(
    kind: 'mystery' | 'ticket',
    required: number,
  ) {
    const currentCapacity = kind === 'mystery'
      ? this.mysteryCapacity
      : this.ticketCapacity
    if (required <= currentCapacity) return
    const nextCapacity = nextCoinPusherInstanceCapacity(
      required,
      currentCapacity,
      SPECIAL_ITEM_INITIAL_CAPACITY,
    )
    const previousMesh = kind === 'mystery' ? this.mysteryMesh : this.ticketMesh
    const nextMesh = this.createSpecialItemMesh(
      kind === 'mystery' ? this.mysteryGeometry : this.ticketGeometry,
      kind === 'mystery' ? this.mysteryMaterial : this.ticketMaterial,
      nextCapacity,
    )
    this.options.root.add(nextMesh)
    this.options.root.remove(previousMesh)
    previousMesh.dispose()
    if (kind === 'mystery') {
      this.mysteryCapacity = nextCapacity
      this.mysteryMesh = nextMesh
    } else {
      this.ticketCapacity = nextCapacity
      this.ticketMesh = nextMesh
    }
  }
  private ensureBodyCapacity(required: number) {
    if (required <= this.bodyCapacity) return
    const nextCapacity = nextCoinPusherInstanceCapacity(
      required,
      this.bodyCapacity,
      BODY_INITIAL_CAPACITY,
    )
    const previousMesh = this.bodyMesh
    const previousRimMesh = this.galacticCoinRimMesh
    const nextMesh = this.createBodyMesh(nextCapacity)
    const nextRimMesh = this.createGalacticCoinRimMesh(nextCapacity)
    this.bodyMesh = nextMesh
    this.galacticCoinRimMesh = nextRimMesh
    this.bodyCapacity = nextCapacity
    this.options.root.add(nextMesh, nextRimMesh)
    this.options.root.remove(previousMesh, previousRimMesh)
    previousMesh.dispose()
    previousRimMesh.dispose()
  }
  private syncCoins(coins: readonly CoinPusher3dCoin[]) {
    this.clearFrameBuffers()
    const { regularCoins, mysteryItems, tickets, avatarKeys, avatarRepresentatives, avatarEntriesByKey, avatarEntries, pageRequirements } = this
    for (let index = 0; index < coins.length; index += 1) {
      const coin = coins[index]
      if (coin.kind === 'mystery') mysteryItems.push(coin)
      else if (coin.kind === 'ticket') tickets.push(coin)
      else regularCoins.push(coin)
    }
    // Capacity follows the full physical population (including special
    // objects), while only portrait coins occupy the round coin instances.
    const bodyCount = coins.length
    const regularCoinCount = regularCoins.length
    const syncGalacticRims = this.machineTheme === 'galactic-palace'
    this.ensureBodyCapacity(bodyCount)
    for (const page of this.atlas.avatarAtlasPages.values()) page.count = 0

    // A viewer can own many coins, but every coin keeps the exact portrait
    // snapshot captured when its gift arrived. Signed CDN URLs from newer
    // gifts therefore receive a new immutable atlas entry instead of repainting
    // historical coins. Identical owner/snapshot pairs are still shared.
    avatarKeys.length = regularCoinCount
    for (let index = 0; index < regularCoinCount; index += 1) {
      const coin = regularCoins[index]
      const key = coinPusherAvatarSnapshotKey(coin)
      avatarKeys[index] = key
      if (!avatarRepresentatives.has(key)) avatarRepresentatives.set(key, coin)
    }

    for (const [key, coin] of avatarRepresentatives) {
      avatarEntriesByKey.set(key, this.atlas.ensureAvatarAtlasEntry(coin, key))
    }
    this.atlas.retryActiveAvatarAtlasLoads()

    avatarEntries.length = regularCoinCount
    for (let index = 0; index < regularCoinCount; index += 1) {
      const entry = avatarEntriesByKey.get(avatarKeys[index])
      if (!entry) continue
      avatarEntries[index] = entry
      pageRequirements.set(
        entry.pageId,
        (pageRequirements.get(entry.pageId) || 0) + 1,
      )
    }
    for (const [pageId, required] of pageRequirements) {
      const page = this.atlas.avatarAtlasPages.get(pageId)
      if (page) this.atlas.ensureAvatarAtlasPageCapacity(page, required)
    }

    for (let index = 0; index < regularCoinCount; index += 1) {
      const coin = regularCoins[index]
      const avatarEntry = avatarEntries[index]
      if (!avatarEntry) continue
      setLogicalPoint(
        this.targetPosition,
        coin.x,
        coin.y,
        coin.phase,
        coin.dropProgress,
        coin.stackHeight,
        coin.radius,
      )
      if (coin.phase === 'plinko' && this.machineTheme === 'galactic-palace') {
        setGalacticPlinkoPoint(this.targetPosition, coin.x, coin.y)
        offsetGalacticPlinkoObject(
          this.targetPosition,
          coin.radius,
          COIN_OBJECT_BOUND_RADIUS,
        )
      }
      const restsOnDeck = (
        coin.phase === 'pusher'
        || coin.phase === 'settling'
        || coin.phase === 'shelf'
      )
      if (coin.phase === 'plinko') {
        this.targetEuler.set(coin.faceAngle, coin.rotation * 0.22, coin.rotation)
      } else if (coin.phase === 'pusher' || coin.phase === 'shelf') {
        const stackTilt = Math.min(0.065, Math.max(0, coin.stackHeight) * 0.014)
        this.targetEuler.set(
          -Math.PI / 2
            + Math.sin(coin.faceAngle) * 0.035
            + Math.sin(coin.rotation * 1.7) * stackTilt,
          Math.sin(coin.rotation) * 0.045
            + Math.cos(coin.rotation * 1.3) * stackTilt,
          coin.rotation,
        )
      } else if (coin.phase === 'settling') {
        const tilt = Math.sin(Math.PI * THREE.MathUtils.clamp(coin.dropProgress, 0, 1)) * 0.18
        this.targetEuler.set(
          -Math.PI / 2 + tilt,
          Math.sin(coin.rotation) * 0.05,
          coin.rotation,
        )
      } else {
        this.targetEuler.set(coin.faceAngle, coin.rotation * 0.62, coin.rotation)
      }
      this.targetQuaternion.setFromEuler(this.targetEuler)
      if (coin.phase === 'plinko' && this.machineTheme === 'galactic-palace') {
        this.targetQuaternion.premultiply(GALACTIC_PLINKO_PLANE_QUATERNION)
      }
      let targetVerticalHalfExtent = 0
      if (restsOnDeck) {
        const flatHalfExtent = plinkoObjectScale(coin.radius) * COIN_THICKNESS / 2
        targetVerticalHalfExtent = coinPusherCoinVerticalHalfExtent(
          coin.radius,
          this.targetQuaternion,
        )
        this.targetPosition.y += Math.max(0, targetVerticalHalfExtent - flatHalfExtent)
      }
      const pose = this.ensureCoinPose(coin, this.targetPosition, this.targetQuaternion)
      const phaseBlend = coin.phase === 'plinko'
        ? 0.72
        : coin.phase === 'pusher'
          ? 0.68
          : coin.phase === 'shelf'
            ? 0.62
            : 0.74
      if (coin.phase === 'pusher' || coin.phase === 'settling' || coin.phase === 'shelf') {
        // The pusher is kinematic. Its coins must share the exact depth used by
        // physics or smoothing makes the face appear to push through empty air.
        pose.position.x = THREE.MathUtils.lerp(pose.position.x, this.targetPosition.x, phaseBlend)
        pose.position.y = this.targetPosition.y
        pose.position.z = this.targetPosition.z
      } else {
        pose.position.lerp(this.targetPosition, phaseBlend)
      }
      pose.quaternion.slerp(this.targetQuaternion, phaseBlend)
      if (restsOnDeck) {
        const animatedHalfExtent = coinPusherCoinVerticalHalfExtent(
          coin.radius,
          pose.quaternion,
        )
        // During the Plinko-to-deck rotation the coin may still be almost
        // upright. Lift only by its exact rotated support extent so it pivots
        // on the metal surface instead of being swallowed by it.
        pose.position.y += Math.max(0, animatedHalfExtent - targetVerticalHalfExtent)
      }
      pose.lastSeenFrame = this.frameIndex

      this.dummy.position.copy(pose.position)
      this.dummy.quaternion.copy(pose.quaternion)
      const radius = Math.max(0.15, coin.radius / 66)
      this.dummy.scale.setScalar(radius)
      this.dummy.updateMatrix()
      this.bodyMesh.setMatrixAt(index, this.dummy.matrix)
      if (syncGalacticRims) {
        this.galacticCoinRimMesh.setMatrixAt(index, this.dummy.matrix)
        const rimColor = this.getGalacticCoinRimColor(coin)
        this.galacticCoinRimMesh.setColorAt(index, rimColor)
      }

      const atlasPage = this.atlas.avatarAtlasPages.get(avatarEntry.pageId)
      if (!atlasPage) continue
      const faceIndex = atlasPage.count
      atlasPage.count += 1
      this.faceMatrix.multiplyMatrices(this.dummy.matrix, this.faceFrontLocal)
      atlasPage.front.setMatrixAt(faceIndex, this.faceMatrix)
      this.faceMatrix.multiplyMatrices(this.dummy.matrix, this.faceBackLocal)
      atlasPage.back.setMatrixAt(faceIndex, this.faceMatrix)
      atlasPage.instanceUv.setXYZW(faceIndex, ...avatarEntry.uv)
    }

    this.bodyMesh.count = regularCoinCount
    this.bodyMesh.instanceMatrix.needsUpdate = true
    this.galacticCoinRimMesh.count = syncGalacticRims ? regularCoinCount : 0
    this.galacticCoinRimMesh.visible = syncGalacticRims
    if (syncGalacticRims) {
      this.galacticCoinRimMesh.instanceMatrix.needsUpdate = true
      if (this.galacticCoinRimMesh.instanceColor) {
        this.galacticCoinRimMesh.instanceColor.needsUpdate = true
      }
    }
    for (const page of this.atlas.avatarAtlasPages.values()) {
      page.front.count = page.count
      page.back.count = page.count
      if (page.count <= 0) continue
      page.front.instanceMatrix.needsUpdate = true
      page.back.instanceMatrix.needsUpdate = true
      page.instanceUv.needsUpdate = true
    }
    this.syncSpecialItems(mysteryItems, tickets)
    this.atlas.sweepAvatarAtlasEntries()
    this.atlas.flushAvatarAtlasTextures()

    for (const [id, pose] of this.poseByCoinId) {
      if (this.frameIndex - pose.lastSeenFrame > 2) this.poseByCoinId.delete(id)
    }
  }
  private syncSpecialItems(
    mysteryItems: readonly CoinPusher3dCoin[],
    tickets: readonly CoinPusher3dCoin[],
  ) {
    this.ensureSpecialItemCapacity('mystery', mysteryItems.length)
    this.ensureSpecialItemCapacity('ticket', tickets.length)
    this.syncSpecialItemBatch(mysteryItems, 'mystery', this.mysteryMesh)
    this.syncSpecialItemBatch(tickets, 'ticket', this.ticketMesh)
  }
  private clearFrameBuffers() {
    this.regularCoins.length = 0
    this.mysteryItems.length = 0
    this.tickets.length = 0
    this.avatarKeys.length = 0
    this.avatarEntries.length = 0
    this.avatarRepresentatives.clear()
    this.avatarEntriesByKey.clear()
    this.pageRequirements.clear()
  }
  private syncSpecialItemBatch(
    items: readonly CoinPusher3dCoin[],
    kind: 'mystery' | 'ticket',
    mesh: THREE.InstancedMesh,
  ) {
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index]
      setLogicalPoint(
        this.targetPosition,
        item.x,
        item.y,
        item.phase,
        item.dropProgress,
        item.stackHeight,
        item.radius,
        kind === 'mystery'
          ? MYSTERY_OBJECT_BOUND_RADIUS
          : TICKET_OBJECT_BOUND_RADIUS,
        kind === 'mystery' ? 0.62 : 0.05,
        kind === 'mystery' ? MYSTERY_VISUAL_SCALE : TICKET_VISUAL_SCALE,
      )
      if (item.phase === 'plinko' && this.machineTheme === 'galactic-palace') {
        setGalacticPlinkoPoint(this.targetPosition, item.x, item.y)
        offsetGalacticPlinkoObject(
          this.targetPosition,
          item.radius,
          kind === 'mystery'
            ? MYSTERY_OBJECT_BOUND_RADIUS
            : TICKET_OBJECT_BOUND_RADIUS,
        )
      }

      const radiusScale = Math.max(0.15, item.radius / 66)
      const restsOnShelf = (
        item.phase === 'pusher'
        || item.phase === 'settling'
        || item.phase === 'shelf'
      )

      if (kind === 'mystery') {
        const animationPhase = (
          this.lastFrameTime * (restsOnShelf ? 2.6 : 6.4)
          + (hashText(item.id) % 360) * Math.PI / 180
        )
        if (restsOnShelf) {
          this.targetEuler.set(
            Math.sin(item.faceAngle) * 0.07 + Math.sin(animationPhase) * 0.035,
            item.rotation + Math.sin(animationPhase * 0.71) * 0.045,
            Math.cos(item.rotation * 0.73) * 0.06
              + Math.cos(animationPhase * 0.83) * 0.03,
          )
        } else {
          this.targetEuler.set(
            item.faceAngle + item.rotation * 0.42 + Math.sin(animationPhase) * 0.24,
            item.rotation * 0.86 + animationPhase * 0.34,
            item.rotation * 1.14 + Math.cos(animationPhase * 0.79) * 0.22,
          )
        }
      } else if (restsOnShelf) {
        const stackTilt = Math.min(0.09, Math.max(0, item.stackHeight) * 0.018)
        this.targetEuler.set(
          -Math.PI / 2 + Math.sin(item.faceAngle) * 0.045 + stackTilt,
          Math.sin(item.rotation) * 0.055,
          item.rotation,
        )
      } else {
        this.targetEuler.set(item.faceAngle, item.rotation * 0.48, item.rotation)
      }
      if (item.phase === 'falling' && item.lostSide) {
        this.targetEuler.z += item.lostSide * 0.32
      }
      this.targetQuaternion.setFromEuler(this.targetEuler)
      if (item.phase === 'plinko' && this.machineTheme === 'galactic-palace') {
        this.targetQuaternion.premultiply(GALACTIC_PLINKO_PLANE_QUATERNION)
      }
      const visualScale = radiusScale * (
        kind === 'mystery' ? MYSTERY_VISUAL_SCALE : TICKET_VISUAL_SCALE
      )
      const localHalfX = kind === 'mystery' ? 0.62 : 0.86
      const localHalfY = kind === 'mystery' ? 0.62 : 0.43
      const localHalfZ = kind === 'mystery' ? 0.62 : 0.05
      let targetVerticalHalfExtent = 0
      if (restsOnShelf) {
        const nominalHalfExtent = visualScale * localHalfZ
        targetVerticalHalfExtent = rotatedObjectVerticalHalfExtent(
          visualScale,
          this.targetQuaternion,
          localHalfX,
          localHalfY,
          localHalfZ,
        )
        this.targetPosition.y += Math.max(
          0,
          targetVerticalHalfExtent - nominalHalfExtent,
        )
      }

      const pose = this.ensureCoinPose(item, this.targetPosition, this.targetQuaternion)
      if (restsOnShelf) {
        pose.position.x = THREE.MathUtils.lerp(pose.position.x, this.targetPosition.x, 0.7)
        pose.position.y = this.targetPosition.y
        pose.position.z = this.targetPosition.z
      } else {
        pose.position.lerp(this.targetPosition, 0.74)
      }
      pose.quaternion.slerp(this.targetQuaternion, 0.72)
      if (restsOnShelf) {
        const animatedHalfExtent = rotatedObjectVerticalHalfExtent(
          visualScale,
          pose.quaternion,
          localHalfX,
          localHalfY,
          localHalfZ,
        )
        pose.position.y += Math.max(0, animatedHalfExtent - targetVerticalHalfExtent)
      }
      pose.lastSeenFrame = this.frameIndex

      this.dummy.position.copy(pose.position)
      this.dummy.quaternion.copy(pose.quaternion)
      this.dummy.scale.setScalar(visualScale)
      this.dummy.updateMatrix()
      mesh.setMatrixAt(index, this.dummy.matrix)
      const highValue = Math.abs(Number(item.specialValue) || 0) >= 25
      mesh.setColorAt(
        index,
        this.options.colors.get(
          kind === 'mystery'
            ? this.machineTheme === 'galactic-palace' ? '#d9b1ff' : '#bcefff'
            : highValue ? '#fff0a8' : this.machineTheme === 'galactic-palace' ? '#ffd2f5' : '#bdf7ff',
        ),
      )
    }
    mesh.count = items.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.visible = items.length > 0
  }
  private ensureCoinPose(
    coin: CoinPusher3dCoin,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ) {
    let pose = this.poseByCoinId.get(coin.id)
    if (!pose) {
      pose = {
        lastSeenFrame: this.frameIndex,
        position: position.clone(),
        quaternion: quaternion.clone(),
      }
      this.poseByCoinId.set(coin.id, pose)
    }
    return pose
  }
  private getGalacticCoinRimColor(coin: CoinPusher3dCoin) {
    const key = String(coin.viewerId || coin.name || coin.id || 'viewer').toLowerCase()
    let color = this.galacticCoinRimColorCache.get(key)
    if (!color) {
      color = GALACTIC_COIN_RIM_COLORS[hashText(key) % GALACTIC_COIN_RIM_COLORS.length]
      if (this.galacticCoinRimColorCache.size >= 4096) {
        const oldestKey = this.galacticCoinRimColorCache.keys().next().value
        if (oldestKey) this.galacticCoinRimColorCache.delete(oldestKey)
      }
      this.galacticCoinRimColorCache.set(key, color)
    }
    return color
  }
  /** Libère les instances et portraits ; les matériaux et géométries visibles restent au dispose de scène. */
  dispose() {
    this.bodyMesh.dispose()
    this.galacticCoinRimMesh.dispose()
    this.atlas.dispose()
    this.circleGeometry.dispose()
    this.galacticCoinRimColorCache.clear()
    this.poseByCoinId.clear()
    this.clearFrameBuffers()
  }
}

