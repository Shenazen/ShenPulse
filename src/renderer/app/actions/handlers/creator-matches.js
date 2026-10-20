"use strict";

/** Commandes Matchs explicites, bornées au compte/profil de départ. */
const CREATOR_MATCHES_ACTIONS = new Set(["matches-tab", "matches-refresh", "matches-visual-configure", "matches-reset-wins", "matches-correct-wins", "matches-clear-donors", "matches-automation-add", "matches-automation-edit", "matches-automation-toggle", "matches-automation-delete", "matches-automation-test", "matches-automation-animation", "matches-animation-local-preview", "matches-automation-output", "matches-automation-setting", "matches-automation-group-output", "matches-automation-group-toggle", "matches-automation-group-test", "matches-automation-multiplier-mode", "matches-widget-edit", "matches-widget-copy", "matches-widget-test", "matches-player-copy"]);
const creatorMatchesPending = new Set();
CREATOR_MATCHES_ACTIONS.add("matches-automation-animation-remove");

function creatorMatchesAcceptResult(result, owner) {
  assertCreatorMatchesOwner(owner);
  if (result?.status) {
    creatorMatchesStatus = result.status;
    creatorMatchesStatusOwner = creatorMatchesOwnerKey();
  }
  if (result?.snapshot) acceptSnapshot(result.snapshot);
  if (!syncCreatorMatchesRuntime()) render();
}

async function creatorMatchesPerform(target, owner, key, work, message) {
  const pendingKey = `${owner.uid}:${owner.profileId}:${key}`;
  if (creatorMatchesPending.has(pendingKey)) return;
  creatorMatchesPending.add(pendingKey);
  const disabled = target.disabled;
  target.disabled = true;
  try {
    return await perform(async () => {
      assertCreatorMatchesOwner(owner);
      const result = await work();
      assertCreatorMatchesOwner(owner);
      creatorMatchesAcceptResult(result, owner);
      return result;
    }, message);
  } finally {
    creatorMatchesPending.delete(pendingKey);
    target.disabled = disabled;
  }
}

