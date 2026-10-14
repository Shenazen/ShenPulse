"use strict";

/** Exécute les groupes en parallèle, avec diagnostic des erreurs et protection des cycles. */
const { safeString } = require("../utils");
const { readState } = require("../state-projection");
const { renderValue } = require("../template");

const ACTION_GROUP_STACK = Symbol("shenpulse.actionGroupStack");
const ACTION_GROUP_MAX_DEPTH = 20;

async function runActionGroup({ store, runAction, randomImpl }, action, config, context) {
  const commandFlow = typeof context.resolveCommandActions === "function";
  const actionIds = [
    ...new Set(
      (Array.isArray(config.actionIds) ? config.actionIds : [])
        .map(String)
        .filter(Boolean)
    )
  ];
  if (!actionIds.length) {
    throw new Error("Ce groupe d’actions ne contient aucune action.");
  }

  const stack = Array.isArray(context[ACTION_GROUP_STACK])
    ? context[ACTION_GROUP_STACK]
    : [];
  const groupId = safeString(action.id || "", 160);
  if (groupId && stack.includes(groupId)) {
    throw new Error(
      `Référence circulaire détectée dans les groupes d’actions : ${[
        ...stack,
        groupId
      ].join(" → ")}.`
    );
  }
  if (stack.length >= ACTION_GROUP_MAX_DEPTH) {
    throw new Error(
      `Profondeur maximale de ${ACTION_GROUP_MAX_DEPTH} groupes d’actions atteinte.`
    );
  }

  // Seules les commandes injectent ce résolveur : profil/compte et références
  // de jeu sont revalidés. Les groupes historiques gardent leur contrat global.
  const resolved = commandFlow
    ? context.resolveCommandActions(actionIds)
    : (readState(store, ["rules"]).rules || []).flatMap((rule) =>
      (rule.actions || [])
        .filter((entry) => entry?.id)
        .map((entry) => [
          String(entry.id),
          {
            action: entry,
            name: safeString(rule.name || entry.name || entry.id, 200)
          }
        ])
    );
  const actionsById = new Map(resolved);
  const missingActionIds = actionIds.filter(
    (actionId) => !actionsById.has(actionId)
  );
  let selectedActions = actionIds
    .map((actionId) => actionsById.get(actionId))
    .filter(Boolean);
  if (!selectedActions.length) {
    throw new Error(
      "Les actions liées à ce groupe sont introuvables. Modifiez sa sélection."
    );
  }

  const mode = config.mode === "random" ? "random" : "all";
  if (mode === "random" && selectedActions.length > 1) {
    selectedActions = [...selectedActions];
    for (let index = selectedActions.length - 1; index > 0; index -= 1) {
      const sampled = Number(randomImpl());
      const bounded = Number.isFinite(sampled)
        ? Math.min(0.999999999999, Math.max(0, sampled))
        : 0;
      const randomIndex = Math.floor(bounded * (index + 1));
      [selectedActions[index], selectedActions[randomIndex]] = [
        selectedActions[randomIndex],
        selectedActions[index]
      ];
    }
    selectedActions = selectedActions.slice(
      0,
      Math.min(
        selectedActions.length,
        Math.max(1, Math.floor(Number(config.randomCount) || 1))
      )
    );
  }

  const nextStack = [
    ...stack,
    groupId || `groupe-anonyme-${stack.length + 1}`
  ];
  const missingFailures = missingActionIds.map((actionId) => ({
    actionId,
    actionName: actionId,
    error: new Error(`Action liée introuvable : ${actionId}.`)
  }));
  const outcomes = await Promise.all(
    selectedActions.map(async ({ action: linkedAction, name: actionName }) => {
      const hydratedAction = {
        ...linkedAction,
        config: renderValue(linkedAction.config || {}, context)
      };
      try {
        const result = await runAction(hydratedAction, {
          ...context,
          [ACTION_GROUP_STACK]: nextStack
        });
        if (result?.skipped) {
          const reason = String(result.reason || "action-skipped");
          const message = reason === "irl-disabled"
            ? "Interactions IRL désactivées dans la page PlugPlus."
            : `Action ignorée : ${reason}.`;
          return {
            ok: false,
            actionId: String(linkedAction.id || ""),
            actionName,
            error: new Error(message)
          };
        }
        return {
          ok: true,
          actionId: String(linkedAction.id || ""),
          actionName,
          result,
          ...(commandFlow && linkedAction.type === "action.group" ? { commandGroup: true } : {})
        };
      } catch (error) {
        return {
          ok: false,
          actionId: String(linkedAction.id || ""),
          actionName,
          error
        };
      }
    })
  );
  const succeeded = outcomes.filter(({ ok }) => ok);
  const failures = [
    ...missingFailures,
    ...outcomes.filter(({ ok }) => !ok)
  ];
  const results = outcomes.map((outcome) =>
    outcome.ok
      ? outcome
      : {
          ok: false,
          actionId: outcome.actionId,
          actionName: outcome.actionName,
          message: outcome.error?.message || String(outcome.error)
        }
  );

  const commandCounts = commandFlow ? summarizeCommandOutcomes(outcomes, missingFailures.length) : null;
  if (failures.length && !(commandFlow ? commandCounts.executed : succeeded.length) && !commandCounts?.queuedCount) {
    const firstMessage = failures[0].error?.message || "Erreur inconnue";
    const error = new AggregateError(
      failures.map(({ error }) => error),
      `Le groupe d’actions a rencontré ${failures.length} erreur${
        failures.length > 1 ? "s" : ""
      } : ${firstMessage}`
    );
    if (commandFlow) error.commandGroupCounts = commandCounts;
    throw error;
  }
  return {
    mode,
    requested: commandCounts?.requested ?? actionIds.length,
    selected: commandCounts?.selected ?? selectedActions.length,
    executed: commandCounts?.executed ?? succeeded.length,
    failed: commandCounts?.failed ?? failures.length,
    partial: commandCounts ? commandCounts.failed > 0 || commandCounts.nestedPartial || commandCounts.queuedCount > 0 && commandCounts.executed > 0 : failures.length > 0,
    ...(commandCounts?.queuedCount ? { queued: true, queuedCount: commandCounts.queuedCount } : {}),
    actionIds: selectedActions.map(({ action: entry }) => String(entry.id || "")),
    results,
    failures: failures.map(({ actionId, actionName, error }) => ({
      actionId,
      actionName,
      message: error?.message || String(error)
    }))
  };
}

