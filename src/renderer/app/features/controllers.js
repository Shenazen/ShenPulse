"use strict";

let controllerStatus = null;
let midiAccess = null;
let midiLearnActive = false;
let midiLearnedMessage = null;
let midiLastMessage = null;
let kickConnectionStatus = null;
let controllerWorkspaceUid = "";
let midiConnectionPromise = null;
let midiConnectionGeneration = 0;

function ensureControllerWorkspace() {
  const uid = String(snapshot?.state.settings.account?.uid || "");
  if (uid === controllerWorkspaceUid) return false;
  disconnectMidiController();
  controllerWorkspaceUid = uid;
  controllerStatus = null;
  kickConnectionStatus = null;
  return true;
}

function controllerTargets(type = "action") {
  return type === "profile" ? snapshot.state.profiles || [] : window.ShenPulseControllerContract.controllerActionTargets(snapshot.state).filter((action) => action.enabled);
}

function renderControllers() {
  if (!isVerifiedAdminSession()) return renderOwnerOnlyPagePlaceholder("Contrôleurs");
  ensureControllerWorkspace();
  const settings = snapshot.state.settings.controllers || {};
  const devices = controllerStatus?.devices || settings.devices || [];
  const mappings = controllerStatus?.mappings || settings.mappings || [];
  const activeProfile = snapshot.state.profiles?.find((profile) => profile.id === snapshot.state.session?.profileId);
  const automatic = controllerStatus?.automaticConnection ?? (settings.autoConnectDisabled !== true && devices.some((device) => device.mode === "local-plugin"));
  const inputs = midiAccess ? [...midiAccess.inputs.values()].filter((input) => input.state !== "disconnected") : [];
  return `${renderStudioHero("controllers", "Votre régie, au bout des doigts", "Lancez vos actions et changez de profil depuis votre matériel.")}<div class="section-toolbar"><span class="eyebrow">STREAM DECK & MIDI</span><button class="button" data-action="controller-refresh">Actualiser</button></div>
    <div class="settings-layout">
      <section class="card"><header class="card-header"><div><p class="eyebrow">STREAM DECK</p><h3>Un bouton, une réaction</h3></div><span class="badge ${devices.length ? "success" : ""}">${automatic ? "Connexion automatique" : `${devices.length} appareil${devices.length > 1 ? "s" : ""}`}</span></header>
        <div class="card-body"><p>Installez le plugin ShenPulse, puis ajoutez une touche dans Stream Deck. La connexion à ce PC est automatique, sans code. Les commandes suivent le profil ouvert dans ShenPulse.</p>
          <p class="muted">Profil actif : ${escapeHtml(activeProfile?.name || "Aucun")}</p>
          <div class="button-row"><button class="button primary" data-action="controller-install">Installer le plugin</button><button class="button" data-action="controller-connect-local">Reconnecter Stream Deck</button></div>
          ${controllerStatus?.pluginInstalled ? '<p class="muted">Plugin installé. Relancez Stream Deck pour y retrouver les commandes ShenPulse.</p>' : ""}
          ${devices.map((device) => `<div class="list-row"><span class="event-icon">▦</span><div><h4>${escapeHtml(device.name)}</h4><p>Appairé le ${escapeHtml(new Date(device.pairedAt).toLocaleDateString("fr-FR"))}</p></div><button class="button small ghost" data-action="controller-revoke" data-id="${escapeHtml(device.id)}">Révoquer</button></div>`).join("")}
        </div>
      </section>
      <section class="card"><header class="card-header"><div><p class="eyebrow">MIDI</p><h3>Vos pads et contrôleurs</h3></div><span class="badge ${inputs.length ? "success" : ""}">${inputs.length ? `${inputs.length} entrée${inputs.length > 1 ? "s" : ""}` : "Non connecté"}</span></header>
        <div class="card-body"><p>Autorisez l’accès MIDI, puis appuyez sur un pad ou bougez un contrôle pour lui attribuer une action. Les associations restent enregistrées sur cet appareil.</p>
          <div class="button-row"><button class="button primary" data-action="controller-midi-connect">${midiAccess ? "Rechercher les appareils" : "Connecter le MIDI"}</button><button class="button" data-action="controller-midi-learn">${midiLearnActive ? "Annuler l’apprentissage" : "Apprendre une commande"}</button>${midiAccess ? '<button class="button ghost" data-action="controller-midi-disconnect">Déconnecter</button>' : ""}</div>
          ${midiLearnActive ? '<p class="muted">En attente d’un signal : appuyez sur un pad ou bougez un contrôle.</p>' : ""}
          ${inputs.map((input) => `<p><span class="badge success">MIDI</span> ${escapeHtml(input.name || "Entrée MIDI")} · ${escapeHtml(input.manufacturer || "")}</p>`).join("")}
          ${midiLastMessage ? `<p class="muted" data-midi-status>Dernier signal : canal ${midiLastMessage.channel}, ${midiLastMessage.kind === "note" ? "note" : "contrôle"} ${midiLastMessage.number}, valeur ${midiLastMessage.value}.</p>` : ""}
        </div>
      </section>
    </div>
    <section class="card" style="margin-top:18px"><header class="card-header"><div><p class="eyebrow">ASSOCIATIONS MIDI</p><h3>${mappings.length} commande${mappings.length > 1 ? "s" : ""}</h3></div><button class="button small" data-action="controller-mapping-add">Ajouter manuellement</button></header>
      <div class="card-body list">${mappings.length ? mappings.map((mapping) => {
        const target = controllerTargets(mapping.targetType).find((entry) => entry.id === mapping.targetId);
        return `<div class="list-row"><span class="event-icon">♩</span><div><h4>${escapeHtml(mapping.name)}</h4><p>Canal ${mapping.channel} · ${mapping.kind === "note" ? "Note" : "Contrôle"} ${mapping.number} → ${escapeHtml(target?.name || "Cible supprimée")}</p></div><div class="toolbar-actions"><button class="button small" data-action="controller-mapping-test" data-id="${escapeHtml(mapping.id)}">Tester</button><button class="button small" data-action="controller-mapping-edit" data-id="${escapeHtml(mapping.id)}">Modifier</button><button class="button small ghost" data-action="controller-mapping-remove" data-id="${escapeHtml(mapping.id)}">Supprimer</button></div></div>`;
      }).join("") : emptyInline("Apprenez un premier pad pour lancer une action.")}</div>
    </section>`;
}

