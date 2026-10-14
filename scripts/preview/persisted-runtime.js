"use strict";

/** Aperçu local : lecture ciblée de la session locale du seul compte correspondant. */
const fs = require("node:fs");
const path = require("node:path");

function defaultStateFile() {
  return path.join(
    process.env.SHENPULSE_USER_DATA_DIR ||
      path.join(process.env.APPDATA || "", "shenpulse"),
    "shenpulse-state.json"
  );
}

function readStoredAccount(uid, stateFile = defaultStateFile()) {
  const targetUid = String(uid || "").trim();
  if (!targetUid || !stateFile || !fs.existsSync(stateFile)) return null;
  try {
    const stored = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    const activeUid = String(stored.activeAccountUid || "").trim();
    const sessionUid = String(stored.settings?.account?.uid || "").trim();
    return activeUid === targetUid && sessionUid === targetUid
      ? stored
      : null;
  } catch {
    return null;
  }
}

function loadLocalRuntime(uid, stateFile = defaultStateFile()) {
  const stored = readStoredAccount(uid, stateFile);
  if (!stored) return null;
  const settings = stored.settings || {};
  return {
    apiPort: Math.max(0, Number(settings.apiPort) || 0),
    apiToken: String(settings.apiToken || ""),
    overlayPort: Math.max(0, Number(settings.overlayPort) || 0),
    overlayToken: String(settings.overlayToken || "")
  };
}

module.exports = { defaultStateFile, readStoredAccount, loadLocalRuntime };

