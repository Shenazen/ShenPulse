"use strict";

/** Notifie l’interface après une mutation métier, sans changer le contrat IPC. */
function notify(core, channel, value) { core.notifyRenderer(channel, value); }

module.exports = { notify };
