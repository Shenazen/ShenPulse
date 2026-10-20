"use strict";

const CONTROLLER_ACTIONS = new Set(["controller-refresh", "controller-install", "controller-connect-local", "controller-revoke", "controller-midi-connect", "controller-midi-disconnect", "controller-midi-learn", "controller-mapping-add", "controller-mapping-edit", "controller-mapping-remove", "controller-mapping-test", "kick-configure", "kick-connect", "kick-disconnect", "kick-refresh"]);

async function handleControllerAction({ action, id }) {
  if (!CONTROLLER_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  try {
    return await runControllerAction({ action, id });
  } catch (error) {
    toast("Commande du contrôleur impossible", error?.message || "Réessayez dans quelques instants.", true);
  }
}

async function runControllerAction({ action, id }) {
  ensureControllerWorkspace();
  if (action === "controller-refresh") {
    const status = await refreshControllers();
    if (status) toast("Contrôleurs actualisés", `${status.devices.length} appareil(s) appairé(s) · ${status.mappings.length} association(s) MIDI.`);
    return;
  }
  if (action === "controller-install") {
    const result = await api.controllers.install();
    if (result?.installed !== true) throw new Error("Le plugin Stream Deck n’a pas confirmé son installation.");
    await refreshControllers();
    toast("Plugin ShenPulse installé", "Relancez Stream Deck pour afficher les nouvelles commandes.");
    return;
  }
  if (action === "controller-connect-local") { controllerStatus = await api.controllers.connectLocal(); acceptSnapshot(await api.getSnapshot()); render(); toast("Stream Deck prêt", "La connexion au profil ouvert est automatique, sans code."); return; }
  if (action === "controller-revoke") { controllerStatus = await api.controllers.revoke(id); acceptSnapshot(await api.getSnapshot()); render(); toast("Appareil révoqué"); return; }
  if (action === "controller-midi-connect") return connectMidiController();
  if (action === "controller-midi-disconnect") { disconnectMidiController(); render(); toast("MIDI déconnecté"); return; }
  if (action === "controller-midi-learn") {
    if (!midiAccess && !(await connectMidiController())) return;
    midiLearnActive = !midiLearnActive;
    render();
    toast(midiLearnActive ? "Apprentissage MIDI activé" : "Apprentissage MIDI annulé", midiLearnActive ? "Appuyez sur un pad ou bougez un contrôle pour lui associer une action." : "");
    return;
  }
  if (action === "controller-mapping-add") return openControllerMappingEditor();
  if (action === "controller-mapping-edit") {
    const mapping = (controllerStatus?.mappings || snapshot.state.settings.controllers?.mappings || []).find((entry) => entry.id === id);
    if (!mapping) throw new Error("Association introuvable. Actualisez la liste.");
    return openControllerMappingEditor(mapping);
  }
  if (action === "controller-mapping-remove") { controllerStatus = await api.controllers.removeMapping(id); acceptSnapshot(await api.getSnapshot()); render(); toast("Association supprimée"); return; }
  if (action === "controller-mapping-test") {
    const mapping = (controllerStatus?.mappings || snapshot.state.settings.controllers?.mappings || []).find((entry) => entry.id === id);
    if (!mapping) throw new Error("Association introuvable.");
    const result = await api.controllers.execute({ id, value: 127, deviceId: mapping.deviceId });
    if (result?.ignored) toast("Commande non exécutée", "L’association est désactivée ou son délai entre deux commandes n’est pas écoulé.");
    else if (result?.ok === true) toast("Commande exécutée");
    else throw new Error("ShenPulse n’a pas confirmé l’exécution de cette commande.");
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
