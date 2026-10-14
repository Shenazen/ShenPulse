"use strict";

/** Modération et déduplication du TTS : TTLs, rôles et Unicode conservés. */
const { safeString } = require("../utils");

const TTS_EMOJI_PATTERN =
  /(?:[#*0-9]\uFE0F?\u20E3|[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200D\u20E3\uFE0E\uFE0F])/gu;
const TTS_LINK_PATTERN =
  /(?:\bhttps?:\/\/|\bwww\.)\S+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|\b(?:[\w-]+\.)+(?:com|fr|net|org|gg|tv|io|co)\b/iu;
const TTS_EVENT_DEDUPE_MS = 30 * 60 * 1000;
const TTS_CONTENT_DEDUPE_MS = 30 * 1000;
const TTS_DEDUPE_MAX_ENTRIES = 4000;
function filterTtsChatComment(value, config = {}) {
  let text = safeString(value, 1000).trim();
  if (!text) return "";
  const maxCharacters = Number(config.maxCharacters);
  if (Number.isFinite(maxCharacters) && maxCharacters > 0 &&
      [...text].length > Math.max(1, Math.min(1000, Math.round(maxCharacters)))) return "";
  const normalizedText = normalizeTtsModerationText(text);
  if (Array.isArray(config.blockedWords) && config.blockedWords.some((word) => {
    const normalizedWord = normalizeTtsModerationText(word);
    return normalizedWord && normalizedText.includes(normalizedWord);
  })) return "";
  if (text.startsWith("@") && config.allowMentions !== true) return "";
  if (/^[!/]/u.test(text) && config.allowCommands !== true) return "";
  if (TTS_LINK_PATTERN.test(text) && config.allowLinks !== true) return "";
  if (config.readEmojis !== true) {
    text = text
      .replace(TTS_EMOJI_PATTERN, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return safeString(text, 1000);
}

function normalizeTtsModerationText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("fr");
}

function isTtsUserAllowed(user = {}, config = {}) {
  if (Array.isArray(config.blockedUsers) && config.blockedUsers.some((name) =>
    normalizeTtsModerationText(name).replace(/^@/, "") ===
      normalizeTtsModerationText(user.name || user.id).replace(/^@/, "")
  )) return false;
  if (!Array.isArray(config.allowedRoles)) return true;
  const roles = new Set(config.allowedRoles);
  if (roles.has("all")) return true;
  if (roles.has("moderator") && user.moderator === true) return true;
  if (roles.has("subscriber") && user.subscriber === true) return true;
  if (roles.has("team") && Number(user.teamLevel) > 0) return true;
  return roles.has("viewer") && !user.moderator && !user.subscriber && !(Number(user.teamLevel) > 0);
}

function claimTtsChatComment(readMessages, event = {}, text = "", now = Date.now()) {
  
  const source = safeString(event.source || "unknown", 80).toLowerCase();
  const viewer = safeString(
    event.user?.id || event.user?.name || "anonymous",
    160
  ).toLowerCase();
  const normalizedText = safeString(text, 1000)
    .normalize("NFKC")
    .toLocaleLowerCase("fr")
    .replace(/\s+/g, " ")
    .trim();
  const keys = [
    event.id
      ? {
          key: `event:${source}:${safeString(event.id, 160)}`,
          ttl: TTS_EVENT_DEDUPE_MS
        }
      : null,
    {
      key: `content:${source}:${viewer}:${normalizedText}`,
      ttl: TTS_CONTENT_DEDUPE_MS
    }
  ].filter(Boolean);
  const duplicate = keys.some(({ key, ttl }) => {
    const previous = readMessages.get(key);
    return Number.isFinite(previous) && now - previous < ttl;
  });
  for (const { key } of keys) {
    readMessages.delete(key);
    readMessages.set(key, now);
  }
  if (readMessages.size > TTS_DEDUPE_MAX_ENTRIES) {
    for (const [key, timestamp] of readMessages) {
      if (now - timestamp >= TTS_EVENT_DEDUPE_MS) {
        readMessages.delete(key);
      }
    }
    while (readMessages.size > TTS_DEDUPE_MAX_ENTRIES) {
      readMessages.delete(readMessages.keys().next().value);
    }
  }
  return !duplicate;
}

module.exports = { filterTtsChatComment, isTtsUserAllowed, claimTtsChatComment };
