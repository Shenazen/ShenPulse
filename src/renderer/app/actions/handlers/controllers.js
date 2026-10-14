"use strict";

const CONTROLLER_ACTIONS = new Set(["controller-refresh", "controller-install", "controller-pair", "controller-revoke", "controller-midi-connect", "controller-midi-disconnect", "controller-midi-learn", "controller-mapping-add", "controller-mapping-edit", "controller-mapping-remove", "controller-mapping-test", "kick-configure", "kick-connect", "kick-disconnect", "kick-refresh"]);

async function handleControllerAction({ action, id }) {
  if (!CONTROLLER_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  ensureControllerWorkspace();
  if (action === "controller-refresh") return refreshControllers();
  if (action === "controller-install") {
    await api.controllers.install();
    toast("Plugin ShenPulse installé", "Relancez Stream Deck pour afficher les nouvelles commandes.");
    return;
  }
  if (action === "controller-pair") { controllerPairing = await api.controllers.pair(); render(); return; }
  if (action === "controller-revoke") { controllerStatus = await api.controllers.revoke(id); acceptSnapshot(await api.getSnapshot()); return; }
  if (action === "controller-midi-connect") return connectMidiController();
  if (action === "controller-midi-disconnect") { disconnectMidiController(); render(); return; }
  if (action === "controller-midi-learn") { midiLearnActive = !midiLearnActive; render(); return; }
  if (action === "controller-mapping-add") return openControllerMappingEditor();
  if (action === "controller-mapping-edit") return openControllerMappingEditor((controllerStatus?.mappings || snapshot.state.settings.controllers?.mappings || []).find((mapping) => mapping.id === id));
  if (action === "controller-mapping-remove") { controllerStatus = await api.controllers.removeMapping(id); acceptSnapshot(await api.getSnapshot()); return; }
  if (action === "controller-mapping-test") {
    const mapping = (controllerStatus?.mappings || snapshot.state.settings.controllers?.mappings || []).find((entry) => entry.id === id);
    if (!mapping) throw new Error("Association introuvable.");
    await api.controllers.execute({ id, value: 127, deviceId: mapping.deviceId });
    toast("Commande envoyée");
    return;
  }
  if (action === "kick-configure") return openKickConfiguration();
  if (action === "kick-refresh") { kickConnectionStatus = await api.kick.status(); render(); return; }
  if (action === "kick-connect") {
    toast("Autorisation Kick", "Terminez la connexion dans votre navigateur.");
    kickConnectionStatus = await api.kick.connect();
    acceptSnapshot(await api.getSnapshot());
    await api.startConnection("source_kick");
    kickConnectionStatus = await api.kick.status();
    acceptSnapshot(await api.getSnapshot());
    toast("Kick connecté");
    return;
  }
  if (action === "kick-disconnect") {
    await api.stopConnection("source_kick");
    kickConnectionStatus = await api.kick.disconnect();
    acceptSnapshot(await api.getSnapshot());
    return;
  }
}

registerActionHandler(CONTROLLER_ACTIONS, handleControllerAction);
