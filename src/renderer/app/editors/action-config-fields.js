"use strict";

/** Réglages de chaque type, partagés par les lignes du scénario. */
function actionEditorConfigFields(currentAction, row) {
  const config = currentAction.config || {};
  const configuredTimerSeconds = Number(config.seconds ?? 30);
  const timerOperation =
    (config.operation || "add") === "add" && configuredTimerSeconds < 0
      ? "remove"
      : config.operation || "add";
  const timerSeconds = ["remove", "random"].includes(timerOperation)
    ? Math.abs(configuredTimerSeconds)
    : configuredTimerSeconds;
  const accessiblePacks = visibleGamePacks().flatMap(pack => pack.modeSelector ? pack.modes : [pack]);
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
  const groupedActionIds = new Set(
    (Array.isArray(config.actionIds) ? config.actionIds : [])
      .map(String)
      .filter(Boolean)
  );
  const actionGroupMode = config.mode === "random" ? "random" : "all";
  const groupedActionRows = flattenActions().filter(
    ({ action }) =>
      action?.id && String(action.id) !== String(currentAction.id || "")
  );
  const groupedActionCount = Math.max(1, groupedActionIds.size);
  const actionGroupRandomCount = Math.min(
    groupedActionCount,
    Math.max(1, Math.floor(Number(config.randomCount) || 1))
  );
  const actionGroupPicker = groupedActionRows.length
    ? groupedActionRows.map(({ rule: ownerRule, action }) => `
      <label class="timer-action-option trigger-action-option" data-action-group-option data-searchable="${escapeHtml(`${ownerRule.name} ${actionTypeLabel(action.type)} ${actionDescription(action)}`.toLowerCase())}">
        <input type="checkbox" name="groupActionIds" value="${escapeHtml(action.id)}" ${groupedActionIds.has(String(action.id)) ? "checked" : ""}>
        <span class="timer-action-check">✓</span>
        <span><strong>${escapeHtml(ownerRule.name)}</strong><small>${escapeHtml(actionTypeLabel(action.type))} · ${escapeHtml(actionDescription(action))}</small></span>
      </label>`).join("")
    : `<div class="timer-actions-empty">Créez d’abord au moins une autre action à exécuter.</div>`;
  const actionFields = [
    conditionalFields("overlay.text", actionAlertDisplayFields({ alert: { ...config.alert, enabled: true } }, { standalone: true })),
    conditionalFields(
      "overlay.media",
      `<div class="form-grid">
        <label class="field"><span>Écran Media</span><select name="mediaScreen">
          ${Array.from({ length: 8 }, (_value, index) => {
            const screen = index + 1;
            return `<option value="${screen}" ${Number(config.screen || 1) === screen ? "selected" : ""}>Écran ${screen}</option>`;
          }).join("")}
        </select><small>Utilisez l’URL du même écran affichée en bas de la page Actions.</small></label>
        ${field("mediaVolume", "Volume (%)", Math.round(Number(config.volume ?? 1) * 100), "number", 'min="0" max="100" step="1"')}${field("durationMs", "Durée à l’écran (ms)", config.durationMs || 5000, "number", 'min="500" max="60000"')}
        ${mediaPickerField(
          "url",
          "Média affiché",
          config.mediaUrl || "",
          config.mediaName || "",
          { optional: true }
        )}
        ${soundPickerField("soundUrl", config.soundUrl || "", {
          selectedActionId: config.soundActionId || "", excludeActionId: currentAction.id,
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
        { selectedName: config.soundName || "", selectedActionId: config.soundActionId || "", excludeActionId: currentAction.id }
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
          ["add", "Ajouter du temps"],
          ["remove", "Retirer du temps"],
          ["random", "Ajouter ou retirer au hasard"],
          ["set", "Définir le temps"],
          ["pause", "Mettre en pause"],
          ["resume", "Reprendre"],
          ["reset", "Réinitialiser"]
        ].map(([value, label]) => `<option value="${value}" ${timerOperation === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        ${field("seconds", "Secondes", timerSeconds, "number", 'min="0" max="86399999"')}
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
      "action.group",
      `<div class="form-grid">
        <label class="field"><span>Mode d’exécution</span><select name="actionGroupMode" data-action-group-mode>
          <option value="all" ${actionGroupMode === "all" ? "selected" : ""}>Toutes les actions sélectionnées</option>
          <option value="random" ${actionGroupMode === "random" ? "selected" : ""}>Un nombre obligatoire au hasard</option>
        </select></label>
        <label class="field" data-action-group-random-count><span>Nombre obligatoire à tirer</span><input name="actionGroupRandomCount" type="number" min="1" max="${groupedActionCount}" value="${actionGroupRandomCount}"><small data-action-group-random-count-help>Exactement ${actionGroupRandomCount} action${actionGroupRandomCount > 1 ? "s" : ""} sera${actionGroupRandomCount > 1 ? "ont" : ""} tirée${actionGroupRandomCount > 1 ? "s" : ""} à chaque exécution.</small></label>
        <label class="field full"><span>Rechercher une action</span><input type="search" data-action-group-search placeholder="Nom, type ou configuration…"></label>
        <div class="timer-action-picker trigger-action-picker full">${actionGroupPicker}</div>
        <div class="field full"><small>Les actions sélectionnées démarrent ensemble. Une sous-action en erreur n’empêche pas les autres de s’exécuter. Les groupes peuvent appeler d’autres groupes ; ShenPulse bloque automatiquement les références circulaires.</small></div>
      </div>`
    ),
    conditionalFields(
      "overlay.match",
      `<div class="form-grid">
        <label class="field full"><span>Animation à lire</span><select name="matchName" data-action-match-name>${MATCH_OVERLAYS.map(([_key, label, value]) => `<option value="${escapeHtml(value)}" ${(config.match || "x2") === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select><small>Le lecteur Match est exclusif : cette animation arrête la précédente et recommence immédiatement à zéro.</small></label>
        <label class="field"><span>Version</span><select name="matchVariant">${actionMatchVariantOptions(config.match || "x2", config.variant || "tikcontrol")}</select></label>
        ${field("matchVolume", "Volume (%)", Math.round(Number(config.volume ?? 1) * 100), "number", 'min="0" max="100" step="1"')}
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
        ${field("spotifyChatCommand", "Commande du chat (optionnelle)", config.chatCommand || "", "text", 'placeholder="!song"')}
        ${field("spotifyMaxDurationMinutes", "Durée maximale du titre (minutes)", config.maxDurationMinutes || 0, "number", 'min="0" max="120" step="1"')}
        <small class="full">Avec une commande, ShenPulse recherche le titre placé après celle-ci. Exemple : !song Daft Punk One More Time. Une durée de 0 autorise toutes les durées.</small>
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
  return actionFields;
}
