/** Normalise les cadeaux et leurs alias techniques pour les exports de jeux. */


const palettes = [
  ["#ff6a00", "#111111"],
  ["#ff9f1c", "#3b1305"],
  ["#f97316", "#7c2d12"],
  ["#facc15", "#18181b"],
  ["#fb7185", "#431407"],
  ["#22d3ee", "#111827"]
];

const giftAliasGroups = [
  ["tiktok", "5269", "tik-tok"],
  ["rose", "5655"],
  ["gg", "6064"],
  ["finger-heart", "5487", "finger heart", "finger hearts", "coeur avec les doigts", "coeur doigts", "c\u0153ur avec les doigts", "c\u0153ur doigts"],
  ["heart-me", "7934", "heart me"],
  ["perfume", "5658", "parfum"],
  ["doughnut", "5879", "donut", "beignet"],
  ["cap", "6104", "casquette"],
  ["little-crown", "6097", "little crown", "petite couronne"],
  ["corgi", "6267"],
  ["bacchetta-magica", "bacchetta magica", "magic wand", "baguette magique"],
  ["fireworks", "6090", "firework", "feu artifice", "feux artifice"],
  ["money-gun", "7168", "money gun", "pistolet a billets", "pistolet \xE0 billets"],
  ["love-you", "6671", "love you"],
  ["galaxy", "5886", "galaxie"],
  ["tofu", "10604", "tofu-10604"],
  ["forever-rosa", "forever rosa"],
  ["boxing-gloves", "boxing gloves", "gants de boxe"],
  ["elephant-trunk", "12320", "gift-12320", "elephant trunk", "trompe d elephant", "trompe d\u2019elephant"],
  ["you-re-amazing", "youre amazing", "you\u2019re amazing", "you are amazing"],
  ["ellie-the-elephant", "ellie the elephant"],
  ["girafa", "giraffe", "girafe"],
  ["leon-the-kitten", "leon the kitten"],
  ["voiture-de-course", "voiture de course", "race car"],
  ["lion", "lion"],
  ["cote-a-cote", "c\xF4te \xE0 c\xF4te", "cote a cote"],
  ["urso-misha", "urso misha"],
  ["panda-escalador", "panda escalador", "panda climb", "panda escalade"],
  ["go-popular", "go popular"],
  ["family", "9575", "family-9575"]
];

const giftAliasLookup = new Map(
  giftAliasGroups.flatMap((aliases) => {
    const canonical = slugify(aliases[0]);
    return aliases.map((alias) => [slugify(alias), canonical]);
  })
);

const giftAliasNumericIdLookup = new Map(
  giftAliasGroups.flatMap((aliases) => {
    const numericId = aliases.find((alias) => /^\d+$/.test(alias));
    if (!numericId) return [];
    return aliases.map((alias) => [slugify(alias), numericId]);
  })
);

function normalizeGiftTriggerOptions(options = []) {
  return dedupeOptions((Array.isArray(options) ? options : []).map(normalizeGiftTriggerOption).filter(Boolean));
}

function normalizeGiftTriggerOption(option) {
  if (!option || typeof option !== "object") return null;
  const id = String(option.id ?? option.value ?? "").trim();
  const name = String(option.name ?? option.label ?? id).trim();
  if (!id && !name) return null;
  const cost = option.cost === void 0 || option.cost === null || option.cost === 0 ? "" : String(option.cost);
  const parsedCost = Number(option.coinCost ?? Number.parseInt(cost, 10));
  const colors = Array.isArray(option.colors) && option.colors.length >= 2 ? option.colors : colorPair(id || name);
  return {
    ...option,
    alternateIds: uniqueOptionStrings(option.alternateIds, option.giftIds),
    alternateNames: uniqueOptionStrings(option.alternateNames),
    coinCost: Number.isFinite(parsedCost) && parsedCost > 0 ? parsedCost : void 0,
    colors,
    cost,
    group: option.group ? String(option.group) : void 0,
    hideCost: Boolean(option.hideCost),
    id,
    imageUrl: String(option.imageUrl || "").trim(),
    label: option.label ? String(option.label) : void 0,
    name,
    source: option.source ? String(option.source) : void 0,
    subtitle: option.subtitle ? String(option.subtitle) : void 0,
    value: option.value ? String(option.value) : void 0
  };
}

function findGiftTriggerOption(triggerId, options = []) {
  const value = String(triggerId || "").trim();
  const normalizedOptions = normalizeGiftTriggerOptions(options);
  const exact = normalizedOptions.filter((option) => option.id === value);
  if (exact.length) return exact.length === 1 ? exact[0] : void 0;
  if (!value) return void 0;
  const matches = normalizedOptions.filter((option) => giftTriggerOptionMatches(option, value));
  // Un ancien nom sans ID peut désigner plusieurs cadeaux : ne jamais choisir
  // arbitrairement le premier ni afficher son image à la place d'un autre.
  return matches.length === 1 ? matches[0] : void 0;
}

