"use strict";

/**
 * Authentification du compte et formulaires administrateur.
 *
 * Ce module est chargé comme script classique dans l'ordre déclaré par la page.
 * Il partage uniquement les contrats globaux documentés dans README.md.
 */

function openAccountLogin(mode = "login", preservedEmail = "") {
  const registering = mode === "register";
  accountMenu.hidden = true;
  accountMenuButton.setAttribute("aria-expanded", "false");
  openEditor({
    title: registering
      ? "Créer votre compte ShenPulse"
      : "Connexion à ShenPulse",
    kicker: registering
      ? "INSCRIPTION SÉCURISÉE · FIREBASE"
      : "COMPTE & ABONNEMENT",
    submitLabel: registering
      ? "Créer mon compte"
      : "Se connecter",
    variant: "account-auth",
    body: `<div class="admin-login-dialog account-login-dialog">
      <section class="admin-login-shield">
        <span>SP</span>
        <div>
          <strong>${registering ? "Un compte pour tous vos accès" : "Retrouvez votre compte ShenPulse"}</strong>
          <p>Votre adresse e-mail identifie vos abonnements, vos achats et vos jeux. Le mot de passe est traité par Firebase et n’est jamais enregistré par ShenPulse.</p>
        </div>
      </section>
      <button class="account-google-button" type="button" data-account-command="google">
        <span aria-hidden="true">G</span>
        ${registering ? "S’inscrire avec Google" : "Continuer avec Google"}
      </button>
      <div class="account-auth-divider"><span>ou avec votre e-mail</span></div>
      <div class="form-grid">
        <label class="field full">
          <span>Adresse email</span>
          <input name="email" type="email" autocomplete="email" value="${escapeHtml(preservedEmail)}" required autofocus>
        </label>
        <label class="field full">
          <span>Mot de passe</span>
          <input name="password" type="password" minlength="${registering ? 8 : 1}" autocomplete="${registering ? "new-password" : "current-password"}" required>
          ${registering ? "<small>8 caractères minimum.</small>" : ""}
        </label>
        ${registering
          ? `<label class="field full">
              <span>Confirmer le mot de passe</span>
              <input name="passwordConfirmation" type="password" minlength="8" autocomplete="new-password" required>
            </label>
            <label class="account-auth-consent full">
              <input name="acceptedTerms" type="checkbox" required>
              <span>J’accepte les conditions d’utilisation et la politique de confidentialité ShenPulse.</span>
            </label>`
          : ""}
      </div>
      ${registering
        ? `<p class="account-auth-switch">Déjà inscrit ? <button type="button" data-account-command="login">Se connecter</button></p>`
        : `<div class="account-auth-links">
            <button type="button" data-account-command="forgot">Mot de passe oublié ?</button>
            <p>Pas encore de compte ? <button type="button" data-account-command="register">Inscrivez-vous</button></p>
          </div>`}
    </div>`,
    onSubmit: async (data) => {
      await waitForPendingAccountLogout();
      const email = data.get("email");
      accountSession = registering
        ? await api.account.register({
            email,
            password: data.get("password"),
            passwordConfirmation: data.get("passwordConfirmation"),
            displayName: String(email || "").split("@")[0]
          })
        : await api.account.login({
            email,
            password: data.get("password")
          });
      acceptSnapshot(await api.getSnapshot());
      await syncAdminSessionFromAccount();
      await refreshGameCheatAccess({ renderWhenChanged: false });
      syncAccountChrome();
      toast(
        registering ? "Compte créé" : "Compte connecté",
        accountSession.emailVerified
          ? accountSession.email
          : `${accountSession.email} · vérification facultative recommandée pour sécuriser le compte`
      );
    }
  });
  const activeDialogSessionId = dialogSessionId;
  resetAccountAuthDialog(activeDialogSessionId);
  requestAnimationFrame(() => {
    resetAccountAuthDialog(activeDialogSessionId);
  });
}

function resetAccountAuthDialog(expectedSessionId = dialogSessionId) {
  if (
    expectedSessionId !== dialogSessionId ||
    dialog.dataset.variant !== "account-auth"
  ) {
    return;
  }
  [dialog, dialogForm, dialogBody].forEach((element) => {
    element.inert = false;
    element.removeAttribute("inert");
    element.removeAttribute("aria-disabled");
    element.style.removeProperty("pointer-events");
  });
  dialogForm.setAttribute("aria-busy", "false");
  dialogBody
    .querySelectorAll("input, select, textarea, button")
    .forEach((control) => {
      control.disabled = false;
      control.removeAttribute("disabled");
      if (control.matches("input, textarea")) {
        control.readOnly = false;
        control.removeAttribute("readonly");
      }
      control.removeAttribute("aria-disabled");
      delete control.dataset.guestLocked;
      delete control.dataset.guestWasDisabled;
    });
  dialogSubmitButton.disabled = false;
}

