"use strict";

const actionComponentEditors = new WeakMap();
let actionComponentSequence = 0;

function newActionEditorPart(action) {
  const seed = JSON.parse(JSON.stringify(action));
  return { key: `part-${++actionComponentSequence}`, seed, type: canonicalActionType(seed.type), panels: new Map() };
}

function createActionEditorParts(rule, currentAction, editing) {
  const source = editing && rule.actions?.length ? rule.actions : [...(rule.actions || []), currentAction];
  const parts = [];
  for (const action of source) {
    const seed = JSON.parse(JSON.stringify(action));
    // Les options viewer/texte créées auparavant deviennent une ligne dédiée,
    // uniquement dans le brouillon. Les identifiants existants sont conservés.
    if (seed.type !== "overlay.text" && seed.config?.alert?.enabled === true) {
      const alert = seed.config.alert;
      delete seed.config.alert;
      if (["overlay.media", "overlay.alert"].includes(seed.type) && !seed.config.mediaUrl) {
        seed.type = "overlay.text";
        seed.config = { alert };
      } else {
        parts.push(newActionEditorPart(seed));
        parts.push(newActionEditorPart({ type: "overlay.text", config: { alert } }));
        continue;
      }
    }
    parts.push(newActionEditorPart(seed));
  }
  return { parts, root: null, ruleId: rule.id };
}

function actionComponentsEditorMarkup() {
  return `<div class="action-components-editor full" data-action-components-editor>
    <div class="action-editor-basics action-component-list" data-action-component-list></div>
    <div class="action-config-stage action-component-configs"><div class="action-config-heading"><strong>Configuration par type</strong><small>Dépliez les réglages dont vous avez besoin.</small></div><div data-action-component-groups></div></div>
  </div>`;
}

function actionComponentPanel(part, context) {
  if (part.panels.has(part.type)) return part.panels.get(part.type);
  const action = part.seed.type === part.type || canonicalActionType(part.seed.type) === part.type
    ? part.seed : { ...part.seed, type: part.type, config: {} };
  const template = document.createElement("template");
  template.innerHTML = actionEditorConfigFields(action, { action });
  const fields = [...template.content.children].filter(node => String(node.dataset.actionTypes || "").split(/\s+/).includes(part.type));
  const panel = document.createElement("section");
  panel.className = "action-component-panel";
  panel.dataset.actionComponent = part.key;
  panel.innerHTML = `<input type="hidden" name="actionType" value="${escapeHtml(part.type)}"><h4 data-action-component-title></h4>`;
  if (fields.length) panel.append(...fields);
  else panel.append(template.content);
  panel.querySelectorAll("[id]").forEach(field => {
    const original = field.id;
    field.id = `${original}-${part.key}`;
    panel.querySelectorAll("label[for]").forEach(label => {
      if (label.htmlFor === original) label.htmlFor = field.id;
    });
  });
  part.panels.set(part.type, panel);
  return panel;
}

function renderActionComponentsEditor(context, focusKey = "") {
  const root = context.root;
  const openTypes = new Set([...root.querySelectorAll('[data-action-type-group][open]')].map(node => node.dataset.actionTypeGroup));
  const first = context.parts.find(part => part.key === focusKey) || context.parts[0];
  if (focusKey) { openTypes.clear(); openTypes.add(first.type); }
  else if (!openTypes.size && context.parts.length === 1) openTypes.add(first.type);
  root.querySelector("[data-action-component-list]").innerHTML = `<span class="action-component-list-label">Types d’action</span>${context.parts.map((part, index) => `
    <div class="action-component-choice" data-action-part-choice="${part.key}"><span class="action-component-number">${index + 1}</span>
      <label class="field"><select data-action-part-type data-editor-action-type data-part-key="${part.key}" aria-label="Type d’action ${index + 1}">${actionTypeOptions(part.type)}</select></label>
      <button type="button" class="button small" data-action-part-add="${part.key}" aria-label="Ajouter une action après la ligne ${index + 1}" title="Ajouter une action">＋</button>
      <button type="button" class="button small ghost" data-action-part-remove="${part.key}" aria-label="Retirer l’action ${index + 1}" title="Retirer cette action" ${context.parts.length === 1 ? "disabled" : ""}>−</button>
    </div>`).join("")}<small>Un seul nom et un seul déclencheur pour toutes ces actions. Les groupes d’actions restent disponibles dans la liste.</small>`;
  const groups = new Map();
  context.parts.forEach((part, index) => {
    if (!groups.has(part.type)) {
      const group = document.createElement("details");
      group.className = "action-type-config";
      group.dataset.actionTypeGroup = part.type;
      group.open = openTypes.has(part.type);
      group.innerHTML = `<summary><strong>${escapeHtml(actionTypeOptionLabel(part.type))}</strong><span>${context.parts.filter(item => item.type === part.type).length}</span></summary><div class="action-type-config-body"></div>`;
      groups.set(part.type, group);
    }
    const panel = actionComponentPanel(part, context);
    panel.querySelector("[data-action-component-title]").textContent = `Action ${index + 1} · ${actionTypeLabel(part.type)}`;
    groups.get(part.type).lastElementChild.append(panel);
  });
  root.querySelector("[data-action-component-groups]").replaceChildren(...groups.values());
  syncActionComponentsEditor();
}

