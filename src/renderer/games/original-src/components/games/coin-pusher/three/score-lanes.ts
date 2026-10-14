import * as THREE from 'three'
import { PLINKO_LEFT, PLINKO_RIGHT, GALACTIC_SCORE_LABEL_HEIGHT, GALACTIC_SCORE_LABEL_Y, GALACTIC_SCORE_LABEL_Z } from './constants'
import { disposeChildren } from './resources'
import { addRoundedBox, addBeamBetween3d, addExtrudedPanel, addTrapezoidFloor } from './geometry'
import { galacticScoreColor, scoreColor, createGalacticScoreSlotTexture, createScoreSlotTexture } from './score-textures'

/** Couloirs de score arcade/galactiques et impulsions lumineuses ; reconstruit seulement si les valeurs changent. */
export class ScoreLanes {
  readonly scoreGroup = new THREE.Group()
  private readonly scoreImpulses: number[] = []
  private readonly scoreMaterials: THREE.MeshStandardMaterial[] = []
  private scoreMultiplier = 1
  private scoreSlotValues: number[] = []
  private machineTheme: 'arcade' | 'galactic-palace' = 'arcade'
  constructor(private readonly goldMaterial: THREE.MeshPhysicalMaterial) {}
  /** Valide le multiplicateur et synchronise la géométrie des couloirs pour ce thème. */
  sync(slots: readonly number[], multiplier: number | undefined, theme: 'arcade' | 'galactic-palace') {
    this.machineTheme = theme
    this.scoreMultiplier = Number.isFinite(Number(multiplier)) ? THREE.MathUtils.clamp(Number(multiplier), 0, 100) : 1
    this.ensureScoreSlots(slots)
  }
  /** Invalide les libellés lors du changement de thème. */
  invalidate() { this.scoreSlotValues = [] }
  /** Anime les impulsions avec le même amortissement, sans reconstruire les couloirs. */
  update(delta: number) { this.updateScoreFlashes(delta) }
  /** Déclenche le flash du couloir correspondant à la coordonnée logique. */
  burst(logicalX: number, points: number) { this.scoreBurst(logicalX, points) }
  private scoreBurst(logicalX: number, points: number) {
    const normalizedX = THREE.MathUtils.clamp(
      (logicalX - PLINKO_LEFT) / (PLINKO_RIGHT - PLINKO_LEFT),
      0,
      0.9999,
    )
    const index = Math.min(
      Math.max(0, this.scoreMaterials.length - 1),
      Math.floor(normalizedX * Math.max(1, this.scoreMaterials.length)),
    )
    if (this.scoreMaterials[index]) {
      this.scoreImpulses[index] = Math.max(
        this.scoreImpulses[index] || 0,
        points >= 20 ? 1.35 : 1,
      )
    }
  }
  private ensureScoreSlots(values: readonly number[]) {
    const slotCount = values.length || 1
    const multiplier = this.scoreMultiplier
    let changed = this.scoreSlotValues.length !== slotCount
    if (!changed) {
      for (let index = 0; index < slotCount; index += 1) {
        const normalized = Math.round(
          (Number(values.length ? values[index] : 0) || 0) * multiplier,
        )
        if (this.scoreSlotValues[index] !== normalized) {
          changed = true
          break
        }
      }
    }
    if (!changed) return

    const slots = new Array<number>(slotCount)
    for (let index = 0; index < slotCount; index += 1) {
      slots[index] = Math.round(
        (Number(values.length ? values[index] : 0) || 0) * multiplier,
      )
    }
    this.scoreSlotValues = slots
    disposeChildren(this.scoreGroup)
    this.scoreMaterials.splice(0)
    this.scoreImpulses.length = slotCount
    this.scoreImpulses.fill(0)

    const isGalactic = this.machineTheme === 'galactic-palace'
    const width = 6.78 / slots.length
    const startX = -3.39 + width / 2
    const dividerMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.62,
      clearcoatRoughness: 0.26,
      color: isGalactic ? 0x090817 : 0x182234,
      emissive: isGalactic ? 0x09031b : 0x01040a,
      emissiveIntensity: isGalactic ? 0.17 : 0.06,
      metalness: 0.92,
      roughness: isGalactic ? 0.24 : 0.32,
    })
    const frontPlateMaterial = new THREE.MeshPhysicalMaterial({
      clearcoat: 0.72,
      clearcoatRoughness: 0.22,
      color: isGalactic ? 0x03040b : 0x080d16,
      emissive: isGalactic ? 0x070215 : 0x01030a,
      emissiveIntensity: isGalactic ? 0.18 : 0.08,
      metalness: isGalactic ? 0.92 : 0.78,
      roughness: isGalactic ? 0.22 : 0.3,
    })
    // Score lanes are rebuilt when settings change. Keep their gold trim
    // independent so disposing the old lanes never destroys the chassis'
    // shared gold material.
    const scoreGoldMaterial = this.goldMaterial.clone()
    if (isGalactic) {
      scoreGoldMaterial.color.setHex(0xe4b55a)
      scoreGoldMaterial.emissive.setHex(0x291300)
      scoreGoldMaterial.emissiveIntensity = 0.025
      scoreGoldMaterial.roughness = 0.2
    }

    slots.forEach((rawValue, index) => {
      const value = Math.round(Number(rawValue) || 0)
      const color = isGalactic
        ? galacticScoreColor(value, index)
        : scoreColor(value, index)
      const basinColor = color.clone().lerp(
        new THREE.Color(isGalactic ? 0x03040b : 0x090e18),
        isGalactic ? 0.86 : 0.78,
      )
      const basinMaterial = new THREE.MeshPhysicalMaterial({
        clearcoat: isGalactic ? 0.82 : 0.5,
        clearcoatRoughness: isGalactic ? 0.2 : 0.34,
        color: basinColor,
        emissive: color,
        emissiveIntensity: isGalactic ? 0.13 : 0.08,
        envMapIntensity: isGalactic ? 0.88 : 0.5,
        metalness: isGalactic ? 0.86 : 0.72,
        roughness: isGalactic ? 0.26 : 0.42,
      })
      const accentMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: isGalactic
          ? value >= 20 ? 0.42 : 0.32
          : value >= 20 ? 0.42 : 0.32,
        metalness: isGalactic ? 0.62 : 0.46,
        roughness: isGalactic ? 0.2 : 0.3,
      })
      accentMaterial.userData.baseEmissiveIntensity = accentMaterial.emissiveIntensity
      this.scoreMaterials.push(accentMaterial)
      if (isGalactic) {
        const laneX = startX + index * width
        const rearWidth = Math.max(0.08, width - 0.31)
        const frontWidth = Math.max(0.12, width - 0.11)
        // A tall recessed chute sits behind the falling coin. Its broad lower
        // mouth and deep black surround reproduce the jewel lanes in the
        // reference while remaining outside the collision model.
        addExtrudedPanel(
          this.scoreGroup,
          [
            [-rearWidth / 2, 1.18],
            [rearWidth / 2, 1.18],
            [frontWidth / 2, -1.34],
            [-frontWidth / 2, -1.34],
          ],
          0.12,
          basinMaterial,
          [laneX, 0, 2.7],
        )
        addExtrudedPanel(
          this.scoreGroup,
          [
            [-rearWidth * 0.35, 1.04],
            [rearWidth * 0.35, 1.04],
            [frontWidth * 0.34, -1.12],
            [-frontWidth * 0.34, -1.12],
          ],
          0.035,
          accentMaterial,
          [laneX, 0, 2.84],
        )
        addTrapezoidFloor(
          this.scoreGroup,
          laneX,
          rearWidth,
          frontWidth,
          -1.6,
          2.75,
          3.72,
          accentMaterial,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.08, rearWidth), 0.18, 0.22],
          [laneX, 1.23, 2.86],
          frontPlateMaterial,
          0.035,
        )
        addBeamBetween3d(
          this.scoreGroup,
          [laneX - rearWidth / 2, 1.17, 2.93],
          [laneX - frontWidth / 2, -1.34, 3.02],
          0.052,
          0.075,
          scoreGoldMaterial,
          0.015,
        )
        addBeamBetween3d(
          this.scoreGroup,
          [laneX + rearWidth / 2, 1.17, 2.93],
          [laneX + frontWidth / 2, -1.34, 3.02],
          0.052,
          0.075,
          scoreGoldMaterial,
          0.015,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.16, width - 0.075), 0.54, 0.24],
          [laneX, 0.04, 3.69],
          frontPlateMaterial,
          0.045,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.1, width - 0.2), 0.035, 0.035],
          [laneX, 0.305, 3.835],
          accentMaterial,
          0.008,
        )
      } else {
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.16, width - 0.055), 0.13, 1.34],
          [startX + index * width, -0.96, 3.5],
          basinMaterial,
          0.045,
          true,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.12, width - 0.15), 0.032, 1.04],
          [startX + index * width, -0.875, 3.48],
          accentMaterial,
          0.012,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.16, width - 0.055), 0.5, 0.16],
          [startX + index * width, -0.64, 4.16],
          frontPlateMaterial,
          0.035,
          true,
        )
        addRoundedBox(
          this.scoreGroup,
          [Math.max(0.1, width - 0.15), 0.035, 0.045],
          [startX + index * width, -0.375, 4.25],
          accentMaterial,
          0.012,
        )
      }

      const scoreText = `${value > 0 ? '+' : ''}${value}`
      const scoreHex = `#${color.getHexString()}`
      const texture = isGalactic
        ? createGalacticScoreSlotTexture(scoreText, scoreHex)
        : createScoreSlotTexture(scoreText, scoreHex)
      const labelMaterial = new THREE.MeshBasicMaterial({
        alphaTest: 0.006,
        depthTest: !isGalactic,
        depthWrite: !isGalactic,
        map: texture,
        toneMapped: false,
        transparent: true,
      })
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(
          Math.max(0.3, width * (isGalactic ? 0.86 : 0.92)),
          isGalactic ? GALACTIC_SCORE_LABEL_HEIGHT : 0.43,
        ),
        labelMaterial,
      )
      label.position.set(
        startX + index * width,
        isGalactic ? GALACTIC_SCORE_LABEL_Y : -0.64,
        isGalactic ? GALACTIC_SCORE_LABEL_Z : 4.252,
      )
      label.renderOrder = 20
      label.frustumCulled = !isGalactic
      this.scoreGroup.add(label)

      if (isGalactic && width >= 0.44) {
        const laneGem = new THREE.Mesh(
          new THREE.OctahedronGeometry(Math.min(0.105, width * 0.12), 0),
          accentMaterial,
        )
        laneGem.position.set(startX + index * width, -1.53, 3.81)
        laneGem.rotation.z = Math.PI / 4
        laneGem.scale.z = 0.42
        laneGem.renderOrder = 21
        this.scoreGroup.add(laneGem)
      }
    })

    for (let index = 0; index <= slots.length; index += 1) {
      const dividerX = -3.39 + index * width
      if (isGalactic) {
        addRoundedBox(
          this.scoreGroup,
          [0.095, 2.78, 0.34],
          [dividerX, -0.08, 2.88],
          dividerMaterial,
          0.026,
        )
        addRoundedBox(
          this.scoreGroup,
          [0.032, 2.62, 0.045],
          [dividerX, -0.08, 3.075],
          scoreGoldMaterial,
          0.009,
        )
      } else {
        addRoundedBox(
          this.scoreGroup,
          [0.055, 1.3, 1.4],
          [dividerX, -0.33, 3.5],
          dividerMaterial,
          0.018,
          true,
        )
        addRoundedBox(
          this.scoreGroup,
          [0.08, 0.06, 1.44],
          [dividerX, 0.35, 3.5],
          scoreGoldMaterial,
          0.02,
        )
      }
    }
  }
  private updateScoreFlashes(delta: number) {
    for (let index = 0; index < this.scoreMaterials.length; index += 1) {
      const material = this.scoreMaterials[index]
      const impulse = Math.max(0, (this.scoreImpulses[index] || 0) - delta * 2.4)
      this.scoreImpulses[index] = impulse
      const base = Number(material.userData.baseEmissiveIntensity)
        || (material.color.getHex() === 0xe7b84b ? 0.42 : 0.32)
      material.emissiveIntensity = base
        + impulse * (this.machineTheme === 'galactic-palace' ? 0.34 : 0.72)
    }
  }
}

