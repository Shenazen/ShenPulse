"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { safeString } = require("./utils");
const {
  canonicalGiftName,
  findCatalogGift,
  giftFamily,
  giftImageIdentity,
  normalizeGiftName
} = require("../shared/gift-identity");

const LOCALIZED_GIFT_REFRESH_MS = 6 * 60 * 60 * 1000;

const KENNEY_GROUPS = {
  back: range(1, 4),
  bong: [1],
  click: range(1, 5),
  close: range(1, 4),
  confirmation: range(1, 4),
  drop: range(1, 4),
  error: range(1, 8),
  glass: range(1, 6),
  glitch: range(1, 4),
  maximize: range(1, 9),
  minimize: range(1, 9),
  open: range(1, 4),
  pluck: range(1, 2),
  question: range(1, 4),
  scratch: range(1, 5),
  scroll: range(1, 5),
  select: range(1, 8),
  switch: range(1, 7),
  tick: [1, 2, 4],
  toggle: range(1, 4)
};

const KENNEY_CATEGORIES = {
  back: "utility",
  bong: "hype",
  click: "social",
  close: "utility",
  confirmation: "social",
  drop: "gift",
  error: "hype",
  glass: "gift",
  glitch: "hype",
  maximize: "hype",
  minimize: "hype",
  open: "gift",
  pluck: "gift",
  question: "social",
  scratch: "hype",
  scroll: "utility",
  select: "social",
  switch: "utility",
  tick: "utility",
  toggle: "utility"
};

const SHENPULSE_PRESETS = [
  ["1699561824035_sub.mp3", "Sub"],
  ["1699892960228_wow-anime.mp3", "Wow Anime"],
  ["1701803298560_lion-king-track2.mp3", "Lion King Track 2"],
  ["1702221560354_love-moment.mp3", "Love Moment"],
  ["1702225485893_ode-to-joy.mp3", "Ode To Joy"],
  ["1702225596064_epic-tut.mp3", "Epic Tut"],
  ["1704450916638_king-of-the-hill-opening-2.mp3", "King Of The Hill Opening 2"],
  ["1704453324936_10-second-intro-music.mp3", "10 Second Intro Music"],
  ["1708877357549_bue.mp3", "Bue"],
  ["1708877384604_taco-bell-bong-sfx.mp3", "Taco Bell Bong SFX"],
  ["1708877415194_chipi-chipi-chapa-chapa.mp3", "Chipi Chipi Chapa Chapa"],
  ["1708877462401_crack_the_whip.mp3", "Crack The Whip"],
  ["1715074207496_blue_oyster5.mp3", "Blue Oyster 5"],
  ["1715074236315_formatfactoryformatfactorygta-iii-theme-song-remix.mp3", "GTA III Theme Remix"],
  ["1715074278522_gta-iv-theme-song-musica-tema-soviet-connection.mp3", "GTA IV Soviet Connection"],
  ["1715074315369_gta-menu.mp3", "GTA Menu"],
  ["1715074355891_gta-v-death-sound-effect-102.mp3", "GTA V Death Sound"],
  ["1715074389222_gta-vice-city-mission-complete-theme.mp3", "GTA Vice City Mission Complete"],
  ["1715074475253_police-i-swear-to-god.mp3", "Police I Swear To God"],
  ["1715074515505_police-radio-gta-sa.mp3", "Police Radio GTA SA"],
  ["1715074526733_pop.mp3", "Pop"],
  ["1715074679680_sub2.mp3", "Sub 2"]
];

const ESSENTIAL_PRESETS = [
  ["big-gift", "Gros cadeau", "open_004", "gift"],
  ["chat-blip", "Bip de chat", "click_001", "social"],
  ["coin-shine", "Pièce brillante", "glass_001", "gift"],
  ["confirm", "Confirmation", "error_003", "social"],
  ["crystal-pop", "Pop cristal", "select_001", "social"],
  ["gift-spark", "Étincelle cadeau", "pluck_001", "gift"],
  ["hype-rise", "Montée hype", "maximize_005", "hype"],
  ["level-up", "Niveau supérieur", "confirmation_002", "hype"],
  ["ping-clean", "Ping clair", "tick_001", "utility"],
  ["power-pulse", "Impulsion", "bong_001", "hype"],
  ["soft-bell", "Cloche douce", "confirmation_001", "social"],
  ["timer-tick", "Tic minuteur", "switch_003", "utility"]
];

