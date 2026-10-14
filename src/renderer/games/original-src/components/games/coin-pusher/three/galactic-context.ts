import * as THREE from 'three'

/** Dépendances explicites des constructeurs du décor, sans référence au renderer principal. */
export type GalacticDecorContext = {
  galacticThemeRoot: THREE.Group
  machineRoot: THREE.Group
  dummy: THREE.Object3D
  galacticAmbientAccents: Array<{
    baseHue: number
    baseIntensity: number
    material: THREE.MeshStandardMaterial
    phase: number
    pulseRange: number
    speed: number
  }>
  galacticBackdropRoot: THREE.Group
  galacticBackdropPulseMaterials: THREE.MeshStandardMaterial[]
  galacticPlinkoSurfaceMaterial: THREE.MeshPhysicalMaterial
  galacticCrest: THREE.Group
  galacticDiamond: THREE.Group
  pointTexture: THREE.CanvasTexture
  logoTexture: THREE.Texture
  galacticPusherThemeRoot: THREE.Group
  pusherGroup: THREE.Group
  galacticPulseMaterials: THREE.MeshStandardMaterial[]
}

