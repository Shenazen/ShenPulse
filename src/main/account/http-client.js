"use strict";

/** Lit une réponse JSON ; les erreurs textuelles restent exploitables sans perdre leur message. */
async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
}

/** Classe une erreur du site sans invalider une session sur une simple panne réseau. */
function apiError(payload, status = 0) {
  const message = String(
    payload?.error?.message || payload?.error || payload?.message || ""
  ).trim();
  const error = new Error(
    message || `Le service ShenPulse a refusé la demande (${status}).`
  );
  error.status = status;
  if ([401, 403].includes(Number(status))) {
    error.invalidSession = Number(status) === 401;
  }
  return error;
}

/** Traduction stable des erreurs Firebase et distinction des sessions réellement invalides. */
function firebaseAuthError(payload, refreshing = false) {
  const code = String(
    payload?.error?.message || payload?.error || ""
  )
    .split(" : ")[0]
    .trim()
    .toUpperCase();
  const invalidCodes = new Set([
    "EMAIL_NOT_FOUND",
    "INVALID_PASSWORD",
    "INVALID_LOGIN_CREDENTIALS",
    "INVALID_REFRESH_TOKEN",
    "TOKEN_EXPIRED",
    "USER_DISABLED",
    "USER_NOT_FOUND"
  ]);
  const messages = {
    EMAIL_EXISTS:
      "Cette adresse e-mail est déjà utilisée. Connectez-vous ou réinitialisez le mot de passe.",
    EMAIL_NOT_FOUND: "Adresse ou mot de passe incorrect.",
    INVALID_EMAIL: "Cette adresse e-mail n’est pas valide.",
    INVALID_PASSWORD: "Adresse ou mot de passe incorrect.",
    INVALID_LOGIN_CREDENTIALS:
      "Adresse ou mot de passe incorrect.",
    INVALID_REFRESH_TOKEN:
      "La session ShenPulse a expiré. Reconnectez-vous.",
    TOKEN_EXPIRED:
      "La session ShenPulse a expiré. Reconnectez-vous.",
    USER_DISABLED: "Ce compte ShenPulse a été désactivé.",
    USER_NOT_FOUND: "Ce compte ShenPulse n’existe plus.",
    WEAK_PASSWORD:
      "Le mot de passe doit contenir au moins 8 caractères.",
    OPERATION_NOT_ALLOWED:
      "Cette méthode de connexion n’est pas activée dans Firebase.",
    TOO_MANY_ATTEMPTS_TRY_LATER:
      "Trop de tentatives. Réessayez dans quelques minutes."
  };
  const error = new Error(
    messages[code] ||
      (refreshing
        ? "Impossible de renouveler la session ShenPulse."
        : "Connexion au compte ShenPulse impossible.")
  );
  error.code = code;
  error.invalidSession = invalidCodes.has(code);
  return error;
}

/** Marque explicitement une session invalide pour le traitement de déconnexion. */
function invalidSessionError(message) {
  const error = new Error(message);
  error.invalidSession = true;
  return error;
}

/** Une erreur réseau générique ne doit jamais vider la session locale. */
function isInvalidSessionError(error) {
  return error?.invalidSession === true;
}

/** Requête et lecture communes ; l'appelant conserve l'URL, les en-têtes, le corps et le délai. */
async function requestJson(service, url, options, errorFactory = apiError) {
  const response = await service.fetch(url, options);
  const payload = await readPayload(response);
  if (!response.ok) throw errorFactory(payload, response.status);
  return payload;
}

module.exports = { readPayload, requestJson, apiError, firebaseAuthError, invalidSessionError, isInvalidSessionError };
