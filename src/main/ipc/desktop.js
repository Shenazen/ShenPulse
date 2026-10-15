"use strict";

/** Presse-papiers, liens externes, import/export et fenêtre.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const fs = require("node:fs");
const { safeString } = require("../utils");
const { notify } = require("./notifications");
const { assertAuthenticatedAccount } = require("../account-access");
const { currentMediaAccountUid, assertMediaAccount } = require("../backblaze-media");

function registerDesktopIpc({ handle, core, store, getWindow, clipboard, dialog, shell }) {
  handle("clipboard:write", (_event, text) => {
    clipboard.writeText(safeString(text, 5000));
    return true;
  });
  
  handle("external:open", async (_event, url) => {
    const target = String(url || "");
    if (!/^https?:\/\//i.test(target)) throw new Error("URL non autorisée.");
    await shell.openExternal(target);
    return true;
  });
  
  handle("data:export", async () => {
    const owner = getWindow();
    const result = await dialog.showSaveDialog(owner, {
      title: "Exporter la configuration ShenPulse",
      defaultPath: `ShenPulse-profile-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: "Profil ShenPulse", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    fs.writeFileSync(result.filePath, JSON.stringify(store.getState(), null, 2), "utf8");
    return { canceled: false, filePath: result.filePath };
  });
  
  handle("data:import", async () => {
    assertAuthenticatedAccount(store);
    const expectedUid = currentMediaAccountUid(store);
    assertMediaAccount(store, expectedUid);
    const owner = getWindow();
    const result = await dialog.showOpenDialog(owner, {
      title: "Importer une configuration ShenPulse",
      properties: ["openFile"],
      filters: [{ name: "Profil ShenPulse", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    assertMediaAccount(store, expectedUid);
    assertAuthenticatedAccount(store);
    const imported = JSON.parse(fs.readFileSync(result.filePaths[0], "utf8"));
    store.importState(imported);
    await core.restartServers();
    notify(core, "state-changed", core.snapshot());
    return { canceled: false, snapshot: core.snapshot() };
  });
  
  handle("data:clear", async () => {
    await core.stopSession();
    await core.stopGameSession({ notify: false });
    store.clearAllData();
    await core.restartServers();
    notify(core, "state-changed", core.snapshot());
    return core.snapshot();
  });
  
  handle("window:minimize", () => getWindow()?.minimize());
  
  handle("window:maximize", () => {
    const window = getWindow();
    if (!window) return;
    if (window.isMaximized()) window.unmaximize();
    else window.maximize();
  });
  
  handle("window:close", () => getWindow()?.close());
}

module.exports = { registerDesktopIpc };
