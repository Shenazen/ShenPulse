/** Primitives et UV partagés par les décors classique et galactique. */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { GALACTIC_PLINKO_TOP_HALF_WIDTH, GALACTIC_PLINKO_FULL_HALF_WIDTH, GALACTIC_PLINKO_TOP_Y, GALACTIC_PLINKO_SHOULDER_Y, GALACTIC_PLINKO_BOTTOM_Y, GALACTIC_PLINKO_CENTER_Y, GALACTIC_PLINKO_PLANE_UP, GALACTIC_PLINKO_PLANE_CENTER, GALACTIC_PLINKO_PLANE_RIGHT, GALACTIC_PLINKO_HALF_HEIGHT } from './constants'

export function neonMaterial(color: number, intensity: number) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.24,
    roughness: 0.2,
  })
}

export function createBrilliantDiamondGeometry() {
  const segments = 8
  const positions: number[] = []
  const tableRadius = 0.22
  const tableY = 0.46
  const girdleRadius = 0.54
  const upperGirdleY = 0.08
  const lowerGirdleY = -0.045
  const pavilionY = -0.58

  const point = (radius: number, y: number, index: number): [number, number, number] => {
    const angle = Math.PI / 8 + index / segments * Math.PI * 2
    return [Math.cos(angle) * radius, y, Math.sin(angle) * radius]
  }
  const triangle = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ) => {
    positions.push(...a, ...b, ...c)
  }

  const tableCenter: [number, number, number] = [0, tableY, 0]
  const pavilionTip: [number, number, number] = [0, pavilionY, 0]
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments
    const table = point(tableRadius, tableY, index)
    const tableNext = point(tableRadius, tableY, next)
    const upper = point(girdleRadius, upperGirdleY, index)
    const upperNext = point(girdleRadius, upperGirdleY, next)
    const lower = point(girdleRadius, lowerGirdleY, index)
    const lowerNext = point(girdleRadius, lowerGirdleY, next)

    triangle(tableCenter, tableNext, table)
    triangle(table, tableNext, upperNext)
    triangle(table, upperNext, upper)
    triangle(upper, upperNext, lowerNext)
    triangle(upper, lowerNext, lower)
    triangle(lower, lowerNext, pavilionTip)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function addExtrudedPanel(
  parent: THREE.Object3D,
  points: readonly [number, number][],
  depth: number,
  material: THREE.Material,
  position: [number, number, number],
  shadows = false,
) {
  const shape = new THREE.Shape()
  const first = points[0] || [0, 0]
  shape.moveTo(first[0], first[1])
  for (let index = 1; index < points.length; index += 1) {
    shape.lineTo(points[index][0], points[index][1])
  }
  shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: Math.min(0.035, depth * 0.22),
    bevelThickness: Math.min(0.025, depth * 0.18),
    curveSegments: 2,
    depth,
    steps: 1,
  })
  geometry.translate(0, 0, -depth / 2)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.castShadow = shadows
  mesh.receiveShadow = shadows
  parent.add(mesh)
  return mesh
}

