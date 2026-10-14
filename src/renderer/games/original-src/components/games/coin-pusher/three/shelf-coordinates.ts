/** Calculs du plateau utilisables dès l’initialisation, sans dépendance aux constantes 3D. */
import * as THREE from 'three'
import {
  COIN_PUSHER_SHELF_EDGE as SHELF_EDGE,
  COIN_PUSHER_SHELF_TOP as SHELF_TOP,
} from '../../coinPusherPhysics'

export function logicalShelfProgress(logicalY: number) {
  return THREE.MathUtils.clamp((logicalY - SHELF_TOP) / (SHELF_EDGE - SHELF_TOP), 0, 1)
}

export function logicalShelfZ(logicalY: number) {
  return -2.82 + logicalShelfProgress(logicalY) * 5.82
}
