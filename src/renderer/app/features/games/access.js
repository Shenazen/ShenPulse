"use strict";

/**
 * Droits, achat et entrée dans les jeux.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function gameAccessGroup(pack) {
  return pack.accessMode === "purchase" ? "purchase" : "included";
}

function currentSubscription() {
  return snapshot.state.commerce?.subscription || {
    tier: "free",
    source: "free",
    status: "free",
    priceMonthly: 0
  };
}

function commerceExpiryMs(entry) {
  const numeric = Number(entry?.expiresAtMs || 0);
  if (numeric > 0) return numeric;
  const parsed = Date.parse(
    String(entry?.expiresAt || entry?.renewalDate || "")
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasProAccess() {
  const subscription = currentSubscription();
  if (!["pro", "premium"].includes(subscription.tier)) return false;
  if (
    subscription.source === "trial" ||
    subscription.status === "trial"
  ) {
    return (
      ["active", "trial"].includes(subscription.status) &&
      commerceExpiryMs(subscription) > Date.now()
    );
  }
  return ["active", "paid"].includes(subscription.status);
}

function hasActivePaidPremium() {
  const subscription = currentSubscription();
  return (
    subscription.tier === "premium" &&
    ["active", "paid"].includes(String(subscription.status || "")) &&
    subscription.source !== "trial"
  );
}

function gameEntitlement(pack) {
  if (pack.accessMode === "included") {
    return { gameId: pack.id, source: "included", status: "active" };
  }
  return (snapshot.state.commerce?.gameEntitlements || []).find((entry) => {
    if (typeof entry === "string") return entry === pack.id;
    if (!entry || entry.gameId !== pack.id) return false;
    const status = String(entry.status || "").trim().toLowerCase();
    const source = String(entry.source || "").trim().toLowerCase();
    if (source === "trial" || status === "trial") {
      return commerceExpiryMs(entry) > Date.now();
    }
    return (
      !status ||
      ["active", "captured", "completed", "paid", "purchased"].includes(
        status
      )
    );
  });
}

function hasGameEntitlement(pack) {
  return Boolean(gameEntitlement(pack));
}

function isGameUnlocked(pack) {
  return hasProAccess() && hasGameEntitlement(pack);
}

function gameArtwork(pack) {
  if (pack.artworkUrl) return pack.artworkUrl;
  if (pack.artwork) return `assets/games/${pack.artwork}`;
  return "assets/brand/shenpulse-512.png";
}

function gamePrice(pack) {
  if (pack.accessMode === "included") return "Inclus avec abonnement";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: pack.currency || "EUR"
  }).format(Number(pack.price || 0));
}

function gameTileActionLabel(pack) {
  if (isGameUnlocked(pack)) {
    return pack.modeSelector ? "Choisir le mode" : "Entrer dans le jeu";
  }
  if (pack.accessMode === "purchase" && !hasGameEntitlement(pack)) {
    return "Acheter le jeu";
  }
  return "Voir l’abonnement";
}

function gameAccessLabel(pack) {
  if (!hasProAccess()) return "ABONNEMENT REQUIS";
  if (!hasGameEntitlement(pack)) return "ACHAT REQUIS";
  const entitlement = gameEntitlement(pack);
  if (
    entitlement?.source === "trial" ||
    entitlement?.status === "trial"
  ) {
    return "ESSAI ACTIF";
  }
  return pack.accessMode === "included"
    ? "INCLUS AVEC ABONNEMENT"
    : "ACHETÉ";
}

function gameAccessReason(pack) {
  const missingGame = !hasGameEntitlement(pack);
  const missingSubscription = !hasProAccess();
  if (missingGame && missingSubscription) {
    return "Un abonnement ShenPulse Pro ou Premium actif et le droit d’accès à ce jeu (achat ou essai) sont requis.";
  }
  if (missingGame) {
    return "Votre abonnement est actif. Achetez ce jeu ou activez un essai de jeu pour y accéder.";
  }
  return "Activez un abonnement ShenPulse Pro ou Premium pour entrer dans ce jeu.";
}

function requireGameAccess(pack) {
  if (pack && isGameUnlocked(pack)) return true;
  toast(
    "Abonnement ShenPulse requis",
    pack
      ? gameAccessReason(pack)
      : "Un abonnement ShenPulse Pro ou Premium actif est requis pour accéder aux jeux.",
    true
  );
  return false;
}

function openGamePurchaseDialog(pack) {
  const price = gamePrice(pack);
  const subscriptionMessage = hasProAccess()
    ? "Votre abonnement est actif : le jeu sera accessible dès la validation du paiement."
    : "Un abonnement Pro ou Premium actif sera aussi nécessaire pour lancer le jeu.";
  openEditor({
    title: `Acheter ${pack.name}`,
    kicker: "ACHAT UNIQUE · PAIEMENT PAYPAL",
    variant: "game-purchase",
    submitLabel: `Acheter pour ${price}`,
    pendingLabel: "Ouverture de PayPal…",
    successMessage: "",
    body: `
      <div class="game-purchase-dialog">
        <div class="game-purchase-visual">
          <img src="${escapeHtml(gameArtwork(pack))}" alt="${escapeHtml(pack.name)}">
          <div>
            <small>MODULE INTERACTIF SHENPULSE</small>
            <strong>${escapeHtml(pack.name)}</strong>
          </div>
        </div>
        <div class="game-purchase-copy">
          <span class="game-purchase-badge">ACHAT UNIQUE</span>
          <h3>Ajoutez ce jeu à votre compte</h3>
          <p>${escapeHtml(pack.description || "Débloquez ce jeu interactif dans ShenPulse.")}</p>
          <div class="game-purchase-price">
            <span>Prix du jeu</span>
            <strong>${escapeHtml(price)}</strong>
            <small>Paiement unique, sans renouvellement pour le jeu</small>
          </div>
          <ul class="game-purchase-facts">
            <li><span>✓</span><div><strong>Conservé sur votre compte</strong><small>L’achat est resynchronisé automatiquement après votre retour de PayPal.</small></div></li>
            <li><span>✓</span><div><strong>${hasProAccess() ? "Abonnement actif" : "Abonnement requis pour jouer"}</strong><small>${escapeHtml(subscriptionMessage)}</small></div></li>
            <li><span>✓</span><div><strong>Paiement sécurisé par PayPal</strong><small>Votre navigateur s’ouvrira après confirmation.</small></div></li>
          </ul>
        </div>
      </div>`,
    onSubmit: async () => {
      const response = await api.account.startGameCheckout({
        productId: pack.id
      });
      const result = response?.result || response;
      if (response?.snapshot) {
        acceptSnapshot(response.snapshot);
        currentPage = "games";
      }
      if (result?.cancelled) {
        toast(
          "Achat annulé",
          `Aucun paiement n’a été enregistré pour ${pack.name}.`
        );
      } else if (result?.alreadyPurchased) {
        toast(
          "Jeu déjà acheté",
          `${pack.name} est déjà associé à votre compte ShenPulse.`
        );
      } else if (result?.checkoutCompleted) {
        toast(
          "Achat validé",
          `${pack.name} est maintenant associé à votre compte ShenPulse.`
        );
      } else {
        throw new Error(
          "L’achat n’a pas pu être confirmé. Aucun accès n’a été modifié."
        );
      }
    }
  });
}

function renderGamesCatalogLegacy() {
  if (!["all", "included", "purchase"].includes(gameFilter)) {
    gameFilter = "all";
  }
  const query = gameSearch.trim().toLowerCase();
  const packs = snapshot.packs.filter((pack) => {
    const matchesSearch = !query || `${pack.name} ${pack.description} ${(pack.tags || []).join(" ")}`.toLowerCase().includes(query);
    const matchesFilter = gameFilter === "all" || gameAccessGroup(pack) === gameFilter;
    return matchesSearch && matchesFilter;
  });
  const selected = snapshot.packs.find((pack) => pack.id === (selectedGameId || snapshot.state.session.activeGamePackId)) || snapshot.packs[0];
  const selectedUnlocked = isGameUnlocked(selected);
  return `
    <div class="reference-page games-gallery-page">
      <section class="page-hero compact games-heading">
        <div><span class="hero-chip">JEUX INTERACTIFS</span><h2>Galerie des jeux</h2><p>Choisissez un pack, configurez sa passerelle et testez chaque effet avant le live.</p></div>
        <span class="hero-count">${snapshot.packs.length}</span>
      </section>
      <section class="catalog-toolbar games-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="games" type="search" value="${escapeHtml(gameSearch)}" placeholder="Rechercher un jeu, un connecteur ou un effet"></label>
        <div class="filter-pills"><button class="${gameFilter === "all" ? "active" : ""}" data-action="set-game-filter" data-value="all">Tous</button><button class="${gameFilter === "included" ? "active" : ""}" data-action="set-game-filter" data-value="included">Inclus avec abonnement</button><button class="${gameFilter === "purchase" ? "active" : ""}" data-action="set-game-filter" data-value="purchase">Achat + abonnement</button></div>
        <span class="result-count">${packs.length} résultat${packs.length > 1 ? "s" : ""}</span>
      </section>
      <section class="games-tile-grid">
        ${packs.map((pack) => `
          <article class="game-gallery-tile ${selected.id === pack.id ? "selected" : ""} ${isGameUnlocked(pack) ? "" : "locked"}" data-action="select-game" data-id="${escapeHtml(pack.id)}">
            <div class="game-tile-art" style="background-image:linear-gradient(180deg,transparent,rgba(5,7,13,.25)),url('${escapeHtml(gameArtwork(pack))}')"></div>
            <span class="tile-status ${isGameUnlocked(pack) ? "unlocked" : "locked"}">${isGameUnlocked(pack) ? "✓ " : "🔒 "}${escapeHtml(gameAccessLabel(pack))}</span>
            <div class="tile-caption"><span>${escapeHtml(pack.source || pack.connector.type)}</span><h3>${escapeHtml(pack.name)}</h3><small>${pack.effects.length} interactions · ${escapeHtml(gamePrice(pack))}</small></div>
            <button class="tile-action-button" data-action="select-game" data-id="${escapeHtml(pack.id)}">Ouvrir</button>
          </article>`).join("")}
      </section>
      ${packs.length ? "" : emptyInline("Aucun jeu ne correspond à ces filtres.")}
      <section class="studio-panel game-detail panel-violet">
        <header class="game-detail-heading">
          <img src="${escapeHtml(gameArtwork(selected))}" alt="">
          <div><span>${escapeHtml(selected.publisher)} · ${escapeHtml(selected.version)}</span><h2>${escapeHtml(selected.name)}</h2><p>${escapeHtml(selected.description)}</p><div class="entity-meta">${(selected.tags || []).map((tag) => `<span class="badge">${escapeHtml(tag)}</span>`).join("")}<span class="badge cyan">${escapeHtml(selected.connector.type)}</span><span class="badge ${selectedUnlocked ? "success" : ""}">${escapeHtml(gameAccessLabel(selected))}</span></div></div>
          <div>${selectedUnlocked ? `<button class="button" data-action="configure-game" data-id="${escapeHtml(selected.id)}">Configurer</button><button class="button primary" data-action="test-game" data-id="${escapeHtml(selected.id)}">Tester la passerelle</button>` : `<button class="button primary" data-navigate="membership">Voir les accès</button><button class="button" data-action="open-url" data-value="https://shenpulse.leuridan.fr">Gérer sur le web</button>`}</div>
        </header>
        <div class="effect-grid game-effects-grid">${selected.effects.map((effect) => `<article class="effect-card ${effect.available === false ? "effect-unavailable" : ""}">${effect.image ? `<img class="effect-image" src="${escapeHtml(effect.image)}" alt="">` : `<span class="effect-icon">${escapeHtml(effect.icon || "◇")}</span>`}<div><h4>${escapeHtml(effect.name)}</h4><p>${escapeHtml(effect.description)}</p><small>${escapeHtml(effect.category || "Effet")} · ${effect.available === false ? "RÉFÉRENCE" : "NATIF"}</small></div><button class="button small" data-action="trigger-effect" data-id="${escapeHtml(effect.id)}" ${selectedUnlocked && effect.available !== false ? "" : "disabled"}>${effect.available === false ? "Non exécutable" : "Déclencher"}</button></article>`).join("")}</div>
      </section>
    </div>`;
}

function renderGamesV2() {
  const availablePacks = visibleGamePacks();
  if (!["all", "included", "purchase"].includes(gameFilter)) {
    gameFilter = "all";
  }
  if (gamePageMode === "detail") {
    const selected = (snapshot?.packs || []).find(
      (pack) => pack.id === selectedGameId && canAccessGame(pack)
    );
    if (selected && isGameUnlocked(selected)) {
      return renderGameWorkspace(selected);
    }
    gamePageMode = "catalog";
  }
  const query = gameSearch.trim().toLocaleLowerCase();
  const packs = availablePacks.filter((pack) => {
    const effects = (pack.effects || []).map((effect) => effect.name).join(" ");
    const matchesSearch =
      !query ||
      `${pack.name} ${pack.description} ${(pack.tags || []).join(" ")} ${effects}`
        .toLocaleLowerCase()
        .includes(query);
    const matchesFilter =
      gameFilter === "all" || gameAccessGroup(pack) === gameFilter;
    return matchesSearch && matchesFilter;
  });
  return `
    <div class="reference-page games-gallery-page">
      <section class="page-hero compact games-heading">
        <div><span class="hero-chip">JEUX INTERACTIFS</span><h2>Galerie des jeux</h2><p>Parcourez tous les jeux disponibles. Un abonnement ShenPulse actif est requis pour entrer dans un jeu.</p></div>
        <span class="hero-count">${availablePacks.length}</span>
      </section>
      ${hasProAccess() ? "" : `<section class="game-access-warning game-catalog-access-warning"><span aria-hidden="true">🔒</span><div><strong>Le catalogue reste accessible</strong><p>Vous pouvez consulter tous les jeux. Activez un abonnement Pro ou Premium pour ouvrir un jeu, l’installer, le configurer et lancer ses interactions.</p></div><button class="button primary" data-navigate="membership">Voir les abonnements</button></section>`}
      <section class="catalog-toolbar games-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="games" type="search" value="${escapeHtml(gameSearch)}" placeholder="Rechercher un jeu, un connecteur ou un effet"></label>
        <div class="filter-pills"><button class="${gameFilter === "all" ? "active" : ""}" data-action="set-game-filter" data-value="all">Tous</button><button class="${gameFilter === "included" ? "active" : ""}" data-action="set-game-filter" data-value="included">Inclus avec abonnement</button><button class="${gameFilter === "purchase" ? "active" : ""}" data-action="set-game-filter" data-value="purchase">Achat + abonnement</button></div>
        <span class="result-count">${packs.length} résultat${packs.length > 1 ? "s" : ""}</span>
      </section>
      <section class="games-tile-grid">
        ${packs.map((pack) => `
          <article class="game-gallery-tile ${isGameUnlocked(pack) ? "" : "locked"}" data-action="open-game" data-id="${escapeHtml(pack.id)}" tabindex="0">
            <div class="game-tile-art" style="background-image:linear-gradient(180deg,transparent,rgba(5,7,13,.25)),url('${escapeHtml(gameArtwork(pack))}')"></div>
            <span class="tile-status ${isGameUnlocked(pack) ? "unlocked" : "locked"}">${isGameUnlocked(pack) ? "✓ " : "🔒 "}${escapeHtml(gameAccessLabel(pack))}</span>
            <div class="tile-caption"><span>${escapeHtml(pack.source || pack.connector.type)}</span><h3>${escapeHtml(pack.name)}</h3><small>${pack.modeSelector ? `${pack.modes.length} modes · ${pack.effects.length} interactions` : `${pack.effects.length} interactions · ${gamePrice(pack)}`}</small></div>
            <button class="tile-action-button" type="button" data-action="open-game" data-id="${escapeHtml(pack.id)}">${escapeHtml(gameTileActionLabel(pack))}</button>
          </article>`).join("")}
      </section>
      ${packs.length ? "" : emptyInline("Aucun jeu ne correspond à ces filtres.")}
    </div>`;
}

function openMinecraftModeSelector(launcher) {
  const modes = launcher?.modes || [];
  if (!modes.length) {
    return toast(
      "Minecraft indisponible",
      "Aucun mode Minecraft n’est actuellement visible.",
      true
    );
  }
  openEditor({
    title: "Choisir un mode Minecraft",
    kicker: "MINECRAFT · BEDROCK BOX OU SANDBOX",
    variant: "minecraft-modes",
    body: `<div class="minecraft-mode-picker">
      <header>
        <span>2 EXPÉRIENCES COMPLÈTES</span>
        <h3>Dans quel mode voulez-vous jouer ?</h3>
        <p>Chaque mode conserve sa propre installation, ses réglages et son catalogue d’interactions TikTok LIVE.</p>
      </header>
      <div class="minecraft-mode-grid">
        ${modes.map((mode) => `
          <button type="button" class="minecraft-mode-card" data-action="open-minecraft-mode" data-id="${escapeHtml(mode.id)}">
            <img src="${escapeHtml(gameArtwork(mode))}" alt="" loading="eager">
            <span>
              <small>${escapeHtml(mode.id === "minecraft-bedrock-box" ? "SURVIE VERTICALE" : "PLATEFORME DE SABLE")}</small>
              <strong>${escapeHtml(mode.name)}</strong>
              <b>${mode.effects.length} interactions récupérées</b>
              <em>Ouvrir ce mode →</em>
            </span>
          </button>`).join("")}
      </div>
    </div>`,
    onSubmit: null
  });
}

async function enterGameWorkspace(pack) {
  selectedGameId = pack.id;
  gamePageMode = "detail";
  gameWorkspaceStep = "installation";
  gameEffectSearch = "";
  gameEffectCategory = "all";
  await api.selectGame(pack.id);
  snapshot = await api.getSnapshot();
  await restoreActiveGameInstallProgress(pack.id, {
    renderWhenFound: false
  });
  render();
  content.scrollTop = 0;
}

function renderGameWorkspace(pack) {
  const unlocked = isGameUnlocked(pack);
  const guide = pack.guide || {};
  const mappedEffects = gameMappedEffects(pack);
  const steps = gameJourneyFor(pack);
  if (!steps.some((step) => step.id === gameWorkspaceStep)) {
    gameWorkspaceStep = steps[0]?.id || "installation";
  }
  return `<div class="reference-page game-workspace-page">
    <button class="game-back-button" data-action="close-game"><span>←</span> Retour à la galerie</button>
    <section class="game-workspace-hero">
      <img src="${escapeHtml(gameArtwork(pack))}" alt="">
      <div>
        <span>PARCOURS SHENPULSE</span>
        <h2>${escapeHtml(pack.name)}</h2>
        <p>${escapeHtml(guide.summary || pack.description)}</p>
        <div class="entity-meta">
          <span class="badge ${unlocked ? "success" : ""}">${escapeHtml(gameAccessLabel(pack))}</span>
          <span class="badge cyan">Configuration guidée</span>
        </div>
      </div>
      <div class="game-hero-stats">
        <span><strong>${pack.effects.length}</strong><small>interactions</small></span>
        <span><strong>${mappedEffects.length}</strong><small>configurées</small></span>
      </div>
    </section>
    ${unlocked ? "" : `<section class="game-access-warning"><span aria-hidden="true">🔒</span><div><strong>Accès requis pour exécuter ce jeu</strong><p>${escapeHtml(gameAccessReason(pack))}</p></div><button class="button primary" data-navigate="membership">Voir les accès</button></section>`}
    <nav class="game-journey-tabs" aria-label="Parcours de configuration">
      ${steps.map((step, index) => `<button class="${gameWorkspaceStep === step.id ? "active" : ""}" data-action="game-step" data-value="${step.id}">
        <b>${step.icon}</b><span><small>ÉTAPE ${index + 1}</small><strong>${step.label}</strong></span>
      </button>`).join("")}
    </nav>
    <section class="game-workspace-content">${renderGameWorkspaceStep(pack, unlocked)}</section>
    ${renderGameLaunchProgressModal(pack)}
  </div>`;
}

function gameJourneyFor(pack) {
  const requested = Array.isArray(pack.guide?.journey)
    ? pack.guide.journey
    : [];
  const known = new Map(DEFAULT_GAME_JOURNEY.map((step) => [step.id, step]));
  const custom = requested
    .map((entry) => {
      const id = typeof entry === "string" ? entry : entry?.id;
      if (!known.has(id)) return null;
      return {
        ...known.get(id),
        ...(typeof entry === "object" ? entry : {})
      };
    })
    .filter(Boolean);
  const journey = custom.length ? custom : DEFAULT_GAME_JOURNEY;
  if (!CONFIGURABLE_INTEGRATED_GAMES.has(pack.id)) return journey;
  if (pack.id === "coin-pusher") {
    return journey
      .filter((step) => step.id !== "overlays")
      .map((step) =>
        step.id === "installation"
          ? { ...step, label: "Réglages", icon: "⚙" }
          : step
      );
  }
  return journey
    .filter((step) => step.id === "installation" || step.id === "launch")
    .map((step) =>
      step.id === "installation"
        ? { ...step, label: "Réglages", icon: "⚙" }
        : step
    );
}

function renderGameWorkspaceStep(pack, unlocked) {
  if (gameWorkspaceStep === "interactions") {
    return renderGameInteractions(pack, unlocked);
  }
  if (gameWorkspaceStep === "overlays") {
    return renderGameOverlays(pack, unlocked);
  }
  if (gameWorkspaceStep === "launch") {
    return renderGameLaunch(pack, unlocked);
  }
  return renderGameInstallation(pack, unlocked);
}
