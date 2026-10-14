import * as THREE from 'three'
import { neonMaterial } from './geometry'
import type { GalacticDecorContext } from './galactic-context'

/** Crée la palette galactique et attache le groupe dans le même ordre que le meuble arcade. */
export function createGalacticPalette(context: GalacticDecorContext) {
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
    context.galacticPulseMaterials.push(material)
  }

  const root = context.galacticThemeRoot
  root.name = 'coin-pusher-galactic-palace'
  root.visible = false
  context.machineRoot.add(root)
  return { root, obsidian, obsidianInset, royalGold, antiqueGold, cyanNeon, electricCyan, violetNeon, magentaNeon, warmNeon, deepBronze }
}
export type GalacticPalette = ReturnType<typeof createGalacticPalette>

