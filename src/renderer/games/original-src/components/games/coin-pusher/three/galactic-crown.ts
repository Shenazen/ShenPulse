import * as THREE from 'three'
import { addRoundedBox, addExtrudedPanel, createBrilliantDiamondGeometry } from './geometry'
import type { GalacticDecorContext } from './galactic-context'
import type { GalacticPalette } from './galactic-palette'

/** Assemble la couronne, la marque et le diamant ; retourne le matériau animé de ce dernier. */
export function buildGalacticCrown(context: GalacticDecorContext, palette: GalacticPalette) {
  const { root, obsidian, obsidianInset, royalGold, antiqueGold, cyanNeon, electricCyan, violetNeon, warmNeon } = palette
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
  context.galacticCrest.position.set(0, 9.58, -2.62)
  context.galacticCrest.name = 'galactic-amethyst-crest'
  root.add(context.galacticCrest)
  addExtrudedPanel(
    context.galacticCrest,
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
  context.galacticCrest.add(outerCrestRing, innerCrestRing)

  const galacticDiamondMaterial = new THREE.MeshPhysicalMaterial({
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
  context.galacticDiamond.name = 'galactic-amethyst-diamond-pivot'
  context.galacticDiamond.position.z = 0.34
  context.galacticDiamond.rotation.y = Math.PI / 8
  context.galacticDiamond.scale.set(0.82, 0.86, 0.72)
  const gem = new THREE.Mesh(
    createBrilliantDiamondGeometry(),
    galacticDiamondMaterial,
  )
  gem.name = 'galactic-amethyst'
  gem.castShadow = true
  context.galacticDiamond.add(gem)
  context.galacticCrest.add(context.galacticDiamond)

  const crestGlowMaterial = new THREE.SpriteMaterial({
    blending: THREE.AdditiveBlending,
    color: 0xac56ff,
    depthTest: true,
    depthWrite: false,
    map: context.pointTexture,
    opacity: 0.09,
    toneMapped: false,
    transparent: true,
  })
  const crestGlow = new THREE.Sprite(crestGlowMaterial)
  crestGlow.position.z = 0.08
  crestGlow.scale.set(1.65, 1.65, 1)
  crestGlow.renderOrder = 7
  context.galacticCrest.add(crestGlow)

  addRoundedBox(root, [1.72, 0.24, 0.19], [0, 8.98, -2.82], obsidian, 0.05)
  addRoundedBox(root, [1.5, 0.028, 0.045], [0, 9.08, -2.7], warmNeon, 0.009)
  const galacticBrandMaterial = new THREE.MeshStandardMaterial({
    alphaTest: 0.012,
    color: 0xfff7df,
    emissive: 0x8fdfff,
    emissiveIntensity: 0.06,
    emissiveMap: context.logoTexture,
    map: context.logoTexture,
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
  return galacticDiamondMaterial
}

