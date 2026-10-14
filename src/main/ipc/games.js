"use strict";

/** Jeux, interactions, lancement et validation manuelle.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { isGameInteractionActionType } = require("../../shared/game-interaction-action-types");
const { sanitizeThiercelieuxEntitlements } = require("../../shared/thiercelieux-products");
const { id, safeString } = require("../utils");
const { sanitizeEntity, sanitizeGameConfiguration, sanitizeDealOrNoDealHostState, sanitizeThiercelieuxCommand, sanitizeThiercelieuxHostState } = require("./sanitizers");
const { notify } = require("./notifications");

function registerGamesIpc({ handle, core, store, gameRuntime, getWindow, dialog, requireGameAccess, requireGameSessionAvailability }) {
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
    let next = sanitizeGameConfiguration(targetId, config);
    if (targetId === "thiercelieux") {
      next = sanitizeThiercelieuxEntitlements(next, store.getState());
    }
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
  
  handle("game:deal-host-state", (_event, incoming) => {
    requireGameAccess("deal-or-no-deal");
    const state = sanitizeDealOrNoDealHostState(incoming);
    notify(core, "deal-host-state", state);
    return { ok: true };
  });
  
  handle("game:thiercelieux-host-state", (_event, incoming) => {
    requireGameAccess("thiercelieux");
    const state = sanitizeThiercelieuxHostState(incoming);
    notify(core, "thiercelieux-host-state", state);
    return { ok: true };
  });
  
  handle("game:thiercelieux-command", (_event, incoming) => {
    requireGameAccess("thiercelieux");
    return gameRuntime.sendThiercelieuxCommand(
      sanitizeThiercelieuxCommand(incoming)
    );
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
      .filter((action) => isGameInteractionActionType(action.type))
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
    const pack = core.gameHub
      .listPacks()
      .find((entry) => entry.id === targetId);
    const lockedEffect = rule.actions
      .map((action) =>
        pack?.effects.find(
          (effect) => effect.id === safeString(action.config?.effectId, 160)
        )
      )
      .find((effect) => effect?.available === false);
    if (lockedEffect) {
      throw new Error(
        lockedEffect.unavailableReason ||
          "Cette interaction est verrouillée et ne peut pas être utilisée."
      );
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
  
  handle("game:select-rom", async (_event, packId) => {
    const targetId = requireGameSessionAvailability(packId);
    requireGameAccess(targetId);
    const result = await gameRuntime.selectPokemonRom(targetId);
    notify(core, "state-changed", core.snapshot());
    return result;
  });
  
  handle("game:launch", async (_event, packId) => {
    const targetId = requireGameSessionAvailability(packId);
    requireGameAccess(targetId);
    await core.gameHub.prepareConnection(targetId);
    const result = await gameRuntime.launch(targetId);
    const nextSnapshot = await core.startGameSession(targetId);
    return { ...result, snapshot: nextSnapshot };
  });
  
  handle("game:window-format", (_event, packId, format) => {
    const targetId = safeString(packId, 160);
    requireGameAccess(targetId);
    return gameRuntime.setGameWindowFormat(
      targetId,
      safeString(format, 20)
    );
  });
  
  handle("game:round-settings:save", (_event, packId, incoming) =>
    core.saveGameRoundSettings(
      safeString(packId, 160),
      sanitizeEntity(incoming || {})
    )
  );
  return { auditGameInteraction };
}

module.exports = { registerGamesIpc };