const TIKFINITY_LOTTIE_PRESETS = [
  ["10086-well-done", "Well Done", "general"],
  ["10193-cup", "Coupe", "general"],
  ["10236-reward-badge", "Badge de récompense", "general"],
  ["10341-it-animation", "Animation IT", "general"],
  ["10475-drawing-a-love", "Cœur dessiné", "general"],
  ["10530-heart-animation", "Animation cœur", "general"],
  ["10651-jumpin-pumpkin", "Citrouille bondissante", "celebration"],
  ["10653-halloween-candy", "Bonbons Halloween", "celebration"],
  ["10849-halloween-pumpkin", "Citrouille Halloween", "celebration"],
  ["11034-sparkles", "Étincelles", "celebration"]
];

function createSoundCatalog() {
  const kenney = Object.entries(KENNEY_GROUPS).flatMap(([prefix, indexes]) =>
    indexes.map((index) => {
      const stem = `${prefix}_${String(index).padStart(3, "0")}`;
      return {
        id: `kenney:${stem}`,
        name: titleCase(stem),
        detail: `Kenney Interface Sounds CC0 · ${KENNEY_CATEGORIES[prefix]}`,
        category: KENNEY_CATEGORIES[prefix],
        url: `/overlay/media/sounds/kenney-interface/${stem}.ogg`,
        tone: toneFor(KENNEY_CATEGORIES[prefix])
      };
    })
  );
  const essentials = ESSENTIAL_PRESETS.map(([id, name, stem, category]) => ({
    id: `essential:${id}`,
    name,
    detail: "Essentiel pour alertes LIVE · Kenney CC0",
    category,
    url: `/overlay/media/sounds/kenney-interface/${stem}.ogg`,
    tone: toneFor(category)
  }));
  const presets = SHENPULSE_PRESETS.map(([fileName, name]) => ({
    id: `shenpulse:${fileName.replace(/\.[^.]+$/, "")}`,
    name,
    detail: "Preset ShenPulse importé",
    category: "shenpulse",
    url: `/overlay/media/sounds/audio-presets/${fileName}`,
    tone: "violet"
  }));
  return [...essentials, ...presets, ...kenney];
}

function createMediaCatalog(resourcesDirectory) {
  const mediaDirectory = path.join(resourcesDirectory, "overlays", "media");
  const catalog = [];
  for (const filePath of walkFiles(mediaDirectory)) {
    const relative = path.relative(mediaDirectory, filePath).replace(/\\/g, "/");
    if (relative.startsWith("sounds/")) continue;
    const extension = path.extname(relative).toLowerCase();
    const kind = mediaKind(extension);
    if (!kind) continue;
    const segments = relative.split("/");
    const category =
      segments[0] === "widgets"
        ? segments[1] || "widgets"
        : segments[0] || kind;
    catalog.push({
      id: `included:${relative}`,
      name: mediaTitle(path.basename(relative, extension)),
      detail: `${mediaKindLabel(kind)} inclus · ${categoryLabel(category)}`,
      category,
      kind,
      source: "included",
      url: `/overlay/media/${relative}`
    });
  }
  for (const [id, name, category] of TIKFINITY_LOTTIE_PRESETS) {
    catalog.push({
      id: `tikfinity:${id}`,
      name,
      detail: "Animation Lottie prédéfinie · Tikfinity",
      category,
      kind: "animation",
      source: "tikfinity",
      url: `/overlay/media/lottie/${id}.json`
    });
  }
  return catalog.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind, "fr") ||
      left.name.localeCompare(right.name, "fr", {
        sensitivity: "base",
        numeric: true
      })
  );
}

