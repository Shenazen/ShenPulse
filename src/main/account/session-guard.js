"use strict";

/** Une réponse ancienne n'invalide jamais la nouvelle connexion, même avec le même UID. */
function changedSessionError() {
  const error = new Error("Le compte ShenPulse a changé pendant cette opération. Réessayez.");
  error.code = "ACCOUNT_SESSION_CHANGED";
  error.staleSession = true;
  return error;
}

/** Lie une opération asynchrone à sa génération et, sauf connexion, à son identité locale. */
function captureSessionGuard(service, readSession, { identity = true } = {}) {
  const generation = service.sessionGeneration;
  const initial = readSession();
  const isCurrent = () => {
    const current = readSession();
    return service.sessionGeneration === generation && (!identity || (
      String(current.uid || "") === String(initial.uid || "") &&
      String(current.refreshTokenSecretId || "") === String(initial.refreshTokenSecretId || "")
    ));
  };
  return {
    isCurrent,
    assertCurrent() { if (!isCurrent()) throw changedSessionError(); }
  };
}

module.exports = { captureSessionGuard, changedSessionError };
