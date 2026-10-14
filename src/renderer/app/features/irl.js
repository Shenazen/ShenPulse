"use strict";

/**
 * Espace IRL : présentation uniquement, sans découverte ni commande réseau au rendu.
 * Les commandes restent déléguées aux gestionnaires existants via leurs data-*.
 * La compatibilité PlugPlus est commune aux appareils, aux compteurs et aux tests.
 */

function isPlugPlusIrlDevice(device = {}) {
  const identity = `${device.id || ""} ${device.model || ""}`;
  return /(?:shellyplusplugs|plusplugs|snpl-00112eu|shelly\s+plus\s+plug\s+s)/i.test(
    identity
  );
}

function isControllableIrlDevice(device = {}) {
  if (!isPlugPlusIrlDevice(device)) return false;
  if (typeof device.controllable === "boolean") return device.controllable;
  const identity = `${device.id || ""} ${device.model || ""}`;
  return !/(?:shellypro3em|spem-003|shellyem3|shem-3)/i.test(identity);
}

/** Icônes vectorielles partagées : pas d'emoji dépendant du système ni d'image distante. */
const IRL_ICON_PATHS = Object.freeze({
    plug: '<path d="M8 3v5M16 3v5M6 8h12v4a6 6 0 0 1-6 6v3M12 18H9"/>',
    power: '<path d="M12 3v9M6.3 5.9a8 8 0 1 0 11.4 0"/>',
    signal: '<path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0M9 16a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="20" r=".5"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    scan: '<path d="M20 7V3l-3 3a8 8 0 0 0-13 5M4 17v4l3-3a8 8 0 0 0 13-5M16 3h4M4 21h4"/>',
    edit: '<path d="m4 20 4.2-1L19 8.2a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20ZM14 7l3 3"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
    play: '<path d="m8 5 11 7-11 7Z"/>',
    eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/>',
    hidden: '<path d="m3 3 18 18M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M6.2 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    shield: '<path d="m12 3 8 3v5c0 5-8 10-8 10S4 16 4 11V6l8-3ZM12 8v5M12 16h.01"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    switch: '<path d="M3 7h17l-4-4M21 17H4l4 4"/>'
});

