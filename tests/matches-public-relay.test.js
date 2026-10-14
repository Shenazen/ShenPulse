"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDefaultState } = require("../src/main/defaults");
const { PublicOverlayRelay } = require("../src/main/public-overlay-relay");
const { selectStatePaths } = require("../src/main/state-projection");
const { MATCH_WIDGET_KEYS, projectMatchesOverlayState } = require("../src/main/matches-overlay-state");

const URL_KEYS = Object.freeze({ wins: "matchesWins", starDonor: "matchesStarDonor", topDonor: "matchesTopDonor", donors: "matchesDonors", timer: "matchesTimer", victory: "matchesVictory", scoreboard: "matchesScoreboard" });
const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
const response = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

/** Toutes les requêtes sont interceptées : aucun compte ou LIVE réel n'est utilisé. */
function harness({ fetchPatch } = {}) {
  const state = createDefaultState();
  state.settings.account = { uid: "fixture-account", email: "fixture@example.invalid", refreshTokenSecretId: "fixture-account-secret" };
  state.commerce.subscription = { tier: "pro", source: "paid", status: "active" };
  state.settings.overlayToken = "private-local-overlay-token";
  state.settings.apiToken = "private-local-api-token";
  state.settings.matches = { widgets: Object.fromEntries(MATCH_WIDGET_KEYS.map((key) => [key, { enabled: true, title: key, theme: "neon" }])), automations: [{ id: "private-automation", action: { token: "private-device-token" } }] };
  state.settings.matches.widgets.wins.customText = "Mes manches";
  state.matchSession = { status: "running", battleId: "private-battle", roomId: "private-room", ownerUid: "private-owner", profileId: "private-profile", scope: "private-scope", startedAtMs: Date.now() - 1000, endsAtMs: Date.now() + 59000,
    manualWins: 4, rounds: { own: 3, opponent: 2 }, result: null,
    participants: [{ id: "private-participant", username: "creator", displayName: "Créateur", avatarUrl: "https://p16-sign-sg.tiktokcdn.com/public.webp", score: 55, own: true, donors: [{ id: "private-donor", username: "supporter", score: 12 }] }, { id: "private-opponent", username: "opponent", score: null }],
    session: { battles: 5, wins: 3, losses: 2, draws: 0, winStreak: 1 }, history: [{ secret: "private-history" }], pairRounds: [{ uid: "private-pair" }], liveContributors: [{ id: "private-contributor", username: "supporter", diamonds: 12, likes: 20, gifts: 1 }]
  };
  state.logs = [{ secret: "private-log" }];
  state.accountWorkspaces = { elsewhere: { secret: "private-workspace" } };
  const secrets = new Map([["fixture-account-secret", "private-auth-refresh-token"]]);
  const projections = [];
  const store = {
    getState() { throw new Error("Le relais ne doit pas cloner tout le compte"); },
    getStateProjection(paths) { projections.push([...paths]); return selectStatePaths(state, paths); },
    getAccountSession: () => state.settings.account,
    getActiveAccountUid: () => state.settings.account.uid,
    mutate(callback) { callback(state); },
    getSecret: (key) => secrets.get(key) || "",
    setSecret(key, value) { const next = key || `fixture-secret-${secrets.size + 1}`; secrets.set(next, String(value)); return next; }
  };
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    const request = { url: String(url), method: options.method, signal: options.signal, body: options.body && (options.headers?.["Content-Type"] === "application/x-www-form-urlencoded" ? Object.fromEntries(new URLSearchParams(options.body)) : JSON.parse(options.body)) };
    requests.push(request);
    if (request.url.includes("accounts:signUp")) return response(200, { idToken: "fixture-installation-token", refreshToken: "fixture-installation-refresh", localId: "fixture-installation", expiresIn: "3600" });
    if (request.url.includes("securetoken.googleapis.com")) return response(200, { id_token: "fixture-installation-token", refresh_token: "fixture-installation-refresh", user_id: "fixture-installation", expires_in: "3600" });
    if (options.method === "PATCH" && fetchPatch) return fetchPatch(request);
    return response(200);
  };
  const relay = new PublicOverlayRelay({ store, fetchImpl });
  const writes = () => requests.filter((row) => row.method === "PATCH");
  const matchWrites = () => writes().filter((row) => Object.hasOwn(row.body, "matchSource"));
  const genericWrites = () => writes().filter((row) => !Object.hasOwn(row.body, "matchSource"));
  return { state, store, secrets, projections, requests, relay, writes, matchWrites, genericWrites };
}

