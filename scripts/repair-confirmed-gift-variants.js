"use strict";

/** Réparation volontaire et hors ligne des seules variantes confirmées pour le compte actif. */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { isDeepStrictEqual } = require("node:util");
const { GiftCatalog } = require("../src/main/catalogs/gifts");
const { AtomicJsonStorage } = require("../src/main/state/json-storage");
const { accountWorkspaceKey, cleanAccountUid } = require("../src/main/state/account-workspace");
const { collectGiftReferenceUpdates, applyGiftReferenceUpdates } = require("../src/main/state/gift-upgrade-migration");
const { findCatalogGift, normalizeGiftName } = require("../src/shared/gift-identity");

const METADATA_KEYS = new Set(["giftId", "giftIds", "giftFamily", "giftImageUrl", "giftCost"]);

/** Les valeurs ne sont jamais implicites : chaque variante vient d'un argument explicite. */
function parseArguments(args) {
  const options = { statePath: "", confirmedVariants: [], apply: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--apply") {
      if (options.apply) throw new Error("L'option --apply ne doit apparaître qu'une fois.");
      options.apply = true;
    } else if (argument === "--state" || argument === "--gift") {
      const value = args[++index];
      if (!value || value.startsWith("--")) throw new Error(`Valeur manquante pour ${argument}.`);
      if (argument === "--state") {
        if (options.statePath) throw new Error("Un seul fichier --state est autorisé.");
        options.statePath = path.resolve(value);
      } else {
        const separator = value.lastIndexOf("=");
        const name = value.slice(0, separator).trim();
        const cost = Number(value.slice(separator + 1));
        if (separator < 1 || !name || !Number.isSafeInteger(cost) || cost <= 0) {
          throw new Error("Chaque --gift doit avoir la forme 'Nom=Prix', avec un prix entier positif.");
        }
        if (options.confirmedVariants.some((gift) => normalizeGiftName(gift.name) === normalizeGiftName(name))) {
          throw new Error("Une même variante ne doit être confirmée qu'une fois.");
        }
        options.confirmedVariants.push({ name, cost });
      }
    } else {
      throw new Error(`Argument inconnu : ${argument}.`);
    }
  }
  if (!options.statePath || !options.confirmedVariants.length) {
    throw new Error("Usage : node scripts/repair-confirmed-gift-variants.js --state <fichier> --gift 'Nom=Prix' [--gift 'Nom=Prix'] [--apply]. Sans --apply, seule une prévisualisation est produite.");
  }
  return options;
}

/** Contrôle de processus en lecture seule ; aucune commande ne ferme ni ne lance ShenPulse. */
function isShenPulseRunning({ platform = process.platform, execute = execFileSync } = {}) {
  if (platform !== "win32") throw new Error("L'arrêt de ShenPulse ne peut être vérifié que sous Windows ; écriture refusée.");
  const command = "$ErrorActionPreference = 'Stop'; @(Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq 'ShenPulse.exe' -or ($_.Name -ieq 'electron.exe' -and $_.CommandLine -match 'ShenPulse|src[\\\\/]main[\\\\/]main\\.js') }).Count";
  let output;
  try {
    output = String(execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      encoding: "utf8", windowsHide: true, timeout: 15000, stdio: ["ignore", "pipe", "pipe"]
    })).trim();
  } catch {
    throw new Error("Impossible de vérifier les processus Windows ; écriture refusée.");
  }
  if (!/^\d+$/.test(output)) throw new Error("Réponse Windows inattendue ; écriture refusée.");
  return Number(output) > 0;
}

