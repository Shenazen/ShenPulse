"use strict";

/** Validation de la configuration avant toute écriture du scénario. */
function readActionEditorConfig(data, currentAction) {
  const config = currentAction.config || {};
  const type = data.get("actionType");
  const libraryUrl = data.get("soundLibrary");
  const rawUrl = String(libraryUrl || "").trim();
  const nextConfig = { ...config };
  const alertDisplay = type === "overlay.text" ? readActionAlertDisplay(data, config.alert, type) : config.alert || { enabled: false };
  if (type === "overlay.text") {
    nextConfig.alert = alertDisplay;
  } else if (type === "overlay.media") {
    const mediaUrl = String(data.get("url") || "").trim();
    if (!mediaUrl && !alertDisplay.enabled) {
      throw new Error("Choisissez le média à afficher.");
    }
    Object.assign(nextConfig, {
      screen: Math.min(
        8,
        Math.max(1, Math.round(Number(data.get("mediaScreen")) || 1))
      ),
      mediaUrl,
      mediaName: data.get("urlName"),
      soundUrl: data.get("soundUrl"),
      soundActionId: readProgrammedSoundReference(data, "soundUrl", currentAction),
      volume: Number(data.get("mediaVolume")) / 100,
      soundName: data.get("soundUrlName"),
      durationMs: Number(data.get("durationMs"))
    });
    delete nextConfig.title;
    delete nextConfig.message;
    delete nextConfig.color;
  } else if (type === "audio.play") {
    if (!rawUrl) {
      throw new Error("Choisissez un son à jouer.");
    }
    Object.assign(nextConfig, {
      url: rawUrl,
      soundActionId: readProgrammedSoundReference(data, "soundLibrary", currentAction),
      soundName: data.get("soundLibraryName"),
      volume: Number(data.get("audioVolume"))
    });
  } else if (type === "tts.speak") {
    Object.assign(nextConfig, {
      ...readTtsModerationFields(data),
      text: data.get("text"),
      voice: data.get("ttsVoice"),
      rate: Number(data.get("ttsRate")),
      pitch: Number(data.get("ttsPitch")),
      volume: Number(data.get("ttsVolume")),
      readEmojis: data.has("ttsReadEmojis"),
      allowMentions: data.has("ttsAllowMentions"),
      allowCommands: data.has("ttsAllowCommands"),
      allowLinks: data.has("ttsAllowLinks")
    });
    delete nextConfig.language;
  } else if (type === "goal.add") {
    Object.assign(nextConfig, {
      goalId: data.get("goalId"),
      amount: Number(data.get("amount"))
    });
  } else if (type === "timer.add") {
    Object.assign(nextConfig, {
      seconds: Math.abs(Number(data.get("seconds")) || 0),
      label: data.get("label"),
      operation: data.get("timerOperation")
    });
  } else if (type === "wheel.spin") {
    Object.assign(nextConfig, {
      wheelId: data.get("wheelId") || "",
      choices: String(data.get("choices") || "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
      color: data.get("wheelColor")
    });
  } else if (type === "action.group") {
    const actionIds = [
      ...new Set(
        data.getAll("groupActionIds").map(String).filter(Boolean)
      )
    ];
    if (!actionIds.length) {
      throw new Error("Sélectionnez au moins une action à exécuter.");
    }
    if (
      currentAction.id &&
      actionIds.includes(String(currentAction.id))
    ) {
      throw new Error("Un groupe d’actions ne peut pas s’appeler lui-même.");
    }
    const mode = data.get("actionGroupMode") === "random"
      ? "random"
      : "all";
    Object.assign(nextConfig, {
      mode,
      actionIds,
      randomCount:
        mode === "random"
          ? Math.min(
              actionIds.length,
              Math.max(
                1,
                Math.floor(
                  Number(data.get("actionGroupRandomCount")) || 1
                )
              )
            )
          : actionIds.length
    });
  } else if (type === "overlay.match") {
    const match = data.get("matchName") || "x2";
    const variant = overlayCatalog.normalizeAnimationVariant(match, data.get("matchVariant") || "tikcontrol");
    if (!variant) throw new Error("Cette variante d’animation Match est indisponible.");
    Object.assign(nextConfig, {
      match,
      variant,
      fit: data.get("matchFit") === "cover" ? "cover" : "contain",
      volume: Number(data.get("matchVolume")) / 100
    });
  } else if (type === "game.effect") {
    Object.assign(nextConfig, {
      packId: data.get("gamePackId") || config.packId || "",
      effectId: data.get("effectId"),
      duration: Number(data.get("effectDuration")),
      quantity: Number(data.get("quantity"))
    });
  } else if (type === "irl.shelly") {
    const deviceId = data.get("irlDeviceId");
    if (!deviceId) throw new Error("Choisissez une prise PlugPlus.");
    Object.assign(nextConfig, {
      deviceId,
      operation: data.get("irlOperation") || "cycle",
      durationMs: Number(data.get("irlDurationMs") || 3000)
    });
  } else if (type === "spotify.queue") {
    Object.assign(nextConfig, {
      operation: data.get("spotifyOperation"),
      query: data.get("spotifyQuery"),
      uri: data.get("spotifyQuery"),
      chatCommand: String(data.get("spotifyChatCommand") || "").trim(),
      maxDurationMinutes: Math.max(0, Math.min(120, Number(data.get("spotifyMaxDurationMinutes")) || 0)),
      mode: data.get("spotifyMode"),
      allowExplicit: data.get("spotifyExplicit") !== "false"
    });
  } else if (type === "obs.request") {
    Object.assign(nextConfig, {
      requestType: data.get("requestType"),
      requestData: parseJsonInput(data.get("requestData"), "Données OBS")
    });
  } else if (type === "http.request") {
    Object.assign(nextConfig, {
      url: data.get("httpUrl"),
      method: data.get("httpMethod"),
      timeoutMs: Number(data.get("timeoutMs")),
      headers: parseJsonInput(data.get("httpHeaders"), "En-têtes HTTP"),
      body: parseJsonInput(data.get("httpBody"), "Corps HTTP")
    });
  } else if (type === "websocket.send") {
    Object.assign(nextConfig, {
      connectionId: data.get("connectionId"),
      payload: parseJsonInput(data.get("wsPayload"), "Message WebSocket")
    });
  } else if (type === "chat.reply") {
    Object.assign(nextConfig, {
      connectionId: data.get("chatConnectionId"),
      message: data.get("chatMessage")
    });
  } else if (type === "system.keys") {
    nextConfig.keys = data.get("keys");
  } else if (type === "system.open") {
    nextConfig.url = data.get("openUrl");
  } else if (type === "delay") {
    nextConfig.durationMs = Number(data.get("delayMs"));
  }
  return nextConfig;
}
