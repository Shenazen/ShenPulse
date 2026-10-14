"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { StateStore } = require("../src/main/store");
const { ShenPulseCore } = require("../src/main/core");
const { ViewerService } = require("../src/main/viewer-service");
const { MAX_VIEWERS, normalizeViewerDatabase, parseViewerImport } = require("../src/main/viewers/normalization");
const ranks = require("../src/shared/viewer-ranks");

function fixture() {
  const state = createDefaultState();
  state.settings.account.uid = "fixture-owner";
  state.settings.tiktok.username = "creator";
  state.settings.kick.account = { name: "creator" };
  let mutations = 0;
  const store = { state, mutateRuntime(fn) { mutations += 1; fn(state); }, getState() { throw new Error("Un événement ne doit pas cloner la base."); } };
  const service = new ViewerService({ store, clock: () => "2026-10-13T10:00:00.000Z" });
  return { state, store, service, mutationCount: () => mutations };
}
function event(userId, type = "gift", data = {}, source = "source_tiktok", handle = "alice") {
  return { id: `${userId}-${type}`, source, type, timestamp: "2026-10-13T10:00:00.000Z",
    user: { id: userId, name: handle, displayName: "Alice", avatarUrl: "https://example.com/alice.webp" }, data: { count: 1, value: 1, ...data } };
}
function exported(rows, extra = {}) { return { format: "shenpulse-viewers", schemaVersion: 1, rows, ...extra }; }

test("les contributions sont cumulées entre LIVE avec ID plateforme/streamer et sans snapshot complet", () => {
  const { state, service, mutationCount } = fixture();
  service.recordEvent(event("1", "gift", { count: 3, value: 5 }));
  service.recordEvent(event("1", "like", { count: 12 }));
  service.recordEvent(event("1", "chat"));
  service.recordEvent(event("1", "share", { count: 2 }));
  state.session.running = false;
  state.session.startedAt = null;
  service.recordEvent(event("1", "gift", { value: 10 }));
  const result = service.snapshot();
  assert.equal(result.total, 1);
  assert.equal(result.rows[0].diamonds, 25);
  assert.equal(result.rows[0].gifts, 4);
  assert.equal(result.rows[0].likes, 12);
  assert.equal(result.rows[0].comments, 1);
  assert.equal(result.rows[0].shares, 2);
  assert.equal(result.rows[0].events, 5);
  assert.equal(result.rows[0].username, "alice");
  assert.equal(result.stats.dominantRank.id, "supporter");
  assert.equal(mutationCount(), 5);
});

test("TikTok/Kick et streamers distincts ne fusionnent jamais le même ID ou @", () => {
  const { service } = fixture();
  service.recordEvent(event("42"));
  service.recordEvent(event("42", "gift", {}, "source_kick"));
  service.recordEvent(event("42", "gift", { streamer: "other_creator" }));
  const all = service.snapshot({ streamer: "*" });
  assert.equal(all.total, 3);
  assert.equal(new Set(all.rows.map((row) => row.id)).size, 3);
  assert.equal(service.snapshot().total, 2);
  assert.equal(service.snapshot({ streamer: "other_creator" }).total, 1);
  assert.throws(() => service.merge({ ids: all.rows.slice(0, 2).map((row) => row.id) }), /même @/);
});

test("les simulateurs, démos et participants anonymes ne deviennent pas des utilisateurs réels", () => {
  const { service, mutationCount } = fixture();
  for (const source of ["test", "simulator", "demo", "demo-fixture", "rule-test", "manual-preview"]) assert.equal(service.recordEvent(event("1", "gift", {}, source)), false);
  assert.equal(service.recordEvent(event("anonymous")), false);
  assert.equal(service.snapshot().total, 0);
  assert.equal(mutationCount(), 0);
});