async function refreshControllers({ renderPage = true } = {}) {
  ensureControllerWorkspace();
  const owner = controllerWorkspaceUid;
  const status = await api.controllers.status();
  if (owner !== String(snapshot?.state.settings.account?.uid || "") || !isVerifiedAdminSession()) return null;
  controllerStatus = status;
  if (renderPage) render();
  return controllerStatus;
}

async function connectMidiController() {
  if (midiConnectionPromise) return midiConnectionPromise;
  if (!navigator.requestMIDIAccess) throw new Error("L’accès MIDI est indisponible dans cette version de ShenPulse.");
  const generation = midiConnectionGeneration;
  const owner = controllerWorkspaceUid;
  const operation = (async () => {
    const access = midiAccess || await navigator.requestMIDIAccess({ sysex: false });
    if (generation !== midiConnectionGeneration || owner !== String(snapshot?.state.settings.account?.uid || "") || !isVerifiedAdminSession()) {
      if (access !== midiAccess) releaseMidiController(access);
      return false;
    }
    midiAccess = access;
    const bind = () => {
      if (midiAccess !== access) return;
      for (const input of access.inputs.values()) input.onmidimessage = (event) => receiveMidiMessage(event, input);
    };
    access.onstatechange = () => { bind(); if (midiAccess === access && currentPage === "controllers") render(); };
    bind();
    await refreshControllers({ renderPage: false });
    if (midiAccess !== access) return false;
    render();
    const count = [...access.inputs.values()].filter((input) => input.state !== "disconnected").length;
    toast(count ? "MIDI connecté" : "Aucun appareil MIDI détecté", count ? `${count} entrée(s) disponible(s). Vous pouvez apprendre une commande.` : "Branchez votre contrôleur MIDI au PC. Sa détection sera automatique.");
    return true;
  })();
  midiConnectionPromise = operation;
  try { return await operation; }
  catch (error) {
    if (["NotAllowedError", "SecurityError"].includes(error.name)) throw new Error("L’accès MIDI a été refusé. Reconnectez-vous à ShenPulse et réessayez.");
    throw error;
  } finally { if (midiConnectionPromise === operation) midiConnectionPromise = null; }
}

