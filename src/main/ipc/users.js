"use strict";

const { readState } = require("../state-projection");

/** Accès explicite et paginé à la base locale, jamais dans le snapshot général. */
function registerUsersIpc({ handle, core, store }) {
  const changed = (operation) => {
    const result = operation();
    core.notifyRenderer("users-changed", { revision: core.viewerService.database().revision });
    return result;
  };
  handle("users:snapshot", (_event, options) => core.viewerService.snapshot(options));
  handle("users:block", (_event, id, blocked) => changed(() => core.viewerService.setBlocked(id, blocked)));
  handle("users:block-list", (_event, usernames, options) => changed(() => core.viewerService.setBlockedList(usernames, options)));
  handle("users:unblock", (_event, options, expectedUid) => {
    const currentUid = readState(store, ["settings.account.uid"]).settings?.account?.uid;
    if (typeof expectedUid !== "string" || !expectedUid || expectedUid !== currentUid) {
      const error = new Error("Le compte a changé pendant cette opération. Actualisez la liste des blocages.");
      error.code = "VIEWER_CONTEXT_CHANGED";
      throw error;
    }
    return changed(() => core.viewerService.unblock(options));
  });
  handle("users:remove", (_event, id) => changed(() => core.viewerService.remove(id)));
  handle("users:cleanup", (_event, options) => changed(() => core.viewerService.cleanup(options)));
  handle("users:clear", (_event, options) => changed(() => core.viewerService.clear(options)));
  handle("users:import", (_event, data) => changed(() => core.viewerService.import(data)));
  handle("users:export", (_event, options) => core.viewerService.export(options));
  handle("users:merge", (_event, options) => changed(() => core.viewerService.merge(options)));
}

module.exports = { registerUsersIpc };