test("la base bornée conserve ses index et remet le prochain événement d'un viewer évincé", () => {
  const { state, service } = fixture();
  for (let index = 0; index <= MAX_VIEWERS; index += 1) service.recordEvent(event(String(index), "join"));
  assert.equal(state.viewerDatabase.rows.length, MAX_VIEWERS);
  assert.equal(service.index(state.viewerDatabase).byUser.size, MAX_VIEWERS);
  assert.equal(state.viewerDatabase.rows[0].userId, "1");
  service.recordEvent(event("0"));
  assert.equal(state.viewerDatabase.rows.length, MAX_VIEWERS);
  assert.equal(state.viewerDatabase.rows.at(-1).userId, "0");
});

test("les tris, rangs, dates et pagination filtrent sans altérer les totaux de la portée", () => {
  const { service } = fixture();
  service.recordEvent(event("1", "gift", { value: 500 }, "source_tiktok", "alice"));
  service.recordEvent({ ...event("2", "gift", { value: 5 }, "source_tiktok", "bob"), timestamp: "2026-10-13T11:00:00Z" });
  const result = service.snapshot({ query: "alice", rank: "vip", sort: "name", order: "asc", limit: 1 });
  assert.equal(result.total, 2);
  assert.equal(result.filteredTotal, 1);
  assert.equal(result.stats.diamonds, 505);
  assert.equal(result.stats.dominantRank.id, "vip");
  assert.equal(result.rows[0].rank, ranks.rankForDiamonds(500));
  result.rows[0].name = "modifié dans l'interface";
  assert.equal(service.snapshot().rows[0].name, "Alice");
  assert.equal(service.snapshot({ sort: "lastSeen", order: "asc", offset: 1 }).rows[0].username, "bob");
});

test("blocage et listes globales empêchent les interactions, pas l'enregistrement statistique", () => {
  const { service } = fixture();
  const incoming = event("1");
  service.recordEvent(incoming);
  service.setBlocked(service.snapshot().rows[0].id, true);
  assert.equal(service.isBlocked(incoming), true);
  service.recordEvent(incoming);
  assert.equal(service.snapshot().rows[0].diamonds, 2);
  service.setBlockedList(["@bob", "bob"]);
  assert.equal(service.isBlocked(incoming), false);
  assert.equal(service.isBlocked(event("2", "chat", {}, "source_tiktok", "bob")), true);
  assert.deepEqual(service.snapshot().blockedUsers, ["bob"]);
  service.clear();
  assert.equal(service.isBlocked(event("2", "chat", {}, "source_tiktok", "bob")), true);
});

test("fusion explicite préserve tous les ID et bloque les rapprochements ambigus", () => {
  const { service } = fixture();
  service.recordEvent(event("old", "gift", { value: 5 }));
  service.recordEvent(event("new", "gift", { value: 10 }));
  const ids = service.snapshot().rows.map((row) => row.id);
  service.merge({ ids });
  assert.equal(service.snapshot().total, 1);
  assert.equal(service.snapshot().rows[0].diamonds, 15);
  service.recordEvent(event("old", "gift", { value: 3 }));
  assert.equal(service.snapshot().total, 1);
  assert.equal(service.snapshot().rows[0].diamonds, 18);
  service.recordEvent(event("different", "gift", {}, "source_tiktok", "bob"));
  assert.throws(() => service.merge({ ids: service.snapshot().rows.map((row) => row.id) }), /même @/);
});

test("un @ en doublon peut être débloqué depuis chaque ligne sans garder un blocage invisible", () => {
  const { service } = fixture();
  service.recordEvent(event("first"));
  service.recordEvent(event("second"));
  const ids = service.snapshot().rows.map((row) => row.id);
  service.setBlocked(ids[0], true);
  assert.equal(service.snapshot().rows.every((row) => row.blocked), true);
  service.setBlocked(ids[1], false);
  assert.deepEqual(service.snapshot().blockedUsers, []);
  assert.equal(service.snapshot().rows.every((row) => !row.blocked), true);
  assert.equal(service.isBlocked(event("first")), false);
  assert.equal(service.isBlocked(event("second")), false);
});

