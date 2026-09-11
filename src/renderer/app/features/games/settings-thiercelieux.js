"use strict";

/**
 * Régie des Loups-Garous de Thiercelieux.
 *
 * Cette page est volontairement hébergée dans ShenPulse : la fenêtre du jeu
 * ne reçoit qu'une composition déjà prête et ne contient aucun réglage.
 */

const THIERCELIEUX_ROLES = Object.freeze([
  ["simple-villageois", "Simple Villageois", "base", "village", "Débat et vote avec le village."],
  ["simple-loup-garou", "Simple Loup-Garou", "base", "wolves", "Choisit une victime avec la meute."],
  ["voyante", "Voyante", "base", "village", "Découvre secrètement un personnage."],
  ["sorciere", "Sorcière", "base", "village", "Dispose d'une potion de vie et d'une potion de mort."],
  ["chasseur", "Chasseur", "base", "village", "Emporte une cible lorsqu'il meurt."],
  ["cupidon", "Cupidon", "base", "village", "Lie deux amoureux la première nuit."],
  ["petite-fille", "Petite Fille", "base", "village", "Peut espionner la meute pendant son réveil."],
  ["voleur", "Voleur", "base", "ambiguous", "Peut échanger son personnage avec une carte au centre."],
  ["salvateur", "Salvateur", "nouvelle-lune", "village", "Protège une personne de l'attaque de la meute."],
  ["ancien", "Ancien", "nouvelle-lune", "village", "Résiste à la première attaque des Loups-Garous."],
  ["idiot-du-village", "Idiot du Village", "nouvelle-lune", "village", "Survit à son premier vote mais perd sa voix."],
  ["bouc-emissaire", "Bouc Émissaire", "nouvelle-lune", "village", "Meurt à la place des joueurs à égalité."],
  ["joueur-de-flute", "Joueur de Flûte", "nouvelle-lune", "solitary", "Charme deux nouveaux joueurs chaque nuit."],
  ["corbeau", "Corbeau", "village", "village", "Ajoute deux voix au prochain vote."],
  ["pyromane", "Pyromane", "village", "village", "Peut incendier un bâtiment une fois."],
  ["loup-garou-blanc", "Loup-Garou Blanc", "village", "solitary", "Traque aussi les membres de sa propre meute."],
  ["villageois-villageois", "Villageois-Villageois", "personnages", "village", "Son innocence est connue publiquement."],
  ["deux-soeurs", "Deux Sœurs", "personnages", "village", "Les deux Sœurs se reconnaissent."],
  ["trois-freres", "Trois Frères", "personnages", "village", "Les trois Frères se reconnaissent."],
  ["renard", "Renard", "personnages", "village", "Sonde trois voisins pour y détecter un Loup-Garou."],
  ["montreur-ours", "Montreur d'Ours", "personnages", "village", "Détecte un Loup-Garou voisin chaque matin."],
  ["juge-begue", "Juge Bègue", "personnages", "village", "Peut déclencher un second vote sans débat."],
  ["chevalier-epee-rouillee", "Chevalier à l'Épée Rouillée", "personnages", "village", "Condamne un Loup-Garou après avoir été dévoré."],
  ["servante-devouee", "Servante Dévouée", "personnages", "village", "Peut prendre le personnage d'un condamné."],
  ["comedien", "Comédien", "personnages", "village", "Emprunte temporairement un pouvoir préparé au centre."],
  ["enfant-sauvage", "Enfant Sauvage", "personnages", "ambiguous", "Change de camp si son modèle disparaît."],
  ["chien-loup", "Chien-Loup", "personnages", "ambiguous", "Choisit définitivement son camp."],
  ["grand-mechant-loup", "Grand-Méchant-Loup", "personnages", "wolves", "Peut faire une seconde victime."],
  ["infect-pere-des-loups", "Infect Père des Loups", "personnages", "wolves", "Peut convertir la victime de la meute."],
  ["ange", "Ange", "personnages", "solitary", "Cherche à être éliminé au premier vote."],
  ["abominable-sectaire", "Abominable Sectaire", "personnages", "solitary", "Doit faire disparaître le groupe opposé."],
  ["gitane-sans-philtre", "Gitane sans Philtre", "personnages", "village", "Prépare les séances de Spiritisme."],
  ["colosse", "Colosse", "25-ans", "village", "Emporte un Loup-Garou s'il est dévoré."],
  ["singe-savant", "Singe Savant", "25-ans", "village", "Inspecte jusqu'à découvrir un Loup-Garou."],
  ["marionnettiste", "Marionnettiste", "25-ans", "village", "Sa marionnette meurt à sa place une fois."],
  ["puissante-mere-des-loups", "Puissante Mère des Loups", "25-ans", "wolves", "Neutralise un pouvoir durant les deux premières nuits."]
].map(([id, name, pack, camp, power]) => Object.freeze({ id, name, pack, camp, power })));

const THIERCELIEUX_ROLE_IDS = new Set(THIERCELIEUX_ROLES.map((role) => role.id));
const THIERCELIEUX_MIN_PLAYERS = 3;
const THIERCELIEUX_MAX_PLAYERS = 8;
const THIERCELIEUX_PACKS = Object.freeze([
  ["base", "Jeu de base", "8 personnages essentiels", ""],
  ["nouvelle-lune", "Nouvelle Lune", "5 personnages, 36 événements et 9 variantes", "thiercelieux-extension-nouvelle-lune"],
  ["village", "Le Village", "3 personnages et 14 bâtiments", "thiercelieux-extension-le-village"],
  ["personnages", "Personnages", "16 personnages avancés", "thiercelieux-extension-personnages"],
  ["25-ans", "Édition 25 ans", "4 personnages anniversaire", "thiercelieux-extension-25-ans"]
]);
const THIERCELIEUX_EXTENSION_ARTWORK = Object.freeze({
  "nouvelle-lune": "assets/games/thiercelieux/extension-nouvelle-lune.png",
  village: "assets/games/thiercelieux/extension-le-village.png",
  personnages: "assets/games/thiercelieux/extension-personnages.png",
  "25-ans": "assets/games/thiercelieux/extension-25-ans.png"
});
const THIERCELIEUX_VARIANTS = Object.freeze([
  ["clair-de-lune", "Clair de lune"],
  ["communaute-hameaux", "Communauté des hameaux"],
  ["pas-lui", "En tout cas, c'est sûrement pas lui !"],
  ["murs-murs", "Murs-murs"],
  ["double-je", "Double « je »"],
  ["fete-moisson", "Fête de la moisson"],
  ["peste-noire", "Peste noire"],
  ["fascination", "Fascination lycanthropique"],
  ["nouvelle-lune", "Nouvelle Lune"]
]);

