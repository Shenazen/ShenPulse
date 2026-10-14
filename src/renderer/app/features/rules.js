"use strict";

/**
 * Liste du moteur d'automatisations.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function renderRules() {
  const rules = snapshot.state.rules;
  return `
    <div class="section-toolbar">
      <div><h2>${rules.length} automatisation${rules.length > 1 ? "s" : ""}</h2><p>Déclencheurs, conditions, cooldowns et actions chaînées.</p></div>
      <button class="button primary" data-action="add-rule">＋ Nouvelle règle</button>
    </div>
    ${renderAutomationTable({ key: "advanced-rules", label: "Automatisations avancées du profil actif", rows: rules.map((rule) => ({
      id: rule.id, name: rule.name,
      detail: `Priorité ${escapeHtml(rule.priority || 0)} · ${Math.round(Number(rule.cooldown?.globalMs || 0) / 1000)}s de cooldown`,
      trigger: triggerPill(rule, { compact: true }),
      effects: `${renderTriggerActionChips(rule)}<small class="automation-row-note">${escapeHtml(triggerExecutionLabel(rule))}</small>`,
      status: renderAutomationStatus(rule), date: rule.createdAt || "",
      commands: `${renderAutomationIconButton({ action: "run-rule", label: "Tester l’automatisation", attributes: `data-id="${escapeHtml(rule.id)}"`, icon: "play", tone: "play" })}${renderAutomationIconButton({ action: "edit-rule", label: "Modifier l’automatisation", attributes: `data-id="${escapeHtml(rule.id)}"`, icon: "edit" })}${renderAutomationIconButton({ action: "delete-entity", label: "Supprimer l’automatisation", attributes: `data-collection="rules" data-id="${escapeHtml(rule.id)}"`, icon: "trash", tone: "danger" })}`
    })) })}`;
}
