/*
 * Générateur partagé d’overlays de jeu.
 * Rendu repris du moteur validé de ShenazenOverlay afin que GTA, Minecraft
 * et les prochains jeux utilisent exactement les mêmes deux gabarits.
 */
var ShenPulseGameOverlay = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // ../ShenazenOverlay/src/utils/minecraftBedrockOverlay.ts
  var minecraftBedrockOverlay_exports = {};
  __export(minecraftBedrockOverlay_exports, {
    downloadMinecraftBedrockOverlay: () => downloadMinecraftBedrockOverlay,
    downloadMinecraftStyledOverlay: () => downloadMinecraftStyledOverlay,
    renderMinecraftBedrockOverlay: () => renderMinecraftBedrockOverlay,
    renderMinecraftStyledOverlay: () => renderMinecraftStyledOverlay
  });

  // ../ShenazenOverlay/src/domain/liveGifts.ts
  var palettes = [
    ["#ff6a00", "#111111"],
    ["#ff9f1c", "#3b1305"],
    ["#f97316", "#7c2d12"],
    ["#facc15", "#18181b"],
    ["#fb7185", "#431407"],
    ["#22d3ee", "#111827"]
  ];
  var giftAliasGroups = [
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
  var giftAliasLookup = new Map(
    giftAliasGroups.flatMap((aliases) => {
      const canonical = slugify(aliases[0]);
      return aliases.map((alias) => [slugify(alias), canonical]);
    })
  );
  var giftAliasNumericIdLookup = new Map(
    giftAliasGroups.flatMap((aliases) => {
      const numericId = aliases.find((alias) => /^\d+$/.test(alias));
      if (!numericId) return [];
      return aliases.map((alias) => [slugify(alias), numericId]);
    })
  );
  function normalizeGiftTriggerOptions(options = []) {
    return dedupeOptions(options.map(normalizeGiftTriggerOption).filter(Boolean));
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
    if (!value) return normalizedOptions.find((option) => option.id === value);
    return normalizedOptions.find((option) => option.id === value) || normalizedOptions.find((option) => giftTriggerOptionMatches(option, value));
  }
  function giftTriggerOptionMatches(option, triggerId) {
    if (!option) return false;
    const triggerKeys = giftLookupKeys(triggerId);
    if (!triggerKeys.size) return false;
    if (option.id === triggerId) return true;
    if (giftLookupKeysIntersect(giftLookupKeys(option.id), triggerKeys)) return true;
    return giftLookupKeysIntersect(giftLookupKeys(option.name), triggerKeys);
  }
  function slugify(value) {
    return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
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
    const deduped = [];
    const indexById = /* @__PURE__ */ new Map();
    const indexByImage = /* @__PURE__ */ new Map();
    const indexByName = /* @__PURE__ */ new Map();
    for (const option of options) {
      const nameKey = dedupeNameKey(option.name);
      const imageKey = String(option.imageUrl || "").trim().toLowerCase();
      let existingIndex = indexById.get(option.id);
      if (existingIndex === void 0 && option.id !== "none" && imageKey) {
        existingIndex = indexByImage.get(imageKey);
      }
      if (existingIndex === void 0 && option.id !== "none" && nameKey) {
        existingIndex = indexByName.get(nameKey);
      }
      if (existingIndex === void 0) {
        existingIndex = deduped.length;
        deduped.push(option);
      } else {
        deduped[existingIndex] = mergeGiftTriggerOptions(deduped[existingIndex], option);
      }
      const merged = deduped[existingIndex];
      indexById.set(merged.id, existingIndex);
      indexById.set(option.id, existingIndex);
      if (nameKey) indexByName.set(nameKey, existingIndex);
      const mergedNameKey = dedupeNameKey(merged.name);
      if (mergedNameKey) indexByName.set(mergedNameKey, existingIndex);
      if (imageKey) indexByImage.set(imageKey, existingIndex);
      const mergedImageKey = String(merged.imageUrl || "").trim().toLowerCase();
      if (mergedImageKey) indexByImage.set(mergedImageKey, existingIndex);
    }
    return deduped;
  }
  function mergeGiftTriggerOptions(current, candidate) {
    const better = giftOptionQuality(candidate) > giftOptionQuality(current) ? candidate : current;
    const other = better === candidate ? current : candidate;
    return {
      ...other,
      ...better,
      id: mergedGiftTriggerId(current, candidate, better)
    };
  }
  function mergedGiftTriggerId(current, candidate, better) {
    if (isNumericGiftOptionId(current.id)) return current.id;
    if (isNumericGiftOptionId(candidate.id)) return candidate.id;
    return better.id || current.id;
  }
  function isNumericGiftOptionId(value) {
    return /^gift:\d+$/.test(value);
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

  // ../ShenazenOverlay/src/utils/minecraftBedrockOverlay.ts
  var OVERLAY_WIDTH = 1080;
  var OVERLAY_HEIGHT = 1920;
  var BOTTOM_PANEL = {
    height: 428,
    padding: 42,
    radius: 0,
    width: 1064,
    x: 8,
    y: 1484
  };
  var FONT_FAMILY = '"Arial Black", Impact, Inter, Arial, sans-serif';
  var MINECRAFT_FONT_FACE = "ShenPulse Minecraft Pixel";
  var MINECRAFT_FONT_SRC = "assets/game-overlays/minecraft-bedrock/PressStart2P-Regular.ttf";
  var MINECRAFT_FONT_FAMILY = `"${MINECRAFT_FONT_FACE}", "Minecraft Ten", Minecraft, Minecrafter, Minecraftia, "Press Start 2P", "Arial Black", Impact, sans-serif`;
  var INTERACTION_SPRITES_SRC = "/overlay-assets/minecraft-bedrock/interaction-sprites.png";
  var STREAM_TO_EARN_EFFECT_ICON_BASE = "/overlay-assets/minecraft-bedrock/interaction-icons";
  var INTERACTION_ICON_URLS = {
    autoReplace: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-auto-replace-ai.png",
    blackhole: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-blackhole.webp",
    clear: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-clear-ai.png",
    comets: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-comets.webp",
    diamond: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-diamond-ai.png",
    fakeTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fake-tnt-ai.png",
    fill: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fill-ai.png",
    fillBlock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fill-block-ai.png",
    fillRows: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fill-rows-ai.png",
    fireworks: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fireworks-ai.png",
    glass: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-glass-ai.png",
    glassPrison: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-glass-prison-ai.png",
    heightDown: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-height-down-ai.png",
    heightUp: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-height-up-ai.png",
    longhands: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-longhands-ai.png",
    enderman: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-enderman.webp",
    meteor: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-meteor.webp",
    radiusDown: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-radius-down-ai.png",
    radiusUp: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-radius-up-ai.png",
    randomTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-random-tnt-ai.png",
    reset: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-reset-ai.png",
    rock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-rock-ai.png",
    superTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-super-tnt-ai.png",
    timer: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-timer-ai.png",
    tnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-ai.png",
    tntRocket: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-rocket-ai.png",
    tntRing: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-ring-ai.png",
    tntStep: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-step-ai.png",
    topLock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-top-lock-ai.png",
    tp: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tp-ai.png",
    weakTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-weak-tnt-ai.png",
    winAdd: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-add-ai.png",
    winBedrock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-bedrock-ai.png",
    winRandom: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-random-ai.png",
    winRemove: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-remove-ai.png",
    winX2: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-x2-ai.png",
    wood: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-wood-ai.png",
    zeusTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-zeus-tnt.webp"
  };
  var SANDBOX_OVERLAY_COLOR_IDS = [
    "white",
    "orange",
    "magenta",
    "light-blue",
    "yellow",
    "lime",
    "pink",
    "gray-gravel",
    "random",
    "gray",
    "light-gray",
    "cyan",
    "purple",
    "blue",
    "brown",
    "green",
    "red",
    "black",
    "red-sand"
  ];
  var INTERACTION_SPRITE_COLUMNS = 3;
  var INTERACTION_SPRITE_ROWS = 2;
  var INTERACTION_SPRITE_CELLS = {
    blocks: [2, 0],
    command: [2, 1],
    diamond: [0, 1],
    fill: [2, 0],
    reset: [1, 1],
    "super-tnt": [1, 0],
    tnt: [0, 0]
  };
  var imageLoadCache = /* @__PURE__ */ new Map();
  var minecraftFontLoadPromise = null;
  async function downloadMinecraftBedrockOverlay(options) {
    const canvas = await renderMinecraftBedrockOverlay(options);
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = options.filename || defaultOverlayFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  async function downloadMinecraftStyledOverlay(options) {
    const canvas = await renderMinecraftStyledOverlay(options);
    const blob = await canvasToBlob(canvas);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = options.filename || `shenpulse-game-overlay-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
  }
  async function renderMinecraftStyledOverlay(options) {
    const canvas = document.createElement("canvas");
    canvas.width = OVERLAY_WIDTH;
    canvas.height = OVERLAY_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible.");
    const entries = options.entries.filter((entry) => String(entry.label || "").trim());
    if (!entries.length) throw new Error("Active au moins une interaction complete avant de telecharger l overlay.");
    await ensureMinecraftOverlayFont();
    const preparedItems = await prepareMinecraftStyledOverlayItems(entries);
    const winItems = preparedItems.filter((item) => item.effect.kind === "win");
    const effectItems = groupOverlayEffectItems(
      preparedItems.filter((item) => item.effect.kind !== "win")
    ).slice(0, Math.max(0, 42 - winItems.length));
    const positiveWins = sortWinItems(winItems.filter((item) => item.effect.winTone !== "negative" && item.effect.winTone !== "random"));
    const negativeWins = sortWinItems(winItems.filter((item) => item.effect.winTone === "negative" || item.effect.winTone === "random"));
    if (options.model === 1) {
      const logo2 = await loadOverlayImage("assets/brand/shenpulse-banner-transparent.png");
      const panel = modelOneBottomPanelBounds(effectItems.length);
      ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
      drawWinColumn(ctx, positiveWins, "left", panel.y);
      drawWinColumn(ctx, negativeWins, "right", panel.y);
      drawModelOneBottomPanel(ctx, effectItems, panel, logo2, options.backgroundColor);
      return canvas;
    }
    const effectIconUrls = Array.from(new Set(effectItems.map((item) => item.effect.imageUrl).filter((url) => Boolean(url))));
    const [logo, effectIconEntries] = await Promise.all([
      loadOverlayImage("assets/brand/shenpulse-banner-transparent.png"),
      Promise.all(effectIconUrls.map(async (url) => [url, await loadOverlayImage(url)]))
    ]);
    const assets = {
      effectIcons: new Map(effectIconEntries),
      interactionSprites: null
    };
    ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
    drawWinColumn(ctx, positiveWins, "left");
    drawWinColumn(ctx, negativeWins, "right");
    drawBottomPanel(ctx, effectItems, logo, assets);
    return canvas;
  }
  async function renderMinecraftBedrockOverlay(options) {
    const canvas = document.createElement("canvas");
    canvas.width = OVERLAY_WIDTH;
    canvas.height = OVERLAY_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponible.");
    const [items] = await Promise.all([
      prepareOverlayItems(options.mappings, options.giftOptions),
      ensureMinecraftOverlayFont()
    ]);
    const winItems = items.filter((item) => item.effect.kind === "win");
    const effectItems = groupOverlayEffectItems(
      items.filter((item) => item.effect.kind !== "win")
    ).slice(0, Math.max(0, 42 - winItems.length));
    const positiveWins = sortWinItems(winItems.filter((item) => item.effect.winTone !== "negative" && item.effect.winTone !== "random"));
    const negativeWins = sortWinItems(winItems.filter((item) => item.effect.winTone === "negative" || item.effect.winTone === "random"));
    if (options.model === 1) {
      const logo2 = await loadOverlayImage("assets/brand/shenpulse-banner-transparent.png");
      const panel = modelOneBottomPanelBounds(effectItems.length);
      ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
      drawWinColumn(ctx, positiveWins, "left", panel.y);
      drawWinColumn(ctx, negativeWins, "right", panel.y);
      drawModelOneBottomPanel(ctx, effectItems, panel, logo2, options.backgroundColor);
      return canvas;
    }
    const effectIconUrls = Array.from(new Set(effectItems.map((item) => item.effect.imageUrl).filter((url) => Boolean(url))));
    const [logo, interactionSprites, effectIconEntries] = await Promise.all([
      loadOverlayImage("assets/brand/shenpulse-banner-transparent.png"),
      loadOverlayImage(INTERACTION_SPRITES_SRC),
      Promise.all(effectIconUrls.map(async (url) => [url, await loadOverlayImage(url)]))
    ]);
    const assets = {
      effectIcons: new Map(effectIconEntries),
      interactionSprites
    };
    ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
    drawWinColumn(ctx, positiveWins, "left");
    drawWinColumn(ctx, negativeWins, "right");
    drawBottomPanel(ctx, effectItems, logo, assets);
    return canvas;
  }
  async function prepareOverlayItems(mappings = [], giftOptions = []) {
    const activeMappings = mappings.filter((mapping) => mapping.enabled && mapping.commands.length && mappingReady(mapping));
    const items = activeMappings.map((mapping) => {
      const gift = mapping.triggerType === "gift" ? findGiftTriggerOption(mapping.giftTrigger, giftOptions) : null;
      const giftLabel = gift?.name || triggerLabel(mapping);
      const effect = detectOverlayEffect(mapping);
      const badge = {
        colors: gift?.colors?.length ? gift.colors : triggerColors(mapping.triggerType),
        giftImage: null,
        giftImageUrl: String(gift?.imageUrl || "").trim(),
        giftLabel,
        likeAmount: mapping.likeAmount,
        mapping,
        triggerType: mapping.triggerType
      };
      return {
        ...badge,
        actionLabels: [effect.label],
        badges: [badge],
        effect
      };
    });
    const images = await Promise.all(items.map((item) => loadOverlayImage(item.giftImageUrl)));
    return items.map((item, index) => {
      const giftImage = images[index] || null;
      const badge = { ...item.badges[0], giftImage };
      return {
        ...item,
        badges: [badge],
        giftImage
      };
    });
  }
  async function prepareMinecraftStyledOverlayItems(entries) {
    const items = entries.map((entry, index) => {
      const triggerType = entry.triggerType || "gift";
      const giftLabel = String(entry.giftLabel || entry.triggerKey || "Cadeau").trim();
      const triggerKey = String(entry.triggerKey || giftLabel || `${triggerType}-${index}`).trim();
      const mapping = {
        chatCommand: triggerType === "chat" ? triggerKey : "",
        commands: [`shenpulse styled-overlay ${index}`],
        cooldownSeconds: 0,
        enabled: true,
        giftTrigger: triggerType === "gift" ? triggerKey : "none",
        id: `styled-overlay-${index}`,
        interactionPresetId: "",
        interactionPresetParams: {},
        likeAmount: Math.max(0, Math.round(Number(entry.likeAmount) || 0)),
        repeatByGiftCount: false,
        soundName: "",
        soundUrl: "",
        soundVolume: 1,
        title: String(entry.label || "Interaction").trim(),
        triggerType
      };
      const badge = {
        colors: entry.colors?.length ? entry.colors : triggerColors(triggerType),
        giftImage: null,
        giftImageUrl: String(entry.giftImageUrl || "").trim(),
        giftLabel,
        likeAmount: mapping.likeAmount,
        mapping,
        triggerType
      };
      const effectImageUrl = String(entry.effectImageUrl || "").trim();
      const actionLabels = mergeOverlayActionLabels(
        Array.isArray(entry.actionLabels) && entry.actionLabels.length
          ? entry.actionLabels
          : [entry.label]
      );
      const effect = withOverlayImage(detectWinEffect([], mapping.title) || {
        imageUrl: effectImageUrl || void 0,
        kind: "command",
        label: actionLabels[0] || "ACTION"
      }, effectImageUrl);
      return {
        ...badge,
        actionLabels,
        badgeLayout: entry.badgeLayout,
        badges: [badge],
        effect,
        groupKey: String(entry.groupKey || "").trim()
      };
    });
    const images = await Promise.all(items.map((item) => loadOverlayImage(item.giftImageUrl)));
    return items.map((item, index) => {
      const giftImage = images[index] || null;
      const badge = { ...item.badges[0], giftImage };
      return {
        ...item,
        badges: [badge],
        giftImage
      };
    });
  }
  function groupOverlayEffectItems(items) {
    const groups = /* @__PURE__ */ new Map();
    for (const item of items) {
      const key = overlayEffectGroupKey(item);
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { ...item, badges: [...item.badges] });
        continue;
      }
      existing.badges = mergeOverlayBadges([...existing.badges, ...item.badges]);
      existing.actionLabels = mergeOverlayActionLabels([
        ...existing.actionLabels,
        ...item.actionLabels
      ]);
    }
    return Array.from(groups.values());
  }
  function mergeOverlayActionLabels(labels) {
    return Array.from(new Set(labels.map((label) => compactTitle(label, "ACTION"))));
  }
  function overlayEffectGroupKey(item) {
    const explicitGroupKey = String(item.groupKey || "").trim().toLowerCase();
    if (explicitGroupKey) return `styled:${explicitGroupKey}`;
    const commandSignature = item.mapping.commands.map(cleanCommand).filter((command) => {
      const clean = command.toLowerCase();
      return !/^title\s+@a\s+(?:title|subtitle)\b/.test(clean) && !/^delay\s+\d+\b/.test(clean);
    }).map((command) => command.toLowerCase()).join("|");
    return `${item.effect.kind}|${item.effect.label}|${commandSignature || item.mapping.title.toLowerCase()}`;
  }
  function mergeOverlayBadges(badges) {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const badge of badges) {
      const key = overlayBadgeKey(badge);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(badge);
    }
    return result.sort((left, right) => overlayBadgeRank(left) - overlayBadgeRank(right));
  }
  function overlayBadgeKey(badge) {
    if (badge.triggerType === "gift") return `gift:${badge.mapping.giftTrigger}:${badge.giftLabel}`;
    if (badge.triggerType === "likes") return `likes:${badge.likeAmount}`;
    if (badge.triggerType === "chat") return `chat:${badge.mapping.chatCommand}`;
    return badge.triggerType;
  }
  function overlayBadgeRank(badge) {
    if (badge.triggerType === "follow") return 0;
    if (badge.triggerType === "gift") return 1;
    if (badge.triggerType === "likes") return 2;
    if (badge.triggerType === "subscribe") return 3;
    if (badge.triggerType === "share") return 4;
    if (badge.triggerType === "chat") return 5;
    if (badge.triggerType === "join") return 6;
    if (badge.triggerType === "raid") return 7;
    return 8;
  }
  function mappingReady(mapping) {
    if (mapping.triggerType === "gift") return mapping.giftTrigger !== "none";
    if (mapping.triggerType === "likes") return mapping.likeAmount > 0;
    if (mapping.triggerType === "chat") return Boolean(mapping.chatCommand.trim());
    return true;
  }
  function detectOverlayEffect(mapping) {
    const cleanCommands = mapping.commands.map(cleanCommand);
    const commandText = cleanCommands.join("\n");
    const rawText = [mapping.id, mapping.title, commandText].join("\n").toLowerCase();
    const presetImageUrl = overlayPresetImageUrl(mapping.interactionPresetId);
    const winEffect = detectWinEffect(cleanCommands, mapping.title);
    if (winEffect) return withOverlayImage(winEffect, presetImageUrl);
    if (/diamant|diamond/.test(rawText)) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.diamond, kind: "diamond", label: overlayEffectLabel(mapping, "DIAMANT") };
    }
    const sandboxTntNearMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+tntnear\s*(\d+)?/i);
    if (sandboxTntNearMatch) {
      return {
        amount: Number(sandboxTntNearMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.randomTnt,
        kind: "tnt",
        label: sandboxTntNearMatch[1] ? "x" + sandboxTntNearMatch[1] : compactTitle(mapping.title, "TNT NEAR")
      };
    }
    const sandboxTntMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+tnt\s*(\d+)?/i);
    if (sandboxTntMatch) {
      return {
        amount: Number(sandboxTntMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tnt,
        kind: "tnt",
        label: sandboxTntMatch[1] ? "x" + sandboxTntMatch[1] : compactTitle(mapping.title, "TNT")
      };
    }
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+prison\b/i.test(commandText)) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glassPrison, kind: "glass", label: overlayEffectLabel(mapping, "PRISON") };
    }
    const sandboxLightningMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+lightning\s*(\d+)?/i);
    if (sandboxLightningMatch) {
      return {
        amount: Number(sandboxLightningMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fireworks,
        kind: "command",
        label: overlayEffectLabel(mapping, sandboxLightningMatch[1] ? "x" + sandboxLightningMatch[1] + " LIGHTNING" : "LIGHTNING")
      };
    }
    const sandboxFillRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+fillrow\s+[a-z_]+\s*(\d+)?/i);
    if (sandboxFillRowMatch) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, sandboxFillRowMatch[1] ? sandboxFillRowMatch[1] + " RANGEES" : "FILL ROW") };
    }
    const sandboxRandomRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+randomrow\s*(\d+)?/i);
    if (sandboxRandomRowMatch) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, sandboxRandomRowMatch[1] ? sandboxRandomRowMatch[1] + " RANGEES" : "RANDOM ROW") };
    }
    const sandboxSandRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+sandrow\s+[a-z_]+\s*(\d+)?/i);
    if (sandboxSandRowMatch) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, sandboxSandRowMatch[1] ? sandboxSandRowMatch[1] + " RANGEES" : "SAND ROW") };
    }
    const sandboxSandMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+sand\s+[a-z_]+\s*(\d+)?/i);
    if (sandboxSandMatch) {
      return {
        amount: Number(sandboxSandMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill,
        kind: "fill",
        label: sandboxSandMatch[1] ? "x" + sandboxSandMatch[1] : overlayEffectLabel(mapping, "SABLE")
      };
    }
    const sandboxCreateMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+create(?:\s+(\d+)\s+(\d+))?/i);
    if (sandboxCreateMatch) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, sandboxCreateMatch[1] ? sandboxCreateMatch[1] + "x" + sandboxCreateMatch[1] : "CREER") };
    }
    const sandboxTimerMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+timer\s*(\d+)?/i);
    if (sandboxTimerMatch) {
      return { amount: Number(sandboxTimerMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, sandboxTimerMatch[1] ? sandboxTimerMatch[1] + "s TIMER" : "TIMER") };
    }
    const sandboxDeleteRowMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+deleterow\s*(\d+)?/i);
    if (sandboxDeleteRowMatch) {
      return { amount: Number(sandboxDeleteRowMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, sandboxDeleteRowMatch[1] ? "-" + sandboxDeleteRowMatch[1] + " LIGNES" : "RETIRER LIGNES") };
    }
    const sandboxSpeedMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+speed\s*(\d+)?/i);
    if (sandboxSpeedMatch) {
      return { amount: Number(sandboxSpeedMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, sandboxSpeedMatch[1] ? "VITESSE " + sandboxSpeedMatch[1] : "VITESSE") };
    }
    const sandboxRangeMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+set\s+block_interaction_range\s*(\d+)?/i);
    if (sandboxRangeMatch) {
      return { amount: Number(sandboxRangeMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.radiusUp, kind: "blocks", label: overlayEffectLabel(mapping, sandboxRangeMatch[1] ? "PORTEE " + sandboxRangeMatch[1] : "PORTEE") };
    }
    const sandboxBreakSpeedMatch = commandText.match(/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+set\s+block_break_speed\s*(\d+)?/i);
    if (sandboxBreakSpeedMatch) {
      return { amount: Number(sandboxBreakSpeedMatch[1]) || void 0, imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, sandboxBreakSpeedMatch[1] ? "CASSE " + sandboxBreakSpeedMatch[1] : "CASSE") };
    }
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+delete\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, "SUPPRIMER") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+clear\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, "VIDER") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+fill\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, "REMPLIR") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+glass\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glass, kind: "glass", label: overlayEffectLabel(mapping, "VERRE") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+wood\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.wood, kind: "blocks", label: overlayEffectLabel(mapping, "BOIS") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+rock\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.rock, kind: "blocks", label: overlayEffectLabel(mapping, "BEDROCK") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+stop\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, "STOP") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+tp\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tp, kind: "tp", label: overlayEffectLabel(mapping, "TP") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+shovel\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.diamond, kind: "diamond", label: overlayEffectLabel(mapping, "PELLE") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+edit\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.autoReplace, kind: "command", label: overlayEffectLabel(mapping, "EDIT") };
    if (/\b(?:shenpulse_sandbox\s+\S+\s+)?sandbox\s+setdefaultsand\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, "SABLE BASE") };
    const fillBlockMatch = commandText.match(/\bbedrock\s+fillblock\s+(\d+)/i);
    if (fillBlockMatch) {
      return {
        amount: Number(fillBlockMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillBlock,
        kind: "blocks",
        label: "+" + fillBlockMatch[1] + " BLOCS"
      };
    }
    const superTntMatch = commandText.match(/\bbedrock\s+supertnt\s+(\d+)/i);
    if (superTntMatch) {
      return {
        amount: Number(superTntMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.superTnt,
        kind: "super-tnt",
        label: "x" + superTntMatch[1]
      };
    }
    const weakTntMatch = commandText.match(/\bbedrock\s+weaktnt\s*(\d+)?/i);
    if (weakTntMatch) {
      return {
        amount: Number(weakTntMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.weakTnt,
        kind: "tnt",
        label: weakTntMatch[1] ? "x" + weakTntMatch[1] : "WEAK TNT"
      };
    }
    const fakeTntMatch = commandText.match(/\bbedrock\s+faketnt\s*(\d+)?/i);
    if (fakeTntMatch) {
      return {
        amount: Number(fakeTntMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fakeTnt,
        kind: "tnt",
        label: fakeTntMatch[1] ? "x" + fakeTntMatch[1] : "FAKE TNT"
      };
    }
    const tntRocketMatch = commandText.match(/\bbedrock\s+tntrocket\s*(\d+)?/i);
    if (tntRocketMatch) {
      return {
        amount: Number(tntRocketMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tntRocket,
        kind: "super-tnt",
        label: tntRocketMatch[1] ? "x" + tntRocketMatch[1] : "ROCKET"
      };
    }
    const tntStepMatch = commandText.match(/\bbedrock\s+tntstep\s*(\d+)?/i);
    if (tntStepMatch) {
      return {
        amount: Number(tntStepMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tntStep,
        kind: "tnt",
        label: tntStepMatch[1] ? "x" + tntStepMatch[1] : "TNT STEP"
      };
    }
    if (/\bbedrock\s+zeustnt\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.zeusTnt, kind: "super-tnt", label: overlayEffectLabel(mapping, "ZEUS TNT") };
    if (/\bbedrock\s+tntring\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tntRing, kind: "super-tnt", label: overlayEffectLabel(mapping, "TNT RING") };
    if (/\bbedrock\s+enderman\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.enderman, kind: "command", label: overlayEffectLabel(mapping, "ENDERMAN") };
    if (/\bbedrock\s+blackhole\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.blackhole, kind: "command", label: overlayEffectLabel(mapping, "TROU NOIR") };
    if (/\bbedrock\s+meteor\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.meteor, kind: "command", label: overlayEffectLabel(mapping, "METEOR") };
    if (/\bbedrock\s+comets\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.comets, kind: "command", label: overlayEffectLabel(mapping, "COMETES") };
    if (/\bbedrock\s+longhands\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.longhands, kind: "tp", label: overlayEffectLabel(mapping, "LONG HANDS") };
    const randomTntMatch = commandText.match(/\bbedrock\s+randomtnt\s*(\d+)?/i);
    if (randomTntMatch) {
      return {
        amount: Number(randomTntMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.randomTnt,
        kind: "tnt",
        label: randomTntMatch[1] ? "x" + randomTntMatch[1] : compactTitle(mapping.title, "TNT")
      };
    }
    const tntMatch = commandText.match(/\bbedrock\s+tnt\s*(\d+)?/i);
    if (tntMatch) {
      return {
        amount: Number(tntMatch[1]) || void 0,
        imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tnt,
        kind: "tnt",
        label: tntMatch[1] ? "x" + tntMatch[1] : compactTitle(mapping.title, "TNT")
      };
    }
    if (rawText.includes("reset") || commandText.includes("bedrock clear") && commandText.includes("bedrock tp")) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.reset, kind: "reset", label: overlayEffectLabel(mapping, "RESET") };
    }
    const bedrockWinMatch = commandText.match(/\bbedrock\s+win\s+([12])\b/i);
    if (bedrockWinMatch) {
      return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.winBedrock, kind: "win", label: "+" + bedrockWinMatch[1] + " WIN", winTone: "positive" };
    }
    if (/\bbedrock\s+clear\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.clear, kind: "reset", label: overlayEffectLabel(mapping, "VIDER") };
    if (/\bbedrock\s+glass_prison\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glassPrison, kind: "glass", label: overlayEffectLabel(mapping, "PRISON") };
    if (/\bbedrock\s+glass\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.glass, kind: "glass", label: overlayEffectLabel(mapping, "GLASS") };
    if (/\bbedrock\s+rock\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.rock, kind: "blocks", label: overlayEffectLabel(mapping, "BEDROCK") };
    if (/\bbedrock\s+wood\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.wood, kind: "blocks", label: overlayEffectLabel(mapping, "BOIS") };
    if (/\bbedrock\s+timer\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.timer, kind: "timer", label: overlayEffectLabel(mapping, "TIMER") };
    if (/\bbedrock\s+tp\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.tp, kind: "tp", label: overlayEffectLabel(mapping, "TP") };
    if (/\bbedrock\s+toplock\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.topLock, kind: "tp", label: overlayEffectLabel(mapping, "TOP LOCK") };
    if (/\bbedrock\s+autoreplace\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.autoReplace, kind: "command", label: overlayEffectLabel(mapping, "AUTO") };
    if (/\bbedrock\s+fireworks\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fireworks, kind: "command", label: overlayEffectLabel(mapping, "FEUX") };
    if (/\bbedrock\s+heightup\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.heightUp, kind: "blocks", label: overlayEffectLabel(mapping, "HAUTEUR +") };
    if (/\bbedrock\s+heightdown\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.heightDown, kind: "blocks", label: overlayEffectLabel(mapping, "HAUTEUR -") };
    if (/\bbedrock\s+radiusup\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.radiusUp, kind: "blocks", label: overlayEffectLabel(mapping, "RAYON +") };
    if (/\bbedrock\s+radiusdown\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.radiusDown, kind: "blocks", label: overlayEffectLabel(mapping, "RAYON -") };
    if (/\bbedrock\s+fill\s+\d+/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fillRows, kind: "fill", label: overlayEffectLabel(mapping, "RANGEES") };
    if (/\bbedrock\s+fill\b/i.test(commandText)) return { imageUrl: presetImageUrl || INTERACTION_ICON_URLS.fill, kind: "fill", label: overlayEffectLabel(mapping, "TOUT REMPLIR") };
    return { kind: "command", label: compactTitle(mapping.title, "ACTION") };
  }
  function overlayPresetImageUrl(presetId) {
    const byPresetId = {
      "bedrock-auto-replace": INTERACTION_ICON_URLS.autoReplace,
      "bedrock-clear": INTERACTION_ICON_URLS.clear,
      "bedrock-diamond": INTERACTION_ICON_URLS.diamond,
      "bedrock-fake-tnt": INTERACTION_ICON_URLS.fakeTnt,
      "bedrock-fill": INTERACTION_ICON_URLS.fill,
      "bedrock-fill-block": INTERACTION_ICON_URLS.fillBlock,
      "bedrock-fill-rows": INTERACTION_ICON_URLS.fillRows,
      "bedrock-fireworks": INTERACTION_ICON_URLS.fireworks,
      "bedrock-glass": INTERACTION_ICON_URLS.glass,
      "bedrock-glass-prison": INTERACTION_ICON_URLS.glassPrison,
      "bedrock-height-down": INTERACTION_ICON_URLS.heightDown,
      "bedrock-height-up": INTERACTION_ICON_URLS.heightUp,
      "bedrock-longhands": INTERACTION_ICON_URLS.longhands,
      "bedrock-radius-down": INTERACTION_ICON_URLS.radiusDown,
      "bedrock-radius-up": INTERACTION_ICON_URLS.radiusUp,
      "bedrock-random-tnt": INTERACTION_ICON_URLS.randomTnt,
      "bedrock-reset": INTERACTION_ICON_URLS.reset,
      "bedrock-reset-one": INTERACTION_ICON_URLS.reset,
      "bedrock-reset-two": INTERACTION_ICON_URLS.reset,
      "bedrock-rock": INTERACTION_ICON_URLS.rock,
      "bedrock-super-tnt": INTERACTION_ICON_URLS.superTnt,
      "bedrock-timer": INTERACTION_ICON_URLS.timer,
      "bedrock-tnt": INTERACTION_ICON_URLS.tnt,
      "bedrock-tnt-rocket": INTERACTION_ICON_URLS.tntRocket,
      "bedrock-tnt-ring": INTERACTION_ICON_URLS.tntRing,
      "bedrock-tnt-step": INTERACTION_ICON_URLS.tntStep,
      "bedrock-top-lock": INTERACTION_ICON_URLS.topLock,
      "bedrock-tp": INTERACTION_ICON_URLS.tp,
      "bedrock-weak-tnt": INTERACTION_ICON_URLS.weakTnt,
      "bedrock-win-one": INTERACTION_ICON_URLS.winBedrock,
      "bedrock-win-two": INTERACTION_ICON_URLS.winBedrock,
      "bedrock-wood": INTERACTION_ICON_URLS.wood,
      "bedrock-zeus-tnt": INTERACTION_ICON_URLS.zeusTnt,
      ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-sand-${colorId}`, INTERACTION_ICON_URLS.fill])),
      ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-sand-row-${colorId}`, INTERACTION_ICON_URLS.fillRows])),
      ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-fill-row-${colorId}`, INTERACTION_ICON_URLS.fillRows])),
      ...Object.fromEntries(SANDBOX_OVERLAY_COLOR_IDS.map((colorId) => [`sandbox-set-default-sand-${colorId}`, INTERACTION_ICON_URLS.fill])),
      "sandbox-block-break-speed": INTERACTION_ICON_URLS.timer,
      "sandbox-block-interaction-range": INTERACTION_ICON_URLS.radiusUp,
      "sandbox-clear": INTERACTION_ICON_URLS.clear,
      "sandbox-create": INTERACTION_ICON_URLS.fill,
      "sandbox-delete": INTERACTION_ICON_URLS.clear,
      "sandbox-delete-row": INTERACTION_ICON_URLS.clear,
      "sandbox-edit": INTERACTION_ICON_URLS.autoReplace,
      "sandbox-fill": INTERACTION_ICON_URLS.fill,
      "sandbox-glass": INTERACTION_ICON_URLS.glass,
      "sandbox-lightning": INTERACTION_ICON_URLS.fireworks,
      "sandbox-prison": INTERACTION_ICON_URLS.glassPrison,
      "sandbox-random-row": INTERACTION_ICON_URLS.fillRows,
      "sandbox-rock": INTERACTION_ICON_URLS.rock,
      "sandbox-shovel": INTERACTION_ICON_URLS.diamond,
      "sandbox-speed": INTERACTION_ICON_URLS.timer,
      "sandbox-stop": INTERACTION_ICON_URLS.timer,
      "sandbox-timer": INTERACTION_ICON_URLS.timer,
      "sandbox-tnt": INTERACTION_ICON_URLS.tnt,
      "sandbox-tnt-near": INTERACTION_ICON_URLS.randomTnt,
      "sandbox-tp": INTERACTION_ICON_URLS.tp,
      "sandbox-wood": INTERACTION_ICON_URLS.wood,
      "bedrock-blackhole": INTERACTION_ICON_URLS.blackhole,
      "bedrock-comets": INTERACTION_ICON_URLS.comets,
      "bedrock-enderman": INTERACTION_ICON_URLS.enderman,
      "bedrock-meteor": INTERACTION_ICON_URLS.meteor,
      "win-add": INTERACTION_ICON_URLS.winAdd,
      "win-random": INTERACTION_ICON_URLS.winRandom,
      "win-remove": INTERACTION_ICON_URLS.winRemove,
      "win-x2": INTERACTION_ICON_URLS.winX2
    };
    return byPresetId[presetId] || "";
  }
  function withOverlayImage(effect, imageUrl) {
    return imageUrl && !effect.imageUrl ? { ...effect, imageUrl } : effect;
  }
  function detectWinEffect(commands, title) {
    for (const command of commands) {
      const x2Match = command.match(/^shenpulse_win\s+x2\b/i);
      if (x2Match) {
        return {
          kind: "win",
          label: "x2 WINS",
          multiplier: 2,
          winTone: "positive"
        };
      }
      const multiplyMatch = command.match(/^shenpulse_win\s+multiply\s+(-?\d+)/i);
      if (multiplyMatch) {
        const multiplier = Number(multiplyMatch[1]) || 1;
        return {
          kind: "win",
          label: `x${multiplier} WINS`,
          multiplier,
          winTone: multiplier >= 0 ? "positive" : "negative"
        };
      }
      const randomMatch = command.match(/^shenpulse_win\s+random\s+(\d+)/i);
      if (randomMatch) {
        const amount = Math.abs(Number(randomMatch[1]) || 0);
        return {
          amount,
          kind: "win",
          label: `+/- ${amount} WINS`,
          winTone: "random"
        };
      }
      const addMatch = command.match(/^shenpulse_win\s+add\s+(-?\d+)/i);
      if (addMatch) return winAddEffect(Number(addMatch[1]) || 0);
    }
    const x2TitleMatch = String(title || "").match(/\bx\s*2\s*wins?\b/i);
    if (x2TitleMatch) {
      return {
        kind: "win",
        label: "x2 WINS",
        multiplier: 2,
        winTone: "positive"
      };
    }
    const randomTitleMatch = String(title || "").match(/\+\/-\s*(\d+)\s*wins?/i);
    if (randomTitleMatch) {
      const amount = Math.abs(Number(randomTitleMatch[1]) || 0);
      return {
        amount,
        kind: "win",
        label: `+/- ${amount} WINS`,
        winTone: "random"
      };
    }
    const titleMatch = String(title || "").match(/([+-]\s*\d+)\s*wins?/i);
    if (titleMatch) return winAddEffect(Number(titleMatch[1].replace(/\s+/g, "")) || 0);
    return null;
  }
  function winAddEffect(amount) {
    return {
      amount,
      kind: "win",
      label: `${amount > 0 ? "+" : ""}${amount} WIN`,
      winTone: amount < 0 ? "negative" : "positive"
    };
  }
  function cleanCommand(command) {
    return String(command || "").trim().replace(/^\/+/, "").trim().replace(/\s+/g, " ");
  }
  function overlayEffectLabel(mapping, fallback) {
    const title = String(mapping.title || "").trim();
    const userTitle = /^(?:bedrock|sandbox|survival) command$/i.test(title) ? "" : title;
    return compactTitle(userTitle || commandTitleLabel(mapping.commands) || fallback, fallback);
  }
  function commandTitleLabel(commands = []) {
    for (const command of commands) {
      const match = cleanCommand(command).match(/^title\s+@a\s+title\s+"([^"]+)"$/i);
      if (match?.[1]) return match[1];
    }
    return "";
  }
  function compactTitle(title, fallback) {
    return String(title || fallback).trim().replace(/\s+/g, " ").slice(0, 28).toUpperCase();
  }
  function sortWinItems(items) {
    return [...items].sort((left, right) => {
      const leftRank = left.effect.multiplier ? 1e5 + left.effect.multiplier : Math.abs(left.effect.amount || 0);
      const rightRank = right.effect.multiplier ? 1e5 + right.effect.multiplier : Math.abs(right.effect.amount || 0);
      return leftRank - rightRank;
    });
  }
  function modelOneBottomPanelBounds(itemCount) {
    const rows = Math.max(1, Math.ceil(Math.max(1, itemCount) / 6));
    const height = clamp(84 + rows * 158, 300, 900);
    return {
      height,
      width: OVERLAY_WIDTH,
      x: 0,
      y: OVERLAY_HEIGHT - height
    };
  }
  function drawModelOneBottomPanel(ctx, items, panel, logo, backgroundColor = "#082b63") {
    ctx.save();
    const selectedColor = normalizeOverlayBackgroundColor(backgroundColor);
    const background = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.height);
    background.addColorStop(0, mixOverlayColor(selectedColor, "#07152f", 0.24));
    background.addColorStop(0.42, mixOverlayColor(selectedColor, "#020817", 0.5));
    background.addColorStop(1, mixOverlayColor(selectedColor, "#01040d", 0.76));
    ctx.fillStyle = background;
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    const horizontalDepth = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y);
    horizontalDepth.addColorStop(0, "rgba(3, 10, 32, 0.38)");
    horizontalDepth.addColorStop(0.24, "rgba(30, 64, 175, 0.08)");
    horizontalDepth.addColorStop(0.52, "rgba(14, 116, 144, 0.1)");
    horizontalDepth.addColorStop(0.78, "rgba(30, 64, 175, 0.07)");
    horizontalDepth.addColorStop(1, "rgba(3, 10, 32, 0.42)");
    ctx.fillStyle = horizontalDepth;
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    const lowerShade = ctx.createLinearGradient(0, panel.y + panel.height * 0.42, 0, panel.y + panel.height);
    lowerShade.addColorStop(0, "rgba(0, 0, 0, 0)");
    lowerShade.addColorStop(1, "rgba(0, 0, 0, 0.32)");
    ctx.fillStyle = lowerShade;
    ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
    const topRim = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y);
    topRim.addColorStop(0, "rgba(125, 211, 252, 0.04)");
    topRim.addColorStop(0.5, "rgba(125, 211, 252, 0.28)");
    topRim.addColorStop(1, "rgba(125, 211, 252, 0.04)");
    ctx.fillStyle = topRim;
    ctx.fillRect(panel.x, panel.y, panel.width, 2);
    if (items.length) drawModelOneInteractionGrid(ctx, items, panel, logo);
    ctx.restore();
  }
  function drawModelOneBrand(ctx, panel, logo, brandY = panel.y + 7, brandWidth = 238, brandHeight = 46, opacity = 0.58) {
    const brandX = panel.x + (panel.width - brandWidth) / 2;
    ctx.save();
    ctx.globalAlpha = clamp(opacity, 0, 1);
    if (logo) {
      drawImageContain(ctx, logo, brandX, brandY, brandWidth, brandHeight);
    } else {
      drawOutlinedText(ctx, "SHENPULSE", panel.x + panel.width / 2, brandY + 33, {
        align: "center",
        color: "#ffffff",
        fontFamily: FONT_FAMILY,
        fontSize: 27,
        lineWidth: 3,
        maxWidth: brandWidth
      });
    }
    ctx.restore();
  }
  function drawModelOneInteractionGrid(ctx, items, panel, logo) {
    const columns = Math.max(1, Math.min(6, items.length));
    const rows = Math.ceil(items.length / columns);
    const paddingX = 10;
    const paddingTop = 12;
    const paddingBottom = 14;
    const gapX = 8;
    const gapY = 10;
    const cellWidth = (panel.width - paddingX * 2 - gapX * (columns - 1)) / columns;
    const cellHeight = (panel.height - paddingTop - paddingBottom - gapY * (rows - 1)) / rows;
    if (rows >= 2) {
      const firstRowBottom = panel.y + paddingTop + cellHeight;
      const secondRowTop = firstRowBottom + gapY;
      const brandHeight = Math.min(104, cellHeight * 0.62);
      drawModelOneBrand(
        ctx,
        panel,
        logo,
        (firstRowBottom + secondRowTop - brandHeight) / 2,
        Math.min(500, panel.width * 0.48),
        brandHeight,
        0.24
      );
    } else {
      const brandHeight = Math.min(92, cellHeight * 0.58);
      drawModelOneBrand(
        ctx,
        panel,
        logo,
        panel.y + paddingTop + (cellHeight - brandHeight) / 2,
        Math.min(440, panel.width * 0.44),
        brandHeight,
        0.2
      );
    }
    items.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      drawModelOneInteractionCard(
        ctx,
        item,
        panel.x + paddingX + column * (cellWidth + gapX),
        panel.y + paddingTop + row * (cellHeight + gapY),
        cellWidth,
        cellHeight
      );
    });
  }
  function normalizeOverlayBackgroundColor(value) {
    const normalized = String(value || "").trim();
    if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(normalized)) {
      return `#${normalized.slice(1).split("").map((character) => character + character).join("")}`.toLowerCase();
    }
    return "#082b63";
  }
  function mixOverlayColor(source, target, targetWeight) {
    const from = overlayHexToRgb(source);
    const to = overlayHexToRgb(target);
    const weight = clamp(targetWeight, 0, 1);
    const red = Math.round(from.red + (to.red - from.red) * weight);
    const green = Math.round(from.green + (to.green - from.green) * weight);
    const blue = Math.round(from.blue + (to.blue - from.blue) * weight);
    return `rgb(${red}, ${green}, ${blue})`;
  }
  function overlayHexToRgb(value) {
    const normalized = normalizeOverlayBackgroundColor(value).slice(1);
    return {
      red: Number.parseInt(normalized.slice(0, 2), 16),
      green: Number.parseInt(normalized.slice(2, 4), 16),
      blue: Number.parseInt(normalized.slice(4, 6), 16)
    };
  }
  function drawModelOneInteractionCard(ctx, item, x, y, width, height) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
    roundedRect(ctx, x, y, width, height, Math.min(7, height * 0.08));
    const tile = ctx.createLinearGradient(x, y, x, y + height);
    tile.addColorStop(0, "rgba(3, 17, 47, 0.38)");
    tile.addColorStop(0.55, "rgba(1, 11, 33, 0.28)");
    tile.addColorStop(1, "rgba(0, 5, 21, 0.46)");
    ctx.fillStyle = tile;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.055)";
    ctx.stroke();
    const actionLines = overlayActionTextLines(item);
    const badges = mergeOverlayBadges(item.badges).slice(0, 6);
    const badgeHeightRatio = actionLines.length > 2 ? 0.4 : 0.5;
    const badgeWidthRatio = badges.length > 1 ? 0.9 / badges.length : 0.46;
    const badgeSize = clamp(Math.min(height * badgeHeightRatio, width * badgeWidthRatio), 18, 78);
    const badgeGap = Math.max(3, badgeSize * 0.06);
    const badgesWidth = badges.length * badgeSize + Math.max(0, badges.length - 1) * badgeGap;
    const badgeStartX = x + (width - badgesWidth) / 2;
    const badgeY = y + clamp(height * 0.05, 4, 9);
    badges.forEach((badge, badgeIndex) => {
      drawTriggerBadge(ctx, badge, badgeStartX + badgeIndex * (badgeSize + badgeGap), badgeY, badgeSize);
    });
    drawOverlayActionLines(
      ctx,
      actionLines,
      x + width / 2,
      y + height - clamp(height * 0.09, 7, 13),
      width - 8,
      {
        cardHeight: height,
        fontFamily: FONT_FAMILY,
        lineWidthRatio: 0.18,
        maxFontSize: 22
      }
    );
    ctx.restore();
  }
  function overlayActionTextLines(item) {
    const labels = mergeOverlayActionLabels(
      item.actionLabels?.length ? item.actionLabels : [item.effect.label]
    );
    const firstWords = String(labels[0] || "ACTION").split(" ").filter(Boolean);
    const primary = firstWords.shift() || "ACTION";
    const secondary = firstWords.join(" ");
    if (labels.length === 1) {
      return [
        { color: "#ff354d", label: primary },
        ...(secondary ? [{ color: "#ffffff", label: secondary }] : [])
      ];
    }
    if (labels.length === 2 && secondary) {
      return [
        { color: "#ff354d", label: primary },
        { color: "#ffffff", label: secondary },
        { color: "#f4da3d", label: labels[1] }
      ];
    }
    const visibleLabels = labels.length <= 3
      ? labels
      : [...labels.slice(0, 2), `ET ${labels.length - 2} AUTRES ACTIONS`];
    return visibleLabels.map((label, index) => ({
      color: index === 1 ? "#ffffff" : index === 2
        ? "#f4da3d"
        : "#ff354d",
      label
    }));
  }
  function drawOverlayActionLines(ctx, lines, x, baselineY, maxWidth, options) {
    const lineCount = Math.max(1, lines.length);
    let fontSize = clamp(
      Math.min(options.cardHeight * 0.145, options.cardHeight * 0.42 / lineCount),
      9,
      options.maxFontSize
    );
    while (
      lines.some((line) =>
        measureText(ctx, line.label, fontSize, options.fontFamily) > maxWidth
      ) && fontSize > 9
    ) {
      fontSize -= 1;
    }
    const lineHeight = fontSize * 1.12;
    const startY = baselineY - (lineCount - 1) * lineHeight;
    lines.forEach((line, index) => {
      drawOutlinedText(ctx, line.label, x, startY + index * lineHeight, {
        align: "center",
        color: line.color,
        fontFamily: options.fontFamily,
        fontSize,
        lineWidth: clamp(fontSize * options.lineWidthRatio, 2.5, 5),
        maxWidth
      });
    });
  }
  function drawBottomPanel(ctx, items, logo, assets) {
    ctx.save();
    const gradient = ctx.createLinearGradient(0, BOTTOM_PANEL.y, 0, BOTTOM_PANEL.y + BOTTOM_PANEL.height);
    gradient.addColorStop(0, "#072a47");
    gradient.addColorStop(0.48, "#041f39");
    gradient.addColorStop(1, "#02172a");
    roundedRect(ctx, BOTTOM_PANEL.x, BOTTOM_PANEL.y, BOTTOM_PANEL.width, BOTTOM_PANEL.height, BOTTOM_PANEL.radius);
    ctx.fillStyle = gradient;
    ctx.fill();
    const centerGlow = ctx.createRadialGradient(
      OVERLAY_WIDTH / 2,
      BOTTOM_PANEL.y + BOTTOM_PANEL.height * 0.46,
      80,
      OVERLAY_WIDTH / 2,
      BOTTOM_PANEL.y + BOTTOM_PANEL.height * 0.48,
      520
    );
    centerGlow.addColorStop(0, "rgba(22, 212, 229, 0.18)");
    centerGlow.addColorStop(0.46, "rgba(14, 116, 144, 0.08)");
    centerGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
    ctx.fillStyle = centerGlow;
    ctx.fillRect(BOTTOM_PANEL.x, BOTTOM_PANEL.y, BOTTOM_PANEL.width, BOTTOM_PANEL.height);
    const topSheen = ctx.createLinearGradient(0, BOTTOM_PANEL.y, 0, BOTTOM_PANEL.y + 72);
    topSheen.addColorStop(0, "rgba(255, 255, 255, 0.1)");
    topSheen.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = topSheen;
    ctx.fillRect(BOTTOM_PANEL.x + 8, BOTTOM_PANEL.y + 8, BOTTOM_PANEL.width - 16, 72);
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();
    ctx.globalAlpha = 0.82;
    if (logo) {
      const logoWidth = 610;
      const logoHeight = logoWidth / (logo.naturalWidth / logo.naturalHeight);
      drawImageContain(
        ctx,
        logo,
        (OVERLAY_WIDTH - logoWidth) / 2,
        BOTTOM_PANEL.y + BOTTOM_PANEL.height / 2 - logoHeight / 2 + 8,
        logoWidth,
        logoHeight
      );
    } else {
      drawOutlinedText(ctx, "SHENPULSE", OVERLAY_WIDTH / 2, BOTTOM_PANEL.y + BOTTOM_PANEL.height / 2 + 18, {
        align: "center",
        color: "#ffffff",
        fontSize: 78,
        lineWidth: 8
      });
    }
    ctx.globalAlpha = 1;
    drawEffectGrid(ctx, items, assets);
    ctx.restore();
  }
  function drawEffectGrid(ctx, items, assets) {
    if (!items.length) return;
    const count = items.length;
    const columns = count <= 5 ? count : count <= 15 ? 5 : Math.min(8, Math.ceil(Math.sqrt(count * 1.7)));
    const rows = Math.ceil(count / columns);
    const gridX = BOTTOM_PANEL.x + BOTTOM_PANEL.padding;
    const gridY = BOTTOM_PANEL.y + 34;
    const gridWidth = BOTTOM_PANEL.width - BOTTOM_PANEL.padding * 2;
    const gridHeight = BOTTOM_PANEL.height - 58;
    const cellWidth = gridWidth / columns;
    const cellHeight = gridHeight / rows;
    const cardWidth = Math.min(cellWidth * 0.86, 170);
    const cardHeight = Math.min(cellHeight * 0.94, rows >= 3 ? 118 : 136);
    items.forEach((item, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      drawEffectCard(
        ctx,
        item,
        gridX + column * cellWidth + (cellWidth - cardWidth) / 2,
        gridY + row * cellHeight + (cellHeight - cardHeight) / 2,
        cardWidth,
        cardHeight,
        assets
      );
    });
  }
  function drawEffectCard(ctx, item, x, y, width, height, assets) {
    ctx.save();
    drawInteractionTile(ctx, x, y, width, height);
    const iconSize = clamp(Math.min(width * 0.92, height * 0.82), 58, 126);
    const giftSize = clamp(Math.min(width, height) * 0.43, 38, 64);
    const centerX = x + width / 2;
    const centerY = y + height * 0.4;
    drawSoftGroundShadow(ctx, centerX, y + height * 0.72, iconSize * 0.92, iconSize * 0.18);
    drawEffectIcon(ctx, item.effect, centerX, centerY, iconSize, assets);
    drawTriggerBadges(ctx, item.badges, x, y, width, height, giftSize, item.badgeLayout);
    drawOverlayActionLines(ctx, overlayActionTextLines(item), centerX, y + height - clamp(height * 0.08, 8, 18), width - 4, {
      cardHeight: height,
      fontFamily: MINECRAFT_FONT_FAMILY,
      lineWidthRatio: 0.2,
      maxFontSize: clamp(Math.min(width * 0.19, height * 0.24), 16, 34)
    });
    ctx.restore();
  }
  function drawInteractionTile(ctx, x, y, width, height) {
    ctx.save();
    const radius = Math.min(10, height * 0.13);
    ctx.shadowColor = "rgba(0, 0, 0, 0.54)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 10;
    roundedRect(ctx, x, y, width, height, radius);
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    gradient.addColorStop(0, "rgba(9, 45, 73, 0.72)");
    gradient.addColorStop(0.42, "rgba(4, 28, 50, 0.62)");
    gradient.addColorStop(1, "rgba(1, 13, 26, 0.76)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const rim = ctx.createLinearGradient(x, y, x, y + height);
    rim.addColorStop(0, "rgba(125, 211, 252, 0.22)");
    rim.addColorStop(0.5, "rgba(14, 116, 144, 0.08)");
    rim.addColorStop(1, "rgba(0, 0, 0, 0.32)");
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = rim;
    ctx.stroke();
    roundedRect(ctx, x + 3, y + 3, width - 6, height - 6, Math.max(5, radius - 2));
    ctx.clip();
    const shine = ctx.createRadialGradient(x + width * 0.5, y, 0, x + width * 0.5, y, width * 0.72);
    shine.addColorStop(0, "rgba(255, 255, 255, 0.08)");
    shine.addColorStop(0.42, "rgba(56, 189, 248, 0.05)");
    shine.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shine;
    ctx.fillRect(x, y, width, height);
    const lowerShade = ctx.createLinearGradient(x, y + height * 0.45, x, y + height);
    lowerShade.addColorStop(0, "rgba(0, 0, 0, 0)");
    lowerShade.addColorStop(1, "rgba(0, 0, 0, 0.22)");
    ctx.fillStyle = lowerShade;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  }
  function drawWinColumn(ctx, items, side, panelTop = BOTTOM_PANEL.y) {
    if (!items.length) return;
    const availableTop = 650;
    const availableBottom = panelTop - 112;
    const availableHeight = availableBottom - availableTop;
    const itemHeight = clamp(availableHeight / items.length, 92, 142);
    const totalHeight = itemHeight * items.length;
    const startY = availableTop + Math.max(0, (availableHeight - totalHeight) / 2);
    const centerX = side === "left" ? 94 : OVERLAY_WIDTH - 94;
    items.forEach((item, index) => {
      const y = startY + index * itemHeight;
      const imageSize = clamp(itemHeight * 0.62, 62, 94);
      const imageX = centerX - imageSize / 2;
      const textY = y + imageSize + clamp(itemHeight * 0.17, 16, 25);
      drawTriggerBadge(ctx, item, imageX, y, imageSize);
      drawCompactWinText(ctx, item.effect.label, centerX, textY, {
        color: winTextColor(item.effect),
        fontFamily: MINECRAFT_FONT_FAMILY,
        fontSize: clamp(itemHeight * 0.24, 28, 36),
        lineWidth: 7,
        maxWidth: 188
      });
    });
  }
  function drawCompactWinText(ctx, label, x, y, options) {
    const match = String(label || "").trim().match(/^(.+?)\s+(WINS?)$/i);
    if (!match) {
      drawOutlinedText(ctx, label, x, y, {
        align: "center",
        color: options.color,
        fontFamily: options.fontFamily,
        fontSize: options.fontSize,
        lineWidth: options.lineWidth,
        maxWidth: options.maxWidth
      });
      return;
    }
    const value = match[1].trim();
    const suffix = match[2].toUpperCase();
    let fontSize = options.fontSize;
    let gap = compactWinTextGap(fontSize);
    while (measureText(ctx, value, fontSize, options.fontFamily) + gap + measureText(ctx, suffix, fontSize, options.fontFamily) > options.maxWidth && fontSize > 18) {
      fontSize -= 1;
      gap = compactWinTextGap(fontSize);
    }
    const valueWidth = measureText(ctx, value, fontSize, options.fontFamily);
    const suffixWidth = measureText(ctx, suffix, fontSize, options.fontFamily);
    const startX = x - (valueWidth + gap + suffixWidth) / 2;
    drawOutlinedText(ctx, value, startX, y, {
      align: "left",
      color: options.color,
      fontFamily: options.fontFamily,
      fontSize,
      lineWidth: options.lineWidth
    });
    drawOutlinedText(ctx, suffix, startX + valueWidth + gap, y, {
      align: "left",
      color: options.color,
      fontFamily: options.fontFamily,
      fontSize,
      lineWidth: options.lineWidth
    });
  }
  function compactWinTextGap(fontSize) {
    return clamp(fontSize * 0.12, 3, 5);
  }
  function winTextColor(effect) {
    if (effect.winTone === "negative") return "#ff1f16";
    if (effect.winTone === "random") return "#ffffff";
    if (effect.multiplier) return "#f5ff21";
    return "#0a82ff";
  }
  function drawTriggerBadges(ctx, badges, x, y, width, height, size, layout = "corners") {
    const orderedBadges = mergeOverlayBadges(badges).slice(0, 6);
    if (!orderedBadges.length) return;
    if (layout === "top-row" && orderedBadges.length > 1) {
      const gap = Math.max(2, size * 0.06);
      const availableWidth = width - 4;
      const badgeSize = Math.min(size * 0.82, (availableWidth - gap * (orderedBadges.length - 1)) / orderedBadges.length);
      const rowWidth = badgeSize * orderedBadges.length + gap * (orderedBadges.length - 1);
      const startX = x + (width - rowWidth) / 2;
      const badgeY = y - badgeSize * 0.14;
      orderedBadges.forEach((badge, index) => {
        drawTriggerBadge(ctx, badge, startX + index * (badgeSize + gap), badgeY, badgeSize);
      });
      return;
    }
    const singlePosition = [
      [x + width - size * 0.78, y - size * 0.12]
    ];
    const multiPositions = [
      [x - size * 0.08, y - size * 0.1],
      [x + width - size * 0.78, y - size * 0.12],
      [x + width - size * 0.72, y + height - size * 0.72],
      [x - size * 0.06, y + height - size * 0.7],
      [x + width * 0.5 - size / 2, y - size * 0.18],
      [x + width * 0.5 - size / 2, y + height - size * 0.64]
    ];
    const positions = orderedBadges.length === 1 ? singlePosition : multiPositions;
    orderedBadges.forEach((badge, index) => {
      const [badgeX, badgeY] = positions[index] || positions[positions.length - 1];
      drawTriggerBadge(ctx, badge, badgeX, badgeY, size);
    });
  }
  function drawTriggerBadge(ctx, badge, x, y, size) {
    if (badge.triggerType === "follow") {
      drawFollowBadge(ctx, x, y, size);
      return;
    }
    if (badge.triggerType === "likes") {
      drawLikesBadge(ctx, x, y, size, badge.likeAmount);
      return;
    }
    if (badge.triggerType === "share") {
      drawSymbolBadge(ctx, x, y, size, "#8b5cf6", "#38bdf8", ">");
      return;
    }
    if (badge.triggerType === "subscribe") {
      drawSymbolBadge(ctx, x, y, size, "#f59e0b", "#fb7185", "*");
      return;
    }
    if (badge.triggerType === "chat") {
      drawSymbolBadge(ctx, x, y, size, "#38bdf8", "#0f172a", "#");
      return;
    }
    if (badge.triggerType === "join") {
      drawSymbolBadge(ctx, x, y, size, "#14b8a6", "#164e63", "+");
      return;
    }
    if (badge.triggerType === "raid") {
      drawSymbolBadge(ctx, x, y, size, "#f97316", "#7c2d12", "!");
      return;
    }
    drawGiftBadge(ctx, badge, x, y, size);
  }
  function drawFollowBadge(ctx, x, y, size) {
    ctx.save();
    const cx = x + size / 2;
    const cy = y + size / 2;
    ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
    ctx.shadowBlur = size * 0.24;
    ctx.shadowOffsetY = size * 0.1;
    const gradient = ctx.createRadialGradient(cx - size * 0.18, cy - size * 0.2, size * 0.08, cx, cy, size * 0.62);
    gradient.addColorStop(0, "#ff4860");
    gradient.addColorStop(0.62, "#ff1f3d");
    gradient.addColorStop(1, "#9f1026");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(3, size * 0.085);
    ctx.strokeStyle = "#020617";
    ctx.stroke();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(4, size * 0.11);
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.2, cy);
    ctx.lineTo(cx + size * 0.2, cy);
    ctx.moveTo(cx, cy - size * 0.2);
    ctx.lineTo(cx, cy + size * 0.2);
    ctx.stroke();
    ctx.restore();
  }
  function drawLikesBadge(ctx, x, y, size, amount) {
    ctx.save();
    const cx = x + size * 0.46;
    const cy = y + size * 0.42;
    ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.1;
    ctx.fillStyle = "#f43f5e";
    ctx.strokeStyle = "#020617";
    ctx.lineWidth = Math.max(3, size * 0.075);
    drawHeartPath(ctx, cx, cy, size * 0.74);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    drawOutlinedText(ctx, `x${formatCompactCount(amount)}`, x + size * 0.54, y + size * 0.92, {
      align: "center",
      color: "#ffffff",
      fontFamily: MINECRAFT_FONT_FAMILY,
      fontSize: clamp(size * 0.18, 9, 15),
      lineWidth: Math.max(3, size * 0.05),
      maxWidth: size * 0.96
    });
    ctx.restore();
  }
  function drawSymbolBadge(ctx, x, y, size, colorA, colorB, symbol) {
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.1;
    roundedRect(ctx, x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84, size * 0.18);
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(1, colorB);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(3, size * 0.075);
    ctx.strokeStyle = "#020617";
    ctx.stroke();
    drawOutlinedText(ctx, symbol, x + size / 2, y + size * 0.66, {
      align: "center",
      color: "#ffffff",
      fontFamily: MINECRAFT_FONT_FAMILY,
      fontSize: size * 0.36,
      lineWidth: size * 0.07
    });
    ctx.restore();
  }
  function drawHeartPath(ctx, cx, cy, size) {
    const top = cy - size * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx, cy + size * 0.36);
    ctx.bezierCurveTo(cx - size * 0.58, top + size * 0.2, cx - size * 0.38, top - size * 0.26, cx - size * 0.1, top);
    ctx.bezierCurveTo(cx, top + size * 0.06, cx, top + size * 0.06, cx + size * 0.1, top);
    ctx.bezierCurveTo(cx + size * 0.38, top - size * 0.26, cx + size * 0.58, top + size * 0.2, cx, cy + size * 0.36);
    ctx.closePath();
  }
  function drawGiftBadge(ctx, item, x, y, size) {
    ctx.save();
    if (item.giftImage) {
      drawImageContainWithOutline(ctx, item.giftImage, x, y, size, size, {
        outlineColor: "#020617",
        outlineSize: Math.max(3, size * 0.085),
        shadowBlur: size * 0.22,
        shadowColor: "rgba(0, 0, 0, 0.58)",
        shadowOffsetY: size * 0.1
      });
    } else {
      const colors = item.colors.length >= 2 ? item.colors : ["#14b8a6", "#0f172a"];
      const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
      gradient.addColorStop(0, colors[0]);
      gradient.addColorStop(1, colors[1]);
      roundedRect(ctx, x, y, size, size, Math.max(6, size * 0.18));
      ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
      ctx.shadowBlur = size * 0.2;
      ctx.shadowOffsetY = size * 0.1;
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = Math.max(3, size * 0.085);
      ctx.strokeStyle = "#020617";
      ctx.stroke();
      drawOutlinedText(ctx, initials(item.giftLabel), x + size / 2, y + size * 0.65, {
        align: "center",
        color: "#ffffff",
        fontSize: size * 0.42,
        lineWidth: size * 0.08
      });
    }
    ctx.restore();
  }
  function drawEffectIcon(ctx, effect, cx, cy, size, assets) {
    const effectImage = effect.imageUrl ? assets.effectIcons.get(effect.imageUrl) : null;
    if (effectImage) {
      drawEffectImage(ctx, effectImage, cx, cy, size * 1.28);
      return;
    }
    const spriteCell = INTERACTION_SPRITE_CELLS[effect.kind];
    if (assets.interactionSprites && spriteCell) {
      const scale = effect.kind === "tnt" || effect.kind === "super-tnt" ? 1.3 : 1.18;
      drawInteractionSprite(ctx, assets.interactionSprites, spriteCell, cx, cy, size * scale);
      return;
    }
    if (effect.kind === "tnt" || effect.kind === "super-tnt") {
      drawTntCluster(ctx, cx, cy, size, effect.amount || 1, effect.kind === "super-tnt");
      return;
    }
    if (effect.kind === "blocks" || effect.kind === "fill") {
      drawBlockStack(ctx, cx, cy, size, effect.kind === "fill" ? "#4ade80" : "#d92517");
      return;
    }
    if (effect.kind === "diamond") {
      drawBlockStack(ctx, cx, cy, size, "#5eead4");
      return;
    }
    if (effect.kind === "reset") {
      drawResetIcon(ctx, cx, cy, size);
      return;
    }
    if (effect.kind === "glass") {
      drawGlassIcon(ctx, cx, cy, size);
      return;
    }
    if (effect.kind === "timer") {
      drawTimerIcon(ctx, cx, cy, size);
      return;
    }
    if (effect.kind === "tp") {
      drawPortalIcon(ctx, cx, cy, size);
      return;
    }
    drawCommandIcon(ctx, cx, cy, size);
  }
  function drawEffectImage(ctx, image, cx, cy, size) {
    const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
    const drawWidth = ratio >= 1 ? size : size * ratio;
    const drawHeight = ratio >= 1 ? size / ratio : size;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.54)";
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.08;
    ctx.drawImage(image, cx - drawWidth / 2, cy - drawHeight / 2, drawWidth, drawHeight);
    ctx.restore();
  }
  function drawInteractionSprite(ctx, image, cell, cx, cy, size) {
    const sourceWidth = image.naturalWidth / INTERACTION_SPRITE_COLUMNS;
    const sourceHeight = image.naturalHeight / INTERACTION_SPRITE_ROWS;
    const drawSize = Math.min(size, sourceWidth, sourceHeight);
    const sourceX = cell[0] * sourceWidth;
    const sourceY = cell[1] * sourceHeight;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
    ctx.shadowBlur = drawSize * 0.16;
    ctx.shadowOffsetY = drawSize * 0.08;
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      cx - drawSize / 2,
      cy - drawSize / 2,
      drawSize,
      drawSize
    );
    ctx.restore();
  }
  function drawTntCluster(ctx, cx, cy, size, amount, superTnt) {
    const blockCount = tntBlockCount(amount);
    const blockSize = blockCount === 1 ? size * 0.9 : blockCount <= 3 ? size * 0.66 : size * 0.56;
    const offsets = tntClusterOffsets(blockCount, blockSize);
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
    ctx.shadowBlur = size * 0.16;
    ctx.shadowOffsetY = size * 0.08;
    offsets.forEach(([offsetX, offsetY], index) => {
      drawMinecraftTntBlock(ctx, cx + offsetX, cy + offsetY, blockSize, {
        highlight: index === offsets.length - 1,
        superTnt
      });
    });
    ctx.restore();
  }
  function tntBlockCount(amount) {
    if (amount >= 300) return 5;
    if (amount >= 80) return 4;
    if (amount >= 20) return 3;
    if (amount >= 3) return 2;
    return 1;
  }
  function tntClusterOffsets(count, size) {
    if (count <= 1) return [[0, 0]];
    if (count === 2) return [[-size * 0.26, size * 0.1], [size * 0.26, -size * 0.06]];
    if (count === 3) return [[-size * 0.34, size * 0.14], [size * 0.32, size * 0.12], [0, -size * 0.2]];
    if (count === 4) return [[-size * 0.36, size * 0.2], [size * 0.32, size * 0.18], [-size * 0.05, -size * 0.14], [size * 0.48, -size * 0.2]];
    return [[-size * 0.48, size * 0.24], [size * 0.12, size * 0.24], [size * 0.52, size * 0.02], [-size * 0.18, -size * 0.18], [size * 0.36, -size * 0.24]];
  }
  function drawMinecraftTntBlock(ctx, cx, cy, size, options = {}) {
    const frontWidth = size * 0.96;
    const frontHeight = size * 0.7;
    const depthX = size * 0.22;
    const depthY = size * 0.22;
    const x = cx - frontWidth / 2 - depthX * 0.16;
    const y = cy - frontHeight / 2 + depthY * 0.36;
    const red = options.superTnt ? "#e94724" : "#d7271e";
    const redDark = options.superTnt ? "#7c150f" : "#81110e";
    const redLight = options.superTnt ? "#ff743d" : "#f14a32";
    const outline = "#120304";
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2.2, size * 0.04);
    ctx.strokeStyle = outline;
    const topGradient = ctx.createLinearGradient(x, y - depthY, x + frontWidth, y);
    topGradient.addColorStop(0, redLight);
    topGradient.addColorStop(0.45, "#ff8a45");
    topGradient.addColorStop(1, "#b91c1c");
    ctx.fillStyle = topGradient;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + depthX, y - depthY);
    ctx.lineTo(x + frontWidth + depthX, y - depthY);
    ctx.lineTo(x + frontWidth, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    drawTntTopPixels(ctx, x, y, frontWidth, depthX, depthY);
    const sideGradient = ctx.createLinearGradient(x + frontWidth, y, x + frontWidth + depthX, y + frontHeight);
    sideGradient.addColorStop(0, "#a51d15");
    sideGradient.addColorStop(1, redDark);
    ctx.fillStyle = sideGradient;
    ctx.beginPath();
    ctx.moveTo(x + frontWidth, y);
    ctx.lineTo(x + frontWidth + depthX, y - depthY);
    ctx.lineTo(x + frontWidth + depthX, y + frontHeight - depthY);
    ctx.lineTo(x + frontWidth, y + frontHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const frontGradient = ctx.createLinearGradient(x, y, x, y + frontHeight);
    frontGradient.addColorStop(0, redLight);
    frontGradient.addColorStop(0.22, red);
    frontGradient.addColorStop(1, redDark);
    ctx.fillStyle = frontGradient;
    ctx.fillRect(x, y, frontWidth, frontHeight);
    ctx.strokeRect(x, y, frontWidth, frontHeight);
    drawTntPixels(ctx, x, y, frontWidth, frontHeight, depthX, depthY, options.superTnt === true);
    const bandHeight = frontHeight * 0.31;
    const bandY = y + frontHeight * 0.36;
    const bandX = x + frontWidth * 0.06;
    const bandWidth = frontWidth * 0.88;
    ctx.fillStyle = "#f5f1e8";
    ctx.fillRect(bandX, bandY, bandWidth, bandHeight);
    ctx.fillStyle = "rgba(203, 213, 225, 0.7)";
    ctx.fillRect(bandX, bandY + bandHeight * 0.62, bandWidth, bandHeight * 0.18);
    ctx.strokeStyle = "#18181b";
    ctx.lineWidth = Math.max(1.4, size * 0.022);
    ctx.strokeRect(bandX, bandY, bandWidth, bandHeight);
    drawOutlinedText(ctx, options.superTnt ? "TNT+" : "TNT", x + frontWidth / 2, bandY + bandHeight * 0.76, {
      align: "center",
      color: "#111111",
      fontSize: size * 0.24,
      lineWidth: size * 0.018,
      stroke: "#ffffff"
    });
    if (options.highlight) {
      ctx.globalAlpha = 0.24;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x + frontWidth * 0.08, y + frontHeight * 0.08, frontWidth * 0.18, frontHeight * 0.2);
    }
    ctx.restore();
  }
  function drawTntTopPixels(ctx, x, y, width, depthX, depthY) {
    ctx.save();
    ctx.lineWidth = Math.max(1, width * 0.018);
    ctx.strokeStyle = "rgba(35, 5, 5, 0.78)";
    for (let index = 0; index < 6; index += 1) {
      const stripeX = x + width * (0.12 + index * 0.145);
      ctx.beginPath();
      ctx.moveTo(stripeX, y - depthY * 0.1);
      ctx.lineTo(stripeX + depthX * 0.36, y - depthY * 0.72);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 220, 150, 0.32)";
    ctx.fillRect(x + width * 0.18, y - depthY * 0.56, width * 0.16, depthY * 0.2);
    ctx.restore();
  }
  function drawTntPixels(ctx, x, y, width, height, depthX, depthY, superTnt) {
    const pixel = Math.max(2, width * 0.052);
    const light = superTnt ? "#ffb169" : "#ff765e";
    const dark = "#4c0908";
    ctx.fillStyle = light;
    for (let index = 0; index < 5; index += 1) {
      ctx.fillRect(x + width * (0.1 + index * 0.18), y + height * 0.1, pixel, pixel * 1.6);
    }
    ctx.fillStyle = dark;
    for (let index = 0; index < 4; index += 1) {
      ctx.fillRect(x + width * (0.17 + index * 0.19), y + height * 0.23, pixel * 0.85, pixel * 1.35);
      ctx.fillRect(x + width + depthX * 0.35, y + height * (0.15 + index * 0.15) - depthY * 0.35, pixel * 0.78, pixel * 1.3);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(x + width * 0.06, y + height * 0.05, width * 0.12, height * 0.18);
  }
  function drawBlockStack(ctx, cx, cy, size, color) {
    drawCube(ctx, cx - size * 0.16, cy + size * 0.12, size * 0.62, color);
    drawCube(ctx, cx + size * 0.16, cy - size * 0.1, size * 0.62, color);
  }
  function drawCube(ctx, cx, cy, size, color) {
    const half = size / 2;
    const depth = size * 0.22;
    const x = cx - half;
    const y = cy - half;
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.06;
    ctx.fillStyle = shadeColor(color, 18);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + depth, y - depth);
    ctx.lineTo(x + size + depth, y - depth);
    ctx.lineTo(x + size, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shadeColor(color, -18);
    ctx.beginPath();
    ctx.moveTo(x + size, y);
    ctx.lineTo(x + size + depth, y - depth);
    ctx.lineTo(x + size + depth, y + size - depth);
    ctx.lineTo(x + size, y + size);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
    ctx.lineWidth = size * 0.035;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.62)";
    ctx.strokeRect(x, y, size, size);
    ctx.restore();
  }
  function drawResetIcon(ctx, cx, cy, size) {
    drawCube(ctx, cx, cy, size * 0.76, "#f8fafc");
    drawOutlinedText(ctx, "?", cx, cy + size * 0.18, {
      align: "center",
      color: "#111827",
      fontSize: size * 0.5,
      lineWidth: size * 0.06,
      stroke: "#ffffff"
    });
    ctx.save();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = size * 0.07;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.5, -0.8, 1.65);
    ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.48, cy + size * 0.23);
    ctx.lineTo(cx + size * 0.62, cy + size * 0.38);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.43);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawGlassIcon(ctx, cx, cy, size) {
    ctx.save();
    ctx.globalAlpha = 0.82;
    drawCube(ctx, cx, cy, size * 0.82, "#7dd3fc");
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.24, cy + size * 0.23);
    ctx.lineTo(cx + size * 0.26, cy - size * 0.28);
    ctx.stroke();
    ctx.restore();
  }
  function drawTimerIcon(ctx, cx, cy, size) {
    ctx.save();
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = size * 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = size * 0.055;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - size * 0.25);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + size * 0.2, cy + size * 0.14);
    ctx.stroke();
    ctx.restore();
  }
  function drawPortalIcon(ctx, cx, cy, size) {
    ctx.save();
    const gradient = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.5);
    gradient.addColorStop(0, "#67e8f9");
    gradient.addColorStop(0.46, "#a855f7");
    gradient.addColorStop(1, "#312e81");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, size * 0.4, size * 0.5, -0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#e9d5ff";
    ctx.lineWidth = size * 0.05;
    ctx.stroke();
    ctx.restore();
  }
  function drawCommandIcon(ctx, cx, cy, size) {
    drawCube(ctx, cx, cy, size * 0.78, "#f59e0b");
    drawOutlinedText(ctx, "/", cx, cy + size * 0.19, {
      align: "center",
      color: "#fff7ed",
      fontSize: size * 0.54,
      lineWidth: size * 0.07
    });
  }
  function drawSoftGroundShadow(ctx, cx, cy, width, height) {
    ctx.save();
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.36)");
    gradient.addColorStop(0.68, "rgba(0, 0, 0, 0.16)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function drawImageContainWithOutline(ctx, image, x, y, width, height, options) {
    const rect = containImageRect(image, x, y, width, height);
    const offsets = outlineOffsets(options.outlineSize);
    ctx.save();
    ctx.shadowColor = options.shadowColor;
    ctx.shadowBlur = options.shadowBlur;
    ctx.shadowOffsetY = options.shadowOffsetY;
    ctx.filter = "brightness(0)";
    ctx.globalAlpha = 0.96;
    for (const [offsetX, offsetY] of offsets) {
      ctx.drawImage(image, rect.x + offsetX, rect.y + offsetY, rect.width, rect.height);
    }
    ctx.restore();
    ctx.save();
    ctx.shadowColor = options.shadowColor;
    ctx.shadowBlur = options.shadowBlur * 0.55;
    ctx.shadowOffsetY = options.shadowOffsetY * 0.7;
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }
  function outlineOffsets(size) {
    const radius = Math.max(2, size);
    return [
      [-radius, 0],
      [radius, 0],
      [0, -radius],
      [0, radius],
      [-radius * 0.72, -radius * 0.72],
      [radius * 0.72, -radius * 0.72],
      [-radius * 0.72, radius * 0.72],
      [radius * 0.72, radius * 0.72]
    ];
  }
  function drawImageContain(ctx, image, x, y, width, height) {
    const rect = containImageRect(image, x, y, width, height);
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }
  function containImageRect(image, x, y, width, height) {
    const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * ratio;
    const drawHeight = image.naturalHeight * ratio;
    return {
      height: drawHeight,
      width: drawWidth,
      x: x + (width - drawWidth) / 2,
      y: y + (height - drawHeight) / 2
    };
  }
  function drawOutlinedText(ctx, text, x, y, options) {
    ctx.save();
    ctx.font = `900 ${Math.round(options.fontSize)}px ${options.fontFamily || FONT_FAMILY}`;
    ctx.textAlign = options.align || "left";
    ctx.textBaseline = "alphabetic";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeStyle = options.stroke || "#020617";
    ctx.lineWidth = options.lineWidth ?? Math.max(3, options.fontSize * 0.18);
    if (options.maxWidth) {
      ctx.strokeText(text, x, y, options.maxWidth);
    } else {
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = options.color;
    if (options.maxWidth) {
      ctx.fillText(text, x, y, options.maxWidth);
    } else {
      ctx.fillText(text, x, y);
    }
    ctx.restore();
  }
  function drawStackedOutlinedText(ctx, text, x, y, maxWidth, options) {
    const maxLines = options.maxLines || 2;
    let fontSize = options.fontSize;
    let lines = wrapText(ctx, text, maxWidth, fontSize, options.fontFamily);
    while ((lines.length > maxLines || lines.some((line) => measureText(ctx, line, fontSize, options.fontFamily) > maxWidth)) && fontSize > 9) {
      fontSize -= 1;
      lines = wrapText(ctx, text, maxWidth, fontSize, options.fontFamily);
    }
    lines = lines.slice(0, maxLines);
    const lineHeight = fontSize * 1.02;
    const startY = y - (lines.length - 1) * lineHeight;
    lines.forEach((line, index) => {
      drawOutlinedText(ctx, line, x, startY + index * lineHeight, {
        align: options.align || "center",
        color: options.color,
        fontFamily: options.fontFamily,
        fontSize,
        lineWidth: options.lineWidth
      });
    });
  }
  function wrapText(ctx, text, maxWidth, fontSize, fontFamily = FONT_FAMILY) {
    const words = String(text || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [""];
    const lines = [];
    let current = words.shift() || "";
    for (const word of words) {
      const candidate = `${current} ${word}`.trim();
      if (measureText(ctx, candidate, fontSize, fontFamily) <= maxWidth) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
    return lines;
  }
  function measureText(ctx, text, fontSize, fontFamily = FONT_FAMILY) {
    ctx.save();
    ctx.font = `900 ${Math.round(fontSize)}px ${fontFamily}`;
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
  }
  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function shadeColor(color, percent) {
    const clean = color.replace("#", "");
    const number = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
    if (!Number.isFinite(number)) return color;
    const amount = Math.round(2.55 * percent);
    const red = clamp((number >> 16) + amount, 0, 255);
    const green = clamp((number >> 8 & 255) + amount, 0, 255);
    const blue = clamp((number & 255) + amount, 0, 255);
    return `#${(16777216 + red * 65536 + green * 256 + blue).toString(16).slice(1)}`;
  }
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }
  function initials(value) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    const letters = words.length > 1 ? `${words[0][0] || ""}${words[1][0] || ""}` : (words[0] || "?").slice(0, 2);
    return letters.toUpperCase();
  }
  function formatCompactCount(value) {
    const amount = Math.max(0, Math.round(Number(value) || 0));
    if (amount >= 1e6) return `${Math.floor(amount / 1e6)}M`;
    if (amount >= 1e4) return `${Math.floor(amount / 1e3)}K`;
    if (amount >= 1e3) return `${Math.floor(amount / 100) / 10}K`.replace(".0K", "K");
    return String(amount);
  }
  function triggerLabel(mapping) {
    if (mapping.triggerType === "likes") return `${mapping.likeAmount} likes`;
    if (mapping.triggerType === "chat") return mapping.chatCommand || "Chat";
    if (mapping.triggerType === "follow") return "Follow";
    if (mapping.triggerType === "share") return "Share";
    if (mapping.triggerType === "subscribe") return "Subscribe";
    if (mapping.triggerType === "join") return "Join";
    if (mapping.triggerType === "raid") return "Raid";
    return "Gift";
  }
  function triggerColors(triggerType) {
    if (triggerType === "likes") return ["#ec4899", "#7f1d1d"];
    if (triggerType === "chat") return ["#38bdf8", "#0f172a"];
    if (triggerType === "follow") return ["#22c55e", "#064e3b"];
    if (triggerType === "share") return ["#a78bfa", "#312e81"];
    if (triggerType === "subscribe") return ["#f59e0b", "#7c2d12"];
    if (triggerType === "join") return ["#14b8a6", "#164e63"];
    if (triggerType === "raid") return ["#f97316", "#7c2d12"];
    return ["#14b8a6", "#0f172a"];
  }
  function ensureMinecraftOverlayFont() {
    if (minecraftFontLoadPromise) return minecraftFontLoadPromise;
    minecraftFontLoadPromise = (async () => {
      if (typeof document === "undefined" || typeof FontFace === "undefined" || !document.fonts) return;
      try {
        const alreadyLoaded = Array.from(document.fonts).some((font) => font.family === MINECRAFT_FONT_FACE);
        if (!alreadyLoaded) {
          const font = new FontFace(MINECRAFT_FONT_FACE, `url("${MINECRAFT_FONT_SRC}")`, {
            style: "normal",
            weight: "900"
          });
          document.fonts.add(await font.load());
        }
        await document.fonts.load(`900 32px "${MINECRAFT_FONT_FACE}"`);
      } catch {
      }
    })();
    return minecraftFontLoadPromise;
  }
  function loadOverlayImage(src, timeoutMs = 4500) {
    const cleanSrc = String(src || "").trim();
    if (!cleanSrc) return Promise.resolve(null);
    const cached = imageLoadCache.get(cleanSrc);
    if (cached) return cached;
    const promise = new Promise((resolve) => {
      const image = new Image();
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      };
      const timer = window.setTimeout(() => finish(null), timeoutMs);
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.onload = () => finish(image);
      image.onerror = () => finish(null);
      image.src = cleanSrc;
    });
    imageLoadCache.set(cleanSrc, promise);
    return promise;
  }
  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Export PNG impossible."));
        }, "image/png");
      } catch (error) {
        reject(error);
      }
    });
  }
  function defaultOverlayFilename() {
    const day = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    return `shenpulse-bedrock-box-overlay-${day}.png`;
  }
  return __toCommonJS(minecraftBedrockOverlay_exports);
})();
