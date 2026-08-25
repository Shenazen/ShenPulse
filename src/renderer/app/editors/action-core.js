"use strict";

/**
 * Éditeurs des actions, règles, profils et connexions.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function openActionEditor(row) {
  const preset = arguments[1] || {};
  const currentRule = row?.rule || preset.rule || {
    id: "",
    name: "",
    enabled: true,
    priority: 50,
    trigger: {
      enabled: false,
      type: "gift",
      source: "*",
      threshold: 1
    },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 2000 },
    chance: 1,
    actions: []
  };
  const automaticTriggerEnabled = hasAutomaticTrigger(currentRule);
  const currentAction = row?.action || preset.action || {
    id: "",
    type: "overlay.media",
    config: {
      durationMs: 5000
    }
  };
  if (!row && !preset.action && !canAccessActionType(currentAction.type)) {
    currentAction.type =
      Object.keys(ACTION_TYPE_LABELS).find(canAccessActionType) ||
      currentAction.type;
  }
  const config = currentAction.config || {};
  const accessiblePacks = visibleGamePacks();
  const configuredPack =
    snapshot.packs.find(
      (pack) =>
        pack.id ===
        (config.packId || snapshot.state.session.activeGamePackId)
    );
  const activePack =
    (configuredPack && (canAccessGame(configuredPack) || Boolean(row))
      ? configuredPack
      : accessiblePacks[0]) ||
    snapshot.packs[0];
  const editorGamePacks =
    activePack && !accessiblePacks.some((pack) => pack.id === activePack.id)
      ? [activePack, ...accessiblePacks]
      : accessiblePacks;
  const configuredWheels = normalizeWheelConfig(
    overlayConfig("wheel")
  ).wheels;
  const irlDevices = (snapshot.state.settings.irl?.devices || []).filter(
    isPlugPlusIrlDevice
  );
  const connectionOptions = [
    ["", "Source du déclencheur"],
    ...snapshot.state.connections.map((connection) => [
      connection.id,
      connection.name
    ])
  ];
  const connectionsSelect = (name, current) =>
    `<label class="field"><span>Connexion</span><select name="${name}">${connectionOptions
      .map(
        ([value, label]) =>
          `<option value="${escapeHtml(value)}" ${value === current ? "selected" : ""}>${escapeHtml(label)}</option>`
      )
      .join("")}</select></label>`;
  const actionFields = [
    conditionalFields(
      "overlay.media",
      `<div class="form-grid">
        <label class="field"><span>Écran Media</span><select name="mediaScreen">
          ${Array.from({ length: 8 }, (_value, index) => {
            const screen = index + 1;
            return `<option value="${screen}" ${Number(config.screen || 1) === screen ? "selected" : ""}>Écran ${screen}</option>`;
          }).join("")}
        </select><small>Utilisez l’URL du même écran affichée en bas de la page Actions.</small></label>
        ${field("durationMs", "Durée à l’écran (ms)", config.durationMs || 5000, "number", 'min="500" max="60000"')}
        ${mediaPickerField(
          "url",
          "Média affiché",
          config.mediaUrl || "",
          config.mediaName || "",
          { optional: false }
        )}
        ${soundPickerField("soundUrl", config.soundUrl || "", {
          label: "Son optionnel",
          selectedName: config.soundName || "",
          optional: true
        })}
      </div>`
    ),
    conditionalFields(
      "audio.play",
      `<div class="form-grid">${soundPickerField(
        "soundLibrary",
        config.url || "",
        { selectedName: config.soundName || "" }
      )}${field("audioVolume", "Volume", config.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}</div>`
    ),
    conditionalFields(
      "tts.speak",
      `<div class="form-grid">
        <label class="field full"><span>Texte prononcé</span><textarea name="text" required>${escapeHtml(config.text || "{{data.message}}")}</textarea><small>Avec le déclencheur « Message du chat », ShenPulse lit uniquement le commentaire reçu.</small></label>
        ${ttsVoiceField("ttsVoice", config.voice || snapshot.state.settings.tts.voice || "")}
        ${field("ttsRate", "Vitesse", config.rate ?? snapshot.state.settings.tts.rate ?? 1, "number", 'min="0.5" max="2" step="0.1"')}
        ${field("ttsPitch", "Hauteur", config.pitch ?? snapshot.state.settings.tts.pitch ?? 1, "number", 'min="0" max="2" step="0.1"')}
        ${field("ttsVolume", "Volume", config.volume ?? snapshot.state.settings.tts.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}
        ${ttsCommentFilterFields(config)}
      </div>`
    ),
    conditionalFields(
      "goal.add",
      `<div class="form-grid">
        <label class="field"><span>Objectif</span><select name="goalId">${snapshot.state.goals.map((goal) => `<option value="${escapeHtml(goal.id)}" ${(config.goalId || snapshot.state.goals[0]?.id) === goal.id ? "selected" : ""}>${escapeHtml(goal.name)}</option>`).join("")}</select></label>
        ${field("amount", "Valeur ajoutée", config.amount ?? 1, "number")}
      </div>`
    ),
    conditionalFields(
      "timer.add",
      `<div class="form-grid">
        <label class="field"><span>Commande du timer</span><select name="timerOperation">${[
          ["add", "Ajouter / retirer du temps"],
          ["set", "Définir le temps"],
          ["pause", "Mettre en pause"],
          ["resume", "Reprendre"],
          ["reset", "Réinitialiser"]
        ].map(([value, label]) => `<option value="${value}" ${(config.operation || "add") === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        ${field("seconds", "Secondes", config.seconds ?? 30, "number", 'min="-86400" max="86400"')}
        ${field("label", "Libellé", config.label || "TEMPS RESTANT", "text", "full")}
      </div>`
    ),
    conditionalFields(
      "wheel.spin",
      `<div class="form-grid">
        <label class="field full"><span>Roue à lancer</span><select name="wheelId">${configuredWheels.map((wheel) => `<option value="${escapeHtml(wheel.id)}" ${(config.wheelId || overlayConfig("wheel").selectedWheelId) === wheel.id ? "selected" : ""}>${escapeHtml(wheel.name)} · ${wheel.segments.length} segments</option>`).join("")}</select><small>Les segments, couleurs et actions sont gérés depuis la page Overlays.</small></label>
        <label class="field full"><span>Segments temporaires (optionnel)</span><textarea name="choices" placeholder="Laissez vide pour utiliser la roue configurée">${escapeHtml((config.choices || []).join("\n"))}</textarea><small>Un choix par ligne. Cette liste ne modifie pas la roue enregistrée.</small></label>
        ${field("wheelColor", "Couleur de secours", config.color || "#ff6a00", "color")}
      </div>`
    ),
    conditionalFields(
      "overlay.match",
      `<div class="form-grid">
        <label class="field full"><span>Animation à lire</span><select name="matchName">${MATCH_OVERLAYS.map(([_key, label, value]) => `<option value="${escapeHtml(value)}" ${(config.match || "x2") === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select><small>Le lecteur Match unique attendra la fin de la vidéo en cours avant de lancer celle-ci.</small></label>
        <label class="field"><span>Version</span><select name="matchVariant">${MATCH_VARIANTS.map(([value, label]) => `<option value="${escapeHtml(value)}" ${(config.variant || "tikcontrol") === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select></label>
        <label class="field"><span>Ajustement</span><select name="matchFit"><option value="contain" ${config.fit !== "cover" ? "selected" : ""}>Vidéo entière</option><option value="cover" ${config.fit === "cover" ? "selected" : ""}>Remplir la source</option></select></label>
      </div>`
    ),
    conditionalFields(
      "game.effect",
      `<div class="form-grid">
        <label class="field full"><span>Jeu ciblé</span><select name="gamePackId">${editorGamePacks.map((pack) => `<option value="${escapeHtml(pack.id)}" ${activePack?.id === pack.id ? "selected" : ""}>${escapeHtml(pack.name)} · ${pack.effects.length} interactions${canAccessGame(pack) ? "" : " · masqué"}</option>`).join("")}</select><small>Le jeu sera activé automatiquement avant le test ou l'exécution.</small></label>
        <label class="field full"><span>Effet du jeu actif</span><select name="effectId">${(activePack?.effects || []).map((effect) => `<option value="${escapeHtml(effect.id)}" ${(config.effectId || activePack.effects[0]?.id) === effect.id ? "selected" : ""}>${escapeHtml(effect.name)} · ${escapeHtml(effect.id)}</option>`).join("")}</select></label>
        ${field("quantity", "Quantité", config.quantity ?? 1, "number", 'min="1" max="100"')}
        ${field("effectDuration", "Durée (secondes)", config.duration ?? 0, "number", 'min="0"')}
      </div>`
    ),
    conditionalFields(
      "irl.shelly",
      `<div class="form-grid">
        <label class="field full"><span>Prise PlugPlus</span><select name="irlDeviceId" required>${irlDevices.map((device) => `<option value="${escapeHtml(device.id)}" ${(config.deviceId || irlDevices.find(isControllableIrlDevice)?.id) === device.id ? "selected" : ""} ${isControllableIrlDevice(device) ? "" : "disabled"}>${escapeHtml(device.name)} · ${escapeHtml(device.host || "adresse en attente")}${isControllableIrlDevice(device) ? "" : " · aucun relais"}</option>`).join("")}</select></label>
        <label class="field"><span>Commande</span><select name="irlOperation">
          ${[
            ["on", "Allumer"],
            ["off", "Éteindre"],
            ["toggle", "Basculer ON / OFF"],
            ["cycle", "Éteindre puis rallumer"],
            ["pulse", "Allumer puis éteindre"]
          ].map(([value, label]) => `<option value="${value}" ${(config.operation || "cycle") === value ? "selected" : ""}>${label}</option>`).join("")}
        </select></label>
        ${field("irlDurationMs", "Durée du cycle (ms)", config.durationMs || 3000, "number", 'min="500" max="60000" step="100"')}
        <div class="field full"><small>1000 ms = 1 seconde. Le changement final est programmé dans la prise puis forcé par ShenPulse à la fin du délai.</small></div>
      </div>`
    ),
    conditionalFields(
      "spotify.queue",
      `<div class="form-grid">
        <label class="field"><span>Commande Spotify</span><select name="spotifyOperation">${["request","queue","play","pause","next","now_playing","volume_up","volume_down"].map((operation) => `<option value="${operation}" ${(config.operation || "request") === operation ? "selected" : ""}>${operation}</option>`).join("")}</select></label>
        <label class="field"><span>Mode de demande</span><select name="spotifyMode"><option value="queue" ${config.mode !== "play" ? "selected" : ""}>Ajouter à la file</option><option value="play" ${config.mode === "play" ? "selected" : ""}>Lire immédiatement</option></select></label>
        ${field("spotifyQuery", "Titre, URL ou URI", config.query || config.uri || "{{data.message}}", "text", "full")}
        <label class="field"><span>Contenu explicite</span><select name="spotifyExplicit"><option value="true" ${config.allowExplicit !== false ? "selected" : ""}>Autorisé</option><option value="false" ${config.allowExplicit === false ? "selected" : ""}>Refusé</option></select></label>
      </div>`
    ),
    conditionalFields(
      "obs.request",
      `<div class="form-grid">${field("requestType", "Commande OBS WebSocket", config.requestType || "GetVersion", "text", "full")}<label class="field full"><span>Données JSON</span><textarea name="requestData">${escapeHtml(JSON.stringify(config.requestData || {}, null, 2))}</textarea></label></div>`
    ),
    conditionalFields(
      "http.request",
      `<div class="form-grid">
        ${field("httpUrl", "URL HTTP(S)", config.url || "https://", "url", "full")}
        <label class="field"><span>Méthode</span><select name="httpMethod">${["POST","PUT","PATCH","GET","DELETE"].map((method) => `<option ${String(config.method || "POST").toUpperCase() === method ? "selected" : ""}>${method}</option>`).join("")}</select></label>
        ${field("timeoutMs", "Délai maximal (ms)", config.timeoutMs || 10000, "number", 'min="500" max="30000"')}
        <label class="field"><span>En-têtes JSON</span><textarea name="httpHeaders">${escapeHtml(JSON.stringify(config.headers || {}, null, 2))}</textarea></label>
        <label class="field"><span>Corps JSON</span><textarea name="httpBody">${escapeHtml(JSON.stringify(config.body || {}, null, 2))}</textarea></label>
      </div>`
    ),
    conditionalFields(
      "websocket.send",
      `<div class="form-grid">${connectionsSelect("connectionId", config.connectionId || "")}<label class="field full"><span>Message JSON</span><textarea name="wsPayload">${escapeHtml(JSON.stringify(config.payload || {}, null, 2))}</textarea></label></div>`
    ),
    conditionalFields(
      "chat.reply",
      `<div class="form-grid">${connectionsSelect("chatConnectionId", config.connectionId || "")}${field("chatMessage", "Réponse envoyée", config.message || "Merci {{user.displayName}} !", "text", "full")}</div>`
    ),
    conditionalFields(
      "system.keys",
      `<div class="form-grid">${field("keys", "Touches Windows", config.keys || "", "text", "full")}<div class="field full"><small>Cette action nécessite l’autorisation « Simulation de touches » dans Paramètres.</small></div></div>`
    ),
    conditionalFields(
      "system.open",
      `<div class="form-grid">${field("openUrl", "URL HTTP(S) à ouvrir", config.url || "https://", "url", "full")}</div>`
    ),
    conditionalFields(
      "delay",
      `<div class="form-grid">${field("delayMs", "Durée d’attente (ms)", config.durationMs || 1000, "number", 'min="0" max="60000"')}</div>`
    )
  ].join("");
  openEditor({
    title: row ? "Modifier l’action" : "Créer une action",
    kicker: "ACTION & DÉCLENCHEUR",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "1. Action",
        "Définissez ce que ShenPulse exécutera.",
        `<div class="action-editor-basics full">
          ${field("name", "Nom de l’action", currentRule.name, "text", "required autofocus")}
          <label class="field full"><span>Type d’action</span><select name="actionType" data-editor-action-type>${actionTypeOptions(currentAction.type)}</select></label>
        </div>
        <div class="action-config-stage full">
          <div class="action-config-heading"><strong>Configuration</strong><small>Seuls les réglages utiles au type choisi sont affichés.</small></div>
          ${actionFields}
        </div>`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Déclencheur",
        "Optionnel : lancez automatiquement cette action lors d’un événement précis.",
        `<div class="trigger-editor-fields editor-conditional full" data-trigger-enabled>
          <label class="field"><span>Déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(currentRule.trigger?.type)}</select></label>
          ${field("threshold", "Seuil / quantité", currentRule.trigger?.threshold || 1, "number", 'min="1"')}
          <div class="editor-conditional full" data-trigger-types="gift">${giftTriggerConditionFields(currentRule.conditions)}</div>
          <div class="editor-conditional full" data-trigger-types="chat">${field("messageCondition", "Le message contient (optionnel)", conditionValue(currentRule.conditions, "data.message", "contains"), "text", "full")}</div>
          ${field("usernameCondition", "@ viewer précis (optionnel)", conditionValue(currentRule.conditions, "user.name", "equals"), "text", "full")}
        </div>`,
        "trigger-option-section",
        `<label class="dialog-header-toggle" title="Activer ou désactiver le déclencheur automatique">
          <span>Automatique</span>
          <span class="switch"><input type="checkbox" name="triggerEnabled" value="true" data-editor-trigger-enabled ${automaticTriggerEnabled ? "checked" : ""}><span></span></span>
        </label>`
      )}
      <details class="dialog-advanced" data-trigger-enabled>
        <summary>Réglages avancés du déclencheur</summary>
        <div class="form-grid">
          ${field("globalCooldown", "Cooldown global (ms)", currentRule.cooldown?.globalMs || 0, "number", 'min="0"')}
          ${field("userCooldown", "Cooldown viewer (ms)", currentRule.cooldown?.perUserMs || 0, "number", 'min="0"')}
        </div>
      </details>
    </div>`,
    onSubmit: async (data) => {
      const type = data.get("actionType");
      const triggerEnabled = data.get("triggerEnabled") === "true";
      const libraryUrl = data.get("soundLibrary");
      const rawUrl = String(libraryUrl || "").trim();
      const nextConfig = { ...config };
      if (type === "overlay.media") {
        const mediaUrl = String(data.get("url") || "").trim();
        if (!mediaUrl) {
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
          soundName: data.get("soundLibraryName"),
          volume: Number(data.get("audioVolume"))
        });
      } else if (type === "tts.speak") {
        Object.assign(nextConfig, {
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
          seconds: Number(data.get("seconds")),
          label: data.get("label"),
          operation: data.get("timerOperation")
        });
      } else if (type === "wheel.spin") {
        Object.assign(nextConfig, {
          wheelId: data.get("wheelId") || "",
          choices: String(data.get("choices") || "").split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
          color: data.get("wheelColor")
        });
      } else if (type === "overlay.match") {
        Object.assign(nextConfig, {
          match: data.get("matchName") || "x2",
          variant: data.get("matchVariant") || "tikcontrol",
          fit: data.get("matchFit") === "cover" ? "cover" : "contain"
        });
      } else if (type === "game.effect") {
        Object.assign(nextConfig, {
          packId: data.get("gamePackId") || activePack?.id || "",
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
      const nextAction = {
        ...currentAction,
        id: currentAction.id || `action_${cryptoId()}`,
        type,
        config: nextConfig
      };
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      const actions = [...(currentRule.actions || [])];
      if (row) actions[row.actionIndex] = nextAction;
      else actions.push(nextAction);
      await api.upsert("rules", {
        ...currentRule,
        id: ruleId,
        name: data.get("name"),
        enabled: true,
        trigger: {
           ...(currentRule.trigger || {}),
           enabled: triggerEnabled,
           type: triggerEnabled
             ? data.get("triggerType")
             : currentRule.trigger?.type || "gift",
           source: "*",
           threshold: triggerEnabled
             ? Number(data.get("threshold"))
             : Number(currentRule.trigger?.threshold || 1)
         },
         conditions: triggerEnabled
           ? buildTriggerConditions(currentRule.conditions, data)
           : currentRule.conditions || [],
        cooldown: {
          globalMs: triggerEnabled
            ? Number(data.get("globalCooldown"))
            : Number(currentRule.cooldown?.globalMs || 0),
          perUserMs: triggerEnabled
            ? Number(data.get("userCooldown"))
            : Number(currentRule.cooldown?.perUserMs || 0)
        },
        actions
      });
      await ensureRuleInActiveProfile(ruleId);
      snapshot = await api.getSnapshot();
    }
  });
}

function parseJsonInput(value, label) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    throw new Error(`${label} : JSON invalide.`);
  }
}
