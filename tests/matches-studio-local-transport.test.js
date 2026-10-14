"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const net = require("node:net");
const path = require("node:path");
const { OverlayServer } = require("../src/main/overlay-server");
const { matchAccountNumber } = require("../src/main/match-access");
const { selectStatePaths } = require("../src/main/state-projection");

/** Serveur réel isolé : aucun compte, LIVE, relais Firebase ni effet utilisateur. */
async function fixture() {
  const port = () => new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
    });
  });
  const state = {
    settings: {
      overlayPort: await port(), apiPort: await port(), overlayToken: "private-overlay-token", apiToken: "private-api-token",
      account: { uid: "studio-local-account", email: "private@example.invalid", refreshTokenSecretId: "test-auth-secret" }, matchAccess: { accessKey: "a".repeat(32) },
      tiktok: { roomId: "private-room" }, publicOverlayRelay: { publicBaseUrl: "https://shenpulse-overlays.web.app", matchChannelId: "m".repeat(24) },
      matches: { widgets: { scoreboard: { enabled: true } } }
    },
    session: { profileId: "private-profile", running: true }, overlaySession: { likes: 5 },
    commerce: { subscription: { tier: "pro", status: "active" } },
    matchSession: { status: "active", participants: [{ username: "test-viewer", score: 25, own: true }] },
    profiles: [{ id: "private-unused-profile" }]
  };
  const store = {
    getState() { throw new Error("Le transport Studio ne lit jamais tout le magasin."); },
    getStateProjection: (keys) => selectStatePaths(state, keys),
    getSecret: () => "test-refresh-token"
  };
  const server = new OverlayServer({ store, staticDirectory: path.join(__dirname, "../resources/overlays"),
    onInboundEvent: async () => {}, onEffectRequest: async () => ({}) });
  await server.start();
  const base = `http://127.0.0.1:${state.settings.overlayPort}`;
  const bridge = `${base}/match-bridge/${matchAccountNumber(state.settings.account.uid)}/${state.settings.publicOverlayRelay.matchChannelId}`;
  return { server, state, store, base, bridge };
}