function irlIconMarkup(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${IRL_ICON_PATHS[name] || IRL_ICON_PATHS.plug}</svg>`;
}

function renderIrlSummary(devices, actions) {
  const onlineCount = devices.filter((device) => device.online).length;
  const rows = [
    ["plug", devices.length, "Prises enregistrées", "Votre installation locale"],
    ["signal", onlineCount, "Prises détectées", "Lors de la dernière recherche"],
    ["bolt", actions.length, "Interactions configurées", "Cadeaux, commandes et automatisations"]
  ];
  return `<section class="irl-summary-grid" aria-label="Résumé des interactions IRL">${rows.map(([icon, count, label, detail]) =>
    `<article class="irl-summary-card"><span class="irl-summary-icon">${irlIconMarkup(icon)}</span><div><strong>${count}</strong><span>${label}</span><small>${detail}</small></div></article>`
  ).join("")}</section>`;
}

/** Les cinq opérations gardent le même identifiant et la même durée côté gestionnaire. */
function renderIrlDeviceTests(device) {
  const disabled = irlBusy || !isControllableIrlDevice(device) ? "disabled" : "";
  const operations = [
    ["on", "Allumer", "Allumer", "power"],
    ["off", "Éteindre", "Éteindre", "power"],
    ["toggle", "Basculer", "Basculer l’état", "switch"],
    ["cycle", "OFF 3s", "Éteindre puis rallumer après 3 secondes", "switch"],
    ["pulse", "ON 3s", "Allumer puis éteindre après 3 secondes", "bolt"]
  ];
  return `<div class="irl-device-tests" role="group" aria-label="Tests immédiats : ${escapeHtml(device.name || "Prise PlugPlus")}">${operations.map(([operation, label, title, icon]) =>
    `<button type="button" data-action="irl-test" data-id="${escapeHtml(device.id)}" data-operation="${operation}" title="${title}" aria-label="${title} : ${escapeHtml(device.name || "Prise PlugPlus")}" ${disabled}>${irlIconMarkup(icon)}<span>${label}</span></button>`
  ).join("")}</div>`;
}

/** Une prise occupe une ligne, sans masquer les cinq tests derrière un menu. */
function renderIrlDeviceRow(device) {
  const controllable = isControllableIrlDevice(device);
  const name = device.name || "Prise PlugPlus";
  const statusTitle = device.online ? "Détectée sur le réseau" : "Non détectée lors de la dernière recherche";
  const busy = irlBusy ? "disabled" : "";
  return {
    id: device.id,
    className: `irl-device-row ${device.online ? "online" : "offline"}`,
    cells: {
      name: `<div class="irl-device-name"><span class="irl-device-icon ${device.online ? "is-online" : ""}">${irlIconMarkup("plug")}</span><div><strong>${escapeHtml(name)}</strong><small>${escapeHtml(device.model || "PlugPlus")} · ${controllable ? `Gen ${escapeHtml(device.generation || 1)}` : "Mesure uniquement · aucun relais"}</small></div></div>`,
      network: `<span class="irl-device-status ${device.online ? "is-online" : "is-offline"}" title="${statusTitle}"><i aria-hidden="true"></i><span>${device.online ? "Détectée" : "Non détectée"}</span></span><small class="irl-network-detail">Dernière recherche réseau</small>`,
      address: `<div class="irl-device-identity"><span title="Adresse locale : ${escapeHtml(device.host || "En attente de détection")}">${escapeHtml(device.host || "En attente de détection")}</span><small title="Identifiant : ${escapeHtml(device.id)}">${escapeHtml(device.id)}</small></div>`,
      tests: renderIrlDeviceTests(device),
      actions: `<div class="irl-device-controls"><button type="button" class="game-effect-icon" data-action="irl-rename" data-id="${escapeHtml(device.id)}" title="Renommer" aria-label="Renommer ${escapeHtml(name)}" ${busy}>${irlIconMarkup("edit")}</button><button type="button" class="game-effect-icon danger" data-action="irl-remove" data-id="${escapeHtml(device.id)}" title="Retirer" aria-label="Retirer ${escapeHtml(name)}" ${busy}>${irlIconMarkup("trash")}</button></div>`
    }
  };
}

function renderIrlDevices(devices) {
  const busy = irlBusy ? "disabled" : "";
  return `<section class="studio-panel panel-cyan irl-devices-panel">
    <header class="studio-panel-heading irl-panel-heading"><div><span class="irl-section-icon">${irlIconMarkup("plug")}</span><div><span class="irl-section-eyebrow">VOTRE INSTALLATION</span><h3>Mes prises PlugPlus <span class="irl-count">${devices.length}</span></h3><p>Associez vos appareils, puis vérifiez leur connexion.</p></div></div><div class="button-row"><button type="button" class="button" data-action="irl-scan" ${busy}>${irlIconMarkup("scan")} Détecter</button><button type="button" class="button" data-action="irl-add-manual" ${busy}>${irlIconMarkup("plus")} Ajouter par IP</button><button type="button" class="button primary" data-action="irl-pair" ${busy}>${irlIconMarkup("plus")} Associer une prise neuve</button></div></header>
    ${devices.length ? renderCompactResourceTable({
      key: "irl-devices", label: "Mes prises PlugPlus", className: "irl-devices-table",
      columns: [{ key: "name", label: "Prise" }, { key: "network", label: "Réseau" }, { key: "address", label: "Adresse / identifiant" }, { key: "tests", label: "Tests immédiats" }, { key: "actions", label: "Actions" }],
      rows: devices.map(renderIrlDeviceRow), emptyText: "Aucune prise enregistrée"
    }) : `<div class="irl-empty"><span class="irl-empty-icon">${irlIconMarkup("plug")}</span><strong>Aucune prise enregistrée</strong><p>Mettez une prise PlugPlus neuve en mode association puis lancez l’assistant.</p><button type="button" class="button primary" data-action="irl-pair" ${busy}>${irlIconMarkup("plus")} Associer ma première prise</button></div>`}
  </section>`;
}

/** Les identifiants et index d'action restent ceux des gestionnaires historiques. */
function renderIrlInteractionRow({ rule, action, actionIndex }, devicesById) {
  const targetDevice = devicesById.get(action.config?.deviceId);
  const canTest = Boolean(targetDevice && isControllableIrlDevice(targetDevice));
  const enabled = rule.enabled !== false;
  const rowData = `data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${escapeHtml(actionIndex)}"`;
  const busy = irlBusy ? "disabled" : "";
  return {
    id: `${rule.id}:${action.id || actionIndex}`,
    className: `irl-interaction-row ${enabled ? "" : "disabled"} ${canTest ? "" : "unavailable"}`,
    cells: {
      name: `<button type="button" class="irl-interaction-name" data-action="edit-action" ${rowData} title="Modifier ${escapeHtml(rule.name)}" ${busy}><strong>${escapeHtml(rule.name)}</strong></button>`,
      trigger: `<div class="irl-interaction-trigger">${triggerPill(rule)}</div>`,
      effect: `<div class="irl-interaction-copy"><span class="irl-interaction-target ${canTest ? "" : "is-missing"}">${irlIconMarkup("plug")} ${escapeHtml(targetDevice?.name || (canTest ? "Prise PlugPlus" : "Aucun relais"))}</span><small>${escapeHtml(actionDescription(action))}</small></div>`,
      status: `<span class="irl-rule-status ${enabled ? "is-active" : "is-paused"}">${enabled ? "Active" : "En pause"}</span>`,
      actions: `<div class="irl-interaction-controls"><button type="button" class="game-effect-icon" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" title="${enabled ? "Désactiver" : "Activer"}" aria-label="${enabled ? "Désactiver" : "Activer"} ${escapeHtml(rule.name)}" ${busy}>${irlIconMarkup(enabled ? "eye" : "hidden")}</button><button type="button" class="game-effect-icon" data-action="edit-action" ${rowData} title="Modifier" aria-label="Modifier ${escapeHtml(rule.name)}" ${busy}>${irlIconMarkup("edit")}</button><button type="button" class="game-effect-icon irl-interaction-test" data-action="test-action" ${rowData} title="Tester l’interaction IRL" aria-label="Tester ${escapeHtml(rule.name)}" ${canTest && !irlBusy ? "" : "disabled"}>${irlIconMarkup("play")}</button><button type="button" class="game-effect-icon danger" data-action="delete-action" ${rowData} title="Supprimer" aria-label="Supprimer ${escapeHtml(rule.name)}" ${busy}>${irlIconMarkup("trash")}</button></div>`
    }
  };
}

