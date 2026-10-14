import { giftTriggers } from '../data/wheelConfig'

export type LiveGift = {
  giftIds?: string[]
  giftFamily?: string
  cost: number
  id: string
  imageUrl: string
  name: string
  source?: string
}

export type GiftTriggerOption = {
  alternateIds?: string[]
  alternateNames?: string[]
  giftIds?: string[]
  coinCost?: number
  colors: string[]
  cost: string
  group?: string
  hideCost?: boolean
  id: string
  imageUrl?: string
  label?: string
  name: string
  source?: string
  subtitle?: string
  value?: string
}

type RawGift = Record<string, any>
type GiftTriggerOptionInput = Partial<GiftTriggerOption> | Record<string, any>
type GiftTriggerOptionListConfig = {
  excludeIds?: string[]
  group?: string
  prepend?: GiftTriggerOptionInput | GiftTriggerOptionInput[]
  subtitle?: string
}

const palettes = [
  ['#ff6a00', '#111111'],
  ['#ff9f1c', '#3b1305'],
  ['#f97316', '#7c2d12'],
  ['#facc15', '#18181b'],
  ['#fb7185', '#431407'],
  ['#22d3ee', '#111827'],
]

const giftAliasGroups = [
  ['tiktok', '5269', 'tik-tok'],
  ['rose', '5655'],
  ['gg', '6064'],
  ['finger-heart', '5487', 'finger heart', 'finger hearts', 'coeur avec les doigts', 'coeur doigts', 'c\u0153ur avec les doigts', 'c\u0153ur doigts'],
  ['heart-me', '7934', '17712', '62816', '601333', 'heart me', 'coeur sur moi', 'cœur sur moi', 'coeur du jour', 'cœur du jour', 'community heart', 'envoie moi un coeur'],
  ['perfume', '5658', 'parfum'],
  ['doughnut', '5879', 'donut', 'beignet'],
  ['cap', '6104', 'casquette'],
  ['little-crown', '6097', 'little crown', 'petite couronne'],
  ['corgi', '6267'],
  ['bacchetta-magica', 'bacchetta magica', 'magic wand', 'baguette magique'],
  ['fireworks', '6090', 'firework', 'feu artifice', 'feux artifice'],
  ['money-gun', '7168', 'money gun', 'pistolet a billets', 'pistolet \u00e0 billets'],
  ['love-you', '6671', 'love you'],
  ['galaxy', '5886', 'galaxie'],
  ['tofu', '10604', 'tofu-10604'],
  ['forever-rosa', 'forever rosa'],
  ['boxing-gloves', 'boxing gloves', 'gants de boxe'],
  ['elephant-trunk', '12320', 'gift-12320', 'elephant trunk', 'trompe d elephant', 'trompe d\u2019elephant'],
  ['you-re-amazing', 'youre amazing', 'you\u2019re amazing', 'you are amazing'],
  ['ellie-the-elephant', 'ellie the elephant'],
  ['girafa', 'giraffe', 'girafe'],
  ['leon-the-kitten', 'leon the kitten'],
  ['voiture-de-course', 'voiture de course', 'race car'],
  ['lion', 'lion'],
  ['cote-a-cote', 'c\u00f4te \u00e0 c\u00f4te', 'cote a cote'],
  ['urso-misha', 'urso misha'],
  ['panda-escalador', 'panda escalador', 'panda climb', 'panda escalade'],
  ['go-popular', 'go popular'],
  ['family', '9575', 'family-9575'],
] as const

const giftAliasLookup = new Map<string, string>(
  giftAliasGroups.flatMap((aliases) => {
    const canonical = slugify(aliases[0])
    return aliases.map((alias) => [slugify(alias), canonical] as const)
  }),
)

const giftAliasNumericIdLookup = new Map<string, string>(
  giftAliasGroups.flatMap((aliases) => {
    const numericId = aliases.find((alias) => /^\d+$/.test(alias))
    if (!numericId) return []
    return aliases.map((alias) => [slugify(alias), numericId] as const)
  }),
)

const giftAliasCatalogIdLookup = new Map<string, string>([
  ['galaxy-11046', '5886'],
])

export function createGiftTriggerOptions(gifts: RawGift[] = []): GiftTriggerOption[] {
  const realOptions = gifts
    .map(giftToTriggerOption)
    .filter((gift) => gift.id && gift.name)
    .sort((left, right) => sourceRank(left.source) - sourceRank(right.source) || costValue(left.cost) - costValue(right.cost) || left.name.localeCompare(right.name))

  return dedupeOptions([normalizeGiftTriggerOption(giftTriggers[0]), ...realOptions].filter(Boolean) as GiftTriggerOption[])
}

