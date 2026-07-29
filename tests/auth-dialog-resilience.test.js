const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const renderer = fs.readFileSync(
  path.join(__dirname, "..", "src", "renderer", "app.js"),
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

  assert.match(accountDialog, /resetAccountAuthDialog\(\)/);
  assert.match(accountDialog, /querySelectorAll\("input, select, textarea, button"\)/);
  assert.match(accountDialog, /control\.disabled = false/);
  assert.match(accountDialog, /dialogSubmitButton\.disabled = false/);
  assert.match(renderer, /let dialogSessionId = 0/);
  assert.match(submitHandler, /activeDialogSessionId !== dialogSessionId/);
  assert.match(submitHandler, /activeSubmitHandler !== dialogSubmitHandler/);
});

test("la déconnexion nettoie toujours la session propriétaire locale", () => {
  const logoutHandler = renderer.slice(
    renderer.indexOf('if (action === "account-logout")'),
    renderer.indexOf("if (requireAccountForAction(action))")
  );

  assert.match(logoutHandler, /accountSession = await api\.account\.logout\(\)/);
  assert.match(logoutHandler, /adminSession = \{/);
  assert.doesNotMatch(logoutHandler, /if \(isVerifiedAdminSession\(\)\)/);
});
