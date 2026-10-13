"use strict";

/**
 * Tableau de préparation et de session des jeux au parcours unifié.
 *
 * L'installation reste atomique côté moteur, tandis que l'interface détaille
 * chaque composant attendu et expose une seule réparation complète.
 */

function sessionGameWorkspaceProfile(pack) {
  if (pack.id === "fortnite") {
    return {
      assetCount: 0,
      assetIds: [],
      inputOnly: true,
      requiresRom: false,
      sessionLabel: "SESSION FORTNITE",
      platformTags: ["PC", "Epic Games", "Clavier ciblé"],
      installKicker: "PRÉPARATION SANS MOD",
      installDescription:
        "Aucun fichier du jeu n’est modifié. Choisissez seulement la disposition de votre clavier.",
      readyDescription:
        "Activez les interactions de la session. Fortnite ne sera pas lancé automatiquement.",
      waitingDescription:
        "Enregistrez la disposition du clavier avant de démarrer.",
      inactiveDescription:
        "La session peut être activée sans lancer Fortnite.",
      interactionDescription:
        "Ajoutez, modifiez et testez les interactions de Fortnite.",
      processLabel: "Fortnite",
      repairHelp:
        "ShenPulse envoie les commandes uniquement à la fenêtre Fortnite reconnue. Aucun mod n’est nécessaire."
    };
  }
  if (pack.id === "rocket-league") {
    return {
      assetCount: 0,
      assetIds: [],
      inputOnly: true,
      requiresRom: false,
      sessionLabel: "SESSION ROCKET LEAGUE",
      platformTags: ["PC", "Epic Games / Steam", "Clavier et souris"],
      installKicker: "PRÉPARATION SANS MOD",
      installDescription:
        "Aucun fichier du jeu n’est modifié. Choisissez uniquement la disposition de votre clavier.",
      readyDescription:
        "Activez la session, puis programmez les interactions Rocket League sans lancer automatiquement le jeu.",
      waitingDescription:
        "Enregistrez la disposition du clavier avant de démarrer.",
      inactiveDescription:
        "La session peut être activée sans lancer Rocket League.",
      interactionDescription:
        "Ajoutez, modifiez et testez les interactions de Rocket League.",
      processLabel: "Rocket League",
      repairHelp:
        "ShenPulse cible uniquement la fenêtre Rocket League et reproduit les commandes clavier et souris attendues. Aucun mod n’est nécessaire."
    };
  }
  if (pack.id === "resident-evil-3") {
    return {
      assetCount: 1,
      assetIds: ["dotnet-desktop-runtime-8", "mod"],
      requiresRom: false,
      inputOnly: false,
      sessionLabel: "SESSION RESIDENT EVIL 3",
      platformTags: ["PC", "Steam", "REFramework"],
      installDescription:
        "ShenPulse détecte le jeu, installe le runtime et prépare le connecteur local.",
      readyDescription:
        "Activez les interactions de la session. Resident Evil 3 ne sera pas lancé automatiquement.",
      waitingDescription:
        "Tous les éléments de la checklist doivent être au vert avant de démarrer.",
      inactiveDescription:
        "La session peut être activée sans lancer Resident Evil 3.",
      interactionDescription:
        "Ajoutez, modifiez et testez les interactions de Resident Evil 3.",
      repairHelp:
        "Le bouton supérieur détecte le jeu, installe .NET 8, REFramework et le connecteur ShenPulse."
    };
  }
  return {
    assetCount: 4,
    assetIds: [],
    requiresRom: true,
    inputOnly: false,
    sessionLabel: "SESSION SUPER MARIO KART",
    platformTags: ["SNES", "BizHawk"],
    installDescription:
      "ShenPulse installe et vérifie tous les composants nécessaires.",
    readyDescription:
      "Activez les interactions de la session. Super Mario Kart et BizHawk ne seront pas lancés automatiquement.",
    waitingDescription:
      "Les quatre éléments de la checklist doivent être au vert avant de démarrer.",
    inactiveDescription:
      "La session peut être activée sans lancer Super Mario Kart ni BizHawk.",
    interactionDescription:
      "Ajoutez, modifiez et testez les interactions de Super Mario Kart.",
    repairHelp:
      "Le bouton supérieur télécharge, installe et vérifie toute la liste."
  };
}

