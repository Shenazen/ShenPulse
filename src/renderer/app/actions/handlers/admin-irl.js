"use strict";

/**
 * Compte, administration et appareils IRL.
 * Une commande ajoutée ici doit être déclarée dans ADMIN_IRL_ACTIONS.
 */

const ADMIN_IRL_ACTIONS = new Set([
  "reset-coin-pusher-artwork",
  "irl-toggle",
  "irl-scan",
  "irl-pair",
  "irl-add-manual",
  "irl-add-action",
  "irl-test",
  "irl-rename",
  "irl-remove",
  "admin-login",
  "open-admin",
  "admin-logout",
  "admin-refresh",
  "admin-workspace",
  "admin-visibility-section",
  "admin-visibility-sync",
  "admin-visibility-bulk",
  "admin-game-cheat-remove",
  "admin-trial-edit",
  "admin-trial-revoke",
  "admin-plan-edit",
  "admin-product-edit",
  "admin-promotion-add",
  "admin-promotion-edit",
  "admin-promotion-delete",
  "admin-commerce-publish",
  "admin-commerce-restore"
]);

async function handleAdminAndIrlAction({ action, target, id }) {
  if (!ADMIN_IRL_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  if (action === "reset-coin-pusher-artwork") {
    return resetCoinPusherArtwork(target);
  }
  if (action === "irl-toggle") {
    return perform(async () => {
      const result = await api.irl.setEnabled(target.checked === true);
      if (result.snapshot) acceptSnapshot(result.snapshot);
      render();
    }, target.checked ? "Interactions IRL activées" : "Interactions IRL désactivées");
  }
  if (action === "irl-scan") {
    return perform(async () => {
      const result = await refreshIrlDiscovery();
      const count = snapshot.state.settings.irl?.devices?.filter(
        (device) => isPlugPlusIrlDevice(device) && device.online
      ).length || 0;
      toast(
        "Détection PlugPlus terminée",
        `${count} prise${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""} sur le réseau local${result.accessPoints.length ? ` · ${result.accessPoints.length} en mode association` : ""}.`
      );
    });
  }
  if (action === "irl-pair") {
    return perform(() => openIrlPairEditor());
  }
  if (action === "irl-add-manual") return openIrlManualEditor();
  if (action === "irl-add-action") return openIrlActionEditor();
  if (action === "irl-test") {
    return perform(async () => {
      const result = await api.irl.test({
        deviceId: id,
        operation: target.dataset.operation || "toggle",
        durationMs: 3000
      });
      if (result.snapshot) acceptSnapshot(result.snapshot);
      render();
    }, "Commande envoyée à la prise");
  }
  if (action === "irl-rename") {
    const device = snapshot.state.settings.irl?.devices?.find(
      (entry) => entry.id === id
    );
    if (!device) throw new Error("Prise PlugPlus introuvable.");
    return openIrlRenameEditor(device);
  }
  if (action === "irl-remove") {
    const device = snapshot.state.settings.irl?.devices?.find(
      (entry) => entry.id === id
    );
    if (
      !device ||
      !(await confirmAction(
        `Retirer la prise « ${device.name} » de ShenPulse ? Les actions existantes ne seront pas supprimées.`,
        { title: "Retirer la prise", confirmLabel: "Retirer" }
      ))
    ) {
      return;
    }
    return perform(async () => {
      const result = await api.irl.remove(id);
      if (result.snapshot) acceptSnapshot(result.snapshot);
      render();
    }, "Prise retirée");
  }
  if (action === "admin-login") return openAdminLogin();
  if (action === "open-admin") {
    currentPage = "admin";
    render();
    content.scrollTop = 0;
    if (!adminDashboard) return refreshAdminDashboard();
    return;
  }
  if (action === "admin-logout") {
    if (
      !(await confirmAction(
        "Fermer la session d’administration sur cet appareil ?",
        {
          title: "Fermer l’administration",
          confirmLabel: "Se déconnecter"
        }
      ))
    ) {
      return;
    }
    await api.admin.logout();
    adminSession = { authorized: false, email: "", uid: "", lastAuthenticatedAt: "" };
    adminDashboard = null;
    siteVisibility = await api.admin.visibility();
    currentPage = "settings";
    ensureCurrentPageAccess();
    render();
    return toast("Administration déconnectée");
  }
  if (action === "admin-refresh") {
    return perform(() => refreshAdminDashboard(), "Administration actualisée");
  }
  if (action === "admin-workspace") {
    adminWorkspace = target.dataset.value || "overview";
    render();
    content.scrollTop = 0;
    return;
  }
  if (action === "admin-visibility-section") {
    adminVisibilitySection = target.dataset.value || "navigation";
    adminVisibilitySearch = "";
    return render();
  }
  if (action === "admin-visibility-sync") {
    if (!adminVisibilityAudit(adminDashboard.siteSettings).changed) return;
    return perform(
      () => syncAdminVisibilityCatalog(),
      "Inventaire ShenPulseNew synchronisé"
    );
  }
  if (action === "admin-visibility-bulk") {
    const scope = target.dataset.value || "public";
    if (
      !(await confirmAction(
        `Appliquer « ${scope === "public" ? "Visible par tous" : scope === "admin" ? "Moi uniquement" : "Masqué"} » à toute cette catégorie ?`,
        { title: "Modifier toute la catégorie", confirmLabel: "Appliquer" }
      ))
    ) return;
    return perform(
      () => saveAdminVisibilityBulk(scope),
      "Catégorie mise à jour"
    );
  }
  if (action === "admin-game-cheat-remove") {
    const email = String(target.dataset.email || "").trim().toLowerCase();
    if (
      !email ||
      !(await confirmAction(
        `Retirer l’accès aux onglets de triche de ${email} ?`,
        {
          title: "Retirer l’accès privé",
          confirmLabel: "Retirer"
        }
      ))
    ) {
      return;
    }
    return perform(
      () =>
        saveAdminGameCheatEntries(
          adminGameCheatEntries().filter((entry) => entry !== email)
        ),
      "Accès aux triches retiré"
    );
  }
  if (action === "admin-trial-edit") {
    const trial = adminTrialRows().find((item) => item.id === id);
    if (!trial) throw new Error("Essai introuvable.");
    return openAdminTrialEditor(trial);
  }
  if (action === "admin-trial-revoke") {
    if (adminModuleError("trials")) {
      throw new Error("Le service des offres d’essai est temporairement indisponible.");
    }
    const trial = adminTrialRows().find((item) => item.id === id);
    if (
      !trial ||
      !(await confirmAction(
        `Retirer immédiatement l’essai de ${trial.email || trial.beneficiaryEmail} ?`,
        { title: "Retirer l’offre d’essai", confirmLabel: "Retirer" }
      ))
    ) {
      return;
    }
    return perform(async () => {
      adminBusy = true;
      try {
        await api.admin.revokeTrial({ trialId: id });
        adminDashboard = await api.admin.dashboard();
      } finally {
        adminBusy = false;
        render();
        restoreAdminTrialFormInteractivity({ focusEmail: true });
      }
    }, "Offre d’essai retirée");
  }
  if (action === "admin-plan-edit") return openAdminPlanEditor(id);
  if (action === "admin-product-edit") return openAdminProductEditor(id);
  if (action === "admin-promotion-add") return openAdminPromotionEditor();
  if (action === "admin-promotion-edit") {
    const promotion = adminCommerceCatalog().promotions?.[id];
    if (!promotion) throw new Error("Promotion introuvable.");
    return openAdminPromotionEditor(promotion);
  }
  if (action === "admin-promotion-delete") {
    const promotion = adminCommerceCatalog().promotions?.[id];
    if (
      !promotion ||
      !(await confirmAction(`Supprimer la promotion « ${promotion.title} » ?`, {
        title: "Supprimer la promotion",
        confirmLabel: "Supprimer"
      }))
    ) {
      return;
    }
    const catalog = cloneAdminData(adminCommerceCatalog());
    delete catalog.promotions[id];
    return saveAdminCommerce(catalog, "save-draft", "Promotion supprimée");
  }
  if (action === "admin-commerce-publish") {
    const publishAction = target.dataset.value;
    const channel = publishAction === "publish-prod" ? "PROD" : "TEST";
    if (
      !(await confirmAction(`Publier le brouillon actuel sur ${channel} ?`, {
        title: `Publication ${channel}`,
        confirmLabel: "Publier",
        danger: false
      }))
    ) {
      return;
    }
    return saveAdminCommerce(
      cloneAdminData(adminCommerceCatalog()),
      publishAction,
      `Catalogue publié sur ${channel}`
    );
  }
  if (action === "admin-commerce-restore") {
    if (adminModuleError("commerce")) {
      throw new Error("Le commerce est temporairement disponible en lecture seule.");
    }
    if (
      !(await confirmAction(
        "Restaurer cette version dans le brouillon ? TEST et PROD resteront inchangés.",
        {
          title: "Restaurer cette version",
          confirmLabel: "Restaurer",
          danger: false
        }
      ))
    ) {
      return;
    }
    adminBusy = true;
    try {
      adminDashboard.commerce = await api.admin.saveCommerce({
        action: "restore-draft",
        historyId: id
      });
      toast("Version restaurée dans le brouillon");
    } finally {
      adminBusy = false;
      render();
    }
    return;
  }
}

registerActionHandler(ADMIN_IRL_ACTIONS, handleAdminAndIrlAction);