export function createGiftTriggerOptionList(options: GiftTriggerOptionInput[] = [], config: GiftTriggerOptionListConfig = {}) {
  const excludeIds = new Set((config.excludeIds || []).map((id) => String(id)))
  const prepend = Array.isArray(config.prepend)
    ? config.prepend
    : config.prepend
      ? [config.prepend]
      : []
  const mappedOptions = normalizeGiftTriggerOptions(options)
    .filter((option) => !excludeIds.has(option.id))
    .map((option) => ({
      ...option,
      ...(config.group ? { group: config.group } : {}),
      ...(config.subtitle ? { subtitle: config.subtitle } : {}),
    }))

  return normalizeGiftTriggerOptions([...prepend, ...mappedOptions])
}

export function createGiftSelectPlaceholderOption(name: string, overrides: GiftTriggerOptionInput = {}) {
  return createGiftSpecialOption({
    id: '',
    name,
    colors: ['#3a332f', '#191512'],
    ...overrides,
  })
}

export function createAnyGiftTriggerOption(name: string, overrides: GiftTriggerOptionInput = {}) {
  return createGiftSpecialOption({
    id: 'Gift',
    name,
    colors: ['#d9a441', '#4a2a07'],
    ...overrides,
  })
}

export function createGiftSpecialOption(option: GiftTriggerOptionInput) {
  return normalizeGiftTriggerOption({
    cost: '',
    hideCost: true,
    ...option,
  }) as GiftTriggerOption
}

export function normalizeGiftTriggerOptions(options: GiftTriggerOptionInput[] = []) {
  return dedupeOptions(options.map(normalizeGiftTriggerOption).filter(Boolean) as GiftTriggerOption[])
}

export function normalizeGiftTriggerOption(option: GiftTriggerOptionInput | null | undefined): GiftTriggerOption | null {
  if (!option || typeof option !== 'object') return null

  const id = String(option.id ?? option.value ?? '').trim()
  const name = String(option.name ?? option.label ?? id).trim()
  if (!id && !name) return null

  const cost = option.cost === undefined || option.cost === null || option.cost === 0
    ? ''
    : String(option.cost)
  const parsedCost = Number(option.coinCost ?? Number.parseInt(cost, 10))
  const colors = Array.isArray(option.colors) && option.colors.length >= 2
    ? option.colors
    : colorPair(id || name)

  return {
    ...option,
    alternateIds: uniqueOptionStrings(option.alternateIds, option.giftIds),
    alternateNames: uniqueOptionStrings(option.alternateNames),
    coinCost: Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : undefined,
    colors,
    cost,
    group: option.group ? String(option.group) : undefined,
    hideCost: Boolean(option.hideCost),
    id,
    imageUrl: String(option.imageUrl || '').trim(),
    label: option.label ? String(option.label) : undefined,
    name,
    source: option.source ? String(option.source) : undefined,
    subtitle: option.subtitle ? String(option.subtitle) : undefined,
    value: option.value ? String(option.value) : undefined,
  }
}

export function giftToTriggerOption(gift: RawGift = {}): GiftTriggerOption {
  const normalized = normalizeLiveGift(gift)
  const source = normalized.source || 'live'
  const nameId = `gift-name:${slugify(normalized.name)}`
  const catalogLiveGiftId = source === 'catalog' ? catalogGiftLiveId(normalized) : ''
  const optionId = source === 'catalog'
    ? catalogLiveGiftId ? `gift:${catalogLiveGiftId}` : nameId
    : normalized.id ? `gift:${normalized.id}` : nameId
  return {
    id: optionId,
    alternateIds: uniqueOptionStrings(gift.alternateIds, gift.giftIds).map((id) => id.startsWith('gift:') ? id : `gift:${id}`),
    alternateNames: uniqueOptionStrings(gift.alternateNames, [gift.originalName]),
    name: normalized.name,
    cost: normalized.cost ? String(normalized.cost) : '',
    coinCost: normalized.cost,
    colors: colorPair(normalized.id || normalized.name),
    imageUrl: normalized.imageUrl,
    source,
  }
}

export function normalizeLiveGift(gift: RawGift = {}): LiveGift {
  return {
    ...(Array.isArray(gift.giftIds) ? { giftIds: [...new Set(gift.giftIds.map((id: unknown) => String(id || '').trim()).filter(Boolean))] as string[] } : {}),
    ...(gift.giftFamily ? { giftFamily: String(gift.giftFamily).trim() } : {}),
    id: String(gift.id || gift.giftId || gift.gift_id || '').trim(),
    name: String(gift.name || gift.giftName || '').trim(),
    cost: Number(gift.cost || gift.giftCost || gift.value || gift.diamondCount || gift.diamond_count || 0) || 0,
    imageUrl: String(gift.imageUrl || gift.giftImageUrl || gift.giftPictureUrl || '').trim(),
    source: String(gift.source || '').trim(),
  }
}

