import { giftTriggers } from '../data/wheelConfig'

export type LiveGift = {
  cost: number
  id: string
  imageUrl: string
  name: string
  source?: string
}

export type GiftTriggerOption = {
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
  ['heart-me', '7934', 'heart me'],
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
    id: String(gift.id || gift.giftId || gift.gift_id || '').trim(),
    name: String(gift.name || gift.giftName || '').trim(),
    cost: Number(gift.cost || gift.diamondCount || gift.diamond_count || 0) || 0,
    imageUrl: String(gift.imageUrl || gift.giftPictureUrl || '').trim(),
    source: String(gift.source || '').trim(),
  }
}

export function triggerMatchesGift(triggerId: string, gift: RawGift) {
  const normalized = normalizeLiveGift(gift)
  if (!triggerId || triggerId === 'none') return false

  if (normalized.id && triggerId === `gift:${normalized.id}`) return true
  return giftLookupKeysIntersect(
    giftLookupKeys(triggerId),
    giftLookupKeysForGift(normalized),
  )
}

export function findGiftTriggerOption(triggerId: string, options: GiftTriggerOption[] = []) {
  const value = String(triggerId || '').trim()
  const normalizedOptions = normalizeGiftTriggerOptions(options)
  if (!value) return normalizedOptions.find((option) => option.id === value)
  return normalizedOptions.find((option) => option.id === value)
    || normalizedOptions.find((option) => giftTriggerOptionMatches(option, value))
}

export function giftTriggerOptionMatches(option: GiftTriggerOption | null | undefined, triggerId: string) {
  if (!option) return false
  const triggerKeys = giftLookupKeys(triggerId)
  if (!triggerKeys.size) return false
  if (option.id === triggerId) return true
  if (giftLookupKeysIntersect(giftLookupKeys(option.id), triggerKeys)) return true
  return giftLookupKeysIntersect(giftLookupKeys(option.name), triggerKeys)
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
  return normalizedOptions.find((gift) => giftLookupKeysIntersect(giftLookupKeys(gift.name), needleKeys))
    || normalizedOptions.find((gift) => giftLookupKeysIntersect(giftLookupKeys(gift.id), needleKeys) || gift.id === `gift-name:${needle}`)
    || normalizedOptions.find((gift) => slugify(gift.name).includes(needle) || slugify(gift.id).includes(needle))
    || fallback
}

export function slugify(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
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
  const deduped: GiftTriggerOption[] = []
  const indexById = new Map<string, number>()
  const indexByImage = new Map<string, number>()
  const indexByName = new Map<string, number>()

  for (const option of options) {
    const nameKey = dedupeNameKey(option.name)
    const imageKey = String(option.imageUrl || '').trim().toLowerCase()
    let existingIndex = indexById.get(option.id)
    if (existingIndex === undefined && option.id !== 'none' && imageKey) {
      existingIndex = indexByImage.get(imageKey)
    }
    if (existingIndex === undefined && option.id !== 'none' && nameKey) {
      existingIndex = indexByName.get(nameKey)
    }

    if (existingIndex === undefined) {
      existingIndex = deduped.length
      deduped.push(option)
    } else {
      deduped[existingIndex] = mergeGiftTriggerOptions(deduped[existingIndex], option)
    }

    const merged = deduped[existingIndex]
    indexById.set(merged.id, existingIndex)
    indexById.set(option.id, existingIndex)
    if (nameKey) indexByName.set(nameKey, existingIndex)
    const mergedNameKey = dedupeNameKey(merged.name)
    if (mergedNameKey) indexByName.set(mergedNameKey, existingIndex)
    if (imageKey) indexByImage.set(imageKey, existingIndex)
    const mergedImageKey = String(merged.imageUrl || '').trim().toLowerCase()
    if (mergedImageKey) indexByImage.set(mergedImageKey, existingIndex)
  }

  return deduped
}

function mergeGiftTriggerOptions(current: GiftTriggerOption, candidate: GiftTriggerOption): GiftTriggerOption {
  const better = giftOptionQuality(candidate) > giftOptionQuality(current) ? candidate : current
  const other = better === candidate ? current : candidate
  return {
    ...other,
    ...better,
    id: mergedGiftTriggerId(current, candidate, better),
  }
}

function mergedGiftTriggerId(current: GiftTriggerOption, candidate: GiftTriggerOption, better: GiftTriggerOption) {
  if (isNumericGiftOptionId(current.id)) return current.id
  if (isNumericGiftOptionId(candidate.id)) return candidate.id
  return better.id || current.id
}

function isNumericGiftOptionId(value: string) {
  return /^gift:\d+$/.test(value)
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
