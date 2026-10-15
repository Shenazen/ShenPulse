"use strict";

/** Réglages, serveurs et configuration des overlays.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const sceneLayout = require("../../../resources/overlays/scene-layout");
const { safeString } = require("../utils");
const { sanitizeEntity } = require("./sanitizers");
const { notify } = require("./notifications");
const { readState } = require("../state-projection");
const { assertProFeatureAccess } = require("../pro-feature-access");
const { settingsAllowedForAccount } = require("../settings-access");

function registerSettingsIpc({ handle, core, store, localServerSettingsSignature }) {
  handle("server:restart", () => core.restartServers());
  
  handle("overlay:public-urls-rotate", () =>
    core.rotatePublicOverlayChannel()
  );
  
  handle("overlay:match-url-rotate", () =>
    core.rotateMatchOverlayAccess()
  );
  
  handle("settings:save", async (_event, incoming) => {
    const sanitized = sanitizeEntity(incoming || {});
    if (typeof sanitized !== "object" || Array.isArray(sanitized)) throw new Error("Réglages invalides.");
    const current = readState(store, ["settings"]).settings;
    const settings = settingsAllowedForAccount(store, sanitized, current);
    if (Object.hasOwn(settings, "irl") && JSON.stringify(settings.irl) !== JSON.stringify(current.irl)) {
      assertProFeatureAccess(store, "irl");
    }
    if (settings.obsPassword) {
      settings.obs = settings.obs || {};
      settings.obs.passwordSecretId = store.setSecret(
        current.obs?.passwordSecretId,
        settings.obsPassword
      );
      delete settings.obsPassword;
    }
    if (settings.spotifyToken) {
      settings.spotify = settings.spotify || {};
      settings.spotify.accessTokenSecretId = store.setSecret(
        current.spotify?.accessTokenSecretId,
        settings.spotifyToken
      );
      delete settings.spotifyToken;
    }
    if (settings.backblazeKeyId) {
      settings.backblaze = settings.backblaze || {};
      settings.backblaze.keyIdSecretId = store.setSecret(
        current.backblaze?.keyIdSecretId,
        settings.backblazeKeyId
      );
    }
    delete settings.backblazeKeyId;
    if (settings.backblazeApplicationKey) {
      settings.backblaze = settings.backblaze || {};
      settings.backblaze.applicationKeySecretId = store.setSecret(
        current.backblaze?.applicationKeySecretId,
        settings.backblazeApplicationKey
      );
    }
    delete settings.backblazeApplicationKey;
    const nextSettings = {
      ...current,
      ...settings,
      admin: current.admin,
      // L'identité et les restrictions ne changent que par leurs services
      // authentifiés ; un formulaire de préférences ne peut ouvrir un accès.
      account: current.account,
      siteVisibility: current.siteVisibility,
      matches: current.matches,
      // Les identifiants d’intégration passent uniquement par leurs API chiffrées dédiées.
      kick: current.kick,
      controllers: current.controllers,
      // La visibilité publique change uniquement par son contrôle de consentement explicite.
      liveDirectory: current.liveDirectory,
      locale: ["fr-FR", "en-US"].includes(settings.locale) ? settings.locale : current.locale,
      overlayScene: sceneLayout.normalizeScene(settings.overlayScene || current.overlayScene),
      tts: { ...current.tts, ...(settings.tts || {}) },
      obs: { ...current.obs, ...(settings.obs || {}) },
      spotify: { ...current.spotify, ...(settings.spotify || {}) },
      backblaze: {
        ...current.backblaze,
        ...(settings.backblaze || {})
      },
      tiktok: { ...current.tiktok, ...(settings.tiktok || {}), chat: current.tiktok?.chat }
    };
    const serverSettingsChanged =
      localServerSettingsSignature(current) !==
      localServerSettingsSignature(nextSettings);
    store.set("settings", nextSettings);
    core.liveEventActions?.chatbot.syncTimers();
    await core.synchronizeOverlayCompletionSettings(
      current,
      nextSettings
    );
    if (serverSettingsChanged) await core.restartServers();
    core.overlayServer.publish("scene", nextSettings.overlayScene);
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
  
  handle("overlay:configuration", (_event, key, incoming) => {
    const overlayKey = safeString(key, 80);
    if (!overlayKey) throw new Error("Overlay invalide.");
    core.overlayServer.publish("configuration", {
      overlayKey,
      config: sanitizeEntity(incoming || {})
    });
    return { ok: true };
  });
}

module.exports = { registerSettingsIpc, settingsAllowedForAccount };