function superMarioKartWorkspaceState(pack) {
  const profile = sessionGameWorkspaceProfile(pack);
  const installation = snapshot?.state?.game?.installations?.[pack.id];
  const mappings = gameMappedEffects(pack);
  const runningSession = activeGameSession();
  if (profile.inputOnly) {
    const inputLayout = String(
      snapshot?.state?.game?.connectorOverrides?.[pack.id]?.keyLayout ||
        pack.connector?.keyLayout ||
        "wasd"
    ).toLowerCase() === "azerty"
      ? "azerty"
      : "wasd";
    return {
      installation: null,
      installed: true,
      upToDate: true,
      assetsReady: true,
      romReady: true,
      allReady: true,
      inputLayout,
      componentReady() {
        return true;
      },
      mappings,
      sessionActive: runningSession?.packId === pack.id
    };
  }
  const installed = Boolean(installation?.path);
  const upToDate = Boolean(
    installed &&
      (!pack.installerVersion ||
        installation?.installerVersion === pack.installerVersion)
  );
  const assetsReady = Boolean(
    installed &&
      (Array.isArray(installation?.satisfiedAssetIds)
        ? profile.assetIds.length === 0 ||
          profile.assetIds.every((assetId) =>
            installation.satisfiedAssetIds.includes(assetId)
          )
        : Number(installation?.assetCount || 0) >= profile.assetCount)
  );
  const romReady = profile.requiresRom
    ? Boolean(installation?.romReady && installation?.romPath)
    : true;
  return {
    installation,
    installed,
    upToDate,
    assetsReady,
    romReady,
    allReady: installed && upToDate && assetsReady && romReady,
    componentReady(assetId) {
      if (!installed || !upToDate || !assetsReady) return false;
      if (!Array.isArray(installation?.satisfiedAssetIds)) return true;
      return installation.satisfiedAssetIds.includes(assetId);
    },
    mappings,
    sessionActive: runningSession?.packId === pack.id
  };
}

function superMarioKartInstallationItems(pack, state) {
  if (pack.id === "fortnite") {
    const layoutLabel = state.inputLayout === "azerty" ? "ZQSD" : "WASD";
    return [
      {
        icon: "◇",
        label: "Aucun mod à installer",
        detail: "Fortnite reste intact et géré par Epic Games",
        ready: true
      },
      {
        icon: "⌖",
        label: "Connecteur clavier ShenPulse",
        detail: "Cible uniquement FortniteClient-Win64-Shipping.exe",
        ready: true
      },
      {
        icon: "⌨",
        label: `Disposition ${layoutLabel}`,
        detail: "Touches de déplacement utilisées dans Fortnite",
        ready: true
      }
    ];
  }
  if (pack.id === "rocket-league") {
    const layoutLabel = state.inputLayout === "azerty" ? "ZQSD" : "WASD";
    return [
      {
        icon: "◇",
        label: "Aucun mod à installer",
        detail: "Rocket League reste intact sur Epic Games ou Steam",
        ready: true
      },
      {
        icon: "⌖",
        label: "Connecteur clavier et souris ShenPulse",
        detail: "Cible uniquement RocketLeague.exe",
        ready: true
      },
      {
        icon: "⌨",
        label: `Disposition ${layoutLabel}`,
        detail: "Conduite au clavier, turbo et saut à la souris",
        ready: true
      }
    ];
  }
  if (pack.id === "resident-evil-3") {
    return [
      {
        icon: "▣",
        label: "Détection de Resident Evil 3",
        detail: state.installed
          ? state.installation?.path || "Dossier Steam détecté"
          : "Installation Steam requise",
        ready: state.installed
      },
      {
        icon: "◆",
        label: "Installation du runtime .NET 8",
        detail: state.componentReady("dotnet-desktop-runtime-8")
          ? "Runtime .NET 8 présent et validé"
          : "Environnement officiel requis par le connecteur",
        ready: state.componentReady("dotnet-desktop-runtime-8")
      },
      {
        icon: "⌁",
        label: "Installation de REFramework",
        detail: state.componentReady("mod")
          ? "REFramework est installé dans le dossier du jeu"
          : "Passerelle locale chargée par le jeu",
        ready: state.componentReady("mod")
      },
      {
        icon: "⚡",
        label: "Installation du pack d’interactions",
        detail: state.componentReady("mod")
          ? `${pack.effects.length} effets Resident Evil 3 disponibles`
          : `${pack.effects.length} effets Resident Evil 3`,
        ready: state.componentReady("mod")
      }
    ];
  }
  return [
    {
      icon: "▣",
      label: "Installation de BizHawk",
      detail: "Émulateur préparé par ShenPulse",
      ready: state.installed
    },
    {
      icon: "⌁",
      label: "Installation du client local",
      detail: state.upToDate
        ? "Dernière version du connecteur ShenPulse"
        : `Version ${pack.installerVersion || "actuelle"} requise`,
      ready: state.assetsReady && state.upToDate
    },
    {
      icon: "⚡",
      label: "Installation du pack d’interactions",
      detail: `${pack.effects.length} effets Super Mario Kart`,
      ready: state.assetsReady && state.upToDate
    },
    {
      icon: "◆",
      label: "Installation de la ROM",
      detail: state.romReady
        ? state.installation?.romName || "Super Mario Kart (USA) validé"
        : "ROM Super Mario Kart (USA) requise",
      ready: state.romReady
    }
  ];
}