export function addTrapezoidFloor(
  parent: THREE.Object3D,
  centerX: number,
  rearWidth: number,
  frontWidth: number,
  y: number,
  rearZ: number,
  frontZ: number,
  material: THREE.Material,
) {
  const positions = new Float32Array([
    centerX - rearWidth / 2, y, rearZ,
    centerX + rearWidth / 2, y, rearZ,
    centerX + frontWidth / 2, y, frontZ,
    centerX - frontWidth / 2, y, frontZ,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex([0, 2, 1, 0, 3, 2])
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  parent.add(mesh)
  return mesh
}

export function createGalacticPlinkoPanelGeometry() {
  const geometry = new THREE.BufferGeometry()
  const topHalfWidth = GALACTIC_PLINKO_TOP_HALF_WIDTH
  const bottomHalfWidth = GALACTIC_PLINKO_FULL_HALF_WIDTH
  const outline: readonly [number, number][] = [
    [-topHalfWidth, GALACTIC_PLINKO_TOP_Y],
    [-bottomHalfWidth, GALACTIC_PLINKO_SHOULDER_Y],
    [-bottomHalfWidth, GALACTIC_PLINKO_BOTTOM_Y],
    [bottomHalfWidth, GALACTIC_PLINKO_BOTTOM_Y],
    [bottomHalfWidth, GALACTIC_PLINKO_SHOULDER_Y],
    [topHalfWidth, GALACTIC_PLINKO_TOP_Y],
  ]
  const positions: number[] = []
  const point = new THREE.Vector3()
  for (const [planeX, worldY] of outline) {
    const planeY = (worldY - GALACTIC_PLINKO_CENTER_Y) / GALACTIC_PLINKO_PLANE_UP.y
    point.copy(GALACTIC_PLINKO_PLANE_CENTER)
      .addScaledVector(GALACTIC_PLINKO_PLANE_RIGHT, planeX)
      .addScaledVector(GALACTIC_PLINKO_PLANE_UP, planeY)
    positions.push(point.x, point.y, point.z)
  }
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setIndex([
    0, 1, 4,
    0, 4, 5,
    1, 2, 3,
    1, 3, 4,
  ])
  setGalacticPlinkoPanelUvCrop(geometry, 1)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Maps the six-point aperture onto one camera-facing rectangle. The only
 * removed pixels are its two upper corners; object-cover cropping preserves
 * the source aspect ratio and every remaining image line stays straight.
 */
export function setGalacticPlinkoPanelUvCrop(
  geometry: THREE.BufferGeometry,
  sourceAspect: number,
) {
  const topHalfWidth = GALACTIC_PLINKO_TOP_HALF_WIDTH
  const bottomHalfWidth = GALACTIC_PLINKO_FULL_HALF_WIDTH
  const panelHeight = GALACTIC_PLINKO_HALF_HEIGHT * 2
  const destinationAspect = bottomHalfWidth * 2 / panelHeight
  const safeSourceAspect = THREE.MathUtils.clamp(
    Number.isFinite(sourceAspect) ? sourceAspect : 1,
    0.12,
    8,
  )
  let uMin = 0
  let uMax = 1
  let vMin = 0
  let vMax = 1
  if (safeSourceAspect > destinationAspect) {
    const visibleWidth = destinationAspect / safeSourceAspect
    uMin = (1 - visibleWidth) / 2
    uMax = 1 - uMin
  } else {
    const visibleHeight = safeSourceAspect / destinationAspect
    vMin = (1 - visibleHeight) / 2
    vMax = 1 - vMin
  }

  const topInset = (bottomHalfWidth - topHalfWidth) / (bottomHalfWidth * 2)
  const mapU = (value: number) => THREE.MathUtils.lerp(uMin, uMax, value)
  const mapV = (value: number) => THREE.MathUtils.lerp(vMin, vMax, value)
  const shoulderPlaneY = (
    (GALACTIC_PLINKO_SHOULDER_Y - GALACTIC_PLINKO_CENTER_Y)
    / GALACTIC_PLINKO_PLANE_UP.y
  )
  const shoulderV = (
    (shoulderPlaneY + GALACTIC_PLINKO_HALF_HEIGHT)
    / (GALACTIC_PLINKO_HALF_HEIGHT * 2)
  )
  const uv = geometry.getAttribute('uv')
  const values = [
    mapU(topInset), vMax,
    uMin, mapV(shoulderV),
    uMin, vMin,
    uMax, vMin,
    uMax, mapV(shoulderV),
    mapU(1 - topInset), vMax,
  ]
  if (uv instanceof THREE.BufferAttribute && uv.count === 6) {
    for (let index = 0; index < 6; index += 1) {
      uv.setXY(index, values[index * 2], values[index * 2 + 1])
    }
    uv.needsUpdate = true
    return
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(values, 2))
}

export function surfaceTextureAspect(texture: THREE.Texture) {
  const image = texture.image as {
    height?: number
    naturalHeight?: number
    naturalWidth?: number
    videoHeight?: number
    videoWidth?: number
    width?: number
  } | null
  const width = Number(image?.naturalWidth || image?.videoWidth || image?.width || 0)
  const height = Number(image?.naturalHeight || image?.videoHeight || image?.height || 0)
  return width > 0 && height > 0 ? width / height : 1
}

export function addBeamBetween3d(
  parent: THREE.Object3D,
  start: [number, number, number],
  end: [number, number, number],
  thickness: number,
  depth: number,
  material: THREE.Material,
  radius = 0.025,
) {
  const startPoint = new THREE.Vector3(...start)
  const endPoint = new THREE.Vector3(...end)
  const direction = endPoint.clone().sub(startPoint)
  const length = Math.max(0.001, direction.length())
  const midpoint = startPoint.add(endPoint).multiplyScalar(0.5)
  const beam = addRoundedBox(
    parent,
    [length, thickness, depth],
    [midpoint.x, midpoint.y, midpoint.z],
    material,
    radius,
  )
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    direction.normalize(),
  )
  return beam
}

export function addBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material)
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

export function addRoundedBox(
  parent: THREE.Object3D,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  radius = 0.08,
  shadows = false,
) {
  const safeRadius = Math.max(0.006, Math.min(radius, ...size.map((value) => value * 0.22)))
  const geometry = new RoundedBoxGeometry(size[0], size[1], size[2], 4, safeRadius)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...position)
  mesh.castShadow = shadows
  mesh.receiveShadow = shadows
  parent.add(mesh)
  return mesh
}

