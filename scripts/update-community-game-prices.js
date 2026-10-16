"use strict";

/** Prix de quatre jeux : inspection par défaut, publication explicite --apply.
 * Seule l'API commerciale existante est utilisée. Elle exige un brouillon
 * identique à la production, sans promotion applicable ni perte de schéma.
 * Une relecture exacte précède l'écriture (pas de CAS proposé par cette API).
 * Le canal test est conservé ; aucune release, commande PayPal ou donnée de
 * compte réelle n'est écrite. La sauvegarde privée ne contient aucun jeton.
 * Le profil temporaire marqué se nettoie après arrêt avec --cleanup-profile.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { isDeepStrictEqual } = require("node:util");
const { randomUUID } = require("node:crypto");
const { AccountService } = require("../src/main/account-service");
const { FIREBASE_DATABASE_URL, SHENPULSE_API_URL } = require("../src/main/admin/constants");
const { cloneEncryptionProfile, isEntryPoint, removeSmokeProfile, sha256 } = require("./smoke-media-upload");
const { ownerMemoryStore, verifiedOwnerIdentity } = require("./maintenance/restrict-owner-pages");

const TARGETS = Object.freeze({ "tiklive-climb": "9.99", "clash-of-live": "12.99", "tiklive-cube-wars": "9.99", "tiklive-stack-tower": "9.99" });
const TITLES = Object.freeze({ "tiklive-climb": "Climb", "clash-of-live": "Clash Of ShenPulse", "tiklive-cube-wars": "ShenPulse Cube Wars", "tiklive-stack-tower": "ShenPulse Stack Tower" });
let phase = "startup";
function emit(value) { process.stdout.write(`${JSON.stringify(value)}\n`); }
function requireCondition(value, code) { if (!value) throw new Error(code); }
function withoutMetadata(catalog) {
  const value = structuredClone(catalog || {});
  for (const key of ["updatedAt", "updatedByEmail", "updatedByUid"]) delete value[key];
  return value;
}
function priceSummary(catalog) {
  return Object.fromEntries(Object.keys(TARGETS).map((id) => {
    const item = catalog?.products?.[id];
    return [id, item ? { baseAmount: item.baseAmount, currency: item.currency, accessMode: item.accessMode, enabled: item.enabled } : null];
  }));
}
function promotionSummary(catalog) {
  return Object.fromEntries(Object.keys(TARGETS).map((id) => [id, Object.values(catalog?.promotions || {}).filter((item) =>
    item.enabled !== false && (!Array.isArray(item.productIds) || !item.productIds.length || item.productIds.includes(id)))
    .map((item) => ({ type: item.type, value: item.value, startsAt: item.startsAt || "", endsAt: item.endsAt || "" }))]));
}
/** Validation conservatrice du schéma normalisé par le backend : tout champ
 * inconnu ou valeur que son normaliseur changerait interdit la publication. */