function thiercelieuxRecommendedRoles(count = 8, enabledPacks = new Set(["base"])) {
  const requestedCount = Number(count);
  const playerCount = Number.isFinite(requestedCount)
    ? Math.max(0, Math.min(THIERCELIEUX_MAX_PLAYERS, Math.round(requestedCount)))
    : THIERCELIEUX_MAX_PLAYERS;
  const compositions = {
    0: [],
    1: ["simple-loup-garou"],
    2: ["simple-loup-garou", "simple-villageois"],
    3: ["simple-loup-garou", "simple-villageois", "simple-villageois"],
    4: ["simple-loup-garou", "voyante", "simple-villageois", "simple-villageois"],
    5: ["simple-loup-garou", "voyante", "sorciere", "simple-villageois", "simple-villageois"],
    6: ["simple-loup-garou", "simple-loup-garou", "voyante", "sorciere", "simple-villageois", "simple-villageois"],
    7: ["simple-loup-garou", "simple-loup-garou", "voyante", "sorciere", "chasseur", "simple-villageois", "simple-villageois"],
    8: ["simple-loup-garou", "simple-loup-garou", "voyante", "sorciere", "chasseur", "cupidon", "petite-fille", "simple-villageois"]
  };
  const roles = [...compositions[playerCount]];
  if (playerCount >= 7 && enabledPacks.has("25-ans")) roles[roles.indexOf("chasseur")] = "colosse";
  if (playerCount >= 8 && enabledPacks.has("village")) roles[roles.indexOf("cupidon")] = "corbeau";
  if (playerCount >= 8 && enabledPacks.has("personnages")) roles[roles.indexOf("petite-fille")] = "renard";
  else if (playerCount >= 8 && enabledPacks.has("nouvelle-lune")) roles[roles.indexOf("petite-fille")] = "salvateur";
  return roles;
}

function thiercelieuxJsonField(name, value) {
  return `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(JSON.stringify(value || []))}">`;
}

function thiercelieuxReadJson(value, fallback = []) {
  try {
    const parsed = JSON.parse(String(value || ""));
    return Array.isArray(parsed) ? parsed : structuredClone(fallback);
  } catch {
    return structuredClone(fallback);
  }
}

function thiercelieuxStatusLabel(status) {
  return ({
    waiting: "En attente",
    full: "Manche suivante",
    deferred: "Reporté",
    "in-game": "Dans le village"
  })[status] || "En attente";
}

function thiercelieuxGamePack() {
  return snapshot.packs.find((item) => item.id === "thiercelieux") || {};
}

function thiercelieuxExtensionForPack(gamePack, packId) {
  const fallback = THIERCELIEUX_PACKS.find(([id]) => id === packId);
  const productId = fallback?.[3] || "";
  return (gamePack?.addOns || []).find(
    (item) => item.packId === packId || item.id === productId
  ) || (productId ? {
    id: productId,
    packId,
    name: fallback?.[1] || packId,
    price: 3.99,
    currency: "EUR",
    description: fallback?.[2] || "",
    includes: [fallback?.[2] || "Contenu de l'extension"]
  } : null);
}

function thiercelieuxOwnedPackIds(gamePack = thiercelieuxGamePack()) {
  return new Set([
    "base",
    ...THIERCELIEUX_PACKS
      .filter(([id]) => {
        if (id === "base") return false;
        const extension = thiercelieuxExtensionForPack(gamePack, id);
        return extension && hasProductEntitlement(extension.id);
      })
      .map(([id]) => id)
  ]);
}

function thiercelieuxEnabledPackIds(config, gamePack = thiercelieuxGamePack()) {
  const ownedPacks = thiercelieuxOwnedPackIds(gamePack);
  return new Set(
    [...new Set(["base", ...(Array.isArray(config.packs) ? config.packs : [])])]
      .filter((id) => ownedPacks.has(id))
  );
}

function thiercelieuxAccessibleConfiguration(config, gamePack = thiercelieuxGamePack()) {
  const enabledPacks = thiercelieuxEnabledPackIds(config, gamePack);
  const playerCount = Math.min(
    THIERCELIEUX_MAX_PLAYERS,
    Array.isArray(config.activePlayers) ? config.activePlayers.length : 0
  );
  const recommendedRoles = thiercelieuxRecommendedRoles(playerCount, enabledPacks);
  const sourceRoles = Array.isArray(config.roleIds) && config.roleIds.length === playerCount
    ? config.roleIds.slice(0, playerCount)
    : recommendedRoles;
  const roleIds = sourceRoles.map((roleId, index) => {
    const role = THIERCELIEUX_ROLES.find((item) => item.id === roleId);
    return role && enabledPacks.has(role.pack)
      ? roleId
      : recommendedRoles[index] || "simple-villageois";
  });
  while (roleIds.length < playerCount) {
    roleIds.push(recommendedRoles[roleIds.length] || "simple-villageois");
  }
  return {
    ...config,
    packs: [...enabledPacks],
    roleIds,
    selectedVariantIds: enabledPacks.has("nouvelle-lune")
      ? (Array.isArray(config.selectedVariantIds) ? config.selectedVariantIds : [])
      : [],
    buildingsEnabled: enabledPacks.has("village") && config.buildingsEnabled === true,
    eventsEnabled: enabledPacks.has("nouvelle-lune") && config.eventsEnabled === true
  };
}

function thiercelieuxRoleOptions(selectedId, enabledPacks, ownedPacks) {
  return THIERCELIEUX_PACKS.filter(([packId]) => ownedPacks.has(packId)).map(([packId, packName]) => {
    const active = enabledPacks.has(packId);
    const suffix = !active ? " · extension désactivée" : "";
    const options = THIERCELIEUX_ROLES
      .filter((role) => role.pack === packId)
      .map((role) => `<option value="${escapeHtml(role.id)}" ${role.id === selectedId ? "selected" : ""} ${active ? "" : "disabled"}>${escapeHtml(role.name)}${escapeHtml(suffix)}</option>`)
      .join("");
    return `<optgroup label="${escapeHtml(packName)}">${options}</optgroup>`;
  }).join("");
}

function thiercelieuxPackPrice(extension) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: extension?.currency || "EUR"
  }).format(Number(extension?.price || 3.99));
}

function thiercelieuxExtensionArtwork(packId) {
  return THIERCELIEUX_EXTENSION_ARTWORK[String(packId || "")] || "";
}

function renderThiercelieuxPackCard(gamePack, packId, label, detail, enabled, owned) {
  if (packId === "base") return `<input type="hidden" name="thiercelieuxPack" value="base">`;
  const extension = thiercelieuxExtensionForPack(gamePack, packId);
  const artwork = THIERCELIEUX_EXTENSION_ARTWORK[packId] || "";
  if (!owned) {
    return `<button class="thiercelieux-extension-card locked" type="button" data-action="thiercelieux-buy-extension" data-id="${escapeHtml(extension?.id || "")}">
      <span class="thiercelieux-extension-cover"><img src="${escapeHtml(artwork)}" alt=""><i>🔒</i></span>
      <span class="thiercelieux-extension-meta"><small>EXTENSION</small><strong>${escapeHtml(label)}</strong><em>${escapeHtml(thiercelieuxPackPrice(extension))}</em><b>Découvrir et acheter</b></span>
    </button>`;
  }
  return `<label class="thiercelieux-extension-card owned ${enabled ? "active" : ""}">
    <span class="thiercelieux-extension-cover"><img src="${escapeHtml(artwork)}" alt=""><i>✓</i></span>
    <span class="thiercelieux-extension-meta"><small>EXTENSION DÉBLOQUÉE</small><strong>${escapeHtml(label)}</strong><em>${escapeHtml(detail)}</em><b>${enabled ? "Activée pour cette partie" : "Activer pour cette partie"}</b></span>
    <input type="checkbox" name="thiercelieuxPack" value="${escapeHtml(packId)}" ${enabled ? "checked" : ""}>
  </label>`;
}

