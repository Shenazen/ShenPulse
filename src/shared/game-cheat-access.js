"use strict";

const crypto = require("node:crypto");

const GAME_CHEAT_ACCESS_ID = "game-tabs";
const GAME_CHEAT_HASH_NAMESPACE = "shenpulse:game-cheat-access:v1:";

function normalizeGameCheatEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}

function isValidGameCheatEmail(value) {
  const email = normalizeGameCheatEmail(value);
  return (
    email.length >= 3 &&
    email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

function gameCheatEmailHash(value) {
  const email = normalizeGameCheatEmail(value);
  if (!isValidGameCheatEmail(email)) return "";
  return crypto
    .createHash("sha256")
    .update(`${GAME_CHEAT_HASH_NAMESPACE}${email}`, "utf8")
    .digest("hex");
}

function gameCheatAccessEntries(settings) {
  const entries = settings?.cheatAccess?.[GAME_CHEAT_ACCESS_ID]?.entries;
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  return entries
    .map((entry) => normalizeGameCheatEmail(entry?.email))
    .filter((email) => {
      if (!isValidGameCheatEmail(email) || seen.has(email)) return false;
      seen.add(email);
      return true;
    })
    .slice(0, 250)
    .map((email) => ({ email }));
}

function gameCheatAccessGrantMap(settings) {
  return Object.fromEntries(
    gameCheatAccessEntries(settings)
      .map(({ email }) => gameCheatEmailHash(email))
      .filter(Boolean)
      .map((hash) => [hash, true])
  );
}

module.exports = {
  GAME_CHEAT_ACCESS_ID,
  gameCheatAccessEntries,
  gameCheatAccessGrantMap,
  gameCheatEmailHash,
  isValidGameCheatEmail,
  normalizeGameCheatEmail
};
