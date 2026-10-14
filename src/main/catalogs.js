"use strict";

/** Façade stable : API historique, implémentations organisées par responsabilités. */
const { createSoundCatalog, searchMyInstantsSounds, extractMyInstantsSounds } = require("./catalogs/sounds");
const { TIKFINITY_LOTTIE_PRESETS, createMediaCatalog, searchWikimediaMedia, normalizeWikimediaMediaPayload } = require("./catalogs/media");
const { GiftCatalog, fetchFrenchTikTokGifts, dedupeLocalizedGifts, normalizeGift, dedupeGiftCatalog } = require("./catalogs/gifts");



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
