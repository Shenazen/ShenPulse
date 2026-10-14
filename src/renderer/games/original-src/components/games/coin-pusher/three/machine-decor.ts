import * as THREE from 'three'
import { COIN_PUSHER_PUSHER_BASE_Y as PUSHER_BASE_Y } from '../../coinPusherPhysics'
import type { CoinPusher3dPeg } from './types'
import { CYAN, PLINKO_LEFT, PLINKO_RIGHT, VIOLET, PUSHER_FACE_LOCAL_Z, PUSHER_REAR_LOCAL_Z, GALACTIC_PLINKO_PLANE_NORMAL, GALACTIC_BACKDROP_PULSE_SPEED, GALACTIC_BACKDROP_PULSE_RANGE, DEFAULT_COIN_PUSHER_PEGS, GALACTIC_PLINKO_PLANE_QUATERNION } from './constants'
import { disposeChildren } from './resources'
import { createMachineTitleTexture } from './machine-textures'
import { logicalShelfZ, setPlinkoPoint, setGalacticPlinkoPoint } from './positions'
import { coinPusherPegSignature } from './math'
import { neonMaterial, addRoundedBox, addBox } from './geometry'
import type { MachineMaterials } from './machine-materials'
import { MachineMechanics } from './machine-mechanics'
import type { GalacticDecorContext } from './galactic-context'
import { createGalacticPalette } from './galactic-palette'
import { buildGalacticAccents } from './galactic-accents'
import { buildGalacticBackdrop } from './galactic-backdrop'
import { buildGalacticCabinet } from './galactic-cabinet'
import { buildGalacticCrown } from './galactic-crown'
import { buildGalacticBase } from './galactic-base'

