/** Dimensions et budgets communs, conservés à l’identique lors du découpage. */
import * as THREE from 'three'
import { COIN_PUSHER_PUSHER_FACE_OFFSET, COIN_PUSHER_SHELF_EDGE as SHELF_EDGE, COIN_PUSHER_SHELF_TOP as SHELF_TOP, COIN_PUSHER_PUSHER_TRAVEL, COIN_PUSHER_PUSHER_BASE_Y as PUSHER_BASE_Y, COIN_PUSHER_COIN_RADIUS_MAX } from '../../coinPusherPhysics'
import { COIN_PUSHER_MAX_COIN_SCALE } from '../../coinPusherSettings'
import { logicalShelfZ } from './shelf-coordinates'
import type { CoinPusher3dPeg } from './types'

export const LOGICAL_WIDTH = 540

export const PLINKO_LEFT = 48

export const PLINKO_RIGHT = 492

export const PLINKO_TOP = 142

export const PLINKO_BOTTOM = 382

export const SCORE_BOTTOM = 916

export const BODY_INITIAL_CAPACITY = 1024

export const AVATAR_ATLAS_COLUMNS = 32

export const AVATAR_ATLAS_ROWS = 32

export const AVATAR_ATLAS_VIEWERS_PER_PAGE = AVATAR_ATLAS_COLUMNS * AVATAR_ATLAS_ROWS

export const AVATAR_ATLAS_TILE_SIZE = 64

export const AVATAR_ATLAS_TEXTURE_SIZE = AVATAR_ATLAS_COLUMNS * AVATAR_ATLAS_TILE_SIZE

export const AVATAR_ATLAS_TILE_PADDING = 2

export const AVATAR_PAGE_INITIAL_COIN_CAPACITY = 1024

export const AVATAR_ATLAS_ENTRY_IDLE_FRAMES = 180

export const AVATAR_ATLAS_UPLOAD_INTERVAL_FRAMES = 12

export const AVATAR_ATLAS_MAX_CONCURRENT_LOADS = 8

export const AVATAR_ATLAS_MAX_LOAD_ATTEMPTS = 3

export const AVATAR_ATLAS_RETRY_BACKOFF_FRAMES = 90

export const MAX_FLOATING_SCORE_SPRITES = 64

export const MAX_FLOATING_SCORE_TEXTURES = 64

export const MAX_PARTICLES = 800

export const ADAPTIVE_QUALITY_MIN = 0.68

export const ADAPTIVE_QUALITY_DOWN_COOLDOWN = 1.35

export const ADAPTIVE_QUALITY_UP_COOLDOWN = 2.4

export const ADAPTIVE_QUALITY_OVERLOAD_SECONDS = 1.05

export const ADAPTIVE_QUALITY_RECOVERY_SECONDS = 4.8

export const COIN_THICKNESS = 0.34

// Plinko objects used to be placed almost coplanar with the palace artwork.
// A rotating coin could consequently cross the opaque panel and appear as a
// crescent. These conservative object-space bounds keep the complete mesh in
// front of the playfield while leaving the cabinet rails and pins free to
// occlude it normally.
export const COIN_OBJECT_BOUND_RADIUS = Math.hypot(1, COIN_THICKNESS / 2)

export const MYSTERY_OBJECT_BOUND_RADIUS = Math.hypot(0.62, 0.62, 0.62)

export const TICKET_OBJECT_BOUND_RADIUS = Math.hypot(0.86, 0.43, 0.05)

export const MYSTERY_VISUAL_SCALE = 1.02

export const TICKET_VISUAL_SCALE = 1.08

export const PLINKO_OBJECT_SURFACE_GAP = 0.018

export const DECK_OBJECT_SURFACE_GAP = 0.006

export const MAIN_DECK_SURFACE_Y = 2.335

export const MOVING_DECK_SURFACE_Y = 2.994

export const CLASSIC_PLINKO_SURFACE_Z = -3.382

export const CLASSIC_PLINKO_BASE_COIN_Z = -3.12

export const GALACTIC_PLINKO_TOP_Y = 8.9

export const GALACTIC_PLINKO_BOTTOM_Y = 3.2

export const GALACTIC_PLINKO_BOTTOM_Z = -2.74

export const GALACTIC_PLINKO_SHOULDER_Y = 8.22

export const GALACTIC_PLINKO_TOP_HALF_WIDTH = 2.31

export const GALACTIC_PLINKO_FULL_HALF_WIDTH = 3.56

export const GALACTIC_PLINKO_PLAYFIELD_HALF_WIDTH = (PLINKO_RIGHT - PLINKO_LEFT) / (2 * 66)

export const GALACTIC_PLINKO_VEIL_OFFSET_Z = 0.018

// The palace artwork is a camera-facing aperture, not a ramp. Keeping its two
// axes orthogonal to the fixed palace view makes portraits and lettering stay
// upright while the surrounding cabinet remains fully three-dimensional.
export const GALACTIC_PLINKO_PLANE_NORMAL = new THREE.Vector3(0.1, 9.9, 17.24).normalize()

export const GALACTIC_PLINKO_PLANE_RIGHT = new THREE.Vector3()
  .crossVectors(new THREE.Vector3(0, 1, 0), GALACTIC_PLINKO_PLANE_NORMAL)
  .normalize()

export const GALACTIC_PLINKO_PLANE_UP = new THREE.Vector3()
  .crossVectors(GALACTIC_PLINKO_PLANE_NORMAL, GALACTIC_PLINKO_PLANE_RIGHT)
  .normalize()

export const GALACTIC_PLINKO_CENTER_Y = (GALACTIC_PLINKO_TOP_Y + GALACTIC_PLINKO_BOTTOM_Y) / 2