async function searchMyInstantsSounds({
  query = "",
  page = 1,
  locale = "fr"
} = {}, { fetchImpl = fetch } = {}) {
  const language = normalizeMyInstantsLanguage(locale);
  const region = language === "fr" ? "fr" : "us";
  const pageNumber = Math.min(20, Math.max(1, Number(page) || 1));
  const cleanQuery = safeString(query, 80).trim();
  const requestUrl = cleanQuery
    ? `https://www.myinstants.com/${language}/search/?name=${encodeURIComponent(cleanQuery)}&page=${pageNumber}`
    : `https://www.myinstants.com/${language}/index/${region}/?page=${pageNumber}`;
  const response = await fetchImpl(requestUrl, {
    headers: {
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language":
        language === "fr"
          ? "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
          : "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/140.0.0.0 Safari/537.36"
    },
    redirect: "follow"
  });
  if (!response.ok) {
    throw new Error(`Bibliothèque de sons indisponible (${response.status}).`);
  }
  const sounds = extractMyInstantsSounds(await response.text());
  return {
    source: "myinstants",
    query: cleanQuery,
    page: pageNumber,
    hasMore: sounds.length > 0,
    sounds
  };
}

async function searchWikimediaMedia({
  query = "",
  page = 1,
  kind = "all"
} = {}) {
  const cleanQuery = safeString(query, 80).trim();
  const pageNumber = Math.min(20, Math.max(1, Number(page) || 1));
  const supportedKind = ["all", "image", "gif", "video"].includes(kind)
    ? kind
    : "all";
  const kindTerms = {
    all: "",
    image: " filetype:bitmap",
    gif: " filetype:bitmap",
    video: " filetype:video"
  };
  const searchText = `${
    cleanQuery || "livestream overlay animation"
  }${kindTerms[supportedKind]}`.trim();
  const requestUrl = new URL("https://commons.wikimedia.org/w/api.php");
  requestUrl.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrsearch: searchText,
    gsrlimit: "40",
    gsroffset: String((pageNumber - 1) * 40),
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "480",
    origin: "*"
  }).toString();
  const response = await fetch(requestUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ShenPulse/1.0 (Microsoft Store desktop app)"
    }
  });
  if (!response.ok) {
    throw new Error(
      `Catalogue média web indisponible (${response.status}).`
    );
  }
  const media = normalizeWikimediaMediaPayload(await response.json()).filter(
    (item) =>
      supportedKind === "all" ||
      item.kind === supportedKind ||
      (supportedKind === "image" && item.kind === "image")
  );
  return {
    source: "wikimedia",
    query: cleanQuery,
    page: pageNumber,
    kind: supportedKind,
    hasMore: media.length > 0,
    media
  };
}

class GiftCatalog {
  constructor(resourcesDirectory, {
    fetchLocalizedGifts = fetchFrenchTikTokGifts,
    fileNames = ["tiktok-gifts.json", "tiklive-gifts.json"]
  } = {}) {
    this.filePaths = fileNames.map((fileName) =>
      path.join(resourcesDirectory, "catalogs", fileName)
    );
    this.fetchLocalizedGifts = fetchLocalizedGifts;
    this.baseGifts = [];
    this.localizedGifts = [];
    this.learnedGifts = [];
    this.gifts = [];
    this.generatedAt = "";
    this.localizedAtMs = 0;
    this.localizedUsername = "";
    this.refreshPromise = null;
    this.load();
  }

  load() {
    const values = [];
    const generatedAt = [];
    for (const filePath of this.filePaths) {
      try {
        const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const source = path.basename(filePath) === "tiklive-gifts.json"
          ? "tiklive"
          : "catalog";
        if (payload.generatedAt) generatedAt.push(safeString(payload.generatedAt, 100));
        for (const gift of Array.isArray(payload.gifts) ? payload.gifts : []) {
          values.push({
            ...gift,
            source: safeString(gift?.source || source, 40)
          });
        }
      } catch {
        // Chaque source est optionnelle : le catalogue restant reste utilisable.
      }
    }
    this.baseGifts = dedupeGiftCatalog(values);
    this.gifts = [...this.baseGifts];
    this.generatedAt = generatedAt.filter(Boolean).sort().at(-1) || "";
    return this.gifts;
  }

