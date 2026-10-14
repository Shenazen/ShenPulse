import * as THREE from 'three'
import type { AvatarAtlasEntry, AvatarAtlasLoadJob, AvatarAtlasPage, CoinPusher3dCoin } from './types'
import { AVATAR_ATLAS_TEXTURE_SIZE, AVATAR_PAGE_INITIAL_COIN_CAPACITY, AVATAR_ATLAS_VIEWERS_PER_PAGE, AVATAR_ATLAS_MAX_LOAD_ATTEMPTS, AVATAR_ATLAS_RETRY_BACKOFF_FRAMES, AVATAR_ATLAS_MAX_CONCURRENT_LOADS, AVATAR_ATLAS_ENTRY_IDLE_FRAMES, AVATAR_ATLAS_UPLOAD_INTERVAL_FRAMES } from './constants'
import { nextCoinPusherInstanceCapacity, coinPusherAvatarSnapshotKey } from './math'
import { drawAvatarAtlasFallback, drawAvatarAtlasImage, avatarAtlasUvRect } from './avatar-canvas'

/** Atlas partagé des portraits : pages GPU, file de chargement bornée et éviction par inactivité. */
export class AvatarAtlas {
  private readonly avatarAtlasEntries = new Map<string, AvatarAtlasEntry>()
  private activeAvatarAtlasLoads = 0
  private readonly avatarAtlasLoadQueue: AvatarAtlasLoadJob[] = []
  readonly avatarAtlasPages = new Map<number, AvatarAtlasPage>()
  private readonly avatarImageLoader = new THREE.ImageLoader()
  private nextAvatarAtlasPageId = 0
  private disposed = false
  private frameIndex = 0

  constructor(private readonly options: { root: THREE.Group; circleGeometry: THREE.CircleGeometry }) {
    this.avatarImageLoader.setCrossOrigin('anonymous')
  }

  /** Avance le compteur utilisé pour les reprises, uploads et évictions. */
  setFrame(frameIndex: number) { this.frameIndex = frameIndex }
  private createAvatarAtlasGeometry(capacity: number) {
    const geometry = this.options.circleGeometry.clone()
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
    this.options.root.add(front, back)

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
  /** Agrandit les instances d'une page sans modifier ses portraits ni réduire sa capacité. */
  ensureAvatarAtlasPageCapacity(page: AvatarAtlasPage, required: number) {
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
    this.options.root.add(page.front, page.back)
    this.options.root.remove(previousFront, previousBack)
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
    this.options.root.remove(page.front, page.back)
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
  /** Reprend uniquement les portraits visibles dont le délai et le budget autorisent une tentative. */
  retryActiveAvatarAtlasLoads() {
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
  /** Obtient la tuile immuable du couple spectateur/portrait et marque sa présence dans cette frame. */
  ensureAvatarAtlasEntry(
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
  /** Recycle les cases inactives ; une page vide est retirée puis libérée. */
  sweepAvatarAtlasEntries() {
    for (const [key, entry] of this.avatarAtlasEntries) {
      if (this.frameIndex - entry.lastSeenFrame > AVATAR_ATLAS_ENTRY_IDLE_FRAMES) {
        this.releaseAvatarAtlasEntry(key, entry)
      }
    }
  }
  /** Publie les pixels modifiés au rythme borné prévu pour les uploads de portraits. */
  flushAvatarAtlasTextures() {
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

  /** Invalide les callbacks et libère toutes les pages sans disposer les ressources des pièces. */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.avatarAtlasLoadQueue.splice(0)
    this.avatarAtlasEntries.clear()
    for (const page of this.avatarAtlasPages.values()) this.disposeAvatarAtlasPage(page)
    this.avatarAtlasPages.clear()
  }
}

