import { PUSHER_FACE_LOCAL_Z, GALACTIC_REAR_SILL_HEIGHT, GALACTIC_REAR_SILL_DEPTH, GALACTIC_REAR_SILL_CENTER_Y, GALACTIC_REAR_SILL_CENTER_Z, GALACTIC_REAR_SILL_TRIM_DEPTH, GALACTIC_REAR_SILL_TRIM_CENTER_Z } from './constants'
import { addRoundedBox, addBeamBetween3d, addExtrudedPanel } from './geometry'
import type { GalacticDecorContext } from './galactic-context'
import type { GalacticPalette } from './galactic-palette'

/** Assemble le socle, les bordures et la peau galactique du pousseur mobile. */
export function buildGalacticBase(context: GalacticDecorContext, palette: GalacticPalette) {
  const { root, obsidian, obsidianInset, royalGold, antiqueGold, cyanNeon, electricCyan, violetNeon, magentaNeon, warmNeon, deepBronze } = palette
  // The lower Plinko sill is a recessed back wall, never a foreground mask.
  // Its underside clears the moving deck and its front face stays behind the
  // largest supported coin, die or ticket at the fixed chute impact point.
  addRoundedBox(
    root,
    [7.45, GALACTIC_REAR_SILL_HEIGHT, GALACTIC_REAR_SILL_DEPTH],
    [0, GALACTIC_REAR_SILL_CENTER_Y, GALACTIC_REAR_SILL_CENTER_Z],
    obsidianInset,
    0.06,
  )
  addRoundedBox(
    root,
    [6.92, 0.055, GALACTIC_REAR_SILL_TRIM_DEPTH],
    [0, 3.19, GALACTIC_REAR_SILL_TRIM_CENTER_Z],
    warmNeon,
    0.018,
  )
  addRoundedBox(root, [0.54, 1.28, 1.15], [-3.48, 2.7, -2.28], obsidian, 0.1)
  addRoundedBox(root, [0.54, 1.28, 1.15], [3.48, 2.7, -2.28], obsidian, 0.1)
  for (const side of [-1, 1]) {
    const lowerCorner = addExtrudedPanel(
      root,
      [
        [-0.5, 0.52],
        [0.22, 0.52],
        [0.48, 0.18],
        [0.4, -0.42],
        [0.08, -0.58],
        [-0.46, -0.38],
      ],
      0.38,
      obsidianInset,
      [side * 3.18, 3.08, -2.08],
    )
    lowerCorner.rotation.y = side < 0 ? 0 : Math.PI
    const lowerCornerTrim = addBeamBetween3d(
      root,
      [side * 2.78, 3.4, -1.82],
      [side * 3.29, 2.75, -1.61],
      0.07,
      0.08,
      royalGold,
      0.015,
    )
    lowerCornerTrim.renderOrder = 4
    addRoundedBox(
      root,
      [0.32, 0.055, 0.09],
      [side * 3.2, 2.75, -1.54],
      side < 0 ? electricCyan : magentaNeon,
      0.012,
    )
  }

  // Sculpted shelf armour and illuminated score-bank surround.
  addRoundedBox(root, [7.38, 0.42, 0.48], [0, 2.12, 3.12], obsidian, 0.09)
  addRoundedBox(root, [7.05, 0.075, 0.18], [0, 2.33, 3.23], antiqueGold, 0.02)
  addRoundedBox(root, [6.58, 0.038, 0.08], [0, 2.39, 3.34], warmNeon, 0.012)
  addRoundedBox(root, [6.74, 0.085, 0.3], [0, 1.96, 3.18], deepBronze, 0.022)
  addRoundedBox(root, [6.26, 0.025, 0.08], [0, 2.01, 3.36], royalGold, 0.007)
  for (const side of [-1, 1]) {
    addExtrudedPanel(
      root,
      [
        [-0.44, 0.28],
        [0.28, 0.28],
        [0.44, 0],
        [0.22, -0.42],
        [-0.35, -0.42],
        [-0.52, -0.05],
      ],
      0.28,
      side < 0 ? cyanNeon : violetNeon,
      [side * 3.35, 2.23, 3.35],
    ).rotation.y = side < 0 ? 0 : Math.PI
  }
  addRoundedBox(root, [0.5, 1.16, 6.55], [-3.72, 2.54, -0.02], obsidian, 0.1)
  addRoundedBox(root, [0.5, 1.16, 6.55], [3.72, 2.54, -0.02], obsidian, 0.1)
  addRoundedBox(root, [0.09, 0.09, 5.9], [-3.4, 2.93, 0.12], cyanNeon, 0.024)
  addRoundedBox(root, [0.09, 0.09, 5.9], [3.4, 2.93, 0.12], electricCyan, 0.024)
  for (const side of [-1, 1]) {
    for (let segment = 0; segment < 3; segment += 1) {
      const segmentZ = -2.03 + segment * 2.06
      const sideCassette = addRoundedBox(
        root,
        [0.32, 0.42, 1.66],
        [side * 3.48, 2.6, segmentZ],
        obsidianInset,
        0.055,
      )
      sideCassette.rotation.z = side * (segment % 2 ? 0.045 : -0.045)
      addRoundedBox(
        root,
        [0.035, 0.22, 1.26],
        [side * 3.29, 2.67, segmentZ],
        side < 0
          ? segment === 1 ? violetNeon : cyanNeon
          : segment === 1 ? magentaNeon : violetNeon,
        0.008,
      )
      addRoundedBox(
        root,
        [0.055, 0.055, 1.48],
        [side * 3.37, 2.89, segmentZ],
        antiqueGold,
        0.012,
      )
    }
  }
  addRoundedBox(root, [7.74, 0.82, 1.04], [0, -1.5, 3.12], obsidian, 0.16)
  addRoundedBox(root, [7.26, 0.13, 1.1], [0, -1.16, 3.15], royalGold, 0.04)
  addRoundedBox(root, [7.38, 0.18, 0.64], [0, -1.86, 3.1], obsidianInset, 0.06)
  addRoundedBox(root, [6.94, 0.038, 0.7], [0, -1.76, 3.23], antiqueGold, 0.011)
  addRoundedBox(root, [5.72, 0.022, 0.12], [0, -1.71, 3.6], warmNeon, 0.006)
  addRoundedBox(root, [0.58, 3.75, 1.72], [-3.78, 0.22, 3.44], obsidian, 0.11)
  addRoundedBox(root, [0.58, 3.75, 1.72], [3.78, 0.22, 3.44], obsidian, 0.11)
  addRoundedBox(root, [0.075, 2.7, 0.075], [-3.47, 0.18, 2.62], cyanNeon, 0.02)
  addRoundedBox(root, [0.075, 2.7, 0.075], [3.47, 0.18, 2.62], magentaNeon, 0.02)
  for (const side of [-1, 1]) {
    const scoreShoulder = addExtrudedPanel(
      root,
      [
        [-0.36, 0.68],
        [0.24, 0.5],
        [0.34, -0.5],
        [0.08, -0.74],
        [-0.4, -0.55],
      ],
      0.22,
      deepBronze,
      [side * 3.54, 0.04, 3.7],
    )
    scoreShoulder.rotation.y = side < 0 ? 0 : Math.PI
    addRoundedBox(
      root,
      [0.035, 0.92, 0.055],
      [side * 3.32, 0.08, 3.83],
      side < 0 ? cyanNeon : violetNeon,
      0.008,
    )
  }

  context.galacticPusherThemeRoot.name = 'galactic-pusher-skin'
  context.galacticPusherThemeRoot.visible = false
  context.pusherGroup.add(context.galacticPusherThemeRoot)
  addRoundedBox(
    context.galacticPusherThemeRoot,
    [6.3, 0.22, 0.16],
    [0, 2.56, PUSHER_FACE_LOCAL_Z + 0.12],
    obsidian,
    0.045,
  )
  addRoundedBox(
    context.galacticPusherThemeRoot,
    [5.92, 0.052, 0.06],
    [0, 2.63, PUSHER_FACE_LOCAL_Z + 0.215],
    electricCyan,
    0.016,
  )
  addRoundedBox(
    context.galacticPusherThemeRoot,
    [6.42, 0.075, 0.12],
    [0, 2.91, PUSHER_FACE_LOCAL_Z + 0.08],
    antiqueGold,
    0.022,
  )
  addRoundedBox(
    context.galacticPusherThemeRoot,
    [5.46, 0.035, 0.06],
    [0, 2.955, PUSHER_FACE_LOCAL_Z + 0.155],
    warmNeon,
    0.01,
  )
  for (const side of [-1, 1]) {
    const pusherFacet = addRoundedBox(
      context.galacticPusherThemeRoot,
      [0.54, 0.28, 0.23],
      [side * 3.06, 2.6, PUSHER_FACE_LOCAL_Z + 0.17],
      royalGold,
      0.045,
    )
    pusherFacet.rotation.z = side * 0.16
  }
}

