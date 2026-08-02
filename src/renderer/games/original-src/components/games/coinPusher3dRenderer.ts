import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  COIN_PUSHER_COIN_RADIUS_MAX,
  COIN_PUSHER_PUSHER_BASE_Y as PUSHER_BASE_Y,
  COIN_PUSHER_PUSHER_FACE_OFFSET,
  COIN_PUSHER_PUSHER_TRAVEL,
  COIN_PUSHER_SHELF_EDGE as SHELF_EDGE,
  COIN_PUSHER_SHELF_TOP as SHELF_TOP,
} from './coinPusherPhysics'
import { COIN_PUSHER_MAX_COIN_SCALE } from './coinPusherSettings'

export type CoinPusher3dCoinPhase = 'plinko' | 'pusher' | 'settling' | 'shelf' | 'falling'

export type CoinPusher3dCoin = {
  avatarUrl: string
  dropProgress: number
  faceAngle: number
  id: string
  kind?: 'coin' | 'mystery' | 'ticket'
  lostSide?: -1 | 0 | 1
  name: string
  phase: CoinPusher3dCoinPhase
  radius: number
  rotation: number
  specialValue?: number
  stackHeight: number
  viewerId: string
  x: number
  y: number
}

export type CoinPusher3dPeg = {
  index: number
  row: number
  x: number
  y: number
}

export type CoinPusher3dParticle = {
  color: string
  life: number
  maxLife: number
  x: number
  y: number
}

export type CoinPusher3dFloatingScore = {
  color: string
  id: number
  life: number
  text: string
  x: number
  y: number
}

export type CoinPusher3dFrame = {
  coins: readonly CoinPusher3dCoin[]
  floatingScores: readonly CoinPusher3dFloatingScore[]
  machineTheme?: string
  particles: readonly CoinPusher3dParticle[]
  pegs?: readonly CoinPusher3dPeg[]
  platformImageUrl: string
  plinkoImageUrl?: string
  pusherPower: number
  pusherY: number
  roundPhase: 'playing' | 'paused' | 'finished'
  scoreSlots: readonly number[]
  scoreMultiplier?: number
  sideGuardProgress?: number
  sideLossEnabled?: boolean
  time: number
}

export interface CoinPusher3dRenderer {
  dispose(): void
  giftBurst(coinCount: number): void
  render(frame: CoinPusher3dFrame): void
  resize(): void
  scoreBurst(logicalX: number, points: number): void
}

type AvatarAtlasEntry = {
  avatarUrl: string
  key: string
  lastSeenFrame: number
  loadAttempts: number
  loadToken: number
  loadedToken: number
  name: string
  pageId: number
  pendingLoadToken: number
  retryAtFrame: number
  slot: number
  uv: readonly [number, number, number, number]
}

type AvatarAtlasLoadJob = {
  entry: AvatarAtlasEntry
  token: number
  url: string
}

type AvatarAtlasPage = {
  back: THREE.InstancedMesh
  capacity: number
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D | null
  count: number
  disposed: boolean
  entries: number
  freeSlots: number[]
  front: THREE.InstancedMesh
  geometry: THREE.BufferGeometry
  id: number
  instanceUv: THREE.InstancedBufferAttribute
  lastTextureUploadFrame: number
  material: THREE.MeshBasicMaterial
  nextSlot: number
  texture: THREE.CanvasTexture
  textureDirty: boolean
}

type CoinPose = {
  lastSeenFrame: number
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

type ScoreSpriteResource = {
  lastSeenFrame: number
  material: THREE.SpriteMaterial
  sprite: THREE.Sprite
  textureKey: string
}

type ScoreTextureResource = {
  lastUsedFrame: number
  references: number
  texture: THREE.CanvasTexture
}

type SurfaceTextureState = {
  desiredUrl: string
  loadedUrl: string
  loadingUrl: string
  retryAt: number
  texture: THREE.Texture | null
  token: number
}

type SurfaceTextureTarget = {
  fallbackColor: number
  material: THREE.MeshPhysicalMaterial
  textureColor: number
}

const LOGICAL_WIDTH = 540
const PLINKO_LEFT = 48
const PLINKO_RIGHT = 492
const PLINKO_TOP = 142
const PLINKO_BOTTOM = 382
const SCORE_BOTTOM = 916
const BODY_INITIAL_CAPACITY = 1024
const AVATAR_ATLAS_COLUMNS = 32
const AVATAR_ATLAS_ROWS = 32
const AVATAR_ATLAS_VIEWERS_PER_PAGE = AVATAR_ATLAS_COLUMNS * AVATAR_ATLAS_ROWS
const AVATAR_ATLAS_TILE_SIZE = 64
const AVATAR_ATLAS_TEXTURE_SIZE = AVATAR_ATLAS_COLUMNS * AVATAR_ATLAS_TILE_SIZE
const AVATAR_ATLAS_TILE_PADDING = 2
const AVATAR_PAGE_INITIAL_COIN_CAPACITY = 1024
const AVATAR_ATLAS_ENTRY_IDLE_FRAMES = 180
const AVATAR_ATLAS_UPLOAD_INTERVAL_FRAMES = 12
const AVATAR_ATLAS_MAX_CONCURRENT_LOADS = 8
const AVATAR_ATLAS_MAX_LOAD_ATTEMPTS = 3
const AVATAR_ATLAS_RETRY_BACKOFF_FRAMES = 90
const MAX_FLOATING_SCORE_SPRITES = 64
const MAX_FLOATING_SCORE_TEXTURES = 64
const MAX_PARTICLES = 800
const ADAPTIVE_QUALITY_MIN = 0.68
const ADAPTIVE_QUALITY_DOWN_COOLDOWN = 1.35
const ADAPTIVE_QUALITY_UP_COOLDOWN = 2.4
const ADAPTIVE_QUALITY_OVERLOAD_SECONDS = 1.05
const ADAPTIVE_QUALITY_RECOVERY_SECONDS = 4.8
const COIN_THICKNESS = 0.34
// Plinko objects used to be placed almost coplanar with the palace artwork.
// A rotating coin could consequently cross the opaque panel and appear as a
// crescent. These conservative object-space bounds keep the complete mesh in
// front of the playfield while leaving the cabinet rails and pins free to
// occlude it normally.
const COIN_OBJECT_BOUND_RADIUS = Math.hypot(1, COIN_THICKNESS / 2)
const MYSTERY_OBJECT_BOUND_RADIUS = Math.hypot(0.62, 0.62, 0.62)
const TICKET_OBJECT_BOUND_RADIUS = Math.hypot(0.86, 0.43, 0.05)
const MYSTERY_VISUAL_SCALE = 1.02
const TICKET_VISUAL_SCALE = 1.08
const PLINKO_OBJECT_SURFACE_GAP = 0.018
const DECK_OBJECT_SURFACE_GAP = 0.006
const MAIN_DECK_SURFACE_Y = 2.335
const MOVING_DECK_SURFACE_Y = 2.994
const CLASSIC_PLINKO_SURFACE_Z = -3.382
const CLASSIC_PLINKO_BASE_COIN_Z = -3.12
const GALACTIC_PLINKO_TOP_Y = 8.9
const GALACTIC_PLINKO_BOTTOM_Y = 3.2
const GALACTIC_PLINKO_BOTTOM_Z = -2.74
const GALACTIC_PLINKO_SHOULDER_Y = 8.22
const GALACTIC_PLINKO_TOP_HALF_WIDTH = 2.31
const GALACTIC_PLINKO_FULL_HALF_WIDTH = 3.56
const GALACTIC_PLINKO_PLAYFIELD_HALF_WIDTH = (PLINKO_RIGHT - PLINKO_LEFT) / (2 * 66)
const GALACTIC_PLINKO_VEIL_OFFSET_Z = 0.018
// The palace artwork is a camera-facing aperture, not a ramp. Keeping its two
// axes orthogonal to the fixed palace view makes portraits and lettering stay
// upright while the surrounding cabinet remains fully three-dimensional.
const GALACTIC_PLINKO_PLANE_NORMAL = new THREE.Vector3(0.1, 9.9, 17.24).normalize()
const GALACTIC_PLINKO_PLANE_RIGHT = new THREE.Vector3()
  .crossVectors(new THREE.Vector3(0, 1, 0), GALACTIC_PLINKO_PLANE_NORMAL)
  .normalize()
const GALACTIC_PLINKO_PLANE_UP = new THREE.Vector3()
  .crossVectors(GALACTIC_PLINKO_PLANE_NORMAL, GALACTIC_PLINKO_PLANE_RIGHT)
  .normalize()
const GALACTIC_PLINKO_CENTER_Y = (GALACTIC_PLINKO_TOP_Y + GALACTIC_PLINKO_BOTTOM_Y) / 2
const GALACTIC_PLINKO_HALF_HEIGHT = (
  (GALACTIC_PLINKO_TOP_Y - GALACTIC_PLINKO_BOTTOM_Y)
  / (2 * GALACTIC_PLINKO_PLANE_UP.y)
)
const GALACTIC_PLINKO_PLANE_CENTER = new THREE.Vector3(
  0,
  GALACTIC_PLINKO_CENTER_Y,
  GALACTIC_PLINKO_BOTTOM_Z
    + GALACTIC_PLINKO_PLANE_UP.z * GALACTIC_PLINKO_HALF_HEIGHT,
)
const GALACTIC_PLINKO_PLANE_QUATERNION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  GALACTIC_PLINKO_PLANE_NORMAL,
)
const GOLD = 0xf7c85d
const CYAN = 0x43e8ff
const VIOLET = 0xa855f7
const MAGENTA = 0xff3ba7
const GALACTIC_BLUE = 0x199cff
const GALACTIC_PURPLE = 0x9d4dff
const GALACTIC_GOLD = 0xffc85a
const GALACTIC_COIN_RIM_COLORS = [
  new THREE.Color(0x28dfff),
  new THREE.Color(0xb85cff),
  new THREE.Color(0xff4fb4),
  new THREE.Color(0xffc64f),
  new THREE.Color(0x6e7bff),
]
const PUSHER_FACE_LOCAL_Z = COIN_PUSHER_PUSHER_FACE_OFFSET * 5.82 / (SHELF_EDGE - SHELF_TOP)
const PUSHER_TRAVEL_LOCAL_Z = COIN_PUSHER_PUSHER_TRAVEL * 5.82 / (SHELF_EDGE - SHELF_TOP)
const PUSHER_REAR_LOCAL_Z = -0.54 - PUSHER_TRAVEL_LOCAL_Z - 0.16
const MAX_RENDERED_OBJECT_SCALE = (
  COIN_PUSHER_COIN_RADIUS_MAX * COIN_PUSHER_MAX_COIN_SCALE / 66
)
const MAX_RENDERED_OBJECT_BOUND_RADIUS = Math.max(
  COIN_OBJECT_BOUND_RADIUS,
  MYSTERY_OBJECT_BOUND_RADIUS * MYSTERY_VISUAL_SCALE,
  TICKET_OBJECT_BOUND_RADIUS * TICKET_VISUAL_SCALE,
)
// The palace rear sill must stay behind the complete landing envelope. It is a
// real opaque piece of cabinet geometry, so depth testing remains enabled: the
// clearance comes from placing the metal where a physical back wall belongs.
const GALACTIC_REAR_SILL_FRONT_Z = (
  logicalShelfZ(PUSHER_BASE_Y)
  - MAX_RENDERED_OBJECT_SCALE * MAX_RENDERED_OBJECT_BOUND_RADIUS
  - 0.045
)
const GALACTIC_REAR_SILL_DEPTH = 0.18
const GALACTIC_REAR_SILL_CENTER_Z = (
  GALACTIC_REAR_SILL_FRONT_Z - GALACTIC_REAR_SILL_DEPTH / 2
)
const GALACTIC_REAR_SILL_HEIGHT = 0.18
const GALACTIC_REAR_SILL_CENTER_Y = 3.11
const GALACTIC_REAR_SILL_TRIM_DEPTH = 0.06
const GALACTIC_REAR_SILL_TRIM_CENTER_Z = (
  GALACTIC_REAR_SILL_FRONT_Z - GALACTIC_REAR_SILL_TRIM_DEPTH / 2
)
// Keep the casino hall inside the portrait camera while leaving it physically
// behind every gameplay surface. Explicit anchors prevent future art passes
// from drifting the columns back outside the visible frame.
const GALACTIC_BACKDROP_COLUMN_X = 4.6
const GALACTIC_BACKDROP_COLUMN_Y = 4.35
const GALACTIC_BACKDROP_COLUMN_Z = -6.34
const GALACTIC_BACKDROP_PULSE_SPEED = 0.46
const GALACTIC_BACKDROP_PULSE_RANGE = 0.085
const GALACTIC_SCORE_LABEL_Y = 0.08
const GALACTIC_SCORE_LABEL_Z = 3.91
const GALACTIC_SCORE_LABEL_HEIGHT = 0.46
const SPECIAL_ITEM_INITIAL_CAPACITY = 64
const DEFAULT_COIN_PUSHER_PEGS: readonly CoinPusher3dPeg[] = createDefaultCoinPusherPegs()

export function nextCoinPusherInstanceCapacity(
  required: number,
  current = 0,
  minimum = 1,
) {
  const requiredValue = Number(required)
  const currentValue = Number(current)
  const minimumValue = Number(minimum)
  if (!Number.isFinite(requiredValue) || !Number.isFinite(currentValue) || !Number.isFinite(minimumValue)) {
    throw new RangeError('Coin Pusher instance capacity must be finite.')
  }
  const needed = Math.max(0, Math.ceil(requiredValue))
  const floor = Math.max(1, Math.ceil(currentValue), Math.ceil(minimumValue))
  let capacity = 1
  while (capacity < floor) capacity *= 2
  while (capacity < needed) capacity *= 2
  return capacity
}

export function coinPusherCoinVerticalHalfExtent(
  radius: number,
  quaternion: Pick<THREE.Quaternion, 'w' | 'x' | 'y' | 'z'>,
) {
  return rotatedObjectVerticalHalfExtent(
    plinkoObjectScale(radius),
    quaternion,
    1,
    1,
    COIN_THICKNESS / 2,
  )
}

function rotatedObjectVerticalHalfExtent(
  scale: number,
  quaternion: Pick<THREE.Quaternion, 'w' | 'x' | 'y' | 'z'>,
  halfX: number,
  halfY: number,
  halfZ: number,
) {
  const x = Number(quaternion.x) || 0
  const y = Number(quaternion.y) || 0
  const z = Number(quaternion.z) || 0
  const w = Number(quaternion.w) || 0
  // Second row of the quaternion rotation matrix. Projecting the three local
  // half extents on world Y gives the exact AABB support height without an
  // allocation in the per-coin render loop.
  const worldYFromX = 2 * (x * y + z * w)
  const worldYFromY = 1 - 2 * (x * x + z * z)
  const worldYFromZ = 2 * (y * z - x * w)
  return Math.max(0, Number(scale) || 0) * (
    Math.abs(worldYFromX) * halfX
    + Math.abs(worldYFromY) * halfY
    + Math.abs(worldYFromZ) * halfZ
  )
}

/**
 * Returns a conservative quality ceiling from the amount of visible work.
 * The renderer approaches this ceiling in small timed steps; the returned
 * value therefore never causes a sudden resolution jump on its own.
 */
export function coinPusherAdaptiveQualityCeiling(
  coinCount: number,
  particleCount = 0,
  floatingScoreCount = 0,
) {
  const coins = Number.isFinite(coinCount) ? Math.max(0, Number(coinCount)) : 0
  const particles = Number.isFinite(particleCount) ? Math.max(0, Number(particleCount)) : 0
  const scores = Number.isFinite(floatingScoreCount)
    ? Math.max(0, Number(floatingScoreCount))
    : 0
  const visualLoad = coins + particles * 0.28 + scores * 4
  if (visualLoad >= 1_400) return 0.7
  if (visualLoad >= 900) return 0.8
  if (visualLoad >= 600) return 0.88
  if (visualLoad >= 350) return 0.95
  return 1
}

class SceneRenderer implements CoinPusher3dRenderer {
  private adaptiveQuality = 1
  private adaptiveRecoverySeconds = 0
  private adaptiveStressSeconds = 0
  private appliedPixelRatio = 0
  private readonly avatarAtlasEntries = new Map<string, AvatarAtlasEntry>()
  private activeAvatarAtlasLoads = 0
  private readonly avatarAtlasLoadQueue: AvatarAtlasLoadJob[] = []
  private readonly avatarAtlasPages = new Map<number, AvatarAtlasPage>()
  private readonly avatarImageLoader = new THREE.ImageLoader()
  private nextAvatarAtlasPageId = 0
  private basePixelRatio = 1
  private readonly bloomPass: UnrealBloomPass
  private bodyCapacity = BODY_INITIAL_CAPACITY
  private readonly bodyGeometry: THREE.CylinderGeometry
  private readonly bodyMaterial: THREE.MeshPhysicalMaterial
  private bodyMesh: THREE.InstancedMesh
  private readonly camera = new THREE.PerspectiveCamera(46, 9 / 16, 0.1, 80)
  private readonly cameraBase = new THREE.Vector3(-0.18, 6.55, 19.5)
  private readonly cameraTarget = new THREE.Vector3(-0.28, 4.12, -0.35)
  // The reference cabinet is read from a high, almost architectural viewpoint:
  // the deep shelf occupies the middle third while the full crown and plinth
  // remain in frame. Arcade keeps its original camera untouched.
  private readonly galacticCameraBase = new THREE.Vector3(-0.18, 13.9, 16.9)
  private readonly galacticCameraTarget = new THREE.Vector3(-0.28, 4, -0.34)
  private readonly canvas: HTMLCanvasElement
  private readonly circleGeometry: THREE.CircleGeometry
  private readonly colorCache = new Map<string, THREE.Color>()
  private readonly composer: EffectComposer
  private readonly cyanLight: THREE.PointLight
  private readonly dummy = new THREE.Object3D()
  private readonly environmentTexture: THREE.Texture
  private readonly faceBackLocal = new THREE.Matrix4()
  private readonly faceFrontLocal = new THREE.Matrix4()
  private readonly faceMatrix = new THREE.Matrix4()
  private readonly floatingScoreGroup = new THREE.Group()
  private readonly floatingScorePool: ScoreSpriteResource[] = []
  private readonly floatingScoreSprites = new Map<number, ScoreSpriteResource>()
  private readonly floatingScoreTextures = new Map<string, ScoreTextureResource>()
  private readonly fxaaPass: FXAAPass
  private readonly galacticCoinRimColorCache = new Map<string, THREE.Color>()
  private readonly galacticCoinRimGeometry: THREE.BufferGeometry
  private readonly galacticCoinRimMaterial: THREE.MeshStandardMaterial
  private galacticCoinRimMesh: THREE.InstancedMesh
  private readonly goldMaterial: THREE.MeshPhysicalMaterial
  private readonly keyLight: THREE.SpotLight
  private readonly classicDecorRoot = new THREE.Group()
  private readonly classicHeaderGroup = new THREE.Group()
  private readonly classicPegRoot = new THREE.Group()
  private readonly galacticPegRoot = new THREE.Group()
  private classicPlinkoBackShell!: THREE.Mesh
  private classicPlinkoInsetShell!: THREE.Mesh
  private readonly galacticAmbientAccents: Array<{
    baseHue: number
    baseIntensity: number
    material: THREE.MeshStandardMaterial
    phase: number
    pulseRange: number
    speed: number
  }> = []
  private readonly galacticBackdropPulseMaterials: THREE.MeshStandardMaterial[] = []
  private readonly galacticBackdropRoot = new THREE.Group()
  private readonly galacticCrest = new THREE.Group()
  private readonly galacticDiamond = new THREE.Group()
  private galacticDiamondMaterial!: THREE.MeshPhysicalMaterial
  private readonly galacticPulseMaterials: THREE.MeshStandardMaterial[] = []
  private readonly galacticPusherThemeRoot = new THREE.Group()
  private readonly galacticThemeRoot = new THREE.Group()
  private readonly machineRoot = new THREE.Group()
  private readonly magentaLight: THREE.PointLight
  private mysteryCapacity = SPECIAL_ITEM_INITIAL_CAPACITY
  private readonly mysteryGeometry: THREE.BufferGeometry
  private readonly mysteryMaterial: THREE.MeshPhysicalMaterial
  private mysteryMesh: THREE.InstancedMesh
  private readonly movingDeckSurfaceMaterial: THREE.MeshPhysicalMaterial
  private readonly particleColors = new Float32Array(MAX_PARTICLES * 3)
  private readonly particleGeometry = new THREE.BufferGeometry()
  private readonly particleMaterial: THREE.PointsMaterial
  private readonly particlePoints: THREE.Points
  private readonly particlePositions = new Float32Array(MAX_PARTICLES * 3)
  private readonly platformMaterial: THREE.MeshPhysicalMaterial
  private readonly platformSurface: THREE.Mesh
  private readonly platformTextureState = createSurfaceTextureState()
  private readonly plinkoMaterial: THREE.MeshPhysicalMaterial
  private readonly galacticPlinkoSurfaceMaterial: THREE.MeshPhysicalMaterial
  private galacticPlinkoPanelGeometry!: THREE.BufferGeometry
  private classicPlinkoSurface!: THREE.Mesh
  private readonly plinkoTextureState = createSurfaceTextureState()
  private readonly pointTexture: THREE.CanvasTexture
  private readonly poseByCoinId = new Map<string, CoinPose>()
  private readonly pusherGroup = new THREE.Group()
  private readonly pusherGlowMaterial: THREE.MeshStandardMaterial
  private pegSignature = ''
  private pegSource?: readonly CoinPusher3dPeg[]
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly scoreGroup = new THREE.Group()
  private readonly scoreImpulses: number[] = []
  private readonly scoreMaterials: THREE.MeshStandardMaterial[] = []
  private scoreMultiplier = 1
  private scoreSlotValues: number[] = []
  private readonly starField: THREE.Points
  private readonly sideGuardFrameMaterial: THREE.MeshPhysicalMaterial
  private readonly sideGuardGlowMaterial: THREE.MeshStandardMaterial
  private readonly sideGuardRoot = new THREE.Group()
  private sideGuardVisualProgress = 1
  private ticketCapacity = SPECIAL_ITEM_INITIAL_CAPACITY
  private readonly ticketGeometry: THREE.BufferGeometry
  private readonly ticketMaterial: THREE.MeshPhysicalMaterial
  private ticketMesh: THREE.InstancedMesh
  private readonly textureLoader = new THREE.TextureLoader()
  private readonly targetPosition = new THREE.Vector3()
  private readonly targetQuaternion = new THREE.Quaternion()
  private readonly targetEuler = new THREE.Euler()
  private disposed = false
  private frameIndex = 0
  private frameTimeEma = 1 / 60
  private giftImpulse = 0
  private lastFrameTime = 0
  private logoTexture!: THREE.Texture
  private lost = false
  private machineTheme: 'arcade' | 'galactic-palace' = 'arcade'
  private nextAdaptiveQualityChangeAt = 0
  private shake = 0
  private shadowFrameInterval = 1
  private shadowRefreshPending = true
  private themeReveal = 1
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
    this.machineRoot.add(this.bodyMesh)
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
    this.machineRoot.add(this.galacticCoinRimMesh)

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
    this.machineRoot.add(this.mysteryMesh, this.ticketMesh)

