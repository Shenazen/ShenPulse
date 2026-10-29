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
  return ShenPulseProAccess.commerceExpiryMs(entry);
}

function hasProAccess() {
  return ShenPulseProAccess.hasProAccess(snapshot?.state);
}

function hasActivePaidPremium() {
  const subscription = currentSubscription();
  return (
    subscription.tier === "premium" &&
    ["active", "paid"].includes(String(subscription.status || "")) &&
    subscription.source !== "trial"
  );
}

function productEntitlement(productId) {
  const id = String(productId || "").trim();
  if (!id) return null;
  return (snapshot.state.commerce?.gameEntitlements || []).find((entry) => {
    if (typeof entry === "string") return entry === id;
    if (!entry) return false;
    const entryId = String(
      entry.productId || entry.gameId || entry.id || ""
    ).trim();
    if (entryId !== id) return false;
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
  }) || null;
}

function hasProductEntitlement(productId) {
  return Boolean(productEntitlement(productId));
}

function gameEntitlement(pack) {
  if (pack.accessMode === "included") {
    return { gameId: pack.id, source: "included", status: "active" };
  }
  return productEntitlement(pack.id);
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

// Library covers are independent from the artwork used for gameplay previews.
function gameTileArtwork(pack) {
  const cover = pack.coverArtwork ? `assets/games/${pack.coverArtwork}` : gameArtwork(pack);
  const className = pack.coverArtwork ? "game-tile-art game-tile-cover" : "game-tile-art";
  return `<div class="${className}" style="background-image:linear-gradient(180deg,transparent,rgba(5,7,13,.25)),url('${escapeHtml(cover)}')"></div>`;
}

const SHENPULSE_PLATFORM_GAME_IDS = new Set([
  "shenfarm","shenpaint","shenkite","splash-bombes",
  "thiercelieux",
  "coin-pusher",
  "connect-four",
  "clash-of-live",
  "color-strike",
  "tiklive-climb",
  "tiklive-cube-wars",
  "tiklive-stack-tower",
  "deal-or-no-deal",
  "diamond-bridge",
  "diamond-drop"
]);

const GAME_PLATFORM_OVERRIDES = Object.freeze({
  fortnite: ["epic-games"],
  "rocket-league": ["epic-games", "steam"],
  "gtav-montchiliad": ["rockstar-games", "steam", "epic-games"],
  "gtav-koth-enhanced": ["rockstar-games", "steam", "epic-games"],
  "gtav-hiking-enhanced": ["rockstar-games", "steam", "epic-games"],
  "pokemon-red-blue": ["nintendo"],
  "super-mario-kart": ["nintendo"]
});

const GAME_PLATFORM_LABELS = Object.freeze({
  "game-pass": "Game Pass",
  "epic-games": "Epic Games",
  "microsoft-store": "Microsoft Store",
  nintendo: "Nintendo",
  "rockstar-games": "Rockstar Games",
  shenpulse: "ShenPulse",
  steam: "Steam"
});

const GAME_PASS_BADGE_GAME_IDS = new Set(["ark-survival-ascended", "balatro", "blue-prince"]);

function gamePlatformIds(pack, settings = typeof siteVisibility === "undefined" ? null : siteVisibility) {
  const selected = typeof visibilityTools === "undefined" ? undefined : visibilityTools.gamePlatformsFor(settings, pack?.id);
  if (selected !== undefined) return selected;
  // La jaquette Minecraft regroupe uniquement les logos de ses modes visibles.
  if (pack?.modeSelector && pack.modes?.length) {
    return [...new Set(pack.modes.flatMap(mode => gamePlatformIds(mode, settings)))];
  }
  const configured = Array.isArray(pack?.storefronts)
    ? pack.storefronts.filter((id) => id !== "game-pass" && GAME_PLATFORM_LABELS[id])
    : [];
  let platforms = configured;
  if (!platforms.length && (
    pack?.modeSelector ||
    pack?.id === "minecraft" ||
    String(pack?.id || "").startsWith("minecraft-")
  )) platforms = ["microsoft-store"];
  if (!platforms.length) platforms = SHENPULSE_PLATFORM_GAME_IDS.has(pack?.id) ? ["shenpulse"] : GAME_PLATFORM_OVERRIDES[pack?.id] || ["steam"];
  const showGamePass = GAME_PASS_BADGE_GAME_IDS.has(pack?.id) && ShenPulseGamePassCatalog.offerFor(pack);
  return [...new Set([...platforms, ...(showGamePass ? ["game-pass"] : [])])];
}

function gamePlatformIcon(platformId) {
  if (platformId === "game-pass") {
    return `<svg viewBox="0 0 86 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#107c10"/><path d="M7 5.5c3.5.5 6.7 2.6 9 4.6 2.3-2 5.5-4.1 9-4.6-2.5 2.2-4.5 4.7-6.4 7.3 4.4 5.1 7.5 10 7.9 13.2-3.4-4.5-7-8.5-10.5-11.2C12.5 17.5 8.9 21.5 5.5 26c.4-3.2 3.5-8.1 7.9-13.2C11.5 10.2 9.5 7.7 7 5.5Z" fill="#fff"/><g fill="#fff" font-family="Arial, sans-serif" font-size="13" font-weight="800"><text x="36" y="14">GAME</text><text x="36" y="28">PASS</text></g></svg>`;
  }
  if (platformId === "shenpulse") {
    return '<img src="assets/brand/shenpulse-512.png" alt="">';
  }
  if (platformId === "steam") {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#1b75bb"/><path d="M2.1 20.7A15 15 0 0 0 29.7 9.9 21 21 0 0 1 2.1 20.7Z" fill="#0b4a8b"/><path d="m9.4 23.4 8.3-6.5" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="4"/><circle cx="21.6" cy="12" r="6.1" fill="#fff"/><circle cx="21.6" cy="12" r="3.5" fill="#1b75bb"/><circle cx="9.4" cy="23.4" r="4.7" fill="#fff"/><circle cx="9.4" cy="23.4" r="2.4" fill="#1b75bb"/></svg>`;
  }
  if (platformId === "epic-games") {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 3h22l-2 23-9 3-9-3Z"/><path class="platform-cutout" d="M10 8h12v3h-8v2h7v3h-7v3h8v3H10Zm5 14h3v3h-3Z"/></svg>`;
  }
  if (platformId === "rockstar-games") {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="4" y="4" width="24" height="24" rx="5"/><path class="platform-cutout" d="M10 9h7.2c3.2 0 5 1.6 5 4.3 0 2-1 3.4-2.8 4l3.6 5.7h-4.6l-3-5h-1.3v5H10Zm4.1 3.2v2.7h2.5c1 0 1.6-.5 1.6-1.4 0-.8-.6-1.3-1.6-1.3Z"/><path d="m23.5 18 1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3Z"/></svg>`;
  }
  if (platformId === "microsoft-store") {
    return `<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 5.5 14.5 4v10.5H4Zm12.5-1.8L28 2v12.5H16.5ZM4 16.5h10.5V27L4 25.5Zm12.5 0H28V30l-11.5-1.7Z"/></svg>`;
  }
  return `<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="3" y="7" width="26" height="18" rx="9" fill="none" stroke="currentColor" stroke-width="3"/><path d="M11 20V12l5 8v-8h5v8" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4"/></svg>`;
}

function gamePlatformLogos(pack, settings = typeof siteVisibility === "undefined" ? null : siteVisibility) {
  const platformIds = gamePlatformIds(pack, settings);
  if (!platformIds.length) return "";
  const labelFor = id => id === "game-pass" ? (ShenPulseGamePassCatalog.offerFor(pack)?.kind === "benefits" ? "Avantages Game Pass Ultimate" : "PC Game Pass") : GAME_PLATFORM_LABELS[id];
  const labels = platformIds.map(labelFor);
  return `<div class="tile-platforms" aria-label="Disponible sur ${escapeHtml(labels.join(", "))}">${platformIds.map((id) => `<span class="tile-platform-logo platform-${escapeHtml(id)}" title="${escapeHtml(labelFor(id))}">${gamePlatformIcon(id)}</span>`).join("")}</div>`;
}

const GAME_CATALOG_PLATFORM_EXPLANATIONS = Object.freeze({
  shenpulse: "Jeu et interactions accessibles avec Pro · achat supplémentaire si indiqué.",
  steam: "Jeu à télécharger sur Steam · accès Pro requis pour les interactions.",
  "game-pass": "Jeux PC et avantages selon votre formule Microsoft · abonnement distinct de ShenPulse Pro, version compatible requise pour les interactions.",
  "epic-games": "Jeu à télécharger sur Epic Games · accès Pro requis pour les interactions.",
  "rockstar-games": "Jeu à télécharger via Rockstar Games · accès Pro requis pour les interactions.",
  "microsoft-store": "Jeu à télécharger sur Microsoft Store · accès Pro requis pour les interactions.",
  nintendo: "Jeu Nintendo original requis · accès Pro requis pour les interactions."
});

function gameCatalogPlatformLegend(packs) {
  const availablePlatformIds = new Set(
    packs.flatMap((pack) => gamePlatformIds(pack))
  );
  const platformIds = Object.keys(GAME_CATALOG_PLATFORM_EXPLANATIONS).filter(
    (id) => availablePlatformIds.has(id)
  );
  return `
    <ul class="game-platform-legend" aria-label="Comment obtenir les jeux et leurs interactions">
      ${platformIds.map((id) => `
        <li class="game-platform-legend-item">
          <span class="game-platform-legend-icon platform-${escapeHtml(id)}" aria-hidden="true">${gamePlatformIcon(id)}</span>
          <span><strong>${escapeHtml(GAME_PLATFORM_LABELS[id])}</strong><small>${escapeHtml(GAME_CATALOG_PLATFORM_EXPLANATIONS[id])}</small></span>
        </li>`).join("")}
    </ul>`;
}

function gamePrice(pack) {
  if (pack.accessMode === "included") return "Inclus avec Pro";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: pack.currency || "EUR"
  }).format(Number(pack.price || 0));
}

