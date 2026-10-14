"use strict";

/** Choix du type de rendu et des actions à exporter. */

function openGameOverlayDownloadChoice(pack, model = 1) {
  const actionRows = triggeredOverlayActions();
  const selectedModel = Number(model) === 2 ? 2 : 1;
  openEditor({
    title: "Composer l’overlay à télécharger",
    kicker: `OVERLAY ${String(pack.name || "DU JEU").toUpperCase()}`,
    variant: "game-overlay-choice",
    body: `<div class="game-overlay-choice-dialog">
      <div class="game-overlay-choice-intro">
        <span>↓</span>
        <div><strong>Que voulez-vous afficher sur le modèle ${selectedModel} ?</strong><p>Les interactions du jeu restent la base de l’image. Vous pouvez aussi y ajouter les actions de ce profil qui possèdent un déclencheur actif.</p></div>
      </div>
      <div class="game-overlay-choice-grid">
        <button type="button" data-action="download-game-overlay-only" data-id="${escapeHtml(pack.id)}" data-model="${selectedModel}">
          <span class="game-overlay-choice-icon">🎮</span>
          <strong>Interactions du jeu uniquement</strong>
          <small>Télécharger immédiatement l’overlay sans ajouter d’action générale.</small>
          <em>↓ Télécharger</em>
        </button>
        <button type="button" data-action="open-game-overlay-action-picker" data-id="${escapeHtml(pack.id)}" data-model="${selectedModel}" ${actionRows.length ? "" : "disabled"}>
          <span class="game-overlay-choice-icon">✦</span>
          <strong>Interactions + actions</strong>
          <small>${actionRows.length ? `${actionRows.length} action${actionRows.length > 1 ? "s" : ""} avec déclencheur disponible${actionRows.length > 1 ? "s" : ""}.` : "Aucune action avec un déclencheur actif dans ce profil."}</small>
          <em>Choisir les actions →</em>
        </button>
      </div>
    </div>`
  });
}

function openGameOverlayActionPicker(pack, model = 1) {
  const actionRows = triggeredOverlayActions();
  const rawGameEntries = gameInteractionOverlayEntries(pack);
  const gameEntries = groupGameOverlayEntriesByGift(rawGameEntries);
  const gameTriggerIdentities = new Set(
    gameEntries.map(gameOverlayEntryTriggerIdentity)
  );
  const selectedModel = Number(model) === 2 ? 2 : 1;
  const cards = actionRows.map((row) => {
    const triggerEntries = overlayEntriesForTriggeredAction(row, pack);
    const joinsGameTrigger = triggerEntries.some(
      (entry) =>
        gameTriggerIdentities.has(gameOverlayEntryTriggerIdentity(entry))
    );
    return `<label class="game-overlay-action-option">
      <input type="checkbox" name="overlayAction" value="${escapeHtml(triggeredOverlayActionKey(row))}">
      <span class="game-overlay-action-check">✓</span>
      <span class="game-overlay-action-visual">${overlayActionPickerVisual(row, pack)}</span>
      <span class="game-overlay-action-copy">
        <strong>${escapeHtml(overlayActionLabel(row))}</strong>
        <small>${escapeHtml(actionTypeLabel(row.action.type))} · ${escapeHtml(actionDescription(row.action))}</small>
        <span class="game-overlay-action-triggers">${row.triggerRules.map((rule) => `<i title="${escapeHtml(triggerLabel(rule))}">${overlayTriggerPickerVisual(rule)}<b>${escapeHtml(triggerLabel(rule))}</b></i>`).join("")}</span>
        ${joinsGameTrigger ? '<em class="game-overlay-merge-note">↳ Déclencheur déjà présent : regroupé avec l’interaction du jeu</em>' : ""}
      </span>
    </label>`;
  }).join("");
  openEditor({
    title: "Choisir les actions à ajouter",
    kicker: `MODÈLE ${selectedModel} · ${String(pack.name || "OVERLAY").toUpperCase()}`,
    variant: "game-overlay-actions",
    submitLabel: "Ajouter et télécharger",
    pendingLabel: "Création de l’overlay…",
    successMessage: `Overlay modèle ${selectedModel} téléchargé`,
    body: `<div class="game-overlay-action-picker">
      <header><div><strong>${actionRows.length} action${actionRows.length > 1 ? "s" : ""} disponible${actionRows.length > 1 ? "s" : ""}</strong><p>Chaque carte montre l’action et ses déclencheurs. Les cadeaux, follows et paliers de likes identiques seront réunis dans une seule case.</p></div><span>${gameOverlayRenderedCaseCount(gameEntries)}/42 cases du jeu</span></header>
      <div class="game-overlay-action-list">${cards}</div>
    </div>`,
    onSubmit: async (data) => {
      const selectedKeys = new Set(data.getAll("overlayAction").map(String));
      if (!selectedKeys.size) {
        throw new Error("Choisissez au moins une action à ajouter à l’overlay.");
      }
      const additionalEntries = actionRows
        .filter((row) => selectedKeys.has(triggeredOverlayActionKey(row)))
        .flatMap((row) => overlayEntriesForTriggeredAction(row, pack));
      const composedEntries = groupGameOverlayEntriesByGift(
        mergeGameOverlayEntries(rawGameEntries, additionalEntries)
      );
      const caseCount = gameOverlayRenderedCaseCount(composedEntries);
      if (caseCount > 42) {
        throw new Error(
          `Cet overlay accepte 42 cases maximum. Retirez au moins ${caseCount - 42} action${caseCount - 42 > 1 ? "s" : ""}.`
        );
      }
      await downloadComposedGameInteractionOverlay(
        pack.id,
        selectedModel,
        additionalEntries
      );
    }
  });
}