    this.goldMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      color: GOLD,
      emissive: 0x6d3700,
      emissiveIntensity: 0.08,
      envMapIntensity: 0.8,
      metalness: 1,
      roughness: 0.3,
    })
    this.platformMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.22,
      clearcoatRoughness: 0.48,
      color: 0x19324b,
      emissive: 0x071827,
      emissiveIntensity: 0.04,
      envMapIntensity: 0.4,
      metalness: 0.08,
      roughness: 0.76,
    })
    this.movingDeckSurfaceMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.38,
      clearcoatRoughness: 0.38,
      color: 0x111827,
      emissive: 0x03111d,
      emissiveIntensity: 0.06,
      envMapIntensity: 0.48,
      metalness: 0.18,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      roughness: 0.68,
    })
    this.plinkoMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.18,
      clearcoatRoughness: 0.56,
      color: 0x0b1324,
      emissive: 0x030815,
      emissiveIntensity: 0.035,
      envMapIntensity: 0.26,
      metalness: 0.06,
      roughness: 0.82,
    })
    this.galacticPlinkoSurfaceMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.42,
      clearcoatRoughness: 0.3,
      color: 0x080713,
      emissive: 0x030108,
      emissiveIntensity: 0.025,
      envMapIntensity: 0.42,
      metalness: 0.08,
      roughness: 0.58,
      side: THREE.DoubleSide,
    })
    this.pusherGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x9af7ff,
      emissive: CYAN,
      emissiveIntensity: 0.9,
      metalness: 0.25,
      roughness: 0.32,
    })
    this.sideGuardFrameMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.88,
      clearcoatRoughness: 0.16,
      color: 0x101a28,
      emissive: 0x06101e,
      emissiveIntensity: 0.1,
      envMapIntensity: 0.86,
      metalness: 0.94,
      roughness: 0.24,
    })
    this.sideGuardGlowMaterial = new THREE.MeshStandardMaterial({
      color: 0x8cf7ff,
      emissive: CYAN,
      emissiveIntensity: 0.88,
      metalness: 0.28,
      roughness: 0.2,
    })
    this.pointTexture = createSoftPointTexture()

    this.platformSurface = this.buildMachine()
    this.buildSideGuards()
    this.ensurePegs()
    this.buildGalacticTheme()
    this.starField = this.buildStars()

    this.particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particlePositions, 3).setUsage(THREE.DynamicDrawUsage),
    )
    this.particleGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.particleColors, 3).setUsage(THREE.DynamicDrawUsage),
    )
    this.particleGeometry.setDrawRange(0, 0)
    this.particleMaterial = new THREE.PointsMaterial({
      alphaTest: 0.006,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: this.pointTexture,
      opacity: 0.55,
      size: 0.085,
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true,
    })
    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial)
    this.particlePoints.frustumCulled = false
    this.particlePoints.renderOrder = 15
    this.machineRoot.add(this.particlePoints)
    this.machineRoot.add(this.floatingScoreGroup)

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

    this.textureLoader.setCrossOrigin('anonymous')
    this.avatarImageLoader.setCrossOrigin('anonymous')
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

    canvas.addEventListener('webglcontextlost', this.handleContextLost)
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored)
    this.resize()
  }

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
    this.ensurePlatformTexture(frame.platformImageUrl)
    this.ensurePlinkoTexture(frame.plinkoImageUrl || '')
    this.ensurePegs(frame.pegs)
    this.scoreMultiplier = Number.isFinite(Number(frame.scoreMultiplier))
      ? THREE.MathUtils.clamp(Number(frame.scoreMultiplier), 0, 100)
      : 1
    this.ensureScoreSlots(frame.scoreSlots)
    this.syncCoins(frame.coins)
    this.syncParticles(frame.particles)
    this.syncFloatingScores(frame.floatingScores)

    this.pusherGroup.position.z = logicalShelfZ(frame.pusherY)
    this.updateSideGuards(
      frame.sideGuardProgress,
      frame.sideLossEnabled,
      frame.coins,
      frame.time,
    )
    this.pusherGlowMaterial.emissiveIntensity = THREE.MathUtils.damp(
      this.pusherGlowMaterial.emissiveIntensity,
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
    this.updateMachineThemeAnimation(frame.time, delta)
    this.updateScoreFlashes(delta)

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

  giftBurst(coinCount: number) {
    const normalized = THREE.MathUtils.clamp(Math.sqrt(Math.max(1, coinCount)) / 9, 0.2, 1)
    this.giftImpulse = Math.max(this.giftImpulse, 0.45 + normalized * 0.8)
    this.shake = Math.max(this.shake, normalized * 0.65)
  }

  scoreBurst(logicalX: number, points: number) {
    const normalizedX = THREE.MathUtils.clamp(
      (logicalX - PLINKO_LEFT) / (PLINKO_RIGHT - PLINKO_LEFT),
      0,
      0.9999,
    )
    const index = Math.min(
      Math.max(0, this.scoreMaterials.length - 1),
      Math.floor(normalizedX * Math.max(1, this.scoreMaterials.length)),
    )
    if (this.scoreMaterials[index]) {
      this.scoreImpulses[index] = Math.max(
        this.scoreImpulses[index] || 0,
        points >= 20 ? 1.35 : 1,
      )
    }
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

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost)
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored)

    this.platformTextureState.token += 1
    this.plinkoTextureState.token += 1
    this.platformTextureState.texture?.dispose()
    this.plinkoTextureState.texture?.dispose()
    this.environmentTexture.dispose()
    this.bodyMesh.dispose()
    this.galacticCoinRimMesh.dispose()
    this.avatarAtlasLoadQueue.splice(0)
    this.avatarAtlasEntries.clear()
    for (const page of this.avatarAtlasPages.values()) this.disposeAvatarAtlasPage(page)
    this.avatarAtlasPages.clear()
    this.circleGeometry.dispose()
    for (const [id, resource] of this.floatingScoreSprites) {
      this.releaseFloatingScore(id, resource)
    }
    for (const resource of this.floatingScorePool) resource.material.dispose()
    for (const resource of this.floatingScoreTextures.values()) resource.texture.dispose()

    disposeObject(this.scene)
    for (const pass of this.composer.passes) pass.dispose?.()
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
    this.floatingScorePool.splice(0)
    this.floatingScoreTextures.clear()
    this.galacticCoinRimColorCache.clear()
    this.poseByCoinId.clear()
  }

  private buildMachine() {
    this.machineRoot.add(this.classicHeaderGroup, this.classicDecorRoot)
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
      this.machineRoot,
      [7.55, 6.85, 0.42],
      [0, 6.18, -3.8],
      gunmetal,
      0.2,
      true,
    )
    this.classicPlinkoInsetShell = addRoundedBox(
      this.machineRoot,
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
      this.plinkoMaterial,
    )
    plinkoSurface.position.set(0, 6.04, -3.382)
    plinkoSurface.receiveShadow = true
    plinkoSurface.renderOrder = 1
    this.classicPlinkoSurface = plinkoSurface
    this.machineRoot.add(plinkoSurface)
    addRoundedBox(this.machineRoot, [7.72, 1.16, 0.72], [0, 9.49, -3.45], gunmetal, 0.16, true)
    addRoundedBox(this.machineRoot, [7.46, 0.07, 0.76], [0, 10.02, -3.44], this.goldMaterial, 0.025, true)
    addRoundedBox(this.machineRoot, [7.46, 0.07, 0.76], [0, 8.96, -3.44], this.goldMaterial, 0.025, true)
    addRoundedBox(this.machineRoot, [0.34, 6.25, 0.58], [-3.67, 6.22, -3.42], this.goldMaterial, 0.1, true)
    addRoundedBox(this.machineRoot, [0.34, 6.25, 0.58], [3.67, 6.22, -3.42], this.goldMaterial, 0.1, true)

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

    addRoundedBox(this.machineRoot, [7.25, 0.3, 6.5], [0, 2.17, -0.03], gunmetal, 0.12, true)
    const platform = new THREE.Mesh(new THREE.PlaneGeometry(6.84, 6.08), this.platformMaterial)
    platform.rotation.x = -Math.PI / 2
    platform.position.set(0, 2.335, -0.08)
    platform.receiveShadow = true
    platform.renderOrder = 1
    this.machineRoot.add(platform)

    addRoundedBox(this.machineRoot, [0.22, 0.58, 6.55], [-3.52, 2.53, -0.02], this.goldMaterial, 0.07, true)
    addRoundedBox(this.machineRoot, [0.22, 0.58, 6.55], [3.52, 2.53, -0.02], this.goldMaterial, 0.07, true)
    addBox(this.machineRoot, [0.055, 5.1, 6.35], [-3.66, 5.05, -0.08], glass)
    addBox(this.machineRoot, [0.055, 5.1, 6.35], [3.66, 5.05, -0.08], glass)

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
      this.pusherGlowMaterial,
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
      this.movingDeckSurfaceMaterial,
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
      this.goldMaterial,
      0.026,
      true,
    )
    this.pusherGroup.position.z = logicalShelfZ(PUSHER_BASE_Y)
    this.machineRoot.add(this.pusherGroup)

    // This fascia sits below and behind the score lanes so it frames them
    // without occluding their floors, dividers and labels from the camera.
    addRoundedBox(this.machineRoot, [7.06, 2.52, 0.18], [0, 0.15, 2.76], scoreBayMaterial, 0.09, true)
    addRoundedBox(this.machineRoot, [7.08, 0.18, 1.56], [0, -1.06, 3.5], scoreBayMaterial, 0.07, true)
    addRoundedBox(this.machineRoot, [7.7, 0.68, 0.86], [0, -1.42, 3.12], gunmetal, 0.18, true)
    addRoundedBox(this.machineRoot, [7.35, 0.24, 1.65], [0, 1.82, 3.22], this.goldMaterial, 0.08, true)
    addRoundedBox(this.machineRoot, [0.42, 3.55, 1.5], [-3.67, 0.35, 3.47], this.goldMaterial, 0.1, true)
    addRoundedBox(this.machineRoot, [0.42, 3.55, 1.5], [3.67, 0.35, 3.47], this.goldMaterial, 0.1, true)
    addBox(this.classicDecorRoot, [0.035, 2.12, 0.035], [-3.34, 0.12, 2.88], softCyanNeon)
    addBox(this.classicDecorRoot, [0.035, 2.12, 0.035], [3.34, 0.12, 2.88], softCyanNeon)

    this.machineRoot.add(this.scoreGroup)
    return platform
  }

  private buildSideGuards() {
    this.sideGuardRoot.name = 'coin-pusher-side-guards'
    for (const side of [-1, 1] as const) {
      const rail = addRoundedBox(
        this.sideGuardRoot,
        [0.19, 0.62, 5.74],
        [side * 3.27, 0, -0.02],
        this.sideGuardFrameMaterial,
        0.065,
        true,
      )
      rail.castShadow = true
      const innerX = side * 3.16
      addRoundedBox(
        this.sideGuardRoot,
        [0.034, 0.12, 5.46],
        [innerX, 0.17, -0.03],
        this.sideGuardGlowMaterial,
        0.012,
      )
      addRoundedBox(
        this.sideGuardRoot,
        [0.24, 0.15, 0.34],
        [side * 3.27, 0.26, -2.76],
        this.goldMaterial,
        0.045,
        true,
      )
      addRoundedBox(
        this.sideGuardRoot,
        [0.24, 0.15, 0.34],
        [side * 3.27, 0.26, 2.72],
        this.goldMaterial,
        0.045,
        true,
      )
      for (let segment = 0; segment < 5; segment += 1) {
        const marker = addRoundedBox(
          this.sideGuardRoot,
          [0.032, 0.16, 0.28],
          [innerX, -0.1, -2.12 + segment * 1.06],
          this.sideGuardGlowMaterial,
          0.01,
        )
        marker.rotation.x = Math.PI / 4
      }
    }
    this.sideGuardRoot.position.y = 2.65
    this.sideGuardRoot.renderOrder = 8
    this.machineRoot.add(this.sideGuardRoot)
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
    this.sideGuardGlowMaterial.emissiveIntensity = (
      (this.machineTheme === 'galactic-palace' ? 0.66 : 0.84)
      + Math.sin(time * 4.6) * 0.08
      + this.sideGuardVisualProgress * 0.16
    )
  }

  private buildGalacticTheme() {
    const obsidian = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.86,
      clearcoatRoughness: 0.18,
      color: 0x03050b,
      emissive: 0x010106,
      emissiveIntensity: 0.025,
      envMapIntensity: 0.72,
      metalness: 0.94,
      roughness: 0.23,
    })
    const obsidianInset = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.58,
      clearcoatRoughness: 0.26,
      color: 0x080817,
      emissive: 0x03010a,
      emissiveIntensity: 0.04,
      envMapIntensity: 0.62,
      metalness: 0.78,
      roughness: 0.3,
    })
    const royalGold = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      color: 0xe4b55a,
      emissive: 0x291300,
      emissiveIntensity: 0.025,
      envMapIntensity: 1,
      metalness: 1,
      roughness: 0.19,
    })
    const antiqueGold = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.88,
      clearcoatRoughness: 0.14,
      color: 0xb9822c,
      emissive: 0x160900,
      emissiveIntensity: 0.02,
      envMapIntensity: 0.92,
      metalness: 0.98,
      roughness: 0.26,
    })
    const cyanNeon = neonMaterial(0x19bfff, 0.66)
    const electricCyan = neonMaterial(0x55dfff, 0.82)
    const violetNeon = neonMaterial(0x7136ff, 0.7)
    const magentaNeon = neonMaterial(0xe62abb, 0.68)
    const warmNeon = neonMaterial(0xdca94b, 0.16)
    const deepBronze = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.58,
      clearcoatRoughness: 0.24,
      color: 0x6b431d,
      envMapIntensity: 0.82,
      metalness: 0.98,
      roughness: 0.3,
    })
    for (const [index, material] of [
      cyanNeon,
      electricCyan,
      violetNeon,
      magentaNeon,
      warmNeon,
    ].entries()) {
      material.userData.baseEmissiveIntensity = material.emissiveIntensity
      material.userData.pulsePhase = index * 1.37
      material.userData.pulseSpeed = 0.62 + index * 0.075
      this.galacticPulseMaterials.push(material)
    }

    const root = this.galacticThemeRoot
    root.name = 'coin-pusher-galactic-palace'
    root.visible = false
    this.machineRoot.add(root)

    // Low-poly jewel lamps add life throughout the cabinet for only four
    // instanced draw calls. Each colour breathes at its own slow cadence; the
    // whole installation remains under the theme root and therefore disappears
    // completely when the classic machine is selected.
    const ambientAccentGeometry = new THREE.OctahedronGeometry(0.064, 0)
    const ambientAccentLayouts: Array<{
      color: number
      positions: readonly [number, number, number][]
    }> = [
      {
        color: 0x43dcff,
        positions: [
          [-3.04, 10.5, -2.97],
          [-3.43, 8.48, -2.78],
          [-3.49, 6.83, -2.43],
          [-3.54, 5.12, -2.06],
          [-3.63, 2.42, 2.78],
          [-2.54, -1.18, 3.65],
        ],
      },
      {
        color: 0x8e61ff,
        positions: [
          [3.04, 10.5, -2.97],
          [3.43, 8.48, -2.78],
          [3.49, 6.83, -2.43],
          [3.54, 5.12, -2.06],
          [3.63, 2.42, 2.78],
          [2.54, -1.18, 3.65],
        ],
      },
      {
        color: 0xf04bc8,
        positions: [
          [-2.3, 10.54, -3.05],
          [2.3, 10.54, -3.05],
          [-3.65, 3.55, -1.72],
          [3.65, 3.55, -1.72],
          [-1.34, -1.2, 3.72],
          [1.34, -1.2, 3.72],
        ],
      },
      {
        color: 0xffcb62,
        positions: [
          [-1.5, 10.57, -3.08],
          [1.5, 10.57, -3.08],
          [-3.56, 4.3, -1.9],
          [3.56, 4.3, -1.9],
          [-0.42, -1.2, 3.74],
          [0.42, -1.2, 3.74],
        ],
      },
    ]
    for (let accentIndex = 0; accentIndex < ambientAccentLayouts.length; accentIndex += 1) {
      const layout = ambientAccentLayouts[accentIndex]
      const material = new THREE.MeshStandardMaterial({
        color: layout.color,
        emissive: layout.color,
        emissiveIntensity: 0.46,
        metalness: 0.16,
        roughness: 0.18,
      })
      const hsl = { h: 0, s: 0, l: 0 }
      material.color.getHSL(hsl)
      const accents = new THREE.InstancedMesh(
        ambientAccentGeometry,
        material,
        layout.positions.length,
      )
      accents.name = `galactic-ambient-jewels-${accentIndex + 1}`
      for (let index = 0; index < layout.positions.length; index += 1) {
        this.dummy.position.set(...layout.positions[index])
        this.dummy.quaternion.identity()
        this.dummy.rotation.z = Math.PI / 4 + index * 0.31
        const scale = 0.82 + (index % 3) * 0.12
        this.dummy.scale.set(scale, scale * 1.24, scale * 0.72)
        this.dummy.updateMatrix()
        accents.setMatrixAt(index, this.dummy.matrix)
      }
      accents.instanceMatrix.needsUpdate = true
      accents.computeBoundingSphere()
      root.add(accents)
      this.galacticAmbientAccents.push({
        baseHue: hsl.h,
        baseIntensity: 0.34 + accentIndex * 0.025,
        material,
        phase: accentIndex * 1.61,
        pulseRange: 0.22,
        speed: 0.56 + accentIndex * 0.07,
      })
    }

    // --- Celestial casino hall ---------------------------------------------------
    // The cabinet now sits in a deliberate, symmetrical casino interior instead
    // of in front of a black wall. The backdrop stays in its own non-interactive
    // group, behind every gameplay surface, and uses emissive textures/materials
    // rather than extra dynamic lights.
    this.galacticBackdropRoot.name = 'galactic-palace-hall-backdrop'
    root.add(this.galacticBackdropRoot)
    const backdrop = this.galacticBackdropRoot

    const backdropTexture = createGalacticCasinoBackdropTexture()
    const backdropWallMaterial = new THREE.MeshStandardMaterial({
      color: 0xb1a8cf,
      emissive: 0x3b295f,
      emissiveIntensity: 0.16,
      emissiveMap: backdropTexture,
      map: backdropTexture,
      metalness: 0.28,
      roughness: 0.72,
    })
    const backdropMetal = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.7,
      clearcoatRoughness: 0.24,
      color: 0x24223d,
      emissive: 0x080b22,
      emissiveIntensity: 0.13,
      envMapIntensity: 0.72,
      metalness: 0.9,
      roughness: 0.28,
    })
    const backdropCyan = neonMaterial(0x2bcfff, 0.34)
    const backdropViolet = neonMaterial(0x9b4dff, 0.35)
    const backdropWarm = neonMaterial(0xffc968, 0.2)
    for (const [index, material] of [
      backdropCyan,
      backdropViolet,
      backdropWarm,
    ].entries()) {
      material.userData.baseEmissiveIntensity = material.emissiveIntensity
      material.userData.pulsePhase = index * 2.08
    }
    this.galacticBackdropPulseMaterials.push(backdropCyan, backdropViolet, backdropWarm)

    addRoundedBox(
      backdrop,
      [14.6, 13.7, 0.22],
      [0, 4.25, -7.18],
      backdropMetal,
      0.18,
    )
    const hallMural = new THREE.Mesh(
      new THREE.PlaneGeometry(14.25, 13.35),
      backdropWallMaterial,
    )
    hallMural.name = 'galactic-casino-art-deco-mural'
    hallMural.position.set(0, 4.25, -7.045)
    hallMural.castShadow = false
    hallMural.receiveShadow = false
    backdrop.add(hallMural)

    const backdropFloorMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.92,
      clearcoatRoughness: 0.12,
      color: 0x171027,
      depthWrite: false,
      emissive: 0x060718,
      emissiveIntensity: 0.12,
      envMapIntensity: 0.86,
      metalness: 0.34,
      opacity: 0.34,
      roughness: 0.17,
      transparent: true,
    })
    addRoundedBox(
      backdrop,
      [14.4, 0.1, 8.8],
      [0, -1.78, -3.02],
      backdropFloorMaterial,
      0.035,
    )

    // Layered arches give the hall a readable silhouette even around the broad
    // cabinet crown. The coloured quarters meet at the apex like the reference.
    const outerArch = new THREE.Mesh(
      new THREE.TorusGeometry(5.24, 0.15, 12, 72, Math.PI),
      deepBronze,
    )
    outerArch.name = 'galactic-hall-outer-arch'
    outerArch.position.set(0, 4.82, -6.65)
    backdrop.add(outerArch)
    const goldArch = new THREE.Mesh(
      new THREE.TorusGeometry(5.02, 0.07, 10, 72, Math.PI),
      antiqueGold,
    )
    goldArch.name = 'galactic-hall-gold-arch'
    goldArch.position.set(0, 4.82, -6.49)
    backdrop.add(goldArch)
    for (const side of [-1, 1]) {
      const lightArch = new THREE.Mesh(
        new THREE.TorusGeometry(4.82, 0.036, 8, 40, Math.PI / 2),
        side < 0 ? backdropCyan : backdropViolet,
      )
      lightArch.name = side < 0
        ? 'galactic-hall-cyan-arch'
        : 'galactic-hall-violet-arch'
      lightArch.rotation.z = side < 0 ? Math.PI / 2 : 0
      lightArch.position.set(0, 4.82, -6.34)
      backdrop.add(lightArch)
    }

    for (const side of [-1, 1]) {
      const alcove = addRoundedBox(
        backdrop,
        [1.82, 10.72, 0.24],
        [side * 4.76, 4.25, -6.76],
        obsidianInset,
        0.26,
      )
      alcove.name = side < 0
        ? 'galactic-hall-left-alcove'
        : 'galactic-hall-right-alcove'
      const alcoveInset = addRoundedBox(
        backdrop,
        [1.42, 9.98, 0.08],
        [side * 4.76, 4.25, -6.59],
        backdropMetal,
        0.22,
      )
      alcoveInset.name = 'galactic-hall-faceted-inset'

      const column = new THREE.Group()
      column.name = side < 0
        ? 'galactic-hall-left-column'
        : 'galactic-hall-right-column'
      column.position.set(
        side * GALACTIC_BACKDROP_COLUMN_X,
        GALACTIC_BACKDROP_COLUMN_Y,
        GALACTIC_BACKDROP_COLUMN_Z,
      )
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.51, 0.67, 10.45, 32),
        backdropMetal,
      )
      shaft.name = 'galactic-hall-fluted-column-shaft'
      shaft.castShadow = false
      column.add(shaft)
      for (const fluteX of [-0.25, 0, 0.25]) {
        addRoundedBox(
          column,
          [0.045, 8.72, 0.055],
          [fluteX, 0.02, 0.52],
          fluteX === 0 ? backdropWarm : antiqueGold,
          0.012,
        )
      }
      for (const y of [-4.8, -4.12, 4.04, 4.82]) {
        const isCapital = Math.abs(y) > 4.5
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(isCapital ? 0.72 : 0.57, isCapital ? 0.085 : 0.06, 10, 36),
          isCapital ? royalGold : antiqueGold,
        )
        ring.rotation.x = Math.PI / 2
        ring.position.y = y
        column.add(ring)
      }
      const capital = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.58, 0.34, 8),
        royalGold,
      )
      capital.position.y = 4.98
      column.add(capital)
      const jewel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.2, 0),
        side < 0 ? backdropCyan : backdropViolet,
      )
      jewel.position.set(0, 5.34, 0.05)
      jewel.rotation.z = Math.PI / 4
      column.add(jewel)
      addRoundedBox(
        column,
        [0.09, 7.65, 0.1],
        [side * -0.17, 0.06, 0.61],
        side < 0 ? backdropCyan : backdropViolet,
        0.022,
      )
      backdrop.add(column)

      // Perspective rails and jewel sconces fill the side gutters without any
      // new per-frame allocations or shadow-casting lights.
      addBeamBetween3d(
        backdrop,
        [side * 5.55, -1.64, -6.42],
        [side * 3.73, -1.64, 1.26],
        0.048,
        0.055,
        side < 0 ? backdropCyan : backdropViolet,
        0.014,
      )
      const sconceGeometry = new THREE.OctahedronGeometry(0.105, 0)
      const sconces = new THREE.InstancedMesh(
        sconceGeometry,
        side < 0 ? backdropCyan : backdropViolet,
        5,
      )
      sconces.name = side < 0
        ? 'galactic-hall-left-sconces'
        : 'galactic-hall-right-sconces'
      for (let index = 0; index < 5; index += 1) {
        this.dummy.position.set(side * 5.22, 0.38 + index * 1.92, -6.16)
        this.dummy.quaternion.identity()
        this.dummy.rotation.z = Math.PI / 4
        const scale = 0.88 + (index % 2) * 0.18
        this.dummy.scale.set(scale, scale * 1.35, scale * 0.72)
        this.dummy.updateMatrix()
        sconces.setMatrixAt(index, this.dummy.matrix)
      }
      sconces.instanceMatrix.needsUpdate = true
      sconces.computeBoundingSphere()
      backdrop.add(sconces)
    }

    // --- Full-height cabinet silhouette -----------------------------------------
    // One continuous faceted back replaces the rectangular arcade outline. It
    // stays behind the camera-facing Plinko aperture at every height, while the
    // jewellery rails remain naturally in front through the depth buffer.
    addExtrudedPanel(
      root,
      [
        [-3.38, 6],
        [3.38, 6],
        [3.92, 5.5],
        [4.08, 1.45],
        [4.42, -0.2],
        [4.12, -2.72],
        [4.02, -5.9],
        [-4.02, -5.9],
        [-4.12, -2.72],
        [-4.42, -0.2],
        [-4.08, 1.45],
        [-3.92, 5.5],
      ],
      0.4,
      obsidian,
      [0, 4.28, -6.36],
    )
    addRoundedBox(root, [7.75, 0.58, 0.64], [0, 10.16, -3.86], obsidianInset, 0.11)
    addRoundedBox(root, [7.34, 0.095, 0.7], [0, 10.42, -3.72], antiqueGold, 0.025)
    addRoundedBox(root, [6.98, 0.042, 0.74], [0, 10.29, -3.34], electricCyan, 0.012)
    addRoundedBox(root, [7.6, 0.075, 0.72], [0, 9.89, -3.52], deepBronze, 0.02)
    // Layered crown moulding. Several narrow stepped profiles read as machined
    // metal at portrait scale; broad luminous slabs would flatten this area.
    addRoundedBox(root, [7.22, 0.18, 0.38], [0, 10.62, -3.94], obsidian, 0.045)
    addRoundedBox(root, [6.82, 0.045, 0.43], [0, 10.68, -3.71], royalGold, 0.012)
    addRoundedBox(root, [6.46, 0.075, 0.38], [0, 10.51, -3.43], obsidianInset, 0.018)
    addRoundedBox(root, [5.92, 0.032, 0.12], [0, 10.47, -3.19], antiqueGold, 0.009)
    for (const side of [-1, 1]) {
      const crownCap = addExtrudedPanel(
        root,
        [
          [-0.52, 0.18],
          [0.36, 0.18],
          [0.52, 0],
          [0.34, -0.2],
          [-0.46, -0.2],
          [-0.62, 0],
        ],
        0.18,
        obsidianInset,
        [side * 3.05, 10.48, -3.12],
      )
      crownCap.rotation.y = side < 0 ? 0 : Math.PI
      addRoundedBox(
        root,
        [0.74, 0.045, 0.09],
        [side * 3.04, 10.54, -2.99],
        side < 0 ? electricCyan : violetNeon,
        0.012,
      )
    }

    // Art-Deco stepped rails trace the two cut crown corners and the cabinet's
    // flared side armour. Gold carries the silhouette; cyan/violet stay inlays.
    const upperRailPoints: Array<[[number, number, number], [number, number, number]]> = [
      [[-2.34, 8.92, -3.78], [-3.2, 8.34, -3.58]],
      [[-3.2, 8.34, -3.58], [-3.55, 3.3, -2.54]],
      [[2.34, 8.92, -3.78], [3.2, 8.34, -3.58]],
      [[3.2, 8.34, -3.58], [3.55, 3.3, -2.54]],
    ]
    for (let index = 0; index < upperRailPoints.length; index += 1) {
      const [start, end] = upperRailPoints[index]
      const isLeft = index < 2
      addBeamBetween3d(root, start, end, 0.19, 0.34, deepBronze, 0.055)
      const insetStart: [number, number, number] = [
        start[0] + (isLeft ? 0.085 : -0.085),
        start[1],
        start[2] + 0.2,
      ]
      const insetEnd: [number, number, number] = [
        end[0] + (isLeft ? 0.085 : -0.085),
        end[1],
        end[2] + 0.2,
      ]
      addBeamBetween3d(
        root,
        insetStart,
        insetEnd,
        0.048,
        0.075,
        isLeft ? electricCyan : violetNeon,
        0.014,
      )
    }
    addBeamBetween3d(root, [-2.34, 8.92, -3.78], [2.34, 8.92, -3.78], 0.16, 0.32, antiqueGold, 0.045)
    addBeamBetween3d(
      root,
      [-3.55, 3.3, GALACTIC_REAR_SILL_FRONT_Z - 0.14],
      [3.55, 3.3, GALACTIC_REAR_SILL_FRONT_Z - 0.14],
      0.14,
      0.28,
      antiqueGold,
      0.04,
    )
    // A second, finer profile inside the structural rails supplies the
    // jewellery-like precision visible in the reference cabinet.
    const innerRailPoints: Array<[[number, number, number], [number, number, number]]> = [
      [[-2.22, 8.76, -3.64], [-3.01, 8.2, -3.45]],
      [[-3.01, 8.2, -3.45], [-3.3, 3.45, -2.43]],
      [[2.22, 8.76, -3.64], [3.01, 8.2, -3.45]],
      [[3.01, 8.2, -3.45], [3.3, 3.45, -2.43]],
    ]
    for (let index = 0; index < innerRailPoints.length; index += 1) {
      const [start, end] = innerRailPoints[index]
      addBeamBetween3d(root, start, end, 0.068, 0.12, royalGold, 0.018)
      const lightOffset = index < 2 ? 0.045 : -0.045
      addBeamBetween3d(
        root,
        [start[0] + lightOffset, start[1], start[2] + 0.072],
        [end[0] + lightOffset, end[1], end[2] + 0.072],
        0.022,
        0.035,
        index < 2 ? cyanNeon : violetNeon,
        0.006,
      )
    }
    addBeamBetween3d(root, [-2.2, 8.76, -3.64], [2.2, 8.76, -3.64], 0.066, 0.12, royalGold, 0.018)
    addBeamBetween3d(
      root,
      [-3.28, 3.44, GALACTIC_REAR_SILL_FRONT_Z - 0.055],
      [3.28, 3.44, GALACTIC_REAR_SILL_FRONT_Z - 0.055],
      0.062,
      0.11,
      royalGold,
      0.016,
    )

    // Three-dimensional side armour projects forward around the deep shelves.
    for (const side of [-1, 1]) {
      addBeamBetween3d(
        root,
        [side * 3.58, 3.25, -2.65],
        [side * 4.06, 2.08, 3.15],
        0.43,
        0.5,
        obsidianInset,
        0.1,
      )
      addBeamBetween3d(
        root,
        [side * 3.48, 3.16, -2.48],
        [side * 3.83, 2.16, 3.22],
        0.095,
        0.13,
        antiqueGold,
        0.026,
      )
      addBeamBetween3d(
        root,
        [side * 3.39, 3.05, -2.32],
        [side * 3.7, 2.22, 3.16],
        0.044,
        0.07,
        side < 0 ? cyanNeon : violetNeon,
        0.012,
      )
    }

    // A translucent, deterministic nebula sits over the selected plinko
    // artwork. It adds depth without replacing the image chosen in settings.
    const starPanelTexture = createGalacticPanelTexture()
    const starPanelMaterial = new THREE.MeshBasicMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: starPanelTexture,
      opacity: 0.24,
      toneMapped: false,
      transparent: true,
    })
    this.galacticPlinkoPanelGeometry = createGalacticPlinkoPanelGeometry()
    const selectedArtPanel = new THREE.Mesh(
      this.galacticPlinkoPanelGeometry,
      this.galacticPlinkoSurfaceMaterial,
    )
    selectedArtPanel.receiveShadow = true
    selectedArtPanel.renderOrder = 1
    root.add(selectedArtPanel)
    // The star veil owns its UVs: the selected image is recropped dynamically
    // from its real aspect ratio, while this square procedural texture remains
    // undistorted and cannot reintroduce perspective into the user's artwork.
    const starPanel = new THREE.Mesh(
      createGalacticPlinkoPanelGeometry(),
      starPanelMaterial,
    )
    starPanel.position.copy(GALACTIC_PLINKO_PLANE_NORMAL)
      .multiplyScalar(GALACTIC_PLINKO_VEIL_OFFSET_Z)
    starPanel.renderOrder = 2
    root.add(starPanel)

    // Deep, faceted outer towers reproduce the monumental casino cabinet of
    // the reference while the original collision space stays untouched.
    addRoundedBox(root, [0.76, 7.26, 0.68], [-3.91, 6.2, -3.36], obsidian, 0.12, true)
    addRoundedBox(root, [0.76, 7.26, 0.68], [3.91, 6.2, -3.36], obsidian, 0.12, true)
    addRoundedBox(root, [0.3, 6.82, 0.77], [-3.6, 6.14, -3.19], antiqueGold, 0.065)
    addRoundedBox(root, [0.3, 6.82, 0.77], [3.6, 6.14, -3.19], antiqueGold, 0.065)
    addRoundedBox(root, [0.09, 5.96, 0.09], [-3.39, 6.1, -2.89], electricCyan, 0.025)
    addRoundedBox(root, [0.09, 5.96, 0.09], [3.39, 6.1, -2.89], electricCyan, 0.025)

    for (const side of [-1, 1]) {
      const x = side * 3.88
      const upperFacet = addRoundedBox(
        root,
        [0.54, 1.42, 0.74],
        [x, 8.75, -3.18],
        obsidianInset,
        0.09,
      )
      upperFacet.rotation.z = side * -0.18
      const upperGold = addRoundedBox(
        root,
        [0.09, 1.24, 0.79],
        [side * 3.59, 8.67, -2.95],
        royalGold,
        0.025,
      )
      upperGold.rotation.z = side * -0.18

      const lowerFacet = addRoundedBox(
        root,
        [0.62, 1.72, 0.82],
        [side * 3.79, 3.52, -2.18],
        obsidianInset,
        0.1,
      )
      lowerFacet.rotation.z = side * 0.16
      const lowerNeon = addRoundedBox(
        root,
        [0.075, 1.38, 0.09],
        [side * 3.52, 3.55, -1.79],
        side < 0 ? cyanNeon : magentaNeon,
        0.02,
      )
      lowerNeon.rotation.z = side * 0.16
    }

    // Recessed side cassettes break up the tall pillars into believable
    // manufactured modules. Their tiny gems are instanced as one draw call.
    for (const side of [-1, 1]) {
      for (let moduleIndex = 0; moduleIndex < 3; moduleIndex += 1) {
        const moduleY = 4.48 + moduleIndex * 1.45
        const module = addExtrudedPanel(
          root,
          [
            [-0.23, 0.54],
            [0.15, 0.54],
            [0.28, 0.35],
            [0.24, -0.43],
            [0.07, -0.56],
            [-0.22, -0.47],
            [-0.3, 0.32],
          ],
          0.12,
          obsidianInset,
          [side * 3.78, moduleY, -2.91],
        )
        module.rotation.y = side < 0 ? 0 : Math.PI
        addRoundedBox(
          root,
          [0.035, 0.72, 0.035],
          [side * 3.54, moduleY, -2.77],
          side < 0 ? cyanNeon : violetNeon,
          0.007,
        )
      }
    }
    const trimStudGeometry = new THREE.OctahedronGeometry(0.052, 0)
    const trimStuds = new THREE.InstancedMesh(trimStudGeometry, royalGold, 16)
    for (let index = 0; index < 16; index += 1) {
      const side = index < 8 ? -1 : 1
      const row = index % 8
      const progress = row / 7
      this.dummy.position.set(
        side * THREE.MathUtils.lerp(3.4, 3.52, progress),
        THREE.MathUtils.lerp(3.75, 8.56, progress),
        THREE.MathUtils.lerp(-2.38, -3.46, progress),
      )
      this.dummy.quaternion.identity()
      this.dummy.rotation.z = Math.PI / 4
      this.dummy.scale.set(1, 1.35, 0.6)
      this.dummy.updateMatrix()
      trimStuds.setMatrixAt(index, this.dummy.matrix)
    }
    trimStuds.instanceMatrix.needsUpdate = true
    trimStuds.renderOrder = 3
    root.add(trimStuds)

    addRoundedBox(root, [8.2, 1.34, 0.72], [0, 9.62, -3.3], obsidian, 0.18, true)
    addRoundedBox(root, [7.72, 0.22, 0.82], [0, 10.14, -3.17], royalGold, 0.055)
    addRoundedBox(root, [7.54, 0.065, 0.12], [0, 10.02, -2.76], electricCyan, 0.02)

    const leftWingBacking = addRoundedBox(
      root,
      [2.96, 0.34, 0.34],
      [-1.78, 9.55, -2.91],
      obsidianInset,
      0.055,
    )
    leftWingBacking.rotation.z = -0.16
    const rightWingBacking = addRoundedBox(
      root,
      [2.96, 0.34, 0.34],
      [1.78, 9.55, -2.91],
      obsidianInset,
      0.055,
    )
    rightWingBacking.rotation.z = 0.16
    const leftWing = addRoundedBox(
      root,
      [2.74, 0.18, 0.32],
      [-1.78, 9.58, -2.76],
      antiqueGold,
      0.045,
    )
    leftWing.rotation.z = -0.16
    const rightWing = addRoundedBox(
      root,
      [2.74, 0.18, 0.32],
      [1.78, 9.58, -2.76],
      antiqueGold,
      0.045,
    )
    rightWing.rotation.z = 0.16
    const leftWingFillet = addRoundedBox(
      root,
      [2.36, 0.035, 0.05],
      [-1.86, 9.48, -2.53],
      royalGold,
      0.008,
    )
    leftWingFillet.rotation.z = -0.16
    const rightWingFillet = addRoundedBox(
      root,
      [2.36, 0.035, 0.05],
      [1.86, 9.48, -2.53],
      royalGold,
      0.008,
    )
    rightWingFillet.rotation.z = 0.16
    const leftWingLight = addRoundedBox(
      root,
      [2.16, 0.065, 0.09],
      [-1.9, 9.72, -2.54],
      cyanNeon,
      0.018,
    )
    leftWingLight.rotation.z = -0.16
    const rightWingLight = addRoundedBox(
      root,
      [2.16, 0.065, 0.09],
      [1.9, 9.72, -2.54],
      violetNeon,
      0.018,
    )
    rightWingLight.rotation.z = 0.16

    // Central heraldic crest: a gold shield, concentric metal rings and an
    // animated amethyst. It replaces only the classic header in this theme.
    this.galacticCrest.position.set(0, 9.58, -2.62)
    this.galacticCrest.name = 'galactic-amethyst-crest'
    root.add(this.galacticCrest)
    addExtrudedPanel(
      this.galacticCrest,
      [
        [-0.66, 0.35],
        [0, 0.92],
        [0.66, 0.35],
        [0.48, -0.58],
        [0, -0.98],
        [-0.48, -0.58],
      ],
      0.18,
      obsidianInset,
      [0, 0, 0],
    )
    const outerCrestRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.67, 0.085, 16, 64),
      royalGold,
    )
    outerCrestRing.position.z = 0.19
    const innerCrestRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.035, 12, 56),
      antiqueGold,
    )
    innerCrestRing.position.z = 0.245
    this.galacticCrest.add(outerCrestRing, innerCrestRing)

    this.galacticDiamondMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      color: 0xb968ff,
      emissive: 0x5d13ae,
      emissiveIntensity: 0.22,
      envMapIntensity: 1.62,
      flatShading: true,
      ior: 2.05,
      metalness: 0.08,
      roughness: 0.055,
      thickness: 0.88,
      transmission: 0.16,
    })
    this.galacticDiamond.name = 'galactic-amethyst-diamond-pivot'
    this.galacticDiamond.position.z = 0.34
    this.galacticDiamond.rotation.y = Math.PI / 8
    this.galacticDiamond.scale.set(0.82, 0.86, 0.72)
    const gem = new THREE.Mesh(
      createBrilliantDiamondGeometry(),
      this.galacticDiamondMaterial,
    )
    gem.name = 'galactic-amethyst'
    gem.castShadow = true
    this.galacticDiamond.add(gem)
    this.galacticCrest.add(this.galacticDiamond)

    const crestGlowMaterial = new THREE.SpriteMaterial({
      blending: THREE.AdditiveBlending,
      color: 0xac56ff,
      depthTest: true,
      depthWrite: false,
      map: this.pointTexture,
      opacity: 0.09,
      toneMapped: false,
      transparent: true,
    })
    const crestGlow = new THREE.Sprite(crestGlowMaterial)
    crestGlow.position.z = 0.08
    crestGlow.scale.set(1.65, 1.65, 1)
    crestGlow.renderOrder = 7
    this.galacticCrest.add(crestGlow)

    addRoundedBox(root, [1.72, 0.24, 0.19], [0, 8.98, -2.82], obsidian, 0.05)
    addRoundedBox(root, [1.5, 0.028, 0.045], [0, 9.08, -2.7], warmNeon, 0.009)
    const galacticBrandMaterial = new THREE.MeshStandardMaterial({
      alphaTest: 0.012,
      color: 0xfff7df,
      emissive: 0x8fdfff,
      emissiveIntensity: 0.06,
      emissiveMap: this.logoTexture,
      map: this.logoTexture,
      metalness: 0.08,
      roughness: 0.28,
      transparent: true,
    })
    const galacticBrand = new THREE.Mesh(
      new THREE.PlaneGeometry(1.34, 0.25),
      galacticBrandMaterial,
    )
    galacticBrand.position.set(0, 8.98, -2.695)
    galacticBrand.renderOrder = 8
    root.add(galacticBrand)

    // Gold navigation chevrons and layered lower corners frame the live
    // plinko action without covering any playable region.
    for (const side of [-1, 1]) {
      const arrow = addExtrudedPanel(
        root,
        [
          [-0.32, 0.38],
          [0.16, 0],
          [-0.32, -0.38],
          [-0.14, -0.38],
          [0.34, 0],
          [-0.14, 0.38],
        ],
        0.075,
        warmNeon,
        [side * 3.04, 6.15, -3.01],
      )
      arrow.rotation.y = side < 0 ? 0 : Math.PI
    }

    // The lower Plinko sill is a recessed back wall, never a foreground mask.
    // Its underside clears the moving deck and its front face stays behind the
    // largest supported coin, die or ticket at the fixed chute impact point.
    addRoundedBox(
      root,
      [7.45, GALACTIC_REAR_SILL_HEIGHT, GALACTIC_REAR_SILL_DEPTH],
      [0, GALACTIC_REAR_SILL_CENTER_Y, GALACTIC_REAR_SILL_CENTER_Z],
      obsidianInset,
      0.06,
    )
    addRoundedBox(
      root,
      [6.92, 0.055, GALACTIC_REAR_SILL_TRIM_DEPTH],
      [0, 3.19, GALACTIC_REAR_SILL_TRIM_CENTER_Z],
      warmNeon,
      0.018,
    )
    addRoundedBox(root, [0.54, 1.28, 1.15], [-3.48, 2.7, -2.28], obsidian, 0.1)
    addRoundedBox(root, [0.54, 1.28, 1.15], [3.48, 2.7, -2.28], obsidian, 0.1)
    for (const side of [-1, 1]) {
      const lowerCorner = addExtrudedPanel(
        root,
        [
          [-0.5, 0.52],
          [0.22, 0.52],
          [0.48, 0.18],
          [0.4, -0.42],
          [0.08, -0.58],
          [-0.46, -0.38],
        ],
        0.38,
        obsidianInset,
        [side * 3.18, 3.08, -2.08],
      )
      lowerCorner.rotation.y = side < 0 ? 0 : Math.PI
      const lowerCornerTrim = addBeamBetween3d(
        root,
        [side * 2.78, 3.4, -1.82],
        [side * 3.29, 2.75, -1.61],
        0.07,
        0.08,
        royalGold,
        0.015,
      )
      lowerCornerTrim.renderOrder = 4
      addRoundedBox(
        root,
        [0.32, 0.055, 0.09],
        [side * 3.2, 2.75, -1.54],
        side < 0 ? electricCyan : magentaNeon,
        0.012,
      )
    }

    // Sculpted shelf armour and illuminated score-bank surround.
    addRoundedBox(root, [7.38, 0.42, 0.48], [0, 2.12, 3.12], obsidian, 0.09)
    addRoundedBox(root, [7.05, 0.075, 0.18], [0, 2.33, 3.23], antiqueGold, 0.02)
    addRoundedBox(root, [6.58, 0.038, 0.08], [0, 2.39, 3.34], warmNeon, 0.012)
    addRoundedBox(root, [6.74, 0.085, 0.3], [0, 1.96, 3.18], deepBronze, 0.022)
    addRoundedBox(root, [6.26, 0.025, 0.08], [0, 2.01, 3.36], royalGold, 0.007)
    for (const side of [-1, 1]) {
      addExtrudedPanel(
        root,
        [
          [-0.44, 0.28],
          [0.28, 0.28],
          [0.44, 0],
          [0.22, -0.42],
          [-0.35, -0.42],
          [-0.52, -0.05],
        ],
        0.28,
        side < 0 ? cyanNeon : violetNeon,
        [side * 3.35, 2.23, 3.35],
      ).rotation.y = side < 0 ? 0 : Math.PI
    }
    addRoundedBox(root, [0.5, 1.16, 6.55], [-3.72, 2.54, -0.02], obsidian, 0.1)
    addRoundedBox(root, [0.5, 1.16, 6.55], [3.72, 2.54, -0.02], obsidian, 0.1)
    addRoundedBox(root, [0.09, 0.09, 5.9], [-3.4, 2.93, 0.12], cyanNeon, 0.024)
    addRoundedBox(root, [0.09, 0.09, 5.9], [3.4, 2.93, 0.12], electricCyan, 0.024)
    for (const side of [-1, 1]) {
      for (let segment = 0; segment < 3; segment += 1) {
        const segmentZ = -2.03 + segment * 2.06
        const sideCassette = addRoundedBox(
          root,
          [0.32, 0.42, 1.66],
          [side * 3.48, 2.6, segmentZ],
          obsidianInset,
          0.055,
        )
        sideCassette.rotation.z = side * (segment % 2 ? 0.045 : -0.045)
        addRoundedBox(
          root,
          [0.035, 0.22, 1.26],
          [side * 3.29, 2.67, segmentZ],
          side < 0
            ? segment === 1 ? violetNeon : cyanNeon
            : segment === 1 ? magentaNeon : violetNeon,
          0.008,
        )
        addRoundedBox(
          root,
          [0.055, 0.055, 1.48],
          [side * 3.37, 2.89, segmentZ],
          antiqueGold,
          0.012,
        )
      }
    }
    addRoundedBox(root, [7.74, 0.82, 1.04], [0, -1.5, 3.12], obsidian, 0.16)
    addRoundedBox(root, [7.26, 0.13, 1.1], [0, -1.16, 3.15], royalGold, 0.04)
    addRoundedBox(root, [7.38, 0.18, 0.64], [0, -1.86, 3.1], obsidianInset, 0.06)
    addRoundedBox(root, [6.94, 0.038, 0.7], [0, -1.76, 3.23], antiqueGold, 0.011)
    addRoundedBox(root, [5.72, 0.022, 0.12], [0, -1.71, 3.6], warmNeon, 0.006)
    addRoundedBox(root, [0.58, 3.75, 1.72], [-3.78, 0.22, 3.44], obsidian, 0.11)
    addRoundedBox(root, [0.58, 3.75, 1.72], [3.78, 0.22, 3.44], obsidian, 0.11)
    addRoundedBox(root, [0.075, 2.7, 0.075], [-3.47, 0.18, 2.62], cyanNeon, 0.02)
    addRoundedBox(root, [0.075, 2.7, 0.075], [3.47, 0.18, 2.62], magentaNeon, 0.02)
    for (const side of [-1, 1]) {
      const scoreShoulder = addExtrudedPanel(
        root,
        [
          [-0.36, 0.68],
          [0.24, 0.5],
          [0.34, -0.5],
          [0.08, -0.74],
          [-0.4, -0.55],
        ],
        0.22,
        deepBronze,
        [side * 3.54, 0.04, 3.7],
      )
      scoreShoulder.rotation.y = side < 0 ? 0 : Math.PI
      addRoundedBox(
        root,
        [0.035, 0.92, 0.055],
        [side * 3.32, 0.08, 3.83],
        side < 0 ? cyanNeon : violetNeon,
        0.008,
      )
    }

    this.galacticPusherThemeRoot.name = 'galactic-pusher-skin'
    this.galacticPusherThemeRoot.visible = false
    this.pusherGroup.add(this.galacticPusherThemeRoot)
    addRoundedBox(
      this.galacticPusherThemeRoot,
      [6.3, 0.22, 0.16],
      [0, 2.56, PUSHER_FACE_LOCAL_Z + 0.12],
      obsidian,
      0.045,
    )
    addRoundedBox(
      this.galacticPusherThemeRoot,
      [5.92, 0.052, 0.06],
      [0, 2.63, PUSHER_FACE_LOCAL_Z + 0.215],
      electricCyan,
      0.016,
    )
    addRoundedBox(
      this.galacticPusherThemeRoot,
      [6.42, 0.075, 0.12],
      [0, 2.91, PUSHER_FACE_LOCAL_Z + 0.08],
      antiqueGold,
      0.022,
    )
    addRoundedBox(
      this.galacticPusherThemeRoot,
      [5.46, 0.035, 0.06],
      [0, 2.955, PUSHER_FACE_LOCAL_Z + 0.155],
      warmNeon,
      0.01,
    )
    for (const side of [-1, 1]) {
      const pusherFacet = addRoundedBox(
        this.galacticPusherThemeRoot,
        [0.54, 0.28, 0.23],
        [side * 3.06, 2.6, PUSHER_FACE_LOCAL_Z + 0.17],
        royalGold,
        0.045,
      )
      pusherFacet.rotation.z = side * 0.16
    }
  }

  private applyMachineTheme(theme: string | undefined) {
    const nextTheme = String(theme || '').trim().toLowerCase() === 'galactic-palace'
      ? 'galactic-palace'
      : 'arcade'
    if (nextTheme === this.machineTheme) return

    this.machineTheme = nextTheme
    const isGalactic = nextTheme === 'galactic-palace'
    this.classicDecorRoot.visible = !isGalactic
    this.classicHeaderGroup.visible = !isGalactic
    this.classicPegRoot.visible = !isGalactic
    this.classicPlinkoBackShell.visible = !isGalactic
    this.classicPlinkoInsetShell.visible = !isGalactic
    this.classicPlinkoSurface.visible = !isGalactic
    this.galacticThemeRoot.visible = isGalactic
    this.galacticPusherThemeRoot.visible = isGalactic
    this.starField.visible = !isGalactic
    this.themeReveal = 0

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setHex(isGalactic ? 0x010108 : 0x01030a)
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setHex(isGalactic ? 0x080319 : 0x030712)
      this.scene.fog.density = isGalactic ? 0.027 : 0.032
    }
    this.renderer.toneMappingExposure = isGalactic ? 0.68 : 0.76
    this.goldMaterial.color.setHex(isGalactic ? 0xe4b55a : GOLD)
    this.goldMaterial.emissive.setHex(isGalactic ? 0x291300 : 0x6d3700)
    this.goldMaterial.emissiveIntensity = isGalactic ? 0.025 : 0.08
    this.bodyMaterial.color.setHex(isGalactic ? 0xe0ad49 : 0xf9cb62)
    this.bodyMaterial.emissive.setHex(isGalactic ? 0x2b1400 : 0x5c3200)
    this.bodyMaterial.emissiveIntensity = isGalactic ? 0.025 : 0.08
    this.pusherGlowMaterial.color.setHex(isGalactic ? 0xcaf8ff : 0x9af7ff)
    this.pusherGlowMaterial.emissive.setHex(isGalactic ? GALACTIC_BLUE : CYAN)
    this.sideGuardFrameMaterial.color.setHex(isGalactic ? 0x090711 : 0x101a28)
    this.sideGuardFrameMaterial.emissive.setHex(isGalactic ? 0x190920 : 0x06101e)
    this.sideGuardFrameMaterial.emissiveIntensity = isGalactic ? 0.14 : 0.1
    this.sideGuardGlowMaterial.color.setHex(isGalactic ? 0x53d9ff : 0x8cf7ff)
    this.sideGuardGlowMaterial.emissive.setHex(isGalactic ? GALACTIC_PURPLE : CYAN)
    this.mysteryMaterial.emissive.setHex(isGalactic ? 0x3f126f : 0x053e68)
    this.ticketMaterial.emissive.setHex(isGalactic ? 0x3b124d : 0x07385c)
    this.cyanLight.color.setHex(isGalactic ? 0x2cbcff : CYAN)
    this.magentaLight.color.setHex(isGalactic ? 0xc34dff : MAGENTA)
    this.keyLight.color.setHex(isGalactic ? 0xffd99a : 0xffd18a)
    this.applyThemeSurfaceColors()

    // Force only the cheap score-lane skin to be rebuilt. Coin instances,
    // avatar buckets, surface textures and all physics-driven poses survive.
    this.scoreSlotValues = []
    this.shadowRefreshPending = true
  }

  private applyThemeSurfaceColors() {
    const isGalactic = this.machineTheme === 'galactic-palace'
    this.platformMaterial.color.setHex(
      this.platformTextureState.texture
        ? isGalactic ? 0xf8f2ff : 0xf1f4f7
        : isGalactic ? 0x0b0a12 : 0x19324b,
    )
    this.movingDeckSurfaceMaterial.color.setHex(
      this.platformTextureState.texture
        ? isGalactic ? 0xf7f1ff : 0xe8edf2
        : isGalactic ? 0x07070c : 0x111827,
    )
    this.plinkoMaterial.color.setHex(
      this.plinkoTextureState.texture
        ? isGalactic ? 0xf7f2ff : 0xf1f4f7
        : isGalactic ? 0x090817 : 0x0b1324,
    )
    this.galacticPlinkoSurfaceMaterial.color.setHex(
      this.plinkoTextureState.texture ? 0xe7def2 : 0x080713,
    )
    this.platformMaterial.emissive.setHex(isGalactic ? 0x030108 : 0x071827)
    this.movingDeckSurfaceMaterial.emissive.setHex(isGalactic ? 0x020106 : 0x03111d)
    this.plinkoMaterial.emissive.setHex(isGalactic ? 0x020106 : 0x030815)
    this.platformMaterial.needsUpdate = true
    this.movingDeckSurfaceMaterial.needsUpdate = true
    this.plinkoMaterial.needsUpdate = true
    this.galacticPlinkoSurfaceMaterial.needsUpdate = true
  }

  private updateMachineThemeAnimation(time: number, delta: number) {
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
      material.emissiveIntensity = base + easedPulse * 0.075 + this.giftImpulse * 0.045
    }
    for (let index = 0; index < this.galacticBackdropPulseMaterials.length; index += 1) {
      const material = this.galacticBackdropPulseMaterials[index]
      const base = Number(material.userData.baseEmissiveIntensity) || 0.2
      const phase = Number(material.userData.pulsePhase) || 0
      const pulse = (Math.sin(time * GALACTIC_BACKDROP_PULSE_SPEED + phase) + 1) * 0.5
      material.emissiveIntensity = (
        base
        + pulse * GALACTIC_BACKDROP_PULSE_RANGE
        + this.giftImpulse * 0.025
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
        + this.giftImpulse * 0.035
      )
    }
    this.galacticCrest.rotation.y = Math.sin(time * 0.72) * 0.028
    this.galacticCrest.rotation.z = Math.sin(time * 0.46) * 0.012
    const crestScale = 1 + Math.sin(time * 2.1) * 0.012 + this.giftImpulse * 0.025
    this.galacticCrest.scale.setScalar(0.82 * crestScale)
    this.galacticDiamond.rotation.x = Math.sin(time * 0.43) * 0.065
    this.galacticDiamond.rotation.y = time * 0.74 + Math.PI / 8
    this.galacticDiamond.rotation.z = Math.sin(time * 0.31) * 0.025
    const diamondSparkle = (Math.sin(time * 1.7) + 1) * 0.5
    this.galacticDiamondMaterial.emissiveIntensity = (
      0.16 + diamondSparkle * 0.12 + this.giftImpulse * 0.075
    )

    // The existing scene point lights remain the only dynamic light sources;
    // a very slow hue drift makes the reflective metal feel alive without
    // adding costly per-light shading or harsh flashes.
    this.cyanLight.color.setHSL(
      0.54 + Math.sin(time * 0.09) * 0.008,
      0.86,
      0.58,
    )
    this.magentaLight.color.setHSL(
      0.79 + Math.sin(time * 0.075 + 1.8) * 0.01,
      0.78,
      0.6,
    )
  }

  private ensurePegs(rawPegs?: readonly CoinPusher3dPeg[]) {
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
    this.machineRoot.add(this.classicPegRoot)
    this.galacticThemeRoot.add(this.galacticPegRoot)
    if (pegs.length === 0) {
      this.shadowRefreshPending = true
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
    this.machineRoot.add(nextMesh)
    this.machineRoot.remove(previousMesh)
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
    this.machineRoot.add(nextMesh, nextRimMesh)
    this.machineRoot.remove(previousMesh, previousRimMesh)
    previousMesh.dispose()
    previousRimMesh.dispose()
  }

  private createAvatarAtlasGeometry(capacity: number) {
    const geometry = this.circleGeometry.clone()
    const instanceUv = new THREE.InstancedBufferAttribute(
      new Float32Array(capacity * 4),
      4,
    )
    instanceUv.setUsage(THREE.DynamicDrawUsage)
    geometry.setAttribute('instanceUvRect', instanceUv)
    return { geometry, instanceUv }
  }

  private createAvatarAtlasMaterial(texture: THREE.CanvasTexture) {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.FrontSide,
      toneMapped: false,
      transparent: false,
    })
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nattribute vec4 instanceUvRect;',
        )
        .replace(
          '#include <uv_vertex>',
          [
            '#include <uv_vertex>',
            '#ifdef USE_MAP',
            '  vMapUv = instanceUvRect.xy + vMapUv * instanceUvRect.zw;',
            '#endif',
          ].join('\n'),
        )
    }
    material.customProgramCacheKey = () => 'coin-pusher-avatar-atlas-v1'
    return material
  }

  private createAvatarFaceMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    capacity: number,
  ) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity)
    mesh.count = 0
    mesh.frustumCulled = false
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    mesh.renderOrder = 5
    return mesh
  }

  private createAvatarAtlasPage() {
    const id = this.nextAvatarAtlasPageId
    this.nextAvatarAtlasPageId += 1

    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_ATLAS_TEXTURE_SIZE
    canvas.height = AVATAR_ATLAS_TEXTURE_SIZE
    const context = canvas.getContext('2d', { alpha: false })
    if (context) {
      context.imageSmoothingEnabled = true
      context.imageSmoothingQuality = 'high'
      context.fillStyle = '#040914'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    // Atlas updates arrive progressively from the CDN. Avoid regenerating the
    // full 2048² mip chain for every batch; the portrait circles remain crisp
    // with linear filtering at their on-screen size.
    texture.generateMipmaps = false
    texture.magFilter = THREE.LinearFilter
    texture.minFilter = THREE.LinearFilter
    texture.needsUpdate = true

    const material = this.createAvatarAtlasMaterial(texture)
    const capacity = AVATAR_PAGE_INITIAL_COIN_CAPACITY
    const { geometry, instanceUv } = this.createAvatarAtlasGeometry(capacity)
    const front = this.createAvatarFaceMesh(geometry, material, capacity)
    const back = this.createAvatarFaceMesh(geometry, material, capacity)
    this.machineRoot.add(front, back)

    const page: AvatarAtlasPage = {
      back,
      capacity,
      canvas,
      context,
      count: 0,
      disposed: false,
      entries: 0,
      freeSlots: [],
      front,
      geometry,
      id,
      instanceUv,
      lastTextureUploadFrame: this.frameIndex,
      material,
      nextSlot: 0,
      texture,
      textureDirty: false,
    }
    this.avatarAtlasPages.set(id, page)
    return page
  }

  private ensureAvatarAtlasPageCapacity(page: AvatarAtlasPage, required: number) {
    if (required <= page.capacity) return
    const nextCapacity = nextCoinPusherInstanceCapacity(
      required,
      page.capacity,
      AVATAR_PAGE_INITIAL_COIN_CAPACITY,
    )
    const previousFront = page.front
    const previousBack = page.back
    const previousGeometry = page.geometry
    const { geometry, instanceUv } = this.createAvatarAtlasGeometry(nextCapacity)
    page.front = this.createAvatarFaceMesh(geometry, page.material, nextCapacity)
    page.back = this.createAvatarFaceMesh(geometry, page.material, nextCapacity)
    page.geometry = geometry
    page.instanceUv = instanceUv
    page.capacity = nextCapacity
    this.machineRoot.add(page.front, page.back)
    this.machineRoot.remove(previousFront, previousBack)
    previousFront.dispose()
    previousBack.dispose()
    previousGeometry.dispose()
  }

  private findAvatarAtlasPageWithSpace() {
    for (const page of this.avatarAtlasPages.values()) {
      if (
        !page.disposed
        && (
          page.freeSlots.length > 0
          || page.nextSlot < AVATAR_ATLAS_VIEWERS_PER_PAGE
        )
      ) {
        return page
      }
    }
    return this.createAvatarAtlasPage()
  }

  private disposeAvatarAtlasPage(page: AvatarAtlasPage) {
    if (page.disposed) return
    page.disposed = true
    page.count = 0
    page.front.count = 0
    page.back.count = 0
    this.machineRoot.remove(page.front, page.back)
    page.front.dispose()
    page.back.dispose()
    page.geometry.dispose()
    page.material.dispose()
    page.texture.dispose()
    if (this.avatarAtlasPages.get(page.id) === page) {
      this.avatarAtlasPages.delete(page.id)
    }
  }

  private markAvatarAtlasPageDirty(page: AvatarAtlasPage) {
    if (page.disposed) return
    page.textureDirty = true
  }

  private drawAvatarAtlasFallback(
    page: AvatarAtlasPage,
    entry: AvatarAtlasEntry,
  ) {
    drawAvatarAtlasFallback(
      page.context,
      entry.slot,
      entry.key,
      entry.name,
    )
    this.markAvatarAtlasPageDirty(page)
  }

  private drawAvatarAtlasImage(
    page: AvatarAtlasPage,
    entry: AvatarAtlasEntry,
    image: HTMLImageElement,
  ) {
    drawAvatarAtlasImage(page.context, entry.slot, image)
    this.markAvatarAtlasPageDirty(page)
  }

  private enqueueAvatarAtlasLoad(entry: AvatarAtlasEntry) {
    if (
      !entry.avatarUrl
      || entry.loadedToken === entry.loadToken
      || entry.pendingLoadToken === entry.loadToken
      || entry.loadAttempts >= AVATAR_ATLAS_MAX_LOAD_ATTEMPTS
    ) {
      return
    }
    entry.pendingLoadToken = entry.loadToken
    this.avatarAtlasLoadQueue.push({
      entry,
      token: entry.loadToken,
      url: entry.avatarUrl,
    })
    this.pumpAvatarAtlasLoads()
  }

  private isCurrentAvatarAtlasLoad(job: AvatarAtlasLoadJob) {
    return (
      !this.disposed
      && this.avatarAtlasEntries.get(job.entry.key) === job.entry
      && job.entry.loadToken === job.token
      && job.entry.avatarUrl === job.url
    )
  }

  private settleAvatarAtlasLoad(job: AvatarAtlasLoadJob, succeeded: boolean) {
    const entry = job.entry
    if (entry.pendingLoadToken === job.token) entry.pendingLoadToken = -1
    if (!this.isCurrentAvatarAtlasLoad(job)) return
    if (succeeded) {
      entry.loadedToken = job.token
      entry.retryAtFrame = 0
      return
    }
    if (entry.loadAttempts >= AVATAR_ATLAS_MAX_LOAD_ATTEMPTS) return
    const retryMultiplier = 2 ** Math.max(0, entry.loadAttempts - 1)
    entry.retryAtFrame = (
      this.frameIndex
      + AVATAR_ATLAS_RETRY_BACKOFF_FRAMES * retryMultiplier
    )
  }

  private pumpAvatarAtlasLoads() {
    if (this.disposed) {
      this.avatarAtlasLoadQueue.splice(0)
      return
    }
    while (
      this.activeAvatarAtlasLoads < AVATAR_ATLAS_MAX_CONCURRENT_LOADS
      && this.avatarAtlasLoadQueue.length > 0
    ) {
      const job = this.avatarAtlasLoadQueue.shift()
      if (!job) break
      if (
        this.avatarAtlasEntries.get(job.entry.key) !== job.entry
        || job.entry.loadToken !== job.token
        || job.entry.avatarUrl !== job.url
      ) {
        if (job.entry.pendingLoadToken === job.token) {
          job.entry.pendingLoadToken = -1
        }
        continue
      }

      job.entry.loadAttempts += 1
      this.activeAvatarAtlasLoads += 1
      let settled = false
      const finish = (succeeded: boolean) => {
        if (settled) return
        settled = true
        this.settleAvatarAtlasLoad(job, succeeded)
        this.activeAvatarAtlasLoads = Math.max(0, this.activeAvatarAtlasLoads - 1)
        this.pumpAvatarAtlasLoads()
      }
      try {
        this.avatarImageLoader.load(
          job.url,
          (image) => {
            const page = this.avatarAtlasPages.get(job.entry.pageId)
            let succeeded = false
            if (
              this.isCurrentAvatarAtlasLoad(job)
              && page
              && !page.disposed
            ) {
              try {
                this.drawAvatarAtlasImage(page, job.entry, image)
                succeeded = true
              } catch {
                try {
                  this.drawAvatarAtlasFallback(page, job.entry)
                } catch {
                  // Keep the previous atlas pixels if the canvas became unavailable.
                }
              }
            }
            finish(succeeded)
          },
          undefined,
          () => {
            // The initials tile remains visible when the avatar CDN refuses CORS.
            finish(false)
          },
        )
      } catch {
        finish(false)
      }
    }
  }

  private retryActiveAvatarAtlasLoads() {
    for (const entry of this.avatarAtlasEntries.values()) {
      if (
        entry.lastSeenFrame !== this.frameIndex
        || !entry.avatarUrl
        || entry.loadedToken === entry.loadToken
        || entry.pendingLoadToken === entry.loadToken
        || entry.loadAttempts >= AVATAR_ATLAS_MAX_LOAD_ATTEMPTS
        || this.frameIndex < entry.retryAtFrame
      ) {
        continue
      }
      this.enqueueAvatarAtlasLoad(entry)
    }
  }

  private ensureAvatarAtlasEntry(
    coin: CoinPusher3dCoin,
    key = coinPusherAvatarSnapshotKey(coin),
  ) {
    const name = String(coin.name || 'Viewer')
    const avatarUrl = String(coin.avatarUrl || '').trim()
    let entry = this.avatarAtlasEntries.get(key)
    if (!entry) {
      const page = this.findAvatarAtlasPageWithSpace()
      const reusedSlot = page.freeSlots.pop()
      const slot = reusedSlot ?? page.nextSlot
      if (reusedSlot === undefined) page.nextSlot += 1
      page.entries += 1
      entry = {
        avatarUrl,
        key,
        lastSeenFrame: this.frameIndex,
        loadAttempts: 0,
        loadToken: avatarUrl ? 1 : 0,
        loadedToken: -1,
        name,
        pageId: page.id,
        pendingLoadToken: -1,
        retryAtFrame: 0,
        slot,
        uv: avatarAtlasUvRect(slot),
      }
      this.avatarAtlasEntries.set(key, entry)
      this.drawAvatarAtlasFallback(page, entry)
      // The fallback belongs to this exact owner/avatar snapshot. Mark the
      // freshly allocated (or recycled) slot for the render about to happen so
      // it can never expose the previous owner's pixels or a black tile.
      page.texture.needsUpdate = true
      page.textureDirty = false
      page.lastTextureUploadFrame = this.frameIndex
      this.enqueueAvatarAtlasLoad(entry)
    }

    entry.lastSeenFrame = this.frameIndex
    return entry
  }

  private releaseAvatarAtlasEntry(key: string, entry: AvatarAtlasEntry) {
    if (this.avatarAtlasEntries.get(key) !== entry) return
    this.avatarAtlasEntries.delete(key)
    entry.loadToken += 1
    entry.pendingLoadToken = -1
    const page = this.avatarAtlasPages.get(entry.pageId)
    if (!page || page.disposed) return
    page.entries = Math.max(0, page.entries - 1)
    page.freeSlots.push(entry.slot)
    if (page.entries === 0) this.disposeAvatarAtlasPage(page)
  }

  private sweepAvatarAtlasEntries() {
    for (const [key, entry] of this.avatarAtlasEntries) {
      if (this.frameIndex - entry.lastSeenFrame > AVATAR_ATLAS_ENTRY_IDLE_FRAMES) {
        this.releaseAvatarAtlasEntry(key, entry)
      }
    }
  }

  private flushAvatarAtlasTextures() {
    for (const page of this.avatarAtlasPages.values()) {
      if (!page.textureDirty || page.disposed) continue
      const uploadDue = (
        this.frameIndex - page.lastTextureUploadFrame
        >= AVATAR_ATLAS_UPLOAD_INTERVAL_FRAMES
      )
      if (!uploadDue) continue
      page.texture.needsUpdate = true
      page.textureDirty = false
      page.lastTextureUploadFrame = this.frameIndex
    }
  }

  private syncCoins(coins: readonly CoinPusher3dCoin[]) {
    const regularCoins: CoinPusher3dCoin[] = []
    const mysteryItems: CoinPusher3dCoin[] = []
    const tickets: CoinPusher3dCoin[] = []
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
    for (const page of this.avatarAtlasPages.values()) page.count = 0

    // A viewer can own many coins, but every coin keeps the exact portrait
    // snapshot captured when its gift arrived. Signed CDN URLs from newer
    // gifts therefore receive a new immutable atlas entry instead of repainting
    // historical coins. Identical owner/snapshot pairs are still shared.
    const avatarKeys = new Array<string>(regularCoinCount)
    const avatarRepresentatives = new Map<string, CoinPusher3dCoin>()
    for (let index = 0; index < regularCoinCount; index += 1) {
      const coin = regularCoins[index]
      const key = coinPusherAvatarSnapshotKey(coin)
      avatarKeys[index] = key
      if (!avatarRepresentatives.has(key)) avatarRepresentatives.set(key, coin)
    }

    const avatarEntriesByKey = new Map<string, AvatarAtlasEntry>()
    for (const [key, coin] of avatarRepresentatives) {
      avatarEntriesByKey.set(key, this.ensureAvatarAtlasEntry(coin, key))
    }
    this.retryActiveAvatarAtlasLoads()

    const avatarEntries = new Array<AvatarAtlasEntry>(regularCoinCount)
    const pageRequirements = new Map<number, number>()
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
      const page = this.avatarAtlasPages.get(pageId)
      if (page) this.ensureAvatarAtlasPageCapacity(page, required)
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

      const atlasPage = this.avatarAtlasPages.get(avatarEntry.pageId)
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
    for (const page of this.avatarAtlasPages.values()) {
      page.front.count = page.count
      page.back.count = page.count
      if (page.count <= 0) continue
      page.front.instanceMatrix.needsUpdate = true
      page.back.instanceMatrix.needsUpdate = true
      page.instanceUv.needsUpdate = true
    }
    this.syncSpecialItems(mysteryItems, tickets)
    this.sweepAvatarAtlasEntries()
    this.flushAvatarAtlasTextures()

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
        this.getColor(
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

  private syncParticles(particles: readonly CoinPusher3dParticle[]) {
    const count = Math.min(MAX_PARTICLES, particles.length)
    const start = Math.max(0, particles.length - count)
    for (let index = 0; index < count; index += 1) {
      const particle = particles[start + index]
      setLogicalPoint(this.targetPosition, particle.x, particle.y)
      const offset = index * 3
      this.particlePositions[offset] = this.targetPosition.x
      this.particlePositions[offset + 1] = this.targetPosition.y
      this.particlePositions[offset + 2] = this.targetPosition.z + 0.16
      const color = this.getColor(particle.color)
      const life = THREE.MathUtils.clamp(particle.life / Math.max(0.001, particle.maxLife), 0, 1)
      const intensity = 0.1 + life * 0.65
      this.particleColors[offset] = color.r * intensity
      this.particleColors[offset + 1] = color.g * intensity
      this.particleColors[offset + 2] = color.b * intensity
    }
    this.particleGeometry.setDrawRange(0, count)
    const positionAttribute = this.particleGeometry.getAttribute('position') as THREE.BufferAttribute
    const colorAttribute = this.particleGeometry.getAttribute('color') as THREE.BufferAttribute
    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
  }

  private syncFloatingScores(scores: readonly CoinPusher3dFloatingScore[]) {
    const start = Math.max(0, scores.length - MAX_FLOATING_SCORE_SPRITES)

    // Mark retained entries first, then return stale sprites to the pool before
    // acquiring new ones. A full burst therefore never doubles the pool.
    for (let index = start; index < scores.length; index += 1) {
      const resource = this.floatingScoreSprites.get(scores[index].id)
      if (resource) resource.lastSeenFrame = this.frameIndex
    }
    for (const [id, resource] of this.floatingScoreSprites) {
      if (resource.lastSeenFrame === this.frameIndex) continue
      this.releaseFloatingScore(id, resource)
    }

    for (let index = start; index < scores.length; index += 1) {
      const score = scores[index]
      let resource = this.floatingScoreSprites.get(score.id)
      if (!resource) {
        resource = this.acquireFloatingScore(score.id)
      }
      resource.lastSeenFrame = this.frameIndex
      this.bindFloatingScoreTexture(resource, score.text, score.color)
      setLogicalPoint(this.targetPosition, score.x, score.y)
      resource.sprite.position.set(
        this.targetPosition.x,
        this.targetPosition.y,
        this.targetPosition.z + 0.48,
      )
      resource.material.opacity = THREE.MathUtils.clamp(score.life * 1.25, 0, 1)
      resource.sprite.scale.setScalar(0.86 + Math.min(0.3, score.life * 0.18))
      resource.sprite.scale.x *= 1.72
      resource.sprite.scale.y *= 0.64
    }

    this.evictFloatingScoreTextures()
  }

  private acquireFloatingScore(id: number) {
    let resource = this.floatingScorePool.pop()
    if (!resource) {
      const material = new THREE.SpriteMaterial({
        blending: THREE.NormalBlending,
        depthTest: false,
        depthWrite: false,
        opacity: 1,
        toneMapped: false,
        transparent: true,
      })
      const sprite = new THREE.Sprite(material)
      sprite.renderOrder = 24
      resource = {
        lastSeenFrame: this.frameIndex,
        material,
        sprite,
        textureKey: '',
      }
    }
    resource.lastSeenFrame = this.frameIndex
    resource.material.opacity = 1
    this.floatingScoreGroup.add(resource.sprite)
    this.floatingScoreSprites.set(id, resource)
    return resource
  }

  private releaseFloatingScore(id: number, resource: ScoreSpriteResource) {
    this.floatingScoreGroup.remove(resource.sprite)
    this.floatingScoreSprites.delete(id)
    this.releaseFloatingScoreTexture(resource)
    resource.material.opacity = 0
    if (this.floatingScorePool.length < MAX_FLOATING_SCORE_SPRITES) {
      this.floatingScorePool.push(resource)
    } else {
      resource.material.dispose()
    }
  }

  private bindFloatingScoreTexture(
    resource: ScoreSpriteResource,
    text: string,
    color: string,
  ) {
    const cleanText = String(text || '0')
    const cleanColor = String(color || '#ffffff')
    const key = `${cleanColor}\u0000${cleanText}`
    if (resource.textureKey === key) {
      const current = this.floatingScoreTextures.get(key)
      if (current) current.lastUsedFrame = this.frameIndex
      return
    }

    this.releaseFloatingScoreTexture(resource)
    let cached = this.floatingScoreTextures.get(key)
    if (!cached) {
      cached = {
        lastUsedFrame: this.frameIndex,
        references: 0,
        texture: createFloatingScoreTexture(cleanText, cleanColor),
      }
      this.floatingScoreTextures.set(key, cached)
    }
    cached.lastUsedFrame = this.frameIndex
    cached.references += 1
    resource.textureKey = key
    resource.material.map = cached.texture
    resource.material.needsUpdate = true
  }

  private releaseFloatingScoreTexture(resource: ScoreSpriteResource) {
    if (!resource.textureKey) return
    const cached = this.floatingScoreTextures.get(resource.textureKey)
    if (cached) cached.references = Math.max(0, cached.references - 1)
    resource.textureKey = ''
    resource.material.map = null
    resource.material.needsUpdate = true
  }

  private evictFloatingScoreTextures() {
    while (this.floatingScoreTextures.size > MAX_FLOATING_SCORE_TEXTURES) {
      let oldestKey = ''
      let oldestFrame = Number.POSITIVE_INFINITY
      for (const [key, cached] of this.floatingScoreTextures) {
        if (cached.references > 0 || cached.lastUsedFrame >= oldestFrame) continue
        oldestKey = key
        oldestFrame = cached.lastUsedFrame
      }
      if (!oldestKey) return
      const cached = this.floatingScoreTextures.get(oldestKey)
      cached?.texture.dispose()
      this.floatingScoreTextures.delete(oldestKey)
    }
  }

  private ensureScoreSlots(values: readonly number[]) {
    const slotCount = values.length || 1
    const multiplier = this.scoreMultiplier
    let changed = this.scoreSlotValues.length !== slotCount
    if (!changed) {
      for (let index = 0; index < slotCount; index += 1) {
        const normalized = Math.round(
          (Number(values.length ? values[index] : 0) || 0) * multiplier,
        )
        if (this.scoreSlotValues[index] !== normalized) {
          changed = true
          break
        }
      }
    }
    if (!changed) return

    const slots = new Array<number>(slotCount)
    for (let index = 0; index < slotCount; index += 1) {
      slots[index] = Math.round(
        (Number(values.length ? values[index] : 0) || 0) * multiplier,
      )
    }
    this.scoreSlotValues = slots
    disposeChildren(this.scoreGroup)
    this.scoreMaterials.splice(0)
    this.scoreImpulses.length = slotCount
    this.scoreImpulses.fill(0)

    const isGalactic = this.machineTheme === 'galactic-palace'
    const width = 6.78 / slots.length
    const startX = -3.39 + width / 2
    const dividerMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.62,
      clearcoatRoughness: 0.26,
      color: isGalactic ? 0x090817 : 0x182234,
      emissive: isGalactic ? 0x09031b : 0x01040a,
      emissiveIntensity: isGalactic ? 0.17 : 0.06,
      metalness: 0.92,
      roughness: isGalactic ? 0.24 : 0.32,
    })
    const frontPlateMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      color: isGalactic ? 0x03040b : 0x080d16,
      emissive: isGalactic ? 0x070215 : 0x01030a,
      emissiveIntensity: isGalactic ? 0.18 : 0.08,
      metalness: isGalactic ? 0.92 : 0.78,
      roughness: isGalactic ? 0.22 : 0.3,
    })
    // Score lanes are rebuilt when settings change. Keep their gold trim
    // independent so disposing the old lanes never destroys the chassis'
    // shared gold material.
    const scoreGoldMaterial = this.goldMaterial.clone()
    if (isGalactic) {
      scoreGoldMaterial.color.setHex(0xe4b55a)
      scoreGoldMaterial.emissive.setHex(0x291300)
      scoreGoldMaterial.emissiveIntensity = 0.025
      scoreGoldMaterial.roughness = 0.2
    }

    slots.forEach((rawValue, index) => {
      const value = Math.round(Number(rawValue) || 0)
      const color = isGalactic
        ? galacticScoreColor(value, index)
        : scoreColor(value, index)
      const basinColor = color.clone().lerp(
        new THREE.Color(isGalactic ? 0x03040b : 0x090e18),
        isGalactic ? 0.86 : 0.78,
      )
      const basinMaterial = new THREE.MeshPhysicalMaterial({
        clearcoat: isGalactic ? 0.82 : 0.5,
        clearcoatRoughness: isGalactic ? 0.2 : 0.34,
        color: basinColor,
        emissive: color,
        emissiveIntensity: isGalactic ? 0.13 : 0.08,
        envMapIntensity: isGalactic ? 0.88 : 0.5,
        metalness: isGalactic ? 0.86 : 0.72,
        roughness: isGalactic ? 0.26 : 0.42,
      })
      const accentMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: isGalactic
          ? value >= 20 ? 0.42 : 0.32
          : value >= 20 ? 0.42 : 0.32,
        metalness: isGalactic ? 0.62 : 0.46,
        roughness: isGalactic ? 0.2 : 0.3,
      })
      accentMaterial.userData.baseEmissiveIntensity = accentMaterial.emissiveIntensity
      this.scoreMaterials.push(accentMaterial)
      if (isGalactic) {
        const laneX = startX + index * width
        const rearWidth = Math.max(0.08, width - 0.31)
        const frontWidth = Math.max(0.12, width - 0.11)
        // A tall recessed chute sits behind the falling coin. Its broad lower
        // mouth and deep black surround reproduce the jewel lanes in the
        // reference while remaining outside the collision model.
        addExtrudedPanel(
          this.scoreGroup,
          [
            [-rearWidth / 2, 1.18],
            [rearWidth / 2, 1.18],
            [frontWidth / 2, -1.34],
            [-frontWidth / 2, -1.34],
          ],
          0.12,
          basinMaterial,
          [laneX, 0, 2.7],
        )
        addExtrudedPanel(
          this.scoreGroup,
          [
            [-rearWidth * 0.35, 1.04],
            [rearWidth * 0.35, 1.04],
            [frontWidth * 0.34, -1.12],
            [-frontWidth * 0.34, -1.12],
          ],
          0.035,
          accentMaterial,
          [laneX, 0, 2.84],
        )
        addTrapezoidFloor(
          this.scoreGroup,
          laneX,
          rearWidth,
          frontWidth,
          -1.6,
          2.75,
          3.72,
          accentMaterial,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.08, rearWidth), 0.18, 0.22],
          [laneX, 1.23, 2.86],
          frontPlateMaterial,
          0.035,
        )
        addBeamBetween3d(
          this.scoreGroup,
          [laneX - rearWidth / 2, 1.17, 2.93],
          [laneX - frontWidth / 2, -1.34, 3.02],
          0.052,
          0.075,
          scoreGoldMaterial,
          0.015,
        )
        addBeamBetween3d(
          this.scoreGroup,
          [laneX + rearWidth / 2, 1.17, 2.93],
          [laneX + frontWidth / 2, -1.34, 3.02],
          0.052,
          0.075,
          scoreGoldMaterial,
          0.015,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.16, width - 0.075), 0.54, 0.24],
          [laneX, 0.04, 3.69],
          frontPlateMaterial,
          0.045,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.1, width - 0.2), 0.035, 0.035],
          [laneX, 0.305, 3.835],
          accentMaterial,
          0.008,
        )
      } else {
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.16, width - 0.055), 0.13, 1.34],
          [startX + index * width, -0.96, 3.5],
          basinMaterial,
          0.045,
          true,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.12, width - 0.15), 0.032, 1.04],
          [startX + index * width, -0.875, 3.48],
          accentMaterial,
          0.012,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.16, width - 0.055), 0.5, 0.16],
          [startX + index * width, -0.64, 4.16],
          frontPlateMaterial,
          0.035,
          true,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.1, width - 0.15), 0.035, 0.045],
          [startX + index * width, -0.375, 4.25],
          accentMaterial,
          0.012,
        )
      }

      const scoreText = `${value > 0 ? '+' : ''}${value}`
      const scoreHex = `#${color.getHexString()}`
      const texture = isGalactic
        ? createGalacticScoreSlotTexture(scoreText, scoreHex)
        : createScoreSlotTexture(scoreText, scoreHex)
      const labelMaterial = new THREE.MeshBasicMaterial({
        alphaTest: 0.006,
        depthTest: !isGalactic,
        depthWrite: !isGalactic,
        map: texture,
        toneMapped: false,
        transparent: true,
      })
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(
          Math.max(0.3, width * (isGalactic ? 0.86 : 0.92)),
          isGalactic ? GALACTIC_SCORE_LABEL_HEIGHT : 0.43,
        ),
        labelMaterial,
      )
      label.position.set(
        startX + index * width,
        isGalactic ? GALACTIC_SCORE_LABEL_Y : -0.64,
        isGalactic ? GALACTIC_SCORE_LABEL_Z : 4.252,
      )
      label.renderOrder = 20
      label.frustumCulled = !isGalactic
      this.scoreGroup.add(label)

      if (isGalactic && width >= 0.44) {
        const laneGem = new THREE.Mesh(
          new THREE.OctahedronGeometry(Math.min(0.105, width * 0.12), 0),
          accentMaterial,
        )
        laneGem.position.set(startX + index * width, -1.53, 3.81)
        laneGem.rotation.z = Math.PI / 4
        laneGem.scale.z = 0.42
        laneGem.renderOrder = 21
        this.scoreGroup.add(laneGem)
      }
    })

    for (let index = 0; index <= slots.length; index += 1) {
      const dividerX = -3.39 + index * width
      if (isGalactic) {
        addRoundedBox(
          this.scoreGroup,
          [0.095, 2.78, 0.34],
          [dividerX, -0.08, 2.88],
          dividerMaterial,
          0.026,
        )
        addRoundedBox(
          this.scoreGroup,
          [0.032, 2.62, 0.045],
          [dividerX, -0.08, 3.075],
          scoreGoldMaterial,
          0.009,
        )
      } else {
        addRoundedBox(
          this.scoreGroup,
          [0.055, 1.3, 1.4],
          [dividerX, -0.33, 3.5],
          dividerMaterial,
          0.018,
          true,
        )
        addRoundedBox(
          this.scoreGroup,
          [0.08, 0.06, 1.44],
          [dividerX, 0.35, 3.5],
          scoreGoldMaterial,
          0.02,
        )
      }
    }
  }

  private updateScoreFlashes(delta: number) {
    for (let index = 0; index < this.scoreMaterials.length; index += 1) {
      const material = this.scoreMaterials[index]
      const impulse = Math.max(0, (this.scoreImpulses[index] || 0) - delta * 2.4)
      this.scoreImpulses[index] = impulse
      const base = Number(material.userData.baseEmissiveIntensity)
        || (material.color.getHex() === 0xe7b84b ? 0.42 : 0.32)
      material.emissiveIntensity = base
        + impulse * (this.machineTheme === 'galactic-palace' ? 0.34 : 0.72)
    }
  }

  private ensurePlatformTexture(url: string) {
    const isGalactic = this.machineTheme === 'galactic-palace'
    this.ensureSurfaceTexture(url, this.platformTextureState, [
      {
        fallbackColor: isGalactic ? 0x171127 : 0x19324b,
        material: this.platformMaterial,
        textureColor: isGalactic ? 0xf8f2ff : 0xf1f4f7,
      },
      {
        fallbackColor: isGalactic ? 0x0d0a18 : 0x111827,
        material: this.movingDeckSurfaceMaterial,
        textureColor: isGalactic ? 0xf7f1ff : 0xe8edf2,
      },
    ])
  }

  private ensurePlinkoTexture(url: string) {
    const isGalactic = this.machineTheme === 'galactic-palace'
    this.ensureSurfaceTexture(url, this.plinkoTextureState, [
      {
        fallbackColor: isGalactic ? 0x090817 : 0x0b1324,
        material: this.plinkoMaterial,
        textureColor: isGalactic ? 0xf7f2ff : 0xf1f4f7,
      },
      {
        fallbackColor: 0x080713,
        material: this.galacticPlinkoSurfaceMaterial,
        textureColor: 0xe7def2,
      },
    ])
  }

  private ensureSurfaceTexture(
    url: string,
    state: SurfaceTextureState,
    targets: readonly SurfaceTextureTarget[],
  ) {
    const cleanUrl = String(url || '').trim()
    const targetsGalacticPlinko = targets.some(
      (target) => target.material === this.galacticPlinkoSurfaceMaterial,
    )
    if (cleanUrl !== state.desiredUrl) {
      state.desiredUrl = cleanUrl
      state.loadingUrl = ''
      state.retryAt = 0
      state.token += 1
    }

    if (!cleanUrl) {
      if (targetsGalacticPlinko && this.galacticPlinkoPanelGeometry) {
        setGalacticPlinkoPanelUvCrop(this.galacticPlinkoPanelGeometry, 1)
      }
      if (!state.texture && !state.loadedUrl) return
      state.texture?.dispose()
      state.texture = null
      state.loadedUrl = ''
      for (const target of targets) {
        target.material.map = null
        target.material.color.setHex(target.fallbackColor)
        target.material.needsUpdate = true
      }
      this.applyThemeSurfaceColors()
      return
    }

    if (state.texture && state.loadedUrl === cleanUrl) return
    if (state.loadingUrl === cleanUrl || Date.now() < state.retryAt) return

    state.loadingUrl = cleanUrl
    const token = ++state.token
    this.textureLoader.load(
      cleanUrl,
      (texture) => {
        if (this.disposed || token !== state.token || state.desiredUrl !== cleanUrl) {
          texture.dispose()
          return
        }

        configureSurfaceTexture(texture, this.renderer)
        if (targetsGalacticPlinko && this.galacticPlinkoPanelGeometry) {
          setGalacticPlinkoPanelUvCrop(
            this.galacticPlinkoPanelGeometry,
            surfaceTextureAspect(texture),
          )
        }
        const previousTexture = state.texture
        state.texture = texture
        state.loadedUrl = cleanUrl
        state.loadingUrl = ''
        state.retryAt = 0
        for (const target of targets) {
          target.material.map = texture
          target.material.color.setHex(target.textureColor)
          target.material.needsUpdate = true
        }
        // The active theme may have changed while the image was downloading.
        // Re-apply its tint instead of letting a stale callback overwrite it.
        this.applyThemeSurfaceColors()
        if (previousTexture && previousTexture !== texture) previousTexture.dispose()
      },
      undefined,
      () => {
        if (this.disposed || token !== state.token || state.desiredUrl !== cleanUrl) return
        // Preserve the currently displayed texture and retry the same URL later.
        state.loadingUrl = ''
        state.retryAt = Date.now() + 1_500
      },
    )
  }

  private getColor(value: string) {
    const key = String(value || '#ffffff')
    let color = this.colorCache.get(key)
    if (!color) {
      color = new THREE.Color(key)
      this.colorCache.set(key, color)
    }
    return color
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
}

