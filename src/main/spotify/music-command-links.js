"use strict";

/** Liaison par profil des commandes Song Requests et des anciens raccourcis Spotify. */
const { normalizeSongRequestSettings } = require("./song-request-settings");
const { normalizeChatbotCommand, chatbotAliases } = require("../../shared/chatbot-command");
const OPERATIONS = Object.freeze({ request: "requests_add", skip: "requests_skip", nowPlaying: "requests_current", queue: "requests_list" });
const keyFor = (entry) => entry?.execution?.type === "music"
  ? Object.keys(OPERATIONS).find((key) => OPERATIONS[key] === entry.execution.operation) || "" : "";

function compatibleShortcut(entry, key) {
  if (entry?.execution?.type !== "music") return false;
  return key === "skip" && entry.execution.operation === "next" ||
    key === "request" && entry.execution.operation === "queue" && entry.execution.useArgs === true;
}

function musicSettingsCommandKey(entry, names = {}) {
  const key = keyFor(entry);
  if (key) return key;
  if (compatibleShortcut(entry, entry?.songRequestKey)) return entry.songRequestKey;
  return Object.keys(OPERATIONS).find((name) => compatibleShortcut(entry, name) &&
    String(entry.command || "").toLowerCase() === String(names[name] || "").toLowerCase()) || "";
}

function songCommands(settings, commands = [], strict = false, previousSettings = {}) {
  const rows = [...commands];
  const previousNames = previousSettings.commands || settings.commands;
  for (const [key, operation] of Object.entries(OPERATIONS)) {
    const existing = rows.find((entry) => keyFor(entry) === key) ||
      rows.find((entry) => musicSettingsCommandKey(entry, previousNames) === key) ||
      rows.find((entry) => musicSettingsCommandKey(entry, settings.commands) === key);
    const shortcut = existing && !keyFor(existing);
    if ((!settings.enabled || !settings.commandEnabled[key]) && !existing) continue;
    // Ne pas désactiver un raccourci Pro ancien au simple chargement d’un profil
    // où Song Requests n’a jamais été utilisé. Une sauvegarde explicite le lie.
    if (shortcut && !strict && !settings.enabled && !existing.songRequestKey) continue;
    let commandId = existing?.id || "song_requests_" + key;
    while (!existing && rows.some((row) => row.id === commandId)) commandId += "_2";
    const command = {
      ...existing, id: commandId, kind: "command",
      command: settings.commands[key], enabled: settings.enabled && settings.commandEnabled[key],
      platform: existing?.platform || "all",
      audience: shortcut ? existing.audience || "all"
        : key === "skip" ? settings.allowViewerSkip ? existing?.audience === "subscriber" ? "subscriber" : "all" : "moderator" : existing?.audience || "all",
      cooldownMs: existing?.cooldownMs ?? 2000, globalCooldownMs: existing?.globalCooldownMs ?? 0,
      aliases: existing?.aliases || [], execution: shortcut ? { ...existing.execution } : { type: "music", operation },
      response: existing?.response || ""
    };
    if (shortcut) {
      command.songRequestKey = key;
      if (key === "skip") {
        if (strict && previousSettings.allowViewerSkip !== settings.allowViewerSkip) {
          command.audience = settings.allowViewerSkip ? "all" : "moderator";
        } else settings.allowViewerSkip = command.audience !== "moderator";
      }
    }
    const collision = !existing && rows.some((row) => row.id !== command.id && row.enabled !== false &&
      [row.command, ...chatbotAliases(row.aliases)].some((word) => String(word).toLowerCase() === command.command));
    if (collision && (!strict || previousNames[key] === command.command)) continue;
    if (strict) normalizeChatbotCommand(command, { commands: rows });
    const index = rows.findIndex((row) => row.id === command.id);
    if (index < 0) rows.push(command); else rows[index] = command;
  }
  return rows;
}

function applyMusicSettings(state, incoming) {
  const current = normalizeSongRequestSettings(state.settings.spotify?.songRequests);
  const settings = normalizeSongRequestSettings({ ...current, ...incoming,
    commands: { ...current.commands, ...(incoming.commands || {}) },
    commandEnabled: { ...current.commandEnabled, ...(incoming.commandEnabled || {}) } }, true);
  const commands = songCommands(settings, state.commands || [], true, current);
  state.settings.spotify ||= {};
  state.settings.spotify.songRequests = settings;
  state.commands = commands;
  return settings;
}

/** Même mutation que le CRUD Commandes ; la cible Spotify et les alias restent conservés. */
function applyMusicCommandEdit(state, entry, previous) {
  const settings = normalizeSongRequestSettings(state.settings.spotify?.songRequests);
  const oldKey = musicSettingsCommandKey(previous, settings.commands);
  const key = keyFor(entry) || (oldKey && compatibleShortcut(entry, oldKey) ? oldKey : musicSettingsCommandKey(entry, settings.commands));
  if (!key && !oldKey) return;
  if (oldKey && oldKey !== key) settings.commandEnabled[oldKey] = false;
  if (key) {
    if ((state.commands || []).some((row) => row.id !== entry.id && musicSettingsCommandKey(row, settings.commands) === key)) {
      throw new Error("Cette commande Song Requests existe déjà. Modifiez-la depuis Musique ou Commandes.");
    }
    settings.commands[key] = entry.command;
    settings.commandEnabled[key] = entry.enabled !== false;
    if (entry.enabled !== false && !settings.enabled) {
      for (const name of Object.keys(OPERATIONS)) settings.commandEnabled[name] = name === key;
      settings.enabled = true;
    }
    if (key === "skip") settings.allowViewerSkip = entry.audience !== "moderator";
    if (!keyFor(entry)) entry.songRequestKey = key;
  }
  state.settings.spotify ||= {};
  state.settings.spotify.songRequests = normalizeSongRequestSettings(settings, true);
}

module.exports = { OPERATIONS, songRequestCommandKey: keyFor, musicSettingsCommandKey, songCommands, applyMusicSettings, applyMusicCommandEdit };
