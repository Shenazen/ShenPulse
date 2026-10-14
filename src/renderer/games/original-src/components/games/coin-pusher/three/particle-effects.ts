import * as THREE from 'three'
import type { CoinPusher3dParticle } from './types'
import { MAX_PARTICLES } from './constants'
import { setLogicalPoint } from './positions'
import { ColorCache } from './color-cache'

/** Tampons de particules persistants : positions et couleurs mises à jour sans reconstruire le graphe GPU. */
export class ParticleEffects {
  private readonly particleColors = new Float32Array(MAX_PARTICLES * 3)
  private readonly particlePositions = new Float32Array(MAX_PARTICLES * 3)
  private readonly particleGeometry = new THREE.BufferGeometry()
  private readonly particleMaterial: THREE.PointsMaterial
  private readonly particlePoints: THREE.Points
  private readonly targetPosition = new THREE.Vector3()
  constructor(private readonly options: { root: THREE.Group; pointTexture: THREE.CanvasTexture; colors: ColorCache }) {
    this.particleGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particlePositions, 3).setUsage(THREE.DynamicDrawUsage),
    )
    this.particleGeometry.setAttribute(
      'color',
      new THREE.BufferAttribute(this.particleColors, 3).setUsage(THREE.DynamicDrawUsage),
    )
    this.particleGeometry.setDrawRange(0, 0)
    this.particleMaterial = new THREE.PointsMaterial({
      alphaTest: 0.006,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      map: options.pointTexture,
      opacity: 0.55,
      size: 0.085,
      sizeAttenuation: true,
      transparent: true,
      vertexColors: true,
    })
    this.particlePoints = new THREE.Points(this.particleGeometry, this.particleMaterial)
    this.particlePoints.frustumCulled = false
    this.particlePoints.renderOrder = 15
    options.root.add(this.particlePoints)
  }
  /** Synchronise le sous-ensemble vivant dans les tampons préalloués. */
  sync(particles: readonly CoinPusher3dParticle[]) {
    const count = Math.min(MAX_PARTICLES, particles.length)
    const start = Math.max(0, particles.length - count)
    for (let index = 0; index < count; index += 1) {
      const particle = particles[start + index]
      setLogicalPoint(this.targetPosition, particle.x, particle.y)
      const offset = index * 3
      this.particlePositions[offset] = this.targetPosition.x
      this.particlePositions[offset + 1] = this.targetPosition.y
      this.particlePositions[offset + 2] = this.targetPosition.z + 0.16
      const color = this.options.colors.get(particle.color)
      const life = THREE.MathUtils.clamp(particle.life / Math.max(0.001, particle.maxLife), 0, 1)
      const intensity = 0.1 + life * 0.65
      this.particleColors[offset] = color.r * intensity
      this.particleColors[offset + 1] = color.g * intensity
      this.particleColors[offset + 2] = color.b * intensity
    }
    this.particleGeometry.setDrawRange(0, count)
    const positionAttribute = this.particleGeometry.getAttribute('position') as THREE.BufferAttribute
    const colorAttribute = this.particleGeometry.getAttribute('color') as THREE.BufferAttribute
    positionAttribute.needsUpdate = true
    colorAttribute.needsUpdate = true
  }
}