export function coinPusherAvatarSnapshotKey(
  coin: Pick<CoinPusher3dCoin, 'avatarUrl' | 'id' | 'name' | 'viewerId'>,
) {
  const viewerId = String(coin.viewerId || '').trim().toLowerCase()
  const name = String(coin.name || 'Viewer').trim().toLowerCase()
  const avatarUrl = String(coin.avatarUrl || '').trim()
  const genericOwner = !viewerId || /^(?:viewer|anonymous|unknown)$/.test(viewerId)
  const owner = genericOwner
    ? `coin:${String(coin.id || name || 'viewer').trim().toLowerCase()}`
    : `viewer:${viewerId}`
  const portrait = avatarUrl
    ? `avatar:${avatarUrl}`
    : `fallback:${name}`
  return JSON.stringify([owner, portrait])
}

function createSurfaceTextureState(): SurfaceTextureState {
  return {
    desiredUrl: '',
    loadedUrl: '',
    loadingUrl: '',
    retryAt: 0,
    texture: null,
    token: 0,
  }
}

function createDefaultCoinPusherPegs(): CoinPusher3dPeg[] {
  const pegs: CoinPusher3dPeg[] = []
  for (let row = 0; row < 8; row += 1) {
    const count = row % 2 === 0 ? 8 : 7
    const spacing = 52
    const totalWidth = (count - 1) * spacing
    const startX = LOGICAL_WIDTH / 2 - totalWidth / 2
    for (let index = 0; index < count; index += 1) {
      pegs.push({
        index,
        row,
        x: startX + index * spacing,
        y: 170 + row * 29,
      })
    }
  }
  return pegs
}

