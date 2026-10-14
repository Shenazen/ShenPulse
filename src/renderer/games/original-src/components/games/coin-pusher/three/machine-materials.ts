import * as THREE from 'three'
import { GOLD, CYAN } from './constants'

/** Matériaux partagés du meuble : chaque instance de renderer possède son propre lot GPU. */
export function createMachineMaterials() {
  const goldMaterial = new THREE.MeshPhysicalMaterial({
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    color: GOLD,
    emissive: 0x6d3700,
    emissiveIntensity: 0.08,
    envMapIntensity: 0.8,
    metalness: 1,
    roughness: 0.3,
  })
  const platformMaterial = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.22,
    clearcoatRoughness: 0.48,
    color: 0x19324b,
    emissive: 0x071827,
    emissiveIntensity: 0.04,
    envMapIntensity: 0.4,
    metalness: 0.08,
    roughness: 0.76,
  })
  const movingDeckSurfaceMaterial = new THREE.MeshPhysicalMaterial({
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
  const pusherGapSurfaceMaterial = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.58,
    clearcoatRoughness: 0.32,
    color: 0x263b52,
    emissive: 0x071827,
    emissiveIntensity: 0.12,
    envMapIntensity: 0.7,
    metalness: 0.72,
    roughness: 0.42,
  })
  const plinkoMaterial = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.18,
    clearcoatRoughness: 0.56,
    color: 0x0b1324,
    emissive: 0x030815,
    emissiveIntensity: 0.035,
    envMapIntensity: 0.26,
    metalness: 0.06,
    roughness: 0.82,
  })
  const galacticPlinkoSurfaceMaterial = new THREE.MeshPhysicalMaterial({
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
  const pusherGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0x9af7ff,
    emissive: CYAN,
    emissiveIntensity: 0.9,
    metalness: 0.25,
    roughness: 0.32,
  })
  const sideGuardFrameMaterial = new THREE.MeshPhysicalMaterial({
    clearcoat: 0.88,
    clearcoatRoughness: 0.16,
    color: 0x101a28,
    emissive: 0x06101e,
    emissiveIntensity: 0.1,
    envMapIntensity: 0.86,
    metalness: 0.94,
    roughness: 0.24,
  })
  const sideGuardGlowMaterial = new THREE.MeshStandardMaterial({
    color: 0x8cf7ff,
    emissive: CYAN,
    emissiveIntensity: 0.88,
    metalness: 0.28,
    roughness: 0.2,
  })
  return { goldMaterial, platformMaterial, movingDeckSurfaceMaterial, pusherGapSurfaceMaterial, plinkoMaterial, galacticPlinkoSurfaceMaterial, pusherGlowMaterial, sideGuardFrameMaterial, sideGuardGlowMaterial }
}
export type MachineMaterials = ReturnType<typeof createMachineMaterials>