function renderSuperMarioKartInstallationRail(pack, unlocked, state) {
  const profile = sessionGameWorkspaceProfile(pack);
  const busy = gameInstallBusyId === pack.id;
  const items = superMarioKartInstallationItems(pack, state);
  const buttonLabel = profile.inputOnly
    ? "✓ Enregistrer la configuration"
    : busy
      ? "Installation en cours…"
      : state.installed
        ? "↻ Tout réparer en un clic"
        : "↓ Tout installer en un clic";
  const buttonAction = profile.inputOnly
    ? "save-game-input-layout"
    : "install-game";
  return `<aside class="smk-command-rail">
    <header class="smk-install-group-heading">
      <span>${profile.installKicker || "INSTALLATION COMPLÈTE"}</span>
      <strong>Préparer le jeu</strong>
      <p>${profile.installDescription}</p>
      ${profile.inputOnly ? `<label class="smk-input-layout-field"><span>Disposition du clavier</span><select data-game-key-layout><option value="wasd" ${state.inputLayout === "wasd" ? "selected" : ""}>WASD — clavier standard</option><option value="azerty" ${state.inputLayout === "azerty" ? "selected" : ""}>ZQSD — clavier français</option></select></label>` : ""}
      <button class="button primary smk-install-all" data-action="${buttonAction}" data-id="${escapeHtml(pack.id)}" ${unlocked && !busy ? "" : "disabled"}>${buttonLabel}</button>
      ${profile.inputOnly ? `<button class="button smk-test-input-game" data-action="test-game" data-id="${escapeHtml(pack.id)}" ${unlocked ? "" : "disabled"}>◎ Vérifier ${escapeHtml(profile.processLabel || pack.name)} ouvert</button>` : ""}
    </header>
    ${renderGamePageMessage(pack, "installation")}
    <section class="smk-install-checklist" aria-label="Installations de ${escapeHtml(pack.name)}">
      ${items.map((item) => `<article class="${item.ready ? "ready" : busy ? "working" : "missing"}">
        <span class="smk-install-state">${item.ready ? "✓" : busy ? "…" : "!"}</span>
        <span class="smk-install-icon">${item.icon}</span>
        <span class="smk-install-copy"><strong>${item.label}</strong><small>${escapeHtml(item.detail)}</small></span>
        <b>${item.ready ? "OK" : busy ? "EN COURS" : "REQUIS"}</b>
      </article>`).join("")}
    </section>
    <footer class="smk-rail-help">
      <span>✦</span>
      <div><strong>${profile.inputOnly ? "Configuration directe" : "Installation en une seule fois"}</strong><p>${profile.repairHelp}</p></div>
    </footer>
  </aside>`;
}

function renderSuperMarioKartSessionLanding(pack, unlocked, state) {
  const profile = sessionGameWorkspaceProfile(pack);
  const canStart = unlocked && state.allReady;
  return `<section class="smk-session-launch">
    <span class="smk-session-launch-icon">▶</span>
    <small>${profile.sessionLabel}</small>
    <h3>${state.allReady ? "Tout est prêt pour votre session" : "Terminez la préparation du jeu"}</h3>
    <p>${state.allReady
      ? profile.readyDescription
      : profile.waitingDescription}</p>
    <button class="button primary smk-start-session-button" data-action="start-game-session" data-id="${escapeHtml(pack.id)}" ${canStart ? "" : "disabled"}>▶ Démarrer la session</button>
    <em>Cette action active la session ShenPulse sans ouvrir le jeu.</em>
  </section>`;
}

