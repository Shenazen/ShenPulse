import { clamp } from './utils.mjs'
import { MIN_ACTIVE_PLAYERS, MAX_ACTIVE_PLAYERS, ROLE_BY_ID } from './catalog.mjs'
import { normalizeConfig } from './configuration.mjs'
import { rolePackIds } from './players.mjs'

export function recommendedRoleIds(playerCount = 8, options = {}) {
  const count = clamp(Math.round(Number(playerCount)), MIN_ACTIVE_PLAYERS, MAX_ACTIVE_PLAYERS)
  const enabledPacks = new Set(Array.isArray(options.packs) ? options.packs : ['base'])
  const compactCompositions = {
    3: ['simple-loup-garou', 'simple-villageois', 'simple-villageois'],
    4: ['simple-loup-garou', 'voyante', 'simple-villageois', 'simple-villageois'],
    5: ['simple-loup-garou', 'voyante', 'sorciere', 'simple-villageois', 'simple-villageois'],
    6: ['simple-loup-garou', 'simple-loup-garou', 'voyante', 'sorciere', 'simple-villageois', 'simple-villageois'],
    7: ['simple-loup-garou', 'simple-loup-garou', 'voyante', 'sorciere', 'chasseur', 'simple-villageois', 'simple-villageois'],
    8: ['simple-loup-garou', 'simple-loup-garou', 'voyante', 'sorciere', 'chasseur', 'cupidon', 'petite-fille', 'simple-villageois'],
  }
  const result = [...compactCompositions[count]]
  if (count >= 7 && enabledPacks.has('25-ans')) result[result.indexOf('chasseur')] = 'colosse'
  if (count >= 8 && enabledPacks.has('village')) result[result.indexOf('cupidon')] = 'corbeau'
  if (count >= 8 && enabledPacks.has('personnages')) result[result.indexOf('petite-fille')] = 'renard'
  else if (count >= 8 && enabledPacks.has('nouvelle-lune')) result[result.indexOf('petite-fille')] = 'salvateur'
  return result
}

export function validateSetup({ players = [], roleIds = [], config = {} } = {}) {
  const normalized = normalizeConfig(config)
  const errors = []
  const warnings = []
  const rolePacks = normalized.contentMode === 'classic'
    ? new Set(['base'])
    : new Set(normalized.packs.filter((pack) => pack !== 'base'))
  if (normalized.contentMode === 'extensions' && normalized.includeBaseRoles) rolePacks.add('base')
  if (players.length < MIN_ACTIVE_PLAYERS) errors.push(`Ajoutez au moins ${MIN_ACTIVE_PLAYERS} joueurs à la partie.`)
  if (players.length > MAX_ACTIVE_PLAYERS) errors.push('La partie ne peut jamais dépasser huit joueurs actifs.')
  if (roleIds.length !== players.length) errors.push('Le nombre de personnages doit correspondre au nombre de joueurs.')
  if (players.length >= MIN_ACTIVE_PLAYERS && players.length < MAX_ACTIVE_PLAYERS) warnings.push(`Village compact à ${players.length} joueurs : la composition est adaptée à cet effectif.`)
  for (const roleId of roleIds) {
    const selected = ROLE_BY_ID[roleId]
    const accessiblePacks = selected ? rolePackIds(selected) : []
    if (!selected) errors.push(`Personnage inconnu : ${roleId}.`)
    else if (!accessiblePacks.some((pack) => normalized.packs.includes(pack))) errors.push(`${selected.name} nécessite l’une de ses extensions compatibles.`)
    else if (!accessiblePacks.some((pack) => rolePacks.has(pack))) errors.push(`${selected.name} n’appartient pas au pool de personnages choisi.`)
    else if (selected.camp === 'solitary' && !normalized.allowSolitary) errors.push(`${selected.name} est solitaire.`)
  }
  for (const roleId of new Set(roleIds)) {
    const selectedCount = roleIds.filter((id) => id === roleId).length
    if (selectedCount > 1 && !['simple-villageois', 'simple-loup-garou', 'deux-soeurs', 'trois-freres'].includes(roleId)) {
      errors.push(`${ROLE_BY_ID[roleId]?.name || roleId} ne peut être présent qu’une fois.`)
    }
  }
  for (const group of [{ id: 'deux-soeurs', count: 2 }, { id: 'trois-freres', count: 3 }]) {
    const selectedCount = roleIds.filter((id) => id === group.id).length
    if (selectedCount && selectedCount !== group.count) errors.push(`${ROLE_BY_ID[group.id].name} doivent être exactement ${group.count}.`)
  }
  if (!roleIds.some((id) => ['simple-loup-garou', 'grand-mechant-loup', 'infect-pere-des-loups', 'puissante-mere-des-loups', 'loup-garou-blanc'].includes(id)) && !normalized.selectedVariantIds.includes('peste-noire')) errors.push('Ajoutez au moins un Loup-Garou.')
  const wolfCount = roleIds.filter((id) => ROLE_BY_ID[id]?.camp === 'wolves').length
  const nonWolfCount = roleIds.length - wolfCount
  if (wolfCount && wolfCount >= nonWolfCount && normalized.rulesMode === 'official') errors.push('Le mode officiel exige davantage de non-Loups que de Loups-Garous.')
  else if (wolfCount && wolfCount >= nonWolfCount) warnings.push('Composition personnalisée très favorable aux Loups-Garous.')
  if (wolfCount > Math.max(2, Math.floor(players.length / 3))) warnings.push('Composition très favorable aux Loups-Garous.')
  return { valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)] }
}