test("Studio lit le document et la projection Match en même origine sans clé privée", { timeout: 10000 }, async () => {
  const h = await fixture();
  try {
    const document = await fetch(h.bridge);
    assert.equal(document.status, 200);
    assert.equal(document.headers.get("cache-control"), "no-store");
    const html = await document.text();
    assert.match(html, /<base href="\/overlay\/"/);
    assert.doesNotMatch(html, /<script\s+data-overlay-base-path>/);
    assert.match(html, /<script src="runtime\/dependencies\.js/);
    assert.match(html, /<script src="runtime\/match-local-entry\.js/);
    assert.match(document.headers.get("content-security-policy"), /script-src 'self'/);
    assert.doesNotMatch(document.headers.get("content-security-policy"), /script-src[^;]*'unsafe-inline'/);
    const head = await fetch(h.bridge, { method: "HEAD" });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const snapshot = await fetch(`${h.bridge}/state`, { headers: { Origin: h.base } });
    assert.equal(snapshot.status, 200);
    assert.equal(snapshot.headers.get("access-control-allow-origin"), h.base);
    const projected = await snapshot.json();
    assert.equal(projected.matches.session.participants[0].score, 25);
    assert.deepEqual(Object.keys(projected), ["matches"]);
    assert.doesNotMatch(JSON.stringify(projected), /private|studio-local-account|a{32}|m{24}/);
    const wrong = await fetch(h.bridge.replace(/m{24}$/, "x".repeat(24)));
    assert.equal(wrong.status, 403);
    assert.match(wrong.headers.get("content-type"), /text\/html/);
    assert.match(await wrong.text(), /<html hidden>/);
    h.state.commerce.subscription.status = "revoked";
    const denied = await fetch(h.bridge);
    assert.equal(denied.status, 403);
    assert.match(await denied.text(), /<html hidden>/);
    const deniedHead = await fetch(h.bridge, { method: "HEAD" });
    assert.equal(deniedHead.status, 403);
    assert.equal(await deniedHead.text(), "");
  } finally { await h.server.stop(); }
});

test("les tickets Studio autorisent GET/HEAD et Range suffixe, jamais POST ni origine étrangère", { timeout: 10000 }, async () => {
  const h = await fixture();
  try {
    const ticketResponse = await fetch(`${h.bridge}/ticket?match=x2&variant=gladiador`);
    assert.equal(ticketResponse.status, 200);
    const ticket = await ticketResponse.json();
    assert.match(ticket.url, /^\/match-media\/[\w-]{32}$/);
    const media = `${h.base}${ticket.url}`;
    const head = await fetch(media, { method: "HEAD", headers: { Origin: h.base } });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get("content-type"), "video/webm");
    assert.equal(await head.text(), "");
    const size = Number(head.headers.get("content-length"));
    assert.ok(size > 128);
    const suffix = await fetch(media, { headers: { Range: "bytes=-128" } });
    assert.equal(suffix.status, 206);
    assert.equal(suffix.headers.get("content-range"), `bytes ${size - 128}-${size - 1}/${size}`);
    assert.equal((await suffix.arrayBuffer()).byteLength, 128);
    const invalid = await fetch(media, { headers: { Range: "bytes=-0" } });
    assert.equal(invalid.status, 416);
    const deniedOrigin = await fetch(media, { headers: { Origin: "https://untrusted.example" } });
    assert.equal(deniedOrigin.status, 403);
    const deniedMethod = await fetch(media, { method: "POST" });
    assert.equal(deniedMethod.status, 405);
    const deniedTicketMethod = await fetch(`${h.bridge}/ticket?match=x2`, { method: "POST" });
    assert.equal(deniedTicketMethod.status, 405);
  } finally { await h.server.stop(); }
});

test("le prévol réseau privé reste limité à l'origine publique déclarée, ticket puis vidéo", { timeout: 10000 }, async () => {
  const h = await fixture();
  const origin = "https://shenpulse-overlays.web.app";
  const preflight = { method: "OPTIONS", headers: { Origin: origin,
    "Access-Control-Request-Method": "GET", "Access-Control-Request-Private-Network": "true" } };
  try {
    const ticketPreflight = await fetch(`${h.bridge}/ticket`, preflight);
    assert.equal(ticketPreflight.status, 204);
    assert.equal(ticketPreflight.headers.get("access-control-allow-origin"), origin);
    const ticketResponse = await fetch(`${h.bridge}/ticket?match=x3&variant=tikcontrol`, { headers: { Origin: origin } });
    const ticket = await ticketResponse.json();
    const mediaPreflight = await fetch(`${h.base}${ticket.url}`, preflight);
    assert.equal(mediaPreflight.status, 204);
    assert.equal(mediaPreflight.headers.get("access-control-allow-private-network"), "true");
    assert.equal(mediaPreflight.headers.get("access-control-allow-origin"), origin);
    assert.match(mediaPreflight.headers.get("access-control-allow-headers"), /Range/);
    assert.equal(mediaPreflight.headers.get("content-type"), null);
    const wrong = await fetch(`${h.base}${ticket.url}`, { ...preflight, headers: { ...preflight.headers, Origin: "https://untrusted.example" } });
    assert.equal(wrong.status, 403);
    const writePreflight = await fetch(`${h.bridge}/ticket`, { ...preflight, headers: { ...preflight.headers, "Access-Control-Request-Method": "POST" } });
    assert.equal(writePreflight.status, 405);
    h.state.settings.publicOverlayRelay.matchChannelId = "n".repeat(24);
    const rotatedTicket = await fetch(`${h.base}${ticket.url}`, { method: "HEAD" });
    assert.equal(rotatedTicket.status, 403);
  } finally { await h.server.stop(); }
});

test("le flux Studio ne reçoit que les trois sorties Match et se ferme après rotation du canal", { timeout: 10000 }, async () => {
  const h = await fixture();
  let reader;
  try {
    const response = await fetch(`${h.bridge}/events`, { headers: { Origin: h.base } });
    assert.equal(response.status, 200);
    reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /ShenPulse Match local connected/);
    h.server.publish("audio", { secret: "ordinary-audio" });
    h.server.publish("configuration", { secret: "ordinary-configuration" });
    h.server.publishEvent({ type: "gift", secret: "ordinary-event" });
    h.server.publish("match", { requestId: "test-1", match: "x2" });
    h.server.publish("match-media", { playbackId: "test-2", mediaUrl: "https://example.invalid/test.mp4" });
    h.server.publish("match-audio", { playbackId: "test-3", mediaUrl: "https://example.invalid/test.mp3" });
    let text = "";
    while (!text.includes("event: match-audio")) text += new TextDecoder().decode((await reader.read()).value);
    assert.match(text, /event: match\ndata:/);
    assert.match(text, /event: match-media/);
    assert.doesNotMatch(text, /ordinary-|event: configuration|event: audio\n|event: event\n/);
    h.state.settings.publicOverlayRelay.matchChannelId = "n".repeat(24);
    h.server.publish("match", { requestId: "should-not-arrive", match: "x3" });
    const revoked = new TextDecoder().decode((await reader.read()).value);
    assert.match(revoked, /access-revoked/);
    assert.doesNotMatch(revoked, /should-not-arrive/);
    assert.equal(h.server.sseClients.size, 0);
  } finally { await reader?.cancel(); await h.server.stop(); }
});