/** Prix du même catalogue que le dialogue d'achat, sans changer les droits.
 * Un jeu déjà acquis ou en essai n'est jamais présenté comme à racheter. */
function gameTileCaption(pack) {
  const purchaseRequired = pack.accessMode === "purchase" && !hasGameEntitlement(pack);
  return `<div class="tile-caption"><h3>${escapeHtml(pack.name)}</h3><div class="tile-details">${gamePlatformLogos(pack)}${purchaseRequired ? `<span class="tile-purchase-price"><strong>${escapeHtml(gamePrice(pack))}</strong><small>Achat unique</small></span>` : ""}</div></div>`;
}

function gameTileActionLabel(pack) {
  if (isGameUnlocked(pack)) {
    return pack.modeSelector ? "Choisir le mode" : "Entrer dans le jeu";
  }
  if (!hasProAccess()) return "Voir l’abonnement";
  if (pack.accessMode === "purchase" && !hasGameEntitlement(pack)) {
    return "Acheter le jeu";
  }
  return "Voir l’abonnement";
}

function gameAccessLabel(pack) {
  if (!hasProAccess()) return "ACCÈS PRO REQUIS";
  if (!hasGameEntitlement(pack)) return "ACHAT REQUIS";
  const entitlement = gameEntitlement(pack);
  if (
    entitlement?.source === "trial" ||
    entitlement?.status === "trial"
  ) {
    return "ESSAI ACTIF";
  }
  return pack.accessMode === "included"
    ? "INCLUS AVEC PRO"
    : "ACHETÉ";
}