function thiercelieuxFeatureToggle(name, title, detail, checked, unlocked, requirement) {
  return `<label class="integrated-setting-toggle ${unlocked ? "" : "is-locked"}">
    <input name="${escapeHtml(name)}" type="checkbox" ${checked && unlocked ? "checked" : ""} ${unlocked ? "" : "disabled"}>
    <span><strong>${unlocked ? "" : "🔒 "}${escapeHtml(title)}</strong><small>${escapeHtml(unlocked ? detail : `Inclus avec ${requirement}.`)}</small></span>
  </label>`;
}

function thiercelieuxSetupState(config) {
  const players = Array.isArray(config.activePlayers) ? config.activePlayers : [];
  const roles = Array.isArray(config.roleIds) ? config.roleIds : [];
  const packs = new Set(Array.isArray(config.packs) ? config.packs : ["base"]);
  packs.add("base");
  const ownedPacks = thiercelieuxOwnedPackIds();
  const errors = [];
  for (const packId of packs) {
    if (ownedPacks.has(packId)) continue;
    const extensionName = THIERCELIEUX_PACKS.find(([id]) => id === packId)?.[1] || packId;
    errors.push(`Achetez l'extension ${extensionName} pour utiliser son contenu.`);
  }
  if (config.buildingsEnabled && !ownedPacks.has("village")) {
    errors.push("Les bâtiments nécessitent l'achat de l'extension Le Village.");
  }
  if (
    (config.eventsEnabled || (config.selectedVariantIds || []).length) &&
    !ownedPacks.has("nouvelle-lune")
  ) {
    errors.push("Les événements et variantes nécessitent l'achat de Nouvelle Lune.");
  }
  if (!config.giftName) errors.push("Choisissez le cadeau d'inscription dans le catalogue TikTok.");
  if (players.length < THIERCELIEUX_MIN_PLAYERS) errors.push(`Ajoutez au moins ${THIERCELIEUX_MIN_PLAYERS} joueurs pour lancer la partie.`);
  if (players.length > THIERCELIEUX_MAX_PLAYERS) errors.push(`Le village est limité à ${THIERCELIEUX_MAX_PLAYERS} joueurs.`);
  if (roles.length !== players.length) errors.push("Attribuez exactement un personnage par joueur.");
  if (!roles.some((id) => ["simple-loup-garou", "grand-mechant-loup", "infect-pere-des-loups", "puissante-mere-des-loups"].includes(id))) {
    errors.push("La composition doit contenir au moins un Loup-Garou.");
  }
  const wolfCount = roles.filter((roleId) => THIERCELIEUX_ROLES.find((role) => role.id === roleId)?.camp === "wolves").length;
  if (config.rulesMode !== "custom" && wolfCount && wolfCount >= roles.length - wolfCount) {
    errors.push("L'équilibre contrôlé exige davantage de non-Loups que de Loups-Garous.");
  }
  for (const roleId of roles) {
    const role = THIERCELIEUX_ROLES.find((candidate) => candidate.id === roleId);
    if (!role) errors.push(`Personnage inconnu : ${roleId}.`);
    else if (!ownedPacks.has(role.pack)) errors.push(`${role.name} nécessite l'achat de l'extension ${role.pack}.`);
    else if (!packs.has(role.pack)) errors.push(`${role.name} nécessite d'activer l'extension ${role.pack}.`);
    else if (role.camp === "solitary" && config.allowSolitary === false) errors.push(`${role.name} est un personnage solitaire.`);
  }
  for (const [roleId, required] of [["deux-soeurs", 2], ["trois-freres", 3]]) {
    const count = roles.filter((id) => id === roleId).length;
    if (count && count !== required) errors.push(`${THIERCELIEUX_ROLES.find((role) => role.id === roleId)?.name} doivent être exactement ${required}.`);
  }
  return { ready: errors.length === 0, errors };
}

function thiercelieuxLiveCommand(label, command, options = {}) {
  const classes = ["button", options.primary ? "primary" : "", options.danger ? "danger" : ""]
    .filter(Boolean)
    .join(" ");
  return `<button class="${classes}" type="button" data-action="thiercelieux-live-command" data-command="${escapeHtml(command)}" ${options.id ? `data-id="${escapeHtml(options.id)}"` : ""} ${options.choice ? `data-choice="${escapeHtml(options.choice)}"` : ""} ${options.multiple ? `data-multiple="true"` : ""} ${options.disabled ? "disabled" : ""}>${escapeHtml(label)}</button>`;
}