function renderIrlInteractions(actions, devices) {
  const controllableDevices = devices.filter(isControllableIrlDevice);
  // Une seule indexation par rendu, plutôt qu'une recherche dans toutes les prises par règle.
  const devicesById = new Map(devices.map((device) => [device.id, device]));
  const query = irlActionSearch.trim().toLocaleLowerCase("fr");
  const visibleActions = actions.filter(({ rule, action }) => !query ||
    `${rule.name} ${triggerLabel(rule)} ${actionDescription(action)}`.toLocaleLowerCase("fr").includes(query)
  );
  return `<section class="game-interactions-page irl-interactions-page irl-actions-panel">
    <header class="studio-panel-heading irl-panel-heading"><div><span class="irl-section-icon">${irlIconMarkup("bolt")}</span><div><span class="irl-section-eyebrow">LES RÉACTIONS DU LIVE</span><h3>Mes interactions <span class="irl-count">${actions.length}</span></h3><p>Un cadeau ou une commande, une action dans votre installation.</p></div></div><div class="button-row"><span class="irl-available-count">${controllableDevices.length} prise${controllableDevices.length > 1 ? "s" : ""} pilotable${controllableDevices.length > 1 ? "s" : ""}</span><button type="button" class="button primary" data-action="irl-add-action" ${controllableDevices.length && !irlBusy ? "" : "disabled"}>${irlIconMarkup("plus")} Créer une interaction</button></div></header>
    <div class="irl-actions-content"><section class="game-interaction-toolbar irl-interaction-toolbar"><label class="search-control">${irlIconMarkup("search")}<input data-search="irl-actions" type="search" value="${escapeHtml(irlActionSearch)}" placeholder="Rechercher dans vos interactions IRL" aria-label="Rechercher dans vos interactions IRL"></label><span>${visibleActions.length} / ${actions.length}</span></section>${visibleActions.length ? renderCompactResourceTable({
      key: "irl-interactions", label: "Mes interactions IRL", className: "irl-interactions-table",
      columns: [{ key: "name", label: "Nom" }, { key: "trigger", label: "Déclencheur" }, { key: "effect", label: "Action exécutée" }, { key: "status", label: "Statut" }, { key: "actions", label: "Actions" }],
      rows: visibleActions.map((entry) => renderIrlInteractionRow(entry, devicesById)), emptyText: "Aucune interaction trouvée"
    }) : `<div class="irl-actions-empty"><span class="irl-empty-icon">${irlIconMarkup(query ? "search" : "bolt")}</span><strong>${actions.length ? "Aucune interaction trouvée" : "Votre première interaction commence ici"}</strong><p>${actions.length ? "Aucune interaction IRL ne correspond à cette recherche." : controllableDevices.length ? "Utilisez « Créer une interaction » pour choisir votre prise et son déclencheur." : "Associez une prise pilotable pour créer votre première interaction."}</p></div>`}</div>
  </section>`;
}

