import { VARIANTS, MAX_ACTIVE_PLAYERS } from './catalog.mjs'
import { clamp } from './utils.mjs'

export const DEFAULT_CONFIG = Object.freeze({
  orientation: 'landscape',
  assignmentMode: 'random',
  contentMode: 'extensions',
  includeBaseRoles: true,
  runMode: 'hybrid',
  rulesMode: 'official',
  packs: ['base', 'nouvelle-lune', 'personnages', '25-ans'],
  selectedVariantIds: [],
  buildingsEnabled: false,
  eventsEnabled: false,
  captainEnabled: true,
  allowSolitary: true,
  cameraEnabled: false,
  spectatorEnabled: true,
  spectatorMode: 'detective',
  debateSeconds: 180,
  voteSeconds: 60,
  revealSeconds: 20,
  allowRoleReview: false,
  revealEliminatedRoles: true,
  showPlayerAvatarOnCardBack: false,
  voteMode: 'secret',
  tieMode: 'captain-then-none',
  audioEnabled: true,
  ambienceVolume: 70,
  saveEnabled: true,
  giftName: 'Côte à côte',
  giftId: '',
  giftValue: 199,
  giftQuantity: 1,
  registrationOpen: true,
  registrationMinutes: 120,
  seats: 8,
  priorityMode: 'arrival',
  giftGuaranteesSeat: false,
  allowDuplicateEntries: false,
  keepQueueAfterGame: true,
})

export function normalizeConfig(config = {}) {
  const merged = { ...DEFAULT_CONFIG, ...config }
  const requestedPacks = Array.isArray(merged.packs) ? merged.packs : []
  const contentMode = merged.contentMode === 'extensions' || (!Object.hasOwn(config, 'contentMode') && requestedPacks.some((pack) => pack !== 'base')) ? 'extensions' : 'classic'
  return {
    ...merged,
    orientation: merged.orientation === 'portrait' ? 'portrait' : 'landscape',
    assignmentMode: merged.assignmentMode === 'manual' ? 'manual' : 'random',
    contentMode,
    includeBaseRoles: contentMode === 'classic' || merged.includeBaseRoles !== false,
    runMode: ['automatic', 'manual', 'hybrid'].includes(merged.runMode) ? merged.runMode : 'hybrid',
    rulesMode: merged.rulesMode === 'custom' ? 'custom' : 'official',
    packs: [...new Set(['base', ...(Array.isArray(merged.packs) ? merged.packs : [])])].filter((pack) => ['base', 'nouvelle-lune', 'village', 'personnages', '25-ans'].includes(pack)),
    selectedVariantIds: [...new Set(Array.isArray(merged.selectedVariantIds) ? merged.selectedVariantIds : [])].filter((id) => VARIANTS.some((variant) => variant.id === id)),
    spectatorMode: merged.spectatorMode === 'omniscient' ? 'omniscient' : 'detective',
    revealEliminatedRoles: merged.revealEliminatedRoles !== false,
    showPlayerAvatarOnCardBack: merged.showPlayerAvatarOnCardBack === true,
    ambienceVolume: clamp(Math.round(Number(merged.ambienceVolume)), 0, 100),
    debateSeconds: clamp(Math.round(Number(merged.debateSeconds)), 30, 1800),
    voteSeconds: clamp(Math.round(Number(merged.voteSeconds)), 15, 600),
    revealSeconds: clamp(Math.round(Number(merged.revealSeconds)), 5, 120),
    giftValue: clamp(Math.round(Number(merged.giftValue)), 0, 1_000_000),
    giftQuantity: clamp(Math.round(Number(merged.giftQuantity)), 1, 999),
    registrationMinutes: clamp(Math.round(Number(merged.registrationMinutes)), 1, 10_080),
    seats: clamp(Math.round(Number(merged.seats)), 1, MAX_ACTIVE_PLAYERS),
  }
}

