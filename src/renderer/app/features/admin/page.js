"use strict";

/**
 * Console d'administration et opérations de catalogue.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

const ADMIN_VISIBILITY_SECTIONS = [
  ["navigation", "Pages ShenPulse", "Les 14 pages réellement présentes dans la navigation de ShenPulseNew"],
  ["features", "Fonctionnalités", "Les services réellement disponibles dans l’application"],
  ["actionTypes", "Actions disponibles", "Les actions proposées dans les éditeurs ShenPulseNew"],
  ["overlays", "Overlays", "Les 17 overlays réellement présents dans la galerie"],
  ["games", "Jeux", "Le catalogue actuel de jeux et packs ShenPulseNew"]
];

const ADMIN_OVERLAY_CATEGORY_LABELS = {
  actions: "Actions",
  engagement: "Engagement",
  interactions: "Interactions",
  matches: "Matchs",
  rankings: "Classements",
  utilities: "Utilitaires"
};

function adminVisibilityCatalog() {
  let pageGroup = "ShenPulse";
  const navigationItems = [];
  for (const page of pages) {
    if (page.section) {
      pageGroup = page.section;
      continue;
    }
    if (!page.id || page.id === "admin") continue;
    navigationItems.push({
      id: page.id,
      label: page.label,
      detail: `${page.title} · ${page.kicker}`,
      group: pageGroup,
      icon: page.icon,
      defaultScope: page.defaultScope,
      ownerOnly: page.ownerOnly === true
    });
  }
  return {
    navigation: navigationItems,
    features: visibilityTools.FEATURE_ITEMS.map((item) => ({ ...item })),
    actionTypes: Object.entries(ACTION_TYPE_LABELS).map(([id, label]) => ({
      id,
      label,
      detail: "Action disponible dans les déclencheurs et automatisations",
      icon: "⚡",
      defaultScope: id === "irl.shelly" ? "admin" : "public",
      ownerOnly: id === "irl.shelly"
    })),
    overlays: overlayDefinitions().map((overlay) => ({
      id: overlay.key,
      label: overlay.name,
      detail:
        ADMIN_OVERLAY_CATEGORY_LABELS[overlay.category] ||
        "Overlay ShenPulse",
      icon: "▱"
    })),
    games: (snapshot?.packs || []).map((pack) => ({
      id: pack.id,
      label: pack.name,
      detail: `${pack.category || "Jeu interactif"} · ${
        pack.accessMode === "purchase" ? "achat séparé" : "inclus"
      }`,
      icon: "◇",
      ...(pack.ownerOnly === true
        ? { defaultScope: "admin", ownerOnly: true }
        : {})
    }))
  };
}

function canonicalAdminSiteSettings(settings) {
  const canonical = visibilityTools.canonicalizeVisibility(
    settings,
    adminVisibilityCatalog()
  );
  for (const [section, items] of Object.entries(adminVisibilityCatalog())) {
    for (const item of items) {
      if (!item.ownerOnly) continue;
      canonical[section][adminVisibilityStorageKey(item.id)] = {
        scope: "admin"
      };
    }
  }
  return canonical;
}

function adminVisibilityAudit(settings) {
  return visibilityTools.auditVisibility(
    settings,
    adminVisibilityCatalog()
  );
}

function adminVisibilityMeta(section) {
  return (
    ADMIN_VISIBILITY_SECTIONS.find(([id]) => id === section) ||
    ADMIN_VISIBILITY_SECTIONS[0]
  );
}

function adminVisibilityStorageKey(id) {
  return visibilityTools.storageKey(id);
}

function renderAdmin() {
  if (!isVerifiedAdminSession()) {
    return `<section class="admin-locked">
      <span>♜</span>
      <p class="eyebrow">ACCÈS PROPRIÉTAIRE</p>
      <h2>Administration verrouillée</h2>
      <p>Seul le compte propriétaire ShenPulse peut ouvrir cet espace. L’autorisation est vérifiée côté serveur.</p>
      <button class="button primary" data-action="admin-login">Se connecter</button>
    </section>`;
  }
  if (adminBusy && !adminDashboard) {
    return `<section class="admin-locked"><span class="pulse-loader"></span><h2>Chargement de l’administration…</h2><p>Lecture des réglages, essais et tarifs publiés.</p></section>`;
  }
  if (!adminDashboard) {
    return `<section class="admin-locked"><span>!</span><h2>Données non chargées</h2><p>La session est valide, mais les données distantes doivent être actualisées.</p><button class="button primary" data-action="admin-refresh">Actualiser</button></section>`;
  }

  const workspaces = [
    ["overview", "Tableau de bord", "Synthèse"],
    ["visibility", "Visibilité", "Pages et fonctions"],
    ["game-cheats", "Triche de jeux", "Accès par e-mail"],
    ["trials", "Offres d’essai", "Utilisateurs"],
    ["commerce", "Tarifs & promotions", "PRO / Premium / jeux"]
  ];
  const contentByWorkspace = {
    overview: renderAdminOverview,
    visibility: renderAdminVisibility,
    "game-cheats": renderAdminGameCheats,
    trials: renderAdminTrials,
    commerce: renderAdminCommerce
  };
  return `<div class="admin-page">
    <section class="admin-hero">
      <div>
        <p class="eyebrow">CONSOLE SHENPULSE</p>
        <h2>Pilotage global</h2>
        <p>Les modifications sont enregistrées sur les services ShenPulse et appliquées aux utilisateurs concernés.</p>
      </div>
      <div class="admin-identity">
        <span class="status-dot"></span>
        <div><strong>${escapeHtml(adminSession.email)}</strong><small>Propriétaire vérifié par Firebase</small></div>
        <button class="button small" data-action="admin-refresh" ${adminBusy ? "disabled" : ""}>↻ Actualiser</button>
        <button class="button small ghost" data-action="admin-logout">Déconnexion</button>
      </div>
    </section>
    <nav class="admin-workspaces" aria-label="Rubriques d’administration">
      ${workspaces.map(([id, label, detail]) => `<button class="${adminWorkspace === id ? "active" : ""}" data-action="admin-workspace" data-value="${id}"><strong>${label}</strong><small>${detail}</small></button>`).join("")}
    </nav>
    ${renderAdminModuleWarnings()}
    <section class="admin-content ${adminBusy ? "is-busy" : ""}">
      ${(contentByWorkspace[adminWorkspace] || renderAdminOverview)()}
    </section>
  </div>`;
}

function renderAdminOverview() {
  const settings = canonicalAdminSiteSettings(
    adminDashboard.siteSettings || {}
  );
  const visibilityEntries = ADMIN_VISIBILITY_SECTIONS.flatMap(([section]) =>
    Object.values(settings[section] || {})
  );
  const publicCount = visibilityEntries.filter((entry) => entry.scope === "public").length;
  const adminCount = visibilityEntries.filter((entry) => entry.scope === "admin").length;
  const hiddenCount = visibilityEntries.filter((entry) => entry.scope === "hidden").length;
  const trials = adminTrialRows();
  const catalog = adminCommerceCatalog();
  const products = Object.values(catalog.products || {}).filter(
    isCurrentGameProduct
  );
  const promotions = Object.values(catalog.promotions || {}).filter((item) => item.enabled);
  return `<div class="admin-overview">
    <div class="admin-stat-grid">
      ${adminStat("Éléments publics", publicCount, "Visibles par tous", "cyan")}
      ${adminStat("Réservés admin", adminCount, "Visibles uniquement par toi", "violet")}
      ${adminStat("Éléments masqués", hiddenCount, "Retirés pour les utilisateurs", "pink")}
      ${adminStat("Essais actifs", trials.length, "Abonnements et jeux", "green")}
    </div>
    <div class="admin-overview-grid">
      <section class="admin-panel">
        <header><div><p class="eyebrow">COMMERCE</p><h3>Catalogue publié</h3></div><button class="button small" data-action="admin-workspace" data-value="commerce">Gérer</button></header>
        <div class="admin-summary-list">
          <span><strong>${products.filter((item) => item.enabled).length}</strong><small>offres de jeux actives</small></span>
          <span><strong>${promotions.length}</strong><small>promotions actives</small></span>
          ${Object.values(catalog.subscriptions || {}).map((plan) => `<span><strong>${escapeHtml(plan.priceMonthly)} ${escapeHtml(plan.currency)}</strong><small>${escapeHtml(plan.title)} / mois</small></span>`).join("")}
        </div>
      </section>
      <section class="admin-panel">
        <header><div><p class="eyebrow">ESSAIS</p><h3>Dernières offres accordées</h3></div><button class="button small" data-action="admin-workspace" data-value="trials">Gérer</button></header>
        <div class="admin-trial-mini-list">
          ${trials.length ? trials.slice(0, 5).map((trial) => `<span><b>${escapeHtml(trial.email || trial.beneficiaryEmail || "compte inconnu")}</b><small>jusqu’au ${formatAdminDate(trial.expiresAt, false)}</small></span>`).join("") : `<p>Aucune offre d’essai active.</p>`}
        </div>
      </section>
    </div>
    <section class="admin-security-note">
      <span>✓</span><div><strong>Protection active sur trois niveaux</strong><p>Compte Firebase exact, jeton d’identité vérifié sur le serveur, puis contrôle de l’adresse propriétaire avant chaque écriture. Le mot de passe n’est jamais conservé.</p></div>
    </section>
  </div>`;
}

function renderAdminVisibility() {
  const sourceSettings = adminDashboard.siteSettings || {};
  const catalog = adminVisibilityCatalog();
  const settings = canonicalAdminSiteSettings(sourceSettings);
  const audit = adminVisibilityAudit(sourceSettings);
  const meta = adminVisibilityMeta(adminVisibilitySection);
  const entries = (catalog[adminVisibilitySection] || [])
    .map((item, order) => ({
      ...item,
      order,
      scope: item.ownerOnly
        ? "admin"
        : settings[adminVisibilitySection]?.[
            adminVisibilityStorageKey(item.id)
          ]?.scope || item.defaultScope || "public"
    }))
    .filter((item) => {
      const query = adminVisibilitySearch.trim().toLocaleLowerCase();
      return (
        !query ||
        `${item.id} ${item.label} ${item.detail || ""} ${item.group || ""}`
          .toLocaleLowerCase()
          .includes(query)
      );
    })
    .sort((left, right) =>
      adminVisibilitySection === "navigation"
        ? left.order - right.order
        : left.label.localeCompare(right.label, "fr")
    );
  return `<div class="admin-visibility-page">
    <section class="admin-catalog-sync ${audit.changed ? "needs-sync" : "is-synced"}">
      <span>${audit.changed ? "↻" : "✓"}</span>
      <div>
        <strong>${audit.changed ? "L’inventaire distant utilise encore l’ancien schéma" : "Inventaire synchronisé avec ShenPulseNew"}</strong>
        <p>${audit.total} éléments réels détectés directement dans l’application.${audit.changed ? ` ${audit.missing} identifiants actuels à ajouter et ${audit.obsolete} anciennes entrées à retirer.` : " Aucune page ni fonctionnalité étrangère n’est affichée."}</p>
      </div>
      <button class="button small ${audit.changed ? "primary" : "ghost"}" data-action="admin-visibility-sync" ${!audit.changed || adminBusy ? "disabled" : ""}>
        ${audit.changed ? "Synchroniser maintenant" : "À jour"}
      </button>
    </section>
    <div class="admin-visibility-layout">
    <aside class="admin-section-list">
      <header><strong>Inventaire ShenPulseNew</strong><small>Uniquement les pages et fonctions réellement disponibles</small></header>
      ${ADMIN_VISIBILITY_SECTIONS.map(([id, label]) => {
        const values = catalog[id] || [];
        const hiddenCount = values.filter(
          (entry) =>
            settings[id]?.[adminVisibilityStorageKey(entry.id)]?.scope ===
            "hidden"
        ).length;
        return `<button class="${id === adminVisibilitySection ? "active" : ""}" data-action="admin-visibility-section" data-value="${id}"><span><strong>${label}</strong><small>${values.length} élément${values.length > 1 ? "s" : ""}</small></span>${hiddenCount ? `<b>${hiddenCount}</b>` : ""}</button>`;
      }).join("")}
    </aside>
    <section class="admin-panel admin-visibility-panel">
      <header>
        <div><p class="eyebrow">VISIBILITÉ · ${entries.length} RÉSULTAT${entries.length > 1 ? "S" : ""}</p><h3>${escapeHtml(meta[1])}</h3><p>${escapeHtml(meta[2])}</p></div>
        <label class="catalog-search"><span>⌕</span><input data-search="admin-visibility" value="${escapeHtml(adminVisibilitySearch)}" placeholder="Rechercher un élément…"></label>
      </header>
      <div class="admin-bulk-actions">
        <span>Appliquer à toute la catégorie</span>
        <button class="button small" data-action="admin-visibility-bulk" data-value="public">Public</button>
        <button class="button small" data-action="admin-visibility-bulk" data-value="admin">Moi uniquement</button>
        <button class="button small ghost" data-action="admin-visibility-bulk" data-value="hidden">Masqué</button>
      </div>
      <div class="admin-visibility-list" data-admin-scroll="visibility-${escapeHtml(adminVisibilitySection)}">
        ${entries.length ? entries.map((item) => `<article>
          <span class="admin-item-icon">${escapeHtml(item.icon || adminVisibilityIcon(item.scope))}</span>
          <div class="admin-item-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail || "")}</small><code>${escapeHtml(item.id)}</code></div>
          <select data-action="admin-scope" data-section="${escapeHtml(adminVisibilitySection)}" data-id="${escapeHtml(item.id)}" class="scope-${escapeHtml(item.scope)}" aria-label="Visibilité de ${escapeHtml(item.label)}" ${item.ownerOnly ? "disabled title=\"Accès propriétaire forcé\"" : ""}>
            <option value="public" ${item.scope === "public" ? "selected" : ""}>Visible par tous</option>
            <option value="admin" ${item.scope === "admin" ? "selected" : ""}>Moi uniquement</option>
            <option value="hidden" ${item.scope === "hidden" ? "selected" : ""}>Masqué</option>
          </select>
        </article>`).join("") : `<div class="admin-empty">Aucun élément ne correspond à cette recherche.</div>`}
      </div>
    </section>
    </div>
  </div>`;
}

function adminGameCheatEntries() {
  const entries =
    adminDashboard?.siteSettings?.cheatAccess?.["game-tabs"]?.entries;
  if (!Array.isArray(entries)) return [];
  const seen = new Set();
  return entries
    .map((entry) => String(entry?.email || "").trim().toLowerCase())
    .filter((email) => {
      if (
        !email ||
        email === ADMIN_OWNER_EMAIL ||
        seen.has(email)
      ) {
        return false;
      }
      seen.add(email);
      return true;
    })
    .sort((left, right) => left.localeCompare(right, "fr"));
}

function renderAdminGameCheats() {
  const entries = adminGameCheatEntries();
  return `<div class="admin-game-cheats">
    <section class="admin-cheat-access-hero">
      <span>!</span>
      <div>
        <p class="eyebrow">ACCÈS PRIVÉ AUX JEUX</p>
        <h3>Onglets de triche</h3>
        <p>Seuls le propriétaire et les comptes ShenPulse vérifiés ci-dessous voient les onglets de triche et les suivis privés lorsqu’un jeu en possède. DealOrNoDeal utilise déjà cette autorisation.</p>
      </div>
      <strong>${entries.length + 1}<small>compte${entries.length ? "s" : ""} autorisé${entries.length ? "s" : ""}</small></strong>
    </section>
    <div class="admin-cheat-access-layout">
      <form id="admin-game-cheat-form" class="admin-panel admin-cheat-access-form" autocomplete="off">
        <header>
          <div><p class="eyebrow">AJOUTER UN COMPTE</p><h3>Autoriser une adresse e-mail</h3><p>L’adresse doit être celle du compte Firebase utilisé dans ShenPulse.</p></div>
        </header>
        <label class="field">
          <span>Adresse e-mail du compte</span>
          <input name="email" type="email" maxlength="254" placeholder="utilisateur@exemple.com" required autofocus>
          <small>Les majuscules et espaces sont normalisés automatiquement.</small>
        </label>
        <footer><button class="button primary" type="submit" ${adminBusy ? "disabled" : ""}>＋ Autoriser ce compte</button></footer>
      </form>
      <section class="admin-panel admin-cheat-access-list">
        <header>
          <div><p class="eyebrow">COMPTES AUTORISÉS</p><h3>${entries.length + 1} accès</h3><p>La suppression prend effet à la prochaine vérification du compte, au plus tard sous 30 secondes.</p></div>
        </header>
        <div data-admin-scroll="game-cheat-access">
          <article class="is-owner">
            <span class="admin-cheat-access-avatar">♜</span>
            <div><strong>${escapeHtml(ADMIN_OWNER_EMAIL)}</strong><small>Propriétaire ShenPulse · accès permanent</small></div>
            <b>PROPRIÉTAIRE</b>
          </article>
          ${entries
            .map(
              (email) => `<article>
                <span class="admin-cheat-access-avatar">${escapeHtml(email.slice(0, 1).toUpperCase())}</span>
                <div><strong>${escapeHtml(email)}</strong><small>Compte ShenPulse vérifié</small></div>
                <b>AUTORISÉ</b>
                <button class="button small danger" type="button" data-action="admin-game-cheat-remove" data-email="${escapeHtml(email)}" ${adminBusy ? "disabled" : ""}>Retirer</button>
              </article>`
            )
            .join("")}
        </div>
      </section>
    </div>
    <section class="admin-security-note">
      <span>✓</span><div><strong>La liste en clair reste privée</strong><p>Le logiciel publie uniquement une empreinte non réversible de chaque adresse. À la connexion, Firebase vérifie le compte actif puis ne renvoie que son droit d’accès.</p></div>
    </section>
  </div>`;
}

function renderAdminTrials() {
  const trials = adminTrialRows();
  const trialsBlocked = Boolean(adminModuleError("trials"));
  const eligibleGames = Object.values(adminCommerceCatalog().products || {})
    .filter((item) => isCurrentGameProduct(item) && item.enabled && item.accessMode === "purchase" && item.trialEligible)
    .sort((left, right) => left.title.localeCompare(right.title, "fr"));
  return `<div class="admin-trials-layout">
    <form id="admin-trial-form" class="admin-panel admin-trial-form" autocomplete="off">
      <header><div><p class="eyebrow">NOUVELLE OFFRE</p><h3>Accorder un essai</h3><p>Le bénéficiaire est identifié exclusivement par l’adresse e-mail de son compte ShenPulse.</p></div></header>
      <div class="form-grid">
        <label class="field full"><span>Adresse e-mail du compte bénéficiaire</span><input name="email" type="email" required maxlength="254" placeholder="utilisateur@exemple.fr" autocomplete="email" autocapitalize="none" spellcheck="false"></label>
        <label class="field"><span>Durée</span><input name="days" type="number" min="1" max="365" value="7" required></label>
        <div class="field"><span>Jeux éligibles</span><strong>${eligibleGames.length} disponibles</strong><small>Laisser la sélection vide accorde tous les jeux éligibles.</small></div>
      </div>
      <div class="admin-trial-options">
        <label><input type="checkbox" name="subscription" checked><span><strong>Accès Pro</strong><small>Toutes les fonctions réservées au plan Pro</small></span></label>
        <label><input type="checkbox" name="games"><span><strong>Jeux payants</strong><small>Tout le catalogue éligible ou une sélection</small></span></label>
      </div>
      <label class="field"><span>Jeux précis (facultatif)</span><select name="gameIds" multiple size="6">${eligibleGames.map((game) => `<option value="${escapeHtml(game.id)}">${escapeHtml(game.title)}</option>`).join("")}</select><small>Ctrl + clic pour en choisir plusieurs. Aucun choix = tous.</small></label>
      <footer><button class="button primary" type="submit" ${adminBusy ? "disabled" : ""}>Offrir l’essai</button></footer>
    </form>
    <section class="admin-panel admin-trial-list">
      <header><div><p class="eyebrow">OFFRES ACTIVES</p><h3>${trials.length} essai${trials.length > 1 ? "s" : ""}</h3><p>Modification et révocation immédiates.</p></div><button class="button small" data-action="admin-refresh">↻</button></header>
      <div>
        ${trials.length ? trials.map((trial) => `<article>
          <span class="admin-trial-avatar">@</span>
          <div><strong>${escapeHtml(trial.email || trial.beneficiaryEmail || "Compte inconnu")}</strong><small>${trial.pending ? "En attente de création du compte" : "Compte ShenPulse associé"}</small></div>
          <div class="admin-trial-entitlements">
            ${trial.subscriptionTrial ? `<b>PRO</b>` : ""}
            ${(trial.gameTrialIds || []).length ? `<b>${trial.gameTrialIds.length} jeu${trial.gameTrialIds.length > 1 ? "x" : ""}</b>` : ""}
          </div>
          <time>${formatAdminDate(trial.expiresAt, false)}</time>
          <button class="button small" data-action="admin-trial-edit" data-id="${escapeHtml(trial.id)}" ${trialsBlocked ? "disabled" : ""}>Modifier</button>
          <button class="button small danger" data-action="admin-trial-revoke" data-id="${escapeHtml(trial.id)}" ${trialsBlocked ? "disabled" : ""}>Retirer</button>
        </article>`).join("") : `<div class="admin-empty">Aucune offre d’essai active.</div>`}
      </div>
    </section>
  </div>`;
}

function restoreAdminTrialFormInteractivity({ focusEmail = false } = {}) {
  if (
    adminBusy ||
    currentPage !== "admin" ||
    adminWorkspace !== "trials"
  ) {
    return;
  }
  const restore = () => {
    if (adminBusy) return;
    const form = content.querySelector("#admin-trial-form");
    if (!form) return;
    const adminContent = form.closest(".admin-content");
    [adminContent, form].filter(Boolean).forEach((element) => {
      element.inert = false;
      element.removeAttribute("inert");
      element.removeAttribute("aria-disabled");
    });
    adminContent?.classList.remove("is-busy");
    form
      .querySelectorAll("input, select, textarea, button")
      .forEach((control) => {
        control.disabled = false;
        control.removeAttribute("disabled");
        control.removeAttribute("aria-disabled");
      });
    const emailInput = form.querySelector('input[name="email"]');
    if (emailInput) {
      emailInput.readOnly = false;
      emailInput.removeAttribute("readonly");
      if (focusEmail) {
        emailInput.focus({ preventScroll: true });
      }
    }
  };
  restore();
  requestAnimationFrame(restore);
}

function renderAdminCommerce() {
  const catalog = adminCommerceCatalog();
  const commerceBlocked = Boolean(adminModuleError("commerce"));
  const query = adminCommerceSearch.trim().toLocaleLowerCase();
  const products = Object.values(catalog.products || {})
    .filter((item) => isCurrentGameProduct(item) && (!query || `${item.title} ${item.id}`.toLocaleLowerCase().includes(query)))
    .sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder) || left.title.localeCompare(right.title, "fr"));
  const plans = Object.values(catalog.subscriptions || {}).sort((left, right) => Number(left.sortOrder) - Number(right.sortOrder));
  const promotions = Object.values(catalog.promotions || {}).sort((left, right) => left.title.localeCompare(right.title, "fr"));
  const history = adminDashboard.commerce?.history || [];
  return `<div class="admin-commerce">
    <section class="admin-commerce-toolbar">
      <div><p class="eyebrow">CATALOGUE COMMERCIAL</p><h3>${commerceBlocked ? "Catalogue public · lecture de secours" : "Brouillon synchronisé"}</h3><p>${commerceBlocked ? "La modification commerciale reprendra dès que l’index Firebase sera publié." : "Enregistre les modifications, puis publie-les sur TEST ou PROD."}</p></div>
      <div class="button-row">
        <button class="button" data-action="admin-commerce-publish" data-value="publish-test" ${commerceBlocked ? "disabled" : ""}>Publier TEST</button>
        <button class="button primary" data-action="admin-commerce-publish" data-value="publish-prod" ${commerceBlocked ? "disabled" : ""}>Publier PROD</button>
      </div>
    </section>
    <div class="admin-plan-grid">
      ${plans.map((plan) => `<article class="${plan.enabled ? "" : "disabled"}"><span>${plan.tier === "premium" ? "♛" : "◆"}</span><div><small>ABONNEMENT</small><strong>${escapeHtml(plan.title)}</strong><b>${escapeHtml(plan.priceMonthly)} ${escapeHtml(plan.currency)}<em>/mois</em></b></div><button class="button small" data-action="admin-plan-edit" data-id="${escapeHtml(plan.tier)}" ${commerceBlocked ? "disabled" : ""}>Modifier</button></article>`).join("")}
    </div>
    <section class="admin-panel">
      <header><div><p class="eyebrow">JEUX</p><h3>${products.length} offres</h3></div><label class="catalog-search"><span>⌕</span><input data-search="admin-commerce" value="${escapeHtml(adminCommerceSearch)}" placeholder="Rechercher un jeu…"></label></header>
      <div class="admin-product-list">
        ${products.map((product) => `<article class="${product.enabled ? "" : "disabled"}">
          <div><strong>${escapeHtml(product.title)}</strong><small>${escapeHtml(product.id)}</small></div>
          <span class="badge">${product.accessMode === "included" ? "INCLUS" : "ACHAT"}</span>
          <b>${product.accessMode === "included" ? "0,00 €" : `${escapeHtml(product.baseAmount)} ${escapeHtml(product.currency)}`}</b>
          <small>${product.trialEligible ? "Essai autorisé" : "Sans essai"}</small>
          <button class="button small" data-action="admin-product-edit" data-id="${escapeHtml(product.id)}" ${commerceBlocked ? "disabled" : ""}>Modifier</button>
        </article>`).join("")}
      </div>
    </section>
    <section class="admin-panel">
      <header><div><p class="eyebrow">PROMOTIONS</p><h3>${promotions.length} campagne${promotions.length > 1 ? "s" : ""}</h3></div><button class="button small primary" data-action="admin-promotion-add" ${commerceBlocked ? "disabled" : ""}>＋ Nouvelle promotion</button></header>
      <div class="admin-promotion-list">
        ${promotions.length ? promotions.map((promo) => `<article class="${promo.enabled ? "" : "disabled"}">
          <span>${promo.type === "percent" ? "%" : "€"}</span>
          <div><strong>${escapeHtml(promo.title)}</strong><small>${promo.productIds?.length ? `${promo.productIds.length} jeu(x)` : "Tous les jeux payants"}${promo.endsAt ? ` · fin ${formatAdminDate(promo.endsAt, false)}` : ""}</small></div>
          <b>${promo.type === "percent" ? `−${escapeHtml(promo.value)} %` : `−${escapeHtml(promo.value)} €`}</b>
          <button class="button small" data-action="admin-promotion-edit" data-id="${escapeHtml(promo.id)}" ${commerceBlocked ? "disabled" : ""}>Modifier</button>
          <button class="button small danger" data-action="admin-promotion-delete" data-id="${escapeHtml(promo.id)}" ${commerceBlocked ? "disabled" : ""}>Supprimer</button>
        </article>`).join("") : `<div class="admin-empty">Aucune promotion configurée.</div>`}
      </div>
    </section>
    ${history.length ? `<section class="admin-panel"><header><div><p class="eyebrow">HISTORIQUE</p><h3>Versions restaurables</h3></div></header><div class="admin-history-list">${history.slice(0, 8).map((entry) => `<span><div><strong>${entry.action === "publish-prod" ? "Publication PROD" : entry.action === "publish-test" ? "Publication TEST" : "Brouillon"}</strong><small>${formatAdminDate(entry.savedAt)}</small></div><button class="button small ghost" data-action="admin-commerce-restore" data-id="${escapeHtml(entry.id)}" ${commerceBlocked ? "disabled" : ""}>Restaurer en brouillon</button></span>`).join("")}</div></section>` : ""}
  </div>`;
}

function adminModuleError(moduleName) {
  return adminDashboard?.errors?.[moduleName] || null;
}

function renderAdminModuleWarnings() {
  const entries = Object.entries(adminDashboard?.errors || {}).filter(
    ([moduleName]) =>
      adminWorkspace === "overview" ||
      (adminWorkspace === "commerce" && moduleName === "commerce") ||
      (adminWorkspace === "trials" && moduleName === "trials")
  );
  if (!entries.length) return "";
  return entries
    .map(
      ([moduleName, error]) => `<section class="admin-module-warning">
        <span>!</span>
        <div><strong>${moduleName === "commerce" ? "Commerce en lecture de secours" : "Offres d’essai indisponibles"}</strong><p>${escapeHtml(error?.message || "Ce module est temporairement indisponible.")}</p></div>
        <button class="button small" data-action="admin-refresh">Réessayer</button>
      </section>`
    )
    .join("");
}

function adminStat(label, value, detail, tone) {
  return `<article class="admin-stat tone-${tone}"><span>${escapeHtml(value)}</span><div><strong>${escapeHtml(label)}</strong><small>${escapeHtml(detail)}</small></div></article>`;
}

function adminTrialRows() {
  return Array.isArray(adminDashboard?.trials?.trials)
    ? adminDashboard.trials.trials
    : [];
}

function adminCommerceCatalog() {
  return (
    adminDashboard?.commerce?.catalog || {
      products: {},
      promotions: {},
      subscriptions: {}
    }
  );
}

function isCurrentGameProduct(product) {
  return (snapshot?.packs || []).some((pack) => pack.id === product?.id);
}

function adminItemLabel(id) {
  const knownItem = Object.values(adminVisibilityCatalog())
    .flat()
    .find((item) => item.id === id);
  if (knownItem?.label) return knownItem.label;
  return String(id || "")
    .replace(/[-_.:]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function adminVisibilityIcon(scope) {
  return scope === "hidden" ? "◌" : scope === "admin" ? "♜" : "◉";
}

function formatAdminDate(value, withTime = true) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(date);
}

function cloneAdminData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeAdminMoney(value, minimum = 0) {
  const amount = Number(String(value ?? "").trim().replace(",", "."));
  if (
    !Number.isFinite(amount) ||
    amount < minimum ||
    amount > 100000
  ) {
    throw new Error("Renseignez un prix valide.");
  }
  return amount.toFixed(2);
}

async function refreshAdminDashboard() {
  if (!isVerifiedAdminSession() || adminBusy) return;
  adminBusy = true;
  render();
  try {
    adminDashboard = await api.admin.dashboard();
    adminSession = adminDashboard.status || adminSession;
  } finally {
    adminBusy = false;
    render();
  }
}

async function syncAdminSessionFromAccount() {
  adminSession = await api.admin.status().catch(() => ({
    authorized: false,
    email: "",
    uid: "",
    lastAuthenticatedAt: ""
  }));
  if (!isVerifiedAdminSession()) {
    adminDashboard = null;
    ensureCurrentPageAccess();
    return;
  }
  try {
    adminDashboard = await api.admin.dashboard();
    adminSession = adminDashboard.status || adminSession;
  } catch (error) {
    console.warn(
      "Synchronisation de l’administration différée :",
      error?.message || error
    );
  }
}
