"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const test = require("node:test");
const crypto = require("node:crypto");
const { buildProtectedMatchMedia } = require("../scripts/build-protected-match-media");
const { ProtectedMatchMediaStore, MAX_CACHE_BYTES } = require("../src/main/match-media/store");
const { encryptMedia, decryptMedia } = require("../src/main/match-media/format");
const { OverlayServer } = require("../src/main/overlay-server");
const { selectStatePaths } = require("../src/main/state-projection");
const catalog = require("../resources/overlays/overlay-catalog");
const packageJson = require("../package.json");

function temporaryFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-protected-match-test-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sourceDirectory = path.join(root, "source");
  const outputDirectory = path.join(root, "private");
  fs.mkdirSync(sourceDirectory);
  const definitions = ["x2", "x3", "cofre"].map((match, index) => ({ previewKind: "match", match, options: [["tikcontrol", "TikControl"]], index }));
  for (const item of definitions) fs.writeFileSync(path.join(sourceDirectory, `${item.match}-tikcontrol.webm`), Buffer.alloc(64, 10 + item.index));
  const options = { sourceDirectory, outputDirectory, definitions };
  buildProtectedMatchMedia(options);
  return { root, sourceDirectory, outputDirectory, definitions, options };
}

test("le paquet n’exporte plus de WebM Match claire ni de pont de préparation", () => {
  const source = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  assert.ok(!packageJson.build.asarUnpack.some((entry) => entry.includes("overlays/media/video")));
  assert.ok(packageJson.build.files.includes("!resources/overlays/media/video/**/*.webm"));
  assert.ok(packageJson.build.files.includes("!resources/overlays/media/video/**/*.mp4"));
  for (const file of ["src/main/main.js", "src/main/ipc/settings.js", "src/main/preload.js"]) {
    assert.doesNotMatch(source(file), /MatchVideoCache|matchVideoCache|overlay:match-video-prepare|prepareMatchVideo/);
  }
  assert.equal(fs.existsSync(path.join(__dirname, "../src/main/match-video-export.js")), false);
  assert.notEqual(path.resolve(__dirname, "../resources/protected-match-media"), path.resolve(__dirname, "../resources/overlays"));
  for (const build of ["build:dir", "build:store", "build:installer"]) assert.match(packageJson.scripts[build], /matches:protect/);
});

test("le constructeur produit toutes les variantes déclarées et des octets différents des vidéos", async (t) => {
  const directory = path.join(__dirname, "../resources/protected-match-media");
  const store = new ProtectedMatchMediaStore({ directory });
  t.after(() => store.clear());
  const declared = catalog.definitions.filter((entry) => entry.previewKind === "match")
    .flatMap((entry) => entry.options.map(([variant]) => `${entry.match}-${variant}.webm`));
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, "manifest.json"), "utf8"));
  assert.deepEqual(Object.keys(manifest.entries).sort(), declared.sort());
  for (const name of declared) {
    const source = fs.readFileSync(path.join(__dirname, "../resources/overlays/media/video", name));
    const encrypted = fs.readFileSync(path.join(directory, manifest.entries[name].file));
    assert.notDeepEqual(encrypted.subarray(0, 32), source.subarray(0, 32));
    const lease = await store.acquire(name);
    assert.deepEqual(lease.bytes, source);
    assert.ok(store.cacheBytes <= MAX_CACHE_BYTES);
    lease.release();
  }
});

test("la génération est stable, répare le chiffré corrompu et régénère lors d’une nouvelle clé", (t) => {
  const h = temporaryFixture(t);
  assert.deepEqual(buildProtectedMatchMedia(h.options), { count: 3, rebuilt: 0 });
  const target = path.join(h.outputDirectory, "x2-tikcontrol.webm.spm");
  const changed = fs.readFileSync(target); changed[changed.length - 1] ^= 1;
  fs.writeFileSync(target, changed);
  assert.deepEqual(buildProtectedMatchMedia(h.options), { count: 3, rebuilt: 1 });
  fs.unlinkSync(path.join(h.outputDirectory, "client-key.json"));
  assert.deepEqual(buildProtectedMatchMedia(h.options), { count: 3, rebuilt: 3 });
  assert.deepEqual(fs.readdirSync(h.outputDirectory).filter((name) => name.endsWith(".tmp")), []);
  assert.throws(() => buildProtectedMatchMedia({ ...h.options, outputDirectory: path.join(h.sourceDirectory, "private") }), /hors du dossier public/);
  assert.throws(() => buildProtectedMatchMedia({ ...h.options, outputDirectory: path.join(__dirname, "../resources/overlays/private") }), /hors du dossier public/);
});

