"use strict";

const { readPayload, invalidSessionError } = require("./http-client");

const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
const CONTENT_TYPES = new Set([
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg",
  "audio/webm", "audio/mp4", "video/mp4", "video/webm",
  "image/gif", "image/jpeg", "image/png", "image/webp"
]);

/** Autorise un seul fichier via le serveur commun ; aucune clé B2 ne quitte le serveur. */
async function prepareMediaUpload(service, incoming, { identity, currentUid }) {
  const expectedUid = String(incoming.expectedUid || currentUid()).trim();
  const assertAccount = () => {
    if (!expectedUid || currentUid() !== expectedUid) {
      throw invalidSessionError("Le compte ShenPulse a changé. Relancez l’import depuis le compte souhaité.");
    }
  };
  assertAccount();
  const fileName = String(incoming.fileName || "").trim();
  const contentType = String(incoming.contentType || "").trim();
  const size = Number(incoming.size);
  if (!fileName || fileName.length > 240 || /[\\/\x00-\x1f]/.test(fileName)) {
    throw new Error("Le nom du fichier média n’est pas valide.");
  }
  if (!CONTENT_TYPES.has(contentType)) throw new Error("Ce format de média n’est pas pris en charge.");
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_MEDIA_BYTES) {
    throw new Error("Le fichier doit être non vide et ne pas dépasser 200 Mio.");
  }
  const account = await identity();
  assertAccount();
  if (account.uid !== expectedUid || !account.idToken) {
    throw invalidSessionError("La session ShenPulse a expiré. Reconnectez-vous pour importer le fichier.");
  }
  let response;
  let payload;
  try {
    response = await service.fetch(`${service.webOrigin}/api/media/uploads/create`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ownerId: account.uid, fileName, contentType, size }),
      signal: AbortSignal.timeout(20000),
      redirect: "error"
    });
    payload = await readPayload(response);
  } catch {
    assertAccount();
    throw new Error("Le stockage média ShenPulse est temporairement inaccessible. Vérifiez votre connexion et réessayez.");
  }
  assertAccount();
  if (!response.ok || payload?.ok !== true) {
    // Le serveur historique renvoie aussi 500 pour certains jetons Firebase
    // invalides. Ne jamais montrer son diagnostic SDK (ou une page HTML) au rendu.
    const message = String(payload?.error?.message || payload?.error || "");
    if (response.status === 401 || /authentification Firebase|jeton.*(invalide|expir)/i.test(message)) {
      throw invalidSessionError("La session ShenPulse a expiré. Reconnectez-vous pour importer le fichier.");
    }
    if (response.status === 413) throw new Error("Ce fichier dépasse la limite du stockage média ShenPulse (200 Mio).");
    if (response.status === 429) throw new Error("Trop d’imports simultanés. Patientez un instant avant de réessayer.");
    throw new Error(`Le stockage média ShenPulse n’a pas pu préparer l’import (${response.status}). Réessayez dans un instant.`);
  }
  return payload;
}

module.exports = { MAX_MEDIA_BYTES, prepareMediaUpload };