test("la liste des blocages inclut les @ sans historique, reste paginée et distingue plateformes et streamers", () => {
  const { service, mutationCount } = fixture();
  service.setBlockedList(["@alice", "@before_live"]);
  service.setBlockedList(["@alice"], { streamer: "other_creator", platform: "tiktok" });
  service.recordEvent(event("first"));
  service.recordEvent(event("second"));
  const mutations = mutationCount();
  const current = service.snapshot({ includeBlocked: true, blockedLimit: 1, blockedOffset: 1 });
  assert.equal(current.blockedTotal, 4, "deux @ sur TikTok et Kick, sans doublonner les fiches");
  assert.equal(current.blockedEntries.length, 1);
  assert.deepEqual(current.blockedUsers, ["alice", "before_live"]);
  assert.equal(service.snapshot().blockedEntries, undefined, "aucune fiche de blocage n'est transmise à panneau fermé");
  const all = service.snapshot({ streamer: "*", includeBlocked: true, blockedLimit: 200 });
  assert.equal(all.blockedTotal, 5);
  assert.equal(all.blockedEntries.filter((row) => row.username === "alice" && row.platform === "tiktok" && row.streamer === "creator").length, 1);
  assert.equal(all.blockedEntries.some((row) => row.username === "before_live" && !row.rowId), true);
  assert.equal(all.streamers.includes("other_creator"), true, "un streamer avec seulement des blocages reste sélectionnable");
  all.blockedEntries[0].username = "mutated";
  assert.equal(service.snapshot({ includeBlocked: true }).blockedEntries.some((row) => row.username === "mutated"), false);
  assert.equal(mutationCount(), mutations, "consulter les blocages ne modifie aucune donnée");
});

test("débloquer un @ ciblé préserve les autres blocages, les doublons et toutes les contributions", () => {
  const { service } = fixture();
  service.recordEvent(event("first", "gift", { value: 5 }));
  service.recordEvent(event("second", "gift", { value: 10 }));
  service.setBlockedList(["alice", "before_live"]);
  service.setBlockedList(["alice"], { streamer: "other_creator", platform: "tiktok" });
  const before = service.export({ streamer: "*" }).rows.map(({ blocked, ...row }) => row);
  assert.deepEqual(service.unblock({ platform: "tiktok", streamer: "creator", username: "@ALICE" }), { updated: true });
  assert.equal(service.isBlocked(event("first")), false);
  assert.equal(service.isBlocked(event("second")), false);
  assert.equal(service.isBlocked(event("third", "chat", {}, "source_kick")), true);
  assert.equal(service.isBlocked(event("third", "chat", { streamer: "other_creator" })), true);
  assert.deepEqual(service.export({ streamer: "*" }).rows.map(({ blocked, ...row }) => row), before);
  assert.deepEqual(service.unblock({ platform: "tiktok", streamer: "creator", username: "before_live" }), { updated: true });
  assert.equal(service.isBlocked(event("new", "chat", {}, "source_tiktok", "before_live")), false);
  assert.equal(service.isBlocked(event("new", "chat", {}, "source_kick", "before_live")), true);
  assert.deepEqual(service.unblock({ platform: "tiktok", streamer: "creator", username: "before_live" }), { updated: false }, "un clic périmé ne remplace pas les nouveaux blocages");
  assert.throws(() => service.unblock({ platform: "unknown", streamer: "creator", username: "alice" }), /Plateforme/);
  assert.throws(() => service.unblock({ platform: "tiktok", streamer: "*", username: "alice" }), /Streamer/);
});

test("un ancien blocage par ID sans @ reste visible et ne peut débloquer une identité d'une autre portée", () => {
  const { state, service } = fixture();
  service.recordEvent(event("without_handle", "chat", {}, "source_tiktok", ""));
  const id = service.snapshot().rows[0].id;
  service.setBlocked(id, true);
  const entry = service.snapshot({ includeBlocked: true }).blockedEntries[0];
  assert.equal(entry.rowId, id);
  assert.equal(entry.username, "");
  assert.throws(() => service.unblock({ rowId: id, platform: "kick", streamer: "creator" }), /introuvable/);
  assert.throws(() => service.unblock({ rowId: id, platform: "tiktok", streamer: "other_creator" }), /introuvable/);
  assert.equal(state.viewerDatabase.rows[0].blocked, true);
  service.unblock({ rowId: id, platform: "tiktok", streamer: "creator" });
  assert.equal(service.snapshot({ includeBlocked: true }).blockedTotal, 0);
  assert.equal(state.viewerDatabase.rows[0].comments, 1);
});