function initializeActionComponentsEditor(context) {
  context.root = dialogBody.querySelector("[data-action-components-editor]");
  if (!context.root) return;
  actionComponentEditors.set(context.root, context);
  renderActionComponentsEditor(context);
}

function syncActionComponentsEditor() {
  const root = dialogBody.querySelector("[data-action-components-editor]");
  if (!root) return;
  const context = actionComponentEditors.get(root);
  if (!context) return;
  const testButton = dialog.querySelector("[data-dialog-test]");
  if (testButton) testButton.hidden = !context.parts.some(part => part.type === "overlay.text");
  for (const part of context.parts) {
    const panel = part.panels.get(part.type);
    panel.querySelectorAll("[data-action-types]").forEach(element => {
      const types = String(element.dataset.actionTypes || "").split(/\s+/);
      setEditorConditionalVisibility(element, types.includes(part.type) || types.includes("*"));
    });
    syncActionGroupEditor(panel);
    syncActionAlertDisplay(panel);
  }
}

function actionComponentFormData(panel) {
  const data = new FormData();
  for (const field of panel.querySelectorAll("input,select,textarea")) {
    if (!field.name || field.matches(":disabled") || ["button", "submit", "file"].includes(field.type)) continue;
    if (["checkbox", "radio"].includes(field.type) && !field.checked) continue;
    if (field.multiple) for (const option of field.selectedOptions) data.append(field.name, option.value);
    else data.append(field.name, field.value);
  }
  return data;
}

function collectActionEditorParts(context) {
  const actions = context.parts.map((part, index) => {
    const panel = part.panels.get(part.type);
    try {
      const seed = canonicalActionType(part.seed.type) === part.type ? part.seed : { ...part.seed, config: {} };
      return { ...seed, id: seed.id || `action_${cryptoId()}_${part.key}`, type: part.type,
        config: readActionEditorConfig(actionComponentFormData(panel), seed) };
    } catch (error) {
      panel.closest("details").open = true;
      panel.scrollIntoView?.({ block: "nearest" });
      throw new Error(`Action ${index + 1} · ${actionTypeLabel(part.type)} : ${error.message}`);
    }
  });
  const available = [...flattenActions().filter(row => row.rule.id !== context.ruleId).map(row => row.action), ...actions];
  actions.forEach((action, index) => {
    if (!action.config?.soundActionId || ShenPulseActionAudio.resolve(action, available)) return;
    context.parts[index].panels.get(context.parts[index].type).closest("details").open = true;
    throw new Error(`Action ${index + 1} : le son lié a été retiré ou crée une boucle. Choisissez un autre son.`);
  });
  return actions;
}

dialog.addEventListener("click", event => {
  const button = event.target.closest("[data-action-part-add],[data-action-part-remove]");
  if (!button) return;
  const context = actionComponentEditors.get(button.closest("[data-action-components-editor]"));
  if (!context) return;
  const key = button.dataset.actionPartAdd || button.dataset.actionPartRemove;
  const index = context.parts.findIndex(part => part.key === key);
  if (index < 0) return;
  if (button.hasAttribute("data-action-part-add")) {
    if (context.parts.length >= 32) return toast("Limite atteinte", "Un scénario peut contenir jusqu’à 32 actions.", true);
    const part = newActionEditorPart({ type: context.parts[index].type, config: {} });
    context.parts.splice(index + 1, 0, part);
    renderActionComponentsEditor(context, part.key);
  } else if (context.parts.length > 1) {
    context.parts.splice(index, 1);
    renderActionComponentsEditor(context);
  }
});

dialog.addEventListener("change", event => {
  if (!event.target.matches("[data-action-part-type]")) return;
  const context = actionComponentEditors.get(event.target.closest("[data-action-components-editor]"));
  const part = context?.parts.find(item => item.key === event.target.dataset.partKey);
  if (!part) return;
  part.type = event.target.value;
  renderActionComponentsEditor(context, part.key);
});

dialog.addEventListener("invalid", event => {
  const panel = event.target.closest("[data-action-component]");
  if (panel) panel.closest("details").open = true;
}, true);

dialog.addEventListener("toggle", event => {
  const group = event.target;
  if (!group.matches?.("[data-action-type-group]") || !group.open || !group.isConnected) return;
  group.closest("[data-action-components-editor]").querySelectorAll("[data-action-type-group]").forEach(other => {
    if (other !== group) other.open = false;
  });
}, true);
