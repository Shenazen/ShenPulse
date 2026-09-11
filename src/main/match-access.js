"use strict";

const crypto = require("node:crypto");

const MATCH_ACCOUNT_DIGITS = 12;
const MATCH_ACCESS_KEY_BYTES = 24;
const MATCH_CHANNEL_BYTES = 18;
const MATCH_SOURCE_PATH_PATTERN = new RegExp(
  `^/match/(\\d{${MATCH_ACCOUNT_DIGITS}})/([A-Za-z0-9_-]{32,128})(?:/(state|events|ticket))?/?$`
);
const MATCH_PUBLIC_SOURCE_PATH_PATTERN = new RegExp(
  `^/m/(\\d{${MATCH_ACCOUNT_DIGITS}})/([A-Za-z0-9_-]{24,128})/?$`
);
const MATCH_BRIDGE_PATH_PATTERN = new RegExp(
  `^/match-bridge/(\\d{${MATCH_ACCOUNT_DIGITS}})/([A-Za-z0-9_-]{24,128})/(ticket)/?$`
);

/**
 * Retourne le numéro public stable d'un compte ShenPulse.
 *
 * Le numéro n'est pas un secret : il rend la source identifiable sans exposer
 * l'UID du fournisseur d'identité. La clé Match séparée reste l'autorisation
 * révocable de la source.
 */
function matchAccountNumber(accountUid) {
  const uid = String(accountUid || "").trim();
  if (!uid) return "";
  const digest = crypto
    .createHash("sha256")
    .update(`shenpulse-match-account:${uid}`, "utf8")
    .digest();
  const minimum = 10n ** BigInt(MATCH_ACCOUNT_DIGITS - 1);
  const range = 9n * minimum;
  return String(minimum + (digest.readBigUInt64BE(0) % range));
}

function createMatchAccessKey() {
  return crypto.randomBytes(MATCH_ACCESS_KEY_BYTES).toString("base64url");
}

function createMatchChannelId() {
  return crypto.randomBytes(MATCH_CHANNEL_BYTES).toString("base64url");
}

function normalizeMatchAccess(value = {}) {
  const candidate = String(value?.accessKey || "").trim();
  return {
    accessKey: /^[A-Za-z0-9_-]{32,128}$/.test(candidate)
      ? candidate
      : createMatchAccessKey()
  };
}

function matchSourcePath({ accountUid, accessKey } = {}) {
  const accountNumber = matchAccountNumber(accountUid);
  const key = String(accessKey || "").trim();
  if (!accountNumber || !/^[A-Za-z0-9_-]{32,128}$/.test(key)) return "";
  return `/match/${accountNumber}/${key}`;
}

function parseMatchSourcePath(pathname) {
  const match = MATCH_SOURCE_PATH_PATTERN.exec(String(pathname || ""));
  if (!match) return null;
  return {
    accountNumber: match[1],
    accessKey: match[2],
    resource: match[3] || "document"
  };
}

function matchPublicSourcePath({ accountUid, channelId } = {}) {
  const accountNumber = matchAccountNumber(accountUid);
  const channel = String(channelId || "").trim();
  if (!accountNumber || !/^[A-Za-z0-9_-]{24,128}$/.test(channel)) return "";
  return `/m/${accountNumber}/${channel}`;
}

function parseMatchPublicSourcePath(pathname) {
  const match = MATCH_PUBLIC_SOURCE_PATH_PATTERN.exec(String(pathname || ""));
  if (!match) return null;
  return {
    accountNumber: match[1],
    channelId: match[2]
  };
}

function parseMatchBridgePath(pathname) {
  const match = MATCH_BRIDGE_PATH_PATTERN.exec(String(pathname || ""));
  if (!match) return null;
  return {
    accountNumber: match[1],
    channelId: match[2],
    resource: match[3]
  };
}

module.exports = {
  MATCH_ACCOUNT_DIGITS,
  createMatchAccessKey,
  createMatchChannelId,
  matchAccountNumber,
  matchPublicSourcePath,
  matchSourcePath,
  normalizeMatchAccess,
  parseMatchBridgePath,
  parseMatchPublicSourcePath,
  parseMatchSourcePath
};
