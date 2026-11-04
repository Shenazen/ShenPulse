"use strict";

const { randomUUID } = require("node:crypto");
const { nativeMinecraftWinCommand } = require("./game-runtime/minecraft-native-wins");
const { shell } = require("electron");
const { clamp, safeString } = require("./utils");
const { renderValue } = require("./template");
const { readState } = require("./state-projection");
const { assertCommandContext } = require("./commands/context-guard");
const { filterTtsChatComment, isTtsUserAllowed, claimTtsChatComment } = require("./actions/tts-policy");
const { runActionGroup } = require("./actions/groups");
const { actionAlertDisplay } = require("./actions/alert-display");
const { LinkedActionAudio } = require("./actions/linked-audio");
const { WheelActionController } = require("./actions/wheel");
const { resolveVoice, naturalVoice } = require("../shared/tts-voices");
const { NaturalVoiceService } = require("./natural-voice-service");
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
    randomImpl = Math.random,
    voiceService = new NaturalVoiceService()
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
    this.voiceService = voiceService;
    this.wheelActions = new WheelActionController({ store, overlayServer, setTimeoutImpl, runAction: (entry, context) => this.run(entry, context) });
    this.ttsReadMessages = new Map();
    this.linkedAudio = new LinkedActionAudio(store, nowImpl);
    this.ttsPlaybackTail = Promise.resolve();
    this.ttsPlaybackPending = 0;
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
    const alertScope = action.config?.alert?.enabled === true ? this.#alertScope() : null;
    const result = await this.#runAction(action, context);
    // Les médias composent déjà leur alerte. Les autres actions peuvent afficher
    // le même texte sur un écran Media sans modifier leur sortie principale.
    if ((!['overlay.media', 'overlay.alert', 'overlay.text'].includes(action.type) || context.overlayTarget === "match" && action.type !== "overlay.text") &&
        !result?.skipped && !result?.cancelled && result?.ok !== false) {
      const alert = this.#actionAlert(action, context);
      if (!alert) return result;
      let current = true;
      try { assertCommandContext(context.shouldExecute); context.assertActionAllowed?.(action, context); } catch { current = false; }
      if (alert && current && alertScope === this.#alertScope()) {
        this.#publishMediaAlert({ id: action.id, displayMode: "media-only", alert,
          screen: alert.screen, durationMs: alert.durationMs });
      }
    }
    return result;
  }

  #alertScope() {
    return JSON.stringify(readState(this.store, ["settings.account.uid", "session.profileId"]));
  }

  #actionAlert(action, context) {
    if (action.config?.alert?.enabled !== true) return null;
    return actionAlertDisplay(action.config, context, readState(this.store, ["statistics"]).statistics || {});
  }

  #publishMediaAlert(payload) {
    this.overlayServer.publish("alert", payload);
    this.notifyRenderer("playback", { type: "alert", ...payload });
  }

  async #runAction(action, context = {}) {
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
      case "overlay.text": {
        if (config.embeddedInMedia) return { displayed: true, embedded: true };
        const alert = this.#actionAlert(action, context);
        if (!alert) return { skipped: true, reason: "empty-text" };
        this.#publishMediaAlert({ id: action.id, displayMode: "media-only", alert,
          screen: alert.screen, durationMs: alert.durationMs });
        return { displayed: true };
      }
      case "overlay.alert":
      case "overlay.media": {
        const alert = this.#actionAlert(action, context);
        const mediaUrl = this.#localMediaUrl(config.mediaUrl);
        if (!mediaUrl && !alert) return { skipped: true, reason: "empty-media" };
        const sound = this.linkedAudio.resolve(action);
        const soundUrl = sound && this.linkedAudio.claim(sound, context) ? sound.url : "";
        const payload = {
          id: action.id,
          // « overlay.alert » reste l’identifiant historique de l’action Media.
          // Le nom et le texte sont une option explicite, indépendante des
          // anciens champs title/message des actions historiques.
          displayMode: "media-only",
          mediaUrl,
          ...(alert ? { alert } : {}),
          soundUrl: this.#localMediaUrl(soundUrl),
          volume: config.volume ?? 1, originActionId: action.id || "",
          durationMs: clamp(config.durationMs || 5000, 500, 60000),
          ...(context.overlayTarget === "match" ? { playbackId: randomUUID() } : {}),
          screen: clamp(Math.round(Number(config.screen) || 1), 1, 8),
          user: context.user
        };
        if (context.overlayTarget === "match") {
          if (mediaUrl) this.overlayServer.publish("match-media", payload);
        } else this.#publishMediaAlert(payload);
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
          config,
          context.event?.data?.raw
        );
        if (!text) return { skipped: true };
        if (
          isChatComment &&
          context.source !== "manual-preview" &&
          !claimTtsChatComment(this.ttsReadMessages, context.event, text, this.nowImpl())
        ) {
          return { skipped: true, reason: "duplicate" };
        }
        const payload = {
          ...tts,
          ...config,
          text,
          playbackId: randomUUID(),
          originActionId: action.id || "",
          screen: clamp(Math.round(Number(config.liveScreen) || 1), 1, 8)
        };
        payload.voice = resolveVoice(tts, config, context.source === "manual-preview" ? {} : context.event?.user);
        const scope = () => JSON.stringify(readState(this.store, ["settings.account.uid", "session.profileId", "session.startedAt", "session.running"]));
        const initialScope = scope();
        const current = () => scope() === initialScope && readState(this.store, ["settings.tts.enabled"]).settings?.tts?.enabled !== false &&
          (!context.shouldExecute || context.shouldExecute());
        if (this.ttsPlaybackPending >= 20) return { skipped: true, reason: "voice-queue-full" };
        this.ttsPlaybackPending++;
        const job = this.ttsPlaybackTail.then(async () => {
          let voiceEngine = "windows";
          if (naturalVoice(payload.voice)) {
            payload.language = naturalVoice(payload.voice).lang;
            const result = await this.voiceService.synthesize(payload, { shouldExecute: current });
            if (result?.cancelled || !current()) return { skipped: true, reason: "context-changed" };
            if (result?.audioUrl) { Object.assign(payload, result); voiceEngine = "natural"; }
            else { payload.voice = ""; payload.voiceFallback = true; }
          }
          if (!current()) return { skipped: true, reason: "context-changed" };
          return { ...this.#queueAudioPlayback("tts", payload, config, context), ...(voiceEngine === "natural" ? { voiceEngine } : {}), ...(payload.voiceFallback ? { voiceFallback: true } : {}) };
        });
        this.ttsPlaybackTail = job.catch(() => {});
        try { return await job; } finally { this.ttsPlaybackPending--; }
      }
      case "audio.play": {
        const sound = this.linkedAudio.resolve(action);
        const live = config.outputMode === "live" && !config.previewScope && context.source !== "manual-preview";
        const local = !live || context.overlayTarget !== "match";
        const targets = {
          local: local && (!sound || this.linkedAudio.claim(sound, context, "local")),
          live: live && (!sound || this.linkedAudio.claim(sound, context, "live"))
        };
        if (!targets.local && !targets.live) return { skipped: true, reason: "linked-sound-already-played" };
        const packId = safeString(config.packId || "", 160);
        const outputDeviceId = safeString(
          config.outputDeviceId ||
            readState(this.store, ["game.connectorOverrides"]).game?.connectorOverrides?.[packId]
              ?.audioOutputDeviceId ||
            "",
          512
        );
        const payload = {
          url: this.#localMediaUrl(sound?.url || config.url),
          volume: clamp(config.volume ?? 1, 0, 1),
          previewScope: safeString(config.previewScope || "", 40),
          outputDeviceId,
          playbackId: randomUUID(),
          originActionId: action.id || "",
          screen: clamp(Math.round(Number(config.liveScreen) || 1), 1, 8)
        };
        return this.#queueAudioPlayback("audio", payload, config, context, targets);
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
            fit: config.fit === "cover" ? "cover" : "contain",
            volume: config.volume ?? 1, originActionId: action.id
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
        const nativeWinCommand = nativeMinecraftWinCommand(minecraftPackId);
        if (nativeWinCommand) {
          try {
            const state = readState(this.store, ["overlaySession", "settings.overlayConfigs.winCounter"]);
            const session = state.overlaySession || {};
            const remaining = Math.max(0, Math.min(3600, Math.ceil((Number(session.winCounterMultiplierUntil || 0) - Date.now()) / 1000)));
            const factor = remaining > 0 ? Math.max(1, Number(session.winCounterMultiplier) || 1) : 1;
            const configuredTarget = Number(state.settings?.overlayConfigs?.winCounter?.target);
            const target = Number.isFinite(configuredTarget) ? Math.max(0, configuredTarget) : 10;
            await this.gameHub.executeMinecraftCommands(minecraftPackId, [`${nativeWinCommand} sync ${Number(session.winCounterCurrent) || 0} ${factor} ${remaining} ${target}`], { shouldExecute });
            payload.nativeSynchronized=true;
          } catch { payload.nativeSynchronized=false; }
        }
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
  #queueAudioPlayback(type, payload, config, context, targets = {}) {
    payload.audioKind = context.overlayTarget === "match" ? "matches" : type === "tts" ? "tts" : "sounds";
    const preview = Boolean(config.previewScope) || context.source === "manual-preview";
    const live = config.outputMode === "live" && !preview && targets.live !== false;
    if (targets.local !== false && (!live || context.overlayTarget !== "match")) {
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
