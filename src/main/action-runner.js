"use strict";

const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { shell } = require("electron");
const { clamp, safeString } = require("./utils");
const { renderValue } = require("./template");
const {
  applyOverlayOperation
} = require("./overlay-session-state");

const TTS_EMOJI_PATTERN =
  /(?:[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\u20E3\uFE0E\uFE0F])/gu;
const TTS_LINK_PATTERN =
  /(?:\bhttps?:\/\/|\bwww\.)\S+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:[\w-]+\.)+(?:com|fr|net|org|gg|tv|io|co)\b/iu;
const TTS_EVENT_DEDUPE_MS = 30 * 60 * 1000;
const TTS_CONTENT_DEDUPE_MS = 30 * 1000;
const TTS_DEDUPE_MAX_ENTRIES = 4000;

function filterTtsChatComment(value, config = {}) {
  let text = safeString(value, 1000).trim();
  if (!text) return "";
  if (text.startsWith("@") && config.allowMentions !== true) return "";
  if (/^[!/]/u.test(text) && config.allowCommands !== true) return "";
  if (TTS_LINK_PATTERN.test(text) && config.allowLinks !== true) return "";
  if (config.readEmojis !== true) {
    text = text
      .replace(TTS_EMOJI_PATTERN, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return safeString(text, 1000);
}

function normalizeWheelRuntimeSettings(settings = {}, design = "classic") {
  const referenceDefaults = {
    font: "Kalam",
    fontSize: 50,
    textOrientation: "horizontal",
    textColor: "#fff8ec",
    textShadowColor: "#2b170c",
    textShadowStrength: 55,
    textRadius: 100,
    textSegmentOffset: 0,
    textBoxWidth: 100,
    textBoxHeight: 240,
    textAngleOffset: 0,
    textAlign: "center",
    textClamp: false,
    textMaxLines: 4,
    lineSpacing: 50,
    letterSpacing: 50,
    showBase: true,
    soundActive: true,
    announceDuration: 0,
    spinDuration: 5,
    waitDuration: 3,
    scale: 100,
    glow: 82,
    showWinner: true,
    pointerPosition: "top",
    alwaysVisible: true,
    entranceAnimation: "fade",
    exitAnimation: "fade",
    resultDuration: 4
  };
  const usesRegressedDefaults =
    settings.font === "Inter" &&
    Number(settings.fontSize) === 19 &&
    settings.textOrientation === "radial" &&
    Number(settings.textRadius) === 34 &&
    Number(settings.textBoxHeight) === 42;
  const overrides = usesRegressedDefaults
    ? design === "royal"
      ? {
          font: "Georgia",
          textColor: "#fff5cb",
          glow: 100,
          spinDuration: 7
        }
      : {}
    : settings;
  return { ...referenceDefaults, ...overrides, announceDuration: 0 };
}

class ActionRunner {
  constructor({
    store,
    overlayServer,
    gameHub,
    obsClient,
    sourceHub,
    spotifyService,
    shellyService,
    notifyRenderer,
    onOverlayOperation = () => {},
    setTimeoutImpl = setTimeout,
    nowImpl = Date.now
  }) {
    this.store = store;
    this.overlayServer = overlayServer;
    this.gameHub = gameHub;
    this.obsClient = obsClient;
    this.sourceHub = sourceHub;
    this.spotifyService = spotifyService;
    this.shellyService = shellyService;
    this.notifyRenderer = notifyRenderer;
    this.onOverlayOperation = onOverlayOperation;
    this.setTimeoutImpl = setTimeoutImpl;
    this.nowImpl = nowImpl;
    this.wheelSpinActive = false;
    this.wheelSpinQueue = [];
    this.ttsReadMessages = new Map();
  }

  #claimTtsChatComment(event = {}, text = "") {
    const now = this.nowImpl();
    const source = safeString(event.source || "unknown", 80).toLowerCase();
    const viewer = safeString(
      event.user?.id || event.user?.name || "anonymous",
      160
    ).toLowerCase();
    const normalizedText = safeString(text, 1000)
      .normalize("NFKC")
      .toLocaleLowerCase("fr")
      .replace(/\s+/g, " ")
      .trim();
    const keys = [
      event.id
        ? {
            key: `event:${source}:${safeString(event.id, 160)}`,
            ttl: TTS_EVENT_DEDUPE_MS
          }
        : null,
      {
        key: `content:${source}:${viewer}:${normalizedText}`,
        ttl: TTS_CONTENT_DEDUPE_MS
      }
    ].filter(Boolean);
    const duplicate = keys.some(({ key, ttl }) => {
      const previous = this.ttsReadMessages.get(key);
      return Number.isFinite(previous) && now - previous < ttl;
    });
    for (const { key } of keys) {
      this.ttsReadMessages.delete(key);
      this.ttsReadMessages.set(key, now);
    }
    if (this.ttsReadMessages.size > TTS_DEDUPE_MAX_ENTRIES) {
      for (const [key, timestamp] of this.ttsReadMessages) {
        if (now - timestamp >= TTS_EVENT_DEDUPE_MS) {
          this.ttsReadMessages.delete(key);
        }
      }
      while (this.ttsReadMessages.size > TTS_DEDUPE_MAX_ENTRIES) {
        this.ttsReadMessages.delete(this.ttsReadMessages.keys().next().value);
      }
    }
    return !duplicate;
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
      // A completion hook can never invalidate the original action.
    }
    return runtime;
  }

  async run(action, context) {
    const config = action.config || {};
    switch (action.type) {
      case "overlay.alert":
      case "overlay.media": {
        const payload = {
          id: action.id,
          // "overlay.alert" is the legacy identifier of the Media action.
          // Both paths render only the selected asset, without the obsolete
          // alert card, text or progress bar.
          displayMode: "media-only",
          mediaUrl: this.#localMediaUrl(config.mediaUrl),
          soundUrl: this.#localMediaUrl(config.soundUrl),
          durationMs: clamp(config.durationMs || 5000, 500, 60000),
          screen: clamp(Math.round(Number(config.screen) || 1), 1, 8),
          user: context.user
        };
        this.overlayServer.publish("alert", payload);
        this.notifyRenderer("playback", { type: "alert", ...payload });
        return { displayed: true };
      }
      case "tts.speak": {
        if (!this.store.getState().settings.tts.enabled) return { skipped: true };
        const isChatComment = context?.event?.type === "chat";
        if (!isChatComment) {
          return { skipped: true, reason: "chat-only" };
        }
        const text = filterTtsChatComment(
          context.event?.data?.message,
          config
        );
        if (!text) return { skipped: true };
        if (
          isChatComment &&
          !this.#claimTtsChatComment(context.event, text)
        ) {
          return { skipped: true, reason: "duplicate" };
        }
        const payload = {
          ...this.store.getState().settings.tts,
          ...config,
          text,
          playbackId: randomUUID(),
          screen: clamp(Math.round(Number(config.liveScreen) || 1), 1, 8)
        };
        if (config.outputMode === "live") {
          this.overlayServer.publish("tts", payload);
          return { queued: true, output: "live", screen: payload.screen };
        }
        this.notifyRenderer("playback", { type: "tts", ...payload });
        return { queued: true };
      }
      case "audio.play": {
        const payload = {
          url: this.#localMediaUrl(config.url),
          volume: clamp(config.volume ?? 1, 0, 1),
          previewScope: safeString(config.previewScope || "", 40),
          playbackId: randomUUID(),
          screen: clamp(Math.round(Number(config.liveScreen) || 1), 1, 8)
        };
        if (config.outputMode === "live") {
          this.overlayServer.publish("audio", payload);
          return { queued: true, output: "live", screen: payload.screen };
        }
        this.notifyRenderer("playback", { type: "audio", ...payload });
        return { queued: true };
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
          seconds: clamp(config.seconds || 0, -86400, 86400),
          label: safeString(config.label || "Temps restant", 100)
        };
        const runtime = this.#applyOverlayOperation("timer", payload, {
          context,
          originActionId: action.id || ""
        });
        if (runtime?.hasData) {
          payload.endsAt = runtime.timerEndsAt;
          payload.paused = runtime.timerPaused;
          payload.remainingSeconds = runtime.timerSeconds;
        }
        this.overlayServer.publish("timer", payload);
        return payload;
      }
      case "wheel.spin": {
        const wheelConfig =
          this.store.getState().settings.overlayConfigs?.wheel || {};
        const configuredWheels = Array.isArray(wheelConfig.wheels)
          ? wheelConfig.wheels
          : [];
        const enabledWheels = configuredWheels.filter(
          (wheel) => wheel.enabled !== false
        );
        const selectedWheel =
          enabledWheels.find((wheel) => wheel.id === config.wheelId) ||
          enabledWheels.find(
            (wheel) => wheel.id === wheelConfig.selectedWheelId
          ) ||
          enabledWheels[0] ||
          null;
        if (configuredWheels.length && !selectedWheel) {
          throw new Error("Aucune roue active n’est disponible.");
        }
        if (this.wheelSpinActive) {
          this.wheelSpinQueue.push({ action, context });
          return {
            queued: true,
            queuePosition: this.wheelSpinQueue.length,
            wheelId: config.wheelId || selectedWheel?.id || ""
          };
        }
        this.wheelSpinActive = true;
        const overrideChoices = Array.isArray(config.choices)
          ? config.choices.filter(Boolean).slice(0, 100)
          : [];
        const configuredSegments = Array.isArray(selectedWheel?.segments)
          ? selectedWheel.segments.slice(0, 100)
          : [];
        const segments =
          overrideChoices.length >= 2
            ? overrideChoices.map((label, index) => ({
                id: `temporary_${index}`,
                label,
                color:
                  selectedWheel?.segments?.[index]?.color ||
                  config.color ||
                  "#ff6a00",
                action: "none",
                actionId: ""
              }))
            : configuredSegments.length >= 2
              ? configuredSegments
              : [
                  { id: "bonus", label: "Bonus", color: "#ff6a00" },
                  { id: "challenge", label: "Défi", color: "#111111" }
                ];
        const winnerIndex = Math.floor(Math.random() * segments.length);
        const winnerSegment = segments[winnerIndex] || null;
        const winnerAction =
          winnerSegment?.action === "spin"
            ? "spin"
            : winnerSegment?.actionId
              ? "action"
              : winnerSegment?.action || "none";
        const choices = segments.map((segment) => segment.label);
        const payload = {
          wheelId: selectedWheel?.id || "",
          wheelName: selectedWheel?.name || "Roue d’actions",
          choices,
          colors: segments.map(
            (segment) => segment.color || config.color || "#ff6a00"
          ),
          winner: winnerSegment?.label || null,
          winnerIndex,
          winnerAction,
          design: selectedWheel?.design || wheelConfig.design || "classic",
          settings: normalizeWheelRuntimeSettings(
            {
              ...(wheelConfig || {}),
              ...(selectedWheel?.settings || {})
            },
            selectedWheel?.design || wheelConfig.design || "classic"
          ),
          color: config.color || "#ff6a00"
        };
        this.overlayServer.publish("wheel", payload);
        const resultDelayMs =
          (
            Math.min(
              30,
              Math.max(1, Number(payload.settings.spinDuration || 6))
            ) +
            Math.max(0, Number(payload.settings.waitDuration || 0))
          ) * 1000;
        if (winnerAction === "action" && winnerSegment.actionId) {
          const linkedAction = (this.store.getState().rules || [])
            .flatMap((rule) => rule.actions || [])
            .find((item) => item.id === winnerSegment.actionId);
          if (linkedAction && linkedAction.id !== action.id) {
            const hydratedLinkedAction = {
              ...linkedAction,
              config: renderValue(linkedAction.config || {}, context)
            };
            const actionTimer = this.setTimeoutImpl(() => {
              this.run(hydratedLinkedAction, context).catch(() => {});
            }, resultDelayMs);
            actionTimer.unref?.();
          }
        }
        if (
          winnerSegment?.action === "spin" &&
          Number(config.reSpinDepth || 0) < 3
        ) {
          const reSpin = this.setTimeoutImpl(() => {
            this.run(
              {
                ...action,
                config: {
                  ...config,
                  wheelId: selectedWheel?.id || config.wheelId,
                  reSpinDepth: Number(config.reSpinDepth || 0) + 1
                }
              },
              context
            ).catch(() => {});
          }, resultDelayMs);
          reSpin.unref?.();
        }
        const cycleDelayMs =
          resultDelayMs +
          Math.min(
            30,
            Math.max(1, Number(payload.settings.resultDuration || 4))
          ) * 1000 +
          700;
        const queueTimer = this.setTimeoutImpl(() => {
          this.wheelSpinActive = false;
          const nextSpin = this.wheelSpinQueue.shift();
          if (nextSpin) {
            this.run(nextSpin.action, nextSpin.context).catch(() => {});
          }
        }, cycleDelayMs);
        queueTimer.unref?.();
        return payload;
      }
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
        const operation = ["adjust", "set", "reset", "multiplier", "random"].includes(
          String(config.operation || "adjust")
        )
          ? String(config.operation || "adjust")
          : "adjust";
        const payload = {
          operation,
          amount: clamp(config.amount || 0, -100000, 100000),
          durationSeconds: clamp(config.duration || 60, 1, 3600),
          effectId: safeString(config.effectId, 120),
          viewer: safeString(
            context.user?.displayName || context.user?.name || "Viewer",
            120
          )
        };
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
            this.store.getState().overlaySession
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
              [command]
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
        return this.#http(config);
      case "websocket.send":
        return this.sourceHub.send(config.connectionId, config.payload || {});
      case "chat.reply":
        return this.sourceHub.send(config.connectionId || context.source, {
          message: safeString(config.message, 450)
        });
      case "spotify.queue":
        return this.#spotify(config);
      case "irl.shelly":
        if (!this.shellyService) {
          throw new Error("Service Interactions IRL indisponible.");
        }
        return this.shellyService.control(config, {
          ignoreGlobalSwitch: context?.source === "manual-preview"
        });
      case "system.keys":
        return this.#sendKeys(config);
      case "system.open":
        return this.#open(config);
      case "delay":
        await new Promise((resolve) =>
          setTimeout(resolve, clamp(config.durationMs || 1000, 0, 60000))
        );
        return { waited: true };
      default:
        throw new Error(`Action inconnue : ${action.type}`);
    }
  }

  #localMediaUrl(value) {
    const source = safeString(value, 2000);
    if (!source.startsWith("/overlay/media/")) return source;
    const urls = this.overlayServer.urls();
    const token = encodeURIComponent(this.store.getState().settings.overlayToken);
    return `${urls.base}${source}?token=${token}`;
  }

  async #http(config) {
    const url = String(config.url || "");
    if (!/^https?:\/\//i.test(url)) throw new Error("URL HTTP(S) requise.");
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      clamp(config.timeoutMs || 10000, 500, 30000)
    );
    try {
      const response = await fetch(url, {
        method: config.method || "POST",
        headers: { "Content-Type": "application/json", ...(config.headers || {}) },
        body:
          ["GET", "HEAD"].includes(String(config.method || "POST").toUpperCase())
            ? undefined
            : JSON.stringify(config.body || {}),
        signal: controller.signal
      });
      const text = await response.text();
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 300)}`);
      return { status: response.status, body: text.slice(0, 5000) };
    } finally {
      clearTimeout(timer);
    }
  }

  async #spotify(config) {
    if (!this.spotifyService) throw new Error("Service Spotify indisponible.");
    return this.spotifyService.control(config);
  }

  #sendKeys(config) {
    if (!this.store.getState().settings.allowKeystrokes) {
      throw new Error("La simulation de touches doit être autorisée dans Paramètres.");
    }
    const keys = safeString(config.keys, 200);
    if (!keys) throw new Error("Séquence de touches vide.");
    return new Promise((resolve, reject) => {
      const script =
        "Add-Type -AssemblyName System.Windows.Forms; " +
        "[System.Windows.Forms.SendKeys]::SendWait($args[0])";
      const child = spawn(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script, keys],
        { windowsHide: true, stdio: "ignore" }
      );
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) resolve({ sent: true });
        else reject(new Error(`Simulation de touches échouée (${code}).`));
      });
    });
  }

  async #open(config) {
    const url = String(config.url || "");
    if (!/^https?:\/\//i.test(url)) throw new Error("Seules les URL HTTP(S) sont permises.");
    await shell.openExternal(url);
    return { opened: true };
  }
}

module.exports = { ActionRunner, filterTtsChatComment };