test("Matchs publics : sept sources HTTPS stables, sans jeton local et avec un canal dédié", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  const urls = h.relay.urls();
  for (const widget of MATCH_WIDGET_KEYS) {
    const url = urls[URL_KEYS[widget]];
    assert.equal(url, `${urls.matchPlayer}?widget=${widget}`);
    assert.match(url, /^https:\/\/shenpulse-overlays\.web\.app\/m\/\d{12}\/[A-Za-z0-9_-]{24}\?widget=/);
    assert.doesNotMatch(url, /127\.0\.0\.1|localhost|token=|fixture-account|private-/);
  }
  assert.deepEqual(h.relay.urls(), urls);
  await h.relay.start();
  await h.relay.rotateMatchChannel();
  assert.notEqual(h.relay.urls().matchesWins, urls.matchesWins);
  assert.equal(h.relay.urls().timer, urls.timer, "la rotation Matchs ne change pas les autres sources");
  assert.ok(h.requests.some((row) => row.method === "DELETE"));
});

test("Matchs publics : les droits réels limitent les URL et includeRestricted ne publie aucune donnée", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  h.state.settings.siteVisibility.navigation.matches = "hidden";
  for (const key of Object.values(URL_KEYS)) assert.equal(h.relay.urls()[key], "");
  assert.ok(h.relay.urls({ includeRestricted: true }).matchesWins);
  await h.relay.start();
  const alias = h.matchWrites().at(-1).body;
  assert.equal(alias.matchSource.widgetsEnabled, false);
  assert.equal(alias.state.matches, null);
});

test("Matchs publics : l'alias contient la projection publique, jamais les données privées", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  const alias = h.matchWrites().at(-1).body;
  assert.equal(alias.matchSource.widgetsEnabled, true);
  assert.equal(alias.presence.connected, true);
  assert.deepEqual(alias.state.matches, projectMatchesOverlayState(h.state));
  assert.equal(alias.state.matches.session.status, "active");
  assert.equal(alias.state.matches.session.manualWins, 4);
  assert.equal(alias.state.matches.config.widgets.wins.customText, "Mes manches");
  assert.equal(alias.state.matches.session.participants[0].score, 55);
  assert.equal(alias.state.matches.session.participants[1].score, null);
  assert.equal(alias.state.matches.session.participants[0].avatarUrl, "https://p16-sign-sg.tiktokcdn.com/public.webp");
  assert.doesNotMatch(JSON.stringify(alias), /private-|battleId|roomId|profileId|scope|pairRounds|history|automations|refreshToken|apiToken|overlayToken/);
  assert.ok(h.projections.every((paths) => !paths.includes("matchSession") && !paths.includes("settings") && !paths.includes("logs") && !paths.includes("accountWorkspaces")));
});

test("Matchs publics : les scores sont coalescés et actualisés sans PATCH si les données sont identiques", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  for (let index = 0; index < 30; index += 1) h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 0);
  for (let score = 56; score <= 80; score += 1) {
    h.state.matchSession.participants[0].score = score;
    h.relay.publishState();
  }
  await pause();
  assert.equal(h.matchWrites().length, 1);
  assert.equal(h.matchWrites()[0].body.state.matches.session.participants[0].score, 80);
  assert.equal(h.genericWrites().length, 0, "un score ne modifie pas les autres overlays");
  h.requests.length = 0;
  h.relay.publishState();
  await pause();
  assert.equal(h.writes().length, 0);
});

test("Matchs publics : une modification du widget ou du compteur manuel arrive via l'alias", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  h.state.settings.matches.widgets.wins.theme = "gold";
  h.state.matchSession.manualWins = 9;
  h.relay.publishState();
  await pause();
  assert.equal(h.matchWrites().length, 1);
  const matches = h.matchWrites()[0].body.state.matches;
  assert.equal(matches.config.widgets.wins.theme, "gold");
  assert.equal(matches.session.manualWins, 9);
  assert.equal(h.genericWrites().length, 0);
});

test("Matchs publics : fin de droits, visibilité ou authentification effacent l'alias", async (t) => {
  const changes = [
    (h) => { h.state.commerce.subscription = { tier: "free", status: "active" }; },
    (h) => { h.state.commerce.subscription = { tier: "pro", source: "trial", status: "trial", expiresAtMs: Date.now() - 1000 }; },
    (h) => { h.state.settings.siteVisibility.navigation.matches = "hidden"; },
    (h) => { h.state.settings.account = {}; },
    (h) => { h.secrets.delete("fixture-account-secret"); }
  ];
  for (const change of changes) {
    const h = harness();
    t.after(() => h.relay.stop());
    await h.relay.start();
    h.requests.length = 0;
    change(h);
    h.relay.publishState();
    await pause();
    assert.equal(h.matchWrites().length, 1);
    assert.equal(h.matchWrites()[0].body.matchSource.widgetsEnabled, false);
    assert.equal(h.matchWrites()[0].body.state.matches, null);
    for (const key of Object.values(URL_KEYS)) assert.equal(h.relay.urls()[key], "");
  }
});

