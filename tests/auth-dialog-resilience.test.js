const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const renderer = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "app.js"),
  "utf8"
);
const rendererHtml = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "index.html"),
  "utf8"
);

test("les champs verrouillés en mode invité sont restaurés après connexion", () => {
  const guestMode = renderer.slice(
    renderer.indexOf("function applyGuestReadOnlyMode"),
    renderer.indexOf("function requireAccountForAction")
  );

  assert.match(guestMode, /data-guest-locked="true"/);
  assert.match(
    guestMode,
    /control\.disabled = control\.dataset\.guestWasDisabled === "true"/
  );
  assert.match(guestMode, /delete control\.dataset\.guestLocked/);
  assert.match(guestMode, /control\.removeAttribute\("aria-disabled"\)/);
});

test("chaque ouverture de connexion réactive les champs et annule les anciens retours", () => {
  const accountDialog = renderer.slice(
    renderer.indexOf("function openAccountLogin"),
    renderer.indexOf("function openAdminLogin")
  );
  const submitHandler = renderer.slice(
    renderer.indexOf('dialogForm.addEventListener("submit"'),
    renderer.indexOf('dialog.addEventListener("click"', renderer.indexOf('dialogForm.addEventListener("submit"'))
  );

  assert.match(
    accountDialog,
    /resetAccountAuthDialog\(activeDialogSessionId\)/
  );
  assert.match(accountDialog, /querySelectorAll\("input, select, textarea, button"\)/);
  assert.match(accountDialog, /control\.disabled = false/);
  assert.match(accountDialog, /control\.readOnly = false/);
  assert.match(accountDialog, /\[dialog, dialogForm, dialogBody\]/);
  assert.match(accountDialog, /requestAnimationFrame\(\(\) => \{/);
  assert.match(accountDialog, /expectedSessionId !== dialogSessionId/);
  assert.match(accountDialog, /dialogSubmitButton\.disabled = false/);
  assert.match(renderer, /let dialogSessionId = 0/);
  assert.match(renderer, /let pendingAccountLogoutPromise = null/);
  assert.match(
    accountDialog,
    /await waitForPendingAccountLogout\(\);\s*const email/
  );
  assert.match(
    renderer,
    /waitForPendingAccountLogout\(\)\s*\.then\(\(\) => api\.account\.loginWithBrowser\(\)\)/
  );
  assert.match(submitHandler, /activeDialogSessionId !== dialogSessionId/);
  assert.match(submitHandler, /activeSubmitHandler !== dialogSubmitHandler/);
});

test("la déconnexion nettoie toujours la session propriétaire locale", () => {
  const logoutHandler = renderer.slice(
    renderer.indexOf('if (action === "account-logout")'),
    renderer.indexOf("if (requireAccountForAction(action))")
  );

  assert.match(logoutHandler, /const logoutOperation = \(async \(\) => \{/);
  assert.match(logoutHandler, /pendingAccountLogoutPromise = logoutOperation/);
  assert.match(logoutHandler, /accountSession = signedOutAccountSession\(\)/);
  assert.match(
    logoutHandler,
    /render\(\);\s*toast\("Compte ShenPulse déconnecté"\);\s*openAccountLogin\(\);\s*try \{\s*accountSession = await logoutOperation/
  );
  assert.match(logoutHandler, /adminSession = \{/);
  assert.match(logoutHandler, /openAccountLogin\(\)/);
  assert.doesNotMatch(logoutHandler, /if \(isVerifiedAdminSession\(\)\)/);
});

test("les confirmations intégrées ne bloquent pas les champs Electron", () => {
  const logoutHandler = renderer.slice(
    renderer.indexOf('if (action === "account-logout")'),
    renderer.indexOf("if (requireAccountForAction(action))")
  );
  const trialRevokeHandler = renderer.slice(
    renderer.indexOf('if (action === "admin-trial-revoke")'),
    renderer.indexOf('if (action === "admin-promotion-save")')
  );
  const confirmationController = renderer.slice(
    renderer.indexOf("function finishConfirmation"),
    renderer.indexOf("function setControlValue")
  );

  assert.match(rendererHtml, /<dialog id="confirmation-dialog"/);
  assert.match(rendererHtml, /id="confirmation-cancel"/);
  assert.match(rendererHtml, /id="confirmation-submit"/);
  assert.match(confirmationController, /confirmationDialog\.showModal\(\)/);
  assert.match(confirmationController, /confirmationCancelButton\.focus/);
  assert.match(confirmationController, /window\.focus\(\)/);
  assert.match(logoutHandler, /await confirmAction\(/);
  assert.match(trialRevokeHandler, /await confirmAction\(/);
  assert.doesNotMatch(renderer, /(?:window\.)?confirm\s*\(/);
});
