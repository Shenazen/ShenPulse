import * as THREE from 'three'
import type { GalacticDecorContext } from './galactic-context'
import type { GalacticPalette } from './galactic-palette'

/** Assemble les accents lumineux instanciés et enregistre leurs paramètres d'animation. */
export function buildGalacticAccents(context: GalacticDecorContext, palette: GalacticPalette) {
  const { root } = palette
  // Low-poly jewel lamps add life throughout the cabinet for only four
  // instanced draw calls. Each colour breathes at its own slow cadence; the
  // whole installation remains under the theme root and therefore disappears
  // completely when the classic machine is selected.
  const ambientAccentGeometry = new THREE.OctahedronGeometry(0.064, 0)
  const ambientAccentLayouts: Array<{
    color: number
    positions: readonly [number, number, number][]
  }> = [
    {
      color: 0x43dcff,
      positions: [
        [-3.04, 10.5, -2.97],
        [-3.43, 8.48, -2.78],
        [-3.49, 6.83, -2.43],
        [-3.54, 5.12, -2.06],
        [-3.63, 2.42, 2.78],
        [-2.54, -1.18, 3.65],
      ],
    },
    {
      color: 0x8e61ff,
      positions: [
        [3.04, 10.5, -2.97],
        [3.43, 8.48, -2.78],
        [3.49, 6.83, -2.43],
        [3.54, 5.12, -2.06],
        [3.63, 2.42, 2.78],
        [2.54, -1.18, 3.65],
      ],
    },
    {
      color: 0xf04bc8,
      positions: [
        [-2.3, 10.54, -3.05],
        [2.3, 10.54, -3.05],
        [-3.65, 3.55, -1.72],
        [3.65, 3.55, -1.72],
        [-1.34, -1.2, 3.72],
        [1.34, -1.2, 3.72],
      ],
    },
    {
      color: 0xffcb62,
      positions: [
        [-1.5, 10.57, -3.08],
        [1.5, 10.57, -3.08],
        [-3.56, 4.3, -1.9],
        [3.56, 4.3, -1.9],
        [-0.42, -1.2, 3.74],
        [0.42, -1.2, 3.74],
      ],
    },
  ]
  for (let accentIndex = 0; accentIndex < ambientAccentLayouts.length; accentIndex += 1) {
    const layout = ambientAccentLayouts[accentIndex]
    const material = new THREE.MeshStandardMaterial({
      color: layout.color,
      emissive: layout.color,
      emissiveIntensity: 0.46,
      metalness: 0.16,
      roughness: 0.18,
    })
    const hsl = { h: 0, s: 0, l: 0 }
    material.color.getHSL(hsl)
    const accents = new THREE.InstancedMesh(
      ambientAccentGeometry,
      material,
      layout.positions.length,
    )
    accents.name = `galactic-ambient-jewels-${accentIndex + 1}`
    for (let index = 0; index < layout.positions.length; index += 1) {
      context.dummy.position.set(...layout.positions[index])
      context.dummy.quaternion.identity()
      context.dummy.rotation.z = Math.PI / 4 + index * 0.31
      const scale = 0.82 + (index % 3) * 0.12
      context.dummy.scale.set(scale, scale * 1.24, scale * 0.72)
      context.dummy.updateMatrix()
      accents.setMatrixAt(index, context.dummy.matrix)
    }
    accents.instanceMatrix.needsUpdate = true
    accents.computeBoundingSphere()
    root.add(accents)
    context.galacticAmbientAccents.push({
      baseHue: hsl.h,
      baseIntensity: 0.34 + accentIndex * 0.025,
      material,
      phase: accentIndex * 1.61,
      pulseRange: 0.22,
      speed: 0.56 + accentIndex * 0.07,
    })
  }
}

