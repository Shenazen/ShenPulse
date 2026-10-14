import * as THREE from 'three'
import { GALACTIC_BACKDROP_COLUMN_X, GALACTIC_BACKDROP_COLUMN_Y, GALACTIC_BACKDROP_COLUMN_Z } from './constants'
import { createGalacticCasinoBackdropTexture } from './machine-textures'
import { neonMaterial, addRoundedBox, addBeamBetween3d } from './geometry'
import type { GalacticDecorContext } from './galactic-context'
import type { GalacticPalette } from './galactic-palette'

/** Assemble la salle arrière, son illustration, ses arches et ses colonnes lumineuses. */
export function buildGalacticBackdrop(context: GalacticDecorContext, palette: GalacticPalette) {
  const { root, obsidianInset, royalGold, antiqueGold, deepBronze } = palette
  // --- Celestial casino hall ---------------------------------------------------
  // The cabinet now sits in a deliberate, symmetrical casino interior instead
  // of in front of a black wall. The backdrop stays in its own non-interactive
  // group, behind every gameplay surface, and uses emissive textures/materials
  // rather than extra dynamic lights.
  context.galacticBackdropRoot.name = 'galactic-palace-hall-backdrop'
  root.add(context.galacticBackdropRoot)
  const backdrop = context.galacticBackdropRoot

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
  context.galacticBackdropPulseMaterials.push(backdropCyan, backdropViolet, backdropWarm)

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
      context.dummy.position.set(side * 5.22, 0.38 + index * 1.92, -6.16)
      context.dummy.quaternion.identity()
      context.dummy.rotation.z = Math.PI / 4
      const scale = 0.88 + (index % 2) * 0.18
      context.dummy.scale.set(scale, scale * 1.35, scale * 0.72)
      context.dummy.updateMatrix()
      sconces.setMatrixAt(index, context.dummy.matrix)
    }
    sconces.instanceMatrix.needsUpdate = true
    sconces.computeBoundingSphere()
    backdrop.add(sconces)
  }
}