function gameAccessReason(pack) {
  const missingGame = !hasGameEntitlement(pack);
  const missingSubscription = !hasProAccess();
  if (missingGame && missingSubscription) {
    return "Un abonnement ShenPulse Pro ou Premium actif et le droit d’accès à ce jeu (achat ou essai) sont requis.";
  }
  if (missingGame) {
    return "Votre accès Pro est actif. Achetez ce jeu ou activez un essai produit pour y accéder.";
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
            <li><span>✓</span><div><strong>${hasProAccess() ? "Accès Pro actif" : "Accès Pro requis pour jouer"}</strong><small>${escapeHtml(subscriptionMessage)}</small></div></li>
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

function openThiercelieuxExtensionPurchaseDialog(pack, extension) {
  const price = gamePrice({
    ...extension,
    accessMode: "purchase"
  });
  const includes = (extension.includes || [])
    .map((item) => `<li><span>✓</span><div><strong>${escapeHtml(item)}</strong><small>Débloqué définitivement dans la régie du village.</small></div></li>`)
    .join("");
  openEditor({
    title: `Acheter ${extension.name}`,
    kicker: "EXTENSION · ACHAT UNIQUE · PAIEMENT PAYPAL",
    variant: "game-purchase",
    submitLabel: `Acheter pour ${price}`,
    pendingLabel: "Ouverture de PayPal…",
    successMessage: "",
    body: `
      <div class="game-purchase-dialog thiercelieux-extension-purchase">
        <div class="game-purchase-visual">
          <img src="${escapeHtml(thiercelieuxExtensionArtwork(extension.packId))}" alt="${escapeHtml(extension.name)}">
          <div>
            <small>EXTENSION THIERCELIEUX</small>
            <strong>${escapeHtml(extension.name)}</strong>
          </div>
        </div>
        <div class="game-purchase-copy">
          <span class="game-purchase-badge">ACHAT UNIQUE</span>
          <h3>Débloquez toute l’extension</h3>
          <p>${escapeHtml(extension.description || "Nouveaux contenus pour vos parties de Thiercelieux.")}</p>
          <div class="game-purchase-price">
            <span>Prix de l’extension</span>
            <strong>${escapeHtml(price)}</strong>
            <small>Paiement unique, conservé sur votre compte ShenPulse</small>
          </div>
          <ul class="game-purchase-facts">
            ${includes}
            <li><span>✓</span><div><strong>Paiement sécurisé par PayPal</strong><small>Les contenus apparaissent automatiquement après validation.</small></div></li>
          </ul>
        </div>
      </div>`,
    onSubmit: async () => {
      const response = await api.account.startGameCheckout({
        productId: extension.id
      });
      const result = response?.result || response;
      if (response?.snapshot) {
        acceptSnapshot(response.snapshot);
        currentPage = "games";
      }
      if (result?.alreadyPurchased || result?.checkoutCompleted) {
        const current = integratedGameSettings("thiercelieux");
        snapshot = await api.configureGame("thiercelieux", {
          ...current,
          packs: [
            ...new Set([
              "base",
              ...(current.packs || []),
              extension.packId
            ])
          ]
        });
        integratedSettingsPanels.set("thiercelieux", "extensions");
      }
      if (result?.cancelled) {
        toast(
          "Achat annulé",
          `Aucun paiement n’a été enregistré pour ${extension.name}.`
        );
      } else if (result?.alreadyPurchased) {
        toast(
          "Extension déjà achetée",
          `${extension.name} est déjà débloquée sur votre compte ShenPulse.`
        );
      } else if (result?.checkoutCompleted) {
        toast(
          "Extension débloquée",
          `Tout le contenu de ${extension.name} est maintenant disponible.`
        );
      } else {
        throw new Error(
          "L’achat n’a pas pu être confirmé. Aucun contenu n’a été débloqué."
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
            ${gameTileArtwork(pack)}
            <span class="tile-status ${isGameUnlocked(pack) ? "unlocked" : "locked"}">${isGameUnlocked(pack) ? "✓ " : "🔒 "}${escapeHtml(gameAccessLabel(pack))}</span>
            ${gameTileCaption(pack)}
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
  if (!ShenPulseGameCategories.categories.some((category) => category.id === gameCategory)) gameCategory = "all";
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
  const matchingPacks = availablePacks.filter((pack) => {
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
  const packs = matchingPacks.flatMap((pack) => {
    if (pack.modeSelector && Array.isArray(pack.modes)) {
      const modes = pack.modes.filter((mode) => ShenPulseGameCategories.matchesCategory(mode, gameCategory));
      return modes.length ? [gameModeLauncherPack(modes,pack.id)] : [];
    }
    return ShenPulseGameCategories.matchesCategory(pack, gameCategory) ? [pack] : [];
  });
  const resultCount = ShenPulseGameCategories.countGames(packs);
  return `
    <div class="reference-page games-gallery-page">
      ${renderStudioHero("games", "Jeux vidéo compatibles", "Vos spectateurs agissent dans votre jeu avec Pro ou Premium. Jeu original et pack adapté nécessaires ; achat supplémentaire si indiqué.")}
      <div class="games-heading-content">${gameCatalogPlatformLegend(availablePacks)}</div>
      ${hasProAccess() ? "" : `<section class="game-access-warning game-catalog-access-warning"><span aria-hidden="true">◇</span><div><strong>Jeux vidéo : accès Pro requis</strong><p>Un accès Pro ou Premium actif est nécessaire, y compris pour les packs déjà achetés. Le jeu original et son pack compatible restent requis ; les modules vendus séparément exigent aussi leur achat ou un essai produit actif.</p></div><button class="button small primary" type="button" data-navigate="membership">Découvrir Pro</button></section>`}
      <section class="catalog-toolbar games-toolbar">
        <label class="search-control"><span>⌕</span><input data-search="games" type="search" value="${escapeHtml(gameSearch)}" placeholder="Rechercher un jeu, un connecteur ou un effet"></label>
        <label class="game-access-filter"><span>Accès</span><select data-game-access-filter aria-label="Filtrer les jeux par accès">${[["all", "Tous les accès"], ["included", "Inclus avec Pro"], ["purchase", "Achat + accès Pro"]].map(([value, label]) => `<option value="${value}" ${gameFilter === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        <span class="result-count" aria-live="polite">${resultCount} jeu${resultCount > 1 ? "x" : ""} / mode${resultCount > 1 ? "s" : ""}</span>
        ${renderGameCategoryFilters(matchingPacks)}
      </section>
      <section class="games-tile-grid">
        ${packs.map((pack) => `
          <article class="game-gallery-tile ${isGameUnlocked(pack) ? "" : "locked"}" data-action="open-game" data-id="${escapeHtml(pack.id)}" tabindex="0">
            ${gameTileArtwork(pack)}
            <span class="tile-status ${isGameUnlocked(pack) ? "unlocked" : "locked"}">${isGameUnlocked(pack) ? "✓ " : "🔒 "}${escapeHtml(gameAccessLabel(pack))}</span>
            ${gameTileCaption(pack)}
            <button class="tile-action-button" type="button" data-action="open-game" data-id="${escapeHtml(pack.id)}">${escapeHtml(gameTileActionLabel(pack))}</button>
          </article>`).join("")}
      </section>
      ${packs.length ? "" : emptyInline("Aucun jeu ne correspond à ces filtres.")}
    </div>`;
}

function openMinecraftModeSelector(launcher) {
  const gta=launcher.id===GTA_LAUNCHER_ID;
  const modes = launcher?.modes || [];
  if (!modes.length) {
    return toast(
      gta ? "GTA indisponible" : "Minecraft indisponible",
      gta ? "Aucun mod GTA n’est actuellement visible." : "Aucun mode Minecraft n’est actuellement visible.",
      true
    );
  }
  openEditor({
    title: gta ? "Choisir un mod GTA Enhanced/Amélioré" : "Choisir un mode Minecraft",
    kicker: gta ? "GTA ENHANCED · CHILIAD, KOTH OU HIKING" : "MINECRAFT · CHOISISSEZ VOTRE MODE",
    variant: "minecraft-modes",
    body: `<div class="minecraft-mode-picker">
      <header>
        <span>${modes.length} EXPÉRIENCES COMPLÈTES</span>
        <h3>Dans quel mode voulez-vous jouer ?</h3>
        <p>Chaque mode conserve sa propre installation, ses réglages et son catalogue d’interactions TikTok LIVE.</p>
      </header>
      <div class="minecraft-mode-grid">
        ${modes.map((mode) => `
          <button type="button" class="minecraft-mode-card ${mode.coverArtwork ? "has-cover" : ""}" data-action="open-game-mode" data-id="${escapeHtml(mode.id)}">
            <div class="minecraft-mode-art"><img src="${escapeHtml(mode.coverArtwork ? `assets/games/${mode.coverArtwork}` : gameArtwork(mode))}" alt="" loading="eager">${!gta && mode.minecraftVersion ? `<b class="minecraft-mode-version">Minecraft Java ${escapeHtml(mode.minecraftVersion)}</b>` : ""}</div>
            <span>
              <small>${escapeHtml(
                gta ? (mode.id === "gtav-koth-enhanced" ? "RAMPE INTERACTIVE" : mode.id === "gtav-hiking-enhanced" ? "RANDONNÉE INTERACTIVE" : "ASCENSION INTERACTIVE") : mode.id === "minecraft-lavarise" ? "ASCENSION DE LAVE" : mode.id === "minecraft-bedrock-box"
                  ? "SURVIE VERTICALE"
                  : mode.id === "minecraft-survival-plugin"
                    ? "SURVIE INTERACTIVE"
                    : "PLATEFORME DE SABLE"
              )}</small>
              <strong>${escapeHtml(mode.name)}</strong>
              <b>${mode.effects.length} interactions disponibles</b>
              <em>Ouvrir ce mode →</em>
            </span>
          </button>`).join("")}
      </div>
    </div>`,
    onSubmit: null
  });
}

// Page data is already available in the renderer. Only migrations and the
// selected game's installation status need to be reconciled after first paint.
let gameWorkspaceEntry = null;
function gameWorkspaceScope(value = snapshot) {
  return JSON.stringify([value?.state?.settings?.account?.uid || '', value?.state?.session?.profileId || '']);
}
function gameWorkspaceInteractionsReady(pack) {
  return !(gameWorkspaceEntry?.packId === pack.id &&
    gameWorkspaceEntry.scope === gameWorkspaceScope() && gameWorkspaceEntry.initializing);
}
async function enterGameWorkspace(pack) {
  const entry = gameWorkspaceEntry = {
    packId: pack.id, scope: gameWorkspaceScope(),
    initializing: (pack.id === 'supermarket-simulator' || typeof usesSharedGameWorkspace === 'function' && usesSharedGameWorkspace(pack)) &&
      Number(snapshot.state.game.interactionCatalogVersions?.[pack.id] || 0) < Number(pack.interactionCatalogVersion || 0)
  };
  const current = () => gameWorkspaceEntry === entry && gameWorkspaceScope() === entry.scope &&
    currentPage === 'games' && gamePageMode === 'detail' && selectedGameId === pack.id;
  selectedGameId = pack.id;
  gamePageMode = 'detail';
  gameWorkspaceStep = 'installation';
  gameEffectSearch = '';
  gameEffectCategory = 'all';
  render();
  content.scrollTop = 0;
  try {
    const beforeSelection = snapshot;
    const selected = await api.selectGame(pack.id);
    if (!current()) return;
    // The IPC already returns a snapshot; don't request it again or overwrite
    // a more recent state event, edit, account or profile with a late response.
    if (selected?.state && snapshot === beforeSelection && gameWorkspaceScope(selected) === entry.scope) {
      acceptSnapshot(selected);
    }
    if (entry.initializing) {
      const beforeInitialization = snapshot;
      const initialized = await api.initializeGameInteractions(pack.id);
      if (!current()) return;
      if (initialized?.snapshot && snapshot === beforeInitialization && gameWorkspaceScope(initialized.snapshot) === entry.scope) {
        acceptSnapshot(initialized.snapshot);
      }
      entry.initializing = false;
      const scroll = content.scrollTop;
      render();
      content.scrollTop = scroll;
    }
    await restoreActiveGameInstallProgress(pack.id, { shouldApply: current });
  } catch (error) {
    if (!current()) return;
    entry.initializing = false;
    gamePageMode = 'catalog';
    render();
    throw error;
  }
}

function renderGameWorkspace(pack) {
  if (typeof usesSharedGameWorkspace === "function" && usesSharedGameWorkspace(pack)) return renderSupermarketWorkspace(pack);
  if (pack.id === "supermarket-simulator") return renderSupermarketWorkspace(pack);
  if (pack.id === "super-mario-kart") {
    return renderSuperMarioKartWorkspace(pack);
  }
  if (pack.id === "resident-evil-3") {
    return renderResidentEvil3Workspace(pack);
  }
  if (pack.id === "fortnite") {
    return renderFortniteWorkspace(pack);
  }
  if (pack.id === "rocket-league") {
    return renderRocketLeagueWorkspace(pack);
  }
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
          ${renderGameConditionsButton(pack)}
        </div>
      </div>
      <div class="game-hero-stats">
        <span><strong>${pack.effects.length}</strong><small>interactions</small></span>
        <span><strong>${mappedEffects.length}</strong><small>configurées</small></span>
      </div>
      ${renderGameConditionsPanel(pack)}
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