function releaseMidiController(access) {
  access.onstatechange = null;
  for (const input of access.inputs.values()) {
    input.onmidimessage = null;
    try { input.close?.()?.catch?.(() => {}); } catch { /* Port déjà fermé. */ }
  }
}

function disconnectMidiController() {
  midiConnectionGeneration += 1;
  midiConnectionPromise = null;
  if (midiAccess) releaseMidiController(midiAccess);
  midiAccess = null;
  midiLearnActive = false;
  midiLearnedMessage = null;
  midiLastMessage = null;
}

function receiveMidiMessage(event, input) {
  if (!isVerifiedAdminSession()) { disconnectMidiController(); return; }
  if (ensureControllerWorkspace()) return;
  const contract = window.ShenPulseControllerContract;
  const message = contract.normalizeMidiMessage(event.data, input.id);
  if (!message) return;
  midiLastMessage = message;
  const status = content.querySelector("[data-midi-status]");
  if (status) status.textContent = `Dernier signal : canal ${message.channel}, ${message.kind === "note" ? "note" : "contrôle"} ${message.number}, valeur ${message.value}.`;
  if (midiLearnActive && message.value > 0) {
    midiLearnActive = false;
    midiLearnedMessage = { ...message, deviceName: input.name };
    if (currentPage === "controllers") render();
    try { openControllerMappingEditor(null, midiLearnedMessage); }
    catch (error) { toast("Association MIDI impossible", error.message, true); }
    return;
  }
  if (!status && currentPage === "controllers") render();
  const mappings = controllerStatus?.mappings || snapshot.state.settings.controllers?.mappings || [];
  for (const mapping of mappings) {
    if (!contract.midiMappingMatches(mapping, message)) continue;
    api.controllers.execute({ id: mapping.id, value: message.value, deviceId: message.deviceId }).catch((error) => toast("Commande MIDI impossible", error.message, true));
  }
}

function openControllerMappingEditor(mapping = null, learned = null) {
  const value = mapping || { name: learned?.deviceName ? `${learned.deviceName} · ${learned.number}` : "Commande MIDI", channel: learned?.channel || 1, kind: learned?.kind || "note", number: learned?.number ?? 60, deviceId: learned?.deviceId || "", targetType: "action", targetId: "", threshold: 1, cooldownMs: 300 };
  const targets = [...controllerTargets("action").map((target) => ({ ...target, type: "action" })), ...controllerTargets("profile").map((target) => ({ ...target, type: "profile" }))];
  if (!targets.length) return toast("Créez une action", "Ajoutez une action avant de l’associer à votre contrôleur.", true);
  openEditor({
    title: mapping ? "Modifier la commande MIDI" : "Associer une commande MIDI",
    body: `<div class="form-grid">${field("name", "Nom", value.name, "text", "required")}${field("channel", "Canal MIDI", value.channel, "number", 'min="1" max="16" required')}${field("number", "Numéro de note ou de contrôle", value.number, "number", 'min="0" max="127" required')}<label class="field"><span>Type de signal</span><select name="kind"><option value="note" ${value.kind === "note" ? "selected" : ""}>Note / pad</option><option value="cc" ${value.kind === "cc" ? "selected" : ""}>Contrôle (CC)</option></select></label><label class="field full"><span>Action ou profil</span><select name="target">${targets.map((target) => `<option value="${escapeHtml(`${target.type}:${target.id}`)}" ${target.type === value.targetType && target.id === value.targetId ? "selected" : ""}>${target.type === "profile" ? "Profil" : "Action"} · ${escapeHtml(target.name)}</option>`).join("")}</select></label>${field("threshold", "Valeur minimale", value.threshold, "number", 'min="1" max="127"')}${field("cooldownMs", "Délai entre deux commandes (ms)", value.cooldownMs, "number", 'min="150" max="60000"')}</div>`,
    onSubmit: async (data) => {
      const raw = String(data.get("target"));
      const split = raw.indexOf(":");
      controllerStatus = await api.controllers.saveMapping({ ...value, id: mapping?.id, name: data.get("name"), channel: Number(data.get("channel")), number: Number(data.get("number")), kind: data.get("kind"), targetType: raw.slice(0, split), targetId: raw.slice(split + 1), threshold: Number(data.get("threshold")), cooldownMs: Number(data.get("cooldownMs")), enabled: true });
      acceptSnapshot(await api.getSnapshot());
    }
  });
}

