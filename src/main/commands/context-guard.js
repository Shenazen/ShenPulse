"use strict";
// Un marqueur interne ne peut pas être forgé par un objet JSON utilisateur.
const COMMAND_WHEEL_RESPIN = Symbol("shenpulse.commandWheelRespin");

/** Garde commun aux services asynchrones ; absent hors du flux Commandes. */
function assertCommandContext(shouldExecute) {
  if (typeof shouldExecute === "function" && !shouldExecute()) {
    const error = new Error("Le contexte LIVE de la commande a changé.");
    error.code = "COMMAND_CONTEXT_CHANGED";
    throw error;
  }
}

module.exports = { assertCommandContext, COMMAND_WHEEL_RESPIN };
