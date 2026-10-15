"use strict";

/**
 * Restreint uniquement Administration, Contrôleurs et Paramètres au propriétaire.
 * Electron est nécessaire pour réutiliser la session Windows existante.
 * Sans --apply : lecture distante et résumé des seules portées, aucune écriture
 * Firebase. ShenPulse peut rester ouvert ; aucun store réel n'est chargé en
 * écriture et ses éventuelles sauvegardes concurrentes ne sont pas bloquées.
 *
 *   electron.exe scripts/maintenance/restrict-owner-pages.js [--apply]
 * Après l'arrêt du processus, supprimer le profil temporaire exact avec
 * --cleanup-profile <chemin-absolu>, également utilisable sous Node.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { isDeepStrictEqual } = require("node:util");
const { AccountService } = require("../../src/main/account-service");
const { ADMIN_EMAIL, FIREBASE_DATABASE_URL } = require("../../src/main/admin/constants");
const { cloneEncryptionProfile, isEntryPoint, memoryAccountStore, removeSmokeProfile } = require("../smoke-media-upload");

const PAGE_IDS = Object.freeze(["admin", "controllers", "settings"]);
const BRANCHES = Object.freeze(["adminSettings", "publicVisibility"]);
const SCOPES = new Set(["public", "admin", "hidden"]);
let phase = "startup";

function emit(record) {
  // Ne jamais ajouter d'erreur brute, d'identité, de chemin de coffre ou d'URL.
  process.stdout.write(`${JSON.stringify({ phase: record.phase, scopes: record.scopes || {} })}\n`);
}

function ownerPatch() {
  return Object.fromEntries(BRANCHES.flatMap((branch) =>
    PAGE_IDS.map((id) => [`${branch}/navigation/${id}/scope`, "admin"])));
}

function validateNavigation(navigation) {
  for (const branch of BRANCHES) {
    const entries = navigation?.[branch];
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error("NAVIGATION_MISSING");
    for (const id of PAGE_IDS) {
      const entry = entries[id];
      // Un ancien catalogue peut ne pas connaître certaines pages, ou stocker
      // directement « public/admin/hidden » plutôt qu'un objet { scope }.
      if (entry === undefined || entry === null || (typeof entry === "string" && SCOPES.has(entry))) continue;
      if (typeof entry !== "object" || Array.isArray(entry) ||
          (entry.scope !== undefined && entry.scope !== null && !SCOPES.has(entry.scope))) {
        throw new Error("NAVIGATION_MISSING");
      }
    }
  }
  return navigation;
}

function scopeSummary(navigation) {
  return Object.fromEntries(BRANCHES.map((branch) => [branch,
    Object.fromEntries(PAGE_IDS.map((id) => {
      const entry = navigation[branch][id];
      return [id, typeof entry === "string" ? entry : entry?.scope ?? null];
    }))]));
}

function withoutOwnerScopes(navigation) {
  const copy = structuredClone(navigation);
  for (const branch of BRANCHES) for (const id of PAGE_IDS) {
    const entry = copy[branch][id];
    if (entry === undefined || entry === null || typeof entry === "string") {
      delete copy[branch][id];
      continue;
    }
    delete entry.scope;
    // Créer uniquement { scope: "admin" } ne constitue pas un changement de
    // métadonnées par rapport à une entrée absente ou une portée scalaire.
    if (!Object.keys(entry).length) delete copy[branch][id];
  }
  return copy;
}

/** Toutes les mutations du compte et de ses secrets restent dans ces fermetures. */
function ownerMemoryStore(state, encryptedSecrets, safeStorage) {
  const original = state.settings?.account;
  if (String(original?.email || "").trim().toLowerCase() !== ADMIN_EMAIL || original?.emailVerified !== true) {
    throw new Error("OWNER_REQUIRED");
  }
  const base = memoryAccountStore(state, encryptedSecrets, safeStorage);
  let account = base.getAccountSession();
  const expectedUid = account.uid;
  return {
    ...base,
    getAccountSession: () => structuredClone(account),
    getState: () => ({ activeAccountUid: base.getActiveAccountUid(), settings: { account: structuredClone(account) } }),
    set(key, value) {
      if (key !== "settings.account" || value?.uid !== expectedUid) throw new Error("LOCAL_WRITE_FORBIDDEN");
      account = structuredClone(value);
    }
  };
}

async function verifiedOwnerIdentity(store, accountService) {
  const expectedUid = store.getAccountSession().uid;
  const identity = await accountService.identityForInternalUse();
  if (identity.email !== ADMIN_EMAIL || identity.emailVerified !== true || identity.uid !== expectedUid ||
      typeof identity.idToken !== "string" || !identity.idToken) throw new Error("OWNER_REQUIRED");
  return identity;
}

/** API bornée : deux branches en lecture, un seul PATCH multi-chemin prédéfini. */
function firebaseNavigationClient(idToken, fetchImpl = globalThis.fetch) {
  if (!idToken) throw new Error("OWNER_REQUIRED");
  async function request(node, options = {}) {
    const response = await fetchImpl(`${FIREBASE_DATABASE_URL}/site${node ? `/${node}` : ""}.json?auth=${encodeURIComponent(idToken)}`, {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      signal: AbortSignal.timeout(15000), redirect: "error", credentials: "omit", ...options
    });
    if (!response.ok) throw new Error("FIREBASE_REFUSED");
    return response.json();
  }
  return {
    async readNavigation() {
      const values = await Promise.all(BRANCHES.map((branch) => request(`${branch}/navigation`)));
      return Object.fromEntries(BRANCHES.map((branch, index) => [branch, values[index]]));
    },
    async patchRestriction() {
      await request("", { method: "PATCH", body: JSON.stringify(ownerPatch()) });
    }
  };
}

