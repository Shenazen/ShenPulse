"use strict";

/** admin : module « validation », sans initialisation externe au chargement. */


function normalizeAdminModuleError(error, moduleName) {
  const raw = String(error?.message || error || "").slice(0, 500);
  if (
    moduleName === "commerce" &&
    /index not defined|indexOn|adminCommerce\/history|savedAt/i.test(raw)
  ) {
    return {
      code: "firebase-index-missing",
      message:
        "L’index Firebase de l’historique commercial manque encore. Les autres outils admin restent disponibles et le catalogue est affiché en lecture de secours."
    };
  }
  return {
    code: "module-unavailable",
    message:
      moduleName === "trials"
        ? "Le service des offres d’essai est temporairement indisponible."
        : "Le service commercial est temporairement indisponible."
  };
}

function normalizeScope(value) {
  const scope =
    value && typeof value === "object" ? value.scope : value;
  if (scope === false) return "hidden";
  return scope === "admin" || scope === "hidden" ? scope : "public";
}

function normalizeMoney(value, fallback) {
  const amount = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(amount) && amount >= 0
    ? amount.toFixed(2)
    : fallback;
}

function normalizeCurrency(value) {
  const currency = String(value || "EUR")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  return currency.length === 3 ? currency : "EUR";
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function cleanUid(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 160);
}

function cleanKey(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9:._-]/g, "")
    .slice(0, 180);
}

function cleanUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9._]/g, "")
    .slice(0, 30);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function firebaseTokenClaims(token) {
  try {
    const payload = String(token || "").split(".")[1] || "";
    if (!payload) return {};
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "="
    );
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return {};
  }
}

async function readPayload(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text.slice(0, 500) };
  }
}

function firebaseErrorMessage(payload) {
  const code = String(payload?.error?.message || payload?.error || "");
  if (/INVALID_LOGIN_CREDENTIALS|EMAIL_NOT_FOUND|INVALID_PASSWORD/.test(code)) {
    return "Adresse ou mot de passe administrateur incorrect.";
  }
  if (/TOO_MANY_ATTEMPTS/.test(code)) {
    return "Trop de tentatives. Réessayez dans quelques minutes.";
  }
  if (/USER_DISABLED/.test(code)) return "Ce compte administrateur est désactivé.";
  return "Connexion Firebase impossible. Vérifiez le compte et réessayez.";
}

function remoteErrorMessage(payload, response) {
  return String(
    payload?.error?.message ||
      payload?.error ||
      payload?.message ||
      `Service ShenPulse indisponible (HTTP ${response.status}).`
  ).slice(0, 500);
}

module.exports = { normalizeAdminModuleError, normalizeScope, normalizeMoney, normalizeCurrency, normalizeDate, cleanUid, cleanKey, cleanUsername, normalizeEmail, firebaseTokenClaims, readPayload, firebaseErrorMessage, remoteErrorMessage };