function coinPusherPegSignature(pegs: readonly CoinPusher3dPeg[]) {
  let hash = 2166136261
  const mix = (value: number) => {
    hash ^= value | 0
    hash = Math.imul(hash, 16777619)
  }
  for (let index = 0; index < pegs.length; index += 1) {
    const peg = pegs[index]
    mix(Math.round(peg.index))
    mix(Math.round(peg.row))
    mix(Math.round(peg.x * 1000))
    mix(Math.round(peg.y * 1000))
  }
  return `${pegs.length}:${hash >>> 0}`
}

function configureSurfaceTexture(texture: THREE.Texture, renderer: THREE.WebGLRenderer) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy())
  texture.needsUpdate = true
}

function createSoftPointTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const context = canvas.getContext('2d')
  if (context) {
    const glow = context.createRadialGradient(32, 32, 3, 32, 32, 31)
    glow.addColorStop(0, 'rgba(255,255,255,1)')
    glow.addColorStop(0.46, 'rgba(255,255,255,.9)')
    glow.addColorStop(0.78, 'rgba(255,255,255,.34)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = glow
    context.fillRect(0, 0, 64, 64)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.needsUpdate = true
  return texture
}

export function createCoinPusher3dRenderer(canvas: HTMLCanvasElement): CoinPusher3dRenderer {
  return new SceneRenderer(canvas)
}

function setLogicalPoint(
  target: THREE.Vector3,
  logicalX: number,
  logicalY: number,
  forcedPhase?: CoinPusher3dCoinPhase,
  dropProgress = 1,
  stackHeight = 0,
  coinRadius = 12,
  plinkoObjectBoundRadius = COIN_OBJECT_BOUND_RADIUS,
  deckObjectLocalHalfHeight = COIN_THICKNESS / 2,
  deckObjectScaleMultiplier = 1,
) {
  const x = (logicalX - LOGICAL_WIDTH / 2) / 66
  const stackOffset = Math.max(0, stackHeight) * coinStackWorldStep(coinRadius)
  const deckObjectHalfHeight = (
    plinkoObjectScale(coinRadius)
    * Math.max(0, Number(deckObjectLocalHalfHeight) || 0)
    * Math.max(0, Number(deckObjectScaleMultiplier) || 0)
  )
  const phase = forcedPhase
    || (logicalY <= PLINKO_BOTTOM ? 'plinko' : logicalY <= SHELF_EDGE ? 'shelf' : 'falling')

  if (phase === 'plinko') {
    return setPlinkoPoint(
      target,
      logicalX,
      logicalY,
      coinRadius,
      plinkoObjectBoundRadius,
    )
  }
  if (phase === 'pusher') {
    return target.set(
      x,
      MOVING_DECK_SURFACE_Y + deckObjectHalfHeight + DECK_OBJECT_SURFACE_GAP + stackOffset,
      logicalShelfZ(logicalY),
    )
  }
  if (phase === 'settling') {
    const progress = THREE.MathUtils.clamp(dropProgress, 0, 1)
    const easedDrop = progress * progress
    const lowerHeight = logicalShelfHeight(logicalY, deckObjectHalfHeight)
    return target.set(
      x,
      THREE.MathUtils.lerp(
        MOVING_DECK_SURFACE_Y + deckObjectHalfHeight + DECK_OBJECT_SURFACE_GAP,
        lowerHeight,
        easedDrop,
      ) + stackOffset,
      logicalShelfZ(logicalY),
    )
  }
  if (phase === 'shelf') {
    return target.set(
      x,
      logicalShelfHeight(logicalY, deckObjectHalfHeight) + stackOffset,
      logicalShelfZ(logicalY),
    )
  }

  const progress = THREE.MathUtils.clamp((logicalY - SHELF_EDGE) / (SCORE_BOTTOM - SHELF_EDGE), 0, 1.25)
  return target.set(x, 2.37 - progress * 3.41 + stackOffset, 3 + progress * 0.34)
}

function logicalShelfProgress(logicalY: number) {
  return THREE.MathUtils.clamp((logicalY - SHELF_TOP) / (SHELF_EDGE - SHELF_TOP), 0, 1)
}

function logicalShelfHeight(_logicalY: number, objectHalfHeight: number) {
  return MAIN_DECK_SURFACE_Y + objectHalfHeight + DECK_OBJECT_SURFACE_GAP
}

function logicalShelfZ(logicalY: number) {
  return -2.82 + logicalShelfProgress(logicalY) * 5.82
}

function coinStackWorldStep(radius: number) {
  return COIN_THICKNESS * Math.max(0.15, Number(radius) / 66 || 0) + 0.008
}

function setPlinkoPoint(
  target: THREE.Vector3,
  logicalX: number,
  logicalY: number,
  objectRadius = 0,
  objectBoundRadius = COIN_OBJECT_BOUND_RADIUS,
) {
  const x = (logicalX - LOGICAL_WIDTH / 2) / 66
  const progress = THREE.MathUtils.clamp((logicalY - PLINKO_TOP) / (PLINKO_BOTTOM - PLINKO_TOP), -0.35, 1.1)
  const objectScale = plinkoObjectScale(objectRadius)
  const clearance = objectScale > 0
    ? Math.max(
        CLASSIC_PLINKO_BASE_COIN_Z - CLASSIC_PLINKO_SURFACE_Z,
        objectScale * objectBoundRadius + PLINKO_OBJECT_SURFACE_GAP,
      )
    : CLASSIC_PLINKO_BASE_COIN_Z - CLASSIC_PLINKO_SURFACE_Z
  return target.set(
    x,
    8.82 - progress * 5.56,
    CLASSIC_PLINKO_SURFACE_Z + clearance,
  )
}

function setGalacticPlinkoPoint(
  target: THREE.Vector3,
  logicalX: number,
  logicalY: number,
) {
  const progress = THREE.MathUtils.clamp(
    (logicalY - PLINKO_TOP) / (PLINKO_BOTTOM - PLINKO_TOP),
    -0.12,
    1.04,
  )
  const baseX = (logicalX - LOGICAL_WIDTH / 2) / 66
  const worldY = 8.82 - progress * 5.56
  const planeY = (worldY - GALACTIC_PLINKO_CENTER_Y) / GALACTIC_PLINKO_PLANE_UP.y
  return target.copy(GALACTIC_PLINKO_PLANE_CENTER)
    .addScaledVector(
      GALACTIC_PLINKO_PLANE_RIGHT,
      baseX * galacticPlinkoApertureScale(worldY),
    )
    .addScaledVector(GALACTIC_PLINKO_PLANE_UP, planeY)
}

function offsetGalacticPlinkoObject(
  target: THREE.Vector3,
  objectRadius: number,
  objectBoundRadius: number,
) {
  const objectScale = plinkoObjectScale(objectRadius)
  if (objectScale <= 0) return target
  // The additive veil is the nearest panel layer. Offset the complete object
  // bound beyond it; pins and cabinet rails still have normal depth testing,
  // so their physically correct foreground occlusion is preserved.
  target.addScaledVector(
    GALACTIC_PLINKO_PLANE_NORMAL,
    GALACTIC_PLINKO_VEIL_OFFSET_Z
      + objectScale * objectBoundRadius
      + PLINKO_OBJECT_SURFACE_GAP,
  )
  return target
}

function plinkoObjectScale(objectRadius: number) {
  const radius = Number(objectRadius)
  return Number.isFinite(radius) && radius > 0
    ? Math.max(0.15, radius / 66)
    : 0
}

function galacticPlinkoApertureScale(worldY: number) {
  const cornerProgress = THREE.MathUtils.clamp(
    (GALACTIC_PLINKO_TOP_Y - worldY)
      / (GALACTIC_PLINKO_TOP_Y - GALACTIC_PLINKO_SHOULDER_Y),
    0,
    1,
  )
  return THREE.MathUtils.lerp(
    GALACTIC_PLINKO_TOP_HALF_WIDTH / GALACTIC_PLINKO_PLAYFIELD_HALF_WIDTH,
    1,
    cornerProgress,
  )
}

function neonMaterial(color: number, intensity: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.24,
    roughness: 0.2,
  })
}

