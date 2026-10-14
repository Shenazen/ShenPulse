/** Contrats des objets et ressources du rendu 3D ; aucun état mutable partagé. */
import * as THREE from 'three'

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

export type AvatarAtlasEntry = {
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

export type AvatarAtlasLoadJob = {
  entry: AvatarAtlasEntry
  token: number
  url: string
}

export type AvatarAtlasPage = {
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

export type CoinPose = {
  lastSeenFrame: number
  position: THREE.Vector3
  quaternion: THREE.Quaternion
}

export type ScoreSpriteResource = {
  lastSeenFrame: number
  material: THREE.SpriteMaterial
  sprite: THREE.Sprite
  textureKey: string
}

export type ScoreTextureResource = {
  lastUsedFrame: number
  references: number
  texture: THREE.CanvasTexture
}

export type SurfaceTextureState = {
  desiredUrl: string
  loadedUrl: string
  loadingUrl: string
  retryAt: number
  texture: THREE.Texture | null
  token: number
}

export type SurfaceTextureTarget = {
  fallbackColor: number
  material: THREE.MeshPhysicalMaterial
  textureColor: number
}