/** Les groupes Commandes rendent compte des effets feuilles, pas seulement
 * d'un enfant ayant accepté un travail qui reste en attente. Contrat legacy
 * volontairement inchangé hors de ce flux. */
function summarizeCommandOutcomes(outcomes, missing) {
  const counts = { requested: missing, selected: 0, executed: 0, failed: missing, queuedCount: 0, nestedPartial: false };
  const number = (value) => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  for (const outcome of outcomes) {
    const child = outcome.commandGroup ? outcome.result : outcome.error?.commandGroupCounts;
    if (child) {
      for (const key of ["requested", "selected", "executed", "failed"]) counts[key] += number(child[key]);
      counts.queuedCount += number(child.queuedCount);
      counts.nestedPartial ||= child.partial === true || child.nestedPartial === true;
    } else {
      counts.requested += 1; counts.selected += 1;
      if (!outcome.ok) counts.failed += 1;
      else if (outcome.result?.queued === true && Number(outcome.result.queuePosition) > 0) counts.queuedCount += 1;
      else counts.executed += 1;
      // Une roue peut avoir été affichée sans son effet gagnant. Son succès
      // visuel ne doit pas transformer un groupe partiel en succès complet.
      counts.nestedPartial ||= outcome.result?.partial === true;
    }
  }
  return counts;
}

module.exports = { runActionGroup };
