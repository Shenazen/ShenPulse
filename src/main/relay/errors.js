"use strict";

/** Classification des erreurs de transport et d'identité du relais ; aucun détail secret n'est publié. */
function isCancelledRequest(error) {
  return ["AbortError", "TimeoutError"].includes(error?.name);
}

function isMissingFirebaseUser(error) {
  return /EMAIL_NOT_FOUND|USER_DISABLED|INVALID_LOGIN_CREDENTIALS/i.test(
    String(error?.message || "")
  );
}

module.exports = { isCancelledRequest, isMissingFirebaseUser };
