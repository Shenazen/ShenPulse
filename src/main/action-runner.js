"use strict";

const { randomUUID } = require("node:crypto");
const { shell } = require("electron");
const { clamp, safeString } = require("./utils");
const { renderValue } = require("./template");
const { readState } = require("./state-projection");
const { assertCommandContext } = require("./commands/context-guard");
const { filterTtsChatComment, isTtsUserAllowed, claimTtsChatComment } = require("./actions/tts-policy");
const { runActionGroup } = require("./actions/groups");
const { WheelActionController } = require("./actions/wheel");
const { runHttpAction, runSpotifyAction, sendKeyAction, openUrlAction } = require("./actions/network-system");
const {
  MAX_TIMER_SECONDS,
  applyOverlayOperation
} = require("./overlay-session-state");

class ActionRunner {
  constructor({
    store,
    overlayServer,
    gameHub,
    gameMuteService,
    obsClient,
    sourceHub,
    spotifyService,
    shellyService,
    notifyRenderer,
    onOverlayOperation = () => {},
    setTimeoutImpl = setTimeout,
    nowImpl = Date.now,
    randomImpl = Math.random
  }) {
    this.store = store;
    this.overlayServer = overlayServer;
    this.gameHub = gameHub;
    this.gameMuteService = gameMuteService;
    this.obsClient = obsClient;
    this.sourceHub = sourceHub;
    this.spotifyService = spotifyService;
    this.shellyService = shellyService;
    this.notifyRenderer = notifyRenderer;
    this.onOverlayOperation = onOverlayOperation;
    this.setTimeoutImpl = setTimeoutImpl;
    this.nowImpl = nowImpl;
    this.randomImpl = randomImpl;
    this.wheelActions = new WheelActionController({ store, overlayServer, setTimeoutImpl, runAction: (entry, context) => this.run(entry, context) });
    this.ttsReadMessages = new Map();
  }