function giftTriggerOptionMatches(option, triggerId) {
  if (!option) return false;
  const value = String(triggerId || "").trim();
  const triggerKeys = giftLookupKeys(value);
  if (!triggerKeys.size) return false;
  if (option.id === value) return true;
  const isNameReference = value.startsWith("gift-name:");
  if (!isNameReference && giftLookupKeysIntersect(optionTechnicalKeys(option), triggerKeys)) return true;
  // Une référence numérique, ou gift:<ID>, reste technique même si son ID
  // manque au catalogue. Son nom ne doit pas la détourner vers un autre ID.
  if (!isNameReference && (/^gift:/i.test(value) || /^\d+$/.test(value))) return false;
  return [option.name, ...(option.alternateNames || [])].some((name) =>
    giftLookupKeysIntersect(giftLookupKeys(name), triggerKeys));
}

function slugify(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}

function colorPair(seed) {
  const value = String(seed || "gift");
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = hash * 31 + value.charCodeAt(index) >>> 0;
  }
  return palettes[hash % palettes.length];
}

function dedupeOptions(options) {
  const parents = options.map((_option, index) => index);
  const indexById = new Map();
  const find = (index) => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  options.forEach((option, index) => {
    const keys = option.id?.startsWith("gift-name:")
      ? new Set([`name-reference:${slugify(option.id)}`])
      : optionTechnicalKeys(option);
    // Seuls les ID et les alias explicites regroupent les options. Ni le
    // dessin, ni le prix, ni un nom homonyme ne suppriment une sélection.
    for (const key of keys) {
      if (indexById.has(key)) parents[find(index)] = find(indexById.get(key));
      else indexById.set(key, index);
    }
  });
  const groups = new Map();
  options.forEach((option, index) => {
    const root = find(index);
    const group = groups.get(root) || [];
    group.push(option);
    groups.set(root, group);
  });
  return [...groups.values()].map((group) => group.reduce(mergeGiftTriggerOptions));
}

function mergeGiftTriggerOptions(current, candidate) {
  const better = giftOptionQuality(candidate) > giftOptionQuality(current) ? candidate : current;
  const other = better === candidate ? current : candidate;
  return {
    ...other,
    ...better,
    id: mergedGiftTriggerId(current, candidate, better),
    alternateIds: uniqueOptionStrings(
      [current.id, candidate.id], current.alternateIds, candidate.alternateIds
    ).filter((id) => id !== mergedGiftTriggerId(current, candidate, better)),
    alternateNames: uniqueOptionStrings(
      [current.name, candidate.name], current.alternateNames, candidate.alternateNames
    ).filter((name) => name !== better.name)
  };
}

function mergedGiftTriggerId(current, candidate, better) {
  if (isNumericGiftOptionId(current.id)) return current.id;
  if (isNumericGiftOptionId(candidate.id)) return candidate.id;
  return better.id || current.id;
}

function isNumericGiftOptionId(value) {
  return /^(?:gift:)?\d+$/.test(value);
}

function uniqueOptionStrings(...groups) {
  return [...new Set(groups.flatMap((group) => Array.isArray(group) ? group : [])
    .map((value) => String(value || "").trim()).filter(Boolean))];
}

function optionTechnicalKeys(option) {
  const keys = new Set();
  for (const id of [option.id, ...(option.alternateIds || []), ...(option.giftIds || [])]) {
    if (!id || String(id).startsWith("gift-name:")) continue;
    for (const key of giftLookupKeys(id)) keys.add(key);
  }
  return keys;
}

function giftOptionQuality(option) {
  let score = 0;
  if (option.imageUrl) score += 8;
  if (option.coinCost || option.cost) score += 2;
  score += Math.min(Number(option.coinCost ?? Number.parseInt(option.cost || "", 10)) || 0, 5e4) / 1e5;
  if (/[A-Z]/.test(option.name)) score += 2;
  if (option.source === "catalog" || option.source === "tikfinity") score += 1;
  return score;
}

function dedupeNameKey(value) {
  const text = String(value || "");
  if (/[^\u0000-\u024f\s'`.\-+&0-9]/u.test(text)) return "";
  return slugify(text);
}

function giftLookupKeys(value) {
  const cleanValue = String(value || "").trim();
  const rawValue = cleanValue.startsWith("gift-name:") ? cleanValue.slice(10) : cleanValue.startsWith("gift:") ? cleanValue.slice(5) : cleanValue;
  const key = slugify(rawValue);
  const keys = /* @__PURE__ */ new Set();
  if (key) keys.add(key);
  const aliasKey = giftAliasLookup.get(key);
  if (aliasKey) keys.add(aliasKey);
  return keys;
}

function giftLookupKeysIntersect(left, right) {
  if (!left.size || !right.size) return false;
  for (const key of left) {
    if (right.has(key)) return true;
  }
  return false;
}

export { palettes, giftAliasGroups, giftAliasLookup, giftAliasNumericIdLookup, normalizeGiftTriggerOptions, normalizeGiftTriggerOption, findGiftTriggerOption, giftTriggerOptionMatches, slugify, colorPair, dedupeOptions, mergeGiftTriggerOptions, mergedGiftTriggerId, isNumericGiftOptionId, giftOptionQuality, dedupeNameKey, giftLookupKeys, giftLookupKeysIntersect };