function createBrilliantDiamondGeometry() {
  const segments = 8
  const positions: number[] = []
  const tableRadius = 0.22
  const tableY = 0.46
  const girdleRadius = 0.54
  const upperGirdleY = 0.08
  const lowerGirdleY = -0.045
  const pavilionY = -0.58

  const point = (radius: number, y: number, index: number): [number, number, number] => {
    const angle = Math.PI / 8 + index / segments * Math.PI * 2
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
  }
  const triangle = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ) => {
    positions.push(...a, ...b, ...c)
  }

  const tableCenter: [number, number, number] = [0, tableY, 0]
  const pavilionTip: [number, number, number] = [0, pavilionY, 0]
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments
    const table = point(tableRadius, tableY, index)
    const tableNext = point(tableRadius, tableY, next)
    const upper = point(girdleRadius, upperGirdleY, index)
    const upperNext = point(girdleRadius, upperGirdleY, next)
    const lower = point(girdleRadius, lowerGirdleY, index)
    const lowerNext = point(girdleRadius, lowerGirdleY, next)

    triangle(tableCenter, tableNext, table)
    triangle(table, tableNext, upperNext)
    triangle(table, upperNext, upper)
    triangle(upper, upperNext, lowerNext)
    triangle(upper, lowerNext, lower)
    triangle(lower, lowerNext, pavilionTip)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function addExtrudedPanel(
  parent: THREE.Object3D,
  points: readonly [number, number][],
  depth: number,
  material: THREE.Material,
  position: [number, number, number],
  shadows = false,
) {
  const shape = new THREE.Shape()
  const first = points[0] || [0, 0]
  shape.moveTo(first[0], first[1])
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index][0], points[index][1])
  }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(0.035, depth * 0.22),
    bevelThickness: Math.min(0.025, depth * 0.18),
    curveSegments: 2,
    depth,
    steps: 1,
  })
  geometry.translate(0, 0, -depth / 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.castShadow = shadows
  mesh.receiveShadow = shadows
  parent.add(mesh)
  return mesh
}