function openAdminLogin() {
  openEditor({
    title: "Connexion propriétaire",
    kicker: "ADMINISTRATION SHENPULSE · FIREBASE",
    submitLabel: "Vérifier mon accès",
    body: `<div class="admin-login-dialog">
      <section class="admin-login-shield"><span>♜</span><div><strong>Accès strictement personnel</strong><p>Seul le compte propriétaire défini côté serveur est accepté. Le mot de passe est envoyé directement à Firebase puis oublié.</p></div></section>
      <div class="form-grid">
        <label class="field full"><span>Compte administrateur</span><input name="email" type="email" value="alexandre.leuridan@gmail.com" readonly></label>
        <label class="field full"><span>Mot de passe Firebase</span><input name="password" type="password" autocomplete="current-password" required autofocus></label>
      </div>
    </div>`,
    onSubmit: async (data) => {
      adminBusy = true;
      try {
        adminSession = await api.admin.login({
          email: data.get("email"),
          password: data.get("password")
        });
        adminDashboard = await api.admin.dashboard();
        siteVisibility = await api.admin.visibility();
        currentPage = "admin";
      } finally {
        adminBusy = false;
      }
    }
  });
}

async function saveAdminVisibilityScope(section, id, scope) {
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  const catalogItem = adminVisibilityCatalog()[section]?.find(
    (item) => item.id === id
  );
  if (!catalogItem) {
    throw new Error("Cet élément n’existe pas dans ShenPulseNew.");
  }
  if (catalogItem.ownerOnly) scope = "admin";
  const storedId = adminVisibilityStorageKey(id);
  next[section][storedId] = { scope };
  if (section === "actionTypes") {
    next.actionTypeOverrides = next.actionTypeOverrides || {};
    next.actionTypeOverrides[storedId] = true;
  }
  adminBusy = true;
  try {
    adminDashboard.siteSettings = await api.admin.saveSiteSettings(next);
    siteVisibility = await api.admin.visibility();
  } finally {
    adminBusy = false;
    render();
  }
}

async function saveAdminVisibilityBulk(scope) {
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  const items = adminVisibilityCatalog()[adminVisibilitySection] || [];
  for (const { id } of items) {
    const storedId = adminVisibilityStorageKey(id);
    const item = items.find((entry) => entry.id === id);
    next[adminVisibilitySection][storedId] = {
      scope: item?.ownerOnly ? "admin" : scope
    };
    if (adminVisibilitySection === "actionTypes") {
      next.actionTypeOverrides[storedId] = true;
    }
  }
  adminBusy = true;
  try {
    adminDashboard.siteSettings = await api.admin.saveSiteSettings(next);
    siteVisibility = await api.admin.visibility();
  } finally {
    adminBusy = false;
    render();
  }
}

async function syncAdminVisibilityCatalog() {
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  adminBusy = true;
  try {
    adminDashboard.siteSettings = await api.admin.saveSiteSettings(next);
    siteVisibility = await api.admin.visibility();
  } finally {
    adminBusy = false;
    render();
  }
}

async function saveAdminGameCheatEntries(emails) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(emails) ? emails : [])
        .map((email) => String(email || "").trim().toLowerCase())
        .filter((email) => email && email !== ADMIN_OWNER_EMAIL)
    )
  ).slice(0, 250);
  const next = canonicalAdminSiteSettings(adminDashboard.siteSettings);
  next.cheatAccess = next.cheatAccess || {};
  next.cheatAccess["game-tabs"] = {
    entries: normalized.map((email) => ({ email }))
  };
  adminBusy = true;
  try {
    adminDashboard.siteSettings = await api.admin.saveSiteSettings(next);
    await refreshGameCheatAccess({ renderWhenChanged: false });
  } finally {
    adminBusy = false;
    render();
  }
}

async function saveAdminCommerce(catalog, action = "save-draft", success = "Catalogue enregistré") {
  if (adminModuleError("commerce")) {
    throw new Error(
      "La modification commerciale est suspendue jusqu’à la publication de l’index Firebase."
    );
  }
  adminBusy = true;
  try {
    adminDashboard.commerce = await api.admin.saveCommerce({ action, catalog });
    toast(success);
  } finally {
    adminBusy = false;
    render();
  }
}

