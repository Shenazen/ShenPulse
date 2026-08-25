"use strict";

/**
 * Éditeurs d'interactions de jeux et appareils IRL.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

async function ensureRuleInActiveProfile() {
  // The store now attaches every rule directly to the active profile workspace.
}

function actionTypeOptions(currentType) {
  const canonicalCurrentType = canonicalActionType(currentType);
  const groups = [
    ["VISUEL & AUDIO", ["overlay.media", "audio.play"]],
    ["INTERACTIONS", ["goal.add", "timer.add", "wheel.spin", "overlay.match", "chat.reply"]],
    ["INTÉGRATIONS", ["irl.shelly", "spotify.queue", "obs.request", "http.request", "websocket.send"]],
    ["SYSTÈME", ["system.keys", "system.open", "delay"]]
  ];
  const existingHiddenOption =
    canonicalCurrentType && !canAccessActionType(canonicalCurrentType)
      ? `<optgroup label="ACTION EXISTANTE"><option value="${escapeHtml(canonicalCurrentType)}" selected>${escapeHtml(actionTypeOptionLabel(canonicalCurrentType))} · masquée par l’administration</option></optgroup>`
      : "";
  return existingHiddenOption + groups
    .map(
      ([label, types]) =>
        `<optgroup label="${label}">${types
          .filter(canAccessActionType)
          .map(
            (type) =>
              `<option value="${escapeHtml(type)}" ${type === canonicalCurrentType ? "selected" : ""}>${escapeHtml(actionTypeOptionLabel(type))}</option>`
          )
          .join("")}</optgroup>`
    )
    .join("");
}

function gameInteractionRowData(row) {
  if (!row) return "";
  return [
    `data-rule="${escapeHtml(row.rule.id)}"`,
    `data-row-action="${escapeHtml(row.action.id || "")}"`,
    `data-index="${row.actionIndex}"`
  ].join(" ");
}

function isMinecraftWinCounterPack(packId) {
  return ["minecraft-bedrock-box", "minecraft-sandbox-3"].includes(
    String(packId || "")
  );
}

function openGameInteractionCatalog(pack, row = null) {
  gameInteractionEditorContext = null;
  gameInteractionCatalogContext = {
    packId: pack.id,
    row
  };
  const groups = [
    ...new Set(
      (pack.effects || []).map(
        (effect) => effect.category || "Interaction"
      )
    )
  ].sort((left, right) => left.localeCompare(right, "fr"));
  const currentEffectId = row?.action.config?.effectId || "";
  const rowData = gameInteractionRowData(row);
  openEditor({
    title: row ? "Changer l’interaction" : "Ajouter une interaction",
    kicker: `${pack.name.toLocaleUpperCase("fr")} · ${pack.effects.length} ACTIONS DISPONIBLES`,
    variant: "effect-library",
    body: `<div class="game-effect-library">
      <header class="game-effect-library-intro">
        <div><span>CATALOGUE DU JEU</span><h3>Choisissez l’action à déclencher</h3><p>Chaque interaction reprend son visuel et sa description. Vous configurerez le cadeau, le follow, les likes ou le message juste après.</p></div>
        <strong>${pack.effects.length}</strong>
      </header>
      <label class="game-effect-library-search">
        <span>⌕</span>
        <input type="search" data-game-effect-library-search autofocus placeholder="Rechercher une action, une catégorie ou un effet">
      </label>
      <div class="game-effect-library-groups">
        ${groups.map((category) => {
          const effects = pack.effects.filter(
            (effect) => (effect.category || "Interaction") === category
          );
          return `<section class="game-effect-library-group" data-game-effect-library-group>
            <header><span>${escapeHtml(category)}</span><strong>${effects.length}</strong></header>
            <div>${effects.map((effect) => {
              const searchText =
                `${effect.name} ${effect.description || ""} ${category} ${effect.code || effect.id}`
                  .toLocaleLowerCase("fr");
              const art = effect.image
                ? `<img src="${escapeHtml(effect.image)}" alt="" loading="lazy">`
                : `<span class="game-effect-library-fallback">${escapeHtml(effect.icon || "◇")}</span>`;
              return `<button type="button" class="game-effect-library-option ${effect.id === currentEffectId ? "selected" : ""}" data-select-game-effect data-pack="${escapeHtml(pack.id)}" data-effect="${escapeHtml(effect.id)}" data-filter="${escapeHtml(searchText)}" ${rowData}>
                ${art}
                <span><strong>${escapeHtml(effect.name)}</strong><small>${escapeHtml(effect.description || "Interaction de jeu ShenPulse.")}</small></span>
                <b>${effect.id === currentEffectId ? "✓" : "＋"}</b>
              </button>`;
            }).join("")}</div>
          </section>`;
        }).join("")}
      </div>
      <p class="game-effect-library-empty" data-game-effect-library-empty hidden>Aucune interaction ne correspond à cette recherche.</p>
    </div>`,
    onSubmit: null
  });
}

function gameEffectParameterFields(effect, config) {
  if (effect.winCounter && isMinecraftWinCounterPack(config.packId)) {
    const sameEffect = config.effectId === effect.id;
    const operation = sameEffect
      ? config.operation || effect.winCounter.operation || "adjust"
      : effect.winCounter.operation || "adjust";
    const amount = Number(
      sameEffect
        ? config.amount ?? effect.winCounter.amount ?? 0
        : effect.winCounter.amount ?? 0
    );
    const amountLabel =
      operation === "multiplier"
        ? "Multiplicateur WINS"
        : operation === "random"
          ? "Amplitude WINS (+/-)"
          : "Variation du compteur WINS";
    const amountLimits =
      operation === "multiplier" || operation === "random"
        ? 'min="1" max="100000" step="1"'
        : 'min="-100000" max="100000" step="1"';
    return `${field("winCounterAmount", amountLabel, amount, "number", amountLimits)}
      ${operation === "multiplier" ? field("effectDuration", "Durée de l’effet (secondes)", config.duration ?? effect.duration ?? 60, "number", 'min="1" max="3600"') : ""}`;
  }
  const parameters = Array.isArray(effect.parameters)
    ? effect.parameters
    : [];
  if (!parameters.length) {
    return `${field("quantity", "Quantité", config.quantity ?? 1, "number", 'min="1" max="1000"')}
      ${field("effectDuration", "Durée de l’effet (secondes)", config.duration ?? 0, "number", 'min="0" max="3600"')}`;
  }
  return parameters
    .map((parameter) => {
      const name = `effectParameter_${parameter.id}`;
      const value =
        config.parameters?.[parameter.id] ??
        parameter.defaultValue ??
        parameter.min ??
        0;
      const constraints = [
        `min="${Number(parameter.min ?? 0)}"`,
        `max="${Number(parameter.max ?? 100000)}"`,
        `step="${Number(parameter.step ?? 1)}"`
      ].join(" ");
      return field(
        name,
        parameter.label || parameter.id,
        value,
        "number",
        constraints
      );
    })
    .join("");
}

function gameEffectParametersFromForm(effect, data) {
  return Object.fromEntries(
    (effect.parameters || []).map((parameter) => {
      const raw = Number(data.get(`effectParameter_${parameter.id}`));
      const minimum = Number(parameter.min ?? 0);
      const maximum = Number(parameter.max ?? 100000);
      const fallback = Number(parameter.defaultValue ?? minimum);
      const value = Number.isFinite(raw) ? raw : fallback;
      return [
        parameter.id,
        Math.min(maximum, Math.max(minimum, value))
      ];
    })
  );
}

function gameWinCounterConfigFromForm(effect, config, data) {
  if (!effect.winCounter) return {};
  if (!isMinecraftWinCounterPack(config.packId)) {
    return {
      amount: Number(effect.winCounter.amount || 0),
      operation: effect.winCounter.operation || "adjust"
    };
  }
  const sameEffect = config.effectId === effect.id;
  const fallbackAmount = Number(
    sameEffect
      ? config.amount ?? effect.winCounter.amount ?? 0
      : effect.winCounter.amount ?? 0
  );
  const rawAmount = data.get("winCounterAmount");
  const parsedAmount =
    rawAmount === null || String(rawAmount).trim() === ""
      ? fallbackAmount
      : Number(rawAmount);
  return {
    amount: Number.isFinite(parsedAmount) ? parsedAmount : fallbackAmount,
    operation: sameEffect
      ? config.operation || effect.winCounter.operation || "adjust"
      : effect.winCounter.operation || "adjust"
  };
}

function gameInteractionDraftFromForm(
  pack,
  effect,
  { currentRule, currentAction, row },
  data
) {
  const config = currentAction.config || {};
  const nextAction = {
    ...currentAction,
    id: currentAction.id || `action_${cryptoId()}`,
    type: effect.actionType || "game.effect",
    config: {
      ...config,
      packId: pack.id,
      effectId: effect.id,
      quantity: Math.max(
        1,
        Number(data.get("quantity")) || Number(effect.quantity || 1)
      ),
      duration: Math.max(
        0,
        Number(data.get("effectDuration")) || Number(effect.duration || 0)
      ),
      parameters: gameEffectParametersFromForm(effect, data),
      ...gameWinCounterConfigFromForm(effect, config, data)
    }
  };
  const actions = [...(currentRule.actions || [])];
  const actionIndex = row ? Number(row.actionIndex) : actions.length;
  if (row) actions[actionIndex] = nextAction;
  else actions.push(nextAction);
  const automatic = data.get("triggerEnabled") === "true";
  const nextTitle =
    String(data.get("interactionTitle") || "").trim() || effect.name;
  const rule = {
    ...currentRule,
    id: currentRule.id || `rule_${cryptoId()}`,
    name: `${pack.name} · ${nextTitle}`,
    enabled: data.get("effectEnabled") === "true",
    gameInteraction: {
      ...(currentRule.gameInteraction || {}),
      title: nextTitle
    },
    trigger: {
      ...(currentRule.trigger || {}),
      enabled: automatic,
      type: data.get("triggerType") || "gift",
      source: "*",
      threshold: Math.max(1, Number(data.get("threshold")) || 1)
    },
    conditions: automatic
      ? buildTriggerConditions(currentRule.conditions, data)
      : currentRule.conditions || [],
    cooldown: {
      globalMs: Math.round(
        Math.max(0, Number(data.get("globalCooldownSeconds")) || 0) * 1000
      ),
      perUserMs: Math.round(
        Math.max(0, Number(data.get("userCooldownSeconds")) || 0) * 1000
      )
    },
    actions
  };
  return {
    rule,
    action: nextAction,
    actionIndex,
    isNew: !row || row.isNew === true
  };
}

function openGameInteractionEditor(pack, effect, row = null) {
  const currentRule = row?.rule || {
    id: "",
    name: `${pack.name} · ${effect.name}`,
    enabled: true,
    priority: 50,
    trigger: {
      enabled: true,
      type: "gift",
      source: "*",
      threshold: 1
    },
    conditions: [],
    cooldown: { globalMs: 1000, perUserMs: 2000 },
    chance: 1,
    actions: []
  };
  const currentAction = row?.action || {
    id: "",
    type: effect.actionType || "game.effect",
    config: {
      packId: pack.id,
      effectId: effect.id,
      quantity: Number(effect.quantity || 1),
      duration: Number(effect.duration || 0),
      parameters: Object.fromEntries(
        (effect.parameters || []).map((parameter) => [
          parameter.id,
          Number(parameter.defaultValue || 0)
        ])
      ),
      ...(effect.winCounter
        ? {
            amount: Number(effect.winCounter.amount || 0),
            operation: effect.winCounter.operation || "adjust"
          }
        : {})
    }
  };
  const config = currentAction.config || {};
  const triggerEnabled = hasAutomaticTrigger(currentRule);
  const image = effect.image
    ? `<img src="${escapeHtml(effect.image)}" alt="${escapeHtml(effect.name)}">`
    : `<span>${escapeHtml(effect.icon || "◇")}</span>`;
  const rowData = gameInteractionRowData(row);
  const interactionTitle =
    currentRule.gameInteraction?.title || effect.name;
  gameInteractionCatalogContext = null;
  gameInteractionEditorContext = {
    packId: pack.id,
    effectId: effect.id,
    pack,
    effect,
    currentRule,
    currentAction,
    row
  };
  openEditor({
    title:
      row && row.isNew !== true
        ? "Modifier l’interaction"
        : "Configurer l’interaction",
    kicker: "INTERACTION DE JEU",
    variant: "effect",
    body: `<div class="game-interaction-editor">
      <section class="game-interaction-editor-hero">
        <div class="game-interaction-editor-art">${image}</div>
        <div><small>${escapeHtml(effect.category || "Interaction")}</small><h3>${escapeHtml(effect.name)}</h3><p>${escapeHtml(effect.description || "Interaction de jeu ShenPulse.")}</p><button type="button" class="button small ghost game-interaction-change" data-open-game-effect-library data-pack="${escapeHtml(pack.id)}" data-effect="${escapeHtml(effect.id)}" ${rowData}>Changer l’interaction</button></div>
      </section>
      <label class="game-interaction-enabled">
        <span class="switch"><input type="checkbox" name="effectEnabled" value="true" ${currentRule.enabled !== false ? "checked" : ""}><span></span></span>
        <span><strong>Interaction active</strong><small>Le public peut utiliser cette interaction pendant le LIVE.</small></span>
      </label>
      ${dialogSection(
        "Déclencheur TikTok",
        "Associez un événement ou un cadeau précis à cet effet.",
        `<label class="field"><span>Type de déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(currentRule.trigger?.type)}</select></label>
        ${field("threshold", "Seuil / quantité", currentRule.trigger?.threshold || 1, "number", 'min="1"')}
        <div class="editor-conditional full" data-trigger-types="gift">${giftTriggerConditionFields(currentRule.conditions, { giftLabel: "Cadeau TikTok précis (optionnel)" })}</div>
        <div class="editor-conditional full" data-trigger-types="chat">${field("messageCondition", "Le message contient (optionnel)", conditionValue(currentRule.conditions, "data.message", "contains"), "text", "full")}</div>
        ${field("usernameCondition", "@ viewer précis (optionnel)", conditionValue(currentRule.conditions, "user.name", "equals"), "text", "full")}`,
        "game-interaction-trigger-section",
        `<label class="dialog-header-toggle" title="Activer ou désactiver le déclenchement automatique"><span>Automatique</span><span class="switch"><input type="checkbox" name="triggerEnabled" value="true" data-editor-trigger-enabled ${triggerEnabled ? "checked" : ""}><span></span></span></label>`
      )}
      ${dialogSection(
        "Réglages de l’effet",
        "Ajustez son intensité et ses délais sans quitter le jeu.",
        `${field("interactionTitle", "Nom affiché", interactionTitle, "text", "required full")}
        ${gameEffectParameterFields(effect, config)}
        ${field("globalCooldownSeconds", "Cooldown global (secondes)", Math.max(0, Number(currentRule.cooldown?.globalMs || 0) / 1000), "number", 'min="0" max="3600" step="0.1"')}
        ${field("userCooldownSeconds", "Cooldown par viewer (secondes)", Math.max(0, Number(currentRule.cooldown?.perUserMs || 0) / 1000), "number", 'min="0" max="3600" step="0.1"')}`
      )}
    </div>`,
    onSubmit: async (data) => {
      const draft = gameInteractionDraftFromForm(
        pack,
        effect,
        { currentRule, currentAction, row },
        data
      );
      acceptSnapshot(
        (await api.saveGameInteraction(pack.id, draft.rule)) ||
          (await api.getSnapshot())
      );
    }
  });
}

async function refreshIrlDiscovery() {
  irlBusy = true;
  render();
  try {
    const result = await api.irl.scan({ timeoutMs: 1600 });
    if (result.snapshot) acceptSnapshot(result.snapshot);
    irlDiscovery = {
      accessPoints: Array.isArray(result.accessPoints) ? result.accessPoints : [],
      currentNetwork: result.currentNetwork || ""
    };
    return irlDiscovery;
  } finally {
    irlBusy = false;
    render();
  }
}

async function openIrlPairEditor() {
  const discovery = await refreshIrlDiscovery();
  if (!discovery.accessPoints.length) {
    throw new Error(
      "Aucun réseau PlugPlus n’a été détecté. Mettez la prise en mode association puis réessayez."
    );
  }
  openEditor({
    title: "Associer une prise PlugPlus",
    kicker: "INTERACTIONS IRL · CONFIGURATION LOCALE",
    submitLabel: "Associer la prise",
    pendingLabel: "Association en cours…",
    body: `<div class="irl-pair-dialog">
      <section class="irl-pair-warning"><span>⌁</span><div><strong>Le Wi-Fi du PC va changer temporairement</strong><p>ShenPulse se connecte directement à la prise, lui transmet le réseau de la maison puis reconnecte le PC. Internet peut être coupé quelques secondes.</p></div></section>
      <div class="form-grid">
        <label class="field full"><span>Prise en mode association</span><select name="accessPointSsid" required>${discovery.accessPoints.map((network) => `<option value="${escapeHtml(network.ssid)}">${escapeHtml(network.ssid)}</option>`).join("")}</select></label>
        ${field("wifiSsid", "Wi-Fi de la maison", discovery.currentNetwork, "text", "full required")}
        <label class="field full"><span>Mot de passe du Wi-Fi</span><input name="wifiPassword" type="password" autocomplete="off"><small>Utilisé uniquement pendant l’association, jamais enregistré par ShenPulse.</small></label>
      </div>
    </div>`,
    onSubmit: async (data) => {
      const result = await api.irl.pair({
        accessPointSsid: data.get("accessPointSsid"),
        wifiSsid: data.get("wifiSsid"),
        wifiPassword: data.get("wifiPassword")
      });
      if (result.snapshot) acceptSnapshot(result.snapshot);
      toast(
        result.pendingDiscovery ? "Prise associée" : "Prise PlugPlus prête",
        result.pendingDiscovery
          ? "Le Wi-Fi est configuré. Relancez la détection dans quelques secondes."
          : "La prise est enregistrée et disponible dans les actions."
      );
    }
  });
}

function openIrlManualEditor() {
  openEditor({
    title: "Ajouter une prise par adresse",
    kicker: "INTERACTIONS IRL · RÉSEAU LOCAL",
    submitLabel: "Détecter et ajouter",
    body: `<div class="form-grid">
      ${field("host", "Adresse IP locale", "192.168.1.", "text", "full required")}
      ${field("name", "Nom personnalisé (optionnel)", "", "text", "full")}
      <div class="field full"><small>Le PC et la prise doivent être connectés au même réseau local.</small></div>
    </div>`,
    onSubmit: async (data) => {
      const result = await api.irl.add({
        host: data.get("host"),
        name: data.get("name")
      });
      if (result.snapshot) acceptSnapshot(result.snapshot);
    }
  });
}

function openIrlRenameEditor(device) {
  openEditor({
    title: "Renommer la prise",
    kicker: "INTERACTIONS IRL",
    submitLabel: "Enregistrer",
    body: `<div class="form-grid">${field("name", "Nom affiché", device.name, "text", "full required autofocus")}</div>`,
    onSubmit: async (data) => {
      const result = await api.irl.rename(device.id, data.get("name"));
      if (result.snapshot) acceptSnapshot(result.snapshot);
    }
  });
}

function openIrlActionEditor() {
  const device = snapshot.state.settings.irl?.devices?.find(
    isControllableIrlDevice
  );
  if (!device) throw new Error("Ajoutez d’abord une prise PlugPlus avec un relais pilotable.");
  openActionEditor(null, {
    rule: {
      id: "",
      name: `Interaction ${device.name}`,
      enabled: true,
      priority: 50,
      trigger: { enabled: true, type: "gift", source: "*", threshold: 1 },
      conditions: [],
      cooldown: { globalMs: 5000, perUserMs: 5000 },
      chance: 1,
      actions: []
    },
    action: {
      id: "",
      type: "irl.shelly",
      config: { deviceId: device.id, operation: "cycle", durationMs: 3000 }
    }
  });
}