function addTrapezoidFloor(
  parent: THREE.Object3D,
  centerX: number,
  rearWidth: number,
  frontWidth: number,
  y: number,
  rearZ: number,
  frontZ: number,
  material: THREE.Material,
) {
  const positions = new Float32Array([
    centerX - rearWidth / 2, y, rearZ,
    centerX + rearWidth / 2, y, rearZ,
    centerX + frontWidth / 2, y, frontZ,
    centerX - frontWidth / 2, y, frontZ,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex([0, 2, 1, 0, 3, 2])
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

function createGalacticPlinkoPanelGeometry() {
  const geometry = new THREE.BufferGeometry()
  const topHalfWidth = GALACTIC_PLINKO_TOP_HALF_WIDTH
  const bottomHalfWidth = GALACTIC_PLINKO_FULL_HALF_WIDTH
  const outline: readonly [number, number][] = [
    [-topHalfWidth, GALACTIC_PLINKO_TOP_Y],
    [-bottomHalfWidth, GALACTIC_PLINKO_SHOULDER_Y],
    [-bottomHalfWidth, GALACTIC_PLINKO_BOTTOM_Y],
    [bottomHalfWidth, GALACTIC_PLINKO_BOTTOM_Y],
    [bottomHalfWidth, GALACTIC_PLINKO_SHOULDER_Y],
    [topHalfWidth, GALACTIC_PLINKO_TOP_Y],
  ]
  const positions: number[] = []
  const point = new THREE.Vector3()
  for (const [planeX, worldY] of outline) {
    const planeY = (worldY - GALACTIC_PLINKO_CENTER_Y) / GALACTIC_PLINKO_PLANE_UP.y
    point.copy(GALACTIC_PLINKO_PLANE_CENTER)
      .addScaledVector(GALACTIC_PLINKO_PLANE_RIGHT, planeX)
      .addScaledVector(GALACTIC_PLINKO_PLANE_UP, planeY)
    positions.push(point.x, point.y, point.z)
  }
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex([
    0, 1, 4,
    0, 4, 5,
    1, 2, 3,
    1, 3, 4,
  ])
  setGalacticPlinkoPanelUvCrop(geometry, 1)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Maps the six-point aperture onto one camera-facing rectangle. The only
 * removed pixels are its two upper corners; object-cover cropping preserves
 * the source aspect ratio and every remaining image line stays straight.
 */
function setGalacticPlinkoPanelUvCrop(
  geometry: THREE.BufferGeometry,
  sourceAspect: number,
) {
  const topHalfWidth = GALACTIC_PLINKO_TOP_HALF_WIDTH
  const bottomHalfWidth = GALACTIC_PLINKO_FULL_HALF_WIDTH
  const panelHeight = GALACTIC_PLINKO_HALF_HEIGHT * 2
  const destinationAspect = bottomHalfWidth * 2 / panelHeight
  const safeSourceAspect = THREE.MathUtils.clamp(
    Number.isFinite(sourceAspect) ? sourceAspect : 1,
    0.12,
    8,
  )
  let uMin = 0
  let uMax = 1
  let vMin = 0
  let vMax = 1
  if (safeSourceAspect > destinationAspect) {
    const visibleWidth = destinationAspect / safeSourceAspect
    uMin = (1 - visibleWidth) / 2
    uMax = 1 - uMin
  } else {
    const visibleHeight = safeSourceAspect / destinationAspect
    vMin = (1 - visibleHeight) / 2
    vMax = 1 - vMin
  }

  const topInset = (bottomHalfWidth - topHalfWidth) / (bottomHalfWidth * 2)
  const mapU = (value: number) => THREE.MathUtils.lerp(uMin, uMax, value)
  const mapV = (value: number) => THREE.MathUtils.lerp(vMin, vMax, value)
  const shoulderPlaneY = (
    (GALACTIC_PLINKO_SHOULDER_Y - GALACTIC_PLINKO_CENTER_Y)
    / GALACTIC_PLINKO_PLANE_UP.y
  )
  const shoulderV = (
    (shoulderPlaneY + GALACTIC_PLINKO_HALF_HEIGHT)
    / (GALACTIC_PLINKO_HALF_HEIGHT * 2)
  )
  const uv = geometry.getAttribute('uv')
  const values = [
    mapU(topInset), vMax,
    uMin, mapV(shoulderV),
    uMin, vMin,
    uMax, vMin,
    uMax, mapV(shoulderV),
    mapU(1 - topInset), vMax,
  ]
  if (uv instanceof THREE.BufferAttribute && uv.count === 6) {
    for (let index = 0; index < 6; index += 1) {
      uv.setXY(index, values[index * 2], values[index * 2 + 1])
    }
    uv.needsUpdate = true
    return
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(values, 2))
}

function surfaceTextureAspect(texture: THREE.Texture) {
  const image = texture.image as {
    height?: number
    naturalHeight?: number
    naturalWidth?: number
    videoHeight?: number
    videoWidth?: number
    width?: number
  } | null
  const width = Number(image?.naturalWidth || image?.videoWidth || image?.width || 0)
  const height = Number(image?.naturalHeight || image?.videoHeight || image?.height || 0)
  return width > 0 && height > 0 ? width / height : 1
}

function addBeamBetween3d(
  parent: THREE.Object3D,
  start: [number, number, number],
  end: [number, number, number],
  thickness: number,
  depth: number,
  material: THREE.Material,
  radius = 0.025,
) {
  const startPoint = new THREE.Vector3(...start)
  const endPoint = new THREE.Vector3(...end)
  const direction = endPoint.clone().sub(startPoint)
  const length = Math.max(0.001, direction.length())
  const midpoint = startPoint.add(endPoint).multiplyScalar(0.5)
  const beam = addRoundedBox(
    parent,
    [length, thickness, depth],
    [midpoint.x, midpoint.y, midpoint.z],
    material,
    radius,
  )
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    direction.normalize(),
  )
  return beam
}

function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

function addRoundedBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  radius = 0.08,
  shadows = false,
) {
  const safeRadius = Math.max(0.006, Math.min(radius, ...size.map((value) => value * 0.22)))
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 4, safeRadius)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.castShadow = shadows
  mesh.receiveShadow = shadows
  parent.add(mesh)
  return mesh
}

function createMachineTitleTexture(title: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 144
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    const edgeGradient = context.createLinearGradient(112, 0, canvas.width - 112, 0)
    edgeGradient.addColorStop(0, 'rgba(67,232,255,0)')
    edgeGradient.addColorStop(0.22, '#43e8ff')
    edgeGradient.addColorStop(0.5, '#f7c85d')
    edgeGradient.addColorStop(0.78, '#fb4b4f')
    edgeGradient.addColorStop(1, 'rgba(251,75,79,0)')
    context.fillStyle = edgeGradient
    context.fillRect(112, 119, canvas.width - 224, 3)

    const titleGradient = context.createLinearGradient(0, 28, 0, 112)
    titleGradient.addColorStop(0, '#fff3c9')
    titleGradient.addColorStop(0.48, '#f7c85d')
    titleGradient.addColorStop(1, '#b9761e')
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '900 82px Inter, Arial Black, Arial, sans-serif'
    context.lineWidth = 8
    context.strokeStyle = 'rgba(2,6,15,.96)'
    context.strokeText(title, canvas.width / 2, 71)
    context.shadowColor = 'rgba(247,200,93,.5)'
    context.shadowBlur = 6
    context.fillStyle = titleGradient
    context.fillText(title, canvas.width / 2, 71)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function createMysteryDieTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    const background = context.createRadialGradient(174, 132, 18, 256, 256, 360)
    background.addColorStop(0, '#a85cff')
    background.addColorStop(0.42, '#4b1a91')
    background.addColorStop(1, '#10051f')
    context.fillStyle = background
    context.fillRect(0, 0, canvas.width, canvas.height)

    const edge = context.createLinearGradient(20, 20, 492, 492)
    edge.addColorStop(0, '#fff2af')
    edge.addColorStop(0.28, '#f6bc47')
    edge.addColorStop(0.56, '#fff4c8')
    edge.addColorStop(1, '#9b5b16')
    context.lineJoin = 'round'
    context.lineWidth = 28
    context.strokeStyle = edge
    context.strokeRect(28, 28, 456, 456)
    context.lineWidth = 5
    context.strokeStyle = 'rgba(255,255,255,.68)'
    context.strokeRect(51, 51, 410, 410)

    for (let corner = 0; corner < 4; corner += 1) {
      const x = corner % 2 ? 438 : 74
      const y = corner > 1 ? 438 : 74
      context.save()
      context.translate(x, y)
      context.rotate(Math.PI / 4)
      context.fillStyle = corner % 2 ? '#58e9ff' : '#ffbd48'
      context.fillRect(-12, -12, 24, 24)
      context.restore()
    }

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '900 330px Inter, Arial Black, Arial, sans-serif'
    context.lineJoin = 'round'
    context.lineWidth = 36
    context.strokeStyle = '#160523'
    context.strokeText('?', 256, 273)
    context.shadowColor = '#fff2a8'
    context.shadowBlur = 24
    context.fillStyle = edge
    context.fillText('?', 256, 273)
    context.shadowBlur = 0
    context.fillStyle = 'rgba(255,255,255,.72)'
    context.beginPath()
    context.ellipse(204, 129, 38, 16, -0.55, 0, Math.PI * 2)
    context.fill()
  }
  const texture = createCanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

function createPointTicketTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    const background = context.createLinearGradient(0, 0, canvas.width, canvas.height)
    background.addColorStop(0, '#063f67')
    background.addColorStop(0.42, '#0ab6d7')
    background.addColorStop(0.58, '#7425bb')
    background.addColorStop(1, '#26063c')
    context.beginPath()
    context.roundRect(18, 18, canvas.width - 36, canvas.height - 36, 62)
    context.fillStyle = background
    context.fill()

    const border = context.createLinearGradient(30, 0, canvas.width - 30, 0)
    border.addColorStop(0, '#66f4ff')
    border.addColorStop(0.48, '#fff5c6')
    border.addColorStop(1, '#f1a3ff')
    context.lineWidth = 22
    context.strokeStyle = border
    context.stroke()
    context.beginPath()
    context.roundRect(49, 49, canvas.width - 98, canvas.height - 98, 42)
    context.setLineDash([18, 13])
    context.lineWidth = 5
    context.strokeStyle = 'rgba(255,255,255,.68)'
    context.stroke()
    context.setLineDash([])

    for (let side = 0; side < 2; side += 1) {
      const x = side ? 878 : 146
      context.save()
      context.translate(x, 255)
      context.rotate(Math.PI / 4)
      context.fillStyle = '#ffd66d'
      context.fillRect(-38, -38, 76, 76)
      context.fillStyle = '#5a20a2'
      context.fillRect(-20, -20, 40, 40)
      context.restore()
    }

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = '900 94px Inter, Arial Black, Arial, sans-serif'
    context.lineJoin = 'round'
    context.lineWidth = 18
    context.strokeStyle = '#07101f'
    context.strokeText('TICKET BONUS', canvas.width / 2, 205)
    context.fillStyle = '#ffffff'
    context.shadowColor = '#73eeff'
    context.shadowBlur = 18
    context.fillText('TICKET BONUS', canvas.width / 2, 205)
    context.shadowBlur = 0
    context.font = '900 122px Inter, Arial Black, Arial, sans-serif'
    context.strokeText('+ POINTS', canvas.width / 2, 329)
    context.fillStyle = '#ffe184'
    context.fillText('+ POINTS', canvas.width / 2, 329)
  }
  const texture = createCanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

function createGalacticCasinoBackdropTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const context = canvas.getContext('2d')
  if (context) {
    const size = canvas.width
    const center = size / 2

    const room = context.createLinearGradient(0, 0, 0, size)
    room.addColorStop(0, '#09091b')
    room.addColorStop(0.42, '#100b24')
    room.addColorStop(0.7, '#070817')
    room.addColorStop(1, '#02040d')
    context.fillStyle = room
    context.fillRect(0, 0, size, size)

    const cyanGlow = context.createRadialGradient(105, 420, 10, 105, 420, 390)
    cyanGlow.addColorStop(0, 'rgba(31,199,255,.22)')
    cyanGlow.addColorStop(0.42, 'rgba(23,101,180,.095)')
    cyanGlow.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = cyanGlow
    context.fillRect(0, 0, size, size)
    const violetGlow = context.createRadialGradient(919, 400, 10, 919, 400, 390)
    violetGlow.addColorStop(0, 'rgba(168,75,255,.22)')
    violetGlow.addColorStop(0.42, 'rgba(91,34,167,.1)')
    violetGlow.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = violetGlow
    context.fillRect(0, 0, size, size)
    const crownGlow = context.createRadialGradient(center, 80, 0, center, 80, 430)
    crownGlow.addColorStop(0, 'rgba(255,204,103,.13)')
    crownGlow.addColorStop(0.45, 'rgba(118,71,175,.055)')
    crownGlow.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = crownGlow
    context.fillRect(0, 0, size, 660)

    // Monumental stepped arches continue the physical torus moulding and make
    // the narrow areas beside the machine read as one coherent casino hall.
    const archGradient = context.createLinearGradient(70, 0, size - 70, 0)
    archGradient.addColorStop(0, 'rgba(56,216,255,.72)')
    archGradient.addColorStop(0.22, 'rgba(224,174,78,.76)')
    archGradient.addColorStop(0.5, 'rgba(255,224,150,.86)')
    archGradient.addColorStop(0.78, 'rgba(224,174,78,.76)')
    archGradient.addColorStop(1, 'rgba(173,79,255,.74)')
    for (let arch = 0; arch < 4; arch += 1) {
      context.beginPath()
      context.ellipse(
        center,
        612 + arch * 10,
        470 - arch * 27,
        548 - arch * 30,
        0,
        Math.PI,
        Math.PI * 2,
      )
      context.lineWidth = arch === 0 ? 10 : arch === 1 ? 4 : 2
      context.strokeStyle = arch === 0
        ? 'rgba(76,50,93,.88)'
        : arch === 1
          ? archGradient
          : `rgba(230,190,102,${0.32 - arch * 0.045})`
      context.stroke()
    }

    // Painted architectural bays remain visible between the real columns and
    // the cabinet. Their small bevels survive downsampling better than noise.
    for (const side of [-1, 1]) {
      const bayCenter = center + side * 395
      const bayGradient = context.createLinearGradient(
        bayCenter - 82,
        0,
        bayCenter + 82,
        0,
      )
      bayGradient.addColorStop(0, 'rgba(3,5,15,.96)')
      bayGradient.addColorStop(0.28, 'rgba(31,27,56,.94)')
      bayGradient.addColorStop(0.5, 'rgba(63,52,83,.78)')
      bayGradient.addColorStop(0.72, 'rgba(25,22,49,.94)')
      bayGradient.addColorStop(1, 'rgba(2,4,13,.96)')
      context.beginPath()
      context.moveTo(bayCenter - 88, 116)
      context.lineTo(bayCenter + 88, 116)
      context.lineTo(bayCenter + 104, 178)
      context.lineTo(bayCenter + 92, 770)
      context.lineTo(bayCenter + 64, 824)
      context.lineTo(bayCenter - 64, 824)
      context.lineTo(bayCenter - 92, 770)
      context.lineTo(bayCenter - 104, 178)
      context.closePath()
      context.fillStyle = bayGradient
      context.fill()
      context.lineWidth = 8
      context.strokeStyle = 'rgba(205,150,61,.55)'
      context.stroke()

      for (let flute = -2; flute <= 2; flute += 1) {
        const x = bayCenter + flute * 25
        const fluteGradient = context.createLinearGradient(x - 4, 0, x + 4, 0)
        fluteGradient.addColorStop(0, 'rgba(0,0,0,0)')
        fluteGradient.addColorStop(
          0.5,
          side < 0 ? 'rgba(63,213,255,.27)' : 'rgba(179,85,255,.27)',
        )
        fluteGradient.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = fluteGradient
        context.fillRect(x - 5, 190, 10, 548)
      }

      for (const y of [166, 258, 445, 632, 748]) {
        context.beginPath()
        context.roundRect(bayCenter - 74, y, 148, 11, 5)
        context.fillStyle = 'rgba(225,178,80,.35)'
        context.fill()
        context.fillStyle = side < 0
          ? 'rgba(57,210,255,.34)'
          : 'rgba(175,77,255,.34)'
        context.fillRect(bayCenter - 54, y + 3, 108, 3)
      }
    }

    // A polished perspective floor extends beyond the cabinet's base. It adds
    // depth in the side gutters while staying deliberately dark under the game.
    const floor = context.createLinearGradient(0, 620, 0, size)
    floor.addColorStop(0, 'rgba(35,25,55,.08)')
    floor.addColorStop(0.34, 'rgba(15,13,31,.72)')
    floor.addColorStop(1, 'rgba(2,4,12,.98)')
    context.fillStyle = floor
    context.fillRect(0, 620, size, size - 620)
    context.save()
    context.beginPath()
    context.rect(0, 620, size, size - 620)
    context.clip()
    for (let line = -7; line <= 7; line += 1) {
      context.beginPath()
      context.moveTo(center + line * 18, 620)
      context.lineTo(center + line * 92, size)
      context.lineWidth = line % 2 === 0 ? 2 : 1
      context.strokeStyle = line < 0
        ? 'rgba(58,197,255,.16)'
        : line > 0
          ? 'rgba(167,77,255,.16)'
          : 'rgba(236,187,88,.24)'
      context.stroke()
    }
    for (let row = 0; row < 9; row += 1) {
      const progress = row / 8
      const y = 635 + Math.pow(progress, 1.72) * 369
      context.beginPath()
      context.moveTo(0, y)
      context.lineTo(size, y)
      context.lineWidth = row % 3 === 0 ? 2 : 1
      context.strokeStyle = `rgba(220,177,87,${0.08 + progress * 0.08})`
      context.stroke()
    }
    context.restore()

    // Deterministic jewel lamps and dust motes supply the controlled detail of
    // a premium casino without shimmering temporal noise.
    let seed = 0x4f13b9
    const random = () => {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)
      return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296
    }
    for (let index = 0; index < 76; index += 1) {
      const side = index % 2 === 0 ? -1 : 1
      const x = center + side * (300 + random() * 205)
      const y = 72 + random() * 795
      const radius = 0.8 + random() * 2.3
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fillStyle = index % 5 === 0
        ? `rgba(255,212,122,${0.26 + random() * 0.42})`
        : side < 0
          ? `rgba(86,221,255,${0.16 + random() * 0.32})`
          : `rgba(193,112,255,${0.16 + random() * 0.32})`
      context.fill()
    }
    for (const side of [-1, 1]) {
      for (let lamp = 0; lamp < 5; lamp += 1) {
        const x = center + side * (438 + (lamp % 2) * 18)
        const y = 230 + lamp * 112
        const halo = context.createRadialGradient(x, y, 0, x, y, 31)
        halo.addColorStop(
          0,
          side < 0 ? 'rgba(176,244,255,.78)' : 'rgba(226,185,255,.78)',
        )
        halo.addColorStop(
          0.18,
          side < 0 ? 'rgba(46,203,255,.36)' : 'rgba(164,63,255,.36)',
        )
        halo.addColorStop(1, 'rgba(0,0,0,0)')
        context.fillStyle = halo
        context.fillRect(x - 34, y - 34, 68, 68)
        context.save()
        context.translate(x, y)
        context.rotate(Math.PI / 4)
        context.fillStyle = 'rgba(244,198,95,.74)'
        context.fillRect(-6, -6, 12, 12)
        context.fillStyle = side < 0 ? '#63dcff' : '#b86cff'
        context.fillRect(-3, -3, 6, 6)
        context.restore()
      }
    }

    const vignette = context.createRadialGradient(center, 490, 300, center, 490, 760)
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(0.72, 'rgba(0,0,0,.06)')
    vignette.addColorStop(1, 'rgba(0,0,0,.52)')
    context.fillStyle = vignette
    context.fillRect(0, 0, size, size)
  }
  const texture = createCanvasTexture(canvas)
  texture.anisotropy = 8
  return texture
}