function validateCatalog(catalog) {
  const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
    isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort());
  const id = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{1,79}$/.test(value);
  const text = (value, max) => typeof value === "string" && !!value && value === value.trim() && value.length <= max;
  const order = (value) => Number.isInteger(value) && value >= -100000 && value <= 100000;
  const amount = (value) => typeof value === "string" && /^(?:0|[1-9]\d*)\.\d{2}$/.test(value) && Number(value) > 0 && Number(value) <= 100000;
  const date = (value) => value === "" || typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
  requireCondition(exactKeys(catalog, ["schemaVersion", "products", "promotions", "subscriptions", "updatedAt", "updatedByEmail", "updatedByUid"]) && catalog.schemaVersion === 2, "CATALOG_SCHEMA_CHANGED");
  for (const name of ["products", "promotions", "subscriptions"]) requireCondition(catalog[name] && typeof catalog[name] === "object" && !Array.isArray(catalog[name]), "CATALOG_SCHEMA_CHANGED");
  requireCondition(Object.keys(catalog.products).length <= 500 && Object.keys(catalog.promotions).length <= 100, "CATALOG_SCHEMA_CHANGED");
  for (const [key, row] of Object.entries(catalog.products)) {
    requireCondition(exactKeys(row, ["accessMode", "baseAmount", "currency", "enabled", "id", "sortOrder", "title", "trialEligible"]) && id(key) && row.id === key &&
      ["purchase", "included"].includes(row.accessMode) && (row.accessMode === "included" ? row.baseAmount === "0.00" : amount(row.baseAmount)) &&
      /^[A-Z]{3}$/.test(row.currency) && typeof row.enabled === "boolean" && typeof row.trialEligible === "boolean" && order(row.sortOrder) && text(row.title, 120), "CATALOG_SCHEMA_CHANGED");
  }
  requireCondition(isDeepStrictEqual(Object.keys(catalog.subscriptions).sort(), ["premium", "pro"]), "CATALOG_SCHEMA_CHANGED");
  for (const [key, row] of Object.entries(catalog.subscriptions)) requireCondition(exactKeys(row, ["currency", "enabled", "priceMonthly", "sortOrder", "tier", "title"]) &&
    row.currency === "EUR" && row.tier === key && typeof row.enabled === "boolean" && amount(row.priceMonthly) && order(row.sortOrder) && text(row.title, 80), "CATALOG_SCHEMA_CHANGED");
  for (const [key, row] of Object.entries(catalog.promotions)) requireCondition(exactKeys(row, ["enabled", "endsAt", "id", "productIds", "startsAt", "title", "type", "value"]) &&
    id(key) && row.id === key && typeof row.enabled === "boolean" && date(row.startsAt) && date(row.endsAt) && text(row.title, 120) &&
    ["fixed", "percent"].includes(row.type) && typeof row.value === "number" && row.value > 0 && row.value <= (row.type === "percent" ? 95 : 100000) && Number(row.value.toFixed(2)) === row.value &&
    Array.isArray(row.productIds) && new Set(row.productIds).size === row.productIds.length && row.productIds.every((value) => id(value) && catalog.products[value]), "CATALOG_SCHEMA_CHANGED");
  for (const key of ["updatedAt", "updatedByEmail", "updatedByUid"]) requireCondition(typeof catalog[key] === "string", "CATALOG_SCHEMA_CHANGED");
  return catalog;
}
function proposedCatalog(admin, now = Date.now()) {
  const channels = admin?.channels;
  for (const name of ["prod", "draft", "test"]) validateCatalog(channels?.[name]);
  requireCondition(isDeepStrictEqual(withoutMetadata(channels.prod), withoutMetadata(channels.draft)), "DRAFT_DIFFERS_FROM_PROD");
  requireCondition(Array.isArray(admin.history), "HISTORY_MISSING");
  for (const rows of Object.values(promotionSummary(channels.prod))) requireCondition(!rows.some((item) =>
    (!item.startsAt || Date.parse(item.startsAt) <= now) && (!item.endsAt || Date.parse(item.endsAt) > now)), "TARGET_PROMOTION_ACTIVE");
  const result = structuredClone(channels.prod);
  let sortOrder = Math.min(99960, Math.max(0, ...Object.values(result.products).map((row) => row.sortOrder)));
  for (const [id, baseAmount] of Object.entries(TARGETS)) {
    const previous = result.products[id];
    if (previous) requireCondition(previous.accessMode === "purchase" && previous.currency === "EUR", "TARGET_ACCESS_CHANGED");
    result.products[id] = previous ? { ...previous, baseAmount } : {
      id, title: TITLES[id], accessMode: "purchase", baseAmount, currency: "EUR", enabled: true, trialEligible: true, sortOrder: sortOrder += 10
    };
  }
  return validateCatalog(result);
}
function commerceClient(identity, fetchImpl = globalThis.fetch) {
  const request = async (url, headers = {}) => {
    const response = await fetchImpl(url, { headers: { "Cache-Control": "no-store", ...headers },
      redirect: "error", credentials: "omit", signal: AbortSignal.timeout(20000) });
    return { status: response.status, etag: response.headers.get("etag"), value: response.ok ? await response.json() : null };
  };
  const adminUrl = `${SHENPULSE_API_URL}/api/admin/commerce`;
  return {
    readAdmin: () => request(`${adminUrl}?ownerId=${encodeURIComponent(identity.uid)}`, { Authorization: `Bearer ${identity.idToken}` }),
    readFirebase: (node) => request(`${FIREBASE_DATABASE_URL}/site/${node}.json?auth=${encodeURIComponent(identity.idToken)}`, { "X-Firebase-ETag": "true" }),
    async publish(catalog) {
      const response = await fetchImpl(adminUrl, { method: "PUT", headers: { Authorization: `Bearer ${identity.idToken}`, "Content-Type": "application/json", "Cache-Control": "no-store" },
        body: JSON.stringify({ ownerId: identity.uid, action: "publish-prod", catalog }), redirect: "error", credentials: "omit", signal: AbortSignal.timeout(20000) });
      requireCondition(response.ok, "PUBLISH_REFUSED");
      return response.json();
    }
  };
}
async function inspect(client, report = emit) {
  phase = "read-admin";
  const admin = await client.readAdmin();
  if (admin.status !== 200) { report({ phase, status: admin.status, adminAccess: false }); throw new Error("ADMIN_REFUSED"); }
  const channels = admin.value.channels;
  if (!channels?.prod || !channels?.draft || !channels?.test) throw new Error("CATALOG_MISSING");
  let publicationSafe = false;
  try { proposedCatalog(admin.value); publicationSafe = true; } catch { /* Résumé sans exposer le catalogue privé. */ }
  report({ phase, status: admin.status, adminAccess: true,
    publicationSafe,
    draftMatchesProd: isDeepStrictEqual(withoutMetadata(channels.prod), withoutMetadata(channels.draft)),
    prices: Object.fromEntries(["prod", "draft", "test"].map((name) => [name, priceSummary(channels[name])])),
    promotions: promotionSummary(channels.prod) });
  phase = "read-firebase";
  const raw = {};
  for (const [name, node] of [["prod", "commerceCatalog"], ["draft", "adminCommerce/draft"], ["test", "commerceCatalogTest"]]) {
    const result = await client.readFirebase(node);
    raw[name] = result;
    report({ phase, channel: name, status: result.status, readable: result.status === 200, etagAvailable: Boolean(result.etag),
      prices: result.status === 200 ? priceSummary(result.value) : undefined,
      matchesAdmin: result.status === 200 ? isDeepStrictEqual(result.value, channels[name]) : undefined });
  }
  return { admin: admin.value, raw };
}
function writeBackup(admin, backupRoot = path.resolve(__dirname, "..", ".artifacts", "community-price-update")) {
  const directory = path.join(backupRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "catalogs-before.json");
  const value = { version: 1, channels: admin.channels, history: admin.history };
  const descriptor = fs.openSync(file, "wx", 0o600);
  try { fs.writeFileSync(descriptor, JSON.stringify(value, null, 2)); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  requireCondition(isDeepStrictEqual(JSON.parse(fs.readFileSync(file, "utf8")), value), "BACKUP_INVALID");
}
function assertPostcheck(before, after, expected) {
  for (const name of ["prod", "draft"]) requireCondition(isDeepStrictEqual(withoutMetadata(after.channels?.[name]), withoutMetadata(expected)), "POSTCHECK_FAILED");
  requireCondition(isDeepStrictEqual(after.channels?.test, before.channels.test), "POSTCHECK_FAILED");
  const oldIds = new Set(before.history.map((item) => item.id));
  const added = after.history?.filter((item) => !oldIds.has(item.id)) || [];
  requireCondition(added.length === 1 && added[0].action === "publish-prod" && added[0].channel === "prod", "HISTORY_CHANGED");
  // L'API renvoie les 30 plus récents : une entrée ancienne peut sortir de
  // cette fenêtre sans être supprimée de Firebase.
  const retained = before.history.slice(0, 29);
  requireCondition(retained.every((item) => isDeepStrictEqual(after.history.find((row) => row.id === item.id), item)), "HISTORY_CHANGED");
}
async function updatePrices({ client, apply = false, backup = writeBackup, report = emit }) {
  const { admin: before } = await inspect(client, report);
  if (!apply) return before;
  phase = "validate-plan";
  const expected = proposedCatalog(before);
  if (isDeepStrictEqual(withoutMetadata(expected), withoutMetadata(before.channels.prod))) { report({ phase: "already-current", prices: priceSummary(expected) }); return before; }
  phase = "backup"; await backup(before);
  phase = "preflight";
  const current = await client.readAdmin();
  requireCondition(current.status === 200 && isDeepStrictEqual(current.value, before), "CATALOG_CHANGED");
  proposedCatalog(current.value);
  phase = "publish-four-products"; await client.publish(expected);
  phase = "verify";
  const next = await client.readAdmin();
  requireCondition(next.status === 200, "POSTCHECK_FAILED");
  assertPostcheck(before, next.value, expected);
  report({ phase: "applied", prices: priceSummary(next.value.channels.prod), testPreserved: true, previousHistoryPreserved: true });
  return next.value;
}
async function main() {
  const cleanup = process.argv.indexOf("--cleanup-profile");
  if (cleanup >= 0) { removeSmokeProfile(process.argv[cleanup + 1]); emit({ phase: "cleanup", status: "removed" }); return; }
  requireCondition(!(process.argv.includes("--apply") && process.argv.includes("--inspect")), "MODE_AMBIGUOUS");
  const { app } = require("electron");
  if (!app?.whenReady) throw new Error("ELECTRON_REQUIRED");
  const roaming = process.env.APPDATA;
  if (!roaming || !path.isAbsolute(roaming)) throw new Error("SESSION_MISSING");
  const userData = path.join(roaming, "ShenPulse");
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-media-smoke-"));
  fs.writeFileSync(path.join(temporary, ".shenpulse-media-smoke-owned"), JSON.stringify({ kind: "shenpulse-media-smoke-v1", pid: process.pid }), { flag: "wx" });
  phase = "isolate-encryption-profile";
  cloneEncryptionProfile(userData, temporary);
  app.setName("ShenPulseCommunityPricesInspection");
  app.setPath("userData", temporary); app.setPath("sessionData", temporary); app.disableHardwareAcceleration();
  await app.whenReady();
  let ok = false;
  const realFiles = ["shenpulse-state.json", "shenpulse-secrets.json", "Local State"].map((name) => path.join(userData, name));
  const before = realFiles.map((file) => fs.readFileSync(file));
  try {
    phase = "verify-owner";
    const state = JSON.parse(before[0]);
    const secrets = JSON.parse(before[1]);
    const store = ownerMemoryStore(state, secrets, require("electron").safeStorage);
    const identity = await verifiedOwnerIdentity(store, new AccountService({ store }));
    await updatePrices({ client: commerceClient(identity), apply: process.argv.includes("--apply") });
    ok = true;
  } catch { emit({ phase, status: "failed" }); }
  finally {
    // ShenPulse peut sauvegarder pendant l'opération : ne rien restaurer et
    // ne pas présenter un changement externe comme une écriture du helper.
    const unchanged = realFiles.every((file, index) => sha256(fs.readFileSync(file)) === sha256(before[index]));
    emit({ phase: "real-files", status: unchanged ? "unchanged" : "changed-externally" });
    app.exit(ok ? 0 : 1);
  }
}
if (isEntryPoint({ nodeMain: require.main === module, processType: process.type, argv: process.argv, scriptPath: __filename })) {
  main().catch(() => { emit({ phase, status: "failed" }); if (process.type === "browser") require("electron").app.exit(1); process.exitCode = 1; });
}
module.exports = { TARGETS, assertPostcheck, commerceClient, inspect, priceSummary, promotionSummary, proposedCatalog, updatePrices, validateCatalog, withoutMetadata, writeBackup };
