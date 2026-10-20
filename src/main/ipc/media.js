"use strict";

/** Catalogues et téléversement des médias.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { SOUND_CATALOG, searchMyInstantsSounds, searchWikimediaMedia } = require("../catalogs");
const { safeString } = require("../utils");
const { notify } = require("./notifications");
const { assertMediaAccount, currentMediaAccountUid } = require("../backblaze-media");
const { readState } = require("../state-projection");
const { giftCatalogScope, sameGiftCatalogScope } = require("../core/gift-scope");

function registerMediaIpc({ handle, core, store, backblazeMedia, getWindow, dialog, net }) {
  handle("catalog:gifts", async (_event, query, limit) => {
    const scope = giftCatalogScope(store);
    // La recherche sert le cache local ; TikTok l'actualise en arrière-plan.
    void core.refreshGiftCatalog().catch(() => {});
    if (!sameGiftCatalogScope(scope, giftCatalogScope(store))) throw new Error("Le compte, le profil ou le LIVE a changé. Relancez la recherche de cadeaux.");
    return core.giftCatalog.search(safeString(query, 200), Number(limit));
  });
  
  handle("catalog:sounds", (_event, incoming) => {
    const browserSession = getWindow()?.webContents?.session;
    const fetchImpl = (url, options) =>
      browserSession?.fetch
        ? browserSession.fetch(url, options)
        : net.fetch(url, options);
    return searchMyInstantsSounds(
      {
        query: safeString(incoming?.query, 80),
        page: Number(incoming?.page) || 1,
        locale: safeString(incoming?.locale || "fr", 10)
      },
      { fetchImpl }
    );
  });
  
  handle("catalog:media", (_event, incoming) =>
    searchWikimediaMedia({
      query: safeString(incoming?.query, 80),
      page: Number(incoming?.page) || 1,
      kind: safeString(incoming?.kind || "all", 20)
    })
  );

  /** Retire seulement du catalogue du compte : aucune suppression du fichier
   * Backblaze ni modification des actions, profils ou médias déjà configurés.
   * L'UID est capturé par l'interface avant la confirmation de l'utilisateur.
   */
  handle("sound:remove", (_event, soundId, expectedUid) => {
    if (typeof expectedUid !== "string") assertMediaAccount(store, "");
    assertMediaAccount(store, expectedUid);
    const invalid = () => {
      const error = new Error("Ce son personnalisé n'existe plus dans la bibliothèque de ce compte.");
      error.code = "CUSTOM_SOUND_NOT_FOUND";
      return error;
    };
    if (typeof soundId !== "string" || !soundId.trim() || soundId.length > 160 ||
        /[\u0000-\u001f\u007f]/.test(soundId)) throw invalid();
    const sounds = readState(store, ["customSounds"]).customSounds;
    const matches = Array.isArray(sounds) ? sounds.filter((sound) => sound?.id === soundId) : [];
    if (matches.length !== 1 ||
        (matches[0].source && matches[0].source !== "custom") ||
        SOUND_CATALOG.some((sound) => sound.id === soundId) ||
        core.soundCatalog?.some((sound) => sound.id === soundId)) throw invalid();
    store.mutate((state) => {
      state.customSounds = state.customSounds.filter((sound) => sound?.id !== soundId);
    }, true);
    const nextSnapshot = core.snapshot();
    notify(core, "state-changed", nextSnapshot);
    return { snapshot: nextSnapshot };
  });
  
  handle("sound:upload", async () => {
    const expectedUid = currentMediaAccountUid(store);
    assertMediaAccount(store, expectedUid);
    const result = await dialog.showOpenDialog(getWindow(), {
      title: "Ajouter un son personnalisé",
      properties: ["openFile"],
      filters: [
        {
          name: "Fichiers audio",
          extensions: ["mp3", "wav", "ogg", "m4a", "mp4", "webm"]
        }
      ]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    assertMediaAccount(store, expectedUid);
    const sound = await backblazeMedia.uploadSound(result.filePaths[0], { expectedUid });
    assertMediaAccount(store, expectedUid);
    store.mutate((state) => {
      state.customSounds = [
        sound,
        ...(state.customSounds || []).filter(
          (item) => item.id !== sound.id && item.url !== sound.url
        )
      ].slice(0, 500);
    }, true);
    notify(core, "state-changed", core.snapshot());
    return { canceled: false, sound, snapshot: core.snapshot() };
  });
  
  handle("media:upload", async (_event, requestedKind) => {
    const expectedUid = currentMediaAccountUid(store);
    assertMediaAccount(store, expectedUid);
    const kind = requestedKind === "sound" ? "sound" : "visual";
    const result = await dialog.showOpenDialog(getWindow(), {
      title:
        kind === "sound"
          ? "Ajouter un son personnalisé"
          : "Ajouter une image, un GIF ou une vidéo",
      properties: ["openFile"],
      filters:
        kind === "sound"
          ? [
              {
                name: "Fichiers audio",
                extensions: ["mp3", "wav", "ogg", "m4a", "mp4", "webm"]
              }
            ]
          : [
              {
                name: "Images, GIF et vidéos",
                extensions: [
                  "png",
                  "jpg",
                  "jpeg",
                  "webp",
                  "gif",
                  "mp4",
                  "webm"
                ]
              }
            ]
    });
    if (result.canceled || !result.filePaths[0]) {
      return { canceled: true };
    }
    assertMediaAccount(store, expectedUid);
    const media = await backblazeMedia.uploadMedia(
      result.filePaths[0],
      kind,
      { expectedUid }
    );
    assertMediaAccount(store, expectedUid);
    if (kind === "sound") {
      store.mutate((state) => {
        state.customSounds = [
          media,
          ...(state.customSounds || []).filter(
            (item) => item.id !== media.id && item.url !== media.url
          )
        ].slice(0, 500);
      }, true);
    } else {
      store.mutate((state) => {
        state.customMedia = [
          media,
          ...(state.customMedia || []).filter(
            (item) => item.id !== media.id && item.url !== media.url
          )
        ].slice(0, 500);
      }, true);
    }
    const nextSnapshot = core.snapshot();
    notify(core, "state-changed", nextSnapshot);
    return { canceled: false, media, snapshot: nextSnapshot };
  });
}

module.exports = { registerMediaIpc };