test("les imports sont idempotents et ne recopient aucun secret ou champ non autorisé", () => {
  const { service } = fixture();
  service.recordEvent(event("1"));
  const payload = service.export();
  payload.rows[0].accessToken = "must-be-discarded";
  payload.rows[0].password = "must-be-discarded";
  payload.ownerUid = "foreign-owner";
  service.import(payload);
  service.import(JSON.stringify(payload));
  assert.equal(service.snapshot().total, 1);
  assert.equal(service.snapshot().rows[0].diamonds, 1);
  const result = JSON.stringify(service.export());
  assert.equal(result.includes("must-be-discarded"), false);
  assert.equal(result.includes("foreign-owner"), false);
  assert.equal(result.includes("accessToken"), false);
});

test("les imports refusent prototypes, accesseurs, objets arbitraires et limite excessive", () => {
  const { service } = fixture();
  service.recordEvent(event("1"));
  const row = service.export().rows[0];
  assert.throws(() => parseViewerImport('{"format":"shenpulse-viewers","schemaVersion":1,"rows":[],"__proto__":{"polluted":true}}'));
  assert.throws(() => parseViewerImport(exported([{ ...row, diamonds: new Date() }])));
  let invoked = 0;
  const malicious = { ...row };
  Object.defineProperty(malicious, "diamonds", { enumerable: true, get() { invoked += 1; return 50; } });
  assert.throws(() => parseViewerImport(exported([malicious])));
  assert.equal(invoked, 0);
  assert.throws(() => parseViewerImport(exported(Array.from({ length: MAX_VIEWERS + 1 }, () => ({ ...row })))), /10 000/);
  assert.throws(() => parseViewerImport(exported([{ ...row, userId: "" }])), /identité/);
  assert.throws(() => service.import({ rows: [row], format: "another-app", schemaVersion: 1 }), /ShenPulse/);
  assert.equal({}.polluted, undefined);
  assert.equal(service.snapshot().total, 1);
});

test("nettoyer/supprimer sont des opérations explicites limitées au streamer sélectionné", () => {
  const { service } = fixture();
  service.recordEvent(event("zero", "chat"));
  service.recordEvent(event("donor"));
  service.recordEvent(event("foreign", "chat", { streamer: "other_creator" }));
  assert.equal(service.cleanup().removed, 1);
  assert.equal(service.snapshot({ streamer: "*" }).total, 2);
  service.remove(service.snapshot().rows[0].id);
  assert.equal(service.snapshot({ streamer: "other_creator" }).total, 1);
  assert.equal(service.clear({ streamer: "*" }).removed, 1);
});

test("la normalisation des alias ne permet pas de voler l'identité principale d'un autre viewer", () => {
  const { service } = fixture();
  service.recordEvent(event("1"));
  service.recordEvent(event("2", "gift", {}, "source_tiktok", "bob"));
  const rows = service.export().rows;
  rows[0].alternateUserIds = [rows[1].userId];
  const normalized = normalizeViewerDatabase({ rows });
  assert.equal(normalized.rows[0].alternateUserIds.length, 0);
});

