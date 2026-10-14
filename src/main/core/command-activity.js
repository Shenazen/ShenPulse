"use strict";

const { safeString } = require("../utils");

/** Métadonnées privées du journal : liste fermée, jamais l'erreur brute d'un fournisseur. */
function commandActivityMetadata(metadata = {}) {
  const result = { sent: metadata.sent === true };
  for (const key of ["profileId", "commandId", "source", "platform"]) result[key] = safeString(metadata[key], 160);
  for (const key of ["executed", "forwarded", "queued", "partial"]) {
    if (Object.hasOwn(metadata, key)) result[key] = metadata[key] === true;
  }
  for (const key of ["executedCount", "failedCount", "queuedCount", "requestedCount", "selectedCount", "queuePosition"]) {
    if (Number.isSafeInteger(metadata[key]) && metadata[key] >= 0 && metadata[key] <= 10000) result[key] = metadata[key];
  }
  if (["music", "action", "overlay"].includes(metadata.executionType)) result.executionType = metadata.executionType;
  if (/^COMMAND_[A-Z_]+$/.test(metadata.executionReason || "")) result.executionReason = safeString(metadata.executionReason, 120);
  return result;
}

module.exports = { commandActivityMetadata };