function renderThiercelieuxLivePanel(config) {
  const state = thiercelieuxHostState;
  if (!state) {
    return `<section data-integrated-panel="live" data-thiercelieux-live-panel class="thiercelieux-live-director waiting">
      <div class="thiercelieux-live-stage"><span class="thiercelieux-live-orb">◉</span><small>RÉGIE EN TEMPS RÉEL</small><h4>Ouvrez le plateau pour prendre la main</h4><p>Les dialogues, l’ordre de parole et toutes les validations apparaîtront ici. La fenêtre du jeu restera un plateau visuel sans consignes longues.</p><button class="button primary" type="submit" data-launch-after-save="true">Ouvrir le plateau animé</button></div>
    </section>`;
  }
  const phase = String(state.phase || state.screen || "ready");
  const targets = state.resultPending
    ? []
    : Array.isArray(state.availableTargets) ? state.availableTargets : [];
  const targetButtons = targets.length
    ? `<div class="thiercelieux-live-targets">${targets.map((player) => `<button type="button" data-action="thiercelieux-live-command" data-command="${phase === "death-trigger" ? "death-target" : "select-target"}" data-id="${escapeHtml(player.id)}" ${state.multipleTargets ? 'data-multiple="true"' : ""} class="${player.selected ? "selected" : ""}"><span>${String(player.seat || 0).padStart(2, "0")}</span><strong>${escapeHtml(player.name)}</strong><small>${player.selected ? "Carte choisie" : "Choisir cette carte"}</small></button>`).join("")}</div>`
    : "";
  let controls = "";
  if (state.resultPending) {
    controls = state.resultUnlocked
      ? thiercelieuxLiveCommand("Masquer le résultat et continuer", "confirm-result", { primary: true })
      : thiercelieuxLiveCommand("Afficher le résultat privé à distance", "reveal-result", { primary: true });
  } else if (state.screen === "ready") {
    controls = `${thiercelieuxLiveCommand("Lancer la distribution", "start", { primary: true, disabled: !state.canStart })}${state.hasSavedGame ? thiercelieuxLiveCommand("Reprendre la sauvegarde", "resume") : ""}`;
  } else if (state.screen === "reveal") {
    controls = state.revealUnlocked
      ? thiercelieuxLiveCommand("Masquer et passer au joueur suivant", "confirm-reveal", { primary: true })
      : thiercelieuxLiveCommand("Retourner la carte à distance", "reveal-card");
  } else if (phase === "night-intro") {
    controls = thiercelieuxLiveCommand("Commencer la nuit", "begin-night", { primary: true });
  } else if (phase === "night") {
    const choices = state.action === "choose-camp"
      ? `<div class="thiercelieux-live-choices">${thiercelieuxLiveCommand("Villageois", "set-choice", { choice: "village" })}${thiercelieuxLiveCommand("Loup-Garou", "set-choice", { choice: "wolves" })}</div>`
      : state.action === "steal"
        ? `<div class="thiercelieux-live-choices">${thiercelieuxLiveCommand("Carte Villageois", "set-choice", { choice: "simple-villageois" })}${thiercelieuxLiveCommand("Carte Loup-Garou", "set-choice", { choice: "simple-loup-garou" })}</div>`
        : state.action === "witch"
          ? `<div class="thiercelieux-live-choices">${thiercelieuxLiveCommand(state.healSelected ? "Potion de vie sélectionnée ✓" : "Utiliser la potion de vie", "toggle-heal")}</div>`
          : "";
    controls = `${choices}${thiercelieuxLiveCommand("↻ Répéter l’annonce", "repeat")}${state.canSkip ? thiercelieuxLiveCommand("Passer", "skip-night") : ""}${thiercelieuxLiveCommand("Valider l’étape", "validate-night", { primary: true })}`;
  } else if (phase === "dawn") {
    controls = thiercelieuxLiveCommand("Ouvrir la discussion", "open-discussion", { primary: true });
  } else if (phase === "discussion") {
    controls = `${thiercelieuxLiveCommand(state.paused ? "Reprendre le chrono" : "Mettre en pause", "toggle-pause")}${thiercelieuxLiveCommand("Ouvrir le vote", "open-vote", { primary: true })}`;
  } else if (phase === "vote") {
    controls = `${thiercelieuxLiveCommand("Abstention", "abstain-vote")}${thiercelieuxLiveCommand("Confirmer ce vote", "confirm-vote", { primary: true })}`;
  } else if (phase === "death-trigger") {
    controls = `${thiercelieuxLiveCommand("Passer la réaction", "skip-death")}`;
  } else if (phase === "verdict") {
    controls = thiercelieuxLiveCommand("Continuer vers la nuit", "continue-verdict", { primary: true });
  } else if (state.screen === "ended" || phase === "ended") {
    controls = thiercelieuxLiveCommand("Préparer une nouvelle manche", "new-round", { primary: true });
  }
  const remaining = Number(state.remainingSeconds || 0);
  return `<section data-integrated-panel="live" data-thiercelieux-live-panel class="thiercelieux-live-director phase-${escapeHtml(phase)}">
    <header class="thiercelieux-live-header"><div><span class="thiercelieux-live-signal"><i></i> PLATEAU CONNECTÉ</span><small>${escapeHtml(state.stepLabel || state.phaseTitle || "RÉGIE EN DIRECT")}</small></div><div>${remaining ? `<b>${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}</b>` : ""}${thiercelieuxLiveCommand(state.audioEnabled ? "♫ Ambiance" : "♩ Ambiance coupée", "toggle-music")}</div></header>
    <div class="thiercelieux-live-stage">
      <span class="thiercelieux-live-orb">${phase.includes("night") ? "◉" : phase === "ended" ? "✦" : "◇"}</span>
      <small>${escapeHtml(state.stepLabel || "DÉROULÉ DU MAÎTRE DU JEU")}</small>
      <h4>${escapeHtml(state.title || "Le village attend")}</h4>
      <blockquote>${escapeHtml(state.dialogue || "Suivez le déroulé de la partie.")}</blockquote>
      <div class="thiercelieux-live-expected"><span>ACTION ATTENDUE</span><strong>${escapeHtml(state.expected || "Valider l’étape suivante.")}</strong>${state.privateAlert ? `<p>${escapeHtml(state.privateAlert)}</p>` : ""}</div>
      ${state.error ? `<p class="thiercelieux-live-error">${escapeHtml(state.error)}</p>` : ""}
      ${targetButtons}
      <div class="thiercelieux-live-controls">${controls}</div>
    </div>
  </section>`;
}

function syncThiercelieuxLivePanel() {
  const current = document.querySelector("[data-thiercelieux-live-panel]");
  if (!current) return;
  current.outerHTML = renderThiercelieuxLivePanel(
    integratedGameSettings("thiercelieux")
  );
}