function createGalacticPanelTexture() {
  const canvas = document.createElement('canvas')
  const logicalSize = 1024
  canvas.width = 512
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (context) {
    context.scale(canvas.width / logicalSize, canvas.height / logicalSize)
    context.clearRect(0, 0, logicalSize, logicalSize)
    const space = context.createLinearGradient(0, 0, logicalSize, logicalSize)
    space.addColorStop(0, 'rgba(2,7,18,.22)')
    space.addColorStop(0.45, 'rgba(20,5,46,.4)')
    space.addColorStop(1, 'rgba(2,12,29,.24)')
    context.fillStyle = space
    context.fillRect(0, 0, logicalSize, logicalSize)

    const cyanNebula = context.createRadialGradient(180, 720, 0, 180, 720, 520)
    cyanNebula.addColorStop(0, 'rgba(21,183,255,.18)')
    cyanNebula.addColorStop(0.45, 'rgba(18,102,220,.075)')
    cyanNebula.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = cyanNebula
    context.fillRect(0, 0, logicalSize, logicalSize)

    const violetNebula = context.createRadialGradient(820, 250, 0, 820, 250, 480)
    violetNebula.addColorStop(0, 'rgba(183,69,255,.18)')
    violetNebula.addColorStop(0.5, 'rgba(90,33,190,.07)')
    violetNebula.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = violetNebula
    context.fillRect(0, 0, logicalSize, logicalSize)

    let seed = 0x5a17c9
    const random = () => {
      seed = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      seed ^= seed + Math.imul(seed ^ (seed >>> 7), 61 | seed)
      return ((seed ^ (seed >>> 14)) >>> 0) / 4294967296
    }
    for (let index = 0; index < 230; index += 1) {
      const x = 28 + random() * (logicalSize - 56)
      const y = 28 + random() * (logicalSize - 56)
      const radius = 0.55 + random() * 1.65
      const alpha = 0.18 + random() * 0.62
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fillStyle = index % 7 === 0
        ? `rgba(123,226,255,${alpha})`
        : index % 9 === 0
          ? `rgba(220,154,255,${alpha})`
          : `rgba(255,239,198,${alpha})`
      context.fill()
    }

    context.lineWidth = 1.5
    context.strokeStyle = 'rgba(240,197,105,.11)'
    for (let line = 0; line < 7; line += 1) {
      const startX = 90 + random() * 840
      const startY = 80 + random() * 850
      context.beginPath()
      context.moveTo(startX, startY)
      for (let point = 1; point < 5; point += 1) {
        context.lineTo(
          Math.max(45, Math.min(979, startX + (random() - 0.5) * 370)),
          Math.max(45, Math.min(979, startY + point * 58 + (random() - 0.5) * 70)),
        )
      }
      context.stroke()
    }

    const border = context.createLinearGradient(0, 0, logicalSize, logicalSize)
    border.addColorStop(0, 'rgba(74,224,255,.38)')
    border.addColorStop(0.5, 'rgba(255,198,90,.2)')
    border.addColorStop(1, 'rgba(176,65,255,.38)')
    context.strokeStyle = border
    context.lineWidth = 9
    context.strokeRect(10, 10, logicalSize - 20, logicalSize - 20)
    context.lineWidth = 2
    context.strokeStyle = 'rgba(255,231,170,.32)'
    context.strokeRect(24, 24, logicalSize - 48, logicalSize - 48)
  }
  return createCanvasTexture(canvas)
}

function avatarAtlasTilePosition(slot: number) {
  const safeSlot = Math.max(0, Math.min(
    AVATAR_ATLAS_VIEWERS_PER_PAGE - 1,
    Math.floor(slot),
  ))
  return {
    x: (safeSlot % AVATAR_ATLAS_COLUMNS) * AVATAR_ATLAS_TILE_SIZE,
    y: Math.floor(safeSlot / AVATAR_ATLAS_COLUMNS) * AVATAR_ATLAS_TILE_SIZE,
  }
}

function avatarAtlasUvRect(slot: number): readonly [number, number, number, number] {
  const { x, y } = avatarAtlasTilePosition(slot)
  const contentSize = AVATAR_ATLAS_TILE_SIZE - AVATAR_ATLAS_TILE_PADDING * 2
  return [
    (x + AVATAR_ATLAS_TILE_PADDING) / AVATAR_ATLAS_TEXTURE_SIZE,
    (
      AVATAR_ATLAS_TEXTURE_SIZE
      - y
      - AVATAR_ATLAS_TILE_SIZE
      + AVATAR_ATLAS_TILE_PADDING
    ) / AVATAR_ATLAS_TEXTURE_SIZE,
    contentSize / AVATAR_ATLAS_TEXTURE_SIZE,
    contentSize / AVATAR_ATLAS_TEXTURE_SIZE,
  ]
}

function prepareAvatarAtlasTile(
  context: CanvasRenderingContext2D | null,
  slot: number,
) {
  if (!context) return null
  const { x, y } = avatarAtlasTilePosition(slot)
  const padding = AVATAR_ATLAS_TILE_PADDING
  const size = AVATAR_ATLAS_TILE_SIZE
  const contentX = x + padding
  const contentY = y + padding
  const contentSize = size - padding * 2
  context.save()
  context.clearRect(x, y, size, size)
  context.fillStyle = '#040914'
  context.fillRect(x, y, size, size)
  context.beginPath()
  context.arc(
    contentX + contentSize / 2,
    contentY + contentSize / 2,
    contentSize / 2,
    0,
    Math.PI * 2,
  )
  context.clip()
  return { contentSize, contentX, contentY }
}

function finishAvatarAtlasTile(
  context: CanvasRenderingContext2D | null,
  tile: { contentSize: number; contentX: number; contentY: number } | null,
) {
  if (!context || !tile) return
  context.restore()
  const centerX = tile.contentX + tile.contentSize / 2
  const centerY = tile.contentY + tile.contentSize / 2
  context.save()
  context.strokeStyle = 'rgba(255,255,255,.9)'
  context.lineWidth = 1.5
  context.beginPath()
  context.arc(centerX, centerY, tile.contentSize * 0.43, 0, Math.PI * 2)
  context.stroke()
  context.strokeStyle = 'rgba(251,191,36,.96)'
  context.lineWidth = 2
  context.beginPath()
  context.arc(centerX, centerY, tile.contentSize * 0.475, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function drawAvatarAtlasFallback(
  context: CanvasRenderingContext2D | null,
  slot: number,
  seed: string,
  name: string,
) {
  const tile = prepareAvatarAtlasTile(context, slot)
  if (!context || !tile) return
  const hue = hashText(seed) % 360
  const centerX = tile.contentX + tile.contentSize / 2
  const centerY = tile.contentY + tile.contentSize / 2
  const gradient = context.createRadialGradient(
    tile.contentX + tile.contentSize * 0.31,
    tile.contentY + tile.contentSize * 0.22,
    tile.contentSize * 0.05,
    centerX,
    centerY,
    tile.contentSize * 0.74,
  )
  gradient.addColorStop(0, `hsl(${(hue + 42) % 360} 95% 72%)`)
  gradient.addColorStop(0.52, `hsl(${hue} 78% 48%)`)
  gradient.addColorStop(1, '#07101f')
  context.fillStyle = gradient
  context.fillRect(tile.contentX, tile.contentY, tile.contentSize, tile.contentSize)
  context.fillStyle = '#ffffff'
  context.shadowColor = '#000000'
  context.shadowBlur = 4
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `900 ${Math.round(tile.contentSize * 0.31)}px Inter, Arial, sans-serif`
  context.fillText(initials(name), centerX, centerY + 1)
  finishAvatarAtlasTile(context, tile)
}

function drawAvatarAtlasImage(
  context: CanvasRenderingContext2D | null,
  slot: number,
  image: HTMLImageElement,
) {
  const tile = prepareAvatarAtlasTile(context, slot)
  if (!context || !tile) return
  const sourceWidth = Math.max(1, image.naturalWidth || image.width || 1)
  const sourceHeight = Math.max(1, image.naturalHeight || image.height || 1)
  const sourceSize = Math.min(sourceWidth, sourceHeight)
  const sourceX = (sourceWidth - sourceSize) / 2
  const sourceY = (sourceHeight - sourceSize) / 2
  try {
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      tile.contentX,
      tile.contentY,
      tile.contentSize,
      tile.contentSize,
    )
  } finally {
    finishAvatarAtlasTile(context, tile)
  }
}

function createFloatingScoreTexture(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 128
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.beginPath()
    context.roundRect(5, 5, canvas.width - 10, canvas.height - 10, 25)
    context.fillStyle = 'rgba(2,6,16,.95)'
    context.fill()
    context.lineWidth = 6
    context.strokeStyle = color
    context.stroke()

    const accent = context.createLinearGradient(44, 0, canvas.width - 44, 0)
    accent.addColorStop(0, 'rgba(255,255,255,0)')
    accent.addColorStop(0.5, color)
    accent.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = accent
    context.fillRect(44, 108, canvas.width - 88, 3)

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const fontSize = fitScoreFont(context, text, 268, 82, 44)
    context.font = scoreFont(fontSize)
    context.lineJoin = 'round'
    context.lineWidth = Math.max(8, fontSize * 0.14)
    context.strokeStyle = 'rgba(1,3,10,.98)'
    context.strokeText(text, canvas.width / 2, 62)
    context.shadowColor = color
    context.shadowBlur = 12
    context.fillStyle = '#ffffff'
    context.fillText(text, canvas.width / 2, 62)
  }
  return createCanvasTexture(canvas)
}

function createScoreSlotTexture(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)

    context.beginPath()
    context.roundRect(8, 8, canvas.width - 16, canvas.height - 16, 34)
    const panel = context.createLinearGradient(0, 8, 0, canvas.height - 8)
    panel.addColorStop(0, 'rgba(14,22,38,.99)')
    panel.addColorStop(0.54, 'rgba(3,8,18,.99)')
    panel.addColorStop(1, 'rgba(1,3,10,.99)')
    context.fillStyle = panel
    context.fill()
    context.lineWidth = 11
    context.strokeStyle = color
    context.stroke()

    context.beginPath()
    context.roundRect(21, 21, canvas.width - 42, canvas.height - 42, 24)
    context.lineWidth = 2
    context.strokeStyle = 'rgba(255,255,255,.28)'
    context.stroke()

    const accent = context.createLinearGradient(70, 0, canvas.width - 70, 0)
    accent.addColorStop(0, 'rgba(255,255,255,0)')
    accent.addColorStop(0.22, color)
    accent.addColorStop(0.5, '#ffffff')
    accent.addColorStop(0.78, color)
    accent.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = accent
    context.fillRect(70, 222, canvas.width - 140, 7)

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const fontSize = fitScoreFont(context, text, 430, 176, 76)
    context.font = scoreFont(fontSize)
    context.lineJoin = 'round'
    context.lineWidth = Math.max(15, fontSize * 0.13)
    context.strokeStyle = 'rgba(0,2,8,1)'
    context.strokeText(text, canvas.width / 2, 126)
    context.shadowColor = color
    context.shadowBlur = 20
    context.fillStyle = '#ffffff'
    context.fillText(text, canvas.width / 2, 126)
  }
  return createCanvasTexture(canvas)
}

function createGalacticScoreSlotTexture(text: string, color: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)

    context.beginPath()
    context.moveTo(42, 10)
    context.lineTo(canvas.width - 42, 10)
    context.lineTo(canvas.width - 10, 48)
    context.lineTo(canvas.width - 10, canvas.height - 42)
    context.lineTo(canvas.width - 48, canvas.height - 10)
    context.lineTo(48, canvas.height - 10)
    context.lineTo(10, canvas.height - 42)
    context.lineTo(10, 48)
    context.closePath()
    const panel = context.createLinearGradient(0, 8, 0, canvas.height - 8)
    panel.addColorStop(0, 'rgba(23,20,43,.99)')
    panel.addColorStop(0.42, 'rgba(5,5,14,.995)')
    panel.addColorStop(1, 'rgba(1,2,7,.995)')
    context.fillStyle = panel
    context.fill()
    context.lineWidth = 12
    context.strokeStyle = color
    context.shadowColor = color
    context.shadowBlur = 18
    context.stroke()

    context.shadowBlur = 0
    context.beginPath()
    context.moveTo(58, 28)
    context.lineTo(canvas.width - 58, 28)
    context.lineTo(canvas.width - 29, 58)
    context.lineTo(canvas.width - 29, canvas.height - 54)
    context.lineTo(canvas.width - 58, canvas.height - 28)
    context.lineTo(58, canvas.height - 28)
    context.lineTo(29, canvas.height - 54)
    context.lineTo(29, 58)
    context.closePath()
    context.lineWidth = 3
    context.strokeStyle = 'rgba(255,222,150,.58)'
    context.stroke()

    const topAccent = context.createLinearGradient(70, 0, canvas.width - 70, 0)
    topAccent.addColorStop(0, 'rgba(255,255,255,0)')
    topAccent.addColorStop(0.25, color)
    topAccent.addColorStop(0.5, '#fff4ce')
    topAccent.addColorStop(0.75, color)
    topAccent.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = topAccent
    context.fillRect(70, 39, canvas.width - 140, 5)
    context.fillRect(92, 216, canvas.width - 184, 5)

    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const fontSize = fitScoreFont(context, text, 416, 174, 74)
    context.font = scoreFont(fontSize)
    context.lineJoin = 'round'
    context.lineWidth = Math.max(16, fontSize * 0.135)
    context.strokeStyle = 'rgba(0,1,6,1)'
    context.strokeText(text, canvas.width / 2, 129)
    context.shadowColor = color
    context.shadowBlur = 24
    context.fillStyle = '#fff8e7'
    context.fillText(text, canvas.width / 2, 129)
  }
  return createCanvasTexture(canvas)
}

function fitScoreFont(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initialSize: number,
  minimumSize: number,
) {
  let size = initialSize
  while (size > minimumSize) {
    context.font = scoreFont(size)
    if (context.measureText(text).width <= maxWidth) break
    size -= 4
  }
  return Math.max(minimumSize, size)
}

function scoreFont(size: number) {
  return `900 ${size}px Inter, Arial Black, Arial, sans-serif`
}

function createCanvasTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function scoreColor(value: number, index: number) {
  if (value < 0) return new THREE.Color(0xdf3f62)
  if (value === 0) return new THREE.Color(index % 2 ? 0x4f46e5 : 0x475569)
  if (value >= 25) return new THREE.Color(0xe7b84b)
  if (value >= 10) return new THREE.Color(0x8b5cf6)
  return new THREE.Color(0x28c7d8)
}

function galacticScoreColor(value: number, index: number) {
  if (value < 0) return new THREE.Color(0xf13c73)
  if (value === 0) return new THREE.Color(index % 2 ? 0x635bff : 0x48556f)
  if (value >= 25) return new THREE.Color(0xf6bd43)
  const palette = [0x16c8ee, 0xc24cff, 0x735dff, 0xff4dc7, 0xf6bd43]
  return new THREE.Color(palette[index % palette.length])
}

function initials(value: string) {
  return String(value || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?'
}

function hashText(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function disposeChildren(group: THREE.Group) {
  while (group.children.length) {
    const child = group.children[0]
    group.remove(child)
    disposeObject(child)
  }
}

function disposeObject(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (mesh.geometry) geometries.add(mesh.geometry)
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
    for (const material of sourceMaterials) {
      materials.add(material)
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value)
      }
    }
  })
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
  for (const geometry of geometries) geometry.dispose()
  root.removeFromParent()
}