function openAdminPlanEditor(tier) {
  if (adminModuleError("commerce")) {
    throw new Error("Le commerce est temporairement disponible en lecture seule.");
  }
  const plan = adminCommerceCatalog().subscriptions?.[tier];
  if (!plan) throw new Error("Abonnement introuvable.");
  openEditor({
    title: `Abonnement ${plan.title}`,
    kicker: "TARIF MENSUEL PUBLIC",
    body: `<div class="form-grid">
      ${field("title", "Nom affiché", plan.title, "text", "full required maxlength=\"80\"")}
      ${field("priceMonthly", "Prix mensuel", plan.priceMonthly, "text", 'inputmode="decimal" required')}
      ${field("sortOrder", "Ordre d’affichage", plan.sortOrder, "number", 'step="1"')}
      <label class="field"><span>Disponibilité</span><select name="enabled"><option value="true" ${plan.enabled ? "selected" : ""}>Disponible</option><option value="false" ${!plan.enabled ? "selected" : ""}>Indisponible</option></select></label>
    </div>`,
    onSubmit: async (data) => {
      const catalog = cloneAdminData(adminCommerceCatalog());
      catalog.subscriptions[tier] = {
        ...plan,
        title: String(data.get("title") || "").trim(),
        priceMonthly: normalizeAdminMoney(data.get("priceMonthly"), 0.01),
        sortOrder: Number(data.get("sortOrder") || 0),
        enabled: data.get("enabled") === "true"
      };
      await saveAdminCommerce(catalog, "save-draft", `Abonnement ${tier.toUpperCase()} enregistré`);
    }
  });
}

function openAdminProductEditor(productId) {
  if (adminModuleError("commerce")) {
    throw new Error("Le commerce est temporairement disponible en lecture seule.");
  }
  const product = adminCommerceCatalog().products?.[productId];
  if (!product) throw new Error("Offre de jeu introuvable.");
  openEditor({
    title: product.title,
    kicker: "OFFRE COMMERCIALE DU JEU",
    submitLabel: "Enregistrer et publier",
    body: `<div class="form-grid">
      ${field("title", "Nom affiché", product.title, "text", "full required maxlength=\"120\"")}
      <label class="field"><span>Mode d’accès</span><select name="accessMode"><option value="purchase" ${product.accessMode === "purchase" ? "selected" : ""}>Achat séparé</option><option value="included" ${product.accessMode === "included" ? "selected" : ""}>Inclus</option></select></label>
      ${field("baseAmount", "Prix", product.baseAmount, "text", 'inputmode="decimal" required')}
      ${field("sortOrder", "Ordre", product.sortOrder, "number", 'step="1"')}
      <label class="field"><span>Disponibilité</span><select name="enabled"><option value="true" ${product.enabled ? "selected" : ""}>Disponible</option><option value="false" ${!product.enabled ? "selected" : ""}>Masqué à la vente</option></select></label>
      <label class="field full"><span>Offre d’essai</span><select name="trialEligible"><option value="true" ${product.trialEligible ? "selected" : ""}>Peut être offert en essai</option><option value="false" ${!product.trialEligible ? "selected" : ""}>Jamais en essai</option></select></label>
    </div>`,
    onSubmit: async (data) => {
      const catalog = cloneAdminData(adminCommerceCatalog());
      const accessMode = data.get("accessMode") === "included" ? "included" : "purchase";
      catalog.products[productId] = {
        ...product,
        title: String(data.get("title") || "").trim(),
        accessMode,
        baseAmount: accessMode === "included"
          ? "0.00"
          : normalizeAdminMoney(data.get("baseAmount")),
        sortOrder: Number(data.get("sortOrder") || 0),
        enabled: data.get("enabled") === "true",
        trialEligible: data.get("trialEligible") === "true"
      };
      await saveAdminCommerce(
        catalog,
        "publish-prod",
        `${product.title} enregistré et publié`
      );
    }
  });
}

