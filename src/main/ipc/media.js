"use strict";

/** Catalogues et téléversement des médias.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { searchMyInstantsSounds, searchWikimediaMedia } = require("../catalogs");
const { id, safeString } = require("../utils");
const { notify } = require("./notifications");

function registerMediaIpc({ handle, core, store, backblazeMedia, getWindow, dialog, net }) {
  handle("catalog:gifts", async (_event, query, limit) => {
    await core.refreshGiftCatalog();
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
  
  handle("sound:upload", async () => {
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
    const sound = await backblazeMedia.uploadSound(result.filePaths[0]);
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
    const media = await backblazeMedia.uploadMedia(
      result.filePaths[0],
      kind
    );
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
