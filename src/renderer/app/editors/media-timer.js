function openTtsEditor(row) {
  const settings = snapshot.state.settings.tts || {};
  const currentRule = row?.rule || {
    id: "",
    name: "Nouvelle règle TTS",
    enabled: true,
    priority: 50,
    trigger: {
      enabled: true,
      type: "chat",
      source: "*",
      threshold: 1
    },
    conditions: [],
    cooldown: { globalMs: 0, perUserMs: 0 },
    chance: 1,
    actions: []
  };
  const currentAction = row?.action || {
    id: "",
    type: "tts.speak",
    config: {
      text: "{{data.message}}",
      voice: settings.voice || "",
      rate: settings.rate ?? 1,
      pitch: settings.pitch ?? 1,
      volume: settings.volume ?? 0.9
    }
  };
  const config = currentAction.config || {};
  openEditor({
    title: row ? "Modifier la règle TTS" : "Ajouter une règle TTS",
    kicker: "SYNTHÈSE VOCALE GLOBALE",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "Lecture des commentaires",
        "Choisissez la voix et son rendu. Le texte lu sera toujours le commentaire reçu.",
        `${field("name", "Nom de la règle", currentRule.name, "text", "required full")}
        ${ttsVoiceField("voice", config.voice || settings.voice || "")}
        ${field("rate", "Vitesse", config.rate ?? settings.rate ?? 1, "number", 'min="0.5" max="2" step="0.1"')}
        ${field("pitch", "Hauteur", config.pitch ?? settings.pitch ?? 1, "number", 'min="0" max="2" step="0.1"')}
        ${field("volume", "Volume", config.volume ?? settings.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "Filtres des commentaires",
        "Choisissez précisément quels messages peuvent être lus à voix haute.",
        ttsCommentFilterFields(config),
        "tts-filter-section"
      )}
    </div>`,
    onSubmit: async (data) => {
      const actionConfig = {
        ...config,
        text: "{{data.message}}",
        voice: data.get("voice"),
        rate: Number(data.get("rate")),
        pitch: Number(data.get("pitch")),
        volume: Number(data.get("volume")),
        readEmojis: data.has("ttsReadEmojis"),
        allowMentions: data.has("ttsAllowMentions"),
        allowCommands: data.has("ttsAllowCommands"),
        allowLinks: data.has("ttsAllowLinks")
      };
      delete actionConfig.language;
      const action = {
        ...currentAction,
        id: currentAction.id || `action_${cryptoId()}`,
        type: "tts.speak",
        config: actionConfig
      };
      const actions = [...(currentRule.actions || [])];
      if (row) actions[row.actionIndex] = action;
      else actions.push(action);
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      await api.upsert("rules", {
        ...currentRule,
        id: ruleId,
        name: data.get("name"),
        enabled: currentRule.enabled !== false,
        trigger: {
          enabled: true,
          type: "chat",
          source: "*",
          threshold: 1
        },
        conditions: [],
        cooldown: { globalMs: 0, perUserMs: 0 },
        actions
      });
      await ensureRuleInActiveProfile(ruleId);
      acceptSnapshot(await api.getSnapshot());
    }
  });
}

