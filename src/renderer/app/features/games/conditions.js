"use strict";

/** Aide commune aux deux en-têtes de jeu ; son ouverture ne recrée pas les formulaires. */
const expandedGameConditions = new Set();

function renderGameConditionsButton(pack) {
  const open = expandedGameConditions.has(pack.id);
  return `<button type="button" class="game-conditions-button" data-action="toggle-game-conditions" data-id="${escapeHtml(pack.id)}" aria-expanded="${open}" aria-controls="game-conditions-${escapeHtml(pack.id)}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10.3 3.9 2.1 18.1A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/></svg>
    CONDITION DE JEU
    <svg class="game-conditions-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </button>`;
}

function toggleGameConditions(target, gameId) {
  const hero = target.closest(".game-workspace-hero, .smk-workspace-hero");
  const panel = hero?.querySelector(".game-conditions-panel");
  if (!panel || panel.id !== `game-conditions-${gameId}`) return;
  const open = target.getAttribute("aria-expanded") !== "true";
  if (open) expandedGameConditions.add(gameId);
  else expandedGameConditions.delete(gameId);
  panel.hidden = !open;
  target.setAttribute("aria-expanded", String(open));
}

function renderGameConditionsPanel(pack) {
  const guide = pack.guide || {};
  const requirements = [...(guide.requirements || []), ...(guide.notes || [])];
  const rows = pack.connector?.type === "windows-input" ? gameConditionInputRows(pack) : [];
  const limitations = [...new Set((pack.effects || []).filter(effect => effect.available === false)
    .map(effect => effect.unavailableReason).filter(Boolean))];
  const list = entries => entries.map(entry => `<li>${escapeHtml(entry)}</li>`).join("");
  const sources = (guide.sources || []).filter(source => /^https:\/\//i.test(source.url || ""));
  return `<section class="game-conditions-panel" id="game-conditions-${escapeHtml(pack.id)}" aria-label="Conditions de jeu — ${escapeHtml(pack.name)}" ${expandedGameConditions.has(pack.id) ? "" : "hidden"}>
    <header><h3>Bien préparer ${escapeHtml(pack.name)}</h3><p>${escapeHtml(guide.summary || pack.description || "")}</p></header>
    <div class="game-conditions-columns">
      <section><h4>Conditions pour les interactions</h4><ul>${list(requirements)}</ul></section>
      <section><h4>Installation et lancement</h4><ol>${list(guide.steps || [])}</ol></section>
    </div>
    ${rows.length ? `<section class="game-conditions-controls"><h4>Touches à configurer dans le jeu</h4>
      <p>Ouvrez les paramètres de contrôle de ${escapeHtml(pack.name)} et attribuez à chaque commande ci-dessous la touche indiquée. Cette configuration correspond à la disposition choisie dans Installation ; ZQSD est proposé par défaut.</p>
      <p>Pour les chiffres, appuyez sur les touches de la rangée supérieure du clavier. Sur un clavier français, le jeu peut les afficher sous la forme &amp;, é, etc. Validez les changements dans le jeu, puis fermez les menus avant les essais.</p>
      <div class="game-conditions-table"><table><thead><tr><th scope="col">Commande dans les paramètres du jeu</th>${pack.id === "dead-by-daylight" ? '<th scope="col">Rôle</th>' : ""}<th scope="col">Touche à attribuer</th></tr></thead><tbody>
        ${rows.map(row => `<tr><th scope="row">${escapeHtml(row.name)}</th>${pack.id === "dead-by-daylight" ? `<td>${escapeHtml(row.role)}</td>` : ""}<td>${row.keys.map(key => `<kbd>${escapeHtml(key)}</kbd>`).join(" ")}</td></tr>`).join("")}
      </tbody></table></div>
    </section>` : ""}
    ${limitations.length ? `<section class="game-conditions-limits"><h4>Limites des interactions</h4><ul>${list(limitations)}</ul></section>` : ""}
    ${sources.length ? `<footer>${sources.map(source => `<button type="button" class="button small" data-action="open-url" data-value="${escapeHtml(source.url)}">${escapeHtml(source.label)}</button>`).join("")}</footer>` : ""}
  </section>`;
}