  async refreshLocalized(username = "", { force = false } = {}) {
    const targetUsername = String(username || "tiktok")
      .trim()
      .replace(/^@+/, "") || "tiktok";
    if (
      !force &&
      this.localizedUsername === targetUsername &&
      Date.now() - this.localizedAtMs < LOCALIZED_GIFT_REFRESH_MS
    ) {
      return this.gifts;
    }
    if (this.refreshPromise && !force) return this.refreshPromise;
    const refresh = Promise.resolve(
      this.fetchLocalizedGifts(targetUsername)
    ).then((values) => {
      const gifts = dedupeLocalizedGifts(values);
      if (!gifts.length) {
        throw new Error("Le catalogue TikTok de la salle est vide.");
      }
      this.localizedGifts = gifts;
      this.gifts = dedupeGiftCatalog([
        ...this.baseGifts,
        ...this.learnedGifts,
        ...this.localizedGifts
      ]);
      this.generatedAt = new Date().toISOString();
      this.localizedAtMs = Date.now();
      this.localizedUsername = targetUsername;
      return this.gifts;
    });
    const pending = refresh.finally(() => {
      if (this.refreshPromise === pending) this.refreshPromise = null;
    });
    this.refreshPromise = pending;
    return pending;
  }

  mergeLiveGift(value = {}) {
    const gift = normalizeGift({
      ...value,
      cost:
        value.giftCost ??
        value.cost ??
        value.value ??
        value.diamondCount ??
        value.diamond_count,
      id: value.giftId ?? value.id,
      imageUrl:
        value.giftImageUrl ??
        value.imageUrl ??
        value.giftPictureUrl ??
        value.image,
      name: value.giftName ?? value.name,
      source: "live"
    });
    if (!gift.id || !gift.name) return false;

    const known = findCatalogGift(this.gifts, gift);
    const knownIds = new Set([
      String(known?.id || ""),
      ...(Array.isArray(known?.alternateIds) ? known.alternateIds : [])
    ]);
    if (known && knownIds.has(gift.id)) return false;

    this.learnedGifts = dedupeGiftCatalog([...this.learnedGifts, gift]);
    this.gifts = dedupeGiftCatalog([
      ...this.baseGifts,
      ...this.learnedGifts,
      ...this.localizedGifts
    ]);
    return true;
  }

  search(query = "", limit = 80) {
    const needle = normalizeSearch(query);
    const max = Math.min(1000, Math.max(1, Number(limit) || 80));
    const source = needle
      ? this.gifts.filter((gift) =>
          normalizeSearch(
            `${gift.name} ${gift.originalName || ""} ${gift.id} ${gift.cost} ` +
              `${(gift.alternateNames || []).join(" ")} ` +
              `${(gift.alternateIds || []).join(" ")}`
          ).includes(needle)
        )
      : this.gifts;
    return {
      generatedAt: this.generatedAt,
      total: source.length,
      gifts: source.slice(0, max)
    };
  }
}

async function fetchFrenchTikTokGifts(
  username = "tiktok",
  { createConnection } = {}
) {
  const connectionOptions = {
    processInitialData: false,
    fetchRoomInfoOnConnect: false,
    webClientParams: {
      app_language: "fr",
      browser_language: "fr-FR",
      priority_region: "FR",
      region: "FR",
      tz_name: "Europe/Paris",
      webcast_language: "fr"
    },
    webClientHeaders: {
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7"
    },
    webClientOptions: {
      timeout: 10000
    }
  };
  const connection = createConnection
    ? createConnection(username, connectionOptions)
    : new (require("tiktok-live-connector").TikTokLiveConnection)(
        username,
        connectionOptions
      );
  const roomId = await connection.fetchRoomId();
  if (!roomId) {
    throw new Error("La salle TikTok du créateur est introuvable.");
  }
  // fetchAvailableGifts() n'associe pas la salle tout seul dans la version
  // embarquée du connecteur. Sans room_id, TikTok renvoie son catalogue
  // mondial générique au lieu des cadeaux rattachés au créateur.
  connection.clientParams.room_id = String(roomId);
  return connection.fetchAvailableGifts();
}

function dedupeLocalizedGifts(values = []) {
  return dedupeGiftCatalog(
    (Array.isArray(values) ? values : []).map((value) => ({
      cost: value?.cost ?? value?.diamondCount ?? value?.diamond_count,
      id: value?.id ?? value?.giftId ?? value?.gift_id,
      imageUrl:
        value?.imageUrl ||
        value?.giftPictureUrl ||
        value?.image?.url_list?.[0] ||
        value?.image?.urlList?.[0] ||
        value?.icon?.url_list?.[0] ||
        value?.icon?.urlList?.[0],
      name: value?.name ?? value?.giftName,
      combo: value?.combo ?? value?.isCombo,
      giftType: value?.type ?? value?.giftType,
      imageUri: value?.image?.uri ?? value?.icon?.uri,
      isDisplayedOnPanel:
        value?.is_displayed_on_panel ?? value?.isDisplayedOnPanel,
      isGlobalGift: value?.is_global_gift ?? value?.isGlobalGift,
      primaryEffectId:
        value?.primary_effect_id ?? value?.primaryEffectId,
      source: "tiktok-fr"
    }))
  );
}

