"use strict";

/**
 * Éditeurs des actions, règles, profils et connexions.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

/** Versions réellement livrées pour l’animation choisie, sans variante fictive. */
function actionMatchVariantOptions(match, current = "tikcontrol") {
  const options = overlayCatalog.animationVariants(match);
  const selected = options.some(([value]) => value === current) ? current : "tikcontrol";
  return options.map(([value, label]) => `<option value="${escapeHtml(value)}" ${selected === value ? "selected" : ""}>${escapeHtml(label)}</option>`).join("");
}

function syncActionMatchVariants(scope = dialogBody) {
  const match = scope.querySelector("[data-action-match-name]");
  const variant = scope.querySelector('[name="matchVariant"]');
  if (!match || !variant) return;
  // Un changement dans la fenêtre reste un brouillon : aucune action ni
  // configuration de profil n’est enregistrée avant la soumission explicite.
  variant.innerHTML = actionMatchVariantOptions(match.value, variant.value);
}

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
  const actionParts = createActionEditorParts(currentRule, currentAction, Boolean(row));
  openEditor({
    title: row ? "Modifier l’action" : "Créer une action",
    kicker: "ACTION & DÉCLENCHEUR",
    variant: "wide",
    onTest: () => previewActionEditorViewer(actionParts),
    body: `<div class="action-editor">
      <nav class="action-editor-progress" aria-label="Étapes de configuration">
        <span class="active"><b>1</b><small>Action</small></span>
        <span><b>2</b><small>Déclencheur optionnel</small></span>
        <span><b>3</b><small>Réglages avancés</small></span>
      </nav>
      ${dialogSection(
        "1. Action",
        "Définissez ce que ShenPulse exécutera.",
        `${field("name", "Nom de l’action", currentRule.name, "text", "required full autofocus")}
        ${actionComponentsEditorMarkup(actionParts)}` ,
        "dialog-section-accent"
      )}
      ${dialogSection(
        "2. Déclencheur",
        "Optionnel : lancez automatiquement cette action lors d’un événement précis.",
        `<div class="trigger-editor-fields editor-conditional full" data-trigger-enabled>
          <label class="field"><span>Déclencheur</span><select name="triggerType" data-editor-trigger-type>${triggerTypeOptions(currentRule.trigger?.type)}</select></label>
          ${field("threshold", "Seuil / quantité", currentRule.trigger?.threshold || 1, "number", 'min="1"')}
          <div class="editor-conditional full" data-trigger-types="gift">${giftTriggerConditionFields(currentRule.conditions, { repeatGiftCombos: currentRule.trigger?.repeatGiftCombos })}</div>
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
      const triggerEnabled = data.get("triggerEnabled") === "true";
      const actions = collectActionEditorParts(actionParts);
      const ruleId = currentRule.id || `rule_${cryptoId()}`;
      await api.upsert("rules", {
        ...currentRule,
        id: ruleId,
        actionEditor: "components",
        name: data.get("name"),
        enabled: true,
        trigger: {
           ...(currentRule.trigger || {}),
           enabled: triggerEnabled,
           repeatGiftCombos: triggerEnabled ? data.has("repeatGiftCombos") : currentRule.trigger?.repeatGiftCombos === true,
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
  initializeActionComponentsEditor(actionParts);
}

function parseJsonInput(value, label) {
  try {
    return JSON.parse(String(value || "{}"));
  } catch {
    throw new Error(`${label} : JSON invalide.`);
  }
}
