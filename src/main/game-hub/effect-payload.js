"use strict";

const { id, safeString } = require("../utils");
const { defaultEffectParameters, effectChoiceValue, interpolateCommand, resolveEffectCode } = require("./commands");

/** Charge utile indépendante : paramètres, commandes, quantités et durées historiques. */
function createEffectPayload(effect, context = {}, options = {}) {
  const requestId = id("effect");
  const defaultParameters = defaultEffectParameters(effect);
  const parameters = {
    ...defaultParameters,
    ...(options.parameters || {})
  };
  for (const parameter of effect.parameters||[]) if(parameter.type === "select") parameters[parameter.id]=effectChoiceValue(parameter,parameters[parameter.id]);
  const configuredDuration =
    effect.durationParameter &&
    Object.prototype.hasOwnProperty.call(
      parameters,
      effect.durationParameter
    )
      ? parameters[effect.durationParameter]
      : options.duration ?? effect.duration ?? 0;
  const configuredQuantity =
    effect.quantityParameter &&
    Object.prototype.hasOwnProperty.call(
      parameters,
      effect.quantityParameter
    )
      ? parameters[effect.quantityParameter]
      : options.quantity ?? effect.quantity ?? 1;
  const payload = {
    requestId,
    type: 1,
    effect: {
      code: "",
      viewer: safeString(context.user?.displayName || context.user?.name || "Viewer", 120),
      viewerId: safeString(context.user?.id || "anonymous", 120),
      quantity: Math.max(1, Number(configuredQuantity || 1)),
      duration: Number(configuredDuration || 0),
      parameters
    }
  };
  const commandTemplates = Array.isArray(effect.commands)
    ? effect.commands
    : [effect.command || effect.code || effect.id];
  payload.effect.commands = commandTemplates.map((command) =>
    interpolateCommand(command, payload.effect)
  );
  payload.effect.command = payload.effect.commands[0];
  payload.effect.code = interpolateCommand(
    resolveEffectCode(effect, payload.effect),
    payload.effect
  );
  return payload;
}

module.exports = { createEffectPayload };