function normalizeGift(value = {}) {
  const originalName = safeString(value.name ?? value.giftName, 200);
  const rawId = safeString(value.id ?? value.giftId ?? value.gift_id, 160);
  const inferredNumericId = inferNumericGiftId(rawId);
  const alternateIds = uniqueStrings([
    ...(Array.isArray(value.alternateIds) ? value.alternateIds : []),
    ...(Array.isArray(value.giftIds) ? value.giftIds : []),
    inferredNumericId
  ], 160).filter((id) => id !== rawId);
  const alternateNames = uniqueStrings([
    ...(Array.isArray(value.alternateNames) ? value.alternateNames : []),
    value.originalName
  ], 200).filter((name) => name !== originalName);
  const gift = {
    id: rawId,
    alternateIds,
    alternateNames,
    name: originalName,
    cost: Math.max(
      0,
      Number(value.cost ?? value.diamondCount ?? value.diamond_count) || 0
    ),
    imageUrl: /^https:\/\//i.test(
      String(value.imageUrl || value.image_url || value.giftPictureUrl || "")
    )
      ? safeString(
          value.imageUrl || value.image_url || value.giftPictureUrl,
          1000
        )
      : "",
    source: safeString(value.source || "catalog", 40),
    giftType: Math.max(0, Number(value.giftType) || 0),
    combo: Boolean(value.combo),
    imageUri: safeString(value.imageUri, 1000),
    primaryEffectId: Math.max(0, Number(value.primaryEffectId) || 0),
    isGlobalGift: Boolean(value.isGlobalGift),
    isDisplayedOnPanel: Boolean(value.isDisplayedOnPanel)
  };
  const family = giftFamily(gift);
  return {
    ...gift,
    name: family ? canonicalGiftName(gift, originalName) : originalName,
    originalName:
      family && originalName !== canonicalGiftName(gift, originalName)
        ? originalName
        : safeString(value.originalName, 200),
    giftFamily: family
  };
}

function dedupeGiftCatalog(values = []) {
  let current = Array.isArray(values) ? values : [];
  let previousSignature = "";
  for (let pass = 0; pass < 8; pass += 1) {
    const next = dedupeGiftCatalogPass(current);
    const signature = giftCatalogSignature(next);
    if (signature === previousSignature) return next;
    previousSignature = signature;
    current = next;
  }
  return current;
}

function dedupeGiftCatalogPass(values = []) {
  const normalized = (Array.isArray(values) ? values : [])
    .map(normalizeGift)
    .filter((gift) => gift.id && gift.name);
  const parents = normalized.map((_gift, index) => index);
  const ranks = normalized.map(() => 0);
  const keys = new Map();

  const find = (index) => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const parent = parents[index];
      parents[index] = root;
      index = parent;
    }
    return root;
  };
  const union = (left, right) => {
    let leftRoot = find(left);
    let rightRoot = find(right);
    if (leftRoot === rightRoot) return;
    if (ranks[leftRoot] < ranks[rightRoot]) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    parents[rightRoot] = leftRoot;
    if (ranks[leftRoot] === ranks[rightRoot]) ranks[leftRoot] += 1;
  };

  normalized.forEach((gift, index) => {
    for (const key of giftDedupeKeys(gift)) {
      if (keys.has(key)) union(index, keys.get(key));
      else keys.set(key, index);
    }
  });

  const imageGroups = new Map();
  normalized.forEach((gift, index) => {
    const imageKey = giftImageIdentity(gift.imageUrl);
    if (!imageKey) return;
    const key = `${imageKey}:${gift.cost}`;
    const group = imageGroups.get(key) || { legacy: [], numeric: [] };
    const ids = [gift.id, ...(gift.alternateIds || [])];
    group[ids.some((id) => /^\d+$/.test(id)) ? "numeric" : "legacy"].push(index);
    imageGroups.set(key, group);
  });
  for (const group of imageGroups.values()) {
    for (let index = 1; index < group.legacy.length; index += 1) {
      union(group.legacy[0], group.legacy[index]);
    }
    const numericRoots = [...new Set(group.numeric.map(find))];
    if (group.legacy.length && numericRoots.length === 1) {
      union(group.legacy[0], numericRoots[0]);
    }
  }

  const groups = new Map();
  normalized.forEach((gift, index) => {
    const root = find(index);
    const group = groups.get(root) || [];
    group.push(gift);
    groups.set(root, group);
  });

  return [...groups.values()]
    .map((group) => group.reduce(mergeGiftEntries))
    .sort(compareGifts);
}

