import * as THREE from 'three'
import type { ScoreSpriteResource, ScoreTextureResource, CoinPusher3dFloatingScore } from './types'
import { MAX_FLOATING_SCORE_SPRITES, MAX_FLOATING_SCORE_TEXTURES } from './constants'
import { setLogicalPoint } from './positions'
import { createFloatingScoreTexture } from './score-textures'

/** Pool borné de sprites et cache partagé des textures de scores ; aucune allocation de sprite par frame. */
export class FloatingScores {
  readonly floatingScoreGroup = new THREE.Group()
  private readonly floatingScorePool: ScoreSpriteResource[] = []
  private readonly floatingScoreSprites = new Map<number, ScoreSpriteResource>()
  private readonly floatingScoreTextures = new Map<string, ScoreTextureResource>()
  private readonly targetPosition = new THREE.Vector3()
  private frameIndex = 0
  /** Met à jour les scores visibles et restitue les sprites expirés au pool. */
  sync(scores: readonly CoinPusher3dFloatingScore[], frameIndex: number) {
    this.frameIndex = frameIndex
    this.syncFloatingScores(scores)
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
  /** Libère les sprites puis les textures et leurs références partagées. */
  dispose() {
    for (const [id, resource] of this.floatingScoreSprites) this.releaseFloatingScore(id, resource)
    for (const resource of this.floatingScorePool) resource.material.dispose()
    for (const resource of this.floatingScoreTextures.values()) resource.texture.dispose()
    this.floatingScorePool.splice(0)
    this.floatingScoreTextures.clear()
  }
}