async function handleCreatorMatchesAction({ action, target, id }) {
  if (!CREATOR_MATCHES_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  const owner = creatorMatchesCaptureOwner();
  const scope = creatorMatchesApiScope(owner);
  if (action === "matches-tab") {
    if (!["dashboard", "widgets", "automations"].includes(target.dataset.value)) return;
    creatorMatchesTab = target.dataset.value;
    const tabs = content.querySelector(".matches-tabs");
    if (tabs) tabs.outerHTML = creatorMatchesTabsMarkup();
    if (!syncCreatorMatchesRuntime()) render();
    return;
  }
  if (action === "matches-refresh") return creatorMatchesPerform(target, owner, action, async () => ({ status: await api.matches.status() }), "Matchs actualisés");
  if (action === "matches-visual-configure") return openCreatorMatchesVisualEditor();
  if (action === "matches-correct-wins") return openCreatorMatchesWinsEditor();
  if (action === "matches-clear-donors") {
    if (!(await confirmAction("Vider la liste des donateurs du LIVE pour ce profil ? Les scores et l’historique des matchs restent inchangés.", { title: "Vider les donateurs du LIVE", confirmLabel: "Vider", danger: true }))) return;
    assertCreatorMatchesOwner(owner);
    return creatorMatchesPerform(target, owner, action, () => api.matches.resetContributors(scope), "Liste des donateurs du LIVE vidée");
  }
  if (action === "matches-reset-wins") {
    if (!(await confirmAction("Remettre le compteur de victoires de ce profil à zéro ? Les autres profils ne seront pas modifiés.", { title: "Réinitialiser les victoires", confirmLabel: "Remettre à zéro", danger: true }))) return;
    assertCreatorMatchesOwner(owner);
    return creatorMatchesPerform(target, owner, action, () => api.matches.resetWins(scope), "Victoires remises à zéro");
  }
  const widget = CREATOR_MATCH_WIDGETS.find((entry) => entry.key === id);
  if (action === "matches-widget-edit") return openCreatorMatchesWidgetEditor(id);
  if (action === "matches-widget-copy" || action === "matches-player-copy") {
    if (action === "matches-player-copy" && target.dataset.transport && target.dataset.transport !== "local") throw new Error("Transport Match inconnu.");
    const url = action === "matches-player-copy" ? target.dataset.transport === "local"
      ? creatorMatchesStudioSourceUrl() : creatorMatchesSourceUrl() : creatorMatchesWidgetUrl(widget);
    if (!url) throw new Error("Cette source HTTPS Match n’est pas disponible. Aucun lien local ne sera copié à sa place.");
    assertCreatorMatchesOwner(owner);
    await api.copy(url);
    assertCreatorMatchesOwner(owner);
    return toast("Source copiée", "Ajoutez le lien dans une source navigateur. Ne partagez pas ce lien protégé.");
  }
  if (action === "matches-widget-test") {
    if (!widget || !creatorMatchesWidgetUrl(widget)) throw new Error("Cette source HTTPS Match n’est pas disponible.");
    return creatorMatchesPerform(target, owner, action + id, () => api.matches.testWidget(widget.key, scope), "Aperçu demandé à la source Match");
  }
  if (action === "matches-automation-add") return openCreatorMatchesAutomationEditor(null, target.dataset.moment);
  const entry = creatorMatchesModel().automations.find((item) => String(item.id) === String(id));
  if (action === "matches-animation-local-preview") {
    if (id && !entry) throw new Error("Cette automatisation n’existe plus dans le profil actif.");
    const moment = entry?.moment || target.dataset.moment;
    const reaction = entry ? creatorMatchesOutput(entry, "animation") : creatorMatchesAnimationFromChoice(moment, `${target.dataset.match}:${target.dataset.variant}`);
    return openCreatorMatchesAnimationPreview(moment, reaction);
  }
  if (["matches-automation-group-output", "matches-automation-group-toggle", "matches-automation-group-test", "matches-automation-multiplier-mode"].includes(action)) {
    const rawIds = String(target.dataset.ids || "");
    let requestedIds;
    try { requestedIds = rawIds.startsWith("[") ? JSON.parse(rawIds) : rawIds.split(",").filter(Boolean); }
    catch { throw new Error("Cette configuration de multiplicateurs est invalide."); }
    if (!Array.isArray(requestedIds) || (!requestedIds.length && action !== "matches-automation-group-output") || requestedIds.length > 2 || requestedIds.some((entryId) => typeof entryId !== "string") || new Set(requestedIds).size !== requestedIds.length) throw new Error("Cette configuration de multiplicateurs est invalide.");
    const entries = requestedIds.map((entryId) => creatorMatchesModel().automations.find((item) => item.id === entryId));
    if (entries.some((item) => !item || !["multiplierX2", "multiplierX3"].includes(item.moment))) throw new Error("Cette configuration de multiplicateurs a changé. Actualisez les Matchs.");
    if (action === "matches-automation-group-output") {
      const initial = entries.find((item) => creatorMatchesOutput(item, target.dataset.output)) || entries[0];
      return openCreatorMatchesOutputEditor(initial, initial?.moment || "multiplierX2", target.dataset.output, entries);
    }
    if (action === "matches-automation-group-test") {
      const ready = entries.filter(creatorMatchesReactionReady);
      if (!ready.length) throw new Error("Choisissez un effet avant de tester.");
      if (!(await confirmAction("Tester réellement les effets ×2 / ×3 configurés sur leurs sorties ? Aucun score ni historique de match ne sera modifié.", { title: "Tester les multiplicateurs", confirmLabel: "Tester les effets" }))) return;
      return creatorMatchesPerform(target, owner, action + requestedIds.join(","), async () => {
        let result;
        for (const item of ready) {
          assertCreatorMatchesOwner(owner);
          result = await api.matches.testAutomation(item.id, scope);
        }
        return result;
      }, "Tests des multiplicateurs demandés");
    }
    const mode = action === "matches-automation-multiplier-mode" ? target.value : "both";
    if (!["both", "multiplierX2", "multiplierX3"].includes(mode)) throw new Error("Choisissez un multiplicateur valide.");
    const enabling = action === "matches-automation-multiplier-mode" || target.checked;
    const chosen = entries.filter((item) => (mode === "both" || item.moment === mode) && creatorMatchesReactionReady(item));
    if (enabling && (!chosen.length || (action === "matches-automation-multiplier-mode" && chosen.length !== (mode === "both" ? 2 : 1)))) throw new Error("Configurez un effet pour chaque multiplicateur choisi avant de l’activer.");
    return creatorMatchesPerform(target, owner, "matches-multipliers:" + requestedIds.join(","), async () => {
      let result;
      for (const item of entries) {
        assertCreatorMatchesOwner(owner);
        const enabled = Boolean(enabling && chosen.includes(item));
        if (item.enabled !== enabled) result = await api.matches.saveAutomation({ ...item, enabled }, scope);
      }
      return result || {};
    }, "Multiplicateurs mis à jour");
  }
  if (["matches-automation-animation", "matches-automation-animation-remove", "matches-automation-output", "matches-automation-setting"].includes(action)) {
    if (id && !entry) throw new Error("Cette automatisation n’existe plus dans le profil actif.");
    const current = creatorMatchesOutputDraft(entry, target.dataset.moment);
    if (action === "matches-automation-output") return openCreatorMatchesOutputEditor(entry, current.moment, target.dataset.output);
    let next;
    if (["matches-automation-animation", "matches-automation-animation-remove"].includes(action)) {
      if (action === "matches-automation-animation-remove" && (!entry || !creatorMatchesOutput(entry, "animation"))) throw new Error("Cette ancienne animation n’existe plus dans le profil actif.");
      const output = creatorMatchesAnimationFromChoice(current.moment, action === "matches-automation-animation-remove" ? "" : String(target.value || ""), creatorMatchesOutput(entry, "animation")?.fit || "contain");
      next = creatorMatchesReplaceOutput(current, "animation", output);
      const dialogSession = typeof dialogSessionId === "number" ? dialogSessionId : null;
      let saved = false;
      const result = await creatorMatchesPerform(target, owner, action + (id || current.moment), async () => {
        const result = await api.matches.saveAutomation(next, scope); saved = true; return result;
      }, "Réglage de match enregistré");
      assertCreatorMatchesOwner(owner);
      if (saved && output && currentPage === "matches" && (dialogSession === null || dialogSession === dialogSessionId)) openCreatorMatchesAnimationPreview(current.moment, output);
      return result;
    } else {
      if (target.dataset.setting !== "card" || current.moment !== "card" || !(target.value === "any" || ShenPulseMatches.CARDS.includes(target.value))) throw new Error("Réglage de match invalide.");
      next = { ...current, id: current.id || `match_auto_${cryptoId()}`, card: target.value };
    }
    return creatorMatchesPerform(target, owner, action + (id || current.moment), () => api.matches.saveAutomation(next, scope), "Réglage de match enregistré");
  }
  if (action === "matches-automation-edit") {
    if (id && !entry) throw new Error("Cette automatisation n’existe plus dans le profil actif.");
    return openCreatorMatchesAutomationEditor(entry, target.dataset.moment);
  }
  if (!entry) throw new Error("Cette automatisation n’existe plus dans le profil actif.");
  if (action === "matches-automation-test") {
    if (!creatorMatchesReactionReady(entry)) throw new Error("Choisissez un effet compatible avec ce temps fort avant de tester.");
    if (!(await confirmAction(`Tester réellement « ${entry.name} » sur ses sorties configurées ? Aucun score ni historique de match ne sera modifié.`, { title: "Tester cet effet de match", confirmLabel: "Tester l’effet" }))) return;
    assertCreatorMatchesOwner(owner);
    return creatorMatchesPerform(target, owner, action + id, () => api.matches.testAutomation(entry.id, scope), "Test de l’effet de match demandé");
  }
  if (action === "matches-automation-delete") {
    if (!(await confirmAction(`Supprimer « ${entry.name} » du profil actif ?`, { title: "Supprimer l’automatisation", confirmLabel: "Supprimer", danger: true }))) return;
    assertCreatorMatchesOwner(owner);
    return creatorMatchesPerform(target, owner, action + id, () => api.matches.removeAutomation(entry.id, scope), "Automatisation supprimée");
  }
  if (action === "matches-automation-toggle") {
    try {
      if (target.checked && entry.moment === "card" && creatorMatchesModel().capabilities.cards === false) throw new Error("La détection automatique des cartes de match est indisponible avec cette connexion TikTok.");
      return await creatorMatchesPerform(target, owner, action + id, () => api.matches.saveAutomation({ ...entry, enabled: target.checked }, scope), "État de l’automatisation mis à jour");
    } catch (error) {
      target.checked = entry.enabled === true;
      throw error;
    }
  }
}

registerActionHandler(CREATOR_MATCHES_ACTIONS, handleCreatorMatchesAction);