function giftCatalogSignature(gifts) {
  return gifts
    .map((gift) =>
      [
        gift.id,
        ...(gift.alternateIds || []),
        gift.name,
        ...(gift.alternateNames || []),
        gift.cost,
        gift.imageUrl
      ].join("\u0001")
    )
    .join("\u0002");
}

function giftDedupeKeys(gift) {
  const keys = [];
  for (const id of [gift.id, ...(gift.alternateIds || [])]) {
    if (id) keys.push(`id:${String(id).toLowerCase()}`);
  }
  if (gift.giftFamily) keys.push(`family:${gift.giftFamily}`);
  for (const name of [gift.name, ...(gift.alternateNames || [])]) {
    const nameKey = normalizeGiftName(name);
    if (nameKey) keys.push(`name:${nameKey}:${gift.cost}`);
  }
  return keys;
}

function mergeGiftEntries(left, right) {
  const preferred = giftQuality(right) >= giftQuality(left) ? right : left;
  const fallback = preferred === right ? left : right;
  const allIds = uniqueStrings([
    preferred.id,
    ...(preferred.alternateIds || []),
    fallback.id,
    ...(fallback.alternateIds || [])
  ], 160);
  const id = /^\d+$/.test(preferred.id)
    ? preferred.id
    : allIds.find((value) => /^\d+$/.test(value)) || preferred.id || fallback.id;
  const allNames = uniqueStrings([
    preferred.name,
    preferred.originalName,
    ...(preferred.alternateNames || []),
    fallback.name,
    fallback.originalName,
    ...(fallback.alternateNames || [])
  ], 200);
  const name = preferred.name || fallback.name;
  return normalizeGift({
    ...fallback,
    ...preferred,
    id,
    alternateIds: allIds.filter((value) => value !== id),
    alternateNames: allNames.filter((value) => value !== name),
    imageUrl: preferred.imageUrl || fallback.imageUrl,
    name
  });
}

function giftQuality(gift) {
  const sourceRank = {
    live: 4,
    "tiktok-fr": 4,
    catalog: 3,
    tiklive: 2
  }[gift.source] || 1;
  return (
    sourceRank * 100 +
    (/^\d+$/.test(gift.id) ? 20 : 0) +
    (gift.imageUrl ? 10 : 0) +
    (gift.cost ? 4 : 0) +
    (gift.giftType ? 2 : 0) +
    (gift.combo ? 1 : 0)
  );
}

function uniqueStrings(values, maximumLength) {
  return [...new Set(
    values
      .map((value) => safeString(value, maximumLength))
      .filter(Boolean)
  )];
}

function inferNumericGiftId(value) {
  const match = String(value || "").match(/(?:^gift-|[-_])(\d{4,})$/i);
  return match?.[1] || "";
}

function compareGifts(left, right) {
  return (
    left.cost - right.cost ||
    left.name.localeCompare(right.name, "fr", {
      sensitivity: "base",
      numeric: true
    }) ||
    left.id.localeCompare(right.id, "en", { numeric: true })
  );
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_value, index) => start + index);
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[œŒ]/g, "oe")
    .replace(/[æÆ]/g, "ae")
    .toLowerCase()
    .trim();
}

function toneFor(category) {
  return {
    gift: "green",
    hype: "pink",
    social: "cyan",
    utility: "violet"
  }[category] || "violet";
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const results = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...walkFiles(target));
    else if (entry.isFile()) results.push(target);
  }
  return results;
}

function mediaKind(extension) {
  if ([".gif", ".jpeg", ".jpg", ".png", ".webp"].includes(extension)) {
    return extension === ".gif" ? "gif" : "image";
  }
  if ([".mp4", ".webm"].includes(extension)) return "video";
  return "";
}