function openSoundEditor(row, preferredSoundId = "") {
  const preferred = SOUND_LIBRARY.find((sound) => sound.id === preferredSoundId);
  const currentRule = row?.rule || {
    id: "",
    name: preferred ? `Son · ${preferred.name}` : "Nouvelle alerte sonore",
    enabled: true,
    priority: 50,
    trigger: { type: "gift", source: "*", threshold: 1 },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 1500 },
    chance: 1,
    actions: []
  };
  const currentAction = row?.action || {
    id: "",
    type: "audio.play",
    config: { url: preferred?.url || "", volume: 0.9 }
  };
  const config = currentAction.config || {};
  openEditor({
    title: row ? "Modifier l’alerte sonore" : "Créer une alerte sonore",
    kicker: "BIBLIOTHÈQUE AUDIO",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "1. Son",
        "Recherchez, écoutez puis choisissez un son.",
        `${field("name", "Nom de l’alerte", currentRule.name, "text", "required full")}
        ${soundPickerField("soundUrl", config.url || "", {
          selectedName: config.soundName || ""
        })}
        ${field("volume", "Volume", config.volume ?? 0.9, "number", 'min="0" max="1" step="0.05"')}`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Déclencheur",
        "Associez le son à une interaction du LIVE.",
        `<label class="field"><span>Déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(currentRule.trigger?.type)}</select></label>
        ${field("threshold", "Seuil", currentRule.trigger?.threshold || 1, "number", 'min="1"')}
        <div class="editor-conditional full" data-trigger-types="gift">${giftTriggerConditionFields(currentRule.conditions)}</div>
        ${field("cooldown", "Cooldown (ms)", currentRule.cooldown?.globalMs || 1000, "number", 'min="0"')}`
      )}
    </div>`,
    onSubmit: async (data) => {
      const nextAction = {
        ...currentAction,
        id: currentAction.id || `action_${cryptoId()}`,
        type: "audio.play",
        config: {
          ...config,
          url: data.get("soundUrl"),
          soundName: data.get("soundUrlName"),
          volume: Number(data.get("volume"))
        }
      };
      const actions = [...(currentRule.actions || [])];
      if (row) actions[row.actionIndex] = nextAction;
      else actions.push(nextAction);
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      await api.upsert("rules", {
        ...currentRule,
        id: ruleId,
        name: data.get("name"),
        enabled: true,
        trigger: {
          ...(currentRule.trigger || {}),
          type: data.get("triggerType"),
          source: "*",
          threshold: Number(data.get("threshold"))
        },
        conditions: buildTriggerConditions(currentRule.conditions, data),
        cooldown: {
          ...(currentRule.cooldown || {}),
          globalMs: Number(data.get("cooldown"))
        },
        actions
      });
      await ensureRuleInActiveProfile(ruleId);
      snapshot = await api.getSnapshot();
    }
  });
}

function openTimerEditor(timer) {
  const current = timer || {
    id: "",
    name: "",
    enabled: true,
    intervalMs: 60000,
    repeatCount: 1,
    repeatDelayMs: 0,
    actionIds: [],
    lastRunAt: ""
  };
  const interval = timerIntervalParts(current.intervalMs);
  const selectedActionIds = new Set(current.actionIds || []);
  const actionRows = flattenActions();
  const actionPicker = actionRows.length
    ? actionRows
        .map(
          ({ rule, action }) => `
            <label class="timer-action-option" data-timer-action-option data-searchable="${escapeHtml(`${rule.name} ${actionTypeLabel(action.type)} ${actionDescription(action)}`.toLowerCase())}">
              <input type="checkbox" name="actionIds" value="${escapeHtml(action.id)}" ${selectedActionIds.has(action.id) ? "checked" : ""}>
              <span class="timer-action-check">✓</span>
              <span><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml(actionTypeLabel(action.type))} · ${escapeHtml(actionDescription(action))}</small></span>
            </label>`
        )
        .join("")
    : `<div class="timer-actions-empty">Créez d’abord au moins une action dans le sous-onglet Actions.</div>`;
  openEditor({
    title: timer ? "Modifier le timer" : "Créer un timer",
    kicker: "PLANIFICATEUR D’ACTIONS",
    variant: "wide",
    body: `<div class="action-editor">
      ${dialogSection(
        "1. Fréquence",
        "Choisissez à quel rythme le cycle d’actions doit démarrer.",
        `${field("name", "Nom du timer", current.name, "text", "required full autofocus")}
        <div class="timer-editor-enabled full">
          <span><strong>Timer actif</strong><small>Le compteur repart de zéro à chaque activation ou modification.</small></span>
          <span class="switch"><input type="checkbox" name="enabled" value="true" ${current.enabled !== false ? "checked" : ""}><span></span></span>
        </div>
        ${field("intervalValue", "Exécuter toutes les", interval.value, "number", 'required min="1" step="1"')}
        <label class="field"><span>Unité</span><select name="intervalUnit">
          <option value="seconds" ${interval.unit === "seconds" ? "selected" : ""}>Secondes</option>
          <option value="minutes" ${interval.unit === "minutes" ? "selected" : ""}>Minutes</option>
          <option value="hours" ${interval.unit === "hours" ? "selected" : ""}>Heures</option>
        </select></label>
        ${field("repeatCount", "Nombre d’exécutions à la suite", Math.max(1, Number(current.repeatCount || 1)), "number", 'required min="1" max="100" step="1"')}
        ${field("repeatDelaySeconds", "Pause entre deux exécutions (secondes)", Number(current.repeatDelayMs || 0) / 1000, "number", 'min="0" max="60" step="0.1"')}`,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Actions à exécuter",
        "Sélectionnez une ou plusieurs actions. Elles seront lancées dans l’ordre affiché.",
        `<label class="field full"><span>Rechercher une action</span><input type="search" data-timer-action-search placeholder="Nom, type ou configuration…"></label>
        <div class="timer-action-picker full">${actionPicker}</div>`
      )}
    </div>`,
    onSubmit: async (data) => {
      const actionIds = data.getAll("actionIds").map(String).filter(Boolean);
      if (!actionIds.length) {
        throw new Error("Sélectionnez au moins une action à exécuter.");
      }
      const multipliers = {
        seconds: 1000,
        minutes: 60000,
        hours: 3600000
      };
      const intervalUnit = data.get("intervalUnit");
      const intervalMs =
        Number(data.get("intervalValue")) *
        (multipliers[intervalUnit] || multipliers.minutes);
      await api.upsert("timers", {
        ...current,
        id: current.id || `timer_${cryptoId()}`,
        name: data.get("name"),
        enabled: data.get("enabled") === "true",
        intervalMs,
        repeatCount: Number(data.get("repeatCount")),
        repeatDelayMs: Number(data.get("repeatDelaySeconds")) * 1000,
        actionIds,
        createdAt: current.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      acceptSnapshot(await api.getSnapshot());
    }
  });
}