/** Seuls la vue active et la copie appartenant exactement au même compte sont accessibles. */
function activeScopes(state) {
  const uid = cleanAccountUid(state.activeAccountUid);
  if (!uid) throw new Error("Aucun compte actif valide ; réparation refusée.");
  const settingsUid = cleanAccountUid(state.settings?.account?.uid);
  if (settingsUid && settingsUid !== uid) throw new Error("Le compte courant ne correspond pas à l'espace actif ; réparation refusée.");
  const key = accountWorkspaceKey(uid);
  const accounts = state.accountWorkspaces;
  const workspace = accounts && Object.hasOwn(accounts, key) ? accounts[key] : null;
  if (!workspace || Array.isArray(workspace) || cleanAccountUid(workspace.ownerUid) !== uid) {
    throw new Error("Le propriétaire de l'espace actif ne peut être vérifié ; réparation refusée.");
  }
  const root = { ...state };
  delete root.accountWorkspaces;
  delete root.unclaimedAccountWorkspace;
  return [root, workspace];
}

/** Vérifie structurellement qu'aucune commande, action ou autre donnée métier ne change. */
function verifyMetadataOnly(before, after, trail = []) {
  if (isDeepStrictEqual(before, after)) return;
  if (!before || !after || typeof before !== "object" || typeof after !== "object" ||
      Array.isArray(before) !== Array.isArray(after)) {
    throw new Error("Un réglage hors métadonnées de cadeaux aurait changé ; réparation refusée.");
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (isDeepStrictEqual(before[key], after[key])) continue;
    if (METADATA_KEYS.has(key)) continue;
    const integrated = trail.includes("game") && trail.includes("connectorOverrides");
    if (integrated && (key === "image" || key === "giftImage")) continue;
    if (key === "triggerGift" && before[key] === undefined && after[key] &&
        typeof after[key] === "object" && !Array.isArray(after[key]) &&
        Object.keys(after[key]).every((field) => METADATA_KEYS.has(field))) continue;
    if (!Object.hasOwn(before, key) || !Object.hasOwn(after, key)) {
      throw new Error("Une structure hors métadonnées de cadeaux aurait changé ; réparation refusée.");
    }
    verifyMetadataOnly(before[key], after[key], [...trail, key]);
  }
}

/** Associe les objets à leur libellé sans exposer chemins internes, UID ou jetons. */
function referenceLabels(scopes, variants) {
  const allowed = new Map(variants.map((gift) => [normalizeGiftName(gift.name), gift.name]));
  const labels = new WeakMap();
  const visited = new WeakSet();
  function walk(value, inheritedLabel = "") {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    const candidates = [value.field === "data.giftName" ? value.value : "", value.giftName, value.name, value.trigger];
    const label = candidates.map((name) => allowed.get(normalizeGiftName(name))).find(Boolean) || inheritedLabel;
    if (label) labels.set(value, label);
    for (const [key, child] of Object.entries(value)) walk(child, key === "triggerGift" ? label : "");
  }
  for (const scope of scopes) walk(scope);
  return labels;
}

/** Plan pur : aucune normalisation de StateStore et aucune écriture, même en cas d'erreur. */
function prepareRepair(state, gifts, confirmedVariants) {
  if (!Array.isArray(confirmedVariants) || !confirmedVariants.length) throw new Error("Au moins une variante doit être confirmée.");
  const confirmedNames = new Set();
  for (const variant of confirmedVariants) {
    if (!variant?.name || !Number.isSafeInteger(variant.cost) || variant.cost <= 0 ||
        !findCatalogGift(gifts, { name: variant.name, cost: variant.cost })) {
      throw new Error("Une variante confirmée est absente ou ambiguë dans le catalogue ; réparation refusée.");
    }
    const nameKey = normalizeGiftName(variant.name);
    if (confirmedNames.has(nameKey)) throw new Error("Une même variante ne doit être confirmée qu'une fois.");
    confirmedNames.add(nameKey);
  }
  const repaired = JSON.parse(JSON.stringify(state));
  const scopes = activeScopes(repaired);
  const labels = referenceLabels(scopes, confirmedVariants);
  const updates = scopes.flatMap((scope) => collectGiftReferenceUpdates(scope, gifts, { confirmedVariants, onlyConfirmed: true }));
  const references = new Set();
  const perGift = confirmedVariants.map(({ name, cost }) => ({ name, cost, references: 0, attributes: 0 }));
  for (const update of updates) {
    const label = labels.get(update.target);
    const entry = perGift.find((gift) => gift.name === label);
    if (!entry) throw new Error("Le plan touche une référence non confirmée ; réparation refusée.");
    entry.attributes += 1;
    if (!references.has(update.target)) {
      references.add(update.target);
      entry.references += 1;
    }
  }
  applyGiftReferenceUpdates(updates);
  verifyMetadataOnly(state, repaired);
  const uidKey = accountWorkspaceKey(cleanAccountUid(state.activeAccountUid));
  for (const [key, workspace] of Object.entries(state.accountWorkspaces || {})) {
    if (key !== uidKey && !isDeepStrictEqual(workspace, repaired.accountWorkspaces[key])) {
      throw new Error("Un autre compte aurait changé ; réparation refusée.");
    }
  }
  if (!isDeepStrictEqual(state.unclaimedAccountWorkspace, repaired.unclaimedAccountWorkspace)) {
    throw new Error("L'espace non revendiqué aurait changé ; réparation refusée.");
  }
  return { repaired, report: { applied: false, references: references.size, attributes: updates.length, changesByGift: perGift } };
}