test("GCM refuse corruption, permutation de nom et métadonnées trafiquées", async (t) => {
  const h = temporaryFixture(t);
  const key = crypto.randomBytes(32);
  const input = Buffer.alloc(64, 7);
  const encrypted = encryptMedia(input, key, "x2-tikcontrol.webm");
  assert.deepEqual(decryptMedia(encrypted, key, "x2-tikcontrol.webm", input.length), input);
  encrypted[14] ^= 1;
  assert.throws(() => decryptMedia(encrypted, key, "x2-tikcontrol.webm", input.length), /intégrité/);
  assert.throws(() => decryptMedia(encryptMedia(input, key, "x2-tikcontrol.webm"), key, "x3-tikcontrol.webm", input.length), /intégrité/);
  const manifestPath = path.join(h.outputDirectory, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.entries["x2-tikcontrol.webm"].file = "../../source/x2-tikcontrol.webm";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const store = new ProtectedMatchMediaStore({ directory: h.outputDirectory });
  t.after(() => store.clear());
  await assert.rejects(store.acquire("x2-tikcontrol.webm"), /indisponible/);
  assert.throws(() => store.metadata("../x2-tikcontrol.webm"), /inconnue/);
});

test("le cache mémoire est borné, ne détruit pas une réponse active et efface TTL/révocation", async (t) => {
  const h = temporaryFixture(t);
  let now = 1;
  const store = new ProtectedMatchMediaStore({ directory: h.outputDirectory, maxCacheBytes: 128, ttlMs: 20, now: () => now });
  t.after(() => store.clear());
  const first = await store.acquire("x2-tikcontrol.webm");
  const second = await store.acquire("x3-tikcontrol.webm");
  await assert.rejects(store.acquire("cofre-tikcontrol.webm"), /cache disponible/);
  assert.equal(first.bytes[0], 10, "le bail actif ne doit pas être effacé");
  first.release();
  const third = await store.acquire("cofre-tikcontrol.webm");
  assert.ok(first.bytes.every((byte) => byte === 0));
  assert.equal(store.cacheBytes, 128);
  second.release(); third.release();
  now += 21; store.prune();
  assert.equal(store.cacheBytes, 0);
  assert.ok(second.bytes.every((byte) => byte === 0));
  const pending = store.acquire("x2-tikcontrol.webm");
  store.clear();
  await assert.rejects(pending, /révoquée/);
  const last = await store.acquire("x2-tikcontrol.webm");
  store.clear();
  assert.equal(last.bytes[0], 10, "l’écriture déjà active est conservée jusqu’à la fermeture");
  last.release();
  assert.ok(last.bytes.every((byte) => byte === 0));
  assert.equal(store.cacheBytes, 0);
});

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer(); probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => { const port = probe.address().port; probe.close(() => resolve(port)); });
  });
}