function renderKickConnectionCard() {
  ensureControllerWorkspace();
  const settings = snapshot.state.settings.kick || {};
  // Un identifiant de coffre n'est pas une preuve de jeton valide. Le statut
  // réel du service prime toujours, y compris lorsqu'il renvoie false.
  const status = { configured: Boolean(settings.clientId && settings.clientSecretId), connected: false,
    receiving: snapshot.state.connections.some((entry) => entry.type === "kick-native" && entry.status === "connected"),
    account: settings.account, lastEventAt: settings.lastEventAt, webhookUrl: settings.webhookUrl,
    ...(kickConnectionStatus || {}) };
  return `<section class="card" style="margin-bottom:20px"><header class="card-header"><div><p class="eyebrow">KICK LIVE</p><h3>${status.account?.name ? escapeHtml(status.account.name) : "Connecter votre compte Kick"}</h3></div><span class="badge ${status.receiving ? "success" : status.connected ? "cyan" : ""}">${status.receiving ? "ÉVÉNEMENTS ACTIFS" : status.connected ? "COMPTE AUTORISÉ" : "À CONNECTER"}</span></header>
    <div class="card-body"><p>Autorisez votre compte dans le navigateur pour recevoir le chat, les follows, les abonnements et les cadeaux KICKs avec l’API officielle.</p><p class="muted">La première configuration demande une application créée dans les réglages développeur Kick et un webhook HTTPS public redirigé vers ShenPulse. Le secret de l’application et les jetons sont conservés dans le coffre chiffré local.</p>
      <div class="button-row"><button class="button primary" data-action="kick-connect" ${status.configured ? "" : "disabled"}>${status.connected ? "Autoriser à nouveau" : "Connecter avec Kick"}</button><button class="button" data-action="kick-configure">Configurer l’application Kick</button><button class="button ghost" data-action="kick-refresh">Actualiser</button>${status.connected ? '<button class="button danger" data-action="kick-disconnect">Déconnecter le compte</button>' : ""}</div>
      ${status.message ? `<p class="notice" role="status">${escapeHtml(status.message)}</p>` : ""}
      ${status.lastEventAt ? `<p class="muted">Dernier événement reçu : ${escapeHtml(new Date(status.lastEventAt).toLocaleTimeString("fr-FR"))}</p>` : ""}
    </div></section>`;
}

async function openKickConfiguration() {
  const status = await api.kick.status();
  const settings = snapshot.state.settings.kick || {};
  openEditor({
    title: "Configurer Kick",
    kicker: "CONNEXION OFFICIELLE",
    body: `<div class="notice"><p>Créez une application dans <a href="#" data-action="open-url" data-value="https://kick.com/settings/developer">les réglages développeur Kick</a>. Enregistrez cette URL de retour :</p><code>${escapeHtml(status.callbackUri)}</code><p>Pour recevoir les événements, publiez un tunnel HTTPS vers <code>${escapeHtml(status.webhookLocalUrl)}</code>, puis enregistrez cette adresse publique comme Webhook URL dans Kick. Les événements ne sont reçus que lorsque le tunnel et ShenPulse sont ouverts.</p></div><div class="form-grid">${field("clientId", "Client ID", settings.clientId || "", "text", "full required")}${field("clientSecret", settings.clientSecretId ? "Client Secret (laisser vide pour conserver)" : "Client Secret", "", "password", settings.clientSecretId ? "full" : "full required")}${field("webhookUrl", "URL publique du webhook HTTPS", settings.webhookUrl || "", "url", "full required")}${field("port", "Port local Kick", settings.port || 21218, "number", 'min="1024" max="65535" required')}</div>`,
    onSubmit: async (data) => {
      if (snapshot.state.connections.some((entry) => entry.id === "source_kick")) await api.stopConnection("source_kick");
      kickConnectionStatus = await api.kick.configure({ clientId: data.get("clientId"), clientSecret: data.get("clientSecret"), webhookUrl: data.get("webhookUrl"), port: Number(data.get("port")) });
      acceptSnapshot(await api.getSnapshot());
    }
  });
}
