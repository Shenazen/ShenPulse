"use strict";

/** Contrat commun et registre des groupes de commandes. */
const ACTION_NOT_HANDLED = Symbol("shenpulse.action-not-handled");
const ACTION_HANDLERS = [];
const REGISTERED_ACTIONS = new Set();

function registerActionHandler(actions, handler) {
  if (!(actions instanceof Set) || typeof handler !== "function") {
    throw new TypeError("Groupe de commandes invalide.");
  }
  for (const action of actions) {
    if (REGISTERED_ACTIONS.has(action)) {
      throw new Error(`Commande enregistrée deux fois : ${action}`);
    }
    REGISTERED_ACTIONS.add(action);
  }
  ACTION_HANDLERS.push(handler);
}