async function httpFixture(t) {
  const h = temporaryFixture(t);
  const state = { settings: { overlayPort: await freePort(), apiPort: await freePort(), overlayToken: "preview-token", apiToken: "api-token",
    account: { uid: "fixture-account", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-secret" }, matchAccess: { accessKey: "a".repeat(32) }, tiktok: { roomId: "fixture-room" },
    publicOverlayRelay: { matchChannelId: "m".repeat(24), publicBaseUrl: "https://shenpulse-overlays.web.app" } },
    session: { profileId: "fixture-profile" }, commerce: { subscription: { tier: "pro", status: "active" } } };
  const media = new ProtectedMatchMediaStore({ directory: h.outputDirectory });
  const store = { getStateProjection: (keys) => selectStatePaths(state, keys), getSecret: (id) => id === "fixture-secret" ? "fixture-refresh-value" : "" };
  const server = new OverlayServer({ store, staticDirectory: path.join(__dirname, "../resources/overlays"), matchMedia: media,
    onInboundEvent: async () => {}, onEffectRequest: async () => ({}) });
  await server.start();
  t.after(() => server.stop());
  const base = `http://127.0.0.1:${state.settings.overlayPort}`;
  return { ...h, state, server, media, base, ticketUrl: `${base}/match-preview/ticket?match=x2&variant=tikcontrol&token=preview-token` };
}

test("l’aperçu passe par ticket Pro, GET/HEAD/Range et ne sert aucun fichier clair", { timeout: 10000 }, async (t) => {
  const h = await httpFixture(t);
  const ticketReply = await fetch(h.ticketUrl);
  assert.equal(ticketReply.status, 200);
  const ticket = await ticketReply.json();
  assert.deepEqual(Object.keys(ticket).sort(), ["expiresAt", "url"]);
  assert.match(ticket.url, /^\/match-media\/[A-Za-z0-9_-]{32}$/);
  const url = `${h.base}${ticket.url}`;
  const head = await fetch(url, { method: "HEAD" });
  assert.equal(head.status, 200); assert.equal(head.headers.get("content-length"), "64");
  assert.equal(h.media.cacheBytes, 0, "HEAD ne déchiffre pas la vidéo");
  const response = await fetch(url, { headers: { Range: "bytes=5-9" } });
  assert.equal(response.status, 206); assert.equal(response.headers.get("content-range"), "bytes 5-9/64");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.alloc(5, 10));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await fetch(url, { headers: { Range: "bytes=bad" } })).status, 416);
  for (const route of ["/overlay/media/video/x2-tikcontrol.webm", "/overlay/media/video/../video/x2-tikcontrol.webm"]) {
    assert.equal((await fetch(`${h.base}${route}?token=preview-token`)).status, 403);
  }
  assert.equal((await fetch(`${h.base}/overlay/media/video/posters/x2-tikcontrol.webp?token=preview-token`)).status, 200);
  assert.equal((await fetch(h.ticketUrl.replace("preview-token", "wrong"))).status, 403);
  assert.equal((await fetch(h.ticketUrl, { method: "POST" })).status, 405);
  assert.equal((await fetch(h.ticketUrl, { headers: { Origin: "https://untrusted.invalid" } })).status, 403);
  const cached = h.media.cache.get("x2-tikcontrol.webm").bytes;
  h.state.session.profileId = "next-profile"; h.server.refreshAccess();
  assert.ok(cached.every((byte) => byte === 0)); assert.equal(h.media.cacheBytes, 0);
  assert.equal((await fetch(url)).status, 403);
  h.state.commerce.subscription.status = "revoked";
  assert.equal((await fetch(h.ticketUrl)).status, 403);
});

test("un paquet corrompu ne retombe jamais sur la WebM brute pourtant présente en développement", { timeout: 10000 }, async (t) => {
  const h = await httpFixture(t);
  const ticket = await (await fetch(h.ticketUrl)).json();
  const target = path.join(h.outputDirectory, "x2-tikcontrol.webm.spm");
  const bytes = fs.readFileSync(target); bytes[12] ^= 1; fs.writeFileSync(target, bytes);
  assert.equal((await fetch(`${h.base}${ticket.url}`)).status, 503);
  assert.equal(h.media.cacheBytes, 0);
  assert.ok(fs.existsSync(path.join(__dirname, "../resources/overlays/media/video/x2-tikcontrol.webm")));
});

test("la nouvelle API d’aperçu exige compte authentifié et visibilité Matchs, puis révoque ses tickets et mémoire", { timeout: 10000 }, async (t) => {
  const h = await httpFixture(t);
  const ticket = await (await fetch(h.ticketUrl)).json();
  const mediaUrl = `${h.base}${ticket.url}`;
  assert.equal((await fetch(mediaUrl)).status, 200);
  const cached = h.media.cache.get("x2-tikcontrol.webm").bytes;
  h.state.settings.account.refreshTokenSecretId = "missing-secret";
  assert.equal((await fetch(h.ticketUrl)).status, 403);
  assert.equal((await fetch(mediaUrl)).status, 403);
  assert.ok(cached.every((byte) => byte === 0));
  h.state.settings.account.refreshTokenSecretId = "fixture-secret";
  const next = await (await fetch(h.ticketUrl)).json();
  assert.equal((await fetch(`${h.base}${next.url}`, { headers: { Range: "bytes=0-15" } })).status, 206);
  const current = h.media.cache.get("x2-tikcontrol.webm").bytes;
  h.state.settings.siteVisibility = { navigation: { matches: "hidden" } };
  h.server.refreshAccess();
  assert.equal((await fetch(h.ticketUrl)).status, 403);
  assert.equal((await fetch(`${h.base}${next.url}`)).status, 403);
  assert.ok(current.every((byte) => byte === 0));
  h.state.settings.siteVisibility = {};
  h.state.settings.account.email = "";
  assert.equal((await fetch(h.ticketUrl)).status, 403);
});
