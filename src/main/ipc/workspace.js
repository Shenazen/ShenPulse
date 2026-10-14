"use strict";

/** Profils, connexions et entités de l’espace utilisateur.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { assertCreatorCapacity } = require("../creator-access");
const { id, safeString } = require("../utils");
const { sanitizeEntity, cleanTikTokUsername } = require("./sanitizers");
const { notify } = require("./notifications");
const { readState } = require("../state-projection");
const { normalizeChatbotCommand } = require("../../shared/chatbot-command");
const { assertCommandsAccess } = require("../chatbot-service");

function registerWorkspaceIpc({ handle, core, store }) {
  handle("entity:upsert", (_event, collection, item) => {
    const allowed = new Set([
      "rules",
      "goals",
      "commands",
      "timers",
      "profiles"
    ]);
    if (!allowed.has(collection)) throw new Error("Collection non modifiable.");
    let entity = sanitizeEntity(item);
    if (collection === "commands") {
      assertCommandsAccess(store);
      if ((entity.kind || "command") !== "command" || !entity.execution) {
        throw new Error("Une commande doit commencer par ! et déclencher la musique, une action ou un overlay.");
      }
      // Les anciens messages conservés sur disque sont inactifs et ne
      // réservent plus leur nom dans la nouvelle page Commandes.
      entity = normalizeChatbotCommand(entity, { commands: (readState(store, ["commands"]).commands || [])
        .filter((entry) => (entry.kind || "command") === "command" && entry.execution) });
      // Une cible indisponible peut être conservée dans une commande désactivée,
      // jamais activée implicitement ni remplacée par une autre action.
      if (entity.enabled !== false) {
        const executor = core.liveEventActions?.commandExecutor;
        if (!executor) throw new Error("Le moteur des commandes n’est pas disponible.");
        executor.validateTargets(entity);
      }
    }
    assertCreatorCapacity(store.getState(), collection, entity);
    const state = store.upsert(collection, entity);
    if (collection === "commands") core.liveEventActions?.chatbot.syncTimers();
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
    if (collection === "commands") assertCommandsAccess(store);
    if (collection === "profiles") core.liveEventActions?.chatbot.reset();
    if (collection === "profiles") core.matches?.reset();
    const state = store.remove(collection, safeString(entityId, 160));
    if (["commands", "profiles"].includes(collection)) core.liveEventActions?.chatbot.syncTimers();
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
    const existing = readState(store, ["connections"])
      .connections.find((item) => item.id === "source_tiktok");
    if (existing) await core.sourceHub.stop("source_tiktok");
    store.set("settings.tiktok", {
      ...readState(store, ["settings.tiktok"]).settings.tiktok,
      username,
      relayUrl: "",
      autoConnect: true,
      status: "disconnected",
      roomId: "",
      broadcaster: null,
      currentViewers: null,
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
    await core.refreshGiftCatalog({ force: true });
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
  
  handle("tiktok:start", async () => {
    const state = readState(store, ["settings.tiktok", "connections"]);
    const tiktok = state.settings.tiktok || {};
    if (!tiktok.username) throw new Error("Renseignez d’abord le @ TikTok.");
    const connection = state
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
    store.mutate((state) => {
      state.settings.tiktok.autoConnect = true;
      const source = state.connections.find((item) => item.id === "source_tiktok");
      if (source) source.enabled = true;
    }, true);
    await core.sourceHub.start("source_tiktok");
    return core.snapshot();
  });
  
  handle("tiktok:stop", async () => {
    store.mutate((state) => {
      state.settings.tiktok.autoConnect = false;
      const source = state.connections.find((item) => item.id === "source_tiktok");
      if (source) source.enabled = false;
    }, true);
    await core.sourceHub.stop("source_tiktok");
    return core.snapshot();
  });
  
  handle("profile:select", async (_event, profileId) => {
    core.matches?.reset();
    core.liveEventActions?.chatbot.reset();
    await core.stopGameSession({ notify: false });
    store.selectProfile(safeString(profileId, 160));
    core.ruleEngine.resetProfileState();
    core.liveEventActions?.chatbot.syncTimers();
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
}

module.exports = { registerWorkspaceIpc };
