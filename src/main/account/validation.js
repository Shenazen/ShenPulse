"use strict";

const { DEFAULT_WEB_ORIGIN } = require("./constants");

/** Ne renvoie pas au rendu un lien de paiement déjà traité. */
function withoutApprovalUrl(payload = {}) {
  const result = { ...(payload || {}) };
  delete result.approvalUrl;
  return result;
}

/** Normalisation historique d'e-mail, commune à la session et aux droits. */
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

/** Valide l'adresse avant toute requête externe. */
function requireEmail(value) {
  const email = normalizeEmail(value);
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email) ||
    email.includes("..")
  ) {
    throw new Error("Renseignez une adresse e-mail valide.");
  }
  return email;
}

/** Bornes historiques de connexion et d'inscription, sans stockage du mot de passe. */
function requirePassword(value, { minimumLength = 8 } = {}) {
  const password = String(value || "");
  if (password.length < minimumLength) {
    throw new Error(
      minimumLength > 1
        ? `Le mot de passe doit contenir au moins ${minimumLength} caractères.`
        : "Renseignez le mot de passe du compte ShenPulse."
    );
  }
  if (password.length > 500) {
    throw new Error("Le mot de passe est trop long.");
  }
  return password;
}

/** Forme technique d'UID attendue par les anciens consommateurs du service de compte. */
function cleanUid(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9:_-]/g, "")
    .slice(0, 160);
}

/** Nom public borné sans modifier son contenu visible. */
function cleanDisplayName(value) {
  return String(value || "").trim().slice(0, 120);
}

/** Photo de compte limitée aux URL HTTPS. */
function cleanUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url.slice(0, 2048) : "";
}

/** Seuls les paliers achetables Pro et Premium sont admissibles. */
function requireSubscriptionTier(value) {
  const tier = String(value || "").trim().toLowerCase();
  if (!["pro", "premium"].includes(tier)) {
    throw new Error("Choisissez un abonnement Pro ou Premium.");
  }
  return tier;
}

/** Identifiant produit technique validé avant achat. */
function requireGameProductId(value) {
  const productId = String(value || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,159}$/.test(productId)) {
    throw new Error("Choisissez un jeu disponible à l’achat.");
  }
  return productId;
}

/** Autorise seulement HTTPS et le domaine PayPal ou ses vrais sous-domaines. */
function paypalApprovalUrl(value) {
  const candidate = String(value || "").trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      (url.hostname !== "paypal.com" &&
        !url.hostname.endsWith(".paypal.com"))
    ) {
      throw new Error();
    }
    return url.toString();
  } catch {
    throw new Error("Le lien d’abonnement reçu ne pointe pas vers PayPal.");
  }
}

/** Origine HTTPS du site ; repli historique si la configuration est invalide. */
function normalizeWebOrigin(value) {
  try {
    const url = new URL(String(value || DEFAULT_WEB_ORIGIN));
    if (url.protocol !== "https:") throw new Error();
    return url.origin;
  } catch {
    return DEFAULT_WEB_ORIGIN;
  }
}

/** Refuse toute page d'authentification hors accounts.google.com en HTTPS. */
function googleAuthUri(value) {
  try {
    const target = new URL(String(value || ""));
    if (
      target.protocol !== "https:" ||
      target.hostname !== "accounts.google.com"
    ) {
      throw new Error();
    }
    return target;
  } catch {
    throw new Error(
      "Firebase n'a pas renvoyé une adresse de connexion Google valide."
    );
  }
}

module.exports = { withoutApprovalUrl, normalizeEmail, requireEmail, requirePassword, cleanUid, cleanDisplayName, cleanUrl, requireSubscriptionTier, requireGameProductId, paypalApprovalUrl, normalizeWebOrigin, googleAuthUri };