export const GALACTIC_PLINKO_HALF_HEIGHT = (
  (GALACTIC_PLINKO_TOP_Y - GALACTIC_PLINKO_BOTTOM_Y)
  / (2 * GALACTIC_PLINKO_PLANE_UP.y)
)

export const GALACTIC_PLINKO_PLANE_CENTER = new THREE.Vector3(
  0,
  GALACTIC_PLINKO_CENTER_Y,
  GALACTIC_PLINKO_BOTTOM_Z
    + GALACTIC_PLINKO_PLANE_UP.z * GALACTIC_PLINKO_HALF_HEIGHT,
)

export const GALACTIC_PLINKO_PLANE_QUATERNION = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  GALACTIC_PLINKO_PLANE_NORMAL,
)

export const GOLD = 0xf7c85d

export const CYAN = 0x43e8ff

export const VIOLET = 0xa855f7

export const MAGENTA = 0xff3ba7

export const GALACTIC_BLUE = 0x199cff

export const GALACTIC_PURPLE = 0x9d4dff

export const GALACTIC_GOLD = 0xffc85a

export const GALACTIC_COIN_RIM_COLORS = [
  new THREE.Color(0x28dfff),
  new THREE.Color(0xb85cff),
  new THREE.Color(0xff4fb4),
  new THREE.Color(0xffc64f),
  new THREE.Color(0x6e7bff),
]

export const PUSHER_FACE_LOCAL_Z = COIN_PUSHER_PUSHER_FACE_OFFSET * 5.82 / (SHELF_EDGE - SHELF_TOP)

export const PUSHER_TRAVEL_LOCAL_Z = COIN_PUSHER_PUSHER_TRAVEL * 5.82 / (SHELF_EDGE - SHELF_TOP)

export const PUSHER_REAR_LOCAL_Z = -0.54 - PUSHER_TRAVEL_LOCAL_Z - 0.16

export const PUSHER_DECK_REAR_LOCAL_Z = PUSHER_REAR_LOCAL_Z + 0.04

// The standard pusher body is deep enough for its normal travel. The special
// full sweep goes much farther, so a telescopic cover must bridge the newly
// exposed well instead of revealing the empty cabinet behind the moving deck.
export const PUSHER_GAP_REAR_ANCHOR_Z = (
  logicalShelfZ(PUSHER_BASE_Y + COIN_PUSHER_PUSHER_TRAVEL)
  + PUSHER_DECK_REAR_LOCAL_Z
)

export const PUSHER_GAP_FRONT_OVERLAP = 0.08

export const MAX_RENDERED_OBJECT_SCALE = (
  COIN_PUSHER_COIN_RADIUS_MAX * COIN_PUSHER_MAX_COIN_SCALE / 66
)

export const MAX_RENDERED_OBJECT_BOUND_RADIUS = Math.max(
  COIN_OBJECT_BOUND_RADIUS,
  MYSTERY_OBJECT_BOUND_RADIUS * MYSTERY_VISUAL_SCALE,
  TICKET_OBJECT_BOUND_RADIUS * TICKET_VISUAL_SCALE,
)

// The palace rear sill must stay behind the complete landing envelope. It is a
// real opaque piece of cabinet geometry, so depth testing remains enabled: the
// clearance comes from placing the metal where a physical back wall belongs.
export const GALACTIC_REAR_SILL_FRONT_Z = (
  logicalShelfZ(PUSHER_BASE_Y)
  - MAX_RENDERED_OBJECT_SCALE * MAX_RENDERED_OBJECT_BOUND_RADIUS
  - 0.045
)

export const GALACTIC_REAR_SILL_DEPTH = 0.18

export const GALACTIC_REAR_SILL_CENTER_Z = (
  GALACTIC_REAR_SILL_FRONT_Z - GALACTIC_REAR_SILL_DEPTH / 2
)

export const GALACTIC_REAR_SILL_HEIGHT = 0.18

export const GALACTIC_REAR_SILL_CENTER_Y = 3.11

export const GALACTIC_REAR_SILL_TRIM_DEPTH = 0.06

export const GALACTIC_REAR_SILL_TRIM_CENTER_Z = (
  GALACTIC_REAR_SILL_FRONT_Z - GALACTIC_REAR_SILL_TRIM_DEPTH / 2
)

// Keep the casino hall inside the portrait camera while leaving it physically
// behind every gameplay surface. Explicit anchors prevent future art passes
// from drifting the columns back outside the visible frame.
export const GALACTIC_BACKDROP_COLUMN_X = 4.6

export const GALACTIC_BACKDROP_COLUMN_Y = 4.35

export const GALACTIC_BACKDROP_COLUMN_Z = -6.34

export const GALACTIC_BACKDROP_PULSE_SPEED = 0.46

export const GALACTIC_BACKDROP_PULSE_RANGE = 0.085

export const GALACTIC_SCORE_LABEL_Y = 0.08

export const GALACTIC_SCORE_LABEL_Z = 3.91

export const GALACTIC_SCORE_LABEL_HEIGHT = 0.46

export const SPECIAL_ITEM_INITIAL_CAPACITY = 64

export const DEFAULT_COIN_PUSHER_PEGS: readonly CoinPusher3dPeg[] = createDefaultCoinPusherPegs()

export function createDefaultCoinPusherPegs(): CoinPusher3dPeg[] {
  const pegs: CoinPusher3dPeg[] = []
  for (let row = 0; row < 8; row += 1) {
    const count = row % 2 === 0 ? 8 : 7
    const spacing = 52
    const totalWidth = (count - 1) * spacing
    const startX = LOGICAL_WIDTH / 2 - totalWidth / 2
    for (let index = 0; index < count; index += 1) {
      pegs.push({
        index,
        row,
        x: startX + index * spacing,
        y: 170 + row * 29,
      })
    }
  }
  return pegs
}

