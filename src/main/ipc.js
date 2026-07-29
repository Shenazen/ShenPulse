"use strict";

const fs = require("node:fs");
const { clipboard, dialog, ipcMain, shell } = require("electron");
const { id, safeString } = require("./utils");
const {
  assertAdminAccount,
  assertAuthenticatedAccount,
  snapshotForRenderer
} = require("./account-access");
const {
  searchMyInstantsSounds,
  searchWikimediaMedia
} = require("./catalogs");
const {
  applyTrialDashboard,
  applyTrialGrant,
  applyTrialRevocation
} = require("./trial-access");

function localServerSettingsSignature(settings = {}) {
  return JSON.stringify([
    Boolean(settings.startOverlayServer),
    Number(settings.overlayPort || 0),
    Number(settings.apiPort || 0),
    String(settings.overlayToken || ""),
    String(settings.apiToken || "")
  ]);
}

function registerIpc({
  core,
  store,
  backblazeMedia,
  accountService,
  adminService,
  gameRuntime,
  getWindow
}) {
  const guestAllowedChannels = new Set([
    "account:login",
    "account:login-browser",
    "account:logout",
    "account:password-reset",
    "account:register",
    "account:status",
    "admin:status",
    "admin:visibility-public",
    "catalog:gifts",
    "catalog:media",
    "catalog:sounds",
    "external:open",
    "snapshot:get",
    "window:close",
    "window:maximize",
    "window:minimize"
  ]);
  const handle = (channel, listener) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (...args) => {
      if (!guestAllowedChannels.has(channel)) {
        if (channel.startsWith("admin:")) {
          assertAdminAccount(store);
        } else {
          assertAuthenticatedAccount(store);
        }
      }
      return listener(...args);
    });
  };
  const requireGameAccess = (packId) =>
    core.gameHub.assertAccess(safeString(packId, 160));
  const requireGameSessionAvailability = (packId) => {
    const targetId = safeString(packId, 160);
    const active = store.getState().session.game || {};
    if (
      active.running === true &&
      active.packId &&
      active.packId !== targetId
    ) {
      const activePack = core.gameHub
        .listPacks()
        .find((entry) => entry.id === active.packId);
      throw new Error(
        `${activePack?.name || "Un autre jeu"} est déjà actif. Arrêtez-le avant d’ouvrir un autre jeu.`
      );
    }
    return targetId;
  };
  const switchAccountWorkspace = async (operation) => {
    await core.suspendAccountWorkspace();
    try {
      const result = await operation();
      await core.resumeAccountWorkspace();
      notify(core, "state-changed", core.snapshot());
      return result;
    } catch (error) {
      await core.resumeAccountWorkspace().catch(() => {});
      throw error;
    }
  };

  handle("snapshot:get", () =>
    snapshotForRenderer(core.snapshot(), store)
  );
  handle("account:status", async () => {
    const previousUid = store.getActiveAccountUid?.() || "";
    const result = await accountService.status();
    const nextUid = store.getActiveAccountUid?.() || "";
    if (previousUid !== nextUid) {
      await core.suspendAccountWorkspace();
      await core.resumeAccountWorkspace();
      notify(core, "state-changed", core.snapshot());
    }
    return result;
  });
  handle("account:login", (_event, incoming) =>
    switchAccountWorkspace(() =>
      accountService.login({
        email: safeString(incoming?.email, 254),
        password: safeString(incoming?.password, 500)
      })
    )
  );
  handle("account:register", (_event, incoming) =>
    switchAccountWorkspace(() =>
      accountService.register({
        email: safeString(incoming?.email, 254),
        password: safeString(incoming?.password, 500),
        passwordConfirmation: safeString(
          incoming?.passwordConfirmation,
          500
        ),
        displayName: safeString(incoming?.displayName, 120)
      })
    )
  );
  handle("account:login-browser", () =>
    switchAccountWorkspace(() =>
      accountService.loginWithBrowser()
    )
  );
  handle("account:password-reset", (_event, incoming) =>
    accountService.requestPasswordReset({
      email: safeString(incoming?.email, 254)
    })
  );
  handle("account:sync-entitlements", async () => {
    const result = await accountService.syncEntitlements();
    notify(core, "state-changed", core.snapshot());
    return result;
  });
  handle("account:logout", async () => {
    await Promise.allSettled([
      core.stopSession(),
      core.stopGameSession({ notify: false })
    ]);
    await core.suspendAccountWorkspace();
    adminService.logout();
    const result = accountService.logout();
    await core.resumeAccountWorkspace();
    notify(core, "state-changed", core.snapshot());
    return result;
  });
  handle("admin:status", () => adminService.status());
  handle("admin:login", (_event, incoming) =>
    adminService.login({
      email: safeString(incoming?.email, 254),
      password: safeString(incoming?.password, 500)
    })
  );
  handle("admin:logout", () => adminService.logout());
  handle("admin:visibility-public", () => adminService.getPublicVisibility());
  handle("admin:dashboard", async () => {
    const dashboard = await adminService.getDashboard();
    if (applyTrialDashboard(store, dashboard)) {
      notify(core, "state-changed", core.snapshot());
    }
    return dashboard;
  });
  handle("admin:site-save", (_event, incoming) =>
    adminService.saveSiteSettings(sanitizeEntity(incoming || {}))
  );
  handle("admin:commerce-save", (_event, incoming) =>
    adminService.saveCommerce(sanitizeEntity(incoming || {}))
  );
  handle("admin:trial-grant", async (_event, incoming) => {
    const result = await adminService.grantTrial(
      sanitizeEntity(incoming || {})
    );
    if (applyTrialGrant(store, result)) {
      notify(core, "state-changed", core.snapshot());
    }
    return result;
  });
  handle("admin:trial-update", async (_event, incoming) => {
    const request = sanitizeEntity(incoming || {});
    const result = await adminService.updateTrial(request);
    const removed = applyTrialRevocation(store, {
      trialId: request.trialId
    });
    const applied = applyTrialGrant(store, result);
    if (removed || applied) {
      notify(core, "state-changed", core.snapshot());
    }
    return result;
  });
  handle("admin:trial-revoke", async (_event, incoming) => {
    const request = sanitizeEntity(incoming || {});
    const result = await adminService.revokeTrial(request);
    if (
      applyTrialRevocation(store, {
        ...result,
        trialId: request.trialId
      })
    ) {
      notify(core, "state-changed", core.snapshot());
    }
    return result;
  });
  handle("premium-seat:assign", async (_event, incoming) => {
    const result = await accountService.assignPremiumSeat({
      beneficiaryEmail: safeString(
        incoming?.beneficiaryEmail || incoming?.email,
        254
      )
    });
    notify(core, "state-changed", core.snapshot());
    return { result, snapshot: core.snapshot() };
  });
  handle("catalog:gifts", (_event, query, limit) =>
    core.giftCatalog.search(safeString(query, 200), Number(limit))
  );
  handle("catalog:sounds", (_event, incoming) =>
    searchMyInstantsSounds({
      query: safeString(incoming?.query, 80),
      page: Number(incoming?.page) || 1,
      locale: safeString(incoming?.locale || "fr", 10)
    })
  );
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
          extensions: ["mp3", "wav", "ogg", "m4a", "webm"]
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
                extensions: ["mp3", "wav", "ogg", "m4a", "webm"]
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
  handle("session:start", () => core.startSession());
  handle("session:stop", () => core.stopSession());
  handle("event:test", (_event, type) => core.testEvent(safeString(type, 40)));
  handle("event:simulate", (_event, incoming) =>
    core.simulateEvent(sanitizeEntity(incoming || {}))
  );
  handle("rule:test", (_event, ruleId, incoming) =>
    core.testRule(safeString(ruleId, 160), sanitizeEntity(incoming || {}))
  );
  handle("action:test", (_event, incoming) => {
    const action = sanitizeEntity(incoming || {});
    const allowed = new Set([
      "overlay.alert",
      "overlay.media",
      "tts.speak",
      "audio.play",
      "goal.add",
      "timer.add",
      "wheel.spin",
      "game.effect",
      "overlay.like-goal",
      "overlay.coin-jar",
      "overlay.win-counter",
      "obs.request",
      "http.request",
      "websocket.send",
      "chat.reply",
      "spotify.queue",
      "system.keys",
      "system.open",
      "delay"
    ]);
    if (!allowed.has(action.type)) {
      throw new Error("Cette action ne peut pas être prévisualisée directement.");
    }
    return core.previewAction({
      id: safeString(action.id || id("preview"), 160),
      type: action.type,
      config: action.config || {}
    }, {
      type: safeString(action.testEventType || "gift", 40),
      message: safeString(action.testMessage || "", 1000)
    });
  });
  handle("timer:test", (_event, timerId) =>
    core.testTimer(safeString(timerId, 160))
  );
  handle("server:restart", () => core.restartServers());
  handle("overlay:public-urls-rotate", () =>
    core.rotatePublicOverlayChannel()
  );

  handle("entity:upsert", (_event, collection, item) => {
    const allowed = new Set([
      "rules",
      "goals",
      "commands",
      "timers",
      "profiles"
    ]);
    if (!allowed.has(collection)) throw new Error("Collection non modifiable.");
    const state = store.upsert(collection, sanitizeEntity(item));
    notify(core, "state-changed", core.snapshot());
    return state;
  });

  handle("entity:remove", (_event, collection, entityId) => {
    const allowed = new Set([
      "rules",
      "goals",
      "commands",
      "timers",
      "profiles",
      "connections"
    ]);
    if (!allowed.has(collection)) throw new Error("Collection non modifiable.");
    const state = store.remove(collection, safeString(entityId, 160));
    notify(core, "state-changed", core.snapshot());
    return state;
  });

  handle("connection:save", (_event, incoming) => {
    const connection = sanitizeEntity(incoming);
    if (!connection.id) connection.id = id("source");
    if (incoming.secret) {
      connection.secretId = store.setSecret(connection.secretId, incoming.secret);
    }
    delete connection.secret;
    connection.status = "disconnected";
    store.upsert("connections", connection);
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
  handle("connection:start", (_event, connectionId) =>
    core.sourceHub.start(safeString(connectionId, 160))
  );
  handle("connection:stop", (_event, connectionId) =>
    core.sourceHub.stop(safeString(connectionId, 160))
  );

  handle("tiktok:save", async (_event, incoming) => {
    const values = sanitizeEntity(incoming || {});
    const username = cleanTikTokUsername(values.username);
    if (!username) throw new Error("Renseignez le @ TikTok à surveiller.");
    const existing = store
      .getState()
      .connections.find((item) => item.id === "source_tiktok");
    if (existing) await core.sourceHub.stop("source_tiktok");
    store.set("settings.tiktok", {
      ...store.getState().settings.tiktok,
      username,
      relayUrl: "",
      autoConnect: true,
      status: "disconnected",
      roomId: "",
      lastCheckedAt: new Date().toISOString()
    });
    store.upsert("connections", {
      ...(existing || {}),
      id: "source_tiktok",
      name: `TikTok @${username}`,
      type: "tiktok-direct",
      enabled: true,
      status: "disconnected",
      secretId: "",
      config: {
        username
      }
    });
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
  handle("tiktok:start", async () => {
    const tiktok = store.getState().settings.tiktok || {};
    if (!tiktok.username) throw new Error("Renseignez d’abord le @ TikTok.");
    const connection = store
      .getState()
      .connections.find((item) => item.id === "source_tiktok");
    if (!connection || connection.type !== "tiktok-direct") {
      store.upsert("connections", {
        id: "source_tiktok",
        name: `TikTok @${tiktok.username}`,
        type: "tiktok-direct",
        enabled: true,
        status: "disconnected",
        config: { username: tiktok.username }
      });
    }
    await core.sourceHub.start("source_tiktok");
    return core.snapshot();
  });
  handle("tiktok:stop", async () => {
    await core.sourceHub.stop("source_tiktok");
    return core.snapshot();
  });

  handle("settings:save", async (_event, incoming) => {
    const settings = sanitizeEntity(incoming);
    if (settings.obsPassword) {
      settings.obs = settings.obs || {};
      settings.obs.passwordSecretId = store.setSecret(
        store.getState().settings.obs?.passwordSecretId,
        settings.obsPassword
      );
      delete settings.obsPassword;
    }
    if (settings.spotifyToken) {
      settings.spotify = settings.spotify || {};
      settings.spotify.accessTokenSecretId = store.setSecret(
        store.getState().settings.spotify?.accessTokenSecretId,
        settings.spotifyToken
      );
      delete settings.spotifyToken;
    }
    if (settings.backblazeKeyId) {
      settings.backblaze = settings.backblaze || {};
      settings.backblaze.keyIdSecretId = store.setSecret(
        store.getState().settings.backblaze?.keyIdSecretId,
        settings.backblazeKeyId
      );
    }
    delete settings.backblazeKeyId;
    if (settings.backblazeApplicationKey) {
      settings.backblaze = settings.backblaze || {};
      settings.backblaze.applicationKeySecretId = store.setSecret(
        store.getState().settings.backblaze?.applicationKeySecretId,
        settings.backblazeApplicationKey
      );
    }
    delete settings.backblazeApplicationKey;
    const current = store.getState().settings;
    const nextSettings = {
      ...current,
      ...settings,
      admin: current.admin,
      tts: { ...current.tts, ...(settings.tts || {}) },
      obs: { ...current.obs, ...(settings.obs || {}) },
      spotify: { ...current.spotify, ...(settings.spotify || {}) },
      backblaze: {
        ...current.backblaze,
        ...(settings.backblaze || {})
      },
      tiktok: { ...current.tiktok, ...(settings.tiktok || {}) }
    };
    const serverSettingsChanged =
      localServerSettingsSignature(current) !==
      localServerSettingsSignature(nextSettings);
    store.set("settings", nextSettings);
    await core.synchronizeOverlayCompletionSettings(
      current,
      nextSettings
    );
    if (serverSettingsChanged) await core.restartServers();
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });

  handle("profile:select", async (_event, profileId) => {
    await core.stopGameSession({ notify: false });
    store.selectProfile(safeString(profileId, 160));
    core.ruleEngine.resetProfileState();
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });

  handle("game:select", (_event, packId) => {
    const targetId = requireGameSessionAvailability(packId);
    requireGameAccess(targetId);
    store.set("session.activeGamePackId", targetId);
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
  handle("game:configure", (_event, packId, config) => {
    const targetId = safeString(packId, 160);
    requireGameAccess(targetId);
    const next = sanitizeEntity(config);
    if (next.secret) {
      const current =
        store.getState().game.connectorOverrides?.[targetId]?.secretId || "";
      next.secretId = store.setSecret(current, next.secret);
    }
    delete next.secret;
    store.mutate((state) => {
      state.game.connectorOverrides[targetId] = {
        ...(state.game.connectorOverrides[targetId] || {}),
        ...next
      };
    });
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
  handle("game:initialize-interactions", (_event, packId) => {
    const result = core.gameHub.initializeDefaultInteractions(
      safeString(packId, 160)
    );
    const nextSnapshot = core.snapshot();
    notify(core, "state-changed", nextSnapshot);
    return { ...result, snapshot: nextSnapshot };
  });
  handle("game:interaction:save", (_event, packId, incoming) => {
    const targetId = safeString(packId, 160);
    requireGameAccess(targetId);
    const rule = sanitizeEntity(incoming || {});
    rule.actions = (Array.isArray(rule.actions) ? rule.actions : [])
      .filter((action) =>
        ["game.effect", "overlay.win-counter"].includes(action.type)
      )
      .map((action) => ({
        ...action,
        config: {
          ...(action.config || {}),
          packId: targetId
        }
      }));
    if (!rule.actions.length) {
      throw new Error("Cette interaction de jeu ne contient aucun effet.");
    }
    store.upsertGameInteraction(targetId, rule);
    const nextSnapshot = core.snapshot();
    notify(core, "state-changed", nextSnapshot);
    return nextSnapshot;
  });
  handle("game:interaction:remove", (_event, packId, ruleId) => {
    const targetId = safeString(packId, 160);
    requireGameAccess(targetId);
    store.removeGameInteraction(
      targetId,
      safeString(ruleId, 160)
    );
    const nextSnapshot = core.snapshot();
    notify(core, "state-changed", nextSnapshot);
    return nextSnapshot;
  });
  handle("game:session:start", (_event, packId) =>
    core.startGameSession(safeString(packId, 160))
  );
  handle("game:session:stop", () => core.stopGameSession());
  handle("game:test", (_event, packId) =>
    core.gameHub.testConnection(safeString(packId, 160))
  );
  handle("game:effect", (_event, effectId, options) =>
    core.gameHub.trigger(
      safeString(effectId, 160),
      {
        source: "manual",
        user: { id: "streamer", name: "streamer", displayName: "Test manuel" }
      },
      sanitizeEntity(options || {})
    )
  );
  const auditGameInteraction = async (
    packId,
    effectId,
    incomingProgress
  ) => {
      const targetId = safeString(packId, 160);
      requireGameAccess(targetId);
      const pack = core.gameHub
        .listPacks()
        .find((entry) => entry.id === targetId);
      const effect = pack?.effects.find(
        (entry) => entry.id === safeString(effectId, 160)
      );
      if (!pack || !effect || effect.available === false) {
        throw new Error("Cette interaction n’est pas exécutable.");
      }

      const progress = sanitizeEntity(incomingProgress || {});
      const current = Math.max(1, Number(progress.current || 1));
      const total = Math.max(current, Number(progress.total || current));
      const expectation =
        safeString(progress.expectation, 1200) ||
        effect.description ||
        "L’interaction doit être visible dans le jeu.";
      const preparation = safeString(progress.preparation, 1600);
      const owner = getWindow();
      const showMessage = (options) =>
        owner && !owner.isDestroyed()
          ? dialog.showMessageBox(owner, options)
          : dialog.showMessageBox(options);
      if (preparation) {
        const introduction = await showMessage({
          type: "info",
          title: `Préparation requise — ${current}/${total}`,
          message: `${current}/${total} · ${effect.name}`,
          detail: [
            preparation,
            "",
            "Effet attendu :",
            expectation,
            "",
            "Quand la situation est prête, cliquez sur « Déclencher maintenant »."
          ].join("\n"),
          buttons: ["Déclencher maintenant", "Arrêter la campagne"],
          defaultId: 0,
          cancelId: 1,
          noLink: true
        });
        if (introduction.response !== 0) {
          return {
            answer: "cancel",
            packId: targetId,
            effectId: effect.id,
            current,
            total
          };
        }
      }

      owner?.minimize();
      const parameters = Object.fromEntries(
        (effect.parameters || []).map((parameter) => [
          parameter.id,
          parameter.defaultValue
        ])
      );
      if (
        targetId === "cult-of-the-lamb" &&
        effect.id === "cult-set-weapon"
      ) {
        // Une hache rend le changement visuellement incontestable, y
        // compris lorsque la sauvegarde démarre déjà avec une épée.
        parameters.weapon = 3;
        parameters.level = 3;
      }
      const context = {
        source: "manual-audit",
        user: {
          id: "streamer",
          name: "streamer",
          displayName: "Validation manuelle"
        }
      };
      if (effect.actionType === "overlay.win-counter") {
        await core.actionRunner.run(
          {
            id: `audit_${effect.id}`,
            type: effect.actionType,
            config: {
              packId: targetId,
              effectId: effect.id,
              quantity: Number(effect.quantity || 1),
              duration: Number(effect.duration || 0),
              parameters,
              amount: Number(effect.winCounter?.amount || 0),
              operation: effect.winCounter?.operation || "adjust"
            }
          },
          context
        );
      } else {
        await core.gameHub.trigger(effect.id, context, {
          packId: targetId,
          quantity: Number(effect.quantity || 1),
          duration: Number(effect.duration || 0),
          parameters
        });
      }

      const observationDelayMs = Math.min(
        360000,
        Math.max(
          1000,
          Number(
            progress.observationDelayMs ||
              (Number(effect.duration || 0) > 0 ? 5000 : 3500)
          )
        )
      );
      await new Promise((resolve) =>
        setTimeout(resolve, observationDelayMs)
      );
      if (owner && !owner.isDestroyed()) {
        if (owner.isMinimized()) owner.restore();
        owner.show();
        owner.focus();
      }

      const validation = await showMessage({
        type: "question",
        title: `Résultat de l’interaction — ${current}/${total}`,
        message: `${effect.name} a-t-elle fonctionné correctement ?`,
        detail: [
          "Résultat qui devait être observé :",
          expectation,
          "",
          "Choisissez « Oui » seulement si le résultat correspond exactement."
        ].join("\n"),
        buttons: [
          "Oui, c’est correct",
          "Non, il faut réparer",
          "Arrêter la campagne"
        ],
        defaultId: 0,
        cancelId: 2,
        noLink: true
      });
      return {
        answer:
          validation.response === 0
            ? "yes"
            : validation.response === 1
              ? "no"
              : "cancel",
        packId: targetId,
        packName: pack.name,
        effectId: effect.id,
        effectName: effect.name,
        description: effect.description || "",
        current,
        total,
        expectation
      };
    };
  handle(
    "game:interaction-audit",
    (_event, packId, effectId, incomingProgress) =>
      auditGameInteraction(packId, effectId, incomingProgress)
  );
  handle("game:runtime-status", (_event, packId) => {
    const targetId = safeString(packId, 160);
    requireGameAccess(targetId);
    return gameRuntime.status(targetId);
  });
  handle("game:install", async (_event, packId) => {
    const targetId = requireGameSessionAvailability(packId);
    requireGameAccess(targetId);
    const result = await gameRuntime.install(targetId);
    notify(core, "state-changed", core.snapshot());
    return result;
  });
  handle("game:launch", async (_event, packId) => {
    const targetId = requireGameSessionAvailability(packId);
    requireGameAccess(targetId);
    const result = await gameRuntime.launch(targetId);
    const nextSnapshot = await core.startGameSession(targetId);
    return { ...result, snapshot: nextSnapshot };
  });
  handle("game:round-settings:save", (_event, packId, incoming) =>
    core.saveGameRoundSettings(
      safeString(packId, 160),
      sanitizeEntity(incoming || {})
    )
  );

  handle("obs:test", () => core.obsClient.request("GetVersion", {}));
  handle("spotify:connect", async () => {
    const status = await core.spotifyService.connect();
    notify(core, "state-changed", core.snapshot());
    return { status, snapshot: core.snapshot() };
  });
  handle("spotify:disconnect", async () => {
    const status = await core.spotifyService.disconnect();
    notify(core, "state-changed", core.snapshot());
    return { status, snapshot: core.snapshot() };
  });
  handle("spotify:status", () => core.spotifyService.status());
  handle("spotify:control", (_event, config) =>
    core.spotifyService.control(sanitizeEntity(config || {}))
  );

  handle("clipboard:write", (_event, text) => {
    clipboard.writeText(safeString(text, 5000));
    return true;
  });

  handle("external:open", async (_event, url) => {
    const target = String(url || "");
    if (!/^https?:\/\//i.test(target)) throw new Error("URL non autorisée.");
    await shell.openExternal(target);
    return true;
  });

  handle("data:export", async () => {
    const owner = getWindow();
    const result = await dialog.showSaveDialog(owner, {
      title: "Exporter la configuration ShenPulse",
      defaultPath: `ShenPulse-profile-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "Profil ShenPulse", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(store.getState(), null, 2), "utf8");
    return { canceled: false, filePath: result.filePath };
  });

  handle("data:import", async () => {
    const owner = getWindow();
    const result = await dialog.showOpenDialog(owner, {
      title: "Importer une configuration ShenPulse",
      properties: ["openFile"],
      filters: [{ name: "Profil ShenPulse", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    const imported = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"));
    store.importState(imported);
    await core.restartServers();
    notify(core, "state-changed", core.snapshot());
    return { canceled: false, snapshot: core.snapshot() };
  });

  handle("data:clear", async () => {
    await core.stopSession();
    await core.stopGameSession({ notify: false });
    store.clearAllData();
    await core.restartServers();
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });

  handle("window:minimize", () => getWindow()?.minimize());
  handle("window:maximize", () => {
    const window = getWindow();
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  handle("window:close", () => getWindow()?.close());
  return { auditGameInteraction };
}

function sanitizeEntity(value, depth = 0) {
  if (depth > 12) throw new Error("Objet trop profond.");
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") return safeString(value, 20000);
  if (Array.isArray(value)) {
    if (value.length > 1000) throw new Error("Tableau trop volumineux.");
    return value.map((entry) => sanitizeEntity(entry, depth + 1));
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 500) throw new Error("Objet trop volumineux.");
    return Object.fromEntries(
      entries.map(([key, entry]) => [
        safeString(key, 120),
        sanitizeEntity(entry, depth + 1)
      ])
    );
  }
  return undefined;
}

function notify(core, channel, value) {
  core.notifyRenderer(channel, value);
}

function cleanTikTokUsername(value) {
  return safeString(value, 80)
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._]/g, "")
    .slice(0, 30);
}

module.exports = { registerIpc, sanitizeEntity, cleanTikTokUsername };