/** Compose le meuble arcade et galactique ; les builders ne connaissent que leurs groupes et matériaux. */
export class MachineDecor {
  readonly classicDecorRoot = new THREE.Group()
  readonly classicHeaderGroup = new THREE.Group()
  readonly classicPegRoot = new THREE.Group()
  readonly galacticPegRoot = new THREE.Group()
  classicPlinkoBackShell!: THREE.Mesh
  classicPlinkoInsetShell!: THREE.Mesh
  classicPlinkoSurface!: THREE.Mesh
  readonly galacticAmbientAccents: Array<{
    baseHue: number
    baseIntensity: number
    material: THREE.MeshStandardMaterial
    phase: number
    pulseRange: number
    speed: number
  }> = []
  readonly galacticBackdropPulseMaterials: THREE.MeshStandardMaterial[] = []
  readonly galacticBackdropRoot = new THREE.Group()
  readonly galacticCrest = new THREE.Group()
  readonly galacticDiamond = new THREE.Group()
  galacticDiamondMaterial!: THREE.MeshPhysicalMaterial
  readonly galacticPulseMaterials: THREE.MeshStandardMaterial[] = []
  readonly galacticPusherThemeRoot = new THREE.Group()
  readonly galacticThemeRoot = new THREE.Group()
  galacticPlinkoPanelGeometry!: THREE.BufferGeometry
  readonly pusherGroup = new THREE.Group()
  private pegSignature = ''
  private pegSource?: readonly CoinPusher3dPeg[]
  private logoTexture!: THREE.Texture
  private readonly textureLoader = new THREE.TextureLoader()
  private readonly dummy = new THREE.Object3D()
  readonly mechanics: MachineMechanics
  readonly platformSurface: THREE.Mesh
  private machineTheme: 'arcade' | 'galactic-palace' = 'arcade'
  private themeReveal = 1
  constructor(private readonly options: { root: THREE.Group; scoreGroup: THREE.Group; materials: MachineMaterials; pointTexture: THREE.CanvasTexture; onShadowRefresh: () => void }) {
    this.platformSurface = this.buildMachine()
    this.mechanics = new MachineMechanics({ root: options.root, materials: options.materials })
    this.ensurePegs()
    this.buildGalacticTheme()
    this.textureLoader.setCrossOrigin('anonymous')
  }
  /** Mémorise le thème pour les chevilles et remet à zéro son apparition animée. */
  setTheme(theme: 'arcade' | 'galactic-palace') {
    this.machineTheme = theme
    this.themeReveal = 0
  }
  /** Actualise les accents animés sans allouer de matériaux dans la boucle de rendu. */
  animate(time: number, delta: number, giftImpulse: number, cyanLight: THREE.PointLight, magentaLight: THREE.PointLight) {
    this.updateMachineThemeAnimation(time, delta, giftImpulse, cyanLight, magentaLight)
  }
  private buildMachine() {
    this.options.root.add(this.classicHeaderGroup, this.classicDecorRoot)
    const gunmetal = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.52,
      clearcoatRoughness: 0.32,
      color: 0x080e1c,
      emissive: 0x020817,
      emissiveIntensity: 0.1,
      envMapIntensity: 0.65,
      metalness: 0.92,
      roughness: 0.36,
    })
    const darkMetal = new THREE.MeshStandardMaterial({
      color: 0x050915,
      emissive: 0x000000,
      emissiveIntensity: 0,
      metalness: 0.18,
      roughness: 0.72,
    })
    const cyanNeon = neonMaterial(CYAN, 1.35)
    const violetNeon = neonMaterial(VIOLET, 1.2)
    const redNeon = neonMaterial(0xff4b50, 0.58)
    const softCyanNeon = neonMaterial(CYAN, 0.5)
    const glass = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.28,
      clearcoatRoughness: 0.42,
      color: 0x6ee7ff,
      depthWrite: false,
      envMapIntensity: 0.24,
      metalness: 0,
      opacity: 0.045,
      roughness: 0.42,
      side: THREE.DoubleSide,
      transparent: true,
      transmission: 0.02,
    })
    const movingDeckBaseMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.65,
      clearcoatRoughness: 0.28,
      color: 0x111827,
      emissive: 0x03111d,
      emissiveIntensity: 0.1,
      envMapIntensity: 0.72,
      metalness: 0.82,
      roughness: 0.34,
    })
    const scoreBayMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.38,
      clearcoatRoughness: 0.5,
      color: 0x07101c,
      emissive: 0x01050b,
      emissiveIntensity: 0.08,
      envMapIntensity: 0.42,
      metalness: 0.68,
      roughness: 0.52,
    })

    this.classicPlinkoBackShell = addRoundedBox(
      this.options.root,
      [7.55, 6.85, 0.42],
      [0, 6.18, -3.8],
      gunmetal,
      0.2,
      true,
    )
    this.classicPlinkoInsetShell = addRoundedBox(
      this.options.root,
      [6.86, 6.08, 0.2],
      [0, 6.18, -3.5],
      darkMetal,
      0.13,
      true,
    )
    const plinkoSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(
        (PLINKO_RIGHT - PLINKO_LEFT) / 66,
        5.56,
      ),
      this.options.materials.plinkoMaterial,
    )
    plinkoSurface.position.set(0, 6.04, -3.382)
    plinkoSurface.receiveShadow = true
    plinkoSurface.renderOrder = 1
    this.classicPlinkoSurface = plinkoSurface
    this.options.root.add(plinkoSurface)
    addRoundedBox(this.options.root, [7.72, 1.16, 0.72], [0, 9.49, -3.45], gunmetal, 0.16, true)
    addRoundedBox(this.options.root, [7.46, 0.07, 0.76], [0, 10.02, -3.44], this.options.materials.goldMaterial, 0.025, true)
    addRoundedBox(this.options.root, [7.46, 0.07, 0.76], [0, 8.96, -3.44], this.options.materials.goldMaterial, 0.025, true)
    addRoundedBox(this.options.root, [0.34, 6.25, 0.58], [-3.67, 6.22, -3.42], this.options.materials.goldMaterial, 0.1, true)
    addRoundedBox(this.options.root, [0.34, 6.25, 0.58], [3.67, 6.22, -3.42], this.options.materials.goldMaterial, 0.1, true)

    addBox(this.classicDecorRoot, [6.65, 0.045, 0.055], [0, 8.86, -3.31], softCyanNeon)
    addBox(this.classicDecorRoot, [6.65, 0.055, 0.06], [0, 3.25, -3.31], violetNeon)
    addBox(this.classicDecorRoot, [0.055, 5.9, 0.06], [-3.32, 6.19, -3.31], cyanNeon)
    addBox(this.classicDecorRoot, [0.055, 5.9, 0.06], [3.32, 6.19, -3.31], violetNeon)

    addRoundedBox(this.classicHeaderGroup, [5.34, 0.98, 0.18], [0, 9.59, -3.01], darkMetal, 0.12, true)
    addRoundedBox(this.classicHeaderGroup, [0.045, 0.76, 0.08], [-2.53, 9.6, -2.87], cyanNeon, 0.012)
    addRoundedBox(this.classicHeaderGroup, [0.045, 0.76, 0.08], [2.53, 9.6, -2.87], redNeon, 0.012)
    const logoTexture = this.textureLoader.load('/brand/shenpulse-banner-transparent.png')
    this.logoTexture = logoTexture
    logoTexture.colorSpace = THREE.SRGBColorSpace
    logoTexture.anisotropy = 8
    const logoDepthMaterial = new THREE.MeshBasicMaterial({
      alphaTest: 0.012,
      color: 0x07101c,
      map: logoTexture,
      toneMapped: true,
    })
    const logoFaceMaterial = new THREE.MeshStandardMaterial({
      alphaTest: 0.012,
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.14,
      emissiveMap: logoTexture,
      map: logoTexture,
      metalness: 0.08,
      roughness: 0.34,
    })
    const logoGeometry = new THREE.PlaneGeometry(4.62, 0.934)
    for (let layer = 3; layer >= 1; layer -= 1) {
      const logoDepth = new THREE.Mesh(logoGeometry, logoDepthMaterial)
      logoDepth.position.set(
        -layer * 0.006,
        9.64 - layer * 0.003,
        -2.84 - layer * 0.015,
      )
      logoDepth.renderOrder = 3
      this.classicHeaderGroup.add(logoDepth)
    }
    const logoFace = new THREE.Mesh(logoGeometry, logoFaceMaterial)
    logoFace.position.set(0, 9.64, -2.84)
    logoFace.renderOrder = 4
    this.classicHeaderGroup.add(logoFace)

    addRoundedBox(this.classicHeaderGroup, [3.56, 0.34, 0.12], [0, 9.02, -3.01], darkMetal, 0.07, true)
    const gameTitleTexture = createMachineTitleTexture('COIN PUSHER')
    const gameTitleMaterial = new THREE.MeshBasicMaterial({
      alphaTest: 0.01,
      map: gameTitleTexture,
      toneMapped: false,
      transparent: true,
    })
    const gameTitle = new THREE.Mesh(new THREE.PlaneGeometry(3.25, 0.29), gameTitleMaterial)
    gameTitle.position.set(0, 9.02, -2.91)
    gameTitle.renderOrder = 5
    this.classicHeaderGroup.add(gameTitle)

    addRoundedBox(this.options.root, [7.25, 0.3, 6.5], [0, 2.17, -0.03], gunmetal, 0.12, true)
    const platform = new THREE.Mesh(new THREE.PlaneGeometry(6.84, 6.08), this.options.materials.platformMaterial)
    platform.rotation.x = -Math.PI / 2
    platform.position.set(0, 2.335, -0.08)
    platform.receiveShadow = true
    platform.renderOrder = 1
    this.options.root.add(platform)

    addRoundedBox(this.options.root, [0.22, 0.58, 6.55], [-3.52, 2.53, -0.02], this.options.materials.goldMaterial, 0.07, true)
    addRoundedBox(this.options.root, [0.22, 0.58, 6.55], [3.52, 2.53, -0.02], this.options.materials.goldMaterial, 0.07, true)
    addBox(this.options.root, [0.055, 5.1, 6.35], [-3.66, 5.05, -0.08], glass)
    addBox(this.options.root, [0.055, 5.1, 6.35], [3.66, 5.05, -0.08], glass)

    const pusherBody = addRoundedBox(
      this.pusherGroup,
      [6.55, 0.58, PUSHER_FACE_LOCAL_Z - PUSHER_REAR_LOCAL_Z],
      [0, 2.65, (PUSHER_FACE_LOCAL_Z + PUSHER_REAR_LOCAL_Z) / 2],
      gunmetal,
      0.12,
      true,
    )
    pusherBody.castShadow = true
    // A nearly square lower blade gives the horizontal coins an unmistakable
    // visual contact at the exact physics face, outside the rounded body bevel.
    addRoundedBox(
      this.pusherGroup,
      [6.42, 0.12, 0.036],
      [0, 2.41, PUSHER_FACE_LOCAL_Z + 0.018],
      darkMetal,
      0.007,
      true,
    )
    addRoundedBox(
      this.pusherGroup,
      [6.38, 0.16, 0.075],
      [0, 2.52, PUSHER_FACE_LOCAL_Z + 0.046],
      darkMetal,
      0.04,
      true,
    )
    addRoundedBox(
      this.pusherGroup,
      [6.12, 0.035, 0.025],
      [0, 2.52, PUSHER_FACE_LOCAL_Z + 0.096],
      this.options.materials.pusherGlowMaterial,
      0.012,
    )
    const movingDeckDepth = PUSHER_FACE_LOCAL_Z - PUSHER_REAR_LOCAL_Z - 0.04
    const movingDeckCenterZ = (PUSHER_FACE_LOCAL_Z + PUSHER_REAR_LOCAL_Z) / 2 + 0.02
    addRoundedBox(
      this.pusherGroup,
      [6.1, 0.06, movingDeckDepth],
      [0, 2.96, movingDeckCenterZ],
      movingDeckBaseMaterial,
      0.035,
      true,
    )
    const movingDeckSurface = new THREE.Mesh(
      new THREE.PlaneGeometry(6.04, Math.max(0.2, movingDeckDepth - 0.08)),
      this.options.materials.movingDeckSurfaceMaterial,
    )
    movingDeckSurface.rotation.x = -Math.PI / 2
    movingDeckSurface.position.set(0, 2.994, movingDeckCenterZ - 0.02)
    movingDeckSurface.receiveShadow = true
    movingDeckSurface.renderOrder = 2
    this.pusherGroup.add(movingDeckSurface)
    addRoundedBox(
      this.pusherGroup,
      [6.18, 0.07, 0.1],
      [0, 2.95, PUSHER_FACE_LOCAL_Z - 0.025],
      this.options.materials.goldMaterial,
      0.026,
      true,
    )
    this.pusherGroup.position.z = logicalShelfZ(PUSHER_BASE_Y)
    this.options.root.add(this.pusherGroup)

    // This fascia sits below and behind the score lanes so it frames them
    // without occluding their floors, dividers and labels from the camera.
    addRoundedBox(this.options.root, [7.06, 2.52, 0.18], [0, 0.15, 2.76], scoreBayMaterial, 0.09, true)
    addRoundedBox(this.options.root, [7.08, 0.18, 1.56], [0, -1.06, 3.5], scoreBayMaterial, 0.07, true)
    addRoundedBox(this.options.root, [7.7, 0.68, 0.86], [0, -1.42, 3.12], gunmetal, 0.18, true)
    addRoundedBox(this.options.root, [7.35, 0.24, 1.65], [0, 1.82, 3.22], this.options.materials.goldMaterial, 0.08, true)
    addRoundedBox(this.options.root, [0.42, 3.55, 1.5], [-3.67, 0.35, 3.47], this.options.materials.goldMaterial, 0.1, true)
    addRoundedBox(this.options.root, [0.42, 3.55, 1.5], [3.67, 0.35, 3.47], this.options.materials.goldMaterial, 0.1, true)
    addBox(this.classicDecorRoot, [0.035, 2.12, 0.035], [-3.34, 0.12, 2.88], softCyanNeon)
    addBox(this.classicDecorRoot, [0.035, 2.12, 0.035], [3.34, 0.12, 2.88], softCyanNeon)

    this.options.root.add(this.options.scoreGroup)
    return platform
  }
  private buildGalacticTheme() {
    const context: GalacticDecorContext = {
      machineRoot: this.options.root,
      pointTexture: this.options.pointTexture,
      galacticPlinkoSurfaceMaterial: this.options.materials.galacticPlinkoSurfaceMaterial,
      galacticThemeRoot: this.galacticThemeRoot,
      dummy: this.dummy,
      galacticAmbientAccents: this.galacticAmbientAccents,
      galacticBackdropRoot: this.galacticBackdropRoot,
      galacticBackdropPulseMaterials: this.galacticBackdropPulseMaterials,
      galacticCrest: this.galacticCrest,
      galacticDiamond: this.galacticDiamond,
      logoTexture: this.logoTexture,
      galacticPusherThemeRoot: this.galacticPusherThemeRoot,
      pusherGroup: this.pusherGroup,
      galacticPulseMaterials: this.galacticPulseMaterials,
    }
    const palette = createGalacticPalette(context)
    buildGalacticAccents(context, palette)
    buildGalacticBackdrop(context, palette)
    this.galacticPlinkoPanelGeometry = buildGalacticCabinet(context, palette)
    this.galacticDiamondMaterial = buildGalacticCrown(context, palette)
    buildGalacticBase(context, palette)
  }
  /** Reconstruit les chevilles uniquement lorsque les coordonnées ou la référence ont changé. */
  ensurePegs(rawPegs?: readonly CoinPusher3dPeg[]) {
    const source = rawPegs === undefined ? DEFAULT_COIN_PUSHER_PEGS : rawPegs
    if (source === this.pegSource) return
    let hasInvalidPeg = false
    for (let index = 0; index < source.length; index += 1) {
      const peg = source[index]
      if (
        !Number.isFinite(peg.index)
        || !Number.isFinite(peg.row)
        || !Number.isFinite(peg.x)
        || !Number.isFinite(peg.y)
      ) {
        hasInvalidPeg = true
        break
      }
    }
    const pegs = hasInvalidPeg
      ? source.filter((peg) => (
          Number.isFinite(peg.index)
          && Number.isFinite(peg.row)
          && Number.isFinite(peg.x)
          && Number.isFinite(peg.y)
        ))
      : source
    const signature = coinPusherPegSignature(pegs)
    this.pegSource = source
    if (signature === this.pegSignature) return
    this.pegSignature = signature
    this.buildPegs(pegs)
  }
  private buildPegs(pegs: readonly CoinPusher3dPeg[]) {
    disposeChildren(this.classicPegRoot)
    disposeChildren(this.galacticPegRoot)
    this.classicPegRoot.name = 'coin-pusher-arcade-pegs'
    this.galacticPegRoot.name = 'coin-pusher-palace-pegs'
    this.options.root.add(this.classicPegRoot)
    this.galacticThemeRoot.add(this.galacticPegRoot)
    if (pegs.length === 0) {
      this.options.onShadowRefresh()
      return
    }

    const pegGeometry = new THREE.CylinderGeometry(0.075, 0.098, 0.25, 40)
    pegGeometry.rotateX(Math.PI / 2)
    const pegMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      color: 0xf2c66d,
      emissive: 0x4b2600,
      emissiveIntensity: 0.16,
      metalness: 1,
      roughness: 0.28,
    })
    const pegMesh = new THREE.InstancedMesh(pegGeometry, pegMaterial, pegs.length)
    const ringGeometry = new THREE.TorusGeometry(0.132, 0.022, 12, 40)
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdf9a,
      toneMapped: true,
    })
    const ringMesh = new THREE.InstancedMesh(ringGeometry, ringMaterial, pegs.length)
    const pegPosition = new THREE.Vector3()

    pegs.forEach((peg, index) => {
      setPlinkoPoint(pegPosition, peg.x, peg.y)
      this.dummy.position.copy(pegPosition)
      this.dummy.quaternion.identity()
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      pegMesh.setMatrixAt(index, this.dummy.matrix)
      ringMesh.setMatrixAt(index, this.dummy.matrix)
    })
    pegMesh.instanceMatrix.needsUpdate = true
    ringMesh.instanceMatrix.needsUpdate = true
    pegMesh.castShadow = true
    pegMesh.receiveShadow = true
    this.classicPegRoot.add(pegMesh, ringMesh)

    // Palace pins are deliberately small, deep metal studs rather than light
    // bulbs. They share the artwork's frontal plane so the visual collision
    // point cannot drift away from a falling coin.
    const palacePegGeometry = new THREE.CylinderGeometry(0.05, 0.071, 0.27, 18)
    palacePegGeometry.rotateX(Math.PI / 2)
    const palacePegMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.84,
      clearcoatRoughness: 0.14,
      color: 0xd6a64d,
      envMapIntensity: 0.92,
      metalness: 1,
      roughness: 0.23,
    })
    const palacePegMesh = new THREE.InstancedMesh(
      palacePegGeometry,
      palacePegMaterial,
      pegs.length,
    )
    const palaceCollarGeometry = new THREE.TorusGeometry(0.077, 0.012, 8, 20)
    const palaceCollarMaterial = new THREE.MeshStandardMaterial({
      color: 0x120d0d,
      metalness: 0.92,
      roughness: 0.24,
    })
    const palaceCollarMesh = new THREE.InstancedMesh(
      palaceCollarGeometry,
      palaceCollarMaterial,
      pegs.length,
    )
    pegs.forEach((peg, index) => {
      setGalacticPlinkoPoint(pegPosition, peg.x, peg.y)
      this.dummy.position.copy(pegPosition)
      this.dummy.quaternion.copy(GALACTIC_PLINKO_PLANE_QUATERNION)
      this.dummy.scale.setScalar(1)
      this.dummy.updateMatrix()
      palacePegMesh.setMatrixAt(index, this.dummy.matrix)
      this.dummy.position.addScaledVector(GALACTIC_PLINKO_PLANE_NORMAL, 0.146)
      this.dummy.updateMatrix()
      palaceCollarMesh.setMatrixAt(index, this.dummy.matrix)
    })
    palacePegMesh.instanceMatrix.needsUpdate = true
    palaceCollarMesh.instanceMatrix.needsUpdate = true
    palacePegMesh.castShadow = false
    palacePegMesh.receiveShadow = true
    this.galacticPegRoot.add(palacePegMesh, palaceCollarMesh)
    this.classicPegRoot.visible = this.machineTheme !== 'galactic-palace'
    // The whole palace root is theme-gated; keeping its peg child visible
    // avoids stale hidden pins when the renderer switches theme at runtime.
    this.galacticPegRoot.visible = true
    this.options.onShadowRefresh()
  }
  private updateMachineThemeAnimation(time: number, delta: number, giftImpulse: number, cyanLight: THREE.PointLight, magentaLight: THREE.PointLight) {
    if (this.machineTheme !== 'galactic-palace') return
    this.themeReveal = THREE.MathUtils.damp(this.themeReveal, 1, 5.5, delta)
    const revealEase = 1 - Math.pow(1 - this.themeReveal, 3)
    this.galacticThemeRoot.position.y = (1 - revealEase) * 0.08
    for (let index = 0; index < this.galacticPulseMaterials.length; index += 1) {
      const material = this.galacticPulseMaterials[index]
      const base = Number(material.userData.baseEmissiveIntensity) || 1
      const phase = Number(material.userData.pulsePhase) || 0
      const speed = Number(material.userData.pulseSpeed) || 0.7
      const pulse = (Math.sin(time * speed + phase) + 1) * 0.5
      const easedPulse = pulse * pulse * (3 - 2 * pulse)
      material.emissiveIntensity = base + easedPulse * 0.075 + giftImpulse * 0.045
    }
    for (let index = 0; index < this.galacticBackdropPulseMaterials.length; index += 1) {
      const material = this.galacticBackdropPulseMaterials[index]
      const base = Number(material.userData.baseEmissiveIntensity) || 0.2
      const phase = Number(material.userData.pulsePhase) || 0
      const pulse = (Math.sin(time * GALACTIC_BACKDROP_PULSE_SPEED + phase) + 1) * 0.5
      material.emissiveIntensity = (
        base
        + pulse * GALACTIC_BACKDROP_PULSE_RANGE
        + giftImpulse * 0.025
      )
    }
    for (const accent of this.galacticAmbientAccents) {
      const pulse = (Math.sin(time * accent.speed + accent.phase) + 1) * 0.5
      const easedPulse = pulse * pulse * (3 - 2 * pulse)
      const hue = accent.baseHue + Math.sin(time * 0.12 + accent.phase) * 0.012
      accent.material.color.setHSL(hue, 0.82, 0.57)
      accent.material.emissive.setHSL(hue, 0.9, 0.41)
      accent.material.emissiveIntensity = (
        accent.baseIntensity
        + easedPulse * accent.pulseRange
        + giftImpulse * 0.035
      )
    }
    this.galacticCrest.rotation.y = Math.sin(time * 0.72) * 0.028
    this.galacticCrest.rotation.z = Math.sin(time * 0.46) * 0.012
    const crestScale = 1 + Math.sin(time * 2.1) * 0.012 + giftImpulse * 0.025
    this.galacticCrest.scale.setScalar(0.82 * crestScale)
    this.galacticDiamond.rotation.x = Math.sin(time * 0.43) * 0.065
    this.galacticDiamond.rotation.y = time * 0.74 + Math.PI / 8
    this.galacticDiamond.rotation.z = Math.sin(time * 0.31) * 0.025
    const diamondSparkle = (Math.sin(time * 1.7) + 1) * 0.5
    this.galacticDiamondMaterial.emissiveIntensity = (
      0.16 + diamondSparkle * 0.12 + giftImpulse * 0.075
    )

    // The existing scene point lights remain the only dynamic light sources;
    // a very slow hue drift makes the reflective metal feel alive without
    // adding costly per-light shading or harsh flashes.
    cyanLight.color.setHSL(
      0.54 + Math.sin(time * 0.09) * 0.008,
      0.86,
      0.58,
    )
    magentaLight.color.setHSL(
      0.79 + Math.sin(time * 0.075 + 1.8) * 0.01,
      0.78,
      0.6,
    )
  }
}