test("un changement de profil ou de LIVE invalide les tickets et le flux déjà ouverts", { timeout: 10000 }, async () => {
  const h = await fixture();
  let reader;
  try {
    const ticketResponse = await fetch(`${h.bridge}/ticket?match=x2&variant=tikcontrol`);
    const ticket = await ticketResponse.json();
    const response = await fetch(`${h.bridge}/events`);
    reader = response.body.getReader();
    await reader.read();
    h.state.session.profileId = "new-profile";
    h.server.refreshAccess();
    assert.match(new TextDecoder().decode((await reader.read()).value), /match-context-changed/);
    const stale = await fetch(`${h.base}${ticket.url}`, { method: "HEAD" });
    assert.equal(stale.status, 403);
    const freshResponse = await fetch(`${h.bridge}/ticket?match=x2&variant=tikcontrol`);
    assert.equal((await fetch(h.bridge)).status, 200, "la même capacité ouvre le nouveau contexte autorisé");
    const freshTicket = await freshResponse.json();
    h.state.settings.tiktok.roomId = "new-room";
    const staleRoom = await fetch(`${h.base}${freshTicket.url}`, { method: "HEAD" });
    assert.equal(staleRoom.status, 403);
  } finally { await reader?.cancel(); await h.server.stop(); }
});

test("un changement de compte ne devient jamais une récupération de profil ou de LIVE", { timeout: 10000 }, async () => {
  const h = await fixture();
  let reader;
  try {
    reader = (await fetch(`${h.bridge}/events`)).body.getReader();
    await reader.read();
    h.state.settings.account.uid = "other-account";
    h.state.session.profileId = "other-profile";
    h.server.refreshAccess();
    const output = new TextDecoder().decode((await reader.read()).value);
    assert.match(output, /match-url-regenerated/);
    assert.doesNotMatch(output, /match-context-changed/);
    const refused = await fetch(h.bridge);
    assert.equal(refused.status, 403);
    assert.match(await refused.text(), /<html hidden>/);
  } finally { await reader?.cancel(); await h.server.stop(); }
});

test("un masquage pendant un changement de profil reste une révocation définitive", { timeout: 10000 }, async () => {
  const h = await fixture();
  let reader;
  try {
    reader = (await fetch(`${h.bridge}/events`)).body.getReader();
    await reader.read();
    h.state.session.profileId = "other-profile";
    h.state.settings.siteVisibility = { navigation: { matches: "hidden" } };
    h.server.refreshAccess();
    const output = new TextDecoder().decode((await reader.read()).value);
    assert.match(output, /matches-access-revoked/);
    assert.doesNotMatch(output, /match-context-changed/);
  } finally { await reader?.cancel(); await h.server.stop(); }
});

test("la capacité locale ne remplace jamais l'authentification ni la visibilité Matchs", { timeout: 10000 }, async () => {
  const h = await fixture();
  let reader;
  try {
    const ticket = await (await fetch(`${h.bridge}/ticket?match=x2`)).json();
    const response = await fetch(`${h.bridge}/events`);
    reader = response.body.getReader();
    await reader.read();
    h.state.settings.siteVisibility = { navigation: { matches: "hidden" } };
    h.server.publish("match", { match: "x2", requestId: "hidden-effect" });
    const output = new TextDecoder().decode((await reader.read()).value);
    assert.match(output, /matches-access-revoked/);
    assert.doesNotMatch(output, /hidden-effect/);
    assert.equal((await fetch(h.bridge)).status, 403);
    assert.equal((await fetch(`${h.base}${ticket.url}`, { method: "HEAD" })).status, 403);
    h.state.settings.siteVisibility.navigation.matches = "public";
    h.store.getSecret = () => "";
    for (const suffix of ["", "/state", "/events", "/ticket?match=x2"]) {
      assert.equal((await fetch(`${h.bridge}${suffix}`)).status, 403);
    }
    // Les anciennes routes privées ne sont ni supprimées ni élargies.
    assert.equal((await fetch(h.server.urls().matchPlayer)).status, 200);
  } finally { await reader?.cancel(); await h.server.stop(); }
});

test("le widget Studio conserve son flux dédié sans exposer les effets du lecteur", { timeout: 10000 }, async () => {
  const h = await fixture();
  let reader;
  try {
    const response = await fetch(`${h.bridge}/events?widget=scoreboard`);
    assert.equal(response.status, 200);
    reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /event: bootstrap/);
    h.server.publish("match", { match: "x2", requestId: "not-a-widget" });
    h.server.publish("match-state", { config: { widgets: { scoreboard: { enabled: true } } },
      session: { status: "active", participants: [{ username: "fixture", score: 40, own: true }] } });
    const output = new TextDecoder().decode((await reader.read()).value);
    assert.match(output, /event: match-state/);
    assert.match(output, /"score":40/);
    assert.doesNotMatch(output, /not-a-widget/);
    const invalid = await fetch(`${h.bridge}/events?widget=scoreboard&widget=wins`);
    assert.equal(invalid.status, 400);
    const unknown = await fetch(`${h.bridge}/events?widget=unknown`);
    assert.equal(unknown.status, 400);
  } finally { await reader?.cancel(); await h.server.stop(); }
});
