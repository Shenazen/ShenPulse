"use strict";

/** Contrats persistés : ces clés appartiennent au compte, jamais à une autre session. */
const ACCOUNT_WORKSPACE_SCHEMA_VERSION = 1;
const RUNTIME_CHECKPOINT_MS = 5000;
const PRIVATE_STATE_ROOTS = new Set([
  "accountWorkspaces",
  "accountWorkspaceSchemaVersion",
  "activeAccountUid",
  "unclaimedAccountWorkspace"
]);
const UNSAFE_PROJECTION_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const LEGACY_AUTOMATIC_DEMO_VIEWER_IDS = new Set([
  "luna_live",
  "nox_player",
  "pixel_ade",
  "nova_fr",
  "orbit_tv"
]);
const ACCOUNT_SETTING_KEYS = [
  "locale",
  "theme",
  "overlayPort",
  "apiPort",
  "overlayToken",
  "apiToken",
  "historyLimit",
  "startOverlayServer",
  "matchAccess",
  "matches",
  "publicOverlayRelay",
  "minimizeToTray",
  "launchAtStartup",
  "allowKeystrokes",
  "telemetry",
  "liveDirectory",
  "irl",
  "tts",
  "obs",
  "spotify",
  "kick",
  "controllers",
  "tiktok"
];

module.exports = { ACCOUNT_WORKSPACE_SCHEMA_VERSION, RUNTIME_CHECKPOINT_MS, PRIVATE_STATE_ROOTS, UNSAFE_PROJECTION_KEYS, LEGACY_AUTOMATIC_DEMO_VIEWER_IDS, ACCOUNT_SETTING_KEYS };