function renderSuperMarioKartActiveSession(pack, unlocked, state) {
  const profile = sessionGameWorkspaceProfile(pack);
  const showOverlay = gameWorkspaceStep === "overlays";
  if (!showOverlay) gameWorkspaceStep = "interactions";
  return `<header class="smk-session-heading active-session">
      <div>
        <span>SESSION ACTIVE</span>
        <h3>${showOverlay ? "Overlay de la partie" : "Interactions de la session"}</h3>
        <p>${showOverlay
          ? "Préparez le visuel des cadeaux associé à cette session."
          : profile.interactionDescription}</p>
      </div>
      <div class="smk-session-actions">
        <button class="button" data-action="game-step" data-value="${showOverlay ? "interactions" : "overlays"}">${showOverlay ? "← Interactions" : "▱ Overlay de partie"}</button>
        ${profile.inputOnly
          ? `<button class="button" data-action="test-game" data-id="${escapeHtml(pack.id)}">◎ Vérifier le jeu</button>`
          : `<button class="button" data-action="launch-game" data-id="${escapeHtml(pack.id)}" ${state.allReady ? "" : "disabled"}>▶ Ouvrir le jeu</button>`}
        <button class="button danger" data-action="stop-game-session">■ Arrêter la session</button>
      </div>
    </header>
    <section class="smk-session-stage active-session">
      ${showOverlay
        ? renderGameOverlays(pack, unlocked)
        : renderStandardGameInteractions(pack, unlocked, {
            addCard: true,
            hideHeaderAdd: true
          })}
    </section>`;
}

function renderSuperMarioKartWorkspace(pack) {
  const profile = sessionGameWorkspaceProfile(pack);
  const unlocked = isGameUnlocked(pack);
  const state = superMarioKartWorkspaceState(pack);
  const artwork = escapeHtml(gameArtwork(pack));
  return `<div class="reference-page game-workspace-page session-game-workspace-page smk-workspace-page">
    <button class="game-back-button smk-back-button" data-action="close-game"><span>←</span> Retour à la galerie</button>
    <section class="smk-workspace-hero">
      <img class="smk-hero-backdrop" src="${artwork}" alt="" aria-hidden="true">
      <div class="smk-hero-shade"></div>
      <img class="smk-hero-cover" src="${artwork}" alt="Illustration de ${escapeHtml(pack.name)}">
      <div class="smk-hero-copy">
        <span>ESPACE DE JEU SHENPULSE</span>
        <h2>${escapeHtml(pack.name)}</h2>
        <p>Préparez le jeu, configurez les interactions et pilotez votre session depuis un tableau unique.</p>
        <div class="smk-hero-tags">${profile.platformTags.map((tag) => `<b>${escapeHtml(tag)}</b>`).join("")}<b>${pack.effects.length} interactions</b></div>
      </div>
      <div class="smk-hero-status ${state.sessionActive ? "live" : state.allReady ? "ready" : ""}">
        <i></i><span>${state.sessionActive ? "Session active" : state.allReady ? "Prêt à jouer" : "Configuration requise"}</span>
      </div>
    </section>
    ${unlocked ? "" : `<section class="game-access-warning"><span aria-hidden="true">🔒</span><div><strong>Accès requis pour exécuter ce jeu</strong><p>${escapeHtml(gameAccessReason(pack))}</p></div><button class="button primary" data-navigate="membership">Voir les accès</button></section>`}
    <div class="smk-workspace-shell">
      ${renderSuperMarioKartInstallationRail(pack, unlocked, state)}
      <main class="smk-session-dashboard ${state.sessionActive ? "session-running" : "session-waiting"}">
        ${state.sessionActive
          ? renderSuperMarioKartActiveSession(pack, unlocked, state)
          : `<header class="smk-session-heading">
              <div><span>TABLEAU DE SESSION</span><h3>Démarrer une nouvelle session</h3><p>${profile.inactiveDescription}</p></div>
              <div class="smk-session-metrics">
                <span class="${state.allReady ? "ready" : ""}"><i></i>${state.allReady ? "Installation prête" : "Installation incomplète"}</span>
                <span class="${state.mappings.length ? "ready" : ""}"><i></i>${state.mappings.length} configurée${state.mappings.length > 1 ? "s" : ""}</span>
                <span><i></i>Hors session</span>
              </div>
            </header>
            <section class="smk-session-stage">${renderSuperMarioKartSessionLanding(pack, unlocked, state)}</section>`}
      </main>
    </div>
    ${renderGameLaunchProgressModal(pack)}
  </div>`;
}

function renderResidentEvil3Workspace(pack) {
  return renderSuperMarioKartWorkspace(pack);
}

function renderFortniteWorkspace(pack) {
  return renderSuperMarioKartWorkspace(pack);
}

function renderRocketLeagueWorkspace(pack) {
  return renderSuperMarioKartWorkspace(pack);
}