function renderThiercelieuxGameFields(pack, config) {
  const queue = Array.isArray(config.queue) ? config.queue : [];
  const players = Array.isArray(config.activePlayers) ? config.activePlayers.slice(0, THIERCELIEUX_MAX_PLAYERS) : [];
  const ownedPacks = thiercelieuxOwnedPackIds(pack);
  const enabledPacks = thiercelieuxEnabledPackIds(config, pack);
  const recommendedRoles = thiercelieuxRecommendedRoles(players.length, enabledPacks);
  const roleIds = Array.isArray(config.roleIds) && config.roleIds.length === players.length
    ? config.roleIds.slice(0, players.length).map((roleId, index) => {
        const role = THIERCELIEUX_ROLES.find((item) => item.id === roleId);
        return role && enabledPacks.has(role.pack)
          ? roleId
          : recommendedRoles[index] || "simple-villageois";
      })
    : recommendedRoles;
  while (roleIds.length < players.length) roleIds.push(recommendedRoles[roleIds.length] || "simple-villageois");
  const activePanel = ["live", "registration", "village", "roles", "rules", "extensions"].includes(integratedSettingsPanels.get(pack.id))
    ? integratedSettingsPanels.get(pack.id)
    : "live";
  const gift = giftForIdentity(config.giftName, config.giftId);
  const setup = thiercelieuxSetupState({ ...config, activePlayers: players, roleIds });
  const waiting = queue.filter((entry) => !["removed", "in-game"].includes(entry.status));
  const enabledVariants = new Set(Array.isArray(config.selectedVariantIds) ? config.selectedVariantIds : []);
  const nouvelleLuneEnabled = enabledPacks.has("nouvelle-lune");
  const villageEnabled = enabledPacks.has("village");
  return `<div class="thiercelieux-control-room">
    ${thiercelieuxJsonField("thiercelieuxQueue", queue)}
    ${thiercelieuxJsonField("thiercelieuxPlayers", players)}
    <section class="thiercelieux-readiness ${setup.ready ? "ready" : "pending"}">
      <div class="thiercelieux-readiness-mark">${setup.ready ? "✓" : "◐"}</div>
      <div><small>RÉGIE DE PARTIE</small><strong>${setup.ready ? "Le village est prêt à être ouvert" : "Préparez le village dans ShenPulse"}</strong><p>${setup.ready ? `${players.length} joueurs, ${roleIds.length} personnages adaptés et le cadeau LIVE sont verrouillés pour cette manche.` : escapeHtml(setup.errors[0] || "Configuration en cours.")}</p></div>
      <div class="thiercelieux-readiness-stats"><span><b>${players.length}</b> joueurs</span><span><b>${roleIds.length}</b> personnages</span><span class="${config.registrationOpen ? "live" : ""}"><i></i>${config.registrationOpen ? "inscriptions ouvertes" : "inscriptions fermées"}</span></div>
    </section>
    <div class="integrated-settings-tabs thiercelieux-settings-tabs">
      ${["live", "registration", "village", "roles", "rules", "extensions"].map((id) => `<input id="thiercelieux-settings-${id}" type="radio" name="integratedSettingsPanel" value="${id}" ${activePanel === id ? "checked" : ""}>`).join("")}
      <nav class="integrated-settings-tab-nav thiercelieux-tab-nav" aria-label="Régie de Thiercelieux">
        ${integratedSettingsTabLabel("thiercelieux-settings-live", "01", "Maître du jeu", "Déroulé en direct")}
        ${integratedSettingsTabLabel("thiercelieux-settings-registration", "02", "Inscriptions LIVE", `${waiting.length} dans la file`)}
        ${integratedSettingsTabLabel("thiercelieux-settings-village", "03", "Le village", `${players.length} joueur${players.length > 1 ? "s" : ""}`)}
        ${integratedSettingsTabLabel("thiercelieux-settings-roles", "04", "Personnages", "Composition secrète")}
        ${integratedSettingsTabLabel("thiercelieux-settings-rules", "05", "Règles & écran", config.orientation === "portrait" ? "Portrait" : "Paysage")}
        ${integratedSettingsTabLabel("thiercelieux-settings-extensions", "06", "Extensions", "Boutique & contenus")}
      </nav>
      <div class="integrated-settings-tab-panels">
        ${renderThiercelieuxLivePanel(config)}
        <section data-integrated-panel="registration" class="thiercelieux-registration-layout">
          <article class="integrated-settings-card thiercelieux-gift-card">
            <header><span>🎁</span><div><h4>Pass d'entrée LIVE</h4><p>Le cadeau est choisi dans le même catalogue TikTok que toutes les interactions ShenPulse.</p></div></header>
            <div class="thiercelieux-gift-preview" data-thiercelieux-gift-preview>
              <span data-thiercelieux-gift-preview-image>${gift?.imageUrl || config.giftImage ? `<img src="${escapeHtml(gift?.imageUrl || config.giftImage)}" alt="">` : "🎁"}</span>
              <div><small>CADEAU D'INSCRIPTION</small><strong data-thiercelieux-gift-preview-name>${escapeHtml(config.giftName || "À choisir")}</strong><p data-thiercelieux-gift-preview-cost>${Number(gift?.cost || config.giftValue || 0).toLocaleString("fr-FR")} pièce${Number(gift?.cost || config.giftValue || 0) > 1 ? "s" : ""} · ×${Math.max(1, Number(config.giftQuantity) || 1)}</p></div>
            </div>
            <div class="integrated-settings-grid">
              ${giftPickerField("thiercelieuxGiftName", "Cadeau d'inscription", config.giftName || "", "full", "", config.giftId || "")}
              ${integratedNumberField("thiercelieuxGiftQuantity", "Quantité demandée", config.giftQuantity || 1, 1, 999)}
              ${integratedNumberField("thiercelieuxRegistrationMinutes", "Validité dans la file (min)", config.registrationMinutes || 120, 1, 10080)}
              <label class="integrated-setting-field"><span>Ordre de priorité</span><select name="thiercelieuxPriorityMode"><option value="arrival" ${config.priorityMode !== "value" ? "selected" : ""}>Ordre d'arrivée</option><option value="value" ${config.priorityMode === "value" ? "selected" : ""}>Valeur offerte</option></select><small>Vous pourrez toujours réordonner la file.</small></label>
              ${integratedToggle("thiercelieuxRegistrationOpen", "Inscriptions ouvertes", "Les cadeaux correspondants ajoutent automatiquement le viewer à la file.", config.registrationOpen !== false)}
              ${integratedToggle("thiercelieuxGiftGuaranteesSeat", "Le cadeau garantit une place", "Sinon, il donne seulement accès à la file d'attente.", config.giftGuaranteesSeat)}
              ${integratedToggle("thiercelieuxAllowDuplicateEntries", "Autoriser plusieurs entrées", "Un même viewer peut revenir dans la file après un nouveau cadeau.", config.allowDuplicateEntries)}
            </div>
          </article>
          <article class="integrated-settings-card thiercelieux-queue-card">
            <header><span>☾</span><div><h4>File d'attente en direct</h4><p>Les inscriptions conformes apparaissent ici pendant le LIVE.</p></div><b class="thiercelieux-live-pill"><i></i>${config.registrationOpen !== false ? "LIVE" : "PAUSE"}</b></header>
            <div class="thiercelieux-manual-add"><input type="text" data-thiercelieux-manual-name placeholder="Ajouter un invité sans cadeau"><button class="button" type="button" data-action="thiercelieux-add-manual">Ajouter</button></div>
            <div class="thiercelieux-queue-list">
              ${waiting.length ? waiting.map((entry, index) => `<article class="thiercelieux-queue-row">
                <b>${index + 1}</b><span class="thiercelieux-avatar">${entry.avatarUrl ? `<img src="${escapeHtml(entry.avatarUrl)}" alt="">` : escapeHtml(String(entry.displayName || "?").slice(0, 1).toUpperCase())}</span>
                <div><strong>${escapeHtml(entry.displayName || "Spectateur")}</strong><small>${escapeHtml(entry.giftName || (entry.manual ? "Ajout manuel" : "Cadeau LIVE"))} · ${thiercelieuxStatusLabel(entry.status)}</small></div>
                <div class="thiercelieux-row-actions"><button type="button" data-action="thiercelieux-move-queue" data-id="${escapeHtml(entry.id)}" data-direction="-1" title="Monter">↑</button><button type="button" data-action="thiercelieux-move-queue" data-id="${escapeHtml(entry.id)}" data-direction="1" title="Descendre">↓</button><button class="seat" type="button" data-action="thiercelieux-promote-player" data-id="${escapeHtml(entry.id)}" ${players.length >= THIERCELIEUX_MAX_PLAYERS ? "disabled" : ""}>Placer</button><button type="button" data-action="thiercelieux-remove-queue" data-id="${escapeHtml(entry.id)}" title="Retirer">×</button></div>
              </article>`).join("") : `<div class="thiercelieux-empty"><span>◌</span><strong>La place du village est silencieuse</strong><small>Le prochain cadeau valide apparaîtra ici instantanément.</small></div>`}
            </div>
          </article>
        </section>

        <section data-integrated-panel="village" class="thiercelieux-village-panel">
          <header class="thiercelieux-section-heading"><div><small>TABLE DE JEU · 3 À 8 JOUEURS</small><h4>Votre village, à la bonne taille</h4><p>Dès 3 participants, ShenPulse adapte automatiquement la composition. Les sièges restants sont facultatifs.</p></div><button class="button" type="button" data-action="thiercelieux-fill-guests" ${players.length >= THIERCELIEUX_MAX_PLAYERS ? "disabled" : ""}>Ajouter des invités jusqu'à 8</button></header>
          <div class="thiercelieux-seat-grid">
            ${Array.from({ length: THIERCELIEUX_MAX_PLAYERS }, (_, index) => {
              const player = players[index];
              return `<article class="thiercelieux-seat ${player ? "occupied" : "empty"}"><span class="thiercelieux-seat-number">${String(index + 1).padStart(2, "0")}</span>${player ? `<span class="thiercelieux-avatar large">${player.avatarUrl ? `<img src="${escapeHtml(player.avatarUrl)}" alt="">` : escapeHtml(String(player.name || "?").slice(0, 1).toUpperCase())}</span><strong>${escapeHtml(player.name)}</strong><small>Prêt pour la distribution</small><button type="button" data-action="thiercelieux-remove-player" data-id="${escapeHtml(player.id)}">Libérer le siège</button>` : `<span class="thiercelieux-empty-seat">+</span><strong>Siège libre</strong><small>Ajoutez un viewer depuis la file</small>`}</article>`;
            }).join("")}
          </div>
        </section>

        <section data-integrated-panel="roles" class="thiercelieux-roles-panel">
          <header class="thiercelieux-section-heading"><div><small>COMPOSITION SECRÈTE</small><h4>Un personnage par siège</h4><p>L'attribution aléatoire mélange cette composition au lancement ; le mode manuel respecte l'ordre ci-dessous.</p></div><button class="button" type="button" data-action="thiercelieux-auto-compose">Composition équilibrée</button></header>
          <div class="thiercelieux-role-grid">
            ${players.length ? Array.from({ length: players.length }, (_, index) => {
              const player = players[index];
              const role = THIERCELIEUX_ROLES.find((item) => item.id === roleIds[index]) || THIERCELIEUX_ROLES[0];
              return `<label class="thiercelieux-role-seat camp-${escapeHtml(role.camp)}" data-thiercelieux-role-seat><span>${String(index + 1).padStart(2, "0")}</span><div><small>${escapeHtml(player?.name || `Siège ${index + 1}`)}</small><select name="thiercelieuxRoleId" data-thiercelieux-role-select>${thiercelieuxRoleOptions(role.id, enabledPacks, ownedPacks)}</select><p data-thiercelieux-role-power>${escapeHtml(role.power)}</p></div></label>`;
            }).join("") : `<div class="thiercelieux-empty"><span>◌</span><strong>Ajoutez d'abord les joueurs</strong><small>La composition équilibrée apparaîtra automatiquement selon leur nombre.</small></div>`}
          </div>
          <aside class="thiercelieux-role-note"><b>Conseil d'équilibre</b><span>La composition automatique utilise uniquement le jeu de base et les extensions achetées puis activées.</span></aside>
        </section>

        <section data-integrated-panel="rules" class="thiercelieux-rules-layout">
          <article class="integrated-settings-card integrated-settings-card-wide">
            <header><span>▣</span><div><h4>Format de la fenêtre de jeu</h4><p>La régie reste dans ShenPulse ; seul le plateau s'ouvre dans ce format.</p></div></header>
            <div class="thiercelieux-format-choices">
              <label><input type="radio" name="thiercelieuxOrientation" value="landscape" ${config.orientation !== "portrait" ? "checked" : ""}><span class="preview landscape"></span><b>Paysage</b><small>Régie secondaire, écran partagé ou OBS 16:9</small></label>
              <label><input type="radio" name="thiercelieuxOrientation" value="portrait" ${config.orientation === "portrait" ? "checked" : ""}><span class="preview portrait"></span><b>Portrait</b><small>TikTok LIVE, écran vertical ou smartphone</small></label>
            </div>
          </article>
          <article class="integrated-settings-card">
            <header><span>◉</span><div><h4>Maître du jeu</h4><p>Choisissez le niveau d'accompagnement pendant la partie.</p></div></header>
            <div class="thiercelieux-mode-choices">${[["automatic", "Automatique", "ShenPulse narre et enchaîne."], ["hybrid", "Hybride", "ShenPulse parle, vous validez."], ["manual", "Manuel guidé", "Vous gardez toutes les commandes."]].map(([id, label, detail]) => `<label><input type="radio" name="thiercelieuxRunMode" value="${id}" ${config.runMode === id ? "checked" : ""}><span><b>${label}</b><small>${detail}</small></span></label>`).join("")}</div>
            <div class="integrated-settings-grid thiercelieux-timing-grid">
              ${integratedNumberField("thiercelieuxDebateSeconds", "Débat (secondes)", config.debateSeconds || 180, 30, 1800)}
              ${integratedNumberField("thiercelieuxVoteSeconds", "Vote (secondes)", config.voteSeconds || 60, 15, 600)}
              ${integratedNumberField("thiercelieuxRevealSeconds", "Carte privée (secondes)", config.revealSeconds || 20, 5, 120)}
              <label class="integrated-setting-field"><span>Attribution</span><select name="thiercelieuxAssignmentMode"><option value="random" ${config.assignmentMode !== "manual" ? "selected" : ""}>Aléatoire</option><option value="manual" ${config.assignmentMode === "manual" ? "selected" : ""}>Ordre des sièges</option></select></label>
            </div>
            <div class="integrated-settings-grid">
              ${integratedToggle("thiercelieuxCameraEnabled", "Caméra facultative", "Activation avec consentement explicite depuis le plateau.", config.cameraEnabled)}
              ${integratedToggle("thiercelieuxSpectatorEnabled", "Pronostics spectateurs", "Active les pronostics liés à la partie.", config.spectatorEnabled !== false)}
              ${integratedToggle("thiercelieuxAudioEnabled", "Narration et ambiance", "Active la voix, les nappes musicales et les effets du plateau.", config.audioEnabled !== false)}
              ${integratedToggle("thiercelieuxSaveEnabled", "Sauvegarde continue", "Permet de reprendre une partie interrompue.", config.saveEnabled !== false)}
              ${integratedToggle("thiercelieuxCaptainEnabled", "Capitaine", "Autorise l'élection et le vote double.", config.captainEnabled !== false)}
              ${integratedToggle("thiercelieuxRevealEliminated", "Révéler les éliminés", "Affiche le personnage après l'élimination.", config.revealEliminatedRoles !== false)}
            </div>
          </article>
          <article class="integrated-settings-card">
            <header><span>⚖</span><div><h4>Règles de la partie</h4><p>Les options générales restent indépendantes des contenus additionnels.</p></div></header>
            <div class="integrated-settings-grid thiercelieux-extension-toggles">
              ${integratedToggle("thiercelieuxOfficialRules", "Équilibre contrôlé", "Vérifie les combinaisons et l'avantage numérique des camps, de 3 à 8 joueurs.", config.rulesMode !== "custom")}
              ${ownedPacks.size > 1 ? integratedToggle("thiercelieuxAllowSolitary", "Conditions de victoire individuelles", "Autorise les compositions comportant un camp individuel.", config.allowSolitary !== false) : ""}
            </div>
          </article>
        </section>

        <section data-integrated-panel="extensions" class="thiercelieux-extensions-panel">
          <header class="thiercelieux-section-heading"><div><small>BOUTIQUE DU VILLAGE</small><h4>Choisissez vos extensions</h4><p>Chaque achat à 3,99 € est lié à votre compte. Les contenus restent entièrement invisibles dans le reste du logiciel tant qu'ils ne sont pas débloqués.</p></div></header>
          <div class="thiercelieux-extension-grid">${THIERCELIEUX_PACKS.map(([id, label, detail]) => renderThiercelieuxPackCard(pack, id, label, detail, enabledPacks.has(id), ownedPacks.has(id))).join("")}</div>
          ${villageEnabled ? `<article class="integrated-settings-card thiercelieux-owned-extension-options"><header><span>⌂</span><div><h4>Options de l'extension activée</h4><p>Ces réglages sont disponibles parce que ce contenu est débloqué sur votre compte.</p></div></header>${thiercelieuxFeatureToggle("thiercelieuxBuildingsEnabled", "Bâtiments et métiers", "Attribue un métier public à chaque siège.", config.buildingsEnabled, true, "")}</article>` : ""}
          ${nouvelleLuneEnabled ? `<article class="integrated-settings-card thiercelieux-owned-extension-options"><header><span>☾</span><div><h4>Options de l'extension activée</h4><p>Événements et variantes disponibles pour cette partie.</p></div></header>${thiercelieuxFeatureToggle("thiercelieuxEventsEnabled", "Événements", "Active les emplacements d'événements de cette extension.", config.eventsEnabled, true, "")}<div class="thiercelieux-variant-heading"><b>Variantes disponibles</b><small>Sélectionnez celles que vous souhaitez utiliser.</small></div><div class="thiercelieux-variant-list">${THIERCELIEUX_VARIANTS.map(([id, label]) => `<label><input type="checkbox" name="thiercelieuxVariant" value="${id}" ${enabledVariants.has(id) ? "checked" : ""}><span>${escapeHtml(label)}</span></label>`).join("")}</div></article>` : ""}
        </section>
      </div>
    </div>
  </div>`;
}

function thiercelieuxConfigurationFromForm(data, current) {
  const number = (name, fallback, minimum, maximum) => {
    const parsed = Number(data.get(name));
    return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
  };
  const gift = integratedGiftDefinition(
    data.get("thiercelieuxGiftName"),
    { giftId: current.giftId, name: current.giftName, image: current.giftImage, cost: current.giftValue },
    data.get("thiercelieuxGiftNameGiftId")
  );
  const players = thiercelieuxReadJson(data.get("thiercelieuxPlayers"), current.activePlayers || []).slice(0, THIERCELIEUX_MAX_PLAYERS);
  const queue = thiercelieuxReadJson(data.get("thiercelieuxQueue"), current.queue || []).slice(0, 250);
  const ownedPacks = thiercelieuxOwnedPackIds();
  const packs = [...new Set(["base", ...data.getAll("thiercelieuxPack").map(String)])]
    .filter((id) => ownedPacks.has(id) && THIERCELIEUX_PACKS.some(([packId]) => packId === id));
  const enabledPacks = new Set(packs);
  const recommendedRoles = thiercelieuxRecommendedRoles(players.length, enabledPacks);
  const submittedRoles = data.getAll("thiercelieuxRoleId")
    .map(String)
    .filter((id) => THIERCELIEUX_ROLE_IDS.has(id))
    .slice(0, players.length);
  const roleIds = (submittedRoles.length ? submittedRoles : (current.roleIds || recommendedRoles))
    .slice(0, players.length)
    .map((roleId, index) => {
      const role = THIERCELIEUX_ROLES.find((item) => item.id === roleId);
      return role && enabledPacks.has(role.pack)
        ? roleId
        : recommendedRoles[index] || "simple-villageois";
    });
  while (roleIds.length < players.length) {
    roleIds.push(recommendedRoles[roleIds.length] || "simple-villageois");
  }
  return {
    ...current,
    orientation: data.get("thiercelieuxOrientation") === "portrait" ? "portrait" : "landscape",
    assignmentMode: data.get("thiercelieuxAssignmentMode") === "manual" ? "manual" : "random",
    runMode: ["automatic", "manual", "hybrid"].includes(data.get("thiercelieuxRunMode")) ? data.get("thiercelieuxRunMode") : "hybrid",
    rulesMode: data.has("thiercelieuxOfficialRules") ? "official" : "custom",
    packs,
    selectedVariantIds: enabledPacks.has("nouvelle-lune")
      ? data.getAll("thiercelieuxVariant").map(String).filter((id) => THIERCELIEUX_VARIANTS.some(([variantId]) => variantId === id))
      : [],
    buildingsEnabled: enabledPacks.has("village") && data.has("thiercelieuxBuildingsEnabled"),
    eventsEnabled: enabledPacks.has("nouvelle-lune") && data.has("thiercelieuxEventsEnabled"),
    captainEnabled: data.has("thiercelieuxCaptainEnabled"),
    allowSolitary: data.has("thiercelieuxAllowSolitary"),
    cameraEnabled: data.has("thiercelieuxCameraEnabled"),
    spectatorEnabled: data.has("thiercelieuxSpectatorEnabled"),
    audioEnabled: data.has("thiercelieuxAudioEnabled"),
    saveEnabled: data.has("thiercelieuxSaveEnabled"),
    revealEliminatedRoles: data.has("thiercelieuxRevealEliminated"),
    debateSeconds: Math.round(number("thiercelieuxDebateSeconds", current.debateSeconds || 180, 30, 1800)),
    voteSeconds: Math.round(number("thiercelieuxVoteSeconds", current.voteSeconds || 60, 15, 600)),
    revealSeconds: Math.round(number("thiercelieuxRevealSeconds", current.revealSeconds || 20, 5, 120)),
    giftName: gift.name,
    giftId: gift.giftId,
    giftImage: gift.image,
    giftValue: gift.cost || Math.max(0, Number(current.giftValue) || 0),
    giftQuantity: Math.round(number("thiercelieuxGiftQuantity", current.giftQuantity || 1, 1, 999)),
    registrationOpen: data.has("thiercelieuxRegistrationOpen"),
    registrationMinutes: Math.round(number("thiercelieuxRegistrationMinutes", current.registrationMinutes || 120, 1, 10080)),
    priorityMode: data.get("thiercelieuxPriorityMode") === "value" ? "value" : "arrival",
    giftGuaranteesSeat: data.has("thiercelieuxGiftGuaranteesSeat"),
    allowDuplicateEntries: data.has("thiercelieuxAllowDuplicateEntries"),
    keepQueueAfterGame: true,
    seats: 8,
    queue,
    activePlayers: players,
    roleIds
  };
}

function thiercelieuxFreshId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function syncThiercelieuxRolePreview(select) {
  const role = THIERCELIEUX_ROLES.find((candidate) => candidate.id === select?.value);
  const seat = select?.closest("[data-thiercelieux-role-seat]");
  if (!role || !seat) return;
  seat.classList.remove("camp-village", "camp-wolves", "camp-solitary", "camp-ambiguous");
  seat.classList.add(`camp-${role.camp}`);
  const power = seat.querySelector("[data-thiercelieux-role-power]");
  if (power) power.textContent = role.power;
}

function syncThiercelieuxGiftPreview(root, gift = null) {
  const form = root?.closest('[data-integrated-game-settings="thiercelieux"]');
  const preview = form?.querySelector("[data-thiercelieux-gift-preview]");
  if (!preview) return;
  const input = root?.querySelector("[data-gift-picker]");
  const quantity = Math.max(1, Number(form.querySelector('[name="thiercelieuxGiftQuantity"]')?.value) || 1);
  const selected = gift || giftForIdentity(input?.value, root?.querySelector("[data-gift-id-input]")?.value);
  const image = preview.querySelector("[data-thiercelieux-gift-preview-image]");
  const name = preview.querySelector("[data-thiercelieux-gift-preview-name]");
  const cost = preview.querySelector("[data-thiercelieux-gift-preview-cost]");
  if (image) image.innerHTML = selected?.imageUrl ? `<img src="${escapeHtml(selected.imageUrl)}" alt="">` : "🎁";
  if (name) name.textContent = selected?.name || input?.value || "À choisir";
  if (cost) cost.textContent = `${Number(selected?.cost || 0).toLocaleString("fr-FR")} pièce${Number(selected?.cost || 0) > 1 ? "s" : ""} · ×${quantity}`;
}

function thiercelieuxQueueEntry(config, source, { manual = false } = {}) {
  const now = Date.now();
  const user = source.user || {};
  const gift = source.data || {};
  return {
    id: thiercelieuxFreshId("queue"),
    userId: String(user.id || user.uniqueId || thiercelieuxFreshId("guest")),
    username: String(user.name || user.uniqueId || ""),
    displayName: String(user.displayName || user.name || "Invité").trim().slice(0, 50) || "Invité",
    avatarUrl: String(user.avatarUrl || ""),
    giftName: manual ? "Ajout manuel" : String(gift.giftName || gift.name || config.giftName || "Cadeau LIVE"),
    giftId: manual ? "" : String(gift.giftId || gift.id || config.giftId || ""),
    value: manual ? 0 : Math.max(0, Number(gift.value || gift.cost || config.giftValue || 0)),
    quantity: manual ? 0 : Math.max(1, Math.round(Number(gift.count || gift.repeatCount || 1))),
    totalValue: manual ? 0 : Math.max(0, Number(gift.value || gift.cost || config.giftValue || 0)) * Math.max(1, Math.round(Number(gift.count || gift.repeatCount || 1))),
    receivedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + Math.max(1, Number(config.registrationMinutes) || 120) * 60_000).toISOString(),
    connected: !manual,
    status: (config.activePlayers || []).length >= THIERCELIEUX_MAX_PLAYERS ? "full" : "waiting",
    manual
  };
}

let thiercelieuxRegistrationQueue = Promise.resolve();

function handleThiercelieuxRegistrationEvent(event) {
  const pending = thiercelieuxRegistrationQueue.then(() => persistThiercelieuxRegistrationEvent(event));
  thiercelieuxRegistrationQueue = pending.catch(() => {});
  return pending;
}

async function persistThiercelieuxRegistrationEvent(event) {
  if (event?.type !== "gift") return;
  const config = integratedGameSettings("thiercelieux");
  if (config.registrationOpen === false || !config.giftName) return;
  const gift = event.data || {};
  const giftId = String(gift.giftId || gift.id || "");
  const giftName = String(gift.giftName || gift.name || "");
  const matches = config.giftId
    ? giftId === String(config.giftId)
    : normalizeGiftName(giftName) === normalizeGiftName(config.giftName);
  const quantity = Math.max(1, Math.round(Number(gift.count || gift.repeatCount || 1)));
  if (!matches || quantity < Math.max(1, Number(config.giftQuantity) || 1)) return;
  const userId = String(event.user?.id || event.user?.uniqueId || event.user?.name || "");
  if (!userId) return;
  const queue = Array.isArray(config.queue) ? structuredClone(config.queue) : [];
  if (!config.allowDuplicateEntries && queue.some((entry) => entry.userId === userId && !["removed", "refused"].includes(entry.status))) {
    toast("Déjà inscrit", `${event.user?.displayName || event.user?.name || "Ce viewer"} est déjà dans la file.`);
    return;
  }
  const entry = thiercelieuxQueueEntry(config, event);
  queue.push(entry);
  if (config.priorityMode === "value") queue.sort((left, right) => Number(right.totalValue || 0) - Number(left.totalValue || 0));
  snapshot = await api.configureGame("thiercelieux", { ...config, queue });
  toast("Nouvelle inscription", `${entry.displayName} rejoint la file de Thiercelieux.`);
  if (currentPage === "games" && selectedGameId === "thiercelieux" && gamePageMode === "detail") render();
}

function handleThiercelieuxControlEffect(payload) {
  if (payload?.packId !== "thiercelieux") return Promise.resolve();
  const effectId = String(payload.effectId || "");
  if (!["ouvrir-inscriptions", "fermer-inscriptions"].includes(effectId)) return Promise.resolve();
  const pending = thiercelieuxRegistrationQueue.then(async () => {
    const config = integratedGameSettings("thiercelieux");
    const registrationOpen = effectId === "ouvrir-inscriptions";
    if (config.registrationOpen === registrationOpen) return;
    snapshot = await api.configureGame("thiercelieux", {
      ...config,
      registrationOpen
    });
    toast(
      registrationOpen ? "Inscriptions ouvertes" : "Inscriptions fermées",
      "La régie Thiercelieux est à jour."
    );
    if (currentPage === "games" && selectedGameId === "thiercelieux" && gamePageMode === "detail") render();
  });
  thiercelieuxRegistrationQueue = pending.catch(() => {});
  return pending;
}