test("Matchs publics : arrêter ShenPulse retire les données et la présence de l'alias", async () => {
  const h = harness();
  await h.relay.start();
  h.requests.length = 0;
  await h.relay.stop();
  assert.equal(h.matchWrites().length, 1);
  assert.equal(h.matchWrites()[0].body.presence.connected, false);
  assert.equal(h.matchWrites()[0].body.state.matches, null);
});

test("Matchs publics : ni l'état général ni les lots ordinaires n'exposent les matchs", async (t) => {
  const h = harness();
  t.after(() => h.relay.stop());
  await h.relay.start();
  const initialGeneric = h.genericWrites()[0].body;
  assert.equal(Object.hasOwn(initialGeneric.state, "matches"), false);
  h.requests.length = 0;
  h.state.statistics.likes = 15;
  h.relay.publishState();
  h.relay.publish("timer", { operation: "set", seconds: 30 });
  await pause();
  const generic = h.genericWrites();
  assert.ok(generic.some((row) => row.body.lastBatch));
  for (const row of generic) {
    assert.equal(Object.hasOwn(row.body.state || {}, "matches"), false);
    assert.equal(Object.hasOwn(row.body.lastBatch?.state || {}, "matches"), false);
    assert.doesNotMatch(JSON.stringify(row.body), /private-|manualWins|participants|Créateur/);
  }
});

test("Matchs publics : un heartbeat lent ne peut rétablir le profil après révocation des droits", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let stallNextAlias = false;
  const commits = [];
  const h = harness({ fetchPatch: async (request) => {
    if (stallNextAlias && request.body.matchSource) {
      stallNextAlias = false;
      await gate;
    }
    if (request.body.matchSource) commits.push(request.body);
    return response(200);
  } });
  t.after(() => { release(); return h.relay.stop(); });
  await h.relay.start();
  h.requests.length = 0;
  commits.length = 0;
  h.state.matchSession.participants[0].score = 100;
  stallNextAlias = true;
  t.mock.timers.tick(45000);
  await pause();
  assert.equal(h.matchWrites().length, 1);
  assert.equal(h.matchWrites()[0].body.state.matches.session.participants[0].score, 100);
  assert.equal(commits.length, 0);

  h.state.session.profileId = "next-profile";
  h.state.matchSession.participants[0].username = "next_creator";
  h.state.commerce.subscription = { tier: "free", status: "active" };
  h.relay.publishState();
  t.mock.timers.tick(45000);
  await pause();
  assert.equal(h.matchWrites().length, 1, "la révocation et le heartbeat suivant attendent l'écriture précédente");
  release();
  await h.relay.publicationPromise;
  await pause();
  assert.ok(commits.length >= 2);
  assert.equal(commits[0].state.matches.session.participants[0].score, 100);
  assert.equal(commits[1].state.matches, null);
  assert.equal(commits.at(-1).matchSource.widgetsEnabled, false);
  let remoteMatches;
  for (const body of commits) {
    if (Object.hasOwn(body, "state")) remoteMatches = body.state.matches;
  }
  assert.equal(remoteMatches, null, "aucune arrivée tardive du heartbeat ne restaure les données privées");
  t.mock.timers.tick(45000);
  await h.relay.publicationPromise;
  await pause();
  assert.equal(Object.hasOwn(commits.at(-1), "state"), false, "le heartbeat inchangé ne renvoie pas les participants");
});

test("Matchs publics : arrêter pendant un heartbeat lent annule la requête et laisse l'alias vide", async (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let stallNextAlias = false;
  let stalled;
  const commits = [];
  const h = harness({ fetchPatch: async (request) => {
    if (stallNextAlias && request.body.matchSource) {
      stallNextAlias = false;
      stalled = request;
      return new Promise((resolve, reject) => request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true }));
    }
    if (request.body.matchSource) commits.push(request.body);
    return response(200);
  } });
  t.after(() => h.relay.stop());
  await h.relay.start();
  h.requests.length = 0;
  commits.length = 0;
  h.state.matchSession.participants[0].score = 90;
  stallNextAlias = true;
  t.mock.timers.tick(45000);
  await pause();
  assert.ok(stalled);
  h.state.matchSession.participants[0].score = 120;
  h.relay.publishState();
  t.mock.timers.tick(45000);
  await pause();
  assert.equal(h.matchWrites().length, 1);
  await h.relay.stop();
  assert.equal(stalled.signal.aborted, true);
  assert.equal(h.relay.requestControllers.size, 0);
  assert.equal(h.relay.status().connected, false);
  assert.equal(commits.length, 1, "la fermeture seule peut publier après l'annulation");
  assert.equal(commits[0].presence.connected, false);
  assert.equal(commits[0].state.matches, null);
  assert.equal(h.matchWrites().at(-1).body.presence.connected, false);
  assert.equal(h.matchWrites().at(-1).body.state.matches, null);
  const requestCount = h.requests.length;
  t.mock.timers.tick(45000);
  await pause();
  assert.equal(h.requests.length, requestCount, "aucun heartbeat en attente ne se réactive après la fermeture");
});
