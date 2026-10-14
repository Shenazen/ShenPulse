

export const COIN_PUSHER_WIDTH = 540

export const COIN_PUSHER_PLINKO_LEFT = 48

export const COIN_PUSHER_PLINKO_RIGHT = 492

export const COIN_PUSHER_PLINKO_TOP = 142

export const COIN_PUSHER_PLINKO_BOTTOM = 382

export const COIN_PUSHER_PLINKO_EXIT_Y = 392

export const COIN_PUSHER_COIN_RADIUS_MIN = 11.5

export const COIN_PUSHER_COIN_RADIUS_MAX = 12.5

export const COIN_PUSHER_PEG_COLLISION_RADIUS = 4.25

export const COIN_PUSHER_PEG_HORIZONTAL_SPACING = 52

export const COIN_PUSHER_PEG_VERTICAL_SPACING = 29

export const COIN_PUSHER_PEG_ROW_OFFSET = COIN_PUSHER_PEG_HORIZONTAL_SPACING / 2

export const COIN_PUSHER_SHELF_TOP = 388

export const COIN_PUSHER_SHELF_EDGE = 718

export const COIN_PUSHER_PUSHER_BASE_Y = 392

export const COIN_PUSHER_PUSHER_TRAVEL = 82

export const COIN_PUSHER_PUSHER_FACE_OFFSET = 34

export const COIN_PUSHER_SETTLING_DURATION_SECONDS = 0.34

export const COIN_PUSHER_MAX_STACK_LEVEL = 6

export const COIN_PUSHER_STACK_CAPTURE_RATIO = 0.64

export const COIN_PUSHER_STACK_SUPPORT_RATIO = 0.74

// A perfectly rigid centre-on-edge test is numerically unstable: the same coin
// can alternate between supported and unsupported while contacts are resolved.
// This small Schmitt band represents the lip/contact patch of a real tray. It
// is deliberately tiny compared with a coin radius, so the centre of mass must
// still be on (or immediately next to) the physical support.
export const COIN_PUSHER_UPPER_TRAY_BALANCE_RATIO = 0.1

export const COIN_PUSHER_UPPER_TRAY_BALANCE_MIN = 0.45

export const COIN_PUSHER_UPPER_TRAY_BALANCE_MAX = 1.2

// The 3D board is a little deeper than it is wide. Contacts on the shelf use
// the same metric so two physically tangent coins are also visually tangent.
export const COIN_PUSHER_SHELF_DEPTH_SCALE = (5.82 / (
  COIN_PUSHER_SHELF_EDGE - COIN_PUSHER_SHELF_TOP
)) / (1 / 66)

export const PLINKO_GRAVITY = 690

export const PLINKO_MAX_STEP_SECONDS = 1 / 120

export const PLINKO_MAX_SUBSTEPS = 6

export const PLINKO_RESTITUTION = 0.28

export const PLINKO_STALL_LIMIT_SECONDS = 0.7

export const PLINKO_HARD_EXIT_SECONDS = 7

export const PLINKO_MAX_HORIZONTAL_SPEED = 260

export const PLINKO_MAX_VERTICAL_SPEED = 620

export const SPATIAL_GRID_MIN_BODIES = 32

