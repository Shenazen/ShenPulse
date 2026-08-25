"use strict";

/**
 * Page et capacités des interactions IRL.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
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

function renderIrl() {
  const irl = snapshot.state.settings.irl || { enabled: false, devices: [] };
  const devices = Array.isArray(irl.devices)
    ? irl.devices.filter(isPlugPlusIrlDevice)
    : [];
  const controllableDevices = devices.filter(isControllableIrlDevice);
  const actions = flattenActions().filter(
    ({ action }) => action.type === "irl.shelly"
  );
  const irlActionQuery = irlActionSearch.trim().toLocaleLowerCase("fr");
  const visibleActions = actions.filter(({ rule, action }) =>
    !irlActionQuery ||
    `${rule.name} ${triggerLabel(rule)} ${actionDescription(action)}`
      .toLocaleLowerCase("fr")
      .includes(irlActionQuery)
  );
  return `<div class="irl-page">
    <section class="irl-hero ${irl.enabled ? "is-enabled" : "is-disabled"}">
      <div class="irl-hero-copy">
        <span class="hero-chip">SHENPULSE · PLUGPLUS LOCAL</span>
        <h2>Interactions IRL</h2>
        <p>Pilotez vos prises PlugPlus enregistrées depuis un cadeau, une commande ou une automatisation, sans cloud.</p>
      </div>
      <label class="irl-master-switch">
        <span><strong>${irl.enabled ? "Interactions activées" : "Interactions désactivées"}</strong><small>${irl.enabled ? "Les déclencheurs LIVE peuvent piloter les prises." : "Les règles restent enregistrées mais aucune prise ne sera commandée."}</small></span>
        <span class="switch large"><input type="checkbox" data-action="irl-toggle" ${irl.enabled ? "checked" : ""} ${irlBusy ? "disabled" : ""}><span></span></span>
      </label>
    </section>
    <section class="irl-summary-grid">
      <article><span>⌁</span><strong>${devices.length}</strong><small>prise${devices.length > 1 ? "s" : ""} enregistrée${devices.length > 1 ? "s" : ""}</small></article>
      <article><span>●</span><strong>${devices.filter((device) => device.online).length}</strong><small>appareil${devices.filter((device) => device.online).length > 1 ? "s" : ""} détecté${devices.filter((device) => device.online).length > 1 ? "s" : ""}</small></article>
      <article><span>⚡</span><strong>${actions.length}</strong><small>action${actions.length > 1 ? "s" : ""} IRL configurée${actions.length > 1 ? "s" : ""}</small></article>
    </section>
    <section class="game-interactions-page irl-interactions-page irl-actions-panel">
      <header class="game-effects-heading">
        <span>${eventIconMarkup("gift")} INTERACTIONS IRL <strong>${actions.length}</strong></span>
        <div class="button-row">
          <span class="game-effect-catalog-count">${controllableDevices.length} prise${controllableDevices.length > 1 ? "s" : ""} pilotable${controllableDevices.length > 1 ? "s" : ""}</span>
          <button class="button primary" data-action="irl-add-action" ${controllableDevices.length ? "" : "disabled"}>＋ Créer une interaction</button>
        </div>
      </header>
      <section class="game-interaction-toolbar irl-interaction-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="irl-actions" type="search" value="${escapeHtml(irlActionSearch)}" placeholder="Rechercher dans vos interactions IRL"></label>
      </section>
      <section class="game-interaction-grid irl-interaction-grid">
        ${visibleActions.map(({ rule, action, actionIndex }) => {
          const targetDevice = devices.find(
            (device) => device.id === action.config?.deviceId
          );
          const canTest = Boolean(
            targetDevice && isControllableIrlDevice(targetDevice)
          );
          const enabled = rule.enabled !== false;
          const rowData = `data-rule="${escapeHtml(rule.id)}" data-id="${escapeHtml(action.id || "")}" data-index="${actionIndex}"`;
          return `<article class="game-interaction-card irl-interaction-card configured ${enabled ? "" : "disabled"} ${canTest ? "" : "unavailable"}">
          <div class="game-effect-side">
            <button class="game-effect-icon" data-action="toggle-rule" data-id="${escapeHtml(rule.id)}" title="${enabled ? "Désactiver" : "Activer"}">
              ${enabled
                ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.7"/></svg>'
                : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A10 10 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.2 2.8M6.2 6.3C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9 9 0 0 0 3-.5M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'}
            </button>
            <button class="game-effect-icon danger" data-action="delete-action" ${rowData} title="Supprimer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg></button>
          </div>
          <button class="game-effect-main" data-action="edit-action" ${rowData} title="Modifier ${escapeHtml(rule.name)}">
            <span class="game-effect-art irl-interaction-art"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M23 8h18v15a14 14 0 0 1-7 12v12h8v9H22v-9h8V35a14 14 0 0 1-7-12V8Z"/><path d="M28 8V3M36 8V3M29 20h8l-5 7h6l-10 11 3-8h-6l4-10Z"/></svg></span>
            <strong>${escapeHtml(rule.name)}</strong>
            <small>${escapeHtml(actionDescription(action))}${canTest ? "" : " · Aucun relais"}</small>
          </button>
          <div class="game-effect-side right">
            <button class="game-effect-icon" data-action="edit-action" ${rowData} title="Modifier"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 20 4.2-1 10.4-10.4a2 2 0 0 0-2.8-2.8L5.4 16.2 4 20Z"/><path d="m14.5 7.1 2.8 2.8"/></svg></button>
            <button class="game-effect-icon play" data-action="test-action" ${rowData} title="Tester l’interaction IRL" ${canTest ? "" : "disabled"}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z"/></svg></button>
          </div>
          <div class="game-effect-trigger">${triggerPill(rule)}</div>
        </article>`;
        }).join("")}
      </section>
      ${visibleActions.length ? "" : emptyInline(actions.length ? "Aucune interaction IRL ne correspond à cette recherche." : "Aucune interaction IRL configurée. Utilisez « Créer une interaction » pour commencer.")}
    </section>
    <section class="studio-panel panel-cyan irl-devices-panel">
      <header class="studio-panel-heading">
        <div><span class="panel-accent"></span><div><h3>Mes prises PlugPlus</h3><p>Association, détection locale et commandes de test.</p></div></div>
        <div class="button-row">
          <button class="button" data-action="irl-scan" ${irlBusy ? "disabled" : ""}>↻ Détecter</button>
          <button class="button" data-action="irl-add-manual" ${irlBusy ? "disabled" : ""}>＋ Ajouter par IP</button>
          <button class="button primary" data-action="irl-pair" ${irlBusy ? "disabled" : ""}>＋ Associer une prise neuve</button>
        </div>
      </header>
      <div class="irl-device-grid">
        ${devices.length ? devices.map((device) => {
          const controllable = isControllableIrlDevice(device);
          return `<article class="irl-device-card ${device.online ? "online" : "offline"}">
          <header><span class="irl-device-icon">⌁</span><div><strong>${escapeHtml(device.name)}</strong><small>${escapeHtml(device.model || "PlugPlus")} · ${controllable ? `Gen ${escapeHtml(device.generation || 1)}` : "Mesure uniquement · aucun relais"}</small></div><i title="${device.online ? "Détectée sur le réseau" : "Non détectée lors de la dernière recherche"}"></i></header>
          <dl><div><dt>Adresse locale</dt><dd>${escapeHtml(device.host || "En attente de détection")}</dd></div><div><dt>Identifiant</dt><dd>${escapeHtml(device.id)}</dd></div></dl>
          <div class="irl-device-tests">
            <button data-action="irl-test" data-id="${escapeHtml(device.id)}" data-operation="on" title="Allumer" ${controllable ? "" : "disabled"}>ON</button>
            <button data-action="irl-test" data-id="${escapeHtml(device.id)}" data-operation="off" title="Éteindre" ${controllable ? "" : "disabled"}>OFF</button>
            <button data-action="irl-test" data-id="${escapeHtml(device.id)}" data-operation="toggle" title="Basculer l’état" ${controllable ? "" : "disabled"}>↔</button>
            <button data-action="irl-test" data-id="${escapeHtml(device.id)}" data-operation="cycle" title="Éteindre puis rallumer après 3 secondes" ${controllable ? "" : "disabled"}>OFF 3s</button>
            <button data-action="irl-test" data-id="${escapeHtml(device.id)}" data-operation="pulse" title="Allumer puis éteindre après 3 secondes" ${controllable ? "" : "disabled"}>ON 3s</button>
          </div>
          <footer><button class="button small ghost" data-action="irl-rename" data-id="${escapeHtml(device.id)}">Renommer</button><button class="button small danger" data-action="irl-remove" data-id="${escapeHtml(device.id)}">Retirer</button></footer>
        </article>`;
        }).join("") : `<div class="irl-empty"><span>⌁</span><strong>Aucune prise enregistrée</strong><p>Mettez une prise PlugPlus neuve en mode association puis lancez l’assistant.</p><button class="button primary" data-action="irl-pair">Associer ma première prise</button></div>`}
      </div>
    </section>
    <aside class="irl-safety-note"><span>!</span><div><strong>Ne branchez pas le PC ShenPulse ni votre routeur sans protection.</strong><p>Le mode « éteindre puis rallumer » programme le retour directement dans la prise quand son API le permet.</p></div></aside>
  </div>`;
}