test("les comptes et profils gardent une audience isolée, persistante et absente du snapshot général", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-viewers-"));
  const store = new StateStore(directory, { isEncryptionAvailable: () => false });
  store.load();
  t.after(() => { store.flush(); fs.rmSync(directory, { recursive: true, force: true }); });
  store.activateAccount("owner-a");
  store.mutate((state) => { state.settings.tiktok.username = "creator-a"; });
  const service = new ViewerService({ store });
  service.recordEvent(event("1"));
  const profiles = store.getState().profiles;
  store.upsert("profiles", { id: "second", name: "Second" });
  store.selectProfile("second");
  assert.equal(service.snapshot().total, 1, "l'audience n'est pas liée au profil de jeu");
  assert.equal(store.getState().viewerDatabase, undefined);
  store.activateAccount("owner-b");
  assert.equal(service.snapshot({ streamer: "*" }).total, 0);
  store.mutate((state) => { state.settings.tiktok.username = "creator-b"; });
  service.recordEvent(event("2"));
  assert.equal(service.snapshot().rows[0].userId, "2");
  store.activateAccount("owner-a");
  assert.equal(service.snapshot().rows[0].userId, "1");
  assert.equal(store.getState().profiles.length, profiles.length + 1);
  store.flush();
  const persisted = JSON.parse(fs.readFileSync(store.filePath, "utf8"));
  assert.equal(persisted.viewerDatabase.rows.length, 1);
  assert.equal(Object.values(persisted.accountWorkspaces).filter((workspace) => workspace.viewerDatabase.rows.length === 1).length, 2);
  store.deactivateAccount();
  assert.equal(service.snapshot({ streamer: "*" }).total, 0);
});

test("l'ingestion bloquée conserve les chiffres mais ne publie ni voix, ni jeu, ni commande", async (t) => {
  const store = new StateStore(path.join(os.tmpdir(), "shenpulse-viewers-core-memory"));
  store.touch = () => {};
  store.state.activeAccountUid = "fixture-owner";
  store.state.settings.account = { uid: "fixture-owner", email: "owner@example.com", refreshTokenSecretId: "fixture-token" };
  store.state.commerce.subscription = { tier: "pro", status: "active" };
  store.secrets["fixture-token"] = { encrypted: false, value: Buffer.from("fixture-only-token").toString("base64") };
  store.state.settings.tiktok = { ...store.state.settings.tiktok, username: "creator", status: "live" };
  store.state.connections.push({ id: "source_tiktok", type: "tiktok-direct", enabled: true, status: "connected" });
  store.state.session.running = true;
  const notifications = [];
  const core = new ShenPulseCore({ store, resourcesDirectory: path.resolve(__dirname, "../resources"), notifyRenderer: (channel, data) => notifications.push({ channel, data }) });
  t.after(() => { clearTimeout(core.deferredChangeTimer); core.liveEventActions.chatbot.reset(); core.overlayCompletionController.stop(); });
  core.viewerService.setBlockedList(["alice"]);
  let publications = 0;
  let commands = 0;
  let sent = 0;
  let rules = 0;
  core.overlayServer.publishEvent = () => { publications += 1; };
  core.sourceHub.runtimes.set("source_tiktok", {});
  core.sourceHub.send = async () => { sent += 1; };
  core.spotifyService.control = async (_config, options) => { assert.equal(options.shouldExecute(), true); commands += 1; return { ok: true }; };
  core.ruleEngine.process = async () => { rules += 1; };
  store.state.commands = [{ id: "hello", enabled: true, command: "!hello", execution: { type: "music", operation: "next" }, cooldownMs: 0 }];
  assert.equal(core.liveEventActions.chatbot.hasFunctionalCommand(event("1", "chat", { message: "!hello" })), true);
  const result = await core.ingest(event("1", "chat", { message: "!hello" }));
  assert.equal(result.moderationBlocked, true);
  assert.equal(store.state.statistics.liveSession.comments, 1);
  assert.equal(store.state.statistics.sessionEvents, 1);
  assert.equal(core.viewerService.snapshot().rows[0].comments, 1);
  assert.equal(publications, 0);
  assert.equal(commands, 0);
  assert.equal(sent, 0);
  assert.equal(rules, 0);
  assert.equal(notifications.some((item) => item.channel === "live-event" || item.channel === "playback"), false);
  // Contrôle positif : mêmes droits, source LIVE et commande, sans blocage.
  // La preuve ne dépend donc pas d'une entrée legacy ignorée ou d'un invité.
  core.viewerService.setBlockedList([]);
  await core.ingest(event("2", "chat", { message: "!hello" }, "source_tiktok", "bob"));
  await core.liveEventActions.chatbot.whenIdle();
  assert.equal(commands, 1);
  assert.equal(sent, 0);
});