function mediaKindLabel(kind) {
  return {
    animation: "Animation",
    gif: "GIF",
    image: "Image",
    video: "Vidéo"
  }[kind] || "Média";
}

function categoryLabel(value) {
  return mediaTitle(String(value || "").replace(/_/g, "-"));
}

function mediaTitle(value) {
  return String(value || "")
    .replace(/^\d+[-_]?/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function extractMyInstantsSounds(html = "") {
  const sounds = [];
  const seen = new Set();
  const pattern =
    /share\('((?:\\.|[^'])*)',\s*'((?:\\.|[^'])*)',\s*'((?:\\.|[^'])*)',\s*'((?:\\.|[^'])*)'\)/g;
  for (const match of String(html || "").matchAll(pattern)) {
    const name = decodeHtml(decodeJsString(match[1])).trim();
    const pageUrl = absoluteMyInstantsUrl(decodeJsString(match[2]));
    const url = absoluteMyInstantsUrl(decodeJsString(match[3]));
    const slug = decodeJsString(match[4]).trim();
    const id = slug || url;
    if (!name || !url || seen.has(id)) continue;
    seen.add(id);
    sounds.push({
      id: `myinstants:${safeString(id, 240)}`,
      name,
      detail: "Catalogue web MyInstants",
      category: "web",
      source: "myinstants",
      tone: "cyan",
      url,
      pageUrl
    });
  }
  return sounds.slice(0, 60);
}

function absoluteMyInstantsUrl(value = "") {
  try {
    return new URL(String(value || "").trim(), "https://www.myinstants.com")
      .toString();
  } catch {
    return "";
  }
}

function decodeJsString(value = "") {
  try {
    return JSON.parse(`"${String(value).replace(/"/g, '\\"')}"`);
  } catch {
    return String(value || "").replace(
      /\\u([0-9a-fA-F]{4})/g,
      (_match, code) => String.fromCharCode(parseInt(code, 16))
    );
  }
}

function decodeHtml(value = "") {
  return String(value || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code) =>
      String.fromCodePoint(parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_match, code) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeMyInstantsLanguage(locale = "") {
  const language = String(locale || "").toLowerCase().slice(0, 2);
  return [
    "de",
    "en",
    "es",
    "fr",
    "hi",
    "it",
    "ja",
    "ko",
    "nl",
    "pt",
    "ru"
  ].includes(language)
    ? language
    : "en";
}

function normalizeWikimediaMediaPayload(payload = {}) {
  const pages = Array.isArray(payload?.query?.pages)
    ? payload.query.pages
    : [];
  return pages
    .map((page) => {
      const info = page?.imageinfo?.[0] || {};
      const mime = String(info.mime || "").toLowerCase();
      const kind =
        mime === "image/gif"
          ? "gif"
          : mime === "video/webm"
            ? "video"
            : [
                "image/jpeg",
                "image/png",
                "image/webp",
                "image/svg+xml"
              ].includes(mime)
              ? "image"
              : "";
      if (!kind || !info.url) return null;
      const originalUrl = String(info.url);
      const previewUrl = String(info.thumburl || originalUrl);
      const title = String(page.title || "Média Wikimedia")
        .replace(/^File:/i, "")
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      const license = stripHtml(
        info.extmetadata?.LicenseShortName?.value ||
          info.extmetadata?.UsageTerms?.value ||
          ""
      );
      return {
        id: `wikimedia:${page.pageid || originalUrl}`,
        name: safeString(title || "Média Wikimedia", 180),
        detail: `Wikimedia Commons${license ? ` · ${license}` : ""}`,
        category: kind,
        kind,
        source: "wikimedia",
        url: kind === "image" ? previewUrl : originalUrl,
        previewUrl,
        pageUrl: String(info.descriptionurl || "")
      };
    })
    .filter(Boolean);
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  GiftCatalog,
  SOUND_CATALOG: createSoundCatalog(),
  TIKFINITY_LOTTIE_PRESETS,
  createMediaCatalog,
  createSoundCatalog,
  extractMyInstantsSounds,
  normalizeWikimediaMediaPayload,
  searchMyInstantsSounds,
  searchWikimediaMedia,
  dedupeGiftCatalog,
  dedupeLocalizedGifts,
  fetchFrenchTikTokGifts,
  normalizeGift
};