  #applyOverlayOperation(channel, payload, metadata = {}) {
    let runtime;
    let previous;
    const update = (state) => {
      previous = structuredClone(state.overlaySession || {});
      runtime = applyOverlayOperation(state, channel, payload);
    };
    if (typeof this.store.mutateRuntime === "function") {
      this.store.mutateRuntime(update);
    } else {
      const state = this.store.getState?.();
      if (state && typeof state === "object") update(state);
    }
    try {
      Promise.resolve(
        this.onOverlayOperation({
          ...metadata,
          channel,
          payload,
          previous,
          runtime
        })
      ).catch(() => {});
    } catch {
      // Le callback de fin ne doit jamais invalider l’action d’origine.
    }
    return runtime;
  }

  async run(action, context = {}) {
    // Garde injecté par les commandes ; les chemins historiques restent
    // inchangés. Les groupes et roues transmettent ce contexte à leurs enfants.
    assertCommandContext(context.shouldExecute);
    context.assertActionAllowed?.(action, context);
    const config = action.config || {};
    // Une action de compteur liée à un jeu est aussi un accès à ce pack,
    // même si elle a été appelée depuis une règle ou un aperçu direct.
    if (config.packId) this.gameHub?.assertAccess?.(safeString(config.packId, 160));
    const shouldExecute = typeof context.shouldExecute === "function" || typeof context.assertActionAllowed === "function" ? () => {
      try { assertCommandContext(context.shouldExecute); context.assertActionAllowed?.(action, context); return true; }
      catch { return false; }
    } : undefined;
    switch (action.type) {
      case "overlay.alert":
      case "overlay.media": {
        const payload = {
          id: action.id,
          // « overlay.alert » reste l’identifiant historique de l’action Media.
          // Les deux chemins affichent seulement le média choisi, sans ancienne
          // carte d’alerte, texte ou barre de progression.
          displayMode: "media-only",
          mediaUrl: this.#localMediaUrl(config.mediaUrl),
          soundUrl: this.#localMediaUrl(config.soundUrl),
          durationMs: clamp(config.durationMs || 5000, 500, 60000),
          ...(context.overlayTarget === "match" ? { playbackId: randomUUID() } : {}),
          screen: clamp(Math.round(Number(config.screen) || 1), 1, 8),
          user: context.user
        };
        this.overlayServer.publish(context.overlayTarget === "match" ? "match-media" : "alert", payload);
        if (context.overlayTarget !== "match") this.notifyRenderer("playback", { type: "alert", ...payload });
        return { displayed: true };
      }
      case "tts.speak": {
        const tts = readState(this.store, ["settings.tts"]).settings.tts;
        if (!tts.enabled) return { skipped: true };
        const isChatComment = context?.event?.type === "chat";
        if (!isChatComment) {
          return { skipped: true, reason: "chat-only" };
        }
        if (!isTtsUserAllowed(context.event?.user, config)) {
          return { skipped: true, reason: "audience-filter" };
        }
        const text = filterTtsChatComment(
          context.event?.data?.message,
          config
        );
        if (!text) return { skipped: true };
        if (
          isChatComment &&
          !claimTtsChatComment(this.ttsReadMessages, context.event, text, this.nowImpl())
        ) {
          return { skipped: true, reason: "duplicate" };
        }
        const payload = {
          ...tts,
          ...config,
          text,
          playbackId: randomUUID(),
          screen: clamp(Math.round(Number(config.liveScreen) || 1), 1, 8)
        };
        return this.#queueAudioPlayback("tts", payload, config, context);
      }
      case "audio.play": {
        const packId = safeString(config.packId || "", 160);
        const outputDeviceId = safeString(
          config.outputDeviceId ||
            readState(this.store, ["game.connectorOverrides"]).game?.connectorOverrides?.[packId]
              ?.audioOutputDeviceId ||
            "",
          512
        );
        const payload = {
          url: this.#localMediaUrl(config.url),
          volume: clamp(config.volume ?? 1, 0, 1),
          previewScope: safeString(config.previewScope || "", 40),
          outputDeviceId,
          playbackId: randomUUID(),
          screen: clamp(Math.round(Number(config.liveScreen) || 1), 1, 8)
        };
        return this.#queueAudioPlayback("audio", payload, config, context);
      }
      case "goal.add": {
        const amount = Number(config.amount || 1);
        let updated;
        this.store.mutate((state) => {
          const goal = state.goals.find((item) => item.id === config.goalId);
          if (!goal) throw new Error("Objectif introuvable.");
          goal.current = Math.max(0, Number(goal.current || 0) + amount);
          updated = structuredClone(goal);
        });
        this.overlayServer.publish("goal", updated);
        return updated;
      }
      case "timer.add": {
        const requestedOperation = [
          "add",
          "remove",
          "random",
          "set",
          "pause",
          "resume",
          "reset"
        ].includes(String(config.operation || "add"))
          ? String(config.operation || "add")
          : "add";
        const configuredSeconds = clamp(
          config.seconds || 0,
          -MAX_TIMER_SECONDS,
          MAX_TIMER_SECONDS
        );
        const appliedSeconds = requestedOperation === "remove"
          ? -Math.abs(configuredSeconds)
          : requestedOperation === "random"
            ? Math.abs(configuredSeconds) * (this.randomImpl() < 0.5 ? -1 : 1)
            : configuredSeconds;
        const appliedPayload = {
          operation: ["remove", "random"].includes(requestedOperation)
            ? "add"
            : requestedOperation,
          seconds: appliedSeconds,
          label: safeString(config.label || "Temps restant", 100)
        };
        const runtime = this.#applyOverlayOperation("timer", appliedPayload, {
          context,
          originActionId: action.id || ""
        });
        const payload = {
          ...appliedPayload,
          operation: requestedOperation
        };
        if (runtime?.hasData) {
          payload.endsAt = runtime.timerEndsAt;
          payload.paused = runtime.timerPaused;
          payload.remainingSeconds = runtime.timerSeconds;
        }
        this.overlayServer.publish("timer", payload);
        return payload;
      }
      case "overlay.multiplier-timer": {
        const operation = [
          "add",
          "set",
          "pause",
          "resume",
          "reset"
        ].includes(String(config.operation || "add"))
          ? String(config.operation || "add")
          : "add";
        const payload = {
          operation,
          seconds: clamp(
            config.seconds || 0,
            -MAX_TIMER_SECONDS,
            MAX_TIMER_SECONDS
          ),
          multiplier: clamp(config.multiplier || 2, 1, 100),
          label: safeString(config.label || "Bonus actif", 100)
        };
        const runtime = this.#applyOverlayOperation(
          "multiplier-timer",
          payload,
          {
            context,
            originActionId: action.id || ""
          }
        );
        if (runtime?.hasData) {
          payload.endsAt = runtime.multiplierTimerEndsAt;
          payload.paused = runtime.multiplierTimerPaused;
          payload.remainingSeconds = runtime.multiplierTimerSeconds;
          payload.multiplier = runtime.multiplierTimerMultiplier;
        }
        this.overlayServer.publish("multiplier-timer", payload);
        return payload;
      }
      case "wheel.spin":
        return this.wheelActions.spin(action, config, context);
      case "action.group":
        return runActionGroup({ store: this.store, runAction: (entry, childContext) => this.run(entry, childContext), randomImpl: this.randomImpl }, action, config, context);
      case "overlay.match":
        return this.overlayServer.playMatch({
          match: safeString(config.match, 40),
          variant: safeString(config.variant || "tikcontrol", 40),
          fit: config.fit === "cover" ? "cover" : "contain"
        });
      case "game.effect":
        return this.gameHub.trigger(
          safeString(config.effectId, 120),
          context,
          config
        );
      case "overlay.like-goal":
      case "overlay.coin-jar": {
        const operation = ["adjust", "set", "reset"].includes(
          String(config.operation || "adjust")
        )
          ? String(config.operation || "adjust")
          : "adjust";
        const channel =
          action.type === "overlay.like-goal" ? "like-goal" : "coin-jar";
        const payload = {
          operation,
          amount: clamp(config.amount || 0, -100000000, 100000000)
        };
        const runtime = this.#applyOverlayOperation(channel, payload, {
          context,
          originActionId: action.id || ""
        });
        if (runtime?.hasData) {
          payload.current =
            channel === "like-goal"
              ? runtime.likeGoalCurrent
              : runtime.coinJarCurrent;
        }
        this.overlayServer.publish(channel, payload);
        return payload;
      }
      case "overlay.win-counter": {
        if (["mute","unmute"].includes(config.operation)) {
          if (!this.gameMuteService) throw Error("Le contrôle du microphone n’est pas disponible.");
          return this.gameMuteService.run(config);
        }
        const operation = ["adjust", "set", "reset", "invert", "multiplier", "random"].includes(
          String(config.operation || "adjust")
        )
          ? String(config.operation || "adjust")
          : "adjust";
        const payload = {
          operation,
          amount: clamp(config.amount || 0, -100000, 100000),
          durationSeconds: clamp(config.duration || 60, 1, 3600),
          effectId: safeString(config.effectId, 120),
          ...(context.source==="gtav-native"&&["gtav-koth-enhanced","gtav-hiking-enhanced"].includes(config.packId)&&Number(config.amount)<0?{ignoreMultiplier:true}:{}),
          viewer: safeString(
            context.user?.displayName || context.user?.name || "Viewer",
            120
          )
        };
        if (operation === "multiplier" && config.stackMode === "increment") {
          const previous = readState(this.store, ["overlaySession"]).overlaySession || {};
          const remaining = Math.max(0, Math.ceil((Number(previous.winCounterMultiplierUntil || 0) - Date.now()) / 1000));
          const cap = clamp(config.maxMultiplier || 10, 2, 100);
          payload.amount = Math.min(cap, remaining > 0 ? Number(previous.winCounterMultiplier || 1) + 1 : Math.max(1, Math.abs(payload.amount) || 2));
          if (config.addDuration === true && remaining > 0) payload.durationSeconds = Math.min(3600, remaining + payload.durationSeconds);
        }
        const runtime = this.#applyOverlayOperation(
          "win-counter",
          payload
        );
        if (runtime?.hasData && operation !== "multiplier") {
          payload.operation = "set";
          payload.amount = runtime.winCounterCurrent;
          payload.current = runtime.winCounterCurrent;
        }
        this.overlayServer.publish("win-counter", payload);
        if (operation === "multiplier") {
          const multiplier = Math.max(1, Math.abs(payload.amount) || 2);
          this.overlayServer.publish("multiplier-timer", {
            operation: "set",
            seconds: payload.durationSeconds,
            multiplier,
            label: `WINS X${multiplier}`
          });
          this.overlayServer.publish(
            "session-state",
            readState(this.store, ["overlaySession"]).overlaySession
          );
          if (
            safeString(config.packId, 120) === "gtav-montchiliad" &&
            payload.effectId === "overlay_win_x2"
          ) {
            try {
              await this.gameHub.trigger(
                payload.effectId,
                context,
                {
                  packId: "gtav-montchiliad",
                  duration: payload.durationSeconds
                }
              );
              payload.nativeSynchronized = true;
            } catch {
              payload.nativeSynchronized = false;
            }
          }
        }
        const minecraftPackId = safeString(config.packId, 120);
        if (
          ["minecraft-bedrock-box", "minecraft-sandbox-3"].includes(
            minecraftPackId
          )
        ) {
          try {
            const command =
              operation === "multiplier"
                ? `shenpulse_win x2 ${payload.durationSeconds}`
                : `shenpulse_win set ${Number(
                    payload.current ?? payload.amount ?? 0
                  )}`;
            await this.gameHub.executeMinecraftCommands(
              minecraftPackId,
              [command],
              { shouldExecute }
            );
            payload.nativeSynchronized = true;
          } catch {
            payload.nativeSynchronized = false;
          }
        }
        return payload;
      }
      case "obs.request":
        return this.obsClient.request(
          safeString(config.requestType, 120),
          config.requestData || {}
        );
      case "http.request":
        return runHttpAction(config);
      case "websocket.send":
        return this.sourceHub.send(config.connectionId, config.payload || {});
      case "chat.reply":
        return this.sourceHub.send(config.connectionId || context.source, {
          message: safeString(config.message, 450)
        });
      case "spotify.queue":
        return runSpotifyAction(this.spotifyService, config, { ...context, shouldExecute });
      case "irl.shelly":
        if (!this.shellyService) {
          throw new Error("Service Interactions IRL indisponible.");
        }
        return this.shellyService.control(config, {
          ignoreGlobalSwitch: context?.source === "manual-preview",
          shouldExecute
        });
      case "system.keys":
        return sendKeyAction(this.store, config);
      case "system.open":
        return openUrlAction(shell, config);
      case "delay":
        await new Promise((resolve) =>
          setTimeout(resolve, clamp(config.durationMs || 1000, 0, 60000))
        );
        return { waited: true };
      default:
        throw new Error(`Action inconnue : ${action.type}`);
    }
  }

  /** Une écoute privée reste locale. Le LIVE ajoute la source navigateur,
   * sans retirer le retour local. Les Matchs gardent leur source dédiée pour
   * ne pas doubler le son de leurs vidéos ; les aperçus ne sont jamais diffusés.
   */
  #queueAudioPlayback(type, payload, config, context) {
    const preview = Boolean(config.previewScope) || context.source === "manual-preview";
    const live = config.outputMode === "live" && !preview;
    if (!live || context.overlayTarget !== "match") {
      this.notifyRenderer("playback", { type, ...payload });
    }
    if (!live) return { queued: true };
    const channel = type === "audio" && context.overlayTarget === "match" ? "match-audio" : type;
    this.overlayServer.publish(channel, payload);
    return { queued: true, output: "live", screen: payload.screen };
  }

  #localMediaUrl(value) {
    const source = safeString(value, 2000);
    if (!source.startsWith("/overlay/media/")) return source;
    const urls = this.overlayServer.urls();
    const token = encodeURIComponent(readState(this.store, ["settings.overlayToken"]).settings.overlayToken);
    return `${urls.base}${source}?token=${token}`;
  }

}

module.exports = { ActionRunner, filterTtsChatComment };