export function triggerMatchesGift(triggerId: string, gift: RawGift) {
  const normalized = normalizeLiveGift(gift)
  if (!triggerId || triggerId === 'none') return false

  if (normalized.id && triggerId === `gift:${normalized.id}`) return true
  if (normalized.giftFamily === 'community-heart' && giftAliasLookup.get(slugify(triggerId.replace(/^gift:/, ''))) === 'heart-me') return true
  if (normalized.id && (triggerId.startsWith('gift:') || /^\d+$/.test(triggerId))) {
    // Les alias techniques confirmés sont permis, pas le nom d'un autre ID.
    return [normalized.id, ...(normalized.giftIds || [])].some((id) => giftLookupKeysIntersect(giftLookupKeys(triggerId), giftLookupKeys(id)))
  }
  return giftLookupKeysIntersect(
    giftLookupKeys(triggerId),
    giftLookupKeysForGift(normalized),
  )
}

export function findGiftTriggerOption(triggerId: string, options: GiftTriggerOption[] = []) {
  const value = String(triggerId || '').trim()
  const normalizedOptions = normalizeGiftTriggerOptions(options)
  const exact = normalizedOptions.filter((option) => option.id === value)
  if (exact.length) return exact.length === 1 ? exact[0] : undefined
  if (!value) return undefined
  const matches = normalizedOptions.filter((option) => giftTriggerOptionMatches(option, value))
  return matches.length === 1 ? matches[0] : undefined
}

export function giftTriggerOptionMatches(option: GiftTriggerOption | null | undefined, triggerId: string) {
  if (!option) return false
  const value = String(triggerId || '').trim()
  const triggerKeys = giftLookupKeys(value)
  if (!triggerKeys.size) return false
  if (option.id === value) return true
  const isNameReference = value.startsWith('gift-name:')
  if (!isNameReference && giftLookupKeysIntersect(optionTechnicalKeys(option), triggerKeys)) return true
  if (!isNameReference && (/^gift:/i.test(value) || /^\d+$/.test(value))) return false
  return [option.name, ...(option.alternateNames || [])].some((name) => giftLookupKeysIntersect(giftLookupKeys(name), triggerKeys))
}

export function giftTriggerLabel(triggerId: string, options: GiftTriggerOption[] = [], fallback = '') {
  const option = findGiftTriggerOption(triggerId, options)
  return option?.name || option?.label || fallback
}

export function giftTriggerCost(triggerId: string, options: GiftTriggerOption[] = []) {
  const option = findGiftTriggerOption(triggerId, options)
  return Number(option?.coinCost ?? Number.parseInt(option?.cost || '', 10)) || 0
}

export function giftTriggerOptionToLiveGift(triggerId: string, options: GiftTriggerOption[] = [], fallbackName = ''): LiveGift {
  const option = findGiftTriggerOption(triggerId, options)
  const rawValue = String(option?.id || triggerId || '').trim()
  const cleanName = String(option?.name || option?.label || fallbackName || '')
    .replace(/\s+-\s+\d+\s+coins?$/i, '')
    .trim()

  return {
    cost: Number(option?.coinCost ?? Number.parseInt(option?.cost || '', 10)) || 0,
    id: rawValue.startsWith('gift:') ? rawValue.slice(5) : rawValue.startsWith('gift-name:') ? '' : rawValue,
    imageUrl: String(option?.imageUrl || '').trim(),
    name: cleanName,
  }
}

export function findGiftTriggerOptionByName(name: string, options: GiftTriggerOption[] = [], fallback?: RawGift) {
  const needle = slugify(name)
  if (!needle) return fallback

  const normalizedOptions = normalizeGiftTriggerOptions(options)
  const needleKeys = giftLookupKeys(name)
  const matches = normalizedOptions.filter((gift) =>
    [gift.name, ...(gift.alternateNames || [])].some((alias) => giftLookupKeysIntersect(giftLookupKeys(alias), needleKeys))
      || giftLookupKeysIntersect(optionTechnicalKeys(gift), needleKeys)
      || gift.id === `gift-name:${needle}`)
  return matches.length === 1 ? matches[0] : fallback
}

