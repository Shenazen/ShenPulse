"use strict";

/**
 * Maintenance explicite : rend uniquement le ChatBot public, sans republier
 * les autres réglages ni les accès aux jeux. À lancer avec Electron et --apply
 * seulement après accord du propriétaire, lorsque ShenPulse est fermé.
 * La session existante est vérifiée par AccountService ; aucun secret n'est
 * imprimé, exporté, passé en argument ou transmis à un autre service.
 */
const fs = require("node:fs");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { app, safeStorage } = require("electron");
const { StateStore } = require("../../src/main/store");
const { AccountService } = require("../../src/main/account-service");
const { ADMIN_EMAIL, FIREBASE_DATABASE_URL } = require("../../src/main/admin/constants");

let stage = "initialisation";
const directoryArgument = process.argv.find((argument) => argument.startsWith("--user-data="));
const sessionDirectory = directoryArgument?.slice("--user-data=".length);
// safeStorage utilise la clé Chromium du dossier de session. Le sélectionner
// avant app.ready permet de déchiffrer le coffre avec sa clé existante.
if (sessionDirectory && path.isAbsolute(sessionDirectory)) app.setPath("userData", sessionDirectory);

function withoutChatbotScope(configuration) {
  const copy = structuredClone(configuration);
  if (copy?.navigation?.commands) delete copy.navigation.commands.scope;
  return copy;
}

async function run() {
  if (!directoryArgument) throw new Error("Dossier de session explicite requis.");
  const directory = sessionDirectory;
  if (!path.isAbsolute(directory)) throw new Error("Dossier de session absolu requis.");
  const apply = process.argv.includes("--apply");
  const store = new StateStore(directory, safeStorage);
  // Lecture seule : pas de migrations ni de réécriture des workspaces.
  store.state = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  store.secrets = JSON.parse(fs.readFileSync(store.secretPath, "utf8"));
  const account = store.getAccountSession();
  if (account.email !== ADMIN_EMAIL || account.emailVerified !== true) {
    throw new Error("Session du propriétaire vérifié requise.");
  }
  // L'identité revalidée reste en mémoire. Une rotation OAuth éventuelle conserve
  // en revanche le nouveau secret via la persistance chiffrée/atomique existante.
  store.set = (key, value) => {
    if (key !== "settings.account") throw new Error("Mutation locale non autorisée.");
    store.state.settings.account = structuredClone(value);
  };
  stage = "vérification de la session Firebase existante";
  if (!store.getSecret(account.refreshTokenSecretId)) {
    stage = "lecture du coffre chiffré existant";
    throw new Error("Coffre illisible.");
  }
  const identity = await new AccountService({ store }).identityForInternalUse();
  if (identity.email !== ADMIN_EMAIL || identity.emailVerified !== true || identity.uid !== account.uid) {
    throw new Error("Identité administrateur non confirmée.");
  }

  async function request(node, options = {}) {
    const response = await fetch(`${FIREBASE_DATABASE_URL}/site/${node}.json?auth=${encodeURIComponent(identity.idToken)}`, {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(15000),
      ...options
    });
    if (!response.ok) throw new Error(`Firebase a refusé l'opération (${response.status}).`);
    return response.json();
  }
  stage = "lecture des deux configurations";
  const before = await Promise.all([request("adminSettings"), request("publicVisibility")]);
  if (before.some((entry) => !entry?.navigation?.commands || typeof entry.navigation.commands !== "object")) {
    throw new Error("Configuration ChatBot existante requise ; aucun accès créé implicitement.");
  }
  const previousScopes = before.map((entry) => entry.navigation.commands.scope);
  if (!apply) {
    console.log(JSON.stringify({ mode: "lecture seule", previousScopes, target: "public" }));
    return;
  }
  stage = "publication atomique de la seule visibilité ChatBot";
  // PATCH multi-chemin : Firebase valide chaque feuille et applique les deux
  // changements ensemble ; aucun PUT de configuration complète.
  const response = await fetch(`${FIREBASE_DATABASE_URL}/site.json?auth=${encodeURIComponent(identity.idToken)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      "adminSettings/navigation/commands/scope": "public",
      "publicVisibility/navigation/commands/scope": "public"
    })
  });
  if (!response.ok) throw new Error(`Firebase a refusé la publication (${response.status}).`);
  stage = "vérification après publication";
  const after = await Promise.all([request("adminSettings"), request("publicVisibility")]);
  const otherSettingsUnchanged = after.every((entry, index) =>
    isDeepStrictEqual(withoutChatbotScope(entry), withoutChatbotScope(before[index]))
  );
  if (after.some((entry) => entry.navigation.commands.scope !== "public") || !otherSettingsUnchanged) {
    throw new Error("Contrôle post-publication non conforme ; inspection requise.");
  }
  console.log(JSON.stringify({ published: true, previousScopes, scopes: ["public", "public"], otherSettingsUnchanged }));
}

app.whenReady().then(run).then(() => app.exit(0)).catch((error) => {
  // Ne jamais sérialiser une erreur réseau brute contenant une URL authentifiée.
  console.error(`Maintenance interrompue pendant : ${stage}. Aucun secret affiché.`);
  const diagnostic = String(error?.code || error?.cause?.code || error?.name || "");
  if (/^[A-Z_a-z0-9-]{1,60}$/.test(diagnostic)) console.error(`Catégorie : ${diagnostic}.`);
  app.exit(1);
});
