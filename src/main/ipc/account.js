"use strict";

/** Comptes, mises à jour, abonnements et accès premium.
 * Les canaux sont toujours enregistrés par le garde d’accès central injecté.
 */
const { snapshotForRenderer } = require("../account-access");
const { safeString } = require("../utils");
const { notify } = require("./notifications");

function registerAccountIpc({ handle, core, store, accountService, adminService, storeUpdateService, getWindow, switchAccountWorkspace, refreshAccountWorkspace }) {
  handle("snapshot:get", async () => {
    core.overlayServer?.refreshAccess();
    return snapshotForRenderer(core.snapshot(), store);
  });
  
  handle("updates:check", (_event, incoming) =>
    storeUpdateService.check({ force: incoming?.force === true })
  );
  
  handle("updates:install", () => storeUpdateService.install());
  
  handle("account:status", async () => {
    const previousUid = store.getActiveAccountUid?.() || "";
    const generation = accountService.sessionGeneration;
    const result = await accountService.status();
    core.overlayServer?.refreshAccess();
    const nextUid = store.getActiveAccountUid?.() || "";
    // Une autre connexion a déjà repris son espace : l'ancien statut ne doit pas l'arrêter.
    if (nextUid && generation !== accountService.sessionGeneration) return result;
    if (previousUid !== nextUid) {
      await refreshAccountWorkspace();
    }
    return result;
  });
  
  handle("account:login", (_event, incoming) =>
    switchAccountWorkspace(() =>
      accountService.login({
        email: safeString(incoming?.email, 254),
        password: safeString(incoming?.password, 500)
      })
    )
  );
  
  handle("account:register", (_event, incoming) =>
    switchAccountWorkspace(() =>
      accountService.register({
        email: safeString(incoming?.email, 254),
        password: safeString(incoming?.password, 500),
        passwordConfirmation: safeString(
          incoming?.passwordConfirmation,
          500
        ),
        displayName: safeString(incoming?.displayName, 120)
      })
    )
  );
  
  handle("account:login-browser", (_event, incoming) =>
    switchAccountWorkspace(() =>
      accountService.loginWithBrowser({
        email: safeString(incoming?.email, 254)
      })
    )
  );
  
  handle("account:password-reset", (_event, incoming) =>
    accountService.requestPasswordReset({
      email: safeString(incoming?.email, 254)
    })
  );
  
  handle("account:checkout-cancel", (_event, incoming) =>
    accountService.cancelCheckout({
      type: safeString(incoming?.type, 20)
    })
  );
  
  handle("account:subscription-checkout", async (_event, incoming) => {
    try {
      const result = await accountService.startSubscriptionCheckout({
        tier: safeString(incoming?.tier, 20)
      });
      core.overlayServer?.refreshAccess();
      notify(core, "state-changed", core.snapshot());
      return {
        result,
        snapshot: snapshotForRenderer(core.snapshot(), store)
      };
    } finally {
      const owner = getWindow?.();
      if (owner?.isMinimized?.()) owner.restore();
      owner?.show?.();
      owner?.focus?.();
    }
  });
  
  handle("account:subscription-stop", async () => {
    const result = await accountService.stopSubscription();
    core.overlayServer?.refreshAccess();
    notify(core, "state-changed", core.snapshot());
    return {
      result,
      snapshot: snapshotForRenderer(core.snapshot(), store)
    };
  });
  
  handle("account:game-checkout", async (_event, incoming) => {
    try {
      const result = await accountService.startGameCheckout({
        productId: safeString(incoming?.productId, 160)
      });
      notify(core, "state-changed", core.snapshot());
      return {
        result,
        snapshot: snapshotForRenderer(core.snapshot(), store)
      };
    } finally {
      const owner = getWindow?.();
      if (owner?.isMinimized?.()) owner.restore();
      owner?.show?.();
      owner?.focus?.();
    }
  });
  
  handle("account:sync-entitlements", async () => {
    const result = await accountService.syncEntitlements();
    core.overlayServer?.refreshAccess();
    notify(core, "state-changed", core.snapshot());
    return result;
  });
  
  handle("account:game-cheat-access", () =>
    accountService.gameCheatAccess()
  );
  
  handle("account:logout", () => switchAccountWorkspace(() => {
    adminService.logout();
    const result = accountService.logout();
    core.overlayServer?.matchSource?.clear();
    return result;
  }, {
    beforeSuspend: () => Promise.allSettled([
      core.stopSession(),
      core.stopGameSession({ notify: false })
    ])
  }));
  
  handle("premium-seat:assign", async (_event, incoming) => {
    const result = await accountService.assignPremiumSeat({
      beneficiaryEmail: safeString(
        incoming?.beneficiaryEmail || incoming?.email,
        254
      )
    });
    core.overlayServer?.refreshAccess();
    notify(core, "state-changed", core.snapshot());
    return { result, snapshot: core.snapshot() };
  });
}

module.exports = { registerAccountIpc };