export function slugify(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

function colorPair(seed: unknown) {
  const value = String(seed || 'gift')
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return palettes[hash % palettes.length]
}

function dedupeOptions(options: GiftTriggerOption[]) {
  const parents = options.map((_option, index) => index)
  const indexById = new Map<string, number>()
  const find = (index: number): number => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]]
      index = parents[index]
    }
    return index
  }
  options.forEach((option, index) => {
    const keys = option.id?.startsWith('gift-name:')
      ? new Set([`name-reference:${slugify(option.id)}`])
      : optionTechnicalKeys(option)
    // Un nom, un dessin ou un prix communs ne suppriment plus un autre ID.
    for (const key of keys) {
      if (indexById.has(key)) parents[find(index)] = find(indexById.get(key)!)
      else indexById.set(key, index)
    }
  })
  const groups = new Map<number, GiftTriggerOption[]>()
  options.forEach((option, index) => {
    const root = find(index)
    const group = groups.get(root) || []
    group.push(option)
    groups.set(root, group)
  })
  return [...groups.values()].map((group) => group.reduce(mergeGiftTriggerOptions))
}

function mergeGiftTriggerOptions(current: GiftTriggerOption, candidate: GiftTriggerOption): GiftTriggerOption {
  const better = giftOptionQuality(candidate) > giftOptionQuality(current) ? candidate : current
  const other = better === candidate ? current : candidate
  return {
    ...other,
    ...better,
    id: mergedGiftTriggerId(current, candidate, better),
    alternateIds: uniqueOptionStrings([current.id, candidate.id], current.alternateIds, candidate.alternateIds)
      .filter((id) => id !== mergedGiftTriggerId(current, candidate, better)),
    alternateNames: uniqueOptionStrings([current.name, candidate.name], current.alternateNames, candidate.alternateNames)
      .filter((name) => name !== better.name),
  }
}

function mergedGiftTriggerId(current: GiftTriggerOption, candidate: GiftTriggerOption, better: GiftTriggerOption) {
  if (isNumericGiftOptionId(current.id)) return current.id
  if (isNumericGiftOptionId(candidate.id)) return candidate.id
  return better.id || current.id
}

function isNumericGiftOptionId(value: string) {
  return /^(?:gift:)?\d+$/.test(value)
}

function uniqueOptionStrings(...groups: unknown[]): string[] {
  return [...new Set(groups.flatMap((group) => Array.isArray(group) ? group : [])
    .map((value) => String(value || '').trim()).filter(Boolean))]
}

function optionTechnicalKeys(option: GiftTriggerOption): Set<string> {
  const keys = new Set<string>()
  for (const id of [option.id, ...(option.alternateIds || []), ...(option.giftIds || [])]) {
    if (!id || id.startsWith('gift-name:')) continue
    for (const key of giftLookupKeys(id)) keys.add(key)
  }
  return keys
}

function giftOptionQuality(option: GiftTriggerOption) {
  let score = 0
  if (option.imageUrl) score += 8
  if (option.coinCost || option.cost) score += 2
  score += Math.min(Number(option.coinCost ?? Number.parseInt(option.cost || '', 10)) || 0, 50000) / 100000
  if (/[A-Z]/.test(option.name)) score += 2
  if (option.source === 'catalog' || option.source === 'tikfinity') score += 1
  return score
}

function catalogGiftLiveId(gift: LiveGift) {
  if (/^\d+$/.test(gift.id)) return gift.id
  const idKey = slugify(gift.id)
  const nameKey = slugify(gift.name)
  const idMatch = giftAliasNumericIdLookup.get(idKey) || giftAliasCatalogIdLookup.get(idKey)
  if (idMatch) return idMatch
  if (!nameKey || (idKey && idKey !== nameKey)) return ''
  return giftAliasNumericIdLookup.get(nameKey) || ''
}

function dedupeNameKey(value: unknown) {
  const text = String(value || '')
  if (/[^\u0000-\u024f\s'`.\-+&0-9]/u.test(text)) return ''
  return slugify(text)
}

function giftLookupKeys(value: unknown) {
  const cleanValue = String(value || '').trim()
  const rawValue = cleanValue.startsWith('gift-name:')
    ? cleanValue.slice(10)
    : cleanValue.startsWith('gift:')
      ? cleanValue.slice(5)
      : cleanValue
  const key = slugify(rawValue)
  const keys = new Set<string>()
  if (key) keys.add(key)
  const aliasKey = giftAliasLookup.get(key)
  if (aliasKey) keys.add(aliasKey)
  return keys
}

function giftLookupKeysForGift(gift: LiveGift | RawGift) {
  const keys = new Set<string>()
  for (const key of giftLookupKeys(gift.id)) keys.add(key)
  for (const key of giftLookupKeys(gift.name)) keys.add(key)
  return keys
}

function giftLookupKeysIntersect(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return false
  for (const key of left) {
    if (right.has(key)) return true
  }
  return false
}

function costValue(value: string) {
  return Number.parseInt(value, 10) || 0
}

function sourceRank(source = '') {
  if (source === 'live') return 0
  if (source === 'catalog' || source === 'tikfinity') return 1
  return 2
}