/** Sauvegarde privée bornée aux deux navigations, durable et vérifiée avant PATCH. */
function writeNavigationBackup(navigation, backupRoot = path.resolve(__dirname, "..", "..", ".artifacts", "maintenance", "restrict-owner-pages")) {
  const directory = path.join(backupRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filePath = path.join(directory, "navigation-before.json");
  const payload = JSON.stringify({ version: 1, navigation }, null, 2);
  const descriptor = fs.openSync(filePath, "wx", 0o600);
  try { fs.writeFileSync(descriptor, payload); fs.fsyncSync(descriptor); }
  finally { fs.closeSync(descriptor); }
  const saved = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (saved.version !== 1 || !isDeepStrictEqual(saved.navigation, navigation)) throw new Error("BACKUP_INVALID");
  return filePath;
}

async function restrictOwnerPages({ apply = false, client, backup = writeNavigationBackup, report = emit }) {
  phase = "read-navigation";
  const before = validateNavigation(await client.readNavigation());
  if (!apply) {
    report({ phase: "dry-run", scopes: scopeSummary(before) });
    return before;
  }
  if (BRANCHES.every((branch) => PAGE_IDS.every((id) => before[branch][id]?.scope === "admin"))) {
    report({ phase: "already-restricted", scopes: scopeSummary(before) });
    return before;
  }
  phase = "backup-navigation";
  await backup(before);
  phase = "preflight-navigation";
  const preflight = validateNavigation(await client.readNavigation());
  if (!isDeepStrictEqual(before, preflight)) throw new Error("NAVIGATION_CHANGED");
  phase = "patch-six-scopes";
  await client.patchRestriction();
  phase = "verify-navigation";
  const after = validateNavigation(await client.readNavigation());
  const restricted = BRANCHES.every((branch) => PAGE_IDS.every((id) => after[branch][id]?.scope === "admin"));
  if (!restricted || !isDeepStrictEqual(withoutOwnerScopes(before), withoutOwnerScopes(after))) {
    // Ne jamais restaurer globalement une configuration potentiellement
    // modifiée par un autre administrateur entre les lectures.
    throw new Error("POSTCHECK_FAILED");
  }
  report({ phase: "applied", scopes: scopeSummary(after) });
  return after;
}

async function main() {
  const cleanupIndex = process.argv.indexOf("--cleanup-profile");
  if (cleanupIndex >= 0) {
    removeSmokeProfile(process.argv[cleanupIndex + 1]);
    emit({ phase: "cleanup", scopes: {} });
    return;
  }
  const { app } = require("electron");
  if (!app?.whenReady) throw new Error("ELECTRON_REQUIRED");
  const roaming = process.env.APPDATA;
  if (!roaming || !path.isAbsolute(roaming)) throw new Error("SESSION_MISSING");
  const userDataDirectory = path.join(roaming, "ShenPulse");
  const temporaryProfile = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-media-smoke-"));
  fs.writeFileSync(path.join(temporaryProfile, ".shenpulse-media-smoke-owned"), JSON.stringify({
    kind: "shenpulse-media-smoke-v1", pid: process.pid
  }), { flag: "wx" });
  phase = "isolate-encryption-profile";
  cloneEncryptionProfile(userDataDirectory, temporaryProfile);
  app.setName("ShenPulseOwnerPagesMaintenance");
  app.setPath("userData", temporaryProfile);
  app.setPath("sessionData", temporaryProfile);
  app.disableHardwareAcceleration();
  await app.whenReady();
  let ok = false;
  try {
    phase = "read-owner-session";
    const state = JSON.parse(fs.readFileSync(path.join(userDataDirectory, "shenpulse-state.json"), "utf8"));
    const secrets = JSON.parse(fs.readFileSync(path.join(userDataDirectory, "shenpulse-secrets.json"), "utf8"));
    const store = ownerMemoryStore(state, secrets, require("electron").safeStorage);
    phase = "verify-owner-identity";
    const identity = await verifiedOwnerIdentity(store, new AccountService({ store }));
    await restrictOwnerPages({ apply: process.argv.includes("--apply"), client: firebaseNavigationClient(identity.idToken) });
    ok = true;
  } catch {
    emit({ phase: `failed/${phase}`, scopes: {} });
  } finally {
    app.exit(ok ? 0 : 1);
  }
}

if (isEntryPoint({ nodeMain: require.main === module, processType: process.type, argv: process.argv, scriptPath: __filename })) {
  main().catch(() => {
    emit({ phase: `failed/${phase}`, scopes: {} });
    if (process.type === "browser") require("electron").app.exit(1);
    process.exitCode = 1;
  });
}

module.exports = { BRANCHES, PAGE_IDS, firebaseNavigationClient, ownerMemoryStore, ownerPatch, restrictOwnerPages, scopeSummary, validateNavigation, verifiedOwnerIdentity, withoutOwnerScopes, writeNavigationBackup };
