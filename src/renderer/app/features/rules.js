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
    <div class="rules-grid">
      ${rules.map((rule) => `
        <article class="card entity-card">
          <div class="entity-top">
            <div><h3>${escapeHtml(rule.name)}</h3><p>${escapeHtml(triggerActionIds(rule).length)} action(s) · ${escapeHtml(triggerExecutionLabel(rule))} · priorité ${escapeHtml(rule.priority || 0)}</p></div>
            <label class="switch"><input type="checkbox" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" ${rule.enabled ? "checked" : ""}><span></span></label>
          </div>
          <div class="entity-meta">
            <span class="badge cyan">${escapeHtml(rule.trigger?.type || "*")}</span>
            <span class="badge">SEUIL ${escapeHtml(rule.trigger?.threshold || 1)}</span>
            <span class="badge">CD ${Math.round(Number(rule.cooldown?.globalMs || 0) / 1000)}s</span>
          </div>
          <div class="entity-actions">
            <button class="button small" data-action="edit-rule" data-id="${escapeHtml(rule.id)}">Modifier</button>
            <button class="button small" data-action="run-rule" data-id="${escapeHtml(rule.id)}">Tester</button>
            <button class="button small ghost" data-action="delete-entity" data-collection="rules" data-id="${escapeHtml(rule.id)}">Supprimer</button>
          </div>
        </article>`).join("")}
    </div>`;
}