function renderIrl() {
  const irl = snapshot.state.settings.irl || { enabled: false, devices: [] };
  const devices = Array.isArray(irl.devices)
    ? irl.devices.filter(isPlugPlusIrlDevice)
    : [];
  const actions = flattenActions().filter(({ action }) => action.type === "irl.shelly");
  return `<div class="irl-page">
    ${renderStudioHero("irl", "Machines IRL", "Faites réagir votre installation aux cadeaux et aux commandes de votre communauté.")}
    <section class="irl-control-bar ${irl.enabled ? "is-enabled" : "is-disabled"}"><div class="irl-control-copy"><span class="irl-control-icon">${irlIconMarkup("power")}</span><div><h3>Piloter mes prises depuis le LIVE</h3><p>PlugPlus en réseau local · Sans cloud</p></div></div><label class="irl-master-switch"><span><strong>${irl.enabled ? "Interactions activées" : "Interactions désactivées"}</strong><small>${irl.enabled ? "Les déclencheurs LIVE peuvent piloter les prises." : "Les règles restent enregistrées. Les commandes de test restent disponibles."}</small></span><span class="switch large"><input type="checkbox" data-action="irl-toggle" aria-label="Activer les interactions IRL" ${irl.enabled ? "checked" : ""} ${irlBusy ? "disabled" : ""}><span></span></span></label></section>
    ${renderIrlSummary(devices, actions)}
    ${renderIrlDevices(devices)}
    ${renderIrlInteractions(actions, devices)}
    <aside class="irl-safety-note"><span class="irl-safety-icon">${irlIconMarkup("shield")}</span><div><strong>Ne branchez pas le PC ShenPulse ni votre routeur sans protection.</strong><p>Le mode « éteindre puis rallumer » programme le retour directement dans la prise quand son API le permet.</p></div></aside>
  </div>`;
}