function openAdminPromotionEditor(promotion = null) {
  if (adminModuleError("commerce")) {
    throw new Error("Le commerce est temporairement disponible en lecture seule.");
  }
  const catalog = adminCommerceCatalog();
  const draft = promotion || {
    id: `promo-${Date.now()}`,
    title: "Nouvelle promotion",
    type: "percent",
    value: 10,
    enabled: true,
    startsAt: "",
    endsAt: "",
    productIds: []
  };
  openEditor({
    title: promotion ? `Promotion ${promotion.title}` : "Nouvelle promotion",
    kicker: "CAMPAGNE COMMERCIALE",
    variant: "wide",
    body: `<div class="form-grid">
      ${field("title", "Nom de la campagne", draft.title, "text", "full required maxlength=\"120\"")}
      <label class="field"><span>Type</span><select name="type"><option value="percent" ${draft.type === "percent" ? "selected" : ""}>Pourcentage</option><option value="fixed" ${draft.type === "fixed" ? "selected" : ""}>Montant fixe</option></select></label>
      ${field("value", "Remise", draft.value, "number", 'min="0.01" max="100000" step="0.01" required')}
      ${field("startsAt", "Début (facultatif)", toLocalAdminDate(draft.startsAt), "datetime-local")}
      ${field("endsAt", "Fin (facultatif)", toLocalAdminDate(draft.endsAt), "datetime-local")}
      <label class="field"><span>État</span><select name="enabled"><option value="true" ${draft.enabled ? "selected" : ""}>Active</option><option value="false" ${!draft.enabled ? "selected" : ""}>Suspendue</option></select></label>
      <label class="field full"><span>IDs des jeux (un par ligne, vide = tous les jeux payants)</span><textarea name="productIds" rows="8">${escapeHtml((draft.productIds || []).join("\n"))}</textarea></label>
    </div>`,
    onSubmit: async (data) => {
      const next = cloneAdminData(catalog);
      next.promotions[draft.id] = {
        ...draft,
        title: String(data.get("title") || "").trim(),
        type: data.get("type") === "fixed" ? "fixed" : "percent",
        value: Number(data.get("value") || 0),
        enabled: data.get("enabled") === "true",
        startsAt: adminDateToIso(data.get("startsAt")),
        endsAt: adminDateToIso(data.get("endsAt")),
        productIds: String(data.get("productIds") || "").split(/\r?\n|,/).map((id) => id.trim()).filter((id) => next.products[id])
      };
      await saveAdminCommerce(next, "save-draft", "Promotion enregistrée");
    }
  });
}

function openAdminTrialEditor(trial) {
  if (adminModuleError("trials")) {
    throw new Error("Le service des offres d’essai est temporairement indisponible.");
  }
  openEditor({
    title: `Essai de ${trial.email || trial.beneficiaryEmail}`,
    kicker: "MODIFIER L’OFFRE D’ESSAI",
    body: `<div class="form-grid">
      ${field("email", "Adresse e-mail du compte", trial.email || trial.beneficiaryEmail, "email", "full required maxlength=\"254\"")}
      ${field("days", "Nouvelle durée (jours)", trial.durationDays || 7, "number", 'min="1" max="365" required')}
      <label class="field"><span>Accès Pro</span><select name="subscription"><option value="true" ${trial.subscriptionTrial ? "selected" : ""}>Oui</option><option value="false" ${!trial.subscriptionTrial ? "selected" : ""}>Non</option></select></label>
      <label class="field"><span>Jeux</span><select name="games"><option value="true" ${(trial.gameTrialIds || []).length ? "selected" : ""}>Oui</option><option value="false" ${!(trial.gameTrialIds || []).length ? "selected" : ""}>Non</option></select></label>
      <label class="field full"><span>IDs des jeux (vide = tous les jeux éligibles)</span><textarea name="gameIds" rows="7">${escapeHtml((trial.gameTrialIds || []).join("\n"))}</textarea></label>
    </div>`,
    onSubmit: async (data) => {
      adminBusy = true;
      try {
        await api.admin.updateTrial({
          trialId: trial.id,
          email: data.get("email"),
          days: Number(data.get("days")),
          subscription: data.get("subscription") === "true",
          games: data.get("games") === "true",
          gameIds: String(data.get("gameIds") || "").split(/\r?\n|,/).map((id) => id.trim()).filter(Boolean)
        });
        adminDashboard = await api.admin.dashboard();
      } finally {
        adminBusy = false;
      }
    }
  });
}

function toLocalAdminDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function adminDateToIso(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function checkRow(title, detail, name, checked) {
  return `<label class="check-row"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></span><span class="switch"><input type="checkbox" name="${escapeHtml(name)}" ${checked ? "checked" : ""}><span></span></span></label>`;
}
