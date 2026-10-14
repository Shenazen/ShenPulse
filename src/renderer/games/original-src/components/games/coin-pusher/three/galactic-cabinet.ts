import * as THREE from 'three'
import { GALACTIC_REAR_SILL_FRONT_Z, GALACTIC_PLINKO_PLANE_NORMAL, GALACTIC_PLINKO_VEIL_OFFSET_Z } from './constants'
import { createGalacticPanelTexture } from './machine-textures'
import { addRoundedBox, addBeamBetween3d, addExtrudedPanel, createGalacticPlinkoPanelGeometry } from './geometry'
import type { GalacticDecorContext } from './galactic-context'
import type { GalacticPalette } from './galactic-palette'

/** Assemble le cadre incliné et retourne la géométrie recadrable de l'image personnalisée. */
export function buildGalacticCabinet(context: GalacticDecorContext, palette: GalacticPalette) {
  const { root, obsidian, obsidianInset, royalGold, antiqueGold, cyanNeon, electricCyan, violetNeon, magentaNeon, deepBronze } = palette
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
  const galacticPlinkoPanelGeometry = createGalacticPlinkoPanelGeometry()
  const selectedArtPanel = new THREE.Mesh(
    galacticPlinkoPanelGeometry,
    context.galacticPlinkoSurfaceMaterial,
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
    context.dummy.position.set(
      side * THREE.MathUtils.lerp(3.4, 3.52, progress),
      THREE.MathUtils.lerp(3.75, 8.56, progress),
      THREE.MathUtils.lerp(-2.38, -3.46, progress),
    )
    context.dummy.quaternion.identity()
    context.dummy.rotation.z = Math.PI / 4
    context.dummy.scale.set(1, 1.35, 0.6)
    context.dummy.updateMatrix()
    trimStuds.setMatrixAt(index, context.dummy.matrix)
  }
  trimStuds.instanceMatrix.needsUpdate = true
  trimStuds.renderOrder = 3
  root.add(trimStuds)
  return galacticPlinkoPanelGeometry
}