/** Exécute un aperçu par défaut ; --apply exige arrêt, verrou, sauvegarde et contrôle de concurrence. */
function runRepair(options, dependencies = {}) {
  const statePath = path.resolve(options.statePath);
  const storage = dependencies.storage || new AtomicJsonStorage();
  const running = dependencies.isRunning || isShenPulseRunning;
  const gifts = dependencies.gifts || new GiftCatalog(path.resolve(__dirname, "../resources")).gifts;
  let original;
  try {
    original = storage.parseJsonFile(statePath);
  } catch {
    // Une erreur JSON peut contenir un extrait privé du fichier ; ne jamais le publier.
    throw new Error("Le fichier d'état est introuvable, illisible ou invalide ; aucune donnée n'a été modifiée.");
  }
  const { repaired, report } = prepareRepair(original.value, gifts, options.confirmedVariants);
  if (!options.apply) return report;
  if (running()) throw new Error("ShenPulse est encore ouvert ; fermez-le avant --apply. Aucune donnée n'a été modifiée.");
  if (!report.attributes) return report;
  const lockPath = `${statePath}.confirmed-gift-variants.lock`;
  let lock;
  try {
    lock = fs.openSync(lockPath, "wx", 0o600);
  } catch {
    throw new Error("Une réparation est déjà verrouillée ; aucune donnée n'a été modifiée.");
  }
  try {
    const ensureUnchanged = () => {
      if (running()) throw new Error("ShenPulse a été rouvert ; écriture refusée.");
      if (fs.readFileSync(statePath, "utf8") !== original.content) {
        throw new Error("Le fichier a changé pendant la préparation ; écriture refusée.");
      }
    };
    ensureUnchanged();
    const now = dependencies.now ? dependencies.now() : new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const stem = path.join(path.dirname(statePath), `shenpulse-state.before-confirmed-gift-variants-${timestamp}`);
    let backupPath = `${stem}.json`;
    for (let suffix = 1; fs.existsSync(backupPath); suffix += 1) backupPath = `${stem}-${suffix}.json`;
    storage.atomicWrite(backupPath, original.content, false);
    let backupContent;
    try {
      backupContent = storage.parseJsonFile(backupPath).content;
    } catch {
      throw new Error("La sauvegarde préalable est illisible ou invalide ; écriture refusée.");
    }
    if (backupContent !== original.content) {
      throw new Error("La sauvegarde préalable n'a pas pu être vérifiée ; écriture refusée.");
    }
    ensureUnchanged();
    storage.atomicWrite(statePath, JSON.stringify(repaired, null, 2));
    return { ...report, applied: true, backupPath };
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}

if (require.main === module) {
  try {
    process.stdout.write(`${JSON.stringify(runRepair(parseArguments(process.argv.slice(2))))}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ error: error.message })}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArguments, isShenPulseRunning, activeScopes, verifyMetadataOnly, prepareRepair, runRepair };
