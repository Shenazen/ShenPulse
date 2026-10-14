import * as THREE from 'three'
import type { SurfaceTextureState, SurfaceTextureTarget } from './types'
import { createSurfaceTextureState, configureSurfaceTexture } from './resources'
import { setGalacticPlinkoPanelUvCrop, surfaceTextureAspect } from './geometry'

/** Chargements des surfaces : tokens anti-callback obsolète, reprise bornée et partage des textures. */
export class SurfaceTextures {
  private readonly platformTextureState = createSurfaceTextureState()
  private readonly plinkoTextureState = createSurfaceTextureState()
  private readonly textureLoader = new THREE.TextureLoader()
  private readonly platformTargets: Record<'arcade' | 'galactic-palace', readonly SurfaceTextureTarget[]>
  private readonly plinkoTargets: Record<'arcade' | 'galactic-palace', readonly SurfaceTextureTarget[]>
  private plinkoAspect: number | undefined
  private disposed = false
  constructor(private readonly options: {
    renderer: THREE.WebGLRenderer
    getTheme: () => 'arcade' | 'galactic-palace'
    getPlinkoGeometry: () => THREE.BufferGeometry
    platformMaterial: THREE.MeshPhysicalMaterial
    movingDeckSurfaceMaterial: THREE.MeshPhysicalMaterial
    pusherGapSurfaceMaterial: THREE.MeshPhysicalMaterial
    plinkoMaterial: THREE.MeshPhysicalMaterial
    galacticPlinkoSurfaceMaterial: THREE.MeshPhysicalMaterial
  }) {
    this.textureLoader.setCrossOrigin('anonymous')
    // Les callbacks gardent le lot immutable du thème qui a demandé leur image.
    const platformTargets = (isGalactic: boolean): readonly SurfaceTextureTarget[] => [
      {
        fallbackColor: isGalactic ? 0x171127 : 0x19324b,
        material: options.platformMaterial,
        textureColor: isGalactic ? 0xf8f2ff : 0xf1f4f7,
      },
      {
        fallbackColor: isGalactic ? 0x0d0a18 : 0x111827,
        material: options.movingDeckSurfaceMaterial,
        textureColor: isGalactic ? 0xf7f1ff : 0xe8edf2,
      },
    ]
    const plinkoTargets = (isGalactic: boolean): readonly SurfaceTextureTarget[] => [
      {
        fallbackColor: isGalactic ? 0x090817 : 0x0b1324,
        material: options.plinkoMaterial,
        textureColor: isGalactic ? 0xf7f2ff : 0xf1f4f7,
      },
      {
        fallbackColor: 0x080713,
        material: options.galacticPlinkoSurfaceMaterial,
        textureColor: 0xe7def2,
      },
    ]
    this.platformTargets = { arcade: platformTargets(false), 'galactic-palace': platformTargets(true) }
    this.plinkoTargets = { arcade: plinkoTargets(false), 'galactic-palace': plinkoTargets(true) }
  }
  /** Met à jour les deux surfaces indépendantes avec les URL demandées. */
  sync(platformUrl: string, plinkoUrl: string) {
    this.ensurePlatformTexture(platformUrl)
    this.ensurePlinkoTexture(plinkoUrl)
  }
  /** Réapplique les couleurs du thème sans relancer les chargements. */
  applyThemeSurfaceColors() {
    const isGalactic = this.options.getTheme() === 'galactic-palace'
    this.options.platformMaterial.color.setHex(
      this.platformTextureState.texture
        ? isGalactic ? 0xf8f2ff : 0xf1f4f7
        : isGalactic ? 0x0b0a12 : 0x19324b,
    )
    this.options.movingDeckSurfaceMaterial.color.setHex(
      this.platformTextureState.texture
        ? isGalactic ? 0xf7f1ff : 0xe8edf2
        : isGalactic ? 0x07070c : 0x111827,
    )
    this.options.pusherGapSurfaceMaterial.color.setHex(isGalactic ? 0x5a5263 : 0x263b52)
    this.options.plinkoMaterial.color.setHex(
      this.plinkoTextureState.texture
        ? isGalactic ? 0xf7f2ff : 0xf1f4f7
        : isGalactic ? 0x090817 : 0x0b1324,
    )
    this.options.galacticPlinkoSurfaceMaterial.color.setHex(
      this.plinkoTextureState.texture ? 0xe7def2 : 0x080713,
    )
    this.options.platformMaterial.emissive.setHex(isGalactic ? 0x030108 : 0x071827)
    this.options.movingDeckSurfaceMaterial.emissive.setHex(isGalactic ? 0x020106 : 0x03111d)
    this.options.pusherGapSurfaceMaterial.emissive.setHex(isGalactic ? 0x13091d : 0x071827)
    this.options.plinkoMaterial.emissive.setHex(isGalactic ? 0x020106 : 0x030815)
    this.options.platformMaterial.needsUpdate = true
    this.options.movingDeckSurfaceMaterial.needsUpdate = true
    this.options.pusherGapSurfaceMaterial.needsUpdate = true
    this.options.plinkoMaterial.needsUpdate = true
    this.options.galacticPlinkoSurfaceMaterial.needsUpdate = true
  }
  private ensurePlatformTexture(url: string) {
    this.ensureSurfaceTexture(url, this.platformTextureState, this.platformTargets[this.options.getTheme()])
  }
  private ensurePlinkoTexture(url: string) {
    this.ensureSurfaceTexture(url, this.plinkoTextureState, this.plinkoTargets[this.options.getTheme()])
  }
  private ensurePlinkoUvCrop(aspect: number) {
    if (this.plinkoAspect === aspect) return
    setGalacticPlinkoPanelUvCrop(this.options.getPlinkoGeometry(), aspect)
    this.plinkoAspect = aspect
  }
  private ensureSurfaceTexture(
    url: string,
    state: SurfaceTextureState,
    targets: readonly SurfaceTextureTarget[],
  ) {
    const cleanUrl = String(url || '').trim()
    const targetsGalacticPlinko = targets.some(
      (target) => target.material === this.options.galacticPlinkoSurfaceMaterial,
    )
    if (cleanUrl !== state.desiredUrl) {
      state.desiredUrl = cleanUrl
      state.loadingUrl = ''
      state.retryAt = 0
      state.token += 1
    }

    if (!cleanUrl) {
      if (targetsGalacticPlinko && this.options.getPlinkoGeometry()) {
        this.ensurePlinkoUvCrop(1)
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

        configureSurfaceTexture(texture, this.options.renderer)
        if (targetsGalacticPlinko && this.options.getPlinkoGeometry()) {
            this.ensurePlinkoUvCrop(surfaceTextureAspect(texture))
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
  /** Invalide les callbacks puis libère uniquement les textures chargées par ce gestionnaire. */
  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.platformTextureState.token += 1
    this.plinkoTextureState.token += 1
    this.platformTextureState.texture?.dispose()
    this.plinkoTextureState.texture?.dispose()
  }
}

